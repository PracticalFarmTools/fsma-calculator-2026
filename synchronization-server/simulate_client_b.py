import httpx
import uuid
from datetime import datetime

SERVER_URL = "http://localhost:8000/sync"

def main():
    print("=========================================")
    print("🌾 Farm App Sync - Device B Simulator 🌾")
    print("=========================================")
    print("This script simulates a second field console ('Device_B') sending data to the server.")
    print("Type a message below to upload it to the sync server. Once uploaded, trigger 'Sync Now' in the mobile app web preview to receive it!")
    print("Type 'exit' to quit.\n")

    client_id = "device_client_b"
    
    print("Select language for simulated Device B:")
    print("1. Spanish (es)")
    print("2. Portuguese (pt)")
    print("3. English (en)")
    print("4. French (fr)")
    lang_choice = input("Choice (1/2/3/4) [default: 1]: ").strip()
    
    lang_code = "es"
    if lang_choice == "2":
        lang_code = "pt"
    elif lang_choice == "3":
        lang_code = "en"
    elif lang_choice == "4":
        lang_code = "fr"
        
    print(f"Device B will broadcast messages in: {lang_code.upper()} (e.g. try typing 'Buenos dias equipo' or 'Barn door is locked')\n")
    
    while True:
        text = input(f"Message from Device B ({lang_code.upper()}): ")
        if not text or text.lower() == 'exit':
            break

        msg_id = str(uuid.uuid4())
        timestamp = datetime.utcnow().isoformat() + "Z"

        sync_payload = {
            "client_id": client_id,
            "last_synced_at": None,
            "queue": [
                {
                    "target_table": "messages",
                    "record_id": msg_id,
                    "operation": "INSERT",
                    "payload": {
                        "id": msg_id,
                        "room_id": "general_hq",
                        "sender_id": "Device_B",
                        "content": text,
                        "language_code": lang_code,
                        "created_at": timestamp,
                        "updated_at": timestamp,
                        "is_deleted": False
                    },
                    "updated_at": timestamp
                }
            ]
        }

        try:
            response = httpx.post(SERVER_URL, json=sync_payload)
            if response.status_code == 200:
                print(f"✔️ Message successfully uploaded to server! UUID: {msg_id}\n")
            else:
                print(f"❌ Failed to sync. Server status: {response.status_code}\n")
        except Exception as e:
            print(f"❌ Error connecting to server: {e}\n")

if __name__ == "__main__":
    main()
