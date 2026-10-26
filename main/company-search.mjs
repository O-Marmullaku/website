export const companyDirectory = [
  { name: "Siemens", domain: "siemens.com" },
  { name: "ABB", domain: "abb.com" },
  { name: "Swisscom", domain: "swisscom.ch" },
  { name: "Roche", domain: "roche.com" },
  { name: "Novartis", domain: "novartis.com" },
  { name: "Google", domain: "google.com" },
  { name: "Microsoft", domain: "microsoft.com" },
  { name: "ETH Zürich", domain: "ethz.ch" },
];
const normalize = (value) =>
  value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .replace(/[^a-z0-9]/g, "");
function distance(a, b) {
  let previous = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const current = [i];
    for (let j = 1; j <= b.length; j++)
      current[j] = Math.min(
        current[j - 1] + 1,
        previous[j] + 1,
        previous[j - 1] + Number(a[i - 1] !== b[j - 1]),
      );
    previous = current;
  }
  return previous[b.length];
}
export function findCompanies(query, recent = []) {
  const needle = normalize(String(query).slice(0, 120));
  const unique = new Map();
  for (const company of [...recent, ...companyDirectory]) {
    if (!company || typeof company.name !== "string") continue;
    const key = normalize(company.name);
    if (!unique.has(key))
      unique.set(key, {
        name: company.name.slice(0, 120),
        domain:
          typeof company.domain === "string"
            ? company.domain.slice(0, 120)
            : "",
      });
  }
  return [...unique.values()]
    .map((company, index) => {
      const words = [company.name, company.domain, ...company.name.split(/\s+/)]
        .map(normalize)
        .filter(Boolean);
      let score = needle ? Infinity : index;
      for (const word of words) {
        if (word === needle) score = Math.min(score, 0);
        else if (word.startsWith(needle)) score = Math.min(score, 1);
        else if (word.includes(needle)) score = Math.min(score, 2);
        else if (needle.length >= 3) {
          const diff = distance(needle, word);
          if (diff <= Math.max(1, Math.floor(needle.length / 4)))
            score = Math.min(score, 3 + diff / word.length);
        }
      }
      const terms=String(query).trim().split(/\s+/).map(normalize).filter(Boolean);
      const nameWords=company.name.split(/\s+/).map(normalize).filter(Boolean);
      if (terms.length>1 && terms.every(term=>term.length>=3 && nameWords.some(word=>word.startsWith(term)||distance(term,word)<=1))) score=Math.min(score,3.5);
      return { company, score, index };
    })
    .filter((item) => Number.isFinite(item.score))
    .sort((a, b) => a.score - b.score || a.index - b.index)
    .slice(0, 6)
    .map((item) => item.company);
}

// Official Swiss register data. Manual entry remains available for all companies.
export async function searchSwissCompanies(value,signal) {
  const terms=value.trim().toLowerCase().match(/[\p{L}\p{N}]+/gu)?.slice(0,4)||[];
  if (!terms.length || value.trim().length<3) return [];
  async function query(words,accents=false) {
    const variants={a:'[aàáâäãå]',c:'[cç]',e:'[eèéêë]',i:'[iìíîï]',o:'[oòóôöõ]',u:'[uùúûü]',y:'[yýÿ]'};
    const filters=words.map(word=>accents
      ?`FILTER(REGEX(LCASE(STR(?name)), ${JSON.stringify(word.replace(/[aceiouy]/g,letter=>variants[letter]))}))`
      :`FILTER(CONTAINS(LCASE(STR(?name)), ${JSON.stringify(word)}))`).join('\n');
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
  const plain=terms.map(term=>term.normalize('NFD').replace(/\p{Diacritic}/gu,''));
  const hasAccents=plain.some((term,index)=>term!==terms[index]);
  let exact=await query(terms,!hasAccents);
  if(exact.length)return exact;
  if(hasAccents){exact=await query(plain,true);if(exact.length)return exact;}
  // A short prefix retrieves candidates; the existing fuzzy matcher ranks typos locally.
  return findCompanies(value,await query([plain[0].slice(0,Math.max(3,Math.floor(plain[0].length/2)))],true));
}

export function companyCombobox(input,list,recent) {
  let chosen=null,items=[],active=-1,generation=0,timer,controller;
  const close=()=>{list.hidden=true;input.setAttribute('aria-expanded','false');input.removeAttribute('aria-activedescendant');active=-1;};
  const choose=item=>{chosen=item;input.value=item.name;close();};
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
    chosen=null;const current=++generation;clearTimeout(timer);controller?.abort();
    render(findCompanies(input.value,recent()));
    if(input.value.trim().length<3)return;
    timer=setTimeout(async()=>{
      const currentController=new AbortController();controller=currentController;const timeout=setTimeout(()=>currentController.abort(),20000);
      try {const remote=await searchSwissCompanies(input.value,currentController.signal);if(current===generation&&document.activeElement===input)render(findCompanies(input.value,[...remote,...recent()]));}
      catch{}finally{clearTimeout(timeout);}
    },350);
  }
  input.addEventListener('input',search);input.addEventListener('focus',search);input.addEventListener('blur',close);
  input.addEventListener('keydown',event=>{
    if(event.key==='Escape'&&!list.hidden){event.preventDefault();event.stopPropagation();close();}
    if(['ArrowDown','ArrowUp'].includes(event.key)&&items.length){event.preventDefault();active=(active+(event.key==='ArrowDown'?1:-1)+items.length)%items.length;[...list.children].forEach((el,index)=>el.setAttribute('aria-selected',String(index===active)));input.setAttribute('aria-activedescendant','company-option-'+active);}
    if(event.key==='Enter'&&!list.hidden&&active>=0){event.preventDefault();choose(items[active]);}
  });
  return ()=>chosen?.name||input.value.trim();
}
