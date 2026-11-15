-- =========================================================
-- Base de datos RELACIONAL (SQLite) — Ruta segura a Mount Sharp
-- Guarda lo que tiene estructura fija y relaciones claras:
-- exploradores, misiones, hallazgos y mensajes de la bitácora.
-- =========================================================
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS explorador (
    id          TEXT PRIMARY KEY,              -- ev1, ev2, ev3
    rol         TEXT NOT NULL,
    color       TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS mision (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    explorador  TEXT NOT NULL REFERENCES explorador(id),
    tipo        TEXT NOT NULL CHECK (tipo IN ('principal', 'secundaria')),
    origen      TEXT CHECK (origen IN ('asignada', 'propia')),
    nombre      TEXT NOT NULL,
    lon         REAL, lat REAL,
    estado      TEXT NOT NULL,                 -- propuesta, aceptada, en curso, completada, abortada
    km          REAL,
    creado      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS hallazgo (
    id          TEXT PRIMARY KEY,
    explorador  TEXT NOT NULL REFERENCES explorador(id),
    tipo        TEXT NOT NULL CHECK (tipo IN ('mineral', 'roca', 'otro')),
    nota        TEXT,
    lon         REAL NOT NULL, lat REAL NOT NULL, altura_m REAL,
    sol_min     REAL,                          -- minutos marcianos desde el inicio
    km          REAL,
    tiene_foto  INTEGER NOT NULL DEFAULT 0,
    creado      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS mensaje (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    explorador  TEXT NOT NULL REFERENCES explorador(id),
    remitente   TEXT NOT NULL CHECK (remitente IN ('explorador', 'tierra', 'sistema')),
    texto       TEXT NOT NULL,
    tipo        TEXT,                          -- texto, hallazgo, mision, pos, estado
    lon         REAL, lat REAL,
    sol_min     REAL,
    creado      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS reporte (
    id          TEXT PRIMARY KEY,
    autor       TEXT NOT NULL REFERENCES explorador(id),
    tipo        TEXT NOT NULL,
    lon         REAL NOT NULL,
    lat         REAL NOT NULL,
    elev_m      REAL DEFAULT 0.0,
    sol_min     REAL DEFAULT 0.0,
    km          REAL DEFAULT 0.0,
    texto       TEXT NOT NULL,
    adjuntos_json TEXT DEFAULT '{}',
    sync_status TEXT NOT NULL DEFAULT 'local',
    creado      TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Avisos compartidos: un hallazgo o una alerta de un explorador que los demás ven en su mapa y su bitácora.
-- Cada explorador sigue con su viaje separado; esto solo avisa. Los eventos (publicado, recibido, retirado)
-- van al almacén JSONL (colección "eventos"), no aquí.
CREATE TABLE IF NOT EXISTS aviso (
    id          TEXT PRIMARY KEY,
    autor       TEXT NOT NULL REFERENCES explorador(id),
    tipo        TEXT NOT NULL CHECK (tipo IN ('hallazgo', 'alerta_pendiente', 'alerta_radiacion')),
    texto       TEXT NOT NULL,
    lon         REAL NOT NULL, lat REAL NOT NULL,
    radio_km    REAL NOT NULL DEFAULT 0.3,       -- tamaño de la zona dibujada en el mapa
    region      TEXT NOT NULL DEFAULT 'gale',
    sol_min     REAL,                            -- reloj del autor (cada viaje tiene el suyo)
    estado      TEXT NOT NULL DEFAULT 'activo' CHECK (estado IN ('activo', 'retirado')),
    creado      TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS ix_aviso_autor ON aviso(autor);

CREATE INDEX IF NOT EXISTS ix_hallazgo_exp ON hallazgo(explorador);
CREATE INDEX IF NOT EXISTS ix_mensaje_exp ON mensaje(explorador);
CREATE INDEX IF NOT EXISTS ix_mision_exp ON mision(explorador);
CREATE INDEX IF NOT EXISTS ix_reporte_autor ON reporte(autor);

INSERT OR IGNORE INTO explorador (id, rol, color) VALUES
    ('ev1', 'Comandante', '#1E64DC'),
    ('ev2', 'Geóloga',    '#B5651D'),
    ('ev3', 'Ingeniero',  '#127846');
