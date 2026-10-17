import {useEffect,useRef,useState,type InputHTMLAttributes} from 'react';
export function DateInput(props:InputHTMLAttributes<HTMLInputElement>){
 const [local,setLocal]=useState(String(props.defaultValue??'')),input=useRef<HTMLInputElement>(null);
 const value=String(props.value??local),date=value?new Date(value+'T12:00:00'):undefined;
 useEffect(()=>{const form=input.current?.form,reset=()=>setLocal(String(props.defaultValue??''));form?.addEventListener('reset',reset);return()=>form?.removeEventListener('reset',reset);},[props.defaultValue]);
 return <span className="date-input"><input {...props} ref={input} type="date" onChange={e=>{setLocal(e.target.value);props.onChange?.(e);}}/>{date&&!Number.isNaN(date.getTime())&&<small>{date.toLocaleDateString('pt-BR',{weekday:'long',day:'2-digit',month:'long',...(date.getFullYear()!==new Date().getFullYear()?{year:'numeric'}:{})})}</small>}</span>;
}
