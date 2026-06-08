# Analysis: Pesticide Logging Dynamic Form Settings Integration

## Executive Summary
This analysis details the implementation plan for integrating a state-specific, dynamic pesticide logging interface into the client mobile application (`client-mobile-app/src/app/index.tsx`). By referencing `PROJECT.md` and the existing codebase, we propose extending the database layer (both SQLite client and SQLAlchemy/Pydantic server) and updating the React Native frontend to dynamically render required compliance fields on a per-state basis.

---

## 1. Compiled Law Database (`state_pesticide_laws.json`)
We must create `client-mobile-app/src/constants/state_pesticide_laws.json`. This JSON database maps US state abbreviations to their regulatory bodies, citations, and specific input requirements.

**Example Structure:**
```json
{
  "TX": {
    "agency": "Texas Department of Agriculture",
    "citation": "https://texasagriculture.gov",
    "fields": [
      { "name": "applicator_license", "label": "Applicator License Number", "type": "string", "required": true }
    ]
  },
  "CA": {
    "agency": "California Department of Pesticide Regulation",
    "citation": "https://cdpr.ca.gov",
    "fields": [
      { "name": "permit_number", "label": "Permit Number", "type": "string", "required": true },
      { "name": "rei_hours", "label": "REI Hours", "type": "number", "required": true, "min": 0 },
      { "name": "phi_days", "label": "PHI Days", "type": "number", "required": true, "min": 0 }
    ]
  },
  "WA": {
    "agency": "Washington State Department of Agriculture",
    "citation": "https://agr.wa.gov",
    "fields": [
      { "name": "license_number", "label": "License Number", "type": "string", "required": true },
      { "name": "wind_speed", "label": "Wind Speed (mph)", "type": "number", "required": false, "min": 0 }
    ]
  }
}
```

---

## 2. Database Layer Schema Extensions

### Client SQLite Schema (`client-mobile-app/src/database/db.ts`)
To support the dynamic attributes, we need to alter the schema of the `chemical_reports` table.
* **Proposed Schema Extension:**
  ```sql
  CREATE TABLE IF NOT EXISTS chemical_reports (
    id TEXT PRIMARY KEY NOT NULL,
    field_id TEXT NOT NULL,
    chemical_name TEXT NOT NULL,
    amount_applied REAL NOT NULL,
    state TEXT NOT NULL,
    dynamic_fields TEXT,  -- JSON string containing key-value pairs of dynamic attributes
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    synced_at TEXT,
    sync_state TEXT NOT NULL CHECK(sync_state IN ('clean', 'dirty', 'pending', 'conflict')) DEFAULT 'dirty',
    is_deleted INTEGER NOT NULL DEFAULT 0
  );
  ```
* **Migration Check:** Since the app may run on devices with existing databases, a migration try-catch block inside `initDatabase` is required:
  ```typescript
  try {
    await db.execAsync("ALTER TABLE chemical_reports ADD COLUMN state TEXT NOT NULL DEFAULT 'TX';");
    await db.execAsync("ALTER TABLE chemical_reports ADD COLUMN dynamic_fields TEXT;");
    console.log("Database Migration: Added 'state' and 'dynamic_fields' to 'chemical_reports'.");
  } catch (err) {
    // Columns already exist
  }
  ```

### Sync Server Schema (`synchronization-server/models.py`)
Extend SQLAlchemy schema for backend storage:
```python
class ChemicalReport(Base):
    __tablename__ = "chemical_reports"

    id = Column(String(36), primary_key=True, index=True)
    field_id = Column(String(36), nullable=False)
    chemical_name = Column(String(255), nullable=False)
    amount_applied = Column(Float, nullable=False)
    state = Column(String(10), nullable=False, default="TX")
    dynamic_fields = Column(Text, nullable=True)  # JSON-serialized string
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow)
    synced_at = Column(DateTime, default=datetime.utcnow)
    is_deleted = Column(Boolean, default=False)
```

### Sync Server Pydantic Schema (`synchronization-server/schemas.py`)
Add fields to client-server serialization schema:
```python
class ChemicalReportSchema(RecordBase):
    field_id: str
    chemical_name: str
    amount_applied: float
    state: str
    dynamic_fields: Optional[str] = None
    synced_at: Optional[datetime] = None

    class Config:
        orm_mode = True
```

---

## 3. UI layout Proposal (`client-mobile-app/src/app/index.tsx`)

### Location in Screen
We propose adding the **Pesticide Compliance Logs** card directly below the **Field Observations** card (Card 3), but before the **Social Media Photo Sharing Gallery** (Card 4). This preserves the logging workflow sequence.

### Layout Components & Interaction Flow
1. **Pesticide Compliance Card Container**: `<View style={styles.card}>`
2. **State Selector**: A horizontal scroll view of state buttons or a custom drop-down menu that lets the user select the state.
3. **Agency Disclaimer Label**: Displays the regulatory agency and website details based on the selected state laws.
4. **Form Section**:
   - **Field ID Selection**: A chip selector (Sector 1, Sector 2, Sector 4) matching the UI style of observations.
   - **Chemical Name Input**: Standard `<TextInput>` for typing the brand/compound.
   - **Amount Applied Input**: Numeric `<TextInput>` for volume.
   - **Dynamic Inputs Section**: Dynamically loops over the array of inputs for the chosen state from `state_pesticide_laws.json`. If type is `'number'`, it uses the numeric keyboard layout.
5. **Action Buttons**:
   - "Log Pesticide Report" button.
6. **Local Logs List**:
   - A list at the bottom of the card displaying already logged chemical reports from the database.
   - Shows state and dynamic fields (e.g. `[TX] Applicator License: LIC-9837`).
   - Sync badges showing "Synced" or "Offline Pending" to maintain standard optimistic UI state indicators.
   - Soft-delete button.

---

## 4. UI State Variables
Add the following state variables inside `HomeScreen()`:
```typescript
const [chemicalReports, setChemicalReports] = useState<any[]>([]);
const [selectedState, setSelectedState] = useState<string>('TX'); // Default state
const [chemName, setChemName] = useState('');
const [chemAmount, setChemAmount] = useState('');
const [chemSector, setChemSector] = useState('Sector 1');
const [dynamicFields, setDynamicFields] = useState<Record<string, string>>({});
const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
```

---

## 5. UI Translations (Addition to `UI_TRANSLATIONS`)

### English (`en`)
```javascript
pesticideTitle: "📝 Pesticide Compliance Logs",
pesticideDesc: "Log chemical applications locally. Compliance fields adjust dynamically based on selected state regulations:",
selectState: "Select State:",
chemNameLabel: "Chemical Name",
chemAmountLabel: "Amount Applied (Gallons)",
logPesticideBtn: "Log Pesticide Report Locally",
pestEmpty: "No chemical reports logged yet.",
pestSynced: "Synced",
pestLocal: "Local",
requiredField: "This field is required",
minValueError: "Value must be at least ",
invalidNumber: "Please enter a valid number",
validationHeader: "Validation Error",
validationSuccess: "Pesticide report saved successfully!",
exportPestBtn: "📝 Pesticide Logs"
```

### Spanish (`es`)
```javascript
pesticideTitle: "📝 Registro de Pesticidas",
pesticideDesc: "Registre la aplicación de químicos localmente. Los campos de cumplimiento se ajustan dinámicamente según el estado:",
selectState: "Seleccione Estado:",
chemNameLabel: "Nombre del Químico",
chemAmountLabel: "Cantidad Aplicada (Galones)",
logPesticideBtn: "Registrar Pesticida Localmente",
pestEmpty: "Aún no se han registrado informes químicos.",
pestSynced: "Sincronizado",
pestLocal: "Local",
requiredField: "Este campo es requerido",
minValueError: "El valor debe ser al menos ",
invalidNumber: "Ingrese un número válido",
validationHeader: "Error de Validación",
validationSuccess: "¡Informe de pesticida guardado con éxito!",
exportPestBtn: "📝 Pesticidas"
```

### Portuguese (`pt`)
```javascript
pesticideTitle: "📝 Registro de Pesticidas",
pesticideDesc: "Registre aplicações químicas localmente. Os campos de conformidade se ajustam dinamicamente por estado:",
selectState: "Selecione o Estado:",
chemNameLabel: "Nome do Produto Químico",
chemAmountLabel: "Quantidade Aplicada (Galões)",
logPesticideBtn: "Registrar Pesticida Localmente",
pestEmpty: "Nenhum relatório químico registrado ainda.",
pestSynced: "Sincronizado",
pestLocal: "Local",
requiredField: "Este campo é obrigatório",
minValueError: "O valor deve ser pelo menos ",
invalidNumber: "Insira um número válido",
validationHeader: "Erro de Validação",
validationSuccess: "Relatório de pesticida salvo com sucesso!",
exportPestBtn: "📝 Pesticidas"
```

### French (`fr`)
```javascript
pesticideTitle: "📝 Registre des Pesticides",
pesticideDesc: "Enregistrez les applications de produits chimiques localement. Les champs de conformité s'adaptent selon l'état :",
selectState: "Sélectionnez l'État :",
chemNameLabel: "Nom du Produit Chimique",
chemAmountLabel: "Quantité Appliquée (Gallons)",
logPesticideBtn: "Enregistrer le Rapport Localement",
pestEmpty: "Aucun rapport chimique enregistré.",
pestSynced: "Synchronisé",
pestLocal: "Local",
requiredField: "Ce champ est obligatoire",
minValueError: "La valeur doit être au moins ",
invalidNumber: "Veuillez entrer un nombre valide",
validationHeader: "Erreur de Validation",
validationSuccess: "Rapport de pesticide enregistré avec succès !",
exportPestBtn: "📝 Pesticides"
```

---

## 6. Integration Steps

### Step A: Initialize the State Laws Database
Create the `state_pesticide_laws.json` in `src/constants/` with the laws database defined in Section 1.

### Step B: SQLite Database Extensions
1. Modify schema configuration in `client-mobile-app/src/database/db.ts` to include `state` and `dynamic_fields` columns.
2. Implement schema update query logic (migration fallback checks) for local DB compatibility.

### Step C: Load Local Data on Screen Init
Extend the `useEffect` database load function in `index.tsx`:
```typescript
// Fetch chemical reports from database
const localReports = await db.getAllAsync(
  'SELECT * FROM chemical_reports WHERE is_deleted = 0 ORDER BY created_at DESC;'
);
setChemicalReports(localReports);
```

### Step D: Implement Dynamic Fields Validation & Saving
Add dynamic input handlers and form validation logic inside `index.tsx`:
```typescript
const handleAddPesticideReport = async () => {
  if (!db || !chemName.trim() || !chemAmount.trim()) return;

  const laws = require('../constants/state_pesticide_laws.json');
  const stateRule = laws[selectedState];
  let errors: Record<string, string> = {};

  // Validate dynamic fields
  if (stateRule && stateRule.fields) {
    for (const field of stateRule.fields) {
      const value = dynamicFields[field.name] || '';
      if (field.required && !value.trim()) {
        errors[field.name] = t.requiredField;
      }
      if (field.type === 'number' && value.trim()) {
        const num = Number(value);
        if (isNaN(num)) {
          errors[field.name] = t.invalidNumber;
        } else if (field.min !== undefined && num < field.min) {
          errors[field.name] = `${t.minValueError}${field.min}`;
        }
      }
    }
  }

  if (Object.keys(errors).length > 0) {
    setValidationErrors(errors);
    return;
  }

  // Create chemical report row data
  const reportId = `chem_${Math.random().toString(36).substring(2, 9)}`;
  const timestamp = new Date().toISOString();
  const newReport = {
    id: reportId,
    field_id: chemSector,
    chemical_name: chemName.trim(),
    amount_applied: parseFloat(chemAmount),
    state: selectedState,
    dynamic_fields: JSON.stringify(dynamicFields),
    created_at: timestamp,
    updated_at: timestamp,
    sync_state: 'dirty',
    is_deleted: 0
  };

  try {
    await writeMutation(db, 'chemical_reports', reportId, 'INSERT', newReport);
    // Reset inputs
    setChemName('');
    setChemAmount('');
    setDynamicFields({});
    setValidationErrors({});
    setRefreshCount(prev => prev + 1);
  } catch (err) {
    console.error("Failed to log pesticide report:", err);
  }
};
```

### Step E: Render Pesticide Form Card in JSX
Embed the UI card in the React components hierarchy:
```typescript
<View style={styles.card}>
  <Text style={styles.cardTitle}>{t.pesticideTitle}</Text>
  <Text style={styles.cardDesc}>{t.pesticideDesc}</Text>

  {/* State selection buttons */}
  <View style={styles.langToggleRow}>
    {['TX', 'CA', 'WA'].map(st => (
      <TouchableOpacity
        key={st}
        style={[styles.langToggleBtn, selectedState === st && styles.langToggleBtnActive]}
        onPress={() => {
          setSelectedState(st);
          setDynamicFields({});
          setValidationErrors({});
        }}
      >
        <Text style={styles.langToggleText}>{st}</Text>
      </TouchableOpacity>
    ))}
  </View>

  {/* Selected State Regulation Disclaimer */}
  {statePesticideLaws[selectedState] && (
    <View style={{ marginTop: 8, padding: 8, backgroundColor: '#E1E7E3', borderRadius: 6 }}>
      <Text style={{ fontSize: 11, fontWeight: 'bold', color: '#1B4322' }}>
        Compliance Agency: {statePesticideLaws[selectedState].agency}
      </Text>
      <Text style={{ fontSize: 10, color: '#61746B', textDecorationLine: 'underline' }}>
        {statePesticideLaws[selectedState].citation}
      </Text>
    </View>
  )}

  {/* Core Input Form */}
  <View style={[styles.obsForm, { marginTop: 12 }]}>
    {/* Sector select */}
    <View style={[styles.obsSelectorRow, { marginBottom: 8 }]}>
      {['Sector 1', 'Sector 2', 'Sector 4'].map(sec => (
        <TouchableOpacity
          key={sec}
          style={[styles.secChip, chemSector === sec && styles.secChipSelected]}
          onPress={() => setChemSector(sec)}
        >
          <Text style={styles.chipText}>{sec}</Text>
        </TouchableOpacity>
      ))}
    </View>

    <TextInput
      style={[styles.input, { marginBottom: 8 }]}
      placeholder={t.chemNameLabel}
      placeholderTextColor="#8C9B90"
      value={chemName}
      onChangeText={setChemName}
    />

    <TextInput
      style={[styles.input, { marginBottom: 8 }]}
      placeholder={t.chemAmountLabel}
      placeholderTextColor="#8C9B90"
      keyboardType="numeric"
      value={chemAmount}
      onChangeText={setChemAmount}
    />

    {/* Dynamic inputs rendering */}
    {statePesticideLaws[selectedState]?.fields.map((field: any) => (
      <View key={field.name} style={{ marginBottom: 8 }}>
        <TextInput
          style={[
            styles.input,
            validationErrors[field.name] ? { borderColor: '#E53935', borderWidth: 1 } : {}
          ]}
          placeholder={field.label + (field.required ? " *" : "")}
          placeholderTextColor="#8C9B90"
          keyboardType={field.type === 'number' ? 'numeric' : 'default'}
          value={dynamicFields[field.name] || ''}
          onChangeText={text => {
            setDynamicFields(prev => ({ ...prev, [field.name]: text }));
            setValidationErrors(prev => {
              const copy = { ...prev };
              delete copy[field.name];
              return copy;
            });
          }}
        />
        {validationErrors[field.name] && (
          <Text style={{ fontSize: 10, color: '#E53935', marginLeft: 4 }}>
            {validationErrors[field.name]}
          </Text>
        )}
      </View>
    ))}

    <TouchableOpacity style={styles.logButton} onPress={handleAddPesticideReport}>
      <Text style={styles.logButtonText}>{t.logPesticideBtn}</Text>
    </TouchableOpacity>
  </View>

  {/* Display Chemical Reports List */}
  {chemicalReports.length === 0 ? (
    <Text style={styles.emptyText}>{t.pestEmpty}</Text>
  ) : (
    chemicalReports.map(rep => {
      let dynValues = "";
      try {
        const parsed = JSON.parse(rep.dynamic_fields || '{}');
        dynValues = Object.entries(parsed)
          .map(([k, v]) => `${k}: ${v}`)
          .join(', ');
      } catch (e) {}
      
      return (
        <View key={rep.id} style={styles.obsRow}>
          <Text style={styles.obsEmoji}>🧪</Text>
          <View style={styles.obsTextColumn}>
            <Text style={styles.obsNotes}>
              {rep.chemical_name} - {rep.amount_applied} gal
            </Text>
            <Text style={styles.obsMeta}>
              State: {rep.state} {dynValues ? `(${dynValues})` : ""} | {rep.field_id} | {rep.sync_state === 'clean' ? t.pestSynced : t.pestLocal}
            </Text>
          </View>
          <TouchableOpacity
            style={styles.completeButton}
            onPress={async () => {
              await writeMutation(db, 'chemical_reports', rep.id, 'DELETE', { id: rep.id });
              setRefreshCount(prev => prev + 1);
            }}
          >
            <Text style={styles.completeButtonText}>{t.todoComplete}</Text>
          </TouchableOpacity>
        </View>
      );
    })
  )}
</View>
```

### Step F: Export Chemical Reports to Compliance CSV format
Extend the existing `exportToCsv` function in `client-mobile-app/src/app/index.tsx` to handle the dynamic state-specific properties of pesticide logs.

1. Add a button in the Data Ownership section:
   ```typescript
   <TouchableOpacity style={styles.exportButton} onPress={() => exportToCsv('chemical_reports')}>
     <Text style={styles.exportButtonText}>{t.exportPestBtn}</Text>
   </TouchableOpacity>
   ```
2. Adapt the serialization logic inside `exportToCsv` for `chemical_reports`:
   ```typescript
   if (tableName === 'chemical_reports') {
     // Retrieve active records
     const rows: any[] = await db.getAllAsync(`SELECT * FROM chemical_reports WHERE is_deleted = 0;`);
     if (rows.length === 0) {
       alert(lang === 'en' ? `No active records to export.` : `No hay registros para exportar.`);
       return;
     }

     // Parse dynamic fields keys to establish unique columns across all records
     const parsedRows = rows.map(r => {
       let parsedDyn: Record<string, any> = {};
       try {
         parsedDyn = JSON.parse(r.dynamic_fields || '{}');
       } catch (err) {}
       return { ...r, ...parsedDyn };
     });

     // Collect all dynamic keys present in the data
     const allKeys = new Set<string>();
     parsedRows.forEach(row => {
       Object.keys(row).forEach(k => {
         if (k !== 'dynamic_fields') allKeys.add(k);
       });
     });
     const headersList = Array.from(allKeys);
     const headers = headersList.join(',');

     const csvContent = parsedRows.map(row => 
       headersList.map(header => `"${String(row[header] ?? '').replace(/"/g, '""')}"`).join(',')
     ).join('\n');
     
     const csvString = `${headers}\n${csvContent}`;
     // ... execute Web or Native download/share mechanisms ...
   }
   ```
