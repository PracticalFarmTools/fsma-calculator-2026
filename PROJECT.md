# Project: Pesticide compliance logging database and dynamic interface

## Architecture
- **Data Layer:** SQLite (`db.ts` / `DatabaseContext.tsx`) manages offline chemical reports. We will extend `chemical_reports` with `state` and `dynamic_fields` (JSON string) to handle state-specific forms flexibly.
- **Sync Layer:** FASTApi sync server (`synchronization-server/`) parses and synchronizes the extended `chemical_reports` table.
- **Frontend Layer:** React Native UI (`client-mobile-app/src/app/index.tsx`) imports compiled JSON state rules and dynamically renders fields.
- **Exporter:** Adapt export logic to output state-specific headers and values to compliance CSV format.

## Code Layout
- `client-mobile-app/src/constants/state_pesticide_laws.json` — Compiled JSON database of all 50 US states.
- `client-mobile-app/src/database/db.ts` — Local SQLite schema definition and mutations.
- `client-mobile-app/src/app/index.tsx` — Dynamic pesticide logging React Native form.
- `synchronization-server/models.py` — SQLAlchemy model for sync server.
- `synchronization-server/schemas.py` — Pydantic schema for sync server.
- `synchronization-server/main.py` — FastAPI routes and conflict resolution.

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| 1 | Research & Compile Database | Research and create `state_pesticide_laws.json` for 50 US states | None | PLANNED |
| 2 | Backend Schema Extension | Extend SQLite schema and FastAPI sync server schemas with `state` and `dynamic_fields` | None | PLANNED |
| 3 | React Native UI Integration | Integrate dynamic forms into `client-mobile-app/src/app/index.tsx` | M1, M2 | PLANNED |
| 4 | State-Specific CSV Exporter | Update CSV export method to dynamically adapt to state rules | M1, M3 | PLANNED |
| 5 | Dual Track Verification & Testing | Test full SQLite storage, sync logic, UI render, and CSV output | M4 | PLANNED |

## Interface Contracts
### `state_pesticide_laws.json` structure:
```json
{
  "TX": {
    "agency": "Texas Department of Agriculture",
    "citation": "https://texasagriculture.gov",
    "fields": [
      { "name": "applicator_license", "label": "Applicator License Number", "type": "string", "required": true }
    ]
  },
  "CA": {
    "agency": "California Department of Pesticide Regulation",
    "citation": "https://cdpr.ca.gov",
    "fields": [
      { "name": "permit_number", "label": "Permit Number", "type": "string", "required": true },
      { "name": "rei_hours", "label": "REI Hours", "type": "number", "required": true, "min": 0 },
      { "name": "phi_days", "label": "PHI Days", "type": "number", "required": true, "min": 0 }
    ]
  }
}
```
