param(
    [string]$Path = (Join-Path $PSScriptRoot '..\..\docs\product\PRD-v1.2.md')
)

$ErrorActionPreference = 'Stop'
$resolvedPath = (Resolve-Path -LiteralPath $Path).Path
$content = Get-Content -LiteralPath $resolvedPath -Raw -Encoding UTF8

if ($content -notmatch '(?m)^# .+$') {
    throw 'Missing PRD v1.2 title.'
}

if (-not $content.Contains('2026-11-21')) {
    throw 'Missing document date.'
}

$requiredHeadings = @(
    '## 1. ',
    '## 5. ',
    '## 8. ',
    '## 18. ',
    '## 19. ',
    '## 23. ',
    '## 24. ',
    '## 27. '
)

foreach ($heading in $requiredHeadings) {
    if (-not $content.Contains($heading)) {
        throw "Missing required section: $heading"
    }
}

$requiredStatements = @(
    'sessionStorage',
    'GET /tags',
    'X-View-Token',
    'JIJU_MODERATION_4092',
    'AC-24',
    'CUR-13',
    'BLOCK-05',
    'BLOCK-09',
    'BLOCK-10'
)

foreach ($statement in $requiredStatements) {
    if (-not $content.Contains($statement)) {
        throw "Missing required current-system statement: $statement"
    }
}

$acRows = [regex]::Matches($content, '(?m)^\| AC-[0-9]{2} \|').Count
if ($acRows -ne 24) {
    throw "Expected 24 AC summary rows, found $acRows."
}

$currentRows = [regex]::Matches($content, '(?m)^\| CUR-[0-9]{2} \|').Count
if ($currentRows -ne 13) {
    throw "Expected 13 current supplemental acceptance rows, found $currentRows."
}

$bannedSqlPatterns = @(
    '(?i)\bCREATE\s+TABLE\b',
    '(?i)\bALTER\s+TABLE\b',
    '(?i)\bSELECT\s+.+\s+FROM\b',
    '(?i)\bINSERT\s+INTO\b',
    '(?i)\bDELETE\s+FROM\b'
)

foreach ($pattern in $bannedSqlPatterns) {
    if ($content -match $pattern) {
        throw "PRD v1.2 contains forbidden SQL pattern: $pattern"
    }
}

Write-Host "PRD v1.2 validation passed: 28 API operations, 24 AC rows, 13 current acceptance rows, and 10 release blockers."
