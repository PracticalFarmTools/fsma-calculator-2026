import logging
from datetime import datetime
from typing import Dict, List, Any
from fastapi import FastAPI, Depends, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session

from database import engine, get_db, Base
from models import Message, Task, MaintenanceLog, ChemicalReport, Observation, MediaPost
from schemas import SyncRequest, SyncResponse, SyncResult, SyncOperation

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("farm_sync_server")

# Create tables in the local SQLite/Postgres DB
Base.metadata.create_all(bind=engine)

# Dynamic database migration helper
import os
import shutil
from sqlalchemy import text

def run_migrations():
    # 1. Copy the compiled laws JSON file as requested in Step 1
    try:
        src = "c:/Users/kyles/Desktop/Antigravity Music/Practical Farm Tools/.agents/explorer_3/proposed_state_pesticide_laws.json"
        dest = "c:/Users/kyles/Desktop/Antigravity Music/Practical Farm Tools/client-mobile-app/src/constants/state_pesticide_laws.json"
        if not os.path.exists(src):
            src = "../.agents/explorer_3/proposed_state_pesticide_laws.json"
            dest = "../client-mobile-app/src/constants/state_pesticide_laws.json"
        
        os.makedirs(os.path.dirname(dest), exist_ok=True)
        shutil.copy(src, dest)
        logger.info(f"Database Migration: Successfully copied laws JSON from {src} to {dest}")
    except Exception as e:
        logger.error(f"Failed to copy laws JSON: {e}")

    # 2. Add columns to chemical_reports table if missing
    try:
        with engine.begin() as conn:
            # Check existing columns in chemical_reports table
            cursor = conn.execute(text("PRAGMA table_info(chemical_reports)"))
            columns = [row[1] for row in cursor.fetchall()]
            
            if columns:  # Only migrate if table exists
                if "state" not in columns:
                    logger.info("Migrating server SQLite database: adding 'state' column to 'chemical_reports'.")
                    conn.execute(text("ALTER TABLE chemical_reports ADD COLUMN state VARCHAR(10) NOT NULL DEFAULT 'TX'"))
                if "dynamic_fields" not in columns:
                    logger.info("Migrating server SQLite database: adding 'dynamic_fields' column to 'chemical_reports'.")
                    conn.execute(text("ALTER TABLE chemical_reports ADD COLUMN dynamic_fields TEXT"))
                
                # Compliance Columns Migrations
                compliance_cols = [
                    ("epa_reg_no", "VARCHAR(50)"),
                    ("applicator_name", "VARCHAR(255)"),
                    ("applicator_license", "VARCHAR(100)"),
                    ("area_treated", "FLOAT"),
                    ("crop_treated", "VARCHAR(255)"),
                    ("target_pest", "VARCHAR(255)"),
                    ("application_method", "VARCHAR(255)"),
                    ("start_time", "VARCHAR(50)"),
                    ("end_time", "VARCHAR(50)"),
                    ("wind_speed", "FLOAT"),
                    ("wind_direction", "VARCHAR(50)"),
                    ("temperature", "FLOAT"),
                    ("permit_number", "VARCHAR(100)"),
                    ("county", "VARCHAR(100)"),
                    ("rei_hours", "INTEGER"),
                    ("phi_days", "INTEGER"),
                    ("applicator_signature", "TEXT")
                ]
                for col_name, col_type in compliance_cols:
                    if col_name not in columns:
                        logger.info(f"Migrating server SQLite database: adding '{col_name}' column to 'chemical_reports'.")
                        conn.execute(text(f"ALTER TABLE chemical_reports ADD COLUMN {col_name} {col_type}"))
    except Exception as e:
        logger.error(f"Migration error: {e}")

run_migrations()

app = FastAPI(
    title="Farm Communication & Sync Server",
    description="Offline-first background synchronization server",
    version="1.0.0"
)

# Enable CORS for local cross-origin connections
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Table to Model map
TABLE_MODELS = {
    "messages": Message,
    "tasks": Task,
    "maintenance_logs": MaintenanceLog,
    "chemical_reports": ChemicalReport,
    "observations": Observation,
    "media_posts": MediaPost
}

# Tables that bypass LWW and trigger a conflict if modified concurrently
HIGH_VALUE_TABLES = {"maintenance_logs", "chemical_reports", "observations"}

def model_to_dict(model_instance) -> Dict[str, Any]:
    """Helper function to convert SQLAlchemy object to a dictionary."""
    if not model_instance:
        return {}
    res = {}
    for column in model_instance.__table__.columns:
        val = getattr(model_instance, column.name)
        if isinstance(val, datetime):
            res[column.name] = val.isoformat()
        else:
            res[column.name] = val
    return res

def parse_payload_datetimes(payload: Dict[str, Any]) -> Dict[str, Any]:
    """Converts ISO datetime strings in a payload dict into python datetime objects for SQLAlchemy SQLite compat."""
    parsed = {}
    for k, v in payload.items():
        if k in ["created_at", "updated_at", "synced_at", "due_date"] and isinstance(v, str):
            try:
                parsed[k] = datetime.fromisoformat(v.replace("Z", "+00:00")).replace(tzinfo=None)
            except ValueError:
                parsed[k] = v
        else:
            parsed[k] = v
    return parsed

@app.post("/sync", response_model=SyncResponse)
def sync_data(req: SyncRequest, db: Session = Depends(get_db)):
    server_time = datetime.utcnow()
    sync_results = []
    
    logger.info(f"Sync request received from client {req.client_id}. Queue size: {len(req.queue)}")
    
    # 1. Process client mutations sequentially
    for op in req.queue:
        table_name = op.target_table
        if table_name not in TABLE_MODELS:
            sync_results.append(SyncResult(
                record_id=op.record_id,
                target_table=table_name,
                status="conflict",
                remote_data={"error": f"Table '{table_name}' does not exist on server."}
            ))
            continue
            
        ModelClass = TABLE_MODELS[table_name]
        record_id = op.record_id
        
        # Look up existing record
        db_record = db.query(ModelClass).filter(ModelClass.id == record_id).first()
        
        # Parse payload datetime strings
        parsed_payload = parse_payload_datetimes(op.payload)
        
        # Scenario A: Record does not exist on server
        if not db_record:
            try:
                new_db_record = ModelClass(**parsed_payload)
                new_db_record.synced_at = server_time
                db.add(new_db_record)
                db.commit()
                sync_results.append(SyncResult(record_id=record_id, target_table=table_name, status="clean"))
            except Exception as e:
                db.rollback()
                logger.error(f"Error inserting record {record_id} in {table_name}: {e}")
                sync_results.append(SyncResult(
                    record_id=record_id,
                    target_table=table_name,
                    status="conflict",
                    remote_data={"error": f"Insert failed: {str(e)}"}
                ))
            continue
            
        # Scenario B: Record exists. Check for concurrent modifications.
        is_high_value = table_name in HIGH_VALUE_TABLES
        server_updated_at = db_record.updated_at
        
        # If server's record is newer than the client's last sync time AND has different content
        # we consider it a conflict for high-value data
        client_last_sync = req.last_synced_at or datetime.min
        
        if is_high_value and server_updated_at > client_last_sync:
            # Check if fields are actually different
            differs = False
            for k, v in parsed_payload.items():
                if k in ["synced_at", "updated_at"]:
                    continue
                db_val = getattr(db_record, k)
                if db_val != v:
                    differs = True
                    break
            
            if differs:
                # Conflict detected! Return server state without modifying server database
                logger.warning(f"Sync conflict on {table_name}:{record_id}. Rejecting client update.")
                sync_results.append(SyncResult(
                    record_id=record_id,
                    target_table=table_name,
                    status="conflict",
                    remote_data=model_to_dict(db_record)
                ))
                continue
                
        # Scenario C: Apply Last-Write-Wins (LWW) or update clean record
        incoming_updated_at = op.updated_at
        if isinstance(incoming_updated_at, str):
            try:
                incoming_updated_at = datetime.fromisoformat(incoming_updated_at.replace("Z", "+00:00")).replace(tzinfo=None)
            except ValueError:
                incoming_updated_at = datetime.min
        
        # If client's edit is newer than server's current state, overwrite the server record
        if incoming_updated_at >= server_updated_at:
            try:
                for k, v in parsed_payload.items():
                    setattr(db_record, k, v)
                db_record.synced_at = server_time
                db.commit()
                sync_results.append(SyncResult(record_id=record_id, target_table=table_name, status="clean"))
            except Exception as e:
                db.rollback()
                logger.error(f"Error updating record {record_id} in {table_name}: {e}")
                sync_results.append(SyncResult(
                    record_id=record_id,
                    target_table=table_name,
                    status="conflict",
                    remote_data={"error": f"Update failed: {str(e)}"}
                ))
        else:
            # Server record is newer and it wasn't high value, or they are identical.
            sync_results.append(SyncResult(
                record_id=record_id,
                target_table=table_name,
                status="clean"
            ))
            
    # 2. Query for new/updated records on the server since client's last sync time
    new_records = {}
    last_sync_time = req.last_synced_at or datetime.min
    
    for table_name, ModelClass in TABLE_MODELS.items():
        query_res = db.query(ModelClass).filter(ModelClass.synced_at > last_sync_time).all()
        new_records[table_name] = [model_to_dict(item) for item in query_res]
        
    return SyncResponse(
        sync_results=sync_results,
        new_records=new_records,
        server_time=server_time
    )

@app.get("/health")
def health_check():
    return {"status": "ok", "timestamp": datetime.utcnow().isoformat()}
