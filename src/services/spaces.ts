import type { Board, Space, TaskPreview } from '../domain/types';
import {newRequestKey} from './request-key';

export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const method=(init?.method??'GET').toUpperCase();
  const csrf=['GET','HEAD'].includes(method)?'':await sessionToken();
  const response = await fetch(`/api${path}`, { ...init, headers: { ...(init?.body != null ? { 'content-type': 'application/json' } : {}),...(csrf?{'x-csrf-token':csrf}:{}), ...init?.headers } });
  if(response.status===401){sessionPromise=undefined;location.assign(`/acesso?status=expired&returnTo=${encodeURIComponent(location.pathname+location.search+location.hash)}`);throw new Error('Sua sessão expirou. Entre novamente.');}
  if(response.status===403){const problem=await response.clone().json().catch(()=>({}));if(problem.error==='access_denied'){sessionPromise=undefined;location.assign('/acesso?status=denied');}else if(problem.message==='Honji identity integration is unavailable'){location.assign('/acesso');throw new Error('Sessão necessária.');}}
  if (!response.ok) { const problem = await response.json().catch(() => ({})); throw Object.assign(new Error(problem.message ?? `Falha ${response.status}`),{code:problem.error}); }
  if (!['GET','HEAD'].includes(method)&&/^\/(?:meetings|meeting-polls|opinion-polls|shifts|availability|agenda\/notifications)/.test(path)) window.dispatchEvent(new Event('caehub:agenda-updated'));
  if(!['GET','HEAD'].includes(method)&&path.startsWith('/commercial/')&&!path.startsWith('/commercial/analytics'))window.dispatchEvent(new Event('caehub:commercial-updated'));
  if (response.status === 204) return undefined as T;
  return response.json();
}
export type SessionInfo={commercialWorkspaceAccess?:boolean;subject:string;displayName:string;csrfToken?:string;projectAccess?:boolean;institutionalAccess?:boolean;buyerAccess?:boolean;membership?:{id:string;role:string;status?:string}|null;owner:boolean;debugView?:{available:boolean;mode:'real'|'global_admin'|'caecomp_admin'|'events_director'|'events_member'|'products_member'|'xii_admin'|'xii_secretary_member'|'xii_sports_member'}};
let sessionPromise:Promise<SessionInfo>|undefined;
// Entry refreshes on every internal entry/retry; consumers share that result.
// Backend authorization still runs for every protected request.
export function getSessionInfo(refresh=false){if(refresh)sessionPromise=undefined;return sessionPromise??=api<SessionInfo>('/me').catch(error=>{sessionPromise=undefined;throw error;});}
async function sessionToken(){return String((await getSessionInfo()).csrfToken??'');}
type WorkspaceDto = { id:string;name:string;description:string|null;department?:string;departmentId?:string;participantCount?:number;boardCount?:number;participants?:unknown[] };
export type WorkspaceDetail={id:string;name:string;description:string|null;department?:string;departmentId?:string|null;canManage:boolean;readOnly:boolean;centralHierarchy:boolean;participants:Array<{membershipId:string;displayName:string;kind:'director'|'member'|'participant'}>};
export const getWorkspaceDetail=(id:string)=>api<WorkspaceDetail>(`/workspaces/${id}`);
type BoardDto = {id:string;workspaceId:string;name:string;canManage:boolean;canWrite?:boolean;columns:Array<{id:string;name:string;position:number;isCompletion:boolean;cards:Array<{id:string;title:string;priority?:'low'|'normal'|'high';description:string|null;dueAt?:string;visibility:'members'|'directors';responsibleName?:string;helperCount:number;isHelper?:boolean;canMove?:boolean;version:number}>}>};
const boardFrom = (dto:BoardDto):Board => ({id:dto.id,spaceId:dto.workspaceId,name:dto.name,canManage:dto.canManage,canWrite:dto.canWrite,columns:dto.columns.map(column=>({id:column.id,label:column.name,isCompletion:Boolean(column.isCompletion),cards:column.cards.map(card=>({id:card.id,title:card.title,priority:card.priority,summary:card.description??'',column:column.name,columnId:column.id,assignee:card.responsibleName??'Sem responsável',helpers:Number(card.helperCount),isHelper:Boolean(card.isHelper),canMove:card.canMove,visibility:card.visibility==='directors'?'Diretoria':'Membros',due:card.dueAt,version:Number(card.version)}))}))});
const spaceFrom=(row:WorkspaceDto,index:number):Space=>({id:row.id,name:row.name,department:row.department??'Direção Geral',description:row.description??'',participants:Number(row.participantCount??row.participants?.length??0),boards:Number(row.boardCount??0),tone:(['teal','sand','ink'] as const)[index%3]});
type TaskDto={workspaceId?:string;priority?:'low'|'normal'|'high';helperCount?:number;column?:string;id:string;title:string;workspace:string;dueAt?:string;completedAt?:string};
const taskFrom=(row:TaskDto):TaskPreview=>({id:row.id,title:row.title,priority:row.priority,workspaceId:row.workspaceId,dueAt:row.dueAt,space:row.workspace,status:row.completedAt?'Concluído':row.column??'Em andamento',due:row.dueAt?new Date(row.dueAt).toLocaleDateString('pt-BR'):'Sem prazo',helpers:Number(row.helperCount??0)});

export async function getSpaces(): Promise<Space[]> { const rows=await api<WorkspaceDto[]>('/workspaces'); return rows.map(spaceFrom); }
export async function getBoards(): Promise<Board[]> { const spaces=await api<WorkspaceDto[]>('/workspaces'); const lists=await Promise.all(spaces.map(s=>api<Array<{id:string}>>(`/workspaces/${s.id}/boards`))); const boards=await Promise.all(lists.flat().map(b=>api<BoardDto>(`/boards/${b.id}`))); return boards.map(boardFrom); }
export async function getBoard(spaceId:string):Promise<Board|undefined>{return (await getBoards()).find(board=>board.spaceId===spaceId);}
export async function getTaskPreviews(filters:Record<string,string>={state:'open'}):Promise<TaskPreview[]>{const query=new URLSearchParams(filters);const rows=await api<TaskDto[]>(`/my-tasks?${query}`);return rows.map(taskFrom);}
export async function getFoundation(){const value=await api<{workspaces:WorkspaceDto[];tasks:TaskDto[];boards:BoardDto[]}>('/foundation');return {spaces:value.workspaces.map(spaceFrom),tasks:value.tasks.map(taskFrom),boards:value.boards.map(boardFrom)};}

// Keep the key on failure: a lost response can be retried without creating another record.
const commandKeys=new Map<string,string>();
const pendingCommands=new Map<string,Promise<{id:string}>>();
async function command(path:string,body:unknown):Promise<{id:string}>{
  const signature=path+JSON.stringify(body);
  const pending=pendingCommands.get(signature);if(pending)return pending;
  const key=commandKeys.get(signature)??newRequestKey();commandKeys.set(signature,key);
  if(commandKeys.size>100)commandKeys.delete(commandKeys.keys().next().value!);
  const work=api<{id:string}>(path,{method:'POST',headers:{'Idempotency-Key':key},body:JSON.stringify(body)}).then(result=>{commandKeys.delete(signature);return result;}).finally(()=>pendingCommands.delete(signature));
  pendingCommands.set(signature,work);return work;
}

export const createCard=(boardId:string,input:{title:string;description?:string;columnId?:string;priority?:string;dueAt?:string})=>command(`/boards/${boardId}/cards`,input);
export const moveCard=(cardId:string,columnId:string,version:number)=>api(`/cards/${cardId}/move`,{method:'POST',body:JSON.stringify({columnId,version})});
export const volunteer=(cardId:string)=>api(`/cards/${cardId}/helpers/me`,{method:'POST'});
export const leaveCard=(cardId:string)=>api<void>(`/cards/${cardId}/helpers/me`,{method:'DELETE'});
export const addColumn=(boardId:string,name:string)=>command(`/boards/${boardId}/columns`,{name});
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
export const addChecklistItem=(cardId:string,content:string)=>command(`/cards/${cardId}/checklist`,{content});
export const toggleChecklistItem=(itemId:string,completed:boolean)=>api(`/checklist/${itemId}`,{method:'PATCH',body:JSON.stringify({completed})});
export const addComment=(cardId:string,body:string)=>command(`/cards/${cardId}/comments`,{body});
