"use client";

import { useState, useEffect, useMemo } from "react";
import { useTurnkey, AuthState } from "@turnkey/react-wallet-kit";
import { useConfidentialClient } from "./hooks/useConfidentialClient";
import { AppError, parseError } from "./utils/errorParser";
import { Toaster, toast } from "sonner";
import { supportedChains } from "./providers";
import Onboarding from "./Onboarding";
import FluidLoader, { LoaderAction } from "./components/FluidLoader";
import LoginPage from "./components/LoginPage";
import { Wallet, LogOut, Check, ArrowUpRight } from "lucide-react";

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
    return <LoginPage login={login} />;
  }

  return (
    <div className="min-h-screen bg-[#E9ECF2] grid-bg flex flex-col">
      <Toaster position="top-right" />
      
      {(loading || isHandlingTx || faucetLoading) && (
        <FluidLoader action={loaderAction} />
      )}

      {/* Mobile Top Bar */}
      <header className="lg:hidden bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between sticky top-0 z-40">
        <div className="font-serif font-bold text-[#0F172A] text-lg">
          Fairblock <span className="text-[#1E4FD6] italic">Assets & Payments</span>
        </div>
        <button onClick={() => logout()} title="Logout" className="text-slate-400 hover:text-red-500 transition-colors">
          <LogOut className="w-5 h-5" />
        </button>
      </header>

      {/* Main Layout Grid */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-0 overflow-x-hidden">
        
        {/* Left Sidebar - Identity & Navigation */}
        <aside className="lg:col-span-4 bg-white border-r border-slate-200 p-6 md:p-10 flex flex-col justify-between lg:h-screen lg:sticky lg:top-0 overflow-y-auto">
          <div className="space-y-10">
            {/* Branding */}
            <div className="space-y-1">
              <h1 className="text-2xl font-serif font-bold text-[#0F172A]">
                Confidential Assets <br />
                <span className="text-[#1E4FD6] italic text-3xl">& Payments.</span>
              </h1>
              <p className="text-[10px] text-slate-400 uppercase tracking-[0.2em] font-bold">
                By Fairblock X Turnkey
              </p>
            </div>

            {/* Wallet Info */}
            <div className="space-y-4">
              <div className="text-[10px] text-slate-400 uppercase tracking-[0.2em] font-bold">
                Wallet Identity
              </div>
              <div className="p-4 border border-slate-100 bg-slate-50/50 space-y-3">
                <div className="flex items-center gap-2 overflow-hidden">
                  <Wallet className="w-4 h-4 text-[#1E4FD6] shrink-0" />
                  {resolvedAddress ? (
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(resolvedAddress);
                        setCopied(true);
                        setTimeout(() => setCopied(false), 2000);
                      }}
                      className="text-xs font-mono truncate hover:text-[#1E4FD6] transition-colors"
                    >
                      {resolvedAddress}
                    </button>
                  ) : (
                    <span className="text-xs text-slate-400 italic">Not connected</span>
                  )}
                  {copied && <Check className="w-3 h-3 text-green-500" />}
                </div>
                <div className="flex items-center justify-between text-xs font-mono">
                  <span className="text-slate-400">Native:</span>
                  <span className="text-[#0F172A]">
                    {Number.parseFloat(balances.native).toFixed(4)} ETH
                  </span>
                </div>
              </div>
            </div>

            {/* Network Info */}
            <div className="space-y-4">
              <div className="text-[10px] text-slate-400 uppercase tracking-[0.2em] font-bold">
                Network
              </div>
              <div className="flex flex-col gap-3 p-4 border border-slate-100">
                <div className="flex items-center gap-2 border-b border-slate-50 pb-2">
                  <div className="glow-dot" />
                  <span className="text-xs font-mono uppercase tracking-wider text-slate-600">
                    {supportedChains.find((c) => c.id === config.chainId)?.name || "Base Sepolia"}
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 leading-relaxed font-medium">
                  We also support all chains on EVM, Stellar, and Solana.
                </p>
              </div>
            </div>

            {/* Quick Actions */}
            <nav className="space-y-2">
              <button
                onClick={handleFaucetRequest}
                disabled={faucetLoading}
                className="w-full text-left p-3 text-sm font-medium hover:bg-slate-50 border-l-2 border-transparent hover:border-[#1E4FD6] transition-all flex items-center justify-between group"
              >
                <span>Request Faucet</span>
                <span className="text-[10px] bg-yellow-100 text-yellow-700 px-2 py-0.5 opacity-0 group-hover:opacity-100 transition-opacity">0.25 USDC</span>
              </button>
              <button
                onClick={restartOnboarding}
                className="w-full text-left p-3 text-sm font-medium hover:bg-slate-50 border-l-2 border-transparent hover:border-[#1E4FD6] transition-all"
              >
                Onboarding Guide
              </button>
              <a
                href="https://www.npmjs.com/package/@fairblock/stabletrust"
                target="_blank"
                rel="noopener noreferrer"
                className="w-full text-left p-3 text-sm font-medium hover:bg-slate-50 border-l-2 border-transparent hover:border-[#1E4FD6] transition-all block"
              >
                SDK Documentation
              </a>
            </nav>
          </div>

          {/* Logout */}
          <button
            onClick={() => logout()}
            className="w-full flex items-center gap-3 p-4 text-slate-400 hover:text-red-500 transition-colors border-t border-slate-100 mt-8"
          >
            <LogOut className="w-4 h-4" />
            <span className="text-sm font-medium uppercase tracking-widest">Disconnect</span>
          </button>
        </aside>

        {/* Middle Column - Main Action Area */}
        <main className="lg:col-span-5 p-6 md:p-10 lg:h-screen overflow-y-auto">
          <div className="space-y-10">
            
            {error && (
              <div className="bg-red-50 border border-red-100 text-red-700 px-6 py-4 flex items-center justify-between">
                <p className="text-sm font-medium">{error}</p>
                <button onClick={() => globalThis.location.reload()} className="text-xs underline">Dismiss</button>
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
              <div className="space-y-10">
                {!userKeys ? (
                  <div className="card text-center py-16 bg-white space-y-6">
                    <div className="space-y-2">
                      <h2 className="text-2xl font-serif text-[#0F172A]">Encryption Keys Required</h2>
                      <p className="text-sm text-slate-500">Accessing confidential state requires a cryptographic derivation via your secure enclave.</p>
                    </div>
                    <button
                      onClick={() => {
                        setLoaderAction("Init");
                        ensureAccount();
                      }}
                      className="btn-primary"
                      disabled={loading}
                    >
                      Derive Confidential Keys
                    </button>
                  </div>
                ) : (
                  <div className="space-y-8">
                    {/* Action Forms */}
                    <div className="space-y-12">
                      {/* Deposit Section */}
                      <section className="space-y-6">
                        <div className="flex items-center gap-4">
                          <h2 className="text-xl font-serif text-[#0F172A]">Deposit to Confidential</h2>
                          <div className="h-px flex-1 bg-slate-100" />
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                          <div className="md:col-span-3">
                            <label htmlFor="deposit-amount" className="text-[10px] uppercase tracking-widest text-slate-400 font-bold mb-2 block">Amount</label>
                            <input
                              id="deposit-amount"
                              type="number"
                              step="0.01"
                              value={depositAmount}
                              onChange={(e) => setDepositAmount(e.target.value)}
                              className="input-primary"
                              placeholder="0.00"
                            />
                          </div>
                          <button
                            onClick={() => handleTransaction("Deposit", () => confidentialDeposit(depositAmount))}
                            disabled={loading || !depositAmount}
                            className="btn-primary w-full"
                          >
                            Deposit
                          </button>
                        </div>
                      </section>

                      {/* Transfer Section */}
                      <section className="space-y-6">
                        <div className="flex items-center gap-4">
                          <h2 className="text-xl font-serif text-[#0F172A]">Private Transfer</h2>
                          <div className="h-px flex-1 bg-slate-100" />
                        </div>
                        <div className="space-y-4">
                          <div>
                            <label htmlFor="recipient-address" className="text-[10px] uppercase tracking-widest text-slate-400 font-bold mb-2 block">Recipient Address</label>
                            <input
                              id="recipient-address"
                              type="text"
                              value={recipient}
                              onChange={(e) => setRecipient(e.target.value)}
                              className="input-primary"
                              placeholder="0x..."
                            />
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                            <div className="md:col-span-3">
                              <label htmlFor="transfer-amount" className="text-[10px] uppercase tracking-widest text-slate-400 font-bold mb-2 block">Amount</label>
                              <input
                                id="transfer-amount"
                                type="number"
                                step="0.01"
                                value={transferAmount}
                                onChange={(e) => setTransferAmount(e.target.value)}
                                className="input-primary"
                                placeholder="0.00"
                              />
                            </div>
                            <button
                              onClick={() => handleTransaction("Transfer", () => confidentialTransfer(recipient, transferAmount))}
                              disabled={loading || !transferAmount || !recipient}
                              className="btn-primary w-full"
                            >
                              Transfer
                            </button>
                          </div>
                        </div>
                      </section>

                      {/* Withdraw Section */}
                      <section className="space-y-6">
                        <div className="flex items-center gap-4">
                          <h2 className="text-xl font-serif text-[#0F172A]">Withdraw to Public</h2>
                          <div className="h-px flex-1 bg-slate-100" />
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                          <div className="md:col-span-3">
                            <label htmlFor="withdraw-amount" className="text-[10px] uppercase tracking-widest text-slate-400 font-bold mb-2 block">Amount</label>
                            <input
                              id="withdraw-amount"
                              type="number"
                              step="0.01"
                              value={withdrawAmount}
                              onChange={(e) => setWithdrawAmount(e.target.value)}
                              className="input-primary"
                              placeholder="0.00"
                            />
                          </div>
                          <button
                            onClick={() => handleTransaction("Withdraw", () => withdraw(withdrawAmount))}
                            disabled={loading || !withdrawAmount}
                            className="btn-secondary w-full"
                          >
                            Withdraw
                          </button>
                        </div>
                      </section>
                    </div>
                  </div>
                )}
              </div>
            )}

          </div>
        </main>

        {/* Right Sidebar - Balances & Activity */}
        <aside className="lg:col-span-3 bg-white border-l border-slate-200 p-6 md:p-8 space-y-10 lg:h-screen overflow-y-auto">
          {/* Balances Section */}
          <div className="space-y-6">
            <div className="text-[10px] text-slate-400 uppercase tracking-[0.2em] font-bold">
              Account Assets
            </div>
            <div className="space-y-1">
              <div className="p-6 border border-slate-100 bg-slate-50/50 space-y-1 shadow-sm">
                <h3 className="text-[10px] text-slate-400 uppercase tracking-widest font-bold">Public Balance</h3>
                <div className="text-2xl font-serif text-[#0F172A]">
                  {balances.public} <span className="text-xs font-sans text-slate-400">{tokenSymbol}</span>
                </div>
              </div>
              <div className="p-6 border border-[#1E4FD6]/20 bg-[#1E4FD6]/5 space-y-1 shadow-sm">
                <h3 className="text-[10px] text-[#1E4FD6] uppercase tracking-widest font-bold italic">Confidential Balance</h3>
                <div className="text-2xl font-serif text-[#0F172A]">
                  {balances.confidential} <span className="text-xs font-sans text-slate-400">{tokenSymbol}</span>
                </div>
              </div>
            </div>
            <button
              onClick={() => {
                setLoaderAction("Refresh");
                fetchBalances();
              }}
              className="w-full py-3 text-[10px] uppercase tracking-widest font-bold border border-slate-200 hover:bg-slate-50 transition-colors"
              disabled={loading}
            >
              Refresh Assets
            </button>
          </div>

          {/* Latest Transaction */}
          <div className="space-y-4">
            <div className="text-[10px] text-slate-400 uppercase tracking-[0.2em] font-bold">
              Activity Log
            </div>
            {lastTxHash ? (
              <div className="p-6 border border-slate-100 bg-green-50/30 space-y-4 shadow-sm">
                <div className="flex items-center gap-2 text-green-600">
                  <Check className="w-4 h-4" />
                  <span className="text-xs font-bold uppercase tracking-wider">Confirmed</span>
                </div>
                <div className="space-y-2">
                  <p className="text-[10px] text-slate-400 uppercase tracking-widest font-bold">Hash</p>
                  <a
                    href={`${config.explorerUrl}${lastTxHash}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[10px] font-mono break-all hover:text-[#1E4FD6] underline"
                  >
                    {lastTxHash}
                  </a>
                </div>
              </div>
            ) : (
              <div className="p-8 border border-dashed border-slate-200 text-center">
                <p className="text-xs text-slate-400 italic">No recent activity.</p>
              </div>
            )}
          </div>

          {/* Integrate Section */}
          <div className="space-y-6 pt-10 border-t border-slate-100">
            <div className="space-y-2">
              <h4 className="text-lg font-serif text-[#0F172A]">Integrate with Fairblock</h4>
              <p className="text-xs text-slate-500 leading-relaxed">
                Unlock programmable privacy for your application. Access our core SDK documentation and partner resources.
              </p>
            </div>
            
            <div className="space-y-3">
              <a
                href="https://partners.fairblock.network/"
                target="_blank"
                rel="noopener noreferrer"
                className="group flex items-center justify-between p-5 bg-[#1E4FD6] text-white transition-all hover:bg-[#0F36A8]"
              >
                <span className="text-xs font-bold uppercase tracking-widest">Partner Portal</span>
                <ArrowUpRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
              </a>
              
              <a
                href="https://docs.fairblock.network"
                target="_blank"
                rel="noopener noreferrer"
                className="group flex items-center justify-between p-5 border border-slate-200 text-[#0F172A] hover:border-[#1E4FD6] transition-all bg-white"
              >
                <span className="text-xs font-bold uppercase tracking-widest text-slate-600 group-hover:text-[#1E4FD6]">Developer Docs</span>
                <ArrowUpRight className="w-4 h-4 text-slate-300 group-hover:text-[#1E4FD6] transition-all" />
              </a>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
