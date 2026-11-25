# Cryptographic design requirements

This document records design constraints, not an assertion that implementation has been audited.

## Algorithms
- Password-based key derivation: Argon2id using a maintained implementation.
- Data encryption: AES-256-GCM using platform cryptographic APIs or a vetted library.
- Randomness: operating-system cryptographically secure random number generator.
- No custom cipher, KDF, random generator, or home-grown encoding.

## Key management
- Generate a random 256-bit DEK.
- Derive a KEK from the master password using Argon2id and a unique random salt.
- Wrap the DEK with authenticated encryption, a distinct nonce, and context-bound AAD.
- Store KDF identifier, parameters, salt, algorithm version, nonce, and wrapped DEK as a versioned envelope.
- Keep raw keys in memory only while needed; clear references promptly, recognizing JavaScript cannot guarantee secure memory erasure.
- Recovery material must be high entropy, shown once, and stored separately by the user. Never create a server-side recovery bypass.

## Nonce and AAD
AES-GCM requires nonce uniqueness for each key. Generate a fresh 96-bit nonce for every encryption and never reuse a nonce with the same key. Bind vault ID, record ID, record type, and envelope version as AAD. Authentication failure must fail closed.

## Parameters and interoperability
Argon2id parameters must be benchmarked on low-end supported devices and versioned for future upgrades. Cross-platform test vectors are required before enabling sync. Never silently downgrade cryptographic parameters.

## Release blockers
Independent cryptographic review, misuse-resistant API design, test vectors, malformed-input testing, and documented key lifecycle review are mandatory before production.
