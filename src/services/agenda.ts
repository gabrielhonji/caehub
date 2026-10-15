import { api } from './spaces';
import type { ReviewRequest, MeetingPoll, OperationalShift } from './agenda-advanced';

export type CalendarItem = { archivedAt?:string;justification?:string;responses?:{displayName:string;response:string;justification?:string}[]; id:string;type:'meeting'|'unavailable'|'shift';title:string;description?:string;location?:string;workspaceId?:string;workspace?:string;startsAt:string;endsAt:string;response?:'pending'|'confirmed'|'maybe'|'declined';revision?:number;organizer?:string;recurring?:boolean;canManage?:boolean;participantIds?:string[] };
export type AvailabilityBlock = { id:string;kind:'weekly'|'date';weekday?:number;date?:string;startTime:string;endTime:string;note?:string;term?:string;validFrom?:string;validTo?:string;excludedDates?:string[]|string|null };
export type CollectiveAvailability = { membershipId:string;displayName:string;status:'free'|'busy'|'unknown' };
export type MemberOption = { id:string;displayName:string;role:string;departmentIds?:string[] };
export type DepartmentOption = { id:string;name:string };
export type Session = { membership:null|{id:string;role:string};owner:boolean;canManage?:boolean;canReadAll?:boolean };
export type AgendaNotification = { id:string;meetingId?:string;resourceType?:string;resourceId?:string;title:string;kind:string;priority?:'normal'|'high';createdAt:string;readAt?:string };
export type AgendaFoundation={calendar:CalendarItem[];availability:AvailabilityBlock[];members:MemberOption[];departments:DepartmentOption[];notifications:AgendaNotification[];requests:ReviewRequest[];polls:MeetingPoll[];shifts:OperationalShift[];session:Session};

export const getSession=()=>api<Session>('/me');
export const getAvailabilityOptions=()=>api<MemberOption[]>('/availability/options');
export const getDepartments=()=>api<DepartmentOption[]>('/organization/departments');
export const getCalendar=(input:{from:string;to:string;scope:'personal'|'general'|'workspace';workspaceId?:string;offsetMinutes?:string})=>api<CalendarItem[]>(`/agenda?${new URLSearchParams(Object.entries(input).filter(([,value])=>value!==undefined) as [string,string][]).toString()}`);
export const getAvailability=()=>api<AvailabilityBlock[]>('/availability/me');
export const createAvailability=(input:Omit<AvailabilityBlock,'id'>)=>api<{id:string}>('/availability/me',{method:'POST',body:JSON.stringify(input)});
export const updateAvailability=(id:string,input:Omit<AvailabilityBlock,'id'>)=>api<{id:string}>(`/availability/me/${id}`,{method:'PUT',body:JSON.stringify(input)});
export const deleteAvailability=(id:string)=>api<void>(`/availability/me/${id}`,{method:'DELETE'});
export type TimetablePreviewRow = { weekday:number;code:string;startTime:string|null;endTime:string|null;needsReview:boolean };
export const previewTimetable=(file:File)=>api<{rows:TimetablePreviewRow[];warnings:string[]}>('/availability/import/preview',{method:'POST',headers:{'content-type':'application/pdf'},body:file});
export const confirmTimetable=(input:{term:string;validFrom:string;validTo:string;confirmed:true;rows:{weekday:number;startTime:string;endTime:string}[]})=>api('/availability/import/confirm',{method:'POST',body:JSON.stringify(input)});
export const setAvailabilityException=(id:string,date:string,excluded:boolean)=>api(`/availability/me/${id}/exception`,{method:'PUT',body:JSON.stringify({date,excluded})});
export const getCollective=(input:{from:string;to:string;departmentId?:string;membershipIds?:string;offsetMinutes?:string})=>api<CollectiveAvailability[]>(`/availability/collective?${new URLSearchParams(Object.entries(input).filter(([,value])=>value) as [string,string][]).toString()}`);
export const createMeeting=(input:{title:string;description?:string;location?:string;workspaceId?:string;startsAt:string;endsAt:string;participantIds:string[]})=>api<{id:string}>('/meetings',{method:'POST',body:JSON.stringify(input)});
export const updateMeeting=(id:string,input:{expectedRevision:number;title?:string;description?:string;location?:string;workspaceId?:string;startsAt?:string;endsAt?:string;participantIds?:string[]})=>api<{id:string;rescheduled:boolean;revision:number}>(`/meetings/${id}`,{method:'PATCH',body:JSON.stringify(input)});
export const respondMeeting=(id:string,response:'confirmed'|'maybe'|'declined',justification?:string)=>api(`/meetings/${id}/response`,{method:'POST',body:JSON.stringify({response,justification})});
export const getAgendaNotifications=()=>api<AgendaNotification[]>('/agenda/notifications');
export const getAgendaFoundation=(input:{from:string;to:string;scope:'personal'|'general'|'workspace';workspaceId?:string;offsetMinutes?:string})=>api<AgendaFoundation>(`/agenda/foundation?${new URLSearchParams(Object.entries(input).filter(([,value])=>value!==undefined) as [string,string][]).toString()}`);

export const getMeetings=(archived=false)=>api<CalendarItem[]>(`/meetings?archived=${archived}`);
export const archiveMeeting=(id:string,expectedRevision:number)=>api(`/meetings/${id}/archive`,{method:'POST',body:JSON.stringify({expectedRevision})});
