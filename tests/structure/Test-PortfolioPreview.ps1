param(
    [string]$Root = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
)

$ErrorActionPreference = 'Stop'
$previewRoot = Join-Path $Root 'docs\preview'
$requiredFiles = @('index.html', 'styles.css', 'app.js', 'cover.png', 'admin.html', 'admin.css', 'admin.js')

foreach ($file in $requiredFiles) {
    if (-not (Test-Path -LiteralPath (Join-Path $previewRoot $file))) {
        throw "Missing portfolio preview file: $file"
    }
}

$html = Get-Content -LiteralPath (Join-Path $previewRoot 'index.html') -Raw -Encoding UTF8
$script = Get-Content -LiteralPath (Join-Path $previewRoot 'app.js') -Raw -Encoding UTF8
$adminHtml = Get-Content -LiteralPath (Join-Path $previewRoot 'admin.html') -Raw -Encoding UTF8
$adminScript = Get-Content -LiteralPath (Join-Path $previewRoot 'admin.js') -Raw -Encoding UTF8
foreach ($marker in @(
    'id="post-list"',
    'id="publish-form"',
    'id="view-my"',
    'id="detail-layer"',
    'id="login-layer"',
    'data-nav="feed"',
    'data-nav="publish"',
    'data-nav="my"'
)) {
    if (-not $html.Contains($marker)) {
        throw "Preview HTML missing marker: $marker"
    }
}

foreach ($marker in @(
    'Intl.Segmenter',
    'localStorage',
    'DAILY_LIMIT = 5',
    'toggleReaction',
    'publish()',
    'resetDemo',
    'noticeConfirmed'
)) {
    if (-not $script.Contains($marker)) {
        throw "Preview script missing behavior: $marker"
    }
}

if ($script -match 'fetch\s*\(' -or $script -match 'XMLHttpRequest') {
    throw 'Portfolio preview must run without a backend.'
}
if ($script.Contains('http://') -or $script.Contains('https://')) {
    throw 'Portfolio preview must not depend on external endpoints.'
}

foreach ($marker in @(
    'id="login-screen"',
    'id="admin-app"',
    'id="panel-overview"',
    'id="panel-queue"',
    'id="panel-content"',
    'id="panel-users"',
    'id="panel-audit"',
    'id="process-layer"'
)) {
    if (-not $adminHtml.Contains($marker)) {
        throw "Admin preview HTML missing marker: $marker"
    }
}

foreach ($marker in @(
    'renderQueue',
    'renderContent',
    'renderUsers',
    'renderAudit',
    'openProcess',
    'submitProcess',
    "item.status === 'RESOLVED'"
)) {
    if (-not $adminScript.Contains($marker)) {
        throw "Admin preview script missing behavior: $marker"
    }
}

if ($adminScript.Contains('fetch(') -or $adminScript.Contains('http://') -or $adminScript.Contains('https://')) {
    throw 'Admin preview must use static demo data only.'
}

& node --check (Join-Path $previewRoot 'app.js')
if ($LASTEXITCODE -ne 0) {
    throw 'Preview JavaScript failed syntax validation.'
}
& node --check (Join-Path $previewRoot 'admin.js')
if ($LASTEXITCODE -ne 0) {
    throw 'Admin preview JavaScript failed syntax validation.'
}

Write-Host 'Portfolio preview validation passed: user and admin static interactions with no backend dependency.'
