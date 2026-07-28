#Requires -Version 5.1
[CmdletBinding()]
param(
  [Parameter(Position = 0)]
  [string]$Command = 'help',

  [Parameter(Position = 1, ValueFromRemainingArguments = $true)]
  [string[]]$Rest = @()
)

$ErrorActionPreference = 'Stop'
$RootDir = if ($PSScriptRoot) { (Resolve-Path -LiteralPath $PSScriptRoot).Path } else { (Get-Location).Path }
Set-Location -LiteralPath $RootDir

function Use-Utf8Console {
  try {
    $utf8 = New-Object System.Text.UTF8Encoding $false
    [Console]::InputEncoding = $utf8
    [Console]::OutputEncoding = $utf8
    $script:OutputEncoding = $utf8
    if (Get-Command chcp.com -ErrorAction SilentlyContinue) {
      & chcp.com 65001 *> $null
    }
  } catch {
    # Keep running even if the host does not allow console encoding changes.
  }
}

Use-Utf8Console

function Write-Info([string]$Message) { Write-Host "[INFO] $Message" -ForegroundColor Cyan }
function Write-Ok([string]$Message) { Write-Host "[OK] $Message" -ForegroundColor Green }
function Write-WarnLine([string]$Message) { Write-Host "[WARN] $Message" -ForegroundColor Yellow }
function Write-Err([string]$Message) { Write-Host "[ERROR] $Message" -ForegroundColor Red }

function Prompt([string]$Label, [string]$Default = '') {
  if ($Default) {
    $value = Read-Host "$Label [$Default]"
    if ([string]::IsNullOrWhiteSpace($value)) { return $Default }
    return $value
  }
  return (Read-Host $Label)
}

function Confirm([string]$Label, [ValidateSet('y', 'n')][string]$Default = 'n') {
  $hint = if ($Default -eq 'y') { 'Y/n' } else { 'y/N' }
  $value = Read-Host "$Label ($hint)"
  if ([string]::IsNullOrWhiteSpace($value)) { $value = $Default }
  $value = $value.Trim().ToLowerInvariant()
  return ($value -eq 'y' -or $value -eq 'yes')
}

function Has-Command([string]$Name) {
  return [bool](Get-Command $Name -ErrorAction SilentlyContinue)
}

function Ensure-Command([string]$Name) {
  if (-not (Has-Command $Name)) {
    Write-Err "Missing command: $Name"
    exit 1
  }
}

function Invoke-Checked([string]$File, [string[]]$Arguments = @()) {
  & $File @Arguments
  if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
}

function Get-LocalRegistryUrl {
  return ([System.Uri](Join-Path $RootDir 'marketplace\registry.local.json')).AbsoluteUri
}

function Write-LocalMarketplacePreviewSteps {
  Write-Info 'Local Marketplace preview:'
  Write-Info "  Registry URL: $(Get-LocalRegistryUrl)"
  Write-Info '  Open DevToolBox Settings -> Marketplace Registry URL and paste this URL.'
  Write-Info '  Open Modules -> Marketplace, refresh, then install the plugin.'
}

function Initialize-LocalMarketplaceRegistry {
  $distDir = Join-Path $RootDir 'marketplace\.local-dist'
  New-Item -ItemType Directory -Force -Path $distDir | Out-Null
  Get-ChildItem -LiteralPath $distDir -Force -ErrorAction SilentlyContinue | Remove-Item -Recurse -Force
  "{`n  `"schemaVersion`": 1,`n  `"plugins`": []`n}`n" | Set-Content -LiteralPath (Join-Path $RootDir 'marketplace\registry.local.json') -Encoding UTF8
  Write-Ok 'Local Marketplace registry reset'
  Write-LocalMarketplacePreviewSteps
}

function Show-Usage {
  @'
Usage:
  .\cli.ps1 <command> [args...]

Commands:
  dev [vite args...]                   Run desktop dev server (auto-selects a free Vite port)
  build                                Build renderer + main/preload
  clear                                Clear local user data / marketplace artifacts (interactive)
  plugin create                        Create a marketplace plugin template (interactive)
  plugin doctor <market-id|all>         Diagnose marketplace plugin setup and package readiness
  plugin dev <market-id>                Run a marketplace plugin Vite dev server
  plugin init-local                     Reset the local Marketplace registry preview
  plugin <market-id>                   Build + pack a marketplace plugin into a local registry zip
  plugin all                           Build + pack all marketplace plugins into a local registry zip
  package <windows|all> [x64]          Package Windows installer (.exe)
  check                                Run local quality/security checks (lint + typecheck + test)
  tool new                             Create a new built-in tool template (delegates to pnpm new:tool)
  doctor                               Print environment info
  help
'@
}

function Get-RequiredNodeMajor {
  $nvmrc = Join-Path $RootDir '.nvmrc'
  if (Test-Path -LiteralPath $nvmrc) {
    $value = (Get-Content -Raw -LiteralPath $nvmrc).Trim()
    if ($value -match '^v?(\d+)') { return $Matches[1] }
  }
  return '20'
}

function Test-NodeVersion {
  $required = [int](Get-RequiredNodeMajor)
  $current = (& node -p "process.versions.node.split('.')[0]").Trim()
  if ([int]$current -lt $required) {
    if ($env:DEVTOOLBOX_ALLOW_UNSUPPORTED_NODE -eq '1') {
      Write-WarnLine "Unsupported Node.js $((& node -v).Trim()). Expected Node.js >= $required; continuing because DEVTOOLBOX_ALLOW_UNSUPPORTED_NODE=1."
      return $true
    }
    Write-Err "Unsupported Node.js $((& node -v).Trim()). DevToolBox requires Node.js >= $required."
    Write-Err "Use Node $required or newer before running this command."
    return $false
  }
  return $true
}

function Test-PnpmVersion {
  $version = (& pnpm -v).Trim()
  $major = [int](($version -split '\.')[0])
  if ($major -lt 10) {
    if ($env:DEVTOOLBOX_ALLOW_UNSUPPORTED_PNPM -eq '1') {
      Write-WarnLine "Unsupported pnpm $version. Expected pnpm >= 10; continuing because DEVTOOLBOX_ALLOW_UNSUPPORTED_PNPM=1."
      return $true
    }
    Write-Err "Unsupported pnpm $version. DevToolBox requires pnpm >= 10."
    Write-Err 'Install pnpm 10 or newer, for example: corepack enable && corepack prepare pnpm@10.10.0 --activate'
    return $false
  }
  return $true
}

function Ensure-ToolVersions {
  Ensure-Command node
  Ensure-Command pnpm
  $ok = $true
  if (-not (Test-NodeVersion)) { $ok = $false }
  if (-not (Test-PnpmVersion)) { $ok = $false }
  if (-not $ok) { exit 1 }
}

function Format-Bytes([double]$Bytes) {
  if ($Bytes -le 0) { return 'unknown' }
  return ('{0:N1} GiB' -f ($Bytes / 1GB))
}

function Get-DiskAvailableBytes {
  try {
    $drive = Get-PSDrive -Name ([System.IO.Path]::GetPathRoot($RootDir).Substring(0, 1))
    return [double]$drive.Free
  } catch {
    return 0
  }
}

function Get-MemoryInfo {
  try {
    $os = Get-CimInstance Win32_OperatingSystem
    return @{
      Total = [double]$os.TotalVisibleMemorySize * 1KB
      Available = [double]$os.FreePhysicalMemory * 1KB
    }
  } catch {
    return @{ Total = 0; Available = 0 }
  }
}

function Write-SystemSummary {
  $mem = Get-MemoryInfo
  Write-Info "OS: $([System.Runtime.InteropServices.RuntimeInformation]::OSDescription) $([System.Runtime.InteropServices.RuntimeInformation]::OSArchitecture)"
  Write-Info "Memory: $(Format-Bytes $mem.Available) available / $(Format-Bytes $mem.Total) total"
  Write-Info "Disk: $(Format-Bytes (Get-DiskAvailableBytes)) available at $RootDir"
}

function Test-PortInUse([int]$Port) {
  try {
    $listener = [System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Parse('127.0.0.1'), $Port)
    $listener.Start()
    $listener.Stop()
    return $false
  } catch {
    return $true
  }
}

function Write-PortOwner([int]$Port) {
  try {
    $ownerRows = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction Stop |
      Select-Object -First 5 LocalAddress, LocalPort, OwningProcess |
      Format-Table -AutoSize |
      Out-String
    if (-not [string]::IsNullOrWhiteSpace($ownerRows)) {
      Write-Host $ownerRows.TrimEnd()
    }
  } catch {
    Write-WarnLine "Could not inspect the process that owns port $Port."
  }
}

function Select-DevPort([int]$Desired) {
  if (-not (Test-PortInUse $Desired)) { return $Desired }
  Write-WarnLine "Port $Desired is already in use."
  Write-PortOwner $Desired
  if ($env:DEVTOOLBOX_STRICT_PORT -eq '1') {
    Write-Err 'DEVTOOLBOX_STRICT_PORT=1 is set, so the dev server will not auto-select another port.'
    exit 1
  }
  for ($port = $Desired + 1; $port -le $Desired + 50; $port++) {
    if (-not (Test-PortInUse $port)) {
      Write-Info "Using free dev port $port instead. Set DEVTOOLBOX_STRICT_PORT=1 to fail on conflicts."
      return $port
    }
  }
  Write-Err "No free dev port found in range $Desired-$($Desired + 50)."
  exit 1
}

function Get-PackageDiagnosticsFile {
  return (Join-Path $RootDir '.devtoolbox-diagnostics\package-preflight.txt')
}

function Write-PackageDiagnostics([string]$Platform, [string]$Arch) {
  $file = Get-PackageDiagnosticsFile
  New-Item -ItemType Directory -Force -Path (Split-Path -Parent $file) | Out-Null
  $branch = (& git rev-parse --abbrev-ref HEAD 2>$null)
  $commit = (& git rev-parse --short HEAD 2>$null)
  $mem = Get-MemoryInfo
  @(
    'DevToolBox package diagnostics'
    "Generated: $((Get-Date).ToUniversalTime().ToString('yyyy-MM-ddTHH:mm:ssZ'))"
    "Platform target: $Platform"
    "Arch target: $(if ($Arch) { $Arch } else { 'default' })"
    "Repository: $RootDir"
    "Git branch: $(if ($branch) { $branch } else { 'unknown' })"
    "Git commit: $(if ($commit) { $commit } else { 'unknown' })"
    "OS: $([System.Runtime.InteropServices.RuntimeInformation]::OSDescription)"
    "Node: $(if (Has-Command node) { (& node -v).Trim() } else { 'missing' })"
    "pnpm: $(if (Has-Command pnpm) { (& pnpm -v).Trim() } else { 'missing' })"
    "Memory available: $(Format-Bytes $mem.Available)"
    "Memory total: $(Format-Bytes $mem.Total)"
    "Disk available: $(Format-Bytes (Get-DiskAvailableBytes))"
    "NODE_OPTIONS: $(if ($env:NODE_OPTIONS) { $env:NODE_OPTIONS } else { '<empty>' })"
  ) | Set-Content -LiteralPath $file -Encoding UTF8
  return $file
}

function Test-PackageResources {
  $mem = Get-MemoryInfo
  $disk = Get-DiskAvailableBytes
  Write-SystemSummary
  if ($mem.Available -gt 0 -and $mem.Available -lt 3GB) {
    Write-Err "Packaging needs at least $(Format-Bytes 3GB) available memory; current: $(Format-Bytes $mem.Available)."
    return $false
  }
  if ($mem.Available -gt 0 -and $mem.Available -lt 4GB) {
    Write-WarnLine "Available memory is below the recommended $(Format-Bytes 4GB) for packaging."
  }
  if ($disk -gt 0 -and $disk -lt 8GB) {
    Write-Err "Packaging needs at least $(Format-Bytes 8GB) free disk space; current: $(Format-Bytes $disk)."
    return $false
  }
  if ($disk -gt 0 -and $disk -lt 12GB) {
    Write-WarnLine "Free disk space is below the recommended $(Format-Bytes 12GB) for packaging."
  }
  return $true
}

function Invoke-PackagePreflight([string]$Platform, [string]$Arch) {
  Write-Info 'Running package preflight...'
  $ok = $true
  if (-not (Test-NodeVersion)) { $ok = $false }
  if (-not (Test-PnpmVersion)) { $ok = $false }
  if ($env:DEVTOOLBOX_SKIP_RESOURCE_CHECK -eq '1') {
    Write-WarnLine 'Skipping memory/disk resource checks because DEVTOOLBOX_SKIP_RESOURCE_CHECK=1.'
  } elseif (-not (Test-PackageResources)) {
    $ok = $false
  }
  $diag = Write-PackageDiagnostics $Platform $Arch
  Write-Info "Package diagnostics: $diag"
  if (-not $ok) {
    Write-Err 'Package preflight failed. Fix the issues above and retry.'
    exit 1
  }
  Write-Ok 'Package preflight passed'
}

function Invoke-PackageStep([string]$Label, [string]$File, [string[]]$Arguments) {
  Write-Info "$Label..."
  & $File @Arguments
  if ($LASTEXITCODE -ne 0) {
    Write-Err "Package step failed with exit code $LASTEXITCODE."
    Write-Err "Diagnostics: $(Get-PackageDiagnosticsFile)"
    Write-Err 'Run .\cli.ps1 doctor for environment details.'
    exit $LASTEXITCODE
  }
  Write-Ok "$Label completed"
}

function Get-AppBuilderExecutable {
  $pnpmDir = Join-Path $RootDir 'node_modules\.pnpm'
  if (-not (Test-Path -LiteralPath $pnpmDir -PathType Container)) { return $null }
  $packages = Get-ChildItem -LiteralPath $pnpmDir -Directory -Filter 'app-builder-bin@*' -ErrorAction SilentlyContinue
  foreach ($package in $packages) {
    $candidate = Join-Path $package.FullName 'node_modules\app-builder-bin\win\x64\app-builder.exe'
    if (Test-Path -LiteralPath $candidate -PathType Leaf) { return $candidate }
  }
  return $null
}

function Get-ElectronBuilderCacheRoot {
  if (-not [string]::IsNullOrWhiteSpace($env:ELECTRON_BUILDER_CACHE)) {
    $resolved = Resolve-Path -LiteralPath $env:ELECTRON_BUILDER_CACHE -ErrorAction SilentlyContinue
    if ($resolved) { return $resolved.Path }
    return $env:ELECTRON_BUILDER_CACHE
  }
  $localAppData = if ($env:LOCALAPPDATA) { $env:LOCALAPPDATA } else { Join-Path $HOME 'AppData\Local' }
  return (Join-Path $localAppData 'electron-builder\Cache')
}

function Get-WinCodeSignFinalDir {
  return (Join-Path (Join-Path (Get-ElectronBuilderCacheRoot) 'winCodeSign') 'winCodeSign-2.6.0')
}

function Test-WinCodeSignReady {
  $dir = Get-WinCodeSignFinalDir
  return (
    (Test-Path -LiteralPath (Join-Path $dir 'rcedit-x64.exe') -PathType Leaf) -and
    (Test-Path -LiteralPath (Join-Path $dir 'rcedit-ia32.exe') -PathType Leaf) -and
    (Test-Path -LiteralPath (Join-Path $dir 'windows-10\x64\signtool.exe') -PathType Leaf)
  )
}

function Repair-WinCodeSignCache {
  $cacheDir = Join-Path (Get-ElectronBuilderCacheRoot) 'winCodeSign'
  $finalDir = Get-WinCodeSignFinalDir
  if (Test-WinCodeSignReady) { return $true }
  if (Test-Path -LiteralPath $finalDir) { return $false }
  if (-not (Test-Path -LiteralPath $cacheDir -PathType Container)) { return $false }

  $candidate = Get-ChildItem -LiteralPath $cacheDir -Directory -ErrorAction SilentlyContinue |
    Where-Object {
      $_.Name -ne 'winCodeSign-2.6.0' -and
      (Test-Path -LiteralPath (Join-Path $_.FullName 'rcedit-x64.exe') -PathType Leaf) -and
      (Test-Path -LiteralPath (Join-Path $_.FullName 'rcedit-ia32.exe') -PathType Leaf) -and
      (Test-Path -LiteralPath (Join-Path $_.FullName 'windows-10\x64\signtool.exe') -PathType Leaf)
    } |
    Sort-Object LastWriteTime -Descending |
    Select-Object -First 1

  if (-not $candidate) { return $false }

  Write-WarnLine "Repairing electron-builder winCodeSign cache from partial extraction: $($candidate.Name)"
  New-Item -ItemType Directory -Force -Path $cacheDir | Out-Null
  Copy-Item -LiteralPath $candidate.FullName -Destination $finalDir -Recurse -Force
  return (Test-WinCodeSignReady)
}

function Initialize-WindowsCodeSignTools {
  if (Test-WinCodeSignReady) { return }
  if (Repair-WinCodeSignCache) {
    Write-Ok 'electron-builder winCodeSign cache repaired'
    return
  }

  $appBuilder = Get-AppBuilderExecutable
  if (-not $appBuilder) {
    Write-WarnLine 'Cannot find app-builder.exe in node_modules; electron-builder will try to fetch Windows resource tools during packaging.'
    return
  }

  Write-Info 'Preparing electron-builder Windows resource tools...'
  & $appBuilder 'download-artifact' '--name' 'winCodeSign'
  if ($LASTEXITCODE -eq 0 -and (Test-WinCodeSignReady)) {
    Write-Ok 'electron-builder Windows resource tools are ready'
    return
  }

  if (Repair-WinCodeSignCache) {
    Write-Ok 'electron-builder winCodeSign cache repaired'
    return
  }

  Write-Err 'Failed to prepare electron-builder winCodeSign tools.'
  Write-Err 'If GitHub download returns 504, retry later or configure ELECTRON_BUILDER_BINARIES_MIRROR.'
  Write-Err 'If extraction reports symbolic-link privileges, enable Windows Developer Mode or run PowerShell as Administrator.'
  exit 1
}

function Get-WindowsUserDataFallback {
  if ($env:APPDATA) { return (Join-Path $env:APPDATA 'DevToolBox-dev') }
  return (Join-Path $HOME 'AppData\Roaming\DevToolBox-dev')
}

function Invoke-Doctor {
  Ensure-Command node
  Ensure-Command pnpm
  $status = 0
  if (Test-NodeVersion) {
    Write-Ok "Node $((& node -v).Trim()) | pnpm $((& pnpm -v).Trim())"
  } else {
    $status = 1
  }
  if (-not (Test-PnpmVersion)) { $status = 1 }
  if (Has-Command git) { Write-Ok ((& git --version).Trim()) }
  if (-not (Has-Command zip)) { Write-WarnLine 'zip command not found. Marketplace packaging currently requires zip.' }
  Write-SystemSummary
  $devPort = if ($env:DEVTOOLBOX_DEV_PORT) { [int]$env:DEVTOOLBOX_DEV_PORT } else { 5173 }
  if (Test-PortInUse $devPort) {
    Write-WarnLine "Dev port $devPort is in use:"
    Write-PortOwner $devPort
  } else {
    Write-Ok "Dev port $devPort is free"
  }
  if ($status -ne 0) { exit $status }
}

function Invoke-Dev([string[]]$ViteArgs) {
  Ensure-ToolVersions
  Remove-Item Env:NODE_OPTIONS -ErrorAction SilentlyContinue
  if (-not $env:DEVTOOLBOX_DEBUG) { $env:DEVTOOLBOX_DEBUG = '1' }

  $args = @()
  if ($ViteArgs) { $args += $ViteArgs }
  $hasPortArg = $false
  foreach ($arg in $ViteArgs) {
    if ($arg -eq '--port' -or $arg -eq '-p' -or $arg.StartsWith('--port=')) { $hasPortArg = $true }
  }
  if (-not $hasPortArg) {
    $desired = if ($env:DEVTOOLBOX_DEV_PORT) { [int]$env:DEVTOOLBOX_DEV_PORT } else { 5173 }
    $selectedPort = @(Select-DevPort $desired)[-1]
    $args += @('--port', [string]$selectedPort)
  }
  Invoke-Checked 'pnpm' (@('exec', 'vite') + $args)
}

function Invoke-Build {
  Ensure-ToolVersions
  Invoke-Checked 'pnpm' @('build')
}

function Remove-Paths([string[]]$Paths) {
  foreach ($path in $Paths) {
    if (Test-Path -LiteralPath $path) {
      Remove-Item -LiteralPath $path -Recurse -Force -ErrorAction SilentlyContinue
    }
  }
}

function Invoke-Clear {
  $candidates = New-Object System.Collections.Generic.List[string]
  foreach ($base in @($env:APPDATA, $env:LOCALAPPDATA)) {
    if (-not $base) { continue }
    foreach ($name in @('DevToolBox-dev', 'DevToolBox', 'cross-platform-toolbox')) {
      $path = Join-Path $base $name
      if ((Test-Path -LiteralPath $path -PathType Container) -and -not $candidates.Contains($path)) {
        [void]$candidates.Add($path)
      }
    }
  }

  if ($candidates.Count -eq 0) {
    $userData = Get-WindowsUserDataFallback
  } elseif ($candidates.Count -eq 1) {
    $userData = $candidates[0]
  } else {
    Write-Info 'Found multiple user data directories:'
    for ($i = 0; $i -lt $candidates.Count; $i++) { Write-Host ("  [{0}] {1}" -f ($i + 1), $candidates[$i]) }
    $picked = Prompt 'Select a directory index to clear' '1'
    [int]$index = 0
    if (-not [int]::TryParse($picked, [ref]$index) -or $index -lt 1 -or $index -gt $candidates.Count) {
      Write-Err "Invalid selection: $picked"
      exit 1
    }
    $userData = $candidates[$index - 1]
  }

  Write-Info "User data dir: $userData"
  if (-not (Test-Path -LiteralPath $userData -PathType Container)) {
    Write-Err "User data dir not found: $userData"
    Write-Info 'Launch the app once (.\cli.ps1 dev) to create it, then retry.'
    exit 1
  }

  Write-Info 'This command deletes local files. Close DevToolBox before continuing.'
  if (-not (Confirm 'Continue' 'n')) { Write-Info 'Cancelled'; return }

  if (Confirm '1) Clear saved app info (Local Storage / Session / Cookies / Preferences / Cache)' 'n') {
    Remove-Paths @(
      (Join-Path $userData 'Local Storage'),
      (Join-Path $userData 'Session Storage'),
      (Join-Path $userData 'Cache'),
      (Join-Path $userData 'Code Cache'),
      (Join-Path $userData 'GPUCache'),
      (Join-Path $userData 'blob_storage'),
      (Join-Path $userData 'DawnGraphiteCache'),
      (Join-Path $userData 'DawnWebGPUCache'),
      (Join-Path $userData 'Preferences'),
      (Join-Path $userData 'Cookies'),
      (Join-Path $userData 'Cookies-journal'),
      (Join-Path $userData 'Network Persistent State'),
      (Join-Path $userData 'SharedStorage'),
      (Join-Path $userData 'SharedStorage-wal')
    )
    Write-Ok 'Saved app info cleared'
  }

  if (Confirm '2) Clear marketplace-installed plugins (uninstall all)' 'n') {
    Remove-Paths @((Join-Path $userData 'modules'), (Join-Path $userData 'plugins'), (Join-Path $userData 'plugin-kv.json'))
    New-Item -ItemType Directory -Force -Path (Join-Path $userData 'modules') | Out-Null
    New-Item -ItemType Directory -Force -Path (Join-Path $userData 'plugins') | Out-Null
    "{`n  `"installed`": {}`n}`n" | Set-Content -LiteralPath (Join-Path $userData 'marketplace-state.json') -Encoding UTF8
    Write-Ok 'Marketplace plugins cleared'
  }

  if (Confirm '3) Clear marketplace cache (registries/download cache)' 'n') {
    Remove-Paths @((Join-Path $userData 'marketplace-cache'))
    New-Item -ItemType Directory -Force -Path (Join-Path $userData 'marketplace-cache') | Out-Null
    Write-Ok 'Marketplace cache cleared'
  }

  if (Confirm '4) Clear plugin KV storage (plugin-kv.json)' 'n') {
    Remove-Paths @((Join-Path $userData 'plugin-kv.json'))
    Write-Ok 'Plugin KV cleared'
  }

  if (Confirm '5) Reset device-id (affects device-bound backup encryption)' 'n') {
    Remove-Paths @((Join-Path $userData 'device-id.txt'))
    Write-Ok 'device-id reset (will be regenerated on next run)'
  }

  if (Confirm '6) Init marketplace/registry.local.json and clear marketplace/.local-dist' 'n') {
    $dist = Join-Path $RootDir 'marketplace\.local-dist'
    New-Item -ItemType Directory -Force -Path $dist | Out-Null
    Get-ChildItem -LiteralPath $dist -Force | Remove-Item -Recurse -Force -ErrorAction SilentlyContinue
    "{`n  `"schemaVersion`": 1,`n  `"plugins`": []`n}`n" | Set-Content -LiteralPath (Join-Path $RootDir 'marketplace\registry.local.json') -Encoding UTF8
    Write-Ok 'Local registry initialized'
  }

  if (Confirm '7) Clear build artifacts (dist / dist-electron / release)' 'n') {
    Remove-Paths @((Join-Path $RootDir 'dist'), (Join-Path $RootDir 'dist-electron'), (Join-Path $RootDir 'release'))
    Write-Ok 'Build artifacts cleared'
  }

  Write-Ok 'Done'
}

function Escape-JsonText([string]$Value) {
  if ($null -eq $Value) { return '' }
  return ($Value -replace '\\', '\\' -replace '"', '\"' -replace "`r?`n", ' ')
}

function New-MarketplacePlugin {
  $pluginId = (Prompt 'Plugin ID (e.g. market-hello-tool)' '').Trim()
  if (-not $pluginId) { Write-Err 'Plugin ID is required'; exit 1 }
  if ($pluginId -notmatch '^[a-z0-9]+(-[a-z0-9]+)*$') { Write-Err "Invalid plugin id: $pluginId (expected kebab-case)"; exit 1 }
  if ($pluginId -notmatch '^market-') { Write-Err "Invalid plugin id: $pluginId (must start with market-)"; exit 1 }

  $name = Prompt 'Plugin Name' $pluginId
  $description = Prompt 'Description' 'A marketplace plugin for DevToolBox'
  $version = Prompt 'Version' '0.1.0'
  $sdkVersion = Prompt 'SDK Version' '1.0'
  $categoryId = Prompt 'categoryId (dev-tools/text-tools/network-tools/security-tools/other-tools)' 'dev-tools'
  $author = Prompt 'Author' 'DevToolBox'
  $license = Prompt 'License' 'Apache-2.0'
  $homepage = Prompt 'Homepage' 'https://example.com'
  $repository = Prompt 'Repository' 'https://example.com'
  $permissionsRaw = Prompt 'Permissions (comma separated)' 'storage:kv,system:getInfo,system:notifications'

  $moduleDir = Join-Path $RootDir "marketplace\modules\$pluginId"
  if (Test-Path -LiteralPath $moduleDir) { Write-Err "Target already exists: marketplace\modules\$pluginId"; exit 1 }
  New-Item -ItemType Directory -Force -Path (Join-Path $moduleDir 'src') | Out-Null

  $permissions = @()
  if (-not [string]::IsNullOrWhiteSpace($permissionsRaw)) {
    $permissions = $permissionsRaw.Split(',') | ForEach-Object { $_.Trim() } | Where-Object { $_ }
  }
  $permissionsJson = ConvertTo-Json -InputObject $permissions -Compress

  @"
{
  "id": "$(Escape-JsonText $pluginId)",
  "name": "$(Escape-JsonText $name)",
  "description": "$(Escape-JsonText $description)",
  "version": "$(Escape-JsonText $version)",
  "sdkVersion": "$(Escape-JsonText $sdkVersion)",
  "entry": "package/index.html",
  "categoryId": "$(Escape-JsonText $categoryId)",
  "author": "$(Escape-JsonText $author)",
  "license": "$(Escape-JsonText $license)",
  "homepage": "$(Escape-JsonText $homepage)",
  "repository": "$(Escape-JsonText $repository)",
  "permissions": $permissionsJson
}
"@ | Set-Content -LiteralPath (Join-Path $moduleDir 'manifest.json') -Encoding UTF8

  @"
{
  "name": "@devtoolbox/plugin-$pluginId",
  "private": true,
  "version": "$version",
  "type": "module",
  "scripts": {
    "dev": "vite --config ../../shared/vite.config.ts",
    "build": "tsc -p tsconfig.json --noEmit && vite build --config ../../shared/vite.config.ts"
  },
  "dependencies": {
    "@devtoolbox/plugin-sdk": "workspace:*",
    "react": "^18.3.1",
    "react-dom": "^18.3.1"
  },
  "devDependencies": {
    "@types/react": "^18.3.12",
    "@types/react-dom": "^18.3.1",
    "@vitejs/plugin-react": "^4.3.4",
    "typescript": "^5.6.3",
    "vite": "^6.0.5"
  }
}
"@ | Set-Content -LiteralPath (Join-Path $moduleDir 'package.json') -Encoding UTF8

  @'
{
  "extends": "../../tsconfig.plugin.json",
  "include": ["src"]
}
'@ | Set-Content -LiteralPath (Join-Path $moduleDir 'tsconfig.json') -Encoding UTF8

  @'
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>DevToolBox Plugin</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
'@ | Set-Content -LiteralPath (Join-Path $moduleDir 'index.html') -Encoding UTF8

  @'
import App from './App';
import { mountPlugin } from '@devtoolbox/plugin-sdk/react';
import './style.css';

mountPlugin(<App />);
'@ | Set-Content -LiteralPath (Join-Path $moduleDir 'src\main.tsx') -Encoding UTF8

  @"
import { useEffect, useState } from 'react';
import { sdk } from '@devtoolbox/plugin-sdk';

type Info = { platform?: string; arch?: string; appVersion?: string };

export default function App() {
  const [info, setInfo] = useState<Info | null>(null);
  const [kv, setKv] = useState('');

  useEffect(() => {
    void (async () => {
      const res = await sdk.system.getInfo();
      if (res.ok) setInfo((res.data ?? null) as any);
    })();
  }, []);

  const writeSample = async () => {
    await sdk.storage.set('sample.key', { ts: Date.now(), msg: 'hello' });
    const v = await sdk.storage.get('sample.key');
    setKv(JSON.stringify(v, null, 2));
  };

  return (
    <div className="app">
      <h1>$name</h1>
      <div className="muted">$description</div>
      <div className="card">
        <div className="row">
          <button onClick={() => void writeSample()}>Storage Sample</button>
          <button
            onClick={() =>
              void sdk.system.notify({ title: 'DevToolBox', body: 'Hello from marketplace plugin', level: 'info' })
            }
          >
            Notify
          </button>
        </div>
        <pre className="pre">{kv || 'Click "Storage Sample" to test sdk.storage'}</pre>
      </div>
      <div className="card">
        <div className="label">system.getInfo</div>
        <pre className="pre">{info ? JSON.stringify(info, null, 2) : 'Loading...'}</pre>
      </div>
    </div>
  );
}
"@ | Set-Content -LiteralPath (Join-Path $moduleDir 'src\App.tsx') -Encoding UTF8

  @'
html,
body {
  margin: 0;
  padding: 0;
  font-family: system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif;
  background: #0e1116;
  color: #e9eef5;
}

.app {
  padding: 16px;
}

.muted {
  color: rgba(233, 238, 245, 0.7);
  font-size: 13px;
  margin-top: 6px;
}

.card {
  margin-top: 12px;
  padding: 12px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.04);
}

.row {
  display: flex;
  gap: 10px;
}

button {
  padding: 8px 10px;
  border-radius: 8px;
  border: 1px solid rgba(255, 255, 255, 0.14);
  background: rgba(255, 255, 255, 0.06);
  color: #e9eef5;
  cursor: pointer;
}

button:hover {
  border-color: rgba(74, 163, 255, 0.6);
}

.label {
  font-size: 12px;
  color: rgba(233, 238, 245, 0.7);
  margin-bottom: 6px;
}

.pre {
  margin: 10px 0 0 0;
  padding: 10px;
  border-radius: 8px;
  background: rgba(0, 0, 0, 0.25);
  overflow: auto;
  font-size: 12px;
}
'@ | Set-Content -LiteralPath (Join-Path $moduleDir 'src\style.css') -Encoding UTF8

  Write-Ok "Created marketplace plugin template: marketplace\modules\$pluginId"
  Write-Info 'Next:'
  Write-Info '  pnpm install'
  Write-Info "  .\cli.ps1 plugin doctor $pluginId"
  Write-Info "  .\cli.ps1 plugin dev $pluginId"
  Write-Info "  .\cli.ps1 plugin $pluginId"
}

function Resolve-PluginId([string]$PluginId, [string]$PromptLabel = 'Plugin ID (e.g. market-hello-tool)') {
  $value = $PluginId
  if (-not $value) { $value = Prompt $PromptLabel '' }
  $value = $value.Trim()
  if (-not $value) { Write-Err 'Plugin ID is required'; exit 1 }
  if ($value -notmatch '^[a-z0-9]+(-[a-z0-9]+)*$') { Write-Err "Invalid plugin id: $value (expected kebab-case)"; exit 1 }
  if ($value -notmatch '^market-') { Write-Err "Invalid plugin id: $value (must start with market-)"; exit 1 }
  if (-not (Test-Path -LiteralPath (Join-Path $RootDir "marketplace\modules\$value") -PathType Container)) {
    Write-Err "Plugin not found: marketplace/modules/$value"
    exit 1
  }
  return $value
}

function Invoke-Plugin([string[]]$PluginArgs) {
  Ensure-ToolVersions
  $action = if ($PluginArgs.Count -gt 0) { $PluginArgs[0] } else { '' }

  if ($action -eq 'create') { New-MarketplacePlugin; return }

  if ($action -eq 'init-local') { Initialize-LocalMarketplaceRegistry; return }

  if ($action -eq 'doctor') {
    $target = if ($PluginArgs.Count -gt 1) { $PluginArgs[1] } else { '' }
    if (-not $target) { $target = Prompt 'Plugin ID or all' 'all' }
    $target = $target.Trim()
    if (-not $target) { Write-Err 'Plugin ID or all is required'; exit 1 }
    Invoke-Checked 'node' @('scripts/marketplace-doctor.mjs', $target)
    return
  }

  if ($action -eq 'dev') {
    $pluginId = Resolve-PluginId $(if ($PluginArgs.Count -gt 1) { $PluginArgs[1] } else { '' })
    Write-Info "Starting plugin dev server: $pluginId"
    Write-Info "For app install testing, stop this server and run: .\cli.ps1 plugin $pluginId"
    Write-Info 'Then set Settings -> Marketplace Registry URL to the local registry URL printed by the package command.'
    Invoke-Checked 'pnpm' @('--filter', "@devtoolbox/plugin-$pluginId", 'dev')
    return
  }

  if ($action -eq 'all') {
    $ids = Get-ChildItem -LiteralPath (Join-Path $RootDir 'marketplace\modules') -Directory -Filter 'market-*' | ForEach-Object { $_.Name }
    if (-not $ids) { Write-Err 'No marketplace plugins found under marketplace/modules'; exit 1 }

    Write-Info 'Building Plugin SDK release output'
    Invoke-Checked 'pnpm' @('--filter', '@devtoolbox/plugin-sdk', 'build')

    Write-Info "Building plugins: $($ids.Count)"
    foreach ($id in $ids) {
      Write-Info "  build: $id"
      Invoke-Checked 'pnpm' @('--filter', "@devtoolbox/plugin-$id", 'build')
    }
    Write-Ok 'All plugin builds completed'

    if (-not (Has-Command zip)) { Write-Err 'Missing command: zip. Install Git for Windows, MSYS2, or another zip provider before packing marketplace plugins.'; exit 1 }
    Write-Info 'Packing plugins into local registry zip (merge)'
    Invoke-Checked 'node' (@('marketplace/scripts/pack-local.mjs', '--merge') + $ids)
    Write-Ok 'Plugin pack completed'
    Write-LocalMarketplacePreviewSteps
    return
  }

  $pluginId = Resolve-PluginId $action

  Write-Info 'Building Plugin SDK release output'
  Invoke-Checked 'pnpm' @('--filter', '@devtoolbox/plugin-sdk', 'build')

  Write-Info "Building plugin: $pluginId"
  Invoke-Checked 'pnpm' @('--filter', "@devtoolbox/plugin-$pluginId", 'build')
  Write-Ok 'Plugin build completed'

  if (-not (Has-Command zip)) { Write-Err 'Missing command: zip. Install Git for Windows, MSYS2, or another zip provider before packing marketplace plugins.'; exit 1 }
  Write-Info "Packing plugin into local registry zip (merge): $pluginId"
  Invoke-Checked 'node' @('marketplace/scripts/pack-local.mjs', '--merge', $pluginId)
  Write-Ok 'Plugin pack completed'
  Write-LocalMarketplacePreviewSteps
}

function Invoke-Package([string[]]$PackageArgs) {
  $platform = if ($PackageArgs.Count -gt 0) { $PackageArgs[0] } else { '' }
  $arch = if ($PackageArgs.Count -gt 1) { $PackageArgs[1] } else { '' }
  if (-not $platform) { $platform = Prompt 'Platform (windows/all)' 'windows' }
  if ($platform -notin @('windows', 'all')) { Write-Err "Invalid platform for Windows script: $platform"; exit 1 }
  if ($arch -and $arch -ne 'x64') { Write-Err "Invalid arch for Windows packaging: $arch"; exit 1 }
  if ($platform -eq 'all') { Write-Info 'Windows script packages Windows artifacts only; treating platform=all as windows.' }

  Ensure-Command node
  Ensure-Command pnpm
  Remove-Item Env:NODE_OPTIONS -ErrorAction SilentlyContinue
  $env:npm_config_jobs = if ($env:npm_config_jobs) { $env:npm_config_jobs } else { '1' }

  Invoke-PackagePreflight 'windows' $arch
  Invoke-PackageStep 'Installing dependencies' 'pnpm' @('install', '--frozen-lockfile', '--child-concurrency=1')
  Initialize-WindowsCodeSignTools
  Invoke-PackageStep 'Building' 'pnpm' @('build')
  Invoke-PackageStep 'Checking bundle budget' 'pnpm' @('bundle:check')
  Invoke-PackageStep 'Generating supply-chain reports' 'pnpm' @('supply-chain:generate')

  & node -p "require('electron/package.json').version" *> $null
  if ($LASTEXITCODE -ne 0) {
    Write-Err 'Cannot resolve electron from node_modules. Run pnpm install in devToolBox.'
    exit 1
  }
  Invoke-PackageStep 'Validating esbuild binary' 'node' @('-e', "require('esbuild').transformSync('const ok = true', { minify: true })")

  $builderArgs = @('exec', 'electron-builder', '--win')
  if ($arch -eq 'x64') { $builderArgs += '--x64' }
  $builderArgs += '--publish'
  $builderArgs += 'never'
  Invoke-PackageStep "Packaging (windows$(if ($arch) { '/' + $arch } else { '' }))" 'pnpm' $builderArgs

  $releaseDir = Join-Path $RootDir 'release'
  if (Test-Path -LiteralPath $releaseDir -PathType Container) {
    Get-ChildItem -LiteralPath $releaseDir -Filter '*.zip*' -File -ErrorAction SilentlyContinue | Remove-Item -Force -ErrorAction SilentlyContinue
    Write-Info 'Artifacts:'
    Get-ChildItem -LiteralPath $releaseDir -Filter '*.exe' -File -Recurse | ForEach-Object { Write-Host $_.FullName }
  }
}

function Invoke-Check {
  Ensure-ToolVersions
  Invoke-Checked 'pnpm' @('lint')
  Invoke-Checked 'pnpm' @('typecheck')
  Invoke-Checked 'pnpm' @('test')
  Write-Ok 'Checks passed'
}

switch ($Command) {
  { $_ -in @('help', '-h', '--help') } { Show-Usage; break }
  'doctor' { Invoke-Doctor; break }
  'dev' { Invoke-Dev $Rest; break }
  'build' { Invoke-Build; break }
  'clear' { Invoke-Clear; break }
  'plugin' { Invoke-Plugin $Rest; break }
  'package' { Invoke-Package $Rest; break }
  'check' { Invoke-Check; break }
  'tool' {
    $sub = if ($Rest.Count -gt 0) { $Rest[0] } else { '' }
    if ($sub -eq 'new') {
      Ensure-ToolVersions
      Invoke-Checked 'pnpm' @('new:tool')
      break
    }
    Write-Err "Unknown tool subcommand: $sub"
    Show-Usage
    exit 1
  }
  default {
    Write-Err "Unknown command: $Command"
    Show-Usage
    exit 1
  }
}
