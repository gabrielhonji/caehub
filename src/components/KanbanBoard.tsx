import {refreshContent} from '../hooks/useRefresh';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { CSSProperties, PointerEvent } from 'react';
import type { Board, BoardCard } from '../domain/types';
import { Badge, Button, Dialog } from './primitives';
import { deleteColumn, leaveCard, moveCard, renameColumn, volunteer } from '../services/spaces';

type Action=(work:()=>Promise<unknown>,message:string)=>Promise<boolean>;

function Card({card,busy,writable,onOpen,onAction,onDrag,onDragMove,onDragEnd}:{card:BoardCard;busy:boolean;writable:boolean;onOpen:(card:BoardCard)=>void;onAction:Action;onDrag:(event:PointerEvent,card:BoardCard)=>void;onDragMove:(event:PointerEvent)=>void;onDragEnd:(event:PointerEvent)=>void}){
  const [helping,setHelping]=useState(Boolean(card.isHelper));
  useEffect(()=>setHelping(Boolean(card.isHelper)),[card.isHelper]);
  return <article data-card-id={card.id} data-highlight={new URLSearchParams(location.hash.split('?')[1]??'').get('card')===card.id} data-priority={card.priority} className="board-card" onClickCapture={event=>{if(event.currentTarget.dataset.dragged){event.preventDefault();event.stopPropagation();delete event.currentTarget.dataset.dragged;}}}>
    <div className="card-upper" aria-label={`Arrastar ${card.title}`} onPointerDown={event=>onDrag(event,card)} onPointerMove={onDragMove} onPointerUp={onDragEnd} onPointerCancel={onDragEnd}>
      <div className="card-topline"><Badge>{card.column}</Badge>{card.priority&&card.priority!=='normal'&&<span className="priority-label">{card.priority==='high'?'↑ Alta prioridade':'↓ Baixa prioridade'}</span>}<button type="button" className="card-menu" aria-label={`Editar ${card.title}`} onPointerDown={event=>event.stopPropagation()} onClick={()=>onOpen(card)}>⋯</button></div>
      <button className="card-detail-trigger" type="button" onClick={()=>onOpen(card)}><h3 title={card.title}>{card.title}</h3><p>{card.summary}</p></button>
    </div>
    <footer><span title={card.assignee}>{card.assignee}</span><span>{card.helpers+Number(helping)-Number(Boolean(card.isHelper))} auxiliares</span></footer>
    {writable&&<div className="card-quick-actions"><Button disabled={busy} aria-pressed={helping} aria-label={helping?`Deixar de ser auxiliar em ${card.title}`:`Quero ajudar em ${card.title}`} title={helping?'Clique para sair dos auxiliares':'Clique para participar como auxiliar'} onClick={()=>void onAction(async()=>{if(helping)await leaveCard(card.id);else await volunteer(card.id);setHelping(!helping);},helping?'Você deixou de ser auxiliar neste cartão.':'Você agora participa como auxiliar neste cartão.')}><span aria-hidden="true">{helping?'🤝':'✋'}</span></Button></div>}
  </article>;
}

export function KanbanBoard({board,busy,onOpen,onAction}:{board:Board;busy:boolean;onOpen:(card:BoardCard)=>void;onAction:Action}){
  const viewport=useRef<HTMLDivElement>(null),edge=useRef(0),dragged=useRef<BoardCard|undefined>(undefined);
  const [columns,setColumns]=useState(board.columns);
  useEffect(()=>setColumns(board.columns),[board.columns]);
  const [editing,setEditing]=useState<string>();
  const [controls,setControls]=useState<HTMLElement|null>(null);
  useEffect(()=>setControls(document.getElementById(`kanban-controls-${board.id}`)),[board.id]);
  const origin=useRef<{x:number;y:number}|undefined>(undefined);
  const [ghost,setGhost]=useState<{x:number;y:number}>();
  const [dragging,setDragging]=useState<BoardCard>(),[target,setTarget]=useState<string>();
  const [limits,setLimits]=useState({left:false,right:false,first:1,last:board.columns.length});
  const writable=board.canWrite!==false;
  const targetCard=new URLSearchParams(location.hash.split('?')[1]??'').get('card');
  useEffect(()=>{if(!targetCard)return;const card=viewport.current?.querySelector<HTMLElement>(`[data-card-id="${CSS.escape(targetCard)}"]`);if(!card)return;card.scrollIntoView({block:'nearest',inline:'center',behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'});card.querySelector<HTMLButtonElement>('.card-detail-trigger')?.focus({preventScroll:true});},[targetCard,board.id]);
  useEffect(()=>{
    const element=viewport.current;if(!element)return;
    const update=()=>{
      const rect=element.getBoundingClientRect();
      const columns=Array.from(element.querySelectorAll<HTMLElement>('.board-column'));
      const visible=columns.map((column,index)=>({rect:column.getBoundingClientRect(),index})).filter(c=>c.rect.right>rect.left+24&&c.rect.left<rect.right-24);
      setLimits({left:element.scrollLeft>2,right:element.scrollLeft+element.clientWidth<element.scrollWidth-2,first:(visible[0]?.index??0)+1,last:(visible.at(-1)?.index??0)+1});
    };
    update();const observer=new ResizeObserver(update);observer.observe(element);if(element.firstElementChild)observer.observe(element.firstElementChild);
    element.addEventListener('scroll',update,{passive:true});
    return()=>{observer.disconnect();element.removeEventListener('scroll',update);};
  },[board.columns.length]);
  useEffect(()=>{if(!dragging)return;const timer=setInterval(()=>{if(viewport.current&&edge.current)viewport.current.scrollLeft+=edge.current*12;},30);return()=>clearInterval(timer);},[dragging]);
  const cancelDrag=()=>{edge.current=0;dragged.current=undefined;setDragging(undefined);setTarget(undefined);setGhost(undefined);origin.current=undefined;};
  const scroll=(direction:number)=>viewport.current?.scrollBy({left:direction*Math.max(280,(viewport.current.clientWidth??300)*.8),behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'});
  const start=(event:PointerEvent,card:BoardCard)=>{if(busy||!writable||!card.canMove||event.pointerType!=='mouse'||event.button!==0)return;if((event.target as HTMLElement).closest('.card-menu'))return;dragged.current=card;origin.current={x:event.clientX,y:event.clientY};};
  const locate=(event:PointerEvent)=>{const element=document.elementFromPoint(event.clientX,event.clientY)?.closest<HTMLElement>('[data-column-id]');return element&&viewport.current?.contains(element)?element.dataset.columnId:undefined;};
  const over=(event:PointerEvent)=>{if(!dragged.current||busy||!origin.current)return;if(!dragging&&Math.hypot(event.clientX-origin.current.x,event.clientY-origin.current.y)<6)return;event.currentTarget.setPointerCapture(event.pointerId);setDragging(dragged.current);setGhost({x:event.clientX,y:event.clientY});setTarget(locate(event));const rect=viewport.current!.getBoundingClientRect();edge.current=event.clientX<rect.left+48?-1:event.clientX>rect.right-48?1:0;};
  const drop=(event:PointerEvent)=>{const card=dragged.current,columnId=locate(event),moved=Boolean(ghost);if(moved){const article=event.currentTarget.closest('article');if(article){article.dataset.dragged='true';setTimeout(()=>delete article.dataset.dragged,250);}}cancelDrag();if(!moved||event.type==='pointercancel'||!card||busy||!columnId||card.columnId===columnId)return;void onAction(async()=>{await moveCard(card.id,columnId,card.version??1);setColumns(current=>current.map(column=>({...column,cards:column.cards.filter(c=>c.id!==card.id).concat(column.id===columnId?[{...card,columnId,column:column.label,version:(card.version??1)+1}]:[])})));},'Cartão movido.');};
  const edited=board.columns.find(column=>column.id===editing);
  return <>
    {edited&&<Dialog protectChanges title={`Editar coluna ${edited.label}`} onClose={()=>setEditing(undefined)}><div className="modal-form"><form className="modal-form" onSubmit={event=>{event.preventDefault();const name=String(new FormData(event.currentTarget).get('name'));void onAction(()=>renameColumn(edited.id,name),'Coluna renomeada.').then(ok=>{if(ok)setEditing(undefined);});}}><label>Novo nome<input name="name" defaultValue={edited.label} required disabled={busy}/></label><Button disabled={busy}>Renomear</Button></form>{board.columns.length>1&&<form className="modal-form" onSubmit={event=>{event.preventDefault();const destination=String(new FormData(event.currentTarget).get('target'));void onAction(()=>deleteColumn(edited.id,destination),'Coluna excluída e cartões realocados.').then(ok=>{if(ok)setEditing(undefined);});}}><label>Realocar cartões para<select name="target" disabled={busy}>{board.columns.filter(c=>c.id!==edited.id).map(c=><option value={c.id} key={c.id}>{c.label}</option>)}</select></label><Button disabled={busy}>Excluir e realocar</Button></form>}</div></Dialog>}
    {ghost&&dragging&&createPortal(<div className="kanban-drag-ghost" style={{left:ghost.x+12,top:ghost.y+12}}>{dragging.title}</div>,document.body)}
    {controls&&createPortal(<div className="kanban-navigation"><div role="group" aria-label="Percorrer colunas"><Button disabled={!limits.left} onClick={()=>scroll(-1)} aria-label="Ver colunas anteriores">←</Button><Button disabled={!limits.right} onClick={()=>scroll(1)} aria-label="Ver próximas colunas">→</Button><Button disabled={busy} aria-label="Atualizar quadro" onClick={()=>void refreshContent()}>↻</Button><Button aria-label="Configurar atualização automática" onClick={()=>{const select=document.getElementById('auto-refresh-mode');select?.closest('details')?.setAttribute('open','');select?.focus();}}>Auto</Button></div><span>Colunas {limits.first}–{limits.last} de {board.columns.length}</span><span>{limits.right?'Há mais colunas à direita →':limits.left?'← Há colunas à esquerda':'Todas as colunas estão visíveis'}</span></div>,controls)}

    <div ref={viewport} className="board-scroll kanban-viewport" data-left={limits.left} data-right={limits.right} tabIndex={0} aria-label="Quadro Kanban. Role horizontalmente para consultar as colunas.">
      <div className="board-grid" style={{'--column-count':board.columns.length} as CSSProperties}>
        {columns.map((column,index)=><section className={`board-column ${target===column.id?'column-drop-target':''}`} style={{'--column-color':({'Ideias':'var(--muted)','Planejado':'#b37516','Em andamento':'#0758c9','Aguardando':'#8555a5','Concluído':'#287a59'} as Record<string,string>)[column.label]??['var(--muted)','#b37516','#0758c9','#8555a5','#287a59'][index%5]} as CSSProperties} key={column.id} data-column-id={column.id}>
          <header><div className="column-title"><h3>{column.label}</h3>{board.canManage&&<button type="button" className="column-edit" aria-label={`Editar coluna ${column.label}`} onClick={()=>setEditing(column.id)}>⋯</button>}</div><span>{column.cards.length}</span></header>
          {column.cards.length?column.cards.map(card=><div key={card.id}><Card card={card} writable={writable} busy={busy||!writable} onOpen={onOpen} onAction={onAction} onDrag={start} onDragMove={over} onDragEnd={drop}/></div>):<p className="column-empty">Nenhum cartão neste estágio.</p>}
        </section>)}
      </div>
    </div>
  </>;
}
