'use strict';
// E-Commerce bill config — consumed by editor-core.js (loaded after this file).
// Uses shared globals from editor-core: esc, m, rs, C, L, R, dateSlash, lines.

function ecomItems(v){
  return v.items.map(it =>
    '<div class="it"><span>'+esc(it.desc)+'</span><span class="num">'+it.qty+
    '</span><span class="num">'+m(it.rate)+'</span><span class="num">'+m(it.amt)+'</span></div>'
  ).join('');
}
function ecomTaxLines(v){
  var out = [];
  if(v.applyTax){
    if(v.iR) out.push(L('IGST @ '+v.iR+'%', rs(v.igst)));
    else { out.push(L('CGST @ '+v.cR+'%', rs(v.cgst))); out.push(L('SGST @ '+v.sR+'%', rs(v.sgst))); }
  }
  return out.join('');
}

// Template 1 — Tax Invoice (formal)
function ecomT1(v){
  var r = [];
  r.push(C('TAX INVOICE','b big'));
  r.push('<div class="sp"></div>');
  r.push('<div class="b">'+esc(v.sellerName||'Seller Name')+'</div>');
  lines('sellerAddr').forEach(l=>r.push('<div class="small">'+esc(l)+'</div>'));
  if(v.sellerGstin) r.push('<div class="small">GSTIN: '+esc(v.sellerGstin)+'</div>');
  r.push('<hr class="thin">');
  r.push(L('Invoice No: '+esc(v.invoice), 'Date: '+dateSlash(v.invoiceDate)));
  if(v.orderId) r.push(L('Order ID: '+esc(v.orderId), v.placeOfSupply?('PoS: '+esc(v.placeOfSupply)):''));
  r.push('<hr class="thin">');
  r.push('<div class="b">Bill To:</div>');
  r.push('<div>'+esc(v.billToName)+'</div>');
  lines('billToAddr').forEach(l=>r.push('<div class="small">'+esc(l)+'</div>'));
  if(v.shipToName || lines('shipToAddr').length){
    r.push('<div class="b" style="margin-top:6px;">Ship To:</div>');
    r.push('<div>'+esc(v.shipToName)+'</div>');
    lines('shipToAddr').forEach(l=>r.push('<div class="small">'+esc(l)+'</div>'));
  }
  r.push('<hr>');
  r.push('<div class="it b"><span>Item</span><span class="num">Qty</span><span class="num">Rate</span><span class="num">Amount</span></div>');
  r.push('<hr class="dash">');
  r.push(ecomItems(v));
  r.push('<hr class="dash">');
  r.push(L('Sub Total', rs(v.subtotal)));
  r.push(ecomTaxLines(v));
  r.push('<hr>');
  r.push(L('Grand Total','₹ '+m(v.grandRaw),'b big'));
  if(v.paymentMode) r.push(L('Payment:', esc(v.paymentMode)));
  r.push('<hr>');
  r.push(C(esc(v.footMsg||'This is a computer-generated invoice.'),'small'));
  return r.join('');
}

// Template 2 — Simple
function ecomT2(v){
  var r = [];
  r.push(C(esc(v.sellerName||'Seller Name'),'b big'));
  lines('sellerAddr').forEach(l=>r.push(C(esc(l),'small')));
  if(v.sellerGstin) r.push(C('GSTIN: '+esc(v.sellerGstin),'small'));
  r.push('<hr class="dash">');
  r.push(L('Invoice: '+esc(v.invoice), dateSlash(v.invoiceDate)));
  if(v.orderId) r.push('<div class="small">Order ID: '+esc(v.orderId)+'</div>');
  r.push('<div class="small">Bill To: '+esc(v.billToName)+'</div>');
  r.push('<hr class="dash">');
  r.push('<div class="it b"><span>Item</span><span class="num">Qty</span><span class="num">Rate</span><span class="num">Amt</span></div>');
  r.push(ecomItems(v));
  r.push('<hr class="dash">');
  r.push(L('Sub Total', rs(v.subtotal)));
  r.push(ecomTaxLines(v));
  r.push('<hr>');
  r.push(L('Total','₹ '+m(v.grandRaw),'b big'));
  if(v.paymentMode) r.push(L('Paid:', esc(v.paymentMode)));
  r.push('<hr class="dash">');
  r.push(C(esc(v.footMsg||'Thank you for shopping!'),'b'));
  return r.join('');
}

window.EDITOR_CFG = {
  type: 'ecommerce',
  defaultTemplate: 1,
  fields: ['sellerName','sellerAddr','sellerGstin','orderId','invoice','invoiceDate',
    'billToName','billToAddr','shipToName','shipToAddr','placeOfSupply','paymentMode',
    'sgstRate','cgstRate','igstRate','footMsg'],
  templates: { 1: ecomT1, 2: ecomT2 },
};
