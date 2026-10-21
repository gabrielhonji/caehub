import type {MemberOption} from '../services/agenda';
import {ParticipantCheckbox} from './ParticipantCheckbox';

export function AgendaPeoplePicker({members,name='participantIds',selectedIds=[]}:{members:MemberOption[];name?:string;selectedIds?:string[]}) {
  return <fieldset className="participant-picker" key={selectedIds.join(',')}><legend>Participantes</legend>{members.map(member=><ParticipantCheckbox key={member.id} name={name} value={member.id} defaultChecked={selectedIds.includes(member.id)} displayName={member.displayName}/>)}</fieldset>;
}
