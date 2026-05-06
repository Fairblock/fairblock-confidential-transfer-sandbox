import { ethers } from "ethers";
import {
  CONTRACT_ABI,
  ERC20_ABI,
  getStabletrustContractAddress,
} from "./constants.js";
import { deriveKeys, decryptCiphertext, combineCiphertext } from "./crypto.js";
import { encodeTransferProof, encodeWithdrawProof, sleep, uploadBytesToIpfs } from "./utils.js";
import { initializeWasm } from "./wasm-loader.js";

let wasmModulePromise = null;

function getWasmModule() {
  if (!wasmModulePromise) {
    wasmModulePromise = initializeWasm();
  }
  return wasmModulePromise;
}

/**
 * ConfidentialTransferClient — Turnkey-compatible confidential transfer SDK.
 *
 * Accepts any ethers v6 Signer, including TurnkeySigner from @turnkey/ethers.
 * Key derivation uses EIP-712 signTypedData which TurnkeySigner supports natively.
 */
export class ConfidentialTransferClient {
  constructor(rpcUrl, contractAddressOrChainId, chainId) {
    if (!rpcUrl) throw new Error("rpcUrl is required");

    let resolvedChainId;
    let resolvedContractAddress;

    if (typeof contractAddressOrChainId === "number" && chainId === undefined) {
      resolvedChainId = contractAddressOrChainId;
      resolvedContractAddress = getStabletrustContractAddress(resolvedChainId);
    } else {
      resolvedChainId = chainId;
      resolvedContractAddress =
        contractAddressOrChainId || getStabletrustContractAddress(resolvedChainId);
    }

    if (!resolvedChainId) throw new Error("chainId is required");
    if (!resolvedContractAddress) {
      throw new Error(
        `No Stabletrust contract for chainId ${resolvedChainId}. Supported: 2201, 1244, 84532, 11155111, 421614, 42431`,
      );
    }
    if (!ethers.isAddress(resolvedContractAddress)) {
      throw new Error(`Invalid contractAddress: ${resolvedContractAddress}`);
    }

    this.config = {
      rpcUrl,
      contractAddress: ethers.getAddress(resolvedContractAddress),
      chainId: Number(resolvedChainId),
    };

    this._wasmModule = null;
    this._keyCache = new Map();

    try {
      this.provider = new ethers.JsonRpcProvider(this.config.rpcUrl);
      this.contract = new ethers.Contract(
        this.config.contractAddress,
        CONTRACT_ABI,
        this.provider,
      );
    } catch (error) {
      throw new Error(`Failed to initialize contracts: ${error.message}`);
    }
  }

  async _getWasm() {
    if (!this._wasmModule) {
      this._wasmModule = await getWasmModule();
    }
    return this._wasmModule;
  }

  _getTokenContract(tokenAddress) {
    return new ethers.Contract(tokenAddress, ERC20_ABI, this.provider);
  }

  async _deriveKeys(wallet) {
    try {
      if (!wallet) throw new Error("Wallet is required");
      const address = await wallet.getAddress();
      if (this._keyCache.has(address)) return this._keyCache.get(address);
      const wasm = await this._getWasm();
      const keys = await deriveKeys(
        wallet,
        { chainId: this.config.chainId, contractAddress: this.config.contractAddress },
        wasm.generate_deterministic_keypair,
      );
      this._keyCache.set(address, keys);
      return keys;
    } catch (error) {
      throw new Error(`Failed to derive keys: ${error.message}`);
    }
  }

  async getAccountInfo(address) {
    try {
      if (!address || !ethers.isAddress(address)) {
        throw new Error(`Invalid address: ${address}`);
      }
      return await this.contract.getAccountCore(address);
    } catch (error) {
      throw new Error(`Failed to get account info: ${error.message}`);
    }
  }

  /**
   * Create a confidential account if it doesn't exist and wait for finalization.
   * Returns the derived ElGamal {publicKey, privateKey}.
   *
   * @param {ethers.Signer} wallet - TurnkeySigner or any ethers v6 Signer
   */
  async ensureAccount(wallet, options = {}) {
    const { waitForFinalization = true, maxAttempts = 225 } = options;

    try {
      const address = await wallet.getAddress();
      const keys = await this._deriveKeys(wallet);
      let accountInfo = await this.getAccountInfo(address);

      if (!accountInfo.exists) {
        const tx = await this.contract
          .connect(wallet)
          .createConfidentialAccount(Buffer.from(keys.publicKey, "base64"));

        const receipt = await tx.wait();
        if (!receipt || receipt.status === 0) {
          throw new Error("Account creation transaction failed");
        }
        accountInfo = await this.getAccountInfo(address);
      }

      if (waitForFinalization) {
        let attempts = 0;
        while (!accountInfo.finalized && attempts < maxAttempts) {
          await sleep(400);
          accountInfo = await this.getAccountInfo(address);
          attempts++;
        }
        if (!accountInfo.finalized) {
          throw new Error(
            `Account finalization timeout after ${maxAttempts} attempts.`,
          );
        }
      }

      return keys;
    } catch (error) {
      if (error.message.includes("Account finalization timeout")) throw error;
      throw new Error(`Failed to ensure account: ${error.message}`);
    }
  }

  async getPublicBalance(address, tokenAddress) {
    try {
      if (!address || !ethers.isAddress(address)) throw new Error(`Invalid address: ${address}`);
      if (!tokenAddress || !ethers.isAddress(tokenAddress)) throw new Error(`Invalid token address: ${tokenAddress}`);
      return await this._getTokenContract(tokenAddress).balanceOf(address);
    } catch (error) {
      throw new Error(`Failed to get token balance: ${error.message}`);
    }
  }

  async getConfidentialBalance(address, privateKey, tokenAddress) {
    try {
      const [available, pending] = await Promise.all([
        this._getAvailableBalance(address, privateKey, tokenAddress),
        this._getPendingBalance(address, privateKey, tokenAddress),
      ]);
      return { amount: available.amount + pending.amount, available, pending };
    } catch (error) {
      throw new Error(`Failed to get confidential balance: ${error.message}`);
    }
  }

  async _getAvailableBalance(address, privateKey, tokenAddress) {
    return this._getBalanceByType(address, privateKey, tokenAddress, "available");
  }

  async _getPendingBalance(address, privateKey, tokenAddress) {
    return this._getBalanceByType(address, privateKey, tokenAddress, "pending");
  }

  async _getBalanceByType(address, privateKey, tokenAddress, type) {
    try {
      if (!address || !ethers.isAddress(address)) throw new Error(`Invalid address: ${address}`);
      if (!privateKey) throw new Error("Private key is required for decryption");
      if (!tokenAddress || !ethers.isAddress(tokenAddress)) throw new Error(`Invalid token address: ${tokenAddress}`);

      let c1, c2;
      if (type === "pending") {
        [c1, c2] = await this.contract.getPending(address, tokenAddress);
      } else {
        [c1, c2] = await this.contract.getAvailable(address, tokenAddress);
      }

      if ((!c1 || c1 === "0x") && (!c2 || c2 === "0x")) {
        return { amount: 0n, ciphertext: null };
      }

      const wasm = await this._getWasm();
      const ciphertext = combineCiphertext(c1, c2);
      const contractAmount = decryptCiphertext(ciphertext, privateKey, wasm.decrypt_ciphertext);
      const tokenAmount = ethers.formatUnits(contractAmount, 2);
      const tokenContract = this._getTokenContract(tokenAddress);
      const tokenUnits = await tokenContract.decimals();

      return { amount: ethers.parseUnits(tokenAmount, Number(tokenUnits)), ciphertext };
    } catch (error) {
      throw new Error(`Failed to get balance: ${error.message}`);
    }
  }

  async _applyPendingIfNeeded(wallet, privateKey, tokenAddress, actionLabel) {
    const address = await wallet.getAddress();
    const pendingBalance = await this._getPendingBalance(address, privateKey, tokenAddress);
    if (pendingBalance.amount > 0n) {
      try {
        await this._applyPending(wallet, { waitForFinalization: true });
      } catch (error) {
        console.warn(`Warning: Failed to apply pending balance before ${actionLabel}: ${error.message}`);
      }
    }
  }

  async confidentialDeposit(wallet, tokenAddress, amount, options = {}) {
    const { waitForFinalization = true } = options;

    try {
      if (!wallet) throw new Error("Wallet is required");
      if (!tokenAddress || !ethers.isAddress(tokenAddress)) throw new Error(`Invalid token address: ${tokenAddress}`);
      if (!amount || BigInt(amount) <= 0) throw new Error("Amount must be greater than 0");

      const address = await wallet.getAddress();
      const derivedKeys = await this._deriveKeys(wallet);
      await this._applyPendingIfNeeded(wallet, derivedKeys.privateKey, tokenAddress, "deposit");

      const tokenContract = this._getTokenContract(tokenAddress);
      const tokenDecimals = await tokenContract.decimals();
      const depositAmount = (BigInt(amount) * 100n) / 10n ** BigInt(tokenDecimals);

      const [tokenBalance, allowance] = await Promise.all([
        tokenContract.balanceOf(address),
        tokenContract.allowance(address, this.config.contractAddress),
      ]);

      if (tokenBalance < BigInt(amount)) {
        throw new Error(`Insufficient token balance. Required: ${amount}, Available: ${tokenBalance}`);
      }

      if (allowance < BigInt(amount)) {
        const approveTx = await tokenContract
          .connect(wallet)
          .approve(this.config.contractAddress, ethers.MaxUint256);
        const approveReceipt = await approveTx.wait();
        if (!approveReceipt || approveReceipt.status === 0) throw new Error("Token approval failed");
      }

      const depositTx = await this.contract.connect(wallet).deposit(tokenAddress, depositAmount);
      const receipt = await depositTx.wait();
      if (!receipt || receipt.status === 0) throw new Error("Deposit transaction failed");

      if (waitForFinalization) await this._waitForGlobalState(address, "deposit");

      return receipt;
    } catch (error) {
      if (error.message.includes("Insufficient token balance")) throw error;
      throw new Error(`Failed to deposit: ${error.message}`);
    }
  }

  async confidentialTransfer(senderWallet, recipientAddress, tokenAddress, amount, options = {}) {
    const { useOffchainVerify = false, waitForFinalization = true } = options;

    try {
      if (!senderWallet) throw new Error("Sender wallet is required");
      if (!recipientAddress || !ethers.isAddress(recipientAddress)) throw new Error(`Invalid recipient address: ${recipientAddress}`);
      if (!tokenAddress || !ethers.isAddress(tokenAddress)) throw new Error(`Invalid token address: ${tokenAddress}`);
      if (!amount || BigInt(amount) <= 0n) throw new Error("Transfer amount must be greater than 0");

      const tokenContract = this._getTokenContract(tokenAddress);
      const tokenDecimals = await tokenContract.decimals();
      const transferAmount = (BigInt(amount) * 100n) / 10n ** BigInt(tokenDecimals);
      const senderAddress = await senderWallet.getAddress();

      const [derivedSenderKeys, recipientAccountInfo] = await Promise.all([
        this._deriveKeys(senderWallet),
        this.getAccountInfo(recipientAddress),
      ]);

      if (!derivedSenderKeys?.privateKey) throw new Error("Failed to derive sender keys");
      if (!recipientAccountInfo.exists) throw new Error(`Recipient account does not exist: ${recipientAddress}`);

      let recipientPubkey = recipientAccountInfo.pubkey;
      if (!recipientPubkey) throw new Error("Recipient public key is required");
      if (typeof recipientPubkey === "string" && recipientPubkey.startsWith("0x")) {
        recipientPubkey = Buffer.from(recipientPubkey.slice(2), "hex").toString("base64");
      }

      await this._applyPendingIfNeeded(senderWallet, derivedSenderKeys.privateKey, tokenAddress, "transfer");

      const [balanceSummary, fee] = await Promise.all([
        this.getConfidentialBalance(senderAddress, derivedSenderKeys.privateKey, tokenAddress),
        this.getFeeAmount(),
      ]);

      const currentBalanceCiphertext = balanceSummary.available.ciphertext;
      const currentBalance = balanceSummary.available.amount;

      if (!currentBalanceCiphertext) throw new Error("Current balance ciphertext is required");
      if (balanceSummary.amount < BigInt(amount)) throw new Error(`Insufficient balance. Required: ${amount}, Total: ${balanceSummary.amount}`);
      if (currentBalance === undefined || currentBalance < BigInt(amount)) throw new Error(`Insufficient available balance. Required: ${amount}, Available: ${currentBalance}`);

      const currentBalanceContractScale = (BigInt(currentBalance) * 100n) / 10n ** BigInt(tokenDecimals);

      const proofInput = {
        current_balance_ciphertext: currentBalanceCiphertext,
        current_balance: Number(currentBalanceContractScale),
        transfer_amount: Number(transferAmount),
        source_keypair: derivedSenderKeys.privateKey,
        destination_pubkey: recipientPubkey,
      };

      const wasm = await this._getWasm();
      const proof = JSON.parse(wasm.generate_transfer_proof(JSON.stringify(proofInput)));
      if (!proof.success) throw new Error(`Proof generation failed: ${proof.error || "Unknown error"}`);

      const encodedProof = ethers.getBytes(encodeTransferProof(proof.data));
      let transferZkpArg;
      let txOverrides;

      if (this.config.chainId === 42431) {
        const cid = await uploadBytesToIpfs(encodedProof, "transfer-proof.bin");
        transferZkpArg = ethers.toUtf8Bytes(`ipfs://${cid}`);
        txOverrides = { value: 0n };
      } else {
        transferZkpArg = encodedProof;
        txOverrides = { value: fee };
      }

      const tx = await this.contract
        .connect(senderWallet)
        .transferConfidential(recipientAddress, tokenAddress, transferZkpArg, useOffchainVerify, txOverrides);

      const receipt = await tx.wait();
      if (!receipt || receipt.status === 0) throw new Error("Transfer transaction failed");

      if (waitForFinalization) await this._waitForGlobalState(senderAddress, "transfer");

      return receipt;
    } catch (error) {
      const message = error?.message ?? String(error);
      if (message.includes("Insufficient balance") || message.includes("Proof generation failed")) throw error;
      throw new Error(`Failed to transfer: ${message}`);
    }
  }

  async withdraw(wallet, tokenAddress, amount, options = {}) {
    const { useOffchainVerify = false, waitForFinalization = true } = options;

    try {
      if (!wallet) throw new Error("Wallet is required");
      if (!tokenAddress || !ethers.isAddress(tokenAddress)) throw new Error(`Invalid token address: ${tokenAddress}`);
      if (!amount || BigInt(amount) <= 0n) throw new Error("Withdrawal amount must be greater than 0");

      const tokenContract = this._getTokenContract(tokenAddress);
      const tokenDecimals = await tokenContract.decimals();
      const withdrawAmount = (BigInt(amount) * 100n) / 10n ** BigInt(tokenDecimals);

      const derivedKeys = await this._deriveKeys(wallet);
      if (!derivedKeys?.privateKey) throw new Error("Failed to derive keys");

      const address = await wallet.getAddress();
      let balanceSummary = await this.getConfidentialBalance(address, derivedKeys.privateKey, tokenAddress);

      if (balanceSummary.available.amount < BigInt(amount)) {
        await this._applyPendingIfNeeded(wallet, derivedKeys.privateKey, tokenAddress, "withdraw");
        balanceSummary = await this.getConfidentialBalance(address, derivedKeys.privateKey, tokenAddress);
      }

      const currentBalanceCiphertext = balanceSummary.available.ciphertext;
      const currentBalance = balanceSummary.available.amount;

      if (!currentBalanceCiphertext) throw new Error("Current balance ciphertext is required");
      if (balanceSummary.amount < BigInt(amount)) throw new Error(`Insufficient balance. Required: ${amount}, Total: ${balanceSummary.amount}`);
      if (currentBalance === undefined || currentBalance < BigInt(amount)) throw new Error(`Insufficient available balance. Required: ${amount}, Available: ${currentBalance}`);

      const currentBalanceContractScale = (BigInt(currentBalance) * 100n) / 10n ** BigInt(tokenDecimals);

      const withdrawInput = {
        current_balance_ciphertext: currentBalanceCiphertext,
        current_balance: Number(currentBalanceContractScale),
        withdraw_amount: Number(withdrawAmount),
        keypair: derivedKeys.privateKey,
      };

      const wasm = await this._getWasm();
      const proof = JSON.parse(wasm.generate_withdraw_proof(JSON.stringify(withdrawInput)));
      if (!proof.success) throw new Error(`Withdrawal proof generation failed: ${proof.error || "Unknown error"}`);

      const encodedProof = ethers.getBytes(encodeWithdrawProof(proof.data));
      let withdrawZkpArg;

      if (this.config.chainId === 42431) {
        const cid = await uploadBytesToIpfs(encodedProof, "withdraw-proof.bin");
        withdrawZkpArg = ethers.toUtf8Bytes(`ipfs://${cid}`);
      } else {
        withdrawZkpArg = encodedProof;
      }

      const tx = await this.contract
        .connect(wallet)
        .withdraw(tokenAddress, BigInt(withdrawAmount), withdrawZkpArg, useOffchainVerify);

      const receipt = await tx.wait();
      if (!receipt || receipt.status === 0) throw new Error("Withdrawal transaction failed");

      if (waitForFinalization) await this._waitForGlobalState(address, "withdraw");

      return receipt;
    } catch (error) {
      const message = error?.message ?? String(error);
      if (message.includes("Insufficient balance") || message.includes("proof generation failed")) throw error;
      throw new Error(`Failed to withdraw: ${message}`);
    }
  }

  async _applyPending(wallet, options = {}) {
    const { waitForFinalization = true } = options;
    try {
      if (!wallet) throw new Error("Wallet is required");
      const address = await wallet.getAddress();
      const tx = await this.contract.connect(wallet).applyPending();
      const receipt = await tx.wait();
      if (!receipt || receipt.status === 0) throw new Error("Apply pending transaction failed");
      if (waitForFinalization) await this._waitForGlobalState(address, "apply pending");
      return receipt;
    } catch (error) {
      throw new Error(`Failed to apply pending: ${error.message}`);
    }
  }

  async _waitForGlobalState(address, actionLabel) {
    let attempts = 0;
    const maxAttempts = 450;
    await sleep(2000);
    while (attempts < maxAttempts) {
      try {
        const info = await this.contract.getAccountCore(address);
        if (!info.hasPendingAction) return;
      } catch (error) {
        console.warn(`Warning: Failed to check account state (attempt ${attempts + 1}): ${error.message}`);
      }
      await sleep(200);
      attempts++;
    }
    throw new Error(`Timeout waiting for ${actionLabel} to complete.`);
  }

  async getFeeAmount() {
    try {
      return await this.contract.feeAmount();
    } catch (error) {
      throw new Error(`Failed to get fee amount: ${error.message}`);
    }
  }
}
