$ErrorActionPreference = "Stop"
$OutputEncoding = [System.Text.UTF8Encoding]::new()
[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new()

$ScriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$ProjectRoot = Resolve-Path (Join-Path $ScriptRoot "..")
$BackendRoot = Join-Path $ProjectRoot "backend"
$BaseUrl = "http://localhost:3000"
$SmokeId = [guid]::NewGuid().ToString("N")
$SmokeDb = Join-Path $env:TEMP "thekeeper-smoke-$SmokeId.sqlite"
$StdoutLog = Join-Path $env:TEMP "thekeeper-smoke-$SmokeId-out.log"
$StderrLog = Join-Path $env:TEMP "thekeeper-smoke-$SmokeId-err.log"
$PreviousKeeperDbPath = $env:KEEPER_DB_PATH
$Email = $null
$Server = $null

function Invoke-KeeperJson {
  param(
    [Parameter(Mandatory = $true)][string]$Path,
    [string]$Method = "GET",
    [object]$Body = $null,
    [string]$Token = $null
  )

  $Params = @{
    Uri = "$BaseUrl$Path"
    Method = $Method
    TimeoutSec = 5
  }

  if ($Token) {
    $Params.Headers = @{
      Authorization = "Bearer $Token"
    }
  }

  if ($null -ne $Body) {
    $Params.ContentType = "application/json"
    $Params.Body = ($Body | ConvertTo-Json)
  }

  Invoke-RestMethod @Params
}

function Assert-PageOk {
  param([Parameter(Mandatory = $true)][string]$Path)

  $Response = Invoke-WebRequest -Uri "$BaseUrl$Path" -TimeoutSec 5 -UseBasicParsing

  if ($Response.StatusCode -ne 200) {
    throw "Rota $Path retornou HTTP $($Response.StatusCode)."
  }
}

function Wait-Keeper {
  for ($Attempt = 0; $Attempt -lt 30; $Attempt++) {
    if ($Server.HasExited) {
      $ErrorText = if (Test-Path $StderrLog) { Get-Content $StderrLog -Raw } else { "" }
      throw "Servidor encerrou antes de responder. $ErrorText"
    }

    try {
      $Health = Invoke-KeeperJson -Path "/api/health"

      if ($Health.status -eq "ok") {
        return
      }
    } catch {
      Start-Sleep -Milliseconds 500
    }
  }

  throw "Servidor nao respondeu em $BaseUrl/api/health."
}

Push-Location $ProjectRoot

try {
  Write-Host "1/5 Build, TypeScript e lint..."
  & npm.cmd run check

  if ($LASTEXITCODE -ne 0) {
    throw "npm run check falhou."
  }

  Write-Host "2/5 Subindo servidor de producao..."
  $env:KEEPER_DB_PATH = $SmokeDb
  $Server = Start-Process `
    -FilePath "node" `
    -ArgumentList "dist\server.js" `
    -WorkingDirectory $BackendRoot `
    -WindowStyle Hidden `
    -PassThru `
    -RedirectStandardOutput $StdoutLog `
    -RedirectStandardError $StderrLog

  Wait-Keeper

  Write-Host "3/5 Conferindo rotas do frontend..."
  foreach ($Route in @("/", "/auth", "/dashboard", "/lancamentos", "/cartoes", "/compromissos", "/investimentos", "/simulador")) {
    Assert-PageOk -Path $Route
  }

  Write-Host "4/5 Exercitando cadastro, login e dados..."
  $Email = "smoke-$([guid]::NewGuid().ToString('N'))@keeper.local"
  $Senha = "Smoke123!"

  Invoke-KeeperJson -Path "/api/auth/register" -Method "POST" -Body @{
    nome = "Smoke Apresentacao"
    email = $Email
    senha = $Senha
    tipo_conta = "pessoal"
  } | Out-Null

  $DuplicateRejected = $false

  try {
    Invoke-KeeperJson -Path "/api/auth/register" -Method "POST" -Body @{
      nome = "Smoke Apresentacao Duplicado"
      email = $Email
      senha = $Senha
      tipo_conta = "pessoal"
    } | Out-Null
  } catch {
    $StatusCode = [int]$_.Exception.Response.StatusCode

    if ($StatusCode -eq 409) {
      $DuplicateRejected = $true
    } else {
      throw
    }
  }

  if (-not $DuplicateRejected) {
    throw "Cadastro duplicado com o mesmo email nao foi rejeitado."
  }

  $HashCheckScript = Join-Path $ScriptRoot "check-smoke-password.js"
  & node $HashCheckScript $BackendRoot $SmokeDb $Email $Senha

  if ($LASTEXITCODE -ne 0) {
    throw "Validacao de criptografia da senha falhou."
  }

  $Login = Invoke-KeeperJson -Path "/api/auth/login" -Method "POST" -Body @{
    email = $Email
    senha = $Senha
  }

  if (-not $Login.success -or -not $Login.userId -or -not $Login.token) {
    throw "Login smoke nao retornou um usuario valido com token."
  }

  $UserId = [int]$Login.userId
  $Token = [string]$Login.token

  $SemTokenRejeitado = $false

  try {
    Invoke-KeeperJson -Path "/api/dashboard?usuario_id=$UserId" | Out-Null
  } catch {
    $StatusCode = [int]$_.Exception.Response.StatusCode

    if ($StatusCode -eq 401) {
      $SemTokenRejeitado = $true
    } else {
      throw
    }
  }

  if (-not $SemTokenRejeitado) {
    throw "Rota protegida aceitou chamada sem token."
  }

  Invoke-KeeperJson -Path "/api/dashboard?usuario_id=$UserId" -Token $Token | Out-Null
  Invoke-KeeperJson -Path "/api/contas?usuario_id=$UserId" -Token $Token | Out-Null
  Invoke-KeeperJson -Path "/api/categorias?usuario_id=$UserId" -Token $Token | Out-Null

  Invoke-KeeperJson -Path "/api/movimentacoes" -Method "POST" -Body @{
    usuario_id = $UserId
    valor = 123.45
    descricao = "Smoke entrada"
    data_movimentacao = "2026-06-11"
  } -Token $Token | Out-Null

  Invoke-KeeperJson -Path "/api/cartoes" -Method "POST" -Body @{
    usuario_id = $UserId
    nome = "Cartao Smoke"
    bandeira = "Visa"
    limite_total = 1000
    limite_usado = 100
    fechamento = 5
    vencimento = 12
    ativo = $true
  } -Token $Token | Out-Null

  Invoke-KeeperJson -Path "/api/funcionarios" -Method "POST" -Body @{
    usuario_id = $UserId
    nome = "Funcionario Smoke"
    funcao = "Atendimento"
    salario = 2400
    beneficios = 450
    ativo = $true
  } -Token $Token | Out-Null

  Invoke-KeeperJson -Path "/api/compromissos" -Method "POST" -Body @{
    usuario_id = $UserId
    tipo = "pagar"
    descricao = "Smoke compromisso"
    valor = 50
    vencimento = "2026-06-20"
    recorrente = $false
  } -Token $Token | Out-Null

  Invoke-KeeperJson -Path "/api/investimentos" -Method "POST" -Body @{
    usuario_id = $UserId
    nome = "Smoke CDB"
    tipo = "Renda fixa"
    instituicao = "Keeper"
    quantidade = 1
    preco_medio = 100
    valor_atual = 105
  } -Token $Token | Out-Null

  Invoke-KeeperJson -Path "/api/movimentacoes?usuario_id=$UserId" -Token $Token | Out-Null
  Invoke-KeeperJson -Path "/api/cartoes?usuario_id=$UserId" -Token $Token | Out-Null
  Invoke-KeeperJson -Path "/api/funcionarios?usuario_id=$UserId" -Token $Token | Out-Null
  Invoke-KeeperJson -Path "/api/compromissos?usuario_id=$UserId" -Token $Token | Out-Null
  Invoke-KeeperJson -Path "/api/investimentos?usuario_id=$UserId" -Token $Token | Out-Null

  Write-Host "5/5 Smoke test concluido com sucesso."
} finally {
  if ($Server -and -not $Server.HasExited) {
    Stop-Process -Id $Server.Id
    Wait-Process -Id $Server.Id -Timeout 5 -ErrorAction SilentlyContinue
  }

  if ($null -eq $PreviousKeeperDbPath) {
    Remove-Item Env:\KEEPER_DB_PATH -ErrorAction SilentlyContinue
  } else {
    $env:KEEPER_DB_PATH = $PreviousKeeperDbPath
  }

  foreach ($Path in @($SmokeDb, "$SmokeDb-wal", "$SmokeDb-shm", $StdoutLog, $StderrLog)) {
    if (Test-Path $Path) {
      Remove-Item -LiteralPath $Path -Force -ErrorAction SilentlyContinue
    }
  }

  Pop-Location
}
