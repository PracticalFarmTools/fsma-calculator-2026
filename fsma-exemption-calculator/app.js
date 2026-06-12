/* app.js - FSMA Exemption Calculator Client Logic */

// Offline Fallback Thresholds in case thresholds.json cannot be fetched
const FALLBACK_THRESHOLDS = {
  "last_updated": "2026-06-10",
  "assessment_years": {
    "2026": {
      "produce_threshold": 34324,
      "total_food_threshold": 686476,
      "years_used": [2023, 2024, 2025]
    },
    "2025": {
      "produce_threshold": 33326,
      "total_food_threshold": 666515,
      "years_used": [2022, 2023, 2024]
    }
  }
};

let activeThresholds = FALLBACK_THRESHOLDS;

// Register Service Worker for PWA Offline support
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js')
      .then((reg) => console.log('[Service Worker] Registered successfully:', reg.scope))
      .catch((err) => console.error('[Service Worker] Registration failed:', err));
  });
}

// State management
let state = {
  farmName: "",
  farmAddress: "",
  farmState: "ME",
  stateManuallySet: false,
  contactName: "",
  contactPhone: "",
  contactEmail: "",
  assessmentYear: "2026",
  sales: {
    // We map keys by relative index 0, 1, 2 for the three preceding years
    produce: [0, 0, 0],
    food: [0, 0, 0],
    local: [0, 0, 0]
  },
  projections: {
    produce: "",
    food: "",
    local: ""
  }
};

// UI Elements
const els = {
  farmName: document.getElementById('farm-name'),
  farmAddress: document.getElementById('farm-address'),
  farmState: document.getElementById('farm-state'),
  contactName: document.getElementById('contact-name'),
  contactPhone: document.getElementById('contact-phone'),
  contactEmail: document.getElementById('contact-email'),
  assessmentYear: document.getElementById('assessment-year'),
  
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
  populateYearOptions();
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
      console.log('Successfully loaded thresholds database:', activeThresholds);
      els.syncBadge.innerText = `Updated ${activeThresholds.last_updated || 'recently'}`;
    } else {
      console.warn('thresholds.json returned status', res.status, '- using offline fallback data.');
      activeThresholds = FALLBACK_THRESHOLDS;
      els.syncBadge.innerText = `Offline Thresholds`;
    }
  } catch (err) {
    console.warn('Could not fetch thresholds.json. Using offline fallback data.', err);
    activeThresholds = FALLBACK_THRESHOLDS;
    els.syncBadge.innerText = `Offline Thresholds`;
  }
}

// Build the assessment-year dropdown from the loaded thresholds (newest first)
function populateYearOptions() {
  const years = Object.keys(activeThresholds.assessment_years || {}).sort((a, b) => Number(b) - Number(a));
  if (!years.length) return;
  
  els.assessmentYear.innerHTML = '';
  years.forEach((yr) => {
    const data = activeThresholds.assessment_years[yr];
    const opt = document.createElement('option');
    opt.value = yr;
    opt.textContent = `${yr} (Uses ${data.years_used[0]} - ${data.years_used[2]} records)`;
    els.assessmentYear.appendChild(opt);
  });
  
  // Default to the newest assessment year; loadSavedState may override this
  els.assessmentYear.value = years[0];
  state.assessmentYear = years[0];
}

// Set up online/offline event listeners
function setupNetworkMonitoring() {
  const updateStatus = () => {
    if (navigator.onLine) {
      els.offlineBadge.style.display = 'none';
    } else {
      els.offlineBadge.style.display = 'inline-flex';
      els.offlineBadge.innerText = '📡 Offline Mode';
    }
  };
  window.addEventListener('online', updateStatus);
  window.addEventListener('offline', updateStatus);
  updateStatus();
}

// Load state from LocalStorage
function loadSavedState() {
  try {
    const saved = localStorage.getItem('fsma_calculator_state');
    if (saved) {
      const parsed = JSON.parse(saved);
      // Ensure structure is correct
      if (parsed.sales && parsed.sales.produce) {
        state = parsed;
        if (!state.projections) {
          state.projections = { produce: "", food: "", local: "" };
        }
        if (state.stateManuallySet === undefined) {
          state.stateManuallySet = false;
        }
        
        // Populate inputs
        els.farmName.value = state.farmName || "";
        els.farmAddress.value = state.farmAddress || "";
        els.farmState.value = state.farmState || "ME";
        els.contactName.value = state.contactName || "";
        els.contactPhone.value = state.contactPhone || "";
        els.contactEmail.value = state.contactEmail || "";
        
        // Restore saved assessment year only if it still exists in the dropdown;
        // otherwise fall back to the newest available year
        if (state.assessmentYear && els.assessmentYear.querySelector(`option[value="${state.assessmentYear}"]`)) {
          els.assessmentYear.value = state.assessmentYear;
        } else {
          state.assessmentYear = els.assessmentYear.value;
        }
        
        for (let i = 0; i < 3; i++) {
          els.produceInputs[i].value = (state.sales.produce[i] !== undefined && state.sales.produce[i] !== null && state.sales.produce[i] !== "") ? state.sales.produce[i] : "";
          els.foodInputs[i].value = (state.sales.food[i] !== undefined && state.sales.food[i] !== null && state.sales.food[i] !== "") ? state.sales.food[i] : "";
          els.localInputs[i].value = (state.sales.local[i] !== undefined && state.sales.local[i] !== null && state.sales.local[i] !== "") ? state.sales.local[i] : "";
        }
        
        if (state.projections) {
          const pProj = document.getElementById('proj-produce');
          const fProj = document.getElementById('proj-food');
          const lProj = document.getElementById('proj-local');
          if (pProj) pProj.value = (state.projections.produce !== undefined && state.projections.produce !== null && state.projections.produce !== "") ? state.projections.produce : "";
          if (fProj) fProj.value = (state.projections.food !== undefined && state.projections.food !== null && state.projections.food !== "") ? state.projections.food : "";
          if (lProj) lProj.value = (state.projections.local !== undefined && state.projections.local !== null && state.projections.local !== "") ? state.projections.local : "";
        }
      }
    }
  } catch (e) {
    console.error('Failed to load local state:', e);
  }
}

// Save state to LocalStorage
function saveState() {
  try {
    localStorage.setItem('fsma_calculator_state', JSON.stringify(state));
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
  els.pThresholdUpdate.innerText = activeThresholds.last_updated || '2026-06-10';
  els.pThresholdProduce.innerText = `$${yearData.produce_threshold.toLocaleString()}`;
  els.pThresholdFood.innerText = `$${yearData.total_food_threshold.toLocaleString()}`;
  for (let i = 0; i < 3; i++) {
    els.pYearLabels[i].innerText = years[i];
  }
  
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

// Auto-detect the farm state from the address field (e.g. "... Nobleboro, ME 04555").
// Only runs while the user types in the address field, and never overrides a state
// the user has explicitly chosen from the dropdown.
function autoDetectStateFromAddress() {
  if (state.stateManuallySet) return;
  const addressVal = els.farmAddress.value || "";
  const stateMatch = addressVal.match(/\b([A-Z]{2})\b(?:\s+\d{5}(?:-\d{4})?)?\s*$/i);
  if (stateMatch) {
    const code = stateMatch[1].toUpperCase();
    if (els.farmState.querySelector(`option[value="${code}"]`) && els.farmState.value !== code) {
      els.farmState.value = code;
      state.farmState = code;
    }
  }
}

// Main Exemption Calculation Logic
function calculateExemption() {
  const yearData = activeThresholds.assessment_years[state.assessmentYear];
  if (!yearData) return;

  // Calculate averages
  let sumProduce = 0, sumFood = 0, sumLocal = 0;
  let hasInputs = false;
  
  for (let i = 0; i < 3; i++) {
    const pVal = parseFloat(els.produceInputs[i].value) || 0;
    const fVal = parseFloat(els.foodInputs[i].value) || 0;
    const lVal = parseFloat(els.localInputs[i].value) || 0;
    
    // Save to state
    state.sales.produce[i] = els.produceInputs[i].value ? pVal : "";
    state.sales.food[i] = els.foodInputs[i].value ? fVal : "";
    state.sales.local[i] = els.localInputs[i].value ? lVal : "";
    
    sumProduce += pVal;
    sumFood += fVal;
    sumLocal += lVal;
    
    if (els.produceInputs[i].value || els.foodInputs[i].value || els.localInputs[i].value) {
      hasInputs = true;
    }
  }
  
  saveState();
  
  if (!hasInputs) {
    resetResults();
    return;
  }
  
  // Validation checks
  let warningMsg = "";
  for (let i = 0; i < 3; i++) {
    const yr = yearData.years_used[i];
    const pVal = parseFloat(els.produceInputs[i].value) || 0;
    const fVal = parseFloat(els.foodInputs[i].value) || 0;
    const lVal = parseFloat(els.localInputs[i].value) || 0;
    
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

  // Count the number of active years with data to use as correct denominator
  let activeYearsCount = 0;
  for (let i = 0; i < 3; i++) {
    const hasProduce = els.produceInputs[i].value.trim() !== "";
    const hasFood = els.foodInputs[i].value.trim() !== "";
    const hasLocal = els.localInputs[i].value.trim() !== "";
    if (hasProduce || hasFood || hasLocal) {
      activeYearsCount++;
    }
  }
  const denominator = activeYearsCount || 1;

  const exactAvgProduce = sumProduce / denominator;
  const exactAvgFood = sumFood / denominator;
  const exactAvgLocal = sumLocal / denominator;

  const avgProduce = Math.round(exactAvgProduce);
  const avgFood = Math.round(exactAvgFood);
  const avgLocal = Math.round(exactAvgLocal);
  const localPct = avgFood > 0 ? Math.round((avgLocal / avgFood) * 100) : 0;
  
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
  if (exactAvgProduce <= yearData.produce_threshold) {
    status = "exempt";
    badgeText = `Fully Exempt (Produce Sales ≤ $${yearData.produce_threshold.toLocaleString()})`;
    badgeClass = "status-exempt";
    bannerClass = "exemption-banner status-exempt";
    explanationText = `Your farm is not covered by the Produce Safety Rule because your rolling average produce sales ($${avgProduce.toLocaleString()}) do not exceed the FDA's inflation-adjusted limit of $${yearData.produce_threshold.toLocaleString()}. You do not need to comply with the general requirements of the Produce Safety Rule.`;
    citationText = `<strong>Legal Citation: 21 CFR § 112.4(a)</strong> — A farm is not covered by the Produce Safety Rule if its average annual value of produce sold during the previous 3-year period does not exceed $25,000 (adjusted for inflation: $${yearData.produce_threshold.toLocaleString()} for the ${state.assessmentYear} claim year). <br><br><strong>Recordkeeping Best Practice:</strong> Although not covered by the rule, you should retain your yearly tax returns and crop sales records for at least 3 years to document and verify your exempt status during audits or inspections.`;
  }
  // Scenario 2: Qualified Exemption (Partially Exempt)
  // § 112.5: Average annual food sales are less than $500,000 (adjusted for inflation) AND the majority (>50%) is sold to qualified end-users.
  else if (exactAvgFood < yearData.total_food_threshold && sumLocal > (sumFood * 0.5)) {
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
  const profileFilled = els.farmName.value.trim() !== "" && els.contactName.value.trim() !== "";
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
            <li>Your farm is fully covered by the Produce Safety Rule.</li>
            <li>You must implement the full standards for growing, harvesting, packing, and holding produce.</li>
            <li>Attend a PSA Grower Training course to understand your regulatory obligations.</li>
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
        helperHintEl.innerHTML = "⚠️ Fill in <strong>Farm Legal Name</strong> and <strong>Owner/Operator Name</strong> in Step 1 to enable printing.";
      }
      helperHintEl.classList.remove('hidden');
    }
  }
  
  // Update print sheet values
  els.pFarmName.innerText = els.farmName.value || "--";
  els.pFarmAddress.innerText = els.farmAddress.value || "--";
  els.pContactName.innerText = els.contactName.value || "--";
  els.pContactPhone.innerText = els.contactPhone.value || "--";
  els.pContactEmail.innerText = els.contactEmail.value || "--";
  els.pCalcDate.innerText = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  
  // Update state-specific declarations in compliance printout
  const STATE_NAMES = {
    "AL": "Alabama", "AK": "Alaska", "AZ": "Arizona", "AR": "Arkansas", "CA": "California",
    "CO": "Colorado", "CT": "Connecticut", "DE": "Delaware", "FL": "Florida", "GA": "Georgia",
    "HI": "Hawaii", "ID": "Idaho", "IL": "Illinois", "IN": "Indiana", "IA": "Iowa",
    "KS": "Kansas", "KY": "Kentucky", "LA": "Louisiana", "ME": "Maine", "MD": "Maryland",
    "MA": "Massachusetts", "MI": "Michigan", "MN": "Minnesota", "MS": "Mississippi", "MO": "Missouri",
    "MT": "Montana", "NE": "Nebraska", "NV": "Nevada", "NH": "New Hampshire", "NJ": "New Jersey",
    "NM": "New Mexico", "NY": "New York", "NC": "North Carolina", "ND": "North Dakota", "OH": "Ohio",
    "OK": "Oklahoma", "OR": "Oregon", "PA": "Pennsylvania", "RI": "Rhode Island", "SC": "South Carolina",
    "SD": "South Dakota", "TN": "Tennessee", "TX": "Texas", "UT": "Utah", "VT": "Vermont",
    "VA": "Virginia", "WA": "Washington", "WV": "West Virginia", "WI": "Wisconsin", "WY": "Wyoming"
  };
  const selectedState = els.farmState.value || "ME";
  const stateFullName = STATE_NAMES[selectedState] || selectedState;
  
  const pDecState = document.getElementById('p-declaration-state');
  const pInspState = document.getElementById('p-inspection-state');
  if (pDecState) pDecState.innerText = stateFullName;
  if (pInspState) pInspState.innerText = stateFullName;

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
  
  const pProj = parseFloat(pProjInput.value) || 0;
  const fProj = parseFloat(fProjInput.value) || 0;
  const lProj = parseFloat(lProjInput.value) || 0;
  
  // Save to state
  state.projections = {
    produce: pProjInput.value ? pProj : "",
    food: fProjInput.value ? fProj : "",
    local: lProjInput.value ? lProj : ""
  };
  saveState();
  
  const projStatusBadge = document.getElementById('proj-status-badge');
  const projStatusExplanation = document.getElementById('proj-status-explanation');
  
  const hasInputs = pProjInput.value.trim() !== "" || fProjInput.value.trim() !== "" || lProjInput.value.trim() !== "";
  
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
  
  // Fetch historical values from Step 2 (Year 2 and Year 3)
  const pYr2 = parseFloat(els.produceInputs[1].value) || 0;
  const pYr3 = parseFloat(els.produceInputs[2].value) || 0;
  
  const fYr2 = parseFloat(els.foodInputs[1].value) || 0;
  const fYr3 = parseFloat(els.foodInputs[2].value) || 0;
  
  const lYr2 = parseFloat(els.localInputs[1].value) || 0;
  const lYr3 = parseFloat(els.localInputs[2].value) || 0;
  
  // Averages (3-year rolling including projected year)
  const avgProduce = Math.round((pYr2 + pYr3 + pProj) / 3);
  const avgFood = Math.round((fYr2 + fYr3 + fProj) / 3);
  const avgLocal = Math.round((lYr2 + lYr3 + lProj) / 3);
  const localPct = avgFood > 0 ? Math.round((avgLocal / avgFood) * 100) : 0;
  
  // Determine projected status
  let status = "";
  let badgeText = "";
  let badgeClass = "";
  let explanationText = "";
  
  if (avgProduce <= yearData.produce_threshold) {
    status = "exempt";
    badgeText = "Projected Exempt";
    badgeClass = "status-exempt";
    explanationText = `Based on projections, your estimated rolling average produce sales ($${avgProduce.toLocaleString()}) remain below the $${yearData.produce_threshold.toLocaleString()} threshold. Your farm would remain <strong>Fully Exempt</strong> next year.`;
  } else if (avgFood < yearData.total_food_threshold && (lYr2 + lYr3 + lProj) > ((fYr2 + fYr3 + fProj) * 0.5)) {
    status = "qualified";
    badgeText = "Projected Qualified Exempt";
    badgeClass = "status-qualified";
    explanationText = `Based on projections, your estimated rolling average total food sales ($${avgFood.toLocaleString()}) are below the $${yearData.total_food_threshold.toLocaleString()} threshold, and the majority (${localPct}%) would be sold directly to qualified end-users. Your farm would qualify for a <strong>Qualified Exemption</strong> next year.`;
  } else {
    status = "not_exempt";
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
  els.avgLocalPercent.innerText = "0%";
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
  
  // Year selector
  els.assessmentYear.addEventListener('change', (e) => {
    state.assessmentYear = e.target.value;
    updateYearsAndLimits();
    calculateExemption();
  });
  
  // Numeric sales inputs
  const inputsList = [...els.produceInputs, ...els.foodInputs, ...els.localInputs];
  inputsList.forEach((input) => {
    input.addEventListener('input', () => {
      calculateExemption();
    });
  });
  
  // Projections inputs
  const pProj = document.getElementById('proj-produce');
  const fProj = document.getElementById('proj-food');
  const lProj = document.getElementById('proj-local');
  if (pProj) pProj.addEventListener('input', calculateProjection);
  if (fProj) fProj.addEventListener('input', calculateProjection);
  if (lProj) lProj.addEventListener('input', calculateProjection);
  
  // Projection collapsible trigger
  const btnToggleProj = document.getElementById('btn-toggle-projection');
  const projContent = document.getElementById('projection-content');
  const projCard = document.getElementById('projection-planning-card');
  if (btnToggleProj && projContent && projCard) {
    btnToggleProj.addEventListener('click', () => {
      const isHidden = projContent.classList.contains('hidden');
      if (isHidden) {
        projContent.classList.remove('hidden');
        projCard.classList.add('expanded');
        btnToggleProj.setAttribute('aria-expanded', 'true');
        btnToggleProj.querySelector('.trigger-icon').innerText = '▲';
        calculateProjection();
      } else {
        projContent.classList.add('hidden');
        projCard.classList.remove('expanded');
        btnToggleProj.setAttribute('aria-expanded', 'false');
        btnToggleProj.querySelector('.trigger-icon').innerText = '▼';
      }
    });
  }
  
  // Print preview trigger
  els.btnPrintPreview.addEventListener('click', () => {
    // Clone the print letter and strip all IDs from the copy so the modal
    // never creates duplicate IDs that could hijack getElementById updates
    const letterClone = document.getElementById('print-letter').cloneNode(true);
    letterClone.querySelectorAll('[id]').forEach((el) => el.removeAttribute('id'));
    els.modalLetterContent.innerHTML = letterClone.innerHTML;
    els.previewModal.classList.remove('hidden');
    document.body.style.overflow = 'hidden'; // Lock background scrolling
  });
  
  els.btnModalClose.addEventListener('click', () => {
    els.previewModal.classList.add('hidden');
    document.body.style.overflow = '';
  });
  
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
