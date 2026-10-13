# Manual operacional mínimo e prontidão

Preparação Agente 10 em 13/10/2026. Plataforma:
https://caehub-gabriel.honji.com.br. Versão observada: **1.14.3**, release
`13102026-093332`. Este manual não certifica homologação humana nem vendas.

## Prontidão

| Etapa | Estado | Condição de liberação |
| --- | --- | --- |
| Homologação institucional assistida | Pronto para iniciar, com limites | Plataforma saudável e roteiro disponível; pessoas autorizadas operam próprias contas e dados controlados. Não significa aceite institucional concluído. |
| Piloto com membros e dados operacionais reais | Bloqueado para aprovação | Executar/registrar I01–I13; definir suporte e confirmar backup/restauração antes de depender de dados reais. |
| Operação comercial | Bloqueado | C01–C09, beneficiário/Pix/prazo, condições públicas/retirada e compra controlada com autorização financeira ainda não conferidos. |
| Recuperação de banco | Bloqueada para comprovação | Não foi localizado procedimento/canal de backup e restauração no repositório ou runbook disponível; solicitar evidência ao dono da infraestrutura, sem inferir inexistência no servidor. |

## Evidências e limites atuais

- Git inicial limpo, main `1b55d12`; refs origin/GitHub e honji iguais. Fonte
  runtime publicada pela auditoria: `61e59c1`; commit posterior é documentação.
- `site-mode --status caehub-gabriel`: proxy-root, container healthy.
  `app-source --show caehub-gabriel`: main autoritativa correspondente.
- HTTPS `/health`: 200, ok, versão/release acima; `/api/public/catalog`: 200;
  `/api/agenda/notifications` sem sessão: 401. Corpo de catálogo privado não
  foi consultado; nenhuma sessão pessoal ou mutação realizada.
- `set-env --names` confirma nomes OIDC/serviço de autorização/origens e
  NODE_ENV, sem valores. Não comprova configuração comercial, guardada no banco.
- Gate 09 documentado: 42/42, build/audit, imagem oficial e Chromium
  desktop/mobile/claro/escuro, Honji real descartável. Não repetido porque
  esta entrega altera só documentação; PDF pessoal e compra real continuam
  pendentes. Revisão visual atual com sessão pessoal não executada.
- P2 restantes: cabeçalho técnico do Kanban e aviso de bundle, sem bloqueio
  operacional comprovado. Nenhum ajuste de UI nesta entrega, evitando release
  de runtime sem necessidade demonstrada.

Saúde HTTP não consulta banco nem Honji em cada chamada: o handler `/health`
retorna metadados. Boot exige conexão/migrations e reconciliação, mas healthy
não garante todas as dependências funcionando depois. API autenticada e
jornada real são necessárias para afirmar integridade funcional atual.

## Rotina assistida

Presidência coordena aceite e define um contato de suporte antes da sessão;
diretores acompanham seus espaços; cada membro gerencia somente seus dados.
Cargos/vínculos centrais são corrigidos no Honji por administrador autorizado,
sem login paralelo ou permissão deduzida do navegador. Depois de salvar,
conferir mensagem, recarregar e verificar resultado. Em 409, reabrir o recurso
atual antes de decidir nova edição; não insistir com revisão antiga.

Responsável comercial confere estoque/pedidos e financeiro confirma recebimento
real. Comprovante isolado não basta. Reserva vence pelo relógio do banco;
reconciliação roda no boot, a cada minuto e nas operações/consultas. Pix tardio
segue revisão, sem reocupar automaticamente estoque; reembolso é manual.
Notificações são internas; não prometer SMTP/push por essa funcionalidade.

## Registro e atendimento

Modelo restrito: `ID do caso; data/hora America/Sao_Paulo; versão/release;
executor autorizado; papel/contexto; passos mínimos; esperado; observado;
ID do recurso; código HTTP/mensagem redigida; gravidade; responsável;
contenção; resultado da reverificação; pendente/aprovado/bloqueado`.
Não coletar senhas, tokens, cookies, MFA, PDF pessoal nem payloads completos.

P0: exposição de dados/acesso indevido ou perda grave; P1: fluxo essencial
bloqueado ou inconsistência de pagamento/estoque; P2: defeito local com
alternativa segura. Pessoa que detecta avisa o suporte definido; responsável
aciona Gabriel para aplicação e dono da infraestrutura para canal ausente.
Em P0/P1, suspender a jornada afetada e novos pagamentos no piloto, preservar
IDs/evidências e conferir persistência antes de repetir. Suspensão é orientação
operacional; não presume botão de bloqueio de vendas disponível.

401: entrar novamente; 403/404 contextual: administrador verifica vínculo,
sem elevar papel para contornar. 503: registrar indisponibilidade e verificar
dependência; não confundir com acesso negado. Pagamento divergente: financeiro
concilia no banco e operador trata ocorrência, sem apagar pedido/histórico.
Correção de código exige reprodução, teste proporcional e gate completo antes
de release; incidente de infraestrutura exige seu dono, sem mudar permissões.

## Continuidade e recuperação

| Mecanismo | O que existe / limite | Menor ação necessária |
| --- | --- | --- |
| Backup do MySQL | Nenhum job, canal ou retenção comprovado nas fontes acessíveis. Reinício persistente do banco descartável no gate 09 não é backup. | Dono da infraestrutura informa responsável, frequência, retenção, destino protegido e evidência da última cópia recuperável; definir RPO aceito. Não fazer dump pelo agente. |
| Restauração | Nenhum procedimento acessível ou ensaio comprovado. | Obter canal autorizado e ensaio em banco isolado, com contagens/invariantes e duração; definir RTO aceito. Não restaurar sobre produção para testar. |
| Logs | Fastify usa logger:false; há histórico/auditoria no MySQL e mensagem limitada de falha de reconciliação. Não há canal de logs remotos documentado. | Dono disponibiliza consulta restrita/redigida e retenção; responsável define quem atende. Não prometer access logs nem consultar home de outro dono. |
| Monitoramento | HEALTHCHECK da imagem e consulta pública disponíveis; alerta contínuo/escalonamento não comprovado. | Durante sessão, suporte acompanha health e ações autorizadas; solicitar cobertura e destinatário de alertas ao dono antes de operação contínua. |
| Rollback de aplicação | Canal oficial `deploy-app --rollback caehub-gabriel`; deploy reverte automaticamente se imagem não fica saudável. | Operador autorizado confirma versão anterior e causa antes de usar; valida health e jornadas depois. Não executado nesta entrega. |
| Proxy | proxy-root saudável; `site-mode --status caehub-gabriel` consulta. | Rollback de proxy só para falha de proxy pelo canal oficial; não confundir com rollback de imagem. Nenhuma mudança necessária agora. |
| Recuperação de dependência | Boot executa migrations idempotentes/reconciliação; sem ledger de versões de migrations. | Classificar app/banco/Honji/infra, acionar dono e validar jornada após recuperação. Rollback de imagem não restaura banco nem desfaz efeitos financeiros. |

Procedimentos de produção seguem o runbook canônico
`/home/gabriel/.codex/runbooks/honji-production.md`, lido integralmente nesta
preparação. Não há shell/SQL remoto genérico. Backup deve ser transmitido
diretamente à workstation pelo mecanismo autorizado, sem dump em repouso no
servidor; acesso e retenção precisam ser aprovados pelo responsável. Não criar
endpoint de exportação, cron ou infraestrutura como parte desta homologação.

## Sequência de liberação

1. Definir pessoas/contato e executar o [roteiro institucional](HOMOLOGACAO-INSTITUCIONAL.md).
2. Resolver falhas bloqueantes e obter evidência de recuperação; registrar
   aceite da presidência para piloto limitado e limitações remanescentes.
3. Operador/financeiro completam [gates comerciais](LIBERACAO-COMERCIAL.md),
   autorizam e executam compra controlada; conferem resultado conjunto.
4. Direção registra decisão explícita de abertura, condições e suporte.
   Até lá, não anunciar vendas nem convidar externos automaticamente.
