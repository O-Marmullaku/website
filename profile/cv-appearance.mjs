const themes=[
  ['blue-gray','Original blue-gray','#adbacd','#155c8c'],['navy','Navy','#edf3f6','#173f67'],
  ['charcoal','Charcoal','#f0f1f2','#424851'],['forest','Forest green','#eef4ef','#285445'],['burgundy','Burgundy','#f5eff1','#73394a'],
];
const check='<svg viewBox="0 0 16 16" aria-hidden="true"><path d="m3 8 3 3 7-7"/></svg>';
const entrySample=timeline=>`<svg class="entry-sample" viewBox="0 0 120 56" aria-hidden="true"><path class="sample-text" d="M8 13h19m17 0h64M8 39h19m17 0h64M44 21h40m-40 26h40"/>${timeline?'<path class="sample-stem" d="M36 20v12"/><circle cx="36" cy="13" r="3"/><circle cx="36" cy="39" r="3"/>':''}</svg>`;
export function setupCVAppearance({data,onChange}){
  const node=(tag,cls,text)=>{const el=document.createElement(tag);if(cls)el.className=cls;if(text)el.textContent=text;return el;};
  const panel=node('section','cv-appearance');panel.id='cv-appearance';panel.setAttribute('popover','auto');panel.setAttribute('aria-label','Appearance');
  const header=node('header','appearance-head');header.append(node('h2','','Appearance'));
  const close=node('button','appearance-close');close.type='button';close.setAttribute('aria-label','Close appearance');close.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18"/></svg>';header.append(close);panel.append(header);
  const toggle=node('button','cv-appearance-toggle','Appearance');toggle.type='button';toggle.setAttribute('aria-controls',panel.id);toggle.setAttribute('aria-expanded','false');
  toggle.addEventListener('click',()=>panel.togglePopover());close.addEventListener('click',()=>{panel.hidePopover();toggle.focus({preventScroll:true});});
  panel.addEventListener('toggle',event=>toggle.setAttribute('aria-expanded',String(event.newState==='open')));
  function group(field,title,choices,current){
    const set=node('fieldset','appearance-group appearance-'+field);set.append(node('legend','',title));
    for(const {value,label,description,sample} of choices){
      const option=node('label','appearance-option'),input=node('input');input.type='radio';input.name='cv-'+field;input.value=value;input.checked=current===value;input.setAttribute('aria-label',label);
      const mark=node('span','appearance-check');mark.innerHTML=check;
      option.append(input);if(sample){const preview=node('span','appearance-sample');preview.setAttribute('aria-hidden','true');preview.innerHTML=sample;option.append(preview);}
      const caption=node('span','appearance-caption');caption.append(node('strong','',label));if(description){const detail=node('small','',description);detail.id=`appearance-${field}-${value}-help`;input.setAttribute('aria-describedby',detail.id);caption.append(detail);}option.append(caption,mark);
      input.addEventListener('change',()=>{if(input.checked){data[field]=value;onChange(field);}});set.append(option);
    }
    panel.append(set);
  }
  group('theme','Color',themes.map(([value,label,tint,ink])=>({value,label,sample:`<span class="color-sample" style="--sample-tint:${tint};--sample-ink:${ink}"><i></i><b>Aa</b></span>`})),data.theme||'navy');
  group('typography','Text style',[
    {value:'classic',label:'Classic',description:'Larger role, bold headings',sample:'<span class="type-sample type-classic"><b>Your name</b><span>Your role</span><strong>EDUCATION</strong></span>'},
    {value:'compact',label:'Compact',description:'Smaller, spaced lettering',sample:'<span class="type-sample type-compact"><b>Your name</b><span>YOUR ROLE</span><strong>EDUCATION</strong></span>'},
  ],data.typography==='compact'?'compact':'classic');
  group('entryStyle','Entries',[
    {value:'plain',label:'Plain',description:'Separated by space',sample:entrySample(false)},
    {value:'timeline',label:'Timeline dots',description:'Dots beside dates',sample:entrySample(true)},
  ],data.entryStyle==='timeline'?'timeline':'plain');
  panel.append(node('p','appearance-note','Changes save automatically and apply to Preview and PDF.'));
  document.getElementById('resume').append(panel);return {panel,toggle};
}
