import init, {
  generate_deterministic_keypair,
  generate_transfer_proof,
  generate_withdraw_proof,
  decrypt_ciphertext,
} from "./pkg/confidential_transfer_proof_generation.js";

let isInitialized = false;
let initPromise = null;

/**
 * Initialize the WASM module.
 * Browser: bundler handles WASM loading via import.meta.url.
 * Node.js: reads WASM from filesystem (used in server actions / tests).
 */
export async function initializeWasm(input) {
  if (initPromise) {
    await initPromise;
    return getExports();
  }

  if (isInitialized) {
    return getExports();
  }

  initPromise = (async () => {
    try {
      if (input) {
        await init(input);
      } else {
        const isNode =
          typeof process !== "undefined" &&
          process.versions != null &&
          process.versions.node != null;

        if (isNode) {
          const fs = await import("fs");
          const path = await import("path");
          const { fileURLToPath } = await import("url");
          const __filename = fileURLToPath(import.meta.url);
          const __dirname = path.dirname(__filename);
          const wasmPath = path.resolve(
            __dirname,
            "./pkg/confidential_transfer_proof_generation_bg.wasm",
          );
          await init(fs.readFileSync(wasmPath));
        } else {
          // Browser: Next.js / webpack handles the WASM asset via import.meta.url
          await init();
        }
      }

      isInitialized = true;
    } catch (error) {
      initPromise = null;
      throw new Error(`Failed to initialize WASM module: ${error.message}`);
    }
  })();

  await initPromise;
  return getExports();
}

function getExports() {
  return {
    generate_deterministic_keypair,
    generate_transfer_proof,
    generate_withdraw_proof,
    decrypt_ciphertext,
  };
}

export { generate_deterministic_keypair, generate_transfer_proof, generate_withdraw_proof, decrypt_ciphertext };
