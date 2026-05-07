"use client";

import Image from "next/image";
import { ArrowUpRight } from "lucide-react";

interface LoginPageProps {
  readonly login: () => void;
}

export default function LoginPage({ login }: LoginPageProps) {
  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-[#E9ECF2] grid-bg">
      {/* Branding Side */}
      <div className="flex-1 flex flex-col justify-between p-8 md:p-16 lg:p-24 border-b md:border-b-0 md:border-r border-slate-200">
        <div className="space-y-12">
          {/* Logos */}
          <div className="flex items-center gap-6">
            <div className="relative w-12 h-12 overflow-hidden border border-slate-200 bg-white">
              <Image
                src="/fairblock.jpeg"
                alt="Fairblock"
                fill
                className="object-cover"
              />
            </div>
            <div className="text-xl font-serif text-slate-400">X</div>
            <div className="relative w-12 h-12 overflow-hidden bg-white flex items-center justify-center border border-slate-200">
              <Image
                src="/turnkey.svg"
                alt="Turnkey"
                fill
                className="object-contain p-2"
              />
            </div>
          </div>

          {/* Headline */}
          <div className="space-y-8">
            <div className="space-y-4">
              <h1 className="text-2xl sm:text-5xl md:text-6xl lg:text-8xl font-serif leading-[1.05] tracking-tight text-[#0F172A]">
                Enterprise <br />
                <span className="italic text-[#1E4FD6] whitespace-nowrap">Privacy Solutions.</span>
              </h1>
              <p className="text-sm font-mono uppercase tracking-[0.2em] text-slate-400">
                Powered by IBE + Homomorphic Encryption
              </p>
            </div>

            <p className="text-xl text-slate-600 max-w-lg font-sans leading-relaxed">
              Institutional-grade privacy without operational complexity.
              Encrypted amounts and balances by default. No new wallets, no new
              trust assumptions.
            </p>
          </div>

          {/* Network Status */}
          <div className="space-y-6 pt-4">
            <div className="flex items-center gap-3">
              <div className="glow-dot" />
              <span className="font-mono text-xs uppercase tracking-[0.2em] text-slate-600">
                Base Sepolia Testnet
              </span>
            </div>

            <div className="space-y-2">
              <p className="text-[10px] text-slate-400 uppercase tracking-[0.3em] font-bold">
                Integration Support
              </p>
              <div className="flex flex-wrap gap-4 opacity-50 grayscale hover:grayscale-0 transition-all duration-500">
                <span className="text-xs font-mono">EVM</span>
                <span className="text-xs font-mono">Solana</span>
                <span className="text-xs font-mono">Stellar</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Login Side */}
      <div className="flex-1 flex flex-col items-center justify-center p-8 md:p-16 lg:p-24 bg-white">
        <div className="w-full max-w-md space-y-12">
          <div className="space-y-4">
            <h2 className="text-4xl font-serif text-[#0F172A]">
              Enter Sandbox
            </h2>
            <p className="text-slate-500 font-sans leading-relaxed">
              Access your non-custodial{" "}
              <span className="text-[#1E4FD6] font-medium">
                Turnkey embedded wallet
              </span>{" "}
              via secure email login for hardware-backed private asset
              management.
            </p>
          </div>

          <div className="space-y-6">
            <button
              onClick={login}
              className="w-full group relative flex items-center justify-center gap-4 bg-[#1E4FD6] text-white py-5 px-8 hover:bg-[#0F36A8] transition-all duration-300 shadow-[0_20px_40px_-15px_rgba(30,79,214,0.3)] hover:shadow-[0_25px_50px_-12px_rgba(30,79,214,0.4)]"
            >
              <span className="font-sans font-medium tracking-wide uppercase text-sm">
                Authenticate Wallet
              </span>
              <div className="absolute right-6 opacity-0 group-hover:opacity-100 transition-opacity">
                <ArrowUpRight className="w-4 h-4" />
              </div>
            </button>

            <div className="relative flex items-center py-4">
              <div className="grow border-t border-slate-100"></div>
              <span className="shrink mx-4 text-[10px] text-slate-300 uppercase tracking-[0.2em] font-bold">
                Secure Access
              </span>
              <div className="grow border-t border-slate-100"></div>
            </div>
          </div>

          {/* Partner Network Refined */}
          <div className="pt-8 border-t border-slate-100 space-y-6">
            <div className="space-y-2">
              <h3 className="text-xl font-serif text-[#0F172A]">
                Ecosystem Collaboration
              </h3>
              <p className="text-sm text-slate-500 leading-relaxed">
                Fairblock is building the privacy layer for the decentralized
                future. Explore our deep integrations with industry-leading
                infrastructure partners.
              </p>
            </div>
            <a
              href="https://partners.fairblock.network/"
              target="_blank"
              rel="noopener noreferrer"
              className="group flex items-center justify-between p-6 bg-[#F8FAFC] border border-slate-200 hover:border-[#1E4FD6] transition-all duration-300"
            >
              <span className="text-sm font-serif font-bold text-[#0F172A] group-hover:text-[#1E4FD6]">
                View Partner Network
              </span>
              <ArrowUpRight className="w-5 h-5 text-slate-300 group-hover:text-[#1E4FD6] transition-all group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
