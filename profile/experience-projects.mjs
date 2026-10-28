import {positionRowHint} from './document-hints.mjs?v=hover-20261028';

// Selected from CrazyEntertainmentWebsite/index.html; the studio link opens its full catalogue.
const projects=[
  {name:'TableKing',description:'Multiplayer board games, card games and arenas.',image:'tableking',href:'https://tableking.gg/'},
  {name:'CoachLexy',description:'AI-assisted meal, workout and progress tracking.',image:'coachlexy'},
  {name:'DumpToTxt',description:'Turn a folder into one AI-ready text file.',image:'dump-to-txt'},
];
const arrow='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14m-6-6 6 6-6 6"/></svg>';

export function setupExperienceProjects(root){
  const panel=document.createElement('aside');
  panel.id='cv-experience-projects';panel.className='cv-project-panel';panel.popover='manual';
  panel.setAttribute('aria-label','Crazy Entertainment projects');
  panel.innerHTML=`<header><img class="project-studio-logo" alt=""><h3>Projects</h3><button type="button" class="project-panel-close" aria-label="Close projects"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18"/></svg></button></header><div class="project-panel-list"></div><a class="project-catalogue" href="https://crazyentertainment.ch/#work" target="_blank" rel="noopener">All projects ${arrow}</a>`;
  for(const project of projects){
    const item=document.createElement(project.href?'a':'div');item.className='project-preview';
    if(project.href){item.href=project.href;item.target='_blank';item.rel='noopener';}
    item.innerHTML=`<img src="../main/pictures/projects/${project.image}.webp" alt="" width="40" height="40"><div><strong>${project.name}</strong><p>${project.description}</p></div>${project.href?arrow:''}`;
    panel.querySelector('.project-panel-list').append(item);
  }
  root.append(panel);
  const logo=panel.querySelector('.project-studio-logo');
  let source,row,opening,closing,flight,dismissing=false,printing=false;
  const cancelClose=()=>clearTimeout(closing);
  function hide(){
    clearTimeout(opening);cancelClose();flight?.cancel();dismissing=true;
    row?.classList.remove('projects-open');source?.setAttribute('aria-expanded','false');
    if(panel.matches(':popover-open'))panel.hidePopover();
    source=row=null;dismissing=false;
  }
  function position(){
    if(!source?.isConnected||!positionRowHint(panel,row,320,280))hide();
  }
  function show(button){
    clearTimeout(opening);cancelClose();
    if(dismissing||printing)return;
    if(!button?.isConnected||root.querySelector('.document-open,[contenteditable="plaintext-only"]'))return hide();
    if(source===button&&panel.matches(':popover-open'))return;
    hide();source=button;row=source.closest('.cv-row');
    const original=source.querySelector('img'),start=original.getBoundingClientRect();
    logo.src=original.currentSrc||original.src;
    root.dispatchEvent(new CustomEvent('cv-hint-open',{detail:panel}));
    position();
    if(!source)return;
    row.classList.add('projects-open');source.setAttribute('aria-expanded','true');
    const end=logo.getBoundingClientRect();
    flight=logo.animate([
      {transform:`translate(${start.left-end.left}px,${start.top-end.top}px) scale(${start.width/end.width},${start.height/end.height})`},
      {transform:'none'},
    ],{duration:280,easing:'cubic-bezier(.16,1,.3,1)'});
  }
  const scheduleClose=()=>{cancelClose();closing=setTimeout(hide,180);};
  function dismissToSource(){
    const button=source;hide();dismissing=true;button?.focus({preventScroll:true});dismissing=false;
  }
  function sync(){
    if(source&&!source.isConnected)hide();
    root.querySelectorAll('[data-section="experience"] .cv-row').forEach(entry=>{
      const link=entry.querySelector('.cv-cell-title a'),image=entry.querySelector('.cv-row-logo');
      let matches=false;
      try{matches=['crazyentertainment.ch','www.crazyentertainment.ch'].includes(new URL(link?.href).hostname);}catch{}
      const existing=entry.querySelector('.cv-project-trigger');
      if(!matches||!image){if(existing){if(source===existing)hide();existing.querySelector('span')?.remove();existing.replaceWith(...existing.childNodes);image?.setAttribute('alt',`${link?.textContent||'Organisation'} logo`);}return;}
      if(existing)return;
      const button=document.createElement('button');button.type='button';button.className='cv-project-trigger';
      button.setAttribute('aria-label','View Crazy Entertainment projects');button.setAttribute('aria-expanded','false');button.setAttribute('aria-controls',panel.id);
      image.classList.remove('image-magnifiable');
      for(const attribute of ['tabindex','role','aria-label','aria-pressed','data-magnifier-label'])image.removeAttribute(attribute);
      image.alt='';image.replaceWith(button);button.append(image);
      const label=document.createElement('span');label.innerHTML=`Projects ${arrow}`;button.append(label);
    });
  }
  root.addEventListener('pointerover',event=>{
    if(event.pointerType==='touch')return;
    const entry=event.target.closest('.cv-row');
    if(entry&&source&&entry!==row)hide();
    if(event.target.closest('.document-link,.cv-row-options,[contenteditable="plaintext-only"]'))return;
    const button=entry?.querySelector('.cv-project-trigger');
    if(button===source&&button)cancelClose();
    else if(button){clearTimeout(opening);opening=setTimeout(()=>show(button),120);}
  });
  root.addEventListener('pointerout',event=>{
    if(!event.target.closest('.cv-row')?.contains(event.relatedTarget))clearTimeout(opening);
    if(source&&!row.contains(event.relatedTarget)&&!panel.contains(event.relatedTarget))scheduleClose();
  });
  panel.addEventListener('pointerenter',cancelClose);
  panel.addEventListener('pointerleave',event=>{if(!row?.contains(event.relatedTarget))scheduleClose();});
  root.addEventListener('focusin',event=>{
    const button=event.target.closest('.cv-project-trigger');
    if(button)show(button);else if(event.target.isContentEditable)hide();
  });
  root.addEventListener('focusout',event=>{if(source&&!row.contains(event.relatedTarget)&&!panel.contains(event.relatedTarget))hide();});
  root.addEventListener('click',event=>{
    const button=event.target.closest('.cv-project-trigger');
    if(button){show(button);if(event.detail===0)panel.querySelector('a').focus();}
  });
  root.addEventListener('pointerdown',event=>{if(source&&!row.contains(event.target)&&!panel.contains(event.target))hide();});
  panel.querySelector('.project-panel-close').addEventListener('click',dismissToSource);
  root.addEventListener('keydown',event=>{
    if(event.key==='Escape'&&panel.matches(':popover-open')){event.preventDefault();event.stopImmediatePropagation();dismissToSource();}
    else if(['ArrowRight','ArrowDown'].includes(event.key)&&event.target.closest('.cv-project-trigger')){event.preventDefault();show(event.target.closest('.cv-project-trigger'));panel.querySelector('a').focus();}
  },true);
  root.addEventListener('scroll',()=>{if(source)position();},true);
  root.addEventListener('close',hide);
  root.addEventListener('cv-hint-open',event=>{if(event.detail!==panel)hide();});
  addEventListener('resize',hide);
  addEventListener('beforeprint',()=>{printing=true;hide();});
  addEventListener('afterprint',()=>{printing=false;});
  sync();return {sync};
}
