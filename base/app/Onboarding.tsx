"use client";

import React, { useState } from "react";
import { toast } from "sonner";

interface OnboardingProps {
  onComplete: () => void;
  config: any;
  balances: any;
  userKeys: any;
  loading: boolean;
  faucetLoading: boolean;
  handleFaucetRequest: () => Promise<void>;
  ensureAccount: () => Promise<void>;
  confidentialDeposit: (amount: string) => Promise<{ hash: string }>;
  confidentialTransfer: (recipient: string, amount: string) => Promise<{ hash: string }>;
  withdraw: (amount: string) => Promise<{ hash: string }>;
  tokenSymbol: string;
  handleTransaction: (
    actionName: string,
    action: () => Promise<{ hash: string }>,
    onSuccess?: () => void
  ) => Promise<void>;
}

export default function Onboarding({
  onComplete,
  config,
  balances,
  userKeys,
  loading,
  faucetLoading,
  handleFaucetRequest,
  ensureAccount,
  confidentialDeposit,
  confidentialTransfer,
  withdraw,
  tokenSymbol,
  handleTransaction,
}: OnboardingProps) {
  const [step, setStep] = useState(1);

  const [depositAmount, setDepositAmount] = useState("0.2");
  const [transferAmount, setTransferAmount] = useState("0.1");
  const [recipient, setRecipient] = useState("0x30626CD95A17fD54A5e3291c2daFDf46D2786425");
  const [withdrawAmount, setWithdrawAmount] = useState("0.1");

  const nextStep = () => setStep((s) => s + 1);

  const performClaim = async () => {
    try {
      await handleFaucetRequest();
      nextStep();
    } catch (e) {
    }
  };

  const performInit = async () => {
    try {
      await ensureAccount();
      nextStep();
    } catch (e) {
      toast.error("Account initialization failed");
    }
  };

  const performDeposit = async () => {
    await handleTransaction("Deposit", () => confidentialDeposit(depositAmount), nextStep);
  };

  const performTransfer = async () => {
    await handleTransaction("Transfer", () => confidentialTransfer(recipient, transferAmount), nextStep);
  };

  const performWithdraw = async () => {
    await handleTransaction("Withdraw", () => withdraw(withdrawAmount), () => {
      onComplete();
    });
  };

  return (
    <div className="card max-w-2xl mx-auto my-8 p-6 md:p-10 border border-black shadow-none bg-white">
      <div className="flex justify-between items-center mb-6 border-b border-black pb-4">
        <h2 className="text-2xl font-bold">Welcome Onboard</h2>
        <button onClick={onComplete} className="text-sm underline text-gray-500 hover:text-black">
          Skip Onboarding
        </button>
      </div>

      <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-6 flex flex-col sm:flex-row justify-between gap-4">
        <div>
          <span className="text-xs text-gray-500 block uppercase tracking-wide">Public Balance</span>
          <span className="font-mono text-lg font-medium">{balances.public} {tokenSymbol}</span>
        </div>
        <div>
          <span className="text-xs text-gray-500 block uppercase tracking-wide">Confidential Balance</span>
          <span className="font-mono text-lg font-medium">{balances.confidential} {tokenSymbol}</span>
        </div>
      </div>

      <div className="flex gap-2 mb-8">
        {[1, 2, 3, 4, 5].map((s) => (
          <div
            key={s}
            className={`h-2 flex-1 rounded-full ${s <= step ? "bg-black" : "bg-gray-200"}`}
          />
        ))}
      </div>

      <div className="min-h-[250px]">
        {step === 1 && (
          <div className="space-y-4 animate-in fade-in zoom-in duration-300">
            <h3 className="text-xl font-bold">Step 1: Claim Testnet Tokens</h3>
            <p className="text-gray-600">
              To get started, you need some testnet tokens (USDC) to pay for transactions and initial deposits.
            </p>
            <div className="pt-4">
              <button
                onClick={performClaim}
                disabled={faucetLoading}
                className="btn-primary w-full py-3"
              >
                {faucetLoading ? "Requesting..." : "Claim 0.25 USDC"}
              </button>
            </div>
            <div className="text-center pt-2">
               <button onClick={nextStep} className="text-sm underline text-gray-500 hover:text-black">
                 Already have tokens? Next
               </button>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4 animate-in fade-in zoom-in duration-300">
            <h3 className="text-xl font-bold">Step 2: Initialize Account</h3>
            <p className="text-gray-600">
              Create or recover your confidential keys to enable private transfers. This is required to access the confidential balances.
            </p>
            <div className="pt-4">
              <button
                onClick={performInit}
                disabled={loading}
                className="btn-primary w-full py-3"
              >
                {loading ? "Initializing..." : "Create / Access Account"}
              </button>
            </div>
            {userKeys && (
              <div className="text-center pt-2">
                 <button onClick={nextStep} className="text-sm underline text-gray-500 hover:text-black">
                   Already initialized. Next
                 </button>
              </div>
            )}
            {!userKeys && (
              <div className="text-center pt-2">
                 <button onClick={nextStep} className="text-sm underline text-gray-500 hover:text-black">
                   Skip for now
                 </button>
              </div>
            )}
          </div>
        )}

        {step === 3 && (
          <div className="space-y-4 animate-in fade-in zoom-in duration-300">
            <h3 className="text-xl font-bold">Step 3: Deposit to Confidential</h3>
            <p className="text-gray-600">
              Move public tokens into your confidential balance so you can transfer them privately.
            </p>
            <div>
              <label className="block text-sm mb-1">Amount</label>
              <input
                type="number"
                step="0.01"
                value={depositAmount}
                onChange={(e) => setDepositAmount(e.target.value)}
                className="input-primary mb-4"
                placeholder="0.0"
              />
              <button
                onClick={performDeposit}
                disabled={loading || !depositAmount}
                className="btn-primary w-full py-3"
              >
                Deposit
              </button>
            </div>
            <div className="text-center pt-2">
               <button onClick={nextStep} className="text-sm underline text-gray-500 hover:text-black">
                 Skip this step
               </button>
            </div>
          </div>
        )}

        {step === 4 && (
          <div className="space-y-4 animate-in fade-in zoom-in duration-300">
            <h3 className="text-xl font-bold">Step 4: Confidential Transfer</h3>
            <p className="text-gray-600">
              Send your confidential tokens to another address. On-chain observers won't see the exact amount transferred.
            </p>
            <div>
              <label className="block text-sm mb-1">Recipient Address</label>
              <input
                type="text"
                value={recipient}
                onChange={(e) => setRecipient(e.target.value)}
                className="input-primary mb-4"
                placeholder="0x..."
              />
              <label className="block text-sm mb-1">Amount</label>
              <input
                type="number"
                step="0.01"
                value={transferAmount}
                onChange={(e) => setTransferAmount(e.target.value)}
                className="input-primary mb-4"
                placeholder="0.0"
              />
              <button
                onClick={performTransfer}
                disabled={loading || !transferAmount || !recipient}
                className="btn-primary w-full py-3"
              >
                Transfer
              </button>
            </div>
            <div className="text-center pt-2">
               <button onClick={nextStep} className="text-sm underline text-gray-500 hover:text-black">
                 Skip this step
               </button>
            </div>
          </div>
        )}

        {step === 5 && (
          <div className="space-y-4 animate-in fade-in zoom-in duration-300">
            <h3 className="text-xl font-bold">Step 5: Withdraw from Confidential</h3>
            <p className="text-gray-600">
              Move tokens back to your public balance. You will regain full transparency over these funds.
            </p>
            <div>
              <label className="block text-sm mb-1">Amount</label>
              <input
                type="number"
                step="0.01"
                value={withdrawAmount}
                onChange={(e) => setWithdrawAmount(e.target.value)}
                className="input-primary mb-4"
                placeholder="0.0"
              />
              <button
                onClick={performWithdraw}
                disabled={loading || !withdrawAmount}
                className="btn-secondary w-full py-3"
              >
                Withdraw & Complete
              </button>
            </div>
            <div className="text-center pt-2">
               <button onClick={onComplete} className="text-sm underline text-gray-500 hover:text-black">
                 Finish Onboarding
               </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
