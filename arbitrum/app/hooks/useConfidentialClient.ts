import { useEffect, useState, useCallback, useRef } from "react";
import { usePrivy, useWallets } from "@privy-io/react-auth";
import { ethers } from "ethers";
import { ConfidentialTransferClient } from "@fairblock/stabletrust";
import { parseError, AppError } from "../utils/errorParser";
import { sendFaucet } from "../actions/faucet";

export interface ConfidentialConfig {
  rpcUrl: string;
  tokenAddress: string;
  explorerUrl: string;
  chainId: number;
}

const CONFIDENTIAL_CONTRACT_ADDRESS = "0x5acECCdeb5CbD3C727eCB49F8706Eb80EF2f977F"; // Arbitrum Sepolia

const ERC20_MINIMAL_ABI = [
  "function allowance(address owner, address spender) view returns (uint256)",
  "function approve(address spender, uint256 amount) returns (bool)",
];

// MetaMask and Privy both send eth_sendTransaction to Arbitrum Sepolia with
// maxFeePerGas: 1000 wei (far below the ~20M wei base fee). BrowserProvider
// signers bypass getFeeData() and let the wallet set fees — so overriding
// getFeeData() has no effect. Instead, intercept at the EIP-1193 level:
// patch eth_sendTransaction params before the request reaches the wallet.
class GasPatchedEip1193Provider {
  constructor(
    private readonly inner: ethers.Eip1193Provider,
    private readonly rpcUrl: string,
  ) {}

  async request(req: { method: string; params?: unknown[] }): Promise<unknown> {
    if (
      req.method === "eth_sendTransaction" &&
      Array.isArray(req.params) &&
      req.params[0] != null
    ) {
      const tx = req.params[0] as Record<string, string | undefined>;
      if (!tx.maxFeePerGas && !tx.gasPrice) {
        try {
          const feeData = await new ethers.JsonRpcProvider(this.rpcUrl).getFeeData();
          if (feeData.maxFeePerGas != null) {
            tx.maxFeePerGas = "0x" + feeData.maxFeePerGas.toString(16);
            tx.maxPriorityFeePerGas =
              "0x" + (feeData.maxPriorityFeePerGas ?? feeData.maxFeePerGas).toString(16);
            delete tx.gasPrice;
          }
        } catch {
          // fee fetch failed — let the wallet estimate (may still fail)
        }
      }
    }
    return this.inner.request(req);
  }
}

const DEFAULT_CONFIG: ConfidentialConfig = {
  rpcUrl:
    process.env.NEXT_PUBLIC_RPC_URL || "https://sepolia-rollup.arbitrum.io/rpc",
  tokenAddress:
    process.env.NEXT_PUBLIC_TOKEN_ADDRESS ||
    "0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d",
  explorerUrl:
    process.env.NEXT_PUBLIC_EXPLORER_URL || "https://sepolia.arbiscan.io/tx/",
  chainId: Number.parseInt(process.env.NEXT_PUBLIC_CHAIN_ID || "421614"),
};

export function useConfidentialClient() {
  const { authenticated, user } = usePrivy();
  const { wallets } = useWallets();
  const [config] = useState<ConfidentialConfig>(DEFAULT_CONFIG);
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
          // Wrap the raw EIP-1193 provider to inject correct gas prices into
          // eth_sendTransaction before the wallet submits to the node.
          const patchedProvider = new GasPatchedEip1193Provider(provider, config.rpcUrl);
          const ethersProvider = new ethers.BrowserProvider(patchedProvider);
          const s = await ethersProvider.getSigner();
          if (cancelled) return;
          signerAddressRef.current = walletAddress;
          // NonceManager gives Privy embedded wallets a local sequential nonce
          // counter so approve + deposit don't race (MetaMask handles this itself).
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
            `Make sure your wallet is unlocked and switched to Arbitrum Sepolia (chain ID 421614).`,
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
    [client, signer, userKeys, config.tokenAddress, tokenDecimals, config.rpcUrl],
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
        // This runs before the SDK's internal approve so the wallet only shows
        // one popup and the SDK skips its own approve (allowance >= amount).
        const erc20 = new ethers.Contract(config.tokenAddress, ERC20_MINIMAL_ABI, signer);
        const userAddress = await signer.getAddress();
        const allowance: bigint = await erc20.allowance(userAddress, CONFIDENTIAL_CONTRACT_ADDRESS);
        if (allowance < amountWei) {
          const approveTx = await erc20.approve(CONFIDENTIAL_CONTRACT_ADDRESS, ethers.MaxUint256);
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
