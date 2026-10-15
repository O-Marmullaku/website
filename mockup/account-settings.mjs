import {companyCombobox} from './company-search.mjs?v=link-manager';
import {sectionLabels} from './section-timing.mjs';
const $=id=>document.getElementById(id);
const node=(tag,text='',cls='')=>{const el=document.createElement(tag);el.textContent=text;el.className=cls;return el;};
const paths={copy:'M9 8V4h11v13h-4M4 8h12v13H4z',more:'M5 12h.01M12 12h.01M19 12h.01',chevron:'m8 10 4 4 4-4',check:'m5 12 4 4 10-10',external:'M14 3h7v7M21 3l-9 9M10 3H3v18h18v-7'};
function icon(name){const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.setAttribute('viewBox','0 0 24 24');svg.setAttribute('aria-hidden','true');const path=document.createElementNS(svg.namespaceURI,'path');path.setAttribute('d',paths[name]);svg.append(path);return svg;}
const date=value=>new Intl.DateTimeFormat(undefined,{dateStyle:'medium'}).format(new Date(value));
const stamp=value=>new Intl.DateTimeFormat(undefined,{dateStyle:'medium',timeStyle:'short'}).format(new Date(value));
export async function createLiveSharing(adapter) {
  if(!adapter.editable)return {isGuest:true,track:kind=>adapter.track(kind),refresh(){}};
  let links=[],events=[],creating=false,statusTimer;
  const status=(message,error=false)=>{
    const el=$('settings-status');clearTimeout(statusTimer);el.textContent=message;el.hidden=!message;el.dataset.error=String(error);
    statusTimer=setTimeout(()=>el.hidden=true,error?8000:3000);
  };
  const report=operation=>async()=>{try{await operation();}catch(error){status(error.message,true);}};
  const url=token=>new URL('./#invite='+token,location.href).href;
  const active=link=>!link.revoked&&(!link.expires_at||Date.parse(link.expires_at)>Date.now());
  const existing=()=>links.find(link=>active(link)&&link.company.toLowerCase()===$('company-name').value.trim().toLowerCase());
  const updateCreate=()=>{$('create-link').disabled=creating||!$('company-name').value.trim();$('create-link').textContent=creating?'Creating…':existing()?'Copy link':'Create link';};
  const company=companyCombobox($('company-name'),$('company-suggestions'),()=>links.map(link=>({name:link.company})),updateCreate);
  function manualCopy(value,link) {
    const item=[...$('company-links').children].find(item=>item.dataset.linkId===link.id);
    let label=item.querySelector('.manual-copy');
    if(!label){label=node('label','Copy this link','manual-copy');const input=node('input');input.readOnly=true;input.setAttribute('aria-label','Private company link');label.append(input);item.append(label);}
    const input=label.querySelector('input');input.value=value;input.focus();input.select();status('Copy the selected link.');
  }
  async function copy(link,button,token) {
    if(button)button.disabled=true;
    try {
      const value=url(token||(await adapter.request('copy-link',{id:link.id})).token);
      try {
        await navigator.clipboard.writeText(value);status('Link copied');
        if(button){button.replaceChildren(icon('check'),document.createTextNode('Copied'));setTimeout(()=>{if(button.isConnected)button.replaceChildren(icon('copy'),document.createTextNode('Copy'));},2000);}
      } catch {manualCopy(value,link);}
    } finally{if(button){button.disabled=!active(link);if(token&&button.isConnected)button.focus({preventScroll:true});}}
  }
  function paintLinks(justCreated) {
    const host=$('company-links'),expanded=new Set([...host.querySelectorAll('.activity-toggle[aria-expanded="true"]')].map(el=>el.closest('article').dataset.linkId));
    host.replaceChildren();$('link-total').textContent=links.length?`(${links.length})`:'';
    if(!links.length){host.append(node('p','No company links yet.','links-empty'));return;}
    for(const link of links) {
      const item=node('article','','managed-link');item.dataset.linkId=link.id;if(link.id===justCreated)item.classList.add('just-created');
      let colour=0;for(const letter of link.company.toLowerCase())colour=(colour*31+letter.codePointAt(0))>>>0;
      item.style.setProperty('--company-hue',[210,155,38,275,180,330,85,18][colour%8]);
      const top=node('div','','managed-link-top'),info=node('div','','managed-link-info');
      const heading=node('h4',link.company);heading.title=link.company;
      const meta=node('p','','managed-link-meta'),state=node('span',active(link)?'Active':link.revoked?'Off':'Expired','managed-link-state');
      meta.append(document.createTextNode('Created '+date(link.created_at)));if(!active(link))meta.append(document.createTextNode(' · '),state);info.append(heading,meta);
      const copyButton=node('button','','copy-company-link');copyButton.type='button';copyButton.setAttribute('aria-label','Copy link for '+link.company);copyButton.append(icon('copy'),document.createTextNode('Copy'));copyButton.disabled=!active(link);
      copyButton.addEventListener('click',report(()=>copy(link,copyButton)));
      const more=node('button','','link-more');more.type='button';more.setAttribute('aria-label','More options for '+link.company);more.append(icon('more'));
      const options=node('div','','link-options');options.popover='auto';more.popoverTargetElement=options;more.setAttribute('aria-expanded','false');
      options.addEventListener('toggle',()=>{
        more.setAttribute('aria-expanded',String(options.matches(':popover-open')));
        if(!options.matches(':popover-open'))return;
        const rect=more.getBoundingClientRect();options.style.left=Math.max(12,rect.right-options.offsetWidth)+'px';options.style.top=Math.min(rect.bottom+6,innerHeight-options.offsetHeight-12)+'px';
      });
      const preview=node('button','Open preview');preview.type='button';preview.prepend(icon('external'));preview.disabled=!active(link);
      preview.addEventListener('click',()=>{
        options.hidePopover();const tab=window.open('about:blank','_blank');if(tab)tab.opener=null;
        adapter.request('copy-link',{id:link.id}).then(result=>{if(tab)tab.location.replace(url(result.token));else manualCopy(url(result.token),link);}).catch(error=>{tab?.close();status(error.message,true);});
      });
      const toggle=node('button',link.revoked?'Turn link on':'Turn link off','toggle-link');toggle.type='button';toggle.disabled=!!link.expires_at&&Date.parse(link.expires_at)<=Date.now();
      toggle.addEventListener('click',report(async()=>{toggle.disabled=true;try{await adapter.request('toggle-link',{id:link.id,revoked:!link.revoked});options.hidePopover();await loadLinks();status(link.revoked?'Link turned on':'Link turned off');}finally{if(toggle.isConnected)toggle.disabled=false;}}));
      options.append(preview,toggle);top.append(info,copyButton,more);item.append(top,options);
      const history=events.filter(event=>event.link_id===link.id),visits=history.filter(event=>event.kind==='visit');
      if(!history.length){item.append(node('p','Not opened yet','activity-empty'));host.append(item);continue;}
      const activity=node('section','','managed-activity');activity.id='activity-'+link.id;activity.hidden=!expanded.has(link.id);
      const trigger=node('button',visits.length?`${visits.length} ${visits.length===1?'visit':'visits'}`:'Not opened yet','activity-toggle');trigger.type='button';trigger.setAttribute('aria-label',trigger.textContent+'. Activity for '+link.company);trigger.append(icon('chevron'));trigger.setAttribute('aria-expanded',String(!activity.hidden));trigger.setAttribute('aria-controls',activity.id);
      trigger.addEventListener('click',()=>{activity.hidden=!activity.hidden;trigger.setAttribute('aria-expanded',String(!activity.hidden));});
      if(history.length){
        const timings=new Map();for(const event of history)if(event.kind==='section')timings.set(event.section,(timings.get(event.section)||0)+event.seconds);
        if(timings.size){
          activity.append(node('h5','Sections in view','section-timing-title'));
          const summary=node('dl','','section-timing-summary');
          for(const [section,seconds] of timings){const row=node('div');row.append(node('dt',sectionLabels[section]),node('dd',seconds<60?`${seconds}s`:`${Math.floor(seconds/60)}m ${seconds%60}s`));summary.append(row);}activity.append(summary,node('p','Visible time, not proof of reading. Sections can overlap.','activity-note'));
        }
        const list=node('ol');for(const event of history.filter(event=>event.kind!=='section')){const row=node('li'),time=node('time',stamp(event.created_at));time.dateTime=event.created_at;row.append(node('span',event.label),time);list.append(row);}activity.append(list);
      }
      activity.append(node('p','Includes visits from forwarded links.','activity-note'));
      item.append(trigger,activity);host.append(item);
    }
  }
  async function loadLinks(justCreated) {const result=await adapter.request('links');links=result.links;events=result.events;paintLinks(justCreated);updateCreate();}
  async function loadFamily() {
    const family=await adapter.request('family');$('sibling-permissions').replaceChildren();
    for(const person of family.profiles.filter(person=>person.id!==adapter.profile.id)) {
      const label=node('label','','family-share'),check=node('input');check.type='checkbox';check.role='switch';check.checked=family.family.some(grant=>grant.recipient_id===person.id&&grant.enabled);check.setAttribute('aria-label','Let '+person.display_name+' view and share my CV');
      label.append(node('span',person.display_name),check);
      check.addEventListener('change',report(async()=>{check.disabled=true;try{await adapter.request('share-family',{recipient_id:person.id,enabled:check.checked});status('Family access saved');}catch(error){check.checked=!check.checked;throw error;}finally{check.disabled=false;}}));$('sibling-permissions').append(label);
    }
  }
  const tabs=[['companies-tab','companies'],['family-tab','family-panel']];
  function selectTab(id){for(const [tab,panel] of tabs){const selected=tab===id;$(tab).setAttribute('aria-selected',String(selected));$(tab).tabIndex=selected?0:-1;$(panel).hidden=!selected;}if(id==='companies-tab')loadLinks().catch(error=>status(error.message,true));}
  for(const [id] of tabs){$(id).addEventListener('click',()=>selectTab(id));$(id).addEventListener('keydown',event=>{if(['ArrowLeft','ArrowRight'].includes(event.key)){event.preventDefault();const other=tabs.find(([tab])=>tab!==id)[0];selectTab(other);$(other).focus();}});}
  const closeOptions=()=>document.querySelectorAll('.link-options:popover-open').forEach(menu=>menu.hidePopover());
  document.querySelector('.settings-content').addEventListener('scroll',closeOptions);addEventListener('resize',closeOptions);
  $('company-create-form').addEventListener('submit',async event=>{
    event.preventDefault();if(creating)return;const name=company();if(!name){$('company-name').focus();return;}
    const found=existing();if(found){try{await copy(found,$('company-links').querySelector(`[data-link-id="${found.id}"] .copy-company-link`));}catch(error){status(error.message,true);}return;}
    creating=true;updateCreate();
    try{await adapter.flush();const result=await adapter.request('create',{company:name});await loadLinks(result.link.id);company.reset();await copy(result.link,$('company-links').querySelector(`[data-link-id="${result.link.id}"] .copy-company-link`),result.token);}
    catch(error){status(error.message,true);}finally{creating=false;updateCreate();}
  });
  $('preview-sign-out').addEventListener('click',report(async()=>{await adapter.flush();await window.siblingSession.signOut();parent.postMessage({type:'marmullaku-signed-out'},location.origin);}));
  await Promise.all([loadLinks(),loadFamily()]);return {isGuest:false,refresh:()=>Promise.all([loadLinks(),loadFamily()]).catch(error=>status(error.message,true)),track(){}};
}
