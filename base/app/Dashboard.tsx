"use client";

import { useState, useEffect } from "react";
import { usePrivy } from "@privy-io/react-auth";
import { useConfidentialClient } from "./hooks/useConfidentialClient";
import { parseError } from "./utils/errorParser";
import { Toaster, toast } from "sonner";
import { supportedChains } from "./Providers";
import Onboarding from "./Onboarding";
import FluidLoader from "./components/FluidLoader";

export default function Dashboard() {
  const { login, logout, authenticated, user } = usePrivy();
  const {
    config,

    ensureAccount,
    fetchBalances,
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

  const [faucetLoading, setFaucetLoading] = useState(false);
  const [isHandlingTx, setIsHandlingTx] = useState(false);

  const [onboardingFinished, setOnboardingFinished] = useState(true);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    if (typeof window !== "undefined") {
      const finished = localStorage.getItem("fairblock_onboarding");
      if (!finished) {
        setOnboardingFinished(false);
      }
    }
  }, []);

  const completeOnboarding = () => {
    localStorage.setItem("fairblock_onboarding", "true");
    setOnboardingFinished(true);
  };

  const restartOnboarding = () => {
    localStorage.removeItem("fairblock_onboarding");
    setOnboardingFinished(false);
  };

  const linkedSmartWalletAddress =
    user?.linkedAccounts?.find(
      (account) => account.type === "smart_wallet" && "address" in account,
    )?.address ?? null;

  const linkedWalletAddress =
    user?.linkedAccounts?.find(
      (account) => account.type === "wallet" && "address" in account,
    )?.address ?? null;

  const resolvedAddress =
    user?.wallet?.address ?? linkedSmartWalletAddress ?? linkedWalletAddress;

  const handleTransaction = async (
    actionName: string,
    action: () => Promise<{ hash: string }>,
    onSuccess?: () => void
  ) => {
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
    } catch (err: unknown) {
      console.error(err);
      const errorMessage = parseError(err);
      toast.error(`${actionName} Failed`, {
        description: errorMessage,
      });
    } finally {
      setIsHandlingTx(false);
    }
  };

  const handleFaucetRequest = async () => {
    if (!resolvedAddress) return;
    setFaucetLoading(true);
    try {
      const response = await fetch("/api/faucet", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address: resolvedAddress }),
      });
      const data = await response.json();

      if (!response.ok) throw new Error(data.error || "Faucet request failed");

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
      fetchBalances();
      setTimeout(fetchBalances, 3000);
      setTimeout(fetchBalances, 6000);
    } catch (err: unknown) {
      const errorMessage = parseError(err);
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
      <div className="flex flex-col items-center justify-center min-h-screen">
        <h1 className="text-2xl sm:text-4xl font-bold mb-8 whitespace-nowrap truncate max-w-full px-4 text-center">
          Fairblock Confidential Transfer Sandbox
        </h1>
        <button onClick={login} className="btn-primary text-xl px-8 py-4">
          Connect Wallet
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-4 sm:p-6 md:p-8 max-w-5xl mx-auto">
      <Toaster position="top-right" />

      <header className="flex flex-col md:flex-row justify-between items-center mb-8 border-b border-black pb-6 gap-6 md:gap-4">
        <div className="flex flex-col items-center md:items-start text-center md:text-left space-y-2">
          <h1 className="text-xl sm:text-2xl font-bold whitespace-normal md:whitespace-nowrap">
            Fairblock Confidential Transfer Sandbox
          </h1>
          <div className="flex flex-col sm:flex-row items-center gap-2 sm:gap-4">
            <a
              href="https://www.npmjs.com/package/@fairblock/stabletrust"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-sm text-blue-600 underline hover:text-blue-800"
            >
              <span className="inline-flex items-center rounded bg-red-600 text-white font-bold px-1.5 py-0.5 leading-none text-xs">
                npm
              </span>
              npm package
            </a>
            <span className="hidden sm:inline text-gray-300">|</span>
            <p className="text-sm font-medium text-gray-600">
              {resolvedAddress
                ? `Connected: ${resolvedAddress.slice(0, 6)}...${resolvedAddress.slice(-4)}`
                : "Not Connected"}
            </p>
          </div>
        </div>
        <div className="flex flex-col sm:flex-row flex-wrap items-center justify-center md:justify-end gap-3 w-full md:w-auto">
          {onboardingFinished && (
            <button
              onClick={restartOnboarding}
              className="w-full sm:w-auto text-sm bg-gray-100 text-gray-800 px-4 py-2 rounded-full border border-gray-200 hover:bg-gray-300 transition-colors font-medium text-center"
            >
              Restart Onboarding
            </button>
          )}
          <button
            onClick={handleFaucetRequest}
            disabled={faucetLoading}
            className="w-full sm:w-auto text-sm bg-yellow-100 text-yellow-800 px-4 py-2 rounded-full border border-yellow-200 hover:bg-yellow-200 disabled:opacity-50 transition-colors font-medium text-center"
          >
            Get 0.25 USDC
          </button>
          <div className="w-full sm:w-auto text-sm font-medium bg-gray-50 px-4 py-2 rounded-full border border-gray-200 flex items-center justify-center">
            <span className="text-gray-500 mr-1">Network:</span>
            {supportedChains.find((c) => c.id === config.chainId)?.name ||
              `Unknown (${config.chainId})`}
          </div>

          <button
            onClick={logout}
            className="w-full sm:w-auto text-sm bg-black text-white px-5 py-2 rounded-full hover:bg-gray-800 transition-colors font-medium text-center"
          >
            Disconnect
          </button>
        </div>
      </header>

      {error && (
        <div
          className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-6"
          role="alert"
        >
          <strong className="font-bold">Error: </strong>
          <span className="block sm:inline">{error}</span>
        </div>
      )}

      {(loading || isHandlingTx || faucetLoading) && (
        <FluidLoader />
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
              {parseFloat(balances.native) < 0.0005 ? (
                <>
                  <h2 className="text-xl mb-4">Insufficient Funds</h2>
                  <p className="mb-6 text-gray-600">
                    You need testnet tokens (USDC/ETH) to pay for gas fees.
                  </p>
                  <button
                    onClick={handleFaucetRequest}
                    className="btn-primary bg-green-600 hover:bg-green-700 border-green-700"
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
                  <h2 className="text-xl mb-4">Initialize Confidential Account</h2>
                  <p className="mb-6 text-gray-600">
                    You need to derive keys to access confidential features.
                  </p>
                  <button
                    onClick={ensureAccount}
                    className="btn-primary"
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
              <h3 className="text-sm text-gray-500 mb-1">Public Balance</h3>
              <p className="text-2xl font-mono">
                {balances.public} {tokenSymbol}
              </p>
            </div>
            <div className="card">
              <h3 className="text-sm text-gray-500 mb-1">
                Confidential Balance
              </h3>
              <p className="text-2xl font-mono">
                {balances.confidential} {tokenSymbol}
              </p>
            </div>
            <button
              onClick={() => fetchBalances()}
              className="btn-secondary w-full md:col-span-2"
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
                  <label className="block text-sm mb-1">Amount</label>
                  <input
                    type="number"
                    step="0.01"
                    value={depositAmount}
                    onChange={(e) => setDepositAmount(e.target.value)}
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
                  disabled={loading || !depositAmount}
                  className="btn-primary w-full"
                >
                  Deposit to Confidential
                </button>
              </div>
            </div>

            <div className="card">
              <h2 className="text-lg font-bold mb-4 border-b border-black pb-2">
                Transfer
              </h2>
              {parseFloat(balances.confidential) <= 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <p>You need a confidential balance to transfer.</p>
                  <p className="text-sm mt-1">Please deposit funds first.</p>
                </div>
              ) : (
                <div className="space-y-6">
                  <div>
                    <label className="block text-sm mb-1">
                      Recipient Address
                    </label>
                    <input
                      type="text"
                      value={recipient}
                      onChange={(e) => setRecipient(e.target.value)}
                      className="input-primary"
                      placeholder="0x..."
                    />
                  </div>
                  <div>
                    <label className="block text-sm mb-1">Amount</label>
                    <input
                      type="number"
                      step="0.01"
                      value={transferAmount}
                      onChange={(e) => setTransferAmount(e.target.value)}
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
                    disabled={loading || !transferAmount || !recipient}
                    className="btn-primary w-full"
                  >
                    Transfer Confidentially
                  </button>
                  <div className="pt-2 border-t border-gray-200 mt-2">
                    <button
                      onClick={() => {
                        setRecipient(
                          "0x30626CD95A17fD54A5e3291c2daFDf46D2786425",
                        );
                        setTransferAmount("0.01");
                      }}
                      className="text-xs text-blue-600 underline hover:text-blue-800 w-full text-center"
                    >
                      Fill Demo Transfer (0.01 to Alice)
                    </button>
                  </div>
                </div>
              )}
            </div>

            <div className="card md:col-span-2">
              <h2 className="text-lg font-bold mb-4 border-b border-black pb-2">
                Withdraw
              </h2>
              {parseFloat(balances.confidential) <= 0 ? (
                <div className="text-center py-4 text-gray-500">
                  <p>You need a confidential balance to withdraw.</p>
                </div>
              ) : (
                <div className="flex flex-col sm:flex-row gap-4 sm:items-end">
                  <div className="flex-1 w-full">
                    <label className="block text-sm mb-1">Amount</label>
                    <input
                      type="number"
                      step="0.01"
                      value={withdrawAmount}
                      onChange={(e) => setWithdrawAmount(e.target.value)}
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
                    disabled={loading || !withdrawAmount}
                    className="btn-secondary w-full sm:w-auto whitespace-nowrap py-3"
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
