# Direcao PWA mobile-first - reconciliada em 2026-10-13

Documento recuperado de `feature/phase6-app-shell` sem reativar o experimento nativo. A [versao integral de 2026-10-07](archive/30-pwa-mobile-first_2026-10-07.md) foi preservada pelo mesmo blob `e88a803855b6717f05326b94cba0535421da4ca6`; os criterios operacionais atuais abaixo e as Instrucoes-Mestre prevalecem sobre gates historicos.

## Direcao mantida

Uma Web React/Vite instalavel como PWA, com IndexedDB, isolamento tenant/user, contratos de plataforma e backend como autoridade. Preservar mesma origem/identidade instalada, dados offline e atualizacao por consentimento explicito. Capacitor/WebNative/SQLite permanecem congelados; historico experimental nao define o runtime vigente.

Capacidades dependem de deteccao, permissao contextual e fallback: camera, GPS, QR, arquivos, compartilhamento e demais capacidades ja previstas. Nao prometer suporte universal. Falha ou negacao de recurso opcional nao deve parar fluxos independentes. Nao criar regras de negocio, permissao backend, retencao ou limpeza de dados por inferencia.

## Desenvolvimento e homologacao

Testes locais automatizaveis de dados/seguranca/PWA continuam obrigatorios. Homologacao fisica Android/iOS/campo fica no piloto antes da producao; nao bloqueia construir incrementos independentes. Nao apagar filas, anexos, backups ou bases legadas sob justificativa de logout, update ou limpeza sem a politica aprovada e preservacao de pendencias.

A recuperacao deste documento nao implementa capacidades novas e nao aprova FASES 5-7. Continuar pelo PRD unico e Checklist Mestre, evitando branches e roadmaps paralelos.
