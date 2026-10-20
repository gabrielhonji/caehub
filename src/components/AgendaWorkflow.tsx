import type { ReactNode } from 'react';
import { Dialog, Eyebrow } from './primitives';

/** Domain composition: concise entry point and an isolated, persistent workspace. */
export function AgendaSummary({eyebrow,title,description,children}:{eyebrow:string;title:string;description:string;children:ReactNode}) {
  return <article className="agenda-panel agenda-summary"><Eyebrow>{eyebrow}</Eyebrow><h2>{title}</h2><p>{description}</p><div className="summary-actions">{children}</div></article>;
}
export function AgendaWorkflow({title,open,onClose,children,busy=false,protectChanges=false}:{title:string;open:boolean;onClose:()=>void;children:ReactNode;busy?:boolean;protectChanges?:boolean}) {
  return <Dialog busy={busy} protectChanges={protectChanges} title={title} open={open} size="wide" onClose={onClose}><div className="agenda-dialog"><fieldset className="workflow-controls" disabled={busy} aria-busy={busy}>{children}</fieldset></div></Dialog>;
}
