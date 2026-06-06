/* ═══════════════════════════════════════════════════════════
   EKRPT — SPECTRE Gaming Hero controller
   Slideshow + presale countdown + reservation capture.
   ═══════════════════════════════════════════════════════════ */
(function () {

  // ── SLIDESHOW ──
  const slides = Array.from(document.querySelectorAll('.sh-slide'));
  const dots   = Array.from(document.querySelectorAll('.sh-dot'));
  const thumbs = Array.from(document.querySelectorAll('.sh-thumb'));
  let idx = 0, timer = null;

  function show(n) {
    idx = (n + slides.length) % slides.length;
    slides.forEach((s, i) => s.classList.toggle('active', i === idx));
    dots.forEach((d, i) => d.classList.toggle('active', i === idx));
    thumbs.forEach((t, i) => t.classList.toggle('active', i === idx));
  }
  function next() { show(idx + 1); }
  function start() { stop(); timer = setInterval(next, 4500); }
  function stop() { if (timer) clearInterval(timer); }

  dots.forEach((d, i) => d.addEventListener('click', () => { show(i); start(); }));
  thumbs.forEach((t, i) => t.addEventListener('click', () => { show(i); start(); }));

  if (slides.length) { show(0); start(); }

  // ── COUNTDOWN ──
  // Target date: read from data-launch on the hero, else default 30 days out.
  const hero = document.querySelector('.spectre-hero');
  let target;
  const ds = hero && hero.getAttribute('data-launch');
  if (ds && !isNaN(Date.parse(ds))) {
    target = new Date(ds).getTime();
  } else {
    target = Date.now() + 30 * 24 * 60 * 60 * 1000; // 30 days from now
  }

  const elD = document.getElementById('cd-d');
  const elH = document.getElementById('cd-h');
  const elM = document.getElementById('cd-m');
  const elS = document.getElementById('cd-s');

  function pad(n) { return String(n).padStart(2, '0'); }
  function setUnit(el, val) {
    if (!el) return;
    const txt = pad(val);
    if (el.textContent !== txt) {
      el.textContent = txt;
      const unit = el.closest('.sh-cd-unit');
      if (unit) { unit.classList.remove('flip'); void unit.offsetWidth; unit.classList.add('flip'); }
    }
  }
  function tick() {
    const diff = target - Date.now();
    if (diff <= 0) {
      setUnit(elD, 0); setUnit(elH, 0); setUnit(elM, 0); setUnit(elS, 0);
      const status = document.getElementById('sh-status-text');
      if (status) status.textContent = 'PRESALE IS LIVE';
      return;
    }
    const d = Math.floor(diff / 86400000);
    const h = Math.floor((diff % 86400000) / 3600000);
    const m = Math.floor((diff % 3600000) / 60000);
    const s = Math.floor((diff % 60000) / 1000);
    setUnit(elD, d); setUnit(elH, h); setUnit(elM, m); setUnit(elS, s);
  }
  tick(); setInterval(tick, 1000);

  // ── PRESALE RESERVATION ──
  window.reservePresale = async function () {
    const input = document.getElementById('sh-reserve-email');
    const email = input ? input.value.trim() : '';
    if (!email || !email.includes('@')) {
      if (typeof showToast === 'function') showToast('Enter a valid email to reserve', 'error');
      return;
    }
    try {
      if (typeof Newsletter !== 'undefined' && Newsletter.subscribe) {
        await Newsletter.subscribe(email, '', 'presale');
      }
    } catch (e) { /* don't expose backend errors */ }
    if (input) input.value = '';
    if (typeof showToast === 'function') showToast('You\'re on the presale list — watch your inbox ✓');
    // bump the social-proof counter for feedback
    const proof = document.getElementById('sh-proof-count');
    if (proof) { const n = parseInt(proof.textContent.replace(/\D/g, ''), 10) || 0; proof.textContent = (n + 1).toLocaleString(); }
  };

})();
