import { StrictMode, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './app/App';
import { PublicPortal } from './components/PublicPortal';
import { api, type SessionInfo } from './services/spaces';
import { ErrorState, LoadingState } from './components/primitives';
import './styles/tokens.css';
import './styles/app.css';
import './styles/refinements.css';
import './styles/kanban-refinements.css';
import './styles/space-tools.css';
import './styles/loading.css';

function Entry(){
  const [route,setRoute]=useState(location.hash),[session,setSession]=useState<SessionInfo>(),[error,setError]=useState(false),[loading,setLoading]=useState(false);
  const internal=route.startsWith('#/');
  const load=()=>{setLoading(true);setError(false);void api<SessionInfo>('/me').then(setSession).catch(()=>setError(true)).finally(()=>setLoading(false));};
  useEffect(()=>{const update=()=>setRoute(location.hash);addEventListener('hashchange',update);return()=>removeEventListener('hashchange',update);},[]);
  useEffect(()=>{if(internal)load();},[internal]);
  if(!internal)return <PublicPortal key={route.startsWith('#verificar-email')?route:'public'}/>;
  if(loading||(!session&&!error))return <LoadingState/>;
  if(error)return <ErrorState onRetry={load}/>;
  const institutional=session?.institutionalAccess??Boolean(session?.membership&&session.membership.status!=='suspended');
  return institutional?<App/>:<PublicPortal key="buyer" institutionalDenied={!route.startsWith('#/meus-pedidos')&&!route.startsWith('#/comercial/comprar')}/>;
}
createRoot(document.getElementById('root')!).render(<StrictMode><Entry /></StrictMode>);
