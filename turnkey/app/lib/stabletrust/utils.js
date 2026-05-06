import { ethers } from "ethers";

// Pinata uploads API endpoint
const PINATA_UPLOAD_URL = "https://uploads.pinata.cloud/v3/files";
const PINATA_JWT = process.env.PINATA_JWT;

/**
 * Encodes the ZK-Proof data for a transfer into a format the Solidity contract expects.
 */
export function encodeTransferProof(proofData) {
  const abiCoder = ethers.AbiCoder.defaultAbiCoder();
  return abiCoder.encode(
    ["string", "string", "string"],
    [
      proofData.equality_proof,
      proofData.ciphertext_validity_proof,
      proofData.range_proof,
    ],
  );
}

/**
 * Encodes the ZK-Proof data for a withdrawal.
 */
export function encodeWithdrawProof(proofData) {
  const abiCoder = ethers.AbiCoder.defaultAbiCoder();
  return abiCoder.encode(
    ["string", "string"],
    [proofData.equality_proof, proofData.range_proof],
  );
}

/**
 * Delays execution for a specified time.
 */
export function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Upload raw bytes to IPFS (Pinata) and return the CID.
 */
export async function uploadBytesToIpfs(bytes, name = "proof.bin") {
  if (!PINATA_JWT) {
    throw new Error("PINATA_JWT is not set");
  }

  const uint8 = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  const blob = new Blob([uint8], { type: "application/octet-stream" });

  const form = new FormData();
  form.append("file", blob, name);
  form.append("network", "public");
  form.append("name", name);

  const res = await fetch(PINATA_UPLOAD_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${PINATA_JWT}` },
    body: form,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Pinata upload failed: ${text}`);
  }

  const jsonRes = await res.json();
  return jsonRes?.data?.cid?.toString();
}
