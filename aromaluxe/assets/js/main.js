(function() {
  const STORAGE_KEYS = {
    history: 'aromaluxe.history.v1',
    emailOptin: 'aromaluxe.emailOptin.v1',
    exitShown: 'aromaluxe.exitShown.v1'
  };
  const CRM = {
    hubspotPortalId: (typeof window !== 'undefined' && window.HUBSPOT_PORTAL_ID) || null,
    leadWebhookUrl: (typeof window !== 'undefined' && window.LEAD_WEBHOOK_URL) || null
  };

  function readStorage(key, fallback) {
    try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; }
  }
  function writeStorage(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch {}
  }
  function loadScript(src) {
    return new Promise((resolve, reject) => {
      try {
        const s = document.createElement('script');
        s.src = src;
        s.async = true;
        s.onload = () => resolve();
        s.onerror = () => reject(new Error('Failed to load ' + src));
        document.head.appendChild(s);
      } catch (e) { reject(e); }
    });
  }
  async function setupHubSpot() {
    if (!CRM.hubspotPortalId) return;
    try { await loadScript('https://js.hs-scripts.com/' + CRM.hubspotPortalId + '.js'); }
    catch (e) { console.warn('HubSpot load failed', e); }
  }

  function onReady(fn) {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', fn);
    else fn();
  }

  function trackProductInteraction(productEl) {
    const productId = productEl?.getAttribute('data-id');
    const cats = (productEl?.getAttribute('data-categories') || '').split(',').map(s => s.trim()).filter(Boolean);
    if (!productId && cats.length === 0) return;
    const history = readStorage(STORAGE_KEYS.history, { productIds: [], categories: {} });
    if (productId && !history.productIds.includes(productId)) history.productIds.push(productId);
    for (const c of cats) history.categories[c] = (history.categories[c] || 0) + 1;
    writeStorage(STORAGE_KEYS.history, history);
  }

  function hydrateRecommended() {
    const container = document.querySelector('#recommended-grid');
    if (!container) return;
    const history = readStorage(STORAGE_KEYS.history, { productIds: [], categories: {} });
    const categoryScores = Object.entries(history.categories).sort((a,b) => b[1]-a[1]).map(([k]) => k);

    const all = Array.from(document.querySelectorAll('.product-card'));
    const ranked = all.slice().sort((a,b) => {
      const ac = (a.getAttribute('data-categories')||'').split(',');
      const bc = (b.getAttribute('data-categories')||'').split(',');
      const as = ac.reduce((sum,c) => sum + Math.max(0, categoryScores.indexOf(c)), 0);
      const bs = bc.reduce((sum,c) => sum + Math.max(0, categoryScores.indexOf(c)), 0);
      return as - bs;
    });

    const chosen = (categoryScores.length ? ranked : all).slice(0, 8);
    container.innerHTML = '';
    chosen.forEach(el => {
      const clone = el.cloneNode(true);
      clone.querySelectorAll('button, a').forEach(btn => btn.addEventListener('click', () => trackProductInteraction(el)));
      container.appendChild(clone);
    });
  }

  function setupProductTracking() {
    document.querySelectorAll('.product-card').forEach(card => {
      card.addEventListener('click', (e) => {
        const target = e.target;
        if (target.closest('button') || target.closest('a')) {
          trackProductInteraction(card);
        }
      });
    });
  }

  function setupExitIntent() {
    if (sessionStorage.getItem(STORAGE_KEYS.exitShown)) return;
    const modal = document.querySelector('#exit-intent-modal');
    if (!modal) return;
    const open = () => {
      modal.classList.add('show');
      sessionStorage.setItem(STORAGE_KEYS.exitShown, '1');
    };
    const close = () => modal.classList.remove('show');

    const closeBtns = modal.querySelectorAll('[data-close]');
    closeBtns.forEach(btn => btn.addEventListener('click', close));

    document.addEventListener('mouseleave', (e) => {
      if (e.clientY <= 0) open();
    });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') close(); });

    // Mobile scroll-based exit intent
    let scrolled = false;
    window.addEventListener('scroll', () => { scrolled = true; }, { passive: true });
    window.addEventListener('beforeunload', () => { if (scrolled) open(); });
  }

  function setupStickyCta() {
    const cta = document.querySelector('#stickyCta');
    if (!cta) return;
    const openModal = () => document.querySelector('#consult-modal')?.classList.add('show');
    cta.addEventListener('click', (e) => { e.preventDefault(); openModal(); });
  }

  function setupMobileNav() {
    const burger = document.querySelector('#burger');
    const nav = document.querySelector('.nav');
    if (!burger || !nav) return;
    burger.addEventListener('click', () => nav.classList.toggle('show'));
  }

  function setupForms() {
    document.querySelectorAll('[data-form="lead"]').forEach(form => {
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        const fd = new FormData(form);
        const payload = Object.fromEntries(fd.entries());
        console.log('Lead captured (replace with HubSpot):', payload);
        if (CRM.leadWebhookUrl) {
          try {
            fetch(CRM.leadWebhookUrl, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ source: location.href, ...payload })
            }).catch(() => {});
          } catch {}
        }
        form.reset();
        const note = document.createElement('div');
        note.textContent = 'Спасибо! Мы свяжемся с вами в ближайшее время.';
        note.style.marginTop = '8px';
        note.style.color = 'var(--gold-2)';
        form.appendChild(note);
      });
    });
  }

  function init() {
    setupMobileNav();
    setupProductTracking();
    hydrateRecommended();
    setupExitIntent();
    setupStickyCta();
    setupForms();
    setupHubSpot();
  }

  onReady(() => {
    try { init(); } catch (e) { console.error(e); }
    // Defer heavy work
    (window.requestIdleCallback || window.setTimeout)(() => {
      try { hydrateRecommended(); } catch {}
    }, 1);
  });
})();