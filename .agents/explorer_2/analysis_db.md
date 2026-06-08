# Database and Migration Analysis Report: Pesticide Compliance & chemical_reports

This analysis examines the offline-first database layout, client-side transaction patterns, synchronization flow, and server schemas. It proposes the migration and synchronization architecture required to extend pesticide reporting to support state-specific compliance dynamically, matching the guidelines of `PROJECT.md`.

---

## 1. Executive Summary
- **Objective**: Extend the local and remote schemas of `chemical_reports` to support a `state` abbreviation and a `dynamic_fields` JSON string. This enables the client to render custom compliance fields dynamically on a state-by-state basis as dictated by `state_pesticide_laws.json`.
- **Key Findings**:
  - **Local Layer**: Client uses `expo-sqlite` with transactional mutations (`db.withTransactionAsync`) that write locally and queue synchronization tasks to `sync_queue`.
  - **Sync Layer**: Synchronization uses a POST request sending a batch of pending mutations to the FastAPI backend.
  - **Conflict Logic**: `chemical_reports` is flagged as a `HIGH_VALUE_TABLE`. Concurrently modified records (where server update time is newer than client's last sync time and payload values differ) trigger a conflict status (`status: "conflict"`) returned to the mobile app for manual reconciliation.
  - **Protocol Inconsistency**: The schema in `shared-protocols/sync_operation.json` enforces UUID constraints on `record_id`, whereas the client app generates arbitrary alphanumeric tags (e.g., `task_xxx`, `obs_xxx`).

---

## 2. Analysis of Current Database Architecture

### A. Local SQLite & Transaction Layer (`client-mobile-app/src/database/`)
1. **DDL Initialization (`db.ts`)**:
   - `initDatabase` executes a single transaction creating tables for messages, tasks, maintenance logs, observations, media posts, and the synchronization queue (`sync_queue`).
   - The current `chemical_reports` table structure is:
     ```sql
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
     ```

2. **Transaction Isolation & Mutations (`db.ts`)**:
   - Mutations are written via `writeMutation()`, which encapsulates SQLite writes inside `db.withTransactionAsync`.
   - **Soft Deletions**: In accordance with the project's coding conventions, `DELETE` operations do not physically delete records. Instead, they run an update setting `is_deleted = 1` and `sync_state = 'dirty'`.
   - **Sync Queuing**: When a record is mutated (inserted, updated, soft deleted), the transaction writes the record's payload string and operation context to `sync_queue`. This guarantees that local records and their sync queue entries are written atomically.

3. **Background Replication (`sync.ts`)**:
   - `performSync()` reads the queue, posts payloads to the server, and processes response indicators.
   - For clean results, the client marks local records clean and updates `synced_at`.
   - Incoming records from other devices (`new_records`) are safely merged into the local SQLite database if the client's local record is currently marked as `'clean'` or does not exist, preventing concurrent local updates from being overwritten.

---

### B. Server Database & Sync Rules (`synchronization-server/`)
1. **SQLAlchemy Models (`models.py`)**:
   - `ChemicalReport` mirrors the SQLite schema, utilizing standard SQLAlchemy field definitions:
     ```python
     class ChemicalReport(Base):
         __tablename__ = "chemical_reports"
         id = Column(String(36), primary_key=True, index=True)
         field_id = Column(String(36), nullable=False)
         chemical_name = Column(String(255), nullable=False)
         amount_applied = Column(Float, nullable=False)
         ...
     ```
2. **Pydantic Validation (`schemas.py`)**:
   - `ChemicalReportSchema` inherits from `RecordBase` and handles API schema validation.
3. **FastAPI Synchronization Logic (`main.py`)**:
   - Resolves conflicts using Last-Write-Wins (LWW) based on `updated_at` timestamps.
   - For high-value tables (`maintenance_logs`, `chemical_reports`, `observations`), the server compares the incoming values to existing values if the server's record has been modified since the client's last sync time. If values differ, it rejects the client's update and flags a conflict, sending the server's state back as `remote_data`.

---

## 3. Proposed Schema Extensions & Migration Plan

### A. Core Extensions
To satisfy pesticide law dynamism, we need to add the following columns:
1. `state` (String / TEXT): Stores the 2-letter US state code (e.g., `"TX"`, `"CA"`) corresponding to the compliance rules applied.
2. `dynamic_fields` (Text / JSON string): Stores the dynamic, state-specific compliance inputs (such as license numbers, permit numbers, REI hours, etc.) in a serializable string format.

---

### B. Client-Side SQLite Schema & Migration
We must update `client-mobile-app/src/database/db.ts` to both update the creation script and handle migrations on existing user devices:

#### 1. Table Creation Modification (`db.ts:54-67`):
```sql
CREATE TABLE IF NOT EXISTS chemical_reports (
  id TEXT PRIMARY KEY NOT NULL,
  field_id TEXT NOT NULL,
  chemical_name TEXT NOT NULL,
  amount_applied REAL NOT NULL,
  state TEXT NOT NULL DEFAULT 'TX',  -- New column
  dynamic_fields TEXT,               -- New column (JSON string)
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  synced_at TEXT,
  sync_state TEXT NOT NULL CHECK(sync_state IN ('clean', 'dirty', 'pending', 'conflict')) DEFAULT 'dirty',
  is_deleted INTEGER NOT NULL DEFAULT 0
);
```

#### 2. Backward Compatibility Migration Step (`db.ts` under migrations block):
To prevent app crashes or data loss on devices with pre-existing databases, add alteration statements inside `initDatabase`'s transaction block:
```typescript
// Migration for chemical_reports state-specific fields
try {
  await db.execAsync("ALTER TABLE chemical_reports ADD COLUMN state TEXT NOT NULL DEFAULT 'TX';");
  console.log("Database Migration: Successfully added 'state' column to 'chemical_reports' table.");
} catch (err) {
  // Column already exists or table does not exist yet
}

try {
  await db.execAsync("ALTER TABLE chemical_reports ADD COLUMN dynamic_fields TEXT;");
  console.log("Database Migration: Successfully added 'dynamic_fields' column to 'chemical_reports' table.");
} catch (err) {
  // Column already exists or table does not exist yet
}
```

---

### C. Server-Side Database Schema Extension
We must adjust SQLAlchemy and Pydantic models on the server to reflect the database structure.

#### 1. Models Extension (`synchronization-server/models.py`):
```python
class ChemicalReport(Base):
    __tablename__ = "chemical_reports"

    id = Column(String(36), primary_key=True, index=True)
    field_id = Column(String(36), nullable=False)
    chemical_name = Column(String(255), nullable=False)
    amount_applied = Column(Float, nullable=False)
    state = Column(String(10), nullable=False, default="TX")  # New column
    dynamic_fields = Column(Text, nullable=True)              # New column (JSON string)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow)
    synced_at = Column(DateTime, default=datetime.utcnow)
    is_deleted = Column(Boolean, default=False)
```

#### 2. Validation Schema Extension (`synchronization-server/schemas.py`):
```python
class ChemicalReportSchema(RecordBase):
    field_id: str
    chemical_name: str
    amount_applied: float
    state: str                                      # New validation attribute
    dynamic_fields: Optional[str] = None            # New dynamic data attribute
    synced_at: Optional[datetime] = None

    class Config:
        orm_mode = True
```

---

### D. Server-Side Data Migrations
Because FastAPI uses `Base.metadata.create_all` which does not alter pre-existing tables automatically, we must use a migration path:

#### Option 1: Alembic Migrations (Recommended for Production)
If the project plans to use Alembic for database lifecycle tracking, create a new revision:
```bash
alembic revision --autogenerate -m "Add state and dynamic_fields to chemical_reports"
```
The auto-generated migration file should apply the changes:
```python
def upgrade():
    op.add_column('chemical_reports', sa.Column('state', sa.String(length=10), nullable=False, server_default='TX'))
    op.add_column('chemical_reports', sa.Column('dynamic_fields', sa.Text(), nullable=True))

def downgrade():
    op.drop_column('chemical_reports', 'dynamic_fields')
    op.drop_column('chemical_reports', 'state')
```

#### Option 2: Automatic Dynamic SQL Migration Script (Recommended for Offline/Local Dev)
For easy developer environment setups, we can introduce a migration hook inside `synchronization-server/database.py` or `main.py` directly after `create_all`:
```python
def run_sqlite_migrations(engine):
    """Executes schema alterations on development SQLite file if columns are missing."""
    import sqlite3
    connection = engine.raw_connection()
    try:
        cursor = connection.cursor()
        # Check existing columns
        cursor.execute("PRAGMA table_info(chemical_reports);")
        columns = [row[1] for row in cursor.fetchall()]
        
        if "state" not in columns:
            cursor.execute("ALTER TABLE chemical_reports ADD COLUMN state VARCHAR(10) NOT NULL DEFAULT 'TX';")
            print("Server Migration: Successfully added 'state' column to 'chemical_reports'.")
        if "dynamic_fields" not in columns:
            cursor.execute("ALTER TABLE chemical_reports ADD COLUMN dynamic_fields TEXT;")
            print("Server Migration: Successfully added 'dynamic_fields' column to 'chemical_reports'.")
        connection.commit()
    except Exception as e:
        print(f"Skipping database checks or migrations: {e}")
    finally:
        connection.close()
```

---

## 4. Verification & Protocol Compliance

### A. Conflict Logic Resilience
The server's conflict logic automatically covers the new attributes:
- The server checks whether the incoming record values differ from the server state:
  ```python
  differs = False
  for k, v in parsed_payload.items():
      if k in ["synced_at", "updated_at"]:
          continue
      db_val = getattr(db_record, k)
      if db_val != v:
          differs = True
          break
  ```
- Adding `state` and `dynamic_fields` to the model automatically registers them under `__table__.columns`.
- Thus, any divergence in the state code or dynamic compliance details will trigger the conflict handler.

### B. Shared Protocol & Client Schema Warning
- **Observation**: `shared-protocols/sync_operation.json` defines a strict regex matching UUID formatting for the `record_id` property:
  `"pattern": "^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$"`
- **Discrepancy**: The frontend UI generates custom IDs (e.g., `task_xxx` or `obs_xxx`) which will fail this JSON schema constraint.
- **Resolution**: Suggest transitioning all client-side ID generation from random alphanumeric codes to standard UUIDs (e.g., using `uuidv4` on the client, or `uuid` package) to maintain strict protocol alignment.
