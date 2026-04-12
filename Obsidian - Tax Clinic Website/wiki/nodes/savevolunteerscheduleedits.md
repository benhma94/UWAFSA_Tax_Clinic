# saveVolunteerScheduleEdits()

## Metadata
- **ID**: `scheduleeditor_savevolunteerscheduleedits`
- **Type**: code
- **Source**: `catbus_scripts/ScheduleEditor.gs`

## Relationships
- -> **calls** [[lookupvolunteeremail_]]
  - Confidence: 1.0
- -> **calls** [[buildschedulechangeemailbody]]
  - Confidence: 1.0
- -> **calls** [[getpastshiftids]]
  - Confidence: 1.0
- -> **references** [[shift_schedule_sheet]]
  - Confidence: 1.0
- <- **calls** [[schedule_dashboard_ui]]
  - Confidence: 1.0
- -> **calls** [[safeexecute]]
  - Confidence: 1.0

**Tags**: #code