# Agenda — incremento inicial

Entrada: BASE.md + este documento; consultar entidades relacionadas de GESTAO.md, autorização contextual, DESIGN/UI-001 e critérios A.

## Escopo confirmado

O incremento inicial cobre calendário pessoal, agenda institucional autorizada e calendário de Espaço. Uma reunião possui uma única origem persistida e pode ser projetada nessas visões sem duplicação.

Cada membro administra somente a própria indisponibilidade, com blocos semanais recorrentes e exceções por data. Diretores e administradores consultam a disponibilidade coletiva por pessoas, departamento e intervalo. Essa consulta retorna somente `livre`, `ocupado` ou `não informado`: títulos, notas e descrições particulares não são expostos. Uma agenda semanal cadastrada permite classificar como livre fora dos blocos; somente exceções avulsas ou ausência de cadastro mantêm o estado `não informado`.

Diretores e administradores organizam reuniões com título, descrição, intervalo, local, Espaço opcional e convidados. Membros respondem `confirmado`, `talvez` ou `recusado`. Convites começam pendentes; alteração de início ou fim incrementa a revisão, notifica convidados e redefine respostas para pendente. O organizador pode adicionar e remover convidados.

## Datas, origem e visibilidade

Reuniões são persistidas como instantes UTC e apresentadas no horário local do navegador. Blocos semanais são horários civis; a consulta envia o deslocamento do navegador para projetá-los no intervalo solicitado. Uma futura integração entre fusos deverá adotar zona IANA explícita antes de substituir esse contrato inicial.

Calendário pessoal inclui reuniões organizadas/recebidas e indisponibilidades próprias. Calendário de Espaço exige acesso contextual ao Espaço. Agenda geral inclui compromissos institucionais e de contextos autorizados; não amplia acesso a um Espaço.

## Limites deste incremento

Não inclui importação de PDF UTFPR, votação de horários, fluxo “Organizando reunião”, escalas/turnos completos, reuniões recorrentes ou Google Calendar. Também não introduz autenticação paralela: identidade e `project.access` continuam no adaptador Honji, e o adaptador simulado permanece exclusivo de desenvolvimento/teste.

## Evidência esperada

Testar persistência, projeção sem duplicação, edição exclusiva da disponibilidade, privacidade da consulta coletiva, criação restrita à direção/administração, respostas dos convidados, gestão de convidados, reconfirmação e notificação após mudança temporal, acesso contextual aos calendários e estados responsivos/acessíveis da interface.

## Incremento 04 — primeira etapa validada localmente

Implementação local em `feat/agenda-avancada`: upload de PDF, prévia editável,
confirmação, período letivo e exceções que liberam uma ocorrência semanal.
Extração conservadora usa `pdftotext -bbox-layout` (Poppler nos containers),
sem IA/OCR e sem presumir o horário civil dos códigos M/T/N. Apenas tabelas
reconhecidas geram candidatos; estrutura diferente exige correção manual.
PDFs não são persistidos. Limites operacionais: 5 MB, dez primeiras páginas,
oito segundos, 4 MB de texto extraído e duas extrações simultâneas por processo.

A confirmação substitui a grade importada do mesmo titular/período em uma
transação serializada pelo vínculo institucional. Blocos manuais permanecem;
blocos importados idênticos preservam ID e exceções. Blocos retirados da grade
perdem suas exceções. A UI exige confirmação dessa substituição. A grade vale
somente entre as datas informadas; fora delas não confirma disponibilidade.
Exceções liberam somente o bloco escolhido, sem cancelar reuniões ou outros
blocos coincidentes. Correções de horário usam a edição própria existente.

Validação em 11/10/2026: 15 testes passaram em container e banco descartável,
incluindo reimportação simultânea, período/exceções, autorização, confirmação,
intervalos inválidos e rejeição HTTP 413 para PDFs acima do limite. TypeScript e
build frontend em modo de produção passaram. Chromium verificou o fluxo com
teclado, nos dois temas e em desktop/mobile, incluindo cadastro, liberação,
restauração e remoção de dados fictícios.

O PDF UTFPR anexado foi validado separadamente por extração real e upload na
prévia sem salvamento. O formato contém duas colunas de horários impressos, sem
separador textual; o leitor foi ajustado e coberto por teste sintético. Essa
evidência vale para o exemplar fornecido, sem garantir todos os formatos UTFPR.
Documentos escaneados ou formatos não reconhecidos continuam exigindo correção
manual. PDF, texto extraído e dados pessoais não foram versionados.

A construção das imagens pelo Compose com `--pull` passou. O timeout anterior
de DNS do Docker Hub não se repetiu nos testes separados de host, container,
daemon e BuildKit; nenhuma configuração de rede foi alterada. Essa foi a
evidência da primeira etapa, anterior à ampliação abaixo.

## Incremento 04 — Agenda Avançada

Consulta semanal combina indivíduos e vários departamentos, mostra ocupação
por intervalos e destaca quando todos estão livres. Não informado permanece
distinto de livre. Solicitações de revisão persistem convidados, prazo e
respostas; atrasos são sinalizados sem impedir a organização.

Votações permitem múltiplas escolhas ou nenhuma opção, alterações até o prazo
e encerramento explícito. Desempate exige escolha entre líderes; nenhum voto
válido impede convocação. Finalização serializada cria uma única reunião,
confirmando votantes ativos do horário vencedor. Demais participantes e
convidados posteriores ficam pendentes. Mudança temporal exige reconfirmação.

Turnos pertencem a espaços autorizados e podem associar uma reunião/evento do
mesmo espaço. Voluntários confirmam imediatamente; atribuições diretas reservam
vaga até aceite/recusa. Reservas e confirmações respeitam o máximo rígido,
inclusive sob concorrência. Somente confirmações atingem o mínimo opcional.
Conflitos com aulas, blocos próprios, reuniões e turnos exigem confirmação
consciente registrada. A janela prioritária de desistência começa em 2 horas
antes do início e é configurável pela direção. Remoções, desistências,
cancelamentos e mudanças temporais preservam histórico; reagendamento exige
novo aceite. Cancelamentos e recusas liberam ocupação.

Notificações internas persistentes abrangem solicitações, votações, convocações,
atribuições, respostas, desistências, remoções e cancelamentos, com leitura
exclusiva do titular. Sem email, SMS, expiração automática ou Google Calendar.
O contexto Honji e a decisão atual de `project.access` são reutilizados.

Validação local: 18 testes de backend, TypeScript/build e fluxos Chromium nos
dois temas em 1440/390 px. Inclui corrida pela última vaga, conflitos entre
turnos concorrentes, aulas/reuniões, redução de capacidade, privacidade,
acesso contextual e finalização duplicada. Capturas usam dados fictícios.
Direção pode liberar participações de vínculos encerrados, sem permitir novas
atribuições a esses vínculos. A regressão é coberta por teste de integração.
