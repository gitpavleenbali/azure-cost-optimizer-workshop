[CmdletBinding()]
param(
    [ValidateSet('Core', 'Azure', 'Foundry', 'All')]
    [string] $Track = 'All'
)

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$stateRoot = Join-Path $root '.workshop'
New-Item -ItemType Directory -Path $stateRoot -Force | Out-Null

function Invoke-Text([string] $Command, [string[]] $Arguments) {
    if (-not (Get-Command $Command -ErrorAction SilentlyContinue)) { return $null }
    $previousErrorAction = $ErrorActionPreference
    try {
        $ErrorActionPreference = 'Continue'
        $output = & $Command @Arguments 2>&1
        $exitCode = $LASTEXITCODE
        $value = ($output | Out-String).Trim()
        if ($exitCode -ne 0) { return $null }
        return $value
    }
    catch { return $null }
    finally { $ErrorActionPreference = $previousErrorAction }
}

function Add-Check(
    [System.Collections.Generic.List[object]] $Checks,
    [string] $Id,
    [string] $Label,
    [bool] $Required,
    [string] $Detected,
    [string] $Minimum,
    [string] $InstallHint
) {
    $status = if ($Detected) { 'ready' } elseif ($Required) { 'missing' } else { 'optional-missing' }
    $Checks.Add([ordered]@{
        id = $Id
        label = $Label
        required = $Required
        status = $status
        detected = $Detected
        minimum = $Minimum
        installHint = $InstallHint
    })
}

$checks = New-Object 'System.Collections.Generic.List[object]'
$gitVersion = Invoke-Text 'git' @('--version')
$codeVersion = Invoke-Text 'code' @('--version')
$dotnetVersion = Invoke-Text 'dotnet' @('--version')
$nodeVersion = Invoke-Text 'node' @('--version')
$npmVersion = Invoke-Text 'npm' @('--version')
$extensions = if ($codeVersion) { Invoke-Text 'code' @('--list-extensions') } else { $null }
$extensionNames = @($extensions -split "`r?`n" | ForEach-Object { $_.Trim().ToLowerInvariant() } | Where-Object { $_ })

Add-Check $checks 'git' 'Git' $true $gitVersion 'current supported release' 'winget install --id Git.Git --exact'
Add-Check $checks 'vscode' 'Visual Studio Code' $true $(if ($codeVersion) { ($codeVersion -split "`r?`n")[0] } else { $null }) 'current stable release' 'winget install --id Microsoft.VisualStudioCode --exact'
$copilotDetected = if ($extensionNames -contains 'github.copilot-chat' -or $extensionNames -contains 'github.copilot') {
    'installed extension'
} elseif ($env:COPILOT_AGENT) {
    'active bundled Copilot agent session'
} else {
    $null
}
Add-Check $checks 'copilot-chat' 'GitHub Copilot Chat extension' $true $copilotDetected 'installed and signed in' 'code --install-extension GitHub.copilot-chat'
Add-Check $checks 'dotnet' '.NET SDK' $true $dotnetVersion '10.0.0' 'winget install --id Microsoft.DotNet.SDK.10 --exact'
Add-Check $checks 'node' 'Node.js' $true $nodeVersion '24.0.0' 'winget install --id OpenJS.NodeJS.LTS --exact'
Add-Check $checks 'npm' 'npm' $true $npmVersion 'bundled with Node.js 24' 'Reinstall the approved Node.js 24 package.'

$versionIssues = New-Object 'System.Collections.Generic.List[string]'
if ($dotnetVersion -and [version](($dotnetVersion -split '-')[0]) -lt [version]'10.0.0') {
    $versionIssues.Add('.NET SDK 10.0.0 or newer is required.')
}
if ($nodeVersion) {
    $normalizedNode = $nodeVersion.TrimStart('v')
    if ([version](($normalizedNode -split '-')[0]) -lt [version]'24.0.0') {
        $versionIssues.Add('Node.js 24.0.0 or newer is required.')
    }
}

$azureRequired = $Track -in @('Azure', 'Foundry', 'All')
$azVersion = $null
$bicepVersion = $null
$acrRemoteBuild = $null
$azureSignIn = 'not-checked'
if ($azureRequired) {
    $azJson = Invoke-Text 'az' @('version', '--output', 'json')
    if ($azJson) {
        try { $azVersion = ($azJson | ConvertFrom-Json).PSObject.Properties['azure-cli'].Value } catch { $azVersion = 'installed' }
        $bicepOutput = Invoke-Text 'az' @('bicep', 'version')
        if ($bicepOutput -match 'Bicep CLI version [^\r\n]+') { $bicepVersion = $Matches[0] }
        $acrHelp = Invoke-Text 'az' @('acr', 'build', '--help')
        if ($acrHelp -match 'az acr build') { $acrRemoteBuild = 'available' }
        $account = Invoke-Text 'az' @('account', 'show', '--output', 'json', '--only-show-errors')
        $azureSignIn = if ($account) { 'signed-in' } else { 'sign-in-required' }
    }
    Add-Check $checks 'azure-cli' 'Azure CLI' $true $azVersion 'current supported release' 'winget install --id Microsoft.AzureCLI --exact'
    Add-Check $checks 'bicep' 'Azure Bicep CLI' $true $bicepVersion 'available through Azure CLI' 'az bicep install'
    Add-Check $checks 'acr-remote-build' 'Azure Container Registry remote build' $true $acrRemoteBuild 'az acr build available' 'Update Azure CLI using the organization-approved package source.'
}

$foundryRequested = $Track -in @('Foundry', 'All')
if ($foundryRequested) {
    Add-Check $checks 'foundry-toolkit' 'Foundry Toolkit for VS Code' $false $(if ($extensionNames -contains 'ms-windows-ai-studio.windows-ai-studio') { 'installed' } else { $null }) 'recommended for the bonus agent exercise' 'code --install-extension ms-windows-ai-studio.windows-ai-studio'
}

$bundleManifest = Join-Path $root 'spec\product-bundle.v2.json'
$bundleReceipt = Join-Path $root 'spec\product-bundle-receipt.v2.json'
$bundleStatus = $null
if ((Test-Path $bundleManifest) -and (Test-Path $bundleReceipt)) {
    try {
        $manifest = Get-Content -LiteralPath $bundleManifest -Raw | ConvertFrom-Json
        $receipt = Get-Content -LiteralPath $bundleReceipt -Raw | ConvertFrom-Json
        $archive = Join-Path $root $manifest.archive.path
        if (Test-Path $archive) {
            $actualHash = (Get-FileHash -Algorithm SHA256 -LiteralPath $archive).Hash.ToLowerInvariant()
            if ($actualHash -eq $manifest.archive.sha256 -and $actualHash -eq $receipt.archive.sha256) { $bundleStatus = 'verified' }
        }
    }
    catch { $bundleStatus = $null }
}
elseif (-not (Test-Path $bundleManifest) -and -not (Test-Path $bundleReceipt)) {
    $participantValidation = Invoke-Text 'node' @((Join-Path $PSScriptRoot 'validate-workshop.mjs'))
    if ($participantValidation) {
        try {
            if (($participantValidation | ConvertFrom-Json).passed -eq $true) {
                $bundleStatus = 'participant-tree-validated; facilitator verifies archive hash separately'
            }
        }
        catch { $bundleStatus = $null }
    }
}
Add-Check $checks 'participant-bundle' 'Workshop package or extracted participant tree' $true $bundleStatus 'producer archive hash verification or participant structure validation' 'Obtain the verified participant ZIP and matching external receipt from the facilitator; do not create missing producer metadata.'

$requiredActions = @($checks | Where-Object { $_.required -and $_.status -ne 'ready' })
$optionalActions = @($checks | Where-Object { -not $_.required -and $_.status -ne 'ready' })
$result = [ordered]@{
    schemaVersion = '1.0.0'
    track = $Track
    status = if ($requiredActions.Count -eq 0 -and $versionIssues.Count -eq 0) { 'ready' } else { 'action-required' }
    checks = $checks
    versionIssues = @($versionIssues)
    azureSignIn = $azureSignIn
    requiredActions = @($requiredActions | ForEach-Object { [ordered]@{ id = $_.id; label = $_.label; installHint = $_.installHint } })
    optionalActions = @($optionalActions | ForEach-Object { [ordered]@{ id = $_.id; label = $_.label; installHint = $_.installHint } })
    dockerRequired = $false
    installedAnything = $false
    changedMachine = $false
    changedAzure = $false
    nextStep = if ($requiredActions.Count -eq 0 -and $versionIssues.Count -eq 0) {
        'Step 1 preparation is complete. Request README Step 2 when ready; do not restart Sprint 1 or auto-advance.'
    } else {
        'Ask ACO Workshop Builder to explain the missing items and request approval before each organization-approved installation.'
    }
}

$json = $result | ConvertTo-Json -Depth 8
$utf8NoBom = New-Object System.Text.UTF8Encoding($false)
[IO.File]::WriteAllText((Join-Path $stateRoot 'preparation.json'), "$json`n", $utf8NoBom)
$json
if ($result.status -ne 'ready') { exit 1 }