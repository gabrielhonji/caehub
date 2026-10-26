import {Button} from './primitives';

export function QuantityStepper({label,value,max,onChange,hideLabel=false}:{label:string;value:number;max:number;onChange:(value:number)=>void;hideLabel?:boolean}){
  const safe=Number.isFinite(value)?Math.min(max,Math.max(1,value)):1;
  return <label className="quantity-stepper"><span className={hideLabel?'sr-only':undefined}>{label}</span><div><Button type="button" disabled={safe<=1} aria-label={`Diminuir ${label.toLowerCase()}`} onClick={()=>onChange(safe-1)}>−</Button><input aria-label={label} type="number" inputMode="numeric" min={1} max={max} value={safe} onChange={event=>onChange(Math.min(max,Math.max(1,Number(event.target.value)||1)))}/><Button type="button" disabled={safe>=max} aria-label={`Aumentar ${label.toLowerCase()}`} onClick={()=>onChange(safe+1)}>+</Button></div></label>;
}
