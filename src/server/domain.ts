export const institutionalRoles = ['president', 'vice_president', 'counselor', 'director', 'member'] as const;
export type InstitutionalRole = typeof institutionalRoles[number];

export type Actor = {
  subject: string;
  displayName: string;
  projectAccess: boolean;
  buyerAccess?: boolean;
  accountAccess?: boolean;
  owner: boolean;
  institutionalAdmin?: boolean;
  centralHierarchy?: boolean;
  realSubject?: string;
  debugView?: { available: boolean; mode: import('./debug-profiles.js').DebugMode };
};

export type Membership = { id: string; role: InstitutionalRole; status: 'active' | 'suspended' | 'ended' };

export function isInstitutionAdmin(actor: Actor, membership?: Membership): boolean {
  return membership?.status === 'active' && (actor.owner || actor.institutionalAdmin === true || ['president', 'vice_president'].includes(membership.role));
}

export function mayManageDepartment(actor: Actor, membership: Membership | undefined, isDirector: boolean): boolean {
  return isInstitutionAdmin(actor, membership) || (membership?.status === 'active' && isDirector);
}
