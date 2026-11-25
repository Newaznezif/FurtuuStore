# FurtuuStore

**Your keys. Your privacy. Your control.**

FurtuuStore is a browser-based password-vault prototype built around client-side encryption and user-controlled keys.

> **Security status: functional MVP, not independently audited. Do not use it as the sole store for high-value credentials, recovery codes, production secrets, or regulated data.** A successful build and an empty database security-advisor report are not a security audit.

## Implemented in this MVP

- Email magic-link authentication through Supabase Auth
- First-use vault creation and master-password unlock
- Argon2id key derivation (64 MiB memory, 3 iterations, parallelism 1)
- Random 256-bit data-encryption key (DEK), wrapped by the derived key
- AES-256-GCM authenticated encryption with a fresh 96-bit nonce per encrypted item
- Context-bound additional authenticated data (AAD) for user and item identity
- Encrypted create, read, update, delete, and search workflows
- Password generation and clipboard copy
- Browser-tab hide auto-lock
- Supabase Postgres storage with per-user Row Level Security policies

The database receives ciphertext, nonce, KDF salt/parameters, wrapped DEK, record IDs, and operational timestamps. It does not receive the master password or plaintext vault fields through the implemented vault flow.

## Important limitations

- No independent cryptographic or penetration-test audit has been performed.
- No recovery key or master-password reset exists. Losing the master password means losing access to the vault.
- No browser extension, autofill, mobile app, desktop app, passkey login, device management, import/export, or conflict-resolution workflow.
- The current client is a web MVP. A malicious browser extension, injected script, compromised endpoint, or malicious client release can access an unlocked vault.
- The current KDF settings are fixed for version 1 and have not been benchmarked across low-end devices.
- Email redirect URLs must be configured in Supabase Auth for the deployed Vercel URL.

**Do not store real high-value secrets until the cryptographic design and implementation have received independent review.**

## Stack

- Next.js 15, React 19, TypeScript
- Supabase Auth and PostgreSQL
- Supabase Row Level Security
- Web Crypto API (AES-GCM and CSPRNG)
- hash-wasm (Argon2id)
- pnpm workspaces

## Local development

Use Node.js 24.x and pnpm 10.28.2. Then:

1. Copy `.env.example` to `.env.local`.
2. Add the Supabase project URL and publishable key.
3. Install and run:

```bash
pnpm install
pnpm dev
```

## Deployment

The GitHub repository is connected to Vercel. Pushes to `main` trigger production deployments. Configure these public environment variables in Vercel:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`

In Supabase Dashboard → Authentication → URL Configuration, set the Site URL to the production deployment URL and add the production and preview URLs you intend to use to the Redirect URLs allowlist.

## Security documentation

- [Architecture](docs/ARCHITECTURE.md)
- [Cryptographic design](docs/CRYPTOGRAPHY.md)
- [Threat model](docs/THREAT-MODEL.md)
- [Security reporting](SECURITY.md)

No production cryptographic implementation is approved merely because it compiles or passes a build.
