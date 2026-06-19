/* ═══════════════════════════════════════════════════════════
   EKRPT — Cookie Consent (Google Consent Mode v2)
   Self-contained. No dependencies. Loads on every page.
   - Sets analytics/ad storage to DENIED by default (must run
     before gtag config; see the consent-default snippet in <head>).
   - Shows a banner until the visitor chooses.
   - Accept  → grants analytics_storage, GA4 begins measuring.
   - Reject  → leaves analytics denied; GA4 stays in cookieless ping mode.
   - Choice remembered in localStorage ('ekrpt_consent').
   ═══════════════════════════════════════════════════════════ */
(function () {
  var KEY = 'ekrpt_consent';
  var stored = null;
  try { stored = localStorage.getItem(KEY); } catch (e) {}

  function gtagSafe() {
    if (typeof gtag === 'function') { gtag.apply(window, arguments); }
  }

  // Apply a saved choice immediately on load (so returning visitors
  // get their analytics state without seeing the banner again).
  function applyConsent(granted) {
    gtagSafe('consent', 'update', {
      analytics_storage: granted ? 'granted' : 'denied',
      ad_storage: 'denied',          // EKRPT does not run ad cookies
      ad_user_data: 'denied',
      ad_personalization: 'denied'
    });
  }

  if (stored === 'granted') { applyConsent(true);  return; }
  if (stored === 'denied')  { applyConsent(false); return; }

  // ── No choice yet: build the banner ──
  function build() {
    if (document.getElementById('ekrpt-cc')) return;
    var bar = document.createElement('div');
    bar.id = 'ekrpt-cc';
    bar.setAttribute('role', 'dialog');
    bar.setAttribute('aria-label', 'Cookie consent');
    bar.innerHTML =
      '<div class="cc-inner">' +
        '<div class="cc-text">' +
          'We use cookies to understand how the site is used and improve your experience. ' +
          'You can accept analytics cookies or continue with only the essentials. ' +
          '<a href="/privacy.html">Learn more</a>.' +
        '</div>' +
        '<div class="cc-actions">' +
          '<button type="button" class="cc-btn cc-reject" id="cc-reject">Essentials only</button>' +
          '<button type="button" class="cc-btn cc-accept" id="cc-accept">Accept all</button>' +
        '</div>' +
      '</div>';
    document.body.appendChild(bar);

    function choose(granted) {
      try { localStorage.setItem(KEY, granted ? 'granted' : 'denied'); } catch (e) {}
      applyConsent(granted);
      bar.classList.add('cc-hide');
      setTimeout(function () { if (bar.parentNode) bar.parentNode.removeChild(bar); }, 300);
      // expose a way to reopen (e.g. from a footer "Cookie settings" link)
    }
    document.getElementById('cc-accept').addEventListener('click', function () { choose(true); });
    document.getElementById('cc-reject').addEventListener('click', function () { choose(false); });
    requestAnimationFrame(function () { bar.classList.add('cc-show'); });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', build);
  } else { build(); }

  // Allow a "Cookie settings" link anywhere to reopen the banner:
  // <a href="#" onclick="EKRPTcookies()">Cookie settings</a>
  window.EKRPTcookies = function () {
    try { localStorage.removeItem(KEY); } catch (e) {}
    build();
  };
})();
