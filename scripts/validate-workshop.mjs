import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const failures = []
const passes = []

function pass(name, detail = '') { passes.push({ name, detail }) }
function fail(name, detail) { failures.push({ name, detail }) }
function text(relative) { return fs.readFileSync(path.join(root, relative), 'utf8') }
function json(relative) { return JSON.parse(text(relative)) }
function exists(relative) { return fs.existsSync(path.join(root, relative)) }
function sha256(value) { return crypto.createHash('sha256').update(value).digest('hex') }
function walk(directory, files = []) {
  if (!fs.existsSync(directory)) return files
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const absolute = path.join(directory, entry.name)
    if (entry.isDirectory()) walk(absolute, files)
    else files.push(absolute)
  }
  return files
}
function relative(absolute) { return path.relative(root, absolute).split(path.sep).join('/') }
const packageExcludedDirectoryNames = new Set(['.git', '.artifacts', '.workshop', '.azure', '.foundry', '.checkpoints', 'bin', 'obj', 'node_modules', 'TestResults', 'playwright-report', 'test-results', 'coverage', 'participant-package', 'dist', 'dist-pages', 'public-pages'])
const packageExcludedFileNames = new Set(['.env', '.agent.log', 'product-bundle.v2.json', 'product-bundle-receipt.v2.json'])
function isPackageExcluded(file) {
  const rel = relative(file)
  const name = path.basename(file)
  return rel.startsWith('templates/product/') || rel.split('/').some((part) => packageExcludedDirectoryNames.has(part)) || packageExcludedFileNames.has(name) || /^\.env\./i.test(name) || /\.(?:log|user|suo|pdb|dll|exe)$/i.test(name)
}

const required = [
  'README.md', 'package.json', 'Dockerfile',
  '.github/copilot-instructions.md', '.github/agents/builder.agent.md', '.github/agents/reviewer.agent.md', '.github/agents/tuner.agent.md',
  '.github/prompts/setup.prompt.md', '.github/prompts/local-run.prompt.md', '.github/prompts/deploy.prompt.md', '.github/prompts/test.prompt.md', '.github/prompts/review.prompt.md', '.github/prompts/evaluate.prompt.md',
  '.github/skills/build-azure-cost-optimizer/SKILL.md', '.github/skills/deploy-azure-cost-optimizer/SKILL.md', '.github/skills/evaluate-azure-cost-optimizer/SKILL.md', '.github/skills/tune-azure-cost-optimizer/SKILL.md',
  'config/workshop.example.env', 'config/aco-system-prompt.md', 'config/optimization-knowledge.v1.json',
  'spec/fai-manifest.json', 'spec/workshop-delivery-contract.v1.json', 'spec/runtime-contract.v1.json', 'spec/openapi.v1.yaml', 'spec/tool-schemas.v1.json',
  'scripts/prepare-workshop.ps1', 'scripts/render-architecture.mjs', 'docs/assets/azure-cost-optimizer-deployment-topology-v2.svg', 'docs/assets/azure-icons/resource-graph-explorer.svg',
  'docs/assets/azure-cost-intelligence-platform.svg',
  'docs/assets/azure-icons/microsoft-foundry.svg',
  'docs/assets/azure-icons/foundry-models.svg', 'docs/assets/azure-icons/foundry-control-plane.svg',
  'docs/assets/screenshots/aco-welcome-live.png', 'docs/assets/screenshots/aco-report-downloads.png',
  'infra/demo-foundation.bicep', 'infra/demo-resources.bicep', 'infra/main.bicep',
  'ops/doctor.ps1', 'ops/start-workshop.ps1', 'ops/workshop-infra.ps1', 'ops/workshop-image.ps1', 'ops/workshop-auth.ps1', 'ops/workshop-app.ps1', 'ops/workshop-smoke.ps1', 'ops/refresh-cost-export.mjs', 'ops/pre-demo.ps1', 'ops/workshop-cleanup.ps1',
  'src/AzureCostOptimizer.App/AzureCostOptimizer.App.csproj', 'src/AzureCostOptimizer.Web/package-lock.json', 'tests/AzureCostOptimizer.App.Tests/AzureCostOptimizer.App.Tests.csproj',
]
const missing = required.filter((item) => !exists(item))
missing.length ? fail('required-files', missing.join(', ')) : pass('required-files', `${required.length} files present`)

const rootMarkdownFiles = fs.readdirSync(root, { withFileTypes: true })
  .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith('.md'))
  .map((entry) => entry.name)
  .sort()
if (rootMarkdownFiles.length === 1 && rootMarkdownFiles[0] === 'README.md') pass('single-guide', 'README.md is the only root Markdown guide')
else fail('single-guide', `root Markdown files: ${rootMarkdownFiles.join(', ')}`)

const participantGuide = text('README.md')
const mermaidBlocks = (participantGuide.match(/```mermaid/g) ?? []).length
const architectureHeadings = (participantGuide.match(/^## Architecture \d:/gm) ?? []).length
const topologyPath = 'docs/assets/azure-cost-optimizer-deployment-topology-v2.svg'
const platformPath = 'docs/assets/azure-cost-intelligence-platform.svg'
const legacyTopologyPath = 'docs/assets/azure-cost-optimizer-deployment-topology.svg'
const screenshotPaths = [
  'docs/assets/screenshots/aco-welcome-live.png',
  'docs/assets/screenshots/aco-report-downloads.png',
  'docs/assets/screenshots/aco-answer.png',
  'docs/assets/screenshots/aco-service-cost.png',
  'docs/assets/screenshots/aco-resource-group-cost.png',
  'docs/assets/screenshots/aco-advisor.png',
  'docs/assets/screenshots/aco-waf-checklist.png',
  'docs/assets/screenshots/aco-finops.png',
  'docs/assets/screenshots/aco-devops-backlog.png',
  'docs/assets/screenshots/aco-next-action.png',
  'docs/assets/screenshots/aco-pdf-services.png',
  'docs/assets/screenshots/aco-pdf-service-mix.png',
  'docs/assets/screenshots/aco-excel-cost-breakdown.png',
  'docs/assets/screenshots/aco-foundry-toolkit.png',
]
const screenshotsValid = screenshotPaths.every((item) => exists(item) && participantGuide.includes(item) && fs.statSync(path.join(root, item)).size > 10_000)
const screenshotWidthsMatch = screenshotPaths.every((item) => exists(item) && fs.readFileSync(path.join(root, item)).readUInt32BE(16) === 1380)
const numberedSteps = [...participantGuide.matchAll(/^## Step (\d+):[^\n]*\n([\s\S]*?)(?=^## |^# |$(?![\s\S]))/gm)]
const participantFlowValid = numberedSteps.length === 15 && numberedSteps.every((step, index) => Number(step[1]) === index + 1 && step[2].includes('```text'))
  && participantGuide.includes('chat.tools.global.autoApprove') && participantGuide.includes('chat.tools.terminal.enableAutoApprove')
  && participantGuide.includes('not a technical guarantee') && participantGuide.includes('.workshop/checkpoint.json')
  && text('.github/agents/builder.agent.md').includes('then end the turn')
  && text('.github/skills/build-azure-cost-optimizer/SKILL.md').includes('.workshop/checkpoint.json')
  && !participantGuide.includes('screenshots/aco-mcp-tools.png') && !exists('docs/assets/screenshots/aco-mcp-tools.png')
const contrastConfigs = [...participantGuide.matchAll(/%%\{init: (.+)\}%%/g)].map((match) => JSON.parse(match[1]))
const contrastValid = contrastConfigs.length === 2
  && contrastConfigs.every((config) => config.theme === 'dark' && config.themeVariables.background === '#1f1f1f' && config.themeVariables.textColor === '#eeeeee' && config.themeVariables.lineColor === '#7194a8' && config.themeCSS?.includes('rx: 0'))
  && contrastConfigs[1].themeVariables.signalTextColor === '#eeeeee'
  && contrastConfigs[0].themeVariables.titleColor === '#eeeeee'
  && contrastConfigs[0].themeCSS?.includes('.cluster-label')
  && ['#3b82f6', '#06b6d4', '#10b981', '#f59e0b', '#8b5cf6', '#0ea5e9'].every((color) => participantGuide.includes(`fill:${color}`))
  && participantGuide.includes('subgraph USER["USER LAYER"]')
  && participantGuide.includes('participant User as User / Web')
  && !participantGuide.includes('actor User as User / Web')
const topology = exists(topologyPath) ? text(topologyPath) : ''
const embeddedIcons = (topology.match(/href="data:image\/svg\+xml;base64,/g) ?? []).length
const topologyValid = embeddedIcons >= 10 && !/<image\b[^>]*href="(?!data:)/.test(topology)
const platformSvg = exists(platformPath) ? text(platformPath) : ''
const platformValid = participantGuide.includes(platformPath) && platformSvg.includes('<linearGradient') && platformSvg.includes('Azure TokenOps') && platformSvg.includes('Azure Cost Mapper') && platformSvg.includes('FUTURE WORKLOAD')
const optionalChannelsValid = participantGuide.includes('class Copilot,Teams,ChannelAdapter future;')
  && participantGuide.includes('## Optional Next Stage: Microsoft 365 Copilot And Teams')
  && topology.includes('Future Microsoft 365 channels') && topology.includes('Microsoft 365 Agents SDK / Toolkit')
  && platformSvg.includes('Future: Microsoft 365 Copilot / Teams via authenticated adapters')
  && topology.includes(fs.readFileSync(path.join(root, 'docs/assets/azure-icons/microsoft-foundry.svg')).toString('base64'))
const tourIndex = participantGuide.indexOf('# Part 1: Solution Tour')
const workshopIndex = participantGuide.indexOf('# Part 2: Hands-On Workshop')
const separationValid = tourIndex >= 0 && workshopIndex > participantGuide.indexOf('### Real PDF And Excel Output') && participantGuide.indexOf('## Workshop Requirements And Preparation') > workshopIndex && participantGuide.indexOf('## Start Sprint 1 In Copilot') > workshopIndex
const removedDailyPhoto = !participantGuide.includes('aco-grounded-review.png') && !exists('docs/assets/screenshots/aco-grounded-review.png')
const simplifiedCore = participantGuide.includes('## Meet Agent ACO')
  && participantGuide.includes('## Bonus: Foundry Prompt Agents')
  && participantGuide.includes('scripts/prepare-workshop.ps1')
  && !participantGuide.includes('## Step 13: Configure Entra Authentication')
  && !participantGuide.includes('## Rollback')
const validationReceipt = exists('spec/product-bundle-receipt.v2.json') ? json('spec/product-bundle-receipt.v2.json') : null
const qualitativeValidation = validationReceipt === null || Object.values(validationReceipt.validation ?? {}).every((value) => typeof value === 'string' && !/\d+\/\d+/.test(value))
if (!participantGuide.includes('```powershell') && mermaidBlocks === 2 && architectureHeadings === 4 && participantGuide.includes(topologyPath) && topologyValid && platformValid && optionalChannelsValid && participantFlowValid && separationValid && !exists(legacyTopologyPath) && screenshotsValid && screenshotWidthsMatch && removedDailyPhoto && contrastValid && simplifiedCore && qualitativeValidation) {
  pass('prompt-led-guide', `4 architecture views, separate solution tour/workshop, ${screenshotPaths.length} gallery assets, embedded official icons and readable labels`)
} else {
  fail('prompt-led-guide', `architecture=${architectureHeadings} mermaid=${mermaidBlocks} topology=${topologyValid} platform=${platformValid} channels=${optionalChannelsValid} participantFlow=${participantFlowValid} separation=${separationValid} legacy=${exists(legacyTopologyPath)} screenshots=${screenshotsValid} widths=${screenshotWidthsMatch} contrast=${contrastValid} removedDaily=${removedDailyPhoto} simplified=${simplifiedCore} qualitative=${qualitativeValidation} powershell=${participantGuide.includes('```powershell')}`)
}

const forbiddenDirectoryNames = new Set(['.azure', '.foundry', '.checkpoints'])
const forbiddenFilePatterns = [/^\.env(?:\.|$)/i, /\.log$/i, /\.(?:user|suo)$/i]
const forbidden = []
for (const entry of walk(root)) {
  const rel = relative(entry)
  const segments = rel.split('/')
  if (segments.some((segment) => forbiddenDirectoryNames.has(segment)) || forbiddenFilePatterns.some((pattern) => pattern.test(path.basename(rel)))) forbidden.push(rel)
}
for (const directory of walkDirectories(root)) {
  const rel = relative(directory)
  if (rel && rel.split('/').some((segment) => forbiddenDirectoryNames.has(segment))) forbidden.push(`${rel}/`)
}
forbidden.length ? fail('distribution-boundary', [...new Set(forbidden)].slice(0, 30).join(', ')) : pass('distribution-boundary', 'no private/generated paths')

function walkDirectories(directory, values = []) {
  if (!fs.existsSync(directory)) return values
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue
    const absolute = path.join(directory, entry.name)
    values.push(absolute)
    walkDirectories(absolute, values)
  }
  return values
}

const jsonFiles = walk(root).filter((file) => file.endsWith('.json') && !path.basename(file).startsWith('tsconfig.') && !isPackageExcluded(file) && !relative(file).startsWith('src/AzureCostOptimizer.App/wwwroot/'))
const invalidJson = []
for (const file of jsonFiles) {
  try { JSON.parse(fs.readFileSync(file, 'utf8')) } catch (error) { invalidJson.push(`${relative(file)}: ${error.message}`) }
}
invalidJson.length ? fail('json-syntax', invalidJson.join('; ')) : pass('json-syntax', `${jsonFiles.length} JSON files parsed`)

const scanExtensions = new Set(['.md', '.json', '.jsonl', '.yaml', '.yml', '.ps1', '.mjs', '.js', '.ts', '.tsx', '.cs', '.bicep'])
const scanFiles = walk(root).filter((file) => scanExtensions.has(path.extname(file).toLowerCase()) && relative(file) !== 'scripts/validate-workshop.mjs' && !relative(file).startsWith('tests/') && !isPackageExcluded(file))
const forbiddenValues = [
  ['known subscription', /37ffd444-46e0-41dd-9e4b-f12857262095/i],
  ['known tenant', /f1755a38-88fd-47a4-a2e9-5c2019dc2535/i],
  ['producer resource prefix', /akodemo/i],
  ['producer hostname', /braveriver-[a-z0-9.-]+/i],
  ['developer identity', /pavleenbali|MngEnvMCAP/i],
  ['floating MCP version', /frootai-mcp@latest/i],
  ['hotel sample residue', /hotel search assistant|Find hotels in Seattle/i],
]
const residue = []
for (const file of scanFiles) {
  const content = fs.readFileSync(file, 'utf8')
    .replaceAll('https://github.com/gitpavleenbali/azure-cost-optimizer-workshop', 'https://github.com/approved-owner/azure-cost-optimizer-workshop')
    .replaceAll('https://gitpavleenbali.github.io/azure-cost-optimizer-workshop/', 'https://approved-owner.github.io/azure-cost-optimizer-workshop/')
  for (const [label, pattern] of forbiddenValues) if (pattern.test(content)) residue.push(`${relative(file)} (${label})`)
}
residue.length ? fail('participant-sanitization', residue.join(', ')) : pass('participant-sanitization', `${scanFiles.length} text files scanned`)

const manifest = json('spec/fai-manifest.json')
const references = []
for (const group of ['agents', 'instructions', 'skills', 'hooks', 'workflows']) references.push(...(manifest.primitives?.[group] ?? []))
for (const group of ['toolkit', 'infrastructure']) for (const value of Object.values(manifest[group] ?? {})) if (typeof value === 'string') references.push(value)
const unresolved = references.filter((item) => !exists(item.replace(/\/$/, '')))
unresolved.length ? fail('fai-references', unresolved.join(', ')) : pass('fai-references', `${references.length} references resolve`)

const runtime = json('spec/runtime-contract.v1.json')
const toolSchemas = json('spec/tool-schemas.v1.json')
const modelConfig = json('config/openai.json')
const assembly = json('spec/assembly-contract.v1.json')
const delivery = json('spec/workshop-delivery-contract.v1.json')
const service = text('src/AzureCostOptimizer.App/AcoAgentService.cs')
const mcp = text('src/AzureCostOptimizer.App/AcoMcpTools.cs')
const appHost = text('src/AzureCostOptimizer.App/AppHost.cs')
const runtimeToolNames = runtime.agent.tools
const schemaToolNames = toolSchemas.tools.map((tool) => tool.name)
const contractChecks = [
  [service.includes('MaximumModelCalls = 6'), 'maximum_model_calls'],
  [service.includes('MaximumOutputTokens = 32_768'), 'maximum_output_tokens'],
  [service.includes('TimeSpan.FromSeconds(150)'), 'deadline_seconds'],
  [runtimeToolNames.length === 8 && runtimeToolNames.every((tool) => service.includes(`"${tool}"`) || service.includes(tool)), 'agent tools'],
  [schemaToolNames.length === 8 && runtimeToolNames.every((tool) => schemaToolNames.includes(tool)), 'tool schema inventory'],
  [runtime.mcp.tools.every((tool) => mcp.includes(tool)), 'MCP tools'],
  [modelConfig.max_output_tokens === runtime.agent.maximum_output_tokens, 'configured output-token budget'],
  [modelConfig.limits.max_model_calls_per_request === runtime.agent.maximum_model_calls, 'configured model-call budget'],
  [modelConfig.limits.max_tool_rounds_per_request === runtime.agent.maximum_tool_calls, 'configured tool-call budget'],
  [modelConfig.limits.request_deadline_seconds === runtime.agent.deadline_seconds, 'configured request deadline'],
  [assembly.schema_version === '1.6.0' && assembly.clock.active_workshop_seconds === 10_800 && assembly.clock.break_seconds === 2_700, 'workshop clock'],
  [assembly.sprints.length === 2 && assembly.sprints.every((sprint) => sprint.maximum_seconds === 5_400), 'two 90-minute sprints'],
  [assembly.sprints.flatMap((sprint) => sprint.phases).reduce((total, phase) => total + phase.maximum_seconds, 0) === 10_800, 'sprint phase budgets'],
  [delivery.interaction_model.participant_shell_commands_required === false && delivery.interaction_model.builder_executes_supplied_operations === true, 'prompt-led participant interaction'],
  [delivery.preparation.script === 'scripts/prepare-workshop.ps1' && delivery.preparation.installs_automatically === false, 'approval-gated preparation'],
  [delivery.tracks.some((track) => track.id === 'foundry-channels-bonus' && track.bonus === true), 'bonus prompt-agent channels'],
  [runtimeToolNames.every((tool) => assembly.aco_foundry_activation_gate.required_tools.includes(tool)), 'assembly tool inventory'],
  [service.includes('SemanticScope(snapshot, principalId)'), 'principal-partitioned semantic cache'],
]
const contractFailures = contractChecks.filter(([ok]) => !ok).map(([, label]) => label)
contractFailures.length ? fail('runtime-contract-parity', contractFailures.join(', ')) : pass('runtime-contract-parity', 'budgets, tools and cache partition match source')

const runtimeRoutes = [...appHost.matchAll(/app\.Map(?:Get|Post)\(\"([^\"]+)\"/g)].map((match) => match[1]).sort()
const openapi = text('spec/openapi.v1.yaml')
const documentedRoutes = [...openapi.matchAll(/^  (\/[^:]+):$/gm)].map((match) => match[1]).sort()
const missingRoutes = runtimeRoutes.filter((route) => !documentedRoutes.includes(route))
const extraRoutes = documentedRoutes.filter((route) => !runtimeRoutes.includes(route))
if (missingRoutes.length || extraRoutes.length) fail('openapi-route-parity', `missing=${missingRoutes.join(',')} extra=${extraRoutes.join(',')}`)
else pass('openapi-route-parity', `${runtimeRoutes.length} runtime routes documented`)

const iconDirectory = path.join(root, 'docs', 'assets', 'azure-icons')
const icons = fs.existsSync(iconDirectory) ? fs.readdirSync(iconDirectory).filter((item) => item.endsWith('.svg')) : []
icons.length >= 10 ? pass('azure-icons', `${icons.length} official SVGs`) : fail('azure-icons', `only ${icons.length} SVGs found`)

const defaults = json('infra/workshop.parameters.example.json')
const authDefault = defaults.parameters?.authMode?.value
if (authDefault !== 'container-apps-easy-auth') fail('safe-defaults', `authMode=${authDefault}`)
else pass('safe-defaults', 'Entra authentication is default')

const hasBundleManifest = exists('spec/product-bundle.v2.json')
const hasBundleReceipt = exists('spec/product-bundle-receipt.v2.json')
if (hasBundleManifest && hasBundleReceipt) {
  const bundle = json('spec/product-bundle.v2.json')
  const receipt = json('spec/product-bundle-receipt.v2.json')
  const manifestHash = sha256(fs.readFileSync(path.join(root, 'spec', 'product-bundle.v2.json')))
  const archivePath = path.join(root, bundle.archive.path)
  const archiveExists = fs.existsSync(archivePath)
  const archiveHash = archiveExists ? sha256(fs.readFileSync(archivePath)) : ''
  const archiveBytes = archiveExists ? fs.statSync(archivePath).size : 0
  const valid = receipt.manifest.sha256 === manifestHash && archiveExists && bundle.archive.sha256 === archiveHash && receipt.archive.sha256 === archiveHash && bundle.archive.bytes === archiveBytes && receipt.archive.bytes === archiveBytes
  valid ? pass('bundle-receipt', `${path.basename(archivePath)} ${archiveHash}`) : fail('bundle-receipt', `manifest=${manifestHash} archive=${archiveHash} bytes=${archiveBytes}`)
} else if (hasBundleManifest || hasBundleReceipt) {
  fail('bundle-receipt', 'bundle manifest and receipt must either both exist or both be absent')
} else {
  pass('bundle-receipt', 'producer-only bundle metadata is not included in the participant distribution')
}

const checksums = walk(root)
  .filter((file) => !isPackageExcluded(file))
  .sort((left, right) => relative(left).localeCompare(relative(right)))
  .map((file) => `${sha256(fs.readFileSync(file))}  ${relative(file)}`)
const manifestDigest = sha256(checksums.join('\n'))
if (hasBundleManifest) {
  const recordedDigest = json('spec/product-bundle.v2.json').source_tree?.validation_identity_sha256
  recordedDigest === manifestDigest
    ? pass('tree-identity', manifestDigest)
    : pass('tree-identity', `current source ${manifestDigest}; preserved bundle source ${recordedDigest}; archive receipt remains authoritative only for the immutable 2.0.0 ZIP`)
} else {
  pass('tree-identity', manifestDigest)
}

const report = {
  schema_version: '1.0.0',
  workshop: 'azure-cost-optimizer-workshop',
  passed: failures.length === 0,
  summary: { pass: passes.length, fail: failures.length },
  passes,
  failures,
}
fs.mkdirSync(path.join(root, '.workshop'), { recursive: true })
fs.writeFileSync(path.join(root, '.workshop', 'validation.json'), `${JSON.stringify(report, null, 2)}\n`)
console.log(JSON.stringify(report, null, 2))
if (failures.length) process.exitCode = 1
