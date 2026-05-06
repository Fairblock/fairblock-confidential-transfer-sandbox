"use client";

import { useState, useEffect, useMemo } from "react";
import { useTurnkey, AuthState } from "@turnkey/react-wallet-kit";
import { useConfidentialClient } from "./hooks/useConfidentialClient";
import { AppError, parseError } from "./utils/errorParser";
import { Toaster, toast } from "sonner";
import { supportedChains } from "./providers";
import Onboarding from "./Onboarding";
import FluidLoader, { LoaderAction } from "./components/FluidLoader";
import { Mail, Wallet, LogOut, Info, Copy, Check } from "lucide-react";

export default function Dashboard() {
  const { authState, wallets, handleLogin: login, logout } = useTurnkey();
  const {
    config,
    ensureAccount,
    fetchBalances,
    requestFaucet,
    confidentialDeposit,
    confidentialTransfer,
    withdraw,
    balances,
    userKeys,
    loading,
    error,
    tokenSymbol,
    lastTxHash,
  } = useConfidentialClient();

  const [depositAmount, setDepositAmount] = useState("");
  const [transferAmount, setTransferAmount] = useState("");
  const [recipient, setRecipient] = useState("");
  const [withdrawAmount, setWithdrawAmount] = useState("");

  const [copied, setCopied] = useState(false);
  const [faucetLoading, setFaucetLoading] = useState(false);
  const [isHandlingTx, setIsHandlingTx] = useState(false);
  const [loaderAction, setLoaderAction] = useState<LoaderAction>("Default");

  const [onboardingFinished, setOnboardingFinished] = useState(true);
  const [mounted, setMounted] = useState(false);

  const authenticated = authState === AuthState.Authenticated;

  useEffect(() => {
    // Avoid synchronous setState in effect body to prevent cascading renders warning in React 19
    const init = () => {
      setMounted(true);
      if (globalThis.window !== undefined) {
        const finished = globalThis.window.localStorage.getItem(
          "fairblock_onboarding",
        );
        if (!finished) {
          setOnboardingFinished(false);
        }
      }
    };

    init();
  }, []);

  const completeOnboarding = () => {
    localStorage.setItem("fairblock_onboarding", "true");
    setOnboardingFinished(true);
  };

  const restartOnboarding = () => {
    localStorage.removeItem("fairblock_onboarding");
    setOnboardingFinished(false);
  };

  const resolvedAddress = useMemo(() => {
    const ethAccount = wallets
      .flatMap((w) => w.accounts)
      .find((a) => a.addressFormat === "ADDRESS_FORMAT_ETHEREUM");
    return ethAccount?.address ?? null;
  }, [wallets]);

  const handleTransaction = async (
    actionName: string,
    action: () => Promise<{ hash: string }>,
    onSuccess?: () => void,
  ) => {
    setLoaderAction(actionName as LoaderAction);
    setIsHandlingTx(true);
    try {
      const { hash } = await action();
      toast.success(`${actionName} Successful!`, {
        description: (
          <a
            href={`${config.explorerUrl}${hash}`}
            target="_blank"
            rel="noopener noreferrer"
            className="underline text-blue-600 hover:text-blue-800"
          >
            View on Explorer
          </a>
        ),
        duration: 5000,
      });
      if (onSuccess) {
        onSuccess();
      } else {
        setDepositAmount("");
        setTransferAmount("");
        setWithdrawAmount("");
      }
    } catch (err) {
      console.error(err);
      const errorMessage = parseError(err as AppError);
      toast.error(`${actionName} Failed`, {
        description: errorMessage,
      });
    } finally {
      setIsHandlingTx(false);
    }
  };

  const handleFaucetRequest = async () => {
    if (!resolvedAddress) return;
    setLoaderAction("Faucet");
    setFaucetLoading(true);
    try {
      const data = await requestFaucet();

      toast.success(
        "Funds Received! It will take a few seconds to appear in your wallet",
        {
          description: (
            <a
              href={`${config.explorerUrl}${data.hash}`}
              target="_blank"
              rel="noopener noreferrer"
              className="underline text-blue-600 hover:text-blue-800"
            >
              View Transaction
            </a>
          ),
          duration: 5000,
        },
      );
      fetchBalances(true);
      setTimeout(() => fetchBalances(true), 3000);
      setTimeout(() => fetchBalances(true), 6000);
    } catch (err: unknown) {
      const errorMessage = parseError(err as AppError);
      toast.error("Faucet Failed", {
        description: errorMessage,
      });
      throw err;
    } finally {
      setFaucetLoading(false);
    }
  };

  if (!mounted) {
    return null;
  }

  if (!authenticated) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-white">
        <div className="card max-w-lg w-full text-center space-y-8 p-12">
          <div className="flex justify-center">
            <div className="w-16 h-16 bg-black rounded-full flex items-center justify-center">
              <Mail className="w-10 h-10 text-white" />
            </div>
          </div>
          <div className="space-y-4">
            <h1 className="text-3xl font-bold tracking-tighter">
              Fairblock Confidential Transfer Sandbox
            </h1>
            <p className="text-gray-500">
              Secure, private transfers powered by Fairblock.
            </p>
          </div>
          <div className="space-y-3">
            <button
              type="button"
              onClick={() => login()}
              className="btn-primary w-full text-lg py-4 flex items-center justify-center gap-3"
            >
              <Mail className="w-5 h-5" />
              Continue with Email
            </button>
          </div>
          <div className="pt-4 flex items-center justify-center gap-2 text-xs text-gray-400">
            <Info className="w-3 h-3" />
            <span>Base Sepolia Testnet</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-4 sm:p-6 md:p-8 max-w-5xl mx-auto bg-white">
      <Toaster position="top-right" />

      <header className="mb-8 border-b border-black pb-6">
        {/* Top row: title + actions */}
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          {/* Title block */}
          <div className="space-y-0.5">
            <h1 className="text-lg sm:text-2xl font-bold leading-tight">
              Fairblock Confidential Transfer Sandbox
            </h1>
            <p className="text-xs text-gray-400">
              Wallet powered by{" "}
              <a
                href="https://turnkey.com"
                target="_blank"
                rel="noopener noreferrer"
                className="underline hover:text-gray-600"
              >
                Turnkey
              </a>
            </p>
          </div>

          {/* Action buttons */}
          <div className="flex flex-wrap gap-2 sm:flex-nowrap sm:items-center">
            {onboardingFinished && (
              <button
                type="button"
                onClick={restartOnboarding}
                className="text-xs sm:text-sm bg-gray-100 text-gray-800 px-3 py-2 border border-gray-200 hover:bg-gray-300 transition-colors font-medium cursor-pointer whitespace-nowrap"
              >
                Restart Onboarding
              </button>
            )}
            <button
              type="button"
              onClick={handleFaucetRequest}
              disabled={faucetLoading}
              className="text-xs sm:text-sm bg-yellow-100 text-yellow-800 px-3 py-2 border border-yellow-200 hover:bg-yellow-200 disabled:opacity-50 transition-colors font-medium cursor-pointer whitespace-nowrap"
            >
              Get 0.25 USDC
            </button>
            <div className="text-xs sm:text-sm font-medium bg-gray-50 px-3 py-2 border border-gray-200 flex items-center text-gray-800 whitespace-nowrap">
              <span className="text-gray-500 mr-1">Network:</span>
              {supportedChains.find((c) => c.id === config.chainId)?.name || "Base Sepolia"}
            </div>
            <button
              type="button"
              onClick={() => logout()}
              className="text-xs sm:text-sm bg-black text-white px-4 py-2 hover:bg-gray-800 transition-colors font-medium cursor-pointer flex items-center gap-1.5 whitespace-nowrap"
            >
              <LogOut className="w-3.5 h-3.5" />
              Disconnect
            </button>
          </div>
        </div>

        {/* Wallet address row */}
        <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-gray-600">
          <div className="flex items-center gap-1.5">
            <Wallet className="w-4 h-4 shrink-0" />
            {resolvedAddress ? (
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(resolvedAddress);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 2000);
                }}
                className="flex items-center gap-1 font-mono text-xs sm:text-sm hover:text-black transition-colors cursor-pointer break-all text-left"
                title="Click to copy address"
              >
                <span>{resolvedAddress}</span>
                {copied ? (
                  <Check className="w-3.5 h-3.5 text-green-500 shrink-0" />
                ) : (
                  <Copy className="w-3.5 h-3.5 shrink-0" />
                )}
              </button>
            ) : (
              <span className="text-gray-400">Not Connected</span>
            )}
          </div>
          {Number.parseFloat(balances.native) > 0 && (
            <span className="font-mono text-[10px] bg-gray-100 px-1.5 py-0.5 border border-gray-200 text-gray-800">
              {Number.parseFloat(balances.native).toFixed(4)} ETH
            </span>
          )}
          <a
            href="https://www.npmjs.com/package/@fairblock/stabletrust"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs text-blue-600 underline hover:text-blue-800"
          >
            <span className="inline-flex items-center rounded bg-red-600 text-white font-bold px-1 py-0.5 leading-none text-[10px]">npm</span>
            {" "}npm package
          </a>
        </div>
      </header>

      {error && (
        <div
          className="bg-red-50 border border-red-400 text-red-700 px-4 py-3 relative mb-6"
          role="alert"
        >
          <strong className="font-bold">Error: </strong>
          <span className="block sm:inline">{error}</span>
        </div>
      )}

      {(loading || isHandlingTx || faucetLoading) && (
        <FluidLoader action={loaderAction} />
      )}

      {lastTxHash && (
        <div className="bg-green-50 border border-green-200 text-green-800 px-4 py-3 rounded relative mb-6 text-center">
          <span className="font-bold mr-2">Latest Transaction:</span>
          <a
            href={`${config.explorerUrl}${lastTxHash}`}
            target="_blank"
            rel="noopener noreferrer"
            className="underline hover:text-green-900 break-all"
          >
            {lastTxHash}
          </a>
        </div>
      )}

      {!onboardingFinished ? (
        <Onboarding
          onComplete={completeOnboarding}
          config={config}
          balances={balances}
          userKeys={userKeys}
          loading={loading}
          faucetLoading={faucetLoading}
          handleFaucetRequest={handleFaucetRequest}
          ensureAccount={async () => {
            setLoaderAction("Init");
            await ensureAccount();
          }}
          confidentialDeposit={confidentialDeposit}
          confidentialTransfer={confidentialTransfer}
          withdraw={withdraw}
          tokenSymbol={tokenSymbol}
          handleTransaction={handleTransaction}
        />
      ) : (
        <>
          {!userKeys ? (
            <div className="card text-center py-10 md:py-16">
              {Number.parseFloat(balances.native) < 0.0005 ? (
                <>
                  <h2 className="text-xl mb-4">Insufficient Funds</h2>
                  <p className="mb-6 text-gray-600">
                    You need testnet tokens (ETH/USDC) to pay for gas fees.
                  </p>
                  <button
                    onClick={handleFaucetRequest}
                    className="btn-primary bg-green-600 hover:bg-green-700 border-green-700 cursor-pointer"
                    disabled={faucetLoading}
                  >
                    {faucetLoading ? "Sending funds..." : "Get 0.25 USDC Now"}
                  </button>
                  <p className="mt-4 text-xs text-gray-400">
                    Funds are sent directly to your wallet on the Base Testnet.
                  </p>
                </>
              ) : (
                <>
                  <h2 className="text-xl mb-4 font-bold">
                    Initialize Confidential Account
                  </h2>
                  <p className="mb-6 text-gray-600">
                    You need to derive keys to access confidential features.
                  </p>
                  <button
                    onClick={() => {
                      setLoaderAction("Init");
                      ensureAccount();
                    }}
                    className="btn-primary cursor-pointer px-10"
                    disabled={loading}
                  >
                    Create / Access Account
                  </button>
                </>
              )}
            </div>
          ) : (
            <div className="space-y-8 md:space-y-12">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8">
                <div className="card">
                  <h3 className="text-sm text-gray-500 mb-1 font-bold uppercase tracking-widest">
                    Public Balance
                  </h3>
                  <p className="text-3xl font-mono font-bold">
                    {balances.public} {tokenSymbol}
                  </p>
                </div>
                <div className="card">
                  <h3 className="text-sm text-gray-500 mb-1 font-bold uppercase tracking-widest">
                    Confidential Balance
                  </h3>
                  <p className="text-3xl font-mono font-bold">
                    {balances.confidential} {tokenSymbol}
                  </p>
                </div>
                <button
                  onClick={() => {
                    setLoaderAction("Refresh");
                    fetchBalances();
                  }}
                  className="btn-secondary w-full md:col-span-2 cursor-pointer font-bold"
                  disabled={loading}
                >
                  Refresh Balances
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8">
                <div className="card">
                  <h2 className="text-lg font-bold mb-4 border-b border-black pb-2">
                    Deposit
                  </h2>
                  <div className="space-y-6">
                    <div>
                      <label
                        htmlFor="deposit-amount"
                        className="block text-sm mb-1 font-bold"
                      >
                        Amount
                      </label>
                      <input
                        id="deposit-amount"
                        type="number"
                        step="0.01"
                        value={depositAmount}
                        onChange={(e) => {
                          const val = e.target.value;
                          if (Number(val) < 0) return;
                          if (!/^\d*\.?\d{0,2}$/.test(val)) return;
                          setDepositAmount(val);
                        }}
                        min="0"
                        className="input-primary"
                        placeholder="0.0"
                      />
                    </div>
                    <button
                      onClick={() =>
                        handleTransaction("Deposit", () =>
                          confidentialDeposit(depositAmount),
                        )
                      }
                      disabled={
                        loading ||
                        !depositAmount ||
                        Number.parseFloat(depositAmount) >
                          Number.parseFloat(balances.public)
                      }
                      className="btn-primary w-full cursor-pointer font-bold"
                    >
                      Deposit to Confidential
                    </button>
                  </div>
                </div>

                <div className="card">
                  <h2 className="text-lg font-bold mb-4 border-b border-black pb-2">
                    Transfer
                  </h2>
                  {Number.parseFloat(balances.confidential) <= 0 ? (
                    <div className="text-center py-8 text-gray-500">
                      <p>You need a confidential balance to transfer.</p>
                      <p className="text-sm mt-1">
                        Please deposit funds first.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-6">
                      <div>
                        <label
                          htmlFor="recipient-address"
                          className="block text-sm mb-1 font-bold"
                        >
                          Recipient Address
                        </label>
                        <div className="relative w-full">
                          <input
                            id="recipient-address"
                            type="text"
                            value={recipient}
                            onChange={(e) => setRecipient(e.target.value)}
                            className="input-primary"
                            placeholder="0x..."
                          />
                        </div>
                      </div>
                      <div>
                        <label
                          htmlFor="transfer-amount"
                          className="block text-sm mb-1 font-bold"
                        >
                          Amount
                        </label>
                        <input
                          id="transfer-amount"
                          type="number"
                          step="0.01"
                          value={transferAmount}
                          onChange={(e) => {
                            const val = e.target.value;
                            if (Number(val) < 0) return;
                            if (!/^\d*\.?\d{0,2}$/.test(val)) return;
                            setTransferAmount(val);
                          }}
                          min="0"
                          className="input-primary"
                          placeholder="0.0"
                        />
                      </div>
                      <button
                        onClick={() =>
                          handleTransaction("Transfer", () =>
                            confidentialTransfer(recipient, transferAmount),
                          )
                        }
                        disabled={
                          loading ||
                          !transferAmount ||
                          !recipient ||
                          Number.parseFloat(transferAmount) >
                            Number.parseFloat(balances.confidential)
                        }
                        className="btn-primary w-full cursor-pointer font-bold"
                      >
                        Confidential Transfer
                      </button>
                    </div>
                  )}
                </div>

                <div className="card md:col-span-2">
                  <h2 className="text-lg font-bold mb-4 border-b border-black pb-2">
                    Withdraw
                  </h2>
                  {Number.parseFloat(balances.confidential) <= 0 ? (
                    <div className="text-center py-4 text-gray-500">
                      <p>You need a confidential balance to withdraw.</p>
                    </div>
                  ) : (
                    <div className="flex flex-col sm:flex-row gap-4 sm:items-end">
                      <div className="flex-1 w-full">
                        <label
                          htmlFor="withdraw-amount"
                          className="block text-sm mb-1 font-bold"
                        >
                          Amount
                        </label>
                        <input
                          id="withdraw-amount"
                          type="number"
                          step="0.01"
                          value={withdrawAmount}
                          onChange={(e) => {
                            const val = e.target.value;
                            if (Number(val) < 0) return;
                            if (!/^\d*\.?\d{0,2}$/.test(val)) return;
                            setWithdrawAmount(val);
                          }}
                          min="0"
                          className="input-primary"
                          placeholder="0.0"
                        />
                      </div>
                      <button
                        onClick={() =>
                          handleTransaction("Withdraw", () =>
                            withdraw(withdrawAmount),
                          )
                        }
                        disabled={
                          loading ||
                          !withdrawAmount ||
                          Number.parseFloat(withdrawAmount) >
                            Number.parseFloat(balances.confidential)
                        }
                        className="btn-secondary w-full sm:w-auto whitespace-nowrap py-3 cursor-pointer font-bold"
                      >
                        Withdraw to Public
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
