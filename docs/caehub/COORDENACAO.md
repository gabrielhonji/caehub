# Coordenação de agentes
## Entrega validada — Hierarquia institucional, 11/10/2026

HIER-01, Codex deste chat. Integração com estrutura central Honji por projeto:
cargos acumuláveis com direção; departamentos editáveis; conselheiro com
consulta ampla e edição apenas por outra função autorizada. Vínculos herdam
espaços/quadros; direção administra o departamento. Remoção/troca/suspensão
revoga acesso, inclusive tarefas. Departamentos novos recebem espaço e quadro.
Página de departamentos e panorama usam dados reais, sem listas fixas.
Comercial preserva a direção responsável quando o departamento é renomeado.

Validação: 24 testes de servidor em MySQL descartável, incluindo projeção,
idempotência, revisões antigas, revogação e conselheiro com direção acumulada;
TypeScript e Vite aprovados. IAM: 31 testes de política e uma integração de
persistência/concorrência. Auditoria de dependências sem vulnerabilidades.
Chromium validou cinco perfis no painel Honji, edição/criação de departamentos,
gestão de membros, seleção de projeto e departamentos no CAEHUB; 1440/768/390 px,
claro/escuro, sem overflow ou exceções. APIs visuais usam fixtures fictícias;
isso não comprova sessão SSO real em produção. Servidor dev teve cache 504 no
mount somente leitura; revisão final usa builds de produção em rede Docker
privada, sem mudar permissões nem publicar portas.

Fonte de regras: D-59 e ARQUITETURA-SEGURANCA. A primeira edição no Honji ativa
a autoridade central; cargos/vínculos locais passam a ser projeção, e espaços
departamentais usam somente a participação herdada. Espaços gerais preservam
vínculos próprios. Não altera Keycloak, segredos, infraestrutura ou a XII.
Commit/push são registrados no Git. Gabriel autorizou posteriormente deploy e
registro de instruções nos AGENTS.md. Publicado CAEHUB 1.8.0, fonte `8106a58`,
imagem `honji/caehub-gabriel:1.8.0`, com healthcheck Healthy e HTTPS confirmando
versão/release. IAM 1.4.0 (`c09ea44`) ficou Healthy antes dos consumidores;
Portal 0.8.0 publicado na release `20261011-221511`, com painel confirmado no
bundle público. APIs anônimas foram recusadas; não foi usada sessão pessoal
para testar a hierarquia em produção. A primeira edição no Honji ativa a
estrutura central. Regras duráveis adicionadas aos AGENTS.md dos dois projetos.

## Atividade atual — Cards da Agenda, 11/10/2026

Incremento `fix/agenda-card-times`, base `8eae416`, versão 1.6.1. Todos os cards
mostram início/fim com relógios mais legíveis; término em outro dia inclui a
data. Grade própria é identificada como Aula. Outros blocos próprios preservam
notas particulares ou mostram Ocupado. Consulta coletiva continua retornando
somente ocupação; não recebe títulos, notas ou período letivo de terceiros.

Validação: 22 testes de servidor, incluindo rótulo pessoal, horários projetados
e ausência de detalhes na consulta coletiva/agenda de outro titular; TypeScript
e Vite. Chromium verifica relógios, término em outro dia e cards em
1440/768/390 px, temas claro/escuro, com dados fictícios. Publicação pelo canal
oficial após commit/push e integração em main. Não altera dados persistidos.


Incremento `fix/agenda-import-and-creation`, sobre `main` em `eb3d99c`, versão
1.6.0. Importação lista pendências e só confirma metadados, blocos válidos e
revisão explícita. Extrator inclui a primeira coluna e consolida períodos
ocupados consecutivos, sem inventar horários ou unir períodos vazios.
O usuário confirmou o término de quarta às 18h20, conforme o PDF.

Reuniões, votações, turnos e disponibilidade compartilham data e relógios com
presets/customização e término posterior; detalhes opcionais recolhidos.
Consulta semanal oferece intervalos predefinidos/customizados e filtros
conectados. Notificações ficam no sino do cabeçalho, com leitura persistida.

Validação: 22 testes de servidor, TypeScript e Vite. Chromium com o PDF real
verificou os seis blocos esperados, ocupação na segunda, almoço livre na terça,
quarta livre após o término, bloqueio da confirmação incompleta, relógios,
intervalo customizado, criação de reunião/votação/turno e leitura de notificações
entre páginas. Revisão visual em 1440/768/390 px nos dois temas, sem overflow
nem exceções JavaScript; dados das capturas são fictícios. Documento privado
não versionado. Grade importada anteriormente exige reimportação do mesmo
período para substituir os blocos antigos; blocos manuais permanecem.
Publicação segue integração em `main`, `build-app` e `deploy-app`, com gate de
saúde e reversão do canal. Sem alteração de auth, schema ou infraestrutura.

## Atividade atual — UX da Agenda, 11/10/2026

Incremento `feat/agenda-ux`, sobre `main` em `a98bf06`, versão 1.5.0.
Calendário, quatro cards de ações com alturas consistentes e listas resumidas
substituem a grade de formulários expansíveis. Importação, disponibilidade,
reuniões, planejamento, notificações, votações e turnos abrem em diálogos com
rolagem própria. Planejamento semanal filtra por dia e horários livres;
votações/turnos separam itens ativos de encerrados/cancelados. Rascunhos ficam
em memória ao fechar/reabrir; falha de salvamento preserva os campos.

Validação: 18 testes de servidor passaram em MySQL descartável; TypeScript e
Vite passaram. Chromium verificou quatro cards com altura igual, 30 opções de
votação e 24 aulas sem ampliar a página, rascunhos, teclado, histórico
sobreposto, criação/voto, disponibilidade e edição de reunião. Revisão visual
em desktop/mobile e temas claro/escuro. Dados de revisão são fictícios. Sem
alterações em autorização, contratos de API ou infraestrutura de produção.
Publicação segue `build-app`/`deploy-app` após integração validada em `main`.

## Entrega anterior — Agente 04, 11/10/2026

Objetivo: Agenda Avançada, reuniões coletivas e escalas. Branch local:
`feat/agenda-avancada`, base `e97e004` com incrementos 01–03 presentes.
Agenda Avançada implementada: grade UTFPR, consulta semanal por pessoas/vários
departamentos, solicitações de revisão, votações e escalas contextualizadas.
Reutiliza Agenda/API, notificações e componentes locais. Janela prioritária de
desistência: 2 horas, configurável pela direção. O usuário autorizou commit,
push, integração e deploy da versão 1.4.1 pelo canal oficial.

Evidência: 18 testes de backend passaram em MySQL descartável; TypeScript e
build Vite em modo de produção passaram. Chromium verificou upload/prévia real
sem persistência, confirmação obrigatória, erro de PDF inválido, cadastro
fictício, exceção/restauração/remoção e teclado. Revisão visual e ausência de
overflow em 1440/390 px nos dois temas; nenhuma exceção JavaScript. A ampliação
também validou votação/convocação, confirmação consciente de conflito, histórico,
configuração da janela, desistência e cancelamento. Testes cobrem concorrência,
limites de capacidade, reconfirmação, privacidade e autorização contextual.
O exemplar UTFPR anexado foi extraído com início/fim impressos reconhecidos;
nenhum documento ou dado pessoal foi adicionado ao repositório. Teste sintético
cobre o formato de duas colunas de horários, sem separador.

O bloqueio do socket foi resolvido pela autorização do usuário para executar
Docker fora do sandbox, sem sudo, alteração de grupos/ACLs ou portas no host.
O MySQL de desenvolvimento recusou conexão; foi preservado e substituído apenas
para validação por container/banco descartáveis na rede
`caehub_agenda04_validation`. O timeout anterior de DNS do Docker Hub não se
repetiu fora do sandbox: host, container, daemon e BuildKit resolveram o
registry; pull das bases e `docker compose -f compose.dev.yml --progress plain
build --pull` passaram. Nenhuma configuração de DNS ou proxy foi alterada.
Publicação usa a origem já registrada `main`, `build-app` e `deploy-app`, com
healthcheck e rollback do canal. Não modifica DNS, proxy ou credenciais.
Entrada real autenticada depende da sessão Honji do usuário; fixtures não são
evidência dessa sessão. O gate público verifica portão real e rejeição sem sessão.

## Execução simples como padrão

**H:** usar o método mais simples; um quadro Kanban de coordenação não é obrigatório. Kanban de produto em Gestão continua confirmado. Não confundir essas duas decisões.

Um agente pode receber BASE + especificação do módulo + tarefa delimitada. Complementos são lidos sob demanda. Um coordenador mantém estado curto, resolve dependências e verifica integração; não repassa o histórico completo.

## Delegação

**H/regra de execução:** propor divisão e obter autorização antes de iniciar subagentes. Depois de autorizada uma divisão, coordenar aquele escopo sem pedir aprovação a cada passo. Este pacote descreve coordenação futura; não autoriza criar agentes ou chats por si só.

Delegar somente tarefas delimitadas e independentes. Cada tarefa informa: objetivo, arquivos/áreas sob responsabilidade, dependências, critérios de aceite e verificação esperada. Não atribuir edições concorrentes de DESIGN, componentes base, políticas comuns ou schema. O coordenador integra e resolve conflitos.

**R — divisão quando houver autorização:** UI base/Design; domínio Gestão; integração/segurança. Domínio depende de P-02/P-03; integração depende de P-01/P-07. Trabalho visual pode avançar com fixtures; isso não desbloqueia produção. Agenda e Comercial aguardam sua fase.

## Entrada compacta para uma tarefa

Modelo a preencher, sem criar infraestrutura adicional:

> Objetivo: [resultado específico]. Contexto: BASE.md + [módulo]. Escopo: [áreas/arquivos]. Dependências: [seções/decisões]. Restrições: [limites]. Aceite: [IDs]. Verificação: ENG-001 conforme risco. Entrega: alterações e evidências curtas, pendências e próximo passo.

Não fornecer IDs de contratos, endpoints ou papéis provisórios como se aprovados. Agente deve parar somente a operação dependente de uma decisão ausente e continuar trabalho independente autorizado.

## Handoff e estado

Handoff: resultado; arquivos/áreas alterados; critérios atendidos; verificações com escopo/resultado; pendências; próximo passo. Não colar logs completos ou repetir a especificação.

**R:** na implementação, manter um único estado curto com objetivo, marco atual, decisões novas, andamento, bloqueios/dependências, próxima tarefa e evidência. Fonte de verdade de regra continua no módulo; não duplicar em status. Criar arquivos extras apenas quando volume ou coordenação justificar.

O coordenador aplica a revisão proporcional por tarefa e o gate completo por marco/release. Não declarar pronto com base apenas em resumos de agentes quando ainda falta integração ou verificação. Componentes e regras comuns têm um responsável por rodada de edição.

## Entrega validada — Agente 05, 11/10/2026

Branch `feat/catalogo-inventario`, base `3369fae` limpa e integrada. Escopo:
`src/server/commercial*`, migração/database e rotas/app, tela Comercial e sua
composição, testes de integração, documentação Comercial/ENG/coordenação.
Sem reservas concorrentes identificadas nestes caminhos.

Aceite observável: administração/direção de Produtos cadastra catálogo e
variações P/M independentes; entrada 50, saída 8, recusa de 43 e ajuste +3
justificado resultam em 45, com histórico/ator; baixas concorrentes não deixam
saldo negativo; membro comum e direção de outro departamento recebem 403;
campanha exclusiva não pode ser trocada/reutilizada; reconexão mantém saldos.
UI real em desktop/mobile e ambos os temas, feedback de erro/sucesso, gate
completo antes de commit/push, integração main e deploy oficial autorizados
pelo pedido Agente 05. Sem checkout, pedidos, pagamentos ou reservas.

Evidência: 23 testes completos de servidor em MySQL descartável; TypeScript,
Vite e `npm audit --omit=dev --audit-level=high` passaram (zero vulnerabilidades).
Gate de metadados confirmou 1.7.0. Chromium percorreu cadastro/campanha,
variações independentes, edição, entradas/saídas/ajuste, recusa sem perder
rascunho, histórico, busca/vazio e recarga. Revisão final em 1440/768/390 px,
claro/escuro, campos compartilhados de 44 px/16 px, teclado/foco, sem overflow
ou exceções. Reinício real do servidor manteve saldo 45 e histórico intacto.

Preparação visual encontrou EACCES em bind mount temporário; instalação e
capturas passaram ao filesystem interno do container, sem alterar permissões,
labels ou infraestrutura do host. Timeout de seletor visual foi corrigido;
teste aguardou aplicação pronta. Nenhuma falha de código/gate permanece.
Escopo ampliado somente para alias `form-fields` do padrão existente, README,
UI-REACT/ACEITE/decisões; não altera estilos anteriores. Dados são fictícios e
não versionados. Publicação usa origem oficial já cadastrada em main,
`build-app caehub-gabriel 1.7.0` e `deploy-app` com healthcheck/rollback.
Resultado Git/publicação é informado separadamente no relatório deste chat;
validação autenticada de produção depende da sessão real do usuário, enquanto
o gate público verifica acesso Honji e recusa sem sessão.
## Refinamento contextual de espaços — 11/10/2026

Implementado e validado por Codex /root: `src/app/App.tsx`, `src/components/WorkspacePeople.tsx`,
`src/services/spaces.ts`, `src/styles/space-tools.css`, `src/server/service.ts` e
`src/server/hierarchy.integration.test.ts`. Cards largos para 1–2 espaços;
participantes/direção nos detalhes; edição contextual e encaminhamento ao
departamento no Honji. 25 testes de servidor, TypeScript/build e Chromium
(0/1/2/3/7 espaços, cinco perfis, 1440/390 px e ambos os temas) aprovados.
Auditoria de produção sem vulnerabilidades. Publicado em 12/10/2026 pela origem
autoritativa: fonte `d5abe6a`, imagem `honji/caehub-gabriel:1.8.2`, container
Healthy, health e bundle HTTPS 200, API de espaços anônima 403. Metadados
editoriais do package continuam em 1.8.0; a tag de imagem identifica este deploy.
Portal contextual `e2a4383`, release `20261012-023654`. Capturas/fluxos visuais
usam fixtures fictícias; não houve smoke com sessão autenticada de produção.
Incremento concluído e reservas liberadas.
