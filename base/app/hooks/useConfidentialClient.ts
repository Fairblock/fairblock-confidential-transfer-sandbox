/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable react-hooks/exhaustive-deps */

import { useEffect, useState, useCallback } from "react";
import { usePrivy, useWallets } from "@privy-io/react-auth";
import { ethers } from "ethers";
import { ConfidentialTransferClient } from "@fairblock/stabletrust";
import { parseError } from "../utils/errorParser";

export interface ConfidentialConfig {
  rpcUrl: string;
  tokenAddress: string;
  explorerUrl: string;
  chainId: number;
}

const TOKEN_ADDRESS =
  process.env.TOKEN_ADDRESS || "0x036CbD53842c5426634e7929541eC2318f3dCF7e";
const RPC_URL = process.env.ETHEREUM_RPC_URL || "https://base-sepolia.drpc.org";
const EXPLORER_URL =
  process.env.EXPLORER_URL || "https://sepolia.basescan.org/tx";
const CHAIN_ID = process.env.CHAIN_ID || 84532;

const DEFAULT_CONFIG: ConfidentialConfig = {
  rpcUrl: RPC_URL,
  tokenAddress: TOKEN_ADDRESS,
  explorerUrl: EXPLORER_URL,
  chainId: Number(CHAIN_ID),
};

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
    native: "0",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tokenSymbol, setTokenSymbol] = useState("TKN");
  const [tokenDecimals, setTokenDecimals] = useState(18);
  const [lastTxHash, setLastTxHash] = useState<string | null>(null);

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
        const wallet = wallets[0];
        await wallet.switchChain(config.chainId);
        const provider = await wallet.getEthereumProvider();
        const ethereProvider = new ethers.BrowserProvider(provider);
        const s = await ethereProvider.getSigner();
        setSigner(s);
      }
    }
    getSigner();
  }, [authenticated, wallets]);

  const ensureAccount = useCallback(async () => {
    if (!client || !signer) return;
    setLoading(true);
    setError(null);
    try {
      const keys = await client.ensureAccount(signer);
      setUserKeys(keys);
      return keys;
    } catch (err) {
      const errorMessage = parseError(err);
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

        if (client && userKeys) {
          try {
            publicBal = await client.getPublicBalance(
              address,
              config.tokenAddress,
            );
            const cb = await client.getConfidentialBalance(
              address,
              userKeys.privateKey,
              config.tokenAddress,
            );
            confidentialBal = { amount: BigInt(cb.amount) };
          } catch (e) {
            console.warn("Failed to fetch token balances", e);
          }
        }

        setBalances({
          public: ethers.formatUnits(publicBal, tokenDecimals),
          confidential: ethers.formatUnits(confidentialBal.amount, 2),
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
        const amountWei = ethers.parseUnits(amount, 2);
        const receipt = await client.confidentialDeposit(
          signer,
          config.tokenAddress,
          amountWei,
        );

        setTimeout(fetchBalances, 2000);

        setLastTxHash(receipt.hash);
        return { hash: receipt.hash };
      } catch (err) {
        const errorMessage = parseError(err);
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
        const amountWei = ethers.parseUnits(amount, 2);
        const receipt = await client.confidentialTransfer(
          signer,
          recipient,
          config.tokenAddress,
          Number(amountWei),
        );
        setTimeout(fetchBalances, 2000);
        setLastTxHash(receipt.hash);
        return { hash: receipt.hash };
      } catch (err) {
        const errorMessage = parseError(err);
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
        const amountWei = ethers.parseUnits(amount, 2);
        const receipt = await client.withdraw(
          signer,
          config.tokenAddress,
          Number(amountWei),
        );
        setTimeout(fetchBalances, 2000);
        setLastTxHash(receipt.hash);
        return { hash: receipt.hash };
      } catch (err) {
        const errorMessage = parseError(err);
        setError(errorMessage);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [client, signer, fetchBalances, config.tokenAddress],
  );

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
    confidentialDeposit,
    confidentialTransfer,
    withdraw,
    tokenSymbol,
    tokenDecimals,
    lastTxHash,
  };
}
