const { db } = require("../config/db");

// RF-25: Bitácora de auditoría de operaciones críticas.
function registrarAuditoria(usuarioId, accion, detalle = "") {
  db.prepare(
    "INSERT INTO auditoria (usuario_id, accion, detalle) VALUES (?, ?, ?)"
  ).run(usuarioId || null, accion, detalle);
}

module.exports = { registrarAuditoria };
