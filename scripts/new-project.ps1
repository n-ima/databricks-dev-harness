[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)]
  [ValidatePattern("^[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+$")]
  [string]$Template,
  [Parameter(Mandatory = $true)]
  [ValidatePattern("^[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+$")]
  [string]$Repository,
  [Parameter(Mandatory = $true)]
  [string]$LocalPath,
  [ValidateSet("private", "internal", "public")]
  [string]$Visibility = "private",
  [string]$ProjectName,
  [string]$DisplayName,
  [string]$Profile,
  [string]$HostUrl,
  [switch]$Authenticate,
  [switch]$InstallPrerequisites,
  [switch]$InstallExtensions
)

$ErrorActionPreference = "Stop"
if (-not (Get-Command gh -ErrorAction SilentlyContinue)) { throw "GitHub CLI (gh) is required." }
if (Test-Path -LiteralPath $LocalPath) { throw "LocalPath already exists: $LocalPath" }
if (($Profile -and -not $HostUrl) -or ($HostUrl -and -not $Profile)) { throw "Provide both Profile and HostUrl before creating the repository." }
if ($Authenticate -and (-not $Profile -or -not $HostUrl)) { throw "Authenticate requires Profile and HostUrl." }
if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
  if (-not $InstallPrerequisites -or -not (Get-Command winget -ErrorAction SilentlyContinue)) { throw "Git is required before creating/cloning a repository. Install Git or pass -InstallPrerequisites with winget available." }
  & winget install --id Git.Git --exact --accept-package-agreements --accept-source-agreements
  if ($LASTEXITCODE -ne 0) { throw "Git installation failed; no repository was created." }
  $env:Path = [Environment]::GetEnvironmentVariable("Path", "Machine") + ";" + [Environment]::GetEnvironmentVariable("Path", "User")
  if (-not (Get-Command git -ErrorAction SilentlyContinue)) { throw "Open a new terminal after Git installation and rerun; no repository was created." }
}
$ResolvedLocalPath = [System.IO.Path]::GetFullPath($LocalPath)

& gh auth status
if ($LASTEXITCODE -ne 0) { throw "Authenticate GitHub CLI with: gh auth login" }

& gh repo create $Repository --template $Template "--$Visibility"
if ($LASTEXITCODE -ne 0) { throw "Could not create $Repository from $Template." }

& gh repo clone $Repository $ResolvedLocalPath
if ($LASTEXITCODE -ne 0) { throw "Repository was created, but clone failed: $Repository" }

$setup = Join-Path $ResolvedLocalPath "scripts\setup.ps1"
$resolvedProjectName = if ($ProjectName) { $ProjectName } else { ($Repository -split "/")[-1] }
$setupArgs = @{
  ProjectName = $resolvedProjectName
}
if ($DisplayName) { $setupArgs.DisplayName = $DisplayName }
if ($Profile) { $setupArgs.Profile = $Profile }
if ($HostUrl) { $setupArgs.HostUrl = $HostUrl }
if ($Authenticate) { $setupArgs.Authenticate = $true }
if ($InstallPrerequisites) { $setupArgs.InstallPrerequisites = $true }
if ($InstallExtensions) { $setupArgs.InstallExtensions = $true }

& $setup @setupArgs
Write-Host "Project ready: $LocalPath"
