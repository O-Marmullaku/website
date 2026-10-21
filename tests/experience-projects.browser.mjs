import assert from 'node:assert/strict';
const {firefox}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const browser=await firefox.launch({headless:true,...(process.env.FIREFOX_EXECUTABLE?{executablePath:process.env.FIREFOX_EXECUTABLE}:{})});
const base=process.env.TEST_BASE_URL||'http://localhost:8000';
try{
 const page=await browser.newPage({viewport:{width:1600,height:1000}});
 await page.goto(base+'/robots.txt');
 await page.setContent(`<html data-live="true"><head><base href="${base}/profile/"><link rel="stylesheet" href="${base}/profile/editor.css"><link rel="stylesheet" href="${base}/main/profile-live.css"><link rel="stylesheet" href="${base}/main/cv-paper.css"></head><body><dialog id="resume" open><div class="resume-workspace"><article class="paper" style="margin-top:200px"><section data-section="experience" style="padding:24px"><div class="cv-rows">
 <div class="cv-row cv-row-timeline"><div class="cv-cell-date">2025–present</div><div class="cv-row-content"><img class="cv-row-logo" src="${base}/main/pictures/projects/tableking.webp" alt="Studio logo"><div class="cv-cell-title"><a class="cv-row-text" href="https://crazyentertainment.ch/">Self-employed Software Developer</a></div><p>Crazy Entertainment Marmullaku</p><p>Develop and maintain web, mobile and desktop applications.</p></div></div>
 <div class="cv-row cv-row-timeline cv-document-card"><div class="cv-cell-date">2023–2024</div><div class="cv-row-content"><img class="cv-row-logo" src="${base}/main/pictures/projects/dump-to-txt.webp" alt="Company logo"><div class="cv-cell-title"><p class="cv-row-text">Software Developer</p></div><p>Siemens</p></div><div class="document-attachments"><button class="document-link" aria-label="Open Arbeitszeugnis Siemens"><span>Arbeitszeugnis Siemens</span></button></div></div>
 </div></section></article></div></dialog></body></html>`);
 await page.evaluate(async base=>{
  const {setupDocumentHints}=await import(base+'/profile/document-hints.mjs?v=experience-projects');
  const {setupExperienceProjects}=await import(base+'/profile/experience-projects.mjs');
  const {setupImageMagnifier}=await import(base+'/profile/image-magnifier.mjs');
  const root=document.querySelector('#resume');setupDocumentHints(root);window.projects=setupExperienceProjects(root);setupImageMagnifier();
 },base);
 const trigger=page.getByRole('button',{name:'View Crazy Entertainment projects',exact:true});
 const panel=page.locator('.cv-project-panel'),studio=page.locator('.cv-row').first();
 await trigger.locator('img').waitFor({state:'visible'});
 const positions=()=>page.locator('.cv-row').evaluateAll(rows=>rows.map(row=>row.getBoundingClientRect().toJSON()));
 const baseline=await positions();
 await studio.hover();await panel.waitFor({state:'visible'});
 assert.equal(await trigger.getAttribute('aria-expanded'),'true');
 assert.deepEqual(await positions(),baseline,'the logo flight must not move résumé text or page breaks');
 assert(await panel.evaluate(el=>el.getBoundingClientRect().left>document.querySelector('.cv-row').getBoundingClientRect().right),'desktop projects appear to the right');
 assert.equal(await trigger.locator('img').evaluate(el=>getComputedStyle(el).visibility),'hidden','the source logo gives way to the travelling logo');
 await page.waitForFunction(()=>[...document.querySelectorAll('.cv-project-panel img')].every(img=>img.complete&&img.naturalWidth));
 assert.equal(await panel.getByText('CoachLexy',{exact:true}).count(),1);
 assert.equal(await panel.getByRole('link',{name:'All projects',exact:true}).getAttribute('href'),'https://crazyentertainment.ch/#work');
 await panel.hover();await page.waitForTimeout(240);assert(await panel.isVisible(),'pointer can cross the gap into projects');
 await page.locator('.cv-document-card').hover();await page.locator('.cv-document-hint').waitFor({state:'visible'});
 assert.equal(await panel.isVisible(),false,'document and project hints do not compete');
 await trigger.focus();await panel.waitFor({state:'visible'});await trigger.press('Enter');
 assert(await panel.getByRole('link').first().evaluate(el=>el===document.activeElement),'keyboard activation enters the project links');
 await page.keyboard.press('Escape');await panel.waitFor({state:'hidden'});
 assert(await trigger.evaluate(el=>el===document.activeElement),'Escape returns focus to the project action');
 await page.mouse.move(0,0);
 await trigger.click();await panel.waitFor({state:'visible'});
 await panel.getByRole('button',{name:'Close projects',exact:true}).click();await panel.waitFor({state:'hidden'});
 assert.equal(await trigger.locator('img').evaluate(el=>getComputedStyle(el).visibility),'visible');
 await page.evaluate(()=>window.projects.sync());assert.equal(await trigger.count(),1,'repeated rendering does not duplicate actions');
 await page.setViewportSize({width:1200,height:900});await trigger.click();await panel.waitFor({state:'visible'});
 assert(await panel.evaluate(el=>el.scrollWidth<=el.clientWidth),'medium widths use the fallback instead of squeezing the project header');
 await page.setViewportSize({width:390,height:844});await trigger.click();await panel.waitFor({state:'visible'});
 assert(await panel.evaluate(el=>{const r=el.getBoundingClientRect();return r.left>=12&&r.right<=innerWidth-12&&r.top>=12&&r.bottom<=innerHeight-12&&el.scrollWidth<=el.clientWidth;}),'mobile panel fits the viewport without clipping');
 await page.evaluate(()=>dispatchEvent(new Event('beforeprint')));await panel.waitFor({state:'hidden'});
 await page.emulateMedia({media:'print'});
 assert.equal(await trigger.locator('img').evaluate(el=>getComputedStyle(el).visibility),'visible','print retains the studio logo');
 assert.equal(await trigger.evaluate(el=>getComputedStyle(el).display),'block','print retains the logo container');
 console.log('PASS: experience projects reveal, logo continuity, keyboard, mobile, document handoff and print');
}finally{await browser.close();}
