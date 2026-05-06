"use server";

const RPC_URL = process.env.RPC_URL || process.env.NEXT_PUBLIC_BASE_SEPOLIA_RPC || "https://sepolia.base.org";

export async function getRpcUrl() {
  if (!RPC_URL) {
    return {
      success: false,
      error: "RPC not configured",
    };
  }
  return {
    success: true,
    rpcUrl: RPC_URL,
  };
}
