param(
    [string]$Root = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
)

$ErrorActionPreference = 'Stop'
$previewRoot = Join-Path $Root 'docs\preview'
$requiredFiles = @('index.html', 'styles.css', 'app.js', 'cover.png')

foreach ($file in $requiredFiles) {
    if (-not (Test-Path -LiteralPath (Join-Path $previewRoot $file))) {
        throw "Missing portfolio preview file: $file"
    }
}

$html = Get-Content -LiteralPath (Join-Path $previewRoot 'index.html') -Raw -Encoding UTF8
$script = Get-Content -LiteralPath (Join-Path $previewRoot 'app.js') -Raw -Encoding UTF8
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
& node --check (Join-Path $previewRoot 'app.js')
if ($LASTEXITCODE -ne 0) {
    throw 'Preview JavaScript failed syntax validation.'
}

Write-Host 'Portfolio preview validation passed: static interactions and no backend dependency.'
