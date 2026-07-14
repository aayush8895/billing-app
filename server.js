'use strict';
// Restaurant Billing App — pure Node.js (no dependencies), local single-user.
// File-backed bill storage with save / edit / duplicate. No login (local use).

const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const os = require('os');
const { execFile } = require('child_process');

const PORT = process.env.PORT || 3000;
const ROOT = __dirname;
const PUBLIC = path.join(ROOT, 'public');
const DATA = path.join(ROOT, 'data');
const BILLS = path.join(DATA, 'bills');
const CONFIG_FILE = path.join(ROOT, 'config.json');

// ---------- storage helpers ----------
function ensure() { fs.mkdirSync(BILLS, { recursive: true }); }
// config.example.json ships with this literal placeholder text — a fresh
// config.json copied from it (by update.ps1/run.sh) still has it until a
// real key is set, so it must never count as "configured".
const APIKEY_PLACEHOLDER = 'PASTE_YOUR_GOOGLE_AI_STUDIO_KEY_HERE';
function isRealApiKey(k) { return !!k && k !== APIKEY_PLACEHOLDER; }
function getConfig() {
  const c = readJSON(CONFIG_FILE, {});
  const rawKey = process.env.GEMINI_API_KEY || c.geminiApiKey || '';
  return {
    apiKey: isRealApiKey(rawKey) ? rawKey : '',
    model: process.env.GEMINI_MODEL || c.model || 'gemini-3.5-flash',
    telemetryUrl: process.env.TELEMETRY_URL || c.telemetryUrl || '',
  };
}

// ---------- telemetry (beta feedback) ----------
// Sends the full saved bill to TELEMETRY_URL so we can see what kinds of
// bills people are making during the beta. Disclosed in README "Data
// collection" section and logged once at startup — see bottom of file.
// Fire-and-forget: never blocks or fails a bill save.
function isValidTelemetryUrl(url) { return /^https:\/\//.test(url); }
function sendTelemetry(event, bill) {
  const { telemetryUrl } = getConfig();
  if (!isValidTelemetryUrl(telemetryUrl)) return;
  const payload = JSON.stringify({ event, bill, sentAt: new Date().toISOString() });
  fetch(telemetryUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: payload })
    .catch(e => console.error('[telemetry] send failed:', e.message));
}
function readJSON(file, fallback) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return fallback; }
}
function writeJSON(file, obj) { fs.writeFileSync(file, JSON.stringify(obj, null, 2)); }
function billPath(id) { return path.join(BILLS, id.replace(/[^a-z0-9_-]/gi, '') + '.json'); }

function listBills() {
  return fs.readdirSync(BILLS).filter(f => f.endsWith('.json')).map(f => {
    const b = readJSON(path.join(BILLS, f), null);
    return b ? { id: b.id, name: b.name, type: b.type, total: b.total || 0,
                 createdAt: b.createdAt, updatedAt: b.updatedAt } : null;
  }).filter(Boolean).sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''));
}
function getBill(id) { return readJSON(billPath(id), null); }
function saveBill(bill) { writeJSON(billPath(bill.id), bill); }
function deleteBill(id) {
  const f = billPath(id);
  if (fs.existsSync(f)) { fs.unlinkSync(f); return true; }
  return false;
}

// ---------- http helpers ----------
function send(res, code, body, headers = {}) {
  const data = typeof body === 'string' || Buffer.isBuffer(body) ? body : JSON.stringify(body);
  res.writeHead(code, Object.assign({ 'Content-Type': 'application/json' }, headers));
  res.end(data);
}
function sendJSON(res, code, obj) { send(res, code, obj); }
function readBody(req) {
  return new Promise((resolve) => {
    let b = '';
    req.on('data', c => { b += c; if (b.length > 25e6) req.destroy(); });
    req.on('end', () => { try { resolve(b ? JSON.parse(b) : {}); } catch { resolve({}); } });
  });
}
const MIME = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript',
  '.json': 'application/json', '.svg': 'image/svg+xml', '.ico': 'image/x-icon' };
function serveStatic(res, urlPath) {
  const rel = urlPath === '/' ? '/index.html' : urlPath;
  const file = path.normalize(path.join(PUBLIC, rel));
  if (!file.startsWith(PUBLIC)) return send(res, 403, 'Forbidden');
  fs.readFile(file, (err, data) => {
    if (err) return send(res, 404, 'Not found');
    send(res, 200, data, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
  });
}

// ---------- AI extraction (Google AI Studio / Gemini API) ----------
const PROMPT_HEAD = `You are a precise bill/receipt data extractor. Read the attached photo or PDF and extract its details.
Respond with ONLY a JSON object (no markdown fences, no commentary) using exactly these keys.
If a value is NOT present, omit that key entirely or set it to null — never invent values.
For every "items" array, rate is the PER-UNIT price (amount / qty). Dates as YYYY-MM-DD, times as 24-hour HH:MM.

Keys:
`;
const PROMPTS = {
  restaurant: PROMPT_HEAD + `- rName (restaurant name, string)
- rTagline (sub-name/tagline lines joined with "\\n", string)
- rAddr (full address, lines joined with "\\n", string)
- rTel (phone, string)
- gstNo (GST/GSTIN, string)
- hsn (HSN/SAC code, string)
- fssai (FSSAI number, string)
- orderType (one of "Dine In","Takeaway","Delivery", string)
- table (table/token number, string)
- cashier (cashier name, string)
- invoice (bill/receipt number, string)
- bdate (date), btime (time)
- cName (customer name, string)
- paidBy (payment mode uppercase e.g. CASH/CARD/UPI, string)
- sgstRate (number), cgstRate (number)
- items: array of { "desc": string, "qty": number, "rate": number }
Return only the JSON object.`,

  ecommerce: PROMPT_HEAD + `- sellerName (sold-by / seller / company name, string)
- sellerAddr (seller address, lines joined with "\\n", string)
- sellerGstin (seller GSTIN, string)
- orderId (order id, string)
- invoice (invoice number, string)
- invoiceDate (invoice date)
- billToName (billing customer name, string)
- billToAddr (billing address, lines joined with "\\n", string)
- shipToName (shipping name, string)
- shipToAddr (shipping address, lines joined with "\\n", string)
- placeOfSupply (state / place of supply, string)
- paymentMode (e.g. PREPAID, COD, CARD, UPI, string)
- sgstRate (number), cgstRate (number), igstRate (number)
- items: array of { "desc": string, "qty": number, "rate": number }
Return only the JSON object.`,

  book: PROMPT_HEAD + `- storeName (bookstore / shop name, string)
- storeAddr (address, lines joined with "\\n", string)
- storeGstin (GSTIN, string)
- storeTel (phone, string)
- invoice (bill/receipt number, string)
- bdate (date), btime (time)
- cashier (cashier name, string)
- cName (customer name, string)
- paidBy (payment mode uppercase, string)
- sgstRate (number), cgstRate (number)
- items: array of { "desc": string (book title), "qty": number, "rate": number }
Return only the JSON object.`,
};

// Return the first *balanced* {...} object, tracking string literals/escapes so
// braces inside string values don't miscount. This ignores trailing junk such as
// an extra "}" or prose the model tacks on after the object — slicing to the last
// "}" would otherwise swallow that and break JSON.parse.
function firstBalancedObject(s) {
  const start = s.indexOf('{');
  if (start < 0) return null;
  let depth = 0, inStr = false, esc = false;
  for (let i = start; i < s.length; i++) {
    const c = s[i];
    if (inStr) {
      if (esc) esc = false;
      else if (c === '\\') esc = true;
      else if (c === '"') inStr = false;
    } else if (c === '"') inStr = true;
    else if (c === '{') depth++;
    else if (c === '}' && --depth === 0) return s.slice(start, i + 1);
  }
  return s.slice(start); // unbalanced — let JSON.parse report the real error
}

function extractJson(text) {
  let s = (text || '').trim();
  // Strip markdown code fences anywhere they appear, not just at the ends —
  // Gemma sometimes wraps its object in ```json ... ``` mid-string.
  s = s.replace(/```(?:json)?/gi, '').trim();
  const obj = firstBalancedObject(s);
  return JSON.parse(obj == null ? s : obj);
}

// A long run of one repeated character means the model fell into a degenerate
// loop (e.g. echoing the "//" in a messy address) and the JSON is junk/truncated.
function isRunaway(s) { return /(.)\1{40,}/.test(s || ''); }

async function callModel(endpoint, b64, mime, prompt, temperature) {
  const body = {
    // Prime the model's reply with "{" so it must continue as JSON instead of
    // narrating (Gemma tends to "think out loud" otherwise).
    contents: [
      { role: 'user', parts: [ { text: prompt }, { inline_data: { mime_type: mime, data: b64 } } ] },
      { role: 'model', parts: [ { text: '{' } ] },
    ],
    // temperature 0 (greedy) is prone to repetition loops; a little randomness
    // breaks them. topP/topK keep it focused. 4096 tokens fits long invoices.
    generationConfig: { temperature, topP: 0.95, topK: 40, maxOutputTokens: 4096 },
  };
  const resp = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const data = await resp.json().catch(() => ({}));
  if (!resp.ok) throw new Error((data.error && data.error.message) || ('HTTP ' + resp.status));
  const text = (data.candidates && data.candidates[0] && data.candidates[0].content
    && data.candidates[0].content.parts || []).map(p => p.text || '').join('');
  if (!text) throw new Error('empty response from model');
  // We primed the reply with "{", so the model's text is normally the *continuation*.
  // But if it ignored the priming and returned its own full object (often fenced),
  // its text already starts with "{" — don't prepend another brace in that case.
  const cleaned = text.replace(/```(?:json)?/gi, '').trim();
  return cleaned.startsWith('{') ? cleaned : '{' + text;
}

async function extractReceipt(apiKey, model, b64, mime, prompt) {
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;
  const temps = [0.2, 0.5, 0.8];   // retry with escalating randomness to break loops
  let lastErr;
  for (let i = 0; i < temps.length; i++) {
    let candidate;
    try {
      candidate = await callModel(endpoint, b64, mime, prompt, temps[i]);
      if (isRunaway(candidate)) throw new Error('model produced a repetition loop');
      return { fields: extractJson(candidate), raw: candidate };
    } catch (e) {
      lastErr = e;
      console.error(`[ai-extract] attempt ${i + 1}/${temps.length} (temp ${temps[i]}) failed: ${e.message}`);
      if (candidate) console.error('[ai-extract] raw model output >>>\n' + candidate + '\n<<< end raw');
    }
  }
  throw lastErr;
}

async function listModels(apiKey) {
  const resp = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(apiKey)}&pageSize=200`);
  const data = await resp.json().catch(() => ({}));
  if (!resp.ok) throw new Error((data.error && data.error.message) || ('HTTP ' + resp.status));
  return (data.models || []).map(m => m.name.replace('models/', ''));
}

// ---------- PDF export (headless system Chrome, no dependencies) ----------
function findChrome() {
  const pf = process.env['ProgramFiles'], pf86 = process.env['ProgramFiles(x86)'], lad = process.env['LocalAppData'];
  const candidates = [
    process.env.CHROME_BIN,
    // Linux
    '/usr/bin/google-chrome', '/usr/bin/google-chrome-stable',
    '/usr/bin/chromium', '/usr/bin/chromium-browser', '/snap/bin/chromium',
    // Windows (Chrome, then Edge as a Chromium-based fallback)
    pf && path.join(pf, 'Google\\Chrome\\Application\\chrome.exe'),
    pf86 && path.join(pf86, 'Google\\Chrome\\Application\\chrome.exe'),
    lad && path.join(lad, 'Google\\Chrome\\Application\\chrome.exe'),
    pf && path.join(pf, 'Microsoft\\Edge\\Application\\msedge.exe'),
    pf86 && path.join(pf86, 'Microsoft\\Edge\\Application\\msedge.exe'),
    // macOS
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
  ].filter(Boolean);
  for (const c of candidates) { try { if (fs.statSync(c).isFile()) return c; } catch {} }
  return null;
}

// Render the receipt to a PDF whose page is exactly the receipt's size — no print
// dialog, no A4 sheet, no headers/footers. Chrome honours a fixed @page size.
function generatePdf({ html, css, wMm, hMm }) {
  return new Promise((resolve, reject) => {
    const chrome = findChrome();
    if (!chrome) return reject(new Error('Chrome/Chromium not found (set CHROME_BIN)'));
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'billpdf-'));
    const htmlPath = path.join(dir, 'bill.html');
    const pdfPath = path.join(dir, 'bill.pdf');
    const cleanup = () => fs.rm(dir, { recursive: true, force: true }, () => {});
    const doc = `<!doctype html><html><head><meta charset="utf-8"><style>
@page{ size:${wMm}mm ${hMm}mm; margin:0; }
html,body{ margin:0!important; padding:0!important; background:#fff; }
${css || ''}
</style></head><body>${html}</body></html>`;
    try { fs.writeFileSync(htmlPath, doc); } catch (e) { cleanup(); return reject(e); }
    execFile(chrome, [
      '--headless=new', '--disable-gpu', '--no-pdf-header-footer',
      '--user-data-dir=' + path.join(dir, 'profile'),
      '--print-to-pdf=' + pdfPath, 'file://' + htmlPath,
    ], { timeout: 25000 }, (err) => {
      let buf = null;
      try { buf = fs.readFileSync(pdfPath); } catch {}
      cleanup();
      if (!buf || !buf.length) return reject(err || new Error('Chrome produced no PDF'));
      resolve(buf);
    });
  });
}

// ---------- API ----------
async function handleApi(req, res, url) {
  const p = url.pathname, method = req.method;

  if (p === '/api/ai-status' && method === 'GET') {
    const { apiKey, model } = getConfig();
    return sendJSON(res, 200, { configured: !!apiKey, model });
  }
  if (p === '/api/ai-models' && method === 'GET') {
    const { apiKey } = getConfig();
    if (!apiKey) return sendJSON(res, 400, { error: 'no API key configured' });
    try { return sendJSON(res, 200, { models: await listModels(apiKey) }); }
    catch (e) { return sendJSON(res, 502, { error: e.message }); }
  }
  if (p === '/api/ai-config' && method === 'POST') {
    const { apiKey } = await readBody(req);
    if (typeof apiKey !== 'string' || !apiKey.trim()) return sendJSON(res, 400, { error: 'apiKey is required' });
    const c = readJSON(CONFIG_FILE, {});
    c.geminiApiKey = apiKey.trim();
    writeJSON(CONFIG_FILE, c);
    return sendJSON(res, 200, { ok: true });
  }
  if (p === '/api/extract' && method === 'POST') {
    const { apiKey, model: cfgModel } = getConfig();
    if (!apiKey) return sendJSON(res, 400, { error: 'No API key configured. Add geminiApiKey to config.json (or set GEMINI_API_KEY).' });
    const { imageBase64, mimeType, type, model: reqModel } = await readBody(req);
    if (!imageBase64) return sendJSON(res, 400, { error: 'no image provided' });
    // Per-request model override (from the UI picker), falling back to config.
    const model = (typeof reqModel === 'string' && /^[\w.\-]{1,80}$/.test(reqModel)) ? reqModel : cfgModel;
    const prompt = PROMPTS[type] || PROMPTS.restaurant;
    try {
      console.error(`[ai-extract] model=${model} type=${type || 'restaurant'}`);
      const out = await extractReceipt(apiKey, model, imageBase64, mimeType || 'image/jpeg', prompt);
      return sendJSON(res, 200, out);
    } catch (e) {
      return sendJSON(res, 502, { error: 'AI extraction failed: ' + e.message });
    }
  }
  if (p === '/api/pdf' && method === 'POST') {
    const { html, css, w, h, name } = await readBody(req);
    if (!html) return sendJSON(res, 400, { error: 'no receipt html provided' });
    const wMm = Math.max(20, Math.round(Number(w) || 0));
    const hMm = Math.max(20, Math.round(Number(h) || 0));
    if (!wMm || !hMm) return sendJSON(res, 400, { error: 'invalid page size' });
    try {
      const pdf = await generatePdf({ html, css, wMm, hMm });
      const safe = String(name || 'bill').replace(/[^\w.\- ]+/g, '').trim() || 'bill';
      return send(res, 200, pdf, {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${safe}.pdf"`,
      });
    } catch (e) {
      return sendJSON(res, 500, { error: 'PDF generation failed: ' + e.message });
    }
  }

  if (p === '/api/bills' && method === 'GET') return sendJSON(res, 200, listBills());
  if (p === '/api/bills' && method === 'POST') {
    const body = await readBody(req);
    const now = new Date().toISOString();
    const bill = {
      id: crypto.randomBytes(8).toString('hex'),
      type: body.type || 'restaurant',
      name: body.name || 'Untitled bill',
      total: body.total || 0,
      data: body.data || {},
      createdAt: now, updatedAt: now,
    };
    saveBill(bill);
    sendTelemetry('create', bill);
    return sendJSON(res, 200, bill);
  }

  const m = p.match(/^\/api\/bills\/([^/]+)(\/duplicate)?$/);
  if (m) {
    const id = m[1], isDup = !!m[2];
    if (isDup && method === 'POST') {
      const src = getBill(id);
      if (!src) return sendJSON(res, 404, { error: 'bill not found' });
      const now = new Date().toISOString();
      const copy = Object.assign({}, src, {
        id: crypto.randomBytes(8).toString('hex'),
        name: src.name + ' (Copy)', createdAt: now, updatedAt: now,
      });
      saveBill(copy);
      sendTelemetry('duplicate', copy);
      return sendJSON(res, 200, copy);
    }
    if (method === 'GET') {
      const b = getBill(id);
      return b ? sendJSON(res, 200, b) : sendJSON(res, 404, { error: 'bill not found' });
    }
    if (method === 'PUT') {
      const b = getBill(id);
      if (!b) return sendJSON(res, 404, { error: 'bill not found' });
      const body = await readBody(req);
      if (body.name != null) b.name = body.name;
      if (body.data != null) b.data = body.data;
      if (body.total != null) b.total = body.total;
      b.updatedAt = new Date().toISOString();
      saveBill(b);
      sendTelemetry('update', b);
      return sendJSON(res, 200, b);
    }
    if (method === 'DELETE')
      return deleteBill(id) ? sendJSON(res, 200, {}) : sendJSON(res, 404, { error: 'bill not found' });
  }
  return sendJSON(res, 404, { error: 'unknown endpoint' });
}

// ---------- server ----------
ensure();
http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://localhost:${PORT}`);
    if (url.pathname.startsWith('/api/')) return await handleApi(req, res, url);
    serveStatic(res, url.pathname);
  } catch (e) {
    console.error(e);
    send(res, 500, { error: 'server error' });
  }
}).listen(PORT, () => {
  console.log(`Billing app (BETA) running → http://localhost:${PORT}`);
  const { telemetryUrl } = getConfig();
  if (isValidTelemetryUrl(telemetryUrl)) {
    console.log(`[telemetry] ENABLED — every saved/updated bill (including any customer names, GSTINs, and amounts you enter) is sent to:\n  ${telemetryUrl}\nThis is a beta build; that data is used for product feedback. See README "Data collection" section. Set telemetryUrl to "" in config.json to disable.`);
  } else if (telemetryUrl) {
    console.log(`[telemetry] disabled — telemetryUrl is set but isn't a valid https:// URL: ${telemetryUrl}`);
  } else {
    console.log('[telemetry] disabled (no telemetryUrl configured in config.json)');
  }
});
