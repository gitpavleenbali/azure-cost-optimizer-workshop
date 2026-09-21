import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const assets = path.join(root, 'docs/assets')
const escapeXml = (value) => value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('"', '&quot;')
const text = (x, y, value, size = 16, weight = 400, color = '#182d40') => `<text x="${x}" y="${y}" font-size="${size}" font-weight="${weight}" fill="${color}">${escapeXml(value)}</text>`
const icon = (name, x, y, size = 52) => `<image x="${x}" y="${y}" width="${size}" height="${size}" preserveAspectRatio="xMidYMid meet" href="data:image/svg+xml;base64,${fs.readFileSync(path.join(assets, 'azure-icons', name + '.svg')).toString('base64')}"/>`
function node(x, y, width, name, title, lines, link) {
  return `<a href="${link}" target="_blank"><g data-node="${escapeXml(title)}"><rect x="${x}" y="${y}" width="${width}" height="100" rx="4" fill="#ffffff" stroke="#6a8092"/>${icon(name, x + 18, y + 24)}${text(x + 85, y + 33, title, 18, 650)}${lines.map((line, index) => text(x + 85, y + 58 + index * 20, line, 14)).join('')}</g></a>`
}
const flowColors = { request: '#005b96', inference: '#6348a0', persistence: '#935700', telemetry: '#006b57', support: '#34495e' }
const connector = (points, dashed = false, kind = 'request') => `<path data-flow="${kind}" d="${points}" fill="none" stroke="${flowColors[kind]}" stroke-width="2.5" ${dashed ? 'stroke-dasharray="7 5"' : ''} marker-end="url(#arrow-${kind})"/>`
const badge = (x, y, number, kind) => `<g><circle cx="${x}" cy="${y}" r="13" fill="${flowColors[kind]}" stroke="#ffffff" stroke-width="2"/><text x="${x}" y="${y + 5}" text-anchor="middle" fill="#ffffff" font-size="14" font-weight="700">${number}</text></g>`
const label = (x, y, title, width) => `<rect x="${x - 6}" y="${y - 18}" width="${width}" height="25" rx="2" fill="#ffffff"/>${text(x, y, title, 14, 600, '#111111')}`
const panel = (x, y, width, height, title, caption, fill = '#f6f9fc', dashed = false) => `<rect x="${x}" y="${y}" width="${width}" height="${height}" rx="6" fill="${fill}" stroke="#718899" stroke-width="1.5" ${dashed ? 'stroke-dasharray="7 5"' : ''}/>${text(x + 20, y + 30, title, 19, 700)}${text(x + 20, y + 53, caption, 14)}`
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1560" height="1350" viewBox="0 0 1560 1350" role="img" aria-labelledby="title description">
<title id="title">Azure Cost Optimizer: application, evidence and Microsoft Foundry</title>
<desc id="description">Official embedded Azure icons. Container Apps hosts the self-hosted Agent ACO and eight read-only tools. Foundry hosts the model. Dashed paths show optional MCP prompt agents, evaluation, trace, and governance integrations; these are not claimed as configured. Managed identity and application authorization guard the workload. No private network or production certification is implied.</desc>
<defs>${Object.entries(flowColors).map(([kind, color]) => `<marker id="arrow-${kind}" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0L10 5L0 10Z" fill="${color}"/></marker>`).join('')}</defs>
<g font-family="Segoe UI, sans-serif" letter-spacing="0">
<rect width="1560" height="1350" fill="#ffffff"/>
${text(36, 43, 'Azure Cost Optimizer', 30, 700)}
${text(36, 72, 'One curated application. One financial engine. Microsoft Foundry for models and optional agent lifecycle integrations.', 17)}
<rect x="420" y="102" width="620" height="70" rx="4" fill="#eef5fb" stroke="#637c91"/>
${text(442, 131, 'EXPERIENCE', 13, 700)}${text(442, 156, 'React workspace  /  grounded answers  /  charts  /  PDF and Excel', 18, 600)}
${connector('M730 172V234')}${badge(704, 204, 1, 'request')}${label(748, 204, 'HTTPS + checked SSE', 171)}

${panel(36, 234, 314, 530, 'Azure evidence sources', 'Collection uses the approved source/cadence')}
${node(54, 310, 278, 'cost-management', 'Cost Management', ['Query / Details OR exports', 'Observed billed cost'], 'https://learn.microsoft.com/azure/cost-management-billing/costs/')}
${node(54, 422, 278, 'storage-account', 'Source Blob', ['cost-exports / billing CSV', 'Written by export schedule'], 'https://learn.microsoft.com/azure/cost-management-billing/costs/tutorial-export-acm-data')}
${node(54, 534, 278, 'advisor', 'Azure Advisor', ['Separate bounded API read', 'Estimates can overlap'], 'https://learn.microsoft.com/azure/advisor/')}
${node(54, 646, 278, 'resource-graph-explorer', 'Resource Graph', ['Separate inventory API read', 'Not utilization evidence'], 'https://learn.microsoft.com/azure/governance/resource-graph/')}
${connector('M192 410V422')}

${panel(420, 234, 620, 494, 'Application runtime', 'Container Apps environment; one ASP.NET Core process', '#f4faf7')}
${node(446, 316, 568, 'container-app', 'Azure Container Apps', ['React static assets + ASP.NET Core API', 'Agent ACO runs here using Microsoft Agent Framework'], 'https://learn.microsoft.com/azure/container-apps/')}
<rect x="446" y="446" width="568" height="96" rx="4" fill="#ffffff" stroke="#789186"/>
${text(466, 475, 'Typed read-only tools', 19, 700)}
${text(466, 500, '8 in-process tools  |  scope + principal + report binding', 16)}
${text(466, 523, 'Optional /mcp transport: the same tools + describe_data_sources', 15)}
<rect x="446" y="572" width="568" height="116" rx="4" fill="#ffffff" stroke="#789186"/>
${text(466, 602, 'Azure Cost Intelligence - ACO engine', 19, 700)}
${text(466, 627, 'Exact decimal normalization, cost totals and source receipts', 16)}
${text(466, 651, 'Advisor interpretation, evidence validity and report generation', 16)}
${text(466, 674, 'The language model never owns authoritative financial totals.', 14)}

${panel(1108, 234, 416, 494, '', '', '#f4f7fc')}
${icon('microsoft-foundry', 1128, 247, 38)}${text(1180, 268, 'Microsoft Foundry', 19, 700)}${text(1180, 291, 'Project and model deployment', 14)}
${node(1128, 316, 376, 'foundry-models', 'Foundry Models', ['Hosts the deployed language model', 'Bounded inference over minimized evidence'], 'https://learn.microsoft.com/azure/foundry/foundry-models/')}
${panel(1128, 446, 376, 258, 'Optional agent lifecycle', 'Configure and verify separately', '#ffffff', true)}
${icon('foundry-agent', 1148, 525, 44)}${text(1208, 544, 'Prompt agents via MCP / OpenAPI', 15, 650)}${text(1208, 567, 'Authenticated connection to the ACO tools', 13)}
${icon('application-insights', 1148, 583, 44)}${text(1208, 602, 'Evaluation + tracing', 16, 650)}${text(1208, 625, 'Datasets, evaluator runs, exported spans', 13)}
${icon('foundry-control-plane', 1148, 641, 44)}${text(1208, 661, 'Governance', 16, 650)}${text(1208, 684, 'RBAC, versioning, policies and oversight', 13)}

${connector('M420 298H372V360H332')}
${badge(391, 300, 2, 'request')}
${connector('M372 360V472H332')}${connector('M372 472V584H332')}${connector('M372 584V696H332')}
${connector('M1014 358H1128', false, 'inference')}${badge(1072, 382, 3, 'inference')}${label(1005, 305, 'Inference', 87)}
${connector('M1128 492H1014', true, 'inference')}${label(1020, 478, 'Tools', 58)}
${connector('M730 416V446')}${connector('M730 542V572')}

${panel(420, 782, 620, 186, 'Normalized evidence persistence', 'Restore to memory; generate PDF/XLSX from the cached revision')}
${node(440, 850, 282, 'storage-account', 'Snapshot Blob', ['Normalized JSON + receipts', 'Hash-verified before pointer'], 'https://learn.microsoft.com/azure/storage/blobs/')}
${node(738, 850, 282, 'cosmos-db', 'Cosmos DB', ['Blob pointer, hash, metadata', 'Not CSV rows or report files'], 'https://learn.microsoft.com/azure/cosmos-db/serverless')}
${connector('M620 688V750H408V900H440', false, 'persistence')}${badge(408, 873, 4, 'persistence')}${label(462, 747, 'Write JSON + verify hash', 192)}
${connector('M850 688V750H1052V900H1020', false, 'persistence')}${badge(1052, 873, 5, 'persistence')}${label(850, 747, 'Then publish pointer', 171)}

${panel(36, 782, 314, 186, 'Image delivery', 'Supplied Dockerfile and Bicep')}
${node(54, 850, 278, 'container-registry', 'Container Registry', ['Remote build', 'Deploy by immutable digest'], 'https://learn.microsoft.com/azure/container-registry/')}
${connector('M350 824H398V397H446', false, 'support')}${label(363, 765, 'Image', 63)}

${panel(1108, 782, 416, 186, 'Observability and access', 'Enabled only with the relevant configuration')}
${icon('application-insights', 1130, 851, 42)}${icon('log-analytics', 1184, 851, 42)}
${text(1240, 871, 'Application Insights + logs', 17, 650)}${text(1240, 895, 'Safe OpenTelemetry; no raw billing rows', 13)}
${icon('managed-identity', 1130, 914, 30)}${text(1174, 935, 'Managed identity | app access | approvals', 13, 650)}
${connector('M1040 648H1086V842H1108', true, 'telemetry')}${badge(1086, 800, 6, 'telemetry')}
${connector('M1316 782V728', true, 'telemetry')}

${panel(36, 1004, 1488, 200, 'Future Microsoft 365 channels', 'Not implemented by this workshop; separate adapter, identity, tenant approval and spend review required', '#f7f9fc', true)}
<g data-node="Future channels"><rect x="56" y="1080" width="568" height="96" rx="4" fill="#ffffff" stroke="#718899" stroke-dasharray="7 5"/>${text(76, 1114, 'Microsoft 365 Copilot  /  Microsoft Teams', 20, 650)}${text(76, 1142, 'Tenant-approved audience; authenticated user context', 16)}${text(76, 1164, 'No automatic publication or React UI parity', 14)}</g>
<g data-node="Future channel adapter"><rect x="780" y="1080" width="724" height="96" rx="4" fill="#ffffff" stroke="#718899" stroke-dasharray="7 5"/>${text(800, 1114, 'Future authenticated adapter - Microsoft 365 Agents SDK / Toolkit', 18, 650)}${text(800, 1142, 'Preserve self-hosted Agent ACO and scope-bound evidence', 16)}${text(800, 1164, 'Alternative: separately publish a verified Foundry prompt agent', 14)}</g>
${connector('M624 1128H780', true, 'request')}
${connector('M1504 1128H1542V206H960V234', true, 'request')}
<path d="M36 1232H1524" stroke="#c2ccd4"/>
${Object.entries(flowColors).map(([kind, color], index) => `<circle cx="${48 + index * 302}" cy="1260" r="6" fill="${color}"/>${text(64 + index * 302, 1266, { request: '1-2  Requests / collection', inference: '3  Model / optional tools', persistence: '4-5  Snapshot publication', telemetry: '6  Configured telemetry', support: 'Image / support path' }[kind], 14)}`).join('')}
${text(36, 1306, 'Numbers match the workflow below. Solid lines: primary paths. Dashed lines: optional or configuration-dependent integrations.', 15)}
${text(36, 1331, 'Official Microsoft icons are embedded unmodified. This workshop does not claim private networking or production certification.', 14)}
</g></svg>`
fs.writeFileSync(path.join(assets, 'azure-cost-optimizer-deployment-topology-v2.svg'), svg + '\n')
console.log('Rendered self-contained Azure topology with embedded official icons.')

const platformLayers = [
  ['5', 'Experience', 'Today: curated React workspace and evidence views', 'Future: Microsoft 365 Copilot / Teams via authenticated adapters', '#005b96', '#e5f1ff', '#f5faff'],
  ['4', 'Agent orchestration', 'Explain evidence through typed contracts', 'Today: Agent ACO + Agent Framework; LLM hosted in Foundry', '#087f68', '#dcf2e9', '#f3fbf7'],
  ['3', 'Read-only tools', 'Scope, principal and report-bound access', 'Today: 8 Agent ACO tools; optional MCP exposes 9', '#566ba6', '#e9edfb', '#f7f8ff'],
  ['2', 'Deterministic engines', 'Exact decimals, currency, dates and financial basis', 'Workload-specific rules, validated totals and provenance', '#935700', '#ffedce', '#fffaf0'],
  ['1', 'Evidence and data', 'Source adapters and authorized snapshots', 'Today: Cost Management, Advisor, Resource Graph, Blob / Cosmos', '#087f96', '#dff2f6', '#f4fbfd'],
]
const workloads = [
  { x: 42, title: 'Azure Cost Optimizer', state: 'IMPLEMENTED', lines: ['Observed Azure spend', 'Recommendations and reports'], future: false },
  { x: 438, title: 'Azure TokenOps', state: 'FUTURE WORKLOAD', lines: ['Token usage and model rates', 'Cost attributed to a solution'], future: true },
  { x: 834, title: 'Azure Cost Mapper', state: 'FUTURE WORKLOAD', lines: ['Reviewed diagram + sizing + prices', 'Initial estimate with assumptions'], future: true },
]
const platformSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="1240" height="990" viewBox="0 0 1240 990" role="img" aria-labelledby="title description">
<title id="title">Azure Cost Intelligence: shared five-layer platform</title><desc id="description">Azure Cost Optimizer is implemented. TokenOps and Cost Mapper are future workloads. Five layers separate experience, agent orchestration, tools, deterministic engines and evidence. Microsoft Foundry hosts the current workload's LLM.</desc>
<defs><marker id="platform-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0 0L10 5L0 10Z" fill="#34495e"/></marker>${platformLayers.map(([number, , , , , from, to]) => `<linearGradient id="layer-${number}"><stop stop-color="${from}"/><stop offset="1" stop-color="${to}"/></linearGradient>`).join('')}</defs>
<g font-family="Segoe UI, sans-serif" letter-spacing="0"><rect width="1240" height="990" fill="#ffffff"/>
${text(42, 44, 'Azure Cost Intelligence', 30, 700)}${text(42, 73, 'A shared platform for evidence-backed cost workloads', 18)}
${workloads.map(item => `<g data-node="${item.title}"><rect x="${item.x}" y="105" width="362" height="134" rx="8" fill="${item.future ? '#ffffff' : '#eaf3fc'}" stroke="${item.future ? '#6d8193' : '#005b96'}" stroke-width="2" ${item.future ? 'stroke-dasharray="6 4"' : ''}/>${text(item.x + 20, 131, item.state, 12, 700)}${text(item.x + 20, 161, item.title, 21, 700)}${text(item.x + 20, 188, item.lines[0], 15)}${text(item.x + 20, 212, item.lines[1], 15)}</g><path d="M${item.x + 181} 239V294" fill="none" stroke="#34495e" stroke-width="2" ${item.future ? 'stroke-dasharray="6 4"' : ''} marker-end="url(#platform-arrow)"/>`).join('')}
<rect x="42" y="294" width="1154" height="626" rx="10" fill="#f6f8fb" stroke="#8a9eaf" stroke-width="1.5"/>
${text(66, 328, 'SHARED PLATFORM  /  FIVE RESPONSIBILITY LAYERS', 15, 700)}
${platformLayers.map(([number, title, primary, detail, color], index) => {
  const top = 351 + index * 110;
  return `<g data-node="${title}"><rect x="66" y="${top}" width="1106" height="88" rx="8" fill="url(#layer-${number})" stroke="#91a5b5"/><rect x="66" y="${top}" width="5" height="88" rx="2" fill="${color}"/><circle cx="102" cy="${top + 44}" r="18" fill="${color}"/><text x="102" y="${top + 50}" font-size="18" font-weight="700" text-anchor="middle" fill="#ffffff">${number}</text>${text(136, top + 51, title, 21, 700)}<path d="M396 ${top + 18}V${top + 70}" stroke="#adbdc9"/>${text(420, top + 34, primary, 18, 650)}${text(420, top + 63, detail, 16)}</g>${index < 4 ? `<path d="M619 ${top + 88}V${top + 109}" stroke="#34495e" stroke-width="2" marker-end="url(#platform-arrow)"/>` : ''}`;
}).join('')}
${text(42, 955, 'Solid: implemented workload. Dashed: future adapters and calculations still need implementation and validation.', 16)}
${text(42, 979, 'Shared guardrails: authorization, provenance, decimal arithmetic, currency and basis separation, human review.', 15)}
</g></svg>`
fs.writeFileSync(path.join(assets, 'azure-cost-intelligence-platform.svg'), platformSvg + '\n')
console.log('Rendered compact five-layer platform with restrained gradients and labeled future workloads.')