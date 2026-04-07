# Project Memory

## Core
Consubov — sistema gestão pecuária, PT-BR. Primary #1B4332 (green), secondary #D4A017 (gold). Inter font. Mobile-first.
Supabase connected (external). Tables: administradores, gerentes, capatazes, fazendas, retiros, pastos, produtos, ciclos, lancamentos, visitas, snapshots, mapas, pastos_mapa.
Roles: administrador, gerente, capataz — detected via profile tables with user_id + ativo.
NEVER drop or recreate existing tables. Only add columns or new tables.
No new tables unless user approves.
All admins see ALL fazendas/data (RLS uses is_admin() function, not administrador_id).

## Memories
- [Brand colors](mem://design/brand) — Green #1B4332, gold #D4A017, HSL tokens in index.css
- [Admin access](mem://features/admin-access) — All admins global access via is_admin() RLS function
- [Mapa interativo](mem://features/mapa-interativo) — Interactive farm map with polygon overlays, clickable pastos, monthly filter
