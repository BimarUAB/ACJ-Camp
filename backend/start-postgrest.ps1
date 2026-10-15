$ErrorActionPreference = 'Stop'
$configurationPath = Join-Path $PSScriptRoot '.env'
$executablePath = Join-Path $env:LOCALAPPDATA 'Programs\PostgREST\postgrest.exe'

if (-not (Test-Path -LiteralPath $configurationPath)) {
  throw 'No existe backend/.env.'
}

if (-not (Test-Path -LiteralPath $executablePath)) {
  throw 'No se encontró PostgREST en %LOCALAPPDATA%\Programs\PostgREST.'
}

$settings = @{}
Get-Content -LiteralPath $configurationPath | ForEach-Object {
  if ($_ -match '^\s*([^#=\s]+)\s*=\s*(.*)$') {
    $value = $matches[2].Trim()
    if (($value.StartsWith('"') -and $value.EndsWith('"')) -or ($value.StartsWith("'") -and $value.EndsWith("'"))) {
      $value = $value.Substring(1, $value.Length - 2)
    }
    $settings[$matches[1]] = $value
  }
}

foreach ($key in @('DB_NAME', 'DB_PORT', 'PGRST_DB_PASSWORD')) {
  if (-not $settings[$key]) {
    throw "Falta configurar $key en backend/.env."
  }
}

$password = [Uri]::EscapeDataString($settings.PGRST_DB_PASSWORD)
$env:PGRST_DB_URI = "postgres://campusab_postgrest_authenticator:$password@127.0.0.1:$($settings.DB_PORT)/$($settings.DB_NAME)"
$env:PGRST_DB_SCHEMAS = 'api'
$env:PGRST_DB_ANON_ROLE = 'campusab_postgrest_anon'
$env:PGRST_SERVER_HOST = '127.0.0.1'
$env:PGRST_SERVER_PORT = '3001'

& $executablePath