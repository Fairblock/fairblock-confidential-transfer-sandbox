import type { Metadata } from "next";
import "./globals.css";
import Providers from "./Providers";

export const metadata: Metadata = {
  title: "Fairblock Confidential Transfer Sandbox",
  description: "Secure confidential transfers on Fairblock Sandbox.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="hydrated">
      <body className="antialiased bg-white text-black">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
