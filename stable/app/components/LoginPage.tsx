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
            <div className="relative w-12 h-12 overflow-hidden border border-black bg-white">
              <Image
                src="/fairblock.jpeg"
                alt="Fairblock"
                fill
                className="object-cover"
              />
            </div>
          </div>

          {/* Headline */}
          <div className="space-y-8">
            <h1 className="text-2xl sm:text-5xl md:text-6xl lg:text-7xl font-serif leading-[1.05] tracking-tight text-[#0F172A]">
              Enterprise <br />
              <span className="italic text-[#1E4FD6] whitespace-nowrap">Privacy Solutions.</span>
            </h1>

            <div className="grid gap-4 max-w-lg">
              {[
                "Institutional-grade privacy without operational complexity.",
                "Encrypted amounts and balances by default.",
                "No new wallets, no new trust assumptions."
              ].map((text) => (
                <div key={text} className="p-6 border border-slate-200 bg-white/40 backdrop-blur-sm hover:border-[#1E4FD6] transition-colors group">
                  <p className="text-base text-slate-600 font-sans leading-relaxed group-hover:text-[#0F172A]">
                    {text}
                  </p>
                </div>
              ))}
            </div>
          </div>

        </div>
      </div>

      {/* Login Side */}
      <div className="flex-1 flex flex-col items-center justify-center p-8 md:p-16 lg:p-24 bg-white">
        <div className="w-full max-w-lg space-y-12">
          <div className="space-y-4 text-center md:text-left">
            <h2 className="text-4xl font-serif text-[#0F172A]">
              Enter Sandbox
            </h2>
            <p className="text-slate-500 font-sans leading-relaxed">
              Access your secure{" "}
              <span className="text-[#1E4FD6] font-medium">
                Privy wallet
              </span>{" "}
              to manage your private assets with hardware-backed security.
            </p>
          </div>

          <div className="space-y-6">
            <button
              onClick={login}
              className="w-full group relative flex items-center justify-center gap-4 bg-[#1E4FD6] text-white py-6 px-10 hover:bg-[#0F36A8] transition-all duration-300 shadow-[0_20px_40px_-15px_rgba(30,79,214,0.3)] hover:shadow-[0_25px_50px_-12px_rgba(30,79,214,0.4)]"
            >
              <span className="font-sans font-bold tracking-widest uppercase text-sm">
                Authenticate Wallet to Access Sandbox
              </span>
              <div className="absolute right-8 opacity-0 group-hover:opacity-100 transition-opacity">
                <ArrowUpRight className="w-5 h-5" />
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

          {/* Ecosystem Collaboration */}
          <div className="pt-8 border-t border-slate-100 space-y-6">
            <div className="space-y-2 text-center md:text-left">
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
              className="w-full group relative flex items-center justify-center gap-4 border border-slate-200 bg-[#F8FAFC] py-6 px-10 hover:border-[#1E4FD6] transition-all duration-300"
            >
              <span className="font-sans font-bold tracking-widest uppercase text-sm text-[#0F172A] group-hover:text-[#1E4FD6]">
                Explore Ecosystem and Partner Network
              </span>
              <div className="absolute right-8 opacity-0 group-hover:opacity-100 transition-opacity">
                <ArrowUpRight className="w-5 h-5 text-[#1E4FD6]" />
              </div>
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
