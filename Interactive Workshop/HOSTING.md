# Hosted Workshop

This deployment is separate from the Azure Cost Optimizer runtime and from the participant Test folder. GitHub Pages serves only the read-only public field guide. The dynamic tracker remains a same-origin Container App so sessions, CSRF, uploads and facilitator authorization are not weakened by cross-origin workarounds.

## Approved Shape

- Dedicated `rg-aco-workshop` resource group.
- Container Apps Consumption, one warm replica maximum, 0.5 vCPU / 1 GiB.
- Azure Table Storage for accounts, hashed sessions, revision-bound progress, moderation and kudos.
- Standard LRS private Blob container for screenshots; shared-key, public-blob and public-network access disabled.
- ACR Basic with admin credentials disabled; digest-pinned application image.
- Managed identity: AcrPull plus data access scoped to the `workshop` table and `screenshots` container.
- Log Analytics: 30-day retention, 1 GB/day ingestion quota. Quotas and credits are not a total spending cap.

The group and application services target East US 2. The Container Apps environment uses a delegated VNet subnet. Blob and Table use private endpoints and private DNS; Storage public network access remains disabled. The Container App itself retains public HTTPS ingress protected by Entra Easy Auth, workshop sessions and server-side roles.

## Provisioning Sequence

1. Resolve and explicitly select the subscription, owner, location and spend/role scope. Never change the global Azure CLI default.
2. Compile `infra/foundation.bicep` and `infra/application.bicep`. Generated ARM and parameter files belong outside source control under the parent's `.workshop/interactive-hosting/` directory.
3. Run and review a fresh what-if. Deployment uses Incremental mode. Never apply a failed, incomplete or stale plan.
4. Deploy the foundation. Read back actual SKU, encryption, authentication, container access, role scopes and region settings.
5. Build with `scripts/stage-image.mjs` into a fresh ignored directory. It copies an allowlist of app files and public guide assets, never `.workshop`, credentials, local SQLite or participant records. ACR builds this context using the supplied Dockerfile. Resolve the image to a digest.
6. Supply a randomly generated invite code through a protected deployment parameter/Container Apps secret. Never print it in agent output, publish it in GitHub, or place it in the frontend build. Share it with participants using an approved private channel.
7. Review application what-if and apply the exact approved digest/configuration. Verify HTTPS, readiness, private Table/Blob access, and denial of anonymous progress/admin/image access.
9. Verify participant save/reload, isolated accounts, upload/review/privacy, and durable state across a Container App restart. Use synthetic test records, never import the producer's private data automatically.

## Facilitator Ownership

Hosted setup is allowed once and only when Easy Auth injects the configured facilitator's Entra object ID. Table Storage atomically enforces one facilitator. The owner enters the private workshop passphrase in the browser; it is never placed in source, deployment parameters, chat or terminal command text. Participant requests cannot choose an administrator role, and `/api/admin/*` remains role-protected even when its route is guessed.

Participants can register only after that account exists, with the workshop invite code. Their role is always `participant`; request bodies cannot select administrator. Facilitator navigation is only visible to the signed-in administrator. The server authorization remains authoritative even when someone guesses `/facilitator` or `/api/admin/...`.

## Persistence And Backups

Container restarts and image updates do not move or erase the Table and Blob resources. Blob soft-delete retention is seven days; deleted screenshots can remain recoverable during that window. Table entities use ETags and same-partition transactions for account, progress, moderation and board changes. Complete an export/restore exercise before claiming recovery readiness.

Local SQLite remains supported when `WORKSHOP_STORAGE` is unset. Hosted mode explicitly requires `WORKSHOP_STORAGE=table`, Table and Blob endpoints, managed identity client ID, canonical HTTPS origin, secure cookies, owner object ID and invite code. There is no hosted fallback to ephemeral SQLite if Azure Storage is unavailable.

## GitHub Pages

Pages publishes a separate static artifact generated from the canonical README. It contains no API client, cookies, participant accounts, uploads, moderation, admin route, invite code or cloud credentials. The secure tracker URL is facilitator-provided when a hosted backend is approved and verified.

## Current Evidence

The resource group currently contains the managed identity, Log Analytics workspace and private Storage account. The Table/Blob runtime, VNet/private-endpoint foundation and Entra-protected application templates compile locally. The operator declined the required Entra app callback/credential update, so no Container Apps what-if/apply, ACR build, owner setup or live persistence test was performed. No participant data was imported. Partial resources are retained and may incur charges; cleanup needs an explicit decision.

Local tests cover the async persistence contract, authorization boundaries, Entra-owner bootstrap, single-facilitator invariant, existing participant journeys, the static Pages boundary and accessibility. They do not prove live Table/Blob private-network or managed-identity configuration. Actual what-if, deployment outputs, image digest, hosted smoke and restart evidence remain pending. A resource-group creation or successful local build is not hosted readiness or production certification.