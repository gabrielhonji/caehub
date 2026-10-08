# Pacote de planejamento CAEHUB

Documentação para orientar implementação futura. Entrega de 08/10/2026; não contém código, configuração de infraestrutura nem alterações no repositório central Honji.

## Como usar

Passe ao agente **BASE.md + a especificação do módulo + uma tarefa delimitada**. O documento base aponta as seções complementares necessárias. Não envie o histórico inteiro. Em um checkout futuro, o AGENTS.md funciona apenas como roteador local, respeitando as instruções aplicáveis desse checkout.

| Arquivo | Conteúdo / quando ler |
| --- | --- |
| [AGENTS.md](AGENTS.md) | Roteador curto |
| [BASE.md](BASE.md) | Decisões, estados de certeza, dependências e limites comuns |
| [PRODUTO.md](PRODUTO.md) | Escopo, fases e jornadas |
| [ARQUITETURA-SEGURANCA.md](ARQUITETURA-SEGURANCA.md) | Honji/Keycloak+BFF, project.access e autorização contextual |
| [DESIGN.md](DESIGN.md) | Contrato integral de identidade editorial, UX e estados |
| [UI-REACT.md](UI-REACT.md) | UI-001, componentes React e regras de composição |
| [GESTAO.md](GESTAO.md) | MVP: Espaços, departamentos, Kanban, cartões e participantes |
| [AGENDA.md](AGENDA.md) | Fase posterior: agenda consolidada e turnos |
| [COMERCIAL.md](COMERCIAL.md) | Fase posterior: estoque físico central e encomendas por lojinha |
| [ENG-001.md](ENG-001.md) | Protocolo obrigatório de eficiência e verificação |
| [ACEITE.md](ACEITE.md) | Critérios rastreáveis e gates por marco |
| [COORDENACAO.md](COORDENACAO.md) | Execução individual/delegada e handoff compacto |

## Limite da recuperação de contexto

A conversa referenciada, “Planejamento do CAEHUB”, foi consultada. O acesso retornou cinco turnos recentes; as respostas anteriores vieram como marcadores, sem seu conteúdo, e sem cursor para recuperar os detalhes. O pedido atual confirma as decisões estruturais abaixo, mas não descreve todas as regras operacionais antigas.

O pacote registra essas lacunas explicitamente. Não afirma recuperar fielmente cardinalidades, poderes de auxiliares, transições ou regras de turnos que não foram disponibilizadas. As partes confirmadas podem orientar implementação; as regras pendentes precisam ser recuperadas ou decididas antes de implementar o comportamento correspondente.

As preferências gerais Honji foram recuperadas de memória anterior. A disponibilidade e a versão dos ativos/componentes centrais não foram verificadas; nenhuma dependência de acesso ao repositório Honji é pressuposta.
