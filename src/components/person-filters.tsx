"use client";
export type PersonOption = {id:string;name:string;count?:number};
export function PersonFilters({people,value,onChange,label,total}:{
  people:readonly PersonOption[];
  value:string;
  onChange:(id:string)=>void;
  label:string;
  total?:number;
}) {
  return <div className="filter-tabs person-filters" role="group" aria-label={label}>
    {[{id:"all",name:"Alle",count:total},...people].map(person=>(
      <button key={person.id} type="button" className={value===person.id ? "active" : ""} aria-pressed={value===person.id} onClick={()=>onChange(person.id)}>
        {person.name}{person.count!==undefined && <span className="filter-count">{person.count}</span>}
      </button>
    ))}
  </div>;
}
