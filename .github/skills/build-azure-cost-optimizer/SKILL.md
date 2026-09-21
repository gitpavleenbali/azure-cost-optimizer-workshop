---
name: build-azure-cost-optimizer
description: "Use when starting or continuing the Azure Cost Optimizer participant workshop: select a track, verify prerequisites, configure subscription/provider/model choices, run locally, and prepare deployment inputs."
---

# Build Azure Cost Optimizer Workshop

## Purpose

Guide one participant from a clean workstation to a validated local Azure Cost Optimizer. Use the complete supplied v99 source; do not scaffold a second app or redesign the frontend.

## Read First

1. `README.md`
2. `spec/workshop-delivery-contract.v1.json`
3. `spec/runtime-contract.v1.json`
4. `config/guardrails.json`

## Decision Interview

Follow the requested single numbered README step and stop at its checkpoint. Start a new workshop with Step 1 preparation and Step 2 sample before any Azure decision interview. Ask these questions one at a time only when their README step needs them:

- Explicit subscription and tenant
- Authority: read-only, grant authority, or unsure
- Region, prefix, resource group, owner, expiry
- Query, Cost Details, or Exports
- Cost-only, existing provider, or approved model creation
- Organization-required policy tags
- Spend/inference bounds

Record decisions under `.workshop/`; never commit them. Persist the current step/status, evidence references, blockers and next proposed step in `.workshop/checkpoint.json`. Do not infer new approval or automatic advancement from a saved checkpoint.

## Local Sample

```powershell
.\ops\doctor.ps1 -Track Local
npm run setup
npm run validate
.\ops\start-workshop.ps1 -Mode Sample -Port 8080
```

Expected: sample label, working reports/visuals, zero provider/model calls.

## Live-Local

Run the Azure doctor and CheckOnly first. Pass the selected subscription explicitly. Do not change the Azure CLI default.

```powershell
.\ops\start-workshop.ps1 -Mode Live -SubscriptionId <id> -Provider None -CheckOnly
```

Start cost-only before model activation. Collection remains explicit. Query gets one attempt; Cost Details is a separately selected alternative and is never automatic fallback.

## Provider Selection

- Prefer Microsoft Foundry through Azure identity.
- Azure OpenAI identity or protected API key are supported alternatives.
- Owner does not prove model data-plane access.
- Model creation requires current capacity/region/SKU guidance, cost bounds, expiry and approval.
- Never pass API keys through chat or command arguments.

## Financial Acceptance

Compare the app with Cost Management using identical subscription, dates, Actual cost basis, currency, and collection time. Keep parity pending until explained. Advisor values are estimates and can overlap.

## Completion

Report track, masked scope, evidence provenance, parity, provider/model status, local URL, validation results, blockers, and next decision. Do not call sample, stale, cost-only, or parity-pending states full live success.
