# FurtuuStore

**Your keys. Your privacy. Your control.**

FurtuuStore is a security-first, zero-knowledge password manager in development. The project is being built around client-side encryption, explicit key ownership, encrypted synchronization, and transparent security boundaries.

> **Security status: early development. Do not store real passwords, recovery codes, API keys, or other sensitive secrets in this project yet.** The repository foundation is not a production-ready password manager, and no independent security audit has been performed.

## Product principles

- **Client-side encryption:** plaintext vault data must be encrypted before it leaves a trusted client.
- **No server-side master password:** the master password must never be sent to the API, database, telemetry, or logs.
- **No recovery backdoor:** recovery must rely on user-controlled recovery material.
- **Authenticated encryption:** tampering must cause decryption to fail.
- **Least privilege:** database access is user-scoped and enforced with Row Level Security.
- **Honest security claims:** zero-knowledge architecture reduces server-side exposure; it does not protect an unlocked, compromised device or malicious client update.

## Planned capabilities

1. Encrypted password and secure-note storage
2. Master-password-based vault unlock
3. Cryptographically secure password generation
4. Encrypted multi-device synchronization
5. User-controlled recovery key
6. Device and session management
7. Browser extension, desktop, and mobile clients

## Architecture direction

- Web: Next.js, React, TypeScript
- Monorepo: pnpm workspaces
- Backend: Supabase Auth and PostgreSQL
- Cryptography: Argon2id key derivation and AES-256-GCM authenticated encryption
- Validation: Zod
- Testing: Vitest and security-focused test vectors

Cryptographic formats and parameters will be versioned. Parameters must be benchmarked on supported devices and reviewed before production. FurtuuStore will use established cryptographic libraries and platform CSPRNGs; it will not implement custom cryptographic primitives.

## Development status

See [ROADMAP.md](docs/ROADMAP.md), [ARCHITECTURE.md](docs/ARCHITECTURE.md), and [THREAT-MODEL.md](docs/THREAT-MODEL.md).

## Local development

The initial scaffold is being added incrementally. Once the web workspace is available:

```bash
pnpm install
pnpm dev
```

## Security

Please do not report exploitable vulnerabilities in public issues. Until a private security contact is configured, avoid submitting sensitive vulnerability details. See [SECURITY.md](SECURITY.md).

## License

License selection is pending. No license is granted by this repository at this stage.
