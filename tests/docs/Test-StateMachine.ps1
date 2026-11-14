param(
    [string]$Path = (Join-Path $PSScriptRoot '..\..\docs\state-machine.md')
)

$ErrorActionPreference = 'Stop'
$resolvedPath = (Resolve-Path -LiteralPath $Path).Path
$content = Get-Content -LiteralPath $resolvedPath -Raw -Encoding UTF8

$numberedHeadings = [regex]::Matches($content, '(?m)^## ([1-9][0-9]*)\. .+$')
if ($numberedHeadings.Count -ne 7) {
    throw "Expected exactly 7 top-level numbered sections, found $($numberedHeadings.Count)."
}

$requiredStatements = @(
    'public_status',
    'moderation_status',
    'DRAFT',
    'PUBLISHED',
    'HIDDEN',
    'EXPIRED',
    'DELETED',
    'PASSED',
    'PENDING',
    'REJECTED',
    'risk_confirmed_at',
    'server_now >= expires_at',
    'JIJU_CONFLICT_4091',
    'JIJU_CONFLICT_4092',
    'JIJU_CONTENT_4221',
    'JIJU_MODERATION_4091',
    '5.6',
    '5.7',
    '7.6'
)

foreach ($statement in $requiredStatements) {
    if (-not $content.Contains($statement)) {
        throw "Missing required state-machine statement: $statement"
    }
}

$mermaidBlocks = [regex]::Matches($content, '(?m)^```mermaid$').Count
if ($mermaidBlocks -ne 2) {
    throw "Expected exactly 2 Mermaid diagrams, found $mermaidBlocks."
}

$publicTransitions = @(
    'DRAFT --> PUBLISHED',
    'PUBLISHED --> PUBLISHED',
    'PUBLISHED --> HIDDEN',
    'HIDDEN --> PUBLISHED',
    'PUBLISHED --> EXPIRED',
    'PUBLISHED --> DELETED',
    'HIDDEN --> DELETED',
    'EXPIRED --> DELETED'
)

foreach ($transition in $publicTransitions) {
    if (-not $content.Contains($transition)) {
        throw "Missing public transition in Mermaid: $transition"
    }
}

$moderationTransitions = @(
    'NEW --> PASSED',
    'NEW --> PENDING',
    'PASSED --> PASSED',
    'PASSED --> PENDING',
    'PENDING --> PENDING',
    'PENDING --> PASSED',
    'PENDING --> REJECTED'
)

foreach ($transition in $moderationTransitions) {
    if (-not $content.Contains($transition)) {
        throw "Missing moderation transition in Mermaid: $transition"
    }
}

$errorCodes = [regex]::Matches(
    $content,
    '\bJIJU_(?:AUTH|ACCESS|VALIDATION|QUOTA|CONTENT|CONFLICT|MODERATION)_[0-9]{4}\b'
) | ForEach-Object Value | Sort-Object -Unique

if ($errorCodes.Count -lt 9) {
    throw "Expected at least 9 distinct suggested error codes, found $($errorCodes.Count)."
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
        throw "State-machine document contains forbidden SQL pattern: $pattern"
    }
}

Write-Host "State-machine validation passed: 7 sections, 2 Mermaid diagrams, and $($errorCodes.Count) suggested error codes."
