import os
import unittest
from datetime import datetime, timedelta
from fastapi.testclient import TestClient

# Set database URL env variable to use a test SQLite db before importing
os.environ["DATABASE_URL"] = "sqlite:///./test_farm_sync.db"

from main import app, get_db
from database import Base, engine
from models import Message, Task, MaintenanceLog, ChemicalReport

class TestSyncServer(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        # Create database tables
        Base.metadata.create_all(bind=engine)
        cls.client = TestClient(app)

    @classmethod
    def tearDownClass(cls):
        # Dispose the engine to close all connections in connection pool
        engine.dispose()
        # Drop database tables and clean up file
        if os.path.exists("./test_farm_sync.db"):
            try:
                os.remove("./test_farm_sync.db")
            except Exception as e:
                print(f"Warning: could not delete test db file: {e}")

    def setUp(self):
        # Clear database rows before each test (simple truncate)
        from database import SessionLocal
        db = SessionLocal()
        for table in reversed(Base.metadata.sorted_tables):
            db.execute(table.delete())
        db.commit()
        db.close()

    def test_health_check(self):
        response = self.client.get("/health")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["status"], "ok")

    def test_sync_insert_clean(self):
        # Client UUIDs and Timestamps
        msg_id = "11111111-2222-3333-4444-555555555555"
        local_time = datetime.utcnow()
        
        sync_payload = {
            "client_id": "client_device_1",
            "last_synced_at": None,
            "queue": [
                {
                    "target_table": "messages",
                    "record_id": msg_id,
                    "operation": "INSERT",
                    "payload": {
                        "id": msg_id,
                        "room_id": "room_alpha",
                        "sender_id": "user_alice",
                        "content": "Hello from the field!",
                        "created_at": local_time.isoformat(),
                        "updated_at": local_time.isoformat(),
                        "is_deleted": False
                    },
                    "updated_at": local_time.isoformat()
                }
            ]
        }
        
        response = self.client.post("/sync", json=sync_payload)
        self.assertEqual(response.status_code, 200)
        data = response.json()
        
        # Verify sync result status
        self.assertEqual(len(data["sync_results"]), 1)
        self.assertEqual(data["sync_results"][0]["record_id"], msg_id)
        self.assertEqual(data["sync_results"][0]["status"], "clean")
        
        # Verify new records doesn't echo back if sync time matches
        self.assertIn("messages", data["new_records"])
        self.assertEqual(data["new_records"]["messages"][0]["id"], msg_id)

    def test_sync_lww_chat_update(self):
        msg_id = "22222222-2222-3333-4444-555555555555"
        base_time = datetime.utcnow()
        
        # 1. First client inserts message
        sync_payload_1 = {
            "client_id": "client_1",
            "last_synced_at": None,
            "queue": [
                {
                    "target_table": "messages",
                    "record_id": msg_id,
                    "operation": "INSERT",
                    "payload": {
                        "id": msg_id,
                        "room_id": "room_alpha",
                        "sender_id": "user_alice",
                        "content": "Original content",
                        "created_at": base_time.isoformat(),
                        "updated_at": base_time.isoformat(),
                        "is_deleted": False
                    },
                    "updated_at": base_time.isoformat()
                }
            ]
        }
        self.client.post("/sync", json=sync_payload_1)
        
        # 2. Second client updates message with LATER timestamp (should succeed)
        later_time = base_time + timedelta(minutes=5)
        sync_payload_2 = {
            "client_id": "client_2",
            "last_synced_at": base_time.isoformat(),
            "queue": [
                {
                    "target_table": "messages",
                    "record_id": msg_id,
                    "operation": "UPDATE",
                    "payload": {
                        "id": msg_id,
                        "room_id": "room_alpha",
                        "sender_id": "user_alice",
                        "content": "Updated content - Newer",
                        "created_at": base_time.isoformat(),
                        "updated_at": later_time.isoformat(),
                        "is_deleted": False
                    },
                    "updated_at": later_time.isoformat()
                }
            ]
        }
        res2 = self.client.post("/sync", json=sync_payload_2)
        self.assertEqual(res2.json()["sync_results"][0]["status"], "clean")
        
        # 3. Third client updates message with OLDER timestamp (should ignore, LWW resolves)
        earlier_time = base_time - timedelta(minutes=5)
        sync_payload_3 = {
            "client_id": "client_3",
            "last_synced_at": base_time.isoformat(),
            "queue": [
                {
                    "target_table": "messages",
                    "record_id": msg_id,
                    "operation": "UPDATE",
                    "payload": {
                        "id": msg_id,
                        "room_id": "room_alpha",
                        "sender_id": "user_alice",
                        "content": "Stale update - Outdated",
                        "created_at": base_time.isoformat(),
                        "updated_at": earlier_time.isoformat(),
                        "is_deleted": False
                    },
                    "updated_at": earlier_time.isoformat()
                }
            ]
        }
        res3 = self.client.post("/sync", json=sync_payload_3)
        self.assertEqual(res3.json()["sync_results"][0]["status"], "clean")
        
        # Verify database has the "Newer" content, not the "Outdated" content
        fetch_payload = {
            "client_id": "client_4",
            "last_synced_at": (base_time - timedelta(days=1)).isoformat(),
            "queue": []
        }
        res_fetch = self.client.post("/sync", json=fetch_payload)
        fetched_msgs = res_fetch.json()["new_records"]["messages"]
        self.assertEqual(fetched_msgs[0]["content"], "Updated content - Newer")

    def test_high_value_conflict_detection(self):
        log_id = "33333333-2222-3333-4444-555555555555"
        base_time = datetime.utcnow()
        
        # 1. Initial chemical report synced
        sync_payload_1 = {
            "client_id": "client_1",
            "last_synced_at": None,
            "queue": [
                {
                    "target_table": "chemical_reports",
                    "record_id": log_id,
                    "operation": "INSERT",
                    "payload": {
                        "id": log_id,
                        "field_id": "field_sector_a",
                        "chemical_name": "Glyphosate",
                        "amount_applied": 150.0,
                        "state": "TX",
                        "dynamic_fields": '{"applicator_license":"TX-1234"}',
                        "created_at": base_time.isoformat(),
                        "updated_at": base_time.isoformat(),
                        "is_deleted": False
                    },
                    "updated_at": base_time.isoformat()
                }
            ]
        }
        self.client.post("/sync", json=sync_payload_1)
        
        # 2. Client A updates chemical amount (Client A's last sync is base_time)
        # However, Client B has already updated it in the server database concurrently!
        # Simulating Client B updating the server database to 180.0
        from database import SessionLocal
        db = SessionLocal()
        db_log = db.query(ChemicalReport).filter(ChemicalReport.id == log_id).first()
        db_log.amount_applied = 180.0
        db_log.updated_at = base_time + timedelta(minutes=1)
        db_log.synced_at = base_time + timedelta(minutes=1)
        db.commit()
        db.close()
        
        # Now, Client A (last synced at base_time) tries to update to 200.0
        sync_payload_2 = {
            "client_id": "client_A",
            "last_synced_at": base_time.isoformat(),
            "queue": [
                {
                    "target_table": "chemical_reports",
                    "record_id": log_id,
                    "operation": "UPDATE",
                    "payload": {
                        "id": log_id,
                        "field_id": "field_sector_a",
                        "chemical_name": "Glyphosate",
                        "amount_applied": 200.0,
                        "state": "TX",
                        "dynamic_fields": '{"applicator_license":"TX-1234"}',
                        "created_at": base_time.isoformat(),
                        "updated_at": (base_time + timedelta(minutes=2)).isoformat(),
                        "is_deleted": False
                    },
                    "updated_at": (base_time + timedelta(minutes=2)).isoformat()
                }
            ]
        }
        
        res = self.client.post("/sync", json=sync_payload_2)
        self.assertEqual(res.status_code, 200)
        data = res.json()
        
        # Verify it results in a conflict because ChemicalReport is a high-value log and the server was modified concurrently
        self.assertEqual(data["sync_results"][0]["status"], "conflict")
        self.assertEqual(data["sync_results"][0]["remote_data"]["amount_applied"], 180.0)

    def test_chemical_report_state_and_dynamic_fields_sync(self):
        log_id = "44444444-2222-3333-4444-555555555555"
        base_time = datetime.utcnow()
        dynamic_fields_json = '{"applicator_license":"TX-98765","county":"Travis","wind_speed":12.5}'
        
        sync_payload = {
            "client_id": "client_device_1",
            "last_synced_at": None,
            "queue": [
                {
                    "target_table": "chemical_reports",
                    "record_id": log_id,
                    "operation": "INSERT",
                    "payload": {
                        "id": log_id,
                        "field_id": "Sector 1",
                        "chemical_name": "Roundup",
                        "amount_applied": 25.5,
                        "state": "TX",
                        "dynamic_fields": dynamic_fields_json,
                        "created_at": base_time.isoformat(),
                        "updated_at": base_time.isoformat(),
                        "is_deleted": False
                    },
                    "updated_at": base_time.isoformat()
                }
            ]
        }
        
        response = self.client.post("/sync", json=sync_payload)
        self.assertEqual(response.status_code, 200)
        data = response.json()
        
        # Verify sync result status
        self.assertEqual(len(data["sync_results"]), 1)
        self.assertEqual(data["sync_results"][0]["record_id"], log_id)
        self.assertEqual(data["sync_results"][0]["status"], "clean")
        
        # Verify it was inserted with correct state and dynamic_fields
        from database import SessionLocal
        db = SessionLocal()
        report = db.query(ChemicalReport).filter(ChemicalReport.id == log_id).first()
        self.assertIsNotNone(report)
        self.assertEqual(report.state, "TX")
        self.assertEqual(report.dynamic_fields, dynamic_fields_json)
        db.close()

    def test_chemical_report_all_compliance_columns_sync(self):
        log_id = "55555555-2222-3333-4444-555555555555"
        base_time = datetime.utcnow()
        
        sync_payload = {
            "client_id": "client_device_1",
            "last_synced_at": None,
            "queue": [
                {
                    "target_table": "chemical_reports",
                    "record_id": log_id,
                    "operation": "INSERT",
                    "payload": {
                        "id": log_id,
                        "field_id": "Sector 4",
                        "chemical_name": "Koppert",
                        "amount_applied": 10.0,
                        "state": "CA",
                        "dynamic_fields": '{"notes":"Applied in morning"}',
                        "epa_reg_no": "12345-67",
                        "applicator_name": "John Doe",
                        "applicator_license": "CA-9876",
                        "area_treated": 5.5,
                        "crop_treated": "Apples",
                        "target_pest": "Aphids",
                        "application_method": "Foliar Spray",
                        "start_time": "08:00 AM",
                        "end_time": "10:00 AM",
                        "wind_speed": 4.5,
                        "wind_direction": "NE",
                        "temperature": 72.0,
                        "permit_number": "PERMIT-123",
                        "county": "Fresno",
                        "rei_hours": 12,
                        "phi_days": 7,
                        "applicator_signature": "data:image/png;base64,mocksignature...",
                        "created_at": base_time.isoformat(),
                        "updated_at": base_time.isoformat(),
                        "is_deleted": False
                    },
                    "updated_at": base_time.isoformat()
                }
            ]
        }
        
        response = self.client.post("/sync", json=sync_payload)
        self.assertEqual(response.status_code, 200)
        data = response.json()
        
        self.assertEqual(len(data["sync_results"]), 1)
        self.assertEqual(data["sync_results"][0]["status"], "clean")
        
        from database import SessionLocal
        db = SessionLocal()
        report = db.query(ChemicalReport).filter(ChemicalReport.id == log_id).first()
        self.assertIsNotNone(report)
        self.assertEqual(report.state, "CA")
        self.assertEqual(report.epa_reg_no, "12345-67")
        self.assertEqual(report.applicator_name, "John Doe")
        self.assertEqual(report.area_treated, 5.5)
        self.assertEqual(report.rei_hours, 12)
        self.assertEqual(report.phi_days, 7)
        self.assertEqual(report.applicator_signature, "data:image/png;base64,mocksignature...")
        db.close()

if __name__ == "__main__":
    unittest.main()
