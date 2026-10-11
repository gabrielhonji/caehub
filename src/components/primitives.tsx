import { forwardRef, useEffect, useRef } from 'react';
import type { ButtonHTMLAttributes, ReactNode } from 'react';

export const Button = forwardRef<HTMLButtonElement, ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' }>(function Button({ children, variant = 'secondary', ...props }, ref) { return <button ref={ref} className={`button button-${variant}`} {...props}>{children}</button>; });
export function Eyebrow({ children }: { children: ReactNode }) { return <span className="eyebrow">{children}</span>; }
export function Badge({ children, tone = 'neutral' }: { children: ReactNode; tone?: 'neutral' | 'active' | 'waiting' }) { return <span className={`badge badge-${tone}`}>{children}</span>; }
export function LoadingState() { return <div className="loading-state" aria-live="polite"><span className="spinner" aria-hidden="true" /><div><strong>Organizando seu espaço</strong><span>Preparando as informações…</span></div></div>; }
export function EmptyState({ title, children }: { title: string; children: ReactNode }) { return <section className="state"><Eyebrow>SEM ITENS</Eyebrow><h2>{title}</h2><p>{children}</p></section>; }
export function ErrorState({ onRetry }: { onRetry: () => void }) { return <section className="state" role="alert"><Eyebrow>INDISPONÍVEL</Eyebrow><h2>Não foi possível carregar este conteúdo.</h2><p>Tente novamente. Se persistir, volte mais tarde.</p><Button onClick={onRetry}>Tentar novamente</Button></section>; }
export function AccessDeniedState() { return <section className="state" role="alert"><Eyebrow>ACESSO RESTRITO</Eyebrow><h2>Esta consulta não está disponível para o seu perfil.</h2><p>As informações protegidas não foram exibidas. Se precisar desse acesso, procure a direção responsável.</p></section>; }

export function Dialog({ title, children, onClose, closeLabel = 'Fechar' }: { title: string; children: ReactNode; onClose: () => void; closeLabel?: string }) {
  const closeButton = useRef<HTMLButtonElement>(null);
  const previousFocus = useRef<HTMLElement | null>(null);
  useEffect(() => { previousFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null; closeButton.current?.focus(); const closeWithEscape = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose(); }; addEventListener('keydown', closeWithEscape); return () => { removeEventListener('keydown', closeWithEscape); previousFocus.current?.focus(); }; }, [onClose]);
  return <div className="dialog-backdrop" role="presentation" onPointerDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><section className="dialog" role="dialog" aria-modal="true" aria-labelledby="dialog-title" onPointerDown={event => event.stopPropagation()}><header><h2 id="dialog-title">{title}</h2><Button ref={closeButton} onClick={onClose} aria-label="Fechar diálogo">{closeLabel} <span aria-hidden="true">×</span></Button></header><div className="dialog-content">{children}</div></section></div>;
}
