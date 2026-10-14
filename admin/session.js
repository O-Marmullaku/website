(() => {
  const key = 'marmullaku-sibling-session';
  let session;
  try { session = JSON.parse(sessionStorage.getItem(key) || 'null'); } catch { session = null; }
  function store(value) {
    session = value;
    try { value ? sessionStorage.setItem(key, JSON.stringify(value)) : sessionStorage.removeItem(key); } catch {}
  }
  async function auth(path, body) {
    const c = window.MARMULLAKU_BACKEND;
    const r = await fetch(`${c.url}/auth/v1/${path}`, {method: 'POST', cache: 'no-store', referrerPolicy: 'no-referrer', headers: {apikey: c.publishableKey, 'Content-Type': 'application/json'}, body: JSON.stringify(body)});
    let data;
    try { data = await r.json(); } catch { throw new Error('Could not connect. Please try again.'); }
    if (!r.ok) throw new Error(data.msg || data.error_description || data.message || 'Sign-in failed. Please try again.');
    return data;
  }
  window.siblingSession = {
    async sendCode(email) {
      // The server checks the invitation before requesting email delivery.
      return window.marmullakuRequest('sign-in-code', {email});
    },
    async verify(email, code) {
      const result = await auth('verify', {email, token: code, type: 'email'});
      store({...result, expires_at: Date.now() + result.expires_in * 1000});
    },
    async request(action, data) {
      if (!session) throw Object.assign(new Error('Please sign in.'), {status: 401});
      if (Date.now() > session.expires_at - 60000) {
        try {
          const next = await auth('token?grant_type=refresh_token', {refresh_token: session.refresh_token});
          store({...next, expires_at: Date.now() + next.expires_in * 1000});
        } catch { store(null); throw Object.assign(new Error('Your session has expired. Please sign in again.'), {status: 401}); }
      }
      return window.marmullakuRequest(action, data, {jwt: session.access_token});
    },
    get active() { return !!session; },
    async signOut() {
      // Revoke this session only, preserving sign-ins in other shared apps.
      const current = session; store(null);
      if (!current) return;
      try { await fetch(`${window.MARMULLAKU_BACKEND.url}/auth/v1/logout?scope=local`, {method:'POST', headers:{apikey:window.MARMULLAKU_BACKEND.publishableKey, Authorization:`Bearer ${current.access_token}`}}); } catch {}
    },
  };
})();
