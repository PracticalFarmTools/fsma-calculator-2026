import json
import os

# Define states with their agency and citation information
states_info = {
    "AL": {
        "agency": "Alabama Department of Agriculture and Industries",
        "citation_code": "Ala. Admin. Code r. 80-1-13-.08",
        "citation_url": "https://agi.alabama.gov/pesticides/",
        "req_fields": ["applicator_license", "epa_reg_no", "crop_treated", "amount_applied", "wind_speed", "wind_direction", "temperature"]
    },
    "AK": {
        "agency": "Alaska Department of Environmental Conservation",
        "citation_code": "18 AAC 90.415",
        "citation_url": "https://dec.alaska.gov/eh/pest/",
        "req_fields": ["applicator_license", "epa_reg_no", "crop_treated", "amount_applied", "dilution_rate"]
    },
    "AZ": {
        "agency": "Arizona Department of Agriculture",
        "citation_code": "A.A.C. R3-3-208",
        "citation_url": "https://agriculture.az.gov/pest-management-division",
        "req_fields": ["applicator_license", "permit_number", "epa_reg_no", "crop_treated", "amount_applied", "wind_speed", "wind_direction", "temperature"]
    },
    "AR": {
        "agency": "Arkansas Department of Agriculture",
        "citation_code": "Ark. Admin. Code 209.02.4",
        "citation_url": "https://www.agriculture.arkansas.gov/plant-industries/",
        "req_fields": ["applicator_license", "epa_reg_no", "crop_treated", "amount_applied", "wind_speed", "wind_direction"]
    },
    "CA": {
        "agency": "California Department of Pesticide Regulation",
        "citation_code": "3 CCR § 6624",
        "citation_url": "https://www.cdpr.ca.gov/",
        "req_fields": ["permit_number", "county", "applicator_license", "rei_hours", "phi_days", "epa_reg_no", "amount_applied", "crop_treated", "wind_speed", "wind_direction", "temperature"]
    },
    "CO": {
        "agency": "Colorado Department of Agriculture",
        "citation_code": "8 CCR 1203-2, Part 6",
        "citation_url": "https://ag.colorado.gov/plants/pesticides",
        "req_fields": ["applicator_license", "epa_reg_no", "crop_treated", "amount_applied"]
    },
    "CT": {
        "agency": "Connecticut Department of Energy and Environmental Protection",
        "citation_code": "CGS § 22a-66g",
        "citation_url": "https://portal.ct.gov/DEEP/Pesticides/Pesticide-Management-Program",
        "req_fields": ["applicator_license", "epa_reg_no", "crop_treated", "amount_applied"]
    },
    "DE": {
        "agency": "Delaware Department of Agriculture",
        "citation_code": "3 Del. Admin. Code 1201-14.0",
        "citation_url": "https://agriculture.delaware.gov/pesticides-planning-survey/",
        "req_fields": ["applicator_license", "epa_reg_no", "crop_treated", "amount_applied", "wind_speed", "wind_direction", "temperature"]
    },
    "FL": {
        "agency": "Florida Department of Agriculture and Consumer Services",
        "citation_code": "Fla. Admin. Code r. 5E-9.032",
        "citation_url": "https://www.fdacs.gov/Business-Services/Pesticide-Licensing",
        "req_fields": ["applicator_license", "epa_reg_no", "crop_treated", "amount_applied", "wind_speed", "wind_direction", "temperature"]
    },
    "GA": {
        "agency": "Georgia Department of Agriculture",
        "citation_code": "Ga. Comp. R. & Regs. 40-21-2-.02",
        "citation_url": "http://agr.georgia.gov/pesticides.aspx",
        "req_fields": ["applicator_license", "epa_reg_no", "crop_treated", "amount_applied", "wind_speed", "wind_direction"]
    },
    "HI": {
        "agency": "Hawaii Department of Agriculture",
        "citation_code": "HAR § 4-66-62",
        "citation_url": "https://hdoa.hawaii.gov/pi/pest/",
        "req_fields": ["applicator_license", "epa_reg_no", "crop_treated", "amount_applied", "wind_speed", "wind_direction", "temperature"]
    },
    "ID": {
        "agency": "Idaho State Department of Agriculture",
        "citation_code": "IDAPA 02.03.03.400",
        "citation_url": "https://agri.idaho.gov/main/5-2/pesticides/",
        "req_fields": ["applicator_license", "epa_reg_no", "crop_treated", "amount_applied", "wind_speed", "wind_direction", "temperature"]
    },
    "IL": {
        "agency": "Illinois Department of Agriculture",
        "citation_code": "8 Ill. Admin. Code 250.120",
        "citation_url": "https://agr.illinois.gov/pesticides.html",
        "req_fields": ["applicator_license", "epa_reg_no", "crop_treated", "amount_applied"]
    },
    "IN": {
        "agency": "Office of Indiana State Chemist",
        "citation_code": "357 IAC 1-4-4",
        "citation_url": "https://oisc.purdue.edu/pesticide/",
        "req_fields": ["applicator_license", "epa_reg_no", "crop_treated", "amount_applied", "wind_speed", "wind_direction"]
    },
    "IA": {
        "agency": "Iowa Department of Agriculture and Land Stewardship",
        "citation_code": "IAC 21-45.26(45)",
        "citation_url": "https://iowaagriculture.gov/pesticide-bureau",
        "req_fields": ["applicator_license", "epa_reg_no", "crop_treated", "amount_applied"]
    },
    "KS": {
        "agency": "Kansas Department of Agriculture",
        "citation_code": "K.A.R. 4-13-9",
        "citation_url": "https://agriculture.ks.gov/divisions-programs/pesticide-fertilizer",
        "req_fields": ["applicator_license", "epa_reg_no", "crop_treated", "amount_applied", "wind_speed", "wind_direction", "temperature"]
    },
    "KY": {
        "agency": "Kentucky Department of Agriculture",
        "citation_code": "302 KAR 31:015",
        "citation_url": "https://www.kyagr.com/consumer/pesticides.html",
        "req_fields": ["applicator_license", "epa_reg_no", "crop_treated", "amount_applied", "wind_speed", "wind_direction"]
    },
    "LA": {
        "agency": "Louisiana Department of Agriculture and Forestry",
        "citation_code": "LAC 7:XXIII.117",
        "citation_url": "https://www.ldaf.state.la.us/licensing/pesticides/",
        "req_fields": ["applicator_license", "epa_reg_no", "crop_treated", "amount_applied", "wind_speed", "wind_direction", "temperature"]
    },
    "ME": {
        "agency": "Maine Board of Pesticides Control",
        "citation_code": "01-026 CMR Chapter 50",
        "citation_url": "https://www.maine.gov/dacf/php/pesticides/",
        "req_fields": ["applicator_license", "epa_reg_no", "crop_treated", "amount_applied", "wind_speed", "wind_direction", "temperature"]
    },
    "MD": {
        "agency": "Maryland Department of Agriculture",
        "citation_code": "COMAR 15.05.01.14",
        "citation_url": "https://mda.maryland.gov/plants-pests/Pages/pesticide_regulation.aspx",
        "req_fields": ["applicator_license", "epa_reg_no", "crop_treated", "amount_applied"]
    },
    "MA": {
        "agency": "Massachusetts Department of Agricultural Resources",
        "citation_code": "333 CMR 10.14",
        "citation_url": "https://www.mass.gov/pesticide-licensing-and-integrated-pest-management-ipm",
        "req_fields": ["applicator_license", "epa_reg_no", "crop_treated", "amount_applied", "wind_speed", "wind_direction", "temperature"]
    },
    "MI": {
        "agency": "Michigan Department of Agriculture and Rural Development",
        "citation_code": "Mich. Admin. Code R 285.636.15",
        "citation_url": "https://www.michigan.gov/mdard/licensing/pesticide",
        "req_fields": ["applicator_license", "epa_reg_no", "crop_treated", "amount_applied", "wind_speed", "wind_direction"]
    },
    "MN": {
        "agency": "Minnesota Department of Agriculture",
        "citation_code": "Minn. Stat. § 18B.37",
        "citation_url": "https://www.mda.state.mn.us/pesticide-fertilizer/pesticide-applicator-licensing",
        "req_fields": ["applicator_license", "epa_reg_no", "crop_treated", "amount_applied", "wind_speed", "wind_direction", "temperature"]
    },
    "MS": {
        "agency": "Mississippi Department of Agriculture and Commerce",
        "citation_code": "Miss. Admin. Code 2-1-3",
        "citation_url": "https://www.mdac.ms.gov/bureaus-departments/plant-industry/pesticide-division/",
        "req_fields": ["applicator_license", "epa_reg_no", "crop_treated", "amount_applied", "wind_speed", "wind_direction"]
    },
    "MO": {
        "agency": "Missouri Department of Agriculture",
        "citation_code": "2 CSR 70-25.060",
        "citation_url": "https://agriculture.mo.gov/plants/pesticides/",
        "req_fields": ["applicator_license", "epa_reg_no", "crop_treated", "amount_applied", "wind_speed", "wind_direction", "temperature"]
    },
    "MT": {
        "agency": "Montana Department of Agriculture",
        "citation_code": "ARM 4.10.207",
        "citation_url": "https://agr.mt.gov/Pesticides",
        "req_fields": ["applicator_license", "epa_reg_no", "crop_treated", "amount_applied", "wind_speed", "wind_direction"]
    },
    "NE": {
        "agency": "Nebraska Department of Agriculture",
        "citation_code": "Title 25, Chapter 2",
        "citation_url": "https://nda.nebraska.gov/pesticide/",
        "req_fields": ["applicator_license", "epa_reg_no", "crop_treated", "amount_applied"]
    },
    "NV": {
        "agency": "Nevada Department of Agriculture",
        "citation_code": "NAC 555.440",
        "citation_url": "https://agri.nv.gov/Pesticides/",
        "req_fields": ["applicator_license", "epa_reg_no", "crop_treated", "amount_applied", "wind_speed", "wind_direction", "temperature"]
    },
    "NH": {
        "agency": "New Hampshire Department of Agriculture, Markets & Food",
        "citation_code": "Pes 501.01",
        "citation_url": "https://www.agriculture.nh.gov/divisions/pesticide-control/",
        "req_fields": ["applicator_license", "epa_reg_no", "crop_treated", "amount_applied"]
    },
    "NJ": {
        "agency": "New Jersey Department of Environmental Protection",
        "citation_code": "N.J.A.C. 7:30-6.8",
        "citation_url": "https://www.nj.gov/dep/enforcement/pcp/",
        "req_fields": ["applicator_license", "epa_reg_no", "crop_treated", "amount_applied", "wind_speed", "wind_direction", "temperature"]
    },
    "NM": {
        "agency": "New Mexico Department of Agriculture",
        "citation_code": "NMAC 21.17.50",
        "citation_url": "https://www.nmda.nmsu.edu/nmda-homepage/divisions/aes/pesticides/",
        "req_fields": ["applicator_license", "epa_reg_no", "crop_treated", "amount_applied", "wind_speed", "wind_direction", "temperature"]
    },
    "NY": {
        "agency": "New York State Department of Environmental Conservation",
        "citation_code": "6 NYCRR § 325.25",
        "citation_url": "https://www.dec.ny.gov/chemical/298.html",
        "req_fields": ["applicator_license", "epa_reg_no", "crop_treated", "amount_applied", "wind_speed", "wind_direction"]
    },
    "NC": {
        "agency": "North Carolina Department of Agriculture and Consumer Services",
        "citation_code": "02 NCAC 09L .1400",
        "citation_url": "https://www.ncagr.gov/SPDiv/pesticides/",
        "req_fields": ["applicator_license", "epa_reg_no", "crop_treated", "amount_applied", "wind_speed", "wind_direction"]
    },
    "ND": {
        "agency": "North Dakota Department of Agriculture",
        "citation_code": "N.D. Admin. Code 7-04-01-08",
        "citation_url": "https://www.nd.gov/ndda/program/pesticide-program",
        "req_fields": ["applicator_license", "epa_reg_no", "crop_treated", "amount_applied", "wind_speed", "wind_direction"]
    },
    "OH": {
        "agency": "Ohio Department of Agriculture",
        "citation_code": "O.A.C. 901:5-11-10",
        "citation_url": "https://agri.ohio.gov/divisions/plant-health/pesticides/",
        "req_fields": ["applicator_license", "epa_reg_no", "crop_treated", "amount_applied", "wind_speed", "wind_direction", "temperature"]
    },
    "OK": {
        "agency": "Oklahoma Department of Agriculture, Food, and Forestry",
        "citation_code": "O.A.C. 35:30-17-24",
        "citation_url": "https://www.oda.state.ok.us/cps/pesticide.htm",
        "req_fields": ["applicator_license", "epa_reg_no", "crop_treated", "amount_applied", "wind_speed", "wind_direction"]
    },
    "OR": {
        "agency": "Oregon Department of Agriculture",
        "citation_code": "OAR 603-057-0130",
        "citation_url": "https://www.oregon.gov/oda/programs/Pesticides/",
        "req_fields": ["applicator_license", "epa_reg_no", "crop_treated", "amount_applied", "wind_speed", "wind_direction", "temperature"]
    },
    "PA": {
        "agency": "Pennsylvania Department of Agriculture",
        "citation_code": "7 Pa. Code § 128.65",
        "citation_url": "https://www.agriculture.pa.gov/Plants_Land_Water/pesticides/",
        "req_fields": ["applicator_license", "epa_reg_no", "crop_treated", "amount_applied", "wind_speed", "wind_direction", "temperature"]
    },
    "RI": {
        "agency": "Rhode Island Department of Environmental Management",
        "citation_code": "250-RICR-40-15-2",
        "citation_url": "http://www.dem.ri.gov/programs/agriculture/pesticides.php",
        "req_fields": ["applicator_license", "epa_reg_no", "crop_treated", "amount_applied", "wind_speed", "wind_direction"]
    },
    "SC": {
        "agency": "Clemson University Department of Pesticide Regulation",
        "citation_code": "S.C. Code Regs. 27-1077",
        "citation_url": "https://www.clemson.edu/public/regulatory/pesticide-regulation/",
        "req_fields": ["applicator_license", "epa_reg_no", "crop_treated", "amount_applied", "wind_speed", "wind_direction"]
    },
    "SD": {
        "agency": "South Dakota Department of Agriculture and Natural Resources",
        "citation_code": "ARSD 12:56:06",
        "citation_url": "https://danr.sd.gov/Agriculture/Inspection/Pesticide/default.aspx",
        "req_fields": ["applicator_license", "epa_reg_no", "crop_treated", "amount_applied", "wind_speed", "wind_direction"]
    },
    "TN": {
        "agency": "Tennessee Department of Agriculture",
        "citation_code": "Tenn. Comp. R. & Regs. 0080-06-14-.07",
        "citation_url": "https://www.tn.gov/agriculture/businesses/pesticides.html",
        "req_fields": ["applicator_license", "epa_reg_no", "crop_treated", "amount_applied", "wind_speed", "wind_direction"]
    },
    "TX": {
        "agency": "Texas Department of Agriculture",
        "citation_code": "4 TAC § 7.33",
        "citation_url": "https://texasagriculture.gov/regulatory-programs/pesticides/",
        "req_fields": ["applicator_license", "county", "epa_reg_no", "crop_treated", "amount_applied", "wind_speed", "wind_direction", "temperature"]
    },
    "UT": {
        "agency": "Utah Department of Agriculture and Food",
        "citation_code": "R68-7-10",
        "citation_url": "https://ag.utah.gov/farmers/plants-industry/pesticides/",
        "req_fields": ["applicator_license", "epa_reg_no", "crop_treated", "amount_applied", "wind_speed", "wind_direction"]
    },
    "VT": {
        "agency": "Vermont Agency of Agriculture, Food and Markets",
        "citation_code": "V.A.R. 20-031-011",
        "citation_url": "https://agriculture.vermont.gov/public-health-agricultural-resource-management-division/pesticide-program",
        "req_fields": ["applicator_license", "epa_reg_no", "crop_treated", "amount_applied", "wind_speed", "wind_direction", "temperature"]
    },
    "VA": {
        "agency": "Virginia Department of Agriculture and Consumer Services",
        "citation_code": "2 VAC 5-685-110",
        "citation_url": "https://www.vdacs.virginia.gov/pesticide-applicator-certification.shtml",
        "req_fields": ["applicator_license", "epa_reg_no", "crop_treated", "amount_applied", "wind_speed", "wind_direction", "temperature"]
    },
    "WA": {
        "agency": "Washington State Department of Agriculture",
        "citation_code": "WAC 16-228-1320",
        "citation_url": "https://agr.wa.gov/departments/pesticides-and-fertilizers/pesticides",
        "req_fields": ["applicator_license", "county", "epa_reg_no", "crop_treated", "amount_applied", "wind_speed", "wind_direction", "temperature"]
    },
    "WV": {
        "agency": "West Virginia Department of Agriculture",
        "citation_code": "W. Va. Code Regs. § 61-12A-10",
        "citation_url": "https://agriculture.wv.gov/divisions/regulatory-environmental-protection/pesticides/",
        "req_fields": ["applicator_license", "epa_reg_no", "crop_treated", "amount_applied", "wind_speed", "wind_direction"]
    },
    "WI": {
        "agency": "Wisconsin Department of Agriculture, Trade and Consumer Protection",
        "citation_code": "ATCP 29.50",
        "citation_url": "https://datcp.wi.gov/Pages/Programs_Services/PesticidesFertilizers.aspx",
        "req_fields": ["applicator_license", "epa_reg_no", "crop_treated", "amount_applied", "wind_speed", "wind_direction", "temperature"]
    },
    "WY": {
        "agency": "Wyoming Department of Agriculture",
        "citation_code": "Chapter 28, Section 8",
        "citation_url": "https://wyagric.state.wy.us/technical-services/pesticide-registration",
        "req_fields": ["applicator_license", "epa_reg_no", "crop_treated", "amount_applied", "wind_speed", "wind_direction", "temperature"]
    }
}

# Base definitions of all possible fields
field_definitions = {
    "applicator_license": {
        "name": "applicator_license",
        "label": "Applicator License Number",
        "type": "string",
        "required": True,
        "regex": "^[A-Za-z0-9\\-]+$",
        "error_message": "License must be alphanumeric and can contain hyphens."
    },
    "permit_number": {
        "name": "permit_number",
        "label": "Permit Number / Operator ID",
        "type": "string",
        "required": True,
        "regex": "^[A-Za-z0-9\\-]+$",
        "error_message": "Permit number must be alphanumeric and can contain hyphens."
    },
    "county": {
        "name": "county",
        "label": "County of Application",
        "type": "string",
        "required": True
    },
    "rei_hours": {
        "name": "rei_hours",
        "label": "Restricted Entry Interval (REI) Hours",
        "type": "number",
        "required": True,
        "min": 0,
        "error_message": "REI hours must be a non-negative number."
    },
    "phi_days": {
        "name": "phi_days",
        "label": "Pre-Harvest Interval (PHI) Days",
        "type": "number",
        "required": True,
        "min": 0,
        "error_message": "PHI days must be a non-negative number."
    },
    "wind_speed": {
        "name": "wind_speed",
        "label": "Wind Speed (mph)",
        "type": "number",
        "required": True,
        "min": 0,
        "max": 50,
        "error_message": "Wind speed must be between 0 and 50 mph."
    },
    "wind_direction": {
        "name": "wind_direction",
        "label": "Wind Direction",
        "type": "select",
        "required": True,
        "options": ["N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE", "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW", "Calm"]
    },
    "temperature": {
        "name": "temperature",
        "label": "Temperature (°F)",
        "type": "number",
        "required": True,
        "min": -20,
        "max": 120,
        "error_message": "Temperature must be between -20°F and 120°F."
    },
    "crop_treated": {
        "name": "crop_treated",
        "label": "Crop or Treatment Site",
        "type": "string",
        "required": True
    },
    "epa_reg_no": {
        "name": "epa_reg_no",
        "label": "EPA Registration Number",
        "type": "string",
        "required": True,
        "regex": "^[0-9]+\\-[0-9]+(\\-[0-9]+)?$",
        "error_message": "EPA Reg No must follow format XXXXX-XXXXX or XXXXX-XXXXX-XXXXX."
    },
    "amount_applied": {
        "name": "amount_applied",
        "label": "Amount Applied (Concentrate)",
        "type": "number",
        "required": True,
        "min": 0,
        "error_message": "Amount applied must be a non-negative number."
    },
    "dilution_rate": {
        "name": "dilution_rate",
        "label": "Dilution or Concentration Rate",
        "type": "string",
        "required": True
    }
}

laws_db = {}

for abbrev, info in states_info.items():
    fields_list = []
    for f_name in info["req_fields"]:
        # Clone default definition and set required
        field_def = dict(field_definitions[f_name])
        fields_list.append(field_def)
    
    # Optional field that exists everywhere but isn't strictly mandated by some states, or exists as optional
    # Target Pest is commonly optional
    if "target_pest" not in info["req_fields"]:
        fields_list.append({
            "name": "target_pest",
            "label": "Target Pest",
            "type": "string",
            "required": False
        })
        
    laws_db[abbrev] = {
        "agency": info["agency"],
        "citation": {
            "reference": info["citation_code"],
            "url": info["citation_url"]
        },
        "fields": fields_list
    }

# Dump to file
output_path = "proposed_state_pesticide_laws.json"
with open(output_path, "w") as f:
    json.dump(laws_db, f, indent=2)

print(f"Generated {len(laws_db)} states. Written to {output_path}")
