# Security Policy

## Supported versions

Outbound is pre-release software. Maintainers apply security fixes to the
latest release and the `main` branch. Older releases receive no security
updates.

## Reporting a vulnerability

Please do not open a public issue or discussion for a suspected vulnerability.

Use GitHub's private vulnerability reporting for this repository:

https://github.com/PhilipN27/Outbound/security/advisories/new

If private reporting is unavailable, email `pan97g@gmail.com` with the subject
`Outbound security report`. Do not include real credentials, private session
transcripts, or other sensitive personal data. Use synthetic or redacted
examples wherever possible.

Please include:

- A description of the issue and its potential impact
- The affected version or commit
- Reproduction steps or a minimal proof of concept
- Any suggested mitigation, if known

You can expect an acknowledgement within 72 hours. Please allow time for a fix
before you disclose the issue.

## Scope

We prioritize reports about credential exposure, unsafe file handling, path
traversal, command execution, malicious transcript input, or sensitive data in
generated reports.

Test only accounts, files, and data you own or have permission to use. Do not
access other people's data, disrupt services, or perform destructive testing.
