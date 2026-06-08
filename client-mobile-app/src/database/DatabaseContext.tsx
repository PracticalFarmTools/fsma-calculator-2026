import React, { createContext, useContext, useEffect, useState } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, ActivityIndicator } from 'react-native';
import * as SQLite from 'expo-sqlite';
import NetInfo from '@react-native-community/netinfo';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { initDatabase } from './db';
import { performSync } from './sync';
import { P2PManager, P2PPeer } from './p2p';

interface DatabaseContextValue {
  db: SQLite.SQLiteDatabase | null;
  isOnline: boolean;
  activePeers: P2PPeer[];
  syncStatus: string;
  isSyncing: boolean;
  syncNow: () => Promise<void>;
  clientId: string;
  userLanguage: string | null;
  changeLanguage: (lang: string) => Promise<void>;
  pendingAreaCalculation: number | null;
  setPendingAreaCalculation: (area: number | null) => void;
}

const DatabaseContext = createContext<DatabaseContextValue | null>(null);

const BACKEND_URL = 'http://localhost:8000';

export const DatabaseProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [db, setDb] = useState<SQLite.SQLiteDatabase | null>(null);
  const [isOnline, setIsOnline] = useState<boolean>(false);
  const [activePeers, setActivePeers] = useState<P2PPeer[]>([]);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [syncStatus, setSyncStatus] = useState<string>('Idle');
  const [clientId, setClientId] = useState<string>('');
  const [p2p, setP2p] = useState<P2PManager | null>(null);
  const [userLanguage, setUserLanguage] = useState<string | null>(null);
  const [isLanguageLoading, setIsLanguageLoading] = useState<boolean>(true);
  const [pendingAreaCalculation, setPendingAreaCalculation] = useState<number | null>(null);

  // Function to update language selection
  const changeLanguage = async (lang: string) => {
    try {
      await AsyncStorage.setItem('@farmconnect:user_language', lang);
      setUserLanguage(lang);
    } catch (err) {
      console.error('Failed to save language preference:', err);
    }
  };

  // Initialize DB and Client ID on startup
  useEffect(() => {
    async function setup() {
      try {
        // 0. Load language preference
        const savedLang = await AsyncStorage.getItem('@farmconnect:user_language');
        setUserLanguage(savedLang);
        setIsLanguageLoading(false);

        // 1. Get or generate unique Client ID
        let cId = await AsyncStorage.getItem('@farmconnect:client_id');
        if (!cId) {
          cId = 'device_' + Math.random().toString(36).substring(2, 11);
          await AsyncStorage.setItem('@farmconnect:client_id', cId);
        }
        setClientId(cId);

        // 2. Open SQLite database
        const database = await SQLite.openDatabaseAsync('farm.db');
        
        // 3. Run migrations/initializations
        await initDatabase(database);
        setDb(database);
        console.log('Local SQLite Database initialized successfully.');

        // 4. Setup P2P discovery
        const p2pName = 'Console-' + cId.substring(7, 11).toUpperCase();
        const p2pMgr = new P2PManager(
          database,
          cId,
          p2pName,
          (peers) => {
            setActivePeers(peers);
          }
        );
        p2pMgr.startServer();
        p2pMgr.startDiscovery();
        setP2p(p2pMgr);
      } catch (err) {
        console.error('Failed to initialize database provider:', err);
        setSyncStatus('DB Error');
      }
    }

    setup();

    return () => {
      if (p2p) {
        p2p.stop();
      }
    };
  }, []);

  // Network State Listener and Auto-Sync Trigger
  useEffect(() => {
    if (!db || !clientId) return;

    const unsubscribe = NetInfo.addEventListener((state) => {
      const online = !!state.isConnected && !!state.isInternetReachable;
      setIsOnline(online);
      
      if (online) {
        console.log('Network connected. Automatically running sync queue flush.');
        setSyncStatus('Online - Syncing...');
        triggerSync(db, clientId);
      } else {
        setSyncStatus('Offline - Queueing');
      }
    });

    return () => {
      unsubscribe();
    };
  }, [db, clientId]);

  const triggerSync = async (database: SQLite.SQLiteDatabase, cId: string) => {
    if (isSyncing) return;
    setIsSyncing(true);
    setSyncStatus('Syncing...');
    try {
      const result = await performSync(database, BACKEND_URL, cId);
      if (result.success) {
        setSyncStatus(result.conflictCount > 0 ? 'Sync Complete (Conflicts)' : 'Synced');
      } else {
        setSyncStatus('Sync Error');
      }
      console.log(result.message);
    } catch (err) {
      console.error(err);
      setSyncStatus('Sync Failed');
    } finally {
      setIsSyncing(false);
    }
  };

  const syncNow = async () => {
    if (db && clientId) {
      await triggerSync(db, clientId);
    }
  };

  return (
    <DatabaseContext.Provider
      value={{
        db,
        isOnline,
        activePeers,
        syncStatus,
        isSyncing,
        syncNow,
        clientId,
        userLanguage,
        changeLanguage,
        pendingAreaCalculation,
        setPendingAreaCalculation
      }}
    >
      {isLanguageLoading ? (
        <View style={contextStyles.loader}>
          <ActivityIndicator size="large" color="#2E7D32" />
        </View>
      ) : userLanguage ? (
        children
      ) : (
        <LanguageSelectionScreen onSelect={changeLanguage} />
      )}
    </DatabaseContext.Provider>
  );
};

// -------------------------------------------------------------
// Beautiful fullscreen Language Selection Overlay
// -------------------------------------------------------------
interface LanguageSelectionScreenProps {
  onSelect: (lang: string) => void;
}

const LanguageSelectionScreen: React.FC<LanguageSelectionScreenProps> = ({ onSelect }) => {
  return (
    <View style={contextStyles.overlay}>
      <View style={contextStyles.card}>
        <Text style={contextStyles.emoji}>🚜</Text>
        <Text style={contextStyles.title}>Practical Farm Tools</Text>
        <Text style={contextStyles.subtitle}>Please select your language to begin / Seleccione su idioma / Selecione seu idioma / Choisissez votre langue</Text>
        
        <TouchableOpacity style={contextStyles.button} onPress={() => onSelect('en')}>
          <Text style={contextStyles.buttonText}>🇺🇸 English</Text>
        </TouchableOpacity>

        <TouchableOpacity style={contextStyles.button} onPress={() => onSelect('es')}>
          <Text style={contextStyles.buttonText}>🇪🇸 Español</Text>
        </TouchableOpacity>

        <TouchableOpacity style={contextStyles.button} onPress={() => onSelect('pt')}>
          <Text style={contextStyles.buttonText}>🇧🇷 Português</Text>
        </TouchableOpacity>

        <TouchableOpacity style={contextStyles.button} onPress={() => onSelect('fr')}>
          <Text style={contextStyles.buttonText}>🇫🇷 Français</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const contextStyles = StyleSheet.create({
  loader: {
    flex: 1,
    backgroundColor: '#F5F7F6',
    justifyContent: 'center',
    alignItems: 'center'
  },
  overlay: {
    flex: 1,
    backgroundColor: '#F5F7F6',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 30,
    width: '100%',
    maxWidth: 400,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E1E7E3',
    shadowColor: '#1B4322',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 5
  },
  emoji: {
    fontSize: 50,
    marginBottom: 16
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1B4322',
    marginBottom: 8,
    textAlign: 'center'
  },
  subtitle: {
    fontSize: 12,
    color: '#61746B',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 18
  },
  button: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E1E7E3',
    borderRadius: 8,
    paddingVertical: 14,
    marginBottom: 12,
    alignItems: 'center',
    shadowColor: '#1B4322',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1
  },
  buttonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#2E3A31'
  }
});

export const useDatabase = () => {
  const context = useContext(DatabaseContext);
  if (!context) {
    throw new Error('useDatabase must be used within a DatabaseProvider');
  }
  return context;
};
