'use strict';
// Generic editor engine. Each bill-type page defines window.EDITOR_CFG before
// loading this file: { type, fields:[ids], templates:{n:fn(v)}, defaultTemplate }.
// Shared helpers (esc, m, C, L, R, dateWords, dateSlash, lines) are exposed globally
// so per-type template functions can use them.

var $ = id => document.getElementById(id);
var m = n => (Math.round((n||0) * 100) / 100).toFixed(2);
var rs = n => '₹' + m(n);
var MON_T = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
function dateWords(v, upper){ if(!v) return ''; var d=new Date(v+'T00:00');
  var s=d.getDate()+' '+MON_T[d.getMonth()]+' '+d.getFullYear(); return upper?s.toUpperCase():s; }
function dateSlash(v){ if(!v) return ''; var d=new Date(v+'T00:00');
  return String(d.getDate()).padStart(2,'0')+'/'+String(d.getMonth()+1).padStart(2,'0')+'/'+String(d.getFullYear()).slice(2); }
function esc(s){ return (s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;'); }
function lines(id){ var e=$(id); return e ? (e.value||'').split('\n').filter(x=>x.trim()) : []; }
var C=(t,cls='')=>'<div class="ctr '+cls+'">'+t+'</div>';
var L=(a,b,cls='')=>'<div class="line '+cls+'"><span>'+a+'</span><span class="r">'+b+'</span></div>';
var R=(t,cls='')=>'<div class="line '+cls+'"><span></span><span class="r">'+t+'</span></div>';

(function(){
  var CFG = window.EDITOR_CFG;
  if(!CFG){ console.error('EDITOR_CFG missing'); return; }
  var currentId = new URLSearchParams(location.search).get('id');
  var currentTemplate = CFG.defaultTemplate || 1;
  var lastTotal = 0, dirty = false, savedNav = false;

  // ---- items ----
  var itemsBody = $('items');
  function addRow(desc='', qty=1, rate=0){
    var tr = document.createElement('tr');
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
  if($('addItem')) $('addItem').onclick = ()=>{ addRow(); render(); markDirty(); };
  function getItems(){
    return [...itemsBody.querySelectorAll('tr')].map(tr=>({
      desc: tr.querySelector('.i-desc').value,
      qty: parseFloat(tr.querySelector('.i-qty').value)||0,
      rate: parseFloat(tr.querySelector('.i-rate').value)||0,
    }));
  }

  // ---- template picker ----
  var tpls = $('tpls');
  if(tpls) tpls.addEventListener('click', e=>{
    var t = e.target.closest('.tpl'); if(!t) return;
    document.querySelectorAll('.tpl').forEach(x=>x.classList.remove('active'));
    t.classList.add('active'); currentTemplate = +t.dataset.t; render(); markDirty();
  });
  function setTemplateUI(n){ currentTemplate=n;
    document.querySelectorAll('.tpl').forEach(x=>x.classList.toggle('active', +x.dataset.t===n)); }

  // ---- serialize / restore ----
  function collect(){
    var data = { items:getItems(), applyTax: $('applyTax')?$('applyTax').checked:true, template:currentTemplate };
    CFG.fields.forEach(f => { if($(f)) data[f] = $(f).value; });
    return data;
  }
  function apply(data){
    CFG.fields.forEach(f => { if($(f) && data[f]!=null) $(f).value = data[f]; });
    if($('applyTax')) $('applyTax').checked = data.applyTax !== false;
    setTemplateUI(data.template || CFG.defaultTemplate || 1);
    itemsBody.innerHTML = '';
    (data.items && data.items.length ? data.items : [{desc:'',qty:1,rate:0}]).forEach(it=>addRow(it.desc,it.qty,it.rate));
  }

  // ---- compute ----
  function compute(){
    var subtotal=0, totalQty=0; var rows=[];
    itemsBody.querySelectorAll('tr').forEach(tr=>{
      var desc=tr.querySelector('.i-desc').value||'';
      var qty=parseFloat(tr.querySelector('.i-qty').value)||0;
      var rate=parseFloat(tr.querySelector('.i-rate').value)||0;
      var amt=qty*rate; tr.querySelector('.i-amt').value=amt.toFixed(2);
      subtotal+=amt; totalQty+=qty; rows.push({desc,qty,rate,amt});
    });
    var applyTax = $('applyTax') ? $('applyTax').checked : true;
    var rate = id => $(id) ? (parseFloat($(id).value)||0) : 0;
    var sR=rate('sgstRate'), cR=rate('cgstRate'), iR=rate('igstRate');
    var sgst=applyTax?subtotal*sR/100:0, cgst=applyTax?subtotal*cR/100:0, igst=applyTax?subtotal*iR/100:0;
    var grandRaw=subtotal+sgst+cgst+igst, grandRounded=Math.round(grandRaw);
    lastTotal=grandRaw;
    var v = { items:rows, subtotal, totalQty, applyTax, sR, cR, iR, sgst, cgst, igst,
              totalGst:sgst+cgst+igst, grandRaw, grandRounded, roundOff:grandRounded-grandRaw };
    CFG.fields.forEach(f => { if($(f)) v[f] = $(f).value; });
    return v;
  }

  function render(){
    var v = compute();
    var fn = CFG.templates[currentTemplate] || CFG.templates[CFG.defaultTemplate || 1];
    var el = $('receipt'); el.className = 'receipt tpl'+currentTemplate;
    el.innerHTML = fn(v);
  }

  // ---- save state ----
  function markDirty(){ dirty=true; setState(currentId ? 'Unsaved changes' : 'Not saved yet'); }
  function setState(t){ if($('saveState')) $('saveState').textContent=t; }

  async function saveBill(){
    var payload = { type:CFG.type, name: $('billName').value || ('Untitled '+CFG.type), total:lastTotal, data:collect() };
    var res = currentId
      ? await fetch('/api/bills/'+currentId, {method:'PUT', headers:{'Content-Type':'application/json'}, body:JSON.stringify(payload)})
      : await fetch('/api/bills', {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(payload)});
    if(res.ok){
      var bill = await res.json(); currentId = bill.id;
      history.replaceState(null,'','/'+CFG.type+'.html?id='+currentId);
      dirty=false; setState('✓ Saved '+new Date().toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'}));
    } else setState('Save failed');
  }
  async function saveAsCopy(){
    if(dirty || !currentId) await saveBill();
    if(!currentId) return;
    var res = await fetch('/api/bills/'+currentId+'/duplicate', {method:'POST'});
    if(res.ok){ var copy = await res.json(); dirty=false; location.href = '/'+CFG.type+'.html?id='+copy.id; }
  }
  window.saveBill = saveBill;
  window.saveAsCopy = saveAsCopy;

  // ---- AI scan ----
  function fileToBase64(file){ return new Promise((res,rej)=>{ var r=new FileReader();
    r.onload=()=>res(String(r.result).split(',')[1]); r.onerror=rej; r.readAsDataURL(file); }); }
  function aiOverlay(show, title, sub){ var o=$('aiOverlay'); if(!o) return;
    o.style.display = show?'flex':'none'; if(title)$('aiOverlayTitle').textContent=title; if(sub!=null)$('aiOverlaySub').textContent=sub; }
  function mergeFields(f){
    if(!f || typeof f!=='object') return;
    var has = v => v!=null && String(v).trim()!=='';
    CFG.fields.forEach(k => { if($(k) && has(f[k])) $(k).value = f[k]; });
    if(Array.isArray(f.items) && f.items.length){
      itemsBody.innerHTML=''; f.items.forEach(it=>addRow(it.desc||'', it.qty!=null?it.qty:1, it.rate!=null?it.rate:0));
    }
  }
  var scanInput = $('scanInput');
  if(scanInput){
    scanInput.addEventListener('change', async e=>{
      var file = e.target.files[0]; if(!file) return;
      var isConfigured = await window.aiIsConfigured();
      if(!isConfigured){
        var saved = await window.openAiKeySetup();
        if(!saved){ scanInput.value = ''; return; }
      }
      var btn=$('scanBtn'), btnHtml=btn.innerHTML;
      btn.disabled=true; btn.classList.add('loading'); btn.innerHTML='<span class="spinner"></span>Extracting…';
      aiOverlay(true,'Reading your receipt…','Uploading '+(file.type==='application/pdf'?'PDF':'image'));
      try{
        var imageBase64 = await fileToBase64(file);
        aiOverlay(true,'Extracting with AI…','Asking Gemma to read the bill — this can take a few seconds');
        setState('🤖 Extracting with AI…');
        var res = await fetch('/api/extract',{method:'POST',headers:{'Content-Type':'application/json'},
          body:JSON.stringify({imageBase64, mimeType:file.type||'image/jpeg', type:CFG.type})});
        var data = await res.json().catch(()=>({}));
        if(!res.ok){ setState('⚠ '+(data.error||'extraction failed')); return; }
        mergeFields(data.fields||{}); render(); markDirty();
        var n=(data.fields && Array.isArray(data.fields.items))?data.fields.items.length:0;
        setState('✓ Filled from receipt'+(n?' ('+n+' items)':'')+(data.model?' via '+data.model:'')+' — review & Save');
      }catch(err){ setState('⚠ '+err.message); }
      finally{ aiOverlay(false); btn.disabled=false; btn.classList.remove('loading'); btn.innerHTML=btnHtml; scanInput.value=''; }
    });
  }

  // ---- unsaved-changes guard ----
  window.addEventListener('beforeunload', e=>{ if(dirty && !savedNav){ e.preventDefault(); e.returnValue=''; } });
  document.addEventListener('click', e=>{
    var a = e.target.closest('a[href]'); if(!a) return;
    var href = a.getAttribute('href');
    if(/^https?:|^#|^mailto:/.test(href)) return;
    if(dirty){
      if(confirm('You have unsaved changes. Leave without saving?')){ savedNav=true; }
      else { e.preventDefault(); }
    }
  }, true);

  // ---- init ----
  function defaults(){
    var now = new Date();
    if($('bdate')) $('bdate').value = now.toISOString().slice(0,10);
    if($('btime')) $('btime').value = now.toTimeString().slice(0,5);
    if($('invoiceDate')) $('invoiceDate').value = now.toISOString().slice(0,10);
    addRow('',1,0);
  }
  async function init(){
    if(currentId){
      var res = await fetch('/api/bills/'+currentId);
      if(res.ok){ var bill=await res.json(); $('billName').value=bill.name||''; apply(bill.data||{});
        setState('Loaded · last edited '+new Date(bill.updatedAt).toLocaleString()); }
      else { alert('Bill not found'); location.href='/index.html'; return; }
    } else { defaults(); setState('New bill — not saved yet'); }
    document.querySelectorAll('input,select,textarea').forEach(el=>{
      el.addEventListener('input', ()=>{ render(); if(el.id!=='billName') markDirty(); });
      el.addEventListener('change', ()=>{ render(); markDirty(); });
    });
    if($('billName')) $('billName').addEventListener('input', markDirty);
    render();
  }
  init();
})();

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
