import { argon2id } from "hash-wasm";

const KDF = {
  algorithm: "argon2id",
  memorySize: 65_536,
  iterations: 3,
  parallelism: 1,
  hashLength: 32,
} as const;

export type VaultRecord = {
  user_id: string;
  kdf_salt: string;
  wrapped_dek: string;
  wrap_nonce: string;
  kdf_params: {
    algorithm: "argon2id";
    memory_kib: number;
    iterations: number;
    parallelism: number;
  };
  crypto_version: 1;
};

export type EncryptedRecord = {
  id: string;
  user_id: string;
  encrypted_payload: string;
  nonce: string;
  crypto_version: 1;
};

export type VaultItem = {
  id: string;
  title: string;
  username: string;
  password: string;
  url: string;
  notes: string;
  category: string;
  created_at?: string;
  updated_at?: string;
};

function toBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(binary);
}

function fromBase64(value: string): Uint8Array {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function randomBytes(length: number): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(length));
}

async function deriveWrappingKey(masterPassword: string, salt: Uint8Array): Promise<CryptoKey> {
  const raw = await argon2id({
    password: masterPassword,
    salt,
    parallelism: KDF.parallelism,
    iterations: KDF.iterations,
    memorySize: KDF.memorySize,
    hashLength: KDF.hashLength,
    outputType: "binary",
  });
  return crypto.subtle.importKey("raw", raw, { name: "AES-GCM" }, false, ["encrypt", "decrypt"]);
}

export async function createVault(userId: string, masterPassword: string): Promise<{
  record: VaultRecord;
  key: CryptoKey;
}> {
  if (masterPassword.length < 12) throw new Error("Use a master password with at least 12 characters.");
  const salt = randomBytes(16);
  const wrappingKey = await deriveWrappingKey(masterPassword, salt);
  const dataKeyBytes = randomBytes(32);
  const nonce = randomBytes(12);
  const wrapped = await crypto.subtle.encrypt({ name: "AES-GCM", iv: nonce }, wrappingKey, dataKeyBytes);
  const key = await crypto.subtle.importKey("raw", dataKeyBytes, { name: "AES-GCM" }, false, ["encrypt", "decrypt"]);
  dataKeyBytes.fill(0);

  return {
    record: {
      user_id: userId,
      kdf_salt: toBase64(salt),
      wrapped_dek: toBase64(new Uint8Array(wrapped)),
      wrap_nonce: toBase64(nonce),
      kdf_params: { algorithm: "argon2id", memory_kib: KDF.memorySize, iterations: KDF.iterations, parallelism: KDF.parallelism },
      crypto_version: 1,
    },
    key,
  };
}

export async function unlockVault(record: VaultRecord, masterPassword: string): Promise<CryptoKey> {
  if (record.crypto_version !== 1 || record.kdf_params.algorithm !== "argon2id") {
    throw new Error("This vault uses an unsupported encryption format.");
  }
  const wrappingKey = await deriveWrappingKey(masterPassword, fromBase64(record.kdf_salt));
  const raw = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: fromBase64(record.wrap_nonce) },
    wrappingKey,
    fromBase64(record.wrapped_dek),
  );
  return crypto.subtle.importKey("raw", raw, { name: "AES-GCM" }, false, ["encrypt", "decrypt"]);
}

export async function encryptItem(item: VaultItem, userId: string, key: CryptoKey): Promise<EncryptedRecord> {
  const nonce = randomBytes(12);
  const aad = new TextEncoder().encode(`furtuustore:v1:${userId}:${item.id}`);
  const plaintext = new TextEncoder().encode(JSON.stringify(item));
  const ciphertext = await crypto.subtle.encrypt({ name: "AES-GCM", iv: nonce, additionalData: aad }, key, plaintext);
  plaintext.fill(0);
  return {
    id: item.id,
    user_id: userId,
    encrypted_payload: toBase64(new Uint8Array(ciphertext)),
    nonce: toBase64(nonce),
    crypto_version: 1,
  };
}

export async function decryptItem(record: EncryptedRecord, key: CryptoKey): Promise<VaultItem> {
  if (record.crypto_version !== 1) throw new Error("Unsupported item encryption version.");
  const aad = new TextEncoder().encode(`furtuustore:v1:${record.user_id}:${record.id}`);
  const plaintext = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: fromBase64(record.nonce), additionalData: aad },
    key,
    fromBase64(record.encrypted_payload),
  );
  return JSON.parse(new TextDecoder().decode(plaintext)) as VaultItem;
}
