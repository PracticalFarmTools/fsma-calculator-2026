# AGENTS.md

## System Identity
This project constructs a high-reliability, offline-first farm communication and mapping suite supporting iOS, Android, and a local Python-based synchronization server.

## Technical Teams & Folder Boundaries
- **Database Architect:**
  - **Path Boundary:** `client-mobile-app/`
  - **Responsibilities:** Managing client-side SQLite databases, IndexedDB tables, transaction schemas, and local sync queue writes.
- **P2P Network Engineer:**
  - **Path Boundary:** `client-mobile-app/`
  - **Responsibilities:** Building local mDNS discovery layers, socket reconnect routines, and TCP/UDP peer-to-peer data replication layers.
- **Geospatial Systems Engineer:**
  - **Path Boundary:** `client-mobile-app/` and `shared-protocols/`
  - **Responsibilities:** Implementing offline raster MapLibre layers, MBTiles decoders, and caching strategies.
- **Backend Automation Specialist:**
  - **Path Boundary:** `synchronization-server/`
  - **Responsibilities:** Designing Python/FastAPI REST endpoints to process batch synchronization uploads and conflict resolutions.

## Mandatory Coding Conventions
1. **Python Formatting:** Apply PEP 8 rules for all Python backend code.
2. **Transaction Isolation:** All local database mutations must be executed within transactions to guarantee ACID compliance during network disconnects.
3. **Soft Deletions:** Data rows must never be physically deleted on client devices; soft deletion via `is_deleted = 1` is strictly required until sync state is marked as 'clean'.
4. **Optimistic UI:** The client UI must render chat messages and task creation immediately with a 'dirty' state badge.
