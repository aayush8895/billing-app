'use strict';
// Book receipt config — consumed by editor-core.js (loaded after this file).

function bookItems(v, upper){
  return v.items.map(it => {
    var d = upper ? esc(it.desc.toUpperCase()) : esc(it.desc);
    return '<div class="it"><span>'+d+'</span><span class="num">'+it.qty+
      '</span><span class="num">'+m(it.rate)+'</span><span class="num">'+m(it.amt)+'</span></div>';
  }).join('');
}
function bookTax(v){
  if(!v.applyTax) return '';
  return L('CGST @ '+v.cR+'%', rs(v.cgst)) + L('SGST @ '+v.sR+'%', rs(v.sgst));
}

// Template 1 — Bookstore Receipt (thermal)
function bookT1(v){
  var r = [];
  r.push(C(esc(v.storeName||'Bookstore'),'b big'));
  lines('storeAddr').forEach(l=>r.push(C(esc(l))));
  if(v.storeTel) r.push(C('Tel: '+esc(v.storeTel)));
  if(v.storeGstin) r.push(C('GST: '+esc(v.storeGstin)));
  r.push('<hr class="dash">');
  r.push(L('Bill No: '+esc(v.invoice), dateSlash(v.bdate)));
  r.push(L('Cashier: '+esc(v.cashier), esc(v.btime)));
  if(v.cName) r.push('<div>Customer: '+esc(v.cName)+'</div>');
  r.push('<hr class="dash">');
  r.push('<div class="it b"><span>Title</span><span class="num">Qty</span><span class="num">Price</span><span class="num">Amt</span></div>');
  r.push('<hr class="dash">');
  r.push(bookItems(v));
  r.push('<hr class="dash">');
  r.push(L('Total Qty: '+v.totalQty, 'Sub Total '+m(v.subtotal)));
  r.push(bookTax(v));
  r.push('<hr>');
  r.push(L('Grand Total','₹ '+m(v.grandRaw),'b big'));
  if(v.paidBy) r.push(L('Paid By:', esc(v.paidBy)));
  r.push('<hr>');
  r.push(C(esc(v.footMsg||'Happy Reading! Visit Again'),'b'));
  return r.join('');
}

// Template 2 — Simple
function bookT2(v){
  var r = [];
  r.push(C(esc((v.storeName||'Bookstore').toUpperCase()),'b big'));
  lines('storeAddr').forEach(l=>r.push(C(esc(l.toUpperCase()))));
  if(v.storeGstin) r.push(C('GST: '+esc(v.storeGstin)));
  r.push('<hr>');
  r.push(L('BILL NO: '+esc(v.invoice), dateWords(v.bdate,true)));
  if(v.cName) r.push('<div>CUST: '+esc(v.cName.toUpperCase())+'</div>');
  r.push('<hr>');
  r.push('<div class="it b"><span>TITLE</span><span class="num">QTY</span><span class="num">PRICE</span><span class="num">AMT</span></div>');
  r.push(bookItems(v, true));
  r.push('<hr>');
  r.push(L('SUB TOTAL','₹ '+m(v.subtotal)));
  r.push(bookTax(v));
  r.push('<hr>');
  r.push(L('TOTAL','₹ '+m(v.grandRaw),'b big'));
  if(v.paidBy) r.push(L('PAID BY:', esc(v.paidBy.toUpperCase())));
  r.push('<hr>');
  r.push(C(esc((v.footMsg||'HAPPY READING!').toUpperCase()),'b'));
  return r.join('');
}

window.EDITOR_CFG = {
  type: 'book',
  defaultTemplate: 1,
  fields: ['storeName','storeAddr','storeGstin','storeTel','invoice','bdate','btime',
    'cashier','cName','paidBy','sgstRate','cgstRate','footMsg'],
  templates: { 1: bookT1, 2: bookT2 },
};
