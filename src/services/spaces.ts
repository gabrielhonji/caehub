import { spaces, tasks } from '../domain/development-data';
import type { Space, TaskPreview } from '../domain/types';

// Development-only seam: replace this module with a confirmed CAEHUB backend adapter.
export async function getSpaces(): Promise<Space[]> { return spaces; }
export async function getTaskPreviews(): Promise<TaskPreview[]> { return tasks; }
