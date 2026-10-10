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
