const CATEGORIES = {
  expense: [
    {name:'อาหาร', icon:'🍜', color:'#278d70'},
    {name:'เดินทาง', icon:'🚌', color:'#5689df'},
    {name:'ช้อปปิ้ง', icon:'🛍️', color:'#a879d2'},
    {name:'บิลและค่าใช้จ่ายประจำ', icon:'💡', color:'#e8a343'},
    {name:'สุขภาพ', icon:'💊', color:'#e47b72'},
    {name:'ความบันเทิง', icon:'🎬', color:'#55a8bb'},
    {name:'อื่น ๆ', icon:'📦', color:'#98a4ad'}
  ],
  income: [
    {name:'เงินเดือน', icon:'💵', color:'#278d70'},
    {name:'งานเสริม', icon:'💻', color:'#5689df'},
    {name:'ของขวัญ', icon:'🎁', color:'#a879d2'},
    {name:'อื่น ๆ', icon:'✨', color:'#e8a343'}
  ]
};
const STORAGE_KEY = 'payday-pocket-v1';
const defaultState = { salary:25000, startDay:25, endDay:24, periodMonth:currentMonth(), transactions:[], budgets:{} };
let state = loadState();
let activeType = 'expense';
let categoryChart, analyticsChart, dailyChart;
let toastTimer;

function currentMonth(){ const d=new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`; }
function loadState(){ try { const v=JSON.parse(localStorage.getItem(STORAGE_KEY)); return v && Array.isArray(v.transactions) ? {...defaultState,...v} : {...defaultState}; } catch { return {...defaultState}; } }
function saveState(){ localStorage.setItem(STORAGE_KEY,JSON.stringify(state)); }
function money(n){ return new Intl.NumberFormat('th-TH',{style:'currency',currency:'THB',maximumFractionDigits:2}).format(Number(n)||0); }
function shortMoney(n){ return '฿'+new Intl.NumberFormat('th-TH',{maximumFractionDigits:0}).format(Number(n)||0); }
function dateObj(s){ const [y,m,d]=s.split('-').map(Number); return new Date(y,m-1,d); }
function dateISO(d){ return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; }
function dateLabel(s){ if(!s)return ''; return dateObj(s).toLocaleDateString('th-TH',{day:'numeric',month:'short',year:'numeric'}); }
function clampDay(y,m,day){ return Math.min(day,new Date(y,m,0).getDate()); }
function periodBounds(month=state.periodMonth){
  const [y,m]=month.split('-').map(Number);
  const end=new Date(y,m-1,clampDay(y,m,state.endDay));
  let start;
  if(state.startDay<=state.endDay){
    start=new Date(y,m-1,clampDay(y,m,state.startDay));
  } else {
    start=new Date(y,m-2,clampDay(y,m-1,state.startDay));
  }
  return {start:dateISO(start),end:dateISO(end)};
}
function activeTransactions(){const b=periodBounds();return state.transactions.filter(t=>t.date>=b.start&&t.date<=b.end);}
function total(items,type){return items.filter(t=>t.type===type).reduce((s,t)=>s+Number(t.amount),0);}
function category(name,type='expense'){return CATEGORIES[type].find(c=>c.name===name)||{name,icon:'📦',color:'#98a4ad'};}
function escapeHTML(s){return String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function toast(msg,error=false){const el=document.querySelector('#toast');el.textContent=msg;el.classList.toggle('error',error);el.classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.classList.remove('show'),2600);}
function initDaySelects(){['start-day','end-day'].forEach(id=>{const el=document.getElementById(id);el.innerHTML=Array.from({length:31},(_,i)=>`<option value="${i+1}">วันที่ ${i+1}</option>`).join('');});}
function initPeriodOptions(){
 const sel=document.querySelector('#period-select'), months=[];
 const now=new Date();
 for(let i=-12;i<=3;i++){const d=new Date(now.getFullYear(),now.getMonth()+i,1);months.push({value:`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`,label:d.toLocaleDateString('th-TH',{month:'short',year:'numeric'})});}
 if(!months.some(m=>m.value===state.periodMonth))months.push({value:state.periodMonth,label:monthLabel(state.periodMonth)});
 sel.innerHTML=months.sort((a,b)=>a.value.localeCompare(b.value)).map(m=>`<option value="${m.value}">${m.label}</option>`).join('');
 sel.value=state.periodMonth;
}
function monthLabel(m){const [y,mo]=m.split('-').map(Number);return new Date(y,mo-1,1).toLocaleDateString('th-TH',{month:'short',year:'numeric'});}
function updatePreview(){const b=periodBounds();document.querySelector('#period-preview-text').textContent=`${dateLabel(b.start)} – ${dateLabel(b.end)}`;}
function render(){
 const items=activeTransactions(), incomes=total(items,'income'), expenses=total(items,'expense'), balance=incomes-expenses;
 document.querySelector('#balance-total').textContent=money(balance);
 document.querySelector('#income-total').textContent=shortMoney(incomes);
 document.querySelector('#expense-total').textContent=shortMoney(expenses);
 const percent=incomes?Math.min(100,expenses/incomes*100):0;
 document.querySelector('#spend-progress').style.width=percent+'%';
 document.querySelector('#spend-percent').textContent=`ใช้เงินไปแล้ว ${percent.toFixed(1)}% ของรายรับ`;
 const today=dateISO(new Date()), todays=items.filter(t=>t.date===today&&t.type==='expense');
 document.querySelector('#today-expenses').textContent=shortMoney(total(todays,'expense'));
 document.querySelector('#today-count').textContent=`${todays.length} รายการ`;
 const b=periodBounds(), end=dateObj(b.end), now=new Date(); now.setHours(0,0,0,0);
 document.querySelector('#days-left').textContent=`${Math.max(0,Math.ceil((end-now)/86400000))} วัน`;
 document.querySelector('#today-line').textContent=`รอบ ${dateLabel(b.start)} – ${dateLabel(b.end)} · วันนี้จ่ายไป ${money(total(todays,'expense'))}`;
 document.querySelector('#donut-total').textContent=shortMoney(expenses);
 renderTransactions('#recent-list',items.slice().sort((a,b)=>b.date.localeCompare(a.date)||b.createdAt-a.createdAt).slice(0,5),false);
 renderTransactions('#all-transactions',filteredTransactions(),true);
 renderCharts(items);
 renderBudget();
 document.querySelector('#salary-input').value=state.salary;
 document.querySelector('#start-day').value=state.startDay;
 document.querySelector('#end-day').value=state.endDay;
 document.querySelector('#period-month').value=state.periodMonth;
 updatePreview();
}
function filteredTransactions(){
 const q=document.querySelector('#search-transactions').value.trim().toLowerCase(), f=document.querySelector('#type-filter').value;
 return activeTransactions().filter(t=>(f==='all'||t.type===f)&&(!q||`${t.note} ${t.category}`.toLowerCase().includes(q))).sort((a,b)=>b.date.localeCompare(a.date)||b.createdAt-a.createdAt);
}
function renderTransactions(selector,items,actions){
 const el=document.querySelector(selector);
 if(!items.length){el.innerHTML='<div class="empty-state">🧾<b>ยังไม่มีรายการในรอบนี้</b>กด “เพิ่มรายการ” เพื่อเริ่มจดรายรับหรือรายจ่าย</div>';return;}
 el.innerHTML=items.map(t=>{const c=category(t.category,t.type);return `<div class="transaction-row"><span class="tx-icon" style="background:${c.color}20">${c.icon}</span><div class="tx-info"><strong>${escapeHTML(t.note||t.category)}</strong><small>${escapeHTML(t.category)} · ${dateLabel(t.date)}</small></div><span class="tx-amount ${t.type}">${t.type==='income'?'+':'−'}${shortMoney(t.amount)}</span>${actions?`<div class="tx-actions"><button class="small-action" data-edit="${t.id}" title="แก้ไข">✎</button><button class="small-action" data-delete="${t.id}" title="ลบ">×</button></div>`:''}</div>`;}).join('');
}
function chartOptions(){return {responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false},tooltip:{callbacks:{label:ctx=>`${ctx.label}: ${money(ctx.raw)}`}}},cutout:'67%'};}
function aggregate(items){const map={};items.filter(t=>t.type==='expense').forEach(t=>map[t.category]=(map[t.category]||0)+Number(t.amount));return Object.entries(map).sort((a,b)=>b[1]-a[1]);}
function renderCharts(items){
 const agg=aggregate(items), labels=agg.map(a=>a[0]), values=agg.map(a=>a[1]), colors=labels.map(n=>category(n).color);
 if(categoryChart)categoryChart.destroy();
 categoryChart=new Chart(document.querySelector('#category-chart'),{type:'doughnut',data:{labels,datasets:[{data:values,backgroundColor:colors,borderWidth:0,hoverOffset:5}]},options:chartOptions()});
 document.querySelector('#category-legend').innerHTML=agg.length?agg.map(([name,value])=>`<div class="legend-item"><span class="legend-dot" style="background:${category(name).color}"></span><span>${escapeHTML(name)}</span><strong>${(value/(values.reduce((a,b)=>a+b,0)||1)*100).toFixed(1)}%</strong></div>`).join(''):'<div class="empty-state" style="grid-column:1/-1">เพิ่มรายจ่ายเพื่อดูสัดส่วนหมวดหมู่</div>';
 if(analyticsChart)analyticsChart.destroy();
 analyticsChart=new Chart(document.querySelector('#analytics-category'),{type:'doughnut',data:{labels,datasets:[{data:values,backgroundColor:colors,borderWidth:1,borderColor:'#fff'}]},options:{...chartOptions(),plugins:{legend:{position:'bottom',labels:{boxWidth:10,usePointStyle:true,font:{family:'Noto Sans Thai'}}},tooltip:chartOptions().plugins.tooltip}}});
 if(dailyChart)dailyChart.destroy();
 const b=periodBounds(), start=dateObj(b.start), end=dateObj(b.end), days=[], dayValues=[];
 for(let d=new Date(start);d<=end;d.setDate(d.getDate()+1)){const iso=dateISO(d);days.push(String(d.getDate()));dayValues.push(items.filter(t=>t.type==='expense'&&t.date===iso).reduce((s,t)=>s+Number(t.amount),0));}
 dailyChart=new Chart(document.querySelector('#daily-chart'),{type:'bar',data:{labels:days,datasets:[{label:'รายจ่าย',data:dayValues,backgroundColor:'#27916b',borderRadius:5,maxBarThickness:22}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false}},scales:{x:{grid:{display:false},ticks:{maxTicksLimit:15}},y:{beginAtZero:true,grid:{color:'#edf2ee'},ticks:{callback:v=>v.toLocaleString('th-TH')}}}}});
}
function openDialog(type='expense',id=null){
 activeType=type;document.querySelector('#transaction-form').reset();document.querySelector('#transaction-id').value='';
 const existing=id?state.transactions.find(t=>t.id===id):null;
 if(existing)activeType=existing.type;
 document.querySelector('#dialog-title').textContent=existing?'แก้ไขรายการ':'เพิ่มรายการ';
 document.querySelectorAll('.segment').forEach(b=>b.classList.toggle('active',b.dataset.type===activeType));
 document.querySelector('#amount-input').value=existing?.amount||'';
 document.querySelector('#date-input').value=existing?.date||dateISO(new Date());
 document.querySelector('#note-input').value=existing?.note||'';
 document.querySelector('#transaction-id').value=existing?.id||'';
 fillCategories(existing?.category);
 document.querySelector('#transaction-dialog').showModal();
}
function fillCategories(selected){const el=document.querySelector('#category-input');el.innerHTML=CATEGORIES[activeType].map(c=>`<option value="${escapeHTML(c.name)}">${c.icon} ${escapeHTML(c.name)}</option>`).join('');if(selected)el.value=selected;}
function renderBudget(){
 const el=document.querySelector('#budget-fields');
 el.innerHTML=CATEGORIES.expense.map(c=>`<div class="budget-field"><span class="tx-icon" style="background:${c.color}20">${c.icon}</span><label>${c.name}<input type="number" min="0" step="1" data-budget="${escapeHTML(c.name)}" value="${state.budgets[c.name]??''}" placeholder="ไม่จำกัดงบ"></label></div>`).join('');
}
function setView(name){
 document.querySelectorAll('.view').forEach(v=>v.classList.toggle('active',v.id===`view-${name}`));
 document.querySelectorAll('.nav-item').forEach(b=>b.classList.toggle('active',b.dataset.view===name));
 const titles={dashboard:['PAYDAY POCKET / OVERVIEW','สวัสดี 👋'],transactions:['PAYDAY POCKET / TRANSACTIONS','รายการรับ-จ่าย'],analytics:['PAYDAY POCKET / ANALYTICS','กราฟสรุป'],settings:['PAYDAY POCKET / SETTINGS','ตั้งค่ารอบเงินเดือน'],budget:['PAYDAY POCKET / BUDGET','ตั้งค่างบประมาณ'],backup:['PAYDAY POCKET / DATA','นำเข้า / ส่งออกข้อมูล']};
 document.querySelector('#page-eyebrow').textContent=titles[name][0];document.querySelector('#page-title').textContent=titles[name][1];
 if(name==='analytics')setTimeout(()=>{if(categoryChart)categoryChart.resize();if(analyticsChart)analyticsChart.resize();if(dailyChart)dailyChart.resize();},50);
 window.scrollTo({top:0,behavior:'smooth'});
}
document.addEventListener('click',e=>{
 const nav=e.target.closest('[data-view]');if(nav){setView(nav.dataset.view);return;}
 const edit=e.target.closest('[data-edit]');if(edit){openDialog('expense',edit.dataset.edit);return;}
 const del=e.target.closest('[data-delete]');if(del){if(confirm('ต้องการลบรายการนี้หรือไม่?')){state.transactions=state.transactions.filter(t=>t.id!==del.dataset.delete);saveState();render();toast('ลบรายการแล้ว');}return;}
 const seg=e.target.closest('.segment');if(seg){activeType=seg.dataset.type;document.querySelectorAll('.segment').forEach(b=>b.classList.toggle('active',b===seg));fillCategories();return;}
});
['add-top','add-transactions'].forEach(id=>document.getElementById(id).addEventListener('click',()=>openDialog()));
document.querySelector('#close-dialog').addEventListener('click',()=>document.querySelector('#transaction-dialog').close());
document.querySelector('#cancel-dialog').addEventListener('click',()=>document.querySelector('#transaction-dialog').close());
document.querySelector('#transaction-form').addEventListener('submit',e=>{
 e.preventDefault();const id=document.querySelector('#transaction-id').value;
 const tx={id:id||crypto.randomUUID(),type:activeType,amount:Number(document.querySelector('#amount-input').value),date:document.querySelector('#date-input').value,category:document.querySelector('#category-input').value,note:document.querySelector('#note-input').value.trim(),createdAt:Date.now()};
 if(!tx.amount||tx.amount<=0||!tx.date){toast('กรุณาตรวจสอบจำนวนเงินและวันที่',true);return;}
 if(id){const index=state.transactions.findIndex(t=>t.id===id);if(index>=0)state.transactions[index]=tx;}else state.transactions.push(tx);
 saveState();document.querySelector('#transaction-dialog').close();render();toast(id?'แก้ไขรายการแล้ว':'บันทึกรายการแล้ว');
});
document.querySelector('#settings-form').addEventListener('submit',e=>{
 e.preventDefault();state.salary=Math.max(0,Number(document.querySelector('#salary-input').value)||0);state.startDay=Number(document.querySelector('#start-day').value);state.endDay=Number(document.querySelector('#end-day').value);state.periodMonth=document.querySelector('#period-month').value||currentMonth();saveState();initPeriodOptions();render();toast('บันทึกการตั้งค่าแล้ว');
});
document.querySelector('#period-select').addEventListener('change',e=>{state.periodMonth=e.target.value;saveState();render();});
document.querySelector('#period-month').addEventListener('change',()=>{state.periodMonth=document.querySelector('#period-month').value||currentMonth();updatePreview();});
document.querySelector('#start-day').addEventListener('change',()=>{state.startDay=Number(document.querySelector('#start-day').value);updatePreview();});
document.querySelector('#end-day').addEventListener('change',()=>{state.endDay=Number(document.querySelector('#end-day').value);updatePreview();});
document.querySelector('#search-transactions').addEventListener('input',()=>renderTransactions('#all-transactions',filteredTransactions(),true));
document.querySelector('#type-filter').addEventListener('change',()=>renderTransactions('#all-transactions',filteredTransactions(),true));
document.querySelector('#budget-form').addEventListener('submit',e=>{e.preventDefault();const budgets={};document.querySelectorAll('[data-budget]').forEach(el=>{if(el.value!==''&&Number(el.value)>=0)budgets[el.dataset.budget]=Number(el.value);});state.budgets=budgets;saveState();toast('บันทึกงบประมาณแล้ว');});
document.querySelector('#export-data').addEventListener('click',()=>{const blob=new Blob([JSON.stringify(state,null,2)],{type:'application/json'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=`payday-pocket-${currentMonth()}.json`;a.click();URL.revokeObjectURL(url);toast('ส่งออกข้อมูลแล้ว');});
document.querySelector('#import-file').addEventListener('change',async e=>{const file=e.target.files[0];if(!file)return;try{const data=JSON.parse(await file.text());if(!Array.isArray(data.transactions))throw new Error('รูปแบบไฟล์ไม่ถูกต้อง');state={...defaultState,...data};saveState();initPeriodOptions();render();toast('นำเข้าข้อมูลสำเร็จ');}catch(err){toast('นำเข้าไม่สำเร็จ: ไฟล์ไม่ถูกต้อง',true);}e.target.value='';});
document.querySelector('#clear-data').addEventListener('click',()=>{if(confirm('แน่ใจหรือไม่ว่าจะลบข้อมูลทั้งหมด? การกระทำนี้ย้อนกลับไม่ได้')){state={...defaultState,periodMonth:currentMonth()};saveState();initPeriodOptions();render();toast('ล้างข้อมูลแล้ว');}});
initDaySelects();initPeriodOptions();render();