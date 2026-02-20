/* eslint-disable @typescript-eslint/no-explicit-any */
export function parseError(error: any): string {
  if (!error) return "An unknown error occurred.";

  const errorMessage =
    typeof error === "string"
      ? error
      : error instanceof Error
        ? error.message
        : typeof error === "object" && error !== null && "message" in error
          ? String(
              (error as { message?: unknown }).message ?? JSON.stringify(error),
            )
          : JSON.stringify(error);

  // User Rejected
  if (
    errorMessage.includes("User rejected") ||
    errorMessage.includes("Action rejected") ||
    errorMessage.includes("4001") ||
    errorMessage.includes("ACTION_REJECTED")
  ) {
    return "User rejected the request.";
  }

  // Execution Reverted
  if (errorMessage.includes("execution reverted")) {
    const match = errorMessage.match(/execution reverted: (.*?)"/);
    if (match && match[1]) {
      return `Transaction failed: ${match[1]}`;
    }
    return "Transaction failed: Execution reverted.";
  }

  // Insufficient Funds
  if (
    errorMessage.includes("insufficient funds") ||
    errorMessage.includes("exceeds balance")
  ) {
    return "Insufficient funds for gas or transaction.";
  }

  // Internal JSON RPC Error
  if (errorMessage.includes("Internal JSON-RPC error")) {
    return "Internal network error. Please try again.";
  }

  // Network Error / Connection
  if (
    errorMessage.includes("Network Error") ||
    errorMessage.includes("connection refusing")
  ) {
    return "Network connection failed. Please check your internet.";
  }

  // Timeout
  if (errorMessage.includes("timeout")) {
    return "Request timed out. Please try again.";
  }

  // Nonce too low
  if (errorMessage.includes("nonce too low")) {
    return "Transaction failed: Nonce too low. Please reset your wallet.";
  }

  // Replacement transaction underpriced
  if (errorMessage.includes("replacement transaction underpriced")) {
    return "Transaction failed: Replacement gas too low. Please increase gas.";
  }

  // Call Exception (general EVM revert)
  if (
    errorMessage.includes("call revert exception") ||
    errorMessage.includes("CALL_EXCEPTION")
  ) {
    return "Transaction failed: Contract execution reverted.";
  }

  // Fallback: Clean up and truncate huge error messages
  if (errorMessage.length > 80) {
    // If it looks like a JSON dump, try to extract a clean message
    try {
      // Sometimes errors are stringified JSON with a message property inside
      const match = errorMessage.match(/"message"\s*:\s*"([^"]+)"/);
      if (match && match[1]) {
        // further truncate if the inner message is also huge
        return match[1].length > 80
          ? match[1].substring(0, 77) + "..."
          : match[1];
      }
    } catch (e) {
      // ignore
      console.log("Error parsing error message:", e);
    }
    return "An unexpected error occurred. Check console.";
  }

  return errorMessage;
}
