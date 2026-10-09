export type Space = { id: string; name: string; department: string; description: string; participants: number; boards: number; tone: 'teal' | 'sand' | 'ink' };
export type TaskPreview = { id: string; title: string; space: string; status: 'Em andamento' | 'Aguardando' | 'Planejado'; due: string; helpers: number };
export type BoardCard = { id: string; title: string; summary: string; column: string; columnId?: string; assignee: string; helpers: number; visibility: 'Membros' | 'Diretoria'; due?: string; version?: number };
export type BoardColumn = { id: string; label: string; isCompletion?: boolean; cards: BoardCard[] };
export type Board = { id: string; spaceId: string; name: string; canManage?: boolean; columns: BoardColumn[] };
