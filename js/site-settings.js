/* ═══════════════════════════════════════════════════════════
   EKRPT — Site Settings Loader + Blog data
   Include on every public page AFTER config.js.
   Reads site_settings once and applies branding, theme & SEO.
   ═══════════════════════════════════════════════════════════ */

const SiteSettings = (() => {
  let _cache = null;

  const get = async (force = false) => {
    if (_cache && !force) return _cache;
    try {
      const sb = getSupabase();
      const { data } = await sb.from('site_settings').select('*').eq('id', 1).single();
      _cache = data || {};
    } catch (e) { _cache = {}; }
    return _cache;
  };

  const save = async (patch) => {
    const sb = getSupabase();
    patch.updated_at = new Date().toISOString();
    const { error } = await sb.from('site_settings').update(patch).eq('id', 1);
    if (error) throw error;
    _cache = { ..._cache, ...patch };
    if (typeof Audit !== 'undefined') Audit.log('site.settings_updated', 'site_settings', {});
  };

  // Upload an image to the 'site' or 'blog' bucket, return public URL
  const uploadImage = async (file, bucket = 'site', prefix = 'img') => {
    const sb = getSupabase();
    const ext = (file.name.split('.').pop() || 'jpg').toLowerCase();
    const path = `${prefix}-${Date.now()}.${ext}`;
    const { error } = await sb.storage.from(bucket).upload(path, file, { upsert: true });
    if (error) throw error;
    const { data } = sb.storage.from(bucket).getPublicUrl(path);
    return data.publicUrl;
  };

  // Apply theme colors + branding to the current page
  const applyTheme = (s) => {
    if (!s) return;
    // Colors are locked to the dark theme CSS by design. The admin panel
    // no longer edits theme colors (that fought the dark theme and hid text).
    // Branding text
    document.querySelectorAll('[data-site-name]').forEach(el => el.textContent = s.site_name || el.textContent);
    document.querySelectorAll('[data-tagline]').forEach(el => el.textContent = s.tagline || el.textContent);
    document.querySelectorAll('[data-logo]').forEach(el => { if (s.logo_url) el.src = s.logo_url; });
    // Announcement bar
    if (s.announce_enabled && s.announce_text) {
      const bar = document.getElementById('announce-bar');
      if (bar) { bar.textContent = s.announce_text; bar.style.display = 'block'; if (s.announce_link) bar.onclick = () => location.href = s.announce_link; }
    }
  };

  // Inject SEO meta tags into <head>
  const applySEO = (opts = {}) => {
    const s = _cache || {};
    const title = opts.title || s.seo_title || s.site_name || 'EKRPT';
    const desc  = opts.description || s.seo_description || s.tagline || '';
    const img   = opts.image || s.seo_og_image || s.logo_url || '';
    const url   = opts.url || location.href;
    document.title = title;
    setMeta('name', 'description', desc);
    setMeta('name', 'keywords', opts.keywords || s.seo_keywords || '');
    // Open Graph
    setMeta('property', 'og:title', title);
    setMeta('property', 'og:description', desc);
    setMeta('property', 'og:type', opts.type || 'website');
    setMeta('property', 'og:url', url);
    if (img) setMeta('property', 'og:image', img);
    setMeta('property', 'og:site_name', s.site_name || 'EKRPT');
    // Twitter
    setMeta('name', 'twitter:card', img ? 'summary_large_image' : 'summary');
    setMeta('name', 'twitter:title', title);
    setMeta('name', 'twitter:description', desc);
    if (img) setMeta('name', 'twitter:image', img);
    if (s.seo_twitter) setMeta('name', 'twitter:site', s.seo_twitter);
    // Canonical
    setLink('canonical', opts.canonical || url);
    if (opts.noIndex) setMeta('name', 'robots', 'noindex,nofollow');
  };

  // Inject JSON-LD structured data (article or organization)
  const injectJsonLd = (obj) => {
    const tag = document.createElement('script');
    tag.type = 'application/ld+json';
    tag.textContent = JSON.stringify(obj);
    document.head.appendChild(tag);
  };

  // Boot: load + apply theme automatically
  const boot = async (seoOpts) => {
    const s = await get();
    applyTheme(s);
    applySEO(seoOpts || {});
    // Organization structured data on every page
    injectJsonLd({
      '@context': 'https://schema.org', '@type': 'Organization',
      name: s.site_name || 'EKRPT Networking Labs',
      url: 'https://ekrpt.com',
      logo: s.logo_url || '',
      email: s.contact_email || '', telephone: s.contact_phone || '',
      address: { '@type': 'PostalAddress', addressLocality: s.contact_address || 'Lagos, Nigeria' },
    });
    return s;
  };

  // helpers
  function setMeta(attr, key, val) {
    if (val == null) return;
    let el = document.querySelector(`meta[${attr}="${key}"]`);
    if (!el) { el = document.createElement('meta'); el.setAttribute(attr, key); document.head.appendChild(el); }
    el.setAttribute('content', val);
  }
  function setLink(rel, href) {
    let el = document.querySelector(`link[rel="${rel}"]`);
    if (!el) { el = document.createElement('link'); el.setAttribute('rel', rel); document.head.appendChild(el); }
    el.setAttribute('href', href);
  }
  function shade(hex, percent) {
    try {
      const n = parseInt(hex.replace('#', ''), 16);
      let r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
      const t = percent < 0 ? 0 : 255, p = Math.abs(percent) / 100;
      r = Math.round((t - r) * p + r); g = Math.round((t - g) * p + g); b = Math.round((t - b) * p + b);
      return '#' + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
    } catch (e) { return hex; }
  }

  return { get, save, uploadImage, applyTheme, applySEO, injectJsonLd, boot };
})();

// ── Blog page chrome (nav + footer) — paths are relative to /blog/ ──
function buildBlogChrome(s) {
  s = s || {};
  const soc = s.social || {};
  const name = s.site_name || 'EKRPT Networking Labs';
  const logo = s.logo_url ? `<img src="${s.logo_url}" alt="${name}" style="height:30px"/>` : `<span style="font-family:var(--font-head);font-weight:800;font-size:18px;color:var(--blue)">${name}</span>`;
  const nav = document.getElementById('nav');
  if (nav) nav.innerHTML = `
    <div style="max-width:1140px;margin:0 auto;padding:14px 24px;display:flex;align-items:center;gap:24px">
      <a href="../index.html" style="text-decoration:none;display:flex;align-items:center;gap:8px">${logo}</a>
      <div style="flex:1"></div>
      <a href="../index.html" style="text-decoration:none;color:var(--gray-600);font-size:14px;font-weight:500">Home</a>
      <a href="../products.html" style="text-decoration:none;color:var(--gray-600);font-size:14px;font-weight:500">Shop</a>
      <a href="./index.html" style="text-decoration:none;color:var(--blue);font-size:14px;font-weight:700">Blog</a>
      <a href="../about.html" style="text-decoration:none;color:var(--gray-600);font-size:14px;font-weight:500">About</a>
      <a href="../account/index.html" style="text-decoration:none;color:white;background:var(--blue);padding:8px 16px;border-radius:8px;font-size:14px;font-weight:600">Account</a>
    </div>`;
  const socLinks = Object.entries({facebook:'f',instagram:'◎',twitter:'𝕏',tiktok:'♪',whatsapp:'💬',linkedin:'in',youtube:'▶'})
    .filter(([k]) => soc[k]).map(([k,ic]) => `<a href="${soc[k]}" target="_blank" style="color:rgba(255,255,255,.7);text-decoration:none;font-size:15px">${ic}</a>`).join(' ');
  const footer = document.getElementById('footer');
  if (footer) footer.innerHTML = `
    <div style="background:var(--gray-900);color:white;padding:48px 24px 28px;margin-top:48px">
      <div style="max-width:1140px;margin:0 auto;display:grid;grid-template-columns:2fr 1fr 1fr;gap:32px">
        <div>
          <div style="font-family:var(--font-head);font-weight:800;font-size:20px;margin-bottom:10px">${name}</div>
          <p style="color:rgba(255,255,255,.6);font-size:14px;line-height:1.6;max-width:320px">${s.footer_about || ''}</p>
          <div style="display:flex;gap:14px;margin-top:14px">${socLinks}</div>
        </div>
        <div><div style="font-family:var(--font-mono);font-size:11px;text-transform:uppercase;color:rgba(255,255,255,.4);margin-bottom:12px">Shop</div>
          <a href="../products.html" style="display:block;color:rgba(255,255,255,.7);text-decoration:none;font-size:14px;margin-bottom:8px">Products</a>
          <a href="./index.html" style="display:block;color:rgba(255,255,255,.7);text-decoration:none;font-size:14px;margin-bottom:8px">Blog</a>
          <a href="../about.html" style="display:block;color:rgba(255,255,255,.7);text-decoration:none;font-size:14px">About</a></div>
        <div><div style="font-family:var(--font-mono);font-size:11px;text-transform:uppercase;color:rgba(255,255,255,.4);margin-bottom:12px">Contact</div>
          <div style="color:rgba(255,255,255,.7);font-size:14px;margin-bottom:6px">${s.contact_email || ''}</div>
          <div style="color:rgba(255,255,255,.7);font-size:14px;margin-bottom:6px">${s.contact_phone || ''}</div>
          <div style="color:rgba(255,255,255,.7);font-size:14px">${s.contact_address || ''}</div></div>
      </div>
      <div style="max-width:1140px;margin:28px auto 0;padding-top:20px;border-top:1px solid rgba(255,255,255,.1);color:rgba(255,255,255,.4);font-size:13px;text-align:center">${s.footer_text || ''}</div>
    </div>`;
}

// ── BLOG DATA MODULE ────────────────────────────────────────
const Blog = (() => {

  const slugify = (str) => str.toLowerCase().trim()
    .replace(/[^\w\s-]/g, '').replace(/\s+/g, '-').replace(/-+/g, '-').slice(0, 70);

  const readingTime = (html) => {
    const words = (html || '').replace(/<[^>]+>/g, ' ').split(/\s+/).filter(Boolean).length;
    return Math.max(1, Math.round(words / 200));
  };

  // Public: list published posts
  const list = async ({ category, tag, limit = 50, featured } = {}) => {
    const sb = getSupabase();
    let q = sb.from('blog_posts').select('*').eq('status', 'published').order('published_at', { ascending: false });
    if (category) q = q.eq('category', category);
    if (featured) q = q.eq('featured', true);
    if (limit) q = q.limit(limit);
    const { data } = await q;
    let posts = data || [];
    if (tag) posts = posts.filter(p => (p.tags || []).includes(tag));
    return posts;
  };

  // Public: one post by slug (and bump views)
  const getBySlug = async (slug) => {
    const sb = getSupabase();
    const { data } = await sb.from('blog_posts').select('*').eq('slug', slug).eq('status', 'published').single();
    if (data) sb.rpc('increment_post_views', { post_slug: slug });
    return data;
  };

  // Admin: list ALL posts (drafts included)
  const listAll = async () => {
    const sb = getSupabase();
    const { data } = await sb.from('blog_posts').select('*').order('updated_at', { ascending: false });
    return data || [];
  };

  const getById = async (id) => {
    const sb = getSupabase();
    const { data } = await sb.from('blog_posts').select('*').eq('id', id).single();
    return data;
  };

  const create = async (post) => {
    const sb = getSupabase();
    const user = await Auth.getSession();
    if (!post.slug) post.slug = slugify(post.title);
    post.reading_time = readingTime(post.content);
    post.author_id = user?.user?.id;
    if (post.status === 'published' && !post.published_at) post.published_at = new Date().toISOString();
    const { data, error } = await sb.from('blog_posts').insert(post).select().single();
    if (error) throw error;
    return data;
  };

  const update = async (id, patch) => {
    const sb = getSupabase();
    if (patch.content) patch.reading_time = readingTime(patch.content);
    if (patch.status === 'published' && !patch.published_at) patch.published_at = new Date().toISOString();
    patch.updated_at = new Date().toISOString();
    const { error } = await sb.from('blog_posts').update(patch).eq('id', id);
    if (error) throw error;
  };

  const remove = async (id) => {
    const sb = getSupabase();
    const { error } = await sb.from('blog_posts').delete().eq('id', id);
    if (error) throw error;
  };

  return { slugify, readingTime, list, getBySlug, listAll, getById, create, update, remove };
})();
