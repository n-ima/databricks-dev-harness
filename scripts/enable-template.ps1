[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)]
  [ValidatePattern("^[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+$")]
  [string]$Repository
)

$ErrorActionPreference = "Stop"
if (-not (Get-Command gh -ErrorAction SilentlyContinue)) {
  throw "GitHub CLI (gh) is required."
}

& gh auth status
if ($LASTEXITCODE -ne 0) { throw "Authenticate GitHub CLI with: gh auth login" }

& gh api --method PATCH "repos/$Repository" -F is_template=true
if ($LASTEXITCODE -ne 0) { throw "Could not enable template repository for $Repository." }

Write-Host "Template repository enabled: $Repository"
