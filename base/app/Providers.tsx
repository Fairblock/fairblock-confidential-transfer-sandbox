"use client";

import { PrivyProvider } from "@privy-io/react-auth";
import { baseSepolia } from "viem/chains";

export const supportedChains = [baseSepolia];

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <PrivyProvider
      appId={process.env.NEXT_PUBLIC_PRIVY_APP_ID!}
      config={{
        loginMethods: ["email", "wallet"],
        embeddedWallets: {
          ethereum: {
            createOnLogin: "all-users",
          },
        },
        appearance: {
          theme: "light",
          accentColor: "#000000",
        },
        supportedChains: supportedChains,
        defaultChain: baseSepolia,
      }}
    >
      {children}
    </PrivyProvider>
  );
}
