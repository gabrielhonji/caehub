import { boards, spaces, tasks } from '../domain/development-data';
import type { Board, Space, TaskPreview } from '../domain/types';

// Development-only seam: replace this module with a confirmed CAEHUB backend adapter.
export async function getSpaces(): Promise<Space[]> { return spaces; }
export async function getTaskPreviews(): Promise<TaskPreview[]> { return tasks; }
export async function getBoard(spaceId: string): Promise<Board | undefined> { return boards.find((board) => board.spaceId === spaceId); }
export async function getBoards(): Promise<Board[]> { return boards; }
