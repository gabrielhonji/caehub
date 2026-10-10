# Critérios de aceite e gates

Critérios C/H verificam decisões/preferências; critérios R/P dependem de aprovação/fechamento da regra. Não interpretar este checklist como evidência de testes já executados.

## Documentação — entrega atual

| ID | Critério |
| --- | --- |
| DOC-01 | AGENTS curto roteia para base e módulos; nenhuma edição central Honji |
| DOC-02 | BASE + módulo permitem iniciar tarefa e localizar complementos seletivamente |
| DOC-03 | C/H/R/P distinguem decisões, memória, propostas e lacunas; não existem endpoints definitivos inventados |
| DOC-04 | DESIGN cobre identidade editorial e UX integral; UI-001 e ENG-001 são obrigatórios |
| DOC-05 | Gestão, Agenda, Comercial e suas dependências não se confundem; estoque/encomendas preservam as decisões explícitas |

## UI comum

| ID | Critério |
| --- | --- |
| UI-01 | Padrões existentes reutilizados; componente novo tem responsabilidade e justificativa próprias |
| UI-02 | Composição editorial, Giro canônico quando disponível e assinatura aprovada; sem copiar identidade específica do XII |
| UI-03 | Foco, teclado, toque, labels/erros e estados loading/vazio/erro/sem acesso funcionam no contexto afetado |
| UI-04 | Temas/mobile preservam hierarquia e legibilidade; documento sem overflow; board tem alternativa a arrastar |
| UI-05 | P-05 fechado para aprovação visual final; protótipo não se apresenta como identidade oficial ainda sem ativos |

## Segurança comum

| ID | Critério |
| --- | --- |
| SEC-01 | Sessão e project.access validados segundo contrato central confirmado; ausência/falha nega acesso |
| SEC-02 | Backend/camada confiável valida contexto em leitura, mutação, ID direto e exportação; cliente não concede poderes |
| SEC-03 | Usuário com entrada no projeto não acessa automaticamente todos os Espaços/lojinhas |
| SEC-04 | Sessão/acesso inválido ou revogado tratado conforme contrato; erros/logs não expõem segredos |
| SEC-05 | Mock explicitamente restrito ao desenvolvimento e incapaz de conceder acesso na versão de produção |
| SEC-06 | Cenários de negação e cruzamento de contextos demonstrados com dados fictícios |

## Gestão — MVP

| ID | Critério |
| --- | --- |
| G-01 | P-02 define relação Espaços/departamentos/boards e política local antes da implementação correspondente |
| G-02 | P-03 define atribuições/auxiliares, poderes, cardinalidades e elegibilidade; implementação não equipara relações |
| G-03 | Operações/transições aprovadas funcionam; as proibidas são rejeitadas no servidor |
| G-04 | Movimentação/remoção de vínculos preserva integridade conforme regras aprovadas; sem privilégios residuais |
| G-05 | Consulta e ações respeitam contexto; cenários permitidos e negados cobrem recursos de outro Espaço |
| G-06 | MVP atende UI-001, DESIGN, segurança e gate ENG-001; Agenda/Comercial não viram escopo implícito |

## Agenda — incremento inicial

| ID | Critério |
| --- | --- |
| A-01 | Calendários pessoal, geral e de Espaço preservam origem única, intervalo e visibilidade contextual |
| A-02 | Disponibilidade própria é editável somente pelo titular; consulta coletiva distingue livre/ocupado/não informado sem revelar descrições particulares |
| A-03 | Direção/administração cria reuniões e gerencia convidados; convidados respondem confirmado/talvez/recusado; mudança temporal notifica e exige nova confirmação |
| A-04 | Persistência, limites temporais, acessibilidade, responsividade e permissões positivas/negativas são verificados; itens expressamente posteriores permanecem fora do incremento |

## Comercial — gate posterior

| ID | Critério |
| --- | --- |
| C-01 | Uma fonte de estoque físico central serve às lojinhas; quantidades não são fontes físicas independentes por loja |
| C-02 | Encomendas permanecem na lojinha de origem; ID direto, listagens e exportações não atravessam acesso |
| C-03 | P-06 fechado antes de implementar ciclo de encomenda/reserva/baixa/pagamento |
| C-04 | Concorrência e reconciliação preservam invariantes aprovadas; estoque comum não abre acesso a encomendas alheias |

## Registro de evidência

Formato curto por critério: ID; cenário/escopo; resultado (passou/falhou/pendente); evidência; limitação. “Tela montada com mock” não satisfaz SEC-01. P aberto não satisfaz o critério que depende dele.

Aceite de tarefa usa verificações proporcionais. Aceite de marco/release exige gate completo ENG-001, revisão dos critérios aplicáveis e pendências bloqueantes fechadas. Definir responsável pela aprovação em cada marco; não presumir aceite por ausência de resposta.
