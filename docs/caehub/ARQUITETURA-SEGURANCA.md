# Arquitetura e segurança

## Limites confirmados

**C:** frontend React/TypeScript; autenticação central Honji/Keycloak+BFF; entrada vinculada a `project.access`; autorização local contextual; mock somente em desenvolvimento.

Fluxo conceitual: usuário → app CAEHUB → integração BFF Honji → identidade Keycloak. O acesso ao projeto é verificado segundo o contrato central; operações de domínio passam também pela política local. O desenho não define hosts, rotas, claims, identificadores de projeto nem formato de resposta.

## Responsabilidades e fronteiras

| Responsável | Obrigação do desenho |
| --- | --- |
| Honji/Keycloak+BFF | Autenticação e sinal de acesso ao projeto conforme contrato a confirmar |
| CAEHUB, camada confiável de servidor | Validar operação, recurso e contexto local; impedir acesso entre contextos |
| Frontend | Representar estados de sessão/acesso e esconder/desabilitar ações conforme política; nunca ser a única proteção |

**P-01/P-07:** definir onde roda a autorização local e como o servidor CAEHUB se relaciona com o BFF. Não assumir que o BFF já implementa as regras do CAEHUB nem provisionar um novo servidor como consequência desta documentação.

## Requisitos de implementação de segurança

Requisitos necessários para concretizar C-03/C-04; escolhas de transporte ficam pendentes.

1. Negar acesso quando identidade, project.access ou contexto não puderem ser validados. Falha de integração não aciona mock em produção.
2. Verificar autorização na camada confiável em cada leitura/mutação, inclusive busca, listagem, exportação e acesso por identificador direto. Filtragem visual isolada é insuficiente.
3. Resolver ator e vínculos a partir de fonte confiável. Não aceitar papel/permissão/autoria enviados pelo cliente como prova.
4. Aplicar menor privilégio e isolamento de contexto. project.access é porta de entrada, não papel local, filiação automática a Espaços ou permissão global.
5. Impedir associação de objetos de contextos incompatíveis. Auxiliar, responsável e integrante são relações de domínio; nenhuma equivale automaticamente a poder administrativo.
6. Validar entradas e regras de negócio no servidor; não expor segredos ou dados desnecessários em respostas, erros e logs.
7. Não introduzir fluxos paralelos de login ou persistência de tokens no navegador sem contrato aprovado. Documentar cookies, proteção CSRF quando aplicável, expiração, logout e revogação a partir do contrato real.
8. Verificar concorrência nas operações cujo estado pode ficar inválido por outra alteração. Estratégia concreta depende da persistência escolhida.

## Autorização local contextual

**R — modelo lógico:** decisão de acesso recebe ator confiável, ação, recurso e contexto (projeto, Espaço/departamento, board/cartão ou lojinha conforme domínio). Permissões locais devem ser testáveis separadamente da interface.

**P:** matriz final de ações/papéis, vínculos, herança e exceções. Não criar um catálogo definitivo de permissões neste estágio. Cada operação implementada precisa de uma política aprovada; operações pendentes continuam indisponíveis.

| Ameaça | Evidência exigida |
| --- | --- |
| Usuário com project.access tenta acessar outro Espaço | Rejeição de leitura e mutação pelo servidor |
| Troca de ID no pedido | Escopo/contexto checados novamente |
| Cliente inventa papel de gestor | Papel recebido do cliente não concede acesso |
| Sessão/acesso deixa de ser válido | Operação negada conforme mecanismo central confirmado |
| Encomenda de outra lojinha | Acesso negado; estoque central não torna encomendas globais |

## Mock e trabalho independente da integração

**C:** usar somente desenvolvimento, com dados fictícios. O mock deve representar cenários permitidos e negados; não serve como evidência de integração real.

**R:** adaptador de desenvolvimento separado, acionamento explícito e proteção no build/inicialização que impeça ativação em produção. Escolher mecanismo após definir ambiente e ferramentas; comprovar no gate de release que o mock não concede acesso no artefato produzido.

Pode avançar: componentes, layouts, estados de erro/acesso, modelo conceitual e políticas já aprovadas. Aguarda contrato: sessão real, project.access, revogação e integração. Nenhum endpoint de exemplo deve virar contrato por cópia.

## Dados e rastreabilidade

**H:** fixtures, capturas, testes e exemplos usam dados fictícios. **R:** registrar alterações sensíveis com ator confiável, ação, recurso/contexto e momento, sem segredos. Retenção, acesso aos registros, exclusão e dados pessoais necessários devem ser definidos antes de persistir dados reais.
