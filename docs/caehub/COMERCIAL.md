# Comercial — campanhas, catálogo e inventário

Pedidos Agente 05 (11/10/2026) e refinamento (12/10/2026) aprovam catálogo,
variações, estoque central e campanha semestral com duas etapas. Reutilizar
BASE, D-59/D-60, autorização contextual e DESIGN/UI-001.

## Campanhas e lojinhas

Todos os novos produtos são cadastrados dentro de uma campanha. Cada campanha
contém nome, semestre (`AAAA.1`/`AAAA.2`), descrição, etapa atual, situação e
versão. As duas etapas aprovadas pelo usuário são Vendas e encomendas e Retirada
e vendas de estoque. Mudar de etapa preserva o mesmo UUID, catálogo e origem das
encomendas. Não executa pedidos, produção ou entrega automaticamente.

A interface lista campanhas existentes, seleciona o catálogo correspondente e
permite criar/editar/arquivar, trocar etapa e incluir produtos físicos já
cadastrados. Catálogo geral e Sem campanha expõem produtos antigos sem vínculo.
Não atribuir automaticamente produtos anteriores a uma campanha presumida.
Campanhas arquivadas são consultáveis; novos cadastros/vínculos exigem campanha
ativa. Atualizações de metadados exigem versão esperada.

Produto físico pode participar de várias campanhas sem duplicar saldo.
Remover seu vínculo preserva produto, variações e movimentos. Produto sob
encomenda é exclusivo da campanha de origem, imutável; não pode ser transferido
ou desvinculado. Encomendas futuras nunca contam como unidades recebidas.

## Cadastro e categorias

Produto possui UUID estável, nome, descrição, categoria obrigatória, código
automático, custo/venda em centavos, tipo físico/encomenda e situação.
Novos códigos usam prefixo da categoria e contador, por exemplo CAM-001 e
ADS-002. O contador é bloqueado exclusivamente desde o upsert, evitando
colisões/deadlocks de upgrade em cadastros simultâneos. Códigos/UUIDs existentes
são preservados; mudar a categoria não renumera o produto.

Categorias são selecionadas no dropdown ou criadas no cadastro. Categorias
iniciais: Camisetas, Moletons, Adesivos, Ecobags, Canecas e Outros; nomes antigos
são importados sem perdas. Cada categoria define até três opções reutilizáveis,
como Tamanho, Modelo e Cor, com até vinte valores por opção. O editor permite
acrescentar opções/valores, com revisão esperada para evitar edição obsoleta.
Não há SEO, fornecedores ou biblioteca genérica de atributos.

Seleção de P/M/G e Tradicional/Babylook gera seis variações em um único
cadastro. Selecionar Cor acrescenta combinações, com limite de 100 por operação.
Sem opções selecionadas, cria Única. SKU da variação também é automático,
por exemplo CAM-001-01. Cada variação tem saldo e atributos próprios.
Adicionar combinações posteriormente conserva as existentes e seus saldos.

Custo e venda são valores unitários distintos, obrigatórios nos novos
cadastros/edições. Margem por unidade = venda − custo; não representa lucro
realizado ou relatório financeiro. Preços de referência antigos são preservados
no banco como legado, sem inventar custo/venda; a tela mostra A definir até
preenchimento consciente pelo gestor.

## Inventário e rastreabilidade

Saldo físico pertence à variação, começa em zero e é centralizado, inclusive
sobras recebidas de encomendas. Não existe saldo editável no navegador.
`physicalQuantity` é o recebido; `reservedQuantity` soma reservas válidas e
alocações; `availableQuantity=physicalQuantity-reservedQuantity`.
`reservationsImplemented=true`. Saída/ajuste não consomem unidades comprometidas.

Movimentações transacionais bloqueiam produto e variação, verificam saldo não
negativo e persistem histórico/saldo atomicamente. Entrada/saída recebem inteiro
positivo; ajuste recebe diferença inteira positiva/negativa. Justificativa
obrigatória, referência opcional, delta assinado, saldo resultante, ator confiável
/nome e horário do banco. Não há edição/exclusão de movimento: correção por
operação compensatória. Arquivamento conserva saldo/histórico e impede novas
movimentações até reativação.

## Autorização

Backend exige `project.access`, vínculo ativo e política vigente D-59/D-60.
Owner e administração institucional com edição, ou direção ativa de Produtos
(ID estável), administram o Comercial. Associação simples ao departamento ou
direção de outro contexto não autoriza mutações. Consulta ampla do conselheiro
não concede edição; `canManage=false`. Debug é somente leitura. Não alterar
Honji/Keycloak ou criar autenticação paralela.

## API efetiva

BFF/sessão e CSRF existentes são usados em todas as mutações.

| Método e caminho | Contrato |
| --- | --- |
| GET `/api/commercial` | Produtos, variantes, campanhas, categorias/opções, vínculos e capacidade administrativa |
| POST `/api/commercial/campaigns` | Cria campanha semestral |
| PATCH `/api/commercial/campaigns/:id` | Metadados, etapa/situação com versão |
| POST `/api/commercial/categories` | Nome e opções; prefixo automático |
| PATCH `/api/commercial/categories/:id` | Opções com revisão esperada |
| POST `/api/commercial/products` | Categoria, campanha, custo/venda e opções; códigos/combinações automáticos |
| PATCH `/api/commercial/products/:id` | Metadados/categoria/custo/venda/situação com versão; códigos preservados |
| POST `/api/commercial/products/:id/variants` | Opções selecionadas e versão; acrescenta combinações ausentes |
| PATCH `/api/commercial/products/:id/variants/:variantId` | Atributos/nome/situação, sem editar código ou saldo |
| POST `/api/commercial/products/:id/campaigns` | Vincula sem copiar estoque; valida exclusividade |
| DELETE `/api/commercial/products/:id/campaigns/:campaignId` | Desvincula somente físicos, sem afetar inventário |
| POST `/api/commercial/variants/:id/movements` | Entrada, saída ou ajuste |
| GET `/api/commercial/variants/:id/movements` | Histórico preservado |

Migrações idempotentes: `migrateCommercial` e `migrateCommercialCatalog`, no boot
existente após seed institucional. Além das cinco tabelas originais, criam
`commercial_categories` e `commercial_code_counters`, campos de categoria,
custo/venda, atributos das variações e metadados de campanha. Preservam dados,
códigos, IDs, saldos e movimentos; importam categorias anteriores.

## Aceite e próximo incremento

Testar seis combinações em um produto, preço de custo/venda separados,
categoria/Cor reutilizáveis, códigos concorrentes únicos, troca de etapa
preservando origem, físicos compartilhados e exclusividade de encomendas,
migração sem perda de estoque/preço legado/histórico, negações e versões antigas.
Fluxo 0 → entrada 50 → saída 8 → recusa 43 → ajuste +3 = 45 continua obrigatório.
Revisão visual de campanhas/catalogo/formulários/detalhes, desktop/mobile e
ambos os temas, com fixtures fictícias e MySQL real descartável.

Pedidos/Vendas consomem os mesmos UUIDs, vínculos, preços e inventário central.
Agente 06 autoriza o ciclo abaixo; sem gateway ou lucro financeiro realizado.

Na etapa de retirada, os modelos sob encomenda existentes permanecem visíveis
na campanha; novos produtos sob encomenda exigem a etapa Vendas e encomendas.
Cadastro e mudança de etapa são serializados na campanha. Novos produtos físicos
continuam permitidos na segunda etapa para o catálogo de estoque.

## Pedidos — Agente 06, 12/10/2026

Operação administrativa por administração institucional/direção de Produtos:
comprador membro usa ID real de `people`, validado no projeto; externo usa
nome/contato operacional, sem identidade autenticada fictícia. Backend grava
preços/nomes/variações da compra e calcula total em centavos. Catálogo atual
não tem preços de membro distintos; nenhum desconto é inventado. Membros
ativos consultam e criam pedidos próprios pela loja de compra. Consulta
ampla/debug não expõe clientes nem permite compras de teste. Autosserviço
externo ainda depende de acesso Honji compatível.

| Eixo | Estados/transições |
| --- | --- |
| Pedido | pending → confirmed por Pix; pending → expired por reserva vencida; Pix tardio → review; alocação administrativa → confirmed; cancelled por cancelamento; completed por retirada |
| Pagamento | pending/problem → paid por operador; cancelamento pago → refund_required; comprovação manual registrada → refunded |
| Alocação/item | stock: provisional → committed → consumed; vencimento/cancelamento → released; preorder: none → committed parcial/integral por recebimento/alocação de sobras → consumed |
| Produção/item | waiting → in_production → received; parcial mantém estado até completar; físico usa not_needed |
| Entrega | waiting → ready somente etapa 2, pago, confirmado e todos os itens alocados; ready → collected com baixa física |

Prazo da reserva é configurado conscientemente pelo operador em minutos
(1–10080), sem valor presumido. Inicialmente vazio, impede pedidos físicos até
definição; encomenda não reserva estoque inexistente. Mudar prazo afeta somente
novos pedidos. Pix real não é inventado; instruções ausentes aparecem como
pendência. Comprovante enviado não confirma pagamento; conferência registra ator,
horário e justificativa. Configuração somente acessível ao operador.

Saldo exclui reservas vencidas usando relógio do banco. Reconciliação persistida
executa no boot, a cada minuto, nas operações e nas consultas de pedidos. Mutex
transacional por organização em `commercial_operations` serializa todos os
escritores de reservas/recebimentos/retiradas/movimentos, entre processos.
Pedidos usam READ COMMITTED e locks de registros; sem filas/lock em memória.
Serialização global é apropriada ao volume atual, podendo ser refinada depois.

Pix tardio registra pagamento, mas mantém review sem reocupar estoque.
Regularização requer saldo físico livre para todos os itens de estoque.
Cancelamento libera alocação uma vez, preserva registros e, se pago, exige
reembolso manual. Produção iniciada/retirada impedem cancelamento simples;
ocorrência administrativa documenta exceção sem fingir estorno/devolução.
Correções físicas usam movimentos. Não há exclusão de pedidos/histórico.

Na etapa 2, pedido novo de modelo exclusivo vende somente físico livre, com
fulfillment=stock; pedidos antigos conservam preorder. Campanha arquivada não
recebe pedidos novos. Criação usa requestKey UUID + hash; repetição com dados
diferentes é recusada. Pagamento/recebimento/retirada repetidos não repetem efeitos.

## Produção, recebimentos e retirada

Consolidação agrupa encomendas por variação, conservando pagas e entregues,
separando pendentes, canceladas, revisão, a produzir, alocadas e em produção.
Recebidas acumulam lotes reais; livres mostram saldo atual após reservas.
Início marca obrigações pagas
atuais. Recebimento exige etapa 2 e registra UUID idempotente, campanha, variação,
referência de lote, quantidade aguardada/recebida/alocada, diferença, ator/momento.
Entrada e alocação FIFO ocorrem atomicamente. Parcial não deixa pedido pronto;
excesso recebido fica livre. Entrada manual com encomendas pagas pendentes exige
o fluxo de recebimento para proteger alocações. Alocação administrativa pode usar
sobras físicas para encomenda paga posteriormente ainda não enviada à produção,
sem nova entrada; produção já iniciada é reconciliada por recebimentos.

Retirada exige ready e consome alocação enquanto baixa físico, atomicamente.
Notificação de pronto reutiliza Agenda para compradores membros; sem serviço
novo ou e-mails. Migração idempotente `migrateOrders` cria operações, pedidos,
itens, eventos e recebimentos, com FKs/checks/unicidade, sem alterar saldo antigo.

| API (prefixo `/api/commercial`) | Uso |
| --- | --- |
| GET/POST `/orders` | Lista pela identidade / criação administrativa |
| GET `/orders/:id` | Detalhes próprios ou administrativos e histórico |
| POST `/orders/:id/actions` | pay, payment_problem, allocate, ready, collect, cancel, refund, exception; justificativa obrigatória |
| GET/PUT `/settings` | Prazo e instruções Pix, restritos a operador |
| GET `/buyers` | Compradores cadastrados, restritos a operador |
| POST `/reservations/reconcile` | Reconciliação administrativa |
| GET `/campaigns/:id/production` | Consolidação/recebimentos |
| POST `/campaigns/:id/production/start` | Início por variação |
| POST `/campaigns/:id/production/receipts` | Entrada/alocação transacional |

`CommercialOrders` compõe Button/Badge/Dialog/Eyebrow, feedback e campos
existentes para lista/filtros, pedido misto, Pix, pendências, histórico, produção,
divergências e entrega. Membros sem catálogo veem Meus pedidos.
Próximo incremento: autosserviço externo Honji e regras específicas de devolução
ou cancelamento de encomendas já comissionadas, mediante decisão operacional.
Prazo/instruções Pix reais precisam ser configurados antes das vendas físicas.
Não avançar automaticamente para integração bancária.

## Refinamento operacional — 1.11.0

Membro ativo com project.access compra pela própria identidade Honji, em
`#/comercial/comprar` ou pela entrada Comercial de quem não administra catálogo.
GET `/api/commercial/shop` retorna apenas campanhas/produtos/variações ativos,
preço de venda e disponibilidade; omite custos, reservas detalhadas e compradores.
POST `/api/commercial/my-orders` aceita campanha, itens e requestKey, jamais
identidade de comprador, papel, preço final ou estados administrativos. Backend
resolve a pessoa e aplica o mesmo fluxo transacional de pedidos. GET
`/my-orders` e `/my-orders/:id` forçam consulta própria, inclusive para owner.
Externos mantêm cadastro administrativo; não há login paralelo ou autoinscrição.

Prévia mostra subtotal/total e distingue encomenda de estoque. Itens duplicados
e quantidades acima do livre são impedidos na interface; backend revalida tudo.
`expectedPriceCents` opcional sinaliza o preço visto, não define o preço cobrado:
se mudou, pedido é recusado para nova conferência. Interface sempre o envia.
Pedido registrado abre seus detalhes e instruções Pix. Rascunho de criação e
recebimento é mantido ao fechar/reabrir o fluxo na mesma campanha; troca de
campanha reinicia o contexto. Rascunhos ficam na memória da página, sem salvar
campos pessoais em localStorage/sessionStorage.

Pedidos têm `version`; configuração tem `revision`. Toda alteração/histórico de
pedido incrementa versão. Interface envia versão e requestKey em ações; chave
é vinculada a pedido, ator e conteúdo e persistida em `commercial_order_commands`.
Reenvio idêntico responde sem repetir efeitos/eventos, mesmo depois de mudar a
versão. Hash novo é canônico, independente da ordem dos campos; criação também
reconhece o hash legado 1.10 para conservar replay após upgrade sem outra reserva.
Outra ação na tela antiga recebe 409 e pede atualização. Configuração
também recusa revisão antiga. Campos novos são opcionais para compatibilidade
com clientes legados; autorização/transições/transações continuam obrigatórias.

Backend retorna `availableActions` conforme pagamento, alocação, produção e
etapa; UI oferece somente ações atuais. Pix, cancelamento, reembolso e retirada
pedem confirmação explícita e justificativa. Quando a revisão mudou, atualizar
detalhes descarta a ação anterior. Alocação de encomenda sem unidades físicas livres é recusada, sem
indicar sucesso ou criar estoque. Produção comissionada usa recebimentos.

`exception` cria uma pendência aberta vinculada ao evento; `resolve_exception`
exige ID do caso e resolução, conservando responsável/momento e histórico.
Essas ações não fazem cancelamento, retorno ao estoque ou reembolso por si só.
`commercial_order_incidents` recebe também ocorrências antigas por ID estável do
evento, preservando data/autor e sem duplicar casos resolvidos ao repetir boot.
Notas administrativas, atores e referências internas não são enviados ao
comprador; seu histórico mostra apenas evento/data, itens e estados próprios.
Detalhes e produção usam leitura coerente com as transações de operações.

GET `/orders` aceita campaignId, search, status, paymentStatus, deliveryStatus,
issues=open, page e pageSize (padrão 20, máximo 100); retorna total/pages/summary.
`paymentStatus=unconfirmed` agrupa pendente/problema ainda não encerrados.
Pendências são restritas a operador. Totais são da campanha/identidade, separados
do filtro atual; buscas/páginas sempre conservam autorização. UI protege contra
respostas antigas de filtros, oferece paginação e restaura foco mesmo se o
pedido sair do filtro após a operação.

Migrations adicionam somente duas revisões e as tabelas de comandos/pendências.
Inicializações usam lock de sessão por schema em conexão dedicada, com liberação
em finally, porque DDL pode encerrar transações. Referência operacional:
[MySQL 8.4 — locking functions](https://dev.mysql.com/doc/refman/8.4/en/locking-functions.html).
Teste com dois pools/schema novo valida startup concorrente e liberação.

## Portal público — Agente 07, 1.12.0

`/` apresenta Honji/CAEHUB e CAECOMP, campanhas e produtos ativos com preço de
venda configurado. Esse estado ativo é a publicação comercial neste incremento;
produtos/campanhas arquivados e variações inativas são omitidos. GET
`/api/public/catalog` reutiliza a projeção de venda do OrderService sem exigir
identidade: somente campos públicos, disponibilidade central descontando
reservas válidas e prazo configurado; nunca Pix, custo, estoque detalhado ou
compradores. GET `/api/public/buyer-status` informa apenas elegibilidade atual;
a criação e consulta própria continuam protegidas pelas APIs 1.11.

Detalhes de produto compõem Dialog e campos existentes, selecionando IDs reais
com atributos e quantidade. Seleção contém uma campanha, pode editar/remover
itens e mostra subtotais/total estimado; troca de campanha reinicia os itens.
IDs, quantidades e chave idempotente ficam em sessionStorage durante a sessão
do navegador para sobreviver à ida ao login; nenhum campo pessoal ou token é
armazenado. Seleção não reserva estoque. Backend recalcula preço, saldo e etapa,
com expectedPriceCents e requestKey dos contratos existentes. Falha temporária
mantém a chave para repetir; envio simultâneo é bloqueado imediatamente.

Etapa 2 preserva os modelos para consulta e vende apenas estoque livre, sem
novas encomendas. Conta com vínculo ativo compra para si; externos sem vínculo
não recebem acesso institucional. Não altera Keycloak/BFF central ou cria login.
Área pessoal, Pix, histórico, produção e retirada reutilizam CommercialOrders e
CommercialOrderDetail com ownOnly, sem operações administrativas. `/auth/login`
mantém OIDC/PKCE existente; rotas hash `#/...` mantêm a aplicação interna.

Não existe contrato de imagem de produto, evento público ou local/instruções de
retirada no cadastro atual. Usam-se placeholder textual, ausência de eventos e
orientação existente para combinar retirada com a equipe. Pix/prazo reais ainda
precisam de configuração administrativa; não se presume chave, local ou horário.
