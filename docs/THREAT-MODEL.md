# Threat model

## Assets
Passwords, secure notes, recovery codes, attachments, master password, derived keys, DEK, recovery secret, account identity, device sessions, and encrypted metadata.

## Adversaries
Database snapshot thief, network attacker, malicious authenticated account, cross-tenant attacker, malicious extension or injected script, compromised endpoint, and software supply-chain attacker.

## Security objectives
- A database-only attacker cannot decrypt vault contents.
- Ciphertext modification is detected by authenticated encryption.
- One user cannot read or mutate another user's records.
- The master password is never transmitted or logged.
- Recovery is user-controlled and has no operator bypass.
- Revoked devices cannot obtain future sync access.

## Residual risk
A compromised unlocked device, keylogger, malicious extension, coercion, weak master password, malicious client release, or memory disclosure can defeat endpoint-side protections. Zero-knowledge does not mean invulnerable.

## Required controls
- Argon2id with calibrated, versioned parameters and unique salts
- AES-256-GCM with strict nonce uniqueness per key
- AAD binding to record identity and format version
- Strict CSP, output escaping, dependency pinning, and secret scanning
- Supabase RLS on every user-owned table
- Rate limiting, session/device revocation, and re-authentication for sensitive actions
- No plaintext telemetry, analytics, crash reports, or logs
- External security review and penetration testing before production

## Abuse cases
1. Alter ciphertext, nonce, tag, or AAD: decryption must fail.
2. Swap ciphertext between records: context binding must fail.
3. Attempt cross-user reads and writes: RLS must deny them.
4. Submit malformed or oversized envelopes: validation must reject them.
5. Revoke a device: subsequent access must be denied.
6. Interrupt sync: no silent overwrite or partial plaintext persistence.
