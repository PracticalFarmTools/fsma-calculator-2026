# Handoff Report: Database Migration & Sync Analysis for `chemical_reports`

## 1. Observation
1. **Client-side Schema Structure**: Located in `client-mobile-app/src/database/db.ts` lines 56–67:
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
2. **Server-side SQLAlchemy Model**: Located in `synchronization-server/models.py` lines 44–54:
   ```python
   class ChemicalReport(Base):
       __tablename__ = "chemical_reports"

       id = Column(String(36), primary_key=True, index=True)
       field_id = Column(String(36), nullable=False)
       chemical_name = Column(String(255), nullable=False)
       amount_applied = Column(Float, nullable=False)
       created_at = Column(DateTime, default=datetime.utcnow)
       updated_at = Column(DateTime, default=datetime.utcnow)
       synced_at = Column(DateTime, default=datetime.utcnow)
       is_deleted = Column(Boolean, default=False)
   ```
3. **Server-side Validation Schema**: Located in `synchronization-server/schemas.py` lines 46–53:
   ```python
   # Chemical Report Schema
   class ChemicalReportSchema(RecordBase):
       field_id: str
       chemical_name: str
       amount_applied: float
       synced_at: Optional[datetime] = None

       class Config:
           orm_mode = True
   ```
4. **Shared Protocol Validator**: Located in `shared-protocols/sync_operation.json` lines 10–13:
   ```json
   "record_id": {
     "type": "string",
     "pattern": "^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$"
   }
   ```
5. **Client-side Non-UUID ID Generation**: Located in `client-mobile-app/src/app/index.tsx` line 319:
   ```typescript
   const taskId = `task_${Math.random().toString(36).substring(2, 9)}`;
   ```
6. **Command Timeout Observation**: During attempt to execute `run_command` to execute tests:
   ```
   Encountered error in step execution: Permission prompt for action 'command' on target 'python -m unittest test_sync.py' timed out waiting for user response.
   ```

---

## 2. Logic Chain
1. To meet the requirements of `PROJECT.md` (to support state-specific forms flexibly), we must store state-specific values. Since these fields vary by state (e.g. license numbers for Texas, permit numbers and hourly limits for California), standard relational columns are rigid. Therefore, adding a `state` abbreviation column and a `dynamic_fields` JSON column to local/remote database schemas is the optimal solution.
2. In the local offline SQLite database (`db.ts`), adding the columns to `CREATE TABLE` is sufficient for new installations. However, to handle backwards-compatibility without deleting existing local databases (which would lose unsynced farm logs), we must add dynamic migrations (`ALTER TABLE` commands inside a try-catch block during initialization).
3. On the server side, SQLAlchemy's `models.py` needs new fields matching SQLite. Pydantic schemas in `schemas.py` must be updated to accept and serialize them.
4. Because the server uses a generic mapping function `model_to_dict` (in `main.py`) which iterates over database columns, adding columns to the model will automatically register them. The server's conflict detection logic compares payload content to database fields for tables in `HIGH_VALUE_TABLES`. Since `chemical_reports` is already in this list, conflicts on the new columns will be resolved without changing the FastAPI endpoint logic.
5. In `shared-protocols/sync_operation.json`, `record_id` must match a UUID format. However, the client generates alphanumeric IDs (`task_xxx`, `obs_xxx`), which violates the schema constraints. To avoid breaking sync operations, client-side ID generation must be migrated to standard UUID formatting.

---

## 3. Caveats
- **Alembic not configured**: The project does not currently configure Alembic. Local SQLite databases on the server require a startup Python helper or manual SQL commands to run schema alterations.
- **Unexecuted Tests**: Tests were not executed locally due to the permission timeout. The analysis relies on static analysis of the existing codebase.

---

## 4. Conclusion
- Propose extending local SQLite and remote tables of `chemical_reports` with `state` (String) and `dynamic_fields` (Text, representing a JSON payload).
- Propose backward-compatible SQLite migration queries in `db.ts` to add these columns safely.
- Recommend migrating client-side ID generation to standard UUIDs to resolve protocol non-compliance.
- Detailed migration patch proposals are authored in `.agents/explorer_2/analysis_db.md`.

---

## 5. Verification Method
1. **SQLite Local Migration Check**: Open client mobile database, verify the schema contains `state` and `dynamic_fields` columns, and make sure existing databases update successfully without throwing errors.
2. **FastAPI Schema Test**: Run FastAPI test suite:
   ```bash
   cd synchronization-server
   python -m unittest test_sync.py
   ```
   Modify `test_sync.py` to include `state` and `dynamic_fields` inside the `chemical_reports` payload and verify the sync server processes and flags conflicts correctly.
3. **Inspect Code Files**: Ensure schema changes match proposal files:
   - `client-mobile-app/src/database/db.ts`
   - `synchronization-server/models.py`
   - `synchronization-server/schemas.py`
