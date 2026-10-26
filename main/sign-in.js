(() => {
  const $ = id => document.getElementById(id), dialog = $('sign-in-dialog'), form = $('sign-in-form'), session = window.siblingSession;
  const email = $('sign-in-email'), password = $('sign-in-password'), code = $('sign-in-code'), submit = $('sign-in-submit'), status = $('sign-in-status'), help = $('sign-in-help');
  let mode = 'sign-in', generation = 0, busy=false, requiredProfile=null;
  const labels={'sign-in':'Sign in',email:'Send code',code:'Continue',password:'Save password'};
  function setBusy(value){busy=value;submit.disabled=$('sign-in-setup').disabled=$('sign-in-back').disabled=value;}
  async function checkOwner(id){
    if(!id)return;
    const {profile}=await session.request('profile');
    if(profile.id!==id){await session.signOut();throw new Error('Sign in with the account that owns this CV.');}
  }
  function setMode(next) {
    mode = next; status.textContent = ''; help.hidden = next === 'sign-in'&&!requiredProfile;
    password.type = 'password'; $('password-toggle').setAttribute('aria-pressed','false'); $('password-toggle').setAttribute('aria-label','Show password');
    $('sign-in-title').textContent = ({'sign-in':'Sign in', email:'Set your password', code:'Check your email', password:'Set your password'})[next];
    help.textContent = ({email:'Verify your email to set or reset your password.', code:'Enter the code from your email.', password:'Use at least 8 characters.'})[next] || '';
    if(next==='sign-in'&&requiredProfile)help.textContent='Sign in to save your CV. Your changes are still open.';
    $('sign-in-email-label').hidden = next === 'password'; email.disabled = next === 'password' || next === 'code';
    $('sign-in-password-label').hidden = next === 'email' || next === 'code'; password.disabled = next === 'email' || next === 'code';
    password.autocomplete = next === 'password' ? 'new-password' : 'current-password'; password.minLength = next === 'password' ? 8 : 0;
    $('sign-in-code-label').hidden = next !== 'code'; code.disabled = next !== 'code'; code.required = next === 'code';
    $('sign-in-setup').hidden = next !== 'sign-in'; $('sign-in-back').hidden = next === 'sign-in';
    $('sign-in-back').textContent=next==='code'?'Change email':'Back to sign in';
    submit.textContent = labels[next];
    setBusy(busy);
  }
  async function finish() {
    if (new URLSearchParams(location.search).get('return')==='legacy') {location.assign('admin/legacy.html');return;}
    dialog.close();dispatchEvent(new Event('marmullaku-signed-in'));
  }
  window.showSignIn = async expectedProfile => {
    requiredProfile=typeof expectedProfile==='string'?expectedProfile:null;
    if (session.active) {
      try { await session.request('profile');await checkOwner(requiredProfile); await finish(); return; }
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
  $('sign-in-back').addEventListener('click', () => { const next=mode==='code'?'email':'sign-in';generation++; password.value = ''; code.value = ''; setMode(next); email.focus(); });
  $('password-toggle').addEventListener('click', () => {
    const visible = password.type === 'password'; password.type = visible ? 'text' : 'password';
    $('password-toggle').setAttribute('aria-pressed', String(visible)); $('password-toggle').setAttribute('aria-label', visible ? 'Hide password' : 'Show password');
  });
  form.addEventListener('submit', async e => {
    e.preventDefault(); if (submit.disabled) return;
    const current = generation, step = mode, expectedProfile=requiredProfile; setBusy(true); status.textContent = '';
    submit.textContent=({'sign-in':'Signing in…',email:'Sending…',code:'Checking…',password:'Saving…'})[step];
    const address = email.value.trim().toLowerCase();
    try {
      if (step === 'sign-in') { await session.signIn(address, password.value);await checkOwner(expectedProfile); if (current === generation) { password.value = ''; await finish(); } else dispatchEvent(new Event('marmullaku-signed-in')); }
      else if (step === 'email') { await session.sendCode(address); if (current === generation) { setMode('code'); code.focus(); } }
      else if (step === 'code') { await session.verify(address, code.value.trim());await checkOwner(expectedProfile); if (current === generation) { code.value = ''; setMode('password'); password.focus(); } else dispatchEvent(new Event('marmullaku-signed-in')); }
      else { await session.setPassword(password.value); if (current === generation) { password.value = ''; await finish(); } }
    } catch (error) { if (current === generation) status.textContent = error.message; }
    finally { setBusy(false);if (current === generation)submit.textContent=labels[mode]; }
  });
  addEventListener('load', () => { if (new URLSearchParams(location.search).has('sign-in')) window.showSignIn(); });
})();
