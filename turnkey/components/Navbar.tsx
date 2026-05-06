"use client";

import { useTurnkey, AuthState } from "@turnkey/react-wallet-kit";
import { Wallet, LogOut, User } from "lucide-react";
import { useState, useEffect, useCallback, useMemo } from "react";
import { formatEther, createPublicClient, http } from "viem";
import { baseSepolia } from "viem/chains";
import { Button, buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const publicClient = createPublicClient({
  chain: baseSepolia,
  transport: http(),
});

export function Navbar() {
  const { authState, wallets, handleLogin: login, logout } = useTurnkey();
  const [address, setAddress] = useState<string | null>(null);
  const [balance, setBalance] = useState<string>("0");
  const [isLoading, setIsLoading] = useState(false);

  const isConnected = useMemo(() => authState === AuthState.Authenticated, [authState]);

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
    const ethAccount = wallets
      .flatMap((w) => w.accounts)
      .find((a) => a.addressFormat === "ADDRESS_FORMAT_ETHEREUM");

    if (isConnected && ethAccount && ethAccount.address !== address) {
      setAddress(ethAccount.address);
      fetchBalance(ethAccount.address);
    }
  }, [isConnected, wallets, address, fetchBalance]);

  return (
    <nav className="border-b bg-background/95 backdrop-blur-sm sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-14 items-center">
          <div className="flex items-center gap-2">
            <Wallet className="w-5 h-5" />
            <span className="font-bold tracking-tight text-sm uppercase">
              Turnkey
            </span>
            <Badge variant="outline" className="text-[10px] h-5 px-1.5 font-mono border-muted-foreground/20 text-muted-foreground">
              BASE
            </Badge>
          </div>

          <div className="flex items-center gap-3">
            {isConnected ? (
              <div className="flex items-center gap-2">
                <div className="hidden sm:flex items-center gap-2 px-3 py-1 bg-secondary rounded-md border border-border">
                  <span className="text-xs font-mono text-muted-foreground">
                    {address ? `${address.slice(0, 6)}...${address.slice(-4)}` : "Connected"}
                  </span>
                  <div className="w-px h-3 bg-border mx-1" />
                  <span className="text-xs font-bold">
                    {isLoading ? "..." : `${Number.parseFloat(balance).toFixed(4)} ETH`}
                  </span>
                </div>
                
                <DropdownMenu>
                  <DropdownMenuTrigger className={cn(buttonVariants({ variant: "ghost", size: "icon" }), "rounded-full cursor-pointer")}>
                    <User className="w-4 h-4" />
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56">
                    <DropdownMenuGroup>
                      <DropdownMenuLabel>My Account</DropdownMenuLabel>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem className="text-xs font-mono cursor-default">
                        {address}
                      </DropdownMenuItem>
                    </DropdownMenuGroup>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => logout()} className="text-destructive focus:text-destructive cursor-pointer">
                      <LogOut className="w-4 h-4 mr-2" />
                      Logout
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            ) : (
              <Button 
                onClick={() => login()}
                variant="default"
                size="sm"
                className="bg-foreground text-background hover:bg-foreground/90 font-bold px-6"
              >
                Login
              </Button>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}
