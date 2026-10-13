# BASE — contrato comum CAEHUB

## Estado das afirmações

- **C — Confirmado:** explícito no pedido atual ou nos turnos acessíveis. Deve ser preservado.
- **H — Preferência Honji registrada:** orientação anterior do usuário, recuperada de memória; aplicar como base, sem presumir ativos ou versão central disponíveis.
- **R — Recomendação:** proposta deste pacote, ainda não aprovada como decisão de produto/contrato.
- **P — Pendente:** detalhe indisponível ou decisão necessária; não preencher por inferência silenciosa.

As regras de execução solicitadas, UI-001 e ENG-001 são obrigatórias. As recomendações de produto continuam propostas. A implementação pode avançar nas fatias C/H independentes; um P bloqueia apenas o comportamento que depende dele. Não substituir decisão aprovada por uma recomendação.

## Decisões comuns

| ID | Estado | Decisão | Fonte de verdade |
| --- | --- | --- | --- |
| C-01 | C | App React/TypeScript | UI-REACT.md |
| C-02 | C | Branding Honji/CAECOMP; DESIGN.md rege identidade editorial e UX completas | DESIGN.md |
| UI-001 | C | Reutilização obrigatória dos componentes compartilhados | UI-REACT.md |
| C-03 | C | Autenticação central Honji/Keycloak+BFF; entrada condicionada a project.access | ARQUITETURA-SEGURANCA.md |
| C-04 | C | Autorização local contextual; acesso ao projeto não autoriza toda operação | ARQUITETURA-SEGURANCA.md |
| C-05 | C | Mock somente em desenvolvimento | ARQUITETURA-SEGURANCA.md |
| C-06 | C | MVP Gestão; Agenda e Comercial posteriores | PRODUTO.md |
| C-07 | C/P | Gestão contém Espaços/departamentos, Kanban, cartões, atribuições e auxiliares; detalhes antigos indisponíveis | GESTAO.md |
| C-08 | C/P | Agenda consolidada e turnos; regras operacionais antigas indisponíveis | AGENDA.md |
| C-09 | C | Estoque físico central; encomendas exclusivas por lojinha | COMERCIAL.md |
| ENG-001 | C | Leituras seletivas, escopo mínimo, testes proporcionais; suíte completa por marco/antes do release; sem atalhos de qualidade ou segurança | ENG-001.md |
| C-10 | C | Não inventar endpoints/contratos definitivos; não editar AGENTS.md central Honji | Este documento |

## Preferências Honji aplicáveis

**H:** frontend React/TypeScript/Tailwind CSS/Vite como preferência; Python se houver necessidade de backend, sujeito ao encaixe com o BFF central. Apenas React/TypeScript é decisão técnica explícita deste projeto; versões, bibliotecas e backend local ficam por definir.

**H:** identidade editorial compartilhada, Giro original, autoria `gabriel.honji`, consistência entre temas/estados/mobile e dados fictícios em testes/capturas. A paleta e a pantera do XII de Março são específicas daquele projeto; não herdar para CAEHUB.

## Leitura sob demanda

| Tarefa | Documento do módulo | Complemento seletivo |
| --- | --- | --- |
| Modelo ou fluxo de Gestão | GESTAO.md | Segurança: autorização local; ACEITE: Gestão |
| Interface de Gestão | GESTAO.md | DESIGN.md + UI-REACT.md; ACEITE: UI |
| Integração de identidade | ARQUITETURA-SEGURANCA.md | ACEITE: Segurança; confirmação dos contratos reais |
| Agenda | AGENDA.md | GESTAO: entidades necessárias; Segurança: autorização; ACEITE: Agenda |
| Comercial | COMERCIAL.md | Segurança: autorização; ACEITE: Comercial |
| Manutenção/testes | Especificação afetada | ENG-001.md; critério correspondente em ACEITE.md |

ENG-001 é leitura inicial de execução; reler apenas quando a tarefa mudar de classe de risco. Trabalho visual sempre depende do contrato de design, mesmo se a solicitação mencionar apenas um botão.

## Pendências e desbloqueio

| ID | O que falta | Bloqueia |
| --- | --- | --- |
| P-01 | Resolvido por BFF existente e D-62/Agente 08: account.access, project.access, sessão Keycloak viva e identidade estável; ver ARQUITETURA-SEGURANCA.md | Smoke pessoal Google/produção permanece distinto do gate descartável |
| P-02 | Relação Espaço/departamento/board e regras de acesso/herança | Persistência e autorização dessas relações |
| P-03 | Cardinalidade de atribuições/auxiliares, poderes, transições e ciclo de vida de cartões | Operações de Kanban dependentes dessas regras |
| P-04 | Origem da agenda, semântica de turnos, conflitos, visibilidade e fuso | Regras e integração de Agenda |
| P-05 | Ativos CAECOMP, composição de marcas, fontes/paleta finais e acesso a componentes Honji | Aprovação visual final |
| P-06 | Resolvido por Agentes 06/08: pedidos existentes e autosserviço externo com e-mail acadêmico verificado; prazo/Pix reais exigem configuração explícita | Configuração comercial real continua explícita |
| P-07 | Resolvido: Fastify/MySQL, tsx/jose, testes/build em containers e canais oficiais | Ver ENG-001 e runbook de produção |

Para fechar um P: registrar decisão curta, origem/data, documentos afetados e critério de aceite; retirar sugestões incompatíveis. Este pacote não altera contratos de outros projetos.
