# UI React — UI-001
## Composição Comercial — 1.11.0

CommercialOrders mantém consulta/filtros/paginação e coordena diálogos;
CommercialOrderForm compõe o formulário existente para subtotal/total e
rascunho; CommercialOrderDetail representa próximos passos, ações confiáveis
e pendências; CommercialProduction consolida obrigações/lotes; CommercialShop
usa o catálogo seguro de compra e identidade existente. São responsabilidades
de domínio do mesmo fluxo, não uma biblioteca visual nova. Reutilizam Button,
Badge, Dialog, feedback, campos/formulário e composição editorial Comercial.
Fontes/tokens/temas, controles 44 px/16 px, foco/teclado e estados de erro/vazio
seguem DESIGN. Escopo não modifica estilos dos módulos anteriores.


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

## Comercial (1.7.0)

`CommercialPage` compõe controles, diálogos e feedbacks existentes para catálogo,
variações e movimentos; não cria biblioteca visual. A classe compartilhada
`form-fields` reutiliza os estilos de campos já consolidados nos diálogos da
Agenda (rótulos, superfície, 16 px, altura mínima 44 px, largura limitada).
Não altera estilos dos consumidores anteriores. Resultado de histórico que
chega depois de fechar/trocar diálogo é ignorado para preservar o contexto.

## Campanhas e cadastro Comercial (1.9.0)

`CommercialPage` navega por campanhas, catálogo geral ou itens sem vínculo.
Cards compactos resumem categoria, venda, estoque e número de variações;
`ProductDetail` concentra custo/venda/margem e seletor de variação com ações.
`CommercialForms` compõe `form-fields`, Button e controles nativos existentes
para cadastro, categoria e seleção em lote. `OptionPicker` combina os valores
selecionados sem exigir novos cadastros de produto. `CategoryEditor` persiste
opções reutilizáveis na categoria; alterações não recriam variantes existentes.
São responsabilidades de domínio, sem nova biblioteca ou controle base.
Campanha selecionada pré-preenche o cadastro. Mutações só aparecem com
`canManage`; perfis de debug e consulta ampla continuam somente leitura.

## Portal público — 1.12.0

PublicPortal compõe HonjiBrand, Button/Badge/Eyebrow, Dialog, estados de feedback,
CommercialOrderForm, CommercialOrders e CommercialOrderDetail. Sua responsabilidade
é a entrada anônima e seleção temporária por campanha; não duplica a biblioteca
visual, cálculos/reservas do servidor ou acompanhamento pós-compra. CSS local
usa tokens e composição Comercial existentes, temas e geometria de campos.
Placeholder textual substitui imagens ausentes, sem criar ativos de marca.

## Compras e retirada — 1.13.0

ThemeToggle extrai o controle existente do AppShell: mesmo ícone e geometria de
44 px, título/nome acessível e tokens no portal e na área interna. Brand recebe
href e preserva o ativo oficial CAECOMP. CommercialShop compõe PublicPortal em
modo interno, reutilizando a mesma seleção/formulário e impedindo divergência
entre telas. Âncoras locais mantêm o contexto da rota interna.
BuyerOrdersPage usa CommercialOrders com consulta própria, itens e quantidades
registrados, situação legível, filtros recolhidos e paginação proporcional.
Não mostra alocação/estoque global como quantidade comprada. Na retirada, esses
pedidos precedem a vitrine física. Troca de campanha com seleção pede decisão
explícita sem perder itens. Notificações de pedido levam ao detalhe pessoal;
a API revalida a titularidade, inclusive no link direto.
