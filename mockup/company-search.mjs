import { findCompanies } from './sharing-model.mjs';

// Official Swiss register data. Manual entry remains available for all companies.
export async function searchSwissCompanies(value,signal) {
  const terms=value.normalize('NFD').replace(/\p{Diacritic}/gu,'').trim().toLowerCase().match(/[\p{L}\p{N}]+/gu)?.slice(0,4)||[];
  if (!terms.length || value.trim().length<3) return [];
  async function query(words) {
    const filters=words.map(word=>`FILTER(CONTAINS(LCASE(STR(?name)), ${JSON.stringify(word)}))`).join('\n');
    const sparql=`PREFIX schema: <http://schema.org/>
PREFIX admin: <https://schema.ld.admin.ch/>
SELECT ?company (SAMPLE(?name) AS ?label) ?uid (SAMPLE(?place) AS ?placeName) WHERE {
?company a admin:ZefixOrganisation; schema:name ?name; schema:identifier ?identifier.
${filters}
FILTER(REGEX(STR(?identifier), "/UID/[^/]+$"))
BIND(REPLACE(STR(?identifier), "^.*/UID/", "") AS ?uid)
OPTIONAL { ?company admin:municipality ?municipality. ?municipality schema:name ?place. }
} GROUP BY ?company ?uid LIMIT 10`;
    const response=await fetch('https://lindas.admin.ch/query',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded',Accept:'application/sparql-results+json'},body:new URLSearchParams({query:sparql}),signal,referrerPolicy:'no-referrer'});
    if(!response.ok)throw new Error('Company search unavailable');
    const data=await response.json();
    return (data.results?.bindings||[]).map(item=>({name:item.label.value,domain:[item.placeName?.value,item.uid?.value].filter(Boolean).join(' · ')}));
  }
  const exact=await query(terms);
  if(exact.length)return exact;
  // A short prefix retrieves candidates; the existing fuzzy matcher ranks typos locally.
  return findCompanies(value,await query([terms[0].slice(0,Math.max(3,Math.floor(terms[0].length/2)))]));
}

export function companyCombobox(input,list,recent,onChange=()=>{}) {
  let chosen=null,items=[],active=-1,generation=0,timer,controller;
  const close=()=>{list.hidden=true;input.setAttribute('aria-expanded','false');input.removeAttribute('aria-activedescendant');active=-1;};
  const choose=item=>{generation++;clearTimeout(timer);controller?.abort();chosen=item;input.value=item.name;close();onChange();};
  function render(candidates) {
    const query=input.value.trim();
    items=candidates.slice(0,10);
    if(query&&!items.some(item=>item.name.toLowerCase()===query.toLowerCase()))items.push({name:query,custom:true});
    list.replaceChildren();active=-1;
    items.forEach((item,index)=>{
      const el=document.createElement('div');el.className='company-option';el.id='company-option-'+index;el.role='option';el.setAttribute('aria-selected','false');
      const name=document.createElement('strong');name.textContent=item.custom?`Use “${item.name}”`:item.name;el.append(name);
      if(item.domain){const detail=document.createElement('small');detail.textContent=item.domain;el.append(detail);}
      el.addEventListener('pointerdown',event=>event.preventDefault());el.addEventListener('click',()=>choose(item));list.append(el);
    });
    list.hidden=!items.length;input.setAttribute('aria-expanded',String(!!items.length));
  }
  function search() {
    chosen=null;onChange();const current=++generation;clearTimeout(timer);controller?.abort();
    render(findCompanies(input.value,recent()));
    if(input.value.trim().length<3)return;
    timer=setTimeout(async()=>{
      const currentController=new AbortController();controller=currentController;const timeout=setTimeout(()=>currentController.abort(),10000);
      try {const remote=await searchSwissCompanies(input.value,currentController.signal);if(current===generation&&document.activeElement===input)render(findCompanies(input.value,[...remote,...recent()]));}
      catch{}finally{clearTimeout(timeout);}
    },350);
  }
  input.addEventListener('input',search);input.addEventListener('focus',search);input.addEventListener('blur',close);
  input.addEventListener('keydown',event=>{
    if(event.key==='Escape'){event.preventDefault();event.stopPropagation();close();}
    if(['ArrowDown','ArrowUp'].includes(event.key)&&items.length){event.preventDefault();active=(active+(event.key==='ArrowDown'?1:-1)+items.length)%items.length;[...list.children].forEach((el,index)=>el.setAttribute('aria-selected',String(index===active)));input.setAttribute('aria-activedescendant','company-option-'+active);}
    if(event.key==='Enter'&&!list.hidden&&active>=0){event.preventDefault();choose(items[active]);}
  });
  const value=()=>chosen?.name||input.value.trim();
  value.reset=()=>{generation++;clearTimeout(timer);controller?.abort();chosen=null;input.value='';close();onChange();};
  return value;
}
