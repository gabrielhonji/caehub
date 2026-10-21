import type {InputHTMLAttributes} from 'react';

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, 'type'|'children'|'hidden'> & {displayName:string;hidden?:boolean};

/** Supports controlled and native form selection without owning either state. */
export function ParticipantCheckbox({displayName,hidden,...input}:Props) {
  return <label hidden={hidden}><input {...input} type="checkbox"/><span title={displayName}>{displayName}</span></label>;
}
