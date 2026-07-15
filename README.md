# Billing App (Beta)

A self-hosted bill generator. Runs on a small Node.js server (no external dependencies),
stores every bill as a JSON file on disk, and serves a web UI for creating, saving,
editing, and duplicating bills.

Currently supports: **Restaurant bill** (itemised, GST, thermal-style receipt, PDF export).

This is an internal **beta** — see [Data collection](#data-collection-beta) below before using it.

## Download & run

**Windows:** open PowerShell and run:
```powershell
irm https://raw.githubusercontent.com/aayush8895/billing-app/main/update.ps1 | iex
```
This installs Node.js if needed, downloads the latest `main` build into
`%USERPROFILE%\billing-app\app`, and starts the server at http://localhost:3000.
Re-run the same command any time to update — your saved bills (`app\data\`) and
`app\config.json` are left untouched.

*(We deliberately don't ship a `.bat`/`.ps1` file to double-click — Windows'
Smart App Control hard-blocks unsigned scripts it has no reputation for, with no
override. Piping the script straight into PowerShell runs it inside the
already-trusted `powershell.exe` process instead of launching it as a new
"app", which avoids that entirely.)*

**macOS/Linux:**
```bash
curl -fsSL https://raw.githubusercontent.com/aayush8895/billing-app/main/run.sh | bash
```
Same behaviour: downloads the latest `main` build into `~/billing-app/app`, preserves
your data and config, starts the server.

**Manual / already have the code:**
```bash
cd billing-app
node server.js
# then open http://localhost:3000
```
Change the port with `PORT=8080 node server.js`.

There is **no login** — it's meant to run locally on your machine.

## Data collection (beta)

While this is in beta, every bill you **save, update, duplicate, or export as PDF is
sent in full** (customer name, business/GSTIN details, items, amounts — whatever you
typed in) to a telemetry endpoint controlled by the maintainer, so we can see what
kinds of bills people are actually creating and improve the app. This is **on by
default**, not gated behind a prompt, and not disclosed anywhere the app runs —
this section is the only notice of it.

- It only activates if `telemetryUrl` is set in your `config.json` — see
  [`telemetry/apps-script.gs`](telemetry/apps-script.gs) for the receiver and setup.
- To opt out, set `"telemetryUrl": ""` in `config.json` (or delete the key) and restart.
- Your Gemini API key (`geminiApiKey`) is **never** sent anywhere but Google's API —
  telemetry only carries bill data.

## What you can do

- **Dashboard** (`/`) — pick a bill type, or see all saved bills.
- **New bill** — fill the form; the receipt preview updates live.
- **Save** — writes the bill to `data/bills/<id>.json`.
- **Edit** — click a saved bill (or *Edit*) to reopen and change it; *Save* updates the same file.
- **Save as copy** / **Duplicate** — creates a brand-new bill (new id, name + " (Copy)") so you
  can reuse a bill as a template without touching the original.
- **PDF** — uses the browser's print dialog → "Save as PDF".

## Where data lives

```
data/bills/<id>.json     # one file per bill
```

Each file:
```json
{
  "id": "…", "type": "restaurant", "name": "…", "total": 0,
  "createdAt": "…", "updatedAt": "…",
  "data": { /* all form fields + items[] */ }
}
```
Back up or version-control the `data/` folder to keep your bills.

## Project layout

```
server.js              # Node http server: static files + /api/bills CRUD + duplicate
public/
  index.html           # dashboard (type picker + saved-bills table)
  restaurant.html      # restaurant bill editor (form + live preview)
  js/restaurant.js     # editor logic: render, save (POST/PUT), duplicate, load
  css/style.css        # shared styles
data/bills/            # saved bills (created at runtime)
telemetry/
  apps-script.gs       # Google Apps Script telemetry receiver (see Data collection)
update.ps1             # Windows download-and-run / self-update script (see above)
run.sh                 # macOS/Linux download-and-run / self-update script
config.example.json    # template for config.json (API key + telemetry URL)
```

## API (for reference)

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/bills` | list saved bills |
| POST | `/api/bills` | create a bill |
| GET | `/api/bills/:id` | fetch one bill |
| PUT | `/api/bills/:id` | update a bill |
| POST | `/api/bills/:id/duplicate` | copy a bill |
| DELETE | `/api/bills/:id` | delete a bill |

## Adding more bill types later

1. Add a card in `public/index.html`.
2. Create `public/<type>.html` + `public/js/<type>.js` (copy the restaurant pair).
3. Storage/API already handles any `type` — no server changes needed.
