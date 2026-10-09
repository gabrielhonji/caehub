# CAEHUB

Fundação React do hub de Gestão do CAECOMP, integrada futuramente ao ecossistema Honji.

## Executar

O desenvolvimento ocorre em container e não publica portas no host:

```sh
docker compose -f compose.dev.yml run --rm web npm run build
docker compose -f compose.dev.yml up web
```

Para visualizar o Vite em desenvolvimento, use um túnel SSH para a rede/serviço Docker, conforme a política do ambiente.

## Estrutura

- `docs/caehub/`: planejamento original e decisões complementares.
- `src/components/`: primitives, shell e elementos reutilizáveis.
- `src/domain/`: tipos e dados fictícios exclusivamente de desenvolvimento.
- `src/services/`: fronteira preparada para futura integração.

## Backend institucional

O backend Fastify fica em `src/server/` e usa MySQL próprio do CAEHUB, separado da identidade Honji. As migrações são idempotentes e criam CAECOMP, seus seis departamentos e sete espaços iniciais (Direção Geral e um por departamento). O bootstrap não cria uma pessoa ativa.

No desenvolvimento, o serviço MySQL é interno à rede Docker e não publica porta. Para preparar o banco e iniciar a API:

```sh
docker compose -f compose.dev.yml run --rm web npm run migrate
docker compose -f compose.dev.yml run --rm web npm run api
```

As variáveis usam o contrato `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER` e `DB_PASSWORD`; os defaults são somente para o MySQL de desenvolvimento. Para testar localmente uma identidade fixa, configure no processo do servidor `NODE_ENV=development`, `CAEHUB_DEV_ACTOR_ID` e, quando necessário, `CAEHUB_DEV_OWNER=true`. Essa identidade não vem de requisição HTTP e é recusada em produção.

Veja os contratos em [`docs/caehub/API.md`](docs/caehub/API.md). Kanban, Agenda e Comercial continuam fora deste incremento.
