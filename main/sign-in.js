(() => {
  const $ = id => document.getElementById(id), dialog = $('sign-in-dialog'), form = $('sign-in-form'), session = window.siblingSession;
  const email = $('sign-in-email'), password = $('sign-in-password'), code = $('sign-in-code'), submit = $('sign-in-submit'), status = $('sign-in-status'), help = $('sign-in-help');
  let mode = 'sign-in', generation = 0;
  const destination = () => new URLSearchParams(location.search).get('return') === 'legacy' ? 'admin/legacy.html' : 'admin/';
  function setMode(next) {
    mode = next; status.textContent = ''; help.hidden = next === 'sign-in';
    password.type = 'password'; $('password-toggle').setAttribute('aria-pressed','false'); $('password-toggle').setAttribute('aria-label','Show password');
    $('sign-in-title').textContent = ({'sign-in':'Sign in', email:'Set your password', code:'Check your email', password:'Set your password'})[next];
    help.textContent = ({email:'Verify your email to set or reset your password.', code:'Enter the code sent to your invited email address.', password:'Use at least 8 characters. If you use this email in our other apps, this updates the same password.'})[next] || '';
    $('sign-in-email-label').hidden = next === 'password'; email.disabled = next === 'password' || next === 'code';
    $('sign-in-password-label').hidden = next === 'email' || next === 'code'; password.disabled = next === 'email' || next === 'code';
    password.autocomplete = next === 'password' ? 'new-password' : 'current-password'; password.minLength = next === 'password' ? 8 : 0;
    $('sign-in-code-label').hidden = next !== 'code'; code.disabled = next !== 'code'; code.required = next === 'code';
    $('sign-in-setup').hidden = next !== 'sign-in'; $('sign-in-back').hidden = next === 'sign-in';
    submit.textContent = ({'sign-in':'Sign in', email:'Send code', code:'Continue', password:'Save password'})[next];
    submit.disabled = false;
  }
  async function finish() {
    if (new URLSearchParams(location.search).get('return')==='legacy') {location.assign(destination());return;}
    dialog.close();dispatchEvent(new Event('marmullaku-signed-in'));
  }
  window.showSignIn = async () => {
    if (session.active) {
      try { await session.request('profile'); await finish(); return; }
      catch { await session.signOut(); }
    }
    document.querySelector('#access-dialog')?.close();
    form.reset(); password.type = 'password'; $('password-toggle').setAttribute('aria-pressed','false'); $('password-toggle').setAttribute('aria-label','Show password');
    generation++; setMode('sign-in');
    if (!dialog.open) dialog.showModal();
  };
  $('sign-in-trigger').addEventListener('click', window.showSignIn);
  $('sign-in-close').addEventListener('click', () => dialog.close());
  dialog.addEventListener('click', e => { if (e.target === dialog) dialog.close(); });
  dialog.addEventListener('close', () => { generation++; password.value = ''; code.value = ''; $('sign-in-trigger')?.focus({preventScroll:true}); });
  $('sign-in-setup').addEventListener('click', () => { password.value = ''; setMode('email'); email.focus(); });
  $('sign-in-back').addEventListener('click', () => { generation++; password.value = ''; code.value = ''; setMode('sign-in'); email.focus(); });
  $('password-toggle').addEventListener('click', () => {
    const visible = password.type === 'password'; password.type = visible ? 'text' : 'password';
    $('password-toggle').setAttribute('aria-pressed', String(visible)); $('password-toggle').setAttribute('aria-label', visible ? 'Hide password' : 'Show password');
  });
  form.addEventListener('submit', async e => {
    e.preventDefault(); if (submit.disabled) return;
    const current = generation, step = mode; submit.disabled = true; status.textContent = '';
    const address = email.value.trim().toLowerCase();
    try {
      if (step === 'sign-in') { await session.signIn(address, password.value); if (current === generation) { password.value = ''; await finish(); } }
      else if (step === 'email') { await session.sendCode(address); if (current === generation) { setMode('code'); code.focus(); } }
      else if (step === 'code') { await session.verify(address, code.value.trim()); if (current === generation) { code.value = ''; setMode('password'); password.focus(); } }
      else { await session.setPassword(password.value); if (current === generation) { password.value = ''; await finish(); } }
    } catch (error) { if (current === generation) status.textContent = error.message; }
    finally { if (current === generation) submit.disabled = false; }
  });
  addEventListener('load', () => { if (new URLSearchParams(location.search).has('sign-in')) window.showSignIn(); });
})();
