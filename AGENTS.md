# CAEHUB — roteador de implementação

Leia `docs/caehub/BASE.md` e somente a especificação diretamente afetada:

- UI: `DESIGN.md` e UI-001 em `UI-REACT.md`.
- Dados, acesso e integração: `ARQUITETURA-SEGURANCA.md`.
- Escopo: `PRODUTO.md`; critérios: `ACEITE.md`.
- Decisões posteriores: `DECISOES-VALIDADAS.md`, apenas onde tratam do mesmo
  requisito.

Políticas obrigatórias:

- **ENG-001** (`ENG-001.md`): delimitação, leitura seletiva, menor escopo
  correto e validação proporcional; gate completo por marco e antes de release.
- **ENG-002** (`ENG-002.md`): cada incremento parte de dependências integradas,
  cumpre aceite, recebe commit e push; paralelismo usa branches/worktrees e a
  integração em `main` é verificada antes de trabalho dependente/publicação.
- **ENG-003** (`ENG-003.md`): confira raiz, estado, branch, remoto, commits,
  `.gitignore` e verificações antes do push; nunca force push nem declare
  publicação antes da confirmação do GitHub.

Coordene conforme `COORDENACAO.md`: tarefas delimitadas, arquivos sem disputa e
evidências curtas. Subagentes somente com autorização aplicável. Não carregue
todo o pacote ou histórico por padrão.

Não invente contratos Honji, endpoints, permissões, ativos oficiais ou decisões
por silêncio. Mocks são apenas de desenvolvimento e dados de teste são
fictícios. Preserve a camada local de componentes compartilhados.

Ao concluir, informe alterações, verificações, limitações e próximo passo;
atualize somente o estado afetado, sem duplicar especificações.

## Produção Honji e Keycloak

### Hierarquia e espaços

- D-60: vínculo departamental exclusivo, direção/membro mutuamente exclusivos,
  cargos independentes. Templates debug só leem, são exclusivos do owner e
  não aparecem nos participantes reais; não amplie acesso entre projetos.

- Siga a seção D-59 de `docs/caehub/ARQUITETURA-SEGURANCA.md`. Cargos e
  departamentos ativados no Honji são autoridade central; não mantenha edição
  local paralela. Departamentos e ferramentas referenciam IDs estáveis, não nomes.
- Membros herdam espaços do departamento; diretores administram seus espaços.
  Presidente/vice acumulam direção. Conselheiro visualiza com abrangência da
  presidência, mas edição depende de outra função autorizada no contexto.
- Preserve revogação ao remover vínculos/trocar direção e a privacidade da
  Agenda. Consulta ampla não concede organização, inscrição ou edição.
- Verifique backend e UI juntos, inclusive negações, projeção idempotente,
  revisões antigas e suspensão. Novos departamentos recebem espaço/quadro.

- A app de infraestrutura é `caehub-gabriel`; o `integrationId` de autorização
  permanece `caehub`. Não trate os dois nomes como intercambiáveis.
- O domínio `caehub-gabriel.honji.com.br` opera em `proxy-root`. Não crie outra
  app ou rotas por prefixo para o mesmo domínio. Consulte com
  `site-mode --status caehub-gabriel` e use o rollback do próprio canal.
- Execute canais SSH de produção fora do sandbox. Dentro dele, o SSH pode
  recusar configurações root válidas porque aparecem como `nobody`.
- Para complementar configuração sem perder os segredos criados por
  `register-integration`, use `set-env --merge`. O `set-env` sem `--merge`
  substitui todo o arquivo privado.
- Novas integrações são criadas exclusivamente por `register-integration`;
  não crie clients manualmente nem tente rotacionar segredos por outro canal.

### Administração do realm `honji`

Use `/usr/local/bin/kc-admin` sempre fora do sandbox. Ele lê sozinho a
credencial privada em `~/.config/honji/keycloak-admin.env`; nunca imprima,
copie, faça `cat` ou `source` desse arquivo.

Comandos aceitos:

```text
kc-admin --check
kc-admin GET    <caminho>
kc-admin POST   <caminho> <corpo.json|->
kc-admin PUT    <caminho> <corpo.json|->
kc-admin DELETE <caminho>
```

O caminho é relativo a `/admin/realms/honji/`; caminhos absolutos, `..`, o
realm `master` e operações de `client-secret` são recusados. A saída redige
segredos como `<redigido>` e um PUT recompõe os valores atuais. Antes de mudar
um client de produção, faça GET para um arquivo temporário, altere somente o
necessário, aplique o PUT e confira o resultado. Redirect URIs e web origins
devem usar somente o FQDN real da app, sem curingas.

Não apague clients ou usuários sem confirmação; não altere
`gabriel-codex-admin`, `realm-management` nem os clients embutidos do
Keycloak. O console web administrativo não é o canal operacional: use a API.
Se `kc-admin --check` indicar acesso ao realm `master`, pare e avise o dono da
infraestrutura, pois o escopo está amplo demais.
