(() => {
  const escape = value => value.replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));
  const walk = value => typeof value === 'string' ? escape(value) : Array.isArray(value) ? value.map(walk) : value && typeof value === 'object' ? Object.fromEntries(Object.entries(value).map(([k, v]) => [k, walk(v)])) : value;
  window.escapeDocument = document => {
    const result = walk(document);
    result.contact = (result.contact || []).map(([label, href]) => [label, href && /^(https?:\/\/|mailto:|tel:)/i.test(href) ? href : '']);
    result.skills = (result.skills || []).map(([label, level]) => [label, Number.isFinite(level) ? Math.max(0, Math.min(100, level)) : 0]);
    return result;
  };
})();
