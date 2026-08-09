const express = require("express");
const { db } = require("../config/db");
const { requireAuth, requireRole } = require("../middleware/auth");
const { registrarAuditoria } = require("../models/auditoria");

const router = express.Router();

// RF-10: Catálogo de tipos de membresía (precio y vigencia).
router.get("/tipos", requireAuth, (req, res) => {
  res.json(db.prepare("SELECT * FROM tipos_membresia ORDER BY precio").all());
});

router.post("/tipos", requireAuth, requireRole("administrador"), (req, res) => {
  const { nombre, precio, duracion_dias } = req.body || {};
  if (!nombre || !precio || !duracion_dias) {
    return res.status(400).json({ error: "nombre, precio y duracion_dias son requeridos" });
  }
  const info = db.prepare(
    "INSERT INTO tipos_membresia (nombre, precio, duracion_dias) VALUES (?, ?, ?)"
  ).run(nombre, precio, duracion_dias);
  res.status(201).json(db.prepare("SELECT * FROM tipos_membresia WHERE id = ?").get(info.lastInsertRowid));
});

// RF-11: Registro de pago y cálculo automático de vencimiento.
// RF-13: El "comprobante" se sirve como el propio registro de pago devuelto (imprimible desde el frontend).
router.post("/pagos", requireAuth, (req, res) => {
  const { socio_id, tipo_membresia_id, metodo } = req.body || {};
  if (!socio_id || !tipo_membresia_id) {
    return res.status(400).json({ error: "socio_id y tipo_membresia_id son requeridos" });
  }

  const socio = db.prepare("SELECT * FROM socios WHERE id = ?").get(socio_id);
  if (!socio) return res.status(404).json({ error: "Socio no encontrado" });

  const tipo = db.prepare("SELECT * FROM tipos_membresia WHERE id = ?").get(tipo_membresia_id);
  if (!tipo) return res.status(404).json({ error: "Tipo de membresía no encontrado" });

  // Vigencia se calcula desde la fecha de vencimiento previa si aún no vence
  // (para no "perder" días si se renueva antes de tiempo), o desde hoy.
  const ultimoPago = db.prepare(`
    SELECT * FROM pagos WHERE socio_id = ? ORDER BY fecha_vencimiento DESC LIMIT 1
  `).get(socio_id);

  const ahora = new Date();
  let base = ahora;
  if (ultimoPago && new Date(ultimoPago.fecha_vencimiento) > ahora) {
    base = new Date(ultimoPago.fecha_vencimiento);
  }
  const vencimiento = new Date(base);
  vencimiento.setDate(vencimiento.getDate() + tipo.duracion_dias);

  const info = db.prepare(`
    INSERT INTO pagos (socio_id, tipo_membresia_id, monto, metodo, fecha_vencimiento, registrado_por)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(socio_id, tipo_membresia_id, tipo.precio, metodo || "efectivo", vencimiento.toISOString(), req.user.id);

  registrarAuditoria(req.user.id, "registrar_pago", `Pago de ${tipo.nombre} para socio #${socio_id}`);

  const pago = db.prepare("SELECT * FROM pagos WHERE id = ?").get(info.lastInsertRowid);
  res.status(201).json(pago);
});

router.get("/pagos/socio/:socioId", requireAuth, (req, res) => {
  res.json(
    db.prepare("SELECT * FROM pagos WHERE socio_id = ? ORDER BY fecha_pago DESC").all(req.params.socioId)
  );
});

// RF-14: Identificación de socios con membresía vencida o próxima a vencer.
router.get("/vencimientos", requireAuth, (req, res) => {
  const dias = Number(req.query.dias || 7);
  const rows = db.prepare(`
    SELECT s.id, s.folio, s.nombre, MAX(p.fecha_vencimiento) AS fecha_vencimiento
    FROM socios s
    JOIN pagos p ON p.socio_id = s.id
    WHERE s.activo = 1
    GROUP BY s.id
    HAVING julianday(fecha_vencimiento) - julianday('now') <= ?
    ORDER BY fecha_vencimiento ASC
  `).all(dias);

  const hoy = new Date();
  const resultado = rows.map((r) => ({
    ...r,
    estado: new Date(r.fecha_vencimiento) < hoy ? "vencida" : "por_vencer",
  }));
  res.json(resultado);
});

module.exports = router;
