<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1.0"/>
<title>My Account — EKRPT Networking Labs</title>
<link rel="stylesheet" href="../css/style.css"/>
<link rel="stylesheet" href="../css/portal-core.css"/>
<link rel="stylesheet" href="../css/theme-spectre-portal.css"/>
<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
<style>:root{--accent:#1a8fc4}.pside-logo-mark{background:var(--blue)}.role-tag{color:var(--blue-mid)}.pside-av{background:var(--blue)}
.track-steps{display:flex;align-items:center;gap:0;margin:20px 0}
.track-step{flex:1;text-align:center;position:relative}
.track-dot{width:32px;height:32px;border-radius:50%;background:var(--gray-100);color:var(--gray-300);display:flex;align-items:center;justify-content:center;margin:0 auto 6px;font-size:14px;position:relative;z-index:1}
.track-step.done .track-dot{background:var(--blue);color:white}
.track-step.current .track-dot{background:var(--blue);color:white;box-shadow:0 0 0 4px var(--blue-light)}
.track-line{position:absolute;top:16px;left:-50%;width:100%;height:2px;background:var(--gray-100);z-index:0}
.track-step.done .track-line{background:var(--blue)}
.track-label{font-size:11px;color:var(--gray-400);font-family:var(--font-mono)}
.order-card{background:white;border:1px solid var(--gray-100);border-radius:var(--radius-lg);padding:20px;margin-bottom:16px}
</style>
</head>
<body class="portal">
<aside class="pside">
  <div class="pside-logo"><div class="pside-logo-mark"><svg viewBox="0 0 20 20"><path d="M2 4h16v2H2zM2 9h10v2H2zM2 14h13v2H2z"/></svg></div><div class="pside-brand">EKRPT Labs<span class="role-tag">My Account</span></div></div>
  <nav class="pside-nav">
    <div class="pside-section">Account</div>
    <button class="pside-link active" onclick="nav('dashboard',this)"><span class="ic">📊</span>Dashboard</button>
    <button class="pside-link" onclick="nav('orders',this)"><span class="ic">📦</span>My Orders</button>
    <button class="pside-link" onclick="nav('profile',this)"><span class="ic">👤</span>Profile</button>
    <a class="pside-link" href="../products.html"><span class="ic">🛒</span>Shop More</a>
    <a class="pside-link" href="../index.html"><span class="ic">🌐</span>Back to Store</a>
  </nav>
  <div class="pside-foot"><div class="pside-user"><div class="pside-av" id="av">U</div><div><div class="pside-uname" id="uname">Customer</div><div class="pside-urole">Member</div></div><button class="pside-out" onclick="Auth.signOut()">⏻</button></div></div>
</aside>
<div class="pmain">
  <div class="ptop"><div class="ptop-title" id="ptitle">Dashboard</div><span class="ptop-meta" id="pmeta"></span></div>
  <div class="pcontent">

    <div id="v-dashboard" class="pview active">
      <div class="pmetrics">
        <div class="pmetric"><div class="pmetric-label">Total Orders</div><div class="pmetric-val" id="u-orders">0</div><div class="pmetric-ic">📦</div></div>
        <div class="pmetric" style="--accent:#16a34a"><div class="pmetric-label">Total Spent</div><div class="pmetric-val" id="u-spent">₦0</div><div class="pmetric-ic">💰</div></div>
        <div class="pmetric" style="--accent:#ca8a04"><div class="pmetric-label">In Transit</div><div class="pmetric-val" id="u-transit">0</div><div class="pmetric-ic">🚚</div></div>
      </div>
      <div class="ppanel"><div class="ppanel-head"><span class="ppanel-title">Recent Orders</span><button class="pbtn pbtn-ghost" onclick="nav('orders',document.querySelectorAll('.pside-link')[1])">View all</button></div><div class="ppanel-body flush"><table class="ptable"><thead><tr><th>Order #</th><th>Date</th><th>Total</th><th>Status</th></tr></thead><tbody id="recent-body"></tbody></table></div></div>
    </div>

    <div id="v-orders" class="pview">
      <div id="orders-list"></div>
    </div>

    <div id="v-profile" class="pview">
      <div class="ppanel" style="max-width:520px"><div class="ppanel-head"><span class="ppanel-title">My Profile</span></div><div class="ppanel-body">
        <div class="pfield"><label>Full Name</label><input id="pf-name"/></div>
        <div class="pfield"><label>Phone</label><input id="pf-phone"/></div>
        <div class="pfield"><label>Delivery Address</label><input id="pf-address"/></div>
        <div class="pfield"><label>City</label><input id="pf-city"/></div>
        <button class="pbtn pbtn-primary" onclick="saveProfile()">Save changes</button>
      </div></div>
      <div class="ppanel" style="max-width:520px"><div class="ppanel-head"><span class="ppanel-title">Security</span></div><div class="ppanel-body">
        <div class="pfield"><label>New Password</label><input type="password" id="pf-pw" placeholder="••••••••"/></div>
        <button class="pbtn pbtn-ghost" onclick="changePw()">Update password</button>
      </div></div>
    </div>

  </div>
</div>

<script src="../js/config.js"></script>
<script src="../js/main.js"></script>
<script src="../js/auth.js"></script>
<script src="../js/store.js"></script>
<script src="../js/roles.js"></script>
<script>
let _orders=[];const STEPS=['confirmed','processing','shipped','delivered'];
document.addEventListener('DOMContentLoaded',async()=>{
  if(!await Auth.requireAuth())return;
  const u=await Auth.getUser();
  if(u){document.getElementById('uname').textContent=u.profile?.full_name||u.email;document.getElementById('av').textContent=(u.profile?.full_name||u.email||'U')[0].toUpperCase();
    document.getElementById('pf-name').value=u.profile?.full_name||'';document.getElementById('pf-phone').value=u.profile?.phone||'';document.getElementById('pf-address').value=u.profile?.address||'';document.getElementById('pf-city').value=u.profile?.city||'';}
  await loadOrders();
});
function nav(v,btn){document.querySelectorAll('.pview').forEach(x=>x.classList.remove('active'));document.querySelectorAll('.pside-link').forEach(x=>x.classList.remove('active'));document.getElementById('v-'+v).classList.add('active');if(btn)btn.classList.add('active');document.getElementById('ptitle').textContent={dashboard:'Dashboard',orders:'My Orders',profile:'Profile'}[v];}

async function loadOrders(){
  try{_orders=await Orders.getMyOrders();
    const spent=_orders.filter(o=>o.payment_status==='paid').reduce((s,o)=>s+o.total,0);
    const transit=_orders.filter(o=>['confirmed','processing','shipped'].includes(o.status)).length;
    document.getElementById('u-orders').textContent=_orders.length;
    document.getElementById('u-spent').textContent=fmtNGN(spent);
    document.getElementById('u-transit').textContent=transit;
    document.getElementById('recent-body').innerHTML=_orders.slice(0,5).map(o=>`<tr><td style="font-family:var(--font-mono);font-size:11px"><strong>${o.order_number}</strong></td><td style="font-size:12px">${new Date(o.created_at).toLocaleDateString('en-NG')}</td><td style="font-family:var(--font-mono)">${fmtNGN(o.total)}</td><td><span class="pill pill-${o.status}">${o.status}</span></td></tr>`).join('')||'<tr><td colspan="4" class="pempty">No orders yet — <a href="../products.html" style="color:var(--blue)">start shopping</a></td></tr>';
    renderOrdersList();
  }catch(e){console.error(e);}
}
function renderOrdersList(){
  document.getElementById('orders-list').innerHTML=_orders.map(o=>{
    const stepIdx=STEPS.indexOf(o.status);
    const tracker=o.status==='cancelled'?'<div class="palert palert-danger">This order was cancelled</div>:`<div class="track-steps">${STEPS.map((s,i)=>`<div class="track-step ${i<stepIdx?'done':i===stepIdx?'current':''}">${i>0?'<div class="track-line"></div>':''}<div class="track-dot">${i<stepIdx?'✓':i+1}</div><div class="track-label">${s}</div></div>`).join('')}</div>`;
    return `<div class="order-card">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:12px">
        <div><div style="font-family:var(--font-mono);font-size:14px;font-weight:700">${o.order_number}</div><div style="font-size:12px;color:var(--gray-300)">${new Date(o.created_at).toLocaleString('en-NG')}</div></div>
        <span class="pill pill-${o.status}">${o.status}</span>
      </div>
      ${tracker}
      <table class="ptable" style="margin-top:12px">${(o.items||[]).map(i=>`<tr><td>${i.emoji||''} ${i.name}</td><td>×${i.qty}</td><td style="font-family:var(--font-mono);text-align:right">${fmtNGN(i.price*i.qty)}</td></tr>`).join('')}</table>
      <div style="display:flex;justify-content:space-between;margin-top:12px;padding-top:12px;border-top:1px solid var(--gray-100);font-weight:700"><span>Total</span><span style="font-family:var(--font-mono)">${fmtNGN(o.total)}</span></div>
    </div>`;
  }).join('')||'<div class="pempty"><div class="pempty-ic">📦</div><p>No orders yet</p><a href="../products.html" class="pbtn pbtn-primary" style="margin-top:12px">Start shopping</a></div>';
}

async function saveProfile(){try{await Auth.updateProfile({full_name:document.getElementById('pf-name').value,phone:document.getElementById('pf-phone').value,address:document.getElementById('pf-address').value,city:document.getElementById('pf-city').value});showToast('Profile saved ✓');}catch(e){showToast('Error: '+e.message,'error');}}
async function changePw(){const pw=document.getElementById('pf-pw').value;if(pw.length<6){showToast('Password must be 6+ characters','error');return;}try{await Auth.updatePassword(pw);document.getElementById('pf-pw').value='';showToast('Password updated ✓');}catch(e){showToast('Error: '+e.message,'error');}}
</script>
</body>
</html>
