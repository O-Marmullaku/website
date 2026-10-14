(() => {
  const frame = document.getElementById('archive'), status = document.getElementById('archive-status'), home = document.getElementById('archive-home');
  let files;
  const resolve = (value, current) => {
    const url = new URL(value, `https://legacy.invalid/${current}`);
    return url.origin === 'https://legacy.invalid' ? decodeURIComponent(url.pathname.slice(1)) : null;
  };
  const resource = path => files[path] ? `data:${files[path].type};base64,${files[path].body}` : '';
  function show(path) {
    if (!files[path] || files[path].type !== 'text/html') { status.textContent = 'That page was not included in the original archive.'; return; }
    const bytes = Uint8Array.from(atob(files[path].body), c => c.charCodeAt(0));
    const doc = new DOMParser().parseFromString(new TextDecoder().decode(bytes), 'text/html');
    for (const node of doc.querySelectorAll('[src],link[href]')) {
      const attr = node.hasAttribute('src') ? 'src' : 'href', value = node.getAttribute(attr);
      const target = resolve(value, path);
      if (target !== null) { const data = resource(target); data ? node.setAttribute(attr, data) : node.removeAttribute(attr); }
    }
    for (const a of doc.querySelectorAll('a[href]')) {
      const target = resolve(a.getAttribute('href'), path);
      if (target !== null) { a.dataset.legacyPath = target || 'index.html'; a.setAttribute('href', '#'); }
    }
    const meta = doc.createElement('meta'); meta.name = 'referrer'; meta.content = 'no-referrer'; doc.head.append(meta);
    const bridge = doc.createElement('script');
    bridge.textContent = `document.addEventListener('click', e => { const a = e.target.closest('a[data-legacy-path]'); if (a) {e.preventDefault();parent.postMessage({legacyPath:a.dataset.legacyPath}, '*');}});`;
    doc.body.append(bridge);
    frame.srcdoc = '<!doctype html>' + doc.documentElement.outerHTML;
    frame.hidden = false; home.hidden = false; status.textContent = '';
  }
  addEventListener('message', e => {
    if (e.source === frame.contentWindow && typeof e.data?.legacyPath === 'string') show(e.data.legacyPath);
  });
  home.addEventListener('click', () => show('index.html'));
  if (!window.siblingSession.active) { location.replace('./?return=legacy'); return; }
  window.siblingSession.request('legacy').then(data => { files = data.files; show('index.html'); }).catch(error => {
    status.textContent = error.message;
    if (error.status === 401) location.replace('./?return=legacy');
  });
})();
