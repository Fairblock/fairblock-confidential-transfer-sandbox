"use server";

const RPC_URL = process.env.RPC_URL || "https://base-sepolia.drpc.org";

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
