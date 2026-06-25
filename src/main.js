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
  
  let formattedRev = '₹0';
  if (totalRevenue >= 10000000) {
    formattedRev = '₹' + (totalRevenue / 10000000).toFixed(1) + 'Cr+';
  } else if (totalRevenue >= 100000) {
    formattedRev = '₹' + (totalRevenue / 100000).toFixed(1) + 'L+';
  } else if (totalRevenue >= 1000) {
    formattedRev = '₹' + (totalRevenue / 1000).toFixed(1) + 'K+';
  } else {
    formattedRev = '₹' + totalRevenue;
  }
  
  let formattedBuyers = uniqueBuyers;
  if (uniqueBuyers >= 1000) {
    formattedBuyers = (uniqueBuyers / 1000).toFixed(1) + 'K+';
  }
  
  const hProducts = document.getElementById('hMetricProducts');
  if (hProducts) hProducts.textContent = totalProducts > 0 ? totalProducts : '0';
  const hBuyers = document.getElementById('hMetricBuyers');
  if (hBuyers) hBuyers.textContent = formattedBuyers;
  const hRev = document.getElementById('hMetricRev');
  if (hRev) hRev.textContent = formattedRev;
  
  const aProducts = document.getElementById('aMetricProducts');
  if (aProducts) aProducts.textContent = totalProducts > 0 ? totalProducts : '0';
  const aBuyers = document.getElementById('aMetricBuyers');
  if (aBuyers) aBuyers.textContent = formattedBuyers;
  const aRev = document.getElementById('aMetricRev');
  if (aRev) aRev.textContent = formattedRev;
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
  
  const date = new Date().toLocaleDateString('en-IN', {day:'numeric', month:'short', year:'numeric'});
  const order = {
    buyerName: currentUser ? currentUser.name : 'Guest User',
    buyerEmail: currentUser ? currentUser.email : 'guest@example.com',
    buyerCity: 'India',
    buyerId: currentUser ? currentUser.id : undefined,
    productId: currentProduct._id,
    productName: currentProduct.name,
    amount: currentProduct.price,
    status: 'Paid',
    date: date
  };
  
  notify('Processing purchase... ⏳');
  const res = await api('/orders', 'POST', order);
  if(res.success){
    const btn=document.getElementById('buyNowBtn');
    btn.textContent='✅ Purchase successful!';
    btn.style.background='rgba(34,197,94,0.15)';
    btn.style.color='var(--green)';
    btn.disabled = true;
    
    notify('🎉 Purchase complete! Check My Orders for access.');
    setTimeout(()=>show('buyer-orders'), 1500);
  }
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

// Tab switcher for landing page sub-views
function showTab(tabId) {
  // Ensure landing page is shown first
  show('landing');
  
  // Hide all tabs
  document.querySelectorAll('.landing-tab').forEach(el => el.classList.remove('active'));
  
  // Show requested tab
  const target = document.getElementById('tab-' + tabId);
  if (target) target.classList.add('active');
  
  // Update active state in nav link buttons
  document.querySelectorAll('#landingNavLinks .nav-link').forEach(btn => {
    if (btn.getAttribute('onclick') && btn.getAttribute('onclick').includes(`showTab('${tabId}')`)) {
      btn.classList.add('active-link');
    } else {
      btn.classList.remove('active-link');
    }
  });

  // Smooth scroll to top of page
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
  grad.addColorStop(0.3, 'rgba(0,210,255,0.8)');
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
  let targetX = 0, targetY = 0;

  window.addEventListener('mousemove', (e) => {
    mouseX = (e.clientX - window.innerWidth / 2) / 100;
    mouseY = (e.clientY - window.innerHeight / 2) / 100;
  });

  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  let clock = new THREE.Clock();

  function animate() {
    requestAnimationFrame(animate);

    const elapsedTime = clock.getElapsedTime();

    // Wavy Particle Simulation
    const posArr = geometry.attributes.position.array;
    for (let i = 0; i < particleCount; i++) {
      const i3 = i * 3;
      const x = initialPositions[i3];
      const z = initialPositions[i3 + 2];

      posArr[i3 + 1] = initialPositions[i3 + 1] + 
        Math.sin(elapsedTime + x * 0.2) * 1.2 + 
        Math.cos(elapsedTime + z * 0.15) * 0.8;
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
}

function initCardTilt() {
  const cards = document.querySelectorAll('.tilt-card-3d');
  
  cards.forEach(card => {
    card.addEventListener('mousemove', (e) => {
      const rect = card.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      
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

