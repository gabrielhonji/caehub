import { api } from './spaces';

export type CalendarItem = { id:string;type:'meeting'|'unavailable';title:string;description?:string;location?:string;workspaceId?:string;workspace?:string;startsAt:string;endsAt:string;response?:'pending'|'confirmed'|'maybe'|'declined';revision?:number;organizer?:string;recurring?:boolean;canManage?:boolean;participantIds?:string[] };
export type AvailabilityBlock = { id:string;kind:'weekly'|'date';weekday?:number;date?:string;startTime:string;endTime:string;note?:string };
export type CollectiveAvailability = { membershipId:string;displayName:string;status:'free'|'busy'|'unknown' };
export type MemberOption = { id:string;displayName:string;role:string;departmentIds?:string[] };
export type DepartmentOption = { id:string;name:string };
export type Session = { membership:null|{id:string;role:string};owner:boolean };
export type AgendaNotification = { id:string;meetingId:string;title:string;kind:'invited'|'rescheduled'|'removed';createdAt:string;readAt?:string };

export const getSession=()=>api<Session>('/me');
export const getAvailabilityOptions=()=>api<MemberOption[]>('/availability/options');
export const getDepartments=()=>api<DepartmentOption[]>('/organization/departments');
export const getCalendar=(input:{from:string;to:string;scope:'personal'|'general'|'workspace';workspaceId?:string;offsetMinutes?:string})=>api<CalendarItem[]>(`/agenda?${new URLSearchParams(Object.entries(input).filter(([,value])=>value!==undefined) as [string,string][]).toString()}`);
export const getAvailability=()=>api<AvailabilityBlock[]>('/availability/me');
export const createAvailability=(input:Omit<AvailabilityBlock,'id'>)=>api<{id:string}>('/availability/me',{method:'POST',body:JSON.stringify(input)});
export const updateAvailability=(id:string,input:Omit<AvailabilityBlock,'id'>)=>api<{id:string}>(`/availability/me/${id}`,{method:'PUT',body:JSON.stringify(input)});
export const deleteAvailability=(id:string)=>api<void>(`/availability/me/${id}`,{method:'DELETE'});
export const getCollective=(input:{from:string;to:string;departmentId?:string;membershipIds?:string;offsetMinutes?:string})=>api<CollectiveAvailability[]>(`/availability/collective?${new URLSearchParams(Object.entries(input).filter(([,value])=>value) as [string,string][]).toString()}`);
export const createMeeting=(input:{title:string;description?:string;location?:string;workspaceId?:string;startsAt:string;endsAt:string;participantIds:string[]})=>api<{id:string}>('/meetings',{method:'POST',body:JSON.stringify(input)});
export const updateMeeting=(id:string,input:{expectedRevision:number;title?:string;description?:string;location?:string;workspaceId?:string;startsAt?:string;endsAt?:string;participantIds?:string[]})=>api<{id:string;rescheduled:boolean;revision:number}>(`/meetings/${id}`,{method:'PATCH',body:JSON.stringify(input)});
export const respondMeeting=(id:string,response:'confirmed'|'maybe'|'declined')=>api(`/meetings/${id}/response`,{method:'POST',body:JSON.stringify({response})});
export const getAgendaNotifications=()=>api<AgendaNotification[]>('/agenda/notifications');
