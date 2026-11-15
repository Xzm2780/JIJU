param(
    [string]$TasksPath = (Join-Path $PSScriptRoot '..\..\tasks'),
    [string]$AcMatrixPath = (Join-Path $PSScriptRoot '..\..\docs\ac-matrix.md')
)

$ErrorActionPreference = 'Stop'
$tasksResolved = (Resolve-Path -LiteralPath $TasksPath).Path
$acMatrixResolved = (Resolve-Path -LiteralPath $AcMatrixPath).Path
$taskFiles = Get-ChildItem -LiteralPath $tasksResolved -Filter 'T??-*.md' -File | Sort-Object Name

if ($taskFiles.Count -ne 19) {
    throw "Expected exactly 19 task files, found $($taskFiles.Count)."
}

$expectedTaskIds = 0..18 | ForEach-Object { 'T{0:D2}' -f $_ }
$dependencies = @{}
$allTaskText = ''

$requiredMarkers = @(
    'Task name',
    'Scope',
    'Non-goals',
    'Dependencies',
    'PRD',
    'AC',
    'Interfaces',
    'Tables',
    'Implementation points / core rules',
    'Test requirements',
    'Definition of done'
)

foreach ($file in $taskFiles) {
    $content = Get-Content -LiteralPath $file.FullName -Raw -Encoding UTF8
    $allTaskText += "`n$content"
    $taskIdMatch = [regex]::Match($file.Name, '^(T[0-9]{2})-')
    if (-not $taskIdMatch.Success) {
        throw "Task filename has no valid task ID: $($file.Name)"
    }
    $taskId = $taskIdMatch.Groups[1].Value

    foreach ($marker in $requiredMarkers) {
        if (-not $content.Contains($marker)) {
            throw "$taskId missing required marker: $marker"
        }
    }

    $coreStart = $content.IndexOf('Implementation points / core rules')
    $coreTail = $content.Substring($coreStart)
    $nextHeading = [regex]::Match($coreTail, '(?m)^## ')
    if ($nextHeading.Success) {
        $coreSection = $coreTail.Substring(0, $nextHeading.Index)
    }
    else {
        $coreSection = $coreTail
    }
    $coreRules = [regex]::Matches($coreSection, '(?m)^[0-9]+\. ').Count
    if ($coreRules -lt 1 -or $coreRules -gt 5) {
        throw "$taskId must contain 1 to 5 core rules, found $coreRules."
    }

    $interfaceStart = $content.IndexOf('Interfaces')
    $interfaceTail = $content.Substring($interfaceStart)
    $interfaceNextHeading = [regex]::Match($interfaceTail, '(?m)^## ')
    if ($interfaceNextHeading.Success) {
        $interfaceSection = $interfaceTail.Substring(0, $interfaceNextHeading.Index)
    }
    else {
        $interfaceSection = $interfaceTail
    }
    $interfaceCount = [regex]::Matches(
        $interfaceSection,
        '\b(?:GET|POST|PUT|PATCH|DELETE) /[A-Za-z0-9_{}\/-]+'
    ).Count
    if ($interfaceCount -gt 3) {
        throw "$taskId exceeds the three-interface limit: $interfaceCount."
    }

    $dependencyStart = $content.IndexOf('Dependencies')
    $dependencyTail = $content.Substring($dependencyStart)
    $dependencyNextHeading = [regex]::Match($dependencyTail, '(?m)^## ')
    if ($dependencyNextHeading.Success) {
        $dependencySection = $dependencyTail.Substring(0, $dependencyNextHeading.Index)
    }
    else {
        $dependencySection = $dependencyTail
    }
    $dependencies[$taskId] = @(
        [regex]::Matches($dependencySection, '\bT[0-9]{2}\b') |
            ForEach-Object Value |
            Sort-Object -Unique
    )

    if ($content -notmatch '\[AUTO\]' -and $content -notmatch '\[MANUAL\]' -and $content -notmatch '\[AUTO\+MANUAL\]') {
        throw "$taskId test requirements do not mark AUTO or MANUAL execution."
    }

    if ($content.Contains('```')) {
        throw "$taskId contains a code block; task packages must remain documentation only."
    }

    $bannedSqlPatterns = @(
        '(?i)\bCREATE\s+TABLE\b',
        '(?i)\bALTER\s+TABLE\b',
        '(?i)\bSELECT\s+.+\s+FROM\b',
        '(?i)\bINSERT\s+INTO\b',
        '(?i)\bDELETE\s+FROM\b'
    )
    foreach ($pattern in $bannedSqlPatterns) {
        if ($content -match $pattern) {
            throw "$taskId contains forbidden SQL pattern: $pattern"
        }
    }
}

foreach ($taskId in $expectedTaskIds) {
    if (-not $dependencies.ContainsKey($taskId)) {
        throw "Missing task file for $taskId."
    }
    foreach ($dependency in $dependencies[$taskId]) {
        if ($expectedTaskIds -notcontains $dependency) {
            throw "$taskId references unknown dependency $dependency."
        }
    }
}

$state = @{}
function Visit-Task([string]$taskId) {
    if ($state[$taskId] -eq 'visiting') {
        throw "Dependency cycle detected at $taskId."
    }
    if ($state[$taskId] -eq 'visited') {
        return
    }
    $state[$taskId] = 'visiting'
    foreach ($dependency in $dependencies[$taskId]) {
        Visit-Task $dependency
    }
    $state[$taskId] = 'visited'
}

foreach ($taskId in $expectedTaskIds) {
    Visit-Task $taskId
}

$requiredInterfaces = @(
    'GET /feed',
    'GET /tags',
    'GET /posts/{post_id}',
    'POST /posts',
    'PUT /posts/{post_id}',
    'DELETE /posts/{post_id}',
    'GET /posts/{post_id}/comments',
    'POST /posts/{post_id}/comments',
    'DELETE /comments/{comment_id}',
    'PUT /posts/{post_id}/reaction',
    'DELETE /posts/{post_id}/reaction',
    'GET /me/posts',
    'GET /me/profile',
    'PUT /me/profile',
    'DELETE /me/account',
    'POST /reports',
    'POST /notices/{notice_version}/confirmations',
    'POST /auth/wechat/login',
    'POST /auth/logout',
    'GET /admin/reports',
    'GET /admin/content',
    'GET /admin/review-queue',
    'POST /admin/content/{target_type}/{target_id}/reviews',
    'POST /admin/content/{target_type}/{target_id}/actions',
    'POST /admin/users/{user_id}/restrictions',
    'POST /admin/auth/login',
    'GET /admin/audit-logs'
)

foreach ($interface in $requiredInterfaces) {
    if (-not $allTaskText.Contains($interface)) {
        throw "No task covers required interface: $interface"
    }
}

$acMatrix = Get-Content -LiteralPath $acMatrixResolved -Raw -Encoding UTF8
$acRows = $acMatrix -split "`r?`n" |
    Where-Object { $_ -match '^\| (?:AC-[0-9]{2}|SUP-[0-9]{2}) \|' }
if ($acRows.Count -ne 31) {
    throw "Expected 31 AC matrix rows, found $($acRows.Count)."
}
foreach ($row in $acRows) {
    $cells = $row.Split('|')
    if ($cells.Count -ne 10 -or [string]::IsNullOrWhiteSpace($cells[8])) {
        throw "AC matrix row has no task package mapping: $row"
    }
    foreach ($taskId in ([regex]::Matches($cells[8], '\bT[0-9]{2}\b') | ForEach-Object Value)) {
        if ($expectedTaskIds -notcontains $taskId) {
            throw "AC matrix references unknown task package: $taskId"
        }
    }
}

Write-Host "Task package validation passed: 19 tasks, 27 covered interfaces, acyclic dependencies, and 31 AC task mappings."
