# Decisões validadas após o pacote

Origem: pedido aprovado de preparação do CAEHUB em 08/10/2026. Este documento complementa, sem reescrever, os originais. Quando houver conflito direto, estas decisões prevalecem.

## Organização e administração

- CAECOMP possui seis departamentos: RH/RE, Marketing, Produtos, Eventos, Secretaria e Financeiro; há aproximadamente 33 membros ativos.
- Owner Honji é a autoridade técnica global. Presidente, vice-presidente e conselheiro têm capacidades administrativas institucionais equivalentes; diretores administram departamentos e espaços; membros participam conforme permissões. A autoridade técnica do Owner é superior.

## Gestão

- Espaços são dinâmicos e possuem participantes, quadros Kanban e calendário. As colunas iniciais são Ideias, Planejado, Em andamento, Aguardando e Concluído; diretores podem personalizá-las preservando cartões.
- Em espaços autorizados, membros criam cartões e qualquer membro pode tornar-se auxiliar sem convite. Criador, responsável principal e auxiliares editam conforme regras de domínio.
- Só responsável atual ou direção autorizada inicia a transferência principal. Atribuição de direção/administração é imediata; de membro para terceiro requer aceite, mantendo-se o responsável anterior até então.
- Visibilidade interna é Membros ou Diretoria; nenhuma publica conteúdo na internet. Só direção autorizada muda a visibilidade, arquiva ou exclui cartões.

## Agenda, escalas e comercial

- Diretores/administração criam reuniões e votações; membros podem votar em vários horários. Vence o mais votado, com desempate do organizador; votantes do horário vencedor são confirmados. Disponibilidade poderá ser manual e, depois, importada de PDF UTFPR, preservando privacidade de descrições.
- Reservas de escala atribuídas diretamente são provisórias até aceite/recusa; voluntários ocupam vagas disponíveis. Capacidade máxima é rígida, mínima opcional. Conflitos avisam e exigem confirmação consciente registrada; cancelamento libera vagas. Mudança de data/horário exige nova confirmação. Expiração configurável fica posterior.
- Desistências de turnos geram aviso prioritário quando faltarem até 2 horas para o início. Esse é o padrão inicial; o diretor pode alterar a janela.
- Estoque físico é central e compartilhado; limites por lojinha nunca excedem o estoque global. Encomendas de camisetas/moletons pertencem exclusivamente à campanha de origem. Comercial não entra no primeiro MVP.

## Segurança

- Keycloak/Honji centralizam identidade; CAEHUB terá BFF, backend, dados e regras próprios. O contrato central conhecido comprova somente `project.access`; autorização contextual é local.
- Não recriar login nem supor endpoints centrais. Autenticação simulada é somente desenvolvimento/teste e deve ser impossível em produção.

## Registro de consistência

- O pacote marca detalhes de Gestão, Agenda e ativos como pendentes. As confirmações acima resolvem somente os mesmos requisitos, preservando as demais pendências de contrato, persistência, matriz final de autorização e integração.
- O ativo Giro canônico está disponível no checkout Honji e foi reutilizado sem redesenho em `public/assets/honji-symbol.svg`. Não há pacote compartilhado de componentes disponível; a camada local é declaradamente compatível com o contrato visual, não o Design System central oficial.
- A preferência Tailwind/Vite conflita apenas no nível técnico sugerido: adotou-se Vite com CSS local, por não haver Tailwind instalado/compartilhado e para evitar introduzir dependência não necessária à fundação.
