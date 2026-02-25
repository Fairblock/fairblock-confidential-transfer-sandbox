"use server";

import { ethers } from "ethers";

function getErrorMessage(error: unknown): string {
  if (typeof error === "string") return error;
  if (error instanceof Error) return error.message;
  if (typeof error === "object" && error !== null && "message" in error) {
    return String((error as { message?: unknown }).message ?? "Unknown error");
  }
  return "Unknown error";
}

const FAUCET_PRIVATE_KEY = process.env.PRIVATE_KEY;
const RPC_URL = process.env.RPC_URL || "https://rpc.testnet.stable.xyz";

export async function sendFaucet(address: string) {
  try {
    if (!FAUCET_PRIVATE_KEY) {
      return { success: false, error: "Faucet configuration missing" };
    }

    if (!address || !ethers.isAddress(address)) {
      return { success: false, error: "Invalid address provided" };
    }

    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const wallet = new ethers.Wallet(FAUCET_PRIVATE_KEY, provider);

    const amount = ethers.parseEther("0.25");

    // Check faucet balance
    const faucetBalance = await provider.getBalance(wallet.address);
    if (faucetBalance < amount) {
      return { success: false, error: "Faucet is empty" };
    }

    const tx = await wallet.sendTransaction({
      to: address,
      value: amount,
    });

    await tx.wait();

    return {
      success: true,
      hash: tx.hash,
      message: "Sent 0.25 native token",
    };
  } catch (error: unknown) {
    return {
      success: false,
      error: getErrorMessage(error) || "Internal server error",
    };
  }
}
