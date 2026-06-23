import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { usePrivy, useWallets } from "@privy-io/react-auth";
import { ethers } from "ethers";
import { ConfidentialTransferClient } from "@fairblock/stabletrust";
import { parseError, AppError } from "../utils/errorParser";
import { getRpcUrl } from "../actions/rpc";
import { sendFaucet } from "../actions/faucet";

export interface ConfidentialConfig {
  rpcUrl: string;
  tokenAddress: string;
  explorerUrl: string;
  chainId: number;
}

const DEFAULT_CONFIG: ConfidentialConfig = {
  rpcUrl: "https://rpc.testnet.stable.xyz",
  tokenAddress:
    process.env.NEXT_PUBLIC_TOKEN_ADDRESS ||
    "0x78cf24370174180738c5b8e352b6d14c83a6c9a9",
  explorerUrl:
    process.env.NEXT_PUBLIC_EXPLORER_URL ||
    "https://testnet.stablescan.xyz/tx/",
  chainId: Number.parseInt(process.env.NEXT_PUBLIC_CHAIN_ID || "2201"),
};

export function useConfidentialClient() {
  const { authenticated, user } = usePrivy();
  const { wallets } = useWallets();
  const [config, setConfig] = useState<ConfidentialConfig>(DEFAULT_CONFIG);

  const client = useMemo(() => {
    try {
      return new ConfidentialTransferClient(config.rpcUrl, config.chainId);
    } catch (err) {
      console.error("Failed to initialize client", err);
      return null;
    }
  }, [config.rpcUrl, config.chainId]);

  const [signer, setSigner] = useState<ethers.Signer | null>(null);
  const [userKeys, setUserKeys] = useState<{
    publicKey: string;
    privateKey: string;
  } | null>(null);
  const [balances, setBalances] = useState({
    public: "0",
    confidential: "0",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tokenSymbol, setTokenSymbol] = useState("TKN");
  const [tokenDecimals, setTokenDecimals] = useState(18);
  const [lastTxHash, setLastTxHash] = useState<string | null>(null);

  const isFetching = useRef(false);
  const signerAddressRef = useRef<string | null>(null);
  const signerPending = useRef(false);

  useEffect(() => {
    async function initRpc() {
      try {
        const res = await getRpcUrl();
        if (res.success && res.rpcUrl) {
          setConfig((prev) => ({ ...prev, rpcUrl: res.rpcUrl }));
        }
      } catch (err) {
        console.warn("Failed to fetch RPC URL", err);
      }
    }
    initRpc();
  }, []);

  useEffect(() => {
    async function fetchTokenDetails() {
      if (!config.tokenAddress || !config.rpcUrl) return;
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
          tokenContract.decimals().catch(() => 18),
        ]);
        setTokenSymbol(sym);
        setTokenDecimals(Number(dec));
      } catch (err) {
        console.warn("Failed to fetch token details", err);
      }
    }
    fetchTokenDetails();
  }, [config.tokenAddress, config.rpcUrl]);

  useEffect(() => {
    let cancelled = false;

    async function getSigner() {
      if (authenticated && wallets.length > 0) {
        let wallet = wallets[0];

        if (user) {
          const linkedSmartWalletAddress = (user.linkedAccounts?.find(
            (account: { type: string }) => account.type === "smart_wallet",
          ) as { address?: string } | undefined)?.address;
          const linkedWalletAddress = (user.linkedAccounts?.find(
            (account: { type: string }) => account.type === "wallet",
          ) as { address?: string } | undefined)?.address;
          const resolvedAddress =
            user.wallet?.address ??
            linkedSmartWalletAddress ??
            linkedWalletAddress;

          if (resolvedAddress) {
            const matchingWallet = wallets.find(
              (w) => w.address.toLowerCase() === resolvedAddress.toLowerCase(),
            );
            if (matchingWallet) {
              wallet = matchingWallet;
            } else {
              return;
            }
          }
        }

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
          // Stable chain is Cosmos EVM — it tracks nonces sequentially on-chain.
          // NonceManager's optimistic local counter over-counts when a tx is rejected,
          // causing "nonce too high" errors. Use the raw signer instead.
          setSigner(s);
          setError(null);
        } catch (err) {
          if (cancelled) return;
          console.error("Failed to set signer:", err);
          signerAddressRef.current = null;
          setSigner(null);
          setError(
            `Wallet setup failed: ${(err as Error).message ?? "unknown error"}. ` +
            `Make sure your wallet is unlocked and switched to Stable Testnet (chain ID ${config.chainId}).`,
          );
        } finally {
          signerPending.current = false;
        }
      } else {
        signerAddressRef.current = null;
        setSigner(null);
        setUserKeys(null);
        setBalances({ public: "0", confidential: "0" });
      }
    }

    getSigner();
    return () => {
      cancelled = true;
    };
  }, [authenticated, wallets, config.chainId, user]);

  const ensureAccount = useCallback(async () => {
    if (!client || !signer) {
      setError("Wallet not ready — please wait a moment and try again, or refresh the page.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const keys = await client.ensureAccount(signer);
      setUserKeys(keys);
      return keys;
    } catch (err) {
      const errorMessage = parseError(err as AppError);
      setError(errorMessage);
      console.error(err);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [client, signer]);

  const fetchBalances = useCallback(
    async (silent: boolean = false) => {
      if (!signer) return;
      if (isFetching.current) return;
      isFetching.current = true;
      if (!silent) setLoading(true);
      try {
        const address = await signer.getAddress();

        let publicBal = BigInt(0);
        let confidentialBal: { amount: bigint } = { amount: BigInt(0) };

        if (client) {
          try {
            publicBal = await client.getPublicBalance(
              address,
              config.tokenAddress,
            );
          } catch (e) {
            console.warn("Failed to fetch public balance", e);
          }
        }

        if (client && userKeys) {
          try {
            const cb = await client.getConfidentialBalance(
              address,
              userKeys.privateKey,
              config.tokenAddress,
            );
            confidentialBal = { amount: BigInt(cb.amount) };
          } catch (e) {
            console.warn("Failed to fetch confidential balance", e);
          }
        }

        setBalances({
          public: ethers.formatUnits(publicBal, tokenDecimals),
          confidential: ethers.formatUnits(confidentialBal.amount, tokenDecimals),
        });
      } catch (err) {
        console.error("Error fetching balances:", err);
      } finally {
        isFetching.current = false;
        if (!silent) setLoading(false);
      }
    },
    [client, signer, userKeys, config.tokenAddress, tokenDecimals],
  );

  const fetchBalancesRef = useRef(fetchBalances);
  useEffect(() => {
    fetchBalancesRef.current = fetchBalances;
  }, [fetchBalances]);

  useEffect(() => {
    if (!signer) return;
    fetchBalancesRef.current(true);
    const interval = setInterval(() => fetchBalancesRef.current(true), 10000);
    return () => clearInterval(interval);
  }, [signer]);

  const confidentialDeposit = useCallback(
    async (amount: string) => {
      if (!client || !signer)
        throw new Error("Client or signer not initialized");
      setLoading(true);
      setError(null);
      try {
        const amountWei = ethers.parseUnits(amount, tokenDecimals);
        const receipt = await client.confidentialDeposit(
          signer,
          config.tokenAddress,
          amountWei,
        );
        setTimeout(() => fetchBalancesRef.current(true), 2000);
        setLastTxHash(receipt.hash);
        return { hash: receipt.hash };
      } catch (err) {
        const errorMessage = parseError(err as AppError);
        setError(errorMessage);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [client, signer, config.tokenAddress, tokenDecimals],
  );

  const confidentialTransfer = useCallback(
    async (recipient: string, amount: string) => {
      if (!client || !signer)
        throw new Error("Client or signer not initialized");
      setLoading(true);
      setError(null);
      try {
        const amountWei = ethers.parseUnits(amount, tokenDecimals);
        const receipt = await client.confidentialTransfer(
          signer,
          recipient,
          config.tokenAddress,
          Number(amountWei),
        );
        setTimeout(() => fetchBalancesRef.current(true), 2000);
        setLastTxHash(receipt.hash);
        return { hash: receipt.hash };
      } catch (err) {
        const errorMessage = parseError(err as AppError);
        setError(errorMessage);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [client, signer, config.tokenAddress, tokenDecimals],
  );

  const withdraw = useCallback(
    async (amount: string) => {
      if (!client || !signer)
        throw new Error("Client or signer not initialized");
      setLoading(true);
      setError(null);
      try {
        const amountWei = ethers.parseUnits(amount, tokenDecimals);
        const receipt = await client.withdraw(
          signer,
          config.tokenAddress,
          Number(amountWei),
        );
        setTimeout(() => fetchBalancesRef.current(true), 2000);
        setLastTxHash(receipt.hash);
        return { hash: receipt.hash };
      } catch (err) {
        const errorMessage = parseError(err as AppError);
        setError(errorMessage);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [client, signer, config.tokenAddress, tokenDecimals],
  );

  const requestFaucet = useCallback(async () => {
    if (!signer) throw new Error("Signer not initialized");
    setLoading(true);
    setError(null);
    try {
      const address = await signer.getAddress();
      const result = await sendFaucet(address);
      if (!result.success) {
        throw new Error(result.error || "Faucet request failed");
      }
      setTimeout(() => fetchBalancesRef.current(true), 2000);
      return result;
    } catch (err) {
      const errorMessage = parseError(err as AppError);
      setError(errorMessage);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [signer]);

  return {
    config,
    client,
    signer,
    userKeys,
    balances,
    loading,
    error,
    ensureAccount,
    fetchBalances,
    requestFaucet,
    confidentialDeposit,
    confidentialTransfer,
    withdraw,
    tokenSymbol,
    tokenDecimals,
    lastTxHash,
  };
}
