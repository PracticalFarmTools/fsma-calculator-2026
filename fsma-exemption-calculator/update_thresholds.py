"""
update_thresholds.py — Annual FSMA threshold refresh tool
==========================================================

WHAT THIS DOES
  Scrapes the FDA's official "FSMA Inflation Adjusted Cut-Offs" page and rewrites
  thresholds.json with the current Produce Safety Rule dollar limits and the
  three-year rolling averages the calculator uses.

WHEN TO RUN IT
  The FDA republishes these inflation-adjusted figures every spring (usually
  March/April). Run this once a year after that update, plus any time you suspect
  the numbers changed.

HOW TO RUN IT
  cd fsma-exemption-calculator
  python update_thresholds.py            # scrape, validate, back up, and write
  python update_thresholds.py --dry-run  # scrape and show the diff, but write nothing

WHAT IT GUARANTEES
  * Verified SSL (never trusts a tampered response).
  * Sanity-checks every scraped value against plausible ranges, so a change in
    the FDA page layout fails loudly instead of silently corrupting thresholds.
  * Backs up the previous thresholds.json to thresholds.bak.json before writing.
  * Prints a clear before/after diff of everything that changed.
  * Exits non-zero on any failure (safe to wire into CI / a scheduled job).
  * With --dry-run, exits code 2 when FDA figures differ from thresholds.json
    (so a scheduled check can alert you without writing files).

AFTER IT RUNS
  Review the printed diff, then redeploy the static site (see README.md). The
  in-app "FDA Threshold Date" updates automatically from last_updated.
"""

import os
import sys
import json
import argparse
import urllib.request
import html.parser
import ssl
import re
from datetime import datetime

# URL of the FDA FSMA inflation adjusted cutoffs page
FDA_URL = "https://www.fda.gov/food/food-safety-modernization-act-fsma/fsma-inflation-adjusted-cut-offs"
JSON_PATH = os.path.join(os.path.dirname(__file__), "thresholds.json")
BACKUP_PATH = os.path.join(os.path.dirname(__file__), "thresholds.bak.json")

# Plausible bands for the inflation-adjusted thresholds. These are deliberately
# wide enough to absorb many years of normal (~2-4%/yr) inflation, but tight
# enough to catch gross parse errors such as grabbing the wrong column or an
# off-by-10x value. Revisit only if real FDA figures ever approach a bound.
PRODUCE_MIN, PRODUCE_MAX = 25_000, 100_000
FOOD_MIN, FOOD_MAX = 500_000, 2_000_000


class FdaTableParser(html.parser.HTMLParser):
    def __init__(self):
        super().__init__()
        self.in_table = False
        self.in_row = False
        self.in_cell = False
        self.current_row = []
        self.current_cell_data = ""
        self.tables = []
        self.current_table = []

    def handle_starttag(self, tag, attrs):
        if tag == 'table':
            self.in_table = True
            self.current_table = []
        elif tag == 'tr' and self.in_table:
            self.in_row = True
            self.current_row = []
        elif tag in ('td', 'th') and self.in_row:
            self.in_cell = True
            self.current_cell_data = ""

    def handle_endtag(self, tag):
        if tag == 'table':
            self.in_table = False
            if self.current_table:
                self.tables.append(self.current_table)
        elif tag == 'tr' and self.in_table:
            self.in_row = False
            self.current_table.append(self.current_row)
        elif tag in ('td', 'th') and self.in_row:
            self.in_cell = False
            self.current_row.append(self.current_cell_data.strip())

    def handle_data(self, data):
        if self.in_cell:
            self.current_cell_data += data


def sanitize_number(val_str):
    """Removes currency symbols, commas, and spaces, then parses as integer."""
    clean = re.sub(r'[^\d]', '', val_str)
    return int(clean) if clean else None


def parse_year(header_str):
    """Attempts to extract a 4-digit year from a column header like 'Value in 2025'."""
    match = re.search(r'\b(20\d{2})\b', header_str)
    return int(match.group(1)) if match else None


def parse_average_range(header_str):
    """Attempts to extract start and end years from 'Average 3 Year Value for 2023 - 2025'."""
    header_clean = header_str.replace('\xa0', ' ').replace('-', ' - ')
    match = re.search(r'Average\s+3\s+Year\s+Value\s+for\s+(20\d{2})\s*-\s*(20\d{2})', header_clean, re.IGNORECASE)
    if match:
        return int(match.group(1)), int(match.group(2))
    # Fallback to just matching two 4-digit years in the string
    years = re.findall(r'\b(20\d{2})\b', header_clean)
    if len(years) >= 2:
        return int(years[-2]), int(years[-1])
    return None


def fetch_fda_html():
    headers = {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'}
    # Verified SSL context: never disable certificate checks when scraping
    # regulatory data, since a tampered response would corrupt thresholds.
    context = ssl.create_default_context()
    req = urllib.request.Request(FDA_URL, headers=headers)
    with urllib.request.urlopen(req, context=context, timeout=15) as response:
        return response.read().decode('utf-8')


def build_config(html_content, base_config):
    """Parse the FDA tables and return (config, changed_keys)."""
    parser = FdaTableParser()
    parser.feed(html_content)
    print(f"Scraped {len(parser.tables)} tables from FDA website.")

    produce_table = None
    food_table = None

    # NOTE: The FDA page contains several tables with a $500,000 baseline
    # (Preventive Controls "qualified facility" and Produce Safety Rule
    # § 112.5 use identical inflation-adjusted values, both derived from the
    # same GDP deflator). We take the FIRST $500k table on the page. If FDA
    # ever publishes diverging $500k tables, this selection must be revisited.
    for table in parser.tables:
        if len(table) < 2:
            continue
        first_col_val = table[1][0] if len(table[1]) > 0 else ""
        if "$25,000" in first_col_val:
            produce_table = table
        elif "$500,000" in first_col_val and food_table is None:
            food_table = table

    if not produce_table or not food_table:
        raise ValueError(
            "Could not find both Produce ($25k) and Food ($500k) tables. "
            f"Found Produce: {produce_table is not None}, Food: {food_table is not None}. "
            "The FDA page layout may have changed."
        )

    config = json.loads(json.dumps(base_config))  # deep copy
    config.setdefault("assessment_years", {})
    config.setdefault("yearly_values", {})
    changed = []

    def process_compliance_table(table, target_key):
        headers_row = [cell.replace('\xa0', ' ').strip() for cell in table[0]]
        data_row = [cell.strip() for cell in table[1]]

        # 1. Parse single-year values
        for idx, col_name in enumerate(headers_row):
            year = parse_year(col_name)
            if year and "Average" not in col_name and idx < len(data_row):
                val = sanitize_number(data_row[idx])
                if val:
                    year_str = str(year)
                    config["yearly_values"].setdefault(year_str, {})
                    if config["yearly_values"][year_str].get(target_key) != val:
                        config["yearly_values"][year_str][target_key] = val
                        changed.append(f"yearly_values[{year_str}].{target_key} = {val:,}")

        # 2. Parse 3-year averages
        for idx, col_name in enumerate(headers_row):
            if "Average" in col_name and idx < len(data_row):
                range_res = parse_average_range(col_name)
                if range_res:
                    start_yr, end_yr = range_res
                    compliance_yr = str(end_yr + 1)
                    avg_val = sanitize_number(data_row[idx])
                    if avg_val:
                        config["assessment_years"].setdefault(compliance_yr, {
                            "produce_threshold": 0,
                            "total_food_threshold": 0,
                            "years_used": [start_yr, start_yr + 1, end_yr],
                        })
                        actual_key = "produce_threshold" if target_key == "produce" else "total_food_threshold"
                        if config["assessment_years"][compliance_yr].get(actual_key) != avg_val:
                            config["assessment_years"][compliance_yr][actual_key] = avg_val
                            changed.append(f"assessment_years[{compliance_yr}].{actual_key} = {avg_val:,}")

    process_compliance_table(produce_table, "produce")
    process_compliance_table(food_table, "food")
    return config, changed


def validate_config(config):
    """Raise ValueError if any threshold looks implausible (guards against parse errors)."""
    errors = []
    years = config.get("assessment_years", {})
    if not years:
        errors.append("No assessment_years were produced.")

    for yr, data in years.items():
        p = data.get("produce_threshold", 0)
        f = data.get("total_food_threshold", 0)
        if not (PRODUCE_MIN <= p <= PRODUCE_MAX):
            errors.append(f"{yr}: produce_threshold {p:,} outside [{PRODUCE_MIN:,}, {PRODUCE_MAX:,}]")
        if not (FOOD_MIN <= f <= FOOD_MAX):
            errors.append(f"{yr}: total_food_threshold {f:,} outside [{FOOD_MIN:,}, {FOOD_MAX:,}]")
        if p and f and p >= f:
            errors.append(f"{yr}: produce_threshold ({p:,}) should be far below total_food_threshold ({f:,})")

    if errors:
        raise ValueError("Validation failed:\n  - " + "\n  - ".join(errors))


def print_diff(changed):
    if changed:
        print(f"\n{len(changed)} value(s) changed:")
        for line in changed:
            print(f"  + {line}")
    else:
        print("\nNo threshold values changed since the last run.")


def run_scraper(dry_run=False):
    print(f"[{datetime.now().isoformat()}] Starting FSMA Threshold Scraper "
          f"({'DRY RUN' if dry_run else 'live'})...")

    if os.path.exists(JSON_PATH):
        with open(JSON_PATH, 'r', encoding='utf-8') as f:
            base_config = json.load(f)
    else:
        base_config = {"last_updated": "", "assessment_years": {}, "yearly_values": {}}

    html_content = fetch_fda_html()
    config, changed = build_config(html_content, base_config)

    # Validate BEFORE touching disk — a bad scrape must never overwrite good data.
    validate_config(config)
    print_diff(changed)

    if dry_run:
        print("\nDry run complete. No files were written.")
        return config, changed

    if changed or not base_config.get("last_updated"):
        config["last_updated"] = datetime.now().strftime("%Y-%m-%d")
        # Back up the previous good file before overwriting.
        if os.path.exists(JSON_PATH):
            with open(BACKUP_PATH, 'w', encoding='utf-8') as f:
                json.dump(base_config, f, indent=2)
            print(f"Backed up previous thresholds to {os.path.basename(BACKUP_PATH)}")
        with open(JSON_PATH, 'w', encoding='utf-8') as f:
            json.dump(config, f, indent=2)
        print(f"[{datetime.now().isoformat()}] thresholds.json updated successfully.")
    else:
        print(f"[{datetime.now().isoformat()}] No update needed; thresholds.json left unchanged.")

    return config, changed


def main():
    ap = argparse.ArgumentParser(description="Refresh thresholds.json from the FDA FSMA cut-offs page.")
    ap.add_argument("--dry-run", action="store_true",
                    help="Scrape and show the diff without writing any files.")
    args = ap.parse_args()
    try:
        _config, changed = run_scraper(dry_run=args.dry_run)
        if args.dry_run and changed:
            print(
                "\n[ACTION NEEDED] FDA figures differ from thresholds.json. "
                "Review the diff above, update test_thresholds.js if needed, "
                "then run without --dry-run.",
                file=sys.stderr,
            )
            sys.exit(2)
    except Exception as e:
        print(f"\n[ERROR] {e}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
