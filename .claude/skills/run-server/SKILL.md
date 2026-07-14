---
name: run-server
description: Launch and verify the billing-app Node.js server. Use when asked to run, start, or smoke-test the billing app.
---

# Running the billing-app server

Plain Node.js server, **no dependencies to install**, no build step.

## Launch

```bash
cd /home/aayush/Documents/Aayush/Projects/billing-app
node server.js
```

- Default port: `3000` → http://localhost:3000
- Override with `PORT=8080 node server.js`
- To run in the background:

```bash
node server.js > /tmp/billing-server.log 2>&1 &
disown
```

## Verify it's up

```bash
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000/
curl -s http://localhost:3000/api/bills
```

- `200` from `/` means the static dashboard is served.
- `/api/bills` returns the JSON list of saved bills from `data/bills/*.json`.

## Notes

- No login/auth — meant for local single-user use.
- Config (Gemini API key/model) lives in `config.json` at the repo root, or via
  `GEMINI_API_KEY` / `GEMINI_MODEL` env vars.
- Bill data persists in `data/bills/<id>.json` — back this up to keep bills.
