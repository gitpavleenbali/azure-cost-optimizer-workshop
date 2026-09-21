# Hosted Demo Infrastructure

The reference Bicep describes an optional, time-bounded hosted demonstration. It is not required for local snapshot or local Foundry Toolkit use.

The default region is `eastus2`. Before deployment, verify current Foundry model capacity and quota plus Cosmos DB Serverless and Container Apps availability. If a required capability is unavailable, try `eastus`, `centralus`, and `westus3` automatically in that order.

## Resources

- One user-assigned managed identity
- One Log Analytics workspace with 30-day retention
- Workspace-based Application Insights with local authentication disabled
- One Storage account and private `cost-data` container for raw FOCUS/Parquet data, receipts, and report files
- One Cosmos DB for NoSQL Serverless account with `cost-intelligence` database
- One `intelligence` container partitioned by `/scopePartition`
- One `conversations` container partitioned by `/principalPartition` with seven-day TTL
- One Container Apps managed environment
- One Container App with public TLS ingress, the predefined workshop access profile, health probes, minimum zero and maximum one replicas

The application image, access profile, analysis subscription, Foundry endpoint, and model deployment are parameters. No credentials are accepted by Bicep.

Participants do not configure identity resources manually. ACO Workshop Builder applies the supplied access workflow, keeps private values under ignored workshop state, includes the effective access boundary in application what-if, and stops before its Azure write. `ops/workshop-auth.ps1` is a Builder-owned implementation detail, not a participant step.

## Important Boundary

This Bicep grants the app identity Blob Data Contributor only at its `cost-data` container and Cosmos DB Built-in Data Contributor only at the `cost-intelligence` database. Cost Management, Reader, Advisor, Monitor, and Foundry roles apply to deployment-specific scopes and require separate review. Do not encode broad subscription role assignments into a reusable workshop template.

Cosmos uses Serverless capacity and Session consistency for intermittent demo traffic. Key authentication is disabled. Raw detailed cost rows stay in Blob; Cosmos stores bounded hot documents with decimal amounts serialized as strings.

## Required Validation

1. Build Bicep with no errors.
2. Pin the image by digest.
3. Review all parameter values without printing secrets.
4. Run Azure what-if against the explicit subscription and resource group.
5. Review creates, modifications, deletions, and ignores.
6. Confirm the predefined workshop access profile and public TLS ingress are intended.
7. Confirm numeric spend envelopes, expiry, retention, and approved stages.
8. Apply incrementally only after explicit approval.
9. Run auth, health, snapshot, report, and one bounded Foundry smoke check.
10. Keep optional cleanup limited to explicitly confirmed workshop-owned resources.

Private networking, WAF, zone redundancy, geo-replication, and enterprise policy are extensions selected after target assessment.
