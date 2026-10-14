# CAEHUB — roteador de implementação

Leia `docs/caehub/BASE.md` e somente a especificação diretamente afetada:

- UI: `DESIGN.md` e UI-001 em `UI-REACT.md`.
- Dados, acesso e integração: `ARQUITETURA-SEGURANCA.md`.
- Escopo: `PRODUTO.md`; critérios: `ACEITE.md`.
- Decisões posteriores: `DECISOES-VALIDADAS.md`, apenas onde tratam do mesmo
  requisito.

Políticas obrigatórias:

- **ENG-001** (`docs/caehub/ENG-001.md`): delimitação, leitura seletiva, menor escopo
  correto e validação proporcional; gate completo por marco e antes de release.
- **ENG-002** (`docs/caehub/ENG-002.md`): cada incremento parte de dependências integradas,
  cumpre aceite, recebe commit e push; paralelismo usa branches/worktrees e a
  integração em `main` é verificada antes de trabalho dependente/publicação.
- **ENG-003** (`docs/caehub/ENG-003.md`): confira raiz, estado, branch, remoto, commits,
  `.gitignore` e verificações antes do push; nunca force push nem declare
  publicação antes da confirmação do GitHub.

Coordene conforme `docs/caehub/COORDENACAO.md`: tarefas delimitadas, arquivos sem disputa e
evidências curtas. Subagentes somente com autorização aplicável. Não carregue
todo o pacote ou histórico por padrão.

Ao alterar hierarquia, espaços ou autorização, leia a seção D-59/D-60 de
`docs/caehub/ARQUITETURA-SEGURANCA.md`. Para produção Honji ou administração do
Keycloak, leia `docs/caehub/OPERACAO.md` e o runbook global de produção antes de
agir; esses detalhes não pertencem ao contexto automático de tarefas locais.

Não invente contratos Honji, endpoints, permissões, ativos oficiais ou decisões
por silêncio. Mocks são apenas de desenvolvimento e dados de teste são
fictícios. Preserve a camada local de componentes compartilhados.

Ao concluir, informe alterações, verificações, limitações e próximo passo;
atualize somente o estado afetado, sem duplicar especificações.
