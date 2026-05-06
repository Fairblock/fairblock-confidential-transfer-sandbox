import { useEffect, useState, useCallback } from "react";
import { useTurnkey, AuthState } from "@turnkey/react-wallet-kit";
import { ethers } from "ethers";
import { TurnkeySigner } from "@turnkey/ethers";
import { ConfidentialTransferClient } from "../lib/stabletrust/index.js";
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
  rpcUrl:
    process.env.NEXT_PUBLIC_BASE_SEPOLIA_RPC || "https://sepolia.base.org",
  tokenAddress:
    process.env.NEXT_PUBLIC_TOKEN_ADDRESS ||
    "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
  explorerUrl:
    process.env.NEXT_PUBLIC_EXPLORER_URL || "https://sepolia.basescan.org/tx/",
  chainId: Number.parseInt(process.env.NEXT_PUBLIC_CHAIN_ID || "84532"),
};

export function useConfidentialClient() {
  const { authState, wallets, httpClient, session } = useTurnkey();
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
  const [tokenSymbol, setTokenSymbol] = useState("USDC");
  const [tokenDecimals, setTokenDecimals] = useState(6);
  const [lastTxHash, setLastTxHash] = useState<string | null>(null);

  const authenticated = authState === AuthState.Authenticated;

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
          tokenContract.symbol().catch(() => "USDC"),
          tokenContract.decimals().catch(() => 6),
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
      Promise.resolve().then(() => setClient(c));
    } catch (err) {
      console.error("Failed to initialize client", err);
    }
  }, [config.rpcUrl, config.chainId]);

  useEffect(() => {
    async function getSigner() {
      if (authenticated && wallets.length > 0 && httpClient) {
        const ethAccount = wallets
          .flatMap((w) => w.accounts)
          .find((a) => a.addressFormat === "ADDRESS_FORMAT_ETHEREUM");

        if (!ethAccount) {
          console.warn("No Ethereum account found in wallets");
          return;
        }

        try {
          const provider = new ethers.JsonRpcProvider(config.rpcUrl);

          // session.organizationId is the sub-org where the user's session key is
          // registered. Using the parent org ID causes "could not find public key in
          // organization" because the stamper key only exists in the sub-org.
          const organizationId =
            session?.organizationId ||
            process.env.NEXT_PUBLIC_ORGANIZATION_ID ||
            "";

          // signWith must be the exact address string Turnkey has stored — case sensitive.
          // Do NOT apply ethers.getAddress() (EIP-55 checksum) as Turnkey stores lowercase.
          const signWith = ethAccount.address;

          const s = new TurnkeySigner({
            client: httpClient,
            organizationId,
            signWith,
          }).connect(provider);
          
          setSigner(s);
        } catch (err) {
          console.error("Failed to set signer:", err);
        }
      } else {
        setSigner(null);
        setUserKeys(null);
        // We don't reset balances here because we can still show them via the public address if wallets exist
      }
    }
    getSigner();
  }, [authenticated, wallets, config.rpcUrl, httpClient, session?.organizationId]);

  const ensureAccount = useCallback(async () => {
    if (!client || !signer) {
      console.warn("Cannot ensure account: client or signer missing");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      console.log("Starting ensureAccount with signer:", signer);
      const keys = await client.ensureAccount(signer);
      setUserKeys(keys);
      return keys;
    } catch (err) {
      const errorMessage = parseError(err as AppError);
      setError(errorMessage);
      console.error("ensureAccount failed:", err);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [client, signer]);

  const fetchBalances = useCallback(
    async (silent: boolean = false) => {
      const ethAccount = wallets
        .flatMap((w) => w.accounts)
        .find((a) => a.addressFormat === "ADDRESS_FORMAT_ETHEREUM");

      const address = ethAccount?.address;
      if (!address) return;
      
      if (!silent) setLoading(true);
      try {
        const provider = new ethers.JsonRpcProvider(config.rpcUrl);
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
      wallets,
      userKeys,
      config.tokenAddress,
      tokenDecimals,
      config.rpcUrl,
    ],
  );

  useEffect(() => {
    if (wallets.length === 0) return;
    
    Promise.resolve().then(() => fetchBalances(true));
    const interval = setInterval(() => {
      fetchBalances(true);
    }, 10000);
    return () => clearInterval(interval);
  }, [fetchBalances, wallets.length]);

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
    [client, signer, fetchBalances, config.tokenAddress, tokenDecimals],
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
    [client, signer, fetchBalances, config.tokenAddress, tokenDecimals],
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
    [client, signer, fetchBalances, config.tokenAddress, tokenDecimals],
  );

  const requestFaucet = useCallback(async () => {
    const ethAccount = wallets
      .flatMap((w) => w.accounts)
      .find((a) => a.addressFormat === "ADDRESS_FORMAT_ETHEREUM");

    if (!ethAccount) throw new Error("No wallet account found");
    
    setLoading(true);
    setError(null);
    try {
      const address = ethAccount.address;
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
  }, [wallets, fetchBalances]);

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
