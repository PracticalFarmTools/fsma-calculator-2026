import json
import sys

def verify_json(file_path):
    try:
        with open(file_path, 'r') as f:
            data = json.load(f)
    except Exception as e:
        print(f"FAILED: Could not parse JSON file: {e}")
        return False

    expected_states = {
        "AL", "AK", "AZ", "AR", "CA", "CO", "CT", "DE", "FL", "GA",
        "HI", "ID", "IL", "IN", "IA", "KS", "KY", "LA", "ME", "MD",
        "MA", "MI", "MN", "MS", "MO", "MT", "NE", "NV", "NH", "NJ",
        "NM", "NY", "NC", "ND", "OH", "OK", "OR", "PA", "RI", "SC",
        "SD", "TN", "TX", "UT", "VT", "VA", "WA", "WV", "WI", "WY"
    }

    parsed_keys = set(data.keys())
    
    # Check count
    if len(parsed_keys) != 50:
        print(f"FAILED: Expected exactly 50 states, got {len(parsed_keys)}")
        missing = expected_states - parsed_keys
        extra = parsed_keys - expected_states
        if missing:
            print(f"Missing states: {missing}")
        if extra:
            print(f"Extra states: {extra}")
        return False

    # Check that all keys are valid state abbreviations
    if parsed_keys != expected_states:
        print("FAILED: State keys do not match the expected 50 US states.")
        return False

    # Check structural elements for each state
    for state, details in data.items():
        if "agency" not in details or not isinstance(details["agency"], str) or len(details["agency"]) == 0:
            print(f"FAILED: State {state} is missing 'agency' or it is not a non-empty string.")
            return False
        
        if "citation" not in details or not isinstance(details["citation"], dict):
            print(f"FAILED: State {state} is missing 'citation' dict.")
            return False
        
        citation = details["citation"]
        if "reference" not in citation or not isinstance(citation["reference"], str) or len(citation["reference"]) == 0:
            print(f"FAILED: State {state} citation is missing 'reference'.")
            return False
            
        if "url" not in citation or not isinstance(citation["url"], str) or len(citation["url"]) == 0:
            print(f"FAILED: State {state} citation is missing 'url'.")
            return False

        if "fields" not in details or not isinstance(details["fields"], list) or len(details["fields"]) == 0:
            print(f"FAILED: State {state} is missing 'fields' list or it is empty.")
            return False

        for f in details["fields"]:
            if "name" not in f or not isinstance(f["name"], str):
                print(f"FAILED: State {state} has a field missing 'name'.")
                return False
            if "label" not in f or not isinstance(f["label"], str):
                print(f"FAILED: State {state} field '{f.get('name')}' is missing 'label'.")
                return False
            if "type" not in f or f["type"] not in ["string", "number", "select", "datetime"]:
                print(f"FAILED: State {state} field '{f.get('name')}' has invalid type '{f.get('type')}'")
                return False
            if "required" not in f or not isinstance(f["required"], bool):
                print(f"FAILED: State {state} field '{f.get('name')}' is missing 'required' boolean.")
                return False
            if f["type"] == "select" and ("options" not in f or not isinstance(f["options"], list) or len(f["options"]) == 0):
                print(f"FAILED: State {state} select field '{f.get('name')}' is missing 'options' array.")
                return False

    print("SUCCESS: JSON structure is 100% valid, contains all 50 states, and conforms to validation schemas!")
    return True

if __name__ == "__main__":
    if len(sys.argv) > 1:
        verify_json(sys.argv[1])
    else:
        verify_json("proposed_state_pesticide_laws.json")
