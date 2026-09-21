---
name: deploy-azure-cost-optimizer
description: "Use when planning or deploying the participant Azure Cost Optimizer foundation, model, immutable image, curated Container App, hosted smoke, reports, screenshot review, or optional prompt-agent and cleanup work."
---

# Deploy Azure Cost Optimizer Workshop

Follow only the participant's requested numbered README step. Read `.workshop/checkpoint.json` on resume, confirm exact approval boundaries, and stop after recording that step's evidence and next decision. This skill is a reference, not permission to execute Foundation through Cleanup in one turn. Plan/what-if, reads, ACR build, Apply and inference each retain their stated approval gates.

## Preconditions

- `npm run validate` passes.
- Subscription, tenant, authority, region, naming, owner, expiry and tags are recorded.
- Exact Azure reads/writes, roles, model spend, deployment, and optional cleanup have separate approvals.
- The global Azure CLI default remains unchanged.

## Foundation

Run `ops/workshop-infra.ps1 -Stage Plan`. Review `.workshop/infra-what-if.json`. Unexpected delete, replacement, role, region, resource, or spend change blocks apply. Apply uses Incremental mode.

The foundation creates the workshop-owned resource group, identity, ACR, Container Apps environment, Storage, Cosmos Serverless, Application Insights, Log Analytics and Foundry project. The model deployment remains a separate availability/cost decision.

## Policy Metadata

`SecurityControl` is optional organization policy metadata. Set a value only when the participant's subscription owner approves that exact value. It does not replace secure resource configuration or authorization.

## Model

Use current Microsoft Foundry workflows to check model capability, region, quota, SKU, capacity and price. Recommend a tool-capable structured-output model. Stop before model deployment and paid inference.

## Image

Use `ops/workshop-image.ps1`. ACR remote build avoids local Docker. Resolve the tag to an immutable digest and place only the digest in `.workshop/app.parameters.json`.

## Workshop Access

Apply the predefined access profile through the supplied deployment workflow. Do not ask participants to manually create an app registration, edit authentication settings, or assemble secret-bearing parameters. Keep all private material under ignored `.workshop/` state and never print it. Public-anonymous mode remains a separately approved, time-bounded exception and is never the default.

## Application

Run `ops/workshop-app.ps1 -Stage Plan`. Review the saved what-if, then Apply. Capture previous image digest and non-image configuration fingerprint before promotion.

## Bonus Channels

The curated web application is the Sprint 2 outcome. Only after it passes, optionally create:

- OpenAPI prompt agent over the bounded REST subset;
- MCP prompt agent over nine read-only tools.

The supplied Foundry script requires `-AllowAnonymousDemo`; authenticated agent tools require approved Foundry connections and are not silently synthesized.

## Smoke And Participant Evidence

Run `ops/workshop-smoke.ps1`. Model smoke requires inference approval. Validate periods, evidence, reports, write refusal, desktop/mobile fit, and no overflow. Have the participant generate PDF or XLSX and share a screenshot in Copilot Chat for visible-state review. MCP checks belong to the optional bonus.

## Pre-Demo

Run `ops/pre-demo.ps1` once with an approved export. It triggers one export, refreshes MTD evidence, prints the portal-comparison total and optionally runs ten model questions.

## Optional Cleanup

Run `ops/workshop-cleanup.ps1 -Stage Plan`. Apply requires the exact resource-group name and refuses groups missing workshop ownership tags. Shared resources outside the workshop group are never deleted.
