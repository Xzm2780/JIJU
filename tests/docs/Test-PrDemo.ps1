param(
    [string]$DemoPath = (Join-Path $PSScriptRoot '..\..\demo\publish')
)

$ErrorActionPreference = 'Stop'
$demoRoot = (Resolve-Path -LiteralPath $DemoPath).Path

$requiredFiles = @(
    'package.json',
    'README.md',
    'AC-COVERAGE.md',
    'server\app.js',
    'server\index.js',
    'public\index.html',
    'public\app.css',
    'public\app.js',
    'public\shared\tags.js',
    'public\modules\graphemes.js',
    'public\modules\draft.js',
    'public\modules\idempotency.js',
    'tests\client-modules.test.js',
    'tests\publish-api.test.js'
)

foreach ($relativePath in $requiredFiles) {
    $fullPath = Join-Path $demoRoot $relativePath
    if (-not (Test-Path -LiteralPath $fullPath)) {
        throw "Missing demo file: $relativePath"
    }
}

$package = Get-Content -LiteralPath (Join-Path $demoRoot 'package.json') -Raw -Encoding UTF8 |
    ConvertFrom-Json
if ($package.dependencies -or $package.devDependencies) {
    throw 'Publish demo must not declare third-party dependencies.'
}
if ($package.scripts.start -ne 'node server/index.js') {
    throw 'Demo start script must use Node built-ins only.'
}
if ($package.scripts.test -ne 'node --test') {
    throw 'Demo test script must use the Node built-in test runner.'
}

$server = Get-Content -LiteralPath (Join-Path $demoRoot 'server\app.js') -Raw -Encoding UTF8
$requiredServerStatements = @(
    '/api/v1/auth/wechat/login',
    '/api/v1/posts',
    'DAILY_POST_LIMIT = 5',
    'JIJU_QUOTA_4291',
    'JIJU_MODERATION_4091',
    '[[BLOCK]]',
    '[[REVIEW]]'
)
foreach ($statement in $requiredServerStatements) {
    if (-not $server.Contains($statement)) {
        throw "Missing required server statement: $statement"
    }
}

$apiPathMatches = [regex]::Matches($server, "'/api/v1/[^']+'") |
    ForEach-Object Value |
    Sort-Object -Unique
$expectedApiPaths = @(
    "'/api/v1/auth/wechat/login'",
    "'/api/v1/posts'"
)
if ($apiPathMatches.Count -ne $expectedApiPaths.Count) {
    throw "Demo must expose exactly the login and publish API paths, found: $($apiPathMatches -join ', ')"
}
foreach ($path in $expectedApiPaths) {
    if ($apiPathMatches -notcontains $path) {
        throw "Missing expected demo API path: $path"
    }
}

$readme = Get-Content -LiteralPath (Join-Path $demoRoot 'README.md') -Raw -Encoding UTF8
if ($readme -notmatch 'npm start' -or $readme -notmatch 'npm test') {
    throw 'README must include start and test commands.'
}

$html = Get-Content -LiteralPath (Join-Path $demoRoot 'public\index.html') -Raw -Encoding UTF8
$css = Get-Content -LiteralPath (Join-Path $demoRoot 'public\app.css') -Raw -Encoding UTF8
if (-not $html.Contains('acknowledgement-box')) {
    throw 'Public acknowledgement must render a visible custom checkmark.'
}
if (-not $css.Contains('grid-template-columns: repeat(3, minmax(0, 1fr));')) {
    throw 'Retention choices must use three shrinkable columns.'
}
if (-not $css.Contains('@media (max-width: 420px)')) {
    throw 'Retention controls must have a narrow-screen responsive rule.'
}

$coverage = Get-Content -LiteralPath (Join-Path $demoRoot 'AC-COVERAGE.md') -Raw -Encoding UTF8
$requiredAcs = @('AUTH-02', 'AC-03', 'AC-04', 'AC-05', 'AC-07', 'AC-20')
foreach ($ac in $requiredAcs) {
    if (-not $coverage.Contains($ac)) {
        throw "AC coverage table is missing: $ac"
    }
}

if (-not $coverage.Contains('[AC-03 PARTIAL: FEED OUT OF SCOPE]')) {
    throw 'AC coverage must explain that the feed portion of AC-03 is outside this demo scope.'
}

Push-Location $demoRoot
try {
    & npm test
    if ($LASTEXITCODE -ne 0) {
        throw "Publish demo tests failed with exit code $LASTEXITCODE."
    }
}
finally {
    Pop-Location
}

Write-Host "Publish demo validation passed: $($requiredFiles.Count) files and Node test suite."
