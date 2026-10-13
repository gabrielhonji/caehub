import { useState } from 'react';
import { api } from '../services/spaces';
import { Button, Eyebrow } from './primitives';

export function BuyerEmailVerification({onVerified}:{onVerified:()=>void}){
  const [email,setEmail]=useState(''),[token]=useState(()=>new URLSearchParams(location.hash.split('?')[1]??'').get('token'));
  const [busy,setBusy]=useState(false),[message,setMessage]=useState(''),[error,setError]=useState(''),[complete,setComplete]=useState(false);
  async function submit(){
    if(busy)return;setBusy(true);setMessage('');setError('');
    try{
      if(token){await api('/buyer/student-email/confirm',{method:'POST',body:JSON.stringify({verificationToken:token})});history.replaceState(null,'',location.pathname+location.search+'#verificar-email');setComplete(true);onVerified();}
      else{const result=await api<{message:string}>('/buyer/student-email',{method:'POST',body:JSON.stringify({studentEmail:email})});setMessage(result.message);}
    }catch(error){setError(error instanceof Error?error.message:'Não foi possível confirmar agora. Tente novamente.');}
    finally{setBusy(false);}
  }
  if(complete)return <p className="form-feedback success" role="status">E-mail acadêmico confirmado. Você já pode comprar. <a href="#campanhas">Ir para a lojinha →</a></p>;
  return <section className="buyer-login-note" aria-label="Confirmação de e-mail acadêmico"><Eyebrow>CONFIRMAÇÃO DE E-MAIL</Eyebrow><h3>Confirme seu vínculo acadêmico.</h3><p>Compradores externos precisam de um e-mail <strong>@alunos.utfpr.edu.br</strong> confirmado. Anexe esse endereço à sua conta Honji antes de comprar. Esta confirmação não concede acesso à área institucional.</p><p>Abra o link usando a mesma conta que solicitou a confirmação. Confira também sua caixa de spam.</p>{token?<Button variant="primary" disabled={busy} onClick={()=>void submit()}>{busy?'Confirmando…':'Confirmar meu e-mail acadêmico'}</Button>:<form className="form-fields" onSubmit={event=>{event.preventDefault();void submit();}}><label>E-mail acadêmico<input type="email" required maxLength={254} autoComplete="email" value={email} onChange={event=>setEmail(event.target.value)} placeholder="seunome@alunos.utfpr.edu.br"/></label><Button variant="primary" disabled={busy} type="submit">{busy?'Enviando…':'Enviar confirmação'}</Button></form>}{message&&<p className="form-feedback success" role="status">{message}</p>}{error&&<p className="form-feedback error" role="alert">{error}</p>}</section>;
}
