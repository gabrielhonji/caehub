import type { Board, Space, TaskPreview } from './types';

export const spaces: Space[] = [
  { id: 'eventos', name: 'Eventos', department: 'Eventos', description: 'Produção, presença e comunicação das atividades do CAECOMP.', participants: 7, boards: 2, tone: 'teal' },
  { id: 'produtos', name: 'Produtos', department: 'Produtos', description: 'Pesquisa e evolução das iniciativas em construção.', participants: 6, boards: 1, tone: 'sand' },
  { id: 'marketing', name: 'Comunicação', department: 'Marketing', description: 'Conteúdo, identidade e pontos de contato da entidade.', participants: 5, boards: 2, tone: 'ink' },
];

export const tasks: TaskPreview[] = [
  { id: 't1', title: 'Confirmar parceiros do próximo encontro', space: 'Eventos', status: 'Em andamento', due: 'Esta semana', helpers: 2 },
  { id: 't2', title: 'Revisar proposta de oficina', space: 'Produtos', status: 'Planejado', due: 'Próxima semana', helpers: 1 },
  { id: 't3', title: 'Publicar chamada para voluntários', space: 'Comunicação', status: 'Aguardando', due: 'Aguardando retorno', helpers: 3 },
];

export const boards: Board[] = [
  {
    id: 'eventos-principal', spaceId: 'eventos', name: 'Organização de atividades', columns: [
      { id: 'ideas', label: 'Ideias', cards: [{ id: 'card-ideia-oficina', title: 'Mapear formatos de oficina', summary: 'Reunir propostas de tema e duração para o semestre.', column: 'Ideias', assignee: 'Sem responsável', helpers: 1, visibility: 'Membros' }] },
      { id: 'planned', label: 'Planejado', cards: [{ id: 'card-divulgacao', title: 'Definir calendário de divulgação', summary: 'Organizar os pontos de comunicação do próximo encontro.', column: 'Planejado', assignee: 'Marina Lopes', helpers: 2, visibility: 'Membros', due: '18 out.' }] },
      { id: 'progress', label: 'Em andamento', cards: [{ id: 'card-parceiros', title: 'Confirmar parceiros do próximo encontro', summary: 'Consolidar retornos e registrar os apoios necessários.', column: 'Em andamento', assignee: 'Rafael Nunes', helpers: 2, visibility: 'Diretoria', due: 'Esta semana' }] },
      { id: 'waiting', label: 'Aguardando', cards: [{ id: 'card-espaco', title: 'Validar reserva do espaço', summary: 'Aguardar confirmação de disponibilidade do local.', column: 'Aguardando', assignee: 'Lia Martins', helpers: 1, visibility: 'Membros' }] },
      { id: 'done', label: 'Concluído', cards: [{ id: 'card-lista', title: 'Atualizar lista de presença', summary: 'Registrar a participação da última atividade.', column: 'Concluído', assignee: 'Igor Souza', helpers: 0, visibility: 'Membros' }] },
    ],
  },
];
