# Comercial — fase futura

Entrada: BASE.md + este documento; dependências seletivas: autorização contextual, DESIGN/UI-001 e critérios C em ACEITE.md.

## Invariantes confirmadas

**C:** estoque físico é central. Encomendas são exclusivas por lojinha. Não criar estoques físicos independentes por loja como fonte de verdade; não misturar encomendas entre lojinhas por haver estoque compartilhado.

Estoque compartilhado não implica catálogo, preço, acesso a compradores ou encomendas compartilhados. O vínculo da encomenda com sua lojinha deve ser preservado e validado em toda operação.

## Modelo conceitual proposto

| Conceito | Estado | Responsabilidade |
| --- | --- | --- |
| Estoque físico central | C | Fonte central de quantidade física |
| Lojinha | C/P | Contexto exclusivo de encomendas; gestão e catálogo ainda pendentes |
| Item/variante | R | Identificação daquilo que se conta fisicamente |
| Movimentação | R | Rastrear entrada, saída ou ajuste com motivo e ator |
| Encomenda | C/P | Pertence à lojinha; significado operacional e campos pendentes |
| Reserva | R/P | Separar comprometimento de quantidade física, somente se aprovado |

Não tratar encomenda como retirada física automática. Não definir uma encomenda como compra de item já disponível ou como pré-venda sem confirmação. Nenhum contrato de pagamento, gateway ou endpoint faz parte deste plano.

## Regras a decidir (P-06)

Definir: catálogo/variações, unidade de contagem, poderes sobre estoque central, saldo negativo, reserva e liberação, disponibilidade, ciclo de encomenda, cancelamento, pagamento, retirada/entrega, devolução e reconciliação. Decidir também quem pode ver cada lojinha e se há operações administrativas entre elas.

**R:** distinguir quantidade física, reservada e disponível quando houver reserva aprovada; validar concorrência de reservas/baixas na camada confiável para evitar consumo duplicado. Fórmula e momento de baixa não são definidos aqui.

## Segurança e aceite futuro

Consultar, editar ou exportar encomenda requer autorização na lojinha de origem. Usuário autorizado na lojinha A não ganha acesso à B. Eventual administrador transversal requer regra explícita; não inferir essa exceção.

A futura fase deve demonstrar que duas lojinhas usam a mesma fonte de estoque físico e que suas encomendas permanecem isoladas, inclusive por ID direto e exportação. Testar concorrência e reconciliação depois de aprovar o fluxo operacional. Não implementar contabilidade, emissão fiscal ou pagamento por antecipação.
