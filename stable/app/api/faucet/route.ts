import { NextResponse } from 'next/server';
import { ethers } from 'ethers';

const FAUCET_PRIVATE_KEY = process.env.NEXT_FAUCET_PRIVATE_KEY;
const RPC_URL = process.env.NEXT_PUBLIC_RPC_URL || "https://rpc.testnet.stable.xyz";

export async function POST(request: Request) {
  try {
    if (!FAUCET_PRIVATE_KEY) {
      return NextResponse.json(
        { error: 'Faucet configuration missing' },
        { status: 500 }
      );
    }

    const { address } = await request.json();

    if (!address || !ethers.isAddress(address)) {
      return NextResponse.json(
        { error: 'Invalid address provided' },
        { status: 400 }
      );
    }

    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const wallet = new ethers.Wallet(FAUCET_PRIVATE_KEY, provider);

    // Send 0.25 native token
    const amount = ethers.parseEther("0.25");
    
    // Check faucet balance
    const faucetBalance = await provider.getBalance(wallet.address);
    if (faucetBalance < amount) {
        return NextResponse.json(
            { error: 'Faucet is empty' },
            { status: 503 }
        );
    }

    const tx = await wallet.sendTransaction({
      to: address,
      value: amount,
    });

    await tx.wait();

    return NextResponse.json({ success: true, hash: tx.hash });
  } catch (error: any) {
    console.error('Faucet error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
