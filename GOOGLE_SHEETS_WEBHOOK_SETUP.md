# Protected Google Sheets campaign receiver

Snappi sends public campaign enquiries to the `public-brand-lead` Supabase Edge Function. Only that server-side function knows the Google Apps Script URL and shared secret. The browser never receives either value.

## 1. Replace the Apps Script receiver

Open the Apps Script project bound to the Snappi CRM spreadsheet and replace its receiver code with the version below. Preserve the existing `HEADERS` array if it contains additional columns.

```javascript
const SHEET_NAME = 'Leads';
const HEADERS = [
  'Lead ID', 'Created At', 'Owner', 'Status', 'Contact Name', 'Work Email',
  'Mobile', 'Company', 'Industry', 'Website', 'Social Profile', 'Package',
  'Requested Videos', 'Campaign Objective', 'Product Category', 'Launch Date',
  'Estimated Budget', 'Payment Method', 'Source', 'Referral Code', 'UTM Source',
  'UTM Medium', 'UTM Campaign', 'Next Action', 'Last Contact', 'Lost Reason',
  'Expected Revenue', 'Confirmed Revenue'
];

function doPost(event) {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);

  try {
    const lead = JSON.parse((event.postData && event.postData.contents) || '{}');
    const expectedSecret = PropertiesService.getScriptProperties()
      .getProperty('SNAPPI_CRM_WEBHOOK_SECRET');

    if (!expectedSecret || !secureEquals(lead.webhookSecret, expectedSecret)) {
      return jsonResponse({ success: false, message: 'Unauthorized' });
    }

    delete lead.webhookSecret;

    if (!lead.id || !lead.workEmail || !lead.companyName) {
      return jsonResponse({ success: false, message: 'Missing required lead fields' });
    }

    const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = spreadsheet.getSheetByName(SHEET_NAME) || spreadsheet.insertSheet(SHEET_NAME);

    if (sheet.getLastRow() === 0) {
      sheet.appendRow(HEADERS);
      sheet.setFrozenRows(1);
      sheet.getRange(1, 1, 1, HEADERS.length)
        .setFontWeight('bold')
        .setBackground('#D4FF3A');
    }

    sheet.appendRow([
      lead.id,
      lead.createdAt || new Date().toISOString(),
      lead.ownerName || 'Basem Shoaib',
      lead.status || 'new',
      lead.contactName || '',
      lead.workEmail || '',
      lead.mobile || '',
      lead.companyName || '',
      lead.industry || '',
      lead.websiteUrl || '',
      lead.socialUrl || '',
      lead.packageName || '',
      lead.requestedVideos || '',
      lead.campaignObjective || '',
      lead.productCategory || '',
      lead.preferredLaunchDate || '',
      lead.estimatedBudget || '',
      lead.preferredPaymentMethod || '',
      lead.source || '',
      lead.referralCode || '',
      lead.utmSource || '',
      lead.utmMedium || '',
      lead.utmCampaign || '',
      '', '', '', '', ''
    ]);

    return jsonResponse({ success: true });
  } catch (error) {
    return jsonResponse({ success: false, message: error.message });
  } finally {
    lock.releaseLock();
  }
}

function secureEquals(received, expected) {
  if (typeof received !== 'string' || typeof expected !== 'string') return false;
  const receivedHash = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, received);
  const expectedHash = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, expected);
  if (receivedHash.length !== expectedHash.length) return false;

  let difference = 0;
  for (let index = 0; index < receivedHash.length; index += 1) {
    difference |= receivedHash[index] ^ expectedHash[index];
  }
  return difference === 0;
}

function jsonResponse(payload) {
  return ContentService
    .createTextOutput(JSON.stringify(payload))
    .setMimeType(ContentService.MimeType.JSON);
}
```

## 2. Store the secret in Apps Script

1. Open **Project Settings** in Apps Script.
2. Under **Script Properties**, add `SNAPPI_CRM_WEBHOOK_SECRET`.
3. Paste a newly generated 64-character secret as its value.
4. Never place this value in a spreadsheet cell, website file, GitHub, or email.

## 3. Redeploy Apps Script

Create a new web-app deployment version with:

- **Execute as:** Me
- **Who has access:** Anyone

Copy the resulting `/exec` URL.

## 4. Store the server-side Supabase secrets

In **Supabase > Edge Functions > Secrets**, save:

- `snappi_crm_webhook_url` = the Apps Script `/exec` URL
- `snappi_crm_webhook_secret` = the exact same value stored in Script Properties

Then deploy `supabase/functions/public-brand-lead/index.ts` with JWT verification disabled because it is a public, origin-checked form endpoint with its own rate limits.

## 5. Verify once

Submit one real campaign enquiry from the website and confirm:

1. The page reports success.
2. Exactly one new row appears in `Leads`.
3. A direct request to the Apps Script URL without the secret returns `{ "success": false, "message": "Unauthorized" }` and creates no row.
