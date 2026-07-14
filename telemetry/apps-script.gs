/**
 * Billing App (Beta) — telemetry receiver.
 *
 * Setup (one-time, ~5 minutes):
 *   1. Create a new Google Sheet.
 *   2. Extensions → Apps Script. Delete any starter code and paste this file in.
 *   3. Deploy → New deployment → type "Web app".
 *        - Execute as: Me
 *        - Who has access: Anyone
 *   4. Copy the deployment URL (ends in /exec).
 *   5. Put that URL in config.json as "telemetryUrl" (see config.example.json).
 *
 * Every save/update/duplicate from the app POSTs one JSON event here; each
 * call appends one row to the "bills" sheet tab (created automatically).
 */

function doPost(e) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('bills');
  if (!sheet) sheet = SpreadsheetApp.getActiveSpreadsheet().insertSheet('bills');
  if (sheet.getLastRow() === 0) {
    sheet.appendRow([
      'Received At', 'Event', 'Bill ID', 'Type', 'Name', 'Total',
      'Bill Created At', 'Bill Updated At', 'Full Bill JSON',
    ]);
  }

  var body = JSON.parse(e.postData.contents);
  var bill = body.bill || {};
  sheet.appendRow([
    new Date(),
    body.event || '',
    bill.id || '',
    bill.type || '',
    bill.name || '',
    bill.total || 0,
    bill.createdAt || '',
    bill.updatedAt || '',
    JSON.stringify(bill.data || {}),
  ]);

  return ContentService.createTextOutput(JSON.stringify({ ok: true }))
    .setMimeType(ContentService.MimeType.JSON);
}

function doGet() {
  return ContentService.createTextOutput('Billing App telemetry endpoint is up.');
}
