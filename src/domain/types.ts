export type Space = { id: string; name: string; department: string; description: string; participants: number; boards: number; tone: 'teal' | 'sand' | 'ink' };
export type Priority='low'|'normal'|'high';
export type TaskPreview = { priority?:Priority;workspaceId?:string;dueAt?:string; id: string; title: string; space: string; status: string; due: string; helpers: number };
export type BoardCard = { priority?:Priority; id: string; title: string; summary: string; column: string; columnId?: string; assignee: string; helpers: number; isHelper?:boolean; canMove?:boolean; visibility: 'Membros' | 'Diretoria'; due?: string; version?: number };
export type BoardColumn = { id: string; label: string; color?: string; isCompletion?: boolean; cards: BoardCard[] };
export type Board = { id: string; spaceId: string; name: string; canManage?: boolean; canWrite?: boolean; columns: BoardColumn[] };
