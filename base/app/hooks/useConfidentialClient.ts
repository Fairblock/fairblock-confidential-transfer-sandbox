import { useEffect, useState, useCallback, useRef } from "react";
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

const CONFIDENTIAL_CONTRACT_ADDRESS =
  "0x4a251C9D79faCa20b193630A4ee313af7cBCDD93"; // Base Sepolia

const ERC20_MINIMAL_ABI = [
  "function allowance(address owner, address spender) view returns (uint256)",
  "function approve(address spender, uint256 amount) returns (bool)",
];

const DEFAULT_CONFIG: ConfidentialConfig = {
  rpcUrl: "https://base-sepolia.drpc.org",
  tokenAddress:
    process.env.NEXT_PUBLIC_TOKEN_ADDRESS ||
    "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
  explorerUrl:
    process.env.NEXT_PUBLIC_EXPLORER_URL || "https://sepolia.basescan.org/tx/",
  chainId: parseInt(process.env.NEXT_PUBLIC_CHAIN_ID || "84532"),
};

export function useConfidentialClient() {
  const { authenticated, user } = usePrivy();
  const { wallets } = useWallets();
  const [config, setConfig] = useState<ConfidentialConfig>(DEFAULT_CONFIG);
  const [client, setClient] = useState<ConfidentialTransferClient | null>(null);
  const [signer, setSigner] = useState<ethers.Signer | null>(null);
  const [userKeys, setUserKeys] = useState<{
    publicKey: string;
    privateKey: string;
  } | null>(null);
  const [balances, setBalances] = useState({
    public: "0",
    confidential: "0",
    native: "0",
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
    try {
      const c = new ConfidentialTransferClient(config.rpcUrl, config.chainId);
      setClient(c);
    } catch (err) {
      console.error("Failed to initialize client", err);
    }
  }, [config.rpcUrl, config.chainId]);

  useEffect(() => {
    let cancelled = false;

    async function getSigner() {
      if (authenticated && wallets.length > 0) {
        let wallet = wallets[0];

        if (user) {
          const linkedSmartWalletAddress = user.linkedAccounts?.find(
            (account) =>
              account.type === "smart_wallet" && "address" in account,
          )?.address;
          const linkedWalletAddress = user.linkedAccounts?.find(
            (account) => account.type === "wallet" && "address" in account,
          )?.address;
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
          // Privy embedded wallets don't track in-flight txs when reporting nonces,
          // causing "nonce too low" when approve + deposit are sent back-to-back.
          // NonceManager keeps a local sequential counter to avoid re-querying.
          const isEmbedded =
            wallet.walletClientType === "privy" ||
            wallet.walletClientType === "privy-v2";
          setSigner(isEmbedded ? new ethers.NonceManager(s) : s);
          setError(null);
        } catch (err) {
          if (cancelled) return;
          console.error("Failed to set signer:", err);
          signerAddressRef.current = null;
          setSigner(null);
          setError(
            `Wallet setup failed: ${(err as Error).message ?? "unknown error"}. ` +
              `Make sure your wallet is unlocked and switched to Base Sepolia (chain ID 84532).`,
          );
        } finally {
          signerPending.current = false;
        }
      } else {
        signerAddressRef.current = null;
        setSigner(null);
        setUserKeys(null);
        setBalances({ public: "0", confidential: "0", native: "0" });
      }
    }

    getSigner();
    return () => {
      cancelled = true;
    };
  }, [authenticated, wallets, config.chainId, user]);

  const ensureAccount = useCallback(async () => {
    if (!client || !signer) {
      setError(
        "Wallet not ready please wait a moment and try again, or refresh the page.",
      );
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
        const provider =
          signer.provider || new ethers.JsonRpcProvider(config.rpcUrl);

        const nativeBal = await provider.getBalance(address);

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
          confidential: ethers.formatUnits(
            confidentialBal.amount,
            tokenDecimals,
          ),
          native: ethers.formatEther(nativeBal),
        });
      } catch (err) {
        console.error("Error fetching balances:", err);
      } finally {
        isFetching.current = false;
        if (!silent) setLoading(false);
      }
    },
    [
      client,
      signer,
      userKeys,
      config.tokenAddress,
      tokenDecimals,
      config.rpcUrl,
    ],
  );

  const fetchBalancesRef = useRef(fetchBalances);
  useEffect(() => {
    fetchBalancesRef.current = fetchBalances;
  }, [fetchBalances]);

  useEffect(() => {
    if (!signer) return;
    fetchBalancesRef.current(true);
    const interval = setInterval(() => fetchBalancesRef.current(true), 15000);
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

        // Approve the confidential contract to spend tokens before depositing.
        // This runs before the SDK's internal approve so MetaMask only shows
        // one popup and the SDK skips its own approve (allowance >= amount).
        const erc20 = new ethers.Contract(
          config.tokenAddress,
          ERC20_MINIMAL_ABI,
          signer,
        );
        const userAddress = await signer.getAddress();
        const allowance: bigint = await erc20.allowance(
          userAddress,
          CONFIDENTIAL_CONTRACT_ADDRESS,
        );
        if (allowance < amountWei) {
          const approveTx = await erc20.approve(
            CONFIDENTIAL_CONTRACT_ADDRESS,
            ethers.MaxUint256,
          );
          await approveTx.wait();
        }

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
