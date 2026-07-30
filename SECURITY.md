# Security Policy

## Supported Versions

Only the latest version on the default branch is supported with security updates.

## Reporting a Vulnerability

Please do not open public issues for security vulnerabilities.

Instead, report privately to the maintainers with:

- A clear description of the issue and impact
- Reproduction steps (or a proof of concept)
- Affected versions / commit hash
- Any suggested fix (optional)

We will acknowledge receipt and work on a fix as soon as possible.

## Security Boundaries

- The renderer process must not execute arbitrary commands.
- File read/write operations must be user-initiated via explicit UI flows.
- IPC surface area should remain minimal and whitelisted via preload.
