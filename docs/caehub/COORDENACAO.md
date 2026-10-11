# Coordenação de agentes

## Atividade atual — Agente 04, 11/10/2026

Objetivo: Agenda Avançada, reuniões coletivas e escalas. Branch local:
`feat/agenda-avancada`, base `e97e004` com incrementos 01–03 presentes.
Primeira etapa validada localmente nos arquivos `src/server/timetable*`, Agenda/API,
`src/components/TimetableImport.tsx`, serviço React, estilos, Dockerfiles e
documentação pertinente. O cliente HTTP compartilhado também foi corrigido:
requisições sem corpo não enviam Content-Type JSON. Commit e push da branch
fazem parte do encerramento deste incremento; merge e deploy não estão autorizados.

Evidência: 15 testes de backend passaram em MySQL descartável; TypeScript e
build Vite em modo de produção passaram. Chromium verificou upload/prévia real
sem persistência, confirmação obrigatória, erro de PDF inválido, cadastro
fictício, exceção/restauração/remoção e teclado. Revisão visual e ausência de
overflow em 1440/390 px nos dois temas; nenhuma exceção JavaScript.
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
Próximo incremento funcional: disponibilidade coletiva ampliada e solicitações
“Organizando reunião”.

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
