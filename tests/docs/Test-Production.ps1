param(
    [string]$Root = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
)

$ErrorActionPreference = 'Stop'
$requiredFiles = @(
    'ai-context.md',
    'domain.md',
    'server\package.json',
    'server\package-lock.json',
    'server\prisma\schema.prisma',
    'server\prisma\seed.ts',
    'server\prisma\migrations\migration_lock.toml',
    'server\prisma\migrations\20261113234000_init_publish\migration.sql',
    'server\src\main.ts',
    'server\src\posts\posts.service.ts',
    'server\src\posts\publish-challenge.service.ts',
    'server\README.md',
    'frontend\package.json',
    'frontend\package-lock.json',
    'frontend\project.config.json',
    'frontend\miniprogram\pages\publish\index.ts',
    'frontend\miniprogram\pages\detail\index.ts',
    'frontend\README.md',
    'tasks\T18-account-deletion.md',
    'docs\T05-production.md'
)

foreach ($relativePath in $requiredFiles) {
    if (-not (Test-Path -LiteralPath (Join-Path $Root $relativePath))) {
        throw "Missing production file: $relativePath"
    }
}

$aiContext = Get-Content -LiteralPath (Join-Path $Root 'ai-context.md') -Raw -Encoding UTF8
if (-not (($aiContext -split "`r?`n")[0]).Contains('docs/')) {
    throw 'ai-context.md first line does not declare the root source-of-truth policy.'
}

$api = Get-Content -LiteralPath (Join-Path $Root 'docs\api.yaml') -Raw -Encoding UTF8
$requiredApiStatements = @(
    '  /tags:',
    'operationId: listTags',
    'JIJU_MODERATION_4092',
    'risk_challenge_id',
    'retention_hours is required'
)
foreach ($statement in $requiredApiStatements) {
    if (-not $api.Contains($statement)) {
        throw "OpenAPI contract missing: $statement"
    }
}

$publishWxml = Get-Content -LiteralPath (Join-Path $Root 'frontend\miniprogram\pages\publish\index.wxml') -Raw -Encoding UTF8
$publishWxss = Get-Content -LiteralPath (Join-Path $Root 'frontend\miniprogram\pages\publish\index.wxss') -Raw -Encoding UTF8
if (-not $publishWxml.Contains('<checkbox-group') -or -not $publishWxml.Contains('value="acknowledged"')) {
    throw 'Mini-program public acknowledgement must use a checkbox confirmation.'
}
if ($publishWxml.Contains('<switch')) {
    throw 'Mini-program public acknowledgement must not use a switch.'
}
if (-not $publishWxss.Contains('flex: 1 1 0;') -or -not $publishWxss.Contains('width: 0;')) {
    throw 'Mini-program retention choices must use three equal flexible columns without percentage-width overlap.'
}
if (-not $publishWxss.Contains('@media (max-width: 360px)')) {
    throw 'Mini-program retention choices need a narrow-screen rule.'
}

$postsService = Get-Content -LiteralPath (Join-Path $Root 'server\src\posts\posts.service.ts') -Raw -Encoding UTF8
$challengeService = Get-Content -LiteralPath (Join-Path $Root 'server\src\posts\publish-challenge.service.ts') -Raw -Encoding UTF8
$publishSources = "$postsService`n$challengeService"
$requiredServiceStatements = @(
    'JIJU_MODERATION_4092',
    'risk-challenge:',
    'Prisma.TransactionIsolationLevel.Serializable',
    'post.publish',
    'POST_DAILY'
)
foreach ($statement in $requiredServiceStatements) {
    if (-not $publishSources.Contains($statement)) {
        throw "Publish service missing: $statement"
    }
}

$ruleConfig = Get-Content -LiteralPath (Join-Path $Root 'server\config\content-rules.json') -Raw -Encoding UTF8
if ($ruleConfig -notmatch '"BLOCK"' -or $ruleConfig -notmatch '"CONFIRM"') {
    throw 'External content rule config must provide BLOCK and CONFIRM decisions.'
}
if ($postsService -match '\[\[BLOCK\]\]|\[\[REVIEW\]\]') {
    throw 'Content rule literals must not be hardcoded in publish service.'
}

$t03 = Get-Content -LiteralPath (Join-Path $Root 'tasks\T03-auth-session.md') -Raw -Encoding UTF8
$t05 = Get-Content -LiteralPath (Join-Path $Root 'tasks\T05-publish-post.md') -Raw -Encoding UTF8
if (-not $t03.Contains('T18') -or -not $t05.Contains('T18')) {
    throw 'Session and publish tasks must keep permanent account deletion out of scope.'
}

Push-Location (Join-Path $Root 'server')
try {
    & npm test
    if ($LASTEXITCODE -ne 0) {
        throw "Server tests failed with exit code $LASTEXITCODE."
    }
    & npm run build
    if ($LASTEXITCODE -ne 0) {
        throw "Server build failed with exit code $LASTEXITCODE."
    }
    $previousDatabaseUrl = $env:DATABASE_URL
    $env:DATABASE_URL = 'postgresql://jiju:jiju@127.0.0.1:5432/jiju?schema=public'
    try {
        & npx prisma validate
        if ($LASTEXITCODE -ne 0) {
            throw 'Prisma schema validation failed.'
        }
    }
    finally {
        $env:DATABASE_URL = $previousDatabaseUrl
    }
}
finally {
    Pop-Location
}

Push-Location (Join-Path $Root 'frontend')
try {
    & npm run typecheck
    if ($LASTEXITCODE -ne 0) {
        throw "Mini-program typecheck failed with exit code $LASTEXITCODE."
    }
    & npm test
    if ($LASTEXITCODE -ne 0) {
        throw "Mini-program tests failed with exit code $LASTEXITCODE."
    }
}
finally {
    Pop-Location
}

Write-Host "Production validation passed: backend, frontend, Prisma, OpenAPI, and task boundaries."
