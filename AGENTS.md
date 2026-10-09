# CAEHUB — roteador de implementação

Leia primeiro `docs/caehub/BASE.md` e a especificação diretamente afetada.

- UI: `DESIGN.md` e `UI-REACT.md`.
- Dados, acesso e integração: `ARQUITETURA-SEGURANCA.md`.
- Escopo: `PRODUTO.md`; critérios: `ACEITE.md`; execução: `ENG-001.md`.
- Colaboração e integração Git: `ENG-002.md`; publicação no GitHub: `ENG-003.md`.
- Decisões posteriores ao pacote: `DECISOES-VALIDADAS.md`; elas prevalecem apenas onde tratam do mesmo requisito.

Não invente contratos Honji, endpoints, permissões novas nem ativos oficiais. Mocks são exclusivamente de desenvolvimento. Preserve a camada de componentes local compartilhada e execute verificações proporcionais.

O CAEHUB usa um único repositório remoto. Todo incremento parte de uma base que contenha suas dependências, é validado, recebe commit e push ao concluir seus critérios de aceite. Para trabalho paralelo, use branches ou worktrees; a integração em `main` deve ser verificada antes da publicação.
