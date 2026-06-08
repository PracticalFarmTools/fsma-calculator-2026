import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Linking,
  Alert
} from 'react-native';
import { useDatabase } from '@/database/DatabaseContext';
import { writeMutation } from '@/database/db';

export function performOfflineTranslation(text: string, from: string, to: string): string {
  if (from === to) return text;
  const cleanText = text.trim().toLowerCase();
  
  const dict: Record<string, Record<string, string>> = {
    "irrigate the field": {
      en: "Irrigate the field",
      es: "Regar el campo",
      pt: "Irrigar o campo",
      fr: "Irriguer le champ"
    },
    "we need to check sector 2 for pests": {
      en: "We need to check Sector 2 for pests",
      es: "Necesitamos revisar el Sector 2 en busca de plagas",
      pt: "Precisamos verificar o Setor 2 para pragas",
      fr: "Nous devons inspecter le Secteur 2 pour les nuisibles"
    },
    "barn door is locked": {
      en: "Barn door is locked",
      es: "La puerta del granero está cerrada",
      pt: "A porta do celeiro está trancada",
      fr: "La porte de la grange est fermée"
    },
    "necesitamos regar el sector 2": {
      en: "We need to irrigate Sector 2",
      es: "Necesitamos regar el Sector 2",
      pt: "Precisamos irrigar o Setor 2",
      fr: "Nous devons irriguer le Secteur 2"
    },
    "aviso de plagas en el huerto sur": {
      en: "Pest warning in the south orchard",
      es: "Aviso de plagas en el huerto sur",
      pt: "Aviso de pragas no pomar sul",
      fr: "Alerte aux nuisibles dans le verger sud"
    },
    "puerta del pastizal reparada": {
      en: "Pasture gate is fixed",
      es: "Puerta del pastizal reparada",
      pt: "Portão do pasto consertado",
      fr: "La barrière du pâturage est réparée"
    },
    "buenos dias equipo": {
      en: "Good morning team",
      es: "Buenos días equipo",
      pt: "Bom dia equipe",
      fr: "Bonjour l'équipe"
    },
    "precisamos irrigar o setor 2": {
      en: "We need to irrigate Sector 2",
      es: "Necesitamos regar el Sector 2",
      pt: "Precisamos irrigar o Setor 2",
      fr: "Nous devons irriguer le Secteur 2"
    },
    "aviso de pragas no pomar sul": {
      en: "Pest warning in the south orchard",
      es: "Aviso de plagas en el huerto sur",
      pt: "Aviso de pragas no pomar sul",
      fr: "Alerte aux nuisibles dans le verger sud"
    },
    "portao do pasto consertado": {
      en: "Pasture gate is fixed",
      es: "Puerta del pastizal reparada",
      pt: "Portão do pasto consertado",
      fr: "La barrière du pâturage est réparée"
    },
    "bom dia equipe": {
      en: "Good morning team",
      es: "Buenos días equipo",
      pt: "Bom dia equipe",
      fr: "Bonjour l'équipe"
    }
  };

  for (const [key, langs] of Object.entries(dict)) {
    if (cleanText === key || cleanText.includes(key)) {
      return langs[to] || text;
    }
  }

  const names: Record<string, string> = { en: "English", es: "Español", pt: "Português", fr: "Français" };
  return `${text} 🌐 (Translated from ${names[from] || from})`;
}

export default function ChatScreen() {
  const { db, clientId, syncStatus, userLanguage, isOnline, activePeers } = useDatabase();
  const [messages, setMessages] = useState<any[]>([]);
  const [inputText, setInputText] = useState('');
  const flatListRef = useRef<FlatList>(null);

  const handleSmsFallback = (content: string) => {
    const url = `sms:?body=${encodeURIComponent(content)}`;
    Linking.openURL(url).catch(err => {
      console.error('Failed to open SMS app:', err);
      Alert.alert('Error', 'Could not open native SMS app on this device.');
    });
  };

  // Load chat messages from SQLite database
  useEffect(() => {
    async function loadMessages() {
      const database = db;
      if (!database) return;
      try {
        const localMessages = await database.getAllAsync(
          "SELECT * FROM messages WHERE is_deleted = 0 ORDER BY created_at ASC;"
        );
        setMessages(localMessages);
      } catch (err) {
        console.error('Failed to load chat messages:', err);
      }
    }
 
    loadMessages();
  }, [db, syncStatus, inputText]);

  // Send message locally (Optimistic UI and sync_queue write)
  const handleSendMessage = async () => {
    if (!db || !inputText.trim()) return;

    const messageId = `msg_${Math.random().toString(36).substring(2, 9)}`;
    const timestamp = new Date().toISOString();

    const newMessage = {
      id: messageId,
      room_id: 'general_hq',
      sender_id: clientId.substring(0, 8),
      content: inputText.trim(),
      language_code: userLanguage || 'en',
      created_at: timestamp,
      updated_at: timestamp,
      sync_state: 'dirty',
      is_deleted: 0
    };

    // Optimistically update list in memory for immediate feedback
    setMessages(prev => [...prev, newMessage]);
    setInputText('');

    try {
      // Perform ACID SQLite write & enqueue sync mutation
      await writeMutation(db, 'messages', messageId, 'INSERT', newMessage);
      
      // Auto-scroll list to bottom
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    } catch (err) {
      console.error('Failed to save message locally:', err);
    }
  };

  const [toggledOriginalMessageIds, setToggledOriginalMessageIds] = useState<Record<string, boolean>>({});

  const toggleMessageTranslation = (id: string) => {
    setToggledOriginalMessageIds(prev => ({
      ...prev,
      [id]: !prev[id]
    }));
  };

  const getLangFlag = (code: string) => {
    if (code === 'en') return '🇺🇸';
    if (code === 'es') return '🇪🇸';
    if (code === 'pt') return '🇧🇷';
    if (code === 'fr') return '🇫🇷';
    return '🌐';
  };

  const renderItem = ({ item }: { item: any }) => {
    const isMe = item.sender_id === clientId.substring(0, 8);
    const msgLang = item.language_code || 'en';
    const targetLang = userLanguage || 'en';
    const hasTranslation = msgLang !== targetLang;
    const isToggledOriginal = !!toggledOriginalMessageIds[item.id];

    let displayContent = item.content;
    if (hasTranslation && !isToggledOriginal) {
      displayContent = performOfflineTranslation(item.content, msgLang, targetLang);
    }
    
    // Determine sync state icon
    let syncIcon = '⏱️'; // dirty/queued
    if (item.sync_state === 'clean') {
      syncIcon = '✔️';
    } else if (item.sync_state === 'pending') {
      syncIcon = '📤';
    } else if (item.sync_state === 'conflict') {
      syncIcon = '⚠️';
    }

    return (
      <View style={[styles.messageRow, isMe ? styles.myRow : styles.otherRow]}>
        <View style={[styles.bubble, isMe ? styles.myBubble : styles.otherBubble]}>
          {!isMe && <Text style={styles.senderLabel}>Device: {item.sender_id}</Text>}
          
          <TouchableOpacity onPress={() => hasTranslation && toggleMessageTranslation(item.id)} disabled={!hasTranslation}>
            <Text style={[styles.messageText, isMe ? styles.myMessageText : styles.otherMessageText]}>
              {displayContent}
            </Text>
            {hasTranslation && (
              <Text style={[styles.originalTextInline, isMe ? styles.myOriginalText : styles.otherOriginalText]}>
                {getLangFlag(msgLang)} {msgLang.toUpperCase()}: {isToggledOriginal ? displayContent : item.content}
              </Text>
            )}
          </TouchableOpacity>

          {isMe && item.sync_state !== 'clean' && (
            <TouchableOpacity 
              style={styles.smsFallbackButton} 
              onPress={() => handleSmsFallback(item.content)}
            >
              <Text style={styles.smsFallbackText}>📲 Send via Cell Text (SMS)</Text>
            </TouchableOpacity>
          )}

          <View style={styles.metaRow}>
            <Text style={[styles.timeText, isMe ? styles.myTimeText : styles.otherTimeText]}>
              {new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </Text>
            <Text style={styles.syncText}> {syncIcon}</Text>
          </View>
        </View>
      </View>
    );
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.container}
    >
      {/* Chat Room Subtitle Banner */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}># general-hq</Text>
        <Text style={styles.headerSub}>
          Offline Mesh Chat • Local broadcasts auto-sync when online
        </Text>
      </View>

      {!isOnline && activePeers.length === 0 && (
        <View style={styles.offlineBanner}>
          <Text style={styles.offlineBannerText}>
            📡 Offline & out of mesh range. Messages are queued. Tap any queued message (⏱️) to send it via native SMS (Cell Text).
          </Text>
        </View>
      )}

      {/* Message List */}
      <FlatList
        ref={flatListRef}
        data={messages}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
        onLayout={() => flatListRef.current?.scrollToEnd({ animated: true })}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No messages in this sector yet.</Text>
            <Text style={styles.emptySub}>Type a message below to broadcast to offline peers!</Text>
          </View>
        }
      />

      {/* Input Composer */}
      <View style={styles.composer}>
        <TextInput
          style={styles.input}
          placeholder="Broadcast message to field..."
          placeholderTextColor="#888"
          value={inputText}
          onChangeText={setInputText}
          onSubmitEditing={handleSendMessage}
        />
        <TouchableOpacity style={styles.sendButton} onPress={handleSendMessage}>
          <Text style={styles.sendText}>Send</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F7F6'
  },
  header: {
    padding: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderColor: '#E1E7E3'
  },
  headerTitle: {
    color: '#1B4322',
    fontSize: 18,
    fontWeight: 'bold'
  },
  headerSub: {
    color: '#61746B',
    fontSize: 11,
    marginTop: 2
  },
  listContent: {
    padding: 16,
    paddingBottom: 24
  },
  messageRow: {
    flexDirection: 'row',
    marginBottom: 12,
    width: '100%'
  },
  myRow: {
    justifyContent: 'flex-end'
  },
  otherRow: {
    justifyContent: 'flex-start'
  },
  bubble: {
    maxWidth: '80%',
    padding: 10,
    borderRadius: 12,
    borderWidth: 1
  },
  myBubble: {
    backgroundColor: '#E8F5E9',
    borderColor: '#C8E6C9',
    borderBottomRightRadius: 2
  },
  otherBubble: {
    backgroundColor: '#FFFFFF',
    borderColor: '#E1E7E3',
    borderBottomLeftRadius: 2
  },
  senderLabel: {
    color: '#2E7D32',
    fontSize: 10,
    fontWeight: 'bold',
    marginBottom: 4
  },
  messageText: {
    fontSize: 14,
    lineHeight: 18
  },
  myMessageText: {
    color: '#1B4322'
  },
  otherMessageText: {
    color: '#2E3A31'
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    marginTop: 6
  },
  timeText: {
    fontSize: 9
  },
  myTimeText: {
    color: '#61746B'
  },
  otherTimeText: {
    color: '#8C9B90'
  },
  syncText: {
    fontSize: 10
  },
  composer: {
    flexDirection: 'row',
    padding: 12,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderColor: '#E1E7E3',
    alignItems: 'center'
  },
  input: {
    flex: 1,
    backgroundColor: '#F5F7F6',
    color: '#2E3A31',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginRight: 10,
    fontSize: 14,
    borderWidth: 1,
    borderColor: '#E1E7E3'
  },
  sendButton: {
    backgroundColor: '#2E7D32',
    borderRadius: 20,
    paddingHorizontal: 18,
    paddingVertical: 8
  },
  sendText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 14
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 100
  },
  emptyText: {
    color: '#1B4322',
    fontSize: 15,
    fontWeight: '600',
    textAlign: 'center'
  },
  emptySub: {
    color: '#61746B',
    fontSize: 13,
    textAlign: 'center',
    marginTop: 6
  },
  originalTextInline: {
    fontSize: 11,
    fontStyle: 'italic',
    marginTop: 6,
    paddingTop: 4,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0, 0, 0, 0.05)'
  },
  myOriginalText: {
    color: '#61746B'
  },
  otherOriginalText: {
    color: '#8C9B90'
  },
  offlineBanner: {
    backgroundColor: '#F9FBF9',
    borderBottomWidth: 1,
    borderColor: '#E1E7E3',
    paddingHorizontal: 16,
    paddingVertical: 10,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center'
  },
  offlineBannerText: {
    color: '#61746B',
    fontSize: 11,
    fontWeight: '500',
    lineHeight: 16,
    textAlign: 'center'
  },
  smsFallbackButton: {
    marginTop: 6,
    paddingVertical: 4,
    paddingHorizontal: 8,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#C8E6C9',
    borderRadius: 6,
    alignSelf: 'flex-start'
  },
  smsFallbackText: {
    color: '#2E7D32',
    fontSize: 10,
    fontWeight: 'bold'
  }
});
