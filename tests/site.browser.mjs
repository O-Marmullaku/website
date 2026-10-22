import assert from 'node:assert/strict';
const playwright=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const executablePath=process.env.CHROMIUM_EXECUTABLE||process.env.FIREFOX_EXECUTABLE;
const browser=await playwright[process.env.CHROMIUM_EXECUTABLE?'chromium':'firefox'].launch({headless:true,...(executablePath?{executablePath}:{})});
const base=process.env.TEST_BASE_URL||'http://localhost:8000';
const names=['Osman','Diellza','Drilona','Drenusha','Dredhza','Ali'];
const unsafeTitle='<img src=x onerror="alert(1)">';
const state={profiles:names.map(name=>({id:name.toLowerCase(),display_name:name+' Marmullaku',role:'Initial title',updated_at:'revision-0',cv:{
 contact:[['Synthetic contact','mailto:synthetic@example.invalid']],skills:[['Testing',50]],languages:[['English','Fluent']],profile:'Synthetic CV for browser checks.',
 experience:[{when:'2025',title:unsafeTitle,org:'Synthetic company A',points:['First contribution']},{when:'2024',title:'Second role',org:'Synthetic company B',points:['Second contribution']}],
 education:[{when:'2023',title:'Synthetic degree',org:'Synthetic school'}],certs:[],interests:'Reading',
}})),family:[],links:[],events:[],assets:[],cv_content_revision:'imported-cvs-v2',seeded_profiles:names.map(name=>name.toLowerCase())};
const {fromProfile}=await import('../main/profile-adapter.mjs');
const rows=fromProfile(state.profiles[0]).cvRows;
rows.experience.push({id:crypto.randomUUID(),title:'Self-employed Software Developer',href:'https://crazyentertainment.ch/',detail:'Synthetic studio',date:'2026',body:'Synthetic projects',logo:'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aPioAAAAASUVORK5CYII='});
state.profiles[0].cv.editor={rows};
function samplePDF(){
 const stream='BT /F1 12 Tf 20 140 Td (Synthetic supporting document) Tj ET';
 const objects=['<< /Type /Catalog /Pages 2 0 R >>','<< /Type /Pages /Kids [3 0 R] /Count 1 >>','<< /Type /Page /Parent 2 0 R /MediaBox [0 0 260 200] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>',`<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`,'<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>'];
 let pdf='%PDF-1.4\n';const offsets=[0];
 objects.forEach((object,index)=>{offsets.push(Buffer.byteLength(pdf));pdf+=`${index+1} 0 obj\n${object}\nendobj\n`;});
 const xref=Buffer.byteLength(pdf);
 pdf+=`xref\n0 6\n0000000000 65535 f \n${offsets.slice(1).map(offset=>String(offset).padStart(10,'0')+' 00000 n ').join('\n')}\ntrailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
 return Buffer.from(pdf);
}
try{
 for(const [path,width] of [['/',1920],['/mockup/',1920],['/',390],['/mockup/',390]]){
  if(process.env.TEST_WIDTH&&width!==Number(process.env.TEST_WIDTH))continue;
  const context=await browser.newContext({viewport:{width,height:1000}}),page=await context.newPage(),errors=[],external=[];
  try{
  page.on('pageerror',error=>errors.push(error.message));
  await context.addInitScript(seed=>{
   if(window!==top||localStorage.getItem('site-test-seeded'))return;
   for(const key of ['marmullaku-local-profiles-v1','marmullaku-site-preview-v1'])localStorage.setItem(key,JSON.stringify(seed));
   localStorage.setItem('marmullaku-site-preview-live-sync-v1','true');localStorage.setItem('site-test-seeded','true');localStorage.setItem('lang','en');
  },state);
  await page.route('**/*',route=>{
   const url=new URL(route.request().url());
   if(url.pathname==='/work/testing-profiles.json')return route.fulfill({contentType:'application/json',body:'[]'});
   if(url.origin===new URL(base).origin)return route.continue();
   if(!['fonts.googleapis.com','fonts.gstatic.com'].includes(url.hostname))external.push(url.href);
   return route.abort();
  });
  let releaseStyle,styleReleased=false,earlyEditor=false;
  const styleGate=new Promise(resolve=>{releaseStyle=()=>{styleReleased=true;resolve();};});
  await page.route('**/profile/editor.css*',async route=>{await styleGate;await route.continue();});
  page.on('request',request=>{if(new URL(request.url()).pathname==='/profile/editor.js'&&!styleReleased)earlyEditor=true;});
  await page.goto(base+path);
  for(const [language,label] of [['DE','Lebenslauf ansehen'],['FR','Voir le CV'],['ไทย','ดูประวัติ'],['中文','查看简历'],['EN','View résumé']]){
   await page.getByRole('button',{name:language,exact:true}).click();
   assert.equal(await page.locator('.cta [data-i18n="view"]').first().textContent(),label);
  }
  await page.getByRole('button',{name:'Osman Marmullaku',exact:true}).click();
  await page.waitForTimeout(150);releaseStyle();
  await page.locator('.profile-window[data-motion="open"]').waitFor({state:'visible'});
  assert.equal(earlyEditor,false,'the editor must wait for its required stylesheets');
  let frame=page.frameLocator('.profile-window iframe');
  assert.equal(await frame.locator('#resume-name').textContent(),'Osman Marmullaku');
  assert.equal(await frame.locator('.cv-cell-title .cv-row-text').filter({hasText:unsafeTitle}).count(),1);
  assert.equal(await frame.locator('img[src="x"]').count(),0,'profile text must never become executable markup');
  await frame.getByRole('button',{name:'View Crazy Entertainment projects',exact:true}).click();
  await frame.locator('.cv-project-panel').waitFor({state:'visible'});
  await frame.getByRole('button',{name:'Close projects',exact:true}).click();
  await frame.locator('.cv-project-panel').waitFor({state:'hidden'});
  assert.equal(await page.locator('.profile-window[open] iframe').count(),1,'projects keep the CV open');
  await frame.locator('[data-cv-view="edit"]').click();
  const title=frame.locator('.paper-header [data-value="role"]');
  await title.click();await title.fill('Updated title');await title.press('Enter');
  let liveFrame=page.frames().find(frame=>new URL(frame.url()).pathname==='/profile/');
  await liveFrame.evaluate(()=>{
   const flush=window.flushProfile;
   window.flushProfile=async()=>{await new Promise(resolve=>{window.releaseClose=resolve;});return flush();};
  });
  await frame.getByRole('button',{name:'Close CV',exact:true}).click();
  await liveFrame.waitForFunction(()=>typeof window.releaseClose==='function');
  await page.keyboard.press('Escape');await page.keyboard.press('Escape');
  assert.equal(await page.locator('.profile-window[open] iframe').count(),1,'repeated Escape cannot remove a frame while its draft is settling');
  await frame.locator('#resume[open]').waitFor({state:'visible'});
  await liveFrame.evaluate(()=>window.releaseClose());
  await page.locator('.profile-window iframe').waitFor({state:'detached'});
  const key=path==='/'?'marmullaku-local-profiles-v1':'marmullaku-site-preview-v1';
  assert.equal(await page.evaluate(key=>JSON.parse(localStorage.getItem(key)).profiles[0].role,key),'Updated title','closing flushes pending edits');
  await page.getByRole('button',{name:'DE',exact:true}).click();assert.equal(await page.locator('.role[data-i18n="osman"]').textContent(),'Updated title');
  await page.getByRole('button',{name:'EN',exact:true}).click();
  await page.getByRole('button',{name:'Osman Marmullaku',exact:true}).click();
  await page.locator('.profile-window[data-motion="open"]').waitFor({state:'visible'});frame=page.frameLocator('.profile-window iframe');
  await frame.locator('[data-cv-view="edit"]').click();
  liveFrame=page.frames().find(frame=>new URL(frame.url()).pathname==='/profile/');
  await liveFrame.evaluate(()=>{
   const read=FileReader.prototype.readAsDataURL;
   FileReader.prototype.readAsDataURL=function(blob){
    if(blob.type==='application/pdf'&&!window.heldPDF){window.heldPDF=true;window.releasePDF=()=>read.call(this,blob);}
    else read.call(this,blob);
   };
  });
  const rows=frame.locator('[data-section="experience"] .cv-row'),ids=await rows.evaluateAll(rows=>rows.map(row=>row.dataset.rowId));
  for(const [index,name] of ['first.pdf','second.pdf'].entries()){
   await rows.nth(index).hover();
   await rows.nth(index).locator('summary').click();
   const chooser=page.waitForEvent('filechooser');await rows.nth(index).getByRole('button',{name:'Attach PDF',exact:true}).click();
   await (await chooser).setFiles({name,mimeType:'application/pdf',buffer:samplePDF()});
   if(index===0)await liveFrame.waitForFunction(()=>typeof window.releasePDF==='function');
  }
  await page.waitForFunction(key=>JSON.parse(localStorage.getItem(key)).profiles[0].cv.editor?.documents.some(doc=>doc.name==='second.pdf'),key);
  await frame.getByRole('button',{name:'Close CV',exact:true}).click();
  await page.waitForFunction(()=>document.querySelector('iframe')?.inert);
  assert.equal(await page.locator('.profile-window[open] iframe').count(),1,'closing waits for uploads before saving the draft');
  await liveFrame.evaluate(()=>window.releasePDF());
  await page.locator('.profile-window iframe').waitFor({state:'detached'});
  const documents=await page.evaluate(key=>JSON.parse(localStorage.getItem(key)).profiles[0].cv.editor.documents,key);
  for(const [index,name] of ['first.pdf','second.pdf'].entries())assert.equal(documents.find(doc=>doc.name===name).anchor?.rowId,ids[index],'concurrent uploads retain the row chosen for each file');
  await page.getByRole('button',{name:'Osman Marmullaku',exact:true}).click();await page.locator('.profile-window[data-motion="open"]').waitFor({state:'visible'});
  frame=page.frameLocator('.profile-window iframe');
  if(width===390){await frame.locator('.cv-document-card').first().hover();assert.equal(await frame.locator('.cv-document-hint').isVisible(),false,'phone-width hints do not cover neighboring attachments');}
  await frame.getByRole('button',{name:'Open first.pdf',exact:true}).click();
  await frame.locator('#document-reader canvas').waitFor({state:'visible'});
  await page.waitForFunction(()=>document.querySelector('iframe').contentDocument.querySelector('#document-text').textContent.includes('Synthetic supporting document'));
  await frame.getByRole('button',{name:'Close supporting document',exact:true}).click();
  await frame.locator('#document-reader').waitFor({state:'hidden'});
  await frame.getByRole('button',{name:'Close CV',exact:true}).click();await page.locator('.profile-window iframe').waitFor({state:'detached'});
  for(const name of names.slice(1)){
   await page.getByRole('button',{name:name+' Marmullaku',exact:true}).click();await page.locator('.profile-window[data-motion="open"]').waitFor({state:'visible'});
   frame=page.frameLocator('.profile-window iframe');
   assert(await frame.locator('.cv-portrait').evaluate(img=>img.complete&&img.naturalWidth>0),name+' has a usable portrait');
   await frame.getByRole('button',{name:'Close CV',exact:true}).click();await page.locator('.profile-window iframe').waitFor({state:'detached'});
  }
  assert.deepEqual(errors,[]);assert.deepEqual(external,[],'sample flows never contact the real backend');
  console.log(`PASS ${path} ${width}: stylesheet readiness, safe text, editing, role sync, upload race, PDF persistence and all profiles`);
  }catch(error){
   console.error(JSON.stringify({path,width,errors,body:await page.locator('body').innerText(),frames:page.frames().map(frame=>frame.url())}));
   await page.screenshot({path:'work/site-browser-failure.png'});throw error;
  }finally{await context.close();}
 }
}finally{await browser.close();}
