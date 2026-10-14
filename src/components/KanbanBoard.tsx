import { useEffect, useRef, useState } from 'react';
import type { CSSProperties, PointerEvent } from 'react';
import type { Board, BoardCard } from '../domain/types';
import { Badge, Button } from './primitives';
import { deleteColumn, leaveCard, moveCard, renameColumn, volunteer } from '../services/spaces';

type Action=(work:()=>Promise<unknown>,message:string)=>Promise<boolean>;

function Card({card,busy,writable,onOpen,onAction,onDrag,onDragMove,onDragEnd}:{card:BoardCard;busy:boolean;writable:boolean;onOpen:(card:BoardCard)=>void;onAction:Action;onDrag:(event:PointerEvent,card:BoardCard)=>void;onDragMove:(event:PointerEvent)=>void;onDragEnd:(event:PointerEvent)=>void}){
  const [helping,setHelping]=useState(Boolean(card.isHelper));
  useEffect(()=>setHelping(Boolean(card.isHelper)),[card.isHelper]);
  return <article className="board-card">
    <div className="card-topline"><Badge>{card.column}</Badge>{writable&&card.canMove&&<button className="card-drag-handle" type="button" disabled={busy} aria-label={`Arrastar ${card.title}`} title="Arraste para outra coluna; o seletor também permite mover por teclado ou toque." onPointerDown={event=>onDrag(event,card)} onPointerMove={onDragMove} onPointerUp={onDragEnd} onPointerCancel={onDragEnd}><span aria-hidden="true">⠿</span></button>}</div>
    <button className="card-detail-trigger" type="button" onClick={()=>onOpen(card)}><h3>{card.title}</h3><p>{card.summary}</p></button>
    <footer><span>{card.assignee}</span><span>{card.helpers+Number(helping)-Number(Boolean(card.isHelper))} auxiliares</span></footer>
    {writable&&<div className="card-quick-actions"><Button disabled={busy} aria-pressed={helping} aria-label={helping?`Deixar de ser auxiliar em ${card.title}`:`Quero ajudar em ${card.title}`} title={helping?'Clique para sair dos auxiliares':'Clique para participar como auxiliar'} onClick={()=>void onAction(async()=>{if(helping)await leaveCard(card.id);else await volunteer(card.id);setHelping(!helping);},helping?'Você deixou de ser auxiliar neste cartão.':'Você agora participa como auxiliar neste cartão.')}>{helping?'Ajudando ✓':'Ajudar'}</Button></div>}
  </article>;
}

export function KanbanBoard({board,busy,onOpen,onAction}:{board:Board;busy:boolean;onOpen:(card:BoardCard)=>void;onAction:Action}){
  const viewport=useRef<HTMLDivElement>(null),edge=useRef(0),dragged=useRef<BoardCard|undefined>(undefined);
  const [dragging,setDragging]=useState<BoardCard>(),[target,setTarget]=useState<string>();
  const [limits,setLimits]=useState({left:false,right:false,first:1,last:board.columns.length});
  const writable=board.canWrite!==false;
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
  const cancelDrag=()=>{edge.current=0;dragged.current=undefined;setDragging(undefined);setTarget(undefined);};
  const scroll=(direction:number)=>viewport.current?.scrollBy({left:direction*Math.max(280,(viewport.current.clientWidth??300)*.8),behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'});
  const start=(event:PointerEvent,card:BoardCard)=>{if(busy||!writable||!card.canMove||event.pointerType!=='mouse'||event.button!==0)return;event.preventDefault();event.currentTarget.setPointerCapture(event.pointerId);dragged.current=card;setDragging(card);};
  const locate=(event:PointerEvent)=>{const element=document.elementFromPoint(event.clientX,event.clientY)?.closest<HTMLElement>('[data-column-id]');return element&&viewport.current?.contains(element)?element.dataset.columnId:undefined;};
  const over=(event:PointerEvent)=>{if(!dragged.current||busy)return;setTarget(locate(event));const rect=viewport.current!.getBoundingClientRect();edge.current=event.clientX<rect.left+48?-1:event.clientX>rect.right-48?1:0;};
  const drop=(event:PointerEvent)=>{const card=dragged.current,columnId=locate(event);cancelDrag();if(event.type==='pointercancel'||!card||busy||!columnId||card.columnId===columnId)return;void onAction(()=>moveCard(card.id,columnId,card.version??1),'Cartão movido.');};
  return <>
    <div className="kanban-navigation"><div role="group" aria-label="Percorrer colunas"><Button disabled={!limits.left} onClick={()=>scroll(-1)} aria-label="Ver colunas anteriores">←</Button><Button disabled={!limits.right} onClick={()=>scroll(1)} aria-label="Ver próximas colunas">→</Button></div><span>Colunas {limits.first}–{limits.last} de {board.columns.length}</span><span>{limits.right?'Há mais colunas à direita →':limits.left?'← Há colunas à esquerda':'Todas as colunas estão visíveis'}</span></div>
    <p className="board-guidance">Arraste pelo puxador para mover um cartão ou use seu seletor de coluna por teclado ou toque. Clique em Ajudar para participar; clique novamente em Ajudando para sair.</p>
    <div ref={viewport} className="board-scroll kanban-viewport" data-left={limits.left} data-right={limits.right} tabIndex={0} aria-label="Quadro Kanban. Role horizontalmente para consultar as colunas.">
      <div className="board-grid" style={{'--column-count':board.columns.length} as CSSProperties}>
        {board.columns.map(column=><section className={`board-column ${target===column.id?'column-drop-target':''}`} key={column.id} data-column-id={column.id}>
          <header><div className="column-title"><h3>{column.label}</h3>{board.canManage&&<details className="column-manager"><summary aria-label={`Editar coluna ${column.label}`}>⋯</summary><div className="column-manager-panel"><form onSubmit={event=>{event.preventDefault();const name=String(new FormData(event.currentTarget).get('name'));void onAction(()=>renameColumn(column.id,name),'Coluna renomeada.');}}><label>Novo nome<input name="name" defaultValue={column.label} required disabled={busy}/></label><Button disabled={busy}>Renomear</Button></form>{board.columns.length>1&&<form onSubmit={event=>{event.preventDefault();const destination=String(new FormData(event.currentTarget).get('target'));void onAction(()=>deleteColumn(column.id,destination),'Coluna excluída e cartões realocados.');}}><label>Realocar cartões para<select name="target" disabled={busy}>{board.columns.filter(c=>c.id!==column.id).map(c=><option value={c.id} key={c.id}>{c.label}</option>)}</select></label><Button disabled={busy}>Excluir e realocar</Button></form>}</div></details>}</div><span>{column.cards.length}</span></header>
          {column.cards.length?column.cards.map(card=><div key={card.id}><Card card={card} writable={writable} busy={busy||!writable} onOpen={onOpen} onAction={onAction} onDrag={start} onDragMove={over} onDragEnd={drop}/>{writable&&card.canMove&&<label className="card-move-field">Mover cartão<select aria-label={`Mover ${card.title}`} disabled={busy} value={card.columnId} onChange={event=>{const id=event.target.value;if(id!==card.columnId)void onAction(()=>moveCard(card.id,id,card.version??1),'Cartão movido.');}}>{board.columns.map(c=><option value={c.id} key={c.id}>{c.label}</option>)}</select></label>}</div>):<p className="column-empty">Nenhum cartão neste estágio.</p>}
        </section>)}
      </div>
    </div>
  </>;
}
