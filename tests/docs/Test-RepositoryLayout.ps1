param(
    [string]$Root = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
)

$ErrorActionPreference = 'Stop'

$requiredPaths = @(
    'README.md',
    'ai-context.md',
    'domain.md',
    'docs\README.md',
    'docs\api.yaml',
    'docs\ac-matrix.md',
    'docs\data-model.md',
    'docs\errors.md',
    'docs\permissions.md',
    'docs\state-machine.md',
    'docs\design\ui-guidelines.md',
    'docs\product\PRD-v1.1.md',
    'docs\product\PRD-v1.2.md',
    'tests\docs\Test-PrD-v11.ps1',
    'tests\docs\Test-PrD-v12.ps1'
)

foreach ($relativePath in $requiredPaths) {
    if (-not (Test-Path -LiteralPath (Join-Path $Root $relativePath))) {
        throw "Missing repository file: $relativePath"
    }
}

$obsoletePaths = @(
    'demo',
    'docs\T05-production.md',
    'docs\ui-design.md',
    'tests\docs\Test-PrDemo.ps1',
    'tests\docs\Test-PrD.ps1'
)

foreach ($relativePath in $obsoletePaths) {
    if (Test-Path -LiteralPath (Join-Path $Root $relativePath)) {
        throw "Obsolete repository path remains: $relativePath"
    }
}

$docsIndex = Get-Content -LiteralPath (Join-Path $Root 'docs\README.md') -Raw -Encoding UTF8
$requiredIndexLinks = @(
    'product/PRD-v1.2.md',
    'product/PRD-v1.1.md',
    'design/ui-guidelines.md',
    '../ai-context.md',
    '../domain.md',
    'api.yaml',
    'ac-matrix.md'
)

foreach ($link in $requiredIndexLinks) {
    if (-not $docsIndex.Contains($link)) {
        throw "Documentation index is missing: $link"
    }
}

$rootReadme = Get-Content -LiteralPath (Join-Path $Root 'README.md') -Raw -Encoding UTF8
if ($rootReadme.Contains('demo/publish') -or $rootReadme.Contains('docs/ui-design.md')) {
    throw 'Root README still references a removed legacy path.'
}
if (-not $rootReadme.Contains('docs/product/PRD-v1.2.md')) {
    throw 'Root README must point to the formal PRD v1.2.'
}

$frontendReadme = Get-Content -LiteralPath (Join-Path $Root 'frontend\README.md') -Raw -Encoding UTF8
if (-not $frontendReadme.Contains('../docs/design/ui-guidelines.md')) {
    throw 'Mini-program README must link to the current visual design guideline.'
}

$guidelines = Get-Content -LiteralPath (Join-Path $Root 'docs\design\ui-guidelines.md') -Raw -Encoding UTF8
if (-not $guidelines.Contains('#a5686c') -or -not $guidelines.Contains('#f5f0ee')) {
    throw 'Visual design guideline must contain the approved warm palette.'
}
if ($guidelines.ToLowerInvariant().Contains('#b85b43')) {
    throw 'Visual design guideline must not contain the retired accent color.'
}
if (-not $guidelines.Contains('flex: 1 1 0') -or -not $guidelines.Contains('min-width: 0')) {
    throw 'Visual design guideline must include the narrow-screen option layout rule.'
}

Write-Host "Repository layout validation passed: current sources indexed and legacy paths removed."
