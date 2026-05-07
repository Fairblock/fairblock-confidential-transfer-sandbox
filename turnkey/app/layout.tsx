import type { Metadata } from "next";
import "@turnkey/react-wallet-kit/styles.css";
import "./globals.css";
import { Providers } from "./providers";
import { Inter, Instrument_Serif, JetBrains_Mono } from "next/font/google";
import { cn } from "@/lib/utils";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const instrumentSerif = Instrument_Serif({ 
  weight: "400", 
  subsets: ["latin"], 
  variable: "--font-instrument-serif" 
});
const jetbrainsMono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-mono" });

export const metadata: Metadata = {
  title: "Fairblock Confidential Transfer Sandbox",
  description: "Secure Turnkey embedded wallet experience",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={cn(
        inter.variable,
        instrumentSerif.variable,
        jetbrainsMono.variable,
        "font-sans"
      )}
      suppressHydrationWarning
    >
      <body
        className="antialiased bg-background text-foreground min-h-screen"
        suppressHydrationWarning
      >
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
