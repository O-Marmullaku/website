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
  const previous = root.querySelector("#document-previous");
  const next = root.querySelector("#document-next");
  const label = root.querySelector("#document-page");
  const zoom = root.querySelector("#document-zoom");
  const fit = root.querySelector("#document-fit");
  const status = root.querySelector("#document-status");
  const download = root.querySelector("#document-download");
  let loading,
    pdf,
    rendering,
    pageNumber = 1,
    revision = 0,renderedScale=1,resetView=false,zoomMode='fit-page';
  async function render(reset=false) {
    if (!pdf) return;
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
      const scale = pdfScale(zoomMode,viewport.clientWidth,viewport.clientHeight,natural);
      root.querySelector('#document-zoom-in').disabled=scale>=3;
      root.querySelector('#document-zoom-out').disabled=scale<=.5;
      const sized = page.getViewport({ scale });
      const density = Math.min(window.devicePixelRatio || 1, 2);
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
      renderedScale=scale;
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
  new ResizeObserver(([entry]) => {
    if (Math.abs(entry.contentRect.width - width) > 1 || Math.abs(entry.contentRect.height-height)>1) {
      width = entry.contentRect.width;
      height=entry.contentRect.height;
      if (width && ['fit','fit-page'].includes(zoomMode)) render();
    }
  }).observe(viewport);
  function close() {
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
