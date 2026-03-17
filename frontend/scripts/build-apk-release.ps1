$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'

$studioJbr = 'C:\Program Files\Android\Android Studio\jbr'
if (Test-Path $studioJbr) {
  $env:JAVA_HOME = $studioJbr
  $env:Path = "$studioJbr\bin;" + $env:Path
}

$sdkRoot = Join-Path $env:LOCALAPPDATA 'Android\Sdk'
if (!(Test-Path $sdkRoot)) {
  throw "No existe el Android SDK en: $sdkRoot. Ejecuta primero npm run android:setup-sdk"
}

$env:ANDROID_SDK_ROOT = $sdkRoot
$env:ANDROID_HOME = $sdkRoot

$env:NODE_ENV = 'production'

# Load .env (if present) so Gradle can read MAPBOX_DOWNLOADS_TOKEN and app can read EXPO_PUBLIC_* vars.
$envFile = Resolve-Path -ErrorAction SilentlyContinue (Join-Path $PSScriptRoot '..\.env')
if ($envFile) {
  Get-Content -Path $envFile | ForEach-Object {
    $line = $_.Trim()
    if (!$line) { return }
    if ($line.StartsWith('#')) { return }
    $m = [regex]::Match($line, '^(?<k>[A-Za-z_][A-Za-z0-9_]*)\s*=\s*(?<v>.*)$')
    if (!$m.Success) { return }
    $k = $m.Groups['k'].Value
    $v = $m.Groups['v'].Value.Trim()
    if (($v.StartsWith('"') -and $v.EndsWith('"')) -or ($v.StartsWith("'") -and $v.EndsWith("'"))) {
      $v = $v.Substring(1, $v.Length - 2)
    }
    if ($k) { Set-Item -Path "Env:$k" -Value $v }
  }
}

$androidDir = Resolve-Path (Join-Path $PSScriptRoot '..\android')

# Force-disable New Architecture for stability
$gradleProps = Join-Path $androidDir 'gradle.properties'
if (Test-Path $gradleProps) {
  $gp = Get-Content -Raw -Path $gradleProps
  if ($gp -match '(?m)^newArchEnabled=') {
    $gp = $gp -replace '(?m)^newArchEnabled=.*$', 'newArchEnabled=false'
  }
  else {
    $gp = $gp.TrimEnd() + "`nnewArchEnabled=false`n"
  }
  Set-Content -Encoding ASCII -Path $gradleProps -Value $gp
}

# Point Gradle to the local SDK
$localProps = Join-Path $androidDir 'local.properties'
"sdk.dir=$($sdkRoot -replace '\\','/')" | Set-Content -Encoding ASCII -Path $localProps

Push-Location $androidDir
try {
  .\gradlew.bat :app:assembleRelease --no-daemon
  if ($LASTEXITCODE -ne 0) {
    throw "Gradle fallo con codigo $LASTEXITCODE. Revisa la salida arriba (por ej. tokens de Mapbox / dependencias)."
  }
}
finally {
  Pop-Location
}

$apk = Join-Path $androidDir 'app\build\outputs\apk\release\app-release.apk'
if (Test-Path $apk) {
  Write-Output "APK release generado: $apk"

  $exportDir = Resolve-Path -ErrorAction SilentlyContinue (Join-Path $PSScriptRoot '..\..\export')
  if (!$exportDir) {
    $exportDir = (Join-Path $PSScriptRoot '..\..\export')
    New-Item -ItemType Directory -Force -Path $exportDir | Out-Null
  }
  $dst = Join-Path $exportDir 'Xpress-release.apk'
  Copy-Item -Force -Path $apk -Destination $dst
  Write-Output "Copiado a: $dst"
}
else {
  Write-Output "Build terminó, pero no encontré el APK esperado en: $apk"
}
