# Agente 13 — correções e evidências, 20/10/2026

Pedido atual e D-76 (coordenação Honji); escopo sem refatoração global React.
As 13 imagens citadas não foram anexadas ao arquivo acessível. Revisão usa o
código atual, Chromium e dados fictícios; nenhuma conta pessoal ou compra real.

Status: **corrigidos** os IDs desta matriz; sem correção parcial ou bloqueada.
Portal P01–P07 também corrigidos e publicados (detalhes na coordenação Honji).
CAEHUB 1.19.0, imagem oficial fonte `ffb1f7b`, publicado Healthy; Portal 0.12.2
release `20261020-164555`. Ambos em main nos remotos oficiais. Smoke HTTPS e
Chromium público aprovados. Não houve alteração de infraestrutura central.

| IDs | Implementação / aceite |
| --- | --- |
| P08 | 401 inicia Authorization Code/PKCE pelo BFF, preservando retorno; a leitura permanece pendente durante navegação e não renderiza erro transitório. Falha de entrada fica centralizada. Teste real de SSO registrado na entrega. |
| P09 | Panorama movido antes de Em foco. |
| K01–K03 | Sem reserva vazia na linha superior; gerenciamento compacto, hover/foco; disclosure sinalizado e revelação limitada a 160px no container rolável ativo, sem scroll ao fechar e com movimento reduzido. |
| K04–K06 | Título/descrição/tags editáveis no contexto; cancelar restaura, confirmação persiste, 409 mantém rascunho e permite reabrir versão atual. Propriedades essenciais e duas colunas de responsáveis. Edição avançada preservada; retorno curto e sem Fechar todos. |
| K07 | Criação a partir do quadro em Dialog existente, rascunho protegido e atualização automática do quadro. |
| K08 | RefreshButton em Kanban, detalhes, tarefas e calendários semanal/mensal: requisição pendente real e proteção contra clique repetido. Erros das telas permanecem visíveis; consulta encerrada não é confirmação de escrita. |
| K09 | Fieldset sem borda e ação para Portal com projeto/departamento reais, em nova aba; rota conferida no consumidor Hierarchy do Portal. |
| K10 | Página e modal compartilham detalhes; removida duplicação estática da página; navegação alinhada ao container. |
| A01–A03 | Término vazio/editável; manual muda para duração personalizada sem sobrescrita. Espaço é contexto; departamentos filtram convidados sem apagar seleção. Equipe adicionada explicitamente. Envio centralizado e pendente real. |
| A04–A05 | Participantes em até três colunas, nomes truncados com title/foco; fins de semana e horários alternativos ativos sem opacidade de desabilitado. Todos ocupados mantém distinção própria. |
| A06 | No formulário de reunião, revisão usa título/data/contexto/convidados atuais; confirmação explícita envia somente pedido de revisão, sem criar reunião. |
| A07 | Três cards na mesma região e dimensões; grade com superfície discreta; banner independente abaixo da região. |
| V01–V04 | Geometria estável nos controles; audiência compartilhada; opções mais compactas; regras preservadas como informação contextual discreta. |
| ES01–ES02 | Máximo antes de mínimo opcional; 0≤mínimo≤máximo com igualdade permitida. Semana inicial de sete dias, preview e aviso/impedimento de zero turnos. |
| PD01–PD04 | Ações de refazer alinhadas e responsivas; leitura de detalhe identificada por pedido, sem busy global; badges alinhadas e metadados em containers com gap. |
| N01 | Lista mais densa, separadores, indicador não lido, data, destino e ação preservados. |
| BUG01 | Relatos internos CAEHUB persistidos em MySQL; título/descrição/passos e screenshot voluntário PNG/JPEG/WebP até 512KB. Formato/assinatura/tamanho validados; download restrito ao administrador Honji. Limite transacional de cinco relatos/hora por conta. Administrador consulta 50 por página e resolve/reabre; erro mantém formulário. Não há publicação ou integração externa. A entrada está nos rodapés do Portal e CAEHUB e em `/#relatar-problema`; qualquer conta central autenticada pode enviar, sem receber acesso institucional. |

## Validação

- Gate servidor: 52/52; domínio: 3/3; tipos/build e audit produção sem vulnerabilidades.
- Testes novos: duas edições simultâneas (200/409), negação por contexto,
  persistência/privacidade/download/formatos e limite concorrente de relatos.
- Chromium: salvar/cancelar/409, reunião manual e convidados preservados,
  revisão confirmada, escala útil/igualdade/limite, criação em modal, banner,
  notificações e loading individual de pedidos com erro. Desktop/mobile,
  claro/escuro e capturas inspecionadas; pedidos usam apresentação fictícia,
  sem compra/transação em produção.
- Scripts: `test/browser/agent13-{flows,consumers}.cjs`; regressão existente
  `security/test/consolidated-agenda.browser.cjs` no repositório Honji.
- Publicação, imagem oficial e limitações finais registradas na coordenação.

## Handoff Agente 14

Reutilizados Button, Dialog, Badge, AgendaWorkflow, AgendaSummary,
DepartmentPicker, hooks de refresh e contratos de sessão. CardInlineFields
compõe controles existentes porque modal e página precisam da mesma edição;
RefreshButton concentra a mesma interação em quatro consumidores.
Permanecem formulários JSX e fluxos de feedback semelhantes em App/Agenda e
Comercial; estilos de formulários e badges ainda distribuídos entre folhas.
RefreshControls contém configuração automática atualmente sem consumidor.
Consolidar futuramente fieldsets/labels, propriedades de cartão e feedback
assíncrono, preservando gates de contexto/concorrência. Não houve auditoria
WCAG completa nem consolidação global de componentes.
