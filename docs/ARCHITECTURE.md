# Architecture

## System boundaries
1. Identity: Supabase Auth authenticates an account. The account password is not the vault master password.
2. Key derivation: a client-side Argon2id operation derives a key-encryption key (KEK) from the master password and a unique per-vault salt.
3. Vault key: a random 256-bit data-encryption key (DEK) encrypts vault records. The KEK wraps the DEK.
4. Records: AES-256-GCM encrypts each record with a fresh unique 96-bit nonce. AAD binds vault ID, record ID, schema version, and item type.
5. Sync: the backend stores encrypted envelopes and non-secret synchronization metadata. Decryption occurs only on an authorized client.

## Key hierarchy
Master password -> Argon2id + unique salt -> KEK -> wrapped DEK -> encrypted vault records.

Changing the master password should re-wrap the DEK after successful unlock rather than re-encrypting every record. Recovery uses a separately generated high-entropy secret and a separately wrapped DEK envelope. Losing both the master password and recovery material means the vault cannot be recovered.

## Trust boundaries
- Browser/device memory while unlocked is trusted only to the extent that the endpoint is uncompromised.
- API and database are untrusted for confidentiality.
- Authentication does not imply permission to decrypt.
- A malicious client update or compromised endpoint can expose unlocked data.

## Planned components
- apps/web: Next.js web client
- apps/browser-extension: isolated extension and autofill integration
- apps/desktop: desktop shell
- apps/mobile: mobile client
- packages/crypto: reviewed primitives and envelope formats
- packages/vault-core: domain logic and item model
- packages/sync: ciphertext synchronization and conflict handling
- packages/validation: runtime schemas
- supabase: migrations and Row Level Security policies

No production cryptographic implementation is approved merely because it compiles or passes unit tests.
