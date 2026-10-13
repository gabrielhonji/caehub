# CAEHUB

Hub de Gestão do CAECOMP com React, API Fastify, MySQL e Kanban persistente.

## Executar

O desenvolvimento ocorre em container e não publica portas no host:

```sh
docker compose -f compose.dev.yml run --rm web npm run build
docker compose -f compose.dev.yml up web api mysql
```

O Vite usa proxy interno para o serviço `api`; nenhuma porta é publicada no host. Para visualizar em desenvolvimento, use um túnel SSH para a rede/serviço Docker, conforme a política do ambiente.

## Verificação de um incremento

Execute dentro de container, com `NODE_ENV=development`, fontes deste checkout,
`dist` presente e MySQL/rede/volume descartáveis separados do ambiente comum:

```sh
npm run test:server
npm run build
npm audit --audit-level=moderate
```

Os testes MySQL são seriais e usam `DB_*` do ambiente. Para repetir a regressão
de estabilização, sirva `test/browser/stabilization.fixture.ts` pelo Node 22/tsx
em container na mesma rede nomeada do navegador. Use um schema vazio dedicado.
O artefato frontend deve corresponder ao checkout testado. Dentro do container:

```sh
node --import tsx test/browser/stabilization.fixture.ts
```

No container Chromium/Playwright já utilizado pelo Honji, execute
`node test/browser/stabilization.mjs` com `NODE_ENV=development`,
`CAEHUB_BROWSER_ORIGIN=http://<container-fixture>:8080` e
`CAEHUB_PLAYWRIGHT_MODULE` apontando para o módulo Playwright disponível nesse
container. A fixture é exclusivamente fictícia; não publique portas no host.
Resultados, limites e release estão em `docs/caehub/COORDENACAO.md`.

## Estrutura

- `docs/caehub/`: planejamento original e decisões complementares.
- `src/components/`: primitives, shell e elementos reutilizáveis.
- `src/domain/`: tipos do frontend; fixtures históricas não são consumidas pelo Kanban.
- `src/services/`: cliente tipado da API CAEHUB.

## Backend institucional

O backend Fastify fica em `src/server/` e usa MySQL próprio do CAEHUB, separado da identidade Honji. As migrações são idempotentes e criam CAECOMP, seus seis departamentos e sete espaços iniciais (Direção Geral e um por departamento). O bootstrap não cria uma pessoa ativa.

Em produção, o mesmo container serve o React e a API atrás de um BFF Honji. A rota pública `/acesso` apresenta o projeto antes do login; Authorization Code + PKCE cria uma sessão persistida no MySQL, e cada chamada à API revalida a conta, a sessão Keycloak e o acesso efetivo no serviço central. As permissões de Espaços e Kanban continuam sendo avaliadas localmente. O mock por processo permanece restrito ao desenvolvimento.

No desenvolvimento, o serviço MySQL é interno à rede Docker e não publica porta. Para preparar o banco e iniciar a API:

```sh
docker compose -f compose.dev.yml run --rm web npm run migrate
docker compose -f compose.dev.yml run --rm web npm run api
```

As variáveis usam o contrato `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER` e `DB_PASSWORD`. O Compose local usa MySQL sem senha exclusivamente na rede Docker interna e sem publicar portas; produção recebe credenciais pela infraestrutura. Para testar localmente outra identidade fixa, configure no processo do servidor `NODE_ENV=development`, `CAEHUB_DEV_ACTOR_ID` e, quando necessário, `CAEHUB_DEV_OWNER=true`. Essa identidade não vem de requisição HTTP e é recusada em produção.

Veja os contratos em [`docs/caehub/API.md`](docs/caehub/API.md). Kanban, Agenda e Comercial são funcionais. Comercial inclui compra própria por membros Honji, pedidos administrativos externos, reservas com vencimento, Pix manual, produção/recebimento, retiradas e pendências rastreáveis, preservando o inventário central. Configure prazo e instruções reais de Pix antes das vendas físicas. Consulte `docs/caehub/COMERCIAL.md`.

## Portal público e compras

A raiz `/` é pública: campanhas ativas, catálogo, detalhes e seleção temporária
por campanha. Conta Honji com vínculo ativo no CAECOMP conclui pelo mesmo serviço
de pedidos e consulta Pix, produção e retirada próprios. Externos entram pelo
Google e precisam confirmar e-mail `@alunos.utfpr.edu.br` antes de comprar;
podem anexar esse endereço à mesma conta criada com outro e-mail. Confira também
a caixa de spam. A confirmação não concede acesso institucional.
`/#/espacos` e os demais hashes preservam a gestão protegida. Imagens de produtos,
eventos públicos e local de retirada aguardam contratos de cadastro/publicação.

Pedidos próprios estão em `/#/meus-pedidos`, acessíveis no navbar interno;
notificações de retirada abrem `/#/meus-pedidos/<id>` com verificação de titular.
A lojinha interna usa a mesma experiência do portal. Na etapa de retirada,
encomendas aparecem apenas nos pedidos do próprio comprador com quantidade e
estado registrados; modelos exclusivos não ficam disponíveis para recompra.
Novas encomendas permanecem habilitadas durante a etapa de vendas.

## Homologação e operação assistida

Antes do piloto ou das vendas reais, consulte o
[roteiro institucional](docs/caehub/HOMOLOGACAO-INSTITUCIONAL.md), os
[gates comerciais](docs/caehub/LIBERACAO-COMERCIAL.md) e o
[manual operacional e quadro de prontidão](docs/caehub/OPERACAO.md).
Gate técnico não substitui aceite humano, conferência financeira ou recuperação
comprovada do banco.
