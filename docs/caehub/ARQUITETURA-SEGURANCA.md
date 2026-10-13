# Arquitetura e segurança

## Integração Agente 08 — contrato D-62

O botão Google envia `kc_idp_hint=google` e `prompt=login` para abrir o broker
mesmo com SSO ativo. O provider central usa `prompt=select_account` para exibir
a escolha de conta Google. Entrada Honji comum conserva a sessão SSO.

O BFF valida assinatura RS256/JWKS, issuer, audience, exp/iat, nonce, azp
quando presente e sid. Authorization Code + PKCE S256 usa state e transação
OAuth persistente de 10 minutos, consumida sob lock antes do token exchange.
Login válido rotaciona o identificador e o CSRF; sessão expira por 1h inativa
ou 12h absoluta. Cookie `__Host-caehub.sid`: host-only, Path=/, HttpOnly,
Secure, SameSite=Lax. Destino de retorno é interno. Tokens OIDC não são
armazenados nem enviados ao navegador; sessões anteriores sem sid exigem login.

`POST /internal/authorization/decisions` recebe JWT técnico, integrationId
`caehub`, userId do subject OIDC, identitySessionId do sid, projeto CAECOMP e
`account.access`. Honji usa o UUID Keycloak como iam_users.id; esse contrato
é confirmado no callback central e na consulta do provedor, sem usar e-mail
como identidade. A resposta fornece allowed, projectAccess e
studentEmailVerified; hierarchy/institutionalAdmin aparecem quando houver
acesso ao projeto. Somente o token técnico é reutilizado, nunca decisões.
Sessão Keycloak encerrada ou perfil desabilitado retorna 401 e invalida a sessão local; suspensão,
conta pendente e integração suspensa negam; indisponibilidade falha com 503.

Conta externa Google verificada cria pessoa central sem grants. No CAEHUB,
comprador é people.honji_subject e pedido próprio usa buyer_person_id,
independentes de memberships. Compra externa exige prova de endereço exato
`@alunos.utfpr.edu.br`; membros institucionais ativos mantêm o fluxo existente.
E-mail acadêmico pode ser anexado a uma conta com outro endereço e confirmado
por link de uso único, válido por 30 minutos e vinculado à mesma conta/sessão.
Reenvio aguarda 1 minuto; uma prova acadêmica pertence a uma identidade.
O backend revalida a prova; campos/headers do navegador não concedem acesso.
Sem project.access e membership ativo, Gestão/Agenda/administração permanecem
negadas. Conselheiro mantém consulta ampla e edição por função contextual.

`POST /api/buyer/student-email` e `/confirm` delegam ao Honji a emissão e a
confirmação, com sessão e CSRF. Cookies/sid não são compartilhados entre apps.
`POST /auth/logout` encerra localmente mesmo após revogação, com CSRF; mode
`provider` inicia end-session do Keycloak. O Portal já encerra as sessões do
provedor e revalida sid: conferir o efeito entre aplicações com Keycloak real.
Consumidores legados que não enviam sid precisam de migração própria; não
presumir que todas as sessões da XII já tenham essa garantia.

401 é sessão ausente/expirada, 403 é autorização/CSRF negado e 503 é dependência
temporariamente indisponível, inclusive falha JWKS. A landing pública conserva
o catálogo quando a conta é negada; a tela de acesso oferece logout local com
CSRF derivado exclusivamente da própria sessão. APIs/sessão/callback não são cacheáveis. Identidade
de desenvolvimento exige NODE_ENV explícito development/test; produção só usa
as variáveis oficiais existentes e nunca aceita parâmetros de mock do browser.

## Limites confirmados

**C:** frontend React/TypeScript; autenticação central Honji/Keycloak+BFF; entrada vinculada a `project.access`; autorização local contextual; mock somente em desenvolvimento.

Fluxo conceitual: usuário → app CAEHUB → integração BFF Honji → identidade Keycloak. O acesso ao projeto é verificado segundo o contrato central; operações de domínio passam também pela política local. O desenho não define hosts, rotas, claims, identificadores de projeto nem formato de resposta.

## Responsabilidades e fronteiras

| Responsável | Obrigação do desenho |
| --- | --- |
| Honji/Keycloak+BFF | Autenticação e sinal de acesso ao projeto conforme contrato a confirmar |
| CAEHUB, camada confiável de servidor | Validar operação, recurso e contexto local; impedir acesso entre contextos |
| Frontend | Representar estados de sessão/acesso e esconder/desabilitar ações conforme política; nunca ser a única proteção |

**P-01/P-07:** definir onde roda a autorização local e como o servidor CAEHUB se relaciona com o BFF. Não assumir que o BFF já implementa as regras do CAEHUB nem provisionar um novo servidor como consequência desta documentação.

## Requisitos de implementação de segurança

Requisitos necessários para concretizar C-03/C-04; escolhas de transporte ficam pendentes.

1. Negar acesso quando identidade, project.access ou contexto não puderem ser validados. Falha de integração não aciona mock em produção.
2. Verificar autorização na camada confiável em cada leitura/mutação, inclusive busca, listagem, exportação e acesso por identificador direto. Filtragem visual isolada é insuficiente.
3. Resolver ator e vínculos a partir de fonte confiável. Não aceitar papel/permissão/autoria enviados pelo cliente como prova.
4. Aplicar menor privilégio e isolamento de contexto. project.access é porta de entrada, não papel local, filiação automática a Espaços ou permissão global.
5. Impedir associação de objetos de contextos incompatíveis. Auxiliar, responsável e integrante são relações de domínio; nenhuma equivale automaticamente a poder administrativo.
6. Validar entradas e regras de negócio no servidor; não expor segredos ou dados desnecessários em respostas, erros e logs.
7. Não introduzir fluxos paralelos de login ou persistência de tokens no navegador sem contrato aprovado. Documentar cookies, proteção CSRF quando aplicável, expiração, logout e revogação a partir do contrato real.
8. Verificar concorrência nas operações cujo estado pode ficar inválido por outra alteração. Estratégia concreta depende da persistência escolhida.

## Autorização local contextual

**R — modelo lógico:** decisão de acesso recebe ator confiável, ação, recurso e contexto (projeto, Espaço/departamento, board/cartão ou lojinha conforme domínio). Permissões locais devem ser testáveis separadamente da interface.

**P:** matriz final de ações/papéis, vínculos, herança e exceções. Não criar um catálogo definitivo de permissões neste estágio. Cada operação implementada precisa de uma política aprovada; operações pendentes continuam indisponíveis.

| Ameaça | Evidência exigida |
| --- | --- |
| Usuário com project.access tenta acessar outro Espaço | Rejeição de leitura e mutação pelo servidor |
| Troca de ID no pedido | Escopo/contexto checados novamente |
| Cliente inventa papel de gestor | Papel recebido do cliente não concede acesso |
| Sessão/acesso deixa de ser válido | Operação negada conforme mecanismo central confirmado |
| Encomenda de outra lojinha | Acesso negado; estoque central não torna encomendas globais |

## Mock e trabalho independente da integração

**C:** usar somente desenvolvimento, com dados fictícios. O mock deve representar cenários permitidos e negados; não serve como evidência de integração real.

**R:** adaptador de desenvolvimento separado, acionamento explícito e proteção no build/inicialização que impeça ativação em produção. Escolher mecanismo após definir ambiente e ferramentas; comprovar no gate de release que o mock não concede acesso no artefato produzido.

Pode avançar: componentes, layouts, estados de erro/acesso, modelo conceitual e políticas já aprovadas. Aguarda contrato: sessão real, project.access, revogação e integração. Nenhum endpoint de exemplo deve virar contrato por cópia.

## Dados e rastreabilidade

### Hierarquia integrada — D-59, 11/10/2026

D-60: cada pessoa possui um departamento por projeto, como diretor ou membro.
Cargos administrativos não criam vínculos; direção/membro no mesmo departamento
são mutuamente exclusivos. Projeção antiga ambígua não concede herança até
correção no Honji. Perfis de visualização usam os departamentos reais de
Eventos/Produtos e não aparecem como participantes reais. Perfis da XII não
ganham acesso ao CAEHUB. Seletor agrupado, owner-only e somente leitura.

Honji mantém cargos institucionais e departamentos por projeto. A primeira
edição no painel ativa a projeção central; antes disso, a configuração local
existente continua disponível. Depois, cargos e vínculos são editados somente
no Honji e recebidos pela decisão técnica autenticada de `project.access`.
Administradores/presidência nomeiam diretores; diretores definem membros do
próprio departamento. Presidente/vice acumulam direção. Conselheiro consulta
com a mesma abrangência da presidência; edição exige outra função autorizada.

Participação em espaço departamental é herdada do vínculo ativo e direção
autoriza sua administração. Vínculos diretos paralelos desses espaços são
substituídos pela projeção; espaços gerais mantêm participantes explícitos.
Remoção, troca de direção e suspensão revogam o acesso, inclusive quadros,
cartões, atribuições disponíveis e listagem de tarefas. IDs persistem ao
renomear departamentos; a direção de Produtos preserva o acesso Comercial
pelo ID estável, sem depender do nome. Agenda mantém privacidade dos blocos
pessoais; visualização ampla não concede organização ou inscrição coletiva.

Projetos têm estruturas independentes. O contrato permite novos consumidores,
mas não migra as permissões específicas da XII nesta entrega.

**H:** fixtures, capturas, testes e exemplos usam dados fictícios. **R:** registrar alterações sensíveis com ator confiável, ação, recurso/contexto e momento, sem segredos. Retenção, acesso aos registros, exclusão e dados pessoais necessários devem ser definidos antes de persistir dados reais.
