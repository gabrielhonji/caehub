export const institutionalRoles = ['president', 'vice_president', 'counselor', 'director', 'member'] as const;
export type InstitutionalRole = typeof institutionalRoles[number];

export type Actor = {
  subject: string;
  displayName: string;
  projectAccess: boolean;
  owner: boolean;
  realSubject?: string;
  debugView?: { available: boolean; mode: 'real' | 'admin' | 'events_director' | 'member' };
};

export type Membership = { id: string; role: InstitutionalRole; status: 'active' | 'suspended' | 'ended' };

export function isInstitutionAdmin(actor: Actor, membership?: Membership): boolean {
  return actor.owner || ['president', 'vice_president', 'counselor'].includes(membership?.role ?? 'member');
}

export function mayManageDepartment(actor: Actor, membership: Membership | undefined, isDirector: boolean): boolean {
  return isInstitutionAdmin(actor, membership) || (membership?.status === 'active' && membership.role === 'director' && isDirector);
}
