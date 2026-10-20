/** Suggested response deadline; callers retain manual choices. */
export function suggestedDeadline(openedAt:number,eventAt?:number):number|undefined {
  if(!Number.isFinite(openedAt))return;
  let candidate=openedAt+48*60*60*1000;
  if(eventAt!==undefined){
    if(!Number.isFinite(eventAt)||eventAt<=openedAt)return;
    const beforeEvent=eventAt-24*60*60*1000;
    candidate=beforeEvent>openedAt?Math.min(candidate,beforeEvent):openedAt+(eventAt-openedAt)/2;
  }
  // Native datetime fields have minute precision; never suggest a rounded past time.
  const rounded=Math.floor(candidate/60000)*60000;
  return rounded>openedAt&&(eventAt===undefined||rounded<eventAt)?rounded:undefined;
}
export function localDeadline(value:number):string {
  const date=new Date(value);
  return new Date(value-date.getTimezoneOffset()*60*1000).toISOString().slice(0,16);
}
