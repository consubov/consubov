@echo off
echo ========================================
echo CONSUBOV QA Setup e Testes
echo ========================================
echo.

echo [1/7] Instalando extensao ESLint globalmente...
code --install-extension dbaeumer.vscode-eslint --global
if %ERRORLEVEL% neq 0 (
    echo AVISO: Nao foi possivel instalar extensao ESLint via CLI
)

echo [2/7] Instalando extensao Playwright globalmente...
code --install-extension ms-playwright.playwright --global
if %ERRORLEVEL% neq 0 (
    echo AVISO: Nao foi possivel instalar extensao Playwright via CLI
)

echo [3/7] Instalando browsers do Playwright...
bunx playwright install chromium webkit firefox
if %ERRORLEVEL% neq 0 (
    echo ERRO: Falha ao instalar browsers Playwright
    pause
    exit /b 1
)
echo OK: Browsers instalados
echo.

echo [4/7] Executando setup...
call task setup
if %ERRORLEVEL% neq 0 (
    echo ERRO: Falha no setup
    pause
    exit /b 1
)
echo OK: Setup concluido
echo.

echo [5/7] Verificando ambiente (doctor)...
call task doctor
if %ERRORLEVEL% neq 0 (
    echo ERRO: Falha no doctor
    pause
    exit /b 1
)
echo OK: Ambiente verificado
echo.

echo [6/7] Executando QA Phase 5...
call task qa:phase5
if %ERRORLEVEL% neq 0 (
    echo ERRO: Falha no QA Phase 5
    pause
    exit /b 1
)
echo OK: QA Phase 5 passou
echo.

echo [7/7] Executando QA All...
call task qa:all
if %ERRORLEVEL% neq 0 (
    echo ERRO: Falha no QA All
    pause
    exit /b 1
)
echo OK: Todos os testes QA passaram
echo.

echo ========================================
echo SUCESSO: Setup e testes concluidos!
echo ========================================
pause
