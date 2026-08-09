// Conexión a base de datos.
// Se usa SQLite (better-sqlite3) para desarrollo/demo porque no requiere un
// servidor de base de datos separado y corre igual en local o en un dyno de
// Heroku para la demo. En un despliegue GA real, este archivo es el único
// punto que cambiaría por un driver de PostgreSQL/MySQL (ver README, sección
// "Requerimientos" y "Roadmap").
const Database = require("better-sqlite3");
const path = require("path");
const fs = require("fs");

const DB_PATH = process.env.DB_PATH || path.join(__dirname, "..", "..", "data", "spartagym.db");

fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });

const db = new Database(DB_PATH);
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

function migrate() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS usuarios (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nombre TEXT NOT NULL,
      usuario TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      rol TEXT NOT NULL CHECK (rol IN ('administrador', 'recepcionista')),
      creado_en TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS socios (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      folio TEXT NOT NULL UNIQUE,
      nombre TEXT NOT NULL,
      telefono TEXT,
      correo TEXT,
      contacto_emergencia_nombre TEXT,
      contacto_emergencia_telefono TEXT,
      foto_url TEXT,
      consentimiento_datos INTEGER NOT NULL DEFAULT 0,
      activo INTEGER NOT NULL DEFAULT 1,
      creado_en TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS tipos_membresia (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nombre TEXT NOT NULL,
      precio REAL NOT NULL,
      duracion_dias INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS pagos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      socio_id INTEGER NOT NULL REFERENCES socios(id),
      tipo_membresia_id INTEGER NOT NULL REFERENCES tipos_membresia(id),
      monto REAL NOT NULL,
      metodo TEXT NOT NULL DEFAULT 'efectivo',
      fecha_pago TEXT NOT NULL DEFAULT (datetime('now')),
      fecha_vencimiento TEXT NOT NULL,
      registrado_por INTEGER REFERENCES usuarios(id)
    );

    CREATE TABLE IF NOT EXISTS asistencias (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      socio_id INTEGER NOT NULL REFERENCES socios(id),
      fecha_hora TEXT NOT NULL DEFAULT (datetime('now')),
      acceso_permitido INTEGER NOT NULL,
      motivo TEXT
    );

    CREATE TABLE IF NOT EXISTS auditoria (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      usuario_id INTEGER REFERENCES usuarios(id),
      accion TEXT NOT NULL,
      detalle TEXT,
      fecha_hora TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);
}

module.exports = { db, migrate };
