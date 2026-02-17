
import type { Metadata } from "next";
import "./globals.css";
import Providers from "./Providers";

export const metadata: Metadata = {
  title: "Confidential Token App",
  description: "Secure confidential transfers.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased bg-white text-black">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
