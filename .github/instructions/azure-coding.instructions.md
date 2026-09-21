---
description: "Azure SDK and infrastructure rules for the lightweight Azure Cost Optimizer implementation and hosted demo profile"
applyTo: "{src,infra,ops}/**/*.{cs,bicep,json,yaml,yml}"
---

# Azure Implementation Rules

- Use Azure SDK clients or structured REST adapters with explicit API versions; never scrape portal pages.
- Use `DefaultAzureCredential` in hosted code and an explicit CLI credential only for local development.
- Verify the selected subscription tenant before data access; do not change global Azure CLI defaults.
- Use managed identity and least-privilege read roles for hosted service calls.
- Set deadlines, cancellation, bounded pagination, byte limits, and redacted errors on every provider adapter.
- Honor `Retry-After`; use bounded jittered retries only for safe idempotent reads.
- Never automatically retry report-generation POST operations.
- Use Bicep for hosted infrastructure and incremental deployment only.
- Run Bicep build, Azure what-if, health smoke, and cleanup-boundary checks before deployment claims.
- Public Azure Cost Optimizer financial endpoints require TLS and Microsoft Entra authentication. The separately approved demo tracker may expose only its join/sign-in surface over TLS and must retain invite-code registration, passphrase sessions, request limits, origin/CSRF checks, and server-side role authorization.
- Keep private endpoints, WAF, zone redundancy, and enterprise policy as assessed extensions rather than baseline workshop dependencies.
- Emit structured OpenTelemetry traces without cost rows, tokens, report contents, or full prompts.
