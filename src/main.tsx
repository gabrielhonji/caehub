import { StrictMode, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { getSessionInfo, type SessionInfo } from './services/spaces';
import { ErrorState, LoadingState } from './components/primitives';
import { deferred } from './components/deferred';
import './styles/tokens.css';
import './styles/app.css';
import './styles/refinements.css';
import './styles/kanban-refinements.css';
import './styles/space-tools.css';
import './styles/loading.css';
import './styles/navigation.css';
import './styles/operational-refinement.css';

const App=deferred<object>(()=>import('./app/App').then(module=>({default:module.App})));
const PublicPortal=deferred<{embedded?:boolean;institutionalDenied?:boolean}>(()=>import('./components/PublicPortal').then(module=>({default:module.PublicPortal})));

function Entry(){
  const [route,setRoute]=useState(location.hash),[session,setSession]=useState<SessionInfo>(),[error,setError]=useState(false),[loading,setLoading]=useState(false);
  const internal=route.startsWith('#/');
  const load=()=>{setLoading(true);setError(false);void getSessionInfo(true).then(setSession).catch(()=>setError(true)).finally(()=>setLoading(false));};
  useEffect(()=>{const update=()=>setRoute(location.hash);addEventListener('hashchange',update);return()=>removeEventListener('hashchange',update);},[]);
  useEffect(()=>{if(internal)load();},[internal]);
  if(!internal)return <PublicPortal key={route.startsWith('#verificar-email')?route:'public'}/>;
  if(loading||(!session&&!error))return <LoadingState/>;
  if(error)return <ErrorState onRetry={load}/>;
  const institutional=session?.institutionalAccess??Boolean(session?.membership&&session.membership.status!=='suspended');
  return institutional?<App/>:<PublicPortal key="buyer" institutionalDenied={!route.startsWith('#/meus-pedidos')&&!route.startsWith('#/comercial/comprar')}/>;
}
createRoot(document.getElementById('root')!).render(<StrictMode><Entry /></StrictMode>);
