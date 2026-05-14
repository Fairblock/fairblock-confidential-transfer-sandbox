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
            <div className="text-xl font-serif text-slate-400">X</div>
            <div className="relative w-12 h-12 overflow-hidden bg-white flex items-center justify-center border border-black">
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
            <h1 className="text-2xl sm:text-5xl md:text-6xl lg:text-7xl font-serif leading-[1.05] tracking-tight text-[#0F172A]">
              Enterprise <br />
              <span className="italic text-[#1E4FD6] whitespace-nowrap">
                Privacy Solutions.
              </span>
            </h1>

            <div className="grid gap-4 max-w-lg">
              {[
                "Institutional-grade privacy without operational complexity.",
                "Encrypted amounts and balances by default.",
                "No new wallets, no new trust assumptions.",
              ].map((text) => (
                <div
                  key={text}
                  className="p-6 border border-slate-200 bg-white/40 backdrop-blur-sm hover:border-[#1E4FD6] transition-colors group"
                >
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
              Try Confidentiality
            </h2>
            <p className="text-slate-500 font-sans leading-relaxed">
              Explore confidential assets and payments through an interactive
              sandbox powered by Turnkey embedded wallets and Fairblock
              confidentiality. Securely access your non-custodial wallet with
              seamless email login and explore how confidential transactions
              work under the hood.
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
          </div>

          {/* Become a Partner */}
          <div className="pt-8 border-t border-slate-100 space-y-6">
            <div className="space-y-2 text-center md:text-left">
              <h3 className="text-4xl font-serif text-[#0F172A]">
                Become a Partner
              </h3>
              <p className="text-sm text-slate-500 leading-relaxed">
                Integrate confidential assets and payments into your product
                with no protocol changes, no infrastructure overhead, and
                compliance built in from day one.
              </p>
            </div>
            <a
              href="https://partners.fairblock.network/"
              target="_blank"
              rel="noopener noreferrer"
              className="w-full group relative flex items-center justify-center gap-4 border border-slate-200 bg-[#F8FAFC] py-6 px-10 hover:border-[#1E4FD6] transition-all duration-300"
            >
              <span className="font-sans font-bold tracking-widest uppercase text-sm text-[#0F172A] group-hover:text-[#1E4FD6]">
                Explore Integration and Partnership Paths
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
