/* ═══════════════════════════════════════════════════════════
   EKRPT — Payments Module
   Paystack · Flutterwave · PayPal · Cryptomus
   ═══════════════════════════════════════════════════════════ */

const Payments = (() => {

  // ── LIVE KEYS ────────────────────────────────────────────
  // Public keys are managed in Super Admin → Payment Keys and stored in
  // the payment_config table. Load them at runtime so the storefront
  // always uses the keys you entered in the admin (falling back to
  // whatever is in config.js if the table isn't reachable).
  let _keys = null; // { paystack:{publicKey,enabled,live}, ... }

  const loadKeys = async () => {
    if (_keys) return _keys;
    _keys = {};
    try {
      const sb = getSupabase();
      const { data } = await sb.from('payment_config').select('gateway, public_key, merchant_id, is_enabled, is_live_mode');
      (data || []).forEach(r => {
        _keys[r.gateway] = { publicKey: r.public_key, merchantId: r.merchant_id, enabled: r.is_enabled, live: r.is_live_mode };
      });
    } catch (e) { /* table not ready — fall back to config */ }
    return _keys;
  };

  const pubKey = (gateway) => {
    const live = _keys && _keys[gateway] && _keys[gateway].publicKey;
    if (live) return live;
    // fall back to config.js values
    const cfg = EKRPT_CONFIG.payments || {};
    return (cfg[gateway] && cfg[gateway].publicKey) || '';
  };

  const isEnabled = (gateway) => {
    if (_keys && _keys[gateway]) return !!_keys[gateway].enabled;
    return true; // assume enabled if we couldn't load config
  };

  // ── PAYSTACK ─────────────────────────────────────────────
  const payWithPaystack = ({ email, amountNGN, orderId, orderNumber, onSuccess, onClose }) => {
    if (!window.PaystackPop) {
      showToast('Paystack is loading, please wait…', 'error');
      return;
    }
    const handler = PaystackPop.setup({
      key:      pubKey('paystack'),
      email,
      amount:   Math.round(amountNGN * 100), // kobo
      currency: 'NGN',
      ref:      `EKRPT-PS-${orderId}-${Date.now()}`,
      metadata: {
        order_id:     orderId,
        order_number: orderNumber,
        custom_fields: [
          { display_name: 'Order Number', variable_name: 'order_number', value: orderNumber }
        ],
      },
      callback: async (response) => {
        // Frontend verification call to Supabase Edge Function
        await verifyPayment('paystack', response.reference, orderId);
        onSuccess && onSuccess(response);
      },
      onClose: () => { onClose && onClose(); },
    });
    handler.openIframe();
  };

  // ── FLUTTERWAVE ──────────────────────────────────────────
  const payWithFlutterwave = ({ email, phone, name, amountNGN, orderId, orderNumber, onSuccess, onClose }) => {
    if (!window.FlutterwaveCheckout) {
      showToast('Flutterwave is loading, please wait…', 'error');
      return;
    }
    FlutterwaveCheckout({
      public_key:  pubKey('flutterwave'),
      tx_ref:      `EKRPT-FW-${orderId}-${Date.now()}`,
      amount:      amountNGN,
      currency:    'NGN',
      payment_options: 'card,banktransfer,ussd,mobilemoney',
      customer: { email, phone_number: phone, name },
      customizations: {
        title:       'EKRPT Networking Labs',
        description: 'Order ' + orderNumber,
        logo:        EKRPT_CONFIG.store.domain + '/img/logo.png',
      },
      meta: { order_id: orderId, order_number: orderNumber },
      callback: async (response) => {
        if (response.status === 'successful') {
          await verifyPayment('flutterwave', response.transaction_id, orderId);
          onSuccess && onSuccess(response);
        }
      },
      onclose: () => { onClose && onClose(); },
    });
  };

  // ── PAYPAL ───────────────────────────────────────────────
  const renderPaypalButton = ({ containerSelector, amountNGN, orderId, orderNumber, onSuccess }) => {
    const container = document.querySelector(containerSelector);
    if (!window.paypal) {
      // SDK not ready yet — wait for it (checkout.html loads it on PayPal select).
      if (container) container.innerHTML = '<p style="color:var(--gray-400);font-size:13px">Loading PayPal…</p>';
      if (typeof loadPaypalSDK === 'function') {
        loadPaypalSDK().then(() => renderPaypalButton({ containerSelector, amountNGN, orderId, orderNumber, onSuccess }))
          .catch(() => { if (container) container.innerHTML = '<p style="color:var(--red);font-size:13px">PayPal could not load.</p>'; });
      }
      return;
    }
    if (container) container.innerHTML = '';
    const usdAmount = toUSD(amountNGN);
    window.paypal.Buttons({
      style: { layout: 'vertical', color: 'blue', shape: 'rect', label: 'pay', height: 44 },
      createOrder: async () => {
        // Call Supabase Edge Function to create PayPal order
        const res = await fetch(`${EKRPT_CONFIG.supabase.url}/functions/v1/paypal-create`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer ' + EKRPT_CONFIG.supabase.anonKey,
          },
          body: JSON.stringify({ amount: usdAmount, orderId, orderNumber }),
        });
        const { paypalOrderId } = await res.json();
        return paypalOrderId;
      },
      onApprove: async (data) => {
        const res = await fetch(`${EKRPT_CONFIG.supabase.url}/functions/v1/paypal-capture`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer ' + EKRPT_CONFIG.supabase.anonKey,
          },
          body: JSON.stringify({ paypalOrderId: data.orderID, ekrptOrderId: orderId }),
        });
        const result = await res.json();
        if (result.status === 'COMPLETED') {
          onSuccess && onSuccess(result);
        }
      },
      onError: (err) => { showToast('PayPal error. Please try another payment method.', 'error'); },
    }).render(containerSelector);
  };

  // ── CRYPTOMUS ────────────────────────────────────────────
  const createCryptoInvoice = async ({ amountNGN, orderId, orderNumber, currency = 'USDT' }) => {
    const usdAmount = toUSD(amountNGN);
    const res = await fetch(`${EKRPT_CONFIG.supabase.url}/functions/v1/cryptomus-create`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + EKRPT_CONFIG.supabase.anonKey,
      },
      body: JSON.stringify({ amount: usdAmount, currency, orderId, orderNumber }),
    });
    const invoice = await res.json();
    return invoice; // { url, address, amount, currency, expiry }
  };

  // ── VERIFY PAYMENT (via Supabase Edge Function) ──────────
  const verifyPayment = async (gateway, reference, orderId) => {
    try {
      const res = await fetch(`${EKRPT_CONFIG.supabase.url}/functions/v1/verify-payment`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + EKRPT_CONFIG.supabase.anonKey,
        },
        body: JSON.stringify({ gateway, reference, orderId }),
      });
      const result = await res.json();
      if (result.success) {
        await Orders.confirmPayment(orderId, reference);
      }
      return result;
    } catch (e) {
      console.error('Payment verification error:', e);
    }
  };

  // ── CRYPTO RATES (live, from CoinGecko free API) ────────
  const getCryptoRates = async (usdAmount) => {
    try {
      const res = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum,tether,binancecoin,solana,litecoin&vs_currencies=usd');
      const rates = await res.json();
      return {
        btc:  (usdAmount / rates.bitcoin.usd).toFixed(8),
        eth:  (usdAmount / rates.ethereum.usd).toFixed(6),
        usdt: (usdAmount / rates.tether.usd).toFixed(2),
        bnb:  (usdAmount / rates.binancecoin.usd).toFixed(5),
        sol:  (usdAmount / rates.solana.usd).toFixed(4),
        ltc:  (usdAmount / rates.litecoin.usd).toFixed(5),
      };
    } catch (e) {
      // Fallback to approximate rates
      return {
        btc:  (usdAmount / 63000).toFixed(8),
        eth:  (usdAmount / 2400).toFixed(6),
        usdt: usdAmount.toFixed(2),
        bnb:  (usdAmount / 600).toFixed(5),
        sol:  (usdAmount / 142).toFixed(4),
        ltc:  (usdAmount / 80).toFixed(5),
      };
    }
  };

  return { loadKeys, isEnabled, pubKey, payWithPaystack, payWithFlutterwave, renderPaypalButton, createCryptoInvoice, getCryptoRates };
})();
