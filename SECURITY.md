# Security policy

## Current status
FurtuuStore is in early development. It has not undergone an independent security audit. Do not use it to store real credentials.

## Reporting
Do not publish exploit details, credentials, personal data, or proof-of-concept payloads in public issues. A private vulnerability reporting channel must be configured before public beta. Until then, report only non-sensitive project concerns in public issues.

## Security invariants
- Master passwords and plaintext vault fields never leave the client.
- The server stores only authenticated ciphertext and minimum sync metadata.
- No service-role secret is shipped to a client.
- No recovery backdoor or operator decryption key exists.
- Cryptographic formats and parameters are versioned.
- Authentication, authorization, and encryption are separate controls.

## Release gate
Production use requires external cryptographic review, penetration testing, dependency review, secure update design, backup/recovery testing, and a documented incident response process.
