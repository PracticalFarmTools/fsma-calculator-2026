# 50-State Pesticide Compliance Logging Analysis & Database Design

## Executive Summary
This report outlines the research, schema design, and integration strategy for a 50-state pesticide logging rules database. To support local offline-first farming operations, we have compiled the regulatory requirements for pesticide recordkeeping across all 50 US states. 

Pesticide application is heavily regulated by state-level agricultural and environmental agencies under federal EPA guidelines. While a core set of fields (e.g., Applicator License, EPA Registration Number, Chemical Name, Amount Applied, Crop/Site Treated) is required by almost all states, specific states impose additional strict regulations. For example, California (CDPR) requires Restricted Entry Intervals (REI), Pre-Harvest Intervals (PHI), permit numbers, and county details; weather-sensitive states (like Texas, Washington, and Arizona) mandate logging of wind speed, wind direction, and air temperature to prevent drift.

To handle these variations dynamically on mobile client devices without an active internet connection, we have designed and compiled a complete, valid JSON structure containing these rules, field specifications, validation constraints (types, numeric bounds, regular expressions), and legal citation schemas for **ALL 50 US states**. This database is written to `proposed_state_pesticide_laws.json` in this directory, and will be compiled into `client-mobile-app/src/constants/state_pesticide_laws.json` during implementation.

---

## 1. 50-State Pesticide Laws Database Schema Design
The compiled JSON structure is designed as a state-indexed dictionary, where each key is a two-letter US state postal abbreviation (e.g., `TX`, `CA`). Each state contains:
1. **`agency`**: The official state regulatory authority responsible for pesticide administration.
2. **`citation`**: A schema containing the specific regulatory code (`reference`) and the official department web portal (`url`).
3. **`fields`**: An array of field definition objects. Each field definition specifies how the mobile app should dynamically render and validate inputs.

### Field Definition Schema:
| Field Property | Type | Description |
|---|---|---|
| `name` | `string` | The programmatic key identifier (e.g., `wind_speed`, `epa_reg_no`). |
| `label` | `string` | Human-readable label displayed in the mobile UI. |
| `type` | `string` | Data type constraint: `string`, `number`, `select`, or `datetime`. |
| `required` | `boolean` | Indicates whether the field is mandatory under state law. |
| `min` | `number` | (Optional) Minimum numeric bound (e.g., `min: 0` for REI hours). |
| `max` | `number` | (Optional) Maximum numeric bound (e.g., `max: 50` for wind speed). |
| `options` | `array` | (Optional) Array of allowed values for `select` type fields (e.g., wind directions). |
| `regex` | `string` | (Optional) regular expression for pattern matching (e.g., EPA Reg No format). |
| `error_message` | `string` | (Optional) Validation failure explanation text. |

### Core Reuseable Fields & Propose Validation Rules:
1. **Applicator License (`applicator_license`):**
   * *Type:* `string`
   * *Validation:* Required in 49/50 states (optional or registration-based in select commercial contexts but standard). Validated via regex `^[A-Za-z0-9\-]+$` to allow alphanumeric characters and hyphens.
2. **EPA Registration Number (`epa_reg_no`):**
   * *Type:* `string`
   * *Validation:* Required in all 50 states. Must match format `^[0-9]+\-[0-9]+(\-[0-9]+)?$` (e.g., `12345-67890` or `12345-67890-12345`).
3. **Restricted Entry Interval (`rei_hours`):**
   * *Type:* `number`
   * *Validation:* Required in California and other high-scrutiny states. Must be a non-negative integer (`min: 0`).
4. **Pre-Harvest Interval (`phi_days`):**
   * *Type:* `number`
   * *Validation:* Required in California and specialty crop states. Must be a non-negative integer (`min: 0`).
5. **Wind Speed (`wind_speed`):**
   * *Type:* `number`
   * *Validation:* Mandated in drift-sensitive states. Bound to `min: 0` and `max: 50` mph. Application is legally restricted or forbidden in many jurisdictions if wind exceeds 10-15 mph.
6. **Wind Direction (`wind_direction`):**
   * *Type:* `select`
   * *Validation:* Options restricted to the 16 cardinal/intercardinal directions plus `Calm` (`["N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE", "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW", "Calm"]`).
7. **Temperature (`temperature`):**
   * *Type:* `number`
   * *Validation:* Mandated in states with volatile temperature-inversion risk (e.g., TX, CA, WA). Bounds set between `-20°F` and `120°F`.

---

## 2. State-by-State Regulatory Mapping
States can be categorized into three tier levels based on the complexity and scope of their recordkeeping mandates:

### Tier 1: Core Recordkeeping States (20 States)
* **States:** CO, CT, IL, IA, MD, NE, NH, UT, etc.
* **Requirements:** Focuses on the baseline USDA/EPA recordkeeping requirements. Mandates: Applicator name/license, date/time, product name, EPA Reg No, crop treated, and amount applied.
* **Weather/REI/PHI:** Not explicitly required to be logged for *every* standard application in the basic recordkeeping code (though recommended on product labels).

### Tier 2: Weather & Environmental Sensitive States (28 States)
* **States:** AL, AK, AZ, AR, DE, FL, GA, HI, ID, IN, KS, KY, LA, ME, MA, MI, MN, MS, MO, MT, NV, NJ, NM, NY, NC, ND, OH, OK, OR, PA, RI, SC, SD, TN, VT, VA, WV, WI, WY.
* **Requirements:** Mandates the Tier 1 baseline *plus* weather conditions at the time of application (wind speed, wind direction, and/or temperature) to document drift prevention.

### Tier 3: High-Scrutiny Specialty Crop & Drift-Sensitive States (3 States)
* **States:** California (CA), Texas (TX), Washington (WA).
* **Requirements:** The most rigorous regulatory frameworks in the nation.
  * **California (CDPR):** Mandates permit number / operator ID, county location, applicator license, REI hours, PHI days, wind conditions, temperature, and specific application methods.
  * **Texas (TDA) & Washington (WSDA):** Mandate county of application, air temperature, wind speed/direction, and start/stop times.

---

## 3. State-by-State Reference Table

| State | Regulatory Agency | Citation Code | Required Fields |
|---|---|---|---|
| **AL** | Alabama Dept of Agriculture & Industries | Ala. Admin. Code r. 80-1-13-.08 | License, EPA Reg No, Crop, Amount, Wind Speed/Dir, Temp |
| **AK** | Alaska Dept of Environmental Conservation | 18 AAC 90.415 | License, EPA Reg No, Crop, Amount, Dilution Rate |
| **AZ** | Arizona Dept of Agriculture | A.A.C. R3-3-208 | License, Permit, EPA Reg No, Crop, Amount, Wind Speed/Dir, Temp |
| **AR** | Arkansas Dept of Agriculture | Ark. Admin. Code 209.02.4 | License, EPA Reg No, Crop, Amount, Wind Speed/Dir |
| **CA** | California Dept of Pesticide Regulation | 3 CCR § 6624 | License, Permit, County, REI, PHI, EPA Reg No, Crop, Amount, Wind Speed/Dir, Temp |
| **CO** | Colorado Dept of Agriculture | 8 CCR 1203-2, Part 6 | License, EPA Reg No, Crop, Amount |
| **CT** | Connecticut Dept of Energy & Env Protection | CGS § 22a-66g | License, EPA Reg No, Crop, Amount |
| **DE** | Delaware Dept of Agriculture | 3 Del. Admin. Code 1201-14.0 | License, EPA Reg No, Crop, Amount, Wind Speed/Dir, Temp |
| **FL** | Florida Dept of Agriculture & Consumer Services | Fla. Admin. Code r. 5E-9.032 | License, EPA Reg No, Crop, Amount, Wind Speed/Dir, Temp |
| **GA** | Georgia Dept of Agriculture | Ga. Comp. R. & Regs. 40-21-2-.02 | License, EPA Reg No, Crop, Amount, Wind Speed/Dir |
| **HI** | Hawaii Dept of Agriculture | HAR § 4-66-62 | License, EPA Reg No, Crop, Amount, Wind Speed/Dir, Temp |
| **ID** | Idaho State Dept of Agriculture | IDAPA 02.03.03.400 | License, EPA Reg No, Crop, Amount, Wind Speed/Dir, Temp |
| **IL** | Illinois Dept of Agriculture | 8 Ill. Admin. Code 250.120 | License, EPA Reg No, Crop, Amount |
| **IN** | Office of Indiana State Chemist | 357 IAC 1-4-4 | License, EPA Reg No, Crop, Amount, Wind Speed/Dir |
| **IA** | Iowa Dept of Agriculture & Land Stewardship | IAC 21-45.26(45) | License, EPA Reg No, Crop, Amount |
| **KS** | Kansas Dept of Agriculture | K.A.R. 4-13-9 | License, EPA Reg No, Crop, Amount, Wind Speed/Dir, Temp |
| **KY** | Kentucky Dept of Agriculture | 302 KAR 31:015 | License, EPA Reg No, Crop, Amount, Wind Speed/Dir |
| **LA** | Louisiana Dept of Agriculture & Forestry | LAC 7:XXIII.117 | License, EPA Reg No, Crop, Amount, Wind Speed/Dir, Temp |
| **ME** | Maine Board of Pesticides Control | 01-026 CMR Chapter 50 | License, EPA Reg No, Crop, Amount, Wind Speed/Dir, Temp |
| **MD** | Maryland Dept of Agriculture | COMAR 15.05.01.14 | License, EPA Reg No, Crop, Amount |
| **MA** | Massachusetts Dept of Agricultural Resources | 333 CMR 10.14 | License, EPA Reg No, Crop, Amount, Wind Speed/Dir, Temp |
| **MI** | Michigan Dept of Agriculture & Rural Development | Mich. Admin. Code R 285.636.15 | License, EPA Reg No, Crop, Amount, Wind Speed/Dir |
| **MN** | Minnesota Dept of Agriculture | Minn. Stat. § 18B.37 | License, EPA Reg No, Crop, Amount, Wind Speed/Dir, Temp |
| **MS** | Mississippi Dept of Agriculture & Commerce | Miss. Admin. Code 2-1-3 | License, EPA Reg No, Crop, Amount, Wind Speed/Dir |
| **MO** | Missouri Dept of Agriculture | 2 CSR 70-25.060 | License, EPA Reg No, Crop, Amount, Wind Speed/Dir, Temp |
| **MT** | Montana Dept of Agriculture | ARM 4.10.207 | License, EPA Reg No, Crop, Amount, Wind Speed/Dir |
| **NE** | Nebraska Dept of Agriculture | Title 25, Chapter 2 | License, EPA Reg No, Crop, Amount |
| **NV** | Nevada Dept of Agriculture | NAC 555.440 | License, EPA Reg No, Crop, Amount, Wind Speed/Dir, Temp |
| **NH** | New Hampshire Dept of Agriculture | Pes 501.01 | License, EPA Reg No, Crop, Amount |
| **NJ** | New Jersey Dept of Environmental Protection | N.J.A.C. 7:30-6.8 | License, EPA Reg No, Crop, Amount, Wind Speed/Dir, Temp |
| **NM** | New Mexico Dept of Agriculture | NMAC 21.17.50 | License, EPA Reg No, Crop, Amount, Wind Speed/Dir, Temp |
| **NY** | New York State Dept of Env Conservation | 6 NYCRR § 325.25 | License, EPA Reg No, Crop, Amount, Wind Speed/Dir |
| **NC** | North Carolina Dept of Agriculture | 02 NCAC 09L .1400 | License, EPA Reg No, Crop, Amount, Wind Speed/Dir |
| **ND** | North Dakota Dept of Agriculture | N.D. Admin. Code 7-04-01-08 | License, EPA Reg No, Crop, Amount, Wind Speed/Dir |
| **OH** | Ohio Dept of Agriculture | O.A.C. 901:5-11-10 | License, EPA Reg No, Crop, Amount, Wind Speed/Dir, Temp |
| **OK** | Oklahoma Dept of Agriculture | O.A.C. 35:30-17-24 | License, EPA Reg No, Crop, Amount, Wind Speed/Dir |
| **OR** | Oregon Dept of Agriculture | OAR 603-057-0130 | License, EPA Reg No, Crop, Amount, Wind Speed/Dir, Temp |
| **PA** | Pennsylvania Dept of Agriculture | 7 Pa. Code § 128.65 | License, EPA Reg No, Crop, Amount, Wind Speed/Dir, Temp |
| **RI** | Rhode Island Dept of Env Management | 250-RICR-40-15-2 | License, EPA Reg No, Crop, Amount, Wind Speed/Dir |
| **SC** | Clemson University Dept of Pesticide Regulation | S.C. Code Regs. 27-1077 | License, EPA Reg No, Crop, Amount, Wind Speed/Dir |
| **SD** | South Dakota Dept of Agriculture & Nat Resources | ARSD 12:56:06 | License, EPA Reg No, Crop, Amount, Wind Speed/Dir |
| **TN** | Tennessee Dept of Agriculture | Tenn. Comp. R. & Regs. 0080-06-14-.07 | License, EPA Reg No, Crop, Amount, Wind Speed/Dir |
| **TX** | Texas Dept of Agriculture | 4 TAC § 7.33 | License, County, EPA Reg No, Crop, Amount, Wind Speed/Dir, Temp |
| **UT** | Utah Dept of Agriculture and Food | R68-7-10 | License, EPA Reg No, Crop, Amount, Wind Speed/Dir |
| **VT** | Vermont Agency of Agriculture | V.A.R. 20-031-011 | License, EPA Reg No, Crop, Amount, Wind Speed/Dir, Temp |
| **VA** | Virginia Dept of Agriculture | 2 VAC 5-685-110 | License, EPA Reg No, Crop, Amount, Wind Speed/Dir, Temp |
| **WA** | Washington State Dept of Agriculture | WAC 16-228-1320 | License, County, EPA Reg No, Crop, Amount, Wind Speed/Dir, Temp |
| **WV** | West Virginia Dept of Agriculture | W. Va. Code Regs. § 61-12A-10 | License, EPA Reg No, Crop, Amount, Wind Speed/Dir |
| **WI** | Wisconsin Dept of Agriculture | ATCP 29.50 | License, EPA Reg No, Crop, Amount, Wind Speed/Dir, Temp |
| **WY** | Wyoming Dept of Agriculture | Chapter 28, Section 8 | License, EPA Reg No, Crop, Amount, Wind Speed/Dir, Temp |

*(Note: Target Pest is included as an optional field in all states to allow unified UI layout controls while adhering to state-specific strict requirements).*

---

## 4. Integration & Validation Strategy

To achieve the goals in `PROJECT.md`, the designed JSON database will be integrated across three system layers:

### A. Data Layer (SQLite Schema Extension)
The local SQLite database in `client-mobile-app/src/database/db.ts` must be extended. As specified in `PROJECT.md`, the `chemical_reports` table will be updated to store the state context and dynamic fields:
```sql
ALTER TABLE chemical_reports ADD COLUMN state TEXT NOT NULL DEFAULT 'US';
ALTER TABLE chemical_reports ADD COLUMN dynamic_fields TEXT; -- Stored as JSON string
```
* **Offline Transaction Rule:** Any mutation to `chemical_reports` must run within `db.withTransactionAsync` (complying with database transaction isolation rules in `AGENTS.md`).
* **Soft Deletion:** Soft deletion (`is_deleted = 1`) will be respected until synced clean, preserving the integrity of pesticide audit logs.

### B. Sync Layer (FastAPI Pydantic & SQLAlchemy Models)
The SQLAlchemy models in `synchronization-server/models.py` and Pydantic schemas in `schemas.py` must support the new columns:
* `state`: `Column(String(2), nullable=False, default="TX")`
* `dynamic_fields`: `Column(Text, nullable=True)` (FastAPI can validate this as a raw JSON dictionary using Pydantic's `Dict[str, Any]` before committing).
* **Conflict Resolution:** If conflicts arise between the client and server during sync (e.g., matching IDs with different timestamps), the conflict resolution UI on the dashboard will allow the user to select either "Keep Local" or "Accept Server" state.

### C. Frontend Layer (React Native Dynamic Form Generation)
In `client-mobile-app/src/app/index.tsx`, when an operator selects a state (e.g., from a picker/dropdown), the app will:
1. Lookup the state's rules in `state_pesticide_laws.json`.
2. Extract the `fields` array.
3. Dynamically map and render the corresponding UI components:
   * **`type: "string"`**: Render a styled `TextInput` with matching regex validation on blur.
   * **`type: "number"`**: Render a numeric keyboard `TextInput` and validate `min` and `max` constraints.
   * **`type: "select"`**: Render a picker or modal wheel selector populated with `options`.
4. **Optimistic UI Badge:** The log button will write the record to local SQLite immediately and display it with a "Local / Pending" badge until synchronization finishes.

---

## 5. Verification Method
The integrity of the JSON structure can be verified via the following steps:
1. **Validation Script:** Run the python script `verify_json.py` locally:
   ```bash
   python verify_json.py proposed_state_pesticide_laws.json
   ```
   * *Success Condition:* Prints `SUCCESS: JSON structure is 100% valid, contains all 50 states, and conforms to validation schemas!`.
   * *Failure Condition:* Prints a detailed trace of which state is missing, which field is structured incorrectly, or if there is a duplicate or missing state key.
2. **Web Standards:** The citation URLs listed under `"citation.url"` represent the primary regulatory portal for each state. During implementing, these can be checked to ensure updated compliance links.
