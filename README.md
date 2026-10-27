# ProofSkill

ProofSkill is an experimental workplace-assessment application built with Next.js, React, TypeScript and PostgreSQL. HR users prepare assessment blueprints and invite candidates to fictional workplace simulations. Reports present advisory evidence for independent human review; they do not make hiring decisions or provide scientific certification.

This repository is a cleaned source snapshot with fresh history. It includes no hosted service, database, provider access, real candidate records or credentials. Hosted deployment is intentionally disabled. Development instructions and tests below are for isolated local use.

## Requirements

- Node.js 24 and npm.
- Docker Compose for an optional dedicated local PostgreSQL database.
- A separately supplied provider key and model only for the optional integrated AI workflow.

## Inspect the interface without credentials

```sh
npm ci
npm run build
npm run preview:frontend
```

Open `http://localhost:3201/enterprise`. This read-only preview uses clearly labeled fictional fixtures. It does not require a database, authenticate users, persist submissions or call an AI provider.

## Optional isolated local development

```sh
cp .env.example .env.local
```

Keep `.env.local` private. Set a newly generated local database password, use that same value in the localhost database URL, and generate a separate authentication secret with `openssl rand -hex 32`:

```env
PROOFSKILL_AUTH_DB_PASSWORD=<new-local-password>
AUTH_DATABASE_URL=postgresql://proofskill_auth:<url-encoded-local-password>@127.0.0.1:55432/proofskill_auth
BETTER_AUTH_URL=http://127.0.0.1:3000
BETTER_AUTH_SECRET=<new-random-secret-at-least-32-characters>
OPENAI_API_KEY=<your-dedicated-provider-key>
OPENAI_MODEL=<a-model-available-to-your-account>
OPENAI_BASE_URL=https://api.openai.com/v1
RECORDING_ENABLED=false
```

The angle-bracket values are placeholders. Do not reuse credentials or databases from another project. The provider is called from the server; never give secret settings a `NEXT_PUBLIC_` prefix. Optional `APP_DATABASE_URL` defaults to `AUTH_DATABASE_URL`.

```sh
docker compose --env-file .env.local -f compose.auth.yaml up -d --wait
npm run auth:migrate
npm run account:migrate
npm run hiring:migrate
npm run dev
```

Open `http://127.0.0.1:3000/auth/sign-up` to create a local HR account. Create and publish an assessment, add a fictional candidate, assign the assessment and open its private invitation in another browser context. Generation and adaptive replies require your configured provider. Provider failures are shown and saved drafts are preserved. Local application servers and Docker's database port bind to loopback by default.

## Checks

```sh
npm run lint
npm run build
npm run typecheck
npm run test:unit
npm run test:request-limits
npm run test:b2b
```

The frontend browser checks use fictional fixtures and require Playwright Chromium (`npx playwright install chromium`). They do not need provider credentials or a database.

Backend checks require a dedicated, migrated, disposable local database and a newly generated authentication secret. Never point them at production or shared data:

```sh
npm run test:hiring:database
npm run test:hiring:browser
```

The hiring browser suite runs its own local mock provider. Fixture passwords and invitation values in tests are synthetic examples, not access to a service.

## Security and limitations

See [SECURITY.md](SECURITY.md). Source controls include server authorization, bounded request parsing, candidate-safe projections, isolated private/public AI calls, durable AI-call budgets, spreadsheet expansion limits and response security headers. The AI-budget tables are part of `hiring:migrate`; missing protection storage prevents provider calls.

Browser monitoring cannot lock an operating system or prove a physical capture state. Candidate consent and policy readiness are enforced at server boundaries, but client acknowledgments are not physical-device attestation. Local recording remains disabled by default; its development storage adapter refuses hosted production use. No retention policy or hosted recording service is supplied.

Published assessment policies and invitation tokens govern candidate access. Treat invitation URLs as private bearer credentials. Reports and candidate records require authorized HR access. Do not enter real personal data into a demonstration instance.

`vercel.json` disables automatic Git deployments and invokes a build guard that refuses hosted builds. This source release is not a deployment approval or a guarantee that the application is free of vulnerabilities. Future hosting needs a separate security/configuration review, dedicated credentials and data, HTTPS, storage/retention decisions and real-device/provider validation.
