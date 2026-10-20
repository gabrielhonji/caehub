import {useEffect,useState} from 'react';
import {readTheme,saveTheme,type Theme} from '../services/theme';
export function useSharedTheme(){
 const [theme,setTheme]=useState<Theme>(()=>readTheme()??(matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'));
 useEffect(()=>{const sync=()=>setTheme(readTheme()??(matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light')),visible=()=>{if(!document.hidden)sync();},device=matchMedia('(prefers-color-scheme: dark)');addEventListener('focus',sync);addEventListener('pageshow',sync);addEventListener('storage',sync);document.addEventListener('visibilitychange',visible);device.addEventListener('change',sync);return()=>{removeEventListener('focus',sync);removeEventListener('pageshow',sync);removeEventListener('storage',sync);document.removeEventListener('visibilitychange',visible);device.removeEventListener('change',sync);};},[]);
 useEffect(()=>{document.documentElement.dataset.theme=theme;},[theme]);
 const choose=(next:Theme)=>{saveTheme(next);setTheme(next);};return [theme,choose] as const;
}
