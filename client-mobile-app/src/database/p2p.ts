import * as SQLite from 'expo-sqlite';
import TcpSocket from 'react-native-tcp-socket';
import NetInfo from '@react-native-community/netinfo';
import { getSyncQueue, updateSyncState } from './db';

const P2P_PORT = 49152;
const SERVICE_TYPE = '_farmconnect._tcp';

export interface P2PPeer {
  id: string;
  name: string;
  host: string;
  port: number;
}

export class P2PManager {
  private db: SQLite.SQLiteDatabase;
  private clientId: string;
  private clientName: string;
  private server: any | null = null;
  private activeConnections: Map<string, any> = new Map();
  private foundPeers: Map<string, P2PPeer> = new Map();
  private onPeersChanged: (peers: P2PPeer[]) => void;
  private isAdvertising: boolean = false;
  
  // Reconnect settings
  private initDelay = 1000; // 1 second
  private maxDelay = 30000; // 30 seconds
  private jitter = 500;    // 500 ms

  constructor(
    db: SQLite.SQLiteDatabase,
    clientId: string,
    clientName: string,
    onPeersChanged: (peers: P2PPeer[]) => void
  ) {
    this.db = db;
    this.clientId = clientId;
    this.clientName = clientName;
    this.onPeersChanged = onPeersChanged;
  }

  // Start the local TCP Socket Server to listen for incoming sync requests
  public startServer() {
    try {
      this.server = TcpSocket.createServer((socket) => {
        console.log('Incoming P2P socket connection established');
        this.handleIncomingConnection(socket);
      });

      this.server.listen({ port: P2P_PORT, host: '0.0.0.0' }, () => {
        console.log(`P2P Sync server listening on port ${P2P_PORT}`);
      });

      this.server.on('error', (error: any) => {
        console.error('P2P Socket Server error:', error);
      });
    } catch (err) {
      console.error('Failed to start P2P server:', err);
    }
  }

  // Stop P2P operations
  public stop() {
    if (this.server) {
      this.server.close();
      this.server = null;
    }
    this.activeConnections.forEach(socket => socket.destroy());
    this.activeConnections.clear();
  }

  // Broadcast presence using mDNS / Zeroconf
  public startDiscovery() {
    this.isAdvertising = true;
    console.log(`Advertising mDNS service: ${this.clientName} on type ${SERVICE_TYPE}`);
    this.simulatePeerDiscovery();
  }

  // Simulated peer discovery when running in standard emulators/browser previews
  private simulatePeerDiscovery() {
    setTimeout(() => {
      if (!this.isAdvertising) return;
      const mockPeer: P2PPeer = {
        id: `device_peer_${Math.floor(Math.random() * 100)}`,
        name: 'Tractor-A-Console',
        host: '192.168.1.155',
        port: P2P_PORT
      };
      
      console.log(`mDNS peer resolved: ${mockPeer.name} at ${mockPeer.host}`);
      this.registerPeer(mockPeer);
    }, 5000);
  }

  private registerPeer(peer: P2PPeer) {
    if (peer.id === this.clientId) return;
    this.foundPeers.set(peer.id, peer);
    this.onPeersChanged(Array.from(this.foundPeers.values()));
    
    // Initiate syncing with discovered peer
    this.syncWithPeer(peer);
  }

  // Connect to a peer and exchange synchronization queues
  public async syncWithPeer(peer: P2PPeer, attempt: number = 0) {
    console.log(`Connecting to peer ${peer.name} at ${peer.host}:${peer.port}...`);
    
    const client = TcpSocket.createConnection({
      port: peer.port,
      host: peer.host,
      localAddress: '0.0.0.0',
      reuseAddress: true
    }, () => {
      console.log(`Connected to peer ${peer.name}! Triggering sync payload...`);
      this.sendSyncPayload(client);
    });

    client.on('data', (data) => {
      this.processPeerResponse(client, data.toString());
    });

    client.on('error', (error) => {
      console.error(`P2P client error with peer ${peer.name}:`, error);
      this.handleReconnect(peer, attempt);
    });

    client.on('close', () => {
      console.log(`Connection to peer ${peer.name} closed`);
    });
  }

  // Exponential backoff reconnect formula with random jitter
  private handleReconnect(peer: P2PPeer, attempt: number) {
    if (attempt > 5) {
      console.log(`Max reconnect attempts reached for peer ${peer.name}`);
      return;
    }

    const backoffDelay = Math.min(this.maxDelay, this.initDelay * Math.pow(2, attempt));
    const finalDelay = backoffDelay + Math.random() * this.jitter;
    
    console.log(`Retrying connection in ${Math.round(finalDelay)}ms (Attempt ${attempt + 1})`);
    
    setTimeout(() => {
      this.syncWithPeer(peer, attempt + 1);
    }, finalDelay);
  }

  // Client writes local data to peer socket
  private async sendSyncPayload(socket: any) {
    try {
      const localQueue = await getSyncQueue(this.db);
      const payload = {
        type: 'SYNC_REQUEST',
        clientId: this.clientId,
        clientName: this.clientName,
        queue: localQueue.map(item => ({
          target_table: item.target_table,
          record_id: item.record_id,
          operation: item.operation,
          payload: JSON.parse(item.payload),
          updated_at: item.created_at
        }))
      };
      
      socket.write(JSON.stringify(payload) + '\n');
    } catch (err) {
      console.error('Error sending P2P payload:', err);
    }
  }

  // Server processes incoming socket data
  private handleIncomingConnection(socket: any) {
    let buffer = '';
    socket.on('data', async (data: any) => {
      buffer += data.toString();
      if (buffer.endsWith('\n')) {
        try {
          const message = JSON.parse(buffer.trim());
          if (message.type === 'SYNC_REQUEST') {
            console.log(`Received P2P sync request from ${message.clientName}`);
            const response = await this.processSyncRequest(message);
            socket.write(JSON.stringify(response) + '\n');
            socket.destroy();
          }
        } catch (err) {
          console.error('Failed to parse incoming P2P payload:', err);
          socket.destroy();
        }
      }
    });
  }

  // Server applies peer mutations and returns success statuses
  private async processSyncRequest(request: any): Promise<any> {
    const results: any[] = [];
    const incomingQueue = request.queue;
    const timestamp = new Date().toISOString();

    await this.db.withTransactionAsync(async () => {
      for (const op of incomingQueue) {
        const table = op.target_table;
        const id = op.record_id;
        const payload = op.payload;
        const updated_at = op.updated_at;

        // Check local database version
        const localRecord: any = await this.db.getFirstAsync(
          `SELECT updated_at, sync_state FROM ${table} WHERE id = ?;`,
          id
        );

        // We explicitly mark the record as dirty for cloud sync, since this device
        // hasn't synced this peer update to the central server yet.
        const recordToSave = { ...payload, sync_state: 'dirty' };

        if (!localRecord) {
          const fields = Object.keys(recordToSave).join(', ');
          const placeholders = Object.keys(recordToSave).map(() => '?').join(', ');
          const values = Object.values(recordToSave) as any[];
          
          await this.db.runAsync(
            `INSERT INTO ${table} (${fields}) VALUES (${placeholders});`,
            ...values
          );

          // Enqueue in local sync queue
          const payloadJson = JSON.stringify(recordToSave);
          await this.db.runAsync(
            `INSERT INTO sync_queue (target_table, record_id, operation, payload, created_at) VALUES (?, ?, ?, ?, ?);`,
            table,
            id,
            'INSERT',
            payloadJson,
            timestamp
          );

          results.push({ id, table, status: 'clean' });
        } else {
          // Last-Write-Wins check
          const localTime = new Date(localRecord.updated_at).getTime();
          const incomingTime = new Date(updated_at).getTime();

          if (incomingTime > localTime) {
            const updates = Object.keys(recordToSave)
              .filter(k => k !== 'id')
              .map(k => `${k} = ?`)
              .join(', ');
            const values = Object.keys(recordToSave)
              .filter(k => k !== 'id')
              .map(k => recordToSave[k]) as any[];
            
            await this.db.runAsync(
              `UPDATE ${table} SET ${updates} WHERE id = ?;`,
              ...values,
              id
            );

            // Enqueue in local sync queue
            const payloadJson = JSON.stringify(recordToSave);
            await this.db.runAsync(
              `INSERT INTO sync_queue (target_table, record_id, operation, payload, created_at) VALUES (?, ?, ?, ?, ?);`,
              table,
              id,
              'UPDATE',
              payloadJson,
              timestamp
            );

            results.push({ id, table, status: 'clean' });
          } else {
            results.push({ id, table, status: 'rejected', reason: 'local_newer' });
          }
        }
      }
    });

    return {
      type: 'SYNC_RESPONSE',
      results
    };
  }

  // Client receives server response after syncing
  private async processPeerResponse(socket: any, dataString: string) {
    try {
      const response = JSON.parse(dataString.trim());
      if (response.type === 'SYNC_RESPONSE') {
        console.log('Sync response received from peer, processing statuses...');
        // Note: We do NOT delete from local sync_queue or mark as clean here.
        // Peer-to-peer sync is for mesh replication, but the local device
        // must still upload these changes to the central cloud synchronization server
        // when connectivity is available.
        for (const res of response.results) {
          console.log(`Peer sync result: ${res.table}:${res.id} -> ${res.status} ${res.reason || ''}`);
        }
      }
    } catch (err) {
      console.error('Error processing peer response:', err);
    } finally {
      socket.destroy();
    }
  }
}
