# Roadmap

## Phase 0 — Foundation
- [x] Project identity and security principles
- [x] Architecture, cryptography, and threat-model documentation
- [ ] CI, linting, and test infrastructure
- [ ] Initial web workspace

## Phase 1 — Local vault MVP
- [ ] Account sign-in and registration
- [ ] Master password setup and unlock, independent of account password
- [ ] Argon2id KEK derivation and random DEK wrapping
- [ ] AES-GCM encrypted password entries and secure notes
- [ ] Secure password generator
- [ ] Lock timeout and explicit lock action
- [ ] Recovery key and recovery envelope

## Phase 2 — Encrypted synchronization
- [ ] Supabase schema and strict RLS
- [ ] Ciphertext-only sync API
- [ ] Conflict handling and offline resilience
- [ ] Device registration and revocation

## Phase 3 — Security hardening
- [ ] CSP, dependency and secret scanning
- [ ] Abuse-case and cross-tenant tests
- [ ] Privacy-preserving breach checking
- [ ] External cryptographic review and penetration test
- [ ] Incident response and vulnerability disclosure process

## Phase 4 — Cross-platform
- [ ] Browser extension and autofill
- [ ] Desktop client
- [ ] Mobile client
- [ ] Cross-platform crypto test vectors

No phase is complete until its acceptance criteria and tests are met.
