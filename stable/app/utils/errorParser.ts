export function parseError(error: any): string {
  if (!error) return "An unknown error occurred.";

  const errorMessage = 
    typeof error === 'string' ? error : 
    error.message || JSON.stringify(error);

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

  // Fallback: Clean up and truncate huge error messages
  if (errorMessage.length > 100) {
      // If it looks like a JSON dump, try to extract a clean message
      try {
          // Sometimes errors are stringified JSON with a message property inside
          // e.g. "Error: { ... \"message\": \"Access denied\" ... }"
          const match = errorMessage.match(/"message"\s*:\s*"([^"]+)"/);
          if (match && match[1]) {
             return match[1];
          }
      } catch (e) {
          // ignore
      }
      return "An unexpected error occurred. Please checks console for details.";
  }

  return errorMessage;
}
