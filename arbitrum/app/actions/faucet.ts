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
const RPC_URL = process.env.RPC_URL || "https://sepolia-rollup.arbitrum.io/rpc";
const TOKEN_ADDRESS =
  process.env.TOKEN_ADDRESS || "0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d";

const ERC20_ABI = [
  "function transfer(address to, uint256 amount) returns (bool)",
  "function decimals() view returns (uint8)",
  "function balanceOf(address account) view returns (uint256)",
];

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
    const tokenContract = new ethers.Contract(TOKEN_ADDRESS, ERC20_ABI, wallet);

    const txHashes: string[] = [];

    let currentNonce = await provider.getTransactionCount(
      wallet.address,
      "latest",
    );

    // --- Send ERC20 ---
    let decimals = 18;
    try {
      decimals = Number(await tokenContract.decimals());
    } catch {
      // fallback to 18
    }

    const tokenAmount = ethers.parseUnits("0.25", decimals);

    const faucetTokenBalance = await tokenContract.balanceOf(wallet.address);
    if (faucetTokenBalance < tokenAmount) {
      return {
        success: false,
        error: `Faucet has insufficient tokens. Has ${ethers.formatUnits(
          faucetTokenBalance,
          decimals,
        )}, needs 0.25`,
      };
    }

    const tokenTx = await tokenContract.transfer(address, tokenAmount, {
      gasLimit: 100000,
      nonce: currentNonce,
    });

    await tokenTx.wait();
    txHashes.push(tokenTx.hash);
    currentNonce++;

    // --- Send native ETH if needed ---
    const userBalance = await provider.getBalance(address);

    if (userBalance < ethers.parseEther("0.001")) {
      const ethAmount = ethers.parseEther("0.001");
      const faucetEthBalance = await provider.getBalance(wallet.address);

      if (faucetEthBalance >= ethAmount) {
        const ethTx = await wallet.sendTransaction({
          to: address,
          value: ethAmount,
          nonce: currentNonce,
        });

        await ethTx.wait();
        txHashes.push(ethTx.hash);
      }
    }

    return {
      success: true,
      hashes: txHashes,
      hash: txHashes[0],
      message:
        txHashes.length > 1
          ? "Sent 0.25 Tokens & 0.001 ETH"
          : "Sent 0.25 Tokens",
    };
  } catch (error: unknown) {
    return {
      success: false,
      error: getErrorMessage(error) || "Internal server error",
    };
  }
}
