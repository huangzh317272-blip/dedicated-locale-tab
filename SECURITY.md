# Security Policy

## Supported versions

Security fixes are applied to the latest release on the `main` branch.

## Reporting a vulnerability

Please do not disclose suspected vulnerabilities in a public issue. Use the repository's **Security → Report a vulnerability** form to submit a private GitHub Security Advisory.

Include:

- the affected version;
- a concise description of the impact;
- reproducible steps or a minimal proof of concept;
- affected Chrome or Edge versions;
- any suggested remediation.

Reports will be acknowledged as soon as practical. No guaranteed response or remediation timeline is offered.

## Scope notes

This extension uses the powerful Chrome `debugger` permission. Security reports involving unexpected access outside the user-created controlled window, leakage of the real locale/timezone from a controlled context, remote-code execution, or unintended persistence are especially valuable.
