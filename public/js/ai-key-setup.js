'use strict';
// Shared "set up AI" modal — lets a user paste a Gemini API key from the UI
// instead of hand-editing config.json. Included on every bill-type page;
// restaurant.js and editor-core.js both call window.aiIsConfigured()/
// window.openAiKeySetup() before attempting a scan.
(function(){
  var configured = null; // null = not checked yet this page load

  function checkStatus(){
    if(configured !== null) return Promise.resolve(configured);
    return fetch('/api/ai-status').then(function(r){ return r.json(); })
      .then(function(d){ configured = !!d.configured; return configured; })
      .catch(function(){ configured = false; return false; });
  }

  var overlay, resolveFn;
  function build(){
    overlay = document.createElement('div');
    overlay.id = 'aiKeyOverlay';
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.5);display:none;'
      + 'align-items:center;justify-content:center;z-index:9999;padding:16px;';
    overlay.innerHTML =
      '<div style="background:var(--card-bg,#fff);color:inherit;max-width:440px;width:100%;'
      + 'border-radius:12px;padding:22px 24px;box-shadow:0 10px 40px rgba(0,0,0,.3);">'
      + '<h3 style="margin:0 0 8px;font-size:17px;">Enable AI receipt scanning</h3>'
      + '<p style="margin:0 0 12px;font-size:13px;opacity:.8;line-height:1.5;">'
      + 'Get a free Gemini API key from Google AI Studio, then paste it below. '
      + "It's saved locally on this server's <code>config.json</code> — never sent anywhere except Google's API.</p>"
      + '<ol style="margin:0 0 14px;padding-left:18px;font-size:13px;line-height:1.6;">'
      + '<li>Open <a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener">aistudio.google.com/apikey</a> '
      + 'and sign in with your Google account.</li>'
      + '<li>Click <b>Create API key</b> (pick or create a project if it asks).</li>'
      + '<li>Copy the key and paste it below.</li>'
      + '</ol>'
      + '<div style="display:flex;gap:8px;margin-bottom:8px;">'
      + '<input id="aiKeyInput" type="password" placeholder="Paste your Gemini API key" '
      + 'style="flex:1;padding:9px 10px;border:1px solid #ccc;border-radius:8px;font-size:13px;min-width:0;">'
      + '<button id="aiKeyToggle" type="button" title="Show/hide" '
      + 'style="padding:9px 12px;border:1px solid #ccc;border-radius:8px;background:transparent;cursor:pointer;">👁</button>'
      + '</div>'
      + '<div id="aiKeyMsg" style="font-size:12px;color:#d33;min-height:16px;margin-bottom:6px;"></div>'
      + '<div style="display:flex;justify-content:flex-end;gap:8px;margin-top:8px;">'
      + '<button id="aiKeyCancel" type="button" style="padding:8px 14px;border:1px solid #ccc;border-radius:8px;'
      + 'background:transparent;cursor:pointer;">Cancel</button>'
      + '<button id="aiKeySave" type="button" style="padding:8px 14px;border:none;border-radius:8px;'
      + 'background:#2563eb;color:#fff;cursor:pointer;">Save key</button>'
      + '</div>'
      + '</div>';
    document.body.appendChild(overlay);

    overlay.addEventListener('click', function(e){
      if(e.target === overlay) close(false);
      if(e.target.id === 'aiKeyCancel') close(false);
      if(e.target.id === 'aiKeyToggle'){
        var i = document.getElementById('aiKeyInput');
        i.type = i.type === 'password' ? 'text' : 'password';
      }
      if(e.target.id === 'aiKeySave') save(e.target);
    });
    overlay.addEventListener('keydown', function(e){
      if(e.key === 'Enter') save(document.getElementById('aiKeySave'));
      if(e.key === 'Escape') close(false);
    });
  }

  function save(btn){
    var input = document.getElementById('aiKeyInput');
    var msg = document.getElementById('aiKeyMsg');
    var key = input.value.trim();
    if(!key){ msg.textContent = 'Paste a key first.'; return; }
    var label = btn.textContent;
    btn.disabled = true; btn.textContent = 'Saving…';
    fetch('/api/ai-config', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ apiKey: key }) })
      .then(function(r){ return r.json().then(function(d){ return { ok:r.ok, data:d }; }); })
      .then(function(res){
        btn.disabled = false; btn.textContent = label;
        if(!res.ok){ msg.textContent = (res.data && res.data.error) || 'Save failed'; return; }
        configured = true;
        close(true);
      })
      .catch(function(err){ btn.disabled = false; btn.textContent = label; msg.textContent = err.message; });
  }

  function open(){
    if(!overlay) build();
    document.getElementById('aiKeyInput').value = '';
    document.getElementById('aiKeyMsg').textContent = '';
    overlay.style.display = 'flex';
    document.getElementById('aiKeyInput').focus();
    return new Promise(function(resolve){ resolveFn = resolve; });
  }
  function close(saved){
    if(overlay) overlay.style.display = 'none';
    if(resolveFn){ resolveFn(saved); resolveFn = null; }
  }

  window.aiIsConfigured = checkStatus;
  window.openAiKeySetup = open;
})();
