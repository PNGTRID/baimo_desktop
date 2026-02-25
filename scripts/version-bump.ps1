# Version Bump Script
# Usage: .\scripts\version-bump.ps1 [patch|minor|major]
# Default: patch

param(
    [ValidateSet('patch', 'minor', 'major')]
    [string]$Level = 'patch'
)

$ErrorActionPreference = 'Stop'

# File paths
$TauriConfig = 'src-tauri/tauri.conf.json'
$PackageJson = 'package.json'

# Read current version
function Get-Version {
    param([string]$Path)
    $content = Get-Content $Path -Raw | ConvertFrom-Json
    return $content.version
}

# Write new version
function Set-Version {
    param(
        [string]$Path,
        [string]$NewVersion
    )
    $content = Get-Content $Path -Raw | ConvertFrom-Json
    $content.version = $NewVersion
    $content | ConvertTo-Json -Depth 10 | Set-Content $Path -NoNewline
}

# Increment version
function Increment-Version {
    param(
        [string]$Version,
        [string]$Level
    )
    $parts = $Version -split '\.'
    $major = [int]$parts[0]
    $minor = [int]$parts[1]
    $patch = [int]$parts[2]

    switch ($Level) {
        'patch' { $patch++ }
        'minor' { $minor++; $patch = 0 }
        'major' { $major++; $minor = 0; $patch = 0 }
    }

    return "$major.$minor.$patch"
}

# Main flow
Write-Host "`n============================================" -ForegroundColor Cyan
Write-Host "   Version Bump Script" -ForegroundColor Cyan
Write-Host "============================================`n" -ForegroundColor Cyan

$currentVersion = Get-Version $PackageJson
$newVersion = Increment-Version $currentVersion $Level

Write-Host "Current version: $currentVersion" -ForegroundColor Yellow
Write-Host "Bump level:      $Level" -ForegroundColor Yellow
Write-Host "New version:     $newVersion" -ForegroundColor Green

# Confirm
$confirm = Read-Host "`nConfirm update? [Y/n]"
if ($confirm -eq 'n' -or $confirm -eq 'N') {
    Write-Host "Operation cancelled" -ForegroundColor Gray
    exit 0
}

# Update files
Write-Host "`nUpdating files..." -ForegroundColor Gray
Set-Version $TauriConfig $newVersion
Set-Version $PackageJson $newVersion

Write-Host "OK $TauriConfig -> $newVersion" -ForegroundColor Green
Write-Host "OK $PackageJson -> $newVersion" -ForegroundColor Green

Write-Host "`nVersion updated successfully!`n" -ForegroundColor Green
