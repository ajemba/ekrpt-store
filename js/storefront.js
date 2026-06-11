/* ═══════════════════════════════════════════════════════════
   EKRPT — Storefront live data layer
   Loads real products from Supabase and wires cart + checkout
   to real orders. Falls back to the demo seed if the DB is empty
   or not yet configured, so pages never break.
   Include AFTER config.js, main.js, auth.js, store.js.
   ═══════════════════════════════════════════════════════════ */

const Storefront = (() => {

  let _loaded = false;

  // Map a Supabase product row → the shape the page renderers expect
  const normalize = (row) => ({
    id: row.id,
    cat: row.category || 'other',
    name: row.name,
    desc: row.description || '',
    price: Number(row.price) || 0,
    badge: row.badge || (row.featured ? 'hot' : null),
    emoji: row.emoji || '📦',
    stock: row.stock != null ? row.stock : 0,
    sku: row.sku || '',
    image: row.image_url || row.cover_image || null,
    slug: row.slug || null,
    _live: true,
  });

  // Load live products; replace the in-memory catalog used by renderers.
  const loadProducts = async () => {
    try {
      if (typeof getSupabase !== 'function') return getCatalog();
      const rows = await Products.getAll();           // active products only
      if (Array.isArray(rows) && rows.length) {
        const live = rows.map(normalize);
        // Replace the global catalog so renderProductCard / Cart keep working
        if (typeof window !== 'undefined') window.EKRPT_PRODUCTS = live;
        _loaded = true;
        return live;
      }
    } catch (e) {
      console.warn('Live products unavailable, using demo catalog.', e?.message);
    }
    return getCatalog(); // fall back to seed already in EKRPT_PRODUCTS
  };

  const getCatalog = () => (typeof window !== 'undefined' && window.EKRPT_PRODUCTS) || [];
  const isLive = () => _loaded;
  const find = (id) => getCatalog().find(p => String(p.id) === String(id));

  return { loadProducts, getCatalog, isLive, find, normalize };
})();


/* ── LIVE CART ───────────────────────────────────────────────
   Stores a full snapshot of each line (id, name, price, emoji, qty)
   so checkout works even after navigation / page reload, and so the
   order payload matches Orders.create({ items:[{...,price,qty}] }).
*/
const LiveCart = (() => {
  const KEY = 'ekrpt_cart_v2';
  let lines = JSON.parse(localStorage.getItem(KEY) || '{}'); // { id: {id,name,price,emoji,qty,sku} }

  const save = () => { localStorage.setItem(KEY, JSON.stringify(lines)); updateBadge(); };

  const add = (id, qty = 1, productObj = null) => {
    const p = Storefront.find(id) || productObj;
    if (!p) { showToast('Product not found', 'error'); return; }
    if (p.stock != null && p.stock <= 0) { showToast(p.name + ' is out of stock', 'error'); return; }
    if (lines[id]) lines[id].qty += qty;
    else lines[id] = { id: p.id, name: p.name, price: p.price, emoji: p.emoji, sku: p.sku, qty };
    save();
    showToast('Added ' + p.name + ' to cart ✓');
  };

  const setQty = (id, qty) => {
    if (qty <= 0) { delete lines[id]; }
    else if (lines[id]) lines[id].qty = qty;
    save();
  };

  const changeQty = (id, delta) => {
    if (!lines[id]) return;
    setQty(id, lines[id].qty + delta);
  };

  const remove = (id) => { delete lines[id]; save(); };
  const clear = () => { lines = {}; save(); };
  const all = () => Object.values(lines);
  const count = () => Object.values(lines).reduce((a, l) => a + l.qty, 0);
  const subtotal = () => Object.values(lines).reduce((s, l) => s + l.price * l.qty, 0);

  const updateBadge = () => {
    document.querySelectorAll('.cart-count').forEach(el => el.textContent = count());
  };

  // Migrate an old demo cart (ekrpt_cart: {id:qty}) into this one, once.
  const migrateLegacy = () => {
    try {
      const old = JSON.parse(localStorage.getItem('ekrpt_cart') || '{}');
      if (Object.keys(old).length && !Object.keys(lines).length) {
        Object.entries(old).forEach(([id, qty]) => {
          const p = Storefront.find(id);
          if (p) lines[id] = { id: p.id, name: p.name, price: p.price, emoji: p.emoji, sku: p.sku, qty };
        });
        localStorage.removeItem('ekrpt_cart');
        save();
      }
    } catch (e) {}
  };

  return { add, setQty, changeQty, remove, clear, all, count, subtotal, updateBadge, migrateLegacy };
})();


/* ── CHECKOUT ────────────────────────────────────────────────
   Builds the order payload from LiveCart and creates a real order,
   then hands off to the selected payment gateway.
*/
const Checkout = (() => {

  const buildItems = () => LiveCart.all().map(l => ({
    id: l.id, name: l.name, price: l.price, qty: l.qty, emoji: l.emoji, sku: l.sku,
  }));

  // Create the order row (status: pending, payment: unpaid) and return it.
  const createOrder = async ({ shipping, paymentMethod, promoCode } = {}) => {
    const items = buildItems();
    if (!items.length) throw new Error('Your cart is empty');
    const order = await Orders.create({ items, shipping, paymentMethod, promoCode });
    return order;
  };

  // Full place-order flow: create order → pay → on success confirm + clear cart.
  const placeOrder = async ({ gateway, shipping, promoCode, crypto, onSuccess, onClose } = {}) => {
    const order = await createOrder({ shipping, paymentMethod: gateway, promoCode });

    // Hand off to the matching payment method (Payments module is optional;
    // if not configured we still have a pending order the admin can confirm).
    if (typeof Payments === 'undefined') {
      return { order, paid: false, note: 'Payment module not configured; order saved as pending.' };
    }

    const email = shipping?.email || Auth.getGuestSession?.()?.email || '';
    const phone = shipping?.phone || '';
    const name  = shipping?.name  || '';
    const amountNGN = order.total;
    const common = {
      email, amountNGN, orderId: order.id, orderNumber: order.order_number,
      onSuccess: async (ref) => {
        try { await Orders.confirmPayment(order.id, ref); } catch (e) {}
        LiveCart.clear();
        if (onSuccess) onSuccess(order, ref);
      },
      onClose: () => { if (onClose) onClose(order); },
    };

    try {
      const g = gateway === 'ps' ? 'paystack' : gateway === 'fw' ? 'flutterwave'
              : gateway === 'pp' ? 'paypal' : gateway === 'cr' ? 'cryptomus' : gateway;
      if (g === 'paystack') {
        Payments.payWithPaystack(common);
      } else if (g === 'flutterwave') {
        Payments.payWithFlutterwave({ ...common, phone, name });
      } else if (g === 'paypal') {
        Payments.renderPaypalButton({ ...common, containerSelector: '#paypal-button-container' });
      } else if (g === 'cryptomus') {
        const invoice = await Payments.createCryptoInvoice({ amountNGN, orderId: order.id, orderNumber: order.order_number, currency: crypto || 'USDT' });
        return { order, invoice, paid: false };
      }
      return { order, paid: true };
    } catch (e) {
      return { order, paid: false, error: e.message };
    }
  };

  return { buildItems, createOrder, placeOrder };
})();
