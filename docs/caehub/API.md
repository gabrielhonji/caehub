# API institucional — Incremento 01

Base: `/api`. JSON; erros usam `{ error, message }` e retornam `400`, `403`, `404` ou `409`.

O servidor resolve o ator na fronteira `IdentityGateway`. Em produção, sem o adaptador BFF Honji, toda rota protegida retorna `403`; não há cabeçalho, payload ou papel fornecido pelo navegador que conceda acesso. O único portão central conhecido é `project.access`.

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

`POST /api/members` recebe `honjiSubject`, `displayName` e opcionalmente `role`. O sujeito é o alvo de uma operação já autorizada, não prova de identidade do ator. `POST /api/workspaces` recebe `name`, `description?`, `departmentId?`. IDs são UUIDs.

Paginação ainda não é necessária para a escala institucional inicial; deverá ser incluída antes de uma listagem cujo volume a exija, sem alterar a política de escopo.

## Limite pendente

O adaptador real para sessão e decisão `project.access` do BFF Honji ainda não possui contrato de transporte. Implementar `IdentityGateway` com essa fonte confiável é a única substituição necessária para retirar o modo de negação em produção; tokens e senhas não são persistidos no CAEHUB.
