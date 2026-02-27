import { useEffect, useState, useCallback } from "react";
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
    console.log("Config is now set for chainId:", config.chainId);
  }, [config]);

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
              console.log("Waiting for matching wallet");
              return;
            }
          }
        }

        try {
          await wallet.switchChain(config.chainId);
          const provider = await wallet.getEthereumProvider();
          const ethereProvider = new ethers.BrowserProvider(provider);
          const s = await ethereProvider.getSigner();
          setSigner(s);
        } catch (err) {
          console.error("Failed to set signer:", err);
        }
      } else {
        setSigner(null);
        setUserKeys(null);
        setBalances({ public: "0", confidential: "0", native: "0" });
      }
    }
    getSigner();
  }, [authenticated, wallets, config.chainId, user]);

  const ensureAccount = useCallback(async () => {
    if (!client || !signer) return;
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

  useEffect(() => {
    if (!signer) return;

    fetchBalances(true);

    const interval = setInterval(() => {
      fetchBalances(true);
    }, 10000);

    return () => clearInterval(interval);
  }, [fetchBalances, signer]);

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

        setTimeout(() => fetchBalances(true), 2000);

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
    [client, signer, fetchBalances, config.tokenAddress],
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
        setTimeout(() => fetchBalances(true), 2000);
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
    [client, signer, fetchBalances, config.tokenAddress],
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
        setTimeout(() => fetchBalances(true), 2000);
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
    [client, signer, fetchBalances, config.tokenAddress],
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
      setTimeout(() => fetchBalances(true), 2000);
      return result;
    } catch (err) {
      const errorMessage = parseError(err as AppError);
      setError(errorMessage);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [signer, fetchBalances]);

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
