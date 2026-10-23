// Local rendering keeps uploaded documents off third-party services.
export function pdfScale(mode,width,height,natural) {
  const fitWidth=(width-32)/natural.width;
  return Math.max(.1,mode==='fit-page'?Math.min(fitWidth,(height-32)/natural.height):mode==='fit'?fitWidth:Number(mode));
}
export async function createPDFViewer(root) {
  const pdfjs = await import("../mockup/vendor/pdfjs/pdf.min.mjs");
  pdfjs.GlobalWorkerOptions.workerSrc = new URL(
    "../mockup/vendor/pdfjs/pdf.worker.min.mjs",
    import.meta.url,
  ).href;
  const canvas = root.querySelector("canvas");
  const viewport = root.querySelector(".document-pages");
  const sheet = viewport.parentElement;
  // The sheet hugs the page, so fitting measures the room the reader leaves for the page area, not the page area itself.
  const room = () => ({width:viewport.clientWidth,height:root.clientHeight-sheet.offsetHeight+viewport.clientHeight});
  const previous = root.querySelector("#document-previous");
  const next = root.querySelector("#document-next");
  const label = root.querySelector("#document-page");
  const zoom = root.querySelector("#document-zoom");
  const fit = root.querySelector("#document-fit");
  const status = root.querySelector("#document-status");
  const download = root.querySelector("#document-download");
  const lens=document.createElement('canvas');lens.className='pdf-hover-lens';lens.setAttribute('popover','manual');lens.setAttribute('aria-hidden','true');root.append(lens);
  let lensEnabled=false,hover=null,lensPage=null,lensTask=null,lensRevision=0,lensMotion=null,lensVisible=false;
  function dismissLens(){
    lensEnabled=false;hover=null;lensRevision++;lensTask?.cancel();
    if(!lensVisible)return;
    lensVisible=false;
    const opacity=getComputedStyle(lens).opacity;lensMotion?.cancel();
    const motion=lens.animate([{opacity},{opacity:0}],{duration:180,easing:'ease-out',fill:'forwards'});lensMotion=motion;
    motion.finished.then(()=>{if(lensMotion===motion&&!lensVisible){lens.hidePopover();motion.cancel();lensMotion=null;}}).catch(()=>{});
  }
  async function paintLens(){
    if(!hover||!lensPage||lensTask)return;
    const point=hover,current=lensRevision,width=Math.min(360,innerWidth-16),height=Math.min(260,innerHeight-16),magnification=1.6,density=Math.min(Math.max(devicePixelRatio||1,2),3);
    const pending=document.createElement('canvas');pending.width=width*density;pending.height=height*density;
    const task=lensPage.render({canvas:pending,viewport:lensPage.getViewport({scale:renderedScale*magnification}),transform:[density,0,0,density,density*(width/2-point.x*magnification),density*(height/2-point.y*magnification)]});
    lensTask=task;
    try{
      await task.promise;
      if(current!==lensRevision||!hover)return;
      lens.width=pending.width;lens.height=pending.height;lens.getContext('2d').drawImage(pending,0,0);
      if(!lensVisible){
        const opacity=lens.matches(':popover-open')?getComputedStyle(lens).opacity:0;
        lensMotion?.cancel();
        if(!lens.matches(':popover-open'))lens.showPopover();
        lensVisible=true;
        lensMotion=lens.animate([{opacity},{opacity:1}],{duration:220,easing:'ease-out',fill:'forwards'});
        lensMotion.finished.catch(()=>{});
      }
    }catch(error){if(error.name!=='RenderingCancelledException')dismissLens();}
    finally{if(lensTask===task)lensTask=null;if(hover&&hover!==point)paintLens();}
  }
  function positionLens(event){
    if(!lensEnabled||!lensPage)return;
    const box=canvas.getBoundingClientRect();hover={x:event.clientX-box.left,y:event.clientY-box.top};
    const width=Math.min(360,innerWidth-16),height=Math.min(260,innerHeight-16);
    lens.style.left=`${Math.max(8,Math.min(innerWidth-width-8,event.clientX-width/2))}px`;
    const toolbarBottom=root.querySelector('header').getBoundingClientRect().bottom;
    lens.style.top=`${Math.max(toolbarBottom+8,Math.min(innerHeight-height-8,event.clientY-height/2))}px`;
    paintLens();
  }
  function toggleLens(event){
    if(lensEnabled){dismissLens();return;}
    lensEnabled=true;positionLens(event);
  }
  canvas.tabIndex=0;
  canvas.title='Click to magnify';
  canvas.setAttribute('aria-description','Click or press Enter to magnify. Click again or press Escape to dismiss.');
  canvas.addEventListener('click',toggleLens);
  canvas.addEventListener('pointermove',positionLens);
  canvas.addEventListener('keydown',event=>{
    if(event.key!=='Enter'&&event.key!==' ')return;
    event.preventDefault();
    const box=canvas.getBoundingClientRect();toggleLens({clientX:box.x+box.width/2,clientY:box.y+box.height/2});
  });
  canvas.addEventListener('pointerleave',event=>{if(event.pointerType!=='touch')dismissLens();});
  viewport.addEventListener('scroll',dismissLens);
  window.addEventListener('resize',dismissLens);
  root.addEventListener('keydown',event=>{if(event.key==='Escape'&&lensEnabled){event.preventDefault();event.stopPropagation();dismissLens();}});
  let loading,
    pdf,
    rendering,
    pageNumber = 1,
    revision = 0,renderedScale=1,resetView=false,zoomMode='fit-page';
  async function render(reset=false) {
    if (!pdf) return;
    dismissLens();lensPage=null;
    resetView ||= reset;
    const current = ++revision;
    const center={x:(viewport.scrollLeft+viewport.clientWidth/2-canvas.offsetLeft)/(canvas.clientWidth||1),y:(viewport.scrollTop+viewport.clientHeight/2-canvas.offsetTop)/(canvas.clientHeight||1)};
    rendering?.cancel();
    previous.disabled = pageNumber === 1;
    next.disabled = pageNumber === pdf.numPages;
    label.textContent = `${pageNumber} / ${pdf.numPages}`;
    label.setAttribute('aria-label',`Page ${pageNumber} of ${pdf.numPages}`);
    try {
      const page = await pdf.getPage(pageNumber);
      if (current !== revision) return;
      const natural = page.getViewport({ scale: 1 });
      const fitted = room();
      const scale = pdfScale(zoomMode,fitted.width,fitted.height,natural);
      root.querySelector('#document-zoom-in').disabled=scale>=3;
      root.querySelector('#document-zoom-out').disabled=scale<=.5;
      const sized = page.getViewport({ scale });
      const density = Math.min(Math.max(window.devicePixelRatio || 1, 2), 3);
      // Keep the current page visible until its replacement is fully painted.
      const pendingCanvas=document.createElement('canvas');
      pendingCanvas.width = Math.ceil(sized.width * density);
      pendingCanvas.height = Math.ceil(sized.height * density);
      rendering = page.render({
        canvas:pendingCanvas,
        viewport: sized,
        transform: [density, 0, 0, density, 0, 0],
      });
      await rendering.promise;
      if (current !== revision) return;
      canvas.width=pendingCanvas.width;canvas.height=pendingCanvas.height;
      canvas.style.width=`${sized.width}px`;canvas.style.height=`${sized.height}px`;
      canvas.getContext('2d').drawImage(pendingCanvas,0,0);
      canvas.setAttribute('aria-label',`Page ${pageNumber} of ${pdf.numPages}`);
      canvas.hidden = false;
      if(resetView){
        canvas.getAnimations().forEach(animation=>animation.cancel());
        canvas.animate([{opacity:0,transform:'translateY(12px)'},{opacity:1,transform:'none'}],{duration:320,easing:'cubic-bezier(.22,1,.36,1)'});
      }
      renderedScale=scale;
      lensPage=page;
      zoom.textContent=`${Math.round(scale*100)}%`;
      fit.dataset.fit=zoomMode==='fit-page'?'fit':'fit-page';
      fit.title=fit.dataset.fit==='fit'?'Fit width':'Fit page';
      fit.setAttribute('aria-label',fit.title);
      status.textContent = "";
      download.hidden = true;
      viewport.scrollLeft=resetView?0:canvas.offsetLeft+center.x*sized.width-viewport.clientWidth/2;
      viewport.scrollTop=resetView?0:canvas.offsetTop+center.y*sized.height-viewport.clientHeight/2;
      resetView=false;
      const text = await page.getTextContent();
      if (current === revision)
        root.querySelector("#document-text").textContent = text.items
          .map((item) => item.str || "")
          .join(" ");
    } catch (error) {
      if (current === revision && error.name !== "RenderingCancelledException") {
        status.textContent =
          "This page could not be displayed. Download it to open in a PDF app.";
        download.hidden = !download.hasAttribute('href');
      }
    }
  }
  previous.addEventListener("click", () => {
    if (pageNumber > 1) {
      pageNumber--;
      render(true);
    }
  });
  next.addEventListener("click", () => {
    if (pdf && pageNumber < pdf.numPages) {
      pageNumber++;
      render(true);
    }
  });
  fit.addEventListener('click',()=>{zoomMode=fit.dataset.fit;render();});
  for(const [id,direction] of [['document-zoom-in',1],['document-zoom-out',-1]])root.querySelector('#'+id)?.addEventListener('click',()=>{
    const levels=[.5,.75,1,1.25,1.5,2,3];
    zoomMode=String(direction>0?levels.find(value=>value>renderedScale+.01)||3:[...levels].reverse().find(value=>value<renderedScale-.01)||.5);
    render();
  });
  let width = 0,height=0;
  const resized = new ResizeObserver(() => {
    const fitted = room();
    if (Math.abs(fitted.width - width) > 1 || Math.abs(fitted.height-height)>1) {
      ({width,height} = fitted);
      if (width && ['fit','fit-page'].includes(zoomMode)) render();
    }
  });
  // The reader, the sheet and the page area each resize alone: window, status line, scrollbar.
  for (const element of [root,sheet,viewport]) resized.observe(element);
  function close() {
    dismissLens();lensPage=null;
    revision++;
    rendering?.cancel();
    rendering = null;
    loading?.destroy();
    loading = null;
    pdf = null;
    resetView=true;
    canvas.hidden = true;
    download.hidden = true;
    root.querySelector("#document-text").textContent = "";
    root.querySelector(".document-controls").hidden = true;
  }
  return {
    close,
    async open(file) {
      close();
      const current = revision;
      const data = new Uint8Array(await file.arrayBuffer());
      if (current !== revision) return;
      const task = pdfjs.getDocument({
        data,
        isEvalSupported: false,
        standardFontDataUrl: new URL(
          "../mockup/vendor/pdfjs/standard_fonts/",
          import.meta.url,
        ).href,
        wasmUrl: new URL("../mockup/vendor/pdfjs/wasm/", import.meta.url).href,
      });
      loading = task;
      const loaded = await task.promise;
      if (current !== revision) return;
      pdf = loaded;
      pageNumber = 1;
      zoomMode = "fit-page";
      root.querySelector(".document-controls").hidden = false;
      await render(true);
    },
  };
}
