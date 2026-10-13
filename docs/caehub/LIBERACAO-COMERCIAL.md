# Checklist de liberação comercial

Referência: 1.14.3, 13/10/2026. **Vendas reais não liberadas por este roteiro.**
Responsável: direção de Produtos/operador comercial autorizado, com responsável
financeiro. Estado inicial de todas as conferências: pendente. A consulta pública
200 não comprova configuração privada, estoque físico ou beneficiário.

Registrar por linha: pendente/aprovado/falhou/bloqueado, executor, data, evidência
restrita e decisão do responsável. Usar o [registro de falha](OPERACAO.md#registro-e-atendimento).
Não colocar chave Pix, comprovantes ou dados dos compradores no Git.

| Gate / quem confere | Ação necessária | Evidência para aprovação |
| --- | --- | --- |
| C01 — operador | Abrir configurações comerciais e conferir prazo explícito de reserva, entre 1 e 10080 minutos, escolhido pelo responsável; salvar apenas se autorizado. | Prazo relido após salvar e política comunicada. Não presumir valor atual; mudança vale só para novos pedidos. |
| C02 — financeiro + operador | Conferir instruções Pix na área privada com a fonte autorizada; verificar identidade do beneficiário no banco antes de qualquer transferência. | Dupla conferência registrada sem publicar dados bancários; instruções corretas no pedido autorizado. Comprovante não confirma recebimento. |
| C03 — operador | Revisar campanha ativa, etapa, produtos/variações e preços em centavos; comparar projeção pública. | Preços de venda/total corretos; custos e dados de compradores ausentes do catálogo; preço único atual, sem desconto de membro presumido. |
| C04 — estoque + operador | Contar saldo físico por variação e reconciliar recebidos/reservados/disponíveis; conferir encomendas e etapa. | Quantidades conciliadas e justificativa de divergências; etapa 2 não aceita nova encomenda própria de exclusivo. Nenhum ajuste fictício em estoque real. |
| C05 — responsável pela retirada | Definir e informar local, janela, contato e condições de identificação/entrega pelo canal aprovado. | Comprador consegue entender onde/quando retirar e quem procurar. Cadastro estruturado de local não existe no contrato atual; não presumir publicação automática. |
| C06 — financeiro | Definir quem confere recebimento no banco e quem registra confirmação manual; conferir poderes no Honji/CAEHUB. | Operador autorizado, separação prática da conferência, justificativa/data e histórico. Sem gateway Pix automático. |
| C07 — financeiro + direção | Definir atendimento, cancelamento, exceções e reembolso manual; explicar prazo/canal ao comprador. | Procedimento aprovado e acessível; pago cancelado fica refund_required até reembolso efetivo. Produção/retirada exigem tratamento de ocorrência, sem estorno fictício. |
| C08 — direção | Conferir informações públicas de venda, privacidade, contato, condições de encomenda/retirada e política de acesso externo acadêmico verificado. | Conteúdo e canal de divulgação aprovados pelo responsável; ausência de contrato/canal é bloqueio, não motivo para criar módulo. |
| C09 — direção/administrador | Conferir papéis dos operadores e negação aos membros/compradores; revisar backup/restauração e resposta a incidente. | Autorizações contextuais, suporte e recuperação confirmados. Sem sessão real, esta linha continua pendente. |

## Compra controlada posterior

Executores: comprador voluntário autorizado, operador, financeiro e responsável
pela retirada. Só iniciar após C01–C09 aprovados e autorização específica para
valor, itens, pagamento e eventual reembolso. Não executar pagamento de teste
por iniciativa do agente. Fazer uma única compra pequena aprovada, sem provocar
corridas de estoque ou expiração financeira intencional em produção.

1. Comprador entra pelo Honji; externo autorizado conclui a prova acadêmica real
   quando exigida. Confere catálogo, variação, quantidade, preço e disponibilidade.
2. Confirma o pedido uma vez; anota ID, total, prazo e instruções. Operador confere
   reserva/saldo e comprador vê apenas o próprio pedido; não acessar pedido alheio.
3. Comprador confere beneficiário no banco e paga somente o valor autorizado.
   Financeiro verifica recebimento real; operador confirma manualmente uma vez.
   Esperado: pedido confirmado, histórico coerente e nenhuma baixa duplicada.
4. Para encomenda autorizada, operador acompanha produção e recebimento reais;
   na etapa adequada, verifica alocação e prontidão. Comprador confere notificação
   interna e quantidade própria pronta; não registrar produção inexistente.
5. Na retirada real combinada, operador confere titular/quantidade e registra
   entrega uma vez. Esperado: pedido/quantidade entregue e saldo físico correto;
   comprador observa a atualização após recarregar.
6. Registrar aceite conjunto e divergências. Cancelamento/reembolso só se
   autorizado à parte e necessário; conferir devolução real antes de marcar
   refunded. Casos de Pix tardio, concorrência e replay já têm gate técnico:
   não repetir com dinheiro real para demonstrá-los.

Evidência: IDs e estados antes/depois, totais conciliados e aceite das pessoas,
em registro restrito. Comprovantes permanecem no canal financeiro autorizado.
Se falhar, interromper novos pedidos/pagamentos no piloto, registrar incidente,
conferir estado persistido antes de repetir e tratar valores com o financeiro.
Liberação comercial exige este aceite e decisão expressa da direção; nenhum
convite automático a compradores é parte desta entrega.
