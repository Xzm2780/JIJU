param(
    [string]$Path = (Join-Path $PSScriptRoot '..\..\domain.md'),
    [string]$PrdPath = (Join-Path $PSScriptRoot '..\..\docs\product\PRD-v1.1.md')
)

$ErrorActionPreference = 'Stop'
$resolvedPath = (Resolve-Path -LiteralPath $Path).Path
$content = Get-Content -LiteralPath $resolvedPath -Raw -Encoding UTF8
$resolvedPrdPath = (Resolve-Path -LiteralPath $PrdPath).Path
$prdContent = Get-Content -LiteralPath $resolvedPrdPath -Raw -Encoding UTF8

$entities = @(
    'User',
    'Post',
    'Comment',
    'Reaction',
    'Report',
    'Tag',
    'NoticeConfirmation',
    'QuotaUsage',
    'ModerationRecord',
    'AuditLog',
    'ViewRecord'
)

foreach ($entity in $entities) {
    if ($content -notmatch "(?m)^## $entity$") {
        throw "Missing entity section: $entity"
    }
}

$sourcePrefix = 'AUTH|FEED|POST|TAG|EXP|DETAIL|REACT|COMMENT|VIEW|MINE|REPORT|MOD'
$fieldRows = [regex]::Matches(
    $content,
    "(?m)^(?:\|[^|\r\n]*){6}\|[^|\r\n]*(?:$sourcePrefix)-[0-9]{2}[^|\r\n]*\|$"
)
if ($fieldRows.Count -lt 80) {
    throw "Expected at least 80 seven-column field rows with source requirement IDs, found $($fieldRows.Count)."
}

$requiredStatements = @(
    'public_status',
    'moderation_status',
    '(user_id, post_id)',
    'content_version',
    'REPORT-07',
    'REACT-03',
    'UTC',
    'view_token',
    'deactivated_at',
    'deleted_at',
    'active'
)

foreach ($statement in $requiredStatements) {
    if (-not $content.Contains($statement)) {
        throw "Missing required domain statement: $statement"
    }
}

if ($content.Contains('```')) {
    throw 'Domain document must not contain code blocks or SQL examples.'
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
        throw "Domain document contains forbidden SQL pattern: $pattern"
    }
}

$sourceIds = [regex]::Matches(
    $content,
    "\b(?:$sourcePrefix)-[0-9]{2}\b"
) | ForEach-Object Value | Sort-Object -Unique

if ($sourceIds.Count -lt 20) {
    throw "Expected at least 20 distinct source requirement IDs, found $($sourceIds.Count)."
}

$requirementSectionStart = $prdContent.IndexOf('AUTH-01')
$requirementSectionEnd = $prdContent.IndexOf('MOD-10')
if ($requirementSectionStart -lt 0 -or $requirementSectionEnd -le $requirementSectionStart) {
    throw 'Unable to locate the requirement ID range in the PRD.'
}

$requirementSection = $prdContent.Substring(
    $requirementSectionStart,
    ($requirementSectionEnd - $requirementSectionStart) + 'MOD-10'.Length
)

foreach ($sourceId in $sourceIds) {
    if (-not $requirementSection.Contains($sourceId)) {
        throw "Source ID is not present in the PRD requirement section: $sourceId"
    }
}

Write-Host "Domain validation passed: $($entities.Count) entities, $($fieldRows.Count) traced field rows, and $($sourceIds.Count) distinct source IDs."
