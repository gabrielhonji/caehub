type Person={membershipId:string;displayName:string;status:string};
const labels:Record<string,string>={free:'Livre',busy:'Ocupado',unknown:'Não informado'};
export function ParticipantStatusList({people}:{people:Person[]}){
 const sorted=[...people].sort((a,b)=>Number(a.status==='free')-Number(b.status==='free'));
 const row=(person:Person)=><li key={person.membershipId}><span className="participant-status-name">{person.displayName}</span><span className="occupancy-status" data-status={person.status}>{labels[person.status]??'Não informado'}</span></li>;
 return <div className="participant-status-list"><ul>{sorted.slice(0,5).map(row)}</ul>{sorted.length>5&&<details><summary>Ver mais {sorted.length-5} participantes</summary><ul>{sorted.slice(5).map(row)}</ul></details>}</div>;
}
