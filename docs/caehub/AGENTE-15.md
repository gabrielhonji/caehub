# Agente 15 — fechamento funcional e visual, 23/10/2026

Escopo do briefing Agente 15 e decisões complementares sobre relatos, retenção
e notificações. O fechamento aproveita as entregas 1.20–1.22 já integradas e
consolida a revisão final no CAEHUB 1.23.0. Portal e identidade permanecem em
seus repositórios independentes; os contratos abaixo foram conferidos contra o
código e a especificação vigente, sem ampliar permissões.

## Matriz de fechamento

| Área | IDs | Resultado verificável |
| --- | --- | --- |
| Transversal | G01–G07 | Diálogo compartilhado protege rascunhos, diferencia continuar/descarte e preserva foco; refresh tem estado pendente, bloqueio de repetição e erro recuperável; vazios, divisórias, validação, densidade e termos foram revisados nos consumidores alterados. A sessão local continua com 1 h de inatividade/12 h absoluta; “lembrar por 30 dias” pertence ao SSO Keycloak, que pode renovar a sessão local. Logout encerra sessão local e global. |
| Portal | P01–P11 | Refresh consolidado, destinos autorizados nos títulos de acesso, card de login sem reserva vazia, regularização de membros sem departamento, pedidos iniciais/mudanças separados, revisão em lote com contagens distintas, notificações administrativas, cards/paginação responsivos e pedido de acesso contextual. O fluxo de relatos e os e-mails reutilizam a infraestrutura central Honji. |
| Compras | L01–L11 | Lojinha preserva e revalida a seleção no retorno do login; checkout evita linhas incompletas e duplicidade; pedido e Pix usam composição única pública/interna; “Meus pedidos” tem filtros, cards, estados e refresh estáveis. Upload Pix continua privado, manualmente conferido e com retenção persistida. |
| Relatos | B01–B08 | Formulário simples no contexto atual; administração exige feedback ao resolver/arquivar; histórico, notificação interna e outbox de e-mail são persistidos. Autor e administradores recebem somente eventos relevantes e retries usam chave idempotente. |
| Interno | I01–I10 | Vazios alinhados; consulta institucional não abre espaço privado; Kanban reorganizado; criação aceita tags, prioridade inline e prazo opcional; detalhes compartilham modal/página, refresh fica no cabeçalho do diálogo; auxiliares podem ser removidos por autoridade legítima. Checklist respeita leitura/edição, aceita itens separados por vírgula e abre o campo sob demanda. Comentários podem ser criados por quem enxerga o cartão e excluídos pelo autor, responsável ou gestor, com validação no servidor. “Gerenciar cartão” é condicionado à autoridade e o refresh de tarefas fica nos filtros. |
| Agenda | A01–A08 | Seleção de espaço/departamento acrescenta convidados sem apagar escolhas anteriores; lista e contador foram reorganizados; estados vazios usam o padrão comum; refresh acompanha filtros; importação acadêmica, votações e turnos mantêm seus diálogos específicos. Votações livres mostram contagem e omitem explicação administrativa para quem não pode criar. |
| Comercial | C01 | Navegação por campanha, catálogo, pedidos, produção, recebimento, retirada e estoque permanece na composição operacional consolidada, sem alterar reservas, inventário central ou pagamento manual. |
| Erros | E01 | Indisponibilidade temporária fica centralizada e oferece tentar novamente/voltar; acesso negado, recurso inexistente e sessão expirada mantêm mensagens e destinos distintos. |

## Funcionalidades novas

- **Continuidade do carrinho após autenticação**, com retorno seguro e
  revalidação antes da criação do pedido.
- **Upload privado de comprovante Pix**, sem confirmação automática de
  pagamento.
- **Retenção efetiva de anexos**, com um único vencimento persistido por arquivo,
  reprogramado pelos eventos definidos e exclusão idempotente do conteúdo sem
  apagar metadados e histórico.
- **Feedback obrigatório ao resolver ou arquivar relatos**, exibido no histórico.
- **Notificações internas e e-mails transacionais por outbox**, usando o
  transportador central Honji, destinatários institucionais reais e retries sem
  duplicidade.
- **Comentários de cartão para leitores autorizados**, exclusão contextual e
  gestão individual de auxiliares.

## Retenção e notificações

Relatos abertos usam três meses por arquivo. Resolver ou arquivar substitui o
vencimento por um mês contado da transição; reabrir antes da exclusão substitui
por três meses contados da reabertura. Comprovantes Pix pendentes usam um mês do
envio; validação ou expiração do pedido substitui por um mês contado do evento.
O registro histórico permanece depois da remoção do objeto. A limpeza periódica
é transacional e idempotente. Se uma obrigação superior de preservação for
configurada pela operação, ela prevalece sobre a remoção automática.

Abertura, resolução, arquivamento e reabertura relevantes notificam o autor;
abertura também notifica os administradores competentes. O e-mail usa o módulo
transacional central do Honji e não bloqueia a operação de negócio quando o
transportador está indisponível. Enfileiramento não equivale a entrega.

## Complemento de fechamento — 24/10/2026

- A seleção de variações com múltiplos atributos foi separada por dimensão,
  sempre reconciliando para uma combinação real e disponível do catálogo.
- Atualizações de catálogo usam o controle contextual compartilhado; remoção do
  carrinho é destrutiva, iconográfica e mantém nome acessível.
- “Meus pedidos” usa uma única hierarquia, lista interna rolável e atualização
  sem deslocar o conteúdo.
- A consulta institucional de departamentos passou a devolver somente nome,
  tipo de vínculo e identificador local de participação para qualquer membro
  ativo. O atalho de gestão central só aparece quando a autoridade real é
  confirmada pelo servidor; perfis de visualização nunca recebem essa ação.
- A cobertura dirigida inclui combinações de produto, bloqueio de refresh,
  remoção do carrinho, diretório institucional seguro, responsividade e os dois
  temas.

## Evidências e limites

- Build TypeScript/Vite da 1.24.0 aprovado em imagem de desenvolvimento.
- Suíte servidor/MySQL isolado: 52/52 testes, concorrência serializada.
- Chromium com fixtures fictícias: cartão, permissões, tags/prioridade,
  comentários de leitor, convidados da Agenda, refresh contextual e retorno do
  login; 1440 e 390 px, temas claro/escuro, sem overflow horizontal. Capturas
  permanecem fora do Git.
- Nenhuma compra, Pix, conta pessoal ou mudança de dados de produção foi usada
  na validação. Smoke autenticado com conta real e aceite humano continuam
  distintos dos testes automatizados.

Commits, refs remotas, imagem oficial, deploy e smoke de produção são
registrados na coordenação depois que cada etapa ocorrer; não são presumidos por
este documento.
