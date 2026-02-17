
'use client';

import { PrivyProvider } from '@privy-io/react-auth';
import { defineChain } from 'viem';
import { baseSepolia, sepolia, arbitrumSepolia,stableTestnet,tempoModerato,arcTestnet } from 'viem/chains';



export const supportedChains = [
    stableTestnet,
    arcTestnet,
    baseSepolia, 
    sepolia,     
    arbitrumSepolia, 
    tempoModerato
];


export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <PrivyProvider
      appId={process.env.NEXT_PUBLIC_PRIVY_APP_ID!}
      config={{
        loginMethods: ['email', 'wallet'],
        appearance: {
          theme: 'light',
          accentColor: '#000000',
        },
        supportedChains: supportedChains,
        defaultChain: stableTestnet,
      }}
    >
      {children}
    </PrivyProvider>
  );
}
