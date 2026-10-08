import type { Space, TaskPreview } from './types';

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
