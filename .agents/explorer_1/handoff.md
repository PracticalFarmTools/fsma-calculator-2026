# Handoff Report - Pesticide compliance logging database and dynamic interface

## 1. Observation
During the investigation of the Practical Farm Tools repository, the following exact files, structures, and line codes were observed:

1. **Local Database Schema & Mutation Handler**
   - **Path**: `client-mobile-app/src/database/db.ts`
   - **Lines 54–67**: Contains the original schema definition for the `chemical_reports` table:
     ```typescript
     // 4. Chemical Reports table
     await db.execAsync(`
       CREATE TABLE IF NOT EXISTS chemical_reports (
         id TEXT PRIMARY KEY NOT NULL,
         field_id TEXT NOT NULL,
         chemical_name TEXT NOT NULL,
         amount_applied REAL NOT NULL,
         created_at TEXT NOT NULL,
         updated_at TEXT NOT NULL,
         synced_at TEXT,
         sync_state TEXT NOT NULL CHECK(sync_state IN ('clean', 'dirty', 'pending', 'conflict')) DEFAULT 'dirty',
         is_deleted INTEGER NOT NULL DEFAULT 0
       );
     `);
     ```
   - **Lines 122–128**: Defines transaction-based mutations on local SQLite database via `writeMutation`:
     ```typescript
     export async function writeMutation(
       db: SQLite.SQLiteDatabase,
       table: 'messages' | 'tasks' | 'maintenance_logs' | 'chemical_reports' | 'observations' | 'media_posts',
       id: string,
       operation: 'INSERT' | 'UPDATE' | 'DELETE',
       recordData: any
     )
     ```

2. **React Native Client Application Frontend**
   - **Path**: `client-mobile-app/src/app/index.tsx`
   - **Lines 26–224**: Holds the localized interface translations under `UI_TRANSLATIONS` object supporting EN (`en`), ES (`es`), PT (`pt`), and FR (`fr`).
   - **Lines 296–306**: Fetches conflicts across all tables, including `chemical_reports`:
     ```typescript
     const conflictedReports = await db.getAllAsync("SELECT * FROM chemical_reports WHERE sync_state = 'conflict';");
     ```
   - **Lines 789–799**: Exposes CSV exports for only `tasks`, `messages`, and `observations`:
     ```typescript
     <View style={styles.exportActionRow}>
       <TouchableOpacity style={styles.exportButton} onPress={() => exportToCsv('tasks')}>
         <Text style={styles.exportButtonText}>📋 Tasks</Text>
       </TouchableOpacity>
       ...
     </View>
     ```

3. **Backend Synchronization Server Models & Rules**
   - **Path**: `synchronization-server/models.py`, lines 44–54:
     ```python
     class ChemicalReport(Base):
         __tablename__ = "chemical_reports"
         id = Column(String(36), primary_key=True, index=True)
         field_id = Column(String(36), nullable=False)
         chemical_name = Column(String(255), nullable=False)
         amount_applied = Column(Float, nullable=False)
         ...
     ```
   - **Path**: `synchronization-server/main.py`, line 45:
     ```python
     # Tables that bypass LWW and trigger a conflict if modified concurrently
     HIGH_VALUE_TABLES = {"maintenance_logs", "chemical_reports", "observations"}
     ```
     This confirms chemical reports are flagged as high-value records and invoke conflict markers if synchronization overlaps.

---

## 2. Logic Chain
- **Observation 1.1** indicates the `chemical_reports` table exists on the client device but lack variables to house dynamic compliant records such as custom license numbers or REI. To fulfill state compliance, the client database must hold a `state` text identifier and a dynamic serializable `dynamic_fields` JSON string.
- **Observation 2.3** highlights that pesticide compliance reports are completely missing from the dashboard view of the mobile client. To make this functional, we must insert a specialized dynamic card layout inside `index.tsx` referencing a compiled JSON array of state guidelines.
- **Observation 2.1** shows how the app manages multi-lingual localization. The new compliance settings and input placeholders must be added to all translation matrices (EN, ES, PT, FR) to keep user interfaces consistent.
- **Observation 3.1 & 3.2** verifies the FastAPI server maps and validates incoming payloads dynamically. The server model and schema attributes must match the client-side schema extensions (`state` and `dynamic_fields`) to prevent serialization failures during sync operations.
- **Observation 2.3** demonstrates that while other tables are exportable, chemical reports are omitted. Updating the exporter to support `chemical_reports` and flattening its dynamic columns dynamically is required to produce standard CSV documents.

---

## 3. Caveats
- **US-Centric Assumptions**: The state pesticide regulations database (`state_pesticide_laws.json`) is designed for the 50 US States. It assumes dynamic field validation rules apply mostly to state levels. International compliance guidelines have not been investigated.
- **JSON Serialization Limits**: Dynamic fields are stored inside SQLite as serialized JSON strings. If queries must index specifically on dynamic columns (e.g. querying permit numbers directly), standard indexing will not apply, but for synchronization and CSV exports, text serialization is sufficient.

---

## 4. Conclusion
Integrating a dynamic pesticide compliance logging system is highly feasible and conforms cleanly to the existing offline-first React Native architecture. 
- **Frontend Changes**: A state-driven logging form settings card will be placed in `client-mobile-app/src/app/index.tsx`, dynamically rendering text or numeric inputs based on `state_pesticide_laws.json`.
- **Database Changes**: The local SQLite `chemical_reports` table will be extended with `state` and `dynamic_fields` columns, alongside SQLAlchemy/Pydantic model alignment in `synchronization-server`.
- **Export Changes**: The CSV builder will parse nested JSON attributes to generate customized columns.

---

## 5. Verification Method
1. **Client Interface Compilation**:
   Run `npm run lint` or `npx expo start --web` in the `client-mobile-app` directory to ensure that TypeScript and JSX elements build without exceptions.
2. **Server Sync Integration**:
   Run python unit tests from the `synchronization-server/` directory:
   ```bash
   python -m unittest test_sync.py
   ```
   *Invalidation Condition*: Tests will fail if the schemas on FastAPI (schemas.py) and SQLite/SQLAlchemy (models.py) do not strictly match.
3. **CSV Export Inspection**:
   Trigger `exportToCsv('chemical_reports')` on a simulated browser and inspect the download file to verify custom columns (e.g., `permit_number`, `rei_hours`) are flattened and structured correctly.
