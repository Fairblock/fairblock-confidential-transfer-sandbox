"use client";

import { useState } from "react";
import { toast } from "sonner";
import { useAnonymousClient } from "./hooks/useAnonymousClient";
import AnonymousOnboarding from "./AnonymousOnboarding";
import FluidLoader, { LoaderAction } from "./components/FluidLoader";
import {
  Check,
  ArrowUpRight,
  Copy,
  AlertCircle,
  RefreshCw,
} from "lucide-react";
import { AppError, parseError } from "./utils/errorParser";

const ACCOUNT_ID_REGEX = /^[a-zA-Z0-9]{1,20}$/;

export default function AnonymousDashboard() {
  const {
    config,
    signer,
    accountId,
    anonBalanceDisplay,
    publicBalance,
    feeAmount,
    feeTokenIsNative,
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
  } = useAnonymousClient();

  const feeSymbol = feeTokenIsNative ? "ETH" : tokenSymbol;

  // Form state
  const [depositAmount, setDepositAmount] = useState("");
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [withdrawDestination, setWithdrawDestination] = useState("");
  const [transferAmount, setTransferAmount] = useState("");
  const [transferTarget, setTransferTarget] = useState("");
  const [transferMode, setTransferMode] = useState<"public" | "anonymous">(
    "public",
  );
  const [feeTopUpOverride, setFeeTopUpOverride] = useState("");
  const feeTopUpAmount = feeTopUpOverride || tenTransfersFee || "";

  // Account setup state
  const [accountIdInput, setAccountIdInput] = useState("");
  const [accountIdError, setAccountIdError] = useState("");

  // UI state
  const [isHandlingTx, setIsHandlingTx] = useState(false);
  const [faucetLoading, setFaucetLoading] = useState(false);
  const [loaderAction, setLoaderAction] = useState<LoaderAction>("Default");
  const [copiedAccountId, setCopiedAccountId] = useState(false);
  const [onboardingFinished, setOnboardingFinished] = useState(() => {
    if (typeof window !== "undefined") {
      return Boolean(localStorage.getItem("fairblock_anon_onboarding"));
    }
    return true;
  });

  const completeOnboarding = () => {
    localStorage.setItem("fairblock_anon_onboarding", "true");
    setOnboardingFinished(true);
  };

  const handleTransaction = async (
    actionName: string,
    action: () => Promise<{ hash: string }>,
    onSuccess?: () => void,
  ) => {
    setLoaderAction(actionName as LoaderAction);
    setIsHandlingTx(true);
    try {
      const { hash } = await action();
      const displayHash = hash.startsWith("0x") ? hash : null;
      toast.success(`${actionName} Successful!`, {
        description: displayHash ? (
          <a
            href={`${config.explorerUrl}${displayHash}`}
            target="_blank"
            rel="noopener noreferrer"
            className="underline text-blue-600 hover:text-blue-800"
          >
            View on Explorer
          </a>
        ) : (
          <span className="font-mono text-xs">{hash.slice(0, 20)}…</span>
        ),
        duration: 5000,
      });
      if (onSuccess) {
        onSuccess();
      } else {
        setDepositAmount("");
        setTransferAmount("");
        setWithdrawAmount("");
        setWithdrawDestination("");
        setFeeTopUpOverride("");
      }
    } catch (err) {
      const errorMessage = parseError(err as AppError);
      toast.error(`${actionName} Failed`, { description: errorMessage });
    } finally {
      setIsHandlingTx(false);
    }
  };

  const handleFaucetRequest = async () => {
    setLoaderAction("Faucet");
    setFaucetLoading(true);
    try {
      const data = await requestFaucet();
      toast.success("Funds Received!", {
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
      });
    } catch (err) {
      const errorMessage = parseError(err as AppError);
      toast.error("Faucet Failed", { description: errorMessage });
    } finally {
      setFaucetLoading(false);
    }
  };

  const validateAccountId = (id: string) => {
    if (!id) return "Account ID is required";
    if (!ACCOUNT_ID_REGEX.test(id))
      return "Letters and numbers only, max 20 characters";
    return "";
  };

  const handleSetupAccount = async () => {
    const err = validateAccountId(accountIdInput);
    if (err) {
      setAccountIdError(err);
      return;
    }
    setAccountIdError("");
    setLoaderAction("Init" as LoaderAction);
    setIsHandlingTx(true);
    try {
      await setupAccount(accountIdInput);
      toast.success(`Account "${accountIdInput}" is ready!`);
    } catch (e) {
      toast.error("Setup failed", { description: (e as Error).message });
    } finally {
      setIsHandlingTx(false);
    }
  };

  const feeLow = transfersRemaining !== null && transfersRemaining < 3;
  const clientReady = !!signer;

  if (!relayConfigured) {
    return (
      <div className="lg:col-span-8 p-6 md:p-10 space-y-6">
        <div className="bg-amber-50 border border-amber-300 p-6 flex gap-4">
          <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div className="space-y-2">
            <p className="text-sm font-bold text-amber-800">
              Relay Not Configured
            </p>
            <p className="text-sm text-amber-700">
              Anonymous transfers require a Fairycloak relay URL. Add{" "}
              <code className="bg-amber-100 px-1 font-mono text-xs">
                NEXT_PUBLIC_FAIRYCLOAK_URL
              </code>{" "}
              to your{" "}
              <code className="bg-amber-100 px-1 font-mono text-xs">
                .env.local
              </code>{" "}
              file and restart the server.
            </p>
            <a
              href="mailto:hello@fairblock.network"
              className="text-xs underline text-amber-700 hover:text-amber-900"
            >
              Contact Fairblock to get relay access →
            </a>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* Middle column */}
      <main className="lg:col-span-5 p-6 md:p-10 lg:h-screen overflow-y-auto">
        {(loading || isHandlingTx || faucetLoading) && (
          <FluidLoader action={loaderAction} />
        )}
        <div className="space-y-6">
          {error && (
            <div className="bg-red-50 border border-red-100 text-red-700 px-6 py-4 flex items-center justify-between">
              <p className="text-sm font-medium">{error}</p>
              <button
                onClick={() => globalThis.location.reload()}
                className="text-xs underline"
              >
                Dismiss
              </button>
            </div>
          )}

          {/* Onboarding or Account Setup or Dashboard */}
          {!onboardingFinished ? (
            <AnonymousOnboarding
              onComplete={completeOnboarding}
              publicBalance={publicBalance}
              anonBalanceDisplay={anonBalanceDisplay}
              tokenSymbol={tokenSymbol}
              loading={loading}
              faucetLoading={faucetLoading}
              feeSymbol={feeSymbol}
              feePerTransferDisplay={feePerTransferDisplay}
              tenTransfersFee={tenTransfersFee}
              transfersRemaining={transfersRemaining}
              handleFaucetRequest={handleFaucetRequest}
              setupAccount={setupAccount}
              anonymousDeposit={anonymousDeposit}
              anonymousTransferToPublic={anonymousTransferToPublic}
              topUpFees={topUpFees}
              handleTransaction={handleTransaction}
              accountId={accountId}
              clientReady={clientReady}
            />
          ) : !accountId ? (
            /* Account setup screen */
            <div className="bg-white border border-slate-200 p-8 space-y-6">
              <div className="space-y-2">
                <h2 className="text-2xl font-serif text-[#0F172A]">
                  Set Up Anonymous Account
                </h2>
                <p className="text-sm text-slate-500">
                  Choose a username. Your wallet address will never appear
                  onchain only this ID.
                </p>
              </div>

              <div className="bg-slate-50 border border-slate-200 p-4 text-xs text-slate-700 space-y-1">
                <p className="font-semibold">Account ID rules:</p>
                <ul className="list-disc list-inside space-y-0.5">
                  <li>Letters and numbers only (A–Z, a–z, 0–9)</li>
                  <li>Max 20 characters · Case-sensitive</li>
                  <li>Same wallet + same ID always gives you access back</li>
                </ul>
              </div>

              <div>
                <label className="text-[10px] uppercase tracking-widest text-slate-400 font-bold mb-2 block">
                  Account ID
                </label>
                <input
                  type="text"
                  value={accountIdInput}
                  onChange={(e) => {
                    setAccountIdInput(e.target.value);
                    setAccountIdError("");
                  }}
                  className="input-primary mb-1"
                  placeholder="e.g. alice123"
                  maxLength={20}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleSetupAccount();
                  }}
                />
                {accountIdError && (
                  <p className="text-xs text-red-500 mt-1">{accountIdError}</p>
                )}
                <p className="text-[10px] text-slate-400 mt-1">
                  {accountIdInput.length}/20 characters
                </p>
              </div>

              <button
                onClick={handleSetupAccount}
                disabled={loading || !accountIdInput || !clientReady}
                className="btn-anon w-full"
              >
                {loading
                  ? "Deriving Keys..."
                  : !clientReady
                    ? "Connecting Wallet..."
                    : "Access / Create Account"}
              </button>
            </div>
          ) : (
            /* Main action area */
            <div className="space-y-10">
              {/* Deposit */}
              <section className="space-y-5">
                <div className="flex items-center gap-4">
                  <h2 className="text-xl font-serif text-[#0F172A]">Deposit</h2>
                  <div className="h-px flex-1 bg-slate-100" />
                  <span className="text-[10px] text-slate-400 bg-slate-100 px-2 py-0.5 font-mono">
                    You pay gas
                  </span>
                </div>
                <p className="text-xs text-slate-500">
                  Move public tokens into your anonymous balance. Your wallet
                  signs this transaction publicly all other operations are
                  relay-paid.
                </p>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                  <div className="md:col-span-3">
                    <label className="text-[10px] uppercase tracking-widest text-slate-400 font-bold mb-2 block">
                      Amount
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={depositAmount}
                      onChange={(e) => {
                        const val = e.target.value;
                        if (Number(val) < 0) return;
                        if (!/^\d*\.?\d{0,2}$/.test(val)) return;
                        setDepositAmount(val);
                      }}
                      className="input-primary"
                      placeholder="0.00"
                    />
                  </div>
                  <button
                    onClick={() =>
                      handleTransaction("Deposit", () =>
                        anonymousDeposit(depositAmount),
                      )
                    }
                    disabled={loading || !depositAmount}
                    className="btn-anon w-full"
                  >
                    Deposit
                  </button>
                </div>
              </section>

              {/* Transfer */}
              <section className="space-y-5">
                <div className="flex items-center gap-4">
                  <h2 className="text-xl font-serif text-[#0F172A]">
                    Anonymous Transfer
                  </h2>
                  <div className="h-px flex-1 bg-slate-100" />
                  <span className="text-[10px] text-slate-500 bg-slate-100 border border-slate-200 px-2 py-0.5 font-mono">
                    relay pays gas
                  </span>
                </div>
                <p className="text-xs text-slate-500">
                  Your wallet address is never revealed onchain. The relay
                  submits the transaction and pays gas.
                </p>

                {feeLow && (
                  <div className="flex items-center gap-2 bg-orange-50 border border-orange-200 px-4 py-3 text-xs text-orange-700">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>
                      Low fee reserve (~{transfersRemaining} transfers left).
                      Top up below to continue transferring.
                    </span>
                  </div>
                )}

                {/* Recipient type toggle */}
                <div className="flex border border-slate-200">
                  <button
                    onClick={() => {
                      setTransferMode("public");
                      setTransferTarget("");
                    }}
                    className={`flex-1 py-2 text-xs font-bold uppercase tracking-widest transition-colors ${
                      transferMode === "public"
                        ? "bg-[#0F172A] text-white"
                        : "text-slate-500 hover:bg-slate-50"
                    }`}
                  >
                    To Public Address
                  </button>
                  <button
                    onClick={() => {
                      setTransferMode("anonymous");
                      setTransferTarget("");
                    }}
                    className={`flex-1 py-2 text-xs font-bold uppercase tracking-widest transition-colors ${
                      transferMode === "anonymous"
                        ? "bg-[#0F172A] text-white"
                        : "text-slate-500 hover:bg-slate-50"
                    }`}
                  >
                    To Account ID
                  </button>
                </div>

                <div className="space-y-4">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-[10px] uppercase tracking-widest text-slate-400 font-bold">
                        {transferMode === "public"
                          ? "Recipient Address"
                          : "Recipient Account ID"}
                      </label>
                      {transferMode === "public" ? (
                        <button
                          type="button"
                          onClick={() =>
                            setTransferTarget(
                              "0xD9A6E167a149219155a1bc5480Bc9738CdDb48F7",
                            )
                          }
                          className="text-[10px] text-[#0F172A] hover:underline font-mono"
                        >
                          Use demo address
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setTransferTarget("test1")}
                          className="text-[10px] text-[#0F172A] hover:underline font-mono"
                        >
                          Use demo account
                        </button>
                      )}
                    </div>
                    <input
                      type="text"
                      value={transferTarget}
                      onChange={(e) => setTransferTarget(e.target.value)}
                      className="input-primary"
                      placeholder={
                        transferMode === "public" ? "0x..." : "e.g. alice123"
                      }
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                    <div className="md:col-span-3">
                      <label className="text-[10px] uppercase tracking-widest text-slate-400 font-bold mb-2 block">
                        Amount
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={transferAmount}
                        onChange={(e) => {
                          const val = e.target.value;
                          if (Number(val) < 0) return;
                          if (!/^\d*\.?\d{0,2}$/.test(val)) return;
                          setTransferAmount(val);
                        }}
                        className="input-primary"
                        placeholder="0.00"
                      />
                    </div>
                    <button
                      onClick={() =>
                        handleTransaction("Transfer", () =>
                          transferMode === "public"
                            ? anonymousTransferToPublic(
                                transferTarget,
                                transferAmount,
                              )
                            : anonymousTransferToAnonymous(
                                transferTarget,
                                transferAmount,
                              ),
                        )
                      }
                      disabled={loading || !transferAmount || !transferTarget}
                      className="btn-anon w-full"
                    >
                      Send
                    </button>
                  </div>
                </div>
              </section>

              {/* Withdraw */}
              <section className="space-y-5">
                <div className="flex items-center gap-4">
                  <h2 className="text-xl font-serif text-[#0F172A]">
                    Withdraw to Public
                  </h2>
                  <div className="h-px flex-1 bg-slate-100" />
                  <span className="text-[10px] text-slate-500 bg-slate-100 border border-slate-200 px-2 py-0.5 font-mono">
                    relay pays gas
                  </span>
                </div>
                <p className="text-xs text-slate-500">
                  Pull funds to any public EVM address. The relay submits
                  onchain your anonymous account stays hidden.
                </p>
                <div className="space-y-4">
                  <div>
                    <label className="text-[10px] uppercase tracking-widest text-slate-400 font-bold mb-2 block">
                      Destination Address
                    </label>
                    <input
                      type="text"
                      value={withdrawDestination}
                      onChange={(e) => setWithdrawDestination(e.target.value)}
                      className="input-primary"
                      placeholder="0x... (your wallet or any address)"
                    />
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                    <div className="md:col-span-3">
                      <label className="text-[10px] uppercase tracking-widest text-slate-400 font-bold mb-2 block">
                        Amount
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={withdrawAmount}
                        onChange={(e) => {
                          const val = e.target.value;
                          if (Number(val) < 0) return;
                          if (!/^\d*\.?\d{0,2}$/.test(val)) return;
                          setWithdrawAmount(val);
                        }}
                        className="input-primary"
                        placeholder="0.00"
                      />
                    </div>
                    <button
                      onClick={() =>
                        handleTransaction("Withdraw", () =>
                          anonymousWithdraw(
                            withdrawDestination,
                            withdrawAmount,
                          ),
                        )
                      }
                      disabled={
                        loading || !withdrawAmount || !withdrawDestination
                      }
                      className="btn-secondary w-full"
                    >
                      Withdraw
                    </button>
                  </div>
                </div>
              </section>
            </div>
          )}
        </div>
      </main>

      {/* Right sidebar */}
      <aside className="lg:col-span-3 bg-white border-l border-slate-200 p-4 md:p-5 space-y-5 lg:h-screen overflow-y-auto">
        {/* Account Identity */}
        {accountId && (
          <div className="space-y-4">
            <div className="text-[10px] text-slate-400 uppercase tracking-[0.2em] font-bold">
              Anonymous Identity
            </div>
            <div className="p-3 border border-slate-200 bg-slate-50 space-y-1.5">
              <p className="text-[10px] uppercase tracking-widest font-bold text-slate-500">
                Account ID
              </p>
              <div className="flex items-center gap-2">
                <span className="font-mono text-sm font-bold text-[#0F172A]">
                  {accountId}
                </span>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(accountId);
                    setCopiedAccountId(true);
                    setTimeout(() => setCopiedAccountId(false), 2000);
                  }}
                  className="text-slate-400 hover:text-[#0F172A] transition-colors"
                >
                  {copiedAccountId ? (
                    <Check className="w-3 h-3 text-green-500" />
                  ) : (
                    <Copy className="w-3 h-3" />
                  )}
                </button>
              </div>
              <button
                onClick={clearAccount}
                className="text-[10px] text-slate-400 underline hover:text-red-500 transition-colors"
              >
                Switch account
              </button>
            </div>
          </div>
        )}

        {/* Balances */}
        <div className="space-y-4">
          <div className="text-[10px] text-slate-400 uppercase tracking-[0.2em] font-bold">
            Account Assets
          </div>
          <div className="space-y-1">
            <div className="p-3 border border-slate-100 bg-slate-50/50 space-y-0.5">
              <h3 className="text-[10px] text-slate-400 uppercase tracking-widest font-bold">
                Public Balance
              </h3>
              <div className="text-xl font-serif text-[#0F172A]">
                {publicBalance}{" "}
                <span className="text-xs font-sans text-slate-400">
                  {tokenSymbol}
                </span>
              </div>
            </div>
            <div className="p-3 border border-[#0F172A]/20 bg-[#0F172A]/5 space-y-0.5">
              <h3 className="text-[10px] text-[#0F172A] uppercase tracking-widest font-bold">
                Anonymous Balance
              </h3>
              <div className="text-xl font-serif text-[#0F172A]">
                {anonBalanceDisplay.total}{" "}
                <span className="text-xs font-sans text-slate-400">
                  {tokenSymbol}
                </span>
              </div>
              {Number(anonBalanceDisplay.pending) > 0 && (
                <p className="text-[10px] text-slate-400">
                  +{anonBalanceDisplay.pending} pending
                </p>
              )}
            </div>
          </div>
          <button
            onClick={() => fetchBalances()}
            disabled={loading}
            className="w-full py-2 text-[10px] uppercase tracking-widest font-bold border border-slate-200 hover:bg-slate-50 transition-colors flex items-center justify-center gap-2"
          >
            <RefreshCw className="w-3 h-3" />
            Refresh
          </button>
        </div>

        {/* Prepaid fee reserve */}
        {accountId && (
          <div className="space-y-4">
            <div className="text-[10px] text-slate-400 uppercase tracking-[0.2em] font-bold">
              Fee Reserve
            </div>
            <div
              className={`p-3 border space-y-1.5 ${feeLow ? "border-orange-300 bg-orange-50" : "border-slate-100 bg-slate-50/50"}`}
            >
              <div className="flex justify-between items-baseline">
                <span className="text-[10px] uppercase tracking-widest font-bold text-slate-400">
                  Transfers Remaining
                </span>
                <span
                  className={`text-xl font-serif ${feeLow ? "text-orange-600" : "text-[#0F172A]"}`}
                >
                  {transfersRemaining !== null ? `~${transfersRemaining}` : "—"}
                </span>
              </div>
              <p className="text-[10px] text-slate-400">
                {feeAmount > 0n
                  ? `${feePerTransferDisplay} ${feeSymbol} per transfer`
                  : "No fee configured"}
              </p>
            </div>

            {/* Top up fees */}
            <div className="space-y-2">
              <label className="text-[10px] uppercase tracking-widest text-slate-400 font-bold block">
                Top Up Amount ({feeSymbol}) covers ~10 transfers
              </label>
              <div className="flex gap-2">
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={feeTopUpAmount}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (Number(val) < 0) return;
                    if (!/^\d*\.?\d{0,2}$/.test(val)) return;
                    setFeeTopUpOverride(val);
                  }}
                  className="input-primary flex-1 text-sm py-2"
                  placeholder="0.00"
                />
                <button
                  onClick={() =>
                    handleTransaction("Top Up Fees", () =>
                      topUpFees(feeTopUpAmount),
                    )
                  }
                  disabled={loading || !feeTopUpAmount}
                  className="btn-anon px-4 text-xs whitespace-nowrap"
                >
                  Top Up
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Latest TX */}
        <div className="space-y-4">
          <div className="text-[10px] text-slate-400 uppercase tracking-[0.2em] font-bold">
            Activity Log
          </div>
          {lastTxHash ? (
            <div className="p-5 border border-slate-100 bg-green-50/30 space-y-4">
              <div className="flex items-center gap-2 text-green-600">
                <Check className="w-4 h-4" />
                <span className="text-xs font-bold uppercase tracking-wider">
                  Confirmed
                </span>
              </div>
              <div className="space-y-1">
                <p className="text-[10px] text-slate-400 uppercase tracking-widest font-bold">
                  {lastTxHash.startsWith("0x") ? "Hash" : "Request ID"}
                </p>
                {lastTxHash.startsWith("0x") ? (
                  <a
                    href={`${config.explorerUrl}${lastTxHash}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[10px] font-mono break-all hover:text-[#0F172A] underline"
                  >
                    {lastTxHash}
                  </a>
                ) : (
                  <p className="text-[10px] font-mono break-all text-slate-500">
                    {lastTxHash}
                  </p>
                )}
              </div>
            </div>
          ) : (
            <div className="p-8 border border-dashed border-slate-200 text-center">
              <p className="text-xs text-slate-400 italic">
                No recent activity.
              </p>
            </div>
          )}
        </div>

        {/* Integrate section */}
        <div className="space-y-4 pt-6 border-t border-slate-100">
          <h4 className="text-base font-serif text-[#0F172A]">
            Integrate Fairblock
          </h4>
          <div className="space-y-2">
            <a
              href="https://partners.fairblock.network/"
              target="_blank"
              rel="noopener noreferrer"
              className="group flex items-center justify-between p-4 bg-[#0F172A] text-white hover:bg-black transition-all"
            >
              <span className="text-xs font-bold uppercase tracking-widest">
                Partner Portal
              </span>
              <ArrowUpRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
            </a>
            <a
              href="https://docs.fairblock.network"
              target="_blank"
              rel="noopener noreferrer"
              className="group flex items-center justify-between p-4 border border-slate-200 text-[#0F172A] hover:border-[#0F172A] transition-all bg-white"
            >
              <span className="text-xs font-bold uppercase tracking-widest text-slate-600 group-hover:text-[#0F172A]">
                Developer Docs
              </span>
              <ArrowUpRight className="w-4 h-4 text-slate-300 group-hover:text-[#0F172A] transition-all" />
            </a>
          </div>
        </div>
      </aside>
    </>
  );
}
