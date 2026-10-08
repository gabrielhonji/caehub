# Agenda consolidada e turnos — fase posterior

Entrada: BASE.md + este documento; consultar apenas entidades relacionadas de GESTAO.md, autorização contextual, DESIGN/UI-001 e critérios A.

## Decisões e limites

**C:** Agenda é posterior ao MVP Gestão e deve contemplar visão consolidada e turnos. Não implementar dentro do MVP apenas para completar navegação.

**P-04:** a recuperação não trouxe regras antigas de agenda/turnos. Consolidar não significa tornar todos os eventos públicos ou conceder edição sobre suas fontes. project.access permanece distinto das permissões locais.

## Modelo lógico proposto

**R:** entrada de agenda representa um compromisso/ocorrência com origem identificável; turno representa um intervalo com participantes ou cobertura. A visão consolidada reúne entradas autorizadas, preservando origem, contexto e nível de edição. Nenhuma definição de recorrência, calendário externo ou sincronização está confirmada.

Uma origem pode ser Gestão, entrada manual ou outra fonte somente depois de aprovada. Não duplicar silenciosamente um cartão como evento e não criar relação automática entre prazo de cartão e turno.

## Decisões antes de implementar

- Fontes incluídas, atualização e regra de deduplicação; edição na origem ou na agenda.
- Turnos: finalidade, responsáveis/participantes, disponibilidade, cobertura e aprovação/troca.
- Conflitos: alerta ou bloqueio, sobreposições aceitas, prioridades e cancelamentos.
- Datas: fuso do domínio, dia inteiro, intervalo, limites inclusivos/exclusivos, recorrência e exceções.
- Visibilidade: por Espaço/departamento, participante ou outra regra aprovada; dados que podem aparecer na consolidação.

**R:** armazenamento de instantes com referência de fuso para apresentação e regras explícitas de dia inteiro; o fuso de execução do servidor não decide a agenda. Não adotar America/Sao_Paulo como contrato do produto só por ser o fuso desta conversa.

## Aceite da futura fase

Não mostrar entradas não autorizadas nem contagens/metadados que revelem contextos protegidos. Preservar origem para evitar edição no contexto errado. Quando as regras forem fechadas, testar consolidação, limites de data/turno, conflitos, mudança/cancelamento e permissões; fornecer dados fictícios e cenários de teclado/mobile.
