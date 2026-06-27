/* ═══════════════════════════════════════════════════════════
   EKRPT → CodaSMS redirect notice
   Shows a one-time modal informing old SMS-verification clients
   that the service has moved to CodaSMS.com. After dismissal,
   a slim persistent bar remains so they can still find it.
   Self-contained: injects its own styles + markup. home.html only.
   ═══════════════════════════════════════════════════════════ */
(function () {
  var KEY = 'ekrpt_codasms_seen';
  var URL = 'https://codasms.com';
  var seen = false;
  try { seen = localStorage.getItem(KEY) === '1'; } catch (e) {}

  var css = ''
    + '.cds-ov{position:fixed;inset:0;z-index:10000;background:rgba(0,0,0,.55);display:flex;align-items:center;justify-content:center;padding:20px;opacity:0;transition:opacity .25s}'
    + '.cds-ov.show{opacity:1}'
    + '.cds-modal{background:#0d0f14;border:1px solid rgba(255,255,255,.12);border-radius:16px;max-width:380px;width:100%;padding:28px 24px;text-align:center;transform:translateY(12px);transition:transform .25s}'
    + '.cds-ov.show .cds-modal{transform:translateY(0)}'
    + '.cds-ic{width:54px;height:54px;border-radius:50%;background:rgba(245,158,60,.12);display:flex;align-items:center;justify-content:center;margin:0 auto 16px;font-size:26px}'
    + '.cds-kicker{font-size:12px;letter-spacing:1px;color:#f59e3c;margin-bottom:8px;font-weight:600}'
    + '.cds-h{font-size:19px;font-weight:600;color:#fff;margin:0 0 10px;line-height:1.4}'
    + '.cds-p{font-size:14px;color:#9aa4b2;line-height:1.6;margin:0 0 22px}'
    + '.cds-p b{color:#fff;font-weight:600}'
    + '.cds-go{display:block;background:#f59e3c;color:#1a1205;text-decoration:none;font-weight:600;font-size:15px;padding:13px;border-radius:8px;margin-bottom:10px;transition:background .15s}'
    + '.cds-go:hover{background:#ffae4d}'
    + '.cds-no{display:block;color:#8b94a3;text-decoration:none;font-size:13px;padding:8px;background:none;border:none;width:100%;cursor:pointer;font-family:inherit}'
    + '.cds-no:hover{color:#c4ccd8}'
    + '.cds-bar{position:fixed;left:0;right:0;bottom:0;z-index:9998;background:#11141a;border-top:1px solid rgba(245,158,60,.3);padding:11px 16px;display:flex;align-items:center;gap:12px;flex-wrap:wrap;transform:translateY(100%);transition:transform .3s}'
    + '.cds-bar.show{transform:translateY(0)}'
    + '.cds-bar-ic{font-size:18px;color:#f59e3c}'
    + '.cds-bar-tx{font-size:13px;color:#c4ccd8;flex:1;min-width:170px}'
    + '.cds-bar-go{background:rgba(245,158,60,.14);color:#f59e3c;text-decoration:none;font-size:13px;font-weight:600;padding:7px 14px;border-radius:6px;white-space:nowrap}'
    + '.cds-bar-go:hover{background:rgba(245,158,60,.24)}'
    + '.cds-bar-x{background:none;border:none;color:#5f6672;cursor:pointer;font-size:18px;line-height:1;padding:4px}'
    + '.cds-bar-x:hover{color:#c4ccd8}';

  var style = document.createElement('style');
  style.textContent = css;
  document.head.appendChild(style);

  function showBar() {
    if (document.getElementById('cds-bar')) {
      document.getElementById('cds-bar').classList.add('show');
      return;
    }
    var bar = document.createElement('div');
    bar.className = 'cds-bar';
    bar.id = 'cds-bar';
    bar.innerHTML =
      '<span class="cds-bar-ic">ⓘ</span>' +
      '<span class="cds-bar-tx">Looking for SMS verification? It moved to CodaSMS.</span>' +
      '<a class="cds-bar-go" href="' + URL + '">Visit CodaSMS ↗</a>' +
      '<button class="cds-bar-x" aria-label="Dismiss">✕</button>';
    document.body.appendChild(bar);
    requestAnimationFrame(function () { bar.classList.add('show'); });
    bar.querySelector('.cds-bar-x').addEventListener('click', function () {
      bar.classList.remove('show');
    });
  }

  function dismissModal(ov) {
    try { localStorage.setItem(KEY, '1'); } catch (e) {}
    ov.classList.remove('show');
    setTimeout(function () { if (ov.parentNode) ov.parentNode.removeChild(ov); showBar(); }, 250);
  }

  function showModal() {
    var ov = document.createElement('div');
    ov.className = 'cds-ov';
    ov.id = 'cds-ov';
    ov.innerHTML =
      '<div class="cds-modal" role="dialog" aria-label="SMS verification has moved to CodaSMS">' +
        '<div class="cds-ic">✉️</div>' +
        '<div class="cds-kicker">SMS VERIFICATION HAS MOVED</div>' +
        '<h2 class="cds-h">Looking for phone numbers &amp; SMS verification?</h2>' +
        '<p class="cds-p">EKRPT\u2019s EkrptSMS verification service is now <b>CodaSMS</b> \u2014 rebranded, faster, and fully upgraded. EKRPT.com is now our networking hardware &amp; tools store.</p>' +
        '<a class="cds-go" href="' + URL + '">Go to CodaSMS.com \u2192</a>' +
        '<button class="cds-no" type="button">No thanks, I\u2019m here for networking gear</button>' +
      '</div>';
    document.body.appendChild(ov);
    requestAnimationFrame(function () { ov.classList.add('show'); });

    ov.querySelector('.cds-no').addEventListener('click', function () { dismissModal(ov); });
    ov.querySelector('.cds-go').addEventListener('click', function () {
      try { localStorage.setItem(KEY, '1'); } catch (e) {}
    });
    ov.addEventListener('click', function (e) { if (e.target === ov) dismissModal(ov); });
  }

  function init() {
    if (seen) { showBar(); }
    else { showModal(); }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else { init(); }
})();
