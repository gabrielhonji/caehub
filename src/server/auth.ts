import type { Actor } from './domain.js';

export interface IdentityGateway { current(): Promise<Actor | undefined>; }

/** Production deliberately has no fallback: the Honji BFF contract is not yet available. */
export class UnavailableHonjiGateway implements IdentityGateway {
  async current(): Promise<Actor | undefined> { return undefined; }
}

/** Explicit, process-configured fixture for local development and tests; never reads request headers. */
export class DevelopmentIdentityGateway implements IdentityGateway {
  constructor(private readonly actor: Actor | undefined) {}
  async current(): Promise<Actor | undefined> { return this.actor; }
}

export function configuredGateway(env: NodeJS.ProcessEnv): IdentityGateway {
  if (env.NODE_ENV === 'production') return new UnavailableHonjiGateway();
  const subject = env.CAEHUB_DEV_ACTOR_ID;
  if (!subject) return new UnavailableHonjiGateway();
  return new DevelopmentIdentityGateway({
    subject,
    displayName: env.CAEHUB_DEV_ACTOR_NAME ?? 'Desenvolvedor CAEHUB',
    projectAccess: env.CAEHUB_DEV_PROJECT_ACCESS !== 'false',
    owner: env.CAEHUB_DEV_OWNER === 'true',
  });
}
