(() => {
  const $ = id => document.getElementById(id), session = window.siblingSession;
  let profile, email = '', dirty = false;
  const sections = [
    ['contact', 'Contact', [['label', 'Text', 200], ['href', 'Link · optional', 500]]],
    ['skills', 'Skills', [['label', 'Skill', 100], ['level', 'Proficiency · 0–100', 100, 'number']]],
    ['languages', 'Languages', [['label', 'Language', 80], ['level', 'Level', 100]]],
    ['experience', 'Experience', [['when', 'Dates', 100], ['title', 'Position', 200], ['org', 'Company', 200], ['points', 'Highlights · one per line', 20000, 'textarea'], ['tags', 'Skills used · separated by commas', 1600]]],
    ['education', 'Education', [['when', 'Dates', 100], ['title', 'Qualification', 200], ['org', 'Institution', 200]]],
    ['certs', 'Certifications', [['when', 'Date', 100], ['title', 'Certification', 200], ['org', 'Issuer', 200]]],
  ];
  function element(tag, cls, content) { const e = document.createElement(tag); if (cls) e.className = cls; if (content !== undefined) e.textContent = content; return e; }
  function status(id, message, error = false) { $(id).textContent = message; $(id).classList.toggle('error', error); }
  async function submit(form, work) {
    const button = form.querySelector('button[type=submit]'); button.disabled = true;
    try { await work(); } finally { button.disabled = false; }
  }
  $('email-form').addEventListener('submit', e => {
    e.preventDefault(); submit(e.currentTarget, async () => {
      email = new FormData(e.target).get('email').trim().toLowerCase();
      status('login-status', 'Sending your sign-in code…');
      try { await session.sendCode(email); $('email-form').hidden = true; $('code-form').hidden = false; status('login-status', 'If this email has sibling access, a sign-in code is on its way.'); $('code-form').elements.code.focus(); }
      catch (error) { status('login-status', error.message, true); }
    });
  });
  $('change-email').addEventListener('click', () => { $('email-form').hidden = false; $('code-form').hidden = true; status('login-status', ''); });
  $('code-form').addEventListener('submit', e => {
    e.preventDefault(); submit(e.currentTarget, async () => {
      try { await session.verify(email, new FormData(e.target).get('code').trim()); e.target.reset(); await load(); }
      catch (error) { status('login-status', error.message, true); }
    });
  });
  $('sign-out').addEventListener('click', async () => {
    if (dirty && !confirm('Leave without saving your CV changes?')) return;
    dirty = false; await session.signOut(); location.reload();
  });
  function tab(name) {
    $('cv-panel').hidden = name !== 'cv'; $('links-panel').hidden = name !== 'links';
    for (const key of ['cv', 'links']) { $(key + '-tab').removeAttribute('aria-current'); if (key === name) $(key + '-tab').setAttribute('aria-current', 'page'); }
  }
  $('cv-tab').addEventListener('click', () => tab('cv')); $('links-tab').addEventListener('click', () => tab('links'));
  function addEntry(section, values = {}) {
    const [key, title, fields] = section, entry = element('div', 'entry'), grid = element('div', fields.length > 2 ? 'fields three' : 'fields two');
    for (const [name, label, max, type] of fields) {
      const wrap = element('label', '', label), input = element(type === 'textarea' ? 'textarea' : 'input');
      input.dataset.field = name; input.maxLength = max;
      if (type === 'number') { input.type = 'number'; input.min = 0; input.max = 100; }
      if (type === 'textarea') { input.rows = 4; wrap.style.gridColumn = '1 / -1'; }
      input.value = values[name] ?? (type === 'number' ? 75 : '');
      wrap.append(input); grid.append(wrap);
    }
    const remove = element('button', 'remove', `Remove ${title.toLowerCase()} entry`); remove.type = 'button';
    remove.addEventListener('click', () => { entry.remove(); dirty = true; });
    entry.append(grid, remove); $('entries-' + key).append(entry);
  }
  function fillCV() {
    const form = $('cv-form'); form.elements.display_name.value = profile.display_name; form.elements.role.value = profile.role;
    form.elements.profile.value = profile.cv.profile; form.elements.interests.value = profile.cv.interests;
    $('cv-sections').replaceChildren();
    for (const section of sections) {
      const [key, title] = section, block = element('section'), entries = element('div'); entries.id = 'entries-' + key;
      const add = element('button', 'section-add', `Add ${title.toLowerCase()} entry`); add.type = 'button';
      add.addEventListener('click', () => { if (entries.children.length >= ({contact: 12, skills: 30, languages: 12}[key] || 20)) return; addEntry(section); dirty = true; entries.lastElementChild.querySelector('input,textarea').focus(); });
      block.append(element('h2', '', title), entries, add); $('cv-sections').append(block);
      for (const value of profile.cv[key]) {
        let fields = value;
        if (['contact','skills','languages'].includes(key)) fields = {label: value[0], [key === 'contact' ? 'href' : 'level']: value[1] ?? ''};
        if (key === 'experience') fields = {...value, points: value.points.join('\n'), tags: value.tags.join(', ')};
        addEntry(section, fields);
      }
    }
  }
  function collectCV() {
    const form = $('cv-form'), cv = {profile: form.elements.profile.value, interests: form.elements.interests.value};
    for (const [key] of sections) {
      cv[key] = [...$('entries-' + key).children].map(entry => {
        const values = Object.fromEntries([...entry.querySelectorAll('[data-field]')].map(x => [x.dataset.field, x.value.trim()]));
        if (key === 'contact') return [values.label, values.href];
        if (key === 'skills') return [values.label, Number(values.level)];
        if (key === 'languages') return [values.label, values.level];
        if (key === 'experience') return {...values, points: values.points.split('\n').map(x => x.trim()).filter(Boolean), tags: values.tags.split(',').map(x => x.trim()).filter(Boolean)};
        return values;
      });
    }
    return {cv, display_name: form.elements.display_name.value, role: form.elements.role.value};
  }
  $('cv-form').addEventListener('input', () => { dirty = true; });
  addEventListener('beforeunload', e => { if (dirty) { e.preventDefault(); e.returnValue = ''; } });
  $('cv-form').addEventListener('submit', e => {
    e.preventDefault(); submit(e.currentTarget, async () => {
      status('save-status', 'Saving…');
      try { const data = await session.request('save', collectCV()); profile = data.profile; dirty = false; $('owner-name').textContent = profile.display_name; status('save-status', 'Saved. Your active links show the updated CV.'); }
      catch (error) { status('save-status', error.message, true); }
    });
  });
  async function listLinks() {
    const {links} = await session.request('links'); $('links-list').replaceChildren();
    if (!links.length) { $('links-list').append(element('p', 'muted', 'No company links yet.')); return; }
    for (const link of links) {
      const row = element('div', 'link-row'), text = element('div'), expired = Date.parse(link.expires_at) <= Date.now();
      text.append(element('strong', '', link.company), element('p', 'muted', link.revoked ? 'Revoked' : expired ? 'Expired' : `Expires ${new Intl.DateTimeFormat(undefined, {dateStyle:'medium'}).format(new Date(link.expires_at))}`)); row.append(text);
      if (!link.revoked && !expired) {
        const revoke = element('button', '', 'Revoke'); revoke.type = 'button';
        revoke.addEventListener('click', async () => {
          if (!confirm(`Revoke access for ${link.company}? Their link will stop working immediately.`)) return;
          revoke.disabled = true;
          try { await session.request('revoke', {id: link.id}); await listLinks(); status('link-status', `Access revoked for ${link.company}.`); }
          catch (error) { status('link-status', error.message, true); revoke.disabled = false; }
        }); row.append(revoke);
      }
      $('links-list').append(row);
    }
  }
  $('link-form').addEventListener('submit', e => {
    e.preventDefault(); submit(e.currentTarget, async () => {
      status('link-status', 'Creating link…');
      try {
        const values = Object.fromEntries(new FormData(e.target)), data = await session.request('create', values);
        const base = new URL('../', location.href); base.search = ''; base.hash = 'invite=' + data.token;
        $('link-output').value = base.href; $('preview-link').href = base.href; $('created-link').hidden = false;
        $('copy-link').textContent = 'Copy link'; status('link-status', 'Link created.'); await listLinks();
      } catch (error) { status('link-status', error.message, true); }
    });
  });
  $('copy-link').addEventListener('click', async () => {
    try { await navigator.clipboard.writeText($('link-output').value); $('copy-link').textContent = 'Copied'; }
    catch { $('link-output').select(); status('link-status', 'Select and copy the link above.'); }
  });
  async function load() {
    try {
      ({profile} = await session.request('profile')); fillCV(); await listLinks();
      $('owner-name').textContent = profile.display_name; $('workspace').hidden = false; $('login').hidden = true; $('sign-out').hidden = false; status('global-status', '');
      if (new URLSearchParams(location.search).get('return') === 'legacy') { location.replace('legacy.html'); return; }
      if (location.search.includes('links')) tab('links');
    } catch (error) { status('login-status', error.message, true); if (error.status === 401 || error.status === 403) await session.signOut(); }
  }
  if (session.active) load();
})();
