import * as SQLite from 'expo-sqlite';

// Define the Database Initialization
export async function initDatabase(db: SQLite.SQLiteDatabase) {
  await db.withTransactionAsync(async () => {
    // 1. Messages table
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS messages (
        id TEXT PRIMARY KEY NOT NULL,
        room_id TEXT NOT NULL,
        sender_id TEXT NOT NULL,
        content TEXT NOT NULL,
        language_code TEXT NOT NULL DEFAULT 'en',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        synced_at TEXT,
        sync_state TEXT NOT NULL CHECK(sync_state IN ('clean', 'dirty', 'pending', 'conflict')) DEFAULT 'dirty',
        is_deleted INTEGER NOT NULL DEFAULT 0
      );
    `);

    // 2. Tasks table
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS tasks (
        id TEXT PRIMARY KEY NOT NULL,
        title TEXT NOT NULL,
        description TEXT,
        assignee_id TEXT,
        status TEXT NOT NULL DEFAULT 'pending',
        due_date TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        synced_at TEXT,
        sync_state TEXT NOT NULL CHECK(sync_state IN ('clean', 'dirty', 'pending', 'conflict')) DEFAULT 'dirty',
        is_deleted INTEGER NOT NULL DEFAULT 0
      );
    `);

    // 3. Maintenance Logs table
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS maintenance_logs (
        id TEXT PRIMARY KEY NOT NULL,
        equipment_name TEXT NOT NULL,
        issue TEXT NOT NULL,
        action_taken TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        synced_at TEXT,
        sync_state TEXT NOT NULL CHECK(sync_state IN ('clean', 'dirty', 'pending', 'conflict')) DEFAULT 'dirty',
        is_deleted INTEGER NOT NULL DEFAULT 0
      );
    `);

    // 4. Chemical Reports table
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS chemical_reports (
        id TEXT PRIMARY KEY NOT NULL,
        field_id TEXT NOT NULL,
        chemical_name TEXT NOT NULL,
        amount_applied REAL NOT NULL,
        state TEXT NOT NULL DEFAULT 'TX',
        dynamic_fields TEXT,
        epa_reg_no TEXT,
        applicator_name TEXT,
        applicator_license TEXT,
        area_treated REAL,
        crop_treated TEXT,
        target_pest TEXT,
        application_method TEXT,
        start_time TEXT,
        end_time TEXT,
        wind_speed REAL,
        wind_direction TEXT,
        temperature REAL,
        permit_number TEXT,
        county TEXT,
        rei_hours INTEGER,
        phi_days INTEGER,
        applicator_signature TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        synced_at TEXT,
        sync_state TEXT NOT NULL CHECK(sync_state IN ('clean', 'dirty', 'pending', 'conflict')) DEFAULT 'dirty',
        is_deleted INTEGER NOT NULL DEFAULT 0
      );
    `);

    // 4b. Pesticide Inventory table (Frequently used chemicals favorites)
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS pesticide_inventory (
        id TEXT PRIMARY KEY NOT NULL,
        chemical_name TEXT NOT NULL,
        epa_reg_no TEXT NOT NULL,
        default_rei_hours INTEGER,
        default_phi_days INTEGER,
        created_at TEXT NOT NULL
      );
    `);

    // 5. Observations table
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS observations (
        id TEXT PRIMARY KEY NOT NULL,
        field_id TEXT NOT NULL,
        notes TEXT NOT NULL,
        observed_by TEXT NOT NULL,
        severity TEXT NOT NULL DEFAULT 'info',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        synced_at TEXT,
        sync_state TEXT NOT NULL CHECK(sync_state IN ('clean', 'dirty', 'pending', 'conflict')) DEFAULT 'dirty',
        is_deleted INTEGER NOT NULL DEFAULT 0
      );
    `);

    // 6. Media Posts table
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS media_posts (
        id TEXT PRIMARY KEY NOT NULL,
        image_url TEXT NOT NULL,
        caption TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        synced_at TEXT,
        sync_state TEXT NOT NULL CHECK(sync_state IN ('clean', 'dirty', 'pending', 'conflict')) DEFAULT 'dirty',
        is_deleted INTEGER NOT NULL DEFAULT 0
      );
    `);

    // 7. Synchronization Queue table
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS sync_queue (
        queue_id INTEGER PRIMARY KEY AUTOINCREMENT,
        target_table TEXT NOT NULL,
        record_id TEXT NOT NULL,
        operation TEXT NOT NULL CHECK(operation IN ('INSERT', 'UPDATE', 'DELETE')),
        payload TEXT NOT NULL,
        created_at TEXT NOT NULL
      );
    `);

    // 8. Migration checks (ensure language_code exists on older local databases)
    try {
      await db.execAsync("ALTER TABLE messages ADD COLUMN language_code TEXT NOT NULL DEFAULT 'en';");
      console.log("Database Migration: Successfully added 'language_code' column to 'messages' table.");
    } catch (err) {
      // Column already exists or table does not exist yet
    }

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

    // Add compliance columns migrations
    const complianceColumns = [
      { name: 'epa_reg_no', type: 'TEXT' },
      { name: 'applicator_name', type: 'TEXT' },
      { name: 'applicator_license', type: 'TEXT' },
      { name: 'area_treated', type: 'REAL' },
      { name: 'crop_treated', type: 'TEXT' },
      { name: 'target_pest', type: 'TEXT' },
      { name: 'application_method', type: 'TEXT' },
      { name: 'start_time', type: 'TEXT' },
      { name: 'end_time', type: 'TEXT' },
      { name: 'wind_speed', type: 'REAL' },
      { name: 'wind_direction', type: 'TEXT' },
      { name: 'temperature', type: 'REAL' },
      { name: 'permit_number', type: 'TEXT' },
      { name: 'county', type: 'TEXT' },
      { name: 'rei_hours', type: 'INTEGER' },
      { name: 'phi_days', type: 'INTEGER' },
      { name: 'applicator_signature', type: 'TEXT' }
    ];

    for (const col of complianceColumns) {
      try {
        await db.execAsync(`ALTER TABLE chemical_reports ADD COLUMN ${col.name} ${col.type};`);
        console.log(`Database Migration: Successfully added '${col.name}' column to 'chemical_reports' table.`);
      } catch (err) {
        // Column already exists or table does not exist yet
      }
    }
  });
}

// Write operation to database and enqueue in sync_queue (ACID transactional write)
export async function writeMutation(
  db: SQLite.SQLiteDatabase,
  table: 'messages' | 'tasks' | 'maintenance_logs' | 'chemical_reports' | 'observations' | 'media_posts',
  id: string,
  operation: 'INSERT' | 'UPDATE' | 'DELETE',
  recordData: any
) {
  const timestamp = new Date().toISOString();
  
  await db.withTransactionAsync(async () => {
    // 1. Apply mutation locally
    if (operation === 'INSERT') {
      const fields = Object.keys(recordData).join(', ');
      const placeholders = Object.keys(recordData).map(() => '?').join(', ');
      const values = Object.values(recordData) as any[];
      
      await db.runAsync(
        `INSERT OR REPLACE INTO ${table} (${fields}) VALUES (${placeholders});`,
        ...values
      );
    } 
    else if (operation === 'UPDATE') {
      const updates = Object.keys(recordData)
        .filter(k => k !== 'id')
        .map(k => `${k} = ?`)
        .join(', ');
      const values = Object.keys(recordData)
        .filter(k => k !== 'id')
        .map(k => recordData[k]) as any[];
      
      await db.runAsync(
        `UPDATE ${table} SET ${updates} WHERE id = ?;`,
        ...values,
        id
      );
    } 
    else if (operation === 'DELETE') {
      // Soft deletion required by coding guidelines
      await db.runAsync(
        `UPDATE ${table} SET is_deleted = 1, updated_at = ?, sync_state = 'dirty' WHERE id = ?;`,
        timestamp,
        id
      );
      recordData.is_deleted = 1;
      recordData.updated_at = timestamp;
      recordData.sync_state = 'dirty';
    }

    // 2. Enqueue mutation in local sync queue
    const payloadJson = JSON.stringify(recordData);
    await db.runAsync(
      `INSERT INTO sync_queue (target_table, record_id, operation, payload, created_at) VALUES (?, ?, ?, ?, ?);`,
      table,
      id,
      operation,
      payloadJson,
      timestamp
    );
  });
}

// Fetch all elements in sync queue
export async function getSyncQueue(db: SQLite.SQLiteDatabase): Promise<any[]> {
  return await db.getAllAsync('SELECT * FROM sync_queue ORDER BY queue_id ASC;');
}

// Clear sync queue up to a specific queue_id
export async function clearSyncQueue(db: SQLite.SQLiteDatabase, upToQueueId: number) {
  await db.runAsync('DELETE FROM sync_queue WHERE queue_id <= ?;', upToQueueId);
}

// Update Sync State of local records
export async function updateSyncState(
  db: SQLite.SQLiteDatabase,
  table: string,
  id: string,
  state: 'clean' | 'dirty' | 'pending' | 'conflict',
  syncedAt?: string
) {
  if (syncedAt) {
    await db.runAsync(
      `UPDATE ${table} SET sync_state = ?, synced_at = ? WHERE id = ?;`,
      state,
      syncedAt,
      id
    );
  } else {
    await db.runAsync(
      `UPDATE ${table} SET sync_state = ? WHERE id = ?;`,
      state,
      id
    );
  }
}
export type SQLiteDatabase = SQLite.SQLiteDatabase;
export type SQLiteRunResult = SQLite.SQLiteRunResult;
