import { StrictMode, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './app/App';
import { PublicPortal } from './components/PublicPortal';
import './styles/tokens.css';
import './styles/app.css';
import './styles/refinements.css';
import './styles/kanban-refinements.css';
import './styles/space-tools.css';
import './styles/loading.css';

function Entry(){
  const [internal,setInternal]=useState(location.hash.startsWith('#/'));
  useEffect(()=>{const update=()=>setInternal(location.hash.startsWith('#/'));addEventListener('hashchange',update);return()=>removeEventListener('hashchange',update);},[]);
  return internal?<App/>:<PublicPortal/>;
}
createRoot(document.getElementById('root')!).render(<StrictMode><Entry /></StrictMode>);
