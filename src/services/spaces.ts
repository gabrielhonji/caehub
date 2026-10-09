import type { Board, Space, TaskPreview } from '../domain/types';

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`/api${path}`, { ...init, headers: { 'content-type': 'application/json', ...init?.headers } });
  if (!response.ok) { const problem = await response.json().catch(() => ({})); throw new Error(problem.message ?? `Falha ${response.status}`); }
  if (response.status === 204) return undefined as T;
  return response.json();
}
type WorkspaceDto = { id:string;name:string;description:string|null;department?:string;participants?:unknown[] };
type BoardDto = {id:string;workspaceId:string;name:string;canManage:boolean;columns:Array<{id:string;name:string;position:number;isCompletion:boolean;cards:Array<{id:string;title:string;description:string|null;dueAt?:string;visibility:'members'|'directors';responsibleName?:string;helperCount:number;version:number}>}>};
const boardFrom = (dto:BoardDto):Board => ({id:dto.id,spaceId:dto.workspaceId,name:dto.name,canManage:dto.canManage,columns:dto.columns.map(column=>({id:column.id,label:column.name,isCompletion:Boolean(column.isCompletion),cards:column.cards.map(card=>({id:card.id,title:card.title,summary:card.description??'',column:column.name,columnId:column.id,assignee:card.responsibleName??'Sem responsável',helpers:Number(card.helperCount),visibility:card.visibility==='directors'?'Diretoria':'Membros',due:card.dueAt,version:Number(card.version)}))}))});

export async function getSpaces(): Promise<Space[]> { const rows=await api<WorkspaceDto[]>('/workspaces'); return rows.map((row,index)=>({id:row.id,name:row.name,department:row.department??'Direção Geral',description:row.description??'',participants:row.participants?.length??0,boards:0,tone:(['teal','sand','ink'] as const)[index%3]})); }
export async function getBoards(): Promise<Board[]> { const spaces=await api<WorkspaceDto[]>('/workspaces'); const lists=await Promise.all(spaces.map(s=>api<Array<{id:string}>>(`/workspaces/${s.id}/boards`))); const boards=await Promise.all(lists.flat().map(b=>api<BoardDto>(`/boards/${b.id}`))); return boards.map(boardFrom); }
export async function getBoard(spaceId:string):Promise<Board|undefined>{return (await getBoards()).find(board=>board.spaceId===spaceId);}
export async function getTaskPreviews():Promise<TaskPreview[]>{const rows=await api<Array<{id:string;title:string;workspace:string;dueAt?:string}>>('/my-tasks?state=open');return rows.map(row=>({id:row.id,title:row.title,space:row.workspace,status:'Em andamento',due:row.dueAt?new Date(row.dueAt).toLocaleDateString('pt-BR'):'Sem prazo',helpers:0}));}
export const createCard=(boardId:string,input:{title:string;description?:string;columnId?:string})=>api<{id:string}>(`/boards/${boardId}/cards`,{method:'POST',body:JSON.stringify(input)});
export const moveCard=(cardId:string,columnId:string,version:number)=>api(`/cards/${cardId}/move`,{method:'POST',body:JSON.stringify({columnId,version})});
export const volunteer=(cardId:string)=>api(`/cards/${cardId}/helpers/me`,{method:'POST'});
export const addColumn=(boardId:string,name:string)=>api(`/boards/${boardId}/columns`,{method:'POST',body:JSON.stringify({name})});
export const renameColumn=(columnId:string,name:string)=>api(`/columns/${columnId}`,{method:'PATCH',body:JSON.stringify({name})});
export const deleteColumn=(columnId:string,targetColumnId:string)=>api(`/columns/${columnId}?targetColumnId=${targetColumnId}`,{method:'DELETE'});
export type CardDetailDto={id:string;title:string;description:string;responsibleName?:string;visibility:'members'|'directors';dueAt?:string;helpers:Array<{membershipId:string;displayName:string}>;checklist:Array<{id:string;content:string;completed:boolean}>;comments:Array<{id:string;body:string;author:string;createdAt:string}>;activities:Array<{id:string;action:string;actor:string;createdAt:string}>};
export const getCardDetail=(cardId:string)=>api<CardDetailDto>(`/cards/${cardId}`);
export const addChecklistItem=(cardId:string,content:string)=>api(`/cards/${cardId}/checklist`,{method:'POST',body:JSON.stringify({content})});
export const toggleChecklistItem=(itemId:string,completed:boolean)=>api(`/checklist/${itemId}`,{method:'PATCH',body:JSON.stringify({completed})});
export const addComment=(cardId:string,body:string)=>api(`/cards/${cardId}/comments`,{method:'POST',body:JSON.stringify({body})});
