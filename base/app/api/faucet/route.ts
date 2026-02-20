import { NextResponse } from "next/server";
import { ethers } from "ethers";

function getErrorMessage(error: unknown): string {
  if (typeof error === "string") return error;
  if (error instanceof Error) return error.message;
  if (typeof error === "object" && error !== null && "message" in error) {
    return String((error as { message?: unknown }).message ?? "Unknown error");
  }
  return "Unknown error";
}

const FAUCET_PRIVATE_KEY = process.env.NEXT_FAUCET_PRIVATE_KEY;
const RPC_URL = process.env.ETHEREUM_RPC_URL || "https://sepolia.base.org";
const TOKEN_ADDRESS =
  process.env.TOKEN_ADDRESS || "0x036CbD53842c5426634e7929541eC2318f3dCF7e";

const ERC20_ABI = [
  "function transfer(address to, uint256 amount) returns (bool)",
  "function decimals() view returns (uint8)",
  "function balanceOf(address account) view returns (uint256)",
];

export async function POST(request: Request) {
  try {
    if (!FAUCET_PRIVATE_KEY) {
      return NextResponse.json(
        { error: "Faucet configuration missing" },
        { status: 500 },
      );
    }

    const { address } = await request.json();

    if (!address || !ethers.isAddress(address)) {
      return NextResponse.json(
        { error: "Invalid address provided" },
        { status: 400 },
      );
    }
    console.log("RPC_URL:", RPC_URL);
    const provider = new ethers.JsonRpcProvider(RPC_URL);
    console.log("Provider connected:", await provider.getBlockNumber());
    const wallet = new ethers.Wallet(FAUCET_PRIVATE_KEY, provider);
    const tokenContract = new ethers.Contract(TOKEN_ADDRESS, ERC20_ABI, wallet);

    const txHashes: string[] = [];

    // Fetch the current nonce explicitly
    let currentNonce = await provider.getTransactionCount(wallet.address, "latest");

    try {
      let decimals = 18;
      try {
        decimals = Number(await tokenContract.decimals());
      } catch (e) {
        console.warn("Failed to fetch decimals, defaulting to 18", e);
      }

      const tokenAmount = ethers.parseUnits("0.25", decimals);

      const faucetTokenBalance = await tokenContract.balanceOf(wallet.address);
      if (faucetTokenBalance < tokenAmount) {
        throw new Error(
          `Faucet has insufficient tokens. Has ${ethers.formatUnits(faucetTokenBalance, decimals)}, needs 0.25`,
        );
      }

      console.log(
        `Sending 0.25 Tokens (decimals: ${decimals}) to ${address} with nonce ${currentNonce}...`,
      );

      const tokenTx = await tokenContract.transfer(address, tokenAmount, {
        gasLimit: 100000,
        nonce: currentNonce,
      });
      await tokenTx.wait();
      txHashes.push(tokenTx.hash);
      
      // Increment nonce for the next transaction
      currentNonce++;
    } catch (err: unknown) {
      console.error("Failed to send tokens:", err);
      return NextResponse.json(
        { error: getErrorMessage(err) || "Failed to send tokens." },
        { status: 500 },
      );
    }

    try {
      const userBalance = await provider.getBalance(address);
      if (userBalance < ethers.parseEther("0.001")) {
        console.log(`User has < 0.001 ETH. Sending 0.001 Base Sepolia ETH with nonce ${currentNonce}...`);
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
        } else {
          console.warn("Faucet has insufficient ETH to send gas money.");
        }
      }
    } catch (err) {
      console.error("Failed to check/send native ETH:", err);
    }

    return NextResponse.json({
      success: true,
      hashes: txHashes,
      hash: txHashes[0],
      message:
        txHashes.length > 1
          ? "Sent 0.25 Tokens & 0.001 ETH"
          : "Sent 0.25 Tokens",
    });
  } catch (error: unknown) {
    console.error("Faucet error:", error);
    return NextResponse.json(
      { error: getErrorMessage(error) || "Internal server error" },
      { status: 500 },
    );
  }
}
