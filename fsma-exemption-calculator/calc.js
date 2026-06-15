/* calc.js — Single source of truth for the FSMA exemption calculation.
 *
 * This is the ONLY place the exemption rule and the 3-year averaging live.
 * Both the app (app.js, in the browser) and the test suite (test_scenarios.js,
 * in Node) call computeExemption() so the shipped code is exactly what the
 * tests verify. Do not duplicate this logic anywhere else.
 *
 * Input model (matches what the UI stores in state.sales):
 *   sales = {
 *     produce: [v, v, v],   // index 0 = oldest year, 2 = newest
 *     food:    [v, v, v],
 *     local:   [v, v, v]
 *   }
 *   Each v is either a NUMBER or "" (blank).
 *     - blank ("")  => the farm was NOT in business that year; the year is
 *                      excluded from the rolling-average denominator.
 *     - 0 (number)  => the farm WAS in business but had $0 of that sale type;
 *                      the year IS counted in the denominator.
 *   This blank-vs-zero distinction is load-bearing for new/partial-year farms,
 *   which is why the UI tells farmers to leave a year blank only if they were
 *   not yet in business.
 *
 * The exemption rule (21 CFR Part 112), in priority order:
 *   1. Fully exempt / not covered (§ 112.4(a)): rolling-average produce sales
 *      do NOT exceed the inflation-adjusted produce threshold. Coverage applies
 *      only to farms with "more than" the threshold, so "<=" is exempt.
 *   2. Qualified exemption (§ 112.5): rolling-average TOTAL FOOD sales are
 *      strictly LESS THAN the food threshold AND sales to qualified end-users
 *      exceed sales to all other buyers (i.e. local > 50% of total food).
 *   3. Otherwise: not exempt (fully covered).
 */
(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;          // Node (test suites)
  } else {
    root.FSMACalc = api;           // Browser (window.FSMACalc)
  }
})(typeof self !== 'undefined' ? self : this, function () {

  // A field is "blank" only when it is an empty value — NOT when it is 0.
  function isBlank(v) {
    return v === '' || v === null || v === undefined;
  }

  // Numeric value of a stored field, ignoring commas; blank/invalid => 0.
  function toNum(v) {
    if (isBlank(v)) return 0;
    const n = parseFloat(String(v).replace(/,/g, '').trim());
    return isNaN(n) ? 0 : n;
  }

  // Decide the exemption status from the rolling-average figures.
  // Kept as its own function so the rule is expressed exactly once.
  function classify(exactAvgProduce, exactAvgFood, sumLocal, sumFood, yearData) {
    if (exactAvgProduce <= yearData.produce_threshold) return 'exempt';
    if (exactAvgFood < yearData.total_food_threshold && sumLocal > (sumFood * 0.5)) return 'qualified';
    return 'not_exempt';
  }

  function computeExemption(sales, yearData) {
    let sumProduce = 0, sumFood = 0, sumLocal = 0;
    let activeYearsCount = 0;

    for (let i = 0; i < 3; i++) {
      sumProduce += toNum(sales.produce[i]);
      sumFood += toNum(sales.food[i]);
      sumLocal += toNum(sales.local[i]);

      // A year counts toward the average if the farm reported ANY figure for it
      // (including an explicit 0). All-blank years are treated as not-in-business.
      if (!isBlank(sales.produce[i]) || !isBlank(sales.food[i]) || !isBlank(sales.local[i])) {
        activeYearsCount++;
      }
    }

    const hasInputs = activeYearsCount > 0;
    const denominator = activeYearsCount || 1;

    const exactAvgProduce = sumProduce / denominator;
    const exactAvgFood = sumFood / denominator;
    const exactAvgLocal = sumLocal / denominator;

    const avgProduce = Math.round(exactAvgProduce);
    const avgFood = Math.round(exactAvgFood);
    const avgLocal = Math.round(exactAvgLocal);
    // Percent from the same totals the § 112.5 decision uses (sumLocal vs sumFood),
    // shown to one decimal so a near-50% result never reads "50%" when it failed.
    const localPctExact = sumFood > 0 ? (sumLocal / sumFood) * 100 : 0;
    const localPctDisplay = localPctExact.toFixed(1);
    const localPct = Math.round(localPctExact);

    const status = classify(exactAvgProduce, exactAvgFood, sumLocal, sumFood, yearData);

    return {
      hasInputs,
      activeYearsCount,
      sumProduce, sumFood, sumLocal,
      exactAvgProduce, exactAvgFood, exactAvgLocal,
      avgProduce, avgFood, avgLocal,
      localPctExact, localPctDisplay, localPct,
      status
    };
  }

  return { computeExemption, classify, toNum, isBlank };
});
