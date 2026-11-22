param(
    [string]$Path = (Join-Path $PSScriptRoot '..\..\docs\development-process.md')
)

$ErrorActionPreference = 'Stop'
$resolvedPath = (Resolve-Path -LiteralPath $Path).Path
$content = Get-Content -LiteralPath $resolvedPath -Raw -Encoding UTF8

if ($content -notmatch '(?m)^# JIJU ') {
    throw 'Missing development process title.'
}
if (-not $content.Contains('PROCESS-JIJU-001')) {
    throw 'Missing development process document ID.'
}

foreach ($section in 1..20) {
    if ($content -notmatch "(?m)^## $section\. ") {
        throw "Missing development process section: $section"
    }
}

$requiredStatements = @(
    'Definition of Ready',
    'Definition of Done',
    'RACI',
    'Idempotency-Key',
    'Prisma schema',
    'Verify-Production.ps1',
    '```mermaid',
    '[ ]'
)

foreach ($statement in $requiredStatements) {
    if (-not $content.Contains($statement)) {
        throw "Development process missing required statement: $statement"
    }
}

$mermaidBlocks = [regex]::Matches($content, '```mermaid').Count
if ($mermaidBlocks -lt 2) {
    throw "Expected at least two Mermaid diagrams, found $mermaidBlocks."
}

$checklistItems = [regex]::Matches($content, '(?m)^- \[ \] ').Count
if ($checklistItems -lt 10) {
    throw "Expected at least ten checklist items, found $checklistItems."
}

Write-Host "Development process validation passed: 20 sections, $mermaidBlocks diagrams, and $checklistItems checklist items."
