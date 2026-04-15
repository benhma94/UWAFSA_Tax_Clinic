# Design: Married/Common-Law Receipt Form Fields

**Date:** 2026-04-14  
**Status:** Approved

## Context

When a client is marked as Married/Common-Law, the Email Receipt modal currently shows single fields for email, refund, and efile confirmation — giving no way to capture both spouses' data. This causes incomplete receipts and forces volunteers to send a generic combined email.

The fix: detect married status when opening the modal and show paired side-by-side fields for the three fields that differ per taxpayer, while keeping shared credit fields (ON-BEN, GST, Other) as single combined inputs.

## Approved Design

### Form Changes (married/common-law only)

| Field | Single | Married |
|---|---|---|
| Email | 1 field (required) | 2 fields: T1 (required), T2 (optional) |
| Refund/Balance Owing | 1 field | 2 independent fields: T1, T2 |
| ON-BEN Credit | 1 field | unchanged (combined) |
| GST/HST Credit | 1 field | unchanged (combined) |
| Other Amounts | 1 field | unchanged (combined) |
| UFILE Password | 1 field | unchanged (shared) |
| Efile Confirmation | 1 field (EFILE only) | 2 fields side-by-side: T1, T2 (EFILE only) |

- Married status detected via `currentClientData?.situations?.includes("Married/Common-Law")`
- A "(combined)" label appears on shared fields to make clear they cover both taxpayers
- An info banner (no emoji) at top of modal: "Married / Common-Law — two taxpayers"
- Efile validation: T1 and T2 confirmation numbers must not be equal

### Email Logic

- Always send receipt + UFILE password to Taxpayer 1
- If Taxpayer 2 email provided: also send receipt + UFILE password to Taxpayer 2 (up to 4 emails)
- Each receipt email shows **full amounts for both taxpayers** (both refunds, all shared credits, both efile confirmations)

## Files to Modify

- `catbus_scripts/control_sheet_form.html` — form HTML + JS
- `catbus_scripts/EmailReceipt.gs` (or wherever `sendReceiptEmail` lives) — email sending logic + `buildReceiptEmailBody()`

## Verification

1. Open a client row marked Married/Common-Law → click "Email Receipt?" → confirm paired fields appear
2. Open a single client row → confirm form is unchanged
3. Fill both efile confirmation fields with the same value → confirm validation error prevents submit
4. Fill Taxpayer 2 email → send → confirm 4 emails are dispatched (check sent mail)
5. Leave Taxpayer 2 email blank → send → confirm only 2 emails sent
