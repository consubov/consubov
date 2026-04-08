# Project Memory

## Core
Consubov — sistema gestão pecuária, PT-BR. Primary #1B4332 (green), secondary #D4A017 (gold). Inter font. Mobile-first.
Supabase connected (external). Tables: administradores, gerentes, fazendas, retiros, pastos, produtos, ciclos, lancamentos, visitas, snapshots.
Roles: administrador (user_id in administradores), gerente (user_id in gerentes). Capataz has no dedicated table yet.
No new tables unless user approves.
Lancamentos MUST have ciclo_id. mes/ano from ciclo, never JS Date.

## Memories
- [Brand colors](mem://design/brand) — Green #1B4332, gold #D4A017, HSL tokens in index.css
- [Ciclo isolation](mem://features/ciclo-isolation) — Lancamentos vinculados a ciclo_id, bloqueio sem ciclo aberto
- [Admin access](mem://features/admin-access) — Admin access rules
- [Escritorio](mem://features/escritorio) — Escritorio role and access
- [Mapa interativo](mem://features/mapa-interativo) — Interactive map feature
