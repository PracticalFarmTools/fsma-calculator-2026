import os
import json
import urllib.request
import html.parser
import ssl
import re
from datetime import datetime

# URL of the FDA FSMA inflation adjusted cutoffs page
FDA_URL = "https://www.fda.gov/food/food-safety-modernization-act-fsma/fsma-inflation-adjusted-cut-offs"
JSON_PATH = os.path.join(os.path.dirname(__file__), "thresholds.json")

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

def run_scraper():
    print(f"[{datetime.now().isoformat()}] Starting FSMA Threshold Scraper...")
    headers = {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'}
    
    try:
        # Verified SSL context: never disable certificate checks when scraping
        # regulatory data, since a tampered response would corrupt thresholds.
        context = ssl.create_default_context()
        req = urllib.request.Request(FDA_URL, headers=headers)
        with urllib.request.urlopen(req, context=context, timeout=15) as response:
            html_content = response.read().decode('utf-8')
        
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
            # Row 1 (first data row) contains the baseline value in cell 0
            first_col_val = table[1][0] if len(table[1]) > 0 else ""
            if "$25,000" in first_col_val:
                produce_table = table
            elif "$500,000" in first_col_val and food_table is None:
                food_table = table

        if not produce_table or not food_table:
            raise ValueError(f"Could not find both Produce ($25k) and Food ($500k) tables. Found Produce: {produce_table is not None}, Food: {food_table is not None}")
        
        # Load existing JSON configuration
        if os.path.exists(JSON_PATH):
            with open(JSON_PATH, 'r', encoding='utf-8') as f:
                config = json.load(f)
        else:
            config = {
                "last_updated": "",
                "assessment_years": {},
                "yearly_values": {}
            }
            
        updated = False
        
        # Helper to process a table and extract values
        def process_compliance_table(table, target_key):
            nonlocal updated
            headers_row = [cell.replace('\xa0', ' ').strip() for cell in table[0]]
            data_row = [cell.strip() for cell in table[1]]
            
            # 1. Parse yearly values
            for idx, col_name in enumerate(headers_row):
                year = parse_year(col_name)
                # Skip columns that represent averages rather than single year values
                if year and "Average" not in col_name and idx < len(data_row):
                    val = sanitize_number(data_row[idx])
                    if val:
                        year_str = str(year)
                        if year_str not in config["yearly_values"]:
                            config["yearly_values"][year_str] = {}
                        if config["yearly_values"][year_str].get(target_key) != val:
                            config["yearly_values"][year_str][target_key] = val
                            updated = True
            
            # 2. Parse 3-year averages
            for idx, col_name in enumerate(headers_row):
                if "Average" in col_name and idx < len(data_row):
                    range_res = parse_average_range(col_name)
                    if range_res:
                        start_yr, end_yr = range_res
                        compliance_yr = str(end_yr + 1)
                        avg_val = sanitize_number(data_row[idx])
                        
                        if avg_val:
                            if compliance_yr not in config["assessment_years"]:
                                config["assessment_years"][compliance_yr] = {
                                    "produce_threshold": 0,
                                    "total_food_threshold": 0,
                                    "years_used": [start_yr, start_yr + 1, end_yr]
                                }
                            
                            threshold_key = f"{target_key}_threshold"
                            # Map keys: 'produce' -> 'produce_threshold', 'total_food' -> 'total_food_threshold' (actually config has total_food_threshold for food)
                            actual_key = "produce_threshold" if target_key == "produce" else "total_food_threshold"
                            
                            if config["assessment_years"][compliance_yr].get(actual_key) != avg_val:
                                config["assessment_years"][compliance_yr][actual_key] = avg_val
                                updated = True
        
        process_compliance_table(produce_table, "produce")
        process_compliance_table(food_table, "food")
        
        if updated or not config["last_updated"]:
            config["last_updated"] = datetime.now().strftime("%Y-%m-%d")
            with open(JSON_PATH, 'w', encoding='utf-8') as f:
                json.dump(config, f, indent=2)
            print(f"[{datetime.now().isoformat()}] Scraper completed: thresholds.json updated successfully.")
        else:
            print(f"[{datetime.now().isoformat()}] Scraper completed: no new thresholds detected.")
            
        return config

    except Exception as e:
        print(f"[{datetime.now().isoformat()}] Scraper error: {e}")
        import traceback
        traceback.print_exc()
        return None

if __name__ == "__main__":
    run_scraper()
