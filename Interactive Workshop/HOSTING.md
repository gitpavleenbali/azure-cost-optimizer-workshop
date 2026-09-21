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

The group and application services target East US 2. The Container Apps environment uses a delegated VNet subnet. Blob and Table use private endpoints and private DNS; Storage public network access remains disabled. The Container App exposes only the tracker join/sign-in surface over public HTTPS. Invite-code registration, passphrase sessions, exact-origin and CSRF checks, request limits and server-side roles protect progress, evidence, moderation and facilitator operations. Azure Cost Optimizer financial APIs are not exposed by this tracker.

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

Hosted setup requires a random 32+ character bootstrap code stored only in ignored deployment state and a Container App secret. The loopback-only owner helper reads that code server-side; it never sends the code to the local browser. The owner enters the private workshop passphrase in the browser, and the helper relays it directly to the hosted setup endpoint without writing it to disk or terminal output. Table Storage atomically enforces one facilitator, after which setup permanently closes. Participant requests cannot choose an administrator role, and `/api/admin/*` remains role-protected even when its route is guessed.

Participants can register only after that account exists, with the workshop invite code. Their role is always `participant`; request bodies cannot select administrator. Facilitator navigation is only visible to the signed-in administrator. The server authorization remains authoritative even when someone guesses `/facilitator` or `/api/admin/...`.

## Persistence And Backups

Container restarts and image updates do not move or erase the Table and Blob resources. Blob soft-delete retention is seven days; deleted screenshots can remain recoverable during that window. Table entities use ETags and same-partition transactions for account, progress, moderation and board changes. Complete an export/restore exercise before claiming recovery readiness.

Local SQLite remains supported when `WORKSHOP_STORAGE` is unset. Hosted mode explicitly requires `WORKSHOP_STORAGE=table`, Table and Blob endpoints, managed identity client ID, canonical HTTPS origin, secure cookies, setup code and invite code. There is no hosted fallback to ephemeral SQLite if Azure Storage is unavailable.

## GitHub Pages

Pages publishes a separate static artifact generated from the canonical README. It contains no API client, cookies, participant accounts, uploads, moderation, admin route, invite code or cloud credentials. The secure tracker URL is facilitator-provided when a hosted backend is approved and verified.

## Current Evidence

The resource group contains the managed identity, Log Analytics workspace, ACR, VNet-integrated Container Apps environment, private Blob/Table endpoints and the running tracker Container App. Foundation and application what-if reviews had no deletes; the application plan created only the app and disabled auth-config resource. The app uses an immutable ACR digest, one warm Consumption replica, HTTPS-only ingress and private Table/Blob persistence. Live shell, liveness, readiness and unauthorized progress/admin/image checks pass. No local participant data was imported.

Local tests cover the async persistence contract, authorization boundaries, protected one-time bootstrap, single-facilitator invariant, existing participant journeys, the static Pages boundary and accessibility. Live evidence now proves private Table/Blob readiness through managed identity and the public sign-in/join surface on desktop and mobile. Facilitator activation, participant registration, screenshot moderation and post-restart persistence remain pending until the owner enters a private passphrase through the loopback helper. This workshop demo is not production certification.