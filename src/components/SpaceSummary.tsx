import type { Space } from '../domain/types';
import { Badge, Eyebrow } from './primitives';
export function SpaceSummary({ space, index }: { space: Space; index?: number }) {
  return <article className={`space-card tone-${space.tone}`}><div className="space-top"><Eyebrow>ESPAÇO {String((index ?? 0) + 1).padStart(2, '0')} · {space.department}</Eyebrow><Badge>{space.participants} participantes</Badge></div><h2>{space.name}</h2><p>{space.description}</p><div className="space-meta"><span>CAEHUB — {space.department}</span><span>{space.boards} {space.boards === 1 ? 'quadro' : 'quadros'} <b aria-hidden="true">→</b></span></div></article>;
}
