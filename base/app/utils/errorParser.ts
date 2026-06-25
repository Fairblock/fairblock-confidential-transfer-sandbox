export interface TransactionError {
  message?: string;
  code?: number | string;
  reason?: string;
  data?: Record<string, string | number | boolean | object | null>;
}

export type AppError = Error | TransactionError | string | null;

const SDK_PREFIXES = [
  "Failed to deposit: ",
  "Failed to transfer: ",
  "Failed to withdraw: ",
  "Failed to apply pending: ",
];

function unwrapSdkPrefix(msg: string): string {
  for (const prefix of SDK_PREFIXES) {
    if (msg.startsWith(prefix)) return msg.slice(prefix.length);
  }
  return msg;
}

export function parseError(error: AppError): string {
  if (!error) return "Something went wrong. Please try again.";

  const raw =
    typeof error === "string"
      ? error
      : error instanceof Error
        ? error.message
        : typeof error === "object" &&
            typeof (error as TransactionError).message === "string"
          ? String((error as TransactionError).message)
          : JSON.stringify(error);

  const msg = unwrapSdkPrefix(raw);

  // User cancelled
  if (
    msg.includes("User rejected") ||
    msg.includes("Action rejected") ||
    msg.includes("4001") ||
    msg.includes("ACTION_REJECTED") ||
    msg.includes("user rejected")
  ) {
    return "You cancelled the transaction.";
  }

  // Nonce / sequencing
  if (
    msg.includes("nonce too low") ||
    msg.includes("nonce has already been used")
  ) {
    return "A previous transaction is still processing. Please wait a moment and try again.";
  }

  if (msg.includes("replacement transaction underpriced")) {
    return "A duplicate transaction is pending. Please wait for it to confirm before trying again.";
  }

  // Native gas
  if (msg.includes("insufficient funds") || msg.includes("exceeds balance")) {
    return "You don't have enough ETH to cover the gas fee for this transaction.";
  }

  // ERC-20 revert reasons (from estimateGas or receipt)
  if (msg.includes("transfer amount exceeds allowance")) {
    return "Token spend approval is missing or too low. Please try again approval will be requested automatically.";
  }

  if (
    msg.includes("ERC20: insufficient balance") ||
    msg.includes("transfer amount exceeds balance")
  ) {
    return "Your token balance is too low for this transaction.";
  }

  if (msg.includes("Insufficient token balance")) {
    return "Your token balance is too low for this amount.";
  }

  // Generic execution revert extract the reason string
  if (msg.includes("execution reverted")) {
    const quoted = msg.match(/execution reverted[^"]*"([^"]+)"/);
    if (quoted?.[1]) return `Transaction failed: ${quoted[1]}`;

    const reason = msg.match(/reason="([^"]+)"/);
    if (reason?.[1]) return `Transaction failed: ${reason[1]}`;

    return "The transaction was rejected by the contract. Check that your balances are correct and try again.";
  }

  // Call exception without revert string
  if (msg.includes("CALL_EXCEPTION") || msg.includes("call revert exception")) {
    return "The contract rejected this transaction. Check your balances and try again.";
  }

  // Privy / wallet provider errors
  if (msg.includes("Missing or invalid parameters")) {
    return "Wallet request failed. Please reconnect your wallet and try again.";
  }

  if (msg.includes("Internal JSON-RPC error")) {
    return "Your wallet encountered an internal error. Please try again.";
  }

  // Network
  if (
    msg.includes("Network Error") ||
    msg.includes("connection refusing") ||
    msg.includes("Failed to fetch")
  ) {
    return "Network connection failed. Please check your internet connection.";
  }

  if (msg.includes("timeout") || msg.includes("timed out")) {
    return "The request timed out. Please try again.";
  }

  // Wallet not ready
  if (msg.includes("Wallet not ready")) {
    return "Wallet is still connecting. Please wait a moment and try again.";
  }

  // Short messages are usually already readable
  if (msg.length <= 120) return msg;

  // Try to pull a clean message out of nested JSON/error objects
  const jsonMessage = msg.match(/"message"\s*:\s*"([^"]+)"/);
  if (jsonMessage?.[1] && jsonMessage[1].length <= 120) return jsonMessage[1];

  return "Something went wrong. Please try again.";
}
