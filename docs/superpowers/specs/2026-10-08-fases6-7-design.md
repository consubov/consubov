# Design: Fases 6 (App) e 7 (Offline)

## 1. Objetivo
Implementar o empacotamento nativo da aplicação web (Fase 6) e consolidar a arquitetura offline-first com SQLite e Sync Engine (Fase 7), mantendo a modularidade e o desacoplamento de infraestrutura definidos nas Fases 2 e 3.

## 2. Arquitetura de Empacotamento (Fase 6)
- **Tecnologia:** Capacitor (v7+).
- **Abordagem:** A aplicação web (Vite/React) permanece intacta. O Capacitor atua como wrapper nativo, expondo APIs de hardware (GPS, QR, Câmera, SQLite) através de plugins oficiais.
- **`NativeBridge`:** Implementação de adaptadores baseados nos contratos da Fase 2 (`LocationProvider`, `QrScanner`, `FileStoragePort`) que internamente chamam os plugins do Capacitor. Isso garante que o domínio de negócio permaneça agnóstico.

## 3. Arquitetura Offline-First (Fase 7)
- **Persistência:** SQLite (`@capacitor-community/sqlite`).
- **Data Access:** O domínio interage com um `LocalDatabase` port, mapeando entidades para o schema SQLite.
- **Sync Engine:** 
    - **Command Queue:** Fila de comandos local (`command_id`, `aggregate_id`, `payload`, `base_version`) persistida no SQLite.
    - **Push:** O cliente tenta sincronizar comandos pendentes quando a conectividade (`ConnectivityProvider`) estiver ativa.
    - **Pull:** Sincronização incremental baseada em cursores (não apenas timestamp).
    - **Conflitos:** Política explícita por aggregate (sem LWW genérico), utilizando `base_version` para detecção de conflitos no servidor.

## 4. Segurança e Privacidade (Checklist P0)
- Dados locais são restritos ao `tenant_id` e `user_id` logado.
- `device_id` estável para auditoria.
- Dados sensíveis em persistência local minimizados.

## 5. Próximos Passos (Aprovação)
Após revisão e aprovação deste documento, prosseguirei com a criação do plano de implementação (Fase de Escrita de Planos).
