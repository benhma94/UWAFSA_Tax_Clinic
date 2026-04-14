# Wiki Migration Artifact: UFILE Setup and Tax Items

## Source
- PPTX: docs/training_slides.pptx
- Extraction method: slide XML text extraction from ppt/slides/slide*.xml
- Date: 2026-04-14

## Goal
Create two new top-level wiki categories for webpage/wiki.html:
1. UFILE Setup
2. Tax Items

Each category contains second-level sections populated from training slide content.

## Slide-to-Section Mapping

### Category: UFILE Setup

#### Section: Return Setup Checklist
- Candidate slide refs: 106, 145, 146, 148, 175, 203
- Key extracted points:
  - CRA no longer accepts direct deposit setup through tax return.
  - T2202 must include number of months.
  - Missing T2202 months can make scholarship income taxable in UFILE.
  - ON-BEN OEPTC prompt must be selected correctly.
  - Before EFILE, verify slips, amounts, identity fields, and address.
- Confidence: High

#### Section: EFILE Flow and Error Handling
- Candidate slide refs: 203, 204, 205, 206, 207, 208, 209, 211
- Key extracted points:
  - Complete final review before EFILE.
  - Fill and sign TIS-60 form before transmission.
  - Record EFILE success details.
  - On failure, stop and ask mentor.
  - Common mismatch errors: name/SIN/date of birth/address.
  - Corrections after filing are harder and delayed.
- Confidence: High

#### Section: Newcomers, SIN, and ITN Setup
- Candidate slide refs: 187, 190, 191, 196, 197, 198, 199, 200, 201
- Key extracted points:
  - Capture newcomer date and pre/post-arrival income fields (including 0 values).
  - RC151 should be completed for newcomer taxpayers.
  - If no SIN eligibility, guide ITN workflow (T1261) with required identity certification.
  - Ensure mailing address is stable for ITN processing.
- Confidence: High

### Category: Tax Items

#### Section: Medical Expenses
- Candidate slide refs: 129, 130, 131, 132, 133, 134, 135
- Key extracted points:
  - Eligible examples include prescriptions, dental, optometry, RMT, and plan premiums.
  - UHIP counts as health insurance for claim purposes.
  - OTC non-prescription drugs are not claimable.
  - Use best 365-day window ending in filing year.
  - Consider transfer logic to parents where appropriate.
  - Medical expense supplement can be refundable for eligible earners.
- Confidence: High

#### Section: Tuition and Student Credits (T2202)
- Candidate slide refs: 145, 146, 148, 149, 151, 153, 154, 155, 156
- Key extracted points:
  - Always enter T2202.
  - Enter months to avoid scholarship mis-taxation.
  - Use NOA/Schedule 11 for carryforward.
  - Tuition transfer to parent requires specific transfer selection and instructions.
  - Student loan interest deduction only for eligible government loans.
- Confidence: High

#### Section: Deductions and Benefit Triggers
- Candidate slide refs: 136, 137, 138, 140, 141, 142, 143, 144, 158, 160, 161, 166, 175, 178, 180, 182, 184
- Key extracted points:
  - RRSP and FHSA contribution rules and carryforward checks.
  - Moving expenses require distance + reason tests.
  - Simplified method usually preferred unless detailed receipts justify otherwise.
  - Childcare and donation entry rules are commonly mishandled.
  - OEPTC and Ontario credit prompts must be selected correctly for eligible clients.
- Confidence: Medium-High (broad section combines many slide topics)

## Notes for Wiki Content Writing
- Keep each section action-oriented for volunteer workflow.
- Preserve high-risk warnings from slides:
  - T2202 month entry
  - ON-BEN/OEPTC selection
  - EFILE identity mismatch checks
  - Mentor escalation triggers
- Avoid overloading sections with edge-case detail; mention mentor escalation where needed.

## Implemented in webpage/wiki.html
- Added category: UFILE Setup (3 sections)
- Added category: Tax Items (3 sections)
- Added section anchor reliability fix by assigning sectionDiv.id = section.id
