import { ethers } from "ethers";

/**
 * Derives ElGamal encryption keys deterministically using the user's wallet signature.
 * Uses EIP-712 typed data signing — compatible with TurnkeySigner from @turnkey/ethers.
 *
 * @param {ethers.Signer} wallet - Any ethers v6 signer (including TurnkeySigner)
 * @param {Object} config - { chainId, contractAddress }
 * @param {Function} generateKeypair - WASM function for deterministic key generation
 * @returns {Promise<{publicKey: string, privateKey: string}>}
 */
export async function deriveKeys(wallet, config, generateKeypair) {
  const domain = {
    name: "ConfidentialTokens",
    version: "1",
    chainId: config.chainId,
    verifyingContract: config.contractAddress,
  };

  const types = {
    DeriveElGamalKey: [
      { name: "purpose", type: "string" },
      { name: "user", type: "address" },
      { name: "context", type: "bytes32" },
    ],
  };

  const contextHash = ethers.keccak256(
    ethers.AbiCoder.defaultAbiCoder().encode(
      ["uint256", "address", "address", "string"],
      [config.chainId, config.contractAddress, ethers.ZeroAddress, "main"],
    ),
  );

  // Use checksummed address — Turnkey's signTypedData is strict about address format
  const userAddress = ethers.getAddress(await wallet.getAddress());

  const message = {
    purpose: "homomorphic-key-derive-v1",
    user: userAddress,
    context: contextHash,
  };

  const signature = await wallet.signTypedData(domain, types, message);

  const domainContext = JSON.stringify({
    chainId: config.chainId.toString(),
    verifyingContract: config.contractAddress,
    user: userAddress.toLowerCase(),
    purpose: "homomorphic-key-derive-v1",
    version: "1",
  });

  const keypair = JSON.parse(generateKeypair(signature.slice(2), domainContext));

  return {
    publicKey: keypair.public_key,
    privateKey: keypair.private_key,
  };
}

/**
 * Decrypts a ciphertext using the private key.
 */
export function decryptCiphertext(ciphertext, privateKey, decryptFn) {
  try {
    const plainStr = decryptFn(ciphertext, privateKey);
    const result = JSON.parse(plainStr);
    return result.decrypted_amount || 0;
  } catch (e) {
    throw new Error("Decryption failed: " + e.message);
  }
}

/**
 * Combines two elliptic curve points into a single ciphertext.
 */
export function combineCiphertext(c1, c2) {
  const combined = new Uint8Array(64);
  combined.set(ethers.getBytes(c1), 0);
  combined.set(ethers.getBytes(c2), 32);
  return Buffer.from(combined).toString("base64");
}
