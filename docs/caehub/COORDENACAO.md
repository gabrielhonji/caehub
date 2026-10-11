# Coordenação de agentes
## Atividade atual — Grade e criação na Agenda, 11/10/2026

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
