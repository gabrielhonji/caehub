import {useMemo,useState,type FormEvent} from 'react';
import type {Catalog} from '../services/commercial';
import {money} from '../services/commercial';
import {Button} from './primitives';

type Line={id:number;variantId:string;quantity:number};

export function CommercialComboForm({catalog,campaignId,busy,onSave}:{catalog:Catalog;campaignId:string;busy:boolean;onSave:(body:Record<string,unknown>)=>Promise<void>}){
  const [lines,setLines]=useState<Line[]>([{id:1,variantId:'',quantity:1},{id:2,variantId:'',quantity:1}]);
  const [sequence,setSequence]=useState(3),[pricingMode,setPricingMode]=useState<'manual'|'percentage'>('manual');
  const variants=catalog.variants.filter(variant=>variant.status==='active'&&catalog.products.some(product=>product.id===variant.productId&&product.status==='active'&&product.saleCents!==null&&catalog.links.some(link=>link.campaignId===campaignId&&link.productId===product.id)));
  const base=useMemo(()=>lines.reduce((sum,line)=>{const variant=variants.find(value=>value.id===line.variantId),product=catalog.products.find(value=>value.id===variant?.productId);return sum+(product?.saleCents??0)*line.quantity;},0),[catalog.products,lines,variants]);
  const change=(id:number,patch:Partial<Line>)=>setLines(rows=>rows.map(row=>row.id===id?{...row,...patch}:row));
  const submit=(event:FormEvent<HTMLFormElement>)=>{event.preventDefault();const data=new FormData(event.currentTarget);const pricing=pricingMode==='manual'?{mode:'manual',priceCents:Math.round(Number(data.get('manualPrice'))*100)}:{mode:'percentage',discountBasisPoints:Math.round(Number(data.get('discountPercent'))*100)};void onSave({campaignId,name:String(data.get('name')),description:String(data.get('description')||''),pricing,items:lines.map(line=>({variantId:line.variantId,quantity:line.quantity}))});};
  const valid=lines.length>=2&&lines.every(line=>line.variantId&&Number.isInteger(line.quantity)&&line.quantity>0)&&new Set(lines.map(line=>line.variantId)).size===lines.length;
  return <form className="form-fields commercial-form combo-form" onSubmit={submit}><fieldset disabled={busy}>
    <p>Combine produtos físicos e por encomenda desta campanha. A composição e o preço ficam congelados no pedido.</p>
    <label>Nome do combo<input name="name" required maxLength={200}/></label>
    <label>Descrição (opcional)<textarea name="description" maxLength={5000}/></label>
    <fieldset className="wide-field combo-items"><legend>Itens do combo</legend>{lines.map((line,index)=><div className="combo-item-row" key={line.id}><label>{index+1}º produto e variação<select required value={line.variantId} onChange={event=>change(line.id,{variantId:event.target.value})}><option value="">Selecione</option>{variants.map(variant=>{const product=catalog.products.find(value=>value.id===variant.productId)!;return <option key={variant.id} value={variant.id} disabled={lines.some(other=>other.id!==line.id&&other.variantId===variant.id)}>{product.name} · {variant.name} · {product.mode==='preorder'?'Encomenda':'Físico'} · {money(product.saleCents)}</option>;})}</select></label><label>Quantidade<input type="number" min={1} max={1000000} required value={line.quantity} onChange={event=>change(line.id,{quantity:Number(event.target.value)})}/></label><Button className="selection-remove" type="button" disabled={lines.length<=2} aria-label={`Remover ${index+1}º item do combo`} onClick={()=>setLines(rows=>rows.filter(row=>row.id!==line.id))}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 7h16m-10 4v6m4-6v6M9 7l1-3h4l1 3m3 0-1 14H7L6 7"/></svg><span className="sr-only">Remover</span></Button></div>)}</fieldset>
    <Button type="button" disabled={lines.length>=100||lines.some(line=>!line.variantId)} onClick={()=>{setLines(rows=>[...rows,{id:sequence,variantId:'',quantity:1}]);setSequence(value=>value+1);}}>Adicionar produto ao combo</Button>
    <fieldset className="wide-field"><legend>Preço do combo</legend><div className="agenda-filter-group"><Button type="button" aria-pressed={pricingMode==='manual'} onClick={()=>setPricingMode('manual')}>Preço manual</Button><Button type="button" aria-pressed={pricingMode==='percentage'} onClick={()=>setPricingMode('percentage')}>Desconto percentual</Button></div>{pricingMode==='manual'?<label>Preço final (R$)<input name="manualPrice" type="number" min={0} max={base/100} step="0.01" required/></label>:<label>Desconto (%)<input name="discountPercent" type="number" min="0.01" max="100" step="0.01" required/></label>}<p className="combo-base-price">Soma dos itens: <strong>{money(base)}</strong></p></fieldset>
    <Button variant="primary" disabled={busy||!valid||base<=0}>{busy?'Salvando…':'Cadastrar combo'}</Button>
  </fieldset></form>;
}
