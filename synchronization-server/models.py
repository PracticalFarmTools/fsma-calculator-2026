from sqlalchemy import Column, String, Boolean, DateTime, Text, Float, Integer
from datetime import datetime
from database import Base

class Message(Base):
    __tablename__ = "messages"

    id = Column(String(36), primary_key=True, index=True)
    room_id = Column(String(36), nullable=False)
    sender_id = Column(String(36), nullable=False)
    content = Column(Text, nullable=False)
    language_code = Column(String(10), default="en", nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow)
    synced_at = Column(DateTime, default=datetime.utcnow)
    is_deleted = Column(Boolean, default=False)

class Task(Base):
    __tablename__ = "tasks"

    id = Column(String(36), primary_key=True, index=True)
    title = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    assignee_id = Column(String(36), nullable=True)
    status = Column(String(50), default="pending")
    due_date = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow)
    synced_at = Column(DateTime, default=datetime.utcnow)
    is_deleted = Column(Boolean, default=False)

class MaintenanceLog(Base):
    __tablename__ = "maintenance_logs"

    id = Column(String(36), primary_key=True, index=True)
    equipment_name = Column(String(255), nullable=False)
    issue = Column(Text, nullable=False)
    action_taken = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow)
    synced_at = Column(DateTime, default=datetime.utcnow)
    is_deleted = Column(Boolean, default=False)

class ChemicalReport(Base):
    __tablename__ = "chemical_reports"

    id = Column(String(36), primary_key=True, index=True)
    field_id = Column(String(36), nullable=False)
    chemical_name = Column(String(255), nullable=False)
    amount_applied = Column(Float, nullable=False)
    state = Column(String(10), nullable=False, default="TX")
    dynamic_fields = Column(Text, nullable=True)
    epa_reg_no = Column(String(50), nullable=True)
    applicator_name = Column(String(255), nullable=True)
    applicator_license = Column(String(100), nullable=True)
    area_treated = Column(Float, nullable=True)
    crop_treated = Column(String(255), nullable=True)
    target_pest = Column(String(255), nullable=True)
    application_method = Column(String(255), nullable=True)
    start_time = Column(String(50), nullable=True)
    end_time = Column(String(50), nullable=True)
    wind_speed = Column(Float, nullable=True)
    wind_direction = Column(String(50), nullable=True)
    temperature = Column(Float, nullable=True)
    permit_number = Column(String(100), nullable=True)
    county = Column(String(100), nullable=True)
    rei_hours = Column(Integer, nullable=True)
    phi_days = Column(Integer, nullable=True)
    applicator_signature = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow)
    synced_at = Column(DateTime, default=datetime.utcnow)
    is_deleted = Column(Boolean, default=False)

class Observation(Base):
    __tablename__ = "observations"

    id = Column(String(36), primary_key=True, index=True)
    field_id = Column(String(36), nullable=False)
    notes = Column(Text, nullable=False)
    observed_by = Column(String(100), nullable=False)
    severity = Column(String(50), default="info")  # info, warning, critical
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow)
    synced_at = Column(DateTime, default=datetime.utcnow)
    is_deleted = Column(Boolean, default=False)

class MediaPost(Base):
    __tablename__ = "media_posts"

    id = Column(String(36), primary_key=True, index=True)
    image_url = Column(Text, nullable=False)  # Base64 data URI or hosted link
    caption = Column(Text, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow)
    synced_at = Column(DateTime, default=datetime.utcnow)
    is_deleted = Column(Boolean, default=False)
