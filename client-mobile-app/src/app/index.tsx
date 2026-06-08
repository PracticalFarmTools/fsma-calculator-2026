import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Clipboard,
  Image,
  Share,
  Platform,
  Alert
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useDatabase } from '@/database/DatabaseContext';
import { writeMutation } from '@/database/db';
import { resolveConflict } from '@/database/sync';
import { encryptField, decryptField } from '@/database/crypto';
import statePesticideLaws from '../constants/state_pesticide_laws.json';

interface MockPhoto {
  id: string;
  title: string;
  emoji: string;
  caption: string;
}

export const UI_TRANSLATIONS = {
  en: {
    dashboardTitle: "🚜 Practical Farm Tools",
    dashboardSubtitle: "Local Offline Mesh System",
    syncBtn: "Sync",
    syncing: "Syncing...",
    statusLabel: "Status: ",
    online: "Cloud Online",
    mesh: "P2P Mesh",
    active: "active",
    conflictsTitle: "⚠️ Database Sync Conflicts",
    keepLocal: "Keep Local",
    acceptServer: "Accept Server",
    
    // Cards
    commTitle: "💬 Communications Area",
    commDesc: "Recent activity in #general-hq channel:",
    commEmpty: "No recent chats. Head to the Chat tab to start!",
    
    todoTitle: "📋 To-Do & Tasks Area",
    todoPlaceholder: "Add new task (e.g. mend pasture gate)...",
    todoEmpty: "All caught up! No active tasks.",
    todoAdd: "Add",
    todoComplete: "Complete",
    todoSynced: "Synced",
    todoPending: "Offline Pending",
    
    obsTitle: "🔍 Field Observations",
    obsPlaceholder: "Log crop status, pests, leaks, or notes...",
    obsSec: "Sec",
    obsInfo: "🔵 Info",
    obsWarn: "🟡 Warn",
    obsCrit: "🔴 Crit",
    obsLogBtn: "Log Observation Locally",
    obsEmpty: "No field observations logged yet.",
    obsSynced: "Synced",
    obsLocal: "Local",
    
    socialTitle: "📸 Social Media Pic Sharing",
    socialDesc: "Select a farm snapshot or upload your own to copy ready-made captions or post directly on social media:",
    socialUploadBtn: "Upload Photo",
    socialEmpty: "Ready to Share Snapshot",
    socialCopy: "📋 Copy Text",
    socialShare: "📤 Share Post",
    socialCopied: "📋 Caption copied to clipboard! Ready to paste.",
    socialShared: "✅ Shared successfully!",
    socialMockUpload: "📸 Selected placeholder farm snapshot!",
    dataTitle: "🔑 Data Ownership & Export",
    dataDesc: "Your farm data belongs to you. Export any local table directly to standard CSV format at any time—no lock-in, no internet connection required:",
    dataExportSuccess: "CSV exported successfully!",

    // Pesticide Compliance
    pesticideTitle: "🛡️ Pesticide Compliance Logs",
    pesticideDesc: "Log pesticide applications and ensure compliance with state regulations.",
    pesticideSelectState: "Select State:",
    pesticideAgency: "Regulatory Agency:",
    pesticideCitation: "Citation Reference:",
    pesticideFieldId: "Field ID:",
    pesticideChemName: "Chemical / Brand Name",
    pesticideAmount: "Amount Applied (Gallons)",
    pesticideArea: "Area Treated (Acres)",
    pesticideLogBtn: "Log Pesticide Report Locally",
    pesticideEmpty: "No pesticide compliance reports logged yet.",
    pesticideSynced: "Synced",
    pesticidePending: "Offline Pending",
    pesticideCompleteBtn: "Complete",
    pesticideSuccess: "Pesticide report logged successfully!"
  },
  es: {
    dashboardTitle: "🚜 Herramientas de Granja",
    dashboardSubtitle: "Sistema de Malla Local sin Conexión",
    syncBtn: "Sincronizar",
    syncing: "Sincronizando...",
    statusLabel: "Estado: ",
    online: "Nube En Línea",
    mesh: "Malla P2P",
    active: "activo",
    conflictsTitle: "⚠️ Conflictos de Sincronización",
    keepLocal: "Mantener Local",
    acceptServer: "Aceptar Servidor",
    
    commTitle: "💬 Área de Comunicaciones",
    commDesc: "Actividad reciente en el canal #general-hq:",
    commEmpty: "No hay chats recientes. ¡Ve a la pestaña de Chat para empezar!",
    
    todoTitle: "📋 Área de Tareas y Pendientes",
    todoPlaceholder: "Agregar nueva tarea (ej. reparar cerca)...",
    todoEmpty: "¡Todo al día! No hay tareas activas.",
    todoAdd: "Añadir",
    todoComplete: "Completar",
    todoSynced: "Sincronizado",
    todoPending: "Pendiente Fuera de Línea",
    
    obsTitle: "🔍 Observaciones de Campo",
    obsPlaceholder: "Registrar estado de cultivos, plagas, fugas...",
    obsSec: "Sec",
    obsInfo: "🔵 Info",
    obsWarn: "🟡 Advert",
    obsCrit: "🔴 Crítico",
    obsLogBtn: "Registrar Observación Local",
    obsEmpty: "Aún no se han registrado observaciones.",
    obsSynced: "Sincronizado",
    obsLocal: "Local",
    
    socialTitle: "📸 Compartir Fotos en Redes Sociales",
    socialDesc: "Selecciona una foto o sube la tuya para copiar subtítulos listos o compartir en redes:",
    socialUploadBtn: "Subir Foto",
    socialEmpty: "Listo para Compartir",
    socialCopy: "📋 Copiar Texto",
    socialShare: "📤 Compartir Post",
    socialCopied: "📋 ¡Subtítulo copiado al portapapeles!",
    socialShared: "✅ ¡Compartido con éxito!",
    socialMockUpload: "📸 ¡Foto de granja de prueba seleccionada!",
    dataTitle: "🔑 Propiedad y Exportación de Datos",
    dataDesc: "Tus datos agrícolas te pertenecen. Exporta cualquier tabla local directamente a formato CSV estándar en cualquier momento: sin bloqueos, sin necesidad de internet:",
    dataExportSuccess: "¡CSV exportado con éxito!",

    // Pesticide Compliance
    pesticideTitle: "🛡️ Registro de Pesticidas",
    pesticideDesc: "Registre la aplicación de pesticidas y asegure el cumplimiento de las normas estatales.",
    pesticideSelectState: "Seleccionar Estado:",
    pesticideAgency: "Agencia Reguladora:",
    pesticideCitation: "Referencia de Citación:",
    pesticideFieldId: "ID del Campo:",
    pesticideChemName: "Nombre Químico / Marca",
    pesticideAmount: "Cantidad Aplicada (Galones)",
    pesticideArea: "Área Tratada (Acres)",
    pesticideLogBtn: "Registrar Pesticida Localmente",
    pesticideEmpty: "Aún no hay registros de pesticidas.",
    pesticideSynced: "Sincronizado",
    pesticidePending: "Pendiente Fuera de Línea",
    pesticideCompleteBtn: "Completar",
    pesticideSuccess: "¡Registro de pesticida guardado con éxito!"
  },
  pt: {
    dashboardTitle: "🚜 Ferramentas Agrícolas",
    dashboardSubtitle: "Sistema de Malha Local Offline",
    syncBtn: "Sincronizar",
    syncing: "Sincronizando...",
    statusLabel: "Status: ",
    online: "Nuvem Online",
    mesh: "Malha P2P",
    active: "ativo",
    conflictsTitle: "⚠️ Conflitos de Sincronização",
    keepLocal: "Manter Local",
    acceptServer: "Aceitar Servidor",
    
    commTitle: "💬 Área de Comunicação",
    commDesc: "Atividade recente no canal #general-hq:",
    commEmpty: "Nenhuma conversa recente. Vá para o Chat para começar!",
    
    todoTitle: "📋 Área de Tarefas e Afazeres",
    todoPlaceholder: "Adicionar nova tarefa (ex: consertar portão)...",
    todoEmpty: "Tudo em dia! Sem tarefas ativas.",
    todoAdd: "Adicionar",
    todoComplete: "Concluir",
    todoSynced: "Sincronizado",
    todoPending: "Pendente Offline",
    
    obsTitle: "🔍 Observações de Campo",
    obsPlaceholder: "Registrar status da colheita, pragas, vazamentos...",
    obsSec: "Set",
    obsInfo: "🔵 Info",
    obsWarn: "🟡 Aviso",
    obsCrit: "🔴 Crítico",
    obsLogBtn: "Registrar Observação Localmente",
    obsEmpty: "Nenhuma observação registrada ainda.",
    obsSynced: "Sincronizado",
    obsLocal: "Local",
    
    socialTitle: "📸 Compartilhar Fotos nas Redes",
    socialDesc: "Selecione uma foto ou envie a sua para copiar legendas prontas ou postar nas redes:",
    socialUploadBtn: "Enviar Foto",
    socialEmpty: "Pronto para Compartilhar",
    socialCopy: "📋 Copiar Legenda",
    socialShare: "📤 Compartilhar",
    socialCopied: "📋 Legenda copiada para a área de transferência!",
    socialShared: "✅ Compartilhado com sucesso!",
    socialMockUpload: "📸 Foto de amostra da fazenda selecionada!",
    dataTitle: "🔑 Propriedade e Exportação de Dados",
    dataDesc: "Seus dados agrícolas pertencem a você. Exporte qualquer tabela local diretamente para o formato CSV padrão a qualquer momento—sem bloqueios, sem necessidade de internet:",
    dataExportSuccess: "CSV exportado com sucesso!",

    // Pesticide Compliance
    pesticideTitle: "🛡️ Registro de Defensivos",
    pesticideDesc: "Registre as aplicações de defensivos agrícolas e garanta conformidade com as regras estaduais.",
    pesticideSelectState: "Selecionar Estado:",
    pesticideAgency: "Órgão Regulador:",
    pesticideCitation: "Referência Legal:",
    pesticideFieldId: "ID do Talhão:",
    pesticideChemName: "Nome do Produto / Marca",
    pesticideAmount: "Quantidade Aplicada (Galões)",
    pesticideArea: "Área Tratada (Acres)",
    pesticideLogBtn: "Registrar Defensivo Localmente",
    pesticideEmpty: "Nenhum registro de defensivo inserido ainda.",
    pesticideSynced: "Sincronizado",
    pesticidePending: "Pendente Offline",
    pesticideCompleteBtn: "Concluir",
    pesticideSuccess: "Registro de defensivo salvo com sucesso!"
  },
  fr: {
    dashboardTitle: "🚜 Outils Agricoles",
    dashboardSubtitle: "Système de Réseau Local Hors Ligne",
    syncBtn: "Synchro",
    syncing: "Synchro...",
    statusLabel: "Statut : ",
    online: "En Ligne Cloud",
    mesh: "Réseau P2P",
    active: "actif",
    conflictsTitle: "⚠️ Conflits de Synchro",
    keepLocal: "Garder Local",
    acceptServer: "Accepter Serveur",
    
    commTitle: "💬 Espace Communication",
    commDesc: "Activité récente sur le canal #general-hq :",
    commEmpty: "Pas de discussion récente. Allez dans le Chat !",
    
    todoTitle: "📋 Tâches & Liste à faire",
    todoPlaceholder: "Ajouter une tâche (ex. réparer barrière)...",
    todoEmpty: "Tout est fait ! Aucune tâche active.",
    todoAdd: "Ajout",
    todoComplete: "Fait",
    todoSynced: "Synchronisé",
    todoPending: "Hors Ligne",
    
    obsTitle: "🔍 Observations de Terrain",
    obsPlaceholder: "Notez l'état des cultures, nuisibles, fuites...",
    obsSec: "Sec",
    obsInfo: "🔵 Info",
    obsWarn: "🟡 Avert",
    obsCrit: "🔴 Crit",
    obsLogBtn: "Enregistrer l'Observation Localement",
    obsEmpty: "Aucune observation enregistrée.",
    obsSynced: "Synchro",
    obsLocal: "Local",
    
    socialTitle: "📸 Partage de Photos",
    socialDesc: "Sélectionnez ou téléchargez une photo de la ferme pour copier la légende :",
    socialUploadBtn: "Télécharger",
    socialEmpty: "Prêt pour le Partage",
    socialCopy: "📋 Copier Légende",
    socialShare: "📤 Partager Post",
    socialCopied: "📋 Légende copiée dans le presse-papiers !",
    socialShared: "✅ Partagé avec succès !",
    socialMockUpload: "📸 Photo de ferme sélectionnée !",
    dataTitle: "🔑 Propriété & Exportation des Données",
    dataDesc: "Vos données agricoles vous appartiennent. Exportez n'importe quelle table locale au format CSV standard à tout moment—sans verrouillage, sans connexion requise :",
    dataExportSuccess: "CSV exporté avec succès !",

    // Pesticide Compliance
    pesticideTitle: "🛡️ Registre des Pesticides",
    pesticideDesc: "Enregistrez l'application des pesticides et assurez la conformité aux règlements de l'État.",
    pesticideSelectState: "Sélectionner l'État :",
    pesticideAgency: "Agence de Régulation :",
    pesticideCitation: "Référence Légale :",
    pesticideFieldId: "ID du Champ :",
    pesticideChemName: "Nom du Produit / Marque",
    pesticideAmount: "Quantité Appliquée (Gallons)",
    pesticideArea: "Surface Traitée (Acres)",
    pesticideLogBtn: "Enregistrer le Pesticide Localement",
    pesticideEmpty: "Aucun rapport de pesticide enregistré.",
    pesticideSynced: "Synchro",
    pesticidePending: "Hors Ligne",
    pesticideCompleteBtn: "Compléter",
    pesticideSuccess: "Rapport sur les pesticides enregistré avec succès !"
  }
};

// Offline-friendly JS UUIDv4 generator
const uuidv4 = () => {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
};

export default function HomeScreen() {
  const { 
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
  } = useDatabase();
  
  const lang = (userLanguage || 'en') as 'en' | 'es' | 'pt' | 'fr';
  const t = UI_TRANSLATIONS[lang] || UI_TRANSLATIONS.en;
  
  const [tasks, setTasks] = useState<any[]>([]);
  const [messages, setMessages] = useState<any[]>([]);
  const [observations, setObservations] = useState<any[]>([]);
  const [chemicalReports, setChemicalReports] = useState<any[]>([]);
  const [conflicts, setConflicts] = useState<any[]>([]);
  const [refreshCount, setRefreshCount] = useState(0);

  // Form states
  const [taskTitle, setTaskTitle] = useState('');
  const [obsNotes, setObsNotes] = useState('');
  const [obsSector, setObsSector] = useState('Sector 1');
  const [obsSeverity, setObsSeverity] = useState<'info' | 'warning' | 'critical'>('info');

  // Pesticide Compliance Log states
  const [pesticideState, setPesticideState] = useState('TX');
  const [pesticideFieldId, setPesticideFieldId] = useState('Sector 1');
  const [chemicalName, setChemicalName] = useState('');
  const [amountApplied, setAmountApplied] = useState('');
  const [areaTreated, setAreaTreated] = useState('');
  const [dynamicValues, setDynamicValues] = useState<Record<string, string>>({});

  // Favorites, Signature and Persistence states
  const [favorites, setFavorites] = useState<any[]>([]);
  const [favName, setFavName] = useState('');
  const [favEpa, setFavEpa] = useState('');
  const [favRei, setFavRei] = useState('');
  const [favPhi, setFavPhi] = useState('');
  const [isAddingFav, setIsAddingFav] = useState(false);
  const [certifiedApplicatorName, setCertifiedApplicatorName] = useState('');
  const [isCertifiedCheck, setIsCertifiedCheck] = useState(false);
  const [isStateModalVisible, setIsStateModalVisible] = useState(false);
  const [stateSearchQuery, setStateSearchQuery] = useState('');

  // Load selected state from AsyncStorage on mount
  useEffect(() => {
    async function loadSelectedState() {
      try {
        const savedState = await AsyncStorage.getItem('@farmconnect:selected_state');
        if (savedState) {
          setPesticideState(savedState);
        }
      } catch (err) {
        console.error('Failed to load selected state:', err);
      }
    }
    loadSelectedState();
  }, []);

  // Set pesticide state and persist to AsyncStorage
  const handleStateChange = async (st: string) => {
    setPesticideState(st);
    try {
      await AsyncStorage.setItem('@farmconnect:selected_state', st);
    } catch (err) {
      console.error('Failed to save selected state:', err);
    }
  };

  useEffect(() => {
    if (pendingAreaCalculation !== null) {
      setAreaTreated(String(pendingAreaCalculation));
    }
  }, [pendingAreaCalculation]);

  useEffect(() => {
    // Reset dynamic values when state is changed
    setDynamicValues({});
  }, [pesticideState]);

  // Media Share states
  const [selectedPhoto, setSelectedPhoto] = useState<MockPhoto | null>(null);
  const [customCaption, setCustomCaption] = useState('');
  const [shareStatus, setShareStatus] = useState('');
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);

  const mockPhotos: MockPhoto[] = [
    {
      id: '1',
      title: 'Wildflower Honey Harvest',
      emoji: '🍯',
      caption: 'Fresh wildflower honey straight from our hives today! 🐝 100% raw, local, and packed with spring sweetness. Grab yours at our farm stand! #LocalHoney #OrganicBeekeeping #FarmFresh #BuyLocal'
    },
    {
      id: '2',
      title: 'Organic Microgreens',
      emoji: '🥬',
      caption: 'Morning harvest of nutrient-rich microgreens! 🌿 Crispy, vibrant, and ready to elevate your fresh salads. Harvested daily. #Microgreens #OrganicFarming #EatClean #FarmToTable'
    },
    {
      id: '3',
      title: 'Sunrise Crop Rotation',
      emoji: '🚜',
      caption: 'Sun rising over the south orchard as we prepare the soil bed. ☀️ Healthy soil equals healthy food. #RegenerativeAg #SunriseFarming #AppleOrchard #SustainableAgriculture'
    }
  ];

  // Load local database data
  useEffect(() => {
    async function loadData() {
      const database = db;
      if (!database) return;
      try {
        // 1. Fetch active tasks
        const localTasks = await database.getAllAsync(
          'SELECT * FROM tasks WHERE is_deleted = 0 ORDER BY created_at DESC;'
        );
        setTasks(localTasks);

        // 2. Fetch last 3 messages for the communications area
        const localMessages = await database.getAllAsync(
          'SELECT * FROM messages WHERE is_deleted = 0 ORDER BY created_at DESC LIMIT 3;'
        );
        setMessages(localMessages.reverse());

        // 3. Fetch active observations
        const localObs = await database.getAllAsync(
          'SELECT * FROM observations WHERE is_deleted = 0 ORDER BY created_at DESC;'
        );
        setObservations(localObs);

        // 3b. Fetch active chemical reports (pesticide logs)
        const localReports = await database.getAllAsync(
          'SELECT * FROM chemical_reports WHERE is_deleted = 0 ORDER BY created_at DESC;'
        );
        setChemicalReports(localReports);

        // 3c. Fetch local pesticide inventory favorites
        const localFavs = await database.getAllAsync(
          'SELECT * FROM pesticide_inventory ORDER BY chemical_name ASC;'
        );
        setFavorites(localFavs);

        // 4. Fetch conflicts
        const conflictedTasks = await database.getAllAsync("SELECT * FROM tasks WHERE sync_state = 'conflict';");
        const conflictedLogs = await database.getAllAsync("SELECT * FROM maintenance_logs WHERE sync_state = 'conflict';");
        const conflictedReports = await database.getAllAsync("SELECT * FROM chemical_reports WHERE sync_state = 'conflict';");
        const conflictedObs = await database.getAllAsync("SELECT * FROM observations WHERE sync_state = 'conflict';");

        const allConflicts = [
          ...conflictedTasks.map((t: any) => ({ ...t, type: 'Task', table: 'tasks' as const })),
          ...conflictedLogs.map((l: any) => ({ ...l, type: 'Maintenance Log', table: 'maintenance_logs' as const })),
          ...conflictedReports.map((r: any) => ({ ...r, type: 'Chemical Report', table: 'chemical_reports' as const })),
          ...conflictedObs.map((o: any) => ({ ...o, type: 'Observation', table: 'observations' as const }))
        ];
        setConflicts(allConflicts);
      } catch (err) {
        console.error('Error loading data:', err);
      }
    }

    loadData();
  }, [db, refreshCount, syncStatus]);

  // Handle adding task locally
  const handleAddTask = async () => {
    if (!db || !taskTitle.trim()) return;
    const taskId = uuidv4();
    const timestamp = new Date().toISOString();
    const newTask = {
      id: taskId,
      title: taskTitle.trim(),
      description: 'Quick task created from Dashboard',
      assignee_id: 'Farm Crew',
      status: 'pending',
      created_at: timestamp,
      updated_at: timestamp,
      sync_state: 'dirty',
      is_deleted: 0
    };
    try {
      await writeMutation(db, 'tasks', taskId, 'INSERT', newTask);
      setTaskTitle('');
      setRefreshCount(prev => prev + 1);
    } catch (err) {
      console.error(err);
    }
  };

  // Handle soft-deleting task
  const handleDeleteTask = async (id: string) => {
    if (!db) return;
    try {
      await writeMutation(db, 'tasks', id, 'DELETE', { id });
      setRefreshCount(prev => prev + 1);
    } catch (err) {
      console.error(err);
    }
  };

  // Handle adding observation
  const handleAddObservation = async () => {
    if (!db || !obsNotes.trim()) return;
    const obsId = uuidv4();
    const timestamp = new Date().toISOString();
    const newObs = {
      id: obsId,
      field_id: obsSector,
      notes: obsNotes.trim(),
      observed_by: 'Operator B',
      severity: obsSeverity,
      created_at: timestamp,
      updated_at: timestamp,
      sync_state: 'dirty',
      is_deleted: 0
    };
    try {
      await writeMutation(db, 'observations', obsId, 'INSERT', newObs);
      setObsNotes('');
      setRefreshCount(prev => prev + 1);
    } catch (err) {
      console.error(err);
    }
  };

  // Handle adding favorite to pesticide inventory
  const handleAddFavorite = async () => {
    if (!db || !favName.trim() || !favEpa.trim()) {
      alert(lang === 'en' ? 'Chemical name and EPA registration number are required.' : 'El nombre químico y el número de registro de la EPA son obligatorios.');
      return;
    }
    const id = uuidv4();
    const timestamp = new Date().toISOString();
    const rei = favRei.trim() ? parseInt(favRei, 10) : null;
    const phi = favPhi.trim() ? parseInt(favPhi, 10) : null;

    try {
      await db.runAsync(
        'INSERT OR REPLACE INTO pesticide_inventory (id, chemical_name, epa_reg_no, default_rei_hours, default_phi_days, created_at) VALUES (?, ?, ?, ?, ?, ?);',
        id, favName.trim(), favEpa.trim(), rei, phi, timestamp
      );
      setFavName('');
      setFavEpa('');
      setFavRei('');
      setFavPhi('');
      setIsAddingFav(false);
      setRefreshCount(prev => prev + 1);
    } catch (err) {
      console.error('Error adding favorite chemical:', err);
      alert('Error: ' + String(err));
    }
  };

  // Handle deleting favorite from pesticide inventory
  const handleDeleteFavorite = async (id: string) => {
    if (!db) return;
    try {
      await db.runAsync('DELETE FROM pesticide_inventory WHERE id = ?;', id);
      setRefreshCount(prev => prev + 1);
    } catch (err) {
      console.error('Error deleting favorite chemical:', err);
    }
  };

  // Validate a chemical report against state laws and return warning messages
  const getAuditWarnings = (report: any) => {
    const warnings: string[] = [];
    if (!report) return warnings;

    // Check custom state rules
    if (report.state === 'CA' && report.wind_speed !== null && report.wind_speed > 10) {
      warnings.push(lang === 'en' 
        ? 'CA Compliance limit: Wind speed must not exceed 10 mph.' 
        : 'Límite de conformidad de CA: la velocidad del viento no debe exceder las 10 mph.'
      );
    }
    if (report.state === 'NY' && report.temperature !== null && report.temperature > 90) {
      warnings.push(lang === 'en' 
        ? 'NY Compliance limit: Temperature must not exceed 90°F.' 
        : 'Límite de conformidad de NY: la temperatura no debe exceder los 90°F.'
      );
    }

    // Check required fields defined in pesticide state laws JSON
    const stateData = (statePesticideLaws as any)[report.state];
    if (stateData && stateData.fields) {
      let parsedDyn: Record<string, any> = {};
      try {
        parsedDyn = JSON.parse(report.dynamic_fields || '{}');
      } catch (e) {}

      stateData.fields.forEach((field: any) => {
        if (field.required) {
          // Check if value is in direct column or dynamic_fields
          const value = report[field.name] !== undefined && report[field.name] !== null
            ? String(report[field.name])
            : parsedDyn[field.name] !== undefined && parsedDyn[field.name] !== null
              ? String(parsedDyn[field.name])
              : '';

          if (!value.trim()) {
            warnings.push(lang === 'en'
              ? `Missing required field: ${field.label}`
              : `Falta campo obligatorio: ${field.label}`
            );
          }
        }
      });
    }

    return warnings;
  };

  // Handle adding chemical report locally
  const handleAddChemicalReport = async () => {
    if (!db) return;

    if (!chemicalName.trim()) {
      alert(lang === 'en' ? 'Chemical/Brand name is required.' : 'El nombre químico/marca es obligatorio.');
      return;
    }
    const amountVal = parseFloat(amountApplied);
    if (isNaN(amountVal) || amountVal <= 0) {
      alert(lang === 'en' ? 'Amount applied must be a positive number.' : 'La cantidad aplicada debe ser un número positivo.');
      return;
    }
    const areaVal = parseFloat(areaTreated);
    if (areaTreated.trim() && (isNaN(areaVal) || areaVal <= 0)) {
      alert(lang === 'en' ? 'Area treated must be a positive number.' : 'El área tratada debe ser un número positivo.');
      return;
    }

    // Enforce electronic signature
    if (!certifiedApplicatorName.trim() || !isCertifiedCheck) {
      alert(lang === 'en'
        ? 'Certified applicator printed name and certification check are required for electronic signature.'
        : 'Se requiere el nombre impreso del aplicador certificado y la confirmación de la certificación para la firma electrónica.'
      );
      return;
    }

    // Dynamic field validation
    const stateData = (statePesticideLaws as any)[pesticideState];
    if (stateData && stateData.fields) {
      for (const field of stateData.fields) {
        const val = dynamicValues[field.name] || '';

        // Required check
        if (field.required && !val.trim()) {
          alert(field.error_message || `Field "${field.label}" is required.`);
          return;
        }

        if (val.trim()) {
          // Type number validation
          if (field.type === 'number') {
            const num = parseFloat(val);
            if (isNaN(num)) {
              alert(`Field "${field.label}" must be a valid number.`);
              return;
            }
            if (field.min !== undefined && num < field.min) {
              alert(field.error_message || `Field "${field.label}" must be at least ${field.min}.`);
              return;
            }
            if (field.max !== undefined && num > field.max) {
              alert(field.error_message || `Field "${field.label}" must be at most ${field.max}.`);
              return;
            }
          }

          // Regex validation
          if (field.regex) {
            try {
              const rx = new RegExp(field.regex);
              if (!rx.test(val)) {
                alert(field.error_message || `Field "${field.label}" does not match the required format.`);
                return;
              }
            } catch (e) {
              console.error('Invalid regex validation pattern: ', field.regex);
            }
          }
        }
      }
    }

    const reportId = uuidv4();
    const timestamp = new Date().toISOString();

    // Encrypt sensitive dynamic fields for storage in dynamic_fields JSON
    const encryptedDynamicValues = { ...dynamicValues };
    if (encryptedDynamicValues.applicator_name) {
      encryptedDynamicValues.applicator_name = encryptField(encryptedDynamicValues.applicator_name, clientId);
    }
    if (encryptedDynamicValues.applicator_license) {
      encryptedDynamicValues.applicator_license = encryptField(encryptedDynamicValues.applicator_license, clientId);
    }

    const newReport: any = {
      id: reportId,
      field_id: pesticideFieldId,
      chemical_name: chemicalName.trim(),
      amount_applied: amountVal,
      state: pesticideState,
      dynamic_fields: JSON.stringify(encryptedDynamicValues),
      created_at: timestamp,
      updated_at: timestamp,
      sync_state: 'dirty',
      is_deleted: 0
    };

    const complianceColumns = [
      'epa_reg_no', 'applicator_name', 'applicator_license', 'area_treated',
      'crop_treated', 'target_pest', 'application_method', 'start_time',
      'end_time', 'wind_speed', 'wind_direction', 'temperature',
      'permit_number', 'county', 'rei_hours', 'phi_days'
    ];

    if (areaTreated.trim() && !isNaN(areaVal)) {
      newReport.area_treated = areaVal;
    } else {
      newReport.area_treated = null;
    }

    complianceColumns.forEach(col => {
      if (col === 'area_treated') return;

      if (dynamicValues[col] !== undefined) {
        let val: any = dynamicValues[col];
        if (col === 'wind_speed' || col === 'temperature') {
          val = parseFloat(val);
          if (isNaN(val)) val = null;
        } else if (col === 'rei_hours' || col === 'phi_days') {
          val = parseInt(val, 10);
          if (isNaN(val)) val = null;
        }
        newReport[col] = val;
      } else {
        newReport[col] = null;
      }
    });

    // Save signature
    if (!newReport.applicator_name && certifiedApplicatorName.trim()) {
      newReport.applicator_name = certifiedApplicatorName.trim();
    }
    newReport.applicator_signature = `Digitally Signed by ${certifiedApplicatorName.trim()} on ${timestamp} (Client ID: ${clientId})`;

    // Encrypt sensitive fields in newReport columns
    if (newReport.applicator_name) {
      newReport.applicator_name = encryptField(newReport.applicator_name, clientId);
    }
    if (newReport.applicator_license) {
      newReport.applicator_license = encryptField(newReport.applicator_license, clientId);
    }
    if (newReport.applicator_signature) {
      newReport.applicator_signature = encryptField(newReport.applicator_signature, clientId);
    }

    try {
      await writeMutation(db, 'chemical_reports', reportId, 'INSERT', newReport);
      setChemicalName('');
      setAmountApplied('');
      setAreaTreated('');
      setDynamicValues({});
      setCertifiedApplicatorName('');
      setIsCertifiedCheck(false);
      setPendingAreaCalculation(null);
      setRefreshCount(prev => prev + 1);
      alert(t.pesticideSuccess || 'Logged successfully');
    } catch (err) {
      console.error('Error logging chemical report:', err);
      alert('Error inserting pesticide report: ' + String(err));
    }
  };

  // Handle soft deleting chemical report
  const handleDeleteReport = async (id: string) => {
    if (!db) return;
    try {
      await writeMutation(db, 'chemical_reports', id, 'DELETE', { id });
      setRefreshCount(prev => prev + 1);
    } catch (err) {
      console.error('Error deleting report:', err);
    }
  };

  // Handle photo select for social sharing
  const handleSelectPhoto = (photo: MockPhoto) => {
    setSelectedPhoto(photo);
    setCustomCaption(photo.caption);
    setShareStatus('');
  };

  const handleCopyToClipboard = () => {
    if (!customCaption) return;
    Clipboard.setString(customCaption);
    setShareStatus('📋 Caption copied to clipboard! Ready to paste on Instagram.');
    setTimeout(() => setShareStatus(''), 4000);
  };

  const selectCustomImage = () => {
    if (Platform.OS === 'web') {
      try {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*';
        input.onchange = (e: any) => {
          const file = e.target.files?.[0];
          if (file) {
            const reader = new FileReader();
            reader.onload = () => {
              const base64Uri = reader.result as string;
              setUploadedImage(base64Uri);
              const mockPhoto: MockPhoto = {
                id: 'custom',
                title: file.name.split('.')[0] || 'Custom Photo',
                emoji: '📸',
                caption: `Checking in from the fields! 🚜 Harvesting ${file.name.split('.')[0] || 'crops'} today. Pure organic, fresh, and local! #OrganicFarming #HarvestDay #FarmFresh #LocalProduce`
              };
              setSelectedPhoto(mockPhoto);
              setCustomCaption(mockPhoto.caption);
              setShareStatus('');
            };
            reader.readAsDataURL(file);
          }
        };
        input.click();
      } catch (err: any) {
        console.error(err);
      }
    } else {
      // Native mock upload (using a beautiful free agriculture photo)
      const mockUri = 'https://images.unsplash.com/photo-1500937386664-56d1dfef3854?auto=format&fit=crop&w=600&q=80';
      setUploadedImage(mockUri);
      const mockPhoto: MockPhoto = {
        id: 'custom',
        title: 'Custom Field Photo',
        emoji: '📸',
        caption: 'Beautiful morning on the farm! 🚜 Fresh crops, fresh air, and organic soil. #FarmToTable #SustainableAg #FreshHarvest'
      };
      setSelectedPhoto(mockPhoto);
      setCustomCaption(mockPhoto.caption);
      setShareStatus('📸 Selected placeholder farm snapshot!');
      setTimeout(() => setShareStatus(''), 3000);
    }
  };

  const handleNativeShare = async () => {
    if (!customCaption) return;
    try {
      const result = await Share.share({
        message: customCaption,
      });
      if (result.action === Share.sharedAction) {
        setShareStatus('📤 Shared successfully!');
      }
    } catch (error: any) {
      setShareStatus('❌ Share failed: ' + error.message);
    }
    setTimeout(() => setShareStatus(''), 4000);
  };

  const exportToCsv = async (tableName: string) => {
    if (!db) return;
    try {
      const rows: any[] = await db.getAllAsync(`SELECT * FROM ${tableName} WHERE is_deleted = 0;`);
      if (rows.length === 0) {
        alert(lang === 'en' ? `No active records in ${tableName} to export.` : `No hay registros activos en ${tableName} para exportar.`);
        return;
      }

      let flattenedRows = rows;
      if (tableName === 'chemical_reports') {
        flattenedRows = rows.map(row => {
          const newRow = {
            ...row,
            applicator_name: decryptField(row.applicator_name, clientId),
            applicator_license: decryptField(row.applicator_license, clientId),
            applicator_signature: decryptField(row.applicator_signature, clientId)
          };
          if (newRow.dynamic_fields) {
            try {
              const parsed = JSON.parse(newRow.dynamic_fields);
              if (parsed && typeof parsed === 'object') {
                Object.keys(parsed).forEach(k => {
                  if (typeof parsed[k] === 'string' && parsed[k].startsWith('enc:')) {
                    parsed[k] = decryptField(parsed[k], clientId);
                  }
                });
                Object.assign(newRow, parsed);
              }
            } catch (e) {
              console.error('Error parsing dynamic_fields:', e);
            }
          }
          delete newRow.dynamic_fields;
          return newRow;
        });
      }

      const allKeys = new Set<string>();
      flattenedRows.forEach(row => {
        Object.keys(row).forEach(key => allKeys.add(key));
      });
      const headersArray = Array.from(allKeys);
      const headers = headersArray.join(',');

      const csvContent = flattenedRows.map(row => 
        headersArray.map(key => {
          const val = row[key];
          return `"${String(val ?? '').replace(/"/g, '""')}"`;
        }).join(',')
      ).join('\n');
      const csvString = `${headers}\n${csvContent}`;

      if (Platform.OS === 'web') {
        const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.setAttribute('href', url);
        link.setAttribute('download', `farm_${tableName}_export.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      } else {
        await Share.share({
          message: csvString,
          title: `Farm ${tableName} Export`
        });
      }
      setShareStatus(t.dataExportSuccess);
      setTimeout(() => setShareStatus(''), 3000);
    } catch (err) {
      console.error(err);
      alert('Export failed: ' + String(err));
    }
  };

  // Handle conflict resolution
  const handleResolveConflict = async (table: any, id: string, resolution: any, remotePayload?: any) => {
    if (!db) return;
    try {
      await resolveConflict(db, table, id, resolution, remotePayload);
      setRefreshCount(prev => prev + 1);
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      
      {/* HEADER: Connection & Network Status */}
      <View style={styles.header}>
        <View>
          <Text style={styles.appTitle}>{t.dashboardTitle}</Text>
          <Text style={styles.appSubtitle}>{t.dashboardSubtitle}</Text>
          
          {/* Quick Language Toggle Row */}
          <View style={styles.langToggleRow}>
            <TouchableOpacity onPress={() => changeLanguage('en')} style={[styles.langToggleBtn, lang === 'en' && styles.langToggleBtnActive]}>
              <Text style={styles.langToggleText}>🇺🇸 EN</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => changeLanguage('es')} style={[styles.langToggleBtn, lang === 'es' && styles.langToggleBtnActive]}>
              <Text style={styles.langToggleText}>🇪🇸 ES</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => changeLanguage('pt')} style={[styles.langToggleBtn, lang === 'pt' && styles.langToggleBtnActive]}>
              <Text style={styles.langToggleText}>🇧🇷 PT</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => changeLanguage('fr')} style={[styles.langToggleBtn, lang === 'fr' && styles.langToggleBtnActive]}>
              <Text style={styles.langToggleText}>🇫🇷 FR</Text>
            </TouchableOpacity>
          </View>
        </View>
        <TouchableOpacity
          style={[styles.syncButton, isSyncing && styles.syncDisabled]}
          onPress={syncNow}
          disabled={isSyncing}
        >
          {isSyncing ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <Text style={styles.syncButtonText}>{t.syncBtn}</Text>
          )}
        </TouchableOpacity>
      </View>

      {/* Network Status bar */}
      <View style={styles.statusBar}>
        <Text style={styles.statusLabel}>
          {t.statusLabel}<Text style={styles.statusValue}>{syncStatus}</Text>
        </Text>
        <Text style={styles.statusPeers}>
          {isOnline ? `🟢 ${t.online}` : `📡 ${t.mesh} (${activePeers.length} ${t.active})`}
        </Text>
      </View>

      {/* Conflicts section */}
      {conflicts.length > 0 && (
        <View style={styles.conflictCard}>
          <Text style={styles.conflictTitle}>{t.conflictsTitle} ({conflicts.length})</Text>
          {conflicts.map(item => (
            <View key={item.id} style={styles.conflictItem}>
              <Text style={styles.conflictText}>
                {item.type}: {item.title || item.notes || 'Record update'}
              </Text>
              <View style={styles.conflictActions}>
                <TouchableOpacity
                  style={styles.conflictButtonLocal}
                  onPress={() => handleResolveConflict(item.table, item.id, 'keep_local')}
                >
                  <Text style={styles.conflictButtonText}>{t.keepLocal}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.conflictButtonRemote}
                  onPress={() => handleResolveConflict(item.table, item.id, 'keep_remote', item)}
                >
                  <Text style={styles.conflictButtonText}>{t.acceptServer}</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))}
        </View>
      )}

      {/* 1. COMMUNICATIONS AREA */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>{t.commTitle}</Text>
        <Text style={styles.cardDesc}>{t.commDesc}</Text>
        
        {messages.length === 0 ? (
          <Text style={styles.emptyText}>{t.commEmpty}</Text>
        ) : (
          messages.map(msg => (
            <View key={msg.id} style={styles.msgWidget}>
              <Text style={styles.msgSender}>{msg.sender_id}:</Text>
              <Text style={styles.msgContent} numberOfLines={1}>{msg.content}</Text>
            </View>
          ))
        )}
      </View>

      {/* 2. TO-DO AREA */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>{t.todoTitle}</Text>
        
        <View style={styles.quickAddRow}>
          <TextInput
            style={styles.input}
            placeholder={t.todoPlaceholder}
            placeholderTextColor="#8C9B90"
            value={taskTitle}
            onChangeText={setTaskTitle}
          />
          <TouchableOpacity style={styles.addButton} onPress={handleAddTask}>
            <Text style={styles.addButtonText}>{t.todoAdd}</Text>
          </TouchableOpacity>
        </View>

        {tasks.length === 0 ? (
          <Text style={styles.emptyText}>{t.todoEmpty}</Text>
        ) : (
          tasks.map(task => (
            <View key={task.id} style={styles.taskRow}>
              <View style={styles.taskTextColumn}>
                <Text style={styles.taskText}>{task.title}</Text>
                <Text style={styles.taskMeta}>
                  Assignee: {task.assignee_id} | {task.sync_state === 'clean' ? t.todoSynced : t.todoPending}
                </Text>
              </View>
              <TouchableOpacity
                style={styles.completeButton}
                onPress={() => handleDeleteTask(task.id)}
              >
                <Text style={styles.completeButtonText}>{t.todoComplete}</Text>
              </TouchableOpacity>
            </View>
          ))
        )}
      </View>

      {/* 3. OBSERVATIONS AREA */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>{t.obsTitle}</Text>
        
        {/* Quick log Observation form */}
        <View style={styles.obsForm}>
          <TextInput
            style={styles.input}
            placeholder={t.obsPlaceholder}
            placeholderTextColor="#8C9B90"
            value={obsNotes}
            onChangeText={setObsNotes}
          />
          <View style={styles.obsSelectorRow}>
            <TouchableOpacity
              style={[styles.secChip, obsSector === 'Sector 1' && styles.secChipSelected]}
              onPress={() => setObsSector('Sector 1')}
            >
              <Text style={styles.chipText}>{t.obsSec} 1</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.secChip, obsSector === 'Sector 2' && styles.secChipSelected]}
              onPress={() => setObsSector('Sector 2')}
            >
              <Text style={styles.chipText}>{t.obsSec} 2</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.secChip, obsSector === 'Sector 4' && styles.secChipSelected]}
              onPress={() => setObsSector('Sector 4')}
            >
              <Text style={styles.chipText}>{t.obsSec} 4</Text>
            </TouchableOpacity>

            <View style={styles.divider} />

            <TouchableOpacity
              style={[styles.sevChip, styles.sevInfo, obsSeverity === 'info' && styles.sevInfoSelected]}
              onPress={() => setObsSeverity('info')}
            >
              <Text style={styles.chipText}>{t.obsInfo}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.sevChip, styles.sevWarning, obsSeverity === 'warning' && styles.sevWarningSelected]}
              onPress={() => setObsSeverity('warning')}
            >
              <Text style={styles.chipText}>{t.obsWarn}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.sevChip, styles.sevCritical, obsSeverity === 'critical' && styles.sevCriticalSelected]}
              onPress={() => setObsSeverity('critical')}
            >
              <Text style={styles.chipText}>{t.obsCrit}</Text>
            </TouchableOpacity>
          </View>
          <TouchableOpacity style={styles.logButton} onPress={handleAddObservation}>
            <Text style={styles.logButtonText}>{t.obsLogBtn}</Text>
          </TouchableOpacity>
        </View>

        {observations.length === 0 ? (
          <Text style={styles.emptyText}>{t.obsEmpty}</Text>
        ) : (
          observations.map(obs => {
            const severityEmoji = obs.severity === 'critical' ? '🔴' : obs.severity === 'warning' ? '🟡' : '🔵';
            return (
              <View key={obs.id} style={styles.obsRow}>
                <Text style={styles.obsEmoji}>{severityEmoji}</Text>
                <View style={styles.obsTextColumn}>
                  <Text style={styles.obsNotes}>{obs.notes}</Text>
                  <Text style={styles.obsMeta}>
                    {obs.field_id} | By: {obs.observed_by} | {obs.sync_state === 'clean' ? t.obsSynced : t.obsLocal}
                  </Text>
                </View>
              </View>
            );
          })
        )}
      </View>

      {/* PESTICIDE COMPLIANCE LOGS */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>{t.pesticideTitle}</Text>
        <Text style={styles.cardDesc}>{t.pesticideDesc}</Text>

        <View style={styles.pesticideForm}>
          <Text style={styles.pesticideLabel}>{t.pesticideSelectState}</Text>
          <TouchableOpacity 
            style={styles.stateSelectButton} 
            onPress={() => {
              setStateSearchQuery('');
              setIsStateModalVisible(true);
            }}
          >
            <Text style={styles.stateSelectButtonText}>
              🇺🇸 {pesticideState} — {(statePesticideLaws as any)[pesticideState]?.agency || 'Select State'} ▼
            </Text>
          </TouchableOpacity>

          {isStateModalVisible && (
            <View style={styles.stateModalOverlay}>
              <View style={styles.stateModalContent}>
                <View style={styles.stateModalHeader}>
                  <Text style={styles.stateModalTitle}>Select State/Region</Text>
                  <TouchableOpacity onPress={() => setIsStateModalVisible(false)} style={styles.stateModalCloseBtn}>
                    <Text style={styles.stateModalCloseText}>✕</Text>
                  </TouchableOpacity>
                </View>
                
                <TextInput
                  style={styles.stateSearchInput}
                  placeholder={lang === 'en' ? "Search state code or agency name..." : "Buscar código de estado o agencia..."}
                  placeholderTextColor="#8C9B90"
                  value={stateSearchQuery}
                  onChangeText={setStateSearchQuery}
                />

                <ScrollView style={styles.stateModalScroll} nestedScrollEnabled={true}>
                  {Object.entries(statePesticideLaws)
                    .filter(([code, data]: [string, any]) => {
                      const query = stateSearchQuery.toLowerCase().trim();
                      if (!query) return true;
                      return code.toLowerCase().includes(query) || 
                             data.agency.toLowerCase().includes(query);
                    })
                    .map(([code, data]: [string, any]) => (
                      <TouchableOpacity
                        key={code}
                        style={[
                          styles.stateModalItem,
                          pesticideState === code && styles.stateModalItemActive
                        ]}
                        onPress={() => {
                          handleStateChange(code);
                          setIsStateModalVisible(false);
                        }}
                      >
                        <Text style={[styles.stateModalCode, pesticideState === code && styles.stateModalTextActive]}>
                          {code}
                        </Text>
                        <Text style={[styles.stateModalAgency, pesticideState === code && styles.stateModalTextActive]} numberOfLines={1}>
                          {data.agency}
                        </Text>
                      </TouchableOpacity>
                    ))}
                </ScrollView>
              </View>
            </View>
          )}

          {statePesticideLaws[pesticideState as keyof typeof statePesticideLaws] && (
            <View style={styles.agencyInfo}>
              <Text style={styles.agencyText}>
                <Text style={{ fontWeight: 'bold' }}>{t.pesticideAgency} </Text>
                {statePesticideLaws[pesticideState as keyof typeof statePesticideLaws].agency}
              </Text>
              <Text style={styles.agencyText}>
                <Text style={{ fontWeight: 'bold' }}>{t.pesticideCitation} </Text>
                {statePesticideLaws[pesticideState as keyof typeof statePesticideLaws].citation?.reference}
              </Text>
            </View>
          )}

          {/* Favorites Selector Block */}
          <View style={styles.favSection}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6, marginTop: 8 }}>
              <Text style={styles.pesticideLabel}>
                {lang === 'en' ? '⭐ Saved Favorites:' : '⭐ Favoritos Guardados:'}
              </Text>
              <TouchableOpacity onPress={() => setIsAddingFav(!isAddingFav)}>
                <Text style={{ fontSize: 12, color: '#2E7D32', fontWeight: 'bold' }}>
                  {isAddingFav 
                    ? (lang === 'en' ? 'Cancel' : 'Cancelar')
                    : (lang === 'en' ? '＋ Add New' : '＋ Añadir Nuevo')}
                </Text>
              </TouchableOpacity>
            </View>

            {isAddingFav && (
              <View style={styles.addFavForm}>
                <TextInput
                  style={styles.pesticideInput}
                  placeholder={lang === 'en' ? 'Product / Chemical Name' : 'Nombre del Producto / Químico'}
                  placeholderTextColor="#8C9B90"
                  value={favName}
                  onChangeText={setFavName}
                />
                <TextInput
                  style={styles.pesticideInput}
                  placeholder={lang === 'en' ? 'EPA Registration Number' : 'Número de Registro EPA'}
                  placeholderTextColor="#8C9B90"
                  value={favEpa}
                  onChangeText={setFavEpa}
                />
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <TextInput
                    style={[styles.pesticideInput, { flex: 1 }]}
                    placeholder={lang === 'en' ? 'REI (Hours)' : 'REI (Horas)'}
                    placeholderTextColor="#8C9B90"
                    value={favRei}
                    onChangeText={setFavRei}
                    keyboardType="numeric"
                  />
                  <TextInput
                    style={[styles.pesticideInput, { flex: 1 }]}
                    placeholder={lang === 'en' ? 'PHI (Days)' : 'PHI (Días)'}
                    placeholderTextColor="#8C9B90"
                    value={favPhi}
                    onChangeText={setFavPhi}
                    keyboardType="numeric"
                  />
                </View>
                <TouchableOpacity style={styles.favAddBtn} onPress={handleAddFavorite}>
                  <Text style={styles.favAddBtnText}>
                    {lang === 'en' ? 'Save Favorite Product' : 'Guardar Producto Favorito'}
                  </Text>
                </TouchableOpacity>
              </View>
            )}

            {favorites.length === 0 ? (
              <Text style={{ fontSize: 11, color: '#8C9B90', fontStyle: 'italic', marginBottom: 8, marginHorizontal: 4 }}>
                {lang === 'en' ? 'No favorites saved. Save products above for quick 1-tap entry.' : 'No hay favoritos guardados. Guarde productos arriba para acceso rápido.'}
              </Text>
            ) : (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexDirection: 'row', marginBottom: 10, paddingVertical: 4 }}>
                {favorites.map(fav => (
                  <TouchableOpacity
                    key={fav.id}
                    style={styles.favChip}
                    onPress={() => {
                      setChemicalName(fav.chemical_name);
                      // Pre-fill EPA Registration number, REI, PHI in dynamicValues
                      setDynamicValues(prev => ({
                        ...prev,
                        epa_reg_no: fav.epa_reg_no,
                        rei_hours: fav.default_rei_hours !== null && fav.default_rei_hours !== undefined ? String(fav.default_rei_hours) : (prev.rei_hours || ''),
                        phi_days: fav.default_phi_days !== null && fav.default_phi_days !== undefined ? String(fav.default_phi_days) : (prev.phi_days || '')
                      }));
                    }}
                    onLongPress={() => {
                      Alert.alert(
                        lang === 'en' ? 'Delete Favorite' : 'Eliminar Favorito',
                        lang === 'en' 
                          ? `Are you sure you want to delete "${fav.chemical_name}" from your favorites?`
                          : `¿Está seguro de que desea eliminar "${fav.chemical_name}" de sus favoritos?`,
                        [
                          { text: lang === 'en' ? 'Cancel' : 'Cancelar', style: 'cancel' },
                          { text: lang === 'en' ? 'Delete' : 'Eliminar', style: 'destructive', onPress: () => handleDeleteFavorite(fav.id) }
                        ]
                      );
                    }}
                  >
                    <Text style={styles.favChipText}>⭐ {fav.chemical_name}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}
          </View>

          <Text style={styles.pesticideLabel}>{t.pesticideFieldId}</Text>
          <View style={styles.fieldSelectorRow}>
            {['Sector 1', 'Sector 2', 'Sector 4'].map(fid => (
              <TouchableOpacity
                key={fid}
                style={[styles.secChip, pesticideFieldId === fid && styles.secChipSelected]}
                onPress={() => setPesticideFieldId(fid)}
              >
                <Text style={[styles.chipText, pesticideFieldId === fid && { color: '#fff' }]}>{fid}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <TextInput
            style={styles.pesticideInput}
            placeholder={t.pesticideChemName}
            placeholderTextColor="#8C9B90"
            value={chemicalName}
            onChangeText={setChemicalName}
          />

          <TextInput
            style={styles.pesticideInput}
            placeholder={t.pesticideAmount}
            placeholderTextColor="#8C9B90"
            value={amountApplied}
            onChangeText={setAmountApplied}
            keyboardType="numeric"
          />

          <TextInput
            style={styles.pesticideInput}
            placeholder={t.pesticideArea}
            placeholderTextColor="#8C9B90"
            value={areaTreated}
            onChangeText={setAreaTreated}
            keyboardType="numeric"
          />

          {pendingAreaCalculation !== null && (
            <Text style={{ fontSize: 11, color: '#E65100', marginHorizontal: 4, marginBottom: 8, fontStyle: 'italic' }}>
              💡 Pre-filled from map boundary drawing tool ({pendingAreaCalculation} Acres)
            </Text>
          )}

          {statePesticideLaws[pesticideState as keyof typeof statePesticideLaws]?.fields.map((field: any) => {
            if (field.type === 'select') {
              return (
                <View key={field.name} style={styles.dynamicFieldContainer}>
                  <Text style={styles.dynamicFieldLabel}>
                    {field.label}{field.required && ' *'}
                  </Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.optionSelectorScroll}>
                    {field.options?.map((opt: string) => (
                      <TouchableOpacity
                        key={opt}
                        style={[
                          styles.optionChip,
                          dynamicValues[field.name] === opt && styles.optionChipSelected
                        ]}
                        onPress={() => setDynamicValues(prev => ({ ...prev, [field.name]: opt }))}
                      >
                        <Text style={[
                          styles.optionChipText,
                          dynamicValues[field.name] === opt && styles.optionChipTextSelected
                        ]}>
                          {opt}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>
              );
            } else {
              return (
                <View key={field.name} style={styles.dynamicFieldContainer}>
                  <Text style={styles.dynamicFieldLabel}>
                    {field.label}{field.required && ' *'}
                  </Text>
                  <TextInput
                    style={styles.pesticideInput}
                    placeholder={field.label}
                    placeholderTextColor="#8C9B90"
                    value={dynamicValues[field.name] || ''}
                    onChangeText={(txt) => setDynamicValues(prev => ({ ...prev, [field.name]: txt }))}
                    keyboardType={field.type === 'number' ? 'numeric' : 'default'}
                  />
                  {field.error_message && (
                    <Text style={{ fontSize: 10, color: '#61746B', marginTop: 2, marginHorizontal: 4, fontStyle: 'italic' }}>
                      💡 {field.error_message}
                    </Text>
                  )}
                </View>
              );
            }
          })}

          {/* Electronic Signature Block */}
          <View style={styles.sigContainer}>
            <Text style={styles.pesticideLabel}>
              {lang === 'en' ? '✍️ Applicator Sign-off (Electronic Signature):' : '✍️ Firma del Aplicador (Firma Electrónica):'}
            </Text>
            <TextInput
              style={styles.pesticideInput}
              placeholder={lang === 'en' ? 'Type Full Legal Name' : 'Escriba Nombre Legal Completo'}
              placeholderTextColor="#8C9B90"
              value={certifiedApplicatorName}
              onChangeText={setCertifiedApplicatorName}
            />
            
            {certifiedApplicatorName.trim().length > 0 && (
              <View style={styles.sigPreviewBox}>
                <Text style={styles.sigPreviewLabel}>
                  {lang === 'en' ? 'Cursive Signature Preview:' : 'Vista Previa de la Firma:'}
                </Text>
                <Text style={styles.sigPreviewCursive}>{certifiedApplicatorName}</Text>
              </View>
            )}

            <TouchableOpacity 
              style={styles.checkboxRow}
              onPress={() => setIsCertifiedCheck(!isCertifiedCheck)}
            >
              <View style={[styles.checkbox, isCertifiedCheck && styles.checkboxChecked]}>
                {isCertifiedCheck && <Text style={styles.checkmark}>✓</Text>}
              </View>
              <Text style={styles.checkboxLabel}>
                {lang === 'en' 
                  ? 'I certify under penalty of law that this application was performed in accordance with label instructions.' 
                  : 'Certifico bajo pena de ley que esta aplicación se realizó de acuerdo con las instrucciones de la etiqueta.'}
              </Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity style={styles.logButton} onPress={handleAddChemicalReport}>
            <Text style={styles.logButtonText}>{t.pesticideLogBtn}</Text>
          </TouchableOpacity>
        </View>

        <View style={{ marginTop: 16 }}>
          {chemicalReports.length === 0 ? (
            <Text style={styles.emptyText}>{t.pesticideEmpty}</Text>
          ) : (
            chemicalReports.map(report => {
              const decryptedReport = {
                ...report,
                applicator_name: decryptField(report.applicator_name, clientId),
                applicator_license: decryptField(report.applicator_license, clientId),
                applicator_signature: decryptField(report.applicator_signature, clientId)
              };
              let parsedDyn: Record<string, any> = {};
              try {
                parsedDyn = JSON.parse(decryptedReport.dynamic_fields || '{}');
                // Decrypt any encrypted fields inside parsedDyn
                Object.keys(parsedDyn).forEach(k => {
                  if (typeof parsedDyn[k] === 'string' && parsedDyn[k].startsWith('enc:')) {
                    parsedDyn[k] = decryptField(parsedDyn[k], clientId);
                  }
                });
              } catch (e) {}

              // Calculate audit warnings
              const auditWarnings = getAuditWarnings(decryptedReport);

              return (
                <View key={decryptedReport.id} style={styles.reportRow}>
                  <View style={styles.reportTextColumn}>
                    <Text style={styles.reportTitleText}>
                      {decryptedReport.chemical_name} — {decryptedReport.amount_applied} gal ({decryptedReport.area_treated ? `${decryptedReport.area_treated} acres, ` : ''}{decryptedReport.state})
                    </Text>
                    <Text style={styles.reportMeta}>
                      Field: {decryptedReport.field_id} | {decryptedReport.sync_state === 'clean' ? t.pesticideSynced : t.pesticidePending}
                    </Text>

                    {decryptedReport.applicator_signature && (
                      <Text style={styles.signatureBadgeText}>
                        ✍️ {decryptedReport.applicator_signature}
                      </Text>
                    )}

                    {Object.keys(parsedDyn).length > 0 && (
                      <View style={styles.dynBadgeRow}>
                        {Object.entries(parsedDyn).map(([k, v]) => (
                          <View key={k} style={styles.dynBadge}>
                            <Text style={styles.dynBadgeText}>{k}: {String(v)}</Text>
                          </View>
                        ))}
                      </View>
                    )}

                    {/* Render Audit Warnings Badges */}
                    {auditWarnings.length > 0 && (
                      <View style={styles.auditWarningContainer}>
                        {auditWarnings.map((warn, i) => (
                          <View key={i} style={styles.auditWarningBadge}>
                            <Text style={styles.auditWarningText}>⚠️ {warn}</Text>
                          </View>
                        ))}
                      </View>
                    )}
                  </View>
                  <TouchableOpacity
                    style={styles.completeButton}
                    onPress={() => handleDeleteReport(decryptedReport.id)}
                  >
                    <Text style={styles.completeButtonText}>{t.pesticideCompleteBtn}</Text>
                  </TouchableOpacity>
                </View>
              );
            })
          )}
        </View>
      </View>

      {/* 4. SOCIAL MEDIA PHOTO SHARING GALLERY */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>{t.socialTitle}</Text>
        <Text style={styles.cardDesc}>{t.socialDesc}</Text>
        
        {/* Photo Gallery Grid */}
        <View style={styles.galleryRow}>
          {mockPhotos.map(photo => (
            <TouchableOpacity
              key={photo.id}
              style={[
                styles.galleryItem,
                selectedPhoto?.id === photo.id && styles.galleryItemSelected
              ]}
              onPress={() => handleSelectPhoto(photo)}
            >
              <Text style={styles.galleryEmoji}>{photo.emoji}</Text>
              <Text style={styles.galleryItemText} numberOfLines={1}>{photo.title}</Text>
            </TouchableOpacity>
          ))}
          
          <TouchableOpacity
            style={[
              styles.galleryItem,
              styles.uploadItem,
              selectedPhoto?.id === 'custom' && styles.galleryItemSelected
            ]}
            onPress={selectCustomImage}
          >
            <Text style={styles.galleryEmoji}>➕</Text>
            <Text style={styles.galleryItemText} numberOfLines={1}>{t.socialUploadBtn}</Text>
          </TouchableOpacity>
        </View>

        {selectedPhoto && (
          <View style={styles.shareBox}>
            <View style={styles.selectedHeader}>
              <Text style={styles.selectedText}>{selectedPhoto.emoji} {selectedPhoto.title}</Text>
            </View>

            {/* Image Preview */}
            {selectedPhoto.id === 'custom' && uploadedImage ? (
              <Image source={{ uri: uploadedImage }} style={styles.previewImage} />
            ) : (
              <View style={styles.previewPlaceholder}>
                <Text style={styles.previewPlaceholderEmoji}>{selectedPhoto.emoji}</Text>
                <Text style={styles.previewPlaceholderText}>{t.socialEmpty}</Text>
              </View>
            )}
            
            <TextInput
              style={styles.captionInput}
              multiline
              numberOfLines={4}
              value={customCaption}
              onChangeText={setCustomCaption}
            />

            <View style={styles.shareActionRow}>
              <TouchableOpacity style={[styles.shareButton, styles.copyBtn]} onPress={handleCopyToClipboard}>
                <Text style={styles.shareButtonText}>{t.socialCopy}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.shareButton, styles.shareBtn]} onPress={handleNativeShare}>
                <Text style={styles.shareButtonText}>{t.socialShare}</Text>
              </TouchableOpacity>
            </View>

            {shareStatus ? (
              <Text style={styles.shareStatusText}>{shareStatus}</Text>
            ) : null}
          </View>
        )}
      </View>
      {/* 5. DATA OWNERSHIP & PORTABILITY */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>{t.dataTitle}</Text>
        <Text style={styles.cardDesc}>{t.dataDesc}</Text>
        <View style={styles.exportActionRow}>
          <TouchableOpacity style={styles.exportButton} onPress={() => exportToCsv('tasks')}>
            <Text style={styles.exportButtonText}>📋 Tasks</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.exportButton} onPress={() => exportToCsv('messages')}>
            <Text style={styles.exportButtonText}>💬 Chats</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.exportButton} onPress={() => exportToCsv('observations')}>
            <Text style={styles.exportButtonText}>🔍 Obs</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.exportButton} onPress={() => exportToCsv('chemical_reports')}>
            <Text style={styles.exportButtonText}>📝 Pesticide Logs</Text>
          </TouchableOpacity>
        </View>
        {shareStatus && shareStatus.includes('CSV') ? (
          <Text style={styles.shareStatusText}>{shareStatus}</Text>
        ) : null}
      </View>

    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F7F6' // Crisp, light sage off-white background
  },
  content: {
    padding: 16
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    marginTop: 8
  },
  appTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#1B4322' // Rich Forest Green
  },
  appSubtitle: {
    fontSize: 12,
    color: '#61746B',
    marginTop: 2
  },
  syncButton: {
    backgroundColor: '#2E7D32',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20
  },
  syncDisabled: {
    backgroundColor: '#8C9B90'
  },
  syncButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 13
  },
  statusBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: '#E1E7E3', // Sage green border/divider tint
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    marginBottom: 16
  },
  statusLabel: {
    color: '#435449',
    fontSize: 11
  },
  statusValue: {
    fontWeight: 'bold'
  },
  statusPeers: {
    color: '#1B4322',
    fontWeight: 'bold',
    fontSize: 11
  },
  card: {
    backgroundColor: '#FFFFFF', // Clean White Cards
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E1E7E3',
    shadowColor: '#1B4322',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3
  },
  cardTitle: {
    color: '#1B4322',
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 6
  },
  cardDesc: {
    fontSize: 12,
    color: '#61746B',
    marginBottom: 12
  },
  emptyText: {
    color: '#8C9B90',
    textAlign: 'center',
    marginVertical: 8,
    fontSize: 13
  },
  input: {
    backgroundColor: '#F5F7F6',
    color: '#2E3A31',
    borderWidth: 1,
    borderColor: '#E1E7E3',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 14,
    flex: 1
  },
  // Communication Area widgets
  msgWidget: {
    flexDirection: 'row',
    backgroundColor: '#F5F7F6',
    padding: 8,
    borderRadius: 6,
    marginBottom: 6,
    borderLeftWidth: 3,
    borderLeftColor: '#2E7D32'
  },
  msgSender: {
    fontWeight: 'bold',
    color: '#1B4322',
    marginRight: 6,
    fontSize: 13
  },
  msgContent: {
    color: '#2E3A31',
    flex: 1,
    fontSize: 13
  },
  // To-Do Area styles
  quickAddRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12
  },
  addButton: {
    backgroundColor: '#2E7D32',
    paddingHorizontal: 16,
    borderRadius: 8,
    justifyContent: 'center'
  },
  addButtonText: {
    color: '#fff',
    fontWeight: 'bold'
  },
  taskRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F3F1'
  },
  taskTextColumn: {
    flex: 1,
    marginRight: 10
  },
  taskText: {
    fontSize: 14,
    color: '#2E3A31',
    fontWeight: '500'
  },
  taskMeta: {
    fontSize: 11,
    color: '#8C9B90',
    marginTop: 2
  },
  completeButton: {
    borderWidth: 1,
    borderColor: '#E65100',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6
  },
  completeButtonText: {
    color: '#E65100',
    fontSize: 11,
    fontWeight: 'bold'
  },
  // Observations styles
  obsForm: {
    backgroundColor: '#F5F7F6',
    padding: 12,
    borderRadius: 8,
    marginBottom: 12
  },
  obsSelectorRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 10,
    alignItems: 'center'
  },
  secChip: {
    backgroundColor: '#E1E7E3',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6
  },
  secChipSelected: {
    backgroundColor: '#1B4322'
  },
  chipText: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#2E3A31'
  },
  sevChip: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1
  },
  sevInfo: { borderColor: '#1E88E5', backgroundColor: '#E3F2FD' },
  sevWarning: { borderColor: '#FFB300', backgroundColor: '#FFF8E1' },
  sevCritical: { borderColor: '#E53935', backgroundColor: '#FFEBEE' },
  sevInfoSelected: { backgroundColor: '#1E88E5' },
  sevWarningSelected: { backgroundColor: '#FFB300' },
  sevCriticalSelected: { backgroundColor: '#E53935' },
  divider: {
    width: 1,
    height: 16,
    backgroundColor: '#B5C2B9',
    marginHorizontal: 4
  },
  logButton: {
    backgroundColor: '#1B4322',
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 12
  },
  logButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold'
  },
  obsRow: {
    flexDirection: 'row',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F3F1'
  },
  obsEmoji: {
    fontSize: 16,
    marginRight: 10,
    marginTop: 2
  },
  obsTextColumn: {
    flex: 1
  },
  obsNotes: {
    color: '#2E3A31',
    fontSize: 14,
    fontWeight: '500'
  },
  obsMeta: {
    color: '#8C9B90',
    fontSize: 11,
    marginTop: 2
  },
  // Pic Sharing Gallery styles
  galleryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
    marginBottom: 12
  },
  galleryItem: {
    flex: 1,
    backgroundColor: '#F5F7F6',
    borderWidth: 1,
    borderColor: '#E1E7E3',
    borderRadius: 8,
    padding: 10,
    alignItems: 'center'
  },
  galleryItemSelected: {
    borderColor: '#2E7D32',
    backgroundColor: '#E8F5E9',
    borderWidth: 2
  },
  galleryEmoji: {
    fontSize: 28,
    marginBottom: 6
  },
  galleryItemText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#2E3A31'
  },
  shareBox: {
    backgroundColor: '#F5F7F6',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E1E7E3'
  },
  selectedHeader: {
    marginBottom: 8
  },
  selectedText: {
    fontWeight: 'bold',
    color: '#1B4322',
    fontSize: 14
  },
  captionInput: {
    backgroundColor: '#FFFFFF',
    color: '#2E3A31',
    borderWidth: 1,
    borderColor: '#E1E7E3',
    borderRadius: 8,
    padding: 10,
    fontSize: 13,
    height: 90,
    textAlignVertical: 'top',
    marginBottom: 10
  },
  shareButton: {
    backgroundColor: '#2E7D32',
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center'
  },
  shareButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 13
  },
  shareStatusText: {
    color: '#2E7D32',
    fontSize: 12,
    fontWeight: 'bold',
    textAlign: 'center',
    marginTop: 8
  },
  // Conflict pane
  conflictCard: {
    backgroundColor: '#FFF3E0',
    borderColor: '#FFE082',
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    marginBottom: 16
  },
  conflictTitle: {
    color: '#E65100',
    fontWeight: 'bold',
    fontSize: 14,
    marginBottom: 8
  },
  conflictItem: {
    backgroundColor: '#FFF',
    borderWidth: 1,
    borderColor: '#FFE082',
    padding: 8,
    borderRadius: 8,
    marginBottom: 6
  },
  conflictText: {
    fontSize: 12,
    color: '#5D4037',
    fontWeight: '600',
    marginBottom: 6
  },
  conflictActions: {
    flexDirection: 'row',
    gap: 8
  },
  conflictButtonLocal: {
    flex: 1,
    backgroundColor: '#E65100',
    paddingVertical: 6,
    borderRadius: 6,
    alignItems: 'center'
  },
  conflictButtonRemote: {
    flex: 1,
    backgroundColor: '#2E7D32',
    paddingVertical: 6,
    borderRadius: 6,
    alignItems: 'center'
  },
  conflictButtonText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: 'bold'
  },
  previewImage: {
    width: '100%',
    height: 180,
    borderRadius: 8,
    marginBottom: 10,
    resizeMode: 'cover'
  },
  previewPlaceholder: {
    width: '100%',
    height: 120,
    backgroundColor: '#E8F5E9',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#C8E6C9',
    borderStyle: 'dashed'
  },
  previewPlaceholderEmoji: {
    fontSize: 36,
    marginBottom: 4
  },
  previewPlaceholderText: {
    fontSize: 12,
    color: '#1B4322',
    fontWeight: '600'
  },
  shareActionRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
    marginBottom: 8
  },
  copyBtn: {
    flex: 1,
    backgroundColor: '#61746B'
  },
  shareBtn: {
    flex: 1,
    backgroundColor: '#2E7D32'
  },
  uploadItem: {
    backgroundColor: '#E8F5E9',
    borderColor: '#C8E6C9',
    borderStyle: 'dashed'
  },
  langToggleRow: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 6
  },
  langToggleBtn: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#E1E7E3',
    backgroundColor: '#FFFFFF'
  },
  langToggleBtnActive: {
    backgroundColor: '#E8F5E9',
    borderColor: '#2E7D32'
  },
  langToggleText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#2E3A31'
  },
  exportActionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 4
  },
  exportButton: {
    minWidth: '45%',
    flexGrow: 1,
    backgroundColor: '#F5F7F6',
    borderWidth: 1,
    borderColor: '#E1E7E3',
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center'
  },
  exportButtonText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#2E3A31'
  },
  // Pesticide Compliance Styles
  pesticideForm: {
    backgroundColor: '#F5F7F6',
    padding: 12,
    borderRadius: 8,
    marginBottom: 12
  },
  pesticideLabel: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#1B4322',
    marginTop: 8,
    marginBottom: 4
  },
  stateSelectorScroll: {
    flexDirection: 'row',
    marginBottom: 8
  },
  stateChip: {
    backgroundColor: '#E1E7E3',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 15,
    marginRight: 6
  },
  stateChipSelected: {
    backgroundColor: '#1B4322'
  },
  stateChipText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#2E3A31'
  },
  stateChipTextSelected: {
    color: '#FFFFFF'
  },
  agencyInfo: {
    backgroundColor: '#E8F5E9',
    borderColor: '#C8E6C9',
    borderWidth: 1,
    borderRadius: 8,
    padding: 10,
    marginVertical: 8
  },
  agencyText: {
    fontSize: 11,
    color: '#1B4322',
    lineHeight: 16
  },
  fieldSelectorRow: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 8
  },
  pesticideInput: {
    backgroundColor: '#FFFFFF',
    color: '#2E3A31',
    borderWidth: 1,
    borderColor: '#E1E7E3',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 14,
    marginVertical: 4
  },
  dynamicFieldContainer: {
    marginVertical: 6
  },
  dynamicFieldLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#435449',
    marginBottom: 4
  },
  optionSelectorScroll: {
    flexDirection: 'row',
    marginVertical: 4
  },
  optionChip: {
    backgroundColor: '#E1E7E3',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    marginRight: 6
  },
  optionChipSelected: {
    backgroundColor: '#2E7D32'
  },
  optionChipText: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#2E3A31'
  },
  optionChipTextSelected: {
    color: '#FFFFFF'
  },
  reportRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F3F1'
  },
  reportTextColumn: {
    flex: 1,
    marginRight: 10
  },
  reportTitleText: {
    fontSize: 14,
    color: '#2E3A31',
    fontWeight: '600'
  },
  reportMeta: {
    fontSize: 11,
    color: '#8C9B90',
    marginTop: 2
  },
  dynBadgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
    marginTop: 4
  },
  dynBadge: {
    backgroundColor: '#E1E7E3',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4
  },
  dynBadgeText: {
    fontSize: 10,
    color: '#435449'
  },
  favSection: {
    marginVertical: 8
  },
  addFavForm: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E1E7E3',
    borderRadius: 8,
    padding: 10,
    marginBottom: 8
  },
  favAddBtn: {
    backgroundColor: '#2E7D32',
    paddingVertical: 8,
    borderRadius: 6,
    alignItems: 'center',
    marginTop: 6
  },
  favAddBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: 'bold'
  },
  favChip: {
    backgroundColor: '#E8F5E9',
    borderColor: '#C8E6C9',
    borderWidth: 1,
    borderRadius: 15,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginRight: 6
  },
  favChipText: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#2E7D32'
  },
  sigContainer: {
    backgroundColor: '#FFFFFF',
    borderColor: '#E1E7E3',
    borderWidth: 1,
    borderRadius: 8,
    padding: 10,
    marginVertical: 8
  },
  sigPreviewBox: {
    backgroundColor: '#F9FBF9',
    borderWidth: 1,
    borderColor: '#C8E6C9',
    borderRadius: 6,
    padding: 10,
    marginVertical: 8
  },
  sigPreviewLabel: {
    fontSize: 10,
    color: '#61746B',
    marginBottom: 2
  },
  sigPreviewCursive: {
    fontSize: 22,
    fontFamily: Platform.OS === 'ios' ? 'Snell Roundhand' : 'cursive',
    color: '#1B4322',
    fontStyle: 'italic',
    paddingHorizontal: 10
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 6,
    gap: 8
  },
  checkbox: {
    width: 20,
    height: 20,
    borderWidth: 1,
    borderColor: '#B5C2B9',
    borderRadius: 4,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF'
  },
  checkboxChecked: {
    backgroundColor: '#2E7D32',
    borderColor: '#2E7D32'
  },
  checkmark: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 12
  },
  checkboxLabel: {
    flex: 1,
    fontSize: 11,
    color: '#435449',
    lineHeight: 15
  },
  signatureBadgeText: {
    fontSize: 11,
    fontStyle: 'italic',
    color: '#2E7D32',
    marginTop: 2
  },
  auditWarningContainer: {
    marginTop: 4,
    gap: 4
  },
  auditWarningBadge: {
    backgroundColor: '#FFEBEE',
    borderColor: '#FFCDD2',
    borderWidth: 1,
    borderRadius: 4,
    paddingHorizontal: 8,
    paddingVertical: 4
  },
  auditWarningText: {
    fontSize: 11,
    color: '#C62828',
    fontWeight: 'bold'
  },
  stateSelectButton: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E1E7E3',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    marginVertical: 6,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between'
  },
  stateSelectButtonText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#1B4322'
  },
  stateModalOverlay: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#B5C2B9',
    borderRadius: 12,
    padding: 12,
    marginVertical: 8,
    shadowColor: '#1B4322',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 3,
    maxHeight: 320
  },
  stateModalContent: {
    flex: 1
  },
  stateModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8
  },
  stateModalTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#1B4322'
  },
  stateModalCloseBtn: {
    padding: 4
  },
  stateModalCloseText: {
    fontSize: 16,
    color: '#61746B',
    fontWeight: 'bold'
  },
  stateSearchInput: {
    backgroundColor: '#F5F7F6',
    color: '#2E3A31',
    borderWidth: 1,
    borderColor: '#E1E7E3',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    fontSize: 13,
    marginBottom: 8
  },
  stateModalScroll: {
    maxHeight: 220
  },
  stateModalItem: {
    flexDirection: 'row',
    paddingVertical: 8,
    paddingHorizontal: 8,
    borderRadius: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#F5F7F6',
    alignItems: 'center',
    gap: 8
  },
  stateModalItemActive: {
    backgroundColor: '#E8F5E9'
  },
  stateModalCode: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#1B4322',
    width: 28
  },
  stateModalAgency: {
    fontSize: 12,
    color: '#435449',
    flex: 1
  },
  stateModalTextActive: {
    color: '#2E7D32',
    fontWeight: 'bold'
  }
});
