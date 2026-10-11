# Comercial — catálogo e inventário (Agente 05)

Pedido de 11/10/2026 aprova catálogo, variações, unidades inteiras, saldo não
negativo, histórico, entradas/saídas/ajustes e vínculo exclusivo de encomendas.
BASE + autorização contextual + DESIGN/UI-001 continuam aplicáveis.

## Contrato implementado

Produtos têm UUID, nome, descrição, SKU único na organização, categoria textual,
preço de referência opcional em centavos, tipo físico/encomenda e situação
ativa/arquivada. Variações têm UUID, nome único no produto, SKU único e situação.
Todo produto começa com pelo menos uma variação (Única quando não houver
opções); o saldo sempre pertence à variação e começa em zero. Tipo e campanha
de origem são imutáveis: nova campanha de encomenda exige novo produto.
Alterações de produto usam versão esperada; edições obsoletas são recusadas.

Inventário físico central, inclusive sobras recebidas de encomendas. Nenhum
pedido futuro é contado. `physicalQuantity` e `availableQuantity` coincidem;
`reservedQuantity=0` e `reservationsImplemented=false` explicitam a ausência de
reservas reais. Reservas, limites de venda e pedidos são trabalho futuro.

Movimentações transacionais bloqueiam produto e variação, verificam saldo e
persistem alteração/histórico atomicamente. Entrada/saída recebem quantidade
positiva; ajuste recebe diferença inteira positiva/negativa. Justificativa é
obrigatória em todas; referência operacional é opcional. Histórico registra
delta assinado, saldo resultante, ator confiável/nome e timestamp do banco.
Não existem edição/exclusão de movimentações: corrigir por ajuste compensatório.
Produto/variação arquivado preserva saldo/histórico e impede movimentação até
reativação. Não há campo para sobrescrever saldo pelo frontend.

## Política de acesso

Consulta e manutenção administrativas requerem `project.access`, vínculo
institucional ativo e administração institucional existente (Owner central,
presidência, vice, conselho) ou papel institucional diretor com vínculo ativo
de direção do departamento Produtos. Filiação simples a Produtos ou direção de
outro departamento não concede acesso. A política é aplicada em cada rota pelo
backend com ator da sessão Honji/BFF; não aceita identidade/papel do navegador.
Perfis de debug continuam somente leitura. Consulta pública/compradores fica
para o próximo incremento, com política própria.

## API efetiva

Todas as rotas abaixo usam o BFF e proteção CSRF existentes nas mutações.

| Método e caminho | Resultado |
| --- | --- |
| GET `/api/commercial` | Produtos, variações/saldos, campanhas e capacidade administrativa |
| POST `/api/commercial/campaigns` | Campanha mínima: UUID, organização e nome |
| POST `/api/commercial/products` | Produto e primeiras variações atomicamente |
| PATCH `/api/commercial/products/:id` | Metadados/situação com versão esperada |
| POST `/api/commercial/products/:id/variants` | Nova variação com saldo zero |
| PATCH `/api/commercial/products/:id/variants/:variantId` | Nome, SKU e situação |
| POST `/api/commercial/products/:id/campaigns` | Vínculo sem duplicar estoque; recusa outra campanha para encomenda |
| POST `/api/commercial/variants/:id/movements` | Entrada, saída ou ajuste e saldo resultante |
| GET `/api/commercial/variants/:id/movements` | Histórico preservado |

Migração idempotente `migrateCommercial`, integrada ao boot/migrate existente:
`commercial_campaigns`, `commercial_products`, `commercial_variants`,
`commercial_campaign_products`, `commercial_movements`. FKs, unicidade e CHECKs
complementam validação estrita do servidor. Vínculos a campanhas físicas
referenciam o mesmo produto/variações centrais. Campanhas ainda não são lojas
operacionais; não há checkout, vendas, limites próprios ou gestão de pedidos.

## Interface e aceite

Comercial compõe AppShell, Eyebrow, Button, Badge, Dialog, LoadingState,
EmptyState, ErrorState e AccessDeniedState existentes, com tokens Honji.
Catálogo pesquisável inclui arquivados, formulário de produto, variações,
campanha mínima, movimentação e histórico. Códigos duplicados/saldo insuficiente
preservam formulário; salvamento desabilita envios repetidos e atualiza saldo.

Aceite: entrada 50 → saída 8 → recusa 43 → ajuste +3 = 45, histórico com três
operações; duas saídas concorrentes de 30 aceitam só uma a partir de 45.
Variação B fica em zero. Sem permissão recebe 403. Campanha 2027 não pode usar o
produto sob encomenda 2026. Nova conexão e reinício do servidor mantêm saldo.
Fixtures e capturas usam somente dados fictícios em banco descartável.

## Próximo incremento

Lojinhas podem consumir os vínculos de campanha e os UUIDs de produtos/variações,
sem copiar saldos. Definir autorização de compradores, limites, reservas,
pedidos, produção, cancelamento, pagamento, retirada e reconciliação antes de
implementar. Estoque central não compartilha encomendas/acessos entre lojas.
