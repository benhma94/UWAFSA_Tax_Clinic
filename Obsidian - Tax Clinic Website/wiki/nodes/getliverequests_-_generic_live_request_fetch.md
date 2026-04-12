# getLiveRequests() - Generic Live Request Fetch

## Metadata
- **ID**: `requesthandler_gs_getliverequests`
- **Type**: code
- **Source**: `catbus_scripts/RequestHandler.gs`

## Relationships
- <- **calls** [[gethelpstatus]]
  - Confidence: 0.9
- <- **calls** [[getlivehelprequestscached]]
  - Confidence: 1.0
- -> **shares_data_with** [[google_sheet_help_requests]]
  - Confidence: 1.0
- -> **shares_data_with** [[google_sheet_review_requests]]
  - Confidence: 1.0
- <- **calls** [[getlivereviewrequestscached]]
  - Confidence: 1.0

**Tags**: #code