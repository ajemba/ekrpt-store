/* ═══════════════════════════════════════════════════════════
   EKRPT — Store / Database Module
   Products, Orders, Inventory via Supabase
   ═══════════════════════════════════════════════════════════ */

// ── PRODUCTS ─────────────────────────────────────────────────
const Products = (() => {

  const getAll = async (filters = {}) => {
    const sb = getSupabase();
    let q = sb.from('products').select('*').eq('is_active', true).order('created_at', { ascending: false });
    if (filters.category) q = q.eq('category', filters.category);
    if (filters.minPrice)  q = q.gte('price', filters.minPrice);
    if (filters.maxPrice)  q = q.lte('price', filters.maxPrice);
    if (filters.search)    q = q.ilike('name', `%${filters.search}%`);
    const { data, error } = await q;
    if (error) throw error;
    return data || [];
  };

  const getById = async (id) => {
    const sb = getSupabase();
    const { data, error } = await sb.from('products').select('*').eq('id', id).single();
    if (error) throw error;
    return data;
  };

  const getBySlug = async (slug) => {
    const sb = getSupabase();
    const { data, error } = await sb.from('products').select('*').eq('slug', slug).single();
    if (error) throw error;
    return data;
  };

  // Admin: create product
  const create = async (product) => {
    const sb = getSupabase();
    const slug = product.name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    const { data, error } = await sb.from('products').insert({ ...product, slug }).select().single();
    if (error) throw error;
    await Inventory.log(data.id, product.stock || 0, 'initial_stock', null);
    return data;
  };

  // Admin: update product
  const update = async (id, updates) => {
    const sb = getSupabase();
    const { data, error } = await sb.from('products').update({
      ...updates,
      updated_at: new Date().toISOString(),
    }).eq('id', id).select().single();
    if (error) throw error;
    return data;
  };

  // Admin: delete (soft delete)
  const remove = async (id) => {
    const sb = getSupabase();
    const { error } = await sb.from('products').update({ is_active: false }).eq('id', id);
    if (error) throw error;
  };

  // Admin: update stock only
  const updateStock = async (id, newStock, reason = 'adjustment') => {
    const sb = getSupabase();
    const current = await getById(id);
    const diff = newStock - current.stock;
    await sb.from('products').update({ stock: newStock }).eq('id', id);
    await Inventory.log(id, diff, reason, null);
  };

  return { getAll, getById, getBySlug, create, update, remove, updateStock };
})();

// ── INVENTORY ────────────────────────────────────────────────
const Inventory = (() => {

  const log = async (productId, change, reason, orderId) => {
    const sb = getSupabase();
    const session = await Auth.getSession();
    await sb.from('inventory_log').insert({
      product_id: productId,
      change,
      reason,
      order_id: orderId,
      admin_id: session?.user?.id || null,
    });
  };

  const getLowStock = async (threshold = 5) => {
    const sb = getSupabase();
    const { data } = await sb.from('products').select('*').lte('stock', threshold).eq('is_active', true);
    return data || [];
  };

  const getLog = async (productId, limit = 50) => {
    const sb = getSupabase();
    const { data } = await sb.from('inventory_log')
      .select('*, products(name)')
      .eq('product_id', productId)
      .order('created_at', { ascending: false })
      .limit(limit);
    return data || [];
  };

  return { log, getLowStock, getLog };
})();

// ── ORDERS ───────────────────────────────────────────────────
const Orders = (() => {

  const generateOrderNumber = () => {
    const y = new Date().getFullYear();
    const n = Math.floor(Math.random() * 9000) + 1000;
    return `EKRPT-${y}-${n}`;
  };

  // Create order (customer or guest)
  const create = async ({ items, shipping, paymentMethod, promoCode }) => {
    const sb = getSupabase();
    const session = await Auth.getSession();
    const guest = Auth.getGuestSession();

    const subtotal = items.reduce((s, i) => s + (i.price * i.qty), 0);

    // Validate promo code
    let discount = 0;
    if (promoCode) {
      const { data: promo } = await sb.from('promo_codes')
        .select('*').eq('code', promoCode.toUpperCase()).eq('is_active', true).single();
      if (promo && (!promo.expires_at || new Date(promo.expires_at) > new Date())) {
        discount = promo.discount_type === 'percent'
          ? (subtotal * promo.discount_value / 100)
          : promo.discount_value;
        await sb.from('promo_codes').update({ used_count: promo.used_count + 1 }).eq('id', promo.id);
      }
    }

    const deliveryFee = subtotal >= EKRPT_CONFIG.shipping.freeThreshold ? 0 : EKRPT_CONFIG.shipping.defaultFee;
    const total = subtotal + deliveryFee - discount;

    const orderData = {
      order_number: generateOrderNumber(),
      user_id:      session?.user?.id || null,
      guest_email:  guest?.email || null,
      guest_phone:  guest?.phone || null,
      items,
      subtotal,
      delivery_fee: deliveryFee,
      discount,
      total,
      status:         'pending',
      payment_method: paymentMethod,
      payment_status: 'unpaid',
      shipping_address: shipping,
    };

    const { data, error } = await sb.from('orders').insert(orderData).select().single();
    if (error) throw error;

    // Log order event (best-effort: never fail the order if this insert is blocked)
    try {
      await sb.from('order_events').insert({ order_id: data.id, status: 'pending', note: 'Order placed' });
    } catch (e) { /* non-fatal */ }

    return data;
  };

  // Get orders for current user
  const getMyOrders = async () => {
    const sb = getSupabase();
    const { data } = await sb.from('orders').select('*')
      .order('created_at', { ascending: false });
    return data || [];
  };

  // Get single order
  const getById = async (id) => {
    const sb = getSupabase();
    const { data, error } = await sb.from('orders').select('*, order_events(*)').eq('id', id).single();
    if (error) throw error;
    return data;
  };

  // Admin: get all orders
  const getAll = async (filters = {}) => {
    const sb = getSupabase();
    let q = sb.from('orders').select('*').order('created_at', { ascending: false });
    if (filters.status) q = q.eq('status', filters.status);
    if (filters.payment_status) q = q.eq('payment_status', filters.payment_status);
    if (filters.limit) q = q.limit(filters.limit);
    const { data } = await q;
    return data || [];
  };

  // Admin: update order status
  const updateStatus = async (id, status, note = '') => {
    const sb = getSupabase();
    await sb.from('orders').update({ status, updated_at: new Date().toISOString() }).eq('id', id);
    await sb.from('order_events').insert({ order_id: id, status, note });

    // If confirmed: deduct stock
    if (status === 'confirmed') {
      const order = await getById(id);
      for (const item of order.items) {
        const { data: product } = await sb.from('products').select('stock').eq('id', item.product_id).single();
        if (product) {
          const newStock = Math.max(0, product.stock - item.qty);
          await sb.from('products').update({ stock: newStock }).eq('id', item.product_id);
          await Inventory.log(item.product_id, -item.qty, 'sale', id);
        }
      }
    }
  };

  // Mark payment confirmed (called from webhook handler / manual)
  const confirmPayment = async (orderId, reference) => {
    const sb = getSupabase();
    await sb.from('orders').update({
      payment_status: 'paid',
      payment_reference: reference,
      status: 'confirmed',
      updated_at: new Date().toISOString(),
    }).eq('id', orderId);
    await sb.from('order_events').insert({ order_id: orderId, status: 'confirmed', note: 'Payment confirmed: ' + reference });
  };

  // Admin: get revenue stats
  const getStats = async () => {
    const sb = getSupabase();
    const today = new Date().toISOString().split('T')[0];
    const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();

    const [allOrders, todayOrders, monthOrders, pendingOrders] = await Promise.all([
      sb.from('orders').select('total, status, payment_status'),
      sb.from('orders').select('total').gte('created_at', today + 'T00:00:00').eq('payment_status', 'paid'),
      sb.from('orders').select('total').gte('created_at', monthStart).eq('payment_status', 'paid'),
      sb.from('orders').select('id').eq('status', 'pending'),
    ]);

    const totalRevenue = (allOrders.data || []).filter(o => o.payment_status === 'paid').reduce((s, o) => s + o.total, 0);
    const todayRevenue = (todayOrders.data || []).reduce((s, o) => s + o.total, 0);
    const monthRevenue = (monthOrders.data || []).reduce((s, o) => s + o.total, 0);

    return {
      totalOrders:   (allOrders.data || []).length,
      totalRevenue,
      todayRevenue,
      monthRevenue,
      pendingCount:  (pendingOrders.data || []).length,
    };
  };

  // Subscribe to real-time order updates
  const subscribe = (orderId, callback) => {
    const sb = getSupabase();
    return sb.channel('order-' + orderId)
      .on('postgres_changes', {
        event: 'UPDATE', schema: 'public', table: 'orders',
        filter: `id=eq.${orderId}`,
      }, callback)
      .subscribe();
  };

  return { create, getMyOrders, getById, getAll, updateStatus, confirmPayment, getStats, subscribe };
})();

// ── CUSTOMERS / CRM ──────────────────────────────────────────
const CRM = (() => {

  // Sync contact to HubSpot (via Supabase Edge Function)
  const syncContact = async ({ email, fullName, phone, source }) => {
    if (!EKRPT_CONFIG.hubspot.portalId) return; // Skip if not configured
    try {
      await fetch(`${EKRPT_CONFIG.supabase.url}/functions/v1/crm-sync`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + EKRPT_CONFIG.supabase.anonKey,
        },
        body: JSON.stringify({ email, fullName, phone, source }),
      });
    } catch (e) {
      console.warn('CRM sync failed (non-critical):', e.message);
    }
  };

  const getAll = async (filters = {}) => {
    const sb = getSupabase();
    let q = sb.from('customers').select('*').order('total_spent', { ascending: false });
    if (filters.search) q = q.or(`full_name.ilike.%${filters.search}%,email.ilike.%${filters.search}%`);
    const { data } = await q;
    return data || [];
  };

  const updateTags = async (customerId, tags) => {
    const sb = getSupabase();
    await sb.from('customers').update({ tags }).eq('id', customerId);
  };

  const addNote = async (customerId, note) => {
    const sb = getSupabase();
    const { data } = await sb.from('customers').select('notes').eq('id', customerId).single();
    const existing = data?.notes || '';
    const timestamp = new Date().toLocaleString('en-NG');
    await sb.from('customers').update({ notes: `[${timestamp}] ${note}\n${existing}` }).eq('id', customerId);
  };

  return { syncContact, getAll, updateTags, addNote };
})();

// ── SUBSCRIBERS ──────────────────────────────────────────────
const Newsletter = (() => {

  const subscribe = async (email, name = '', source = 'homepage') => {
    const sb = getSupabase();
    const { error } = await sb.from('subscribers').upsert({ email, name, source, subscribed: true });
    if (error && !error.message.includes('duplicate')) throw error;
  };

  const getAll = async () => {
    const sb = getSupabase();
    const { data } = await sb.from('subscribers').select('*').eq('subscribed', true).order('created_at', { ascending: false });
    return data || [];
  };

  return { subscribe, getAll };
})();

// ── PROMO CODES ──────────────────────────────────────────────
const Promos = (() => {

  const validate = async (code, orderTotal) => {
    const sb = getSupabase();
    const { data, error } = await sb.from('promo_codes')
      .select('*').eq('code', code.toUpperCase()).eq('is_active', true).single();
    if (error || !data) return { valid: false, message: 'Invalid promo code' };
    if (data.expires_at && new Date(data.expires_at) < new Date()) return { valid: false, message: 'Promo code expired' };
    if (data.max_uses && data.used_count >= data.max_uses) return { valid: false, message: 'Promo code limit reached' };
    if (orderTotal < data.min_order) return { valid: false, message: `Min order ${fmtNGN(data.min_order)} required` };
    const discount = data.discount_type === 'percent'
      ? (orderTotal * data.discount_value / 100)
      : data.discount_value;
    return { valid: true, promo: data, discount, message: `${data.discount_type === 'percent' ? data.discount_value + '% off' : fmtNGN(data.discount_value) + ' off'} applied!` };
  };

  return { validate };
})();
