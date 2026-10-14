# API institucional, Kanban e Agenda — Incrementos 01 a 04

## Reenvio Kanban e participação — 14/10/2026

Criação de cartões/colunas/comentários/checklist aceita header opcional
`Idempotency-Key` (UUID). Ator, operação/recurso e chave identificam o comando;
payload diferente na mesma chave retorna 409. Gravação, atividade e recibo
ficam na mesma transação. Replay verifica novamente o acesso atual; não
armazena dados do formulário no recibo, somente hash e ID do resultado.
Sem header, o contrato anterior permanece; clientes atualizados enviam a chave.
Tabela nova: `kanban_commands`, criada pela migration comum idempotente.

Cards de `GET /boards/:id` e `GET /foundation` incluem `isHelper` e `canMove`
derivados do ator no servidor. POST/DELETE de auxiliares definem entrar/sair,
sem toggle implícito no backend: repetir intenção não inverte nem duplica efeito.
Reentrar conserva o histórico anterior. Movimento repetido para a coluna atual
é no-op; movimento com revisão antiga para outra coluna continua retornando 409.

Base: `/api`. JSON; erros usam `{ error, message }` e retornam `400`, `401`, `403`, `404`, `409` ou `503`. `GET /health` expõe também a versão e o identificador de release no formato `DDMMAAAA-HHMMSS`.

O servidor resolve o ator na fronteira `IdentityGateway`. Em produção, o BFF Honji usa Authorization Code + PKCE, sessão persistida no MySQL e uma decisão central nova de `account.access`, com sessão Keycloak viva e `projectAccess`, em cada requisição protegida. Institucional exige também membership ativo; comprador externo exige e-mail acadêmico verificado e acessa somente rotas próprias. Sem configuração completa ou decisão positiva, o acesso é negado; nenhum cabeçalho, payload ou papel fornecido pelo navegador concede acesso.

`POST /api/buyer/student-email` recebe somente `{studentEmail}` do domínio
`alunos.utfpr.edu.br`; `/api/buyer/student-email/confirm` recebe somente
`{verificationToken}`. Ambos exigem sessão/CSRF e usam o contrato central.
`GET /api/me` informa buyerAccess e institutionalAccess separadamente.
`POST /auth/logout` encerra localmente; `{mode:'provider'}` inicia end-session.
Contratos completos de expiração, revogação e identidade estão em
ARQUITETURA-SEGURANCA.md.

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
| `GET /api/foundation` | carga agregada de espaços, tarefas e quadros acessíveis para evitar consultas HTTP em cascata |
| `GET /api/agenda` | calendário pessoal, geral ou de Espaço por intervalo; indisponibilidades são projetadas sem duplicação |
| `GET /api/agenda/foundation` | carga agregada do período: calendário, indisponibilidade própria, opções autorizadas, departamentos, notificações e contexto da sessão |
| `GET, POST /api/availability/me` | consulta e cadastro da indisponibilidade do ator |
| `PUT, DELETE /api/availability/me/:id` | edição/remoção exclusivamente pelo titular |
| `GET /api/availability/collective` | livre/ocupado/não informado para direção/administração, sem detalhes particulares |
| `GET /api/availability/options` | opções mínimas de pessoas de todos os departamentos para filtros e convites da direção/administração |
| `POST /api/meetings`, `PATCH /api/meetings/:id` | criação e gestão de reunião por direção/administração/organizador |
| `POST /api/meetings/:id/response` | resposta do convidado: confirmado, talvez ou recusado |
| `GET /api/agenda/notifications` | convites, reagendamentos e remoções persistidos do ator |

Visibilidade `directors` é filtrada antes do detalhe e usa `404` para não revelar o recurso. Somente direção/administradores alteram visibilidade ou arquivamento. Criador, responsável e auxiliar podem editar campos permitidos. As cinco colunas padrão são inicializadas por quadro de forma idempotente; `is_completion` preserva a semântica de conclusão independentemente do nome.

`POST /api/members` recebe `honjiSubject`, `displayName` e opcionalmente `role`. O sujeito é o alvo de uma operação já autorizada, não prova de identidade do ator. `POST /api/workspaces` recebe `name`, `description?`, `departmentId?`. IDs são UUIDs.

Paginação ainda não é necessária para a escala institucional inicial; deverá ser incluída antes de uma listagem cujo volume a exija, sem alterar a política de escopo.

Datas de reuniões usam ISO 8601 na API e instantes UTC no banco. Consultas aceitam `offsetMinutes` para projetar horários civis recorrentes no deslocamento local do cliente. Mudança de início ou fim redefine respostas ativas para `pending`, incrementa a revisão e cria notificações persistentes. Edições recebem `expectedRevision`; uma versão obsoleta retorna conflito em vez de sobrescrever alterações concorrentes.

## Integração Honji

### Grade acadêmica — validação local concluída

- `POST /api/availability/import/preview`: corpo binário `application/pdf`,
  protegido pela mesma identidade/CSRF. Retorna `rows` e `warnings`, sem salvar.
  Cada candidato contém `weekday`, `code`, `startTime`, `endTime`, `needsReview`;
  horários incertos são `null` e precisam ser preenchidos.
- `POST /api/availability/import/confirm`: `{term, validFrom, validTo,
  confirmed:true, rows:[{weekday,startTime,endTime}]}`. Valida os intervalos,
  elimina duplicatas e substitui somente a grade importada do mesmo período.
- `PUT /api/availability/me/:id/exception`: `{date,excluded}` libera/restaura
  uma ocorrência semanal, exclusivamente pelo titular.

`GET /api/availability/me` acrescenta `term`, `validFrom`, `validTo` e
`excludedDates` aos blocos importados. Calendário e consulta coletiva aplicam
vigência e exceções sem expor notas particulares.

Migração idempotente acrescenta `academic_timetable_imports`,
`availability_blocks.timetable_import_id` e `availability_occurrence_exceptions`.
Testes de extração, persistência, reimportação concorrente e autorização passaram
em container. PDFs acima de 5 MB recebem HTTP 413; intervalos/períodos inválidos
recebem 409 e confirmação ausente recebe 400. O exemplar real fornecido foi
verificado na extração e na prévia, sem persistir dados pessoais. A revisão
Chromium cobriu o fluxo completo com dados fictícios. O build Compose com
`--pull` passou depois de host, container, daemon e BuildKit resolverem o
registry; o timeout anterior foi transitório. Evidência da primeira etapa;
a publicação da Agenda Avançada utiliza o mesmo extrator.

### Agenda Avançada — rotas sob `/api`

| Método e rota | Operação |
| --- | --- |
| `GET /availability/week` | até sete dias; `slotMinutes` de 15 a 240; seleções CSV `membershipIds` e `departmentIds` combinadas por união; sem descrições |
| `GET, POST /availability/requests` | solicitações `{title,from,to,participantIds,deadline?,workspaceId?}` |
| `POST /availability/requests/:id/review` | convidado registra `kind: unchanged ou updated`; atraso não bloqueia |
| `GET, POST /meeting-polls` | título, descrição/local/espaço opcionais, participantes, duas a trinta opções `{startsAt,endsAt}` e prazo opcional |
| `PUT /meeting-polls/:id/vote` | `{optionIds,noneWorks}` substitui votos enquanto aberta |
| `POST /meeting-polls/:id/close` | `{confirmed:true,optionId?}`; empate exige líder; sem votos válidos retorna 409; finalização idempotente retorna a mesma `meetingId` |
| `GET, POST /shifts` | turnos acessíveis/criação contextual; espaço, intervalo e `maximumCapacity` obrigatórios; mínimo opcional |
| `GET /shifts/related-meetings?workspaceId=...` | reuniões ativas do espaço para associação opcional `relatedMeetingId` |
| `PUT /shifts/:id` | campos completos e `expectedRevision`; `priorityWindowHours` padrão 2, configurável pela direção |
| `POST /shifts/:id/participation` | `action: volunteer, assign, accept, decline, withdraw ou remove`; atribuição/remoção exigem `membershipId` e direção contextual |
| `POST /shifts/:id/cancel` | cancelamento idempotente pela direção, preservando histórico |
| `GET /shifts/:id/history` | histórico restrito à direção do espaço |
| `POST /agenda/notifications/:id/read` | marca somente notificação do titular como lida |

Participação aceita `offsetMinutes` e `confirmConflict:true` após HTTP 409
`schedule_conflict`. A decisão fica no histórico; nunca supera capacidade nem
substitui aceite de atribuição. Reservas ocupam capacidade e aparecem
diferenciadas no calendário. Somente confirmações contam para o mínimo.
Alteração temporal redefine estados ativos para pendente, preserva os anteriores
no histórico e notifica. Desistência dentro da janela gera prioridade `high`.

`/agenda/foundation` inclui `requests`, `polls` e `shifts` autorizados.
Notificações possuem `resourceType`, `resourceId`, `priority`, título e leitura.
Votantes ativos do horário vencedor recebem `confirmed` na reunião única;
demais convidados começam `pending`. Nenhum canal externo foi introduzido.

### Contrato central existente

As rotas `/acesso`, `/auth/login`, `/auth/callback` e `/auth/logout` implementam o portão Honji. O cookie de sessão é Secure, HttpOnly, SameSite=Lax e não contém tokens; identificadores de sessão são armazenados somente como hash. Mutações exigem origem exata e token CSRF da sessão. Client secrets permanecem fora do repositório e da imagem.

Cada requisição protegida continua exigindo uma decisão central atual de `project.access`. Apenas o token técnico de client credentials é reaproveitado até pouco antes de expirar; decisões de usuário não são armazenadas em cache. As rotas `foundation` reduzem o número de travessias dessa fronteira sem afrouxar revogação ou autorização contextual.
