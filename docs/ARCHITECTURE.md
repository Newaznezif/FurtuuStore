# Architecture

## Current web MVP

1. **Identity:** Supabase Auth email magic links establish the account session. Account authentication and the vault master password are separate.
2. **Key derivation:** The browser derives an AES-GCM wrapping key from the master password using Argon2id and a per-vault random salt.
3. **Vault key:** The browser generates a random 256-bit data-encryption key (DEK) and stores only its AES-GCM-wrapped form in Postgres.
4. **Record encryption:** Each vault item is encrypted in the browser using AES-256-GCM with a fresh random 96-bit nonce and AAD bound to user and item IDs.
5. **Synchronization:** Supabase stores encrypted payloads. RLS policies restrict reads and writes to the authenticated owner.
6. **Unlock:** The browser fetches the wrapped DEK and ciphertext, derives the wrapping key, unwraps the DEK, and decrypts records locally.

## Key hierarchy

Master password → Argon2id + salt → KEK → wrapped DEK → encrypted records.

The master password is not used for Supabase authentication and is not submitted to the backend. The server does not hold a plaintext DEK.

## Database

- `public.vaults`: one vault per authenticated user; KDF salt, parameters, wrapped DEK, nonce, crypto version, timestamps.
- `public.vault_items`: user-owned encrypted item envelopes; ciphertext, nonce, version, IDs, timestamps.

Both tables have RLS enabled. All policies target the authenticated role and compare `auth.uid()` with `user_id`. The security advisor returned no lints immediately after the initial schema migration.

## Trust boundaries and residual risk

- The database and API are not trusted with plaintext confidentiality.
- The browser is trusted while unlocked only to the extent that the endpoint is uncompromised.
- A malicious extension, XSS, compromised endpoint, malicious client update, or keylogger can expose decrypted records.
- Authentication is not decryption authorization; possession of the master password is required to unwrap the DEK.
- Locking clears app state and drops the CryptoKey reference. JavaScript cannot guarantee physical memory erasure.

## Not implemented

Recovery key, master-password rotation, device/session management UI, import/export, autofill, browser extension, mobile/desktop clients, conflict resolution, offline-first sync, and independent security review.
