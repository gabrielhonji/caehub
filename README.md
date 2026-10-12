# CAEHUB

Hub de Gestão do CAECOMP com React, API Fastify, MySQL e Kanban persistente.

## Executar

O desenvolvimento ocorre em container e não publica portas no host:

```sh
docker compose -f compose.dev.yml run --rm web npm run build
docker compose -f compose.dev.yml up web api mysql
```

O Vite usa proxy interno para o serviço `api`; nenhuma porta é publicada no host. Para visualizar em desenvolvimento, use um túnel SSH para a rede/serviço Docker, conforme a política do ambiente.

## Estrutura

- `docs/caehub/`: planejamento original e decisões complementares.
- `src/components/`: primitives, shell e elementos reutilizáveis.
- `src/domain/`: tipos do frontend; fixtures históricas não são consumidas pelo Kanban.
- `src/services/`: cliente tipado da API CAEHUB.

## Backend institucional

O backend Fastify fica em `src/server/` e usa MySQL próprio do CAEHUB, separado da identidade Honji. As migrações são idempotentes e criam CAECOMP, seus seis departamentos e sete espaços iniciais (Direção Geral e um por departamento). O bootstrap não cria uma pessoa ativa.

Em produção, o mesmo container serve o React e a API atrás de um BFF Honji. A rota pública `/acesso` apresenta o projeto antes do login; Authorization Code + PKCE cria uma sessão persistida no MySQL, e cada chamada à API revalida `project.access` no serviço central. As permissões de Espaços e Kanban continuam sendo avaliadas localmente. O mock por processo permanece restrito ao desenvolvimento.

No desenvolvimento, o serviço MySQL é interno à rede Docker e não publica porta. Para preparar o banco e iniciar a API:

```sh
docker compose -f compose.dev.yml run --rm web npm run migrate
docker compose -f compose.dev.yml run --rm web npm run api
```

As variáveis usam o contrato `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER` e `DB_PASSWORD`. O Compose local usa MySQL sem senha exclusivamente na rede Docker interna e sem publicar portas; produção recebe credenciais pela infraestrutura. Para testar localmente outra identidade fixa, configure no processo do servidor `NODE_ENV=development`, `CAEHUB_DEV_ACTOR_ID` e, quando necessário, `CAEHUB_DEV_OWNER=true`. Essa identidade não vem de requisição HTTP e é recusada em produção.

Veja os contratos em [`docs/caehub/API.md`](docs/caehub/API.md). Kanban, Agenda e Comercial são funcionais. Comercial inclui compra própria por membros Honji, pedidos administrativos externos, reservas com vencimento, Pix manual, produção/recebimento, retiradas e pendências rastreáveis, preservando o inventário central. Configure prazo e instruções reais de Pix antes das vendas físicas. Consulte `docs/caehub/COMERCIAL.md`.
