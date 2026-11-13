param(
    [string]$Path = (Join-Path $PSScriptRoot '..\..\docs\ac-matrix.md')
)

$ErrorActionPreference = 'Stop'
$resolvedPath = (Resolve-Path -LiteralPath $Path).Path
$content = Get-Content -LiteralPath $resolvedPath -Raw -Encoding UTF8

$requiredAcIds = 1..24 | ForEach-Object { 'AC-{0:D2}' -f $_ }
foreach ($id in $requiredAcIds) {
    $matches = [regex]::Matches($content, "(?m)^\| $id \|")
    if ($matches.Count -ne 1) {
        throw "Expected exactly one row for $id, found $($matches.Count)."
    }
}

$supplementalIds = 1..7 | ForEach-Object { 'SUP-{0:D2}' -f $_ }
foreach ($id in $supplementalIds) {
    $matches = [regex]::Matches($content, "(?m)^\| $id \|")
    if ($matches.Count -ne 1) {
        throw "Expected exactly one row for $id, found $($matches.Count)."
    }
}

$allRows = [regex]::Matches(
    $content,
    '(?m)^\| (?:AC-[0-9]{2}|SUP-[0-9]{2}) \|'
)
if ($allRows.Count -ne 31) {
    throw "Expected exactly 31 AC/SUP rows, found $($allRows.Count)."
}

$rowLines = $content -split "`r?`n" |
    Where-Object { $_ -match '^\| (?:AC-[0-9]{2}|SUP-[0-9]{2}) \|' }

foreach ($row in $rowLines) {
    $cells = $row.Split('|')
    if ($cells.Count -ne 10) {
        throw "Expected 8 columns in AC row: $row"
    }

    if ([string]::IsNullOrWhiteSpace($cells[8]) -or $cells[8] -notmatch 'T[0-9]{2}') {
        throw "AC row does not reference a task package: $row"
    }

    if ($row -notmatch '\[AUTO\]' -and $row -notmatch '\[MANUAL\]' -and $row -notmatch '\[AUTO\+MANUAL\]') {
        throw "AC row must identify automated or manual execution: $row"
    }
}

$requiredTerms = @(
    'Unicode',
    'zero-width',
    'expires_at',
    'content_version',
    'Idempotency-Key',
    'view_count',
    'log',
    'telemetry',
    'API_GAP'
)

foreach ($term in $requiredTerms) {
    if (-not $content.Contains($term)) {
        throw "Missing required AC matrix term: $term"
    }
}

$automatedRows = $rowLines | Where-Object { $_ -match '\[AUTO(?:\+MANUAL)?\]' }
$manualRows = $rowLines | Where-Object { $_ -match '\[(?:AUTO\+)?MANUAL\]' }
if ($automatedRows.Count -lt 20) {
    throw "Expected at least 20 automated rows, found $($automatedRows.Count)."
}
if ($manualRows.Count -lt 5) {
    throw "Expected at least 5 manual verification rows, found $($manualRows.Count)."
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
        throw "AC matrix contains forbidden SQL pattern: $pattern"
    }
}

Write-Host "AC matrix validation passed: 24 PRD ACs, 7 supplemental cases, $($automatedRows.Count) automated rows, and $($manualRows.Count) manual rows."
