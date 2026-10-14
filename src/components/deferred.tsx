import { useEffect, useState, type ComponentType } from 'react';
import { ErrorState, LoadingState } from './primitives';

// Load code only. Explicit state avoids nested Suspense fallback throttling.
export function deferred<P extends object>(load:()=>Promise<{default:ComponentType<P>}>) {
  let resolved:ComponentType<P>|undefined;
  let pending:Promise<{default:ComponentType<P>}>|undefined;
  return function Deferred(props:P) {
    const [page,setPage]=useState(()=>resolved?{Component:resolved}:undefined);
    const [failed,setFailed]=useState(false);
    useEffect(()=>{
      let active=true;
      const request=pending??=load();
      void request.then(module=>{resolved=module.default;if(active)setPage({Component:module.default});},()=>{if(pending===request)pending=undefined;if(active)setFailed(true);});
      return()=>{active=false;};
    },[]);
    if(page)return <page.Component {...props}/>;
    return failed?<ErrorState onRetry={()=>location.reload()}/>:<LoadingState/>;
  };
}
