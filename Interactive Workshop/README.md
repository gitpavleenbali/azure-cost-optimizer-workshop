# Interactive Workshop

A local-first companion to the [Azure Cost Optimizer workshop guide](../README.md). The original README remains the instructional source of truth. This application reads it at server startup; it does not rewrite the guide, execute workshop commands, invoke a model, or deploy Azure resources.

## Run Locally

Requirements: Node.js 24.18 or later in the Node 24 line, npm, and the complete parent workshop folder. Keep this directory beside the parent README and `docs/assets`; the companion is not a standalone copy of the instructional content.

From this directory:

```sh
npm ci
npm run build
npm start
```

Open `http://127.0.0.1:4310` to read the guide. Open `http://127.0.0.1:4310/facilitator` on the server computer once to create the facilitator name and passphrase. There are no seeded accounts, default passwords, sample participants, or fabricated completion results. Setup is loopback-only and permanently closes after the first administrator is created. Use a trusted workstation for initial setup.

Participants choose a display name and a separate workshop passphrase (at least 12 characters). A name alone is not authentication; do not reuse an organizational password. The facilitator can reset a participant passphrase after verifying the person outside the application. Resetting revokes that participant's existing sessions. There is no email recovery or enterprise SSO in this local release.

If the port is occupied, set `PORT` and a matching `WORKSHOP_ORIGIN` before starting. For example, in PowerShell:

```powershell
$env:PORT = '4312'
$env:WORKSHOP_ORIGIN = 'http://127.0.0.1:4312'
npm start
```

`npm run dev` watches the Node server. After frontend changes run `npm run build` and refresh the page. This deliberately serves the same built UI used in acceptance tests rather than a separate unauthenticated dev proxy.

## Participant Experience

- All README sections, 15 numbered steps, fenced prompts, references, architecture diagrams, screenshots, preparation guidance and optional bonus material are preserved.
- The guide opens at the README introduction. First-time participants start with the optional Solution Tour; returning participants continue at their next required step. Next/Previous follows the document order; section and subsection links, browser Back/Forward, and evidence/kudos URLs survive reload.
- The progress rail records each step as not started, complete, blocked or deferred. README task lists are independently checkable. Reading sections can also be marked complete.
- Step completion is self-reported, not a verified Azure deployment, financial-parity result, instructor approval, or permission to execute the copied prompt.
- Prompt copying, diagram expansion, image expansion, desktop/mobile navigation and light/dark themes are available. Original Markdown is downloadable.
- Progress and private facilitator notes survive refresh, sign-out and server restart. The participant can export or delete their account, progress and screenshots.
- Screenshot submission includes a preview, a sensitive-data acknowledgment and optional sharing consent. The facilitator reviews before a screenshot can appear on the kudos wall.
- The wall requires all 15 steps reported complete, sharing consent, screenshot approval and explicit facilitator board release. Blocked/deferred work remains visible privately to the facilitator, not falsely counted as complete. Kudos are unique per signed-in account and can be withdrawn; participants may applaud their own or another released result.

## Facilitator Dashboard

The protected dashboard shows the roster, 15-step maps, blockers, pending screenshot reviews and reported completions. It refreshes every 15 seconds and has search, status filters, CSV export, participant notes, screenshot approval/change requests and participant passphrase reset. In hosted mode, sign in at `/facilitator` and select **Show invite code** to retrieve the configured participant code from the role-protected API. Use **Copy invite code** and share it only through an approved private channel; it is never embedded in the browser bundle or public guide.

Screenshot approval means the facilitator reviewed what is visible. It does not certify hidden deployment state or security. Do not approve screenshots with sensitive billing/resource information. Uploaded metadata is stripped, but the app cannot automatically redact private text inside pixels.

## Persistence And Privacy

The local default database is outside the companion's source tree at:

```text
../.workshop/interactive-workshop/workshop.sqlite
```

SQLite stores accounts, salted scrypt password hashes, hashed session tokens, revision-bound progress, screenshot PNG bytes, moderation feedback, kudos and minimal audit events. Raw uploaded files are not written to disk. Uploads are restricted to static PNG/JPEG/WebP, 5 MB input, 16 million pixels, and 8 MB normalized output. The total screenshot-storage cap is 500 MB. Sessions expire after 12 hours.

Progress is tied to the README revision. Restarting with an edited README creates a new progress namespace; previous progress remains in the database but is not silently treated as completion of the revised guide. Finish a cohort before revising its guide. Keep the database and its matching guide revision together in backups.

For a consistent local backup, stop the server cleanly, copy the entire data directory to protected storage, then restart. Restore while the server is stopped, to an empty configured data directory; verify the expected facilitator, roster and guide revision before accepting participants. The database is not encrypted by this application. Use OS access controls, encrypted disks and protected backups. Define a retention period and delete the cohort data after the approved retention window. Never commit databases, user exports, raw uploads or credentials to Git.

## One Shared Workshop Versus Local Copies

Everyone must connect to the **same server URL** for a centralized roster and kudos wall. Each participant running their own local instance gets an independent database. Local instances do not automatically synchronize through GitHub.

GitHub Pages serves static files. It cannot run this Node API or a writable SQLite database. GitHub Actions can validate/build deployment artifacts, but runners, caches, artifacts, repository commits and Issues are not this application's live private data store.

The hosted implementation uses Azure Table Storage for records and private Blob storage for screenshots, selected explicitly with `WORKSHOP_STORAGE=table`. See [HOSTING.md](HOSTING.md) for the intended stack and remaining deployment boundary. There is no silent SQLite fallback in hosted mode. GitHub Pages contains a separate read-only field guide; it never receives account, progress, screenshot, moderation, session or facilitator code.

**Deployment status:** The passphrase-authenticated demo tracker is deployed to Azure Container Apps with private Table/Blob persistence, managed identity, HTTPS-only ingress and an immutable image digest. Live health and authorization-boundary checks pass, and one-time facilitator activation is complete. No local participant data was imported.

## Hosting Settings

| Variable | Default / purpose |
|---|---|
| `PORT` | `4310` |
| `WORKSHOP_HOST` | `127.0.0.1`; no LAN/public listener by default |
| `WORKSHOP_ORIGIN` | Exact scheme, host and port; defaults to `http://127.0.0.1:4310` |
| `WORKSHOP_DATA_DIR` | Optional absolute persistent data-directory path |
| `WORKSHOP_SECURE_COOKIES` | Set `true` for HTTPS hosting |
| `WORKSHOP_TRUST_PROXY` | Set `true` only behind one trusted reverse proxy that removes untrusted forwarded headers; do not expose the origin directly |
| `WORKSHOP_INVITE_CODE` | Optional for local use; required before non-loopback hosting; distribute outside source control |
| `WORKSHOP_STORAGE` | Unset for SQLite; `table` for Azure Table and Blob with no local fallback; `azure` retains the legacy SQL adapter only |
| `WORKSHOP_TABLE_ENDPOINT` / `WORKSHOP_TABLE_NAME` | Hosted Table endpoint and table name |
| `WORKSHOP_BLOB_ENDPOINT` | Private screenshot account endpoint, accessed by identity |
| `WORKSHOP_SETUP_CODE` | Random 32+ character one-time hosted facilitator bootstrap secret; never expose it in the public UI or source control |
| `AZURE_CLIENT_ID` | Hosted user-assigned managed identity client ID, not a credential |

Non-loopback startup requires the canonical HTTPS origin, secure cookies and an invite code. SQLite hosting also requires completed local facilitator setup. Hosted setup requires the protected setup code, is relayed through the loopback-only owner helper and permanently closes after the first facilitator is created. Managed identity protects Table/Blob access; workshop passphrases and server-side roles protect participant and facilitator functions. These checks do not by themselves provision or certify the hosted service.

## Validation

```sh
npm test
npm run lint
npm run build
npm run test:browser
npm run build:pages
npm run test:pages
npm audit
```

For a machine without Playwright's browser, run `npx playwright install chromium` once. Linux CI can use `npx playwright install --with-deps chromium`.

Tests use disposable databases and fixture accounts, not the facilitator's real data. API tests cover roles, origin/CSRF checks, cross-account isolation, stale revision refusal, image decoding, consent, moderation, session revocation, deletion, restart persistence and every local README reference. Browser tests traverse every section in README order and compare every displayed prompt exactly. They also cover desktop/mobile navigation, subsection links, Back/Forward, mobile keyboard focus, copy, diagrams/assets, persisted checklists, upload/review failures and retry, kudos, and expired sessions, with WCAG scans for the guide and dashboard. Screenshots and failure artifacts go under the parent's ignored `.workshop/` directory.

The parent validation workflow for the ACO product is separate. The companion validation workflow performs checks only, without cloud credentials or deployment. The existing product ZIP is not automatically promoted by companion builds. Include this folder, the matching parent README and referenced assets in a separately reviewed distribution when ready.

## Release Boundary

This is a functional, locally validated participant/facilitator application, not production certification. Before public use, complete deployment-specific review for HTTPS/proxy configuration, SSO or approved account policy, rate limiting under expected load, backup restoration, retention/consent policy, monitoring, accessibility with assistive technology and private screenshot handling. No promises of HA, DR, compliance or automatic verification of workshop achievements are implied.