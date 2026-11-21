param(
    [string]$Path = (Join-Path $PSScriptRoot '..\..\docs\product\PRD-v1.1.md')
)

$ErrorActionPreference = 'Stop'
$resolvedPath = (Resolve-Path -LiteralPath $Path).Path
$content = Get-Content -LiteralPath $resolvedPath -Raw -Encoding UTF8

$requiredSections = @('1', '4', '5', '8', '9', '10', '11', '12', '13')

foreach ($section in $requiredSections) {
    if ($content -notmatch "(?m)^## $section\. ") {
        throw "Missing required section: $section"
    }
}

if ($content -notmatch '\| PRD-JIJU-MVP \|') {
    throw 'Missing document ID: PRD-JIJU-MVP'
}
if ($content -notmatch '\| 1\.1-rev\.1 \|') {
    throw 'Missing document version: 1.1-rev.1'
}

$requirementPrefixes = 'AUTH|FEED|POST|TAG|EXP|DETAIL|REACT|COMMENT|VIEW|MINE|REPORT|MOD|NFR-PERF|NFR-REL|NFR-SEC'
foreach ($prefix in ($requirementPrefixes -split '\|')) {
    $escapedPrefix = [regex]::Escape($prefix)
    if ($content -notmatch "(?m)^\| $escapedPrefix-[0-9]{2} \|") {
        throw "Missing requirement group: $prefix"
    }
}

$requirementRows = [regex]::Matches(
    $content,
    "(?m)^\| ((?:$requirementPrefixes)-[0-9]{2}) \|"
)

if ($requirementRows.Count -lt 50) {
    throw "Expected at least 50 requirement IDs, found $($requirementRows.Count)."
}

$ids = @($requirementRows | ForEach-Object { $_.Groups[1].Value })
$duplicateIds = @(
    $ids |
        Group-Object |
        Where-Object Count -gt 1 |
        ForEach-Object Name
)

if ($duplicateIds.Count -gt 0) {
    throw "Duplicate requirement IDs: $($duplicateIds -join ', ')"
}

$acceptanceRows = [regex]::Matches($content, '(?m)^\| AC-[0-9]{2} \|')
if ($acceptanceRows.Count -lt 20) {
    throw "Expected at least 20 acceptance scenarios, found $($acceptanceRows.Count)."
}

Write-Host "PRD v1.1 archive validation passed: $($ids.Count) unique requirement IDs and $($acceptanceRows.Count) acceptance scenarios."
