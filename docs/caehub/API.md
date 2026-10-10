# API institucional e Kanban — Incrementos 01 e 02

Base: `/api`. JSON; erros usam `{ error, message }` e retornam `400`, `403`, `404` ou `409`. `GET /health` expõe também a versão e o identificador de release no formato `DDMMAAAA-HHMMSS`.

O servidor resolve o ator na fronteira `IdentityGateway`. Em produção, o BFF Honji usa Authorization Code + PKCE, sessão persistida no MySQL e uma decisão central nova de `project.access` em cada requisição protegida. Sem configuração completa ou decisão positiva, o acesso é negado; nenhum cabeçalho, payload ou papel fornecido pelo navegador concede acesso.

| Método e rota | Operação |
| --- | --- |
| `GET /api/me` | identidade institucional e acesso efetivo |
| `GET /api/organization` | CAECOMP |
| `GET /api/organization/departments` | departamentos |
| `GET, POST /api/members` | consulta/criação de vínculo; criação é institucional |
| `PATCH /api/members/:id` | cargo ou situação; Owner não é aceitável |
| `GET, POST /api/departments/:id/participants` | participantes; diretor só administra seu departamento e não nomeia diretor |
| `DELETE /api/departments/:id/participants/:membershipId` | encerra vínculo departamental, preservando histórico |
| `GET, POST /api/workspaces` | espaços acessíveis/criação contextual |
| `GET, PATCH /api/workspaces/:id` | detalhe e administração, inclusive `archive`, `addMembershipId` e `removeMembershipId` |
| `GET, POST /api/workspaces/:id/boards` | quadros do espaço e criação administrativa |
| `GET /api/boards/:id` | quadro, colunas e cartões visíveis |
| `POST /api/boards/:id/columns`, `PATCH /api/columns/:id` | criar, renomear ou reordenar colunas |
| `DELETE /api/columns/:id?targetColumnId=...` | excluir coluna com realocação transacional obrigatória |
| `POST /api/boards/:id/cards`, `GET, PATCH /api/cards/:id` | criar, consultar e editar cartão |
| `POST /api/cards/:id/move` | mover com `columnId` e versão otimista |
| `POST, DELETE /api/cards/:id/helpers/me` | entrar/sair como auxiliar voluntário |
| `POST /api/cards/:id/transfers`, `POST /api/transfers/:id/decision` | solicitar e decidir transferência de responsabilidade |
| `POST /api/cards/:id/checklist`, `PATCH /api/checklist/:id` | checklist persistente |
| `POST /api/cards/:id/comments` | comentário persistente |
| `GET /api/my-tasks` | consolidação sem duplicação; filtros `workspaceId`, `state`, `participation` |

Visibilidade `directors` é filtrada antes do detalhe e usa `404` para não revelar o recurso. Somente direção/administradores alteram visibilidade ou arquivamento. Criador, responsável e auxiliar podem editar campos permitidos. As cinco colunas padrão são inicializadas por quadro de forma idempotente; `is_completion` preserva a semântica de conclusão independentemente do nome.

`POST /api/members` recebe `honjiSubject`, `displayName` e opcionalmente `role`. O sujeito é o alvo de uma operação já autorizada, não prova de identidade do ator. `POST /api/workspaces` recebe `name`, `description?`, `departmentId?`. IDs são UUIDs.

Paginação ainda não é necessária para a escala institucional inicial; deverá ser incluída antes de uma listagem cujo volume a exija, sem alterar a política de escopo.

## Integração Honji

As rotas `/acesso`, `/auth/login`, `/auth/callback` e `/auth/logout` implementam o portão Honji. O cookie de sessão é Secure, HttpOnly, SameSite=Lax e não contém tokens; identificadores de sessão são armazenados somente como hash. Mutações exigem origem exata e token CSRF da sessão. Client secrets permanecem fora do repositório e da imagem.
