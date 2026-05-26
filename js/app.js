// ===================== STATE =====================
let S = { groups:[], expenses:[], cfg:{ curr:'INR', fbConfig:null, localMode:false, myProfile:{name:'',phone:''} } };
let curGid = null, splitMode = 'equal', selEmoji = '🏖️', editGid = null, pendingMembers = [];
let fbDb = null;
let currentPhone = null;
let authVerifier = null;
let authResult = null;
let fbUnsubscribes = [];
let fbDataBuffer = { groups: {}, expenses: {} };

const CURR = {INR:'₹',USD:'$',EUR:'€',GBP:'£',AED:'د',SGD:'S$',JPY:'¥',CAD:'C$',AUD:'A$',CHF:'₣',MYR:'RM',THB:'฿'};
const CATCLR = {'Food & Dining':'#f59e0b','Travel':'#3b82f6','Stay':'#8b5cf6','Shopping':'#ec4899','Entertainment':'#22c55e','Transport':'#14b8a6','Utilities':'#f97316','Medical':'#ef4444','Other':'#6b7280'};
const CATEM = {'Food & Dining':'🍕','Travel':'✈️','Stay':'🏨','Shopping':'🛒','Entertainment':'🎉','Transport':'🚗','Utilities':'💡','Medical':'💊','Other':'📦'};
const EMOJIS = ['🏖️','✈️','🍕','🏠','🎉','🚗','💼','👨‍👩‍👧','🎮','🏃','🛒','❤️','⚽','🎸','📚','💊','🌏','🎓'];
const AVC = ['av-1','av-2','av-3','av-4','av-5','av-6'];

// ===================== INIT =====================
function init() {
  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.has('phone')) currentPhone = urlParams.get('phone');
  
  loadLocal();
  if(!S.cfg.myProfile) S.cfg.myProfile = {name:'', phone:''};
  
  initEmojiPicker();
  renderProfile();
  renderHome();
  renderAllGroups();
  initFirebase();
}

function loadLocal() {
  try { const d = localStorage.getItem('se_v2'); if(d) S = {...S,...JSON.parse(d)}; } catch(e){}
  if(S.cfg.fbConfig && document.getElementById('fbConfigStr')) {
    document.getElementById('fbConfigStr').value = JSON.stringify(S.cfg.fbConfig, null, 2);
  }
}

function saveMem() {
  try { localStorage.setItem('se_v2', JSON.stringify(S)); } catch(e){}
}

function getMyName() {
  if (currentPhone) {
    for (const g of S.groups) {
      if (g.phones) {
        for (const [name, phone] of Object.entries(g.phones)) {
          if (phone === currentPhone) return name;
        }
      }
    }
    return 'Guest';
  }
  return S.cfg.myProfile?.name || 'You';
}

function getFilteredGroups() {
  const active = S.groups.filter(g=>!g.isDeleted);
  if (!currentPhone) return active;
  return active.filter(g => g.memberPhones && g.memberPhones[currentPhone]);
}

function getFilteredExpenses() {
  const activeExps = S.expenses.filter(e=>!e.isDeleted);
  if (!currentPhone) return activeExps;
  const myGroups = getFilteredGroups().map(g => g.id);
  return activeExps.filter(e => myGroups.includes(e.groupId));
}

function uid() { return Date.now().toString(36)+Math.random().toString(36).slice(2,6); }
function fAmt(n,curr) { const s=(CURR[curr||S.cfg.curr]||'₹'); return s+(n||0).toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g,','); }
function fDate(ts) { return new Date(ts).toLocaleDateString('en-IN',{day:'numeric',month:'short'}); }
function initials(name) { return name.split(' ').map(x=>x[0]).join('').toUpperCase().slice(0,2); }

// ===================== NAVIGATION =====================
function goTo(pg) {
  document.querySelectorAll('.page').forEach(p=>p.classList.remove('active'));
  document.querySelectorAll('.ni').forEach(n=>n.classList.remove('active'));
  document.getElementById('page-'+pg).classList.add('active');
  document.getElementById('nav-'+pg).classList.add('active');
  if(pg==='charts') renderCharts();
  if(pg==='home') renderHome();
  if(pg==='groups') renderAllGroups();
}

// ===================== PROFILE =====================
function editProfile() {
  const name = prompt('Enter your Name:', S.cfg.myProfile?.name || '');
  if (name === null) return;
  let phone = prompt('Enter your Phone Number:', S.cfg.myProfile?.phone || '');
  if (phone === null) return;
  
  phone = phone.trim();
  if (phone && !phone.startsWith('+')) phone = '+91' + phone;

  S.cfg.myProfile.name = name.trim();
  S.cfg.myProfile.phone = phone;
  saveMem();
  renderProfile();
  renderHome();
  toast('Profile updated');
}

function renderProfile() {
  const n = S.cfg.myProfile?.name;
  const p = S.cfg.myProfile?.phone;
  document.getElementById('profName').textContent = n ? n : 'Not set';
  document.getElementById('profPhone').textContent = p ? p : 'Tap to setup profile';
}

// ===================== SHEETS =====================
function openSheet(id) { document.getElementById(id).classList.add('open'); }
function closeSheet(id) { document.getElementById(id).classList.remove('open'); }
document.querySelectorAll('.mbg').forEach(b=>b.addEventListener('click',e=>{if(e.target===b)b.classList.remove('open');}));

// ===================== TOAST =====================
function toast(msg) {
  const t=document.getElementById('toast');
  t.textContent=msg; t.classList.add('show');
  setTimeout(()=>t.classList.remove('show'),2500);
}

function copyText(txt) {
  navigator.clipboard.writeText(txt).then(() => toast('Link copied!'));
}

// ===================== EMOJI PICKER =====================
function initEmojiPicker() {
  document.getElementById('emojiPick').innerHTML = EMOJIS.map(e=>
    `<div class="chip${e===selEmoji?' active':''}" onclick="pickEmoji(this,'${e}')">${e}</div>`
  ).join('');
}

function pickEmoji(el,e) {
  document.querySelectorAll('#emojiPick .chip').forEach(c=>c.classList.remove('active'));
  el.classList.add('active'); selEmoji=e;
}

// ===================== GROUP MANAGEMENT =====================
function addMemBtn() {
  const name = document.getElementById('memInputName').value.trim();
  let phone = document.getElementById('memInputPhone').value.trim();
  if (phone && !phone.startsWith('+')) phone = '+91' + phone;
  
  if(name && !pendingMembers.find(m => m.name === name)) {
    pendingMembers.push({name, phone});
    document.getElementById('memInputName').value = '';
    document.getElementById('memInputPhone').value = '';
    renderMemChips();
  }
}

function renderMemChips() {
  document.getElementById('memChips').innerHTML = pendingMembers.map((m,i)=>
    `<div class="chip active">${m.name}${m.phone ? ` (${m.phone})` : ''} <span style="cursor:pointer;font-size:16px;margin-left:2px" onclick="remMem(${i})">×</span></div>`
  ).join('');
}

function remMem(i) { pendingMembers.splice(i,1); renderMemChips(); }

function saveGroup() {
  const name=document.getElementById('gName').value.trim();
  if(!name) { toast('Enter a group name'); return; }
  
  const myName = getMyName();
  const myPhone = currentPhone || S.cfg.myProfile?.phone || '';
  
  const members = [myName];
  const phones = {};
  const memberPhones = {}; // Index for security rules
  if (myPhone) {
    phones[myName] = myPhone;
    memberPhones[myPhone] = true;
  }
  
  pendingMembers.forEach(m => {
    if (m.name !== myName) {
      members.push(m.name);
      if (m.phone) {
        phones[m.name] = m.phone;
        memberPhones[m.phone] = true;
      }
    }
  });

  if(editGid) {
    const g=S.groups.find(g=>g.id===editGid);
    if(g){
      g.name=name;g.emoji=selEmoji;g.members=members;g.phones=phones;g.memberPhones=memberPhones;
      if (fbDb) {
        fbDb.ref('groups/' + g.id).update({name, emoji:selEmoji, members, phones, memberPhones});
        Object.keys(memberPhones).forEach(phone => {
          fbDb.ref('userGroups/' + phone + '/' + g.id).set(true);
        });
      }
    }
    editGid=null;
  } else {
    const newG = {id:uid(),name,emoji:selEmoji,members,phones,memberPhones,createdAt:Date.now(),isDeleted:false};
    if (S.cfg.localMode) { S.groups.push(newG); }
    if (fbDb) {
      fbDb.ref('groups/' + newG.id).set(newG);
      Object.keys(memberPhones).forEach(phone => {
        fbDb.ref('userGroups/' + phone + '/' + newG.id).set(true);
      });
    }
  }
  if (S.cfg.localMode) saveMem(); 
  closeSheet('gs');
  pendingMembers=[]; document.getElementById('gName').value=''; 
  if(document.getElementById('memInputName')) document.getElementById('memInputName').value='';
  if(document.getElementById('memInputPhone')) document.getElementById('memInputPhone').value='';
  renderMemChips();
  renderHome(); renderAllGroups(); toast('Group saved! 👍');
}

// ===================== EXPENSE MANAGEMENT =====================
function openAddExpense(gid=null) {
  const activeGroups = getFilteredGroups();
  if(!activeGroups.length) { toast('Create a group first!'); openSheet('gs'); return; }
  const sel=document.getElementById('eGroup');
  sel.innerHTML=activeGroups.map(g=>`<option value="${g.id}">${g.emoji} ${g.name}</option>`).join('');
  if(gid) sel.value=gid;
  updateExpenseMembers();
  openSheet('es');
}

function updateExpenseMembers() {
  const g=S.groups.find(g=>g.id===document.getElementById('eGroup').value);
  if(!g) return;
  document.getElementById('ePaidBy').innerHTML=g.members.map(m=>`<option value="${m}">${m}</option>`).join('');
  document.getElementById('ePaidBy').value=getMyName(); // Default to logged in user
  renderSplitList();
}

function setSplitMode(m) { splitMode=m; renderSplitList(); }

function renderSplitList() {
  const g=S.groups.find(g=>g.id===document.getElementById('eGroup').value);
  if(!g) return;
  const amt=parseFloat(document.getElementById('eAmt').value)||0;
  const n=g.members.length;
  document.getElementById('splitList').innerHTML = g.members.map((m,i)=>{
    const av=AVC[i%AVC.length]; const ini=initials(m);
    let right='';
    if(splitMode==='equal') right=`<span style="font-size:13px;font-weight:600;color:var(--text2)">${CURR[document.getElementById('eCurr').value]||'₹'}${(amt/n).toFixed(2)}</span>`;
    else right=`<div class="msh"><input class="fi" type="number" placeholder="${splitMode==='pct'?'%':'0'}" min="0" ${splitMode==='pct'?'max="100"':''} step="0.01" id="sp${i}" data-m="${m}"></div>`;
    return `<div class="mr">
      <div class="av ${av}">${ini}</div>
      <div class="mn">${m}</div>
      <div class="mck on" id="ck${i}" onclick="toggleMck(${i},this)">✓</div>
      ${right}
    </div>`;
  }).join('');
}

function toggleMck(i,el) { el.classList.toggle('on'); el.textContent=el.classList.contains('on')?'✓':''; }

function pickCat(el) { document.querySelectorAll('#catChips .chip').forEach(c=>c.classList.remove('active')); el.classList.add('active'); }
function pickToggle(el,id) { document.getElementById(id).querySelectorAll('.to').forEach(b=>b.classList.remove('active')); el.classList.add('active'); }

function saveExpense() {
  const gid=document.getElementById('eGroup').value;
  const title=document.getElementById('eTitle').value.trim();
  const amt=parseFloat(document.getElementById('eAmt').value);
  if(!title){toast('Add a title');return;}
  if(!amt||amt<=0){toast('Add an amount');return;}
  const g=S.groups.find(g=>g.id===gid);
  const catEl=document.querySelector('#catChips .chip.active');
  const paidEl=document.querySelector('#paidTg .to.active');
  const splits={};
  g.members.forEach((m,i)=>{
    const ck=document.getElementById('ck'+i);
    if(!ck||!ck.classList.contains('on')) return;
    if(splitMode==='equal'){
      const inc=g.members.filter((_,j)=>document.getElementById('ck'+j)?.classList.contains('on'));
      splits[m]=amt/inc.length;
    } else {
      const inp=document.getElementById('sp'+i);
      splits[m]=splitMode==='pct'?amt*(parseFloat(inp?.value||0)/100):parseFloat(inp?.value||0);
    }
  });
  const newE = {
    id:uid(),groupId:gid,title,desc:document.getElementById('eDesc').value,
    amount:amt,currency:document.getElementById('eCurr').value,
    category:catEl?.dataset.v||'Other',paidBy:document.getElementById('ePaidBy').value,
    isPaid:paidEl?.dataset.v==='paid',splitMode,splits,createdAt:Date.now(),isDeleted:false
  };
  
  if (S.cfg.localMode) { S.expenses.push(newE); saveMem(); }
  if (fbDb) fbDb.ref('groups/' + gid + '/expenses/' + newE.id).set(newE);
  
  closeSheet('es');
  document.getElementById('eTitle').value=''; document.getElementById('eAmt').value=''; document.getElementById('eDesc').value='';
  renderHome(); toast('Expense added! 🎉');
  if(curGid) openGroupDetail(curGid);
}

function delExpense(id) {
  if(!confirm('Delete this expense?')) return;
  const e = S.expenses.find(x=>x.id===id);
  if(e) {
    e.isDeleted = true;
    e.deletedAt = Date.now();
    if (S.cfg.localMode) { saveMem(); }
    if (fbDb) fbDb.ref('groups/' + e.groupId + '/expenses/' + id).update({isDeleted: true, deletedAt: e.deletedAt});
  }
  renderHome(); toast('Deleted');
  if(curGid) openGroupDetail(curGid);
}

// ===================== RENDER HOME =====================
function renderHome() {
  const activeExps = getFilteredExpenses();
  const activeGroups = getFilteredGroups();
  const myName = getMyName();
  
  const total=activeExps.reduce((s,e)=>s+e.amount,0);
  const owe=activeExps.filter(e=>!e.isPaid&&e.paidBy!==myName).reduce((s,e)=>s+(e.splits?.[myName]||0),0);
  const owed=activeExps.filter(e=>!e.isPaid&&e.paidBy===myName).reduce((s,e)=>s+e.amount-(e.splits?.[myName]||0),0);
  
  document.getElementById('hTotal').textContent=fAmt(total);
  document.getElementById('hOwe').textContent=fAmt(owe);
  document.getElementById('hOwed').textContent=fAmt(owed);
  document.getElementById('hGroups').textContent=activeGroups.length;
  const gh=document.getElementById('groupsHome');
  if(!activeGroups.length) {
    gh.innerHTML=`<div class="empty"><div class="empty-i">👥</div><div class="empty-t">No groups yet</div><div class="empty-s">Create a group to start tracking shared expenses</div></div>`;
  } else {
    gh.innerHTML=activeGroups.map(g=>groupHTML(g)).join('');
  }
  const recent=[...activeExps].sort((a,b)=>b.createdAt-a.createdAt).slice(0,5);
  const rh=document.getElementById('recentHome');
  if(!recent.length){rh.style.display='none';}
  else{rh.style.display='';rh.innerHTML=recent.map(expHTML).join('');}
}

function groupHTML(g) {
  const exps=S.expenses.filter(e=>e.groupId===g.id && !e.isDeleted);
  const total=exps.reduce((s,e)=>s+e.amount,0);
  const up=exps.filter(e=>!e.isPaid).length;
  return `<div class="gc" onclick="openGroupDetail('${g.id}')">
    <div class="ga">${g.emoji}</div>
    <div class="gi">
      <div class="gn">${g.name}</div>
      <div class="gm">${g.members.length} members · ${exps.length} expenses${up?` · <span style="color:var(--red)">${up} unpaid</span>`:''}</div>
    </div>
    <div class="gamt"><div class="a">${fAmt(total)}</div><div class="l">total</div></div>
  </div>`;
}

function expHTML(e) {
  const g=S.groups.find(gr=>gr.id===e.groupId);
  const sym=CURR[e.currency]||'₹';
  return `<div class="ei">
    <div class="eic" style="background:${CATCLR[e.category]||'#6b7280'}22">${CATEM[e.category]||'📦'}</div>
    <div class="eii">
      <div class="eit">${e.title}</div>
      <div class="eim">${g?.name||''} · ${e.paidBy} · ${fDate(e.createdAt)}</div>
    </div>
    <div class="eir">
      <div class="eia">${sym}${e.amount.toFixed(2)}</div>
      <div class="eip ${e.isPaid?'p-y':'p-n'}">${e.isPaid?'Paid':'Unpaid'}</div>
    </div>
  </div>`;
}

// ===================== GROUP DETAIL =====================
function openGroupDetail(gid) {
  curGid=gid;
  const g=S.groups.find(gr=>gr.id===gid);
  if(!g) return;
  const exps=S.expenses.filter(e=>e.groupId===gid && !e.isDeleted);
  const total=exps.reduce((s,e)=>s+e.amount,0);
  const unpaid=exps.filter(e=>!e.isPaid).reduce((s,e)=>s+e.amount,0);
  document.getElementById('gdEmoji').textContent=g.emoji;
  document.getElementById('gdName').textContent=g.name;
  document.getElementById('gdMems').textContent=g.members.join(', ');
  document.getElementById('gdTotal').textContent=fAmt(total);
  document.getElementById('gdUnpaid').textContent=fAmt(unpaid);
  const bals=calcBalances(g,exps);
  const bEl=document.getElementById('gdBal');
  bEl.innerHTML=!bals.length
    ?`<div style="font-size:14px;color:var(--text2);text-align:center;padding:12px 0">✅ All settled up!</div>`
    :bals.map(b=>`<div class="bi"><div style="font-size:16px">→</div><div class="bt"><strong>${b.from}</strong> owes <strong>${b.to}</strong></div><div class="ba">${fAmt(b.amount)}</div></div>`).join('');
  
  // Access Links
  const linkTitle = document.getElementById('gdLinksTitle');
  const linkCard = document.getElementById('gdLinks').parentElement;
  const linksHtml = [];
  g.members.forEach(m => {
    if (g.phones && g.phones[m]) {
      const url = new URL(window.location.href);
      // No longer need ?phone= since they will log in securely, but we can pass ?group= to deep link
      url.searchParams.set('group', g.id);
      linksHtml.push(`<div class="mr" style="justify-content:space-between">
        <div class="mn">${m} <span style="font-size:11px;color:var(--text2)">(${g.phones[m]})</span></div>
        <button class="btn btn-o" style="padding:6px 12px;font-size:12px" onclick="copyText('${url.toString()}')">Copy Link</button>
      </div>`);
    }
  });
  if (linksHtml.length) {
    linkTitle.style.display = 'block';
    linkCard.style.display = 'block';
    document.getElementById('gdLinks').innerHTML = linksHtml.join('');
  } else {
    linkTitle.style.display = 'none';
    linkCard.style.display = 'none';
  }
  
  const eEl=document.getElementById('gdExp');
  eEl.innerHTML=!exps.length
    ?`<div style="font-size:14px;color:var(--text2);text-align:center;padding:16px 0">No expenses yet</div>`
    :[...exps].sort((a,b)=>b.createdAt-a.createdAt).map(e=>`
      <div class="ei">
        <div class="eic" style="background:${CATCLR[e.category]}22">${CATEM[e.category]||'📦'}</div>
        <div class="eii"><div class="eit">${e.title}</div><div class="eim">${e.category} · ${e.paidBy} · ${fDate(e.createdAt)}</div></div>
        <div class="eir">
          <div class="eia">${CURR[e.currency]||'₹'}${e.amount.toFixed(2)}</div>
          <div class="eip ${e.isPaid?'p-y':'p-n'}">${e.isPaid?'Paid':'Unpaid'}</div>
          <div style="margin-top:4px"><span onclick="delExpense('${e.id}')" style="font-size:11px;color:var(--red);cursor:pointer">Delete</span></div>
        </div>
      </div>`).join('');
  openSheet('gd');
}

function calcBalances(g,exps) {
  const net={};
  g.members.forEach(m=>net[m]=0);
  exps.filter(e=>!e.isPaid).forEach(e=>{
    if(net[e.paidBy]!==undefined) net[e.paidBy]+=e.amount;
    Object.entries(e.splits||{}).forEach(([m,v])=>{if(net[m]!==undefined)net[m]-=v;});
  });
  const give=Object.entries(net).filter(([,v])=>v>0).map(([k,v])=>({n:k,a:v})).sort((a,b)=>b.a-a.a);
  const take=Object.entries(net).filter(([,v])=>v<0).map(([k,v])=>({n:k,a:-v})).sort((a,b)=>b.a-a.a);
  const res=[]; let gi=0,ti=0;
  while(gi<give.length&&ti<take.length) {
    const mn=Math.min(give[gi].a,take[ti].a);
    if(mn>0.01) res.push({from:take[ti].n,to:give[gi].n,amount:mn});
    give[gi].a-=mn; take[ti].a-=mn;
    if(give[gi].a<0.01)gi++;
    if(take[ti].a<0.01)ti++;
  }
  return res;
}

// ===================== RENDER ALL GROUPS =====================
function renderAllGroups() {
  const activeGroups = getFilteredGroups();
  const el=document.getElementById('groupsAll');
  el.innerHTML=!activeGroups.length
    ?`<div class="empty"><div class="empty-i">👥</div><div class="empty-t">No groups</div><div class="empty-s">Tap "+ New" to create your first group</div></div>`
    :activeGroups.map(g=>groupHTML(g)).join('');
  // Update chart filter
  const cf=document.getElementById('chartFilter');
  const cv=cf.value;
  cf.innerHTML='<option value="all">All Groups</option>'+activeGroups.map(g=>`<option value="${g.id}">${g.emoji} ${g.name}</option>`).join('');
  cf.value=cv;
}

// ===================== CHARTS =====================
const chartInst={};
function destroyChart(id){const ex=Chart.getChart(document.getElementById(id));if(ex)ex.destroy();}
function renderCharts() {
  const gid=document.getElementById('chartFilter').value;
  let exps=gid==='all'?getFilteredExpenses():S.expenses.filter(e=>e.groupId===gid && !e.isDeleted);
  
  const dark=window.matchMedia('(prefers-color-scheme:dark)').matches;
  const tc=dark?'#8888a8':'#6b6b80', gc=dark?'rgba(255,255,255,.05)':'rgba(0,0,0,.05)';
  // Category doughnut
  const catT={};
  exps.forEach(e=>{catT[e.category]=(catT[e.category]||0)+e.amount;});
  destroyChart('catC');
  if(Object.keys(catT).length) new Chart(document.getElementById('catC'),{
    type:'doughnut',
    data:{labels:Object.keys(catT),datasets:[{data:Object.values(catT),backgroundColor:Object.keys(catT).map(c=>CATCLR[c]||'#6b7280'),borderWidth:2,borderColor:dark?'#1d1d2e':'#fff'}]},
    options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{position:'right',labels:{color:tc,font:{size:11},boxWidth:10,padding:10}}}}
  });
  // Paid bar
  const pA=exps.filter(e=>e.isPaid).reduce((s,e)=>s+e.amount,0);
  const uA=exps.filter(e=>!e.isPaid).reduce((s,e)=>s+e.amount,0);
  destroyChart('paidC');
  new Chart(document.getElementById('paidC'),{
    type:'bar',
    data:{labels:['Paid','Unpaid'],datasets:[{data:[pA,uA],backgroundColor:['#16a34a','#dc2626'],borderRadius:8,borderSkipped:false}]},
    options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false}},scales:{y:{ticks:{color:tc,callback:v=>fAmt(v)},grid:{color:gc}},x:{ticks:{color:tc},grid:{display:false}}}}
  });
  // Monthly trend
  const mon={};
  exps.forEach(e=>{const d=new Date(e.createdAt),k=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;mon[k]=(mon[k]||0)+e.amount;});
  const mKeys=Object.keys(mon).sort();
  destroyChart('trendC');
  new Chart(document.getElementById('trendC'),{
    type:'line',
    data:{labels:mKeys.map(m=>{const[y,mo]=m.split('-');return new Date(y,mo-1).toLocaleString('default',{month:'short',year:'2-digit'});}),datasets:[{data:mKeys.map(m=>mon[m]),borderColor:'#6c63ff',backgroundColor:'rgba(108,99,255,.12)',fill:true,tension:.4,pointBackgroundColor:'#6c63ff',pointRadius:4}]},
    options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false}},scales:{y:{ticks:{color:tc,callback:v=>fAmt(v)},grid:{color:gc}},x:{ticks:{color:tc,autoSkip:true},grid:{display:false}}}}
  });
  // Per member
  const memT={};
  exps.forEach(e=>{Object.entries(e.splits||{}).forEach(([m,v])=>{memT[m]=(memT[m]||0)+v;});});
  destroyChart('memberC');
  if(Object.keys(memT).length) new Chart(document.getElementById('memberC'),{
    type:'bar',
    data:{labels:Object.keys(memT),datasets:[{data:Object.values(memT),backgroundColor:['#6c63ff','#22c55e','#f59e0b','#3b82f6','#ec4899','#14b8a6'],borderRadius:8,borderSkipped:false}]},
    options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false}},scales:{y:{ticks:{color:tc,callback:v=>fAmt(v)},grid:{color:gc}},x:{ticks:{color:tc},grid:{display:false}}}}
  });
}

// ===================== FIREBASE SYNC & AUTH =====================
function handleFirebaseConnect() { openSheet('driveSheet'); }

function localMode() {
  S.cfg.localMode=true; S.cfg.fbConfig=null; fbDb=null; currentPhone=null;
  saveMem(); 
  closeSheet('driveSheet'); 
  document.getElementById('loginOverlay').classList.remove('open');
  updateFirebaseUI(); 
  toast('📱 Using local storage');
  renderHome(); renderAllGroups(); renderCharts();
}

function connectFirebase() {
  const cfgStr=document.getElementById('fbConfigStr').value.trim();
  if(!cfgStr){toast('Enter Firebase Config or URL');return;}
  try {
    let cfg;
    if (cfgStr.startsWith('http')) {
      cfg = { databaseURL: cfgStr };
    } else {
      cfg = JSON.parse(cfgStr);
      if (!cfg.databaseURL) throw new Error("Missing databaseURL in JSON");
    }
    S.cfg.fbConfig=cfg;
    S.cfg.localMode=false;
    saveMem(); closeSheet('driveSheet');
    initFirebase();
    toast('🔥 Firebase Configured! Please Login.');
  } catch(e) { toast('Invalid input: '+e.message); }
}

function initFirebase() {
  if(S.cfg.localMode || !S.cfg.fbConfig) { updateFirebaseUI(); return; }
  try {
    if (!firebase.apps.length) {
      firebase.initializeApp(S.cfg.fbConfig);
    }
    fbDb = firebase.database();
    updateFirebaseUI();
    
    // Auth Logic
    firebase.auth().useDeviceLanguage();
    firebase.auth().onAuthStateChanged(user => {
      if (user) {
        document.getElementById('loginOverlay').classList.remove('open');
        currentPhone = user.phoneNumber;
        S.cfg.myProfile.phone = currentPhone;
        saveMem();
        renderProfile();
        startDataSync();
      } else {
        document.getElementById('loginOverlay').classList.add('open');
        initRecaptcha();
      }
    });
  } catch(e) {
    console.error(e);
    toast('Firebase Error: ' + e.message);
  }
}

function initRecaptcha() {
  if (!authVerifier && document.getElementById('recaptcha-container')) {
    authVerifier = new firebase.auth.RecaptchaVerifier('recaptcha-container', {
      'size': 'normal',
      'callback': (response) => {} // reCAPTCHA solved
    });
    authVerifier.render();
  }
}

function sendOtp() {
  let phone = document.getElementById('loginPhone').value.trim();
  if (!phone) return toast('Enter a valid phone number');
  if (!phone.startsWith('+')) phone = '+91' + phone;
  
  document.getElementById('sendOtpBtn').disabled = true;
  document.getElementById('sendOtpBtn').textContent = 'Sending...';
  
  firebase.auth().signInWithPhoneNumber(phone, authVerifier)
    .then((confirmationResult) => {
      authResult = confirmationResult;
      document.getElementById('phoneAuthBox').style.display = 'none';
      document.getElementById('otpAuthBox').style.display = 'block';
      toast('OTP Sent via SMS');
    }).catch((error) => {
      console.error(error);
      toast('Error: ' + error.message);
      document.getElementById('sendOtpBtn').disabled = false;
      document.getElementById('sendOtpBtn').textContent = 'Send OTP';
      if(authVerifier) {
        authVerifier.render().then(function(widgetId) {
          grecaptcha.reset(widgetId);
        });
      }
    });
}

function verifyOtp() {
  const code = document.getElementById('loginOtp').value.trim();
  if (!code) return toast('Enter code');
  
  authResult.confirm(code).then((result) => {
    toast('Logged in successfully! 🚀');
    // onAuthStateChanged will handle the rest
  }).catch((error) => {
    toast('Invalid Verification Code');
  });
}

function startDataSync() {
  // Clear existing listeners
  fbUnsubscribes.forEach(u => u());
  fbUnsubscribes = [];
  
  // Listen to user's authorized groups index
  const ref = fbDb.ref('userGroups/' + currentPhone);
  const onUserGroups = ref.on('value', snap => {
    const myGroups = snap.val() || {};
    const gids = Object.keys(myGroups);
    
    // Reset buffer
    fbDataBuffer = { groups: {}, expenses: {} };
    fbUnsubscribes.slice(1).forEach(u => u()); // Keep the first one (userGroups)
    fbUnsubscribes = [fbUnsubscribes[0]];
    
    // Sub to each group
    gids.forEach(gid => {
      const gRef = fbDb.ref('groups/' + gid);
      const onVal = gRef.on('value', gSnap => {
        const gData = gSnap.val();
        if (gData && !gData.isDeleted) {
          const exps = gData.expenses || {};
          delete gData.expenses;
          fbDataBuffer.groups[gid] = gData;
          
          Object.values(exps).forEach(e => {
            if (!e.isDeleted) fbDataBuffer.expenses[e.id] = e;
          });
          
          S.groups = Object.values(fbDataBuffer.groups);
          S.expenses = Object.values(fbDataBuffer.expenses);
          saveMem();
          renderHome(); renderAllGroups(); renderCharts();
          if(curGid) openGroupDetail(curGid);
        }
      });
      fbUnsubscribes.push(() => gRef.off('value', onVal));
    });
    
    if (gids.length === 0) {
      S.groups = []; S.expenses = [];
      renderHome(); renderAllGroups(); renderCharts();
    }
  });
  fbUnsubscribes.push(() => ref.off('value', onUserGroups));
}

function updateFirebaseUI() {
  const btn=document.getElementById('driveBtn');
  const lbl=document.getElementById('driveLbl');
  const ico=document.getElementById('driveIco');
  const sub=document.getElementById('driveSetSub');
  if(fbDb && currentPhone){btn.className='drive-pill on';lbl.textContent='Synced';ico.textContent='🔥';sub.textContent='Logged in: '+currentPhone;}
  else if(S.cfg.localMode){btn.className='drive-pill off';lbl.textContent='Local';ico.textContent='📱';sub.textContent='Local storage mode';}
  else{btn.className='drive-pill off';lbl.textContent='Firebase';ico.textContent='🔥';sub.textContent='Not connected';}
}

// ===================== EXPORT =====================
function exportCSV() {
  const rows=[['Group','Title','Description','Amount','Currency','Category','Paid By','Status','Split Mode','Date']];
  getFilteredExpenses().forEach(e=>{
    const g=S.groups.find(gr=>gr.id===e.groupId);
    rows.push([g?.name||'',e.title,e.desc||'',e.amount,e.currency,e.category,e.paidBy,e.isPaid?'Paid':'Unpaid',e.splitMode,new Date(e.createdAt).toLocaleDateString()]);
  });
  const csv=rows.map(r=>r.map(v=>`"${String(v||'').replace(/"/g,'""')}"`).join(',')).join('\n');
  const a=document.createElement('a');
  a.href=URL.createObjectURL(new Blob([csv],{type:'text/csv'}));
  a.download='splitease_expenses.csv'; a.click();
  toast('📊 CSV downloaded!');
}

function changeCurrency() {
  const opts=Object.keys(CURR).join(', ');
  const c=prompt(`Enter currency code:\n${opts}`,'INR');
  if(c&&CURR[c.toUpperCase()]){S.cfg.curr=c.toUpperCase();saveMem();document.getElementById('currSub').textContent=c.toUpperCase()+' – '+CURR[c.toUpperCase()];toast('Currency updated');}
}

// ===================== PWA =====================
if('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(()=>{});

init();