import { useEffect, useState, useCallback, useRef, useMemo } from "react";
import { usePrivy, useWallets } from "@privy-io/react-auth";
import { ethers } from "ethers";
import { AnonymousTransferClient } from "@fairblock/stabletrust";
import { parseError, AppError } from "../utils/errorParser";
import { getRpcUrl } from "../actions/rpc";
import { sendFaucet } from "../actions/faucet";

const FAIRYCLOAK_URL = process.env.NEXT_PUBLIC_FAIRYCLOAK_URL || "";
const CHAIN_ID = parseInt(process.env.NEXT_PUBLIC_CHAIN_ID || "84532");
const TOKEN_ADDRESS =
  process.env.NEXT_PUBLIC_TOKEN_ADDRESS ||
  "0x036CbD53842c5426634e7929541eC2318f3dCF7e";
const EXPLORER_URL =
  process.env.NEXT_PUBLIC_EXPLORER_URL || "https://sepolia.basescan.org/tx/";

export interface AnonymousConfig {
  rpcUrl: string;
  tokenAddress: string;
  explorerUrl: string;
  chainId: number;
}

const DEFAULT_CONFIG: AnonymousConfig = {
  rpcUrl: "https://base-sepolia.drpc.org",
  tokenAddress: TOKEN_ADDRESS,
  explorerUrl: EXPLORER_URL,
  chainId: CHAIN_ID,
};

const ACCOUNT_ID_KEY = (address: string) =>
  `anon_account_${address.toLowerCase()}_${CHAIN_ID}`;

// JsonRpcSigner (and NonceManager wrapping it) throws UNSUPPORTED_OPERATION when
// the SDK calls signer.connect(provider) internally. This proxy makes connect() a
// safe no-op that returns the same signer, which is already bound to the wallet.
function wrapSignerForBrowser(signer: ethers.Signer): ethers.Signer {
  return new Proxy(signer, {
    get(target, prop, receiver) {
      if (prop === "connect") return () => receiver;
      const val = Reflect.get(target, prop, target);
      return typeof val === "function" ? val.bind(target) : val;
    },
  });
}

export function useAnonymousClient() {
  const { authenticated, user } = usePrivy();
  const { wallets } = useWallets();
  const [config, setConfig] = useState<AnonymousConfig>(DEFAULT_CONFIG);
  const client = useMemo<AnonymousTransferClient | null>(() => {
    if (!FAIRYCLOAK_URL) return null;
    try {
      return new AnonymousTransferClient({
        fairycloakUrl: FAIRYCLOAK_URL,
        chainId: config.chainId,
        rpcUrl: config.rpcUrl,
      });
    } catch (err) {
      console.error("Failed to initialize anonymous client", err);
      return null;
    }
  }, [config.rpcUrl, config.chainId]);
  const [signer, setSigner] = useState<ethers.Signer | null>(null);
  const [accountId, setAccountId] = useState<string | null>(null);
  const [anonymousKeys, setAnonymousKeys] = useState<{
    publicKey: string;
    privateKey: string;
  } | null>(null);
  const [anonymousBalance, setAnonymousBalance] = useState({
    available: 0,
    pending: 0,
    amount: 0,
  });
  const [publicBalance, setPublicBalance] = useState("0");
  const [nativeBalance, setNativeBalance] = useState("0");
  const [prepaidFeeBalance, setPrepaidFeeBalance] = useState<bigint>(0n);
  const [feeAmount, setFeeAmount] = useState<bigint>(0n);
  const [feeToken, setFeeToken] = useState<string | null>(null);
  const [tokenDecimals, setTokenDecimals] = useState(6);
  const [tokenSymbol, setTokenSymbol] = useState("USDC");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastTxHash, setLastTxHash] = useState<string | null>(null);

  const signerAddressRef = useRef<string | null>(null);
  const signerPending = useRef(false);
  const isFetching = useRef(false);
  const fetchBalancesRef = useRef<(silent?: boolean) => Promise<void>>(
    async () => {},
  );

  useEffect(() => {
    async function initRpc() {
      try {
        const res = await getRpcUrl();
        if (res.success && res.rpcUrl) {
          setConfig((prev) => ({ ...prev, rpcUrl: res.rpcUrl }));
        }
      } catch {}
    }
    initRpc();
  }, []);

  useEffect(() => {
    async function fetchTokenDetails() {
      try {
        const provider = new ethers.JsonRpcProvider(config.rpcUrl);
        const tokenContract = new ethers.Contract(
          config.tokenAddress,
          [
            "function symbol() view returns (string)",
            "function decimals() view returns (uint8)",
          ],
          provider,
        );
        const [sym, dec] = await Promise.all([
          tokenContract.symbol().catch(() => "TKN"),
          tokenContract.decimals().catch(() => 6),
        ]);
        setTokenSymbol(sym);
        setTokenDecimals(Number(dec));
      } catch {}
    }
    fetchTokenDetails();
  }, [config.rpcUrl, config.tokenAddress]);

  useEffect(() => {
    let cancelled = false;
    async function getSigner() {
      if (authenticated && wallets.length > 0) {
        // Anonymous deposits and fee top-ups require raw transaction signing
        // (eth_signTransaction), which MetaMask does NOT support. Privy's embedded
        // wallet does always prefer it for anonymous mode.
        const embedded = wallets.find(
          (w) =>
            w.walletClientType === "privy" || w.walletClientType === "privy-v2",
        );
        let wallet = embedded ?? wallets[0];
        const walletAddress = wallet.address.toLowerCase();
        if (signerAddressRef.current === walletAddress) return;
        if (signerPending.current) return;
        signerPending.current = true;
        try {
          await wallet.switchChain(config.chainId);
          if (cancelled) return;
          const provider = await wallet.getEthereumProvider();
          if (cancelled) return;
          const ethersProvider = new ethers.BrowserProvider(provider);
          const s = await ethersProvider.getSigner();
          if (cancelled) return;
          signerAddressRef.current = walletAddress;
          setSigner(wrapSignerForBrowser(s));
          setError(null);
        } catch (err) {
          if (cancelled) return;
          signerAddressRef.current = null;
          setSigner(null);
          setError(`Wallet setup failed: ${(err as Error).message}`);
        } finally {
          signerPending.current = false;
        }
      } else {
        signerAddressRef.current = null;
        setSigner(null);
        setAccountId(null);
        setAnonymousKeys(null);
      }
    }
    getSigner();
    return () => {
      cancelled = true;
    };
  }, [authenticated, wallets, config.chainId, user]);

  // Load saved account ID from localStorage
  useEffect(() => {
    if (!signer) return;
    async function loadSavedAccount() {
      try {
        const address = await signer!.getAddress();
        const saved = localStorage.getItem(ACCOUNT_ID_KEY(address));
        if (saved) setAccountId(saved);
      } catch {}
    }
    loadSavedAccount();
  }, [signer]);

  // Re-derive keys whenever accountId changes
  useEffect(() => {
    if (!client || !signer || !accountId) return;
    async function rederiveKeys() {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const keys = await client!.deriveAnonymousKeys(
          signer as any,
          accountId!,
        );
        setAnonymousKeys(keys);
      } catch (err) {
        console.warn("Failed to re-derive anonymous keys", err);
      }
    }
    rederiveKeys();
  }, [client, signer, accountId]);

  const fetchBalances = useCallback(
    async (silent = false) => {
      if (!signer) return;
      if (isFetching.current) return;
      isFetching.current = true;
      if (!silent) setLoading(true);
      try {
        const address = await signer.getAddress();
        const provider =
          signer.provider || new ethers.JsonRpcProvider(config.rpcUrl);

        const nativeBal = await provider.getBalance(address);
        setNativeBalance(ethers.formatEther(nativeBal));

        const erc20 = new ethers.Contract(
          config.tokenAddress,
          ["function balanceOf(address) view returns (uint256)"],
          provider,
        );
        try {
          const pubBal = await erc20.balanceOf(address);
          setPublicBalance(ethers.formatUnits(pubBal, tokenDecimals));
        } catch {}

        if (client && accountId && anonymousKeys) {
          try {
            const bal = await client.getBalance(
              accountId,
              config.tokenAddress,
              anonymousKeys.privateKey,
            );
            setAnonymousBalance({
              available: bal.available,
              pending: bal.pending,
              amount: bal.amount,
            });
          } catch {}

          try {
            const feeTokenAddr = await client.getFeeToken();
            setFeeToken(feeTokenAddr);
            const [feeBal, fee] = await Promise.all([
              client.getPrepaidFeeBalance(accountId, feeTokenAddr),
              client.getFeeAmount(),
            ]);
            setPrepaidFeeBalance(feeBal);
            setFeeAmount(fee);
          } catch {}
        }
      } catch (err) {
        console.error("Error fetching anonymous balances:", err);
      } finally {
        isFetching.current = false;
        if (!silent) setLoading(false);
      }
    },
    [
      client,
      signer,
      accountId,
      anonymousKeys,
      config.tokenAddress,
      config.rpcUrl,
      tokenDecimals,
    ],
  );

  useEffect(() => {
    fetchBalancesRef.current = fetchBalances;
  }, [fetchBalances]);

  useEffect(() => {
    if (!signer) return;
    fetchBalancesRef.current(true);
    const interval = setInterval(() => fetchBalancesRef.current(true), 15000);
    return () => clearInterval(interval);
  }, [signer, accountId, anonymousKeys]);

  const setupAccount = useCallback(
    async (id: string) => {
      if (!client || !signer) throw new Error("Client or signer not ready");
      setLoading(true);
      setError(null);
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const keys = await client.deriveAnonymousKeys(signer as any, id);
        // ensureAnonymousAccount exists at runtime but is missing from the .d.ts
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (client as any).ensureAnonymousAccount(
          signer as any,
          id,
          keys.publicKey,
        );
        setAnonymousKeys(keys);
        setAccountId(id);
        const address = await signer.getAddress();
        localStorage.setItem(ACCOUNT_ID_KEY(address), id);
        setTimeout(() => fetchBalancesRef.current(true), 2000);
      } catch (err) {
        const msg = parseError(err as AppError);
        setError(msg);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [client, signer],
  );

  const clearAccount = useCallback(async () => {
    if (!signer) return;
    try {
      const address = await signer.getAddress();
      localStorage.removeItem(ACCOUNT_ID_KEY(address));
    } catch {}
    setAccountId(null);
    setAnonymousKeys(null);
    setAnonymousBalance({ available: 0, pending: 0, amount: 0 });
    setPrepaidFeeBalance(0n);
  }, [signer]);

  const anonymousDeposit = useCallback(
    async (amount: string) => {
      if (!client || !signer || !accountId)
        throw new Error("Not ready account not set up");
      setLoading(true);
      setError(null);
      try {
        const amountWei = ethers.parseUnits(amount, tokenDecimals);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const result = await client.deposit(
          signer as any,
          accountId,
          config.tokenAddress,
          amountWei,
        );
        const hash = result.tx_hash || result.request_id;
        setTimeout(() => fetchBalancesRef.current(true), 3000);
        setLastTxHash(hash || null);
        return { hash: hash || "" };
      } catch (err) {
        const msg = parseError(err as AppError);
        setError(msg);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [client, signer, accountId, config.tokenAddress, tokenDecimals],
  );

  const anonymousTransferToPublic = useCallback(
    async (recipient: string, amount: string) => {
      if (!client || !signer || !accountId || !anonymousKeys)
        throw new Error("Not ready");
      setLoading(true);
      setError(null);
      try {
        const amountWei = ethers.parseUnits(amount, tokenDecimals);
        const result = await client.transferToPublic(signer, accountId, {
          recipient,
          token: config.tokenAddress,
          elGamalPrivateKey: anonymousKeys.privateKey,
          amount: amountWei,
        });
        await client.waitForRequest(result.request_id);
        const hash = result.tx_hash || result.request_id;
        setTimeout(() => fetchBalancesRef.current(true), 3000);
        setLastTxHash(hash || null);
        return { hash: hash || "" };
      } catch (err) {
        const msg = parseError(err as AppError);
        setError(msg);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [
      client,
      signer,
      accountId,
      anonymousKeys,
      config.tokenAddress,
      tokenDecimals,
    ],
  );

  const anonymousTransferToAnonymous = useCallback(
    async (recipientId: string, amount: string) => {
      if (!client || !signer || !accountId || !anonymousKeys)
        throw new Error("Not ready");
      setLoading(true);
      setError(null);
      try {
        const amountWei = ethers.parseUnits(amount, tokenDecimals);
        const result = await client.transferToAnonymous(signer, accountId, {
          recipientId,
          token: config.tokenAddress,
          elGamalPrivateKey: anonymousKeys.privateKey,
          amount: amountWei,
        });
        await client.waitForRequest(result.request_id);
        const hash = result.tx_hash || result.request_id;
        setTimeout(() => fetchBalancesRef.current(true), 3000);
        setLastTxHash(hash || null);
        return { hash: hash || "" };
      } catch (err) {
        const msg = parseError(err as AppError);
        setError(msg);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [
      client,
      signer,
      accountId,
      anonymousKeys,
      config.tokenAddress,
      tokenDecimals,
    ],
  );

  const anonymousWithdraw = useCallback(
    async (destination: string, amount: string) => {
      if (!client || !signer || !accountId || !anonymousKeys)
        throw new Error("Not ready");
      setLoading(true);
      setError(null);
      try {
        const amountWei = ethers.parseUnits(amount, tokenDecimals);
        const result = await client.withdraw(signer, accountId, {
          destination,
          token: config.tokenAddress,
          plainAmount: amountWei,
          elGamalPrivateKey: anonymousKeys.privateKey,
        });
        await client.waitForRequest(result.request_id);
        const hash = result.tx_hash || result.request_id;
        setTimeout(() => fetchBalancesRef.current(true), 3000);
        setLastTxHash(hash || null);
        return { hash: hash || "" };
      } catch (err) {
        const msg = parseError(err as AppError);
        setError(msg);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [
      client,
      signer,
      accountId,
      anonymousKeys,
      config.tokenAddress,
      tokenDecimals,
    ],
  );

  const topUpFees = useCallback(
    async (amount: string) => {
      if (!client || !signer || !accountId) throw new Error("Not ready");
      setLoading(true);
      setError(null);
      try {
        const amountWei = ethers.parseUnits(amount, tokenDecimals);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const result = await client.depositFees(
          signer as any,
          accountId,
          amountWei,
        );
        const hash = result.tx_hash || result.request_id;
        setTimeout(() => fetchBalancesRef.current(true), 3000);
        setLastTxHash(hash || null);
        return { hash: hash || "" };
      } catch (err) {
        const msg = parseError(err as AppError);
        setError(msg);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [client, signer, accountId, tokenDecimals],
  );

  const requestFaucet = useCallback(async () => {
    if (!signer) throw new Error("Signer not initialized");
    setLoading(true);
    setError(null);
    try {
      const address = await signer.getAddress();
      const result = await sendFaucet(address);
      if (!result.success)
        throw new Error(result.error || "Faucet request failed");
      setTimeout(() => fetchBalancesRef.current(true), 2000);
      return result;
    } catch (err) {
      const msg = parseError(err as AppError);
      setError(msg);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [signer]);

  // Transfers remaining = floor(feeBalance / feePerTransfer)
  const transfersRemaining =
    feeAmount > 0n
      ? Math.floor(Number(prepaidFeeBalance) / Number(feeAmount))
      : null;

  // Anonymous balance in human-readable tokens: contractScale / 100
  const anonBalanceDisplay = {
    available: (anonymousBalance.available / 100).toFixed(2),
    pending: (anonymousBalance.pending / 100).toFixed(2),
    total: (anonymousBalance.amount / 100).toFixed(2),
  };

  const relayConfigured = Boolean(FAIRYCLOAK_URL);
  const feeTokenIsNative = feeToken !== null && feeToken === ethers.ZeroAddress;
  const feeLoaded = feeToken !== null;

  function formatFeeUnits(raw: bigint, decimals: number): string {
    if (raw === 0n) return "—";
    const value = Number(raw) / Math.pow(10, decimals);
    // Use enough decimal places to show at least 2 significant digits
    const places = Math.min(Math.max(4, Math.ceil(-Math.log10(value)) + 2), 10);
    return value.toFixed(places).replace(/\.?0+$/, "");
  }

  const feePerTransferDisplay = feeLoaded
    ? feeAmount > 0n
      ? formatFeeUnits(feeAmount, tokenDecimals)
      : "0"
    : "—";

  const tenTransfersFee =
    feeAmount > 0n ? formatFeeUnits(feeAmount * 10n, tokenDecimals) : "";

  return {
    config,
    client,
    signer,
    accountId,
    anonymousKeys,
    anonBalanceDisplay,
    publicBalance,
    nativeBalance,
    prepaidFeeBalance,
    feeAmount,
    feeToken,
    tokenDecimals,
    feeTokenIsNative,
    feeLoaded,
    feePerTransferDisplay,
    tenTransfersFee,
    transfersRemaining,
    tokenSymbol,
    loading,
    error,
    lastTxHash,
    relayConfigured,
    setupAccount,
    clearAccount,
    fetchBalances,
    requestFaucet,
    anonymousDeposit,
    anonymousTransferToPublic,
    anonymousTransferToAnonymous,
    anonymousWithdraw,
    topUpFees,
  };
}
