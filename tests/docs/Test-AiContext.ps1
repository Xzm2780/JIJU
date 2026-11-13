param(
    [string]$Path = (Join-Path $PSScriptRoot '..\..\ai-context.md')
)

$ErrorActionPreference = 'Stop'
$resolvedPath = (Resolve-Path -LiteralPath $Path).Path
$content = Get-Content -LiteralPath $resolvedPath -Raw -Encoding UTF8

$numberedHeadings = [regex]::Matches($content, '(?m)^## ([1-9][0-9]*)\. .+$')
if ($numberedHeadings.Count -ne 5) {
    throw "Expected exactly 5 top-level numbered sections, found $($numberedHeadings.Count)."
}

for ($section = 1; $section -le 5; $section++) {
    if ($content -notmatch "(?m)^## $section\. .+$") {
        throw "Missing required section number: $section"
    }
}

$requiredStatements = @(
    'Taro',
    'uni-app',
    'frontend/',
    'components/',
    'server/',
    'routes/',
    'services/',
    'repositories/',
    'tests/',
    'JIJU_<DOMAIN>_<NNNN>',
    'UTC',
    'Asia/Shanghai',
    '`<type>_<uuid_v7>`',
    'Idempotency-Key',
    'v1:<operation>:<uuid_v7>',
    'PRD'
)

foreach ($statement in $requiredStatements) {
    if (-not $content.Contains($statement)) {
        throw "Missing required statement: $statement"
    }
}

$sectionFourStart = $content.IndexOf('## 4. ')
$sectionFiveStart = $content.IndexOf('## 5. ')
if ($sectionFourStart -lt 0 -or $sectionFiveStart -le $sectionFourStart) {
    throw 'Unable to locate sections 4 and 5 for structured validation.'
}

$forbiddenItems = $content.Substring(
    $sectionFourStart,
    $sectionFiveStart - $sectionFourStart
)
$forbiddenCount = [regex]::Matches($forbiddenItems, '(?m)^[0-9]+\. \*\*').Count
if ($forbiddenCount -ne 5) {
    throw "Expected exactly 5 forbidden items, found $forbiddenCount."
}

$pendingSection = $content.Substring($sectionFiveStart)
$pendingQuestions = [regex]::Matches($pendingSection, '(?m)^[0-9]+\. \*\*')
if ($pendingQuestions.Count -lt 10) {
    throw "Expected at least 10 pending questions, found $($pendingQuestions.Count)."
}

Write-Host "AI context validation passed: 5 sections, 5 forbidden items, and $($pendingQuestions.Count) pending questions."
