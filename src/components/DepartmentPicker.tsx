import type {DepartmentOption} from '../services/agenda';
export function DepartmentPicker({departments,selected,onChange,disabled=false,description}:{departments:DepartmentOption[];selected:string[];onChange:(ids:string[])=>void;disabled?:boolean;description?:string}){
 return <fieldset disabled={disabled} className="department-multiselect wide-field"><legend>Departamentos · selecione um ou mais</legend>{description&&<p className="availability-hint">{description}</p>}{departments.map(department=><label key={department.id}><input type="checkbox" checked={selected.includes(department.id)} onChange={event=>onChange(event.target.checked?[...selected,department.id]:selected.filter(id=>id!==department.id))}/>{department.name}</label>)}</fieldset>;
}
