# Original User Request

## Initial Request — 2026-06-07T00:11:42Z

Research and compile a structured database of pesticide application logging requirements for all 50 US states, and integrate it into the Pesticide Logger app so that selecting any state dynamically updates the form fields and export formats.

Working directory: C:\Users\kyles\Documents\GitHub\Pesticide
Integrity mode: development

## Requirements

### R1. Structured State Laws Database
Research and compile the record-keeping and pesticide logging requirements for all 50 US states. Save this data in a structured JSON file (e.g., `state_pesticide_laws.json`) inside the client app. Each state entry must define:
- Required form fields (e.g., chemical name, EPA reg number, wind speed, applicator license, temperature, permit number, county, etc.)
- Data types for each field (string, number, date)
- Any validation rules (e.g., required, positive number, specific format)
- The official state regulatory agency citation/reference link

### R2. Dynamic Form Engine Integration
Update the mobile client app's React Native user interface (`index.tsx`) to import the compiled JSON database. When the user changes their selected state in the settings, the pesticide log entry form must dynamically update to display only the fields required by that state (with standard core fields displayed for all states).

### R3. State-Specific CSV Exporter
Modify the client's CSV exporter to check the active state and generate a formatted CSV report containing only the headers and values required for compliance in that specific state.

## Acceptance Criteria

### Data Completeness
- [ ] The JSON database must contain valid entries for all 50 US states.
- [ ] Each state entry must list the specific fields required by its agricultural department (e.g., California CDPR must include permit number, REI hours, PHI days; Texas TDA must include applicator license number; New York DEC must include county and target pest).

### UI Integration
- [ ] The pesticide logging screen must dynamically show/hide inputs when the user toggles between different states in the settings.
- [ ] The form must submit and save entries correctly to the SQLite database for any chosen state without runtime errors.

### Compliance Export
- [ ] The exported CSV file must dynamically adjust its columns and headers to match the selected state's compliance requirements.
