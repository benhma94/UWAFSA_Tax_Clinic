# getVolunteersAndClients()

## Metadata
- **ID**: `controlsheet_gs_getvolunteersandclients`
- **Type**: code
- **Source**: `catbus_scripts/ControlSheet.gs`

## Relationships
- -> **shares_data_with** [[client_assignment_sheet]]
  - Confidence: 1.0
- -> **shares_data_with** [[volunteer_list_sheet_sign-in]]
  - Confidence: 1.0
- -> **shares_data_with** [[signout_sheet]]
  - Confidence: 1.0
- -> **calls** [[getcachedorfetch]]
  - Confidence: 1.0
- <- **calls** [[getvolunteerpollingstatus]]
  - Confidence: 1.0

**Tags**: #code