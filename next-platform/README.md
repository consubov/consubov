# CONSUBOV next-platform (Laboratório Isolado)

Este diretório contém a nova plataforma modular e desacoplada CONSUBOV (Missão F23-ISOLATED-NEXT).

## Regras de Confinamento Estrito:
1. 100% do código novo reside exclusivamente dentro deste diretório 
ext-platform/**.
2. NUNCA modificar arquivos da aplicação legada ou arquivos raiz do repositório.
3. Comunicação central estritamente via /api/v1 (Mock Server Bun/TS local).
4. Proibido qualquer acesso direto a bancos remotos, Supabase PostgREST ou serviços de produção.
5. Dados e credenciais utilizados são estritamente sintéticos (LGPD e segurança).
