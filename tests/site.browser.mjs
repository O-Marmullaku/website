import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
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
function samplePDF(pageCount=1){
 const stream='BT /F1 12 Tf 50 770 Td (Synthetic supporting document) Tj ET';
 const pages=Array.from({length:pageCount},(_,index)=>index+3),content=pageCount+3,font=pageCount+4;
 const objects=['<< /Type /Catalog /Pages 2 0 R >>',`<< /Type /Pages /Kids [${pages.map(id=>`${id} 0 R`).join(' ')}] /Count ${pageCount} >>`,...pages.map(()=>`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 ${font} 0 R >> >> /Contents ${content} 0 R >>`),`<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`,'<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>'];
 let pdf='%PDF-1.4\n';const offsets=[0];
 objects.forEach((object,index)=>{offsets.push(Buffer.byteLength(pdf));pdf+=`${index+1} 0 obj\n${object}\nendobj\n`;});
 const xref=Buffer.byteLength(pdf);
 pdf+=`xref\n0 ${objects.length+1}\n0000000000 65535 f \n${offsets.slice(1).map(offset=>String(offset).padStart(10,'0')+' 00000 n ').join('\n')}\ntrailer\n<< /Size ${objects.length+1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
 return Buffer.from(pdf);
}
try{
 for(const [path,width] of [['/',1920],['/mockup/',1920],['/',1280],['/',390],['/mockup/',390]]){
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
  assert.equal(await frame.locator('.cv-extras-tool').textContent(),'Links & documents');
  assert(await frame.locator('.resume-toolbar').evaluate(el=>{const box=el.getBoundingClientRect();return getComputedStyle(el).position==='fixed'&&box.top>=0&&box.right<=innerWidth;}),'CV actions float in the screen corner, independently of the paper');
  assert(await frame.locator('.resume-toolbar').evaluate(el=>{const light='rgb(238, 242, 246)',round=[...el.querySelectorAll('.cv-download,[data-close=resume]')].every(button=>{const box=button.getBoundingClientRect(),style=getComputedStyle(button);return Math.round(box.width)===44&&Math.round(box.height)===44&&style.borderRadius==='50%'&&style.backgroundColor===light;});return round&&getComputedStyle(el.querySelector('.cv-extras-tool')).backgroundColor===light&&!el.querySelector('.cv-download>span').getClientRects().length&&getComputedStyle(el).backgroundColor==='rgba(0, 0, 0, 0)';}),'CV actions are compact light controls: one filled text button and round icon buttons, without a dark tray');
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
   await (await chooser).setFiles({name,mimeType:'application/pdf',buffer:samplePDF(index+1)});
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
  const pdfTrigger=frame.locator('.paper').getByRole('button',{name:'Open first.pdf',exact:true});
  await pdfTrigger.scrollIntoViewIfNeeded();
  const resumeScroll=await frame.locator('#resume').evaluate(el=>el.scrollTop);
  const paperLeft=await frame.locator('.paper').first().evaluate(el=>el.getBoundingClientRect().left);
  await pdfTrigger.click();
  await frame.locator('#document-reader .document-pages canvas').waitFor({state:'visible'});
  await page.waitForFunction(()=>document.querySelector('iframe').contentDocument.querySelector('#document-text').textContent.includes('Synthetic supporting document'));
  const reader=frame.locator('#document-reader'),canvas=reader.locator('.document-pages canvas');
  const pdfFrame=page.frames().find(frame=>new URL(frame.url()).pathname==='/profile/');
  assert.equal(await reader.locator('.document-pages').evaluate(el=>el.scrollTop),0,'opening starts at the top even when toolbar resize cancels the first render');
  await reader.evaluate(async el=>{await Promise.allSettled(el.getAnimations().map(animation=>animation.finished));});
  assert(await reader.evaluate(el=>{const box=el.getBoundingClientRect(),sheet=el.querySelector('.document-sheet').getBoundingClientRect();return innerWidth<=680?box.left===0&&box.top===0&&box.width===innerWidth&&box.height===innerHeight:getComputedStyle(el).backgroundColor==='rgba(0, 0, 0, 0)'&&box.left>0&&sheet.top>0&&sheet.top<=16&&innerWidth-sheet.right>0&&innerWidth-sheet.right<=16&&sheet.bottom<=innerHeight;}),'the PDF sheet sits in the upper right of a transparent sidebar and fills phone screens');
  assert.equal(await frame.locator('.paper').first().evaluate(el=>el.getBoundingClientRect().left),paperLeft,'opening a PDF never shifts the CV sideways');
  assert(await frame.locator('.resume-toolbar').evaluate(el=>el.inert&&getComputedStyle(el).visibility==='hidden'),'CV actions step behind the document while it is open');
  await pdfFrame.waitForFunction(()=>{const alpha=Number(/([\d.]+)\)$/.exec(getComputedStyle(document.querySelector('#resume'),'::after').backgroundColor)?.[1]);return alpha>=.15&&alpha<=.4;});
  assert(await pdfFrame.evaluate(()=>{const dim=getComputedStyle(document.querySelector('#resume'),'::after'),paper=document.querySelector('.paper').getBoundingClientRect(),hit=innerWidth<=680||document.elementFromPoint(paper.left+20,innerHeight/2)?.closest('.paper');return dim.pointerEvents==='none'&&Number(dim.zIndex)<Number(getComputedStyle(document.querySelector('#document-reader')).zIndex)&&!!hit&&!document.querySelector('.paper').inert;}),'a light shade dims the CV behind the PDF without taking its clicks or focus');
  assert.equal(await reader.getByRole('link',{name:'Download PDF',exact:true}).isVisible(),true);
  assert.notEqual(await reader.getAttribute('aria-modal'),'true');
  assert.equal(await canvas.getAttribute('role'),'img');assert.equal(await canvas.getAttribute('tabindex'),'0','the click magnifier is keyboard accessible');
  assert(await canvas.evaluate(el=>el.width>=el.getBoundingClientRect().width*2),'small print renders at least two bitmap pixels per displayed pixel');
  assert(await reader.evaluate(el=>{const sheet=el.querySelector('.document-sheet'),surface=sheet.getBoundingClientRect(),header=sheet.querySelector('header').getBoundingClientRect(),pages=sheet.querySelector('.document-pages').getBoundingClientRect(),page=sheet.querySelector('.document-pages>canvas').getBoundingClientRect();return getComputedStyle(sheet).backgroundColor!=='rgba(0, 0, 0, 0)'&&Math.abs(header.left-pages.left)<1&&Math.abs(header.right-pages.right)<1&&Math.abs(header.bottom-pages.top)<1&&page.left-pages.left>=8&&pages.right-page.right>=8&&page.top-pages.top>=8&&surface.bottom-page.bottom<=32;}),'the header and page share one continuous sheet that hugs the document instead of a full-height slab');
  await canvas.hover();
  await page.waitForTimeout(100);
  assert.equal(await reader.locator('.pdf-hover-lens:popover-open').count(),0,'hovering alone never enables magnification');
  await canvas.click();
  assert.equal(await frame.locator('.image-magnifier.is-visible').count(),0,'clicking the PDF cannot open the blurry image lens');
  const lens=reader.locator('.pdf-hover-lens:popover-open');await lens.waitFor({state:'visible'});
  assert(await lens.evaluate(el=>{const page=document.querySelector('#document-reader .document-pages canvas').getBoundingClientRect(),box=el.getBoundingClientRect();return Math.abs(box.x+box.width/2-page.x-page.width/2)<3;}),'the lens stays centered on the cursor instead of flipping sideways');
  assert(await lens.evaluate(el=>el.getAnimations().some(animation=>animation.effect.getKeyframes().at(-1).opacity==='1'&&animation.effect.getTiming().duration>=200)),'clicking fades the lens in');
  assert(await lens.evaluate(el=>el.width>=el.clientWidth*2&&el.height>=el.clientHeight*2),'magnified detail is rendered directly at high resolution');
  assert(await lens.evaluate(el=>el.clientWidth>el.clientHeight&&el.getBoundingClientRect().left>=0&&el.getBoundingClientRect().right<=innerWidth),'the wider reading lens stays inside the viewport');
  assert(await lens.evaluate(el=>el.getBoundingClientRect().top>=document.querySelector('#document-reader header').getBoundingClientRect().bottom),'the reading lens cannot obscure the document controls');
  assert(await pdfFrame.evaluate(()=>{document.querySelector('#document-reader .document-pages canvas').dispatchEvent(new PointerEvent('pointerleave'));return document.querySelector('.pdf-hover-lens').getAnimations().some(animation=>animation.effect.getKeyframes().at(-1).opacity==='0'&&animation.effect.getTiming().duration>=180);}),'leaving the page fades out before hiding the lens');
  await reader.getByRole('button',{name:'Zoom in',exact:true}).hover();await lens.waitFor({state:'hidden'});
  await canvas.press('Enter');await lens.waitFor({state:'visible'});
  await canvas.press('Escape');await lens.waitFor({state:'hidden'});
  assert.equal(await reader.isVisible(),true,'Escape dismisses an active lens before closing the PDF');
  await canvas.click();await lens.waitFor({state:'visible'});
  await canvas.click();await lens.waitFor({state:'hidden'});
  assert.equal(await reader.locator('select').count(),0,'zoom has direct controls instead of a percentage dropdown');
  assert.equal(await reader.locator('.document-pagination').isVisible(),true,'the page count and navigation remain discoverable for every PDF');
  assert.equal(await reader.locator('#document-page').textContent(),'1 / 1');
  assert.equal(await reader.getByRole('button',{name:'Next PDF page',exact:true}).isEnabled(),false,'a single-page PDF visibly disables Next');
  assert.equal(await reader.locator('[target="_blank"]').count(),0,'the title bar expands the reader instead of opening a tab');
  assert(await reader.evaluate(el=>{const controls=el.querySelector('.document-controls').getBoundingClientRect(),pages=el.querySelector('.document-pages').getBoundingClientRect();return controls.bottom<=pages.top&&Math.abs(pages.bottom-el.querySelector('.document-sheet').getBoundingClientRect().bottom)<2;}),'controls stay above the document and leave no bottom toolbar');
  assert(await reader.evaluate(el=>{const bar=el.querySelector('header'),header=bar.getBoundingClientRect(),controls=[...el.querySelectorAll('header :is(button,a[href])')].filter(control=>control.getClientRects().length).map(control=>control.getBoundingClientRect());return bar.scrollWidth<=bar.clientWidth&&el.querySelector('h2').getBoundingClientRect().width>=120&&controls.every(box=>box.left>=header.left&&box.right<=header.right&&box.top>=header.top&&box.bottom<=header.bottom&&box.width>=(innerWidth<=680?44:32));}),'the title stays legible and every reader control fits inside the bar at full size, without sideways scrolling');
  assert(await reader.evaluate(el=>{const middle=part=>{const box=el.querySelector(part).getBoundingClientRect();return box.top+box.height/2;},title=middle('h2'),controls=middle('.document-pagination');return Math.abs(middle('.document-actions')-title)<2&&Math.abs(middle('.document-view')-controls)<2&&(Math.abs(controls-title)<2||controls>title)&&(innerWidth<1900||Math.abs(controls-title)<2);}),'the title shares its line with the window actions; page and view controls share one aligned line, beside the title on wide readers');
  const pixels=await canvas.evaluate(el=>el.width),percentage=Number.parseInt(await reader.locator('#document-zoom').textContent());
  await frame.getByRole('button',{name:'Zoom in',exact:true}).click();
  await pdfFrame.waitForFunction(pixels=>document.querySelector('#document-reader .document-pages canvas').width>pixels,pixels);
  assert(Number.parseInt(await reader.locator('#document-zoom').textContent())>percentage,'zoom reports the rendered scale');
  assert(await canvas.evaluate(el=>el.width>=el.getBoundingClientRect().width*2),'zoom renders fresh detail at the larger size');
  for(const label of ['Fit page','Fit width','Fit page']){
   await reader.getByRole('button',{name:label,exact:true}).click();
   await pdfFrame.waitForFunction(label=>document.querySelector('#document-fit').getAttribute('aria-label')!==label,label);
  }
  if(width>680){
   const sideWidth=await reader.evaluate(el=>el.getBoundingClientRect().width);
   await reader.getByRole('button',{name:'Maximize PDF',exact:true}).click();
   await pdfFrame.waitForFunction(()=>{const reader=document.querySelector('#document-reader'),box=reader.getBoundingClientRect();return box.left===0&&box.top===0&&box.width===innerWidth&&box.height===innerHeight;});
   assert(await reader.evaluate((el,width)=>el.getBoundingClientRect().width>width,sideWidth),'maximize expands the document inside this page');
   assert(await reader.evaluate(el=>[...el.parentElement.children].filter(sibling=>sibling!==el).every(sibling=>sibling.inert)),'the covered CV cannot receive keyboard focus');
   await reader.locator('#document-fit').press('Tab');
   assert(await reader.evaluate(el=>el.contains(document.activeElement)),'Tab remains inside the maximized reader');
   await reader.locator('#document-zoom-out').press('Shift+Tab');
   assert(await canvas.evaluate(el=>el===document.activeElement),'Shift+Tab wraps back to the keyboard-accessible PDF page');
   await reader.getByRole('button',{name:'Restore PDF size',exact:true}).click();
   await pdfFrame.waitForFunction(width=>Math.abs(document.querySelector('#document-reader').getBoundingClientRect().width-width)<1,sideWidth);
   await reader.getByRole('button',{name:'Maximize PDF',exact:true}).click();
   await reader.getByRole('button',{name:'Restore PDF size',exact:true}).press('Escape');
   assert.equal(await reader.isVisible(),true,'Escape restores the side reader before closing it');
   assert.equal(await reader.getAttribute('aria-modal'),null);
  }
  await frame.getByRole('button',{name:'Close PDF',exact:true}).press('Escape');
  await reader.waitFor({state:'hidden'});
  await pdfFrame.waitForFunction(()=>Number(/([\d.]+)\)$/.exec(getComputedStyle(document.querySelector('#resume'),'::after').backgroundColor)?.[1])===0);
  assert.equal(await frame.locator('#resume[open]').count(),1,'Escape closes the PDF without closing the CV');
  await pdfFrame.waitForFunction(()=>document.activeElement?.getAttribute('aria-label')==='Open first.pdf');
  assert(await pdfTrigger.evaluate(el=>el===document.activeElement),'closing restores focus to the document link: '+await pdfFrame.evaluate(()=>document.activeElement.outerHTML.slice(0,500)));
  assert(Math.abs(await frame.locator('#resume').evaluate(el=>el.scrollTop)-resumeScroll)<2,'closing preserves the CV scroll position');
  await pdfTrigger.click();await canvas.waitFor({state:'visible'});
  await frame.getByRole('button',{name:'Close PDF',exact:true}).click();await reader.waitFor({state:'hidden'});
  await frame.locator('.paper').getByRole('button',{name:'Open second.pdf',exact:true}).click();
  await pdfFrame.waitForFunction(()=>document.querySelector('#document-page').textContent==='1 / 2'&&!document.querySelector('#document-reader .document-pages canvas').hidden);
  assert.equal(await reader.locator('.document-pagination').isVisible(),true,'documents with multiple pages retain navigation');
  assert.equal(await reader.getByRole('button',{name:'Next PDF page',exact:true}).locator('svg').isVisible(),true,'the next-page chevron stays visible in the compact bar');
  assert.equal(await reader.getByRole('button',{name:'Next PDF page',exact:true}).isEnabled(),true);
  await reader.getByRole('button',{name:'Next PDF page',exact:true}).click();
  await pdfFrame.waitForFunction(()=>document.querySelector('#document-reader .document-pages canvas').getAttribute('aria-label')==='Page 2 of 2');
  assert.equal(await reader.getByRole('button',{name:'Next PDF page',exact:true}).isEnabled(),false);
  await reader.getByRole('button',{name:'Previous PDF page',exact:true}).click();
  await pdfFrame.waitForFunction(()=>document.querySelector('#document-reader .document-pages canvas').getAttribute('aria-label')==='Page 1 of 2');
  await reader.getByRole('button',{name:'Close PDF',exact:true}).click();await reader.waitFor({state:'hidden'});
  await pdfFrame.evaluate(()=>{
   const request=window.siblingSession.request;
   window.siblingSession.request=async(...args)=>{
    const result=await request(...args);
    if(args[0]==='asset'){
     window.siblingSession.request=request;
     result.arrayBuffer=async()=>{throw new Error('Synthetic PDF read failure');};
    }
    return result;
   };
  });
  await pdfTrigger.click();
  const fallback=reader.locator('#document-download');
  await fallback.waitFor({state:'visible'});
  const downloading=page.waitForEvent('download');await fallback.click();
  const download=await downloading;
  assert.equal(download.suggestedFilename(),'first.pdf');
  assert.deepEqual(await readFile(await download.path()),samplePDF(),'render failures preserve the original PDF for recovery');
  await reader.getByRole('button',{name:'Close PDF',exact:true}).click();await reader.waitFor({state:'hidden'});
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
   console.error(JSON.stringify({path,width,errors,frames:await Promise.all(page.frames().map(async frame=>({url:frame.url(),body:await frame.locator('body').innerText({timeout:1000}).catch(()=>''),portrait:await frame.evaluate(()=>{const el=document.querySelector('.cv-portrait');return el?{complete:el.complete,width:el.naturalWidth}:null;}).catch(()=>null)})))}));
   await page.screenshot({path:'work/site-browser-failure.png'});throw error;
  }finally{await context.close();}
 }
}finally{await browser.close();}
