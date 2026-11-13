param(
    [string]$PermissionsPath = (Join-Path $PSScriptRoot '..\..\docs\permissions.md'),
    [string]$ErrorsPath = (Join-Path $PSScriptRoot '..\..\docs\errors.md')
)

$ErrorActionPreference = 'Stop'
$permissionsPathResolved = (Resolve-Path -LiteralPath $PermissionsPath).Path
$errorsPathResolved = (Resolve-Path -LiteralPath $ErrorsPath).Path
$permissions = Get-Content -LiteralPath $permissionsPathResolved -Raw -Encoding UTF8
$errors = Get-Content -LiteralPath $errorsPathResolved -Raw -Encoding UTF8

$permissionHeadings = [regex]::Matches($permissions, '(?m)^## ([1-9][0-9]*)\. .+$')
if ($permissionHeadings.Count -ne 7) {
    throw "Expected exactly 7 permission sections, found $($permissionHeadings.Count)."
}

$errorHeadings = [regex]::Matches($errors, '(?m)^## ([1-9][0-9]*)\. .+$')
if ($errorHeadings.Count -ne 5) {
    throw "Expected exactly 5 error sections, found $($errorHeadings.Count)."
}

$permissionStatements = @(
    'GUEST',
    'AUTH_NON_AUTHOR',
    'AUTHOR',
    'OPERATOR',
    'S1',
    'S2',
    'S3',
    'S4',
    'S5',
    'S6',
    'S7',
    'S8',
    'S9',
    'S10',
    'S11',
    'view_count',
    'JIJU_CONTENT_4041',
    'JIJU_ACCESS_4031',
    'AUTHZ-07'
)

foreach ($statement in $permissionStatements) {
    if (-not $permissions.Contains($statement)) {
        throw "Missing required permission statement: $statement"
    }
}

$matrixRows = @(
    $permissions -split "`r?`n" |
        Where-Object {
            ([regex]::Matches($_, 'S[0-9]+')).Count -ge 4
        }
)

if ($matrixRows.Count -lt 18) {
    throw "Expected at least 18 matrix rows with role-level checkpoints, found $($matrixRows.Count)."
}

$requiredCodes = @(
    'JIJU_AUTH_4011',
    'JIJU_AUTH_4012',
    'JIJU_ACCESS_4031',
    'JIJU_ACCESS_4032',
    'JIJU_CONTENT_4041',
    'JIJU_CONTENT_4221',
    'JIJU_VALIDATION_4221',
    'JIJU_QUOTA_4291',
    'JIJU_QUOTA_4292',
    'NETWORK_ERROR',
    'JIJU_SYSTEM_5031',
    'JIJU_CONFLICT_4091',
    'JIJU_CONFLICT_4092',
    'JIJU_MODERATION_4091',
    'JIJU_MODERATION_4092'
)

foreach ($code in $requiredCodes) {
    if (-not $errors.Contains($code)) {
        throw "Missing required error code: $code"
    }
}

$errorRows = [regex]::Matches($errors, '(?m)^\| (?:JIJU_[A-Z_]+_[0-9]{4}|NETWORK_ERROR) \|')
if ($errorRows.Count -lt $requiredCodes.Count) {
    throw "Expected at least $($requiredCodes.Count) error table rows, found $($errorRows.Count)."
}

$requiredStatuses = @('401', '403', '404', '409', '422', '429', '503')
foreach ($status in $requiredStatuses) {
    if ($errors -notmatch "\| $status \|") {
        throw "Missing required HTTP status: $status"
    }
}

$bannedSqlPatterns = @(
    '(?i)\bCREATE\s+TABLE\b',
    '(?i)\bALTER\s+TABLE\b',
    '(?i)\bSELECT\s+.+\s+FROM\b',
    '(?i)\bINSERT\s+INTO\b',
    '(?i)\bDELETE\s+FROM\b'
)

foreach ($document in @($permissions, $errors)) {
    foreach ($pattern in $bannedSqlPatterns) {
        if ($document -match $pattern) {
            throw "Authorization documents contain forbidden SQL pattern: $pattern"
        }
    }
}

Write-Host "Authorization validation passed: 4 roles, 11 checkpoints, $($matrixRows.Count) traced matrix rows, and $($requiredCodes.Count) error codes."
