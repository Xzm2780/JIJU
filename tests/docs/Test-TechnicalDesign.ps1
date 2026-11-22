param(
    [string]$Path = (Join-Path $PSScriptRoot '..\..\docs\technical-design.md')
)

$ErrorActionPreference = 'Stop'
$resolvedPath = (Resolve-Path -LiteralPath $Path).Path
$content = Get-Content -LiteralPath $resolvedPath -Raw -Encoding UTF8

if ($content -notmatch '(?m)^# JIJU ') {
    throw 'Missing technical design title.'
}
if (-not $content.Contains('TECH-JIJU-001')) {
    throw 'Missing technical design document ID.'
}

foreach ($section in 1..30) {
    if ($content -notmatch "(?m)^## $section\. ") {
        throw "Missing technical design section: $section"
    }
}

$requiredStatements = @(
    'NestJS 11',
    'PostgreSQL',
    'Redis',
    'Prisma',
    'SessionAuthGuard',
    'AdminRoleGuard',
    'Idempotency-Key',
    'X-View-Token',
    'Serializable',
    'Unicode',
    'UTC',
    'request_id',
    'Verify-Production.ps1',
    'PostVersion',
    'AuditLog'
)

foreach ($statement in $requiredStatements) {
    if (-not $content.Contains($statement)) {
        throw "Technical design missing required statement: $statement"
    }
}

$mermaidBlocks = [regex]::Matches($content, '```mermaid').Count
if ($mermaidBlocks -lt 4) {
    throw "Expected at least four Mermaid diagrams, found $mermaidBlocks."
}

$tableRows = [regex]::Matches($content, '(?m)^\| .+ \|$').Count
if ($tableRows -lt 80) {
    throw "Expected a detailed technical document with at least 80 table rows, found $tableRows."
}

Write-Host "Technical design validation passed: 30 sections, $mermaidBlocks diagrams, and $tableRows table rows."
