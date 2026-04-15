# Married/Common-Law Receipt Form Fields — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** When a client is Married/Common-Law, show paired side-by-side fields for email (T2 optional), refund (T1+T2 independent), and efile confirmation (T1+T2 must differ); send up to 4 emails with full amounts.

**Architecture:** All changes are in two files. The HTML file gains paired field markup (hidden by default, toggled in `openEmailReceiptDialog` based on married status) and updated JS validation/data-building. The backend gains multi-recipient sending and an updated email body showing both taxpayers' amounts.

**Tech Stack:** Google Apps Script (`.gs`), HTML/CSS/JS served via HtmlService.

---

## File Map

| File | What changes |
|---|---|
| `catbus_scripts/control_sheet_form.html` | CSS for pairs; married banner + paired HTML fields; `openEmailReceiptDialog` toggle logic; `sendReceiptEmail` JS validation + data |
| `catbus_scripts/EmailReceipt.gs` | `buildReceiptEmailBody` shows T1+T2 amounts; `sendReceiptEmail` sends to T2 when present |

---

## Task 1: Add CSS for paired fields and married banner

**Files:**
- Modify: `catbus_scripts/control_sheet_form.html` (near line 749, after `.email-form-field` CSS block)

- [ ] **Step 1: Insert CSS after the `.email-form-field` CSS block (around line 749)**

Find the block ending with `body.dark .email-form-field input {` and add the following after the full `.email-form-field` CSS group:

```css
    /* Receipt form — married/common-law paired fields */
    #receiptMarriedBanner {
      display: none;
      background: #e8f4fd;
      border: 1px solid #2c7be5;
      border-radius: 4px;
      padding: 7px 12px;
      font-size: 0.85em;
      color: #1a5fa8;
      font-weight: 600;
      margin-bottom: 4px;
    }
    .receipt-married-field {
      display: none;
    }
    .receipt-pair {
      display: flex;
      gap: 10px;
    }
    .receipt-pair-col {
      flex: 1;
      min-width: 0;
    }
    .receipt-pair-label {
      font-size: 0.82em;
      color: #777;
      margin-bottom: 3px;
    }
    .receipt-pair-label .receipt-optional {
      color: #aaa;
      font-style: italic;
    }
    .receipt-pair-col input[type="email"],
    .receipt-pair-col input[type="text"] {
      width: 100%;
      padding: 8px;
      border: 1px solid var(--border-light);
      border-radius: 4px;
      font-size: 1em;
      box-sizing: border-box;
    }
```

- [ ] **Step 2: Commit**

```bash
cd "catbus_scripts" && git add control_sheet_form.html && git commit -m "style: add CSS for married receipt paired fields"
```

---

## Task 2: Add married banner and paired HTML fields to the form

**Files:**
- Modify: `catbus_scripts/control_sheet_form.html` (lines 1424–1468, the `<form id="emailReceiptForm">` section)

The goal is to add:
1. A married banner at the top of the form body
2. A paired email row alongside the existing single email field
3. A paired refund row alongside the existing single refund field
4. A paired efile confirmation row alongside the existing single efile confirmation field
5. `(combined)` hint text on ON-BEN, GST, Other labels

Single-mode fields keep their existing IDs. Paired fields use `1`/`2` suffixes. The JS in Task 3 will toggle which set is visible and which inputs are `required`.

- [ ] **Step 1: Add the married banner immediately after `<div class="email-modal-body">`**

Find (line ~1423):
```html
      <div class="email-modal-body">
        <form id="emailReceiptForm">
          <div class="email-form-field">
            <label for="clientEmailReceipt">Client Email <span style="color: red;">*</span></label>
```

Replace with:
```html
      <div class="email-modal-body">
        <div id="receiptMarriedBanner">Married / Common-Law — two taxpayers</div>
        <form id="emailReceiptForm">
          <div class="email-form-field">
            <label for="clientEmailReceipt">Client Email <span style="color: red;">*</span></label>
```

- [ ] **Step 2: Add the paired email field immediately after the single email `</div>`**

Find (line ~1428):
```html
            <input type="email" id="clientEmailReceipt" required placeholder="client@example.com">
          </div>
          
          <div class="email-form-field">
            <label for="refundBalanceReceipt">Refund/Balance Owing</label>
```

Replace with:
```html
            <input type="email" id="clientEmailReceipt" required placeholder="client@example.com">
          </div>

          <div class="email-form-field receipt-married-field">
            <label>Client Email</label>
            <div class="receipt-pair">
              <div class="receipt-pair-col">
                <div class="receipt-pair-label">Taxpayer 1 <span style="color:red;">*</span></div>
                <input type="email" id="clientEmail1Receipt" placeholder="taxpayer1@example.com">
              </div>
              <div class="receipt-pair-col">
                <div class="receipt-pair-label">Taxpayer 2 <span class="receipt-optional">(optional)</span></div>
                <input type="email" id="clientEmail2Receipt" placeholder="spouse@example.com">
              </div>
            </div>
          </div>
          
          <div class="email-form-field">
            <label for="refundBalanceReceipt">Refund/Balance Owing</label>
```

- [ ] **Step 3: Add the paired refund field immediately after the single refund `</div>`**

Find (line ~1433):
```html
            <div class="number-input-hint">Positive = Refund (green), Negative = Balance Owing (red)</div>
          </div>
          
          <div class="email-form-field">
            <label for="onBenReceipt">Total ON-BEN Credit</label>
```

Replace with:
```html
            <div class="number-input-hint">Positive = Refund (green), Negative = Balance Owing (red)</div>
          </div>

          <div class="email-form-field receipt-married-field">
            <label>Refund / Balance Owing</label>
            <div class="receipt-pair">
              <div class="receipt-pair-col">
                <div class="receipt-pair-label">Taxpayer 1</div>
                <input type="text" id="refundBalance1Receipt" class="number-input" placeholder="e.g., 1,200.00 or -200.00" oninput="formatAccountingNumber(this, 'refundBalance1')" onblur="validateAndFormatRefundBalance(this)">
              </div>
              <div class="receipt-pair-col">
                <div class="receipt-pair-label">Taxpayer 2</div>
                <input type="text" id="refundBalance2Receipt" class="number-input" placeholder="e.g., 1,200.00 or -200.00" oninput="formatAccountingNumber(this, 'refundBalance2')" onblur="validateAndFormatRefundBalance(this)">
              </div>
            </div>
            <div class="number-input-hint">Positive = Refund (green), Negative = Balance Owing (red)</div>
          </div>
          
          <div class="email-form-field">
            <label for="onBenReceipt">Total ON-BEN Credit</label>
```

- [ ] **Step 4: Add `(combined)` hints to ON-BEN, GST, Other labels**

Find:
```html
            <label for="onBenReceipt">Total ON-BEN Credit</label>
```
Replace with:
```html
            <label for="onBenReceipt">Total ON-BEN Credit <span id="onBenCombinedHint" style="display:none; font-weight:normal; color:#888; font-size:0.88em;">(combined)</span></label>
```

Find:
```html
            <label for="gstHstReceipt">Total CGEB or GST/HST Credit</label>
```
Replace with:
```html
            <label for="gstHstReceipt">Total CGEB or GST/HST Credit <span id="gstCombinedHint" style="display:none; font-weight:normal; color:#888; font-size:0.88em;">(combined)</span></label>
```

Find:
```html
            <label for="otherReceipt">Other Amounts</label>
```
Replace with:
```html
            <label for="otherReceipt">Other Amounts <span id="otherCombinedHint" style="display:none; font-weight:normal; color:#888; font-size:0.88em;">(combined)</span></label>
```

- [ ] **Step 5: Add the paired efile confirmation field immediately after the existing single efile `</div>`**

Find (line ~1467):
```html
          <div class="email-form-field" id="efileConfirmationField" style="display: none;">
            <label for="efileConfirmationReceipt">E-File Confirmation Number <span style="color:#e74c3c;">*</span></label>
            <input type="text" id="efileConfirmationReceipt" placeholder="Enter E-File confirmation number" required>
          </div>
        </form>
```

Replace with:
```html
          <div class="email-form-field" id="efileConfirmationField" style="display: none;">
            <label for="efileConfirmationReceipt">E-File Confirmation Number <span style="color:#e74c3c;">*</span></label>
            <input type="text" id="efileConfirmationReceipt" placeholder="Enter E-File confirmation number" required>
          </div>

          <div class="email-form-field receipt-married-field" id="efileConfirmationFieldMarried" style="display: none;">
            <label>E-File Confirmation Number <span style="color:#e74c3c;">*</span></label>
            <div class="receipt-pair">
              <div class="receipt-pair-col">
                <div class="receipt-pair-label">Taxpayer 1</div>
                <input type="text" id="efileConfirmation1Receipt" placeholder="Enter confirmation number">
              </div>
              <div class="receipt-pair-col">
                <div class="receipt-pair-label">Taxpayer 2</div>
                <input type="text" id="efileConfirmation2Receipt" placeholder="Enter confirmation number">
              </div>
            </div>
            <div id="efileMatchError" style="display:none; font-size:0.82em; color:#e74c3c; margin-top:4px;">Confirmation numbers must be different from each other.</div>
          </div>
        </form>
```

- [ ] **Step 6: Commit**

```bash
git add control_sheet_form.html && git commit -m "feat: add married paired fields HTML to receipt form"
```

---

## Task 3: Toggle married vs single fields in `openEmailReceiptDialog`

**Files:**
- Modify: `catbus_scripts/control_sheet_form.html` (function `openEmailReceiptDialog`, line ~3109)

- [ ] **Step 1: Replace the body of `openEmailReceiptDialog` with the new version**

Find the entire function (lines ~3109–3143):
```javascript
    function openEmailReceiptDialog(rowId, rowCount) {
      currentEmailRowId = rowId;
      currentEmailRowCount = rowCount;
      
      // Get the selected filing status and tax year for this row
      const row = document.querySelector(`[data-row-id="${rowId}"]`);
      const selectedRadio = row.querySelector(`input[name="filingStatus${rowCount}"]:checked`);
      const filingStatus = selectedRadio ? selectedRadio.value : 'efile';
      const taxYear = row.querySelector('select[name="taxYear"]')?.value || '';
      
      const modal = document.getElementById('emailReceiptModal');
      modal.classList.add('show');
      modal.setAttribute('data-filing-status', filingStatus);
      modal.setAttribute('data-tax-year', taxYear);
      
      // Reset form
      document.getElementById('emailReceiptForm').reset();
      document.getElementById('emailReceiptStatusMessage').classList.remove('show');
      
      // Show/hide E-File Confirmation Number field based on filing status
      const efileConfirmationField = document.getElementById('efileConfirmationField');
      const efileConfirmationInput = document.getElementById('efileConfirmationReceipt');
      if (filingStatus === 'efile') {
        efileConfirmationField.style.display = 'block';
      } else {
        efileConfirmationField.style.display = 'none';
        if (efileConfirmationInput) {
          efileConfirmationInput.value = '';
        }
      }
      
      // Clear files
      selectedFilesEmail = [];
      updateFileListEmail();
    }
```

Replace with:
```javascript
    function openEmailReceiptDialog(rowId, rowCount) {
      currentEmailRowId = rowId;
      currentEmailRowCount = rowCount;

      // Get the selected filing status and tax year for this row
      const row = document.querySelector(`[data-row-id="${rowId}"]`);
      const selectedRadio = row.querySelector(`input[name="filingStatus${rowCount}"]:checked`);
      const filingStatus = selectedRadio ? selectedRadio.value : 'efile';
      const taxYear = row.querySelector('select[name="taxYear"]')?.value || '';

      const modal = document.getElementById('emailReceiptModal');
      modal.classList.add('show');
      modal.setAttribute('data-filing-status', filingStatus);
      modal.setAttribute('data-tax-year', taxYear);

      // Reset form
      document.getElementById('emailReceiptForm').reset();
      document.getElementById('emailReceiptStatusMessage').classList.remove('show');
      document.getElementById('efileMatchError').style.display = 'none';

      const isMarried = currentClientData?.situations?.includes('Married/Common-Law') || false;

      // Toggle married banner
      document.getElementById('receiptMarriedBanner').style.display = isMarried ? 'block' : 'none';

      // Toggle single vs paired email field
      const singleEmailField = document.querySelector('.email-form-field:has(#clientEmailReceipt)');
      const marriedEmailField = document.querySelector('.email-form-field.receipt-married-field:has(#clientEmail1Receipt)');
      if (isMarried) {
        if (singleEmailField) singleEmailField.style.display = 'none';
        document.getElementById('clientEmailReceipt').required = false;
        if (marriedEmailField) marriedEmailField.style.display = 'block';
        document.getElementById('clientEmail1Receipt').required = true;
      } else {
        if (singleEmailField) singleEmailField.style.display = 'block';
        document.getElementById('clientEmailReceipt').required = true;
        if (marriedEmailField) marriedEmailField.style.display = 'none';
        document.getElementById('clientEmail1Receipt').required = false;
      }

      // Toggle single vs paired refund field
      const singleRefundField = document.querySelector('.email-form-field:has(#refundBalanceReceipt)');
      const marriedRefundField = document.querySelector('.email-form-field.receipt-married-field:has(#refundBalance1Receipt)');
      if (isMarried) {
        if (singleRefundField) singleRefundField.style.display = 'none';
        if (marriedRefundField) marriedRefundField.style.display = 'block';
      } else {
        if (singleRefundField) singleRefundField.style.display = 'block';
        if (marriedRefundField) marriedRefundField.style.display = 'none';
      }

      // Toggle (combined) hints on shared fields
      ['onBenCombinedHint', 'gstCombinedHint', 'otherCombinedHint'].forEach(id => {
        document.getElementById(id).style.display = isMarried ? 'inline' : 'none';
      });

      // Show/hide efile confirmation fields based on married + filing status
      const efileConfirmationField = document.getElementById('efileConfirmationField');
      const efileConfirmationReceipt = document.getElementById('efileConfirmationReceipt');
      const efileConfirmationFieldMarried = document.getElementById('efileConfirmationFieldMarried');
      const efile1 = document.getElementById('efileConfirmation1Receipt');
      const efile2 = document.getElementById('efileConfirmation2Receipt');

      if (filingStatus === 'efile') {
        if (isMarried) {
          efileConfirmationField.style.display = 'none';
          efileConfirmationReceipt.required = false;
          efileConfirmationFieldMarried.style.display = 'block';
          efile1.required = true;
          efile2.required = true;
        } else {
          efileConfirmationField.style.display = 'block';
          efileConfirmationReceipt.required = true;
          efileConfirmationFieldMarried.style.display = 'none';
          efile1.required = false;
          efile2.required = false;
        }
      } else {
        efileConfirmationField.style.display = 'none';
        efileConfirmationReceipt.required = false;
        efileConfirmationReceipt.value = '';
        efileConfirmationFieldMarried.style.display = 'none';
        efile1.required = false;
        efile2.required = false;
        efile1.value = '';
        efile2.value = '';
      }

      // Clear files
      selectedFilesEmail = [];
      updateFileListEmail();
    }
```

- [ ] **Step 2: Commit**

```bash
git add control_sheet_form.html && git commit -m "feat: toggle married paired fields in openEmailReceiptDialog"
```

---

## Task 4: Update `sendReceiptEmail` JS — read married fields, validate, build emailData

**Files:**
- Modify: `catbus_scripts/control_sheet_form.html` (function `sendReceiptEmail`, line ~3349)

- [ ] **Step 1: After the UFILE password validation block and before the `refundBalanceRaw` extraction, add the married flag**

Find (line ~3372):
```javascript
      const modal = document.getElementById('emailReceiptModal');
      const filingStatus = modal.getAttribute('data-filing-status') || 'efile';
      const taxYear = modal.getAttribute('data-tax-year') || '';

      // Extract and format numbers
      const refundBalanceRaw = document.getElementById('refundBalanceReceipt').value.trim();
```

Replace with:
```javascript
      const modal = document.getElementById('emailReceiptModal');
      const filingStatus = modal.getAttribute('data-filing-status') || 'efile';
      const taxYear = modal.getAttribute('data-tax-year') || '';
      const isMarried = currentClientData?.situations?.includes('Married/Common-Law') || false;

      // Validate efile confirmations differ for married clients
      if (isMarried && filingStatus === 'efile') {
        const conf1 = document.getElementById('efileConfirmation1Receipt').value.trim();
        const conf2 = document.getElementById('efileConfirmation2Receipt').value.trim();
        if (conf1 && conf2 && conf1 === conf2) {
          document.getElementById('efileMatchError').style.display = 'block';
          showEmailStatus('E-File confirmation numbers must be different for each taxpayer.', 'error');
          return;
        }
        document.getElementById('efileMatchError').style.display = 'none';
      }

      // Extract and format numbers
      const refundBalanceRaw = isMarried
        ? document.getElementById('refundBalance1Receipt').value.trim()
        : document.getElementById('refundBalanceReceipt').value.trim();
```

- [ ] **Step 2: After `refundBalanceRaw` through the `totalAmount` calculation, add Taxpayer 2 refund parsing**

Find (line ~3387):
```javascript
      const otherRaw = document.getElementById('otherReceipt').value.trim();
      const otherNum = otherRaw ? parseAccountingNumber(otherRaw) : null;

      // Format refund/balance - determine label based on sign
      let refundBalance = null;
      let refundLabel = null;
```

Replace with:
```javascript
      const otherRaw = document.getElementById('otherReceipt').value.trim();
      const otherNum = otherRaw ? parseAccountingNumber(otherRaw) : null;

      // Taxpayer 2 refund (married only)
      const refundBalance2Raw = isMarried ? document.getElementById('refundBalance2Receipt').value.trim() : '';
      const refundBalance2Num = refundBalance2Raw ? parseAccountingNumber(refundBalance2Raw) : null;

      // Format refund/balance - determine label based on sign
      let refundBalance = null;
      let refundLabel = null;
```

- [ ] **Step 3: After the T1 `refundBalance`/`refundLabel` block, add the same for T2**

Find (line ~3402):
```javascript
      }

      // Calculate total sum of all numeric amounts
      let totalAmount = 0;
      if (refundBalanceNum !== null && !isNaN(refundBalanceNum)) {
        totalAmount += refundBalanceNum;
      }
```

Replace with:
```javascript
      }

      // Format T2 refund/balance
      let refundBalance2 = null;
      let refundLabel2 = null;
      if (refundBalance2Num !== null && !isNaN(refundBalance2Num) && refundBalance2Num !== 0) {
        const absValue2 = Math.abs(refundBalance2Num);
        const formatted2 = formatAsAccountingPositive(absValue2);
        refundLabel2 = refundBalance2Num > 0 ? 'Refund' : 'Balance Owing';
        refundBalance2 = formatted2;
      }

      // Calculate total sum of all numeric amounts
      let totalAmount = 0;
      if (refundBalanceNum !== null && !isNaN(refundBalanceNum)) {
        totalAmount += refundBalanceNum;
      }
      if (isMarried && refundBalance2Num !== null && !isNaN(refundBalance2Num)) {
        totalAmount += refundBalance2Num;
      }
```

- [ ] **Step 4: Update the `emailData` object to add married fields and fix the email/efile fields**

Find (line ~3420):
```javascript
      const _emailReceiptRow = document.querySelector(`[data-row-id="${currentEmailRowId}"]`);
      const emailData = {
        clientEmail: document.getElementById('clientEmailReceipt').value.trim(),
        refundBalance: refundBalance,
        refundLabel: refundLabel,
        gstHst: gstHstNum !== null && !isNaN(gstHstNum) && gstHstNum >= 0 ? formatAsAccountingPositive(gstHstNum) : '',
        onBen: onBenNum !== null && !isNaN(onBenNum) && onBenNum >= 0 ? formatAsAccountingPositive(onBenNum) : '',
        other: otherNum !== null && !isNaN(otherNum) && otherNum >= 0 ? formatAsAccountingPositive(otherNum) : '',
        notes: document.getElementById('notesReceipt').value.trim(),
        totalAmount: totalAmount,
        ufilePassword: document.getElementById('ufilePasswordReceipt').value.trim(),
        efileConfirmation: filingStatus === 'efile' ? document.getElementById('efileConfirmationReceipt').value.trim() : '',
        clientID: document.getElementById('client').value.trim(),
        volunteerName: document.getElementById('volunteer').value.trim(),
        married: currentClientData?.situations?.includes("Married/Common-Law") || false,
        reviewer: _emailReceiptRow?.querySelector('input[name="reviewer"]')?.value.trim() || '',
        secondaryReviewer: _emailReceiptRow?.querySelector('input[name="secondaryReviewer"]')?.value.trim() || ''
      };
```

Replace with:
```javascript
      const _emailReceiptRow = document.querySelector(`[data-row-id="${currentEmailRowId}"]`);
      const emailData = {
        clientEmail: isMarried
          ? document.getElementById('clientEmail1Receipt').value.trim()
          : document.getElementById('clientEmailReceipt').value.trim(),
        clientEmail2: isMarried
          ? document.getElementById('clientEmail2Receipt').value.trim()
          : '',
        refundBalance: refundBalance,
        refundLabel: refundLabel,
        refundBalance2: refundBalance2,
        refundLabel2: refundLabel2,
        gstHst: gstHstNum !== null && !isNaN(gstHstNum) && gstHstNum >= 0 ? formatAsAccountingPositive(gstHstNum) : '',
        onBen: onBenNum !== null && !isNaN(onBenNum) && onBenNum >= 0 ? formatAsAccountingPositive(onBenNum) : '',
        other: otherNum !== null && !isNaN(otherNum) && otherNum >= 0 ? formatAsAccountingPositive(otherNum) : '',
        notes: document.getElementById('notesReceipt').value.trim(),
        totalAmount: totalAmount,
        ufilePassword: document.getElementById('ufilePasswordReceipt').value.trim(),
        efileConfirmation: isMarried && filingStatus === 'efile'
          ? document.getElementById('efileConfirmation1Receipt').value.trim()
          : (filingStatus === 'efile' ? document.getElementById('efileConfirmationReceipt').value.trim() : ''),
        efileConfirmation2: isMarried && filingStatus === 'efile'
          ? document.getElementById('efileConfirmation2Receipt').value.trim()
          : '',
        clientID: document.getElementById('client').value.trim(),
        volunteerName: document.getElementById('volunteer').value.trim(),
        married: isMarried,
        reviewer: _emailReceiptRow?.querySelector('input[name="reviewer"]')?.value.trim() || '',
        secondaryReviewer: _emailReceiptRow?.querySelector('input[name="secondaryReviewer"]')?.value.trim() || ''
      };
```

- [ ] **Step 5: Update the existing efile validation block (after `emailData`) to handle married case**

Find (line ~3438):
```javascript
      // Validate E-File Confirmation Number is required for EFILE
      if (filingStatus === 'efile') {
        const efileConfirmation = document.getElementById('efileConfirmationReceipt').value.trim();
        if (!efileConfirmation) {
          showEmailStatus('E-File Confirmation Number is required for EFILE submissions.', 'error');
          return;
        }
      }
```

Replace with:
```javascript
      // Validate E-File Confirmation Number is required for EFILE
      if (filingStatus === 'efile') {
        if (isMarried) {
          if (!emailData.efileConfirmation) {
            showEmailStatus('E-File Confirmation Number for Taxpayer 1 is required for EFILE submissions.', 'error');
            return;
          }
          if (!emailData.efileConfirmation2) {
            showEmailStatus('E-File Confirmation Number for Taxpayer 2 is required for EFILE submissions.', 'error');
            return;
          }
        } else {
          if (!emailData.efileConfirmation) {
            showEmailStatus('E-File Confirmation Number is required for EFILE submissions.', 'error');
            return;
          }
        }
      }
```

- [ ] **Step 6: Commit**

```bash
git add control_sheet_form.html && git commit -m "feat: update sendReceiptEmail JS for married paired fields"
```

---

## Task 5: Update `buildReceiptEmailBody` to show both taxpayers' amounts

**Files:**
- Modify: `catbus_scripts/EmailReceipt.gs` (function `buildReceiptEmailBody`, lines 145–230)

The email body currently shows a single `Refund/Balance Owing` row and a single efile confirmation. For married returns we need to show both.

- [ ] **Step 1: Replace the Return Summary section inside `buildReceiptEmailBody`**

Find (lines ~169–188):
```javascript
            ${emailData.refundBalance && emailData.refundLabel ? `
              <p><strong>${escapeHtmlServer(emailData.refundLabel)}:</strong> ${escapeHtmlServer(emailData.refundBalance)}</p>
            ` : ''}

            ${emailData.onBen ? `
              <p><strong>Ontario Trillium Benefit:</strong> ${escapeHtmlServer(emailData.onBen)}, paid over 12 monthly payments</p>
            ` : ''}

            ${emailData.gstHst ? `
              <p><strong>CGEB or GST/HST Credit:</strong> ${escapeHtmlServer(emailData.gstHst)}, paid over 4 quarterly payments</p>
            ` : ''}

            ${emailData.other ? `
              <p><strong>Other Amounts:</strong> ${escapeHtmlServer(emailData.other)}</p>
            ` : ''}

            ${emailData.efileConfirmation ? `
              <p><strong>E-File Confirmation Number:</strong> ${escapeHtmlServer(emailData.efileConfirmation)}</p>
            ` : ''}
```

Replace with:
```javascript
            ${emailData.refundBalance && emailData.refundLabel && !emailData.refundBalance2 ? `
              <p><strong>${escapeHtmlServer(emailData.refundLabel)}:</strong> ${escapeHtmlServer(emailData.refundBalance)}</p>
            ` : ''}

            ${emailData.refundBalance2 ? `
              ${emailData.refundBalance && emailData.refundLabel ? `
                <p><strong>Taxpayer 1 ${escapeHtmlServer(emailData.refundLabel)}:</strong> ${escapeHtmlServer(emailData.refundBalance)}</p>
              ` : ''}
              <p><strong>Taxpayer 2 ${escapeHtmlServer(emailData.refundLabel2 || 'Refund')}:</strong> ${escapeHtmlServer(emailData.refundBalance2)}</p>
            ` : ''}

            ${emailData.onBen ? `
              <p><strong>Ontario Trillium Benefit:</strong> ${escapeHtmlServer(emailData.onBen)}, paid over 12 monthly payments</p>
            ` : ''}

            ${emailData.gstHst ? `
              <p><strong>CGEB or GST/HST Credit:</strong> ${escapeHtmlServer(emailData.gstHst)}, paid over 4 quarterly payments</p>
            ` : ''}

            ${emailData.other ? `
              <p><strong>Other Amounts:</strong> ${escapeHtmlServer(emailData.other)}</p>
            ` : ''}

            ${emailData.efileConfirmation && !emailData.efileConfirmation2 ? `
              <p><strong>E-File Confirmation Number:</strong> ${escapeHtmlServer(emailData.efileConfirmation)}</p>
            ` : ''}

            ${emailData.efileConfirmation2 ? `
              <p><strong>Taxpayer 1 E-File Confirmation Number:</strong> ${escapeHtmlServer(emailData.efileConfirmation)}</p>
              <p><strong>Taxpayer 2 E-File Confirmation Number:</strong> ${escapeHtmlServer(emailData.efileConfirmation2)}</p>
            ` : ''}
```

- [ ] **Step 2: Commit**

```bash
git add EmailReceipt.gs && git commit -m "feat: update receipt email body for married taxpayer amounts"
```

---

## Task 6: Update `sendReceiptEmail` backend to send to Taxpayer 2

**Files:**
- Modify: `catbus_scripts/EmailReceipt.gs` (function `sendReceiptEmail`, lines 24–126)

- [ ] **Step 1: After the T1 UFILE password email block, add T2 sending**

Find (lines ~92–105):
```javascript
    // Send UFILE password in a separate email
    if (emailData.ufilePassword) {
      const passwordSubject = taxYearDisplay
        ? `Tax Year ${taxYearDisplay} — UFILE Password`
        : `UFILE Password`;
      const passwordBody = buildPasswordEmailBody(emailData.ufilePassword, taxYearDisplay);
      sendEmail({
        to: clientEmail,
        subject: passwordSubject,
        htmlBody: passwordBody,
        name: 'AFSA Tax Clinic'
      }, 'sendPasswordEmail');
      Logger.log(`UFILE password email sent to ${clientEmail}`);
    }
```

Replace with:
```javascript
    // Send UFILE password in a separate email
    if (emailData.ufilePassword) {
      const passwordSubject = taxYearDisplay
        ? `Tax Year ${taxYearDisplay} — UFILE Password`
        : `UFILE Password`;
      const passwordBody = buildPasswordEmailBody(emailData.ufilePassword, taxYearDisplay);
      sendEmail({
        to: clientEmail,
        subject: passwordSubject,
        htmlBody: passwordBody,
        name: 'AFSA Tax Clinic'
      }, 'sendPasswordEmail');
      Logger.log(`UFILE password email sent to ${clientEmail}`);
    }

    // Send to Taxpayer 2 if email provided (married/common-law)
    const email2Pattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const clientEmail2 = (emailData.clientEmail2 || '').trim();
    if (clientEmail2 && email2Pattern.test(clientEmail2)) {
      const emailBody2 = buildReceiptEmailBody(emailData, filingStatus);
      sendEmail({
        to: clientEmail2,
        subject: subject,
        htmlBody: emailBody2,
        name: 'AFSA Tax Clinic',
        ...(attachments.length > 0 ? { attachments: attachments } : {})
      }, 'sendReceiptEmail_T2');
      Logger.log(`Receipt email sent to Taxpayer 2: ${clientEmail2}`);

      if (emailData.ufilePassword) {
        const passwordSubject2 = taxYearDisplay
          ? `Tax Year ${taxYearDisplay} — UFILE Password`
          : `UFILE Password`;
        sendEmail({
          to: clientEmail2,
          subject: passwordSubject2,
          htmlBody: buildPasswordEmailBody(emailData.ufilePassword, taxYearDisplay),
          name: 'AFSA Tax Clinic'
        }, 'sendPasswordEmail_T2');
        Logger.log(`UFILE password email sent to Taxpayer 2: ${clientEmail2}`);
      }
    }
```

- [ ] **Step 2: Update the return value to include T2 recipient info**

Find (lines ~115–120):
```javascript
    return {
      success: true,
      message: 'Email sent successfully',
      recipient: clientEmail,
      attachmentCount: attachments.length
    };
```

Replace with:
```javascript
    const recipients = clientEmail2 && email2Pattern.test(clientEmail2)
      ? `${clientEmail} and ${clientEmail2}`
      : clientEmail;
    return {
      success: true,
      message: 'Email sent successfully',
      recipient: recipients,
      attachmentCount: attachments.length
    };
```

- [ ] **Step 3: Commit**

```bash
git add EmailReceipt.gs && git commit -m "feat: send receipt and password emails to Taxpayer 2 when married"
```

---

## Verification

- [ ] Push to Apps Script: `/push`, then `/deploy`
- [ ] Open a row where client is **not** married → click "Email Receipt?" → confirm form is unchanged (single email, single refund, single efile)
- [ ] Open a row where client **is** Married/Common-Law → confirm: blue banner, paired email fields, paired refund, "(combined)" labels on ON-BEN/GST/Other, paired efile (when EFILE selected)
- [ ] On the married form, enter the same confirmation number in both efile fields → confirm the "must be different" error appears and submit is blocked
- [ ] Fill in Taxpayer 2 email and submit → confirm the success message says "sent to [email1] and [email2]" → check Gmail sent folder for 4 emails
- [ ] Leave Taxpayer 2 email blank and submit → confirm only 2 emails sent to Taxpayer 1
- [ ] Check that each receipt email body shows both taxpayers' refund amounts and both efile confirmation numbers
