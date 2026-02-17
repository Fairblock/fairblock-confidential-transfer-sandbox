
import { useEffect, useState, useCallback } from "react";
import { usePrivy, useWallets } from "@privy-io/react-auth";
import { ethers } from "ethers";
import { ConfidentialTransferClient } from "@fairblock/stabletrust";

export interface ConfidentialConfig {
  rpcUrl: string;
  contractAddress: string;
  tokenAddress: string;
  explorerUrl: string;
  chainId: number;
}

const DEFAULT_CONFIG: ConfidentialConfig = {
  rpcUrl: process.env.NEXT_PUBLIC_RPC_URL || "https://rpc.testnet.stable.xyz",
  contractAddress:
    process.env.NEXT_PUBLIC_CONTRACT_ADDRESS ||
    "0x29E4fd434758b1677c10854Fa81C2fc496D76E62",
  tokenAddress:
    process.env.NEXT_PUBLIC_TOKEN_ADDRESS ||
    "0x78Cf24370174180738C5B8E352B6D14c83a6c9A9",
  explorerUrl:
    process.env.NEXT_PUBLIC_EXPLORER_URL || "https://testnet.stablescan.xyz/tx/",
  chainId: parseInt(process.env.NEXT_PUBLIC_CHAIN_ID || "2201"),
};

// const CHAIN_ID = parseInt(process.env.NEXT_PUBLIC_CHAIN_ID || "2201"); // Removed in favor of config.chainId

export function useConfidentialClient() {
  const { authenticated } = usePrivy();
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
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tokenSymbol, setTokenSymbol] = useState("TKN");
  const [tokenDecimals, setTokenDecimals] = useState(18);
  const [lastTxHash, setLastTxHash] = useState<string | null>(null);

  // Fetch Token Details
  useEffect(() => {
    async function fetchTokenDetails() {
      if (!config.tokenAddress || !config.rpcUrl) return;
      try {
        // Simple provider just for reading token details
        const provider = new ethers.JsonRpcProvider(config.rpcUrl);
        const tokenContract = new ethers.Contract(
          config.tokenAddress,
          ["function symbol() view returns (string)", "function decimals() view returns (uint8)"],
          provider
        );
        
        const [sym, dec] = await Promise.all([
          tokenContract.symbol().catch(() => "TKN"),
          tokenContract.decimals().catch(() => 18)
        ]);

        setTokenSymbol(sym);
        setTokenDecimals(Number(dec));
      } catch (err) {
        console.warn("Failed to fetch token details", err);
      }
    }
    fetchTokenDetails();
  }, [config.tokenAddress, config.rpcUrl]);

  // Initialize Client when config changes
  useEffect(() => {
    try {
      const c = new ConfidentialTransferClient(
        config.rpcUrl,
        config.contractAddress,
        config.chainId
      );
      setClient(c);
    } catch (err) {
      console.error("Failed to initialize client", err);
    }
  }, [config.rpcUrl, config.contractAddress]);

  // Get Ethers Signer from Privy Wallet
  useEffect(() => {
    async function getSigner() {
      if (authenticated && wallets.length > 0) {
        const wallet = wallets[0]; // Use first wallet
        await wallet.switchChain(config.chainId);
        const provider = await wallet.getEthereumProvider();
        const ethereProvider = new ethers.BrowserProvider(provider);
        const s = await ethereProvider.getSigner();
        setSigner(s);
      }
    }
    getSigner();
  }, [authenticated, wallets]);

  // Ensure Account (Create/Retrieve Keys)
  const ensureAccount = useCallback(async () => {
    if (!client || !signer) return;
    setLoading(true);
    setError(null);
    try {
      const keys = await client.ensureAccount(signer);
      setUserKeys(keys);
      return keys;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to ensure account";
      setError(errorMessage);
      console.error(err);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [client, signer]);

  // Fetch Balances
  const fetchBalances = useCallback(async (silent: boolean = false) => {
    if (!client || !signer || !userKeys) return;
    if (!silent) setLoading(true);
    try {
      const address = await signer.getAddress();

      // Public Balance
      const publicBal = await client.getPublicBalance(address, config.tokenAddress);

      // Confidential Balance
      const confidentialBal = await client.getConfidentialBalance(
        address,
        userKeys.privateKey,
        config.tokenAddress
      );

      setBalances({
        public: ethers.formatUnits(publicBal, tokenDecimals),
        confidential: ethers.formatUnits(confidentialBal.amount, 2), // Confidential always 2 decimals as requested
      });
    } catch (err) {
      console.error("Error fetching balances:", err);
    } finally {
      if (!silent) setLoading(false);
    }
  }, [client, signer, userKeys, config.tokenAddress, tokenDecimals]);

  // Polling for balances
  useEffect(() => {
    if (!client || !signer || !userKeys) return;
    
    // Initial fetch
    fetchBalances(true);

    const interval = setInterval(() => {
      fetchBalances(true);
    }, 30000); // 30 seconds

    return () => clearInterval(interval);
  }, [fetchBalances, client, signer, userKeys]);

  // Confidential Deposit
  const confidentialDeposit = useCallback(
    async (amount: string) => {
      if (!client || !signer) throw new Error("Client or signer not initialized");
      setLoading(true);
      setError(null);
      try {
        
        const amountWei = ethers.parseUnits(amount, 2); 
        const receipt = await client.confidentialDeposit(
          signer, 
          config.tokenAddress, 
          amountWei
        );
        
        setTimeout(fetchBalances, 2000); 
        
        setLastTxHash(receipt.hash);
        return { hash: receipt.hash };
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : "Deposit failed";
        setError(errorMessage);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [client, signer, fetchBalances, config.tokenAddress]
  );

  // Confidential Transfer
  const confidentialTransfer = useCallback(
    async (recipient: string, amount: string) => {
      if (!client || !signer) throw new Error("Client or signer not initialized");
      setLoading(true);
      setError(null);
      try {
        const amountWei = ethers.parseUnits(amount, 2);
        const receipt = await client.confidentialTransfer(
          signer,
          recipient,
          config.tokenAddress,
          Number(amountWei)
        );
        setTimeout(fetchBalances, 2000);
        setLastTxHash(receipt.hash);
        return { hash: receipt.hash };
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : "Transfer failed";
        setError(errorMessage);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [client, signer, fetchBalances, config.tokenAddress]
  );

  // Withdraw
  const withdraw = useCallback(
    async (amount: string) => {
      if (!client || !signer) throw new Error("Client or signer not initialized");
      setLoading(true);
      setError(null);
      try {
        const amountWei = ethers.parseUnits(amount, 2);
        const receipt = await client.withdraw(
          signer, 
          config.tokenAddress, 
          Number(amountWei)
        );
        setTimeout(fetchBalances, 2000);
        setLastTxHash(receipt.hash);
        return { hash: receipt.hash };
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : "Withdraw failed";
        setError(errorMessage);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [client, signer, fetchBalances, config.tokenAddress]
  );

  return {
    config,
    setConfig,
    client,
    signer,
    userKeys,
    balances,
    loading,
    error,
    ensureAccount,
    fetchBalances,
    confidentialDeposit,
    confidentialTransfer,
    withdraw,
    tokenSymbol,
    tokenDecimals,
    lastTxHash,
  };
}
