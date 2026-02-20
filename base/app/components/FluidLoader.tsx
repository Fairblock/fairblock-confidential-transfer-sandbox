import React, { useState, useEffect } from 'react';

const defaultMessages = [
  "Encrypting your transaction...",
];

interface FluidLoaderProps {
  messages?: string[];
}

export default function FluidLoader({ messages = defaultMessages }: FluidLoaderProps) {
  const [messageIndex, setMessageIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setMessageIndex((prev) => (prev + 1) % messages.length);
    }, 3000);

    return () => clearInterval(interval);
  }, [messages.length]);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-white/80 backdrop-blur-sm">
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
