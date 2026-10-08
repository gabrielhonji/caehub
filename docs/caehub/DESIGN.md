# DESIGN — contrato integral Honji/CAECOMP

## Autoridade

**C:** este documento rege composição, hierarquia, linguagem visual, interação, acessibilidade, responsividade, estados e UX; não é apenas uma tabela de cores. UI-001 materializa o contrato em componentes reutilizáveis. Qualquer alteração visual deve respeitar ambos.

## Identidade editorial

**H:** preservar o Giro original Honji: quatro pétalas arredondadas em rotação, centro aberto, mesmas curvas/proporções. Não desenhar H, monograma, peça central ou ornamento. Reutilizar o ativo canônico quando fornecido; não recriar uma aproximação.

**H:** composição editorial, superfície clara tipo papel/creme, grid sutil que continua até as bordas, títulos de destaque com serifas, respiro, numeração discreta e cabeçalho/rodapé sólidos. Tema escuro preserva hierarquia e legibilidade. A densidade de um board pode ser maior sem abandonar esses princípios.

**C:** branding Honji/CAECOMP. **H:** autoria `gabriel.honji` no rodapé; sem subtítulo genérico abaixo de HONJI ou link solto de identidade. **P-05:** assinatura conjunta, ativo CAECOMP, grafia visual final, paleta, fontes e tokens numéricos. Não copiar a pantera ou tornar o vinho do XII a cor obrigatória do CAEHUB.

**H:** favicon mantém geometria canônica, base circular e cantos externos transparentes; ícone de tela inicial pode usar superfície completa para máscara do sistema. A implementação aguarda os ativos; uma área neutra identificada no protótipo é preferível a uma marca improvisada.

## Hierarquia e composição

**R — especificação a validar em amostra:** shell com contexto atual visível; título da página, descrição curta quando útil, ação principal identificável e conteúdo agrupado por significado. Usar tipografia de leitura para dados/formulários; reservar destaque editorial aos títulos. Não transformar cada conteúdo em card decorativo.

Ações destrutivas devem ser distinguíveis e ter proteção proporcional ao impacto. Mensagens devem dizer o que ocorreu e como continuar, com vocabulário de Espaços, cartões, turnos e lojinhas. Evitar nomes de endpoints, termos de implementação ou erro cru no fluxo do usuário.

## Interação e estados obrigatórios

- Carregando: preservar orientação; não permitir envio duplicado.
- Vazio: explicar ausência e oferecer ação somente quando permitida.
- Erro: informar falha e recuperação possível sem expor dados internos.
- Sem acesso: impedir ação e explicar indisponibilidade sem revelar conteúdo protegido.
- Salvando/sucesso: feedback coerente e estado atualizado; comportamento otimista depende da operação e não pode ocultar falhas.
- Hover, foco, ativo, selecionado e desabilitado: mesmos significados em todos os módulos; cor não é o único sinal.

Estas obrigações integram DESIGN/UI-001; exemplos de texto e animação exata são R, não decisões antigas recuperadas.

## Acessibilidade e responsividade

**H:** alvos de toque de pelo menos 44 px; campos/selects com geometria consistente e texto de 16 px no mobile. Botões secundários discretos, com hover/foco claros; tooltips trazem descrição e apenas atalhos realmente implementados. Ícones preenchidos e alinhados; controle de tema com lua inclinada e tamanho fixo; scrollbar coerente com o tema.

Requisitos de qualidade: controles semânticos e com nome acessível, foco visível, formulários com rótulos/erros associados, teclado funcional e restauração de foco após diálogo. Tooltips não substituem rótulos. Contraste e legibilidade devem ser verificados; movimento deve respeitar preferência de redução.

Não permitir overflow horizontal do documento. No Kanban, rolagem do board pode ser contida e indicada; precisa de alternativa acessível para mover cartões, sem depender exclusivamente de arrastar. Em telas estreitas, preservar contexto, ação principal e conteúdo essencial. **R:** escolher entre lista e board conforme amostra aprovada; breakpoints não estão definidos.

## Aprovação e revisão visual

**R:** aprovar uma amostra com shell, formulário, cartão/board, diálogo e estados de erro/vazio/acesso nos dois temas e em desktop/mobile antes de expandir telas. Registrar tokens e componentes aprovados no catálogo real. A aprovação é local ao CAEHUB; não altera a identidade central Honji.

Uma alteração isolada exige checagem visual do componente e contexto afetados. Mudança em shell, tipografia ou token compartilhado amplia a revisão aos consumidores relevantes, conforme ENG-001. O gate de marco cobre a aplicação implementada.
