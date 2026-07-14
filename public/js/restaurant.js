'use strict';
const $ = id => document.getElementById(id);
const m = n => (Math.round(n * 100) / 100).toFixed(2);     // 0.00
const rs = n => '₹' + m(n);                                 // ₹0.00
const MON_T = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
function dateWords(v, upper){ if(!v) return ''; const d=new Date(v+'T00:00');
  let s = d.getDate()+' '+MON_T[d.getMonth()]+' '+d.getFullYear(); return upper ? s.toUpperCase() : s; }
function dateSlash(v){ if(!v) return ''; const d=new Date(v+'T00:00');
  return String(d.getDate()).padStart(2,'0')+'/'+String(d.getMonth()+1).padStart(2,'0')+'/'+String(d.getFullYear()).slice(2); }
function esc(s){ return (s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;'); }
function lines(id){ return ($(id).value||'').split('\n').filter(x=>x.trim()); }

const FIELDS = ['rName','rTagline','rAddr','rTel','gstNo','hsn','fssai',
  'orderType','table','cashier','invoice','bdate','btime','cName',
  'paidBy','sgstRate','cgstRate','footMsg'];

let currentId = new URLSearchParams(location.search).get('id');
let currentTemplate = 4;
let lastTotal = 0;

// ---------- items ----------
const itemsBody = $('items');
function addRow(desc='', qty=1, rate=0){
  const tr = document.createElement('tr');
  tr.innerHTML =
    '<td><input class="i-desc" value="'+String(desc).replace(/"/g,'&quot;')+'"></td>'+
    '<td class="col-qty"><input class="i-qty" type="number" min="0" step="1" value="'+qty+'"></td>'+
    '<td class="col-rate"><input class="i-rate" type="number" min="0" step="0.01" value="'+rate+'"></td>'+
    '<td class="col-amt"><input class="i-amt" disabled value="0.00"></td>'+
    '<td><button class="del" title="Remove">×</button></td>';
  tr.querySelector('.del').onclick = ()=>{ tr.remove(); render(); markDirty(); };
  tr.querySelectorAll('input').forEach(i=>i.addEventListener('input', ()=>{ render(); markDirty(); }));
  itemsBody.appendChild(tr);
}
$('addItem').onclick = ()=>{ addRow(); render(); markDirty(); };
function getItems(){
  return [...itemsBody.querySelectorAll('tr')].map(tr=>({
    desc: tr.querySelector('.i-desc').value,
    qty: parseFloat(tr.querySelector('.i-qty').value)||0,
    rate: parseFloat(tr.querySelector('.i-rate').value)||0,
  }));
}

// ---------- template picker ----------
$('tpls').addEventListener('click', e=>{
  const t = e.target.closest('.tpl'); if(!t) return;
  document.querySelectorAll('.tpl').forEach(x=>x.classList.remove('active'));
  t.classList.add('active'); currentTemplate = +t.dataset.t; render(); markDirty();
});
function setTemplateUI(n){
  currentTemplate = n;
  document.querySelectorAll('.tpl').forEach(x=>x.classList.toggle('active', +x.dataset.t===n));
}

// ---------- serialize / restore ----------
function collect(){
  const data = { items: getItems(), applyTax: $('applyTax').checked, template: currentTemplate };
  FIELDS.forEach(f => data[f] = $(f).value);
  return data;
}
function apply(data){
  FIELDS.forEach(f => { if(data[f] != null) $(f).value = data[f]; });
  $('applyTax').checked = data.applyTax !== false;
  setTemplateUI(data.template || 4);
  itemsBody.innerHTML = '';
  (data.items && data.items.length ? data.items : [{desc:'',qty:1,rate:0}])
    .forEach(it => addRow(it.desc, it.qty, it.rate));
}

// ---------- compute shared values ----------
function compute(){
  let subtotal=0, totalQty=0; const rows=[];
  itemsBody.querySelectorAll('tr').forEach(tr=>{
    const desc=tr.querySelector('.i-desc').value||'';
    const qty=parseFloat(tr.querySelector('.i-qty').value)||0;
    const rate=parseFloat(tr.querySelector('.i-rate').value)||0;
    const amt=qty*rate; tr.querySelector('.i-amt').value=amt.toFixed(2);
    subtotal+=amt; totalQty+=qty; rows.push({desc,qty,rate,amt});
  });
  const applyTax=$('applyTax').checked;
  const sR=parseFloat($('sgstRate').value)||0, cR=parseFloat($('cgstRate').value)||0;
  const sgst=applyTax?subtotal*sR/100:0, cgst=applyTax?subtotal*cR/100:0;
  const grandRaw=subtotal+sgst+cgst;
  const grandRounded=Math.round(grandRaw);
  lastTotal=grandRaw;
  return {
    rname:$('rName').value, taglines:lines('rTagline'), addr:lines('rAddr'),
    tel:$('rTel').value, gst:$('gstNo').value, hsn:$('hsn').value, fssai:$('fssai').value,
    customer:$('cName').value, orderType:$('orderType').value, table:$('table').value,
    cashier:$('cashier').value, invoice:$('invoice').value,
    dateW:dateWords($('bdate').value,false), dateU:dateWords($('bdate').value,true), time:$('btime').value,
    rows, subtotal, totalQty, applyTax, sR, cR, sgst, cgst, totalGst:sgst+cgst,
    grandRaw, grandRounded, roundOff:grandRounded-grandRaw,
    paidBy:$('paidBy').value, footMsg:$('footMsg').value,
  };
}

// helpers for receipt building
const L=(a,b,cls='')=>'<div class="line '+cls+'"><span>'+a+'</span><span class="r">'+b+'</span></div>';
const C=(t,cls='')=>'<div class="ctr '+cls+'">'+t+'</div>';
const R=(t,cls='')=>'<div class="line '+cls+'"><span></span><span class="r">'+t+'</span></div>';

// ---------- Template 1: Original Receipt (monospace) ----------
function renderT1(v){
  const r=[];
  r.push(C('WELCOME!!!'));
  r.push(C(esc(v.rname||'Restaurant Name'),'b big2'));
  v.taglines.forEach(l=>r.push(C(esc(l))));
  v.addr.forEach(l=>r.push(C(esc(l))));
  r.push(C('Original Receipt'));
  r.push('<div class="sp"></div>');
  r.push(L('Date: '+v.dateW,'Time: '+esc(v.time)));
  if(v.customer) r.push('<div>'+esc(v.customer)+'</div>');
  r.push('<div>Table: '+esc(v.table)+'</div>');
  r.push('<div>Receipt No.: '+esc(v.invoice)+'</div>');
  r.push('<div class="sp"></div>');
  r.push('<div class="it b"><span>Description</span><span class="num">Qty</span><span class="num">Price</span><span class="num">Subtotal</span></div>');
  v.rows.forEach(it=>r.push('<div class="it"><span>'+esc(it.desc)+'</span><span class="num">'+it.qty+'</span><span class="num">'+rs(it.rate)+'</span><span class="num">'+rs(it.amt)+'</span></div>'));
  r.push('<div class="sp"></div>');
  r.push(R('Sub Total: &nbsp;'+rs(v.subtotal)));
  if(v.applyTax){ r.push(R('CGST: '+v.cR+'% &nbsp;'+rs(v.cgst))); r.push(R('SGST: '+v.sR+'% &nbsp;'+rs(v.sgst))); }
  r.push(R('Total: &nbsp;'+rs(v.grandRaw),'b'));
  r.push('<div class="sp"></div>');
  if(v.paidBy) r.push('<div>MODE: '+esc(v.paidBy)+'</div>');
  r.push(C('SAVE PAPER SAVE NATURE !!'));
  r.push(C(esc(v.footMsg||'THANK YOU FOR A DELICIOUS MEAL.')));
  return r.join('');
}

// ---------- Template 2: RECEIPT (sans-serif, dashed) ----------
function renderT2(v){
  const r=[];
  r.push(C(esc(v.rname||'Restaurant Name'),'b'));
  v.taglines.forEach(l=>r.push(C(esc(l))));
  v.addr.forEach(l=>r.push(C(esc(l))));
  r.push('<div class="dash-label">RECEIPT</div>');
  r.push(L('Name: '+esc(v.customer),'Invoice No: '+esc(v.invoice)));
  r.push(L('Table: '+esc(v.table),'Date: '+v.dateW));
  r.push('<hr class="dash">');
  r.push('<div class="it b"><span>Item</span><span class="num">Price</span><span class="num">Qty</span><span class="num">Total</span></div>');
  v.rows.forEach(it=>r.push('<div class="it"><span>'+esc(it.desc)+'</span><span class="num">'+rs(it.rate)+'</span><span class="num">'+it.qty+'</span><span class="num">'+rs(it.amt)+'</span></div>'));
  r.push('<hr class="dash">');
  r.push(R('Sub-Total: &nbsp;'+rs(v.subtotal)));
  if(v.applyTax){ r.push(R('CGST: '+v.cR+'% &nbsp;'+rs(v.cgst))); r.push(R('SGST: '+v.sR+'% &nbsp;'+rs(v.sgst))); }
  r.push('<hr class="dash">');
  r.push(L('Mode: '+esc(v.paidBy||'—'),'Total: '+rs(v.grandRaw),'b'));
  r.push('<hr class="dash">');
  r.push(C('**SAVE PAPER SAVE NATURE !!'));
  r.push(C(esc(v.footMsg)||'Time: '+esc(v.time)));
  return r.join('');
}

// ---------- Template 3: Modern ----------
function renderT3(v){
  const r=[];
  r.push(C(esc(v.rname||'Restaurant Name'),'b big'));
  v.taglines.forEach(l=>r.push(C(esc(l),'small')));
  v.addr.forEach(l=>r.push(C(esc(l),'small')));
  r.push('<hr class="thin">');
  r.push('<div class="it b"><span>Item</span><span class="num">Qty</span><span class="num">Price</span><span class="num">Subtotal</span></div>');
  v.rows.forEach(it=>r.push('<div class="it"><span>'+esc(it.desc)+'</span><span class="num">'+it.qty+'</span><span class="num">'+rs(it.rate)+'</span><span class="num">'+rs(it.amt)+'</span></div>'));
  r.push('<hr class="thin">');
  r.push(L('Sub Total',rs(v.subtotal)));
  if(v.applyTax){ r.push('<div class="small">CGST: '+v.cR+'% &nbsp;'+rs(v.cgst)+'</div>'); r.push('<div class="small">SGST: '+v.sR+'% &nbsp;'+rs(v.sgst)+'</div>'); }
  r.push('<hr class="dot">');
  r.push(L('TOTAL','₹ '+m(v.grandRaw),'b big'));
  r.push('<hr class="thin">');
  if(v.paidBy) r.push('<div>Paid By: '+esc(v.paidBy)+'</div>');
  r.push('<div class="small">'+v.dateW+' : '+esc(v.time)+'</div>');
  r.push('<div class="small">Receipt No: '+esc(v.invoice)+'</div>');
  r.push('<div class="small">Table No: '+esc(v.table)+'</div>');
  if(v.customer) r.push('<div class="small">Customer : '+esc(v.customer)+'</div>');
  r.push('<div class="sp"></div>');
  r.push(C(esc(v.footMsg||'SAVE PAPER SAVE NATURE !!'),'b'));
  r.push(C('Thank You For Supporting','b'));
  r.push(C('Local Business!','b'));
  return r.join('');
}

// ---------- Template 4: Thermal / GST (default) ----------
function renderT4(v){
  const r=[];
  r.push(C(esc((v.rname||'Restaurant Name').toUpperCase()),'b big'));
  v.taglines.forEach(l=>r.push(C(esc(l.toUpperCase()))));
  v.addr.forEach(l=>r.push(C(esc(l.toUpperCase()))));
  if(v.tel) r.push(C('TEL: '+esc(v.tel)));
  if(v.gst) r.push(C('GST: '+esc(v.gst)));
  if(v.hsn) r.push(C('HSN/SAC: '+esc(v.hsn)));
  if(v.fssai) r.push(C('FSSAI: '+esc(v.fssai)));
  r.push(C('BILL NO: '+esc(v.invoice),'b'));
  r.push('<hr class="dash">');
  r.push(L('TABLE: '+esc(v.table),'DATE: '+v.dateU));
  r.push(L('CUST: '+esc((v.customer||'-').toUpperCase()),'TIME: '+esc(v.time)));
  r.push('<hr class="dash">');
  r.push('<div class="it b"><span>DESCRIPTION</span><span class="num">QTY</span><span class="num">RATE</span><span class="num">AMOUNT</span></div>');
  r.push('<hr class="dash">');
  v.rows.forEach(it=>r.push('<div class="it"><span>'+esc(it.desc.toUpperCase())+'</span><span class="num">'+it.qty+'</span><span class="num">'+m(it.rate)+'</span><span class="num">'+m(it.amt)+'</span></div>'));
  r.push('<hr class="dash">');
  r.push(L('SUB TOTAL','₹ '+m(v.subtotal)));
  if(v.applyTax){ r.push(L('CGST @ '+v.cR+'%','₹ '+m(v.cgst))); r.push(L('SGST @ '+v.sR+'%','₹ '+m(v.sgst))); }
  if(Math.abs(v.roundOff)>=0.005) r.push(C('( '+(v.roundOff>=0?'+':'-')+' ) ROUNDED '+m(Math.abs(v.roundOff))));
  r.push('<hr class="dash">');
  r.push(L('TOTAL','₹ '+m(v.applyTax?v.grandRounded:v.grandRaw),'b big'));
  if(v.applyTax){
    r.push(C('ABOVE PRICES INCLUDE TAXES','b'));
    r.push(L('TOTAL GST','₹ '+m(v.totalGst)));
    r.push(L('NON-TAXABLE','₹ '+m(0)));
  }
  r.push('<hr class="dash">');
  r.push(L('PAID BY:',esc((v.paidBy||'CASH').toUpperCase())));
  r.push(C(esc((v.footMsg||'THANKS FOR YOUR VISIT!').toUpperCase()),'b'));
  r.push(C(esc(v.time)));
  return r.join('');
}

// ---------- Template 5: Simple (the original plain layout) ----------
function renderT5(v){
  const r=[];
  r.push(C(esc(v.rname||'Restaurant Name'),'b big'));
  v.taglines.forEach(l=>r.push(C(esc(l))));
  v.addr.forEach(l=>r.push(C(esc(l))));
  if(v.tel) r.push(C('Tel: '+esc(v.tel)));
  if(v.gst) r.push(C('GST: '+esc(v.gst)));
  if(v.hsn) r.push(C('HSN/SAC: '+esc(v.hsn)));
  if(v.fssai) r.push(C('FSSAI: '+esc(v.fssai)));
  r.push('<hr>');
  r.push('<div>Name: '+esc(v.customer)+'</div>');
  r.push('<hr>');
  r.push(L('Date: '+dateSlash($('bdate').value), '<b>'+esc(v.orderType)+': '+esc(v.table)+'</b>'));
  r.push('<div>'+esc(v.time)+'</div>');
  r.push(L('Cashier: '+esc(v.cashier), 'Bill No.: '+esc(v.invoice)));
  r.push('<hr>');
  r.push('<div class="it b"><span>Item</span><span class="num">Qty</span><span class="num">Price</span><span class="num">Amt</span></div>');
  v.rows.forEach(it=>r.push('<div class="it"><span>'+esc(it.desc)+'</span><span class="num">'+it.qty+'</span><span class="num">'+m(it.rate)+'</span><span class="num">'+m(it.amt)+'</span></div>'));
  r.push('<hr>');
  r.push(L('Total Qty: '+v.totalQty,'Sub Total &nbsp;'+m(v.subtotal)));
  if(v.applyTax){ r.push(R('SGST '+v.sR+'% &nbsp;'+m(v.sgst))); r.push(R('CGST '+v.cR+'% &nbsp;'+m(v.cgst))); }
  r.push('<hr>');
  r.push(L('Grand Total','₹ '+m(v.grandRaw),'b big'));
  if(v.paidBy) r.push(L('Paid By:',esc(v.paidBy)));
  r.push('<hr>');
  r.push(C(esc(v.footMsg),'b'));
  return r.join('');
}

const RENDERERS = {1:renderT1, 2:renderT2, 3:renderT3, 4:renderT4, 5:renderT5};
function render(){
  const v = compute();
  const fn = RENDERERS[currentTemplate] || renderT4;
  const el = $('receipt');
  el.className = 'receipt tpl'+currentTemplate;
  el.innerHTML = fn(v);
}

// ---------- save / state ----------
let dirty = false;
function markDirty(){ dirty = true; setState(currentId ? 'Unsaved changes' : 'Not saved yet'); }
function setState(t){ $('saveState').textContent = t; }

async function saveBill(){
  const payload = { type:'restaurant', name: $('billName').value || 'Untitled bill', total: lastTotal, data: collect() };
  const res = currentId
    ? await fetch('/api/bills/'+currentId, {method:'PUT', headers:{'Content-Type':'application/json'}, body:JSON.stringify(payload)})
    : await fetch('/api/bills', {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(payload)});
  if(res.ok){
    const bill = await res.json(); currentId = bill.id;
    history.replaceState(null,'','/restaurant.html?id='+currentId);
    dirty = false; setState('✓ Saved '+new Date().toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'}));
  } else setState('Save failed');
}
async function saveAsCopy(){
  if(dirty || !currentId) await saveBill();
  if(!currentId) return;
  const res = await fetch('/api/bills/'+currentId+'/duplicate', {method:'POST'});
  if(res.ok){ const copy = await res.json(); location.href = '/restaurant.html?id='+copy.id; }
}

// ---------- AI scan ----------
function fileToBase64(file){
  return new Promise((resolve, reject)=>{
    const r = new FileReader();
    r.onload = ()=>resolve(String(r.result).split(',')[1]);
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}
function mergeFields(f){
  if(!f || typeof f !== 'object') return;
  const has = v => v != null && String(v).trim() !== '';
  const SIMPLE = ['rName','rTagline','rAddr','rTel','gstNo','hsn','fssai',
    'orderType','table','cashier','invoice','bdate','btime','cName','paidBy','footMsg'];
  SIMPLE.forEach(k => { if(has(f[k])) $(k).value = f[k]; });
  if(has(f.sgstRate)) $('sgstRate').value = f.sgstRate;
  if(has(f.cgstRate)) $('cgstRate').value = f.cgstRate;
  if(Array.isArray(f.items) && f.items.length){
    itemsBody.innerHTML = '';
    f.items.forEach(it => addRow(it.desc || '', it.qty != null ? it.qty : 1, it.rate != null ? it.rate : 0));
  }
}
function aiOverlay(show, title, sub){
  const o = $('aiOverlay'); if(!o) return;
  o.style.display = show ? 'flex' : 'none';
  if(title) $('aiOverlayTitle').textContent = title;
  if(sub != null) $('aiOverlaySub').textContent = sub;
}
const scanInput = $('scanInput');
if(scanInput){
  scanInput.addEventListener('change', async e=>{
    const file = e.target.files[0]; if(!file) return;
    const isConfigured = await window.aiIsConfigured();
    if(!isConfigured){
      const saved = await window.openAiKeySetup();
      if(!saved){ scanInput.value = ''; return; }
    }
    const btn = $('scanBtn');
    const btnHtml = btn.innerHTML;
    btn.disabled = true; btn.classList.add('loading');
    btn.innerHTML = '<span class="spinner"></span>Extracting…';
    aiOverlay(true, 'Reading your receipt…', 'Uploading image');
    try{
      const imageBase64 = await fileToBase64(file);
      aiOverlay(true, 'Extracting with AI…', 'Asking Gemma to read the bill — this can take a few seconds');
      setState('🤖 Extracting with AI…');
      const res = await fetch('/api/extract', {method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ imageBase64, mimeType: file.type || 'image/jpeg', model: aiModelVal() })});
      const data = await res.json().catch(()=>({}));
      if(!res.ok){ setState('⚠ ' + (data.error || 'extraction failed')); return; }
      mergeFields(data.fields || {});
      render(); markDirty();
      const n = (data.fields && Array.isArray(data.fields.items)) ? data.fields.items.length : 0;
      setState('✓ Filled from receipt' + (n? ' ('+n+' items)' : '') + ' — review & Save');
    }catch(err){ setState('⚠ ' + err.message); }
    finally{
      aiOverlay(false);
      btn.disabled = false; btn.classList.remove('loading'); btn.innerHTML = btnHtml;
      scanInput.value = '';
    }
  });
}

// ---------- unsaved-changes guard ----------
let savedNav = false;
window.addEventListener('beforeunload', e=>{ if(dirty && !savedNav){ e.preventDefault(); e.returnValue=''; } });
document.addEventListener('click', e=>{
  const a = e.target.closest('a[href]'); if(!a) return;
  const href = a.getAttribute('href');
  if(/^https?:|^#|^mailto:/.test(href)) return;
  if(dirty){
    if(confirm('You have unsaved changes. Leave without saving?')) savedNav = true;
    else e.preventDefault();
  }
}, true);

// ---------- init ----------
function defaults(){
  const now = new Date();
  $('bdate').value = now.toISOString().slice(0,10);
  $('btime').value = now.toTimeString().slice(0,5);
  addRow('', 1, 0);
}
async function init(){
  if(currentId){
    const res = await fetch('/api/bills/'+currentId);
    if(res.ok){
      const bill = await res.json();
      $('billName').value = bill.name || '';
      apply(bill.data || {});
      setState('Loaded · last edited '+new Date(bill.updatedAt).toLocaleString());
    } else { alert('Bill not found'); location.href='/index.html'; return; }
  } else { defaults(); setState('New bill — not saved yet'); }
  document.querySelectorAll('input,select,textarea').forEach(el=>{
    el.addEventListener('input', ()=>{ render(); if(el.id!=='billName') markDirty(); });
    el.addEventListener('change', ()=>{ render(); markDirty(); });
  });
  $('billName').addEventListener('input', markDirty);
  render();
}
window.saveBill = saveBill;
window.saveAsCopy = saveAsCopy;

// Generate a PDF sized exactly to the receipt (server renders it via headless
// Chrome) and download it directly — no print dialog, no A4 sheet.
async function downloadPdf(btn){
  var el = document.getElementById('receipt');
  if(!el) return;
  var pxToMm = function(px){ return px * 25.4 / 96; };
  var w = Math.round(pxToMm(el.offsetWidth));
  var h = Math.round(pxToMm(el.offsetHeight)) + 1;        // +1mm slack so nothing clips
  var css = '';
  for(var i=0;i<document.styleSheets.length;i++){
    try{ var rs=document.styleSheets[i].cssRules; for(var j=0;j<rs.length;j++) css+=rs[j].cssText+'\n'; }catch(e){}
  }
  var nameEl = document.getElementById('billName');
  var name = (nameEl && nameEl.value.trim()) || 'bill';
  var label = btn && btn.textContent;
  if(btn){ btn.textContent='⏳ PDF…'; btn.disabled=true; }
  try{
    var resp = await fetch('/api/pdf',{ method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ html: el.outerHTML, css: css, w: w, h: h, name: name }) });
    if(!resp.ok){ var er=await resp.json().catch(function(){return {};}); throw new Error(er.error||('HTTP '+resp.status)); }
    var blob = await resp.blob();
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a'); a.href=url; a.download=name+'.pdf';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function(){ URL.revokeObjectURL(url); }, 5000);
  }catch(e){ alert('PDF failed: '+e.message); }
  finally{ if(btn){ btn.textContent=label; btn.disabled=false; } }
}
window.downloadPdf = downloadPdf;

// AI model picker — remember the chosen model across sessions.
function aiModelVal(){ var s=document.getElementById('aiModel'); return s ? s.value : ''; }
(function(){
  var sel = document.getElementById('aiModel'); if(!sel) return;
  var saved = localStorage.getItem('aiModel');
  if(saved){ for(var i=0;i<sel.options.length;i++){ if(sel.options[i].value===saved){ sel.value=saved; break; } } }
  sel.addEventListener('change', function(){ localStorage.setItem('aiModel', sel.value); });
})();

init();
