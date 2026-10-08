import type { Space } from '../domain/types';
import { Badge, Eyebrow } from './primitives';
export function SpaceSummary({ space }: { space: Space }) { return <article className={`space-card tone-${space.tone}`}><Eyebrow>{space.department}</Eyebrow><h2>{space.name}</h2><p>{space.description}</p><div className="space-meta"><Badge>{space.participants} participantes</Badge><span>{space.boards} {space.boards === 1 ? 'quadro' : 'quadros'}</span></div></article>; }
