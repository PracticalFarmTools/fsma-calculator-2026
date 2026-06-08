## 2026-06-07T00:45:20Z

You are the Implementation Specialist (Generation 2). Your task is to continue and complete the implementation of the 50-state pesticide logging database, dynamic React Native UI form card, and compliance CSV exporter, replacing the previous worker which became unresponsive.

Your working directory is: c:\Users\kyles\Desktop\Antigravity Music\Practical Farm Tools\.agents\worker_implementation_gen2\

Please inspect the current state of the codebase. Note that several parts have already been completed by your predecessor:
- The `state_pesticide_laws.json` database has been copied to `client-mobile-app/src/constants/state_pesticide_laws.json`.
- The local SQLite schema and migrations in `client-mobile-app/src/database/db.ts` have been updated with `state` and `dynamic_fields` columns.
- The server SQLAlchemy models (`models.py`) and schemas (`schemas.py`) have been updated.
- The FastAPI server startup migrations in `synchronization-server/main.py` have been implemented.
- The synchronization unit tests in `synchronization-server/test_sync.py` have been updated.

Your remaining tasks are:
1. Verify the existing database schema extensions on the client and server.
2. Complete the client React Native UI integration in `client-mobile-app/src/app/index.tsx`:
   - Import the state pesticide laws database: `import statePesticideLaws from '../constants/state_pesticide_laws.json';`
   - Add localized translation strings to the `UI_TRANSLATIONS` map for languages (EN, ES, PT, FR) to support pesticide logging title, labels, descriptions, and error/validation states.
   - Insert a "Pesticide Compliance Logs" card component in index.tsx directly below the "Field Observations" card and above the "Social Media Photo Sharing Gallery".
   - The card must feature:
     - A state selection selector (e.g. selector row for selecting any of the US states, using keys from the JSON database, at least showing common states like TX, CA, WA, NY, etc.).
     - Displaying the regulatory agency name and citation reference from the JSON for the selected state.
     - A chip selector for Field ID (Sector 1, Sector 2, Sector 4).
     - Standard input text fields for Chemical/Brand Name and Amount Applied (Gallons, numeric).
     - Dynamic text/numeric input fields loaded on the fly from the JSON schema for the selected state (e.g. Applicator License for TX, Permit Number/REI/PHI for CA, License/Wind Speed for WA, County/Target Pest for NY). Set numeric keyboard types if specified.
     - Client-side validation: ensure that required dynamic fields are populated, and numeric limits (e.g. `min` values) are enforced using the validation rules and custom error messages in the JSON.
     - Implement an offline-friendly JS UUIDv4 generator function and use it to generate the `id` of newly inserted pesticide reports. This is critical because the sync protocol (`shared-protocols/sync_operation.json`) validates that all `record_id` fields match the UUID regex pattern, whereas the default app code generates non-compliant alphanumeric IDs like `task_xxx`.
     - Log Pesticide Report button: validate inputs, and if clean, insert the report into the local database using `writeMutation(db, 'chemical_reports', reportId, 'INSERT', newReport)`. Reset inputs upon successful insertion.
     - Display list of logged reports from SQLite database, showcasing their chemical name, amount, state, dynamic fields, and sync state (e.g. Sync Badge: "Synced" / "Offline Pending").
     - Soft-deletion: add a "Complete" button for each record that calls `writeMutation` with a 'DELETE' operation to set `is_deleted = 1` and `sync_state = 'dirty'`.
3. Complete the client CSV Exporter in `client-mobile-app/src/app/index.tsx`'s `exportToCsv` function:
   - Extend support for the `chemical_reports` table.
   - Retrieve active (non-deleted) pesticide report rows. If empty, warn the user.
   - Deserialize the `dynamic_fields` JSON string for each row, flatten its keys directly into the row object.
   - Dynamically collect all keys across all records to build the CSV header row.
   - Format and generate CSV content, escaping quotes as standard.
   - Add a touchable button "📝 Pesticide Logs" in the Data Ownership card to trigger `exportToCsv('chemical_reports')`.
4. Run the sync server tests:
   - Run the tests from the `synchronization-server` directory using `python -m unittest test_sync.py` and capture/report the results in your handoff.
