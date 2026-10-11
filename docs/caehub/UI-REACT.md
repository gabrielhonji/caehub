# UI React — UI-001

## Regra obrigatória de reutilização

**C/UI-001:** qualquer padrão de UI já existente deve ser reutilizado. Antes de criar um componente, localizar o equivalente no catálogo e nos consumidores relevantes. É proibido duplicar botão, campo, diálogo, tabela, cartão ou layout para resolver uma diferença apenas de cor, espaçamento, tamanho ou estado.

Ordem: reutilizar → compor → acrescentar variante semântica compatível → criar um componente somente quando houver responsabilidade distinta. Registrar a justificativa de novo componente ou variante. Não usar seletores locais/adaptações isoladas que contrariem tokens, estados ou acessibilidade compartilhados.

Não supor acesso ao pacote UI Honji. Com ativos/contratos disponíveis, verificar compatibilidade e reutilizar. Sem acesso, planejar uma camada compartilhada local alinhada a DESIGN.md, com origem e dependências claras, sem afirmar que é o Design System central oficial. Não bloquear todos os protótipos pela ausência de acesso central.

## Stack e separação

**C:** React/TypeScript. **H:** Tailwind CSS/Vite preferidos. **P:** versões, bibliotecas, roteamento, estado e integração de servidor. Nenhuma biblioteca adicional é obrigatória por este documento.

**R:** separar fundamentos/tokens, componentes base, componentes de domínio e telas. Componentes base não decidem permissões ou regras de cartões. Telas compõem componentes; domínio fornece regras; fronteira de integração traduz contratos confirmados. Nomes/pastas concretos serão escolhidos no checkout de implementação.

## Catálogo mínimo proposto

| Camada | Componentes candidatos (R) | Obrigações de consistência |
| --- | --- | --- |
| Fundamentos | Tokens de cor semântica, tipografia, espaço, borda, foco, elevação e movimento | Temas e estados com mesma semântica |
| Controles | Button, IconButton, Field, Input, Select, Checkbox | Rótulos, erros, foco, disabled/loading |
| Feedback | Alert, EmptyState, LoadingState, Badge, Tooltip | Texto útil e estado acessível |
| Composição | AppShell, PageHeader, Dialog, Table/List | Responsividade, teclado e foco |
| Gestão | SpaceSummary, Board, CardSummary, ParticipantPicker | Usar controles base; obedecer políticas do domínio |

É um mapa de responsabilidades, não uma exigência para criar todos os nomes antes da primeira tela. Criar o mínimo necessário e centralizar padrões à medida que aparecem. Não construir Agenda/Comercial por antecipação.

## Contrato de componente

Cada componente compartilhado documenta propósito, variantes semânticas, estados, comportamento por teclado/mobile e exemplos com dados fictícios. Usar tipos explícitos para estados relevantes; evitar uma coleção de flags que permita combinações incoerentes.

As telas não redefinem controles base. Um componente de cartão pode exibir atribuições e auxiliares, mas não assume que qualquer participante pode editar. Nenhuma ocultação de botão substitui autorização de servidor.

## Aceite UI-001

Antes de concluir: comprovar reutilização ou justificar responsabilidade nova; conferir DESIGN; verificar estados e interação alterados; avaliar consumidores impactados por mudança compartilhada. Não exigir um teste automatizado que apenas replique classes CSS. Interações críticas e regressões precisam de evidência apropriada, conforme ENG-001.

## Composição de fluxos da Agenda (1.5.0)

`AgendaSummary` compõe `Eyebrow` e ações existentes como entrada compacta;
`AgendaWorkflow` compõe `Dialog` para isolar formulários e resultados sem
expandir a página. A responsabilidade de domínio é manter o rascunho em memória
quando o fluxo fecha; recarregar a página descarta o rascunho. Não há nova
biblioteca, persistência de documentos ou componente base duplicado.

O `Dialog` compartilhado usa o elemento nativo no topo da página, título único,
fundo inerte e bloqueio de rolagem. A variante `wide` acomoda fluxos de revisão;
o cabeçalho permanece visível e o conteúdo tem rolagem limitada à viewport.
Escape fecha o diálogo superior; Tab fica no diálogo e fechar restaura o foco.
A composição mantém a variante padrão usada pelo Kanban. Layout, teclado e
formulários longos são verificados em Chromium, 1440/390 px e nos dois temas.

## Formulários e notificações da Agenda (1.6.0)

`AgendaTimeFields` compõe controles nativos com os campos e tokens existentes:
uma data, relógios predefinidos ou específicos e término posterior ao início.
Traduz para os mesmos timestamps da API; a opção de outro dia preserva eventos
longos. É compartilhado por reuniões, votações, turnos e disponibilidade;
reset após sucesso e fechamento com rascunho seguem os fluxos existentes.

`AgendaNotifications` assume a responsabilidade de atualizações globais no
`AppShell`, compondo `Dialog`, `Button` e `Badge`. O sino tem nome acessível,
contador de não lidas e leitura persistida pela API existente. Atualiza após
operações da agenda, ao abrir e ao retornar à janela; respostas antigas não
sobrescrevem a consulta mais recente. Filtros usam grupos de botões com
`aria-pressed`; detalhes opcionais ficam recolhidos. Nenhum controle base ou
biblioteca foi duplicado. Revisão em 1440/768/390 px e ambos os temas.
