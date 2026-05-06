"use client";

import { useState, useEffect, useCallback } from "react";
import { useTurnkey, AuthState } from "@turnkey/react-wallet-kit";
import { publicClient } from "./viemClient";
import { formatEther, parseEther, createWalletClient, http } from "viem";
import { baseSepolia } from "viem/chains";
import { createAccount } from "@turnkey/viem";
import { 
  RefreshCw, 
  Copy, 
  ExternalLink, 
  ArrowUpRight, 
  ArrowDownLeft, 
  Loader2, 
  CheckCircle2,
  Wallet,
  ArrowRight
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogHeader, 
  DialogTitle, 
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

export function WalletInterface() {
  const { authState, wallets, createWallet, httpClient } = useTurnkey();
  const [balance, setBalance] = useState<string>("0.00");
  const [isLoading, setIsLoading] = useState(false);
  const [address, setAddress] = useState<string | null>(null);
  const [showSendModal, setShowSendModal] = useState(false);
  const [showReceiveModal, setShowReceiveModal] = useState(false);

  const isConnected = authState === AuthState.Authenticated;

  const fetchBalance = useCallback(async (addr: string) => {
    try {
      setIsLoading(true);
      const bal = await publicClient.getBalance({ address: addr as `0x${string}` });
      setBalance(formatEther(bal));
    } catch (error) {
      console.error("Error fetching balance:", error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isConnected && wallets.length > 0) {
      const ethAccount = wallets
        .flatMap(w => w.accounts)
        .find(a => a.addressFormat === "ADDRESS_FORMAT_ETHEREUM");
      
      if (ethAccount && ethAccount.address !== address) {
        setAddress(ethAccount.address);
        fetchBalance(ethAccount.address);
      }
    }
  }, [isConnected, wallets, address, fetchBalance]);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  if (!isConnected) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] text-center max-w-xl mx-auto space-y-8 py-20">
        <div className="space-y-4">
          <h2 className="text-4xl font-bold tracking-tighter sm:text-5xl">Your Wallet, Simplified.</h2>
          <p className="text-muted-foreground text-lg">
            A minimalist approach to managing your digital assets on Base Sepolia. 
            Connect your Turnkey account to begin.
          </p>
        </div>
        <Button size="lg" className="h-12 px-10 rounded-full font-bold">
          Get Started
        </Button>
      </div>
    );
  }

  if (wallets.length === 0) {
    return (
      <Card className="max-w-md mx-auto mt-20 border-border bg-card">
        <CardHeader>
          <CardTitle>Initialize Wallet</CardTitle>
          <CardDescription>No wallet found. Create one to start using Base Sepolia.</CardDescription>
        </CardHeader>
        <CardContent className="flex justify-center py-10">
          <Wallet className="w-16 h-16 text-muted-foreground/30" />
        </CardContent>
        <CardFooter>
          <Button 
            className="w-full h-12 font-bold"
            onClick={() => createWallet({ walletName: "My Base Wallet", accounts: ["ADDRESS_FORMAT_ETHEREUM"] })}
          >
            Create Base Wallet
          </Button>
        </CardFooter>
      </Card>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-12 py-10 animate-in fade-in duration-500">
      <div className="space-y-6">
        <div className="flex justify-between items-end">
          <div className="space-y-1">
            <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Available Balance</p>
            <div className="flex items-baseline gap-2">
              <h1 className="text-6xl font-bold tracking-tighter">
                {Number.parseFloat(balance).toFixed(4)}
              </h1>
              <span className="text-xl font-medium text-muted-foreground">ETH</span>
            </div>
          </div>
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={() => address && fetchBalance(address)}
            disabled={isLoading}
            className="rounded-full hover:bg-secondary"
            title="Refresh Balance"
          >
            <RefreshCw className={`w-5 h-5 ${isLoading ? 'animate-spin' : ''}`} />
          </Button>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Button size="lg" className="h-14 rounded-xl text-lg font-bold" onClick={() => setShowSendModal(true)}>
            <ArrowUpRight className="mr-2 h-5 w-5" /> Send
          </Button>
          <Button size="lg" variant="secondary" className="h-14 rounded-xl text-lg font-bold" onClick={() => setShowReceiveModal(true)}>
            <ArrowDownLeft className="mr-2 h-5 w-5" /> Receive
          </Button>
        </div>
      </div>

      <Separator />

      <div className="grid gap-6">
        <Card className="border-border/60 bg-card/50 overflow-hidden">
          <CardHeader className="pb-4">
            <CardTitle className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Primary Address</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-3 bg-secondary/50 p-4 rounded-lg border border-border group">
              <code className="text-xs font-mono break-all flex-1">
                {address || "Fetching..."}
              </code>
              <Button variant="ghost" size="icon" onClick={() => address && copyToClipboard(address)} className="h-8 w-8" title="Copy Address">
                <Copy className="h-4 w-4" />
              </Button>
            </div>
          </CardContent>
          <CardFooter className="bg-secondary/20 py-3 flex justify-between items-center px-6 border-t border-border/40">
             <a 
              href={`https://sepolia.basescan.org/address/${address}`} 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-xs font-bold text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors"
            >
              Explorer <ExternalLink className="h-3 w-3" />
            </a>
            <Badge variant="outline" className="text-[10px] bg-background border-border/50 uppercase tracking-tighter">
              Sepolia
            </Badge>
          </CardFooter>
        </Card>
      </div>

      <SendModal 
        open={showSendModal} 
        onOpenChange={setShowSendModal}
        address={address} 
        balance={balance} 
        turnkeyClient={httpClient}
        onSuccess={() => address && fetchBalance(address)}
      />

      <ReceiveModal 
        open={showReceiveModal} 
        onOpenChange={setShowReceiveModal}
        address={address} 
      />
    </div>
  );
}

function SendModal({ open, onOpenChange, address, balance, turnkeyClient, onSuccess }: { open: boolean, onOpenChange: (open: boolean) => void, address: string | null, balance: string, turnkeyClient: any, onSuccess: () => void }) {
  const [recipient, setRecipient] = useState("");
  const [amount, setAmount] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [txHash, setTxHash] = useState<string | null>(null);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!recipient || !amount || !address) return;

    try {
      setStatus("loading");
      const account = await createAccount({
        client: turnkeyClient,
        organizationId: process.env.NEXT_PUBLIC_ORGANIZATION_ID!,
        signWith: address,
        ethereumAddress: address,
      });

      const walletClient = createWalletClient({
        account,
        chain: baseSepolia,
        transport: http(process.env.NEXT_PUBLIC_BASE_SEPOLIA_RPC)
      });

      const hash = await walletClient.sendTransaction({
        to: recipient as `0x${string}`,
        value: parseEther(amount),
      });

      setTxHash(hash);
      setStatus("success");
      onSuccess?.();
    } catch (error) {
      console.error("Send error:", error);
      setStatus("error");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md bg-background border-border p-0 overflow-hidden gap-0">
        <DialogHeader className="p-6 pb-0">
          <DialogTitle className="text-2xl font-bold tracking-tight">Send ETH</DialogTitle>
          <DialogDescription>
            Send Base Sepolia ETH to any address.
          </DialogDescription>
        </DialogHeader>

        {status === "success" ? (
          <div className="p-10 text-center space-y-6">
            <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-8 h-8 text-primary" />
            </div>
            <div className="space-y-2">
              <h3 className="text-xl font-bold">Transfer Initiated</h3>
              <p className="text-sm text-muted-foreground px-10">Your transaction has been broadcasted to the network.</p>
            </div>
            <div className="p-3 bg-secondary rounded-md font-mono text-[10px] break-all border border-border">
              {txHash}
            </div>
            <Button onClick={() => onOpenChange(false)} className="w-full h-12 font-bold">
              Dismiss
            </Button>
          </div>
        ) : (
          <form onSubmit={handleSend} className="p-6 space-y-6">
            <div className="space-y-4">
              <div className="space-y-2">
                <label htmlFor="recipient" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Recipient</label>
                <Input 
                  id="recipient"
                  placeholder="0x..." 
                  value={recipient}
                  onChange={(e) => setRecipient(e.target.value)}
                  className="h-12 border-border focus-visible:ring-1 focus-visible:ring-foreground"
                  required
                />
              </div>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <label htmlFor="amount" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Amount</label>
                  <span className="text-[10px] font-medium">Bal: {Number.parseFloat(balance).toFixed(4)} ETH</span>
                </div>
                <div className="relative">
                  <Input 
                    id="amount"
                    type="number" 
                    step="0.0001"
                    placeholder="0.00" 
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="h-12 pr-12 border-border focus-visible:ring-1 focus-visible:ring-foreground"
                    required
                  />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-bold text-muted-foreground">ETH</span>
                </div>
              </div>
            </div>

            <Button 
              type="submit" 
              className="w-full h-14 text-lg font-bold bg-foreground text-background hover:bg-foreground/90 transition-all"
              disabled={status === "loading"}
            >
              {status === "loading" ? (
                <> <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Confirming... </>
              ) : (
                <> Confirm Transfer <ArrowRight className="ml-2 h-5 w-5" /> </>
              )}
            </Button>
            
            {status === "error" && (
              <p className="text-xs text-destructive text-center font-bold">Something went wrong. Please try again.</p>
            )}
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

function ReceiveModal({ open, onOpenChange, address }: { open: boolean, onOpenChange: (open: boolean) => void, address: string | null }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md bg-background border-border p-8">
        <DialogHeader className="text-center">
          <DialogTitle className="text-2xl font-bold tracking-tight">Receive Assets</DialogTitle>
          <DialogDescription>
            Use this address to receive ETH on Base Sepolia.
          </DialogDescription>
        </DialogHeader>
        
        <div className="flex flex-col items-center space-y-8 pt-6">
          <div className="w-48 h-48 bg-foreground p-4 rounded-xl flex items-center justify-center shadow-xl">
             <div className="w-full h-full bg-background rounded-lg flex flex-wrap p-1 overflow-hidden">
               {Array.from({length: 36}).map((_, i) => (
                 <div key={`qr-dot-${i}`} className={`w-1/6 h-1/6 ${i % (Math.floor(i/4)+2) === 0 ? 'bg-foreground' : 'bg-transparent'} rounded-[1px] opacity-90`}></div>
               ))}
             </div>
          </div>
          
          <div className="w-full space-y-4">
             <div className="p-4 bg-secondary rounded-xl border border-border text-center">
                <code className="text-xs font-mono break-all">{address}</code>
             </div>
             <Button 
                variant="outline" 
                className="w-full h-12 font-bold uppercase tracking-wider text-xs border-border/60 hover:bg-secondary"
                onClick={() => {
                  if (address) navigator.clipboard.writeText(address);
                }}
              >
                <Copy className="mr-2 h-4 w-4" /> Copy Address
             </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
