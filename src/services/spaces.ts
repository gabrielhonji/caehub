import type { Board, Space, TaskPreview } from '../domain/types';

export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const csrf=await sessionToken();
  const response = await fetch(`/api${path}`, { ...init, headers: { 'content-type': 'application/json',...(csrf?{'x-csrf-token':csrf}:{}), ...init?.headers } });
  if(response.status===403){const problem=await response.clone().json().catch(()=>({}));if(problem.message==='Honji identity integration is unavailable'){location.assign('/acesso');throw new Error('Sessão necessária.');}}
  if (!response.ok) { const problem = await response.json().catch(() => ({})); throw new Error(problem.message ?? `Falha ${response.status}`); }
  if (response.status === 204) return undefined as T;
  return response.json();
}
let tokenPromise:Promise<string>|undefined;
function sessionToken(){return tokenPromise??=fetch('/api/me').then(async response=>{if(!response.ok){location.assign('/acesso');throw new Error('Sessão necessária.');}return String((await response.json()).csrfToken??'');});}
type WorkspaceDto = { id:string;name:string;description:string|null;department?:string;participants?:unknown[] };
type BoardDto = {id:string;workspaceId:string;name:string;canManage:boolean;columns:Array<{id:string;name:string;position:number;isCompletion:boolean;cards:Array<{id:string;title:string;description:string|null;dueAt?:string;visibility:'members'|'directors';responsibleName?:string;helperCount:number;version:number}>}>};
const boardFrom = (dto:BoardDto):Board => ({id:dto.id,spaceId:dto.workspaceId,name:dto.name,canManage:dto.canManage,columns:dto.columns.map(column=>({id:column.id,label:column.name,isCompletion:Boolean(column.isCompletion),cards:column.cards.map(card=>({id:card.id,title:card.title,summary:card.description??'',column:column.name,columnId:column.id,assignee:card.responsibleName??'Sem responsável',helpers:Number(card.helperCount),visibility:card.visibility==='directors'?'Diretoria':'Membros',due:card.dueAt,version:Number(card.version)}))}))});

export async function getSpaces(): Promise<Space[]> { const rows=await api<WorkspaceDto[]>('/workspaces'); return rows.map((row,index)=>({id:row.id,name:row.name,department:row.department??'Direção Geral',description:row.description??'',participants:row.participants?.length??0,boards:0,tone:(['teal','sand','ink'] as const)[index%3]})); }
export async function getBoards(): Promise<Board[]> { const spaces=await api<WorkspaceDto[]>('/workspaces'); const lists=await Promise.all(spaces.map(s=>api<Array<{id:string}>>(`/workspaces/${s.id}/boards`))); const boards=await Promise.all(lists.flat().map(b=>api<BoardDto>(`/boards/${b.id}`))); return boards.map(boardFrom); }
export async function getBoard(spaceId:string):Promise<Board|undefined>{return (await getBoards()).find(board=>board.spaceId===spaceId);}
export async function getTaskPreviews(filters:Record<string,string>={state:'open'}):Promise<TaskPreview[]>{const query=new URLSearchParams(filters);const rows=await api<Array<{id:string;title:string;workspace:string;dueAt?:string;completedAt?:string}>>(`/my-tasks?${query}`);return rows.map(row=>({id:row.id,title:row.title,space:row.workspace,status:row.completedAt?'Concluído':'Em andamento',due:row.dueAt?new Date(row.dueAt).toLocaleDateString('pt-BR'):'Sem prazo',helpers:0}));}
export const createCard=(boardId:string,input:{title:string;description?:string;columnId?:string})=>api<{id:string}>(`/boards/${boardId}/cards`,{method:'POST',body:JSON.stringify(input)});
export const moveCard=(cardId:string,columnId:string,version:number)=>api(`/cards/${cardId}/move`,{method:'POST',body:JSON.stringify({columnId,version})});
export const volunteer=(cardId:string)=>api(`/cards/${cardId}/helpers/me`,{method:'POST'});
export const addColumn=(boardId:string,name:string)=>api(`/boards/${boardId}/columns`,{method:'POST',body:JSON.stringify({name})});
export const renameColumn=(columnId:string,name:string)=>api(`/columns/${columnId}`,{method:'PATCH',body:JSON.stringify({name})});
export const deleteColumn=(columnId:string,targetColumnId:string)=>api(`/columns/${columnId}?targetColumnId=${targetColumnId}`,{method:'DELETE'});
export type CardDetailDto={id:string;title:string;description:string;priority:'low'|'normal'|'high';tags:string[];responsibleName?:string;responsibleMembershipId?:string;visibility:'members'|'directors';dueAt?:string;archivedAt?:string;helpers:Array<{membershipId:string;displayName:string}>;eligibleParticipants:Array<{membershipId:string;displayName:string}>;checklist:Array<{id:string;content:string;completed:boolean}>;comments:Array<{id:string;body:string;author:string;createdAt:string}>;activities:Array<{id:string;action:string;actor:string;createdAt:string}>;pendingTransfer:null|{id:string;toMembershipId:string;status:string};permissions:{edit:boolean;manage:boolean;volunteer:boolean};currentMembershipId:string};
export const getCardDetail=(cardId:string)=>api<CardDetailDto>(`/cards/${cardId}`);
export type ArchivedCardDto={id:string;title:string;description?:string;archivedAt:string;responsibleName?:string};
export const getArchivedCards=(boardId:string)=>api<ArchivedCardDto[]>(`/boards/${boardId}/archived-cards`);
export const updateWorkspace=(workspaceId:string,input:{name?:string;description?:string})=>api(`/workspaces/${workspaceId}`,{method:'PATCH',body:JSON.stringify(input)});
export const updateCard=(cardId:string,input:Record<string,unknown>)=>api(`/cards/${cardId}`,{method:'PATCH',body:JSON.stringify(input)});
export const requestTransfer=(cardId:string,toMembershipId:string)=>api<{id?:string;immediate:boolean}>(`/cards/${cardId}/transfers`,{method:'POST',body:JSON.stringify({toMembershipId})});
export const decideTransfer=(transferId:string,decision:'accepted'|'declined'|'cancelled')=>api(`/transfers/${transferId}/decision`,{method:'POST',body:JSON.stringify({decision})});
export const addChecklistItem=(cardId:string,content:string)=>api(`/cards/${cardId}/checklist`,{method:'POST',body:JSON.stringify({content})});
export const toggleChecklistItem=(itemId:string,completed:boolean)=>api(`/checklist/${itemId}`,{method:'PATCH',body:JSON.stringify({completed})});
export const addComment=(cardId:string,body:string)=>api(`/cards/${cardId}/comments`,{method:'POST',body:JSON.stringify({body})});
