(() => {
  const config = window.MARMULLAKU_BACKEND;
  window.marmullakuRequest = async (action, data = {}, {token, jwt, signal} = {}) => {
    const response = await fetch(`${config.url}/functions/v1/marmullaku-access`, {
      method: 'POST', cache: 'no-store', referrerPolicy: 'no-referrer', signal,
      headers: {'Content-Type': 'application/json', ...(config.publishableKey ? {apikey: config.publishableKey} : {}), ...(token ? {'x-cv-access': token} : {}), ...(jwt ? {Authorization: `Bearer ${jwt}`} : {})},
      body: JSON.stringify({action, ...data}),
    });
    let result;
    try { result = await response.json(); } catch { throw new Error('Could not connect. Please try again.'); }
    if (!response.ok) {
      const error = new Error(result.error || 'Could not connect. Please try again.');
      error.status = response.status;
      throw error;
    }
    return result;
  };
})();
