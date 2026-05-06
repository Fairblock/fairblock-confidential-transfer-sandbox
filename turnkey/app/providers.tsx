"use client";

import { TurnkeyProvider, TurnkeyProviderConfig } from "@turnkey/react-wallet-kit";
import { ReactNode } from "react";
import { ThemeProvider } from "next-themes";

export const supportedChains = [
  { id: 84532, name: "Base Sepolia" },
];

const ETH_WALLET_ACCOUNT = {
  curve: "CURVE_SECP256K1" as const,
  pathFormat: "PATH_FORMAT_BIP32" as const,
  path: "m/44'/60'/0'/0/0",
  addressFormat: "ADDRESS_FORMAT_ETHEREUM" as const,
};

const turnkeyConfig: TurnkeyProviderConfig = {
  organizationId: process.env.NEXT_PUBLIC_ORGANIZATION_ID || "",
  authProxyConfigId: process.env.NEXT_PUBLIC_AUTH_PROXY_CONFIG_ID || "",
  auth: {
    createSuborgParams: {
      emailOtpAuth: {
        customWallet: {
          walletName: "Default Wallet",
          walletAccounts: [ETH_WALLET_ACCOUNT],
        },
      },
    },
  },
  ui: {
    authModal: {
      methods: {
        emailOtpAuthEnabled: true,
        passkeyAuthEnabled: false,
        walletAuthEnabled: false,
        smsOtpAuthEnabled: false,
        googleOauthEnabled: false,
        appleOauthEnabled: false,
        xOauthEnabled: false,
        discordOauthEnabled: false,
        facebookOauthEnabled: false,
      },
      methodOrder: ["email"],
    },
  },
};

export function Providers({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="light"
      enableSystem={false}
      disableTransitionOnChange
    >
      <TurnkeyProvider
        config={turnkeyConfig}
        callbacks={{
          onError: (error) => {
            console.error("Turnkey Initialization Error:", error);
            // Help users identify the common CORS/Placeholder issue
            if (turnkeyConfig.organizationId === "YOUR_TURNKEY_ORGANIZATION_ID") {
              console.warn("ACTION REQUIRED: Please replace 'YOUR_TURNKEY_ORGANIZATION_ID' in .env.local with your real Turnkey Organization ID.");
            }
          },
        }}
      >
        {children}
      </TurnkeyProvider>
    </ThemeProvider>
  );
}
