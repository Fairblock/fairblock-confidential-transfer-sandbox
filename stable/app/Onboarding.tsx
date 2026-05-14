"use client";
import { toast } from "sonner";

import { ConfidentialConfig } from "./hooks/useConfidentialClient";
import { useState } from "react";
import { Confetti } from "@/components/ui/confetti";
interface OnboardingProps {
  onComplete: () => void;
  config: ConfidentialConfig;
  balances: { public: string | number; confidential: string | number };
  userKeys: { publicKey: string; privateKey: string } | null;
  loading: boolean;
  faucetLoading: boolean;
  handleFaucetRequest: () => Promise<void>;
  ensureAccount: () => Promise<void>;
  confidentialDeposit: (amount: string) => Promise<{ hash: string }>;
  confidentialTransfer: (
    recipient: string,
    amount: string,
  ) => Promise<{ hash: string }>;
  withdraw: (amount: string) => Promise<{ hash: string }>;
  tokenSymbol: string;
  handleTransaction: (
    actionName: string,
    action: () => Promise<{ hash: string }>,
    onSuccess?: () => void,
  ) => Promise<void>;
}

export default function Onboarding({
  onComplete,
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
  const [recipient, setRecipient] = useState(
    "0xD9A6E167a149219155a1bc5480Bc9738CdDb48F7",
  );
  const [withdrawAmount, setWithdrawAmount] = useState("0.1");

  const nextStep = () => setStep((s) => s + 1);

  const performClaim = async () => {
    try {
      await handleFaucetRequest();
      nextStep();
    } catch (e) {
      console.log(e);
    }
  };

  const performInit = async () => {
    try {
      await ensureAccount();
      nextStep();
    } catch (e) {
      console.log(e);
      toast.error("Account initialization failed");
    }
  };

  const performDeposit = async () => {
    await handleTransaction(
      "Deposit",
      () => confidentialDeposit(depositAmount),
      nextStep,
    );
  };

  const performTransfer = async () => {
    await handleTransaction(
      "Transfer",
      () => confidentialTransfer(recipient, transferAmount),
      nextStep,
    );
  };

  const performWithdraw = async () => {
    await handleTransaction(
      "Withdraw",
      () => withdraw(withdrawAmount),
      () => {
        nextStep();
      },
    );
  };

  return (
    <div className="card max-w-2xl mx-auto my-8 p-6 md:p-10 border border-slate-200 shadow-none bg-white">
      <div className="flex justify-between items-center mb-6 border-b border-slate-200 pb-4">
        <h2 className="text-2xl font-bold font-serif">
          Confidential Onboarding
        </h2>
        <button
          onClick={onComplete}
          className="text-sm underline text-gray-500 hover:text-black cursor-pointer"
        >
          Skip Onboarding
        </button>
      </div>

      <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-6 flex flex-col sm:flex-row justify-between gap-4">
        <div>
          <span className="text-[10px] text-gray-500 block uppercase tracking-widest font-bold">
            Public Balance
          </span>
          <span className="font-mono text-lg font-medium">
            {balances.public} {tokenSymbol}
          </span>
        </div>
        <div>
          <span className="text-[10px] text-gray-500 block uppercase tracking-widest font-bold">
            Confidential Balance
          </span>
          <span className="font-mono text-lg font-medium text-[#1E4FD6]">
            {balances.confidential} {tokenSymbol}
          </span>
        </div>
      </div>

      <div className="flex gap-2 mb-8">
        {[1, 2, 3, 4, 5, 6].map((s) => (
          <div
            key={s}
            className={`h-1 flex-1 ${s <= step ? "bg-[#1E4FD6]" : "bg-gray-200"}`}
          />
        ))}
      </div>

      <div className="min-h-62.5">
        {step === 1 && (
          <div className="space-y-4">
            <h3 className="text-xl font-bold font-serif">
              Step 1: Claim Testnet Tokens
            </h3>
            <p className="text-gray-600 text-sm">
              To get started, you need some testnet tokens ({tokenSymbol}) to
              pay for transactions and initial deposits.
            </p>
            <div className="pt-4">
              <button
                onClick={performClaim}
                disabled={faucetLoading}
                className="btn-primary w-full py-3 cursor-pointer"
              >
                {faucetLoading ? "Requesting..." : `Claim 0.25 ${tokenSymbol}`}
              </button>
            </div>
            <div className="text-center pt-2">
              <button
                onClick={nextStep}
                className="text-sm underline text-gray-500 hover:text-black cursor-pointer"
              >
                Already have tokens? Next
              </button>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <h3 className="text-xl font-bold font-serif">
              Step 2: Initialize Account
            </h3>
            <p className="text-gray-600 text-sm">
              Create or recover your confidential keys to enable confidential
              transfers. Your private balances will not unlock themselves.
            </p>
            <div className="pt-4">
              <button
                onClick={performInit}
                disabled={loading}
                className="btn-primary w-full py-3 cursor-pointer"
              >
                {loading ? "Initializing..." : "Create / Access Account"}
              </button>
            </div>
            {userKeys && (
              <div className="text-center pt-2">
                <button
                  onClick={nextStep}
                  className="text-sm underline text-gray-500 hover:text-black cursor-pointer"
                >
                  Already initialized. Next
                </button>
              </div>
            )}
            {!userKeys && (
              <div className="text-center pt-2">
                <button
                  onClick={nextStep}
                  className="text-sm underline text-gray-500 hover:text-black cursor-pointer"
                >
                  Skip for now
                </button>
              </div>
            )}
          </div>
        )}

        {step === 3 && (
          <div className="space-y-4">
            <h3 className="text-xl font-bold font-serif">
              Step 3: Deposit to Confidential
            </h3>
            <p className="text-gray-600 text-sm">
              Move public tokens into your confidential balance so you can
              transfer them privately.
            </p>
            <div>
              <label className="text-[10px] uppercase tracking-widest text-slate-400 font-bold mb-2 block">
                Amount
              </label>
              <input
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
                className="input-primary mb-4"
                placeholder="0.0"
              />
              <button
                onClick={performDeposit}
                disabled={
                  loading ||
                  !depositAmount ||
                  Number(depositAmount) > Number(balances.public)
                }
                className="btn-primary w-full py-3 cursor-pointer"
              >
                Deposit
              </button>
            </div>
            <div className="text-center pt-2">
              <button
                onClick={nextStep}
                className="text-sm underline text-gray-500 hover:text-black cursor-pointer"
              >
                Skip this step
              </button>
            </div>
          </div>
        )}

        {step === 4 && (
          <div className="space-y-4">
            <h3 className="text-xl font-bold font-serif">
              Step 4: Confidential Transfer
            </h3>
            <p className="text-gray-600 text-sm">
              Send your confidential tokens to another address. Onchain
              observers won&apos;t see the encrypted amount transferred.
            </p>
            <div>
              <label className="text-[10px] uppercase tracking-widest text-slate-400 font-bold mb-2 block">
                Recipient Address
              </label>
              <div className="relative w-full mb-4">
                <input
                  type="text"
                  value={recipient}
                  onChange={(e) => setRecipient(e.target.value)}
                  className="input-primary w-full disabled:bg-gray-100 disabled:text-gray-500"
                  title="Transfer"
                  disabled
                />
              </div>
              <label className="text-[10px] uppercase tracking-widest text-slate-400 font-bold mb-2 block">
                Amount
              </label>
              <input
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
                className="input-primary mb-4"
                placeholder="0.0"
              />
              <button
                onClick={performTransfer}
                disabled={
                  loading ||
                  !transferAmount ||
                  !recipient ||
                  Number(transferAmount) > Number(balances.confidential)
                }
                className="btn-primary w-full py-3 cursor-pointer"
              >
                Confidential Transfer
              </button>
            </div>
            <div className="text-center pt-2">
              <button
                onClick={nextStep}
                className="text-sm underline text-gray-500 hover:text-black cursor-pointer"
              >
                Skip this step
              </button>
            </div>
          </div>
        )}

        {step === 5 && (
          <div className="space-y-4">
            <h3 className="text-xl font-bold font-serif">
              Step 5: Withdraw from Confidential
            </h3>
            <p className="text-gray-600 text-sm">
              Move tokens back to your public balance anytime. This step is
              optional.
            </p>
            <div>
              <label className="text-[10px] uppercase tracking-widest text-slate-400 font-bold mb-2 block">
                Amount
              </label>
              <input
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
                className="input-primary mb-4"
                placeholder="0.0"
              />
              <button
                onClick={performWithdraw}
                disabled={
                  loading ||
                  !withdrawAmount ||
                  Number(withdrawAmount) > Number(balances.confidential)
                }
                className="btn-secondary w-full py-3 cursor-pointer"
              >
                Withdraw
              </button>
            </div>
            <div className="text-center pt-2">
              <button
                onClick={nextStep}
                className="text-sm underline text-gray-500 hover:text-black cursor-pointer"
              >
                Skip this step
              </button>
            </div>
          </div>
        )}

        {step === 6 && (
          <div className="space-y-6 text-center py-8 relative">
            <Confetti
              className="absolute left-0 top-0 z-0 size-full pointer-events-none"
              options={{
                particleCount: 150,
                spread: 120,
              }}
            />
            <div className="text-6xl mb-4 relative z-10">🎉</div>
            <h3 className="text-2xl font-bold relative z-10 font-serif">
              Congratulations!
            </h3>
            <p className="text-gray-600 text-lg relative z-10">
              Yay! You have successfully completed a confidential journey on
              Fairblock.
            </p>
            <p className="text-gray-500 relative z-10 text-sm">
              We&apos;re just getting started! Head over to your dashboard to
              explore more.
            </p>
            <div className="pt-6 relative z-10">
              <button
                onClick={onComplete}
                className="btn-primary w-full py-6 text-lg font-medium cursor-pointer"
              >
                Go to Dashboard
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
