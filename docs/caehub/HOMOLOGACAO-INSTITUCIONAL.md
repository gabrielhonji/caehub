# Homologação institucional assistida

Referência: CAEHUB 1.14.3; preparação em 13/10/2026. Responsável pelo aceite:
presidência CAECOMP, com um diretor e membros voluntários autorizados.
Nenhuma linha abaixo foi aprovada com usuários reais pelo Agente 10.

Antes de começar, combinar uma janela, identificar contas autorizadas com
vínculos conferidos no Honji e escolher um espaço restrito de homologação já
permitido. Cada pessoa opera a própria conta; não compartilhar senha, MFA ou
sessão. Usar cartões/reuniões claramente identificados como homologação,
sem convocar terceiros. Importar somente o PDF do próprio participante.
Não alterar cargos reais apenas para testar; administrador acompanha as
negações com contas que já tenham os papéis correspondentes.

Para cada linha, registrar **pendente / aprovado / falhou / bloqueado**, data,
executor, versão, evidência e responsável pela resolução. Evidência mínima:
resultado observado após recarregar, identificador do recurso e captura
redigida quando necessária. Registro restrito, fora do Git, sem PDF pessoal,
e-mail, cookies, códigos MFA ou tokens. Uma falha usa o modelo do
[manual](OPERACAO.md#registro-e-atendimento); nunca marcar aprovado por ausência de erro.

| ID / executor | Passos | Resultado esperado / evidência de sucesso |
| --- | --- | --- |
| I01 — membro, acompanhado pelo administrador | Abrir o domínio oficial; entrar pelo Honji; conferir identidade, projeto e vínculo. Reabrir a página. | Pessoa e departamento corretos; sessão válida; registrar conferência sem copiar dados pessoais. Primeiro login pessoal permanece pendente até execução. |
| I02 — presidente, diretor e membro | Cada um abre departamentos/espaços e as ações de gestão disponíveis; diretor consulta outro departamento, membro tenta ação administrativa pela interface quando disponível. | Presidência no âmbito aprovado; diretor administra só seu contexto; membro sem poderes administrativos. Recurso restrito não aparece ou acesso é negado. Não criar poderes pela função nominal. |
| I03 — diretor e membro | Abrir espaço herdado do departamento e um espaço ao qual não pertencem; conferir quadro e participantes. | Herança corresponde ao Honji; nenhum dado de outro contexto é exposto. Registrar IDs dos espaços autorizados e negação sem conteúdo alheio. |
| I04 — diretor/membro com permissão | Criar cartão de homologação, editar título, mover coluna, comentar e marcar checklist; recarregar. | Cartão aparece imediatamente e alterações persistem; campos de criação limpos e histórico coerente. Em erro, registrar se gravou antes de tentar novamente. |
| I05 — responsável e auxiliar voluntário | Atribuir responsável conforme permissão; auxiliar entra/sai; solicitar transferência e destinatário decide. | Participações sem duplicação; decisão de transferência respeita aceite; campos/histórico após recarregar correspondem às pessoas autorizadas. |
| I06 — membro participante | Abrir Minhas tarefas, filtrar espaço/participação; conferir cartão próprio; usar Tentar novamente se ocorrer falha transitória. | Tarefas próprias sem duplicação; nenhum cartão restrito aparece; recuperação funciona quando houver falha real. Não provocar indisponibilidade em produção. |
| I07 — membro e diretor | Titular cadastra disponibilidade/indisponibilidade própria, exceção e edição; diretor consulta visão coletiva. | Dados persistem; visão coletiva mostra livre/ocupado/não informado, sem descrições privadas. Não editar agenda de terceiro. |
| I08 — titular de PDF UTFPR real | Importar o próprio PDF; revisar prévia, período, disciplinas e horários antes de confirmar; conferir calendário; reimportar somente com consentimento do titular. | Prévia corresponde ao PDF; confirmação afeta só grade própria/período; sem duplicação e sem deslocamento de horários. Se extração divergir, parar antes da confirmação e registrar caso sem anexar documento pessoal ao Git. |
| I09 — diretor/organizador e convidados voluntários | Criar reunião de homologação, responder convite, reagendar; abrir votação, votar e encerrar pela regra existente. | Respostas persistem; encerramento gera a reunião esperada; empate exige escolha válida e nenhum voto é atribuído a terceiro. Registrar IDs e resultados. |
| I10 — diretor contextual e membro | Criar turno no espaço autorizado; membro se voluntaria ou aceita atribuição; conferir capacidade e horário; cancelar turno de homologação ao fim. | Confirmação/capacidade corretas, sem inscrição em espaço indevido; histórico e cancelamento preservados. |
| I11 — destinatários | Abrir notificações dos convites/reagendamentos; seguir link; marcar lida; recarregar. | Somente notificações próprias, destino correto e leitura persistida. Não presumir e-mail/push: validar o canal exibido na aplicação. |
| I12 — titular e administrador acompanhante | Fazer logout local, voltar à rota protegida e entrar novamente; testar logout central conforme opção disponível. Aguardar expiração normal da sessão na janela combinada. | API/tela protegida exige novo acesso após encerramento/expiração; mensagem clara e sem ciclo de erro. Não reduzir TTL de produção para o teste. Expiração permanece pendente se a janela não permitir observá-la. |
| I13 — participantes, desktop e celular | Percorrer primeiro acesso, navegação, lista vazia autorizada e formulários; salvar; abrir/fechar diálogo por teclado; comparar claro/escuro e zoom. | Rótulos e erros compreensíveis; feedback de salvamento, foco visível/restaurado, nenhuma ação essencial cortada; marcas Honji consistentes. Registrar aparelho/largura e defeito concreto. Não equivale a certificação WCAG. |

Aceite para piloto: responsáveis revisam todas as linhas, resolvem falhas
bloqueantes e registram as limitações aceitas. Disponibilidade de backup e
restauração deve ser confirmada antes de depender de dados reais, conforme o
manual. Ao encerrar, remover/cancelar somente dados de homologação próprios
pelas ações existentes, preservando histórico. Não excluir registros financeiros.
