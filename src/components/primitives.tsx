import { forwardRef, useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { ButtonHTMLAttributes, ReactNode } from 'react';

export const Button = forwardRef<HTMLButtonElement, ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' }>(function Button({ children, variant = 'secondary', ...props }, ref) { return <button ref={ref} className={`button button-${variant}`} {...props}>{children}</button>; });
export function Eyebrow({ children }: { children: ReactNode }) { return <span className="eyebrow">{children}</span>; }
export function Badge({ children, tone = 'neutral' }: { children: ReactNode; tone?: 'neutral' | 'active' | 'waiting' }) { return <span className={`badge badge-${tone}`}>{children}</span>; }
export function LoadingState() { return <div className="loading-state" aria-live="polite"><span className="spinner" aria-hidden="true" /><div><strong>Carregando conteúdo</strong><span>Aguarde um instante…</span></div></div>; }
export function EmptyState({ title, children }: { title: string; children: ReactNode }) { return <section className="state"><Eyebrow>SEM ITENS</Eyebrow><h2>{title}</h2><div className="state-description">{children}</div></section>; }
export function ErrorState({ onRetry }: { onRetry: () => void }) { return <section className="state" role="alert"><Eyebrow>INDISPONÍVEL</Eyebrow><h2>Não foi possível carregar este conteúdo.</h2><p>Tente novamente. Se persistir, volte mais tarde.</p><Button onClick={onRetry}>Tentar novamente</Button></section>; }
export function AccessDeniedState() { return <section className="state" role="alert"><Eyebrow>ACESSO RESTRITO</Eyebrow><h2>Esta consulta não está disponível para o seu perfil.</h2><p>As informações protegidas não foram exibidas. Se precisar desse acesso, procure a direção responsável.</p></section>; }

let dialogCount=0;
let originalBodyOverflow='';
export function Dialog({ title, children, onClose, closeLabel = 'Fechar', returnFocus, open=true, size='default', protectChanges=false }: { title: string; children: ReactNode; onClose: () => void; closeLabel?: string; returnFocus?:HTMLElement|null; open?:boolean; size?:'default'|'wide';protectChanges?:boolean }) {
  const overlay=useRef<HTMLDialogElement>(null);
  const titleId=useId();
  const closeButton = useRef<HTMLButtonElement>(null);
  const previousFocus = useRef<HTMLElement | null>(null);
  const dirty=useRef(new Set<HTMLFormElement>());
  const [discard,setDiscard]=useState(false);const continueButton=useRef<HTMLButtonElement>(null);
  const requestClose=()=>{if(discard){setDiscard(false);return;}if(protectChanges&&dirty.current.size){setDiscard(true);return;}onClose();};
  const close=useRef(requestClose);close.current=requestClose;
  useEffect(()=>{if(discard)continueButton.current?.focus();},[discard]);
  useEffect(()=>{
    const modal=overlay.current;if(!modal||!protectChanges)return;
    const changed=(event:Event)=>{const form=(event.target as HTMLElement).closest('form');if(form)dirty.current.add(form);};
    const saved=(event:Event)=>{if(event.target instanceof HTMLFormElement)dirty.current.delete(event.target);};
    modal.addEventListener('input',changed);modal.addEventListener('change',changed);modal.addEventListener('reset',saved,true);modal.addEventListener('caehub:form-saved',saved);
    return()=>{modal.removeEventListener('input',changed);modal.removeEventListener('change',changed);modal.removeEventListener('reset',saved,true);modal.removeEventListener('caehub:form-saved',saved);};
  },[protectChanges]);
  useEffect(() => {
    if(!open)return;
    const modal=overlay.current;
    previousFocus.current = returnFocus??(document.activeElement instanceof HTMLElement ? document.activeElement : null);
    modal?.showModal();
    if(dialogCount++===0){originalBodyOverflow=document.body.style.overflow;document.body.style.overflow='hidden';}
    closeButton.current?.focus();
    const keyboard = (event: KeyboardEvent) => {
      if(Array.from(document.querySelectorAll('dialog[open]')).at(-1)!==modal)return;
      if (event.key === 'Escape') {event.preventDefault();close.current();}
      if(event.key==='Tab') {
        const dialog=closeButton.current?.closest('dialog');
        const controls=Array.from(dialog?.querySelectorAll<HTMLElement>('button:not(:disabled),a[href],input:not(:disabled),select:not(:disabled),textarea:not(:disabled),[tabindex="0"]')??[]).filter(element=>element.offsetParent!==null);
        const first=controls[0],last=controls.at(-1);
        if(event.shiftKey&&document.activeElement===first){event.preventDefault();last?.focus();}
        else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus();}
      }
    };
    addEventListener('keydown',keyboard);
    return () => {
      removeEventListener('keydown',keyboard);modal?.close();
      if(--dialogCount===0)document.body.style.overflow=originalBodyOverflow;
      if(previousFocus.current?.isConnected)previousFocus.current.focus();
    };
  }, [open]);
  return createPortal(<dialog ref={overlay} className="dialog-backdrop" aria-labelledby={titleId} onCancel={event=>{event.preventDefault();close.current();}} onPointerDown={(event) => { if (event.target === event.currentTarget) close.current(); }}><section className={`dialog ${size==='wide'?'dialog-wide':''}`} onPointerDown={event => event.stopPropagation()}><header><h2 id={titleId}>{title}</h2><Button ref={closeButton} onClick={requestClose} aria-label="Fechar diálogo">{closeLabel} <span aria-hidden="true">×</span></Button></header><div className="dialog-content">{discard&&<div className="discard-confirmation" role="alert"><strong>Descartar alterações não salvas?</strong><p>Você pode continuar editando para salvar seu trabalho.</p><div className="form-actions"><Button ref={continueButton} onClick={()=>setDiscard(false)}>Continuar editando</Button><Button onClick={()=>{dirty.current.clear();setDiscard(false);onClose();}}>Descartar alterações</Button></div></div>}{children}</div></section></dialog>,document.body);
}

export function Toast({message}:{message:string}) {
  const element=useRef<HTMLDivElement>(null);
  const [visible,setVisible]=useState(false);
  useEffect(()=>{setVisible(Boolean(message));if(!message)return;const timer=setTimeout(()=>setVisible(false),5500);return()=>clearTimeout(timer);},[message]);
  useEffect(()=>{const node=element.current;if(visible&&node&&typeof node.showPopover==='function')node.showPopover();},[visible,message]);
  return visible&&message?createPortal(<div ref={element} popover="manual" className="action-toast" role="status" aria-live="polite" aria-atomic="true">✓ {message}</div>,document.body):null;
}
