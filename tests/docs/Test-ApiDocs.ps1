param(
    [string]$ApiPath = (Join-Path $PSScriptRoot '..\..\docs\api.yaml'),
    [string]$DataModelPath = (Join-Path $PSScriptRoot '..\..\docs\data-model.md'),
    [string]$ErrorsPath = (Join-Path $PSScriptRoot '..\..\docs\errors.md')
)

$ErrorActionPreference = 'Stop'
$apiPathResolved = (Resolve-Path -LiteralPath $ApiPath).Path
$dataModelPathResolved = (Resolve-Path -LiteralPath $DataModelPath).Path
$errorsPathResolved = (Resolve-Path -LiteralPath $ErrorsPath).Path
$api = Get-Content -LiteralPath $apiPathResolved -Raw -Encoding UTF8
$dataModel = Get-Content -LiteralPath $dataModelPathResolved -Raw -Encoding UTF8
$errors = Get-Content -LiteralPath $errorsPathResolved -Raw -Encoding UTF8

if ($api -notmatch '(?m)^openapi: 3\.0\.3$') {
    throw 'OpenAPI document must declare version 3.0.3.'
}

$expectedPaths = @(
    '  /feed:',
    '  /posts:',
    '  /tags:',
    '  /posts/{post_id}:',
    '  /posts/{post_id}/comments:',
    '  /comments/{comment_id}:',
    '  /posts/{post_id}/reaction:',
    '  /me/posts:',
    '  /me/profile:',
    '  /me/account:',
    '  /reports:',
    '  /admin/review-queue:',
    '  /notices/{notice_version}/confirmations:',
    '  /auth/wechat/login:',
    '  /auth/logout:',
    '  /admin/reports:',
    '  /admin/content/{target_type}/{target_id}/reviews:',
    '  /admin/content/{target_type}/{target_id}/actions:',
    '  /admin/users/{user_id}/restrictions:',
    '  /admin/audit-logs:'
)

foreach ($path in $expectedPaths) {
    if (-not $api.Contains($path)) {
        throw "Missing required API path: $path"
    }
}

$pathCount = [regex]::Matches($api, '(?m)^  /[^:]+:$').Count
if ($pathCount -ne $expectedPaths.Count) {
    throw "Expected exactly $($expectedPaths.Count) API paths, found $pathCount."
}

$operationIds = [regex]::Matches($api, '(?m)^      operationId: ([A-Za-z0-9_]+)$')
if ($operationIds.Count -ne 25) {
    throw "Expected exactly 25 operations, found $($operationIds.Count)."
}

$uniqueOperationIds = @($operationIds | ForEach-Object { $_.Groups[1].Value } | Sort-Object -Unique)
if ($uniqueOperationIds.Count -ne 25) {
    throw "Expected 25 unique operation IDs, found $($uniqueOperationIds.Count)."
}

$requiredExtensions = @(
    'x-auth',
    'x-validation',
    'x-errors',
    'x-error-reference',
    'x-idempotency',
    'x-side-effects',
    'x-view-count'
)

foreach ($extension in $requiredExtensions) {
    $escaped = [regex]::Escape($extension)
    if ($extension -eq 'x-error-reference') {
        $count = [regex]::Matches($api, "(?m)^      ${escaped}: docs/errors\.md$").Count
    }
    else {
        $count = [regex]::Matches($api, "(?m)^      ${escaped}:$").Count
    }
    if ($count -ne 25) {
        throw "Expected $extension on all 25 operations, found $count."
    }
}

$idempotencyHeaderRefs = [regex]::Matches(
    $api,
    [regex]::Escape("#/components/parameters/IdempotencyKey")
).Count
if ($idempotencyHeaderRefs -ne 14) {
    throw "Expected 14 idempotent write operations, found $idempotencyHeaderRefs header references."
}

$viewCountFalse = [regex]::Matches($api, '(?m)^        returned: false$').Count
$viewCountConditional = [regex]::Matches($api, '(?m)^        returned: conditional$').Count
if ($viewCountFalse -ne 24 -or $viewCountConditional -ne 1) {
    throw "Expected 24 non-view-count responses and one conditional author-detail response, found $viewCountFalse and $viewCountConditional."
}

$viewCountSchemas = [regex]::Matches($api, '(?m)^\s+view_count:$').Count
if ($viewCountSchemas -ne 1) {
    throw "Expected view_count in exactly one response schema, found $viewCountSchemas."
}

if ($api -notmatch "(?m)^      x-view-count:\r?\n        returned: conditional\r?\n        condition: caller is the post author") {
    throw 'Author post-detail endpoint must be the conditional view_count response.'
}

$apiCodes = [regex]::Matches(
    $api,
    '\b(?:JIJU_[A-Z_]+_[0-9]{4}|NETWORK_ERROR)\b'
) | ForEach-Object Value | Sort-Object -Unique

$requiredCodes = @(
    'JIJU_AUTH_4011',
    'JIJU_AUTH_4012',
    'JIJU_ACCESS_4031',
    'JIJU_CONTENT_4041',
    'JIJU_CONTENT_4221',
    'JIJU_VALIDATION_4221',
    'JIJU_QUOTA_4291',
    'JIJU_QUOTA_4292',
    'JIJU_MODERATION_4092',
    'NETWORK_ERROR'
)

foreach ($code in $requiredCodes) {
    if ($apiCodes -notcontains $code) {
        throw "API does not reference required error code: $code"
    }
}

foreach ($code in $apiCodes) {
    if (-not $errors.Contains($code)) {
        throw "API references unknown error code: $code"
    }
}

$schemasStart = $api.IndexOf("  schemas:")
if ($schemasStart -lt 0) {
    throw 'Missing components.schemas section.'
}
$schemasText = $api.Substring($schemasStart)
$schemaRefs = [regex]::Matches($api, '#/components/schemas/([A-Za-z0-9_]+)') |
    ForEach-Object { $_.Groups[1].Value } |
    Sort-Object -Unique

foreach ($schema in $schemaRefs) {
    $escapedSchema = [regex]::Escape($schema)
    if ($schemasText -notmatch "(?m)^    ${escapedSchema}:$") {
        throw "Missing referenced schema definition: $schema"
    }
}

$dataModelHeadings = [regex]::Matches($dataModel, '(?m)^## ([1-9][0-9]*)\. .+$')
if ($dataModelHeadings.Count -ne 10) {
    throw "Expected exactly 10 data-model sections, found $($dataModelHeadings.Count)."
}

$dataModelEntities = @(
    'User',
    'AuthSession',
    'AdminRoleAssignment',
    'Post',
    'PostVersion',
    'Comment',
    'Reaction',
    'Report',
    'Tag',
    'NoticeConfirmation',
    'QuotaUsage',
    'ModerationRecord',
    'AuditLog',
    'ViewRecord',
    'IdempotencyRecord'
)

foreach ($entity in $dataModelEntities) {
    if (-not $dataModel.Contains($entity)) {
        throw "Data model is missing entity: $entity"
    }
}

$mermaidBlocks = [regex]::Matches($dataModel, '(?m)^```mermaid$').Count
if ($mermaidBlocks -ne 1) {
    throw "Expected exactly one Mermaid ER diagram, found $mermaidBlocks."
}

if ($dataModel -notmatch 'PostVersion' -or $dataModel -notmatch 'content_version') {
    throw 'Data model must define content version storage and association.'
}

$bannedSqlPatterns = @(
    '(?i)\bCREATE\s+TABLE\b',
    '(?i)\bALTER\s+TABLE\b',
    '(?i)\bSELECT\s+.+\s+FROM\b',
    '(?i)\bINSERT\s+INTO\b',
    '(?i)\bDELETE\s+FROM\b'
)

foreach ($document in @($api, $dataModel)) {
    foreach ($pattern in $bannedSqlPatterns) {
        if ($document -match $pattern) {
            throw "API/data-model documents contain forbidden SQL pattern: $pattern"
        }
    }
}

Write-Host "API/data-model validation passed: $pathCount paths, $($operationIds.Count) operations, $($schemaRefs.Count) referenced schemas, and $($apiCodes.Count) error codes."
