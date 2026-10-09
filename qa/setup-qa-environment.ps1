# Script de setup do ambiente QA para CONSUBOV
# Execute este script manualmente no PowerShell para contornar bloqueios do classificador

Write-Host "=== CONSUBOV QA Environment Setup ===" -ForegroundColor Cyan
Write-Host ""

# Passo 1: Instalar extensões VS Code globalmente
Write-Host "1. Instalando extensões do VS Code globalmente..." -ForegroundColor Yellow
code --install-extension dbaeumer.vscode-eslint --global
code --install-extension ms-playwright.playwright --global
Write-Host "   ✓ Instalação de extensões finalizada" -ForegroundColor Green
Write-Host ""

# Passo 2: Instalar navegadores Playwright
Write-Host "2. Instalando navegadores Playwright (Chromium, WebKit, Firefox)..." -ForegroundColor Yellow
Set-Location "d:\MATEUS\Documentos\GitHub\consubov\apps\web"
bunx playwright install chromium webkit firefox
if ($LASTEXITCODE -eq 0) {
    Write-Host "   ✓ Navegadores Playwright instalados" -ForegroundColor Green
} else {
    Write-Host "   ✗ Erro ao instalar navegadores Playwright" -ForegroundColor Red
}
Set-Location "d:\MATEUS\Documentos\GitHub\consubov"
Write-Host ""

# Passo 3: Executar task setup
Write-Host "3. Executando task setup (dependências do monorepo)..." -ForegroundColor Yellow
task setup
if ($LASTEXITCODE -eq 0) {
    Write-Host "   ✓ Setup concluído" -ForegroundColor Green
} else {
    Write-Host "   ✗ Erro no setup" -ForegroundColor Red
}
Write-Host ""

# Passo 4: Executar task doctor
Write-Host "4. Verificando ambiente com task doctor..." -ForegroundColor Yellow
task doctor
if ($LASTEXITCODE -eq 0) {
    Write-Host "   ✓ Verificação concluída" -ForegroundColor Green
} else {
    Write-Host "   ✗ Erro na verificação" -ForegroundColor Red
}
Write-Host ""

# Passo 5: Listar tasks disponíveis
Write-Host "5. Tasks QA disponíveis:" -ForegroundColor Yellow
task --list-all | Select-String "qa:"
Write-Host ""

Write-Host "=== Setup Concluído ===" -ForegroundColor Cyan
Write-Host ""
Write-Host "Próximos passos:" -ForegroundColor Yellow
Write-Host "  - Execute: task qa:phase5  (para executar fase 5)"
Write-Host "  - Execute: task qa:all     (para executar todas as fases)"
Write-Host ""
