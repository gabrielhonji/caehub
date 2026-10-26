# CAEHUB — roteador de implementação

Comece pela especificação diretamente afetada. Código comprova o estado
implementado, mas não substitui requisito ou decisão aprovada.

## Fontes por assunto

- UI: `docs/caehub/DESIGN.md` e UI-001 em `docs/caehub/UI-REACT.md`.
- Gestão: `docs/caehub/GESTAO.md`; Agenda: `docs/caehub/AGENDA.md`;
  Comercial: `docs/caehub/COMERCIAL.md`.
- Identidade, acesso, dados e integração: `docs/caehub/ARQUITETURA-SEGURANCA.md`.
- Escopo e aceite: `docs/caehub/PRODUTO.md` e a seção relacionada de
  `docs/caehub/ACEITE.md`.
- Contrato comum C/H/R/P: `docs/caehub/BASE.md`, somente quando a classificação
  ou uma decisão compartilhada puder mudar o lote.
- Decisões posteriores: `docs/caehub/DECISOES-VALIDADAS.md`, apenas pelo ID ou
  requisito relacionado.

Ao alterar hierarquia, espaços ou autorização, leia D-59/D-60 em
`ARQUITETURA-SEGURANCA.md`. Para produção Honji ou Keycloak, leia `OPERACAO.md`
e o runbook global antes de agir; não os carregue em tarefas locais.

## Estado e coordenação

Quando o pacote mestre estiver ativo, entre por
`/home/gabriel/workdir/CAEHUB_planejamento_mestre/STATUS_ATUAL.md`; o ledger
conserva rastreabilidade por ID e recebe deltas, enquanto handoffs e checkpoints
anteriores são históricos. Consulte `docs/caehub/COORDENACAO.md` apenas pela
atividade, ID ou episódio necessário.

Registre coordenação nova ao iniciar trabalho compartilhado, ampliar escopo ou
encontrar sobreposição. Uma retomada já autorizada continua pelo estado atual,
sem nova transferência humana por formalidade. Preserve alterações existentes e
edite apenas arquivos concretos do lote.

Responsabilidade é definida pelo comportamento e pelo arquivo concreto, não por
extensão ou pasta. Templates HTML/CSS/JS gerados no servidor podem conter
trabalho visual; entrada, sessão, autorização e regras de domínio continuam sob
responsabilidade backend. Mudanças visuais nesses templates exigem coordenação,
sem remendar a fronteira no frontend.

## Execução, validação e Git

- Siga `docs/caehub/ENG-001.md`: trabalhe por família/fluxo, use buscas
  estreitas, verificações agrupadas e proporcionais, inspeção visual
  representativa durante lotes visuais e integração conforme o risco.
- Siga `docs/caehub/ENG-002.md`: commit local, push, integração e deploy são
  etapas distintas. Consulte `ENG-003.md` apenas quando houver push autorizado.
- Não invente contratos Honji, endpoints, permissões, ativos oficiais ou
  decisões por silêncio. Mocks são apenas de desenvolvimento e dados de teste
  são fictícios. Preserve componentes compartilhados.
- Subagentes somente com autorização aplicável. Não carregue pacote, ledger ou
  histórico completos por padrão; retenha evidências e resuma logs.

Ao concluir, informe alterações, verificações e pendências, distinguindo
implementação, teste automatizado, inspeção visual, aceite, commit, push,
integração e deploy. Atualize somente o estado afetado.
