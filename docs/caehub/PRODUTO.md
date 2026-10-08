# Produto e fases

## Propósito

**C:** CAEHUB reúne Gestão, com módulos posteriores de Agenda e Comercial, sob identidade Honji/CAECOMP. Autenticação e acesso de entrada são centrais; permissões operacionais são locais e contextuais.

**R:** objetivo de produto: reduzir dispersão da organização do CAECOMP, dando contexto às tarefas, aos compromissos e às operações das lojinhas. Validar esse enunciado sem ampliar escopo.

## Escopo por fase

| Fase | Estado | Resultado | Fora dessa entrega |
| --- | --- | --- | --- |
| Planejamento atual | C | Pacote Markdown modular | Código, infraestrutura e edição no Honji central |
| MVP Gestão | C | Espaços/departamentos, Kanban e operações de cartões aprovadas | Agenda e Comercial operacionais |
| Agenda | C | Consolidação de agenda e turnos conforme regras aprovadas | Implantação antecipada dentro do MVP |
| Comercial | C | Estoque físico central e encomendas restritas à lojinha de origem | Contratos comerciais/pagamentos inventados |

Não criar navegação funcional para módulos indisponíveis. **R:** omitir a entrada até sua fase, ou mostrar uma indicação discreta de disponibilidade futura se aprovado. Nunca deixar um botão que aparenta executar uma operação inexistente.

## Jornadas de referência

- **Gestão, C/R:** entrar pelo acesso Honji confirmado; visualizar somente contextos autorizados; localizar Espaço/board; acompanhar ou agir no cartão segundo a permissão local. A sequência de telas é R; o controle de acesso é C.
- **Agenda, C/P:** consultar visão consolidada e turnos; fontes, edição e critérios de consolidação dependem de P-04.
- **Comercial, C/P:** operar no contexto de uma lojinha; respeitar estoque central e exclusividade das encomendas. Jornada de compra/retirada depende de P-06.

## Marcos sugeridos

**R:** M0 decisões e amostra visual; M1 base UI e telas com dados fictícios de desenvolvimento; M2 Gestão funcional com políticas locais verificadas; M3 integração Honji e aceite do MVP; M4 Agenda; M5 Comercial. A ordem de M2/M3 deve preservar a dependência de segurança: nenhuma entrega em produção usa mock.

Cada marco exige o gate completo de ENG-001 sobre a aplicação implementada. Agenda/Comercial permanecem fora da suíte funcional enquanto não implementados; sua ausência não elimina testes compartilhados de segurança/UI.
