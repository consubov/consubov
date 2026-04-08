# Project Memory

## Core
Consubov — sistema gestão pecuária, PT-BR. Primary #1B4332 (green), secondary #D4A017 (gold). Inter font. Mobile-first.
Supabase connected (external). Tables: administradores, gerentes, fazendas, retiros, pastos, produtos, ciclos, lancamentos, visitas, snapshots, escritorios.
Roles: administrador, gerente, capataz, escritorio. Detection order in useAuth: capataz → gerente → escritorio → administrador.
No new tables unless user approves.

## Memories
- [Brand colors](mem://design/brand) — Green #1B4332, gold #D4A017, HSL tokens in index.css
- [Admin global access](mem://features/admin-access) — All admins see all fazendas via is_admin() RLS
- [Mapa interativo](mem://features/mapa-interativo) — Interactive farm map with pasture actions
