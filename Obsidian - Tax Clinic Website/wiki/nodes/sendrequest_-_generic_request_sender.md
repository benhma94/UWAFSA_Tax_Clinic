# sendRequest() - Generic Request Sender

## Metadata
- **ID**: `requesthandler_gs_sendrequest`
- **Type**: code
- **Source**: `catbus_scripts/RequestHandler.gs`

## Relationships
- <- **calls** [[sendhelprequest]]
  - Confidence: 1.0
- -> **shares_data_with** [[google_sheet_help_requests]]
  - Confidence: 1.0
- -> **shares_data_with** [[google_sheet_review_requests]]
  - Confidence: 1.0
- -> **calls** [[invalidatecache]]
  - Confidence: 1.0
- -> **references** [[request_types_config_-_generic_request_config]]
  - Confidence: 1.0
- <- **calls** [[sendreviewrequest]]
  - Confidence: 1.0

**Tags**: #code