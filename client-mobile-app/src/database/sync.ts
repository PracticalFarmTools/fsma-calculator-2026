import * as SQLite from 'expo-sqlite';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getSyncQueue, clearSyncQueue, updateSyncState, writeMutation } from './db';

const LAST_SYNCED_KEY = '@farmconnect:last_synced_at';

export interface SyncOperationPayload {
  target_table: string;
  record_id: string;
  operation: 'INSERT' | 'UPDATE' | 'DELETE';
  payload: any;
  updated_at: string;
}

export interface SyncResponseData {
  sync_results: {
    record_id: string;
    target_table: string;
    status: 'clean' | 'conflict';
    remote_data?: any;
  }[];
  new_records: {
    [table: string]: any[];
  };
  server_time: string;
}

// Perform opportunistic background synchronization with remote server
export async function performSync(
  db: SQLite.SQLiteDatabase,
  backendUrl: string,
  clientId: string
): Promise<{ success: boolean; conflictCount: number; message: string }> {
  try {
    // 1. Fetch pending sync queue from SQLite
    const localQueue = await getSyncQueue(db);
    
    // 2. Fetch last sync timestamp from AsyncStorage
    const lastSyncedAt = await AsyncStorage.getItem(LAST_SYNCED_KEY);
    
    // Parse queue elements into sync payload
    const formattedQueue: SyncOperationPayload[] = localQueue.map(item => {
      let payload = {};
      try {
        payload = JSON.parse(item.payload);
      } catch (err) {
        payload = {};
      }
      return {
        target_table: item.target_table,
        record_id: item.record_id,
        operation: item.operation,
        payload: payload,
        updated_at: item.created_at
      };
    });

    // 3. Send payload to server
    const syncRequestPayload = {
      client_id: clientId,
      last_synced_at: lastSyncedAt,
      queue: formattedQueue
    };

    console.log(`Starting sync: sending ${formattedQueue.length} operations. Last sync: ${lastSyncedAt}`);
    
    const response = await fetch(`${backendUrl}/sync`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(syncRequestPayload)
    });

    if (!response.ok) {
      throw new Error(`Sync server responded with status: ${response.status}`);
    }

    const data: SyncResponseData = await response.json();
    let conflictCount = 0;
    
    // 4. Handle sync results (mark clean or conflict)
    await db.withTransactionAsync(async () => {
      let maxSuccessfulQueueId = 0;
      
      for (let i = 0; i < localQueue.length; i++) {
        const localItem = localQueue[i];
        const serverResult = data.sync_results.find(
          r => r.record_id === localItem.record_id && r.target_table === localItem.target_table
        );

        if (serverResult) {
          if (serverResult.status === 'clean') {
            await updateSyncState(db, localItem.target_table, localItem.record_id, 'clean', data.server_time);
            maxSuccessfulQueueId = Math.max(maxSuccessfulQueueId, localItem.queue_id);
          } else if (serverResult.status === 'conflict') {
            conflictCount++;
            await updateSyncState(db, localItem.target_table, localItem.record_id, 'conflict');
            console.warn(`Sync conflict on ${localItem.target_table}:${localItem.record_id}`);
          }
        }
      }

      // Clear successfully flushed operations from sync_queue
      if (maxSuccessfulQueueId > 0) {
        await clearSyncQueue(db, maxSuccessfulQueueId);
      }

      // 5. Apply new/updated records from other devices sent by the server
      for (const [tableName, records] of Object.entries(data.new_records)) {
        for (const record of records) {
          const localMatch: any = await db.getFirstAsync(
            `SELECT sync_state FROM ${tableName} WHERE id = ?;`,
            record.id
          );

          if (!localMatch || localMatch.sync_state === 'clean') {
            const finalRecord = {
              ...record,
              sync_state: 'clean',
              synced_at: data.server_time
            };
            
            const updatedFields = Object.keys(finalRecord).join(', ');
            const updatedPlaceholders = Object.keys(finalRecord).map(() => '?').join(', ');
            const updatedValues = Object.values(finalRecord) as any[];

            await db.runAsync(
              `INSERT OR REPLACE INTO ${tableName} (${updatedFields}) VALUES (${updatedPlaceholders});`,
              ...updatedValues
            );
          }
        }
      }
    });

    // 6. Update last sync time in storage
    await AsyncStorage.setItem(LAST_SYNCED_KEY, data.server_time);
    
    return {
      success: true,
      conflictCount,
      message: `Sync completed successfully. ${formattedQueue.length - conflictCount} items synced. ${conflictCount} conflicts. Fetch delta completed.`
    };
  } catch (error: any) {
    console.error('Synchronization failed:', error);
    return {
      success: false,
      conflictCount: 0,
      message: `Sync failed: ${error.message}`
    };
  }
}

// Function to manually resolve a conflict (user selection)
export async function resolveConflict(
  db: SQLite.SQLiteDatabase,
  table: 'messages' | 'tasks' | 'maintenance_logs' | 'chemical_reports' | 'observations' | 'media_posts',
  id: string,
  resolution: 'keep_local' | 'keep_remote',
  remotePayload?: any
) {
  if (resolution === 'keep_remote' && remotePayload) {
    // Overwrite local with remote
    const timestamp = new Date().toISOString();
    const finalRecord = {
      ...remotePayload,
      sync_state: 'clean',
      synced_at: timestamp
    };
    
    const fields = Object.keys(finalRecord).join(', ');
    const placeholders = Object.keys(finalRecord).map(() => '?').join(', ');
    const values = Object.values(finalRecord) as any[];

    await db.withTransactionAsync(async () => {
      await db.runAsync(
        `INSERT OR REPLACE INTO ${table} (${fields}) VALUES (${placeholders});`,
        ...values
      );
      await db.runAsync('DELETE FROM sync_queue WHERE target_table = ? AND record_id = ?;', table, id);
    });
  } else {
    // Keep local: Mark it as dirty again so it re-attempts sync and overwrites the server
    await db.withTransactionAsync(async () => {
      await updateSyncState(db, table, id, 'dirty');
      
      const localRecord: any = await db.getFirstAsync(`SELECT * FROM ${table} WHERE id = ?;`, id);
      if (localRecord) {
        delete localRecord.sync_state;
        delete localRecord.synced_at;
        const payloadJson = JSON.stringify(localRecord);
        await db.runAsync(
          `INSERT INTO sync_queue (target_table, record_id, operation, payload, created_at) VALUES (?, ?, ?, ?, ?);`,
          table,
          id,
          'UPDATE',
          payloadJson,
          new Date().toISOString()
        );
      }
    });
  }
}
