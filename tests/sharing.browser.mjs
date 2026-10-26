// Local synthetic settings UAT; no accounts, invitations or messages leave this browser.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const playwright=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const executablePath=process.env.CHROMIUM_EXECUTABLE||process.env.FIREFOX_EXECUTABLE;
const browser=await playwright[process.env.CHROMIUM_EXECUTABLE?'chromium':'firefox'].launch({headless:true,...(executablePath?{executablePath}:{})});
const base=process.env.TEST_BASE_URL||'http://localhost:8000';
const template=(await readFile(new URL('../profile/editor.html',import.meta.url),'utf8')).replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,'').replace('<html lang="en">','<html lang="en" data-live="true">').replace('<head>',`<head><base href="${base}/profile/">`);
const homepage=(await readFile(new URL('../index.html',import.meta.url),'utf8')).replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,'').replace('<head>',`<head><base href="${base}/">`);
try{
 for(const [width,height] of [[320,568],[390,844],[844,390],[1280,720]]){
  const context=await browser.newContext({viewport:{width,height}}),page=await context.newPage(),errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  await page.route('**/*',route=>new URL(route.request().url()).origin===new URL(base).origin?route.continue():route.abort());
  await page.goto(base+'/robots.txt');await page.setContent(template);
  await page.addStyleTag({url:base+'/main/profile-live.css'});
  await page.evaluate(async base=>{
   const {createLiveSharing}=await import(base+'/main/live-sharing.mjs');
   const state=window.fixture={fail:true,links:[],family:[],calls:[]};
   let release;const gate=new Promise(resolve=>{release=resolve;});state.release=release;
   const profiles=[{id:'osman',display_name:'Synthetic owner'},{id:'diellza',display_name:'Synthetic sibling'}];
   const adapter={editable:true,profile:profiles[0],flush:async()=>{},async request(action,data){
    state.calls.push(action);
    if(action==='links'&&state.blockNext){
     state.blockNext=false;state.blocked=true;
     const snapshot={links:structuredClone(state.links),events:[]};
     await new Promise(resolve=>state.releaseRefresh=resolve);state.blocked=false;return snapshot;
    }
    if(action==='links'||action==='family'){
     await gate;if(state.fail)throw new Error('Sharing unavailable. Try again.');
     return action==='links'?{links:state.links,events:[]}:{profiles,family:state.family};
    }
    if(action==='create'){state.links.push({id:'synthetic-link',company:data.company,created_at:new Date().toISOString(),revoked:false});return {token:'S'.repeat(43)};}
    if(action==='copy-link')return {token:'S'.repeat(43)};
    if(action==='toggle-link'){state.links.find(link=>link.id===data.id).revoked=data.revoked;return {};}
    if(action==='share-family'){state.family=data.enabled?[{recipient_id:data.recipient_id,enabled:true}]:[];return {};}
    throw new Error('Unexpected test action '+action);
   }};
   window.MARMULLAKU_LOCAL_PREVIEW=true;
   // This must resolve while optional sharing requests remain blocked.
   state.sharing=await createLiveSharing(adapter,async()=>true);state.ready=true;
   document.querySelector('#settings-panel').showModal();
  },base);
  assert(await page.evaluate(()=>window.fixture.ready),'sharing metadata must not block CV boot');
  await page.evaluate(()=>window.fixture.release());await page.getByText('Sharing unavailable. Try again.',{exact:true}).waitFor();
  await page.evaluate(()=>window.fixture.fail=false);
  await page.getByRole('tab',{name:'Company links',exact:true}).click();
  await page.getByText('No links yet.',{exact:true}).waitFor();
  await page.getByRole('button',{name:'Create link',exact:true}).click();
  assert.equal(await page.locator('#settings-status').innerText(),'Enter a company name.');
  assert(await page.locator('#company-name').evaluate(el=>el===document.activeElement));
  await page.locator('#company-name').fill('Synthetic company');
  await page.getByRole('button',{name:'Create link',exact:true}).click();
  await page.getByRole('button',{name:'Turn off',exact:true}).waitFor();
  assert((await page.locator('#created-link').inputValue()).includes('?local=1#invite='));
  await page.evaluate(()=>{window.fixture.blockNext=true;window.fixture.sharing.refresh();});
  await page.waitForFunction(()=>window.fixture.blocked);
  await page.getByRole('button',{name:'Turn off',exact:true}).focus();await page.keyboard.press('Enter');
  await page.waitForFunction(()=>window.fixture.calls.includes('toggle-link'));
  await page.evaluate(()=>window.fixture.releaseRefresh());
  await page.getByRole('button',{name:'Turn on',exact:true}).waitFor();
  assert(await page.getByRole('button',{name:'Turn on',exact:true}).evaluate(el=>el===document.activeElement),'refresh retains focus on the updated link action: '+await page.evaluate(()=>document.activeElement.outerHTML.slice(0,600)));
  await page.keyboard.press('Enter');await page.getByRole('button',{name:'Turn off',exact:true}).waitFor();
  await page.evaluate(()=>{window.fixture.blockNext=true;window.fixture.sharing.refresh();});
  await page.waitForFunction(()=>window.fixture.blocked);
  await page.getByRole('button',{name:'Create link',exact:true}).click();
  assert(await page.locator('#create-link').isDisabled(),'creation waits for in-flight metadata');
  await page.evaluate(()=>window.fixture.releaseRefresh());
  await page.waitForFunction(()=>window.fixture.calls.includes('copy-link'));
  assert.equal(await page.evaluate(()=>window.fixture.calls.filter(action=>action==='create').length),1,'a create during refresh copies the existing company link');
  await page.getByRole('tab',{name:'Family',exact:true}).click();
  const share=page.getByRole('checkbox',{name:'Let Synthetic sibling view and share my CV',exact:true});
  await share.check();await page.getByText('Family access saved.',{exact:true}).waitFor();assert.equal(await page.evaluate(()=>window.fixture.family.length),1);
  await share.uncheck();assert.equal(await page.evaluate(()=>window.fixture.family.length),0);
  await page.getByRole('tab',{name:'Family',exact:true}).press('ArrowLeft');
  assert.equal(await page.getByRole('tab',{name:'Company links',exact:true}).getAttribute('aria-selected'),'true');
  assert(await page.locator('#settings-panel').evaluate(el=>el.scrollWidth<=el.clientWidth),'settings must not overflow horizontally');
  await page.screenshot({path:`work/uat-sharing-${width}.png`});
  await page.locator('#company-name').focus();
  await page.locator('#company-suggestions').waitFor({state:'visible'});
  await page.keyboard.press('Escape');
  assert(await page.locator('#settings-panel').isVisible(),'first Escape dismisses company suggestions');
  await page.keyboard.press('Escape');
  await page.locator('#settings-panel').waitFor({state:'hidden'});
  console.log(`PASS sharing ${width}x${height}: non-blocking load, retry, validation, create, toggle/focus, family sharing, keyboard tabs, overflow`);
  await page.setContent(homepage);
  await page.evaluate(()=>{
   window.authFixture={calls:[],signedIn:0};
   window.siblingSession={active:false,
    async signIn(email,password){window.authFixture.calls.push('sign-in');if(password==='wrong-password')throw new Error('Incorrect email or password.');},
    async sendCode(){window.authFixture.calls.push('send-code');},
    async verify(email,code){window.authFixture.calls.push('verify');if(code!=='123456')throw new Error('Incorrect code. Try again.');},
    async setPassword(){window.authFixture.calls.push('set-password');}
   };
   addEventListener('marmullaku-signed-in',()=>window.authFixture.signedIn++);
  });
  await page.addScriptTag({url:base+'/main/sign-in.js'});
  await page.locator('#sign-in-trigger').click();
  await page.locator('#sign-in-email').fill('synthetic@example.invalid');await page.locator('#sign-in-password').fill('wrong-password');
  await page.getByRole('button',{name:'Show password',exact:true}).click();assert.equal(await page.locator('#sign-in-password').getAttribute('type'),'text');
  await page.locator('#sign-in-submit').click();await page.getByText('Incorrect email or password.',{exact:true}).waitFor();
  assert(await page.locator('#sign-in-submit').isEnabled());
  await page.getByRole('button',{name:'Set up or reset password',exact:true}).click();
  await page.locator('#sign-in-submit').click();await page.getByRole('heading',{name:'Check your email',exact:true}).waitFor();
  await page.getByRole('button',{name:'Change email',exact:true}).click();assert.equal(await page.locator('#sign-in-email').inputValue(),'synthetic@example.invalid');
  await page.locator('#sign-in-submit').click();await page.locator('#sign-in-code').fill('000000');await page.locator('#sign-in-submit').click();await page.getByText('Incorrect code. Try again.',{exact:true}).waitFor();
  await page.locator('#sign-in-code').fill('123456');await page.locator('#sign-in-submit').click();await page.getByRole('button',{name:'Save password',exact:true}).waitFor();
  await page.locator('#sign-in-password').fill('short');await page.locator('#sign-in-submit').click();
  assert.equal(await page.evaluate(()=>window.authFixture.calls.includes('set-password')),false,'native length validation prevents short password submission');
  await page.locator('#sign-in-password').fill('synthetic-test-password');
  assert(await page.locator('#sign-in-dialog').evaluate(el=>el.scrollWidth<=el.clientWidth),'sign-in fits narrow screens');
  await page.screenshot({path:`work/uat-sign-in-${width}.png`});
  await page.locator('#sign-in-submit').click();await page.locator('#sign-in-dialog').waitFor({state:'hidden'});
  assert.equal(await page.evaluate(()=>window.authFixture.signedIn),1);
  assert.equal(await page.locator('#sign-in-password').inputValue(),'','closing clears the password');
  assert(await page.locator('#sign-in-trigger').evaluate(el=>el===document.activeElement),'sign-in returns focus to its trigger');
  assert.deepEqual(errors,[]);console.log(`PASS sign-in ${width}x${height}: password visibility, failure/retry, change email, code verification, password validation, completion and focus`);
  await context.close();
 }
}finally{await browser.close();}
