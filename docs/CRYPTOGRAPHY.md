# Cryptographic design — version 1

This document describes the current prototype implementation. It is not an independent security review or production approval.

## Algorithms and parameters

- Key derivation: Argon2id via the maintained `hash-wasm` package.
- Version 1 parameters: 65,536 KiB memory, 3 iterations, parallelism 1, 32-byte output.
- Data encryption and DEK wrapping: AES-256-GCM through the browser Web Crypto API.
- Nonces: fresh random 96-bit values generated with `crypto.getRandomValues`.
- Salt: fresh random 128-bit per-vault salt.
- DEK: fresh random 256-bit key per vault.

## Key hierarchy

Master password → Argon2id + per-vault salt → wrapping key (KEK) → AES-GCM-wrapped DEK → per-item AES-GCM ciphertext.

The raw DEK is imported as a non-extractable CryptoKey for normal record operations. The master password is not sent to Supabase. The wrapping key is held only during vault creation or unlock.

## Record encryption

Each item is JSON-serialized and encrypted with AES-256-GCM using a new 96-bit nonce. Additional authenticated data binds the ciphertext to the application format version, authenticated user ID, and item ID:

`furtuustore:v1:<user_id>:<item_id>`

Changing the record ID or user ID causes authenticated decryption to fail. The encrypted payload includes the GCM authentication tag.

The vault table stores the KDF salt, KDF parameters, wrapped DEK, and wrapping nonce. The item table stores item ID, owner ID, ciphertext, nonce, version, and timestamps.

## Key lifecycle and limitations

JavaScript cannot guarantee secure erasure of strings or memory. Locking drops application references to the in-memory CryptoKey and clears decrypted UI state, but cannot prove that every copy has been erased from process memory.

Version 1 parameters are fixed in code. The implementation does not yet support KDF upgrades, master-password rotation, recovery keys, device revocation, or cross-client test vectors. There is no password reset or recovery bypass.

## Release blockers

Independent cryptographic review, test vectors, malformed-input tests, KDF performance testing, CSP review, dependency/supply-chain review, recovery design, and penetration testing are required before high-value use.
