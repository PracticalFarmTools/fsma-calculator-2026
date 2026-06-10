// test_scenarios.js
// Standalone calculation tests to verify our 4 farmer scenarios.

const thresholds = require('./thresholds.json');

const scenarios = [
  {
    name: "Persona A: Clara Vance (Small diversified veg grower, Maine)",
    assessmentYear: "2026",
    sales: {
      produce: [28000, 31000, 29000],
      food: [28000, 31000, 29000],
      local: [28000, 31000, 29000]
    },
    expectedStatus: "exempt"
  },
  {
    name: "Persona B: Jedediah Miller (Large dairy, beef, hay & small pumpkin patch, Pennsylvania)",
    assessmentYear: "2026",
    sales: {
      produce: [42000, 48000, 45000],
      food: [1100000, 1300000, 1200000],
      local: [1100000, 1300000, 1200000]
    },
    expectedStatus: "not_exempt"
  },
  {
    name: "Persona C: Liam O'Connor (Mid-size berry orchard + jams, Oregon)",
    assessmentYear: "2026",
    sales: {
      produce: [75000, 85000, 80000],
      food: [480000, 520000, 500000],
      local: [290000, 310000, 300000]
    },
    expectedStatus: "qualified"
  },
  {
    name: "Persona D: Sophia Russo (New farm, 1st year of sales, Massachusetts)",
    assessmentYear: "2026",
    sales: {
      produce: [28000, 0, 0],
      food: [40000, 0, 0],
      local: [40000, 0, 0]
    },
    expectedStatus: "exempt"
  }
];

function runTest(scenario) {
  const yearData = thresholds.assessment_years[scenario.assessmentYear];
  if (!yearData) {
    throw new Error(`Year data not found for ${scenario.assessmentYear}`);
  }

  // Count the number of active years with data to use as correct denominator
  let activeYearsCount = 0;
  let sumProduce = 0, sumFood = 0, sumLocal = 0;
  
  for (let i = 0; i < 3; i++) {
    const pVal = scenario.sales.produce[i];
    const fVal = scenario.sales.food[i];
    const lVal = scenario.sales.local[i];
    
    if (pVal > 0 || fVal > 0 || lVal > 0) {
      activeYearsCount++;
      sumProduce += pVal;
      sumFood += fVal;
      sumLocal += lVal;
    }
  }
  
  const denominator = activeYearsCount || 1;
  const exactAvgProduce = sumProduce / denominator;
  const exactAvgFood = sumFood / denominator;
  const exactAvgLocal = sumLocal / denominator;
  
  let status = "";
  if (exactAvgProduce <= yearData.produce_threshold) {
    status = "exempt";
  } else if (exactAvgFood < yearData.total_food_threshold && sumLocal > (sumFood * 0.5)) {
    status = "qualified";
  } else {
    status = "not_exempt";
  }
  
  const pass = status === scenario.expectedStatus;
  console.log(`[\x1b[32m${pass ? 'PASS' : 'FAIL'}\x1b[0m] ${scenario.name}`);
  console.log(`      Average Produce: $${exactAvgProduce.toFixed(2)} (Threshold: $${yearData.produce_threshold})`);
  console.log(`      Average Food:    $${exactAvgFood.toFixed(2)} (Threshold: $${yearData.total_food_threshold})`);
  console.log(`      Average Local:   $${exactAvgLocal.toFixed(2)} (${(exactAvgFood > 0 ? (exactAvgLocal / exactAvgFood * 100) : 0).toFixed(1)}%)`);
  console.log(`      Calculated Status: ${status} | Expected: ${scenario.expectedStatus}\n`);
  return pass;
}

console.log("Running Farmer Persona Testing Scenarios...\n");
let allPass = true;
scenarios.forEach(s => {
  const result = runTest(s);
  if (!result) allPass = false;
});

if (allPass) {
  console.log("All farmer persona tests passed successfully!");
  process.exit(0);
} else {
  console.log("Some farmer persona tests failed.");
  process.exit(1);
}
