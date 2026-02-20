export function parseError(error: unknown): string {
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

  if (
    errorMessage.includes("User rejected") ||
    errorMessage.includes("Action rejected") ||
    errorMessage.includes("4001") ||
    errorMessage.includes("ACTION_REJECTED")
  ) {
    return "User rejected the request.";
  }

  if (errorMessage.includes("execution reverted")) {
    const match = errorMessage.match(/execution reverted: (.*?)"/);
    if (match && match[1]) {
      return `Transaction failed: ${match[1]}`;
    }
    return "Transaction failed: Execution reverted.";
  }

  if (
    errorMessage.includes("insufficient funds") ||
    errorMessage.includes("exceeds balance")
  ) {
    return "Insufficient funds for gas or transaction.";
  }

  if (errorMessage.includes("Internal JSON-RPC error")) {
    return "Internal network error. Please try again.";
  }

  if (
    errorMessage.includes("Network Error") ||
    errorMessage.includes("connection refusing")
  ) {
    return "Network connection failed. Please check your internet.";
  }

  if (errorMessage.includes("timeout")) {
    return "Request timed out. Please try again.";
  }

  if (errorMessage.includes("nonce too low")) {
    return "Transaction failed: Nonce too low. Please reset your wallet.";
  }

  if (errorMessage.includes("replacement transaction underpriced")) {
    return "Transaction failed: Replacement gas too low. Please increase gas.";
  }

  if (
    errorMessage.includes("call revert exception") ||
    errorMessage.includes("CALL_EXCEPTION")
  ) {
    return "Transaction failed: Contract execution reverted.";
  }

  if (errorMessage.length > 80) {
    try {
      const match = errorMessage.match(/"message"\s*:\s*"([^"]+)"/);
      if (match && match[1]) {
        return match[1].length > 80
          ? match[1].substring(0, 77) + "..."
          : match[1];
      }
    } catch (e) {
      console.log("Error parsing error message:", e);
    }
    return "An unexpected error occurred. Check console.";
  }

  return errorMessage;
}
