import type { ButtonHTMLAttributes, ReactNode } from 'react';

export function Button({ children, variant = 'secondary', ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' }) { return <button className={`button button-${variant}`} {...props}>{children}</button>; }
export function Eyebrow({ children }: { children: ReactNode }) { return <span className="eyebrow">{children}</span>; }
export function Badge({ children, tone = 'neutral' }: { children: ReactNode; tone?: 'neutral' | 'active' | 'waiting' }) { return <span className={`badge badge-${tone}`}>{children}</span>; }
export function LoadingState() { return <section className="state" aria-live="polite"><span className="spinner" aria-hidden="true" /><h2>Organizando seu espaço</h2><p>Os dados de desenvolvimento estão sendo preparados.</p></section>; }
export function EmptyState({ title, children }: { title: string; children: ReactNode }) { return <section className="state"><Eyebrow>SEM ITENS</Eyebrow><h2>{title}</h2><p>{children}</p></section>; }
export function ErrorState({ onRetry }: { onRetry: () => void }) { return <section className="state" role="alert"><Eyebrow>INDISPONÍVEL</Eyebrow><h2>Não foi possível carregar este conteúdo.</h2><p>Tente novamente. Se persistir, volte mais tarde.</p><Button onClick={onRetry}>Tentar novamente</Button></section>; }
