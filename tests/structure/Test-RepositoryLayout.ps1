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
    'docs\product\PRD-v1.3.md',
    'server\scripts\retention.ts',
    'tests\README.md',
    'tests\docs\Test-AiContext.ps1',
    'tests\docs\Test-PRD-v11.ps1',
    'tests\docs\Test-PRD-v13.ps1',
    'tests\production\Verify-Production.ps1',
    'tests\structure\Test-RepositoryLayout.ps1'
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
    'docs\product\PRD-v1.2.md',
    'frontend\custom-tab-bar',
    'server\prisma\retention.ts',
    'tests\docs\Test-PrDemo.ps1',
    'tests\docs\Test-PrD.ps1',
    'tests\docs\Test-Production.ps1',
    'tests\docs\Test-RepositoryLayout.ps1'
)

foreach ($relativePath in $obsoletePaths) {
    if (Test-Path -LiteralPath (Join-Path $Root $relativePath)) {
        throw "Obsolete repository path remains: $relativePath"
    }
}

$docsIndex = Get-Content -LiteralPath (Join-Path $Root 'docs\README.md') -Raw -Encoding UTF8
$requiredIndexLinks = @(
    'product/PRD-v1.3.md',
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
if (-not $rootReadme.Contains('docs/product/PRD-v1.3.md')) {
    throw 'Root README must point to the formal PRD v1.3.'
}
$readmeSectionCount = [regex]::Matches($rootReadme, '(?m)^## .+$').Count
if ($readmeSectionCount -lt 8) {
    throw "Root README is missing expected sections: found $readmeSectionCount level-2 headings."
}
$readmeLineCount = ($rootReadme -split "`r?`n").Count
if ($readmeLineCount -gt 160) {
    throw "Portfolio README is too long: $readmeLineCount lines."
}
$requiredReadmeHeadings = @('Highlights', 'Architecture', 'Quick Start', 'Tests', 'License')
foreach ($heading in $requiredReadmeHeadings) {
    if (-not $rootReadme.Contains($heading)) {
        throw "Root README is missing portfolio section: $heading"
    }
}
if (-not $rootReadme.Contains('```mermaid')) {
    throw 'Root README must include the architecture diagram.'
}
if (-not $rootReadme.Contains('flowchart LR') -or
    -not $rootReadme.Contains('MP["') -or
    -not $rootReadme.Contains('API["NestJS API"]') -or
    -not $rootReadme.Contains('PG["PostgreSQL"]') -or
    $rootReadme.Contains('PG[(PostgreSQL)]')) {
    throw 'README Mermaid diagram must use quoted, GitHub-compatible node labels.'
}
$requiredReadmeStatements = @(
    'https://github.com/Xzm2780/JIJU.git',
    'docker compose up --build',
    'http://127.0.0.1:3001/api/v1/admin-console',
    'MIT License'
)
foreach ($statement in $requiredReadmeStatements) {
    if (-not $rootReadme.Contains($statement)) {
        throw "Root README is missing: $statement"
    }
}
if ($rootReadme.Contains('Verify-Production') -or $rootReadme.Contains('production/')) {
    throw 'Portfolio README must stay focused on the project rather than release operations.'
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

$package = Get-Content -LiteralPath (Join-Path $Root 'server\package.json') -Raw -Encoding UTF8 | ConvertFrom-Json
if ($package.scripts.'retention:run' -ne 'ts-node scripts/retention.ts') {
    throw 'Retention job must live in server/scripts and be referenced from package.json.'
}

$gitignore = Get-Content -LiteralPath (Join-Path $Root '.gitignore') -Raw -Encoding UTF8
if (-not $gitignore.Contains('frontend/project.private.config.json')) {
    throw 'WeChat developer-local settings must be ignored.'
}

Write-Host "Repository layout validation passed: current sources indexed and legacy paths removed."
