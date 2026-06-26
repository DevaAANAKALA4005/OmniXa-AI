let currentUser = JSON.parse(localStorage.getItem('ox_user')) || null;
let currentRole = localStorage.getItem('ox_role') || null;
let allProducts = [];
let allOrders = [];
let userPurchases = [];
let currentProduct = null;

const API_BASE = import.meta.env.VITE_API_URL || '/api';

async function api(path, method='GET', body=null){
  const options = { method, headers: { 'Content-Type': 'application/json' } };
  if(body) options.body = JSON.stringify(body);
  const res = await fetch(API_BASE + path, options);
  return res.json();
}

async function initData(){
  const productsRes = await api('/products');
  allProducts = Array.isArray(productsRes) ? productsRes : [];
  
  const ordersRes = await api('/orders');
  allOrders = Array.isArray(ordersRes) ? ordersRes : [];
  
  if(currentUser){
    const purchasesRes = await api('/orders/purchases?email=' + currentUser.email);
    userPurchases = Array.isArray(purchasesRes) ? purchasesRes : [];
  }
  renderGlobalStats();
}

function renderGlobalStats() {
  const totalProducts = allProducts.length;
  
  const paidOrders = allOrders.filter(o => o.status === 'Paid');
  const uniqueBuyers = new Set(paidOrders.map(o => o.buyerEmail)).size;
  const totalRevenue = paidOrders.reduce((sum, o) => sum + (o.amount || 0), 0);
  
  animateValue('hMetricProducts', 0, totalProducts, 800);
  animateValue('hMetricBuyers', 0, uniqueBuyers, 1000);
  animateValue('hMetricRev', 0, totalRevenue, 1200, '₹');
  animateValue('hMetricRating', 1.0, 4.9, 600, '', '★', true);
  
  animateValue('aMetricProducts', 0, totalProducts, 800);
  animateValue('aMetricBuyers', 0, uniqueBuyers, 1000);
  animateValue('aMetricRev', 0, totalRevenue, 1200, '₹');
}

/* ── ROUTING ── */
async function show(page){
  // Close any open mobile menus
  closeMenu();

  const adminPages = ['seller-home', 'seller-products', 'seller-add', 'seller-buyers', 'seller-earnings'];
  const privateBuyerPages = ['buyer-home', 'buyer-orders', 'settings'];
  
  if (adminPages.includes(page)) {
    if (!currentUser || currentUser.role !== 'seller') {
      page = currentUser ? 'buyer-home' : 'landing';
    }
  } else if (privateBuyerPages.includes(page)) {
    if (!currentUser) {
      page = 'landing';
    }
  }

  document.querySelectorAll('.page').forEach(p=>p.classList.remove('active'));
  const el = document.getElementById('page-'+page);
  if(el){ el.classList.add('active'); window.scrollTo({top:0,behavior:'smooth'}); }
  
  await initData();

  if(page==='seller-home') renderSellerStats();
  if(page==='seller-products') renderSellerProducts();
  if(page==='seller-buyers') renderBuyersTable();
  if(page==='seller-earnings') renderEarnings();
  if(page==='buyer-market') renderMarket(null);
  if(page==='buyer-orders') renderOrders();
  if(page==='settings') {
    if(currentUser) {
      document.getElementById('set-email').value = currentUser.email;
      document.getElementById('set-name').value = currentUser.name;
      document.getElementById('set-avatar').value = currentUser.avatar || '';
    }
  }
}

function scrollSec(id){
  const el = document.getElementById(id);
  if(el) el.scrollIntoView({behavior:'smooth'});
}

/* ── AUTH ── */
async function doLogin(){
  const email = document.getElementById('lEmail').value;
  const password = document.getElementById('lPass').value;
  
  if(!email || !password) {
    notify('Please enter both email and password');
    return;
  }

  notify('Logging in... ⏳');
  const res = await api('/auth/login', 'POST', { email, password });
  if(res.success){
    currentUser = res.user;
    localStorage.setItem('ox_user', JSON.stringify(currentUser));
    const role = currentUser.role || (currentUser.email === 'admin@omnixaai.in' ? 'seller' : 'buyer');
    setRole(role);
  } else {
    notify('Login failed: ' + res.message);
  }
}

async function doSignup(){
  const first = document.getElementById('sFirst').value;
  const last = document.getElementById('sLast').value;
  const email = document.getElementById('sEmail').value;
  const password = document.getElementById('sPass').value;

  if(!first || !email || !password) {
    notify('Please fill all required fields');
    return;
  }

  notify('Creating account... ⏳');
  const res = await api('/auth/signup', 'POST', { first, last, email, password });
  if(res.success){
    currentUser = res.user;
    localStorage.setItem('ox_user', JSON.stringify(currentUser));
    const role = currentUser.role || (currentUser.email === 'admin@omnixaai.in' ? 'seller' : 'buyer');
    setRole(role);
  } else {
    notify('Signup failed: ' + res.message);
  }
}

// Quick login removed

async function setRole(role){
  currentRole = role;
  localStorage.setItem('ox_role', role);
  
  if (currentUser && currentUser.id) {
    const res = await api('/auth/role', 'PUT', { userId: currentUser.id, role });
    if (res && !res.success) {
       notify(res.message);
       return;
    }
  } else if (currentUser && currentUser.email) {
    const res = await api('/auth/role', 'PUT', { email: currentUser.email, role });
    if (res && !res.success) {
       notify(res.message);
       return;
    }
  }

  const name = currentUser ? currentUser.name : 'User';
  const initial = name[0].toUpperCase();
  const firstName = name.split(' ')[0];
  
  if(role === 'seller'){
    document.getElementById('sGreetName').textContent = 'Welcome, '+firstName+'!';
    ['sAvatar','sAvatar2','sAvatar3','sAvatar4','sAvatar5'].forEach(id=>{
      const el=document.getElementById(id); if(el){el.textContent=initial;}
    });
    document.getElementById('sName').textContent = name;
    show('seller-home');
    notify('👋 Welcome back, Admin ' + firstName + '!');
  } else {
    document.getElementById('bGreetName').textContent = 'Welcome, '+firstName+'!';
    ['bAvatar','bAvatar2','bAvatar3','bAvatar4'].forEach(id=>{
      const el=document.getElementById(id); if(el){el.textContent=initial;}
    });
    document.getElementById('bName').textContent = name;
    show('buyer-home');
    notify('👋 Welcome, '+firstName+'!');
  }
}

function doLogout(){
  currentUser=null; currentRole=null;
  localStorage.removeItem('ox_user');
  localStorage.removeItem('ox_role');
  show('landing');
  notify('You have been logged out.');
}

/* ── SELLER: STATS ── */
function renderSellerStats(){
  const myProducts = allProducts;
  const totalSales = allOrders.filter(o=>o.status==='Paid').length;
  const totalRev = allOrders.filter(o=>o.status==='Paid').reduce((sum,o)=>sum+o.amount,0);
  document.getElementById('sMetric1').textContent = myProducts.length;
  document.getElementById('sMetric2').textContent = totalSales;
  
  let formattedRev = '₹0';
  if (totalRev >= 10000000) {
    formattedRev = '₹' + (totalRev / 10000000).toFixed(1) + 'Cr';
  } else if (totalRev >= 100000) {
    formattedRev = '₹' + (totalRev / 100000).toFixed(1) + 'L';
  } else if (totalRev >= 1000) {
    formattedRev = '₹' + (totalRev / 1000).toFixed(1) + 'K';
  } else {
    formattedRev = '₹' + totalRev;
  }
  document.getElementById('sMetric3').textContent = formattedRev;
  const sRating = document.getElementById('sMetricRating');
  if (sRating) sRating.textContent = myProducts.length > 0 ? '4.9★' : '—';
}

/* ── SELLER: PRODUCTS ── */
function renderSellerProducts(){
  const el = document.getElementById('spList');
  if(!el) return;
  const myProducts = allProducts;
  el.innerHTML = myProducts.map(p=>`
    <div class="prod-card">
      <div class="prod-thumb">${p.icon}</div>
      <div class="prod-body">
        <div class="prod-cat">${p.cat}</div>
        <div class="prod-name">${p.name}</div>
        <div class="prod-desc">${p.desc.substring(0,90)}...</div>
        <div class="chips">${p.tags.map(t=>`<span class="chip">${t}</span>`).join('')}</div>
        <div class="prod-footer">
          <div class="prod-price">₹${p.price.toLocaleString('en-IN')}</div>
          <div style="font-size:12px;color:var(--muted)">${p.sales} buyers</div>
        </div>
        <div style="display:flex;gap:8px;margin-top:14px">
          <button class="btn-orange" style="flex:1;font-size:13px;padding:9px" onclick="show('seller-buyers')">👥 View buyers</button>
          <button class="btn-ghost" style="font-size:13px;padding:9px 14px" onclick="notify('Edit mode for '+${JSON.stringify(p.name)}+' coming soon!')">✏️</button>
        </div>
      </div>
    </div>`).join('');
}

/* ── SELLER: ADD PRODUCT ── */
function livePreview(){
  const n=document.getElementById('aName').value||'Your Product Name';
  const c=document.getElementById('aCat').value||'Category';
  const p=parseInt(document.getElementById('aPrice').value)||0;
  const d=document.getElementById('aDesc').value||'Short description...';
  const e=document.getElementById('aEmoji').value||'🤖';
  document.getElementById('pvName').textContent=n;
  document.getElementById('pvCat').textContent=c;
  document.getElementById('pvPrice').textContent='₹'+p.toLocaleString('en-IN');
  document.getElementById('pvDesc').textContent=d;
  document.getElementById('pvIcon').textContent=e;
}

async function submitProduct(){
  const n=document.getElementById('aName').value;
  const c=document.getElementById('aCat').value;
  const p=document.getElementById('aPrice').value;
  const d=document.getElementById('aDesc').value;
  if(!n||!c||!p||!d){notify('Please fill all required fields (*)');return;}
  
  const parsedPrice = parseInt(p);
  if(isNaN(parsedPrice) || parsedPrice < 0) {
    notify('Please enter a valid price');
    return;
  }

  const tags=(document.getElementById('aTags').value||c).split(',').map(t=>t.trim()).filter(Boolean);
  const icon=document.getElementById('aEmoji').value||'🤖';
  
  notify('Listing product... ⏳');
  const res = await api('/products', 'POST', {
    name: n,
    cat: c,
    price: parsedPrice,
    desc: d,
    icon,
    tags,
    sellerEmail: currentUser ? currentUser.email : 'demo@seller.com',
    sellerName: currentUser ? currentUser.name : 'Demo Seller'
  });
  
  if(res.success){
    document.getElementById('aSuccess').style.display='block';
    notify('🚀 Product listed! Goes live after review.');
    setTimeout(()=>{document.getElementById('aSuccess').style.display='none';},4000);
    
    ['aName','aDesc','aFullDesc','aUrl','aVideo','aEmoji','aPrice','aComm','aTags'].forEach(id=>{
      const el=document.getElementById(id); if(el) el.value='';
    });
    livePreview();
    show('seller-products');
  }
}

/* ── SELLER: BUYERS ── */
function renderBuyersTable(){
  const tbody = document.getElementById('buyersTbody');
  if(!tbody) return;
  const myProducts = allProducts;
  const myOrders = allOrders;
  
  // Calculate real buyer stats
  const buyerCounts = {};
  myOrders.forEach(o => {
    if (o.status === 'Paid') {
      buyerCounts[o.buyerEmail] = (buyerCounts[o.buyerEmail] || 0) + 1;
    }
  });
  
  const uniqueBuyers = Object.keys(buyerCounts).length;
  const repeatBuyers = Object.values(buyerCounts).filter(count => count > 1).length;
  
  const elTotal = document.getElementById('sbTotalBuyers');
  const elRepeat = document.getElementById('sbRepeat');
  if(elTotal) elTotal.textContent = uniqueBuyers;
  if(elRepeat) elRepeat.textContent = repeatBuyers;

  tbody.innerHTML = myOrders.map(o=>`
    <tr>
      <td><div style="font-weight:600">${o.buyerName}</div><div style="font-size:12px;color:var(--muted)">${o.buyerEmail} · ${o.buyerCity}</div></td>
      <td><span class="chip">${o.productName}</span></td>
      <td style="color:var(--muted);font-size:13px">${o.date}</td>
      <td style="color:var(--green);font-weight:700">₹${o.amount.toLocaleString('en-IN')}</td>
      <td><span class="badge ${o.status==='Paid'?'badge-green':'badge-orange'}">● ${o.status}</span></td>
      <td><button class="btn-orange" style="font-size:12px;padding:6px 14px" onclick="openConnect('${o.buyerName.replace(/'/g, "\\'")}','${o.buyerEmail}','${o.productName.replace(/'/g, "\\'")}','${o.date}')">💬 Connect</button></td>
    </tr>`).join('');
}

function searchBuyers(q){
  document.querySelectorAll('#buyersTbody tr').forEach(r=>{
    r.style.display=r.textContent.toLowerCase().includes(q.toLowerCase())?'':'none';
  });
}

/* ── SELLER: EARNINGS ── */
function renderEarnings(){
  const myProducts = allProducts;
  const myOrders = allOrders;

  const paid = myOrders.filter(o=>o.status==='Paid');
  const total = paid.reduce((s,o)=>s+o.amount,0);
  
  document.getElementById('eTotalRev').textContent = '₹' + total.toLocaleString('en-IN');
  document.getElementById('eMonthRev').textContent = '₹' + (total * 0.15).toLocaleString('en-IN'); 
  document.getElementById('eWeekRev').textContent = '₹' + (total * 0.05).toLocaleString('en-IN'); 
  document.getElementById('eTotalOrders').textContent = paid.length;
  
  const prodStats = myProducts.map(p=>{
    const sales = paid.filter(o=>o.productId===p._id);
    return {name:p.name, count:sales.length, rev:sales.reduce((s,o)=>s+o.amount,0)};
  }).sort((a,b)=>b.rev - a.rev);
  
  document.getElementById('eProdTbody').innerHTML = prodStats.map(s=>`
    <tr><td style="font-weight:600">${s.name}</td><td>${s.count}</td><td style="color:var(--green);font-weight:700">₹${s.rev.toLocaleString('en-IN')}</td><td><button class="btn-orange" style="font-size:12px;padding:5px 12px" onclick="show('seller-buyers')">View all</button></td></tr>
  `).join('');
  
  document.getElementById('eTransTbody').innerHTML = myOrders.slice(-5).reverse().map(o=>`
    <tr><td>${o.buyerName}</td><td style="color:var(--muted);font-size:13px">${o.productName}</td><td style="color:var(--green);font-weight:700">₹${o.amount.toLocaleString('en-IN')}</td><td><span class="badge ${o.status==='Paid'?'badge-green':'badge-orange'}">● ${o.status}</span></td></tr>
  `).join('');

  // Draw visual canvas line/area trend graph
  setTimeout(() => drawTrendChart(myOrders), 50);
}

/* ── MARKETPLACE ── */
function renderMarket(cat){
  const el=document.getElementById('mktList');
  if(!el) return;
  const list = cat&&cat!=='All' ? allProducts.filter(p=>p.cat===cat) : allProducts;
  el.innerHTML=list.map(p=>`
    <div class="prod-card" onclick="viewProduct('${p._id}')">
      <div class="prod-thumb">${p.icon}</div>
      <div class="prod-body">
        <div class="prod-cat">${p.cat}</div>
        <div class="prod-name">${p.name}</div>
        <div style="font-size:12px;color:var(--muted);margin-bottom:8px">By ${p.sellerName || 'Verified Creator'}</div>
        <div class="prod-desc">${p.desc.substring(0,85)}...</div>
        <div class="chips">${p.tags.map(t=>`<span class="chip">${t}</span>`).join('')}</div>
        <div class="prod-footer">
          <div class="prod-price">₹${p.price.toLocaleString('en-IN')}</div>
          <div style="font-size:12px;color:var(--muted)">${p.sales} sold · 4.8★</div>
        </div>
      </div>
    </div>`).join('');
}

function filterCat(cat,btn){
  document.querySelectorAll('.filt-btn').forEach(b=>b.classList.remove('on'));
  if(btn) btn.classList.add('on');
  renderMarket(cat);
}

function filterSearch(q){
  const filtered=allProducts.filter(p=>
    p.name.toLowerCase().includes(q.toLowerCase())||
    p.cat.toLowerCase().includes(q.toLowerCase())||
    p.desc.toLowerCase().includes(q.toLowerCase())
  );
  const el=document.getElementById('mktList');
  if(!el) return;
  el.innerHTML=filtered.map(p=>`
    <div class="prod-card" onclick="viewProduct('${p._id}')">
      <div class="prod-thumb">${p.icon}</div>
      <div class="prod-body">
        <div class="prod-cat">${p.cat}</div>
        <div class="prod-name">${p.name}</div>
        <div style="font-size:12px;color:var(--muted);margin-bottom:8px">By ${p.sellerName || 'Verified Creator'}</div>
        <div class="prod-desc">${p.desc.substring(0,85)}...</div>
        <div class="chips">${p.tags.map(t=>`<span class="chip">${t}</span>`).join('')}</div>
        <div class="prod-footer">
          <div class="prod-price">₹${p.price.toLocaleString('en-IN')}</div>
          <div style="font-size:12px;color:var(--muted)">${p.sales} sold · 4.8★</div>
        </div>
      </div>
    </div>`).join('');
}

function viewProduct(id){
  currentProduct=allProducts.find(p=>p._id===id);
  if(!currentProduct) return;
  document.getElementById('dIcon').textContent=currentProduct.icon;
  document.getElementById('dCat').textContent=currentProduct.cat;
  document.getElementById('dName').textContent=currentProduct.name;
  document.getElementById('dPrice').textContent='₹'+currentProduct.price.toLocaleString('en-IN');
  document.getElementById('dDesc').textContent=currentProduct.desc;
  document.getElementById('dTags').innerHTML=currentProduct.tags.map(t=>`<span class="chip">${t}</span>`).join('');
  
  const owned=userPurchases.find(o=>o.id===id || o._id===id);
  const btn=document.getElementById('buyNowBtn');
  if(owned){
    btn.textContent='✅ Already owned';
    btn.style.background='rgba(34,197,94,0.15)';
    btn.style.color='var(--green)';
    btn.disabled = true;
  } else {
    btn.textContent='🛒 Buy Now';
    btn.style.background='';
    btn.style.color='';
    btn.disabled = false;
  }
  show('product');
}

async function doBuy(){
  if(!currentProduct) return;
  if(userPurchases.find(o=>o.id===currentProduct._id || o._id===currentProduct._id)){notify('You already own this product!');return;}
  
  openCheckoutModal(currentProduct._id, currentProduct.name, currentProduct.price);
}

function renderOrders(){
  const el=document.getElementById('ordersList');
  if(!el) return;
  if(!userPurchases.length){
    el.innerHTML=`<div class="empty-state"><div class="ei">🛒</div><h3>No orders yet</h3><p>Browse the marketplace and purchase your first AI tool</p><button class="btn-big" onclick="show('buyer-market')" style="margin-top:20px;font-size:15px;padding:12px 28px">Browse Marketplace</button></div>`;
    return;
  }
  el.innerHTML=`<div class="prod-grid">`+userPurchases.map(p=>`
    <div class="prod-card">
      <div class="prod-thumb">${p.icon}</div>
      <div class="prod-body">
        <div class="prod-cat">${p.cat}</div>
        <div class="prod-name">${p.name}</div>
        <div class="prod-desc">${p.desc.substring(0,80)}...</div>
        <div class="prod-footer">
          <div class="prod-price">₹${p.price.toLocaleString('en-IN')}</div>
          <div style="font-size:12px;color:var(--green)">✅ Purchased on ${p.boughtOn}</div>
        </div>
        <button class="submit-btn" style="margin-top:12px;font-size:13px;padding:10px" onclick="openAccess('${p.name}')">🔓 Access Product</button>
      </div>
    </div>`).join('')+`</div>`;
}

function openAccess(name){
  notify('Opening dashboard for '+name+'... (Full access granted)');
}

/* ── CONNECT MODAL ── */
function openConnect(name,email,product,date){
  document.getElementById('mBuyerName').textContent='Connect with '+name;
  document.getElementById('mBuyerInfo').textContent=name+' · '+email+' · Bought '+product+' on '+date;
  document.getElementById('msgThread').innerHTML=
    `<div class="bubble bubble-them">Hi! I just purchased ${product}. Really impressive work! 🔥</div>
     <div class="bubble bubble-me">Thank you so much, ${name.split(' ')[0]}! Let me know if you need help getting started.</div>
     <div class="bubble bubble-them">Can you share the setup documentation and a quick onboarding call?</div>`;
  document.getElementById('connectModal').classList.add('open');
}

function closeModal(){
  document.getElementById('connectModal').classList.remove('open');
}

function sendMsg(){
  const inp=document.getElementById('msgInput');
  const txt=inp.value.trim();
  if(!txt) return;
  const thread=document.getElementById('msgThread');
  const b=document.createElement('div');
  b.className='bubble bubble-me';
  b.textContent=txt;
  thread.appendChild(b);
  thread.scrollTop=thread.scrollHeight;
  inp.value='';
  setTimeout(()=>{
    const r=document.createElement('div');
    r.className='bubble bubble-them';
    r.textContent='Thanks for the message! I\'ll get back to you within a few hours.';
    thread.appendChild(r);
    thread.scrollTop=thread.scrollHeight;
  },1200);
}

document.getElementById('connectModal').addEventListener('click',e=>{if(e.target===e.currentTarget)closeModal();});

/* ── CONTACT FORMS ── */
function submitContact(){
  const n=document.getElementById('cName').value;
  const e=document.getElementById('cEmail').value;
  if(!n||!e){notify('Please fill in name and email');return;}
  document.getElementById('cSuccess').style.display='block';
  notify('Message sent!');
  setTimeout(()=>{document.getElementById('cSuccess').style.display='none';},5000);
}

function submitSellerContact(){
  if(!document.getElementById('sContactMsg').value){notify('Please enter a message');return;}
  document.getElementById('sContactSuccess').style.display='block';
  notify('Support ticket created!');
  setTimeout(()=>{document.getElementById('sContactSuccess').style.display='none';},5000);
}

function submitBuyerContact(){
  if(!document.getElementById('bContactMsg').value){notify('Please enter a message');return;}
  document.getElementById('bContactSuccess').style.display='block';
  notify('Support ticket created!');
  setTimeout(()=>{document.getElementById('bContactSuccess').style.display='none';},5000);
}

/* ── NOTIFY ── */
function notify(msg){
  const el=document.getElementById('notif');
  el.textContent=msg;
  el.classList.add('show');
  setTimeout(()=>el.classList.remove('show'),3200);
}

// Google Auth
async function handleGoogleResponse(response) {
  const res = await api('/auth/google', 'POST', { idToken: response.credential });
  if (res.success) {
    currentUser = res.user;
    localStorage.setItem('ox_user', JSON.stringify(currentUser));
    const role = currentUser.role || (currentUser.email === 'admin@omnixaai.in' ? 'seller' : 'buyer');
    setRole(role);
  } else {
    notify('Google Login failed: ' + res.message);
  }
}

function initGoogleAuth() {
  if (window.google) {
    google.accounts.id.initialize({
      client_id: '19792595973-1teed1o06iiofunr0hn63cso36nq2l0v.apps.googleusercontent.com',
      callback: handleGoogleResponse
    });
    const btnContainer = document.getElementById('googleBtnContainer');
    if (btnContainer) {
      google.accounts.id.renderButton(
        btnContainer,
        { theme: 'outline', size: 'large', type: 'standard', text: 'continue_with', width: 340 }
      );
    }
  }
}

async function updateSettings() {
  if (!currentUser) return;
  const newName = document.getElementById('set-name').value;
  const newAvatar = document.getElementById('set-avatar').value;
  
  if (!newName) {
    notify('Name cannot be empty');
    return;
  }
  
  notify('Updating profile... ⏳');
  const res = await api('/auth/profile', 'PUT', { email: currentUser.email, full_name: newName, avatar: newAvatar });
  
  if (res.success) {
    currentUser = res.user;
    localStorage.setItem('ox_user', JSON.stringify(currentUser));
    
    // Update name in navbars
    if(currentRole === 'seller'){
      const sName = document.getElementById('sName');
      if(sName) sName.textContent = currentUser.name;
      const sGreet = document.getElementById('sGreetName');
      if(sGreet) sGreet.textContent = 'Welcome, ' + currentUser.name.split(' ')[0] + '!';
    } else {
      const bName = document.getElementById('bName');
      if(bName) bName.textContent = currentUser.name;
      const bGreet = document.getElementById('bGreetName');
      if(bGreet) bGreet.textContent = 'Welcome, ' + currentUser.name.split(' ')[0] + '!';
    }
    
    const successBar = document.getElementById('set-success');
    successBar.style.display = 'block';
    setTimeout(() => { successBar.style.display = 'none'; }, 4000);
    notify('✅ Profile updated successfully!');
  } else {
    notify('Update failed: ' + res.message);
  }
}

// Mobile Menu
function toggleMenu(btn) {
  const nav = btn.closest('.nav');
  if (nav) {
    const links = nav.querySelector('.nav-links');
    if (links) {
      links.classList.toggle('open');
      const backdrop = document.getElementById('menuBackdrop');
      if (backdrop) backdrop.classList.toggle('open');
    }
  }
}

function closeMenu() {
  document.querySelectorAll('.nav-links').forEach(n => n.classList.remove('open'));
  const backdrop = document.getElementById('menuBackdrop');
  if (backdrop) backdrop.classList.remove('open');
}

// Tab switcher for landing page sub-views with smooth transitions
function showTab(tabId) {
  show('landing');
  
  document.querySelectorAll('.landing-tab').forEach(el => {
    el.classList.remove('active', 'fade-in-tab');
    el.style.display = 'none';
  });
  
  const target = document.getElementById('tab-' + tabId);
  if (target) {
    target.style.display = 'block';
    // Trigger transition next frame
    requestAnimationFrame(() => {
      target.classList.add('active', 'fade-in-tab');
    });
  }
  
  document.querySelectorAll('#landingNavLinks .nav-link').forEach(btn => {
    if (btn.getAttribute('onclick') && btn.getAttribute('onclick').includes(`showTab('${tabId}')`)) {
      btn.classList.add('active-link');
    } else {
      btn.classList.remove('active-link');
    }
  });

  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// Toggle Billing Period for Pricing Tiers
function toggleBillingPeriod(period) {
  const btnRow = document.querySelector('.toggle-btn');
  if (btnRow) {
    btnRow.querySelectorAll('.toggle-opt').forEach(btn => {
      if (btn.getAttribute('onclick') && btn.getAttribute('onclick').includes(period)) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });
  }

  const starter = document.getElementById('price-starter');
  const growth = document.getElementById('price-growth');
  
  if (period === 'annual') {
    if (starter) starter.textContent = '399';
    if (growth) growth.textContent = '1,039';
  } else {
    if (starter) starter.textContent = '499';
    if (growth) growth.textContent = '1,299';
  }
}

// Check for existing session
window.onload = async () => {
  initGoogleAuth();
  initMajestic3D();
  initCardTilt();
  initScrollReveal();
  initMagneticButtons();
  
  // Glowing Scroll Progress Bar Tracker
  window.addEventListener('scroll', () => {
    const winScroll = document.body.scrollTop || document.documentElement.scrollTop;
    const height = document.documentElement.scrollHeight - document.documentElement.clientHeight;
    const scrolled = height > 0 ? (winScroll / height) * 100 : 0;
    const progressBar = document.getElementById('scroll-progress');
    if (progressBar) {
      progressBar.style.width = scrolled + '%';
    }
  });

  if(currentUser && currentRole) {
    setRole(currentRole);
  } else {
    // We still want to load global stats on landing page
    await initData();
    show('landing');
    showTab('home'); // Ensure we land on home sub-tab
  }
}

// ── 3D MAJESTIC EXPERIENCE (THREE.JS & CARD TILT) ──
function initMajestic3D() {
  const canvas = document.getElementById('bg-3d-canvas');
  if (!canvas) return;

  // Initialize Three.js
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
  const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

  // Wavy Particle Field
  const particleCount = 2000;
  const positions = new Float32Array(particleCount * 3);
  const colors = new Float32Array(particleCount * 3);

  // Cyan theme color (#00d2ff)
  const cyanColor = new THREE.Color('#00d2ff');

  for (let i = 0; i < particleCount; i++) {
    const i3 = i * 3;
    positions[i3] = (Math.random() - 0.5) * 45; // X
    positions[i3 + 1] = (Math.random() - 0.5) * 25; // Y
    positions[i3 + 2] = (Math.random() - 0.5) * 35; // Z

    // Add color values with slight variance
    colors[i3] = cyanColor.r * (0.8 + Math.random() * 0.2);
    colors[i3 + 1] = cyanColor.g * (0.8 + Math.random() * 0.2);
    colors[i3 + 2] = cyanColor.b * (0.8 + Math.random() * 0.2);
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

  // Custom round particle texture (CSS Radial Gradient Canvas)
  const pCanvas = document.createElement('canvas');
  pCanvas.width = 16;
  pCanvas.height = 16;
  const pCtx = pCanvas.getContext('2d');
  const grad = pCtx.createRadialGradient(8, 8, 0, 8, 8, 8);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.3, 'rgba(255,255,255,0.8)');
  grad.addColorStop(1, 'rgba(0,0,0,0)');
  pCtx.fillStyle = grad;
  pCtx.fillRect(0, 0, 16, 16);
  const pTexture = new THREE.CanvasTexture(pCanvas);

  const material = new THREE.PointsMaterial({
    size: 0.16,
    sizeAttenuation: true,
    vertexColors: true,
    transparent: true,
    alphaMap: pTexture,
    depthWrite: false,
    blending: THREE.AdditiveBlending
  });

  const points = new THREE.Points(geometry, material);
  scene.add(points);

  const initialPositions = new Float32Array(positions);

  // Floating Wireframe shapes in Hero Section
  const wireGroup = new THREE.Group();
  scene.add(wireGroup);

  const ringGeo = new THREE.TorusGeometry(3.5, 0.08, 12, 48);
  const crystalGeo = new THREE.OctahedronGeometry(1.8, 1);
  const bigRingGeo = new THREE.RingGeometry(4.5, 4.6, 64);

  const lineMat = new THREE.LineBasicMaterial({
    color: '#00d2ff',
    transparent: true,
    opacity: 0.18,
    blending: THREE.AdditiveBlending
  });

  const meshMat = new THREE.MeshBasicMaterial({
    color: '#00d2ff',
    wireframe: true,
    transparent: true,
    opacity: 0.08,
    blending: THREE.AdditiveBlending
  });

  const torusMesh = new THREE.Mesh(ringGeo, meshMat);
  const crystalMesh = new THREE.Mesh(crystalGeo, meshMat);
  const ringLine = new THREE.LineLoop(bigRingGeo, lineMat);

  torusMesh.position.set(10, 5, -15);
  crystalMesh.position.set(-10, -5, -10);
  ringLine.position.set(5, -4, -12);

  wireGroup.add(torusMesh);
  wireGroup.add(crystalMesh);
  wireGroup.add(ringLine);

  camera.position.z = 15;

  let mouseX = 0, mouseY = 0;
  let ndcX = 0, ndcY = 0;
  let targetX = 0, targetY = 0;

  window.addEventListener('mousemove', (e) => {
    mouseX = (e.clientX - window.innerWidth / 2) / 100;
    mouseY = (e.clientY - window.innerHeight / 2) / 100;
    ndcX = (e.clientX / window.innerWidth) * 2 - 1;
    ndcY = -(e.clientY / window.innerHeight) * 2 + 1;
  });

  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  let clock = new THREE.Clock();
  let accumulatedTime = 0;

  function animate() {
    requestAnimationFrame(animate);

    const deltaTime = clock.getDelta();
    accumulatedTime += deltaTime * (window.threeCtx && window.threeCtx.speedMultiplier !== undefined ? window.threeCtx.speedMultiplier : 1.0);
    const elapsedTime = accumulatedTime;

    // Project screen coordinates to world space ray direction
    const rayDir = new THREE.Vector3(ndcX, ndcY, 0.5);
    rayDir.unproject(camera);
    rayDir.sub(camera.position).normalize();

    // Wavy Particle Simulation with dynamic mouse repulsion (gravity)
    const posArr = geometry.attributes.position.array;
    for (let i = 0; i < particleCount; i++) {
      const i3 = i * 3;
      const px = initialPositions[i3];
      const py = initialPositions[i3 + 1];
      const pz = initialPositions[i3 + 2];

      const targetY_wave = py + 
        Math.sin(elapsedTime + px * 0.2) * 1.2 + 
        Math.cos(elapsedTime + pz * 0.15) * 0.8;

      // Intersect the mouse ray with the plane z = pz for this specific particle
      // t * rayDir.z + camera.position.z = pz => t = (pz - camera.position.z) / rayDir.z
      const t = (pz - camera.position.z) / rayDir.z;
      const mouseWorldX = camera.position.x + t * rayDir.x;
      const mouseWorldY = camera.position.y + t * rayDir.y;

      const dx = px - mouseWorldX;
      const dy = targetY_wave - mouseWorldY;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist < 4.8) {
        const force = (1.0 - dist / 4.8) * 1.6;
        posArr[i3] = px + (dx / dist) * force;
        posArr[i3 + 1] = targetY_wave + (dy / dist) * force;
        posArr[i3 + 2] = pz;
      } else {
        posArr[i3] = px;
        posArr[i3 + 1] = targetY_wave;
        posArr[i3 + 2] = pz;
      }
    }
    geometry.attributes.position.needsUpdate = true;

    // Rotate wireframe shapes
    torusMesh.rotation.x = elapsedTime * 0.2;
    torusMesh.rotation.y = elapsedTime * 0.15;

    crystalMesh.rotation.y = elapsedTime * 0.3;
    crystalMesh.rotation.z = elapsedTime * 0.1;

    ringLine.rotation.x = elapsedTime * 0.05;
    ringLine.rotation.y = elapsedTime * 0.1;

    // Smooth camera mouse follow
    targetX += (mouseX - targetX) * 0.05;
    targetY += (mouseY - targetY) * 0.05;

    camera.position.x = targetX * 1.5;
    camera.position.y = -targetY * 1.5;
    camera.lookAt(scene.position);

    renderer.render(scene, camera);
  }

  animate();

  // Expose context for theme switching
  window.threeCtx = {
    lineMat,
    meshMat,
    pointsMat: material,
    geometry,
    particleCount,
    initialPositions
  };

  // Run initial theme configuration for Three.js
  const savedTheme = localStorage.getItem('theme') || 'cyan';
  const themeColors = {
    cyan: { primary: '#00d2ff', isLight: false },
    orange: { primary: '#FF4500', isLight: false },
    light: { primary: '#4f46e5', isLight: true },
    emerald: { primary: '#10b981', isLight: false },
    cyberpunk: { primary: '#ec4899', isLight: false },
    solar: { primary: '#f59e0b', isLight: false },
    crimson: { primary: '#ef4444', isLight: false },
    royal: { primary: '#a855f7', isLight: false },
    nordic: { primary: '#14b8a6', isLight: false },
    aurora: { primary: '#0d9488', isLight: true },
    sakura: { primary: '#db2777', isLight: true },
    'day-amber': { primary: '#d97706', isLight: true },
    terminal: { primary: '#22c55e', isLight: false }
  };
  const current = themeColors[savedTheme] || themeColors.cyan;
  if (window.updateThreeJSColors) {
    window.updateThreeJSColors(current.primary, current.isLight);
  }
}

function initCardTilt() {
  const cards = document.querySelectorAll('.tilt-card-3d');
  
  cards.forEach(card => {
    card.addEventListener('mousemove', (e) => {
      const rect = card.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      
      // Update mouse coordinates for CSS radial spotlight
      card.style.setProperty('--mouse-x', `${x}px`);
      card.style.setProperty('--mouse-y', `${y}px`);
      
      const xc = rect.width / 2;
      const yc = rect.height / 2;
      
      const angleX = ((yc - y) / yc) * 14; 
      const angleY = ((x - xc) / xc) * 14;
      
      card.style.transform = `perspective(1000px) rotateX(${angleX}deg) rotateY(${angleY}deg) scale3d(1.03, 1.03, 1.03)`;
      
      const pops = card.querySelectorAll('.pop-3d-1, .pop-3d-2, .pop-3d-3, .pop-3d-img');
      pops.forEach(pop => {
        let depth = 30;
        if(pop.classList.contains('pop-3d-1')) depth = 15;
        if(pop.classList.contains('pop-3d-2')) depth = 35;
        if(pop.classList.contains('pop-3d-3')) depth = 55;
        if(pop.classList.contains('pop-3d-img')) depth = 45;
        
        pop.style.transform = `translateZ(${depth}px)`;
        pop.style.transition = 'transform 0.05s ease-out';
      });
    });
    
    card.style.transformStyle = 'preserve-3d';
    
    card.addEventListener('mouseleave', () => {
      card.style.transform = 'perspective(1000px) rotateX(0deg) rotateY(0deg) scale3d(1, 1, 1)';
      card.style.transition = 'transform 0.5s ease';
      
      const pops = card.querySelectorAll('.pop-3d-1, .pop-3d-2, .pop-3d-3, .pop-3d-img');
      pops.forEach(pop => {
        pop.style.transform = 'translateZ(0px)';
        pop.style.transition = 'transform 0.5s ease';
      });
    });
  });
}

function initScrollReveal() {
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('revealed');
        observer.unobserve(entry.target);
      }
    });
  }, {
    threshold: 0.05,
    rootMargin: '0px 0px -40px 0px'
  });
  
  document.querySelectorAll('.scroll-reveal').forEach(el => observer.observe(el));
}

function initMagneticButtons() {
  const btns = document.querySelectorAll('.magnetic-btn');
  btns.forEach(btn => {
    btn.addEventListener('mousemove', (e) => {
      const rect = btn.getBoundingClientRect();
      const x = e.clientX - rect.left - rect.width / 2;
      const y = e.clientY - rect.top - rect.height / 2;
      
      // Pull button towards cursor within a range
      btn.style.transform = `translate(${x * 0.35}px, ${y * 0.35}px)`;
      btn.style.transition = 'transform 0.1s ease-out';
    });
    
    btn.addEventListener('mouseleave', () => {
      btn.style.transform = 'translate(0, 0)';
      btn.style.transition = 'transform 0.4s cubic-bezier(0.16, 1, 0.3, 1)';
    });
  });
}

// Expose functions to global scope for inline HTML onclick handlers
window.show = show;
window.showTab = showTab;
window.toggleBillingPeriod = toggleBillingPeriod;
window.scrollSec = scrollSec;
window.doLogin = doLogin;
window.doSignup = doSignup;
window.setRole = setRole;
window.doLogout = doLogout;
window.livePreview = livePreview;
window.submitProduct = submitProduct;
window.openConnect = openConnect;
window.closeModal = closeModal;
window.sendMsg = sendMsg;
window.submitContact = submitContact;
window.submitSellerContact = submitSellerContact;
window.submitBuyerContact = submitBuyerContact;
window.filterCat = filterCat;
window.filterSearch = filterSearch;
window.viewProduct = viewProduct;
window.doBuy = doBuy;
window.openAccess = openAccess;
window.searchBuyers = searchBuyers;
window.initGoogleAuth = initGoogleAuth;
window.updateSettings = updateSettings;
window.toggleMenu = toggleMenu;
window.closeMenu = closeMenu;

window.goHome = function() {
  if (currentUser && currentUser.role === 'seller') {
    show('seller-home');
  } else if (currentUser && currentUser.role === 'buyer') {
    show('buyer-home');
  } else {
    show('landing');
  }
};

// ── THEME SWITCHER CONTROLLERS ──
function toggleThemeDropdown(e) {
  if (e) e.stopPropagation();
  const dropdown = document.getElementById('themeDropdown');
  if (dropdown) {
    dropdown.classList.toggle('open');
  }
}

function updateThreeJSColors(hexColor, isLightTheme) {
  const color = new THREE.Color(hexColor);
  
  if (window.threeCtx) {
    const ctx = window.threeCtx;
    if (ctx.lineMat) {
      ctx.lineMat.color.copy(color);
      ctx.lineMat.opacity = isLightTheme ? 0.28 : 0.18;
      ctx.lineMat.blending = isLightTheme ? THREE.NormalBlending : THREE.AdditiveBlending;
    }
    if (ctx.meshMat) {
      ctx.meshMat.color.copy(color);
      ctx.meshMat.opacity = isLightTheme ? 0.12 : 0.08;
      ctx.meshMat.blending = isLightTheme ? THREE.NormalBlending : THREE.AdditiveBlending;
    }
    if (ctx.pointsMat) {
      ctx.pointsMat.blending = isLightTheme ? THREE.NormalBlending : THREE.AdditiveBlending;
    }
    if (ctx.geometry) {
      const colors = ctx.geometry.attributes.color.array;
      for (let i = 0; i < ctx.particleCount; i++) {
        const i3 = i * 3;
        colors[i3] = color.r * (0.8 + Math.random() * 0.2);
        colors[i3 + 1] = color.g * (0.8 + Math.random() * 0.2);
        colors[i3 + 2] = color.b * (0.8 + Math.random() * 0.2);
      }
      ctx.geometry.attributes.color.needsUpdate = true;
    }
  }
}

function setTheme(themeName, e) {
  if (e) e.stopPropagation();
  document.documentElement.setAttribute('data-theme', themeName);
  localStorage.setItem('theme', themeName);
  
  const themeColors = {
    cyan: { primary: '#00d2ff', isLight: false },
    orange: { primary: '#FF4500', isLight: false },
    light: { primary: '#4f46e5', isLight: true },
    emerald: { primary: '#10b981', isLight: false },
    cyberpunk: { primary: '#ec4899', isLight: false },
    solar: { primary: '#f59e0b', isLight: false },
    crimson: { primary: '#ef4444', isLight: false },
    royal: { primary: '#a855f7', isLight: false },
    nordic: { primary: '#14b8a6', isLight: false },
    aurora: { primary: '#0d9488', isLight: true },
    sakura: { primary: '#db2777', isLight: true },
    'day-amber': { primary: '#d97706', isLight: true },
    terminal: { primary: '#22c55e', isLight: false }
  };
  
  const selected = themeColors[themeName] || themeColors.cyan;
  updateThreeJSColors(selected.primary, selected.isLight);
  
  // Highlight active theme in the float dropdown
  const themeIds = [
    'theme-opt-cyan', 'theme-opt-orange', 'theme-opt-light', 
    'theme-opt-emerald', 'theme-opt-cyberpunk', 'theme-opt-solar', 
    'theme-opt-crimson', 'theme-opt-royal', 'theme-opt-nordic', 
    'theme-opt-aurora', 'theme-opt-sakura', 'theme-opt-day-amber', 
    'theme-opt-terminal'
  ];
  themeIds.forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      if (id === `theme-opt-${themeName}`) {
        el.classList.add('active');
      } else {
        el.classList.remove('active');
      }
    }
  });

  const dropdown = document.getElementById('themeDropdown');
  if (dropdown) dropdown.classList.remove('open');
}

// Close theme dropdown when clicking outside
document.addEventListener('click', () => {
  const dropdown = document.getElementById('themeDropdown');
  if (dropdown && dropdown.classList.contains('open')) {
    dropdown.classList.remove('open');
  }
});

// Run initial UI updates on load
window.addEventListener('DOMContentLoaded', () => {
  const savedTheme = localStorage.getItem('theme') || 'cyan';
  // Set active class on load
  const themeIds = [
    'theme-opt-cyan', 'theme-opt-orange', 'theme-opt-light', 
    'theme-opt-emerald', 'theme-opt-cyberpunk', 'theme-opt-solar', 
    'theme-opt-crimson', 'theme-opt-royal', 'theme-opt-nordic', 
    'theme-opt-aurora', 'theme-opt-sakura', 'theme-opt-day-amber', 
    'theme-opt-terminal'
  ];
  themeIds.forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      if (id === `theme-opt-${savedTheme}`) {
        el.classList.add('active');
      } else {
        el.classList.remove('active');
      }
    }
  });
});

// Expose theme functions to window
window.toggleThemeDropdown = toggleThemeDropdown;
window.setTheme = setTheme;
window.updateThreeJSColors = updateThreeJSColors;

/* ── 1. SPOTLIGHT TRACKING & SCROLL PROGRESS ── */
let spotlightX = window.innerWidth / 2;
let spotlightY = window.innerHeight / 2;
let currentSpotlightX = spotlightX;
let currentSpotlightY = spotlightY;

document.addEventListener('mousemove', (e) => {
  spotlightX = e.clientX;
  spotlightY = e.clientY;
  
  const spotlight = document.getElementById('cursorSpotlight');
  if (spotlight) spotlight.style.opacity = '1';
});

function animateSpotlight() {
  currentSpotlightX += (spotlightX - currentSpotlightX) * 0.08;
  currentSpotlightY += (spotlightY - currentSpotlightY) * 0.08;
  
  const spotlight = document.getElementById('cursorSpotlight');
  if (spotlight) {
    spotlight.style.left = `${currentSpotlightX}px`;
    spotlight.style.top = `${currentSpotlightY}px`;
  }
  requestAnimationFrame(animateSpotlight);
}
requestAnimationFrame(animateSpotlight);

/* ── 2. PARTICLE SPEED & SIZE CUSTOMIZER RANGE INPUTS ── */
function changeParticleSpeed(val) {
  const label = document.getElementById('val-speed');
  if (label) label.textContent = parseFloat(val).toFixed(1);
  if (window.threeCtx) {
    window.threeCtx.speedMultiplier = parseFloat(val);
  }
}
function changeParticleSize(val) {
  const label = document.getElementById('val-size');
  if (label) label.textContent = parseFloat(val).toFixed(2);
  if (window.threeCtx && window.threeCtx.pointsMat) {
    window.threeCtx.pointsMat.size = parseFloat(val);
  }
}
window.changeParticleSpeed = changeParticleSpeed;
window.changeParticleSize = changeParticleSize;

/* ── 3. COUNT-UP COUNTERS ENGINE ── */
function animateValue(id, start, end, duration, prefix = '', suffix = '', isDecimal = false) {
  const obj = document.getElementById(id);
  if (!obj) return;
  let startTimestamp = null;
  const step = (timestamp) => {
    if (!startTimestamp) startTimestamp = timestamp;
    const progress = Math.min((timestamp - startTimestamp) / duration, 1);
    const rawValue = progress * (end - start) + start;
    const value = isDecimal ? rawValue.toFixed(1) : Math.floor(rawValue);
    
    let displayVal = value;
    if (!isDecimal) {
      if (end >= 10000000) {
        displayVal = (value / 10000000).toFixed(1) + 'Cr+';
      } else if (end >= 100000) {
        displayVal = (value / 100000).toFixed(1) + 'L+';
      } else if (end >= 1000) {
        displayVal = (value / 1000).toFixed(1) + 'K+';
      } else {
        displayVal = value.toLocaleString('en-IN');
      }
    }
    obj.textContent = prefix + displayVal + suffix;
    if (progress < 1) {
      window.requestAnimationFrame(step);
    }
  };
  window.requestAnimationFrame(step);
}
window.animateValue = animateValue;

/* ── 4. CUSTOM LINE CHART ENGINE (CANVAS BASED) ── */
function drawTrendChart(orders) {
  const canvas = document.getElementById('earningsTrendCanvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  
  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  canvas.width = rect.width * dpr;
  canvas.height = rect.height * dpr;
  ctx.scale(dpr, dpr);
  
  const width = rect.width;
  const height = rect.height;
  
  const paidOrders = orders.filter(o => o.status === 'Paid');
  const dataPoints = [];
  const days = 7;
  
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const dateStr = d.toLocaleDateString('en-IN', {day:'numeric', month:'short'});
    
    const dayOrders = paidOrders.filter(o => {
      const oDate = new Date(o.date);
      return oDate.toDateString() === d.toDateString();
    });
    const amount = dayOrders.reduce((sum, o) => sum + (o.amount || 0), 0);
    dataPoints.push({ label: dateStr, value: amount });
  }
  
  const maxVal = Math.max(...dataPoints.map(d => d.value), 5000);
  
  const paddingLeft = 50;
  const paddingBottom = 30;
  const paddingTop = 20;
  const paddingRight = 20;
  const chartWidth = width - paddingLeft - paddingRight;
  const chartHeight = height - paddingTop - paddingBottom;
  
  ctx.clearRect(0, 0, width, height);

  // Draw Grid Lines
  ctx.strokeStyle = 'rgba(255,255,255,0.06)';
  ctx.lineWidth = 1;
  for (let i = 0; i <= 4; i++) {
    const y = paddingTop + (chartHeight * i / 4);
    ctx.beginPath();
    ctx.moveTo(paddingLeft, y);
    ctx.lineTo(width - paddingRight, y);
    ctx.stroke();
    
    ctx.fillStyle = 'var(--muted)';
    ctx.font = '10px Inter, sans-serif';
    ctx.textAlign = 'right';
    const val = maxVal - (maxVal * i / 4);
    ctx.fillText('₹' + Math.round(val), paddingLeft - 10, y + 3);
  }
  
  const coords = dataPoints.map((pt, i) => {
    const x = paddingLeft + (chartWidth * i / (days - 1));
    const y = paddingTop + chartHeight - (chartHeight * pt.value / maxVal);
    return { x, y, label: pt.label, value: pt.value };
  });
  
  const themeCyan = getComputedStyle(document.documentElement).getPropertyValue('--cyan').trim() || '#00d2ff';
  
  // Fill gradient
  ctx.beginPath();
  ctx.moveTo(coords[0].x, coords[0].y);
  for (let i = 0; i < coords.length - 1; i++) {
    const xc = (coords[i].x + coords[i + 1].x) / 2;
    const yc = (coords[i].y + coords[i + 1].y) / 2;
    ctx.quadraticCurveTo(coords[i].x, coords[i].y, xc, yc);
  }
  ctx.lineTo(coords[coords.length - 1].x, coords[coords.length - 1].y);
  ctx.lineTo(coords[coords.length - 1].x, paddingTop + chartHeight);
  ctx.lineTo(coords[0].x, paddingTop + chartHeight);
  ctx.closePath();
  
  const grad = ctx.createLinearGradient(0, paddingTop, 0, paddingTop + chartHeight);
  grad.addColorStop(0, themeCyan + '22');
  grad.addColorStop(1, 'transparent');
  ctx.fillStyle = grad;
  ctx.fill();
  
  // Stroke line
  ctx.beginPath();
  ctx.moveTo(coords[0].x, coords[0].y);
  for (let i = 0; i < coords.length - 1; i++) {
    const xc = (coords[i].x + coords[i + 1].x) / 2;
    const yc = (coords[i].y + coords[i + 1].y) / 2;
    ctx.quadraticCurveTo(coords[i].x, coords[i].y, xc, yc);
  }
  ctx.lineTo(coords[coords.length - 1].x, coords[coords.length - 1].y);
  ctx.strokeStyle = themeCyan;
  ctx.lineWidth = 3;
  ctx.stroke();
  
  // Draw Dots and bottom labels
  coords.forEach((c) => {
    ctx.beginPath();
    ctx.arc(c.x, c.y, 4, 0, Math.PI * 2);
    ctx.fillStyle = 'var(--card)';
    ctx.fill();
    ctx.strokeStyle = themeCyan;
    ctx.lineWidth = 2;
    ctx.stroke();
    
    ctx.fillStyle = 'var(--muted)';
    ctx.font = '10px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(c.label, c.x, height - 10);
  });

  // Mouse move tooltip trigger
  canvas.onmousemove = (e) => {
    const mRect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - mRect.left;
    const mouseY = e.clientY - mRect.top;
    
    let closest = null;
    let minDist = 30;
    coords.forEach(c => {
      const dist = Math.abs(c.x - mouseX);
      if (dist < minDist) {
        minDist = dist;
        closest = c;
      }
    });
    
    if (closest) {
      drawTrendChart(orders);
      
      // Vertical guide line
      ctx.strokeStyle = 'rgba(255,255,255,0.15)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(closest.x, paddingTop);
      ctx.lineTo(closest.x, paddingTop + chartHeight);
      ctx.stroke();
      
      // Highlight dot
      ctx.beginPath();
      ctx.arc(closest.x, closest.y, 6, 0, Math.PI * 2);
      ctx.fillStyle = themeCyan;
      ctx.fill();
      
      // Tooltip Card
      ctx.fillStyle = 'var(--card)';
      ctx.strokeStyle = 'var(--border)';
      ctx.lineWidth = 1;
      const tooltipW = 100;
      const tooltipH = 45;
      const tx = closest.x - tooltipW / 2;
      const ty = closest.y - tooltipH - 10;
      
      ctx.beginPath();
      ctx.roundRect(tx, ty, tooltipW, tooltipH, 6);
      ctx.fill();
      ctx.stroke();
      
      ctx.fillStyle = 'white';
      ctx.font = 'bold 11px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('₹' + closest.value.toLocaleString('en-IN'), closest.x, ty + 18);
      
      ctx.fillStyle = 'var(--muted)';
      ctx.font = '9px Inter, sans-serif';
      ctx.fillText(closest.label, closest.x, ty + 32);
    }
  };
}
window.drawTrendChart = drawTrendChart;

/* ── 5. FLOATING GLASSMORPHIC AI ASSISTANT CHATBOT ── */
const aiBotReplies = {
  how_to_buy: "To purchase any AI product, simply click on its card in the Marketplace and click 'Buy Now'. This opens the theme-matched secure checkout. After simulated verification, the product key and download/dashboard dashboard links will instantly populate inside your 'My Orders' tab.",
  seller_fees: "OmniXa AI offers 100% free hosting. We charge 0% commission fees on sales so creators keep all of their earnings. There are no recurring subscriptions.",
  api_key: "All AI tools include visual sandboxing. View any product's details and switch to the 'API & Developer Sandbox' tab. Here, you can copy test credentials and run mock REST queries directly inside the browser terminal console.",
  custom_builds: "Yes! Our specialized AI engineering squad provides custom fine-tuning and retrieval pipelines for enterprise requirements. Contact us using the demo button to arrange a detailed callback.",
  default: "I'm the OmniXa automated helper bot! Ask me about listing items, checking API keys, order processes, or custom ML fine-tuning services."
};

function toggleAIAssistant(e) {
  if (e) e.stopPropagation();
  const card = document.getElementById('aiChatCard');
  if (card) card.classList.toggle('open');
}

function handleAISuggestion(topic) {
  const container = document.getElementById('aiChatBody');
  if (!container) return;
  
  const topicsMap = {
    how_to_buy: "How do I purchase tools?",
    seller_fees: "What are the seller commissions?",
    api_key: "Where can I test the API keys?",
    custom_builds: "Do you offer custom integrations?"
  };
  
  // Render user question
  const userMsg = document.createElement('div');
  userMsg.className = 'ai-msg user';
  userMsg.textContent = topicsMap[topic] || topic;
  container.appendChild(userMsg);
  container.scrollTop = container.scrollHeight;
  
  // Trigger simulation typing
  simulateBotResponse(aiBotReplies[topic] || aiBotReplies.default);
}

function sendAIMessage() {
  const input = document.getElementById('aiMsgInput');
  if (!input || !input.value.trim()) return;
  
  const container = document.getElementById('aiChatBody');
  if (!container) return;
  
  const text = input.value.trim();
  input.value = '';
  
  const userMsg = document.createElement('div');
  userMsg.className = 'ai-msg user';
  userMsg.textContent = text;
  container.appendChild(userMsg);
  container.scrollTop = container.scrollHeight;
  
  // Match keyword replies
  let matchedReply = aiBotReplies.default;
  const lower = text.toLowerCase();
  if (lower.includes('buy') || lower.includes('purchase') || lower.includes('order')) {
    matchedReply = aiBotReplies.how_to_buy;
  } else if (lower.includes('commission') || lower.includes('fee') || lower.includes('charge')) {
    matchedReply = aiBotReplies.seller_fees;
  } else if (lower.includes('api') || lower.includes('sandbox') || lower.includes('key') || lower.includes('code')) {
    matchedReply = aiBotReplies.api_key;
  } else if (lower.includes('custom') || lower.includes('consult') || lower.includes('integration')) {
    matchedReply = aiBotReplies.custom_builds;
  }
  
  simulateBotResponse(matchedReply);
}

function simulateBotResponse(text) {
  const container = document.getElementById('aiChatBody');
  if (!container) return;
  
  // Render loading typing dots
  const loadingMsg = document.createElement('div');
  loadingMsg.className = 'ai-msg bot';
  loadingMsg.innerHTML = '<span style="display:inline-block; animation: pulse 1s infinite;">•</span><span style="display:inline-block; animation: pulse 1s infinite; animation-delay:0.2s;">•</span><span style="display:inline-block; animation: pulse 1s infinite; animation-delay:0.4s;">•</span>';
  container.appendChild(loadingMsg);
  container.scrollTop = container.scrollHeight;
  
  setTimeout(() => {
    loadingMsg.remove();
    const botMsg = document.createElement('div');
    botMsg.className = 'ai-msg bot';
    botMsg.textContent = text;
    container.appendChild(botMsg);
    container.scrollTop = container.scrollHeight;
  }, 1000);
}
window.toggleAIAssistant = toggleAIAssistant;
window.handleAISuggestion = handleAISuggestion;
window.sendAIMessage = sendAIMessage;

/* ── 6. PRODUCT DETAIL TABS & TERMINAL SANDBOX MOCKUP ── */
function switchSandboxTab(tabName) {
  const tabs = document.querySelectorAll('.sandbox-tab-btn');
  const panes = document.querySelectorAll('.sandbox-pane');
  
  tabs.forEach(t => t.classList.remove('active'));
  panes.forEach(p => p.classList.remove('active'));
  
  if (tabName === 'features') {
    const tabBtn = document.getElementById('tabBtnFeatures');
    const pane = document.getElementById('paneFeatures');
    if (tabBtn) tabBtn.classList.add('active');
    if (pane) pane.classList.add('active');
  } else {
    const tabBtn = document.getElementById('tabBtnDeveloper');
    const pane = document.getElementById('paneDeveloper');
    if (tabBtn) tabBtn.classList.add('active');
    if (pane) pane.classList.add('active');
    updateTerminalCode();
  }
}

function updateTerminalCode() {
  const method = document.getElementById('sandboxMethod').value;
  const prompt = document.getElementById('sandboxPrompt').value || 'Hello';
  const termBody = document.getElementById('sandboxTermBody');
  if (!termBody) return;
  
  let codeStr = '';
  if (method === 'POST_inference') {
    codeStr = `guest@omnixa-sandbox:~$ curl -X POST https://api.omnixa.ai/v1/inference \\<br/>` +
              `  -H "Authorization: Bearer ox_live_839a28f...b78f" \\<br/>` +
              `  -H "Content-Type: application/json" \\<br/>` +
              `  -d '{"model": "omnixa-core-v2", "prompt": "${prompt}"}'`;
  } else if (method === 'GET_status') {
    codeStr = `guest@omnixa-sandbox:~$ curl -X GET https://api.omnixa.ai/v1/status \\<br/>` +
              `  -H "Authorization: Bearer ox_live_839a28f...b78f"`;
  } else {
    codeStr = `guest@omnixa-sandbox:~$ curl -X GET https://api.omnixa.ai/v1/usage \\<br/>` +
              `  -H "Authorization: Bearer ox_live_839a28f...b78f"`;
  }
  
  termBody.innerHTML = `<div class="term-prompt">${codeStr}</div><div class="term-log"># Click 'Execute API Call' to request simulation...</div>`;
}

function runSandboxQuery() {
  const method = document.getElementById('sandboxMethod').value;
  const prompt = document.getElementById('sandboxPrompt').value || 'Hello';
  const termBody = document.getElementById('sandboxTermBody');
  if (!termBody) return;
  
  // loading logs
  termBody.innerHTML += `<div style="color:var(--muted); margin-top:8px;">Sending secure request to gateway...</div>` +
                        `<div style="color:var(--cyan); margin-top:4px;">Connecting socket channel...</div>`;
  
  setTimeout(() => {
    let responseObj = {};
    if (method === 'POST_inference') {
      responseObj = {
        status: "success",
        timestamp: new Date().toISOString(),
        model: "omnixa-core-v2",
        latency: "142ms",
        results: [
          {
            output: `Processed prompt successful. Optimized model output generated for: "${prompt}".`,
            confidence: 0.992
          }
        ],
        usage: { prompt_tokens: 14, completion_tokens: 28, cost: "$0.000084" }
      };
    } else if (method === 'GET_status') {
      responseObj = {
        node: "omnixa-cluster-india-03",
        status: "healthy",
        uptime_seconds: 432920,
        average_response_ms: 12,
        active_tunnels: 24,
        gpu_utilization: "72.4%"
      };
    } else {
      responseObj = {
        account_id: "acc_902384a29c",
        tier: "Developer Elite",
        monthly_limit: 1000000,
        requests_this_month: 24392,
        cost_accumulated_usd: 12.04,
        billing_currency: "INR",
        estimated_next_invoice: "₹1,012.30"
      };
    }
    
    termBody.innerHTML += `<div style="color:#10b981; margin-top:8px; font-weight:bold;"><<< Response Received (200 OK):</div>` +
                          `<pre style="color:#22c55e; margin-top:4px; margin-bottom:0; font-family:monospace;">${JSON.stringify(responseObj, null, 2)}</pre>`;
    termBody.scrollTop = termBody.scrollHeight;
  }, 1000);
}

function copySandboxKey() {
  const keyField = document.getElementById('sandboxApiKey');
  if (keyField) {
    keyField.select();
    navigator.clipboard.writeText(keyField.value);
    notify('🔐 API key copied to clipboard!');
  }
}
window.switchSandboxTab = switchSandboxTab;
window.updateTerminalCode = updateTerminalCode;
window.runSandboxQuery = runSandboxQuery;
window.copySandboxKey = copySandboxKey;

/* ── 7. THEME-MATCHED CHECKOUT PAYMENT DIALOG ── */
let checkoutProductId = null;
let checkoutProductName = '';
let checkoutProductPrice = 0;
let checkoutPayMethod = 'card';

function openCheckoutModal(prodId, name, price) {
  checkoutProductId = prodId;
  checkoutProductName = name;
  checkoutProductPrice = price;
  
  document.getElementById('chkProdName').textContent = name;
  document.getElementById('chkProdPrice').textContent = '₹' + price.toLocaleString('en-IN');
  
  const modal = document.getElementById('checkoutModalBg');
  if (modal) modal.classList.add('open');
  
  // Pre-fill placeholder info
  document.getElementById('chkCardNumber').value = '';
  document.getElementById('chkCardName').value = '';
  document.getElementById('chkCardExpiry').value = '';
  document.getElementById('chkCardCVV').value = '';
  
  updateCardVisuals();
  switchPayMethod('card');
}

function closeCheckoutModal() {
  const modal = document.getElementById('checkoutModalBg');
  if (modal) modal.classList.remove('open');
}

function switchPayMethod(method) {
  checkoutPayMethod = method;
  
  const btnCard = document.getElementById('btnPayCard');
  const btnUpi = document.getElementById('btnPayUPI');
  const formCard = document.getElementById('payFormCard');
  const formUpi = document.getElementById('payFormUPI');
  
  if (method === 'card') {
    if (btnCard) btnCard.classList.add('active');
    if (btnUpi) btnUpi.classList.remove('active');
    if (formCard) formCard.style.display = 'block';
    if (formUpi) formUpi.style.display = 'none';
  } else {
    if (btnCard) btnCard.classList.remove('active');
    if (btnUpi) btnUpi.classList.add('active');
    if (formCard) formCard.style.display = 'none';
    if (formUpi) formUpi.style.display = 'block';
  }
}

function updateCardVisuals() {
  const num = document.getElementById('chkCardNumber').value || '•••• •••• •••• ••••';
  const name = document.getElementById('chkCardName').value || 'YOUR NAME';
  const expiry = document.getElementById('chkCardExpiry').value || 'MM/YY';
  
  const dNum = document.getElementById('chkCardNumDisplay');
  const dName = document.getElementById('chkCardNameDisplay');
  const dExpiry = document.getElementById('chkCardExpiryDisplay');
  
  if (dNum) dNum.textContent = num;
  if (dName) dName.textContent = name.toUpperCase();
  if (dExpiry) dExpiry.textContent = expiry;
}

async function processCheckoutPurchase() {
  if (!checkoutProductId) return;
  
  // Validate forms
  if (checkoutPayMethod === 'card') {
    const num = document.getElementById('chkCardNumber').value;
    const name = document.getElementById('chkCardName').value;
    const expiry = document.getElementById('chkCardExpiry').value;
    const cvv = document.getElementById('chkCardCVV').value;
    if (!num || !name || !expiry || !cvv) {
      notify('⚠️ Please fill out all card details fields!');
      return;
    }
  } else {
    const vpa = document.getElementById('chkUpiVpa').value;
    if (!vpa || !vpa.includes('@')) {
      notify('⚠️ Please specify a valid UPI VPA address!');
      return;
    }
  }

  const payBtn = document.getElementById('checkoutPayBtn');
  if (payBtn) {
    payBtn.disabled = true;
    payBtn.innerHTML = '<span style="display:inline-block; width:12px; height:12px; border:2px solid var(--btn-text); border-top-color:transparent; border-radius:50%; animation:spin 0.8s infinite linear; margin-right:6px; vertical-align:middle;"></span> Processing payment...';
  }
  
  const date = new Date().toLocaleDateString('en-IN', {day:'numeric', month:'short', year:'numeric'});
  const order = {
    buyerName: currentUser ? currentUser.name : 'Guest User',
    buyerEmail: currentUser ? currentUser.email : 'guest@example.com',
    buyerCity: 'India',
    buyerId: currentUser ? currentUser.id : undefined,
    productId: checkoutProductId,
    productName: checkoutProductName,
    amount: checkoutProductPrice,
    status: 'Paid',
    date: date
  };
  
  const res = await api('/orders', 'POST', order);
  if (res.success) {
    // Refresh purchases data
    if (currentUser) {
      const purchasesRes = await api('/orders/purchases?email=' + currentUser.email);
      userPurchases = Array.isArray(purchasesRes) ? purchasesRes : [];
    } else {
      // Direct push for guests
      userPurchases.push({
        _id: checkoutProductId,
        name: checkoutProductName,
        price: checkoutProductPrice,
        icon: '🤖',
        cat: 'AI Tool',
        desc: 'Product description goes here.',
        tags: ['AI'],
        boughtOn: date
      });
    }
    
    setTimeout(() => {
      closeCheckoutModal();
      notify('🎉 Payment verified! Product added to orders successfully.');
      
      const buyBtn = document.getElementById('buyNowBtn');
      if (buyBtn) {
        buyBtn.textContent = '✅ Purchased Successfully';
        buyBtn.disabled = true;
      }
      
      // Navigate to orders
      show('buyer-orders');
      
      // reset payBtn status
      if (payBtn) {
        payBtn.disabled = false;
        payBtn.textContent = '💳 Complete Payment';
      }
    }, 1500);
  } else {
    notify('❌ Checkout failed. Please try again.');
    if (payBtn) {
      payBtn.disabled = false;
      payBtn.textContent = '💳 Complete Payment';
    }
  }
}
window.openCheckoutModal = openCheckoutModal;
window.closeCheckoutModal = closeCheckoutModal;
window.switchPayMethod = switchPayMethod;
window.updateCardVisuals = updateCardVisuals;
window.processCheckoutPurchase = processCheckoutPurchase;

