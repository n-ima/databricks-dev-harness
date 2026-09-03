[CmdletBinding()]
param(
  [string]$ProjectName,
  [string]$DisplayName,
  [string]$Profile,
  [string]$HostUrl,
  [switch]$Authenticate,
  [switch]$InstallPrerequisites,
  [switch]$InstallExtensions,
  [switch]$SkipAgentSkills,
  [switch]$RefreshSkills
)

$ErrorActionPreference = "Stop"
$RepositoryRoot = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot ".."))
$HarnessCli = Join-Path $RepositoryRoot "tools\harness.mjs"

function Ensure-Command {
  param([string]$Name, [string]$WingetId)
  if (Get-Command $Name -ErrorAction SilentlyContinue) { return }
  if (-not $InstallPrerequisites) {
    throw "$Name is required. Re-run with -InstallPrerequisites or install it first."
  }
  if (-not (Get-Command winget -ErrorAction SilentlyContinue)) {
    throw "winget is required for automatic prerequisite installation."
  }
  & winget install --id $WingetId --exact --accept-package-agreements --accept-source-agreements
  if ($LASTEXITCODE -ne 0) { throw "Failed to install $Name." }
  $machinePath = [Environment]::GetEnvironmentVariable("Path", "Machine")
  $userPath = [Environment]::GetEnvironmentVariable("Path", "User")
  $env:Path = "$machinePath;$userPath"
  if (-not (Get-Command $Name -ErrorAction SilentlyContinue)) {
    throw "$Name was installed but is not available in this process. Open a new terminal and rerun setup."
  }
}

function Get-PythonInventory {
  $candidates = @(
    @{ Name = "python"; Prefix = @() },
    @{ Name = "python3"; Prefix = @() },
    @{ Name = "py"; Prefix = @("-3") }
  )
  if ($env:HARNESS_TEST_PYTHON) {
    $candidates = @(@{ Name = $env:HARNESS_TEST_PYTHON; Prefix = @() })
  }
  foreach ($candidate in $candidates) {
    $command = Get-Command $candidate.Name -CommandType Application -ErrorAction SilentlyContinue | Select-Object -First 1
    if (-not $command) { continue }
    # Do not open the Microsoft Store through a Python app-execution alias.
    if ($command.Source -match '[\\/]Microsoft[\\/]WindowsApps[\\/]python3?\.exe$') { continue }
    $probeArgs = @($candidate.Prefix) + @("-c", "import sys; print('.'.join(str(value) for value in sys.version_info[:3]))")
    try {
      $versionText = (& $command.Source @probeArgs 2>$null | Out-String).Trim()
      if ($LASTEXITCODE -eq 0 -and $versionText -match '^\d+\.\d+\.\d+$') {
        [pscustomobject]@{ Command = $candidate.Name; Version = [version]$versionText }
      }
    } catch { continue }
  }
}

function Ensure-Python {
  $inventory = @(Get-PythonInventory)
  foreach ($python in $inventory) { Write-Host "Python inventory: $($python.Command) $($python.Version)" }
  if ($inventory | Where-Object { $_.Version -ge [version]"3.10.0" }) { return }
  if ($env:HARNESS_TEST_PYTHON) {
    throw "HARNESS_TEST_PYTHON must name a working Python 3.10+ executable. Correct this explicit selection; no installer or fallback was used."
  }
  if ($inventory.Count -gt 0) {
    throw "Only unsupported Python versions were found. Python 3.10+ is required for generated contract tests. Use your organization's approved package manager or select an approved interpreter with HARNESS_TEST_PYTHON; existing Python is never upgraded automatically."
  }
  if (-not $InstallPrerequisites) {
    throw "Python 3.10+ is required for generated contract tests. Install it using your organization's approved package manager, or explicitly opt in to winget Python 3.12 with -InstallPrerequisites. This is independent of the Databricks Runtime Python version."
  }
  if (-not (Get-Command winget -ErrorAction SilentlyContinue)) {
    throw "winget is unavailable. Install Python 3.10+ using your organization's approved package manager, then rerun setup."
  }
  # Verified 2026-09-04: microsoft/winget-pkgs manifests/p/Python/Python/3/12/3.12.10.
  Write-Host "Opt-in installation of Python 3.12 (current user) via winget. Use this only when permitted by your organization's package policy."
  & winget install --id Python.Python.3.12 --exact --scope user --accept-package-agreements --accept-source-agreements
  if ($LASTEXITCODE -ne 0) { throw "Failed to install Python 3.12." }
  $machinePath = [Environment]::GetEnvironmentVariable("Path", "Machine")
  $userPath = [Environment]::GetEnvironmentVariable("Path", "User")
  $env:Path = "$machinePath;$userPath"
  $installed = @(Get-PythonInventory)
  if (-not ($installed | Where-Object { $_.Version -ge [version]"3.10.0" })) {
    throw "Python was installed but Python 3.10+ is not available in this process. Open a new terminal and rerun setup."
  }
  foreach ($python in $installed) { Write-Host "Python inventory: $($python.Command) $($python.Version)" }
}

Ensure-Command -Name "node" -WingetId "OpenJS.NodeJS.LTS"
Ensure-Command -Name "git" -WingetId "Git.Git"
Ensure-Command -Name "databricks" -WingetId "Databricks.DatabricksCLI"
Ensure-Python

$nodeVersionText = (& node --version).Trim().TrimStart("v")
if ([version]$nodeVersionText -lt [version]"22.0.0") {
  throw "Node.js 22 or newer is required; found $nodeVersionText."
}
$databricksVersionText = (& databricks --version | Out-String)
if ($databricksVersionText -notmatch '(\d+)\.(\d+)\.(\d+)') {
  throw "Could not determine the Databricks CLI version."
}
$databricksVersion = [version]"$($Matches[1]).$($Matches[2]).$($Matches[3])"
if ($databricksVersion -lt [version]"1.6.0" -or $databricksVersion -ge [version]"2.0.0") {
  throw "Databricks CLI >=1.6.0 and <2.0.0 is required; found $databricksVersion. Upgrade with your approved package manager, then rerun."
}

$harnessArgs = @("setup")
if ($ProjectName) { $harnessArgs += @("--project-name", $ProjectName) }
if ($DisplayName) { $harnessArgs += @("--display-name", $DisplayName) }
if ($Profile) { $harnessArgs += @("--profile", $Profile) }
if ($HostUrl) { $harnessArgs += @("--host", $HostUrl) }
if ($Authenticate) { $harnessArgs += "--auth" }
if ($SkipAgentSkills) { $harnessArgs += "--skip-agent-skills" }
if ($RefreshSkills) { $harnessArgs += "--refresh-skills" }

& node $HarnessCli @harnessArgs
if ($LASTEXITCODE -ne 0) { throw "Harness setup failed." }

if ($InstallExtensions) {
  Ensure-Command -Name "code" -WingetId "Microsoft.VisualStudioCode"
  foreach ($extension in @("databricks.databricks", "github.copilot-chat", "anthropic.claude-code")) {
    & code --install-extension $extension
    if ($LASTEXITCODE -ne 0) { throw "Could not install VS Code extension: $extension" }
  }
}
Write-Host "Local files are ready. Open VS Code and sign in to your selected agent. This script does not purchase a subscription or grant workspace permissions."
