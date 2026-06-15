// test_thresholds.js
// Guards the regulatory data in thresholds.json. Run with:
//   node test_thresholds.js
//
// Two layers of protection:
//   1. EVERGREEN checks — structural/consistency rules that must hold for ANY
//      year (e.g. the assessment-year threshold must equal the rounded mean of
//      the three referenced yearly values). These catch a bad scrape or a typo.
//   2. SNAPSHOT checks — the exact dollar values FDA publishes RIGHT NOW under
//      the "Produce Safety" section of:
//      https://www.fda.gov/food/food-safety-modernization-act-fsma/fsma-inflation-adjusted-cut-offs
//      Verified against the live FDA page on 2026-06-15.
//
// WHEN FDA UPDATES (every spring): confirm the new figures on the FDA page
// above, update thresholds.json, then update the EXPECTED_* constants below to
// match. The snapshot check is intentional friction so the numbers a farmer
// hands an FDA inspector can never silently drift from the official source.

const thresholds = require('./thresholds.json');

// ---- Exact FDA-published values (Produce Safety section). Update deliberately. ----
const EXPECTED_YEARLY = {
  "2021": { produce: 30112, food: 602234 },
  "2022": { produce: 32253, food: 645068 },
  "2023": { produce: 33447, food: 668937 },
  "2024": { produce: 34277, food: 685541 },
  "2025": { produce: 35247, food: 704950 }
};
const EXPECTED_ASSESSMENT = {
  "2026": {
    produce_threshold: 34324,      // FDA "Average 3 Year Value for 2023 - 2025", $25,000 baseline
    total_food_threshold: 686476,  // FDA "Average 3 Year Value for 2023 - 2025", $500,000 baseline
    years_used: [2023, 2024, 2025]
  }
};

// Plausible bands (same spirit as update_thresholds.py's validation).
const PRODUCE_MIN = 25000, PRODUCE_MAX = 100000;
const FOOD_MIN = 500000, FOOD_MAX = 2000000;

let failures = 0;
function check(label, condition, detail) {
  if (condition) {
    console.log(`[\x1b[32mPASS\x1b[0m] ${label}`);
  } else {
    failures++;
    console.log(`[\x1b[31mFAIL\x1b[0m] ${label}${detail ? `  — ${detail}` : ''}`);
  }
}

console.log("Verifying thresholds.json against FDA-published figures...\n");

// ---- 1. Evergreen structural / consistency checks ----
const years = thresholds.assessment_years || {};
check("assessment_years is non-empty", Object.keys(years).length > 0);

Object.keys(years).forEach((yr) => {
  const data = years[yr];
  const p = data.produce_threshold;
  const f = data.total_food_threshold;

  check(`${yr}: produce_threshold within [${PRODUCE_MIN}, ${PRODUCE_MAX}]`,
    p >= PRODUCE_MIN && p <= PRODUCE_MAX, `got ${p}`);
  check(`${yr}: total_food_threshold within [${FOOD_MIN}, ${FOOD_MAX}]`,
    f >= FOOD_MIN && f <= FOOD_MAX, `got ${f}`);
  check(`${yr}: produce_threshold < total_food_threshold`, p < f, `${p} vs ${f}`);

  check(`${yr}: years_used is 3 ascending years`,
    Array.isArray(data.years_used) && data.years_used.length === 3 &&
    data.years_used[0] < data.years_used[1] && data.years_used[1] < data.years_used[2],
    JSON.stringify(data.years_used));

  // The published 3-year average must equal the rounded mean of the referenced
  // single-year values. This is the core anti-scrape-error check.
  if (Array.isArray(data.years_used) && data.years_used.length === 3) {
    const yv = thresholds.yearly_values || {};
    const haveAll = data.years_used.every((y) => yv[String(y)] &&
      typeof yv[String(y)].produce === 'number' && typeof yv[String(y)].food === 'number');
    check(`${yr}: all referenced years exist in yearly_values`, haveAll,
      JSON.stringify(data.years_used));

    if (haveAll) {
      const meanProduce = Math.round(data.years_used.reduce((s, y) => s + yv[String(y)].produce, 0) / 3);
      const meanFood = Math.round(data.years_used.reduce((s, y) => s + yv[String(y)].food, 0) / 3);
      check(`${yr}: produce_threshold equals rounded mean of years_used`,
        p === meanProduce, `threshold ${p} vs mean ${meanProduce}`);
      check(`${yr}: total_food_threshold equals rounded mean of years_used`,
        f === meanFood, `threshold ${f} vs mean ${meanFood}`);
    }
  }
});

// ---- 2. Snapshot checks against the exact current FDA figures ----
Object.keys(EXPECTED_YEARLY).forEach((yr) => {
  const exp = EXPECTED_YEARLY[yr];
  const got = (thresholds.yearly_values || {})[yr];
  check(`FDA snapshot: yearly_values[${yr}].produce === ${exp.produce}`,
    got && got.produce === exp.produce, got ? `got ${got.produce}` : 'missing year');
  check(`FDA snapshot: yearly_values[${yr}].food === ${exp.food}`,
    got && got.food === exp.food, got ? `got ${got.food}` : 'missing year');
});

Object.keys(EXPECTED_ASSESSMENT).forEach((yr) => {
  const exp = EXPECTED_ASSESSMENT[yr];
  const got = years[yr];
  check(`FDA snapshot: ${yr} produce_threshold === ${exp.produce_threshold}`,
    got && got.produce_threshold === exp.produce_threshold, got ? `got ${got.produce_threshold}` : 'missing year');
  check(`FDA snapshot: ${yr} total_food_threshold === ${exp.total_food_threshold}`,
    got && got.total_food_threshold === exp.total_food_threshold, got ? `got ${got.total_food_threshold}` : 'missing year');
  check(`FDA snapshot: ${yr} years_used === [${exp.years_used.join(', ')}]`,
    got && JSON.stringify(got.years_used) === JSON.stringify(exp.years_used),
    got ? JSON.stringify(got.years_used) : 'missing year');
});

console.log("");
if (failures === 0) {
  console.log("All threshold checks passed — thresholds.json matches the FDA figures.");
  process.exit(0);
} else {
  console.log(`${failures} threshold check(s) FAILED. Do not ship until thresholds.json matches the FDA page.`);
  process.exit(1);
}
