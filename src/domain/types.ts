export type Space = { id: string; name: string; department: string; description: string; participants: number; boards: number; tone: 'teal' | 'sand' | 'ink' };
export type TaskPreview = { id: string; title: string; space: string; status: 'Em andamento' | 'Aguardando' | 'Planejado'; due: string; helpers: number };
