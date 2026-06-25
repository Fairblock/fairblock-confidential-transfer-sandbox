"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Confetti } from "@/components/ui/confetti";

interface AnonymousOnboardingProps {
  onComplete: () => void;
  publicBalance: string;
  anonBalanceDisplay: { available: string; pending: string; total: string };
  tokenSymbol: string;
  loading: boolean;
  faucetLoading: boolean;
  feeSymbol: string;
  feePerTransferDisplay: string;
  tenTransfersFee: string;
  transfersRemaining: number | null;
  handleFaucetRequest: () => Promise<void>;
  setupAccount: (id: string) => Promise<void>;
  anonymousDeposit: (amount: string) => Promise<{ hash: string }>;
  anonymousTransferToPublic: (
    recipient: string,
    amount: string,
  ) => Promise<{ hash: string }>;
  topUpFees: (amount: string) => Promise<{ hash: string }>;
  handleTransaction: (
    actionName: string,
    action: () => Promise<{ hash: string }>,
    onSuccess?: () => void,
  ) => Promise<void>;
  accountId: string | null;
  clientReady: boolean;
}

const ACCOUNT_ID_REGEX = /^[a-zA-Z0-9]{1,20}$/;

export default function AnonymousOnboarding({
  onComplete,
  publicBalance,
  anonBalanceDisplay,
  tokenSymbol,
  loading,
  faucetLoading,
  feeSymbol,
  feePerTransferDisplay,
  tenTransfersFee,
  transfersRemaining,
  handleFaucetRequest,
  setupAccount,
  anonymousDeposit,
  anonymousTransferToPublic,
  topUpFees,
  handleTransaction,
  accountId,
  clientReady,
}: AnonymousOnboardingProps) {
  const [step, setStep] = useState(1);
  const [accountIdInput, setAccountIdInput] = useState("");
  const [accountIdError, setAccountIdError] = useState("");
  const [depositAmount, setDepositAmount] = useState("0.2");
  const [feeTopUpOverride, setFeeTopUpOverride] = useState("");
  const feeTopUpAmount = feeTopUpOverride || tenTransfersFee || "";
  const [transferAmount, setTransferAmount] = useState("0.1");
  const [transferRecipient] = useState(
    "0xD9A6E167a149219155a1bc5480Bc9738CdDb48F7",
  );

  const nextStep = () => setStep((s) => s + 1);

  const performClaim = async () => {
    try {
      await handleFaucetRequest();
      nextStep();
    } catch {}
  };

  const validateAccountId = (id: string) => {
    if (!id) return "Account ID is required";
    if (!ACCOUNT_ID_REGEX.test(id))
      return "Only letters and numbers, max 20 characters";
    return "";
  };

  const performSetupAccount = async () => {
    const err = validateAccountId(accountIdInput);
    if (err) {
      setAccountIdError(err);
      return;
    }
    setAccountIdError("");
    try {
      await setupAccount(accountIdInput);
      toast.success("Account ready!", {
        description: `Your anonymous account "${accountIdInput}" is set up.`,
      });
      nextStep();
    } catch (e) {
      console.error(e);
      toast.error("Account setup failed", {
        description: (e as Error).message,
      });
    }
  };

  const performTopUpFees = async () => {
    await handleTransaction(
      "Top Up Fees",
      () => topUpFees(feeTopUpAmount),
      nextStep,
    );
  };

  const performDeposit = async () => {
    await handleTransaction(
      "Deposit",
      () => anonymousDeposit(depositAmount),
      nextStep,
    );
  };

  const performTransfer = async () => {
    await handleTransaction(
      "Transfer",
      () => anonymousTransferToPublic(transferRecipient, transferAmount),
      nextStep,
    );
  };

  return (
    <div className="bg-white border border-slate-200 p-6 space-y-6">
      <div className="flex justify-between items-center mb-6 border-b border-slate-200 pb-4">
        <h2 className="text-2xl font-bold font-serif">Anonymous Onboarding</h2>
        <button
          type="button"
          onClick={onComplete}
          className="text-sm underline text-gray-500 hover:text-black cursor-pointer"
        >
          Skip Onboarding
        </button>
      </div>

      {/* Balance strip */}
      <div className="bg-slate-50 border border-slate-200 p-4 flex justify-between gap-4">
        <div>
          <span className="text-[10px] text-slate-500 block uppercase tracking-widest font-bold">
            Public Balance
          </span>
          <span className="font-mono text-lg font-medium">
            {publicBalance} {tokenSymbol}
          </span>
        </div>
        <div>
          <span className="text-[10px] text-slate-500 block uppercase tracking-widest font-bold">
            Anonymous Balance
          </span>
          <span className="font-mono text-lg font-medium text-[#0F172A]">
            {anonBalanceDisplay.total} {tokenSymbol}
          </span>
        </div>
      </div>

      {/* Progress bar */}
      <div className="flex gap-2 mb-8">
        {[1, 2, 3, 4, 5, 6].map((s) => (
          <div
            key={s}
            className={`h-1 flex-1 transition-colors ${s <= step ? "bg-[#0F172A]" : "bg-gray-200"}`}
          />
        ))}
      </div>

      <div className="min-h-64">
        {/* Step 1: Claim tokens */}
        {step === 1 && (
          <div className="space-y-4">
            <h3 className="text-xl font-bold font-serif">
              Step 1: Claim Testnet Tokens
            </h3>
            <p className="text-gray-600 text-sm">
              You need public tokens first. We&apos;ll move them into your
              anonymous account in a later step deposits are the one operation
              you pay gas for.
            </p>
            <div className="pt-4">
              <button
                type="button"
                onClick={performClaim}
                disabled={faucetLoading}
                className="btn-anon w-full py-3 cursor-pointer"
              >
                {faucetLoading ? "Requesting..." : "Claim 0.25 USDC"}
              </button>
            </div>
            <div className="text-center pt-2">
              <button
                type="button"
                onClick={nextStep}
                className="text-sm underline text-gray-500 hover:text-black cursor-pointer"
              >
                Already have tokens? Next
              </button>
            </div>
          </div>
        )}

        {/* Step 2: Set up account ID */}
        {step === 2 && (
          <div className="space-y-4">
            <h3 className="text-xl font-bold font-serif">
              Step 2: Choose Your Account ID
            </h3>
            <p className="text-gray-600 text-sm">
              Pick a short username (e.g.{" "}
              <span className="font-mono text-gray-800">alice123</span>). This
              is your onchain identity your wallet address is{" "}
              <strong>never</strong> revealed. Keys are derived from your wallet
              + this ID, so you can always recover by using the same wallet and
              ID.
            </p>
            <div className="bg-slate-50 border border-slate-200 p-3 text-xs text-slate-700 space-y-1">
              <p className="font-semibold">Account ID rules:</p>
              <ul className="list-disc list-inside space-y-0.5">
                <li>Letters and numbers only (A–Z, a–z, 0–9)</li>
                <li>Max 20 characters, case-sensitive</li>
                <li>
                  Choose something you&apos;ll remember it&apos;s how you log
                  back in
                </li>
              </ul>
            </div>
            {accountId ? (
              <div className="p-4 bg-green-50 border border-green-200 text-sm text-green-800">
                Already set up as{" "}
                <span className="font-mono font-bold">{accountId}</span>.
              </div>
            ) : (
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
                />
                {accountIdError && (
                  <p className="text-xs text-red-500 mt-1">{accountIdError}</p>
                )}
                <p className="text-[10px] text-slate-400 mt-1">
                  {accountIdInput.length}/20 characters
                </p>
              </div>
            )}
            <div className="pt-2">
              {accountId ? (
                <button
                  type="button"
                  onClick={nextStep}
                  className="btn-anon w-full py-3 cursor-pointer"
                >
                  Continue
                </button>
              ) : (
                <button
                  type="button"
                  onClick={performSetupAccount}
                  disabled={loading || !accountIdInput || !clientReady}
                  className="btn-anon w-full py-3 cursor-pointer"
                >
                  {loading
                    ? "Setting up..."
                    : !clientReady
                      ? "Connecting Wallet..."
                      : "Set Up Account"}
                </button>
              )}
            </div>
          </div>
        )}

        {/* Step 3: Top up fee reserve */}
        {step === 3 && (
          <div className="space-y-4">
            <h3 className="text-xl font-bold font-serif">
              Step 3: Fund Your Fee Reserve
            </h3>
            <p className="text-gray-600 text-sm">
              Anonymous transfers are gas-free for you the Fairycloak relay pays
              gas. But it charges a small <strong>prepaid fee</strong> in{" "}
              {feeSymbol} per transfer. You top this up once and each transfer
              draws from it automatically.
            </p>
            <div className="bg-slate-50 border border-slate-200 p-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-slate-600">Fee per transfer:</span>
                <span className="font-mono font-bold text-[#0F172A]">
                  {feePerTransferDisplay} {feeSymbol}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-600">Current reserve:</span>
                <span className="font-mono font-bold text-[#0F172A]">
                  {transfersRemaining !== null
                    ? `~${transfersRemaining} transfers remaining`
                    : "Not set up yet"}
                </span>
              </div>
            </div>
            <div>
              <label className="text-[10px] uppercase tracking-widest text-slate-400 font-bold mb-2 block">
                Amount to deposit ({feeSymbol}) covers ~10 transfers
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={feeTopUpAmount}
                onChange={(e) => {
                  const val = e.target.value;
                  if (Number(val) < 0) return;
                  if (!/^\d*\.?\d{0,6}$/.test(val)) return;
                  setFeeTopUpOverride(val);
                }}
                className="input-primary mb-4"
                placeholder="0.0"
              />
              <button
                type="button"
                onClick={performTopUpFees}
                disabled={
                  loading ||
                  !feeTopUpAmount ||
                  Number(feeTopUpAmount) > Number(publicBalance)
                }
                className="btn-anon w-full py-3 cursor-pointer"
              >
                {loading ? "Processing..." : "Top Up Fee Reserve"}
              </button>
            </div>
            <div className="text-center pt-2">
              <button
                type="button"
                onClick={nextStep}
                className="text-sm underline text-gray-500 hover:text-black cursor-pointer"
              >
                Skip for now
              </button>
            </div>
          </div>
        )}

        {/* Step 4: Deposit */}
        {step === 4 && (
          <div className="space-y-4">
            <h3 className="text-xl font-bold font-serif">
              Step 4: Deposit Tokens Anonymously
            </h3>
            <p className="text-gray-600 text-sm">
              Move public tokens into your anonymous account. This is the only
              step where your wallet pays gas everything after is relay-paid and
              your wallet stays invisible.
            </p>
            <div>
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
                className="input-primary mb-4"
                placeholder="0.0"
              />
              <button
                type="button"
                onClick={performDeposit}
                disabled={
                  loading ||
                  !depositAmount ||
                  Number(depositAmount) > Number(publicBalance)
                }
                className="btn-anon w-full py-3 cursor-pointer"
              >
                {loading ? "Depositing..." : "Deposit to Anonymous Account"}
              </button>
            </div>
            <div className="text-center pt-2">
              <button
                type="button"
                onClick={nextStep}
                className="text-sm underline text-gray-500 hover:text-black cursor-pointer"
              >
                Skip this step
              </button>
            </div>
          </div>
        )}

        {/* Step 5: Transfer */}
        {step === 5 && (
          <div className="space-y-4">
            <h3 className="text-xl font-bold font-serif">
              Step 5: Make an Anonymous Transfer
            </h3>
            <p className="text-gray-600 text-sm">
              Send tokens to a public address. onchain, nobody sees your wallet
              only your account ID. Amounts are encrypted with ZK proofs. The
              relay pays gas.
            </p>
            <div>
              <label className="text-[10px] uppercase tracking-widest text-slate-400 font-bold mb-2 block">
                Recipient (demo address)
              </label>
              <input
                title="amount"
                type="text"
                value={transferRecipient}
                disabled
                className="input-primary mb-4 disabled:bg-gray-100 disabled:text-gray-500"
              />
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
                className="input-primary mb-4"
                placeholder="0.0"
              />
              <button
                type="button"
                onClick={performTransfer}
                disabled={
                  loading ||
                  !transferAmount ||
                  Number(anonBalanceDisplay.available) < Number(transferAmount)
                }
                className="btn-anon w-full py-3 cursor-pointer"
              >
                {loading ? "Sending..." : "Send Anonymously"}
              </button>
            </div>
            <div className="text-center pt-2">
              <button
                type="button"
                onClick={nextStep}
                className="text-sm underline text-gray-500 hover:text-black cursor-pointer"
              >
                Skip this step
              </button>
            </div>
          </div>
        )}

        {/* Step 6: Done */}
        {step === 6 && (
          <div className="space-y-6 text-center py-8 relative">
            <Confetti
              className="absolute left-0 top-0 z-0 size-full pointer-events-none"
              options={{ particleCount: 150, spread: 120 }}
            />
            <h3 className="text-2xl font-bold relative z-10 font-serif">
              You&apos;re Anonymous!
            </h3>
            <p className="text-gray-600 text-lg relative z-10">
              You just completed a fully anonymous transfer on Fairblock. Your
              wallet was never exposed.
            </p>
            <p className="text-gray-500 relative z-10 text-sm">
              Head to your dashboard to deposit, transfer, and withdraw with
              full anonymity.
            </p>
            <div className="pt-6 relative z-10">
              <button
                type="button"
                onClick={onComplete}
                className="btn-anon w-full py-6 text-lg font-medium cursor-pointer"
              >
                Go to Anonymous Dashboard
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
