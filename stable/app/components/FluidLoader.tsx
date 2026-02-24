import React, { useState, useEffect } from "react";

const allMessages = [
  "Encrypting",
  "Deciphering",
  "Transacting",
  "Verifying",
  "Reconciling",
  "Securing",
  "Authorizing",
  "Transmuting",
  "Balancing",
  "Hatching",
  "Unfurling",
  "Stewing",
  "Cloaking",
  "Forging",
  "Settling",
].map((m) => `${m} your transaction...`);

const zkFlowMessages = [
  "Encrypting...",
  "Generating proof...",
  "Verifying proof...",
  "Communicating with stable...",
];

const actionMessageMap: Record<string, string[]> = {
  Deposit: [
    "Approving tokens...",
    "Depositing...",
    "Communicating with stable...",
  ],
  Transfer: zkFlowMessages,
  Withdraw: zkFlowMessages,
  Faucet: ["Sending from the faucet wallet..."],
  Init: [
    "Deriving keys...",
    "Creating account...",
    "Communicating with stable...",
  ],
  Refresh: ["Fetching balance..."],
};

export type LoaderAction =
  | "Deposit"
  | "Transfer"
  | "Withdraw"
  | "Faucet"
  | "Init"
  | "Refresh"
  | "Default";

interface FluidLoaderProps {
  action?: LoaderAction;
}

export default function FluidLoader({ action = "Default" }: FluidLoaderProps) {
  const [messageIndex, setMessageIndex] = useState(0);
  const [currentAction, setCurrentAction] = useState(action);

  if (action !== currentAction) {
    setCurrentAction(action);
    setMessageIndex(0);
  }

  const messages =
    action !== "Default" && actionMessageMap[action]
      ? actionMessageMap[action]
      : allMessages;

  useEffect(() => {
    if (messageIndex < messages.length - 1) {
      const timer = setTimeout(() => {
        setMessageIndex((prev) => prev + 1);
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [messageIndex, messages.length]);

  return (
    <div className="fixed inset-0 z-100 flex items-center justify-center bg-white/80 backdrop-blur-sm">
      <div className="flex flex-col items-center gap-8 px-4 text-center">
        <div className="relative flex items-center justify-center w-24 h-24 sm:w-32 sm:h-32">
          <style>{`
            @keyframes morph {
              0%, 100% {
                border-radius: 60% 40% 30% 70% / 60% 30% 70% 40%;
              }
              50% {
                border-radius: 30% 60% 70% 40% / 50% 60% 30% 60%;
              }
            }
            .fluid-blob {
              animation: morph 3s ease-in-out infinite, spin 8s linear infinite;
            }
          `}</style>
          <div className="fluid-blob absolute inset-0 bg-black opacity-90 transition-all duration-700 ease-in-out"></div>
          <div className="absolute w-4 h-4 bg-white rounded-full animate-pulse transition-all"></div>
        </div>

        <div className="h-12 flex items-center justify-center">
          <p
            key={messageIndex}
            className="text-lg sm:text-xl font-medium animate-in fade-in slide-in-from-bottom-2 duration-500"
          >
            {messages[messageIndex]}
          </p>
        </div>
      </div>
    </div>
  );
}
