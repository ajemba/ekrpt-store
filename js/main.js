/* ═══════════════════════════════════════
   EKRPT Networking Labs — Shared JS
   ═══════════════════════════════════════ */

/* ── PRODUCTS DATA ── */
const EKRPT_PRODUCTS = [
  { id:1, cat:'starlink', name:'Starlink Mini Kit',          desc:'Ultra-compact portable dish, ideal for travel, vehicles, and remote sites.',                       price:280000, badge:'new',     emoji:'📡', stock:8  },
  { id:2, cat:'starlink', name:'Starlink Gen3 Standard',     desc:'Third-generation dish. Faster speeds, improved weather resistance, self-orienting.',               price:420000, badge:'hot',     emoji:'🛰️', stock:5  },
  { id:3, cat:'starlink', name:'Starlink V4 High Perf.',     desc:'Latest V4 hardware for enterprises and high-demand connectivity. Gigabit capable.',                price:520000, badge:'new',     emoji:'📡', stock:3  },
  { id:4, cat:'router',   name:'EKRPT ProRouter X1',         desc:'EKRPT branded dual-band AC1200. Optimized firmware for demanding network conditions.',                  price:28500,  badge:'branded', emoji:'📶', stock:20 },
  { id:5, cat:'router',   name:'EKRPT MeshNode 3-Pack',      desc:'Whole-home mesh kit. Covers 450sqm seamlessly. Easy app setup.',                                   price:65000,  badge:'branded', emoji:'🌐', stock:12 },
  { id:6, cat:'mifi',     name:'EKRPT MiFi Pro 4G+',         desc:'EKRPT branded 4G+ MiFi. Supports 10 devices simultaneously. 3000mAh battery.',                    price:18500,  badge:'branded', emoji:'📱', stock:30 },
  { id:7, cat:'mifi',     name:'EKRPT MiFi 5G',              desc:'Next-gen 5G pocket router. Sub-6GHz SA/NSA dual-mode. Up to 2.1Gbps.',                            price:34000,  badge:'new',     emoji:'⚡', stock:14 },
  { id:8, cat:'mifi',     name:'EKRPT USB LTE Modem',        desc:'Plug-and-play LTE USB modem. CAT6. 300Mbps download. Works with any laptop.',                      price:9500,   badge:null,      emoji:'🔌', stock:40 },
];

const BADGE_LABELS = { new:'New', hot:'Hot', branded:'EKRPT' };
const CAT_LABELS   = { starlink:'Starlink Hardware', router:'Router', mifi:'MiFi / Modem', accessories:'Accessories' };

/* ── CART ── */
const Cart = (() => {
  let items = JSON.parse(localStorage.getItem('ekrpt_cart') || '{}');

  const save = () => localStorage.setItem('ekrpt_cart', JSON.stringify(items));

  const add = (id) => {
    items[id] = (items[id] || 0) + 1;
    save(); updateBadge();
    const p = (typeof EKRPT_PRODUCTS !== 'undefined' && EKRPT_PRODUCTS.find(x => x.id == id))
           || (typeof Store !== 'undefined' && Store.find && Store.find(id))
           || (typeof _prod !== 'undefined' && _prod && _prod.id == id ? _prod : null);
    showToast(p && p.name ? ('Added ' + p.name + ' to cart ✓') : 'Added to cart ✓');
  };

  const remove = (id) => { delete items[id]; save(); updateBadge(); };

  const qty = (id) => items[id] || 0;

  const all = () => Object.entries(items).map(([id, qty]) => ({
    product: EKRPT_PRODUCTS.find(x => x.id == id), qty
  })).filter(x => x.product);

  const total = () => all().reduce((s, {product, qty}) => s + product.price * qty, 0);

  const count = () => Object.values(items).reduce((a,b) => a+b, 0);

  const clear = () => { items = {}; save(); updateBadge(); };

  const updateBadge = () => {
    document.querySelectorAll('.cart-count').forEach(el => el.textContent = count());
  };

  return { add, remove, qty, all, total, count, clear, updateBadge };
})();

/* ── TOAST ── */
let _toastTimer;
function showToast(msg, type = 'default') {
  let el = document.getElementById('global-toast');
  if (!el) {
    el = document.createElement('div');
    el.id = 'global-toast';
    el.className = 'toast';
    document.body.appendChild(el);
  }
  el.textContent = msg;
  el.style.borderLeftColor = type === 'error' ? 'var(--red)' : 'var(--blue)';
  el.classList.add('show');
  clearTimeout(_toastTimer);
  _toastTimer = setTimeout(() => el.classList.remove('show'), 3000);
}

/* ── NAV ACTIVE STATE ── */
function setActiveNav() {
  const page = location.pathname.split('/').pop() || 'index.html';
  document.querySelectorAll('.nav-links a').forEach(a => {
    const href = a.getAttribute('href');
    a.classList.toggle('active', href === page || (page === '' && href === 'index.html'));
  });
  Cart.updateBadge();
}

/* ── PRODUCT CARD RENDERER ── */
function renderProductCard(p, addFn) {
  const imgArea = p.image
    ? `<img src="${p.image}" alt="${p.name} — buy ${p.cat||'networking hardware'} at EKRPT Networking Labs Nigeria" class="product-photo" loading="lazy"/>`
    : `<span class="product-emoji">${p.emoji}</span>`;
  const link = `/product.html?${p.slug?`slug=${encodeURIComponent(p.slug)}`:`id=${p.id}`}`;
  return `
    <div class="product-card">
      <a href="${link}" class="product-img${p.image ? ' has-photo' : ''}" style="text-decoration:none;display:block">
        ${p.badge ? `<span class="product-badge badge-${p.badge}">${BADGE_LABELS[p.badge]}</span>` : ''}
        ${imgArea}
      </a>
      <div class="product-body">
        <div class="product-cat">${CAT_LABELS[p.cat] || p.cat}</div>
        <a href="${link}" class="product-name" style="text-decoration:none;color:inherit;cursor:pointer">${p.name}</a>
        <div class="product-desc">${p.desc}</div>
        <div class="product-footer">
          <div class="product-price">
            ₦${p.price.toLocaleString()}
            <small>+ delivery</small>
          </div>
          <button class="add-to-cart" data-add-id="${p.id}">Add to cart</button>
        </div>
      </div>
    </div>`;
}

document.addEventListener('click', function(e) {
  var b = e.target.closest('.add-to-cart');
  if (b && b.dataset.addId) { LiveCart.add(b.dataset.addId); }
});

/* ── SHARED NAV HTML ── */
const NAV_HTML = `
<nav class="nav">
  <a class="nav-logo" href="/index.html">
    <img class="nav-logo-img" data-logo src="/img/logo-ekrpt.png" alt="EKRPT Networking Labs" />
    <div class="nav-logo-mark">
      <svg viewBox="0 0 20 20"><path d="M2 4h16v2H2zM2 9h10v2H2zM2 14h13v2H2z"/></svg>
    </div>
    <span class="nav-brand">EKRPT <span>Labs</span></span>
  </a>
  <div class="nav-links">
    <a href="/index.html">Home</a>
    <a href="/products.html">Products</a>
    <a href="/roadmap.html">Roadmap</a>
    <a href="/about.html">About Us</a>
    <a href="/contact.html">Contact</a>
  </div>
  <div class="nav-actions">
    <button class="cart-btn" onclick="location.href='/checkout.html'">
      🛒 Cart <span class="cart-count">0</span>
    </button>
    <a href="/login.html" class="btn btn-secondary btn-sm">Sign in</a>
    <a href="/login.html#signup" class="btn btn-primary btn-sm">Get started</a>
  </div>
  <button class="nav-hamburger" aria-label="Menu" onclick="toggleMobileNav()">
    <span></span><span></span><span></span>
  </button>
</nav>
<div class="mobile-nav" id="mobile-nav">
  <a href="/index.html">Home</a>
  <a href="/products.html">Products</a>
  <a href="/roadmap.html">Roadmap</a>
  <a href="/about.html">About Us</a>
  <a href="/contact.html">Contact</a>
  <a href="/faq.html">FAQ</a>
  <div class="mobile-nav-actions">
    <a href="/checkout.html" class="btn btn-secondary btn-sm">🛒 Cart (<span class="cart-count">0</span>)</a>
  </div>
  <div class="mobile-nav-actions">
    <a href="/login.html" class="btn btn-secondary btn-sm">Sign in</a>
    <a href="/login.html#signup" class="btn btn-primary btn-sm">Get started</a>
  </div>
</div>`;

/* ── SHARED FOOTER HTML ── */
const FOOTER_HTML = `
<footer>
  <div class="footer-inner">
    <div class="footer-grid">
      <div>
        <div class="footer-logo-wrap">
          <img src="/img/logo-ekrpt.png" alt="EKRPT Networking Labs" style="height:34px;width:auto"/>
        </div>
        <div class="footer-about">Performance networking hardware engineered for gamers, businesses, and everyone who refuses to compromise on connection.</div>
        <a class="footer-email" href="mailto:office@ekrpt.com">✉ office@ekrpt.com</a>
      </div>
      <div class="footer-col">
        <h4>Products</h4>
        <a href="/products.html">Starlink Mini</a>
        <a href="/products.html">Starlink Gen3</a>
        <a href="/products.html">Starlink V4</a>
        <a href="/products.html">EKRPT Routers</a>
        <a href="/products.html">MiFi Devices</a>
        <a href="/products.html">Modems</a>
      </div>
      <div class="footer-col">
        <h4>Company</h4>
        <a href="/about.html">About Us</a>
        <a href="/about.html#mission">Our Mission</a>
        <a href="/contact.html">Contact</a>
        <a href="#">B2B / Bulk Orders</a>
        <a href="#">Become a Reseller</a>
      </div>
      <div class="footer-col">
        <h4>Support</h4>
        <a href="/checkout.html">Track Order</a>
        <a href="/returns.html">Return Policy</a>
        <a href="/warranty.html">Warranty</a>
        <a href="/shipping.html">Shipping Policy</a>
        <a href="/documentation.html">Documentation</a>
        <a href="/faq.html">FAQ</a>
        <a href="/contact.html">Help Centre</a>
      </div>
    </div>
    <div class="footer-bottom">
      <div class="footer-copy">© 2026 EKRPT Networking Labs. All rights reserved.</div>
      <div class="footer-badges">
        <span class="f-badge">CAC REGISTERED</span>
        <span class="f-badge">LICENSED</span>
        <span class="f-badge">SSL SECURED</span>
      </div>
    </div>
  </div>
</footer>`;

/* ── INJECT NAV + FOOTER ── */
document.addEventListener('DOMContentLoaded', () => {
  const navMount = document.getElementById('nav-mount');
  const footerMount = document.getElementById('footer-mount');
  if (navMount) navMount.innerHTML = NAV_HTML;
  if (footerMount) footerMount.innerHTML = FOOTER_HTML;
  setActiveNav();
  refreshNavAuth();
});

/* Swap the Sign in / Get started buttons for account links when logged in. */
async function refreshNavAuth() {
  try {
    if (typeof Auth === 'undefined' || !Auth.getUser) return;
    const u = await Auth.getUser();
    const actions = document.querySelector('.nav-actions');
    if (!actions) return;
    const cartBtn = actions.querySelector('.cart-btn');
    const cartHTML = cartBtn ? cartBtn.outerHTML : '';
    if (u) {
      actions.innerHTML = cartHTML +
        '<a href="/account/index.html" class="btn btn-secondary btn-sm">My Account</a>' +
        '<button class="btn btn-primary btn-sm" onclick="Auth.signOut()">Sign out</button>';
    } else {
      actions.innerHTML = cartHTML +
        '<a href="/login.html" class="btn btn-secondary btn-sm">Sign in</a>' +
        '<a href="/login.html#signup" class="btn btn-primary btn-sm">Get started</a>';
    }
    LiveCart?.updateBadge?.();
    // mirror auth state into the mobile menu's second actions row
    var mobActions=document.querySelectorAll('.mobile-nav .mobile-nav-actions');
    var mAuth=mobActions&&mobActions[1];
    if(mAuth){
      mAuth.innerHTML = u
        ? '<a href="/account/index.html" class="btn btn-secondary btn-sm">My Account</a><button class="btn btn-primary btn-sm" onclick="Auth.signOut()">Sign out</button>'
        : '<a href="/login.html" class="btn btn-secondary btn-sm">Sign in</a><a href="/login.html#signup" class="btn btn-primary btn-sm">Get started</a>';
    }
  } catch (e) {}
}

/* ── MOBILE NAV TOGGLE ── */
function toggleMobileNav(){
  var m=document.getElementById('mobile-nav');
  var h=document.querySelector('.nav-hamburger');
  if(!m)return;
  var open=m.classList.toggle('open');
  if(h)h.classList.toggle('active',open);
  document.body.style.overflow=open?'hidden':'';
}
document.addEventListener('click',function(e){
  var m=document.getElementById('mobile-nav');
  if(m&&m.classList.contains('open')&&e.target.closest('#mobile-nav a')){
    m.classList.remove('open');
    var h=document.querySelector('.nav-hamburger');if(h)h.classList.remove('active');
    document.body.style.overflow='';
  }
});

/* ── ADMIN/PORTAL SIDEBAR TOGGLE (mobile) ── */
function togglePortalSidebar(){
  var s=document.querySelector('.pside');
  if(!s)return;
  s.classList.toggle('open');
}
// close sidebar when a nav link is tapped (mobile) or when tapping outside it
document.addEventListener('click',function(e){
  var s=document.querySelector('.pside');
  if(!s||!s.classList.contains('open'))return;
  if(e.target.closest('.pside-link')){ s.classList.remove('open'); return; }
  if(!e.target.closest('.pside')&&!e.target.closest('.ptop-burger')){ s.classList.remove('open'); }
});
