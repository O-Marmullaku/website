(() => {
  const dialog = document.querySelector('#access-dialog'), title = document.querySelector('#access-title'), detail = document.querySelector('#access-detail'), button = document.querySelector('#access-continue'), error = document.querySelector('#access-error');
  let token;
  function updateToken() {
    token = location.hash.match(/^#invite=([A-Za-z0-9_-]{43})$/)?.[1];
    window.marmullakuInvitationURL = token ? `${location.origin}${location.pathname}#invite=${token}` : null;
  }
  updateToken();
  let pendingCard = null, generation = 0;
  const words = {
    en: {private: 'Private résumé', invitation: 'Open the private link included with the application to view this résumé.', welcome: 'Welcome', intro: name => `A closer look at ${name}’s experience and projects.`, view: 'View CV', checking: 'Checking your invitation…', unavailable: 'This link is unavailable', renewal: 'It may have expired or been revoked. Ask the applicant for a new link.', mismatch: 'This invitation is for another family member.', opening: 'Opening…'},
    de: {private: 'Privater Lebenslauf', invitation: 'Öffnen Sie den privaten Link aus der Bewerbung, um diesen Lebenslauf anzusehen.', welcome: 'Willkommen', intro: name => `Ein Einblick in die Erfahrung und Projekte von ${name}.`, view: 'Lebenslauf ansehen', checking: 'Einladung wird geprüft…', unavailable: 'Dieser Link ist nicht verfügbar', renewal: 'Er ist möglicherweise abgelaufen oder wurde widerrufen. Bitten Sie um einen neuen Link.', mismatch: 'Diese Einladung ist für ein anderes Familienmitglied.', opening: 'Wird geöffnet…'},
    fr: {private: 'CV privé', invitation: 'Ouvrez le lien privé inclus dans la candidature pour consulter ce CV.', welcome: 'Bienvenue', intro: name => `Découvrez l’expérience et les projets de ${name}.`, view: 'Voir le CV', checking: 'Vérification de votre invitation…', unavailable: 'Ce lien est indisponible', renewal: 'Il a peut-être expiré ou été révoqué. Demandez un nouveau lien.', mismatch: 'Cette invitation concerne un autre membre de la famille.', opening: 'Ouverture…'},
    th: {private: 'ประวัติส่วนตัว', invitation: 'เปิดลิงก์ส่วนตัวที่แนบมากับใบสมัครเพื่อดูประวัติ', welcome: 'ยินดีต้อนรับ', intro: name => `ประสบการณ์และผลงานของ ${name}`, view: 'ดูประวัติ', checking: 'กำลังตรวจสอบคำเชิญ…', unavailable: 'ลิงก์นี้ไม่สามารถใช้งานได้', renewal: 'ลิงก์อาจหมดอายุหรือถูกยกเลิก กรุณาขอลิงก์ใหม่', mismatch: 'คำเชิญนี้สำหรับสมาชิกครอบครัวคนอื่น', opening: 'กำลังเปิด…'},
    zh: {private: '私人简历', invitation: '请打开申请材料中的私人链接查看简历。', welcome: '欢迎', intro: name => `了解 ${name} 的经验与项目。`, view: '查看简历', checking: '正在验证邀请…', unavailable: '此链接不可用', renewal: '链接可能已过期或被撤销，请向申请人索取新链接。', mismatch: '此邀请属于另一位家庭成员。', opening: '正在打开…'},
  };
  const t = () => words[document.documentElement.lang] || words.en;
  function show() { error.textContent = ''; button.hidden = true; button.disabled = false; if (!dialog.open) dialog.showModal(); }
  document.querySelector('#access-close').addEventListener('click', () => dialog.close());
  dialog.addEventListener('click', e => { if (e.target === dialog) dialog.close(); });
  dialog.addEventListener('close', () => { generation++; pendingCard?.querySelector('.open')?.focus({preventScroll: true}); });
  window.requestPrivateCV = async card => {
    pendingCard = card;
    const current = ++generation;
    show();
    if (!token) { title.textContent = t().private; detail.textContent = t().invitation; return; }
    title.textContent = t().checking; detail.textContent = '';
    try {
      const data = await window.marmullakuRequest('welcome', {}, {token});
      if (current !== generation) return;
      const invited = document.querySelector(`.role[data-i18n="${data.profile.id}"]`)?.closest('.card');
      const allowed = data.profiles || [data.profile];
      document.querySelectorAll('.card').forEach(candidate => {candidate.hidden=!allowed.some(profile=>profile.id===candidate.querySelector('.role')?.dataset.i18n);});
      if (!invited || (card && !allowed.some(profile=>profile.id===card.querySelector('.role')?.dataset.i18n))) throw new Error(t().mismatch);
      pendingCard = card || invited;
      title.textContent = `${t().welcome}, ${data.company}`;
      detail.textContent = data.message || t().intro(data.profile.display_name);
      button.textContent = t().view; button.hidden = false;
    } catch (e) {
      if (current !== generation) return;
      title.textContent = t().unavailable;
      detail.textContent = e.status === 404 ? t().renewal : e.message;
    }
  };
  button.addEventListener('click', async () => {
    if (!token || !pendingCard || button.disabled) return;
    const current = generation;
    button.disabled = true; button.textContent = t().opening; error.textContent = '';
    try {
      // Check expiry and revocation again when entering, not just when showing the welcome.
      const data = {profile:{id:pendingCard.querySelector('.role').dataset.i18n}};
      if (current !== generation) return;
      if (pendingCard.querySelector('.role').dataset.i18n !== data.profile.id) throw new Error(t().mismatch);
      const card = pendingCard;
      dialog.close();
      window.openPrivateCV(card, data.profile);
    } catch (e) {
      if (current !== generation) return;
      error.textContent = e.status === 404 ? t().renewal : e.message;
      button.disabled = false; button.textContent = t().view;
    }
  });
  addEventListener('load', () => {
    if (token || location.hash.startsWith('#invite=')) window.requestPrivateCV(null);
  });
  addEventListener('hashchange', () => {
    updateToken();
    if (location.hash.startsWith('#invite=')) window.requestPrivateCV(null);
  });
})();
