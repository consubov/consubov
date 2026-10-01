# GitHub Free e Codespaces

## Objetivo

Manter o desenvolvimento do Consubov reproduzível e econômico usando recursos disponíveis no GitHub Free e GitHub Codespaces.

## Fluxo

- `main` é a branch oficial;
- mudanças relevantes usam branches temporárias;
- toda branch abre Pull Request para `main`;
- o CI executa instalação congelada, build e testes;
- execuções concorrentes do mesmo PR são canceladas;
- após merge, a branch temporária deve ser removida.

## Codespaces

O repositório usa `.devcontainer/devcontainer.json`.

Configuração atual:

- imagem TypeScript/Node baseada em Debian;
- Bun 1.3.12;
- `bun install --frozen-lockfile` após criação;
- porta 8080 preparada para preview da aplicação web;
- sem secrets embutidos.

Para reduzir consumo:

- usar máquina de 2 cores quando suficiente;
- parar o Codespace quando não estiver em uso;
- não manter ambientes ociosos;
- preferir um único Codespace ativo por tarefa.

## GitHub Actions

O workflow principal roda em Pull Requests para `main` e por disparo manual.

Validações:

- instalação com lockfile congelado;
- build;
- testes.

## Limitação operacional

Como o repositório é privado e o fluxo está sendo mantido no plano gratuito, regras avançadas de proteção de branch podem não estar disponíveis. A regra de não escrever diretamente em `main` permanece obrigatória para pessoas e agentes.

## Segurança

- nunca versionar `.env`;
- não inserir credenciais em devcontainer, workflows ou testes;
- Supabase remoto e Vercel só podem ser conectados mediante autorização e PRD específico;
- integrações bloqueadas ficam registradas em issues.
