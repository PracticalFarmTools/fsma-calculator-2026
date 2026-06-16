/* app.js - FSMA Exemption Calculator Client Logic */

// Offline Fallback Thresholds in case thresholds.json cannot be fetched
const FALLBACK_THRESHOLDS = {
  "last_updated": "2026-06-10",
  "assessment_years": {
    "2026": {
      "produce_threshold": 34324,
      "total_food_threshold": 686476,
      "years_used": [2023, 2024, 2025]
    }
  }
};

let activeThresholds = FALLBACK_THRESHOLDS;

// Format an ISO date (YYYY-MM-DD) as "June 10, 2026" without timezone drift
function formatLongDate(iso) {
  if (!iso) return '';
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso));
  if (!m) return String(iso);
  const months = ['January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'];
  return `${months[parseInt(m[2], 10) - 1]} ${parseInt(m[3], 10)}, ${m[1]}`;
}

// --- Numeric input helpers (inputs may contain thousands separators) ---

// Numeric value of an input, ignoring commas; returns 0 for blank/invalid
function parseNum(el) {
  if (!el) return 0;
  const n = parseFloat(String(el.value).replace(/,/g, '').trim());
  return isNaN(n) ? 0 : n;
}

// Raw, comma-free string of an input (for "is this blank?" checks)
function rawVal(el) {
  return el ? String(el.value).replace(/,/g, '').trim() : '';
}

// Add thousands separators to a numeric-ish string, preserving a decimal part
function formatWithCommas(value) {
  const cleaned = String(value).replace(/[^\d.]/g, '');
  if (cleaned === '') return '';
  const parts = cleaned.split('.');
  let intPart = parts[0].replace(/^0+(?=\d)/, '');
  if (intPart === '') intPart = '0';
  intPart = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return parts.length > 1 ? `${intPart}.${parts.slice(1).join('')}` : intPart;
}

// Display a stored value (number or "") as a comma-formatted string
function formatStoredNumber(v) {
  return (v === undefined || v === null || v === '') ? '' : formatWithCommas(String(v));
}

// Reformat an input live while typing, keeping the caret in a sensible spot
function formatLiveThousands(el) {
  const before = el.value;
  const caret = el.selectionStart;
  const digitsLeft = before.slice(0, caret).replace(/[^\d]/g, '').length;
  const formatted = formatWithCommas(before);
  if (formatted === before) return;
  el.value = formatted;
  let pos = 0, seen = 0;
  while (pos < formatted.length && seen < digitsLeft) {
    if (/\d/.test(formatted[pos])) seen++;
    pos++;
  }
  try { el.setSelectionRange(pos, pos); } catch (e) { /* non-text input */ }
}

// Set true only when the user clicks Refresh on the update toast, so the first
// install (clients.claim) never triggers an automatic page reload.
let pendingUpdateReload = false;

// Register Service Worker for PWA Offline support, with a controlled update prompt
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js')
      .then((reg) => {
        // A new version was already downloaded and is waiting to take over
        if (reg.waiting && navigator.serviceWorker.controller) {
          showUpdateToast(reg);
        }
        reg.addEventListener('updatefound', () => {
          const newWorker = reg.installing;
          if (!newWorker) return;
          newWorker.addEventListener('statechange', () => {
            // Only prompt when this is an UPDATE (a controller already exists),
            // not on the very first install
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              showUpdateToast(reg);
            }
          });
        });
      })
      .catch((err) => console.error('[Service Worker] Registration failed:', err));

    let reloading = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (!pendingUpdateReload) return;
      if (reloading) return;
      reloading = true;
      window.location.reload();
    });
  });
}

// Small, dismissible toast telling the user a new version is ready
function showUpdateToast(reg) {
  if (document.getElementById('update-toast')) return;
  const toast = document.createElement('div');
  toast.id = 'update-toast';
  toast.className = 'update-toast';
  toast.setAttribute('role', 'status');

  const msg = document.createElement('span');
  msg.textContent = 'A new version is available.';
  toast.appendChild(msg);

  const refreshBtn = document.createElement('button');
  refreshBtn.type = 'button';
  refreshBtn.className = 'update-toast-btn';
  refreshBtn.textContent = 'Refresh';
  refreshBtn.addEventListener('click', () => {
    pendingUpdateReload = true;
    if (reg.waiting) {
      reg.waiting.postMessage('SKIP_WAITING');
    } else {
      window.location.reload();
    }
  });
  toast.appendChild(refreshBtn);

  const dismissBtn = document.createElement('button');
  dismissBtn.type = 'button';
  dismissBtn.className = 'update-toast-dismiss';
  dismissBtn.setAttribute('aria-label', 'Dismiss update notice');
  dismissBtn.textContent = '✕';
  dismissBtn.addEventListener('click', () => toast.remove());
  toast.appendChild(dismissBtn);

  document.body.appendChild(toast);
}

// Bump this whenever the saved-state shape changes in an incompatible way.
const STATE_VERSION = 2;
const STORAGE_KEY = 'fsma_calculator_state';

// Farm jurisdiction labels for the declaration and inspection references in the
// printed record. States use "State of …"; DC and territories use accurate titles.
function stateJurisdiction(name) {
  return { name, declaration: `the State of ${name}`, inspection: `State of ${name}` };
}

const JURISDICTIONS = {
  AL: stateJurisdiction('Alabama'), AK: stateJurisdiction('Alaska'), AZ: stateJurisdiction('Arizona'),
  AR: stateJurisdiction('Arkansas'), CA: stateJurisdiction('California'), CO: stateJurisdiction('Colorado'),
  CT: stateJurisdiction('Connecticut'), DE: stateJurisdiction('Delaware'),
  DC: { name: 'District of Columbia', declaration: 'the District of Columbia', inspection: 'District of Columbia' },
  FL: stateJurisdiction('Florida'), GA: stateJurisdiction('Georgia'),
  GU: { name: 'Guam', declaration: 'Guam', inspection: 'Government of Guam' },
  HI: stateJurisdiction('Hawaii'), ID: stateJurisdiction('Idaho'), IL: stateJurisdiction('Illinois'),
  IN: stateJurisdiction('Indiana'), IA: stateJurisdiction('Iowa'), KS: stateJurisdiction('Kansas'),
  KY: stateJurisdiction('Kentucky'), LA: stateJurisdiction('Louisiana'), ME: stateJurisdiction('Maine'),
  MD: stateJurisdiction('Maryland'), MA: stateJurisdiction('Massachusetts'), MI: stateJurisdiction('Michigan'),
  MN: stateJurisdiction('Minnesota'), MS: stateJurisdiction('Mississippi'), MO: stateJurisdiction('Missouri'),
  MT: stateJurisdiction('Montana'), NE: stateJurisdiction('Nebraska'), NV: stateJurisdiction('Nevada'),
  NH: stateJurisdiction('New Hampshire'), NJ: stateJurisdiction('New Jersey'), NM: stateJurisdiction('New Mexico'),
  NY: stateJurisdiction('New York'), NC: stateJurisdiction('North Carolina'), ND: stateJurisdiction('North Dakota'),
  OH: stateJurisdiction('Ohio'), OK: stateJurisdiction('Oklahoma'), OR: stateJurisdiction('Oregon'),
  PA: stateJurisdiction('Pennsylvania'),
  PR: { name: 'Puerto Rico', declaration: 'the Commonwealth of Puerto Rico', inspection: 'Commonwealth of Puerto Rico' },
  RI: stateJurisdiction('Rhode Island'), SC: stateJurisdiction('South Carolina'), SD: stateJurisdiction('South Dakota'),
  TN: stateJurisdiction('Tennessee'), TX: stateJurisdiction('Texas'), UT: stateJurisdiction('Utah'),
  VI: { name: 'U.S. Virgin Islands', declaration: 'the U.S. Virgin Islands', inspection: 'U.S. Virgin Islands' },
  VT: stateJurisdiction('Vermont'), VA: stateJurisdiction('Virginia'), WA: stateJurisdiction('Washington'),
  WV: stateJurisdiction('West Virginia'), WI: stateJurisdiction('Wisconsin'), WY: stateJurisdiction('Wyoming')
};

function jurisdictionFor(code) {
  if (!code) return { name: 'your state', declaration: 'your state', inspection: 'your state' };
  return JURISDICTIONS[code] || { name: code, declaration: code, inspection: code };
}

// Factory for a clean default state (lets us reset safely on bad/old data)
function defaultState() {
  return {
    schemaVersion: STATE_VERSION,
    farmName: "",
    farmAddress: "",
    farmState: "",
    stateManuallySet: false,
    contactName: "",
    contactPhone: "",
    contactEmail: "",
    assessmentYear: "2026",
    sales: {
      // We map keys by relative index 0, 1, 2 for the three preceding years
      produce: ["", "", ""],
      food: ["", "", ""],
      local: ["", "", ""]
    },
    projections: {
      produce: "",
      food: "",
      local: ""
    }
  };
}

// State management
let state = defaultState();

// UI Elements
const els = {
  farmName: document.getElementById('farm-name'),
  farmAddress: document.getElementById('farm-address'),
  farmState: document.getElementById('farm-state'),
  contactName: document.getElementById('contact-name'),
  contactPhone: document.getElementById('contact-phone'),
  contactEmail: document.getElementById('contact-email'),
  assessmentYearLabel: document.getElementById('assessment-year-label'),
  assessmentYearSub: document.getElementById('assessment-year-sub'),
  
  // Year Labels
  rowYear0: document.getElementById('row-year-0'),
  rowYear1: document.getElementById('row-year-1'),
  rowYear2: document.getElementById('row-year-2'),
  
  // Sales Inputs
  produceInputs: [
    document.getElementById('produce-sales-0'),
    document.getElementById('produce-sales-1'),
    document.getElementById('produce-sales-2')
  ],
  foodInputs: [
    document.getElementById('food-sales-0'),
    document.getElementById('food-sales-1'),
    document.getElementById('food-sales-2')
  ],
  localInputs: [
    document.getElementById('local-sales-0'),
    document.getElementById('local-sales-1'),
    document.getElementById('local-sales-2')
  ],
  
  // Averages Displays
  avgProduce: document.getElementById('avg-produce-display'),
  avgFood: document.getElementById('avg-food-display'),
  avgLocalPercent: document.getElementById('avg-local-percent-display'),
  
  // Reference Displays
  limitProduce: document.getElementById('limit-produce-display'),
  limitFood: document.getElementById('limit-food-display'),
  
  // Badges and status info
  statusBadge: document.getElementById('status-badge'),
  statusExplanation: document.getElementById('status-explanation'),
  offlineBadge: document.getElementById('offline-badge'),
  syncBadge: document.getElementById('sync-status-badge'),
  
  // Actions
  btnPrintPreview: document.getElementById('btn-print-preview'),
  btnPrint: document.getElementById('btn-print'),
  
  // Preview Modal
  previewModal: document.getElementById('preview-modal'),
  modalLetterContent: document.getElementById('modal-letter-content'),
  btnModalPrint: document.getElementById('btn-modal-print'),
  btnModalClose: document.getElementById('btn-modal-close'),
  
  // Letter PDF placeholders
  pFarmName: document.getElementById('p-farm-name'),
  pFarmAddress: document.getElementById('p-farm-address'),
  pContactName: document.getElementById('p-contact-name'),
  pContactPhone: document.getElementById('p-contact-phone'),
  pContactEmail: document.getElementById('p-contact-email'),
  pAssessmentYear: document.getElementById('p-assessment-year'),
  pCalcDate: document.getElementById('p-calc-date'),
  pThresholdUpdate: document.getElementById('p-threshold-update'),
  pExemptionStatus: document.getElementById('p-exemption-status'),
  pStatusBanner: document.getElementById('p-status-banner'),
  pBannerTitle: document.getElementById('p-banner-title'),
  pBannerDesc: document.getElementById('p-banner-desc'),
  pRegulatoryCitation: document.getElementById('p-regulatory-citation'),
  pLetterTitle: document.getElementById('p-letter-title'),
  pLetterFarmName: document.getElementById('p-letter-farm-name'),
  pClaimStatement: document.getElementById('p-claim-statement'),
  pSigPrintedName: document.getElementById('p-sig-printed-name'),
  
  // Letter Table cells
  pYearLabels: [
    document.getElementById('p-year-0'),
    document.getElementById('p-year-1'),
    document.getElementById('p-year-2')
  ],
  pProduceVals: [
    document.getElementById('p-val-produce-0'),
    document.getElementById('p-val-produce-1'),
    document.getElementById('p-val-produce-2')
  ],
  pFoodVals: [
    document.getElementById('p-val-food-0'),
    document.getElementById('p-val-food-1'),
    document.getElementById('p-val-food-2')
  ],
  pLocalVals: [
    document.getElementById('p-val-local-0'),
    document.getElementById('p-val-local-1'),
    document.getElementById('p-val-local-2')
  ],
  pLocalPcts: [
    document.getElementById('p-pct-local-0'),
    document.getElementById('p-pct-local-1'),
    document.getElementById('p-pct-local-2')
  ],
  pAvgProduce: document.getElementById('p-avg-produce'),
  pAvgFood: document.getElementById('p-avg-food'),
  pAvgLocal: document.getElementById('p-avg-local'),
  pAvgPctLocal: document.getElementById('p-avg-pct-local'),
  pThresholdProduce: document.getElementById('p-threshold-produce'),
  pThresholdFood: document.getElementById('p-threshold-food')
};

// Initialize App
async function init() {
  await loadThresholds();
  applyAssessmentYear();
  setupNetworkMonitoring();
  loadSavedState();
  updateYearsAndLimits();
  calculateExemption();
  setupEventListeners();
}

// Fetch thresholds from JSON config
async function loadThresholds() {
  try {
    const res = await fetch('thresholds.json');
    if (res.ok) {
      activeThresholds = await res.json();
      const yr = Object.keys(activeThresholds.assessment_years || {}).sort((a, b) => Number(b) - Number(a))[0] || '';
      els.syncBadge.innerText = yr ? `FDA Limits: ${yr}` : 'FDA Limits Current';
    } else {
      console.warn('thresholds.json returned status', res.status, '- using offline fallback data.');
      activeThresholds = FALLBACK_THRESHOLDS;
      els.syncBadge.innerText = 'Offline (2026 Limits)';
    }
  } catch (err) {
    console.warn('Could not fetch thresholds.json. Using offline fallback data.', err);
    activeThresholds = FALLBACK_THRESHOLDS;
    els.syncBadge.innerText = 'Offline (2026 Limits)';
  }
}

// Return the newest claimable assessment year from the loaded thresholds
function newestAssessmentYear() {
  const years = Object.keys(activeThresholds.assessment_years || {}).sort((a, b) => Number(b) - Number(a));
  return years[0] || state.assessmentYear;
}

// Lock the calculator to the newest claimable year and render the static label.
// Only one year is offered at a time, so no dropdown is needed.
function applyAssessmentYear() {
  const newest = newestAssessmentYear();
  if (!newest) return;
  state.assessmentYear = newest;
  const data = activeThresholds.assessment_years[newest];
  if (els.assessmentYearLabel) els.assessmentYearLabel.innerText = newest;
  if (els.assessmentYearSub && data) {
    els.assessmentYearSub.innerText = `Uses ${data.years_used[0]} – ${data.years_used[2]} sales records`;
  }
}

// Set up online/offline event listeners
function setupNetworkMonitoring() {
  const updateStatus = () => {
    els.offlineBadge.style.display = 'inline-flex';
    if (navigator.onLine) {
      els.offlineBadge.innerText = '📡 Offline Ready';
      els.offlineBadge.classList.remove('offline-mode-active');
    } else {
      els.offlineBadge.innerText = '📡 Offline Mode';
      els.offlineBadge.classList.add('offline-mode-active');
    }
  };
  window.addEventListener('online', updateStatus);
  window.addEventListener('offline', updateStatus);
  updateStatus();
}

// Normalize a stored sales figure: blank stays blank, valid numbers are coerced.
function sanitizeSalesValue(v) {
  if (v === undefined || v === null || v === '') return '';
  if (typeof v === 'number' && !isNaN(v)) return v;
  if (typeof v === 'string') {
    const trimmed = v.replace(/,/g, '').trim();
    if (trimmed === '') return '';
    const n = parseFloat(trimmed);
    return isNaN(n) ? '' : n;
  }
  return '';
}

// Build a clean, validated state from whatever was stored, ignoring unknown or
// malformed fields so an old/corrupt save can never crash or corrupt the app.
function migrateState(parsed) {
  const fresh = defaultState();
  if (!parsed || typeof parsed !== 'object') return fresh;

  const strFields = ['farmName', 'farmAddress', 'contactName', 'contactPhone', 'contactEmail'];
  strFields.forEach((k) => { if (typeof parsed[k] === 'string') fresh[k] = parsed[k]; });
  if (typeof parsed.farmState === 'string' && JURISDICTIONS[parsed.farmState]) {
    fresh.farmState = parsed.farmState;
  }
  if (typeof parsed.stateManuallySet === 'boolean') fresh.stateManuallySet = parsed.stateManuallySet;

  const copyTriple = (src, dest) => {
    if (!Array.isArray(src)) return;
    for (let i = 0; i < 3; i++) {
      dest[i] = sanitizeSalesValue(src[i]);
    }
  };
  if (parsed.sales && typeof parsed.sales === 'object') {
    copyTriple(parsed.sales.produce, fresh.sales.produce);
    copyTriple(parsed.sales.food, fresh.sales.food);
    copyTriple(parsed.sales.local, fresh.sales.local);
  }
  if (parsed.projections && typeof parsed.projections === 'object') {
    ['produce', 'food', 'local'].forEach((k) => {
      fresh.projections[k] = sanitizeSalesValue(parsed.projections[k]);
    });
  }
  fresh.schemaVersion = STATE_VERSION;
  return fresh;
}

// Load state from LocalStorage
function loadSavedState() {
  let parsed;
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) return;
    parsed = JSON.parse(saved);
  } catch (e) {
    console.error('Could not read saved data; starting fresh.', e);
    return;
  }

  state = migrateState(parsed);

  // Populate text inputs
  els.farmName.value = state.farmName || "";
  els.farmAddress.value = state.farmAddress || "";
  els.farmState.value = state.farmState || "";
  els.contactName.value = state.contactName || "";
  els.contactPhone.value = state.contactPhone || "";
  els.contactEmail.value = state.contactEmail || "";

  // Only the newest year is claimable; ignore any stale saved year (e.g. an old 2025)
  state.assessmentYear = newestAssessmentYear();
  applyAssessmentYear();

  for (let i = 0; i < 3; i++) {
    els.produceInputs[i].value = formatStoredNumber(state.sales.produce[i]);
    els.foodInputs[i].value = formatStoredNumber(state.sales.food[i]);
    els.localInputs[i].value = formatStoredNumber(state.sales.local[i]);
  }

  const pProj = document.getElementById('proj-produce');
  const fProj = document.getElementById('proj-food');
  const lProj = document.getElementById('proj-local');
  if (pProj) pProj.value = formatStoredNumber(state.projections.produce);
  if (fProj) fProj.value = formatStoredNumber(state.projections.food);
  if (lProj) lProj.value = formatStoredNumber(state.projections.local);
}

// Save state to LocalStorage
function saveState() {
  try {
    state.schemaVersion = STATE_VERSION;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (e) {
    console.error('Failed to save state:', e);
  }
}

// Update year labels and threshold values in UI
function updateYearsAndLimits() {
  const yearData = activeThresholds.assessment_years[state.assessmentYear];
  if (!yearData) return;
  
  const years = yearData.years_used;
  els.rowYear0.innerText = years[0];
  els.rowYear1.innerText = years[1];
  els.rowYear2.innerText = years[2];
  
  els.limitProduce.innerText = `$${yearData.produce_threshold.toLocaleString()}`;
  els.limitFood.innerText = `$${yearData.total_food_threshold.toLocaleString()}`;
  
  // Update print placeholders
  els.pAssessmentYear.innerText = state.assessmentYear;
  els.pThresholdUpdate.innerText = formatLongDate(activeThresholds.last_updated) || '—';
  els.pThresholdProduce.innerText = `$${yearData.produce_threshold.toLocaleString()}`;
  els.pThresholdFood.innerText = `$${yearData.total_food_threshold.toLocaleString()}`;
  for (let i = 0; i < 3; i++) {
    els.pYearLabels[i].innerText = years[i];
  }

  // Keep each sales input's accessible name year-specific (screen readers would
  // otherwise hear three identically-labeled "Gross Produce Sales" fields).
  const setYearAria = (inputs, label) => {
    for (let i = 0; i < 3; i++) {
      if (inputs[i]) inputs[i].setAttribute('aria-label', `${label} for ${years[i]}`);
    }
  };
  setYearAria(els.produceInputs, 'Gross Produce Sales');
  setYearAria(els.foodInputs, 'Total Food Sales');
  setYearAria(els.localInputs, 'Qualified End-User Sales');
  
  // Update projection labels dynamically
  const assessmentYearNum = parseInt(state.assessmentYear);
  const nextYear = assessmentYearNum + 1;
  const currentYear = assessmentYearNum;
  
  const projNextYearLabel = document.getElementById('proj-next-year-label');
  const projCurrentYearLabel = document.getElementById('proj-current-year-label');
  const projMathYears = document.getElementById('proj-math-years');
  
  if (projNextYearLabel) projNextYearLabel.innerText = nextYear;
  if (projCurrentYearLabel) projCurrentYearLabel.innerText = currentYear;
  if (projMathYears) projMathYears.innerText = `${years[1]}, ${years[2]}, and ${currentYear} (Projected)`;
  
  const projThresholdYear = document.getElementById('proj-threshold-year');
  if (projThresholdYear) projThresholdYear.innerText = state.assessmentYear;
  
  // Keep the static reference card in sync with the selected assessment year
  const helperProduce = document.getElementById('helper-produce-threshold');
  const helperFood = document.getElementById('helper-food-threshold');
  const helperYearProduce = document.getElementById('helper-year-produce');
  const helperYearFood = document.getElementById('helper-year-food');
  if (helperProduce) helperProduce.innerText = yearData.produce_threshold.toLocaleString();
  if (helperFood) helperFood.innerText = yearData.total_food_threshold.toLocaleString();
  if (helperYearProduce) helperYearProduce.innerText = state.assessmentYear;
  if (helperYearFood) helperYearFood.innerText = state.assessmentYear;

  const helperNotProduce = document.getElementById('helper-not-produce-threshold');
  const helperNotFood = document.getElementById('helper-not-food-threshold');
  if (helperNotProduce) helperNotProduce.innerText = yearData.produce_threshold.toLocaleString();
  if (helperNotFood) helperNotFood.innerText = yearData.total_food_threshold.toLocaleString();
}// Helper to reset results when entries fail validation checks
function resetResultsForValidation() {
  els.avgProduce.innerText = "--";
  els.avgFood.innerText = "--";
  els.avgLocalPercent.innerText = "--";
  els.statusBadge.innerText = "Check Entries";
  els.statusBadge.className = "status-badge status-undetermined";
  els.statusExplanation.innerText = "Sales values are mathematically invalid. Please correct the fields marked above.";
  els.btnPrintPreview.disabled = true;
  els.btnPrint.disabled = true;
  const helperHintEl = document.getElementById('print-helper-hint');
  if (helperHintEl) {
    helperHintEl.innerHTML = "⚠️ Please correct the invalid sales values in Step 2 to calculate your status.";
    helperHintEl.classList.remove('hidden');
  }
}

// Auto-detect the farm state from the address field (e.g. "... Anytown, ME 04000").
// Only runs while the user types in the address field, and never overrides a state
// the user has explicitly chosen from the dropdown.
function autoDetectStateFromAddress() {
  if (state.stateManuallySet) return;
  const addressVal = els.farmAddress.value || "";
  let code = null;

  if (/\b(DC|District of Columbia)\b/i.test(addressVal)) {
    code = 'DC';
  } else {
    const stateMatch = addressVal.match(/\b([A-Z]{2})\b(?:\s+\d{5}(?:-\d{4})?)?\s*$/i);
    if (stateMatch) code = stateMatch[1].toUpperCase();
  }

  if (code && JURISDICTIONS[code] && els.farmState.value !== code) {
    els.farmState.value = code;
    state.farmState = code;
  }
}

// Main Exemption Calculation Logic
function calculateExemption() {
  const yearData = activeThresholds.assessment_years[state.assessmentYear];
  if (!yearData) return;

  // Persist exactly what the farmer typed: a parsed number per filled field, or
  // "" for a blank (not-in-business) year. calc.js turns this into the average.
  for (let i = 0; i < 3; i++) {
    state.sales.produce[i] = rawVal(els.produceInputs[i]) !== "" ? parseNum(els.produceInputs[i]) : "";
    state.sales.food[i] = rawVal(els.foodInputs[i]) !== "" ? parseNum(els.foodInputs[i]) : "";
    state.sales.local[i] = rawVal(els.localInputs[i]) !== "" ? parseNum(els.localInputs[i]) : "";
  }

  saveState();

  // Single source of truth for the 3-year averaging + exemption decision (calc.js).
  const calc = FSMACalc.computeExemption(state.sales, yearData);

  if (!calc.hasInputs) {
    resetResults();
    return;
  }
  
  // Validation checks
  let warningMsg = "";
  for (let i = 0; i < 3; i++) {
    const yr = yearData.years_used[i];
    const pVal = parseNum(els.produceInputs[i]);
    const fVal = parseNum(els.foodInputs[i]);
    const lVal = parseNum(els.localInputs[i]);
    
    if (pVal < 0 || fVal < 0 || lVal < 0) {
      warningMsg = `In ${yr}, sales values cannot be negative. Please enter $0 or greater.`;
      break;
    }
    if (pVal > fVal) {
      warningMsg = `In ${yr}, Produce Sales ($${pVal.toLocaleString()}) cannot be greater than Total Food Sales ($${fVal.toLocaleString()}).`;
      break;
    }
    if (lVal > fVal) {
      warningMsg = `In ${yr}, Local Food Sales ($${lVal.toLocaleString()}) cannot be greater than Total Food Sales ($${fVal.toLocaleString()}).`;
      break;
    }
  }
  
  const warningEl = document.getElementById('validation-warning');
  const warningMsgEl = document.getElementById('warning-message');
  if (warningMsg) {
    warningMsgEl.innerText = warningMsg;
    warningEl.classList.remove('hidden');
    resetResultsForValidation();
    return;
  } else {
    warningEl.classList.add('hidden');
  }

  // Pull the rolling-average figures from the shared calculation (calc.js).
  const exactAvgFood = calc.exactAvgFood;
  const avgProduce = calc.avgProduce;
  const avgFood = calc.avgFood;
  const avgLocal = calc.avgLocal;
  const localPct = calc.localPctDisplay;
  
  // Update averages displays
  els.avgProduce.innerText = `$${avgProduce.toLocaleString()}`;
  els.avgFood.innerText = `$${avgFood.toLocaleString()}`;
  els.avgLocalPercent.innerText = `${localPct}%`;
  
  // Exemption Logic
  let status = ""; // "exempt", "qualified", "not_exempt"
  let badgeText = "";
  let badgeClass = "";
  let explanationText = "";
  let citationText = "";
  let bannerClass = "";
  
  // Scenario 1: De Minimis (Fully Exempt)
  // § 112.4(a): Average annual value of produce sold does not exceed $25,000 (adjusted for inflation)
  if (calc.status === "exempt") {
    status = "exempt";
    badgeText = `Fully Exempt (Produce Sales ≤ $${yearData.produce_threshold.toLocaleString()})`;
    badgeClass = "status-exempt";
    bannerClass = "exemption-banner status-exempt";
    explanationText = `Your farm is not covered by the Produce Safety Rule because your rolling average produce sales ($${avgProduce.toLocaleString()}) do not exceed the FDA's inflation-adjusted limit of $${yearData.produce_threshold.toLocaleString()}. You do not need to comply with the general requirements of the Produce Safety Rule.`;
    citationText = `<strong>Legal Citation: 21 CFR § 112.4(a)</strong> — A farm is not covered by the Produce Safety Rule if its average annual value of produce sold during the previous 3-year period does not exceed $25,000 (adjusted for inflation: $${yearData.produce_threshold.toLocaleString()} for the ${state.assessmentYear} claim year). <br><br><strong>Recordkeeping Best Practice:</strong> Although not covered by the rule, you should retain your yearly tax returns and crop sales records for at least 3 years to document and verify your exempt status during audits or inspections.`;
  }
  // Scenario 2: Qualified Exemption (Partially Exempt)
  // § 112.5: Average annual food sales are less than $500,000 (adjusted for inflation) AND the majority (>50%) is sold to qualified end-users.
  else if (calc.status === "qualified") {
    status = "qualified";
    badgeText = "Partially Exempt (Qualified Local Farm)";
    badgeClass = "status-qualified";
    bannerClass = "exemption-banner status-qualified";
    explanationText = `Your farm qualifies for a Qualified Exemption (partial exemption). Your average total food sales ($${avgFood.toLocaleString()}) are below the FDA inflation-adjusted limit of $${yearData.total_food_threshold.toLocaleString()}, and the majority of your food sales (${localPct}%) are sold directly to qualified end-users (local consumers, stores, or restaurants). You must comply with modified requirements under 21 CFR §§ 112.6 and 112.7.`;
    citationText = `<strong>Legal Citation: 21 CFR § 112.5 & § 112.7</strong> — A farm is eligible for a Qualified Exemption if: (1) average annual food sales during the previous 3-year period were less than $500,000 (adjusted for inflation: $${yearData.total_food_threshold.toLocaleString()} for the ${state.assessmentYear} claim year), AND (2) average annual value of food sold directly to qualified end-users (local consumers/retailers) exceeded sales to all other buyers. A written record of this determination is required annually under 21 CFR § 112.7. <br><br><strong>Labeling & Point of Purchase (21 CFR § 112.6):</strong> You must prominently and conspicuously display the farm name and complete business address on your produce packaging label (if required) or at the point of purchase (e.g., on a sign, poster, placard, or document delivered with the food).`;
  }
  // Scenario 3: Not Exempt
  else {
    status = "not_exempt";
    badgeText = "Not Exempt (Fully Covered)";
    badgeClass = "status-not-exempt";
    bannerClass = "exemption-banner status-not-exempt";
    
    let failureReason = "";
    if (exactAvgFood >= yearData.total_food_threshold) {
      failureReason = `your average food sales ($${avgFood.toLocaleString()}) meet or exceed the FDA inflation-adjusted limit of $${yearData.total_food_threshold.toLocaleString()}.`;
    } else {
      failureReason = `your local sales to qualified end-users ($${avgLocal.toLocaleString()}) represent only ${localPct}% of your food sales, which does not exceed the required 50% majority.`;
    }
    
    explanationText = `Your farm does not qualify for a Produce Safety Rule exemption because ${failureReason} You must comply with the full regulatory standards for covered farms.`;
    citationText = `<strong>Legal Citation: 21 CFR Part 112</strong> — The farm does not meet the exclusion requirements of 21 CFR § 112.4(a) or the qualified exemption requirements of 21 CFR § 112.5. The farm is fully covered by the standards for growing, harvesting, packing, and holding produce for human consumption.`;
  }
  
  // Update badge
  els.statusBadge.innerText = badgeText;
  els.statusBadge.className = `status-badge ${badgeClass}`;
  els.statusExplanation.innerText = explanationText;
  
  // Enable buttons if farm profile is filled out
  const profileFilled = els.farmName.value.trim() !== "" && els.contactName.value.trim() !== "" && state.farmState !== "";
  const helperHintEl = document.getElementById('print-helper-hint');
  
  if (profileFilled && status !== "") {
    els.btnPrintPreview.disabled = false;
    els.btnPrint.disabled = false;
    if (helperHintEl) {
      if (status === "qualified") {
        helperHintEl.innerHTML = `
          <strong>💡 Action Steps to Secure Qualified Exemption:</strong>
          <ol style="margin-left: 1.15rem; margin-top: 0.35rem; font-size: 0.78rem; display: flex; flex-direction: column; gap: 0.2rem; line-height: 1.4;">
            <li>Click <strong>Print / Save Exemption Record</strong> below to generate your record.</li>
            <li>Sign and date the printed annual written determination.</li>
            <li>File it alongside your sales logs or farm records (retain for at least 3 years).</li>
            <li><strong>Labeling Rule (21 CFR § 112.6):</strong> Ensure your farm name and physical address are prominently shown at your farmstand, market placard, invoices, or produce labels.</li>
          </ol>
        `;
      } else if (status === "exempt") {
        helperHintEl.innerHTML = `
          <strong>💡 Action Steps to Prove Exemption:</strong>
          <ol style="margin-left: 1.15rem; margin-top: 0.35rem; font-size: 0.78rem; display: flex; flex-direction: column; gap: 0.2rem; line-height: 1.4;">
            <li>Click <strong>Print / Save Exemption Record</strong> below to generate your record.</li>
            <li>Sign and date the printed declaration.</li>
            <li>File this record with your supporting 3-year crop sales logs (retain for at least 3 years).</li>
          </ol>
        `;
      } else {
        helperHintEl.innerHTML = `
          <strong>⚠️ Required Action Items:</strong>
          <ul style="margin-left: 1.15rem; margin-top: 0.35rem; font-size: 0.78rem; display: flex; flex-direction: column; gap: 0.2rem; list-style-type: disc; line-height: 1.4;">
            <li>Your farm is fully covered by the Produce Safety Rule and must meet all applicable standards for growing, harvesting, packing, and holding produce.</li>
            <li>Complete a <a href="https://cals.cornell.edu/produce-safety-alliance/training/grower-training-course/upcoming-grower-trainings" target="_blank" rel="noopener" style="color: inherit;">PSA Grower Training course</a> — the FDA-recognized national training that satisfies the supervisor training requirement in 21 CFR § 112.22(c).</li>
            <li>Contact your state's produce safety program or cooperative extension office for on-farm compliance assistance and inspection guidance.</li>
            <li>Review the <a href="https://www.fda.gov/food/food-safety-modernization-act-fsma/fsma-produce-safety-rule" target="_blank" rel="noopener" style="color: inherit;">FDA FSMA Produce Safety Rule</a> guidance for a full overview of your obligations.</li>
          </ul>
        `;
      }
      helperHintEl.classList.remove('hidden');
    }
  } else {
    els.btnPrintPreview.disabled = true;
    els.btnPrint.disabled = true;
    if (helperHintEl) {
      if (status === "") {
        helperHintEl.innerHTML = "⚠️ Please enter your sales data in Step 2 to calculate your status.";
      } else {
        helperHintEl.innerHTML = "⚠️ Fill in <strong>Farm Legal Name</strong>, <strong>Owner/Operator Name</strong>, and <strong>Farm State</strong> in Step 1 to enable printing.";
      }
      helperHintEl.classList.remove('hidden');
    }
  }
  
  // Update print sheet values
  if (els.pLetterFarmName) {
    els.pLetterFarmName.innerText = (els.farmName.value.trim() || "Your Farm").toUpperCase();
  }
  els.pFarmName.innerText = els.farmName.value || "--";
  els.pFarmAddress.innerText = els.farmAddress.value || "--";
  els.pContactName.innerText = els.contactName.value || "--";
  els.pContactPhone.innerText = els.contactPhone.value || "--";
  els.pContactEmail.innerText = els.contactEmail.value || "--";
  els.pCalcDate.innerText = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

  // Explicit, plain-language statement of exactly what the farm is claiming
  let claimText = "";
  if (status === "exempt") {
    claimText = `This farm asserts that it is NOT COVERED by the FSMA Produce Safety Rule under 21 CFR § 112.4(a) for the ${state.assessmentYear} coverage year.`;
  } else if (status === "qualified") {
    claimText = `This farm claims a QUALIFIED EXEMPTION from the full FSMA Produce Safety Rule under 21 CFR § 112.5 for the ${state.assessmentYear} coverage year.`;
  } else if (status === "not_exempt") {
    claimText = `Based on the figures below, this farm is FULLY COVERED by the FSMA Produce Safety Rule (21 CFR Part 112) for the ${state.assessmentYear} coverage year.`;
  }
  if (els.pClaimStatement) els.pClaimStatement.innerText = claimText;
  if (els.pSigPrintedName) els.pSigPrintedName.innerText = els.contactName.value.trim() || "";
  
  const selectedState = els.farmState.value || "ME";
  const jur = jurisdictionFor(selectedState);

  const pInspJurisdiction = document.getElementById('p-inspection-jurisdiction');
  if (pInspJurisdiction) pInspJurisdiction.innerText = jur.inspection;

  // Update document title dynamically in compliance printout
  let docTitle = "FSMA PRODUCE SAFETY RULE EXEMPTION RECORD";
  if (status === "exempt") {
    docTitle = "ANNUAL DETERMINATION OF NON-COVERAGE STATUS (21 CFR § 112.4(a))";
  } else if (status === "qualified") {
    docTitle = "ANNUAL WRITTEN DETERMINATION OF QUALIFIED EXEMPTION STATUS (21 CFR § 112.7)";
  } else if (status === "not_exempt") {
    docTitle = "ANNUAL DETERMINATION OF COVERAGE STATUS (21 CFR Part 112)";
  }
  if (els.pLetterTitle) {
    els.pLetterTitle.innerText = docTitle;
  }

  els.pExemptionStatus.innerText = badgeText;
  els.pExemptionStatus.className = `field-print bold-status ${status}`;
  els.pStatusBanner.className = bannerClass;
  els.pBannerTitle.innerText = badgeText.toUpperCase();
  els.pBannerDesc.innerText = explanationText;
  els.pRegulatoryCitation.innerHTML = citationText;
  
  // Populate print ledger rows
  for (let i = 0; i < 3; i++) {
    const pVal = state.sales.produce[i] || 0;
    const fVal = state.sales.food[i] || 0;
    const lVal = state.sales.local[i] || 0;
    const lPct = fVal > 0 ? Math.round((lVal / fVal) * 100) : 0;
    
    els.pProduceVals[i].innerText = `$${pVal.toLocaleString()}`;
    els.pFoodVals[i].innerText = `$${fVal.toLocaleString()}`;
    els.pLocalVals[i].innerText = `$${lVal.toLocaleString()}`;
    els.pLocalPcts[i].innerText = `${lPct}%`;
  }
  
  els.pAvgProduce.innerHTML = `<strong>$${avgProduce.toLocaleString()}</strong>`;
  els.pAvgFood.innerHTML = `<strong>$${avgFood.toLocaleString()}</strong>`;
  els.pAvgLocal.innerHTML = `<strong>$${avgLocal.toLocaleString()}</strong>`;
  els.pAvgPctLocal.innerHTML = `<strong>${localPct}%</strong>`;
  els.pThresholdProduce.innerText = `$${yearData.produce_threshold.toLocaleString()}`;
  els.pThresholdFood.innerText = `$${yearData.total_food_threshold.toLocaleString()}`;
  
  // Update projection planning calculations
  calculateProjection();
}

function calculateProjection() {
  const yearData = activeThresholds.assessment_years[state.assessmentYear];
  if (!yearData) return;
  
  const pProjInput = document.getElementById('proj-produce');
  const fProjInput = document.getElementById('proj-food');
  const lProjInput = document.getElementById('proj-local');
  
  if (!pProjInput || !fProjInput || !lProjInput) return;
  
  const pProj = parseNum(pProjInput);
  const fProj = parseNum(fProjInput);
  const lProj = parseNum(lProjInput);
  
  // Save to state
  state.projections = {
    produce: rawVal(pProjInput) !== "" ? pProj : "",
    food: rawVal(fProjInput) !== "" ? fProj : "",
    local: rawVal(lProjInput) !== "" ? lProj : ""
  };
  saveState();
  
  const projStatusBadge = document.getElementById('proj-status-badge');
  const projStatusExplanation = document.getElementById('proj-status-explanation');
  
  const hasInputs = rawVal(pProjInput) !== "" || rawVal(fProjInput) !== "" || rawVal(lProjInput) !== "";
  
  if (!hasInputs) {
    projStatusBadge.innerText = "Enter Projections";
    projStatusBadge.className = "status-badge status-undetermined";
    projStatusExplanation.innerText = "Enter projected sales to calculate your estimated status for next year.";
    return;
  }
  
  // Validations
  if (pProj < 0 || fProj < 0 || lProj < 0) {
    projStatusBadge.innerText = "Check Projections";
    projStatusBadge.className = "status-badge status-undetermined";
    projStatusExplanation.innerHTML = "⚠️ Projected sales values cannot be negative.";
    return;
  }
  if (pProj > fProj) {
    projStatusBadge.innerText = "Check Projections";
    projStatusBadge.className = "status-badge status-undetermined";
    projStatusExplanation.innerHTML = "⚠️ Projected Produce Sales cannot exceed Projected Total Food Sales.";
    return;
  }
  if (lProj > fProj) {
    projStatusBadge.innerText = "Check Projections";
    projStatusBadge.className = "status-badge status-undetermined";
    projStatusExplanation.innerHTML = "⚠️ Projected Local Sales cannot exceed Projected Total Food Sales.";
    return;
  }
  
  // Build next year's 3-year window from the two most recent historical years
  // (Step 2's Year 2 & Year 3) plus the projected current year, preserving the
  // blank-vs-zero distinction so a not-in-business year is excluded from the
  // average — exactly like the official calculator.
  const histOrBlank = (input) => rawVal(input) !== "" ? parseNum(input) : "";
  const projSales = {
    produce: [histOrBlank(els.produceInputs[1]), histOrBlank(els.produceInputs[2]), state.projections.produce],
    food:    [histOrBlank(els.foodInputs[1]),    histOrBlank(els.foodInputs[2]),    state.projections.food],
    local:   [histOrBlank(els.localInputs[1]),   histOrBlank(els.localInputs[2]),   state.projections.local]
  };

  // Same engine as the official determination (calc.js): identical averaging
  // (active-years denominator) AND identical exempt/qualified decision, so the
  // planner can never disagree with the real calculator.
  const calc = FSMACalc.computeExemption(projSales, yearData);
  const avgProduce = calc.avgProduce;
  const avgFood = calc.avgFood;
  const localPct = calc.localPctDisplay;
  let status = calc.status;
  let badgeText = "";
  let badgeClass = "";
  let explanationText = "";
  
  if (status === "exempt") {
    badgeText = "Projected Exempt";
    badgeClass = "status-exempt";
    explanationText = `Based on projections, your estimated rolling average produce sales ($${avgProduce.toLocaleString()}) remain below the $${yearData.produce_threshold.toLocaleString()} threshold. Your farm would remain <strong>Fully Exempt</strong> next year.`;
  } else if (status === "qualified") {
    badgeText = "Projected Qualified Exempt";
    badgeClass = "status-qualified";
    explanationText = `Based on projections, your estimated rolling average total food sales ($${avgFood.toLocaleString()}) are below the $${yearData.total_food_threshold.toLocaleString()} threshold, and the majority (${localPct}%) would be sold directly to qualified end-users. Your farm would qualify for a <strong>Qualified Exemption</strong> next year.`;
  } else {
    badgeText = "Projected Not Exempt";
    badgeClass = "status-not-exempt";
    
    let reason = "";
    if (avgFood >= yearData.total_food_threshold) {
      reason = `estimated rolling average food sales ($${avgFood.toLocaleString()}) would meet or exceed the $${yearData.total_food_threshold.toLocaleString()} threshold.`;
    } else {
      reason = `estimated qualified end-user sales (${localPct}%) would fall below the required 50% majority.`;
    }
    explanationText = `Based on projections, your farm would be <strong>Not Exempt (Fully Covered)</strong> next year because ${reason}`;
  }
  
  projStatusBadge.innerText = badgeText;
  projStatusBadge.className = `status-badge ${badgeClass}`;
  projStatusExplanation.innerHTML = explanationText;
}
function resetResults() {
  els.avgProduce.innerText = "$0";
  els.avgFood.innerText = "$0";
  els.avgLocalPercent.innerText = "0.0%";
  els.statusBadge.innerText = "Enter Sales Data";
  els.statusBadge.className = "status-badge status-undetermined";
  els.statusExplanation.innerText = "Fill in the sales numbers in Step 2 to calculate your FSMA Exemption status.";
  els.btnPrintPreview.disabled = true;
  els.btnPrint.disabled = true;
  const helperHintEl = document.getElementById('print-helper-hint');
  if (helperHintEl) {
    helperHintEl.innerHTML = "⚠️ Please enter your sales data in Step 2 to calculate your status.";
    helperHintEl.classList.remove('hidden');
  }
}

let modalReturnFocus = null;

function openPreviewModal() {
  const letterClone = document.getElementById('print-letter').cloneNode(true);
  letterClone.querySelectorAll('[id]').forEach((el) => el.removeAttribute('id'));
  els.modalLetterContent.replaceChildren(letterClone);
  modalReturnFocus = document.activeElement;
  els.previewModal.classList.remove('hidden');
  els.previewModal.setAttribute('aria-hidden', 'false');
  document.body.style.overflow = 'hidden';
  els.btnModalClose.focus();
}

function closePreviewModal() {
  els.previewModal.classList.add('hidden');
  els.previewModal.setAttribute('aria-hidden', 'true');
  document.body.style.overflow = '';
  if (modalReturnFocus && typeof modalReturnFocus.focus === 'function') {
    modalReturnFocus.focus();
  }
  modalReturnFocus = null;
}

function trapModalFocus(e) {
  if (els.previewModal.classList.contains('hidden')) return;
  if (e.key === 'Escape') {
    e.preventDefault();
    closePreviewModal();
    return;
  }
  if (e.key !== 'Tab') return;
  const focusable = els.previewModal.querySelectorAll(
    'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
  );
  const list = Array.from(focusable).filter((el) => !el.disabled && el.offsetParent !== null);
  if (!list.length) return;
  const first = list[0];
  const last = list[list.length - 1];
  if (e.shiftKey && document.activeElement === first) {
    e.preventDefault();
    last.focus();
  } else if (!e.shiftKey && document.activeElement === last) {
    e.preventDefault();
    first.focus();
  }
}

function clearSavedData() {
  const confirmed = window.confirm(
    'Clear all saved farm information and sales figures from this device? This cannot be undone.'
  );
  if (!confirmed) return;

  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (e) {
    console.error('Failed to clear saved data:', e);
  }

  state = defaultState();
  applyAssessmentYear();

  els.farmName.value = "";
  els.farmAddress.value = "";
  els.farmState.value = state.farmState;
  els.contactName.value = "";
  els.contactPhone.value = "";
  els.contactEmail.value = "";

  for (let i = 0; i < 3; i++) {
    els.produceInputs[i].value = "";
    els.foodInputs[i].value = "";
    els.localInputs[i].value = "";
  }

  const pProj = document.getElementById('proj-produce');
  const fProj = document.getElementById('proj-food');
  const lProj = document.getElementById('proj-local');
  if (pProj) pProj.value = "";
  if (fProj) fProj.value = "";
  if (lProj) lProj.value = "";

  const warningEl = document.getElementById('validation-warning');
  if (warningEl) warningEl.classList.add('hidden');

  updateYearsAndLimits();
  calculateExemption();
}

// Start app

// Event Listeners setup
function setupEventListeners() {
  // Save profile inputs
  const profileFields = ['farmName', 'farmAddress', 'contactName', 'contactPhone', 'contactEmail'];
  profileFields.forEach((field) => {
    els[field].addEventListener('input', (e) => {
      state[field] = e.target.value;
      if (field === 'farmAddress') {
        autoDetectStateFromAddress();
      }
      calculateExemption();
    });
  });
  
  els.farmState.addEventListener('change', (e) => {
    state.farmState = e.target.value;
    state.stateManuallySet = true; // user's explicit choice wins over address auto-detection
    calculateExemption();
  });
  
  // Numeric sales inputs (format thousands live, then recalculate)
  const inputsList = [...els.produceInputs, ...els.foodInputs, ...els.localInputs];
  inputsList.forEach((input) => {
    input.addEventListener('input', () => {
      formatLiveThousands(input);
      calculateExemption();
    });
  });
  
  // Projections inputs
  const pProj = document.getElementById('proj-produce');
  const fProj = document.getElementById('proj-food');
  const lProj = document.getElementById('proj-local');
  [pProj, fProj, lProj].forEach((input) => {
    if (input) {
      input.addEventListener('input', () => {
        formatLiveThousands(input);
        calculateProjection();
      });
    }
  });
  
  // Generic collapsible-card toggle (trigger, content, card, optional onExpand)
  const wireCollapsible = (triggerId, contentId, cardId, onExpand) => {
    const trigger = document.getElementById(triggerId);
    const content = document.getElementById(contentId);
    const card = document.getElementById(cardId);
    if (!trigger || !content || !card) return;
    trigger.addEventListener('click', () => {
      const isHidden = content.classList.contains('hidden');
      content.classList.toggle('hidden', !isHidden);
      card.classList.toggle('expanded', isHidden);
      trigger.setAttribute('aria-expanded', String(isHidden));
      const icon = trigger.querySelector('.trigger-icon');
      if (icon) icon.innerText = isHidden ? '▲' : '▼';
      if (isHidden && typeof onExpand === 'function') onExpand();
    });
  };

  wireCollapsible('btn-toggle-projection', 'projection-content', 'projection-planning-card', calculateProjection);
  wireCollapsible('btn-toggle-criteria', 'criteria-content', 'criteria-card');
  
  // Print preview trigger
  els.btnPrintPreview.addEventListener('click', openPreviewModal);

  els.btnModalClose.addEventListener('click', closePreviewModal);

  els.previewModal.addEventListener('keydown', trapModalFocus);
  els.previewModal.addEventListener('click', (e) => {
    if (e.target === els.previewModal) closePreviewModal();
  });

  const btnClearData = document.getElementById('btn-clear-data');
  if (btnClearData) btnClearData.addEventListener('click', clearSavedData);
  
  // Native print trigger
  els.btnPrint.addEventListener('click', () => {
    window.print();
  });
  
  els.btnModalPrint.addEventListener('click', () => {
    window.print();
  });
}

// Start app
window.addEventListener('DOMContentLoaded', init);
