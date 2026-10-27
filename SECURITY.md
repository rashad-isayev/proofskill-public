# Security

This is experimental source code for isolated local evaluation. No hosted deployment, production credentials, live database or real candidate data is included. Do not use it for automatic hiring decisions.

## Security controls

- HR access and candidate invitation ownership are checked on the server. Candidate responses use explicit safe projections.
- Private AI analysis is separated from public reply generation. Provider calls require durable, global and scoped budgets with concurrency limits.
- JSON requests are bounded while streaming. Spreadsheet imports cap compressed size, actual expanded size, entry count, rows and columns before processing.
- Responses include anti-framing, MIME-sniffing, referrer and browser-permission restrictions. Invitation responses discourage caching and indexing.
- Authentication requires a separately supplied secret and database. Hosted production authentication requires HTTPS.
- Local servers bind to loopback by default. Hosted Git deployment is disabled and the configured hosted build fails deliberately.

These controls reduce specific risks; they do not establish the absence of vulnerabilities. Unknown dependency issues, custom prompt attacks, provider behavior and physical-device/browser limitations remain possible. Review and test a future deployment independently.

## Handling credentials and data

Use new, dedicated credentials for any local experiment. Never commit environment files, invitation URLs, authentication sessions, recordings, transcripts or database exports. Blank settings are provided in `.env.example`; private local configuration is ignored by Git. Test identities, passwords and tokens are fictional and must not be reused as real credentials.

Keep recording disabled unless you separately establish consent, retention and private storage requirements. The included filesystem recording adapter is restricted to local development.

## Reporting a vulnerability

Use this repository's **Security → Advisories → Report a vulnerability** feature for a private report when available. Do not post credentials, personal records or a working sensitive invitation in a public issue. If a credential is exposed, revoke it with its provider; deleting a file alone does not revoke access or erase copies.
