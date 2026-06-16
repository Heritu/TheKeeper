@echo off
setlocal

cd /d "%~dp0"

echo.
echo The Keeper - modo apresentacao
echo.

where node >nul 2>nul
if errorlevel 1 (
  echo Node.js nao foi encontrado neste computador.
  echo Instale o Node.js ou use um computador que ja tenha Node disponivel.
  pause
  exit /b 1
)

if not exist "frontend-novo\dist\index.html" (
  echo Gerando frontend de producao...
  call npm.cmd --prefix frontend-novo run build
  if errorlevel 1 (
    echo Falha ao gerar o frontend.
    pause
    exit /b 1
  )
)

if not exist "backend\dist\server.js" (
  echo Gerando backend de producao...
  call npm.cmd --prefix backend run build
  if errorlevel 1 (
    echo Falha ao gerar o backend.
    pause
    exit /b 1
  )
)

echo.
echo Servidor iniciando em http://localhost:3000
echo Para encerrar, pressione Ctrl+C nesta janela.
echo.

cd backend
node dist\server.js
