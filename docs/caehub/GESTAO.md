# Gestão — especificação MVP

Entrada de execução: BASE.md + este documento. Para interface, DESIGN.md/UI-REACT.md; para acesso e mutações, seção de autorização em ARQUITETURA-SEGURANCA.md; critérios G em ACEITE.md.

## Escopo e entidades

**C:** Gestão é o MVP; inclui Espaços/departamentos, Kanban, cartões, atribuições e auxiliares. As regras detalhadas anteriormente aprovadas não constam no material recuperado; os itens P abaixo precisam ser fechados antes da operação correspondente.

| Conceito | Confirmado | Proposta / decisão pendente |
| --- | --- | --- |
| Espaço | Contexto de organização da Gestão | R: agrupar trabalho e acesso; P-02: hierarquia, vínculos e administração |
| Departamento | Parte do modelo organizacional | P-02: se é um Espaço, contido nele ou relação independente; não tratar como sinônimos |
| Board/coluna | Kanban faz parte da Gestão | R: board reúne cartões em colunas; P: número de boards, colunas e transições |
| Cartão | Unidade do Kanban, com atribuições e auxiliares | P-03: campos obrigatórios, autoria, ciclo de vida e poderes |
| Atribuição | Relação entre cartão e participante | P-03: quantidade, elegibilidade e efeitos na autorização |
| Auxiliar | Relação distinta de atribuição | P-03: quantidade, poderes, aceite e vínculo com contexto |

**R:** modelo lógico inicial com identidade estável de cada objeto, vínculos explícitos entre recursos e participantes e datas de criação/alteração. Isso não é schema de banco nem payload aprovado. Não migrar dados ou escolher cardinalidades a partir da tabela.

## Invariantes de segurança e consistência

Exigências para preservar C-04, independentemente da futura matriz de papéis:

1. Toda operação de cartão usa o contexto real do recurso; trocar o ID não permite atravessar Espaços.
2. Atribuir ou adicionar um auxiliar exige validar autorização do ator e elegibilidade do participante segundo regra aprovada.
3. Responsável, auxiliar e integrante não são sinônimos; participação não concede poderes implícitos de administração.
4. Mover cartão deve verificar origem/destino e a transição aprovada; o cliente não valida sozinho.
5. Remover vínculo organizacional não pode deixar privilégios ativos por acidente. O destino de cartões/atribuições existentes depende da decisão de ciclo de vida.

## Operações candidatas

**R:** consultar Espaços e boards permitidos, abrir cartão, criar/editar cartão, mudar coluna, gerir atribuições/auxiliares, arquivar cartão. São propostas para detalhar o MVP, não autorização para implementar todas sem recuperar P-02/P-03. Busca, notificações, anexos, comentários e automações não são confirmados.

## Decisões necessárias para as regras antigas

| Pergunta | Consequência de não responder |
| --- | --- |
| Há uma ou várias atribuições? Pode existir cartão sem atribuição? | Não definir campos obrigatórios ou validação final |
| Auxiliar pode editar, mover, concluir ou apenas acompanhar? | Não habilitar essas ações por participação |
| Quem atribui/remove pessoas? Há aceite do participante? | Não criar uma política implícita |
| Pessoa pode acumular atribuição e auxiliar? Há limites? | Não fixar unicidade/cardinalidade |
| Quais são colunas, transições e condições de conclusão/reabertura? | Não impor workflow definitivo |
| Quem cria/gerencia Espaço, departamento e board? Existe herança? | Não criar papéis/poderes globais |
| Pode mover entre boards/Espaços? O que muda nos participantes? | Não habilitar transferência entre contextos |
| Como arquivamento/exclusão e saída de membro afetam vínculos? | Não implementar cascatas irreversíveis |

## Fatia independente sugerida

**R:** protótipo de consulta de Espaço/board/cartão com dados fictícios, componentes compartilhados e estados de acesso. Cenários de atribuição/auxiliar podem ser exibidos como exemplos de desenvolvimento, sem lhes atribuir poderes. Persistência e operações dependentes aguardam decisões. Produção exige integração central e autorização local verificadas.
