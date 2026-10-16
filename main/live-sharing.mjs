import { companyCombobox } from './company-search.mjs';
const $=id=>document.getElementById(id);
const node=(tag,text,cls)=>{const el=document.createElement(tag);el.textContent=text||'';if(cls)el.className=cls;return el;};
const stamp=value=>new Intl.DateTimeFormat(undefined,{dateStyle:'medium',timeStyle:'short'}).format(new Date(value));
export async function createLiveSharing(adapter,openResume) {
  if(!adapter.editable)return {isGuest:true,track:kind=>adapter.track(kind),refresh(){}};
  let links=[],events=[],refreshing=false;
  const status=message=>$('settings-status').textContent=message;
  status('');
  const company=companyCombobox($('company-name'),$('company-suggestions'),()=>links.map(link=>({name:link.company})));
  const url=token=>{const target=new URL((window.MARMULLAKU_MOCKUP?'../mockup/':'../')+'#invite='+token,location.href);if(window.MARMULLAKU_LOCAL_PREVIEW)target.searchParams.set('local','1');return target.href;};
  const report=operation=>async()=>{try{await operation();}catch(error){status(error.message);}};
  function showURL(value) {
    let output=$('created-link');
    if(!output){output=node('input');output.id='created-link';output.readOnly=true;output.setAttribute('aria-label','Private company link');$('create-link').closest('.sharing-actions').after(output);}
    output.value=value;output.select();
  }
  async function copy(link) {
    const result=await adapter.request('copy-link',{id:link.id}),value=url(result.token);
    try{await navigator.clipboard.writeText(value);status('Link copied.');}
    catch{showURL(value);status('Select and copy your link.');}
  }
  function paintLinks() {
    const host=$('company-links');const expanded=new Set([...host.querySelectorAll('details[open]')].map(el=>el.parentElement.dataset.linkId));host.replaceChildren();
    if(!links.length){host.append(node('p','No links yet.','links-empty'));return;}
    for(const link of links) {
      const expired=link.expires_at&&Date.parse(link.expires_at)<=Date.now(),unavailable=link.revoked||expired;
      const item=node('article','','shared-link');item.dataset.linkId=link.id;
      const heading=node('div','','shared-link-heading');heading.append(node('h4',link.company),node('span',expired?'Expired':link.revoked?'Off':'Active','link-state'));
      const history=events.filter(event=>event.link_id===link.id),visits=history.filter(event=>event.kind==='visit');
      item.append(heading,node('p','Created '+stamp(link.created_at),'link-meta'),node('p',visits.length?`${visits.length} ${visits.length===1?'open':'opens'} · Last opened ${stamp(visits[0].created_at)}`:'Not opened yet','link-counts'));
      const actions=node('div','','link-actions'),copyButton=node('button','Copy link','text-button'),open=node('button','Open link','text-button'),toggle=node('button',link.revoked?'Turn on':'Turn off','text-button');
      copyButton.disabled=open.disabled=!!unavailable;toggle.disabled=!!expired;
      copyButton.addEventListener('click',report(()=>copy(link)));
      open.addEventListener('click',()=>{
        const tab=window.open('about:blank','_blank');if(tab)tab.opener=null;
        adapter.request('copy-link',{id:link.id}).then(result=>{if(tab)tab.location.replace(url(result.token));else showURL(url(result.token));}).catch(error=>{tab?.close();status(error.message);});
      });
      toggle.addEventListener('click',report(async()=>{toggle.disabled=true;try{await adapter.request('toggle-link',{id:link.id,revoked:!link.revoked});await refresh();}finally{toggle.disabled=false;}}));
      actions.append(copyButton,open,toggle);item.append(actions);
      const activity=node('details','','link-activity');activity.open=expanded.has(link.id);activity.append(node('summary','Activity'));
      const list=node('ol');for(const event of history){const row=node('li');const time=node('time',stamp(event.created_at));time.dateTime=event.created_at;row.append(node('span',event.label),time);list.append(row);}
      activity.append(list);if(!history.length)activity.append(node('p','No activity yet.'));item.append(activity);host.append(item);
    }
  }
  async function refresh() {
    if(refreshing)return;refreshing=true;
    try {
      const [history,family]=await Promise.all([adapter.request('links'),adapter.request('family')]);links=history.links;events=history.events;paintLinks();
      $('sibling-permissions').replaceChildren();
      for(const person of family.profiles.filter(person=>person.id!==adapter.profile.id)) {
        const label=node('label','','family-share'),check=node('input');check.type='checkbox';check.checked=family.family.some(grant=>grant.recipient_id===person.id&&grant.enabled);
        check.setAttribute('aria-label',`Let ${person.display_name} view and share my CV`);label.append(node('span',person.display_name),check);
        check.addEventListener('change',report(async()=>{check.disabled=true;try{await adapter.request('share-family',{recipient_id:person.id,enabled:check.checked});status('Family access saved.');}catch(error){check.checked=!check.checked;throw error;}finally{check.disabled=false;}}));
        $('sibling-permissions').append(label);
      }
      $('family-panel').querySelector('.family-help').textContent='They can open your CV and include it in their company links. Turn this off to remove that access.';
    } finally{refreshing=false;}
  }
  const tabs=[['companies-tab','companies'],['family-tab','family-panel']];
  function selectTab(tab,panel){
    for(const [other,target] of tabs){const selected=other===tab;$(other).setAttribute('aria-selected',String(selected));$(other).tabIndex=selected?0:-1;$(target).hidden=target!==panel;}
    refresh().catch(error=>status(error.message));
  }
  for(const [tab,panel] of tabs){
    $(tab).tabIndex=$(tab).getAttribute('aria-selected')==='true'?0:-1;
    $(tab).addEventListener('click',()=>selectTab(tab,panel));
    $(tab).addEventListener('keydown',event=>{if(['ArrowLeft','ArrowRight','Home','End'].includes(event.key)){event.preventDefault();const next=event.key==='Home'?tabs[0]:event.key==='End'?tabs.at(-1):tabs.find(([id])=>id!==tab);selectTab(...next);$(next[0]).focus();}});
  }
  $('preview-company').hidden=true;
  $('create-link').addEventListener('click',report(async()=>{
    const name=company();if(!name){status('Enter a company name.');$('company-name').focus();return;}
    const existing=links.find(link=>!link.revoked&&(!link.expires_at||Date.parse(link.expires_at)>Date.now())&&link.company.toLowerCase()===name.toLowerCase());
    if(existing){await copy(existing);return;}
    const button=$('create-link');button.disabled=true;
    try{await adapter.flush();const result=await adapter.request('create',{company:name});showURL(url(result.token));status('Link created. Copy it below.');await refresh();}finally{button.disabled=false;}
  }));
  const signout=node('button','Sign out','text-button');
  signout.addEventListener('click',report(async()=>{await adapter.flush();await window.siblingSession.signOut();parent.postMessage({type:'marmullaku-signed-out'},location.origin);}));
  const archive=node('a','Family archive','text-button');archive.href='../admin/legacy.html';archive.target='_top';
  $('settings-panel').append(signout,archive);
  await refresh();return {isGuest:false,refresh:()=>refresh().catch(error=>status(error.message)),track(){}};
}
