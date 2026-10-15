// Local rendering keeps uploaded documents off third-party services.
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
  const status = root.querySelector("#document-status");
  let loading,
    pdf,
    rendering,
    pageNumber = 1,
    revision = 0;
  async function render() {
    if (!pdf) return;
    const current = ++revision;
    rendering?.cancel();
    previous.disabled = pageNumber === 1;
    next.disabled = pageNumber === pdf.numPages;
    label.textContent = `Page ${pageNumber} of ${pdf.numPages}`;
    try {
      const page = await pdf.getPage(pageNumber);
      if (current !== revision) return;
      const natural = page.getViewport({ scale: 1 });
      const scale =
        zoom.value === "fit"
          ? Math.max(0.1, (viewport.clientWidth - 24) / natural.width)
          : Number(zoom.value);
      const sized = page.getViewport({ scale });
      const density = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.ceil(sized.width * density);
      canvas.height = Math.ceil(sized.height * density);
      canvas.style.width = `${sized.width}px`;
      canvas.style.height = `${sized.height}px`;
      canvas.setAttribute("aria-label", label.textContent);
      rendering = page.render({
        canvas,
        viewport: sized,
        transform: [density, 0, 0, density, 0, 0],
      });
      await rendering.promise;
      if (current !== revision) return;
      canvas.hidden = false;
      status.textContent = "";
      viewport.scrollTop = 0;
      const text = await page.getTextContent();
      if (current === revision)
        root.querySelector("#document-text").textContent = text.items
          .map((item) => item.str || "")
          .join(" ");
    } catch (error) {
      if (current === revision && error.name !== "RenderingCancelledException")
        status.textContent =
          "This page could not be displayed. Use Open PDF to read the original.";
    }
  }
  previous.addEventListener("click", () => {
    if (pageNumber > 1) {
      pageNumber--;
      render();
    }
  });
  next.addEventListener("click", () => {
    if (pdf && pageNumber < pdf.numPages) {
      pageNumber++;
      render();
    }
  });
  zoom.addEventListener("change", render);
  let width = 0;
  new ResizeObserver(([entry]) => {
    if (Math.abs(entry.contentRect.width - width) > 1) {
      width = entry.contentRect.width;
      if (width && zoom.value === "fit") render();
    }
  }).observe(viewport);
  function close() {
    revision++;
    rendering?.cancel();
    rendering = null;
    loading?.destroy();
    loading = null;
    pdf = null;
    canvas.hidden = true;
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
      zoom.value = "fit";
      root.querySelector(".document-controls").hidden = false;
      await render();
    },
  };
}
