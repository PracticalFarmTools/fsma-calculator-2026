from pydantic import BaseModel
from typing import Optional, List, Dict, Any
from datetime import datetime

# Base Schema for generic record details
class RecordBase(BaseModel):
    id: str
    created_at: datetime
    updated_at: datetime
    is_deleted: bool = False

# Message Schema
class MessageSchema(RecordBase):
    room_id: str
    sender_id: str
    content: str
    language_code: str = "en"
    synced_at: Optional[datetime] = None

    class Config:
        orm_mode = True

# Task Schema
class TaskSchema(RecordBase):
    title: str
    description: Optional[str] = None
    assignee_id: Optional[str] = None
    status: str = "pending"
    due_date: Optional[datetime] = None
    synced_at: Optional[datetime] = None

    class Config:
        orm_mode = True

# Maintenance Log Schema
class MaintenanceLogSchema(RecordBase):
    equipment_name: str
    issue: str
    action_taken: Optional[str] = None
    synced_at: Optional[datetime] = None

    class Config:
        orm_mode = True

# Chemical Report Schema
class ChemicalReportSchema(RecordBase):
    field_id: str
    chemical_name: str
    amount_applied: float
    state: str
    dynamic_fields: Optional[str] = None
    epa_reg_no: Optional[str] = None
    applicator_name: Optional[str] = None
    applicator_license: Optional[str] = None
    area_treated: Optional[float] = None
    crop_treated: Optional[str] = None
    target_pest: Optional[str] = None
    application_method: Optional[str] = None
    start_time: Optional[str] = None
    end_time: Optional[str] = None
    wind_speed: Optional[float] = None
    wind_direction: Optional[str] = None
    temperature: Optional[float] = None
    permit_number: Optional[str] = None
    county: Optional[str] = None
    rei_hours: Optional[int] = None
    phi_days: Optional[int] = None
    applicator_signature: Optional[str] = None
    synced_at: Optional[datetime] = None

    class Config:
        orm_mode = True

# Observation Schema
class ObservationSchema(RecordBase):
    field_id: str
    notes: str
    observed_by: str
    severity: str = "info"
    synced_at: Optional[datetime] = None

    class Config:
        orm_mode = True

# Media Post Schema
class MediaPostSchema(RecordBase):
    image_url: str
    caption: str
    synced_at: Optional[datetime] = None

    class Config:
        orm_mode = True

# Sync Operation Payload (Client to Server)
class SyncOperation(BaseModel):
    target_table: str
    record_id: str
    operation: str
    payload: Dict[str, Any]
    updated_at: datetime

# Full Sync Request Structure
class SyncRequest(BaseModel):
    client_id: str
    last_synced_at: Optional[datetime] = None
    queue: List[SyncOperation]

# Individual Sync Result Status
class SyncResult(BaseModel):
    record_id: str
    target_table: str
    status: str
    remote_data: Optional[Dict[str, Any]] = None

# Full Sync Response Structure
class SyncResponse(BaseModel):
    sync_results: List[SyncResult]
    new_records: Dict[str, List[Dict[str, Any]]]
    server_time: datetime
