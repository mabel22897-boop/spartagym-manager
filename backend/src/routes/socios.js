const express = require("express");
const { v4: uuidv4 } = require("uuid");
const QRCode = require("qrcode");
const { db } = require("../config/db");
const { requireAuth, requireRole } = require("../middleware/auth");
const { registrarAuditoria } = require("../models/auditoria");

const router = express.Router();

// RF-05: Alta de socio (datos personales, contacto de emergencia, foto).
// RF-08: Generación de código QR/folio único por socio.
// RF-09: Registro de consentimiento de datos personales (LFPDPPP).
router.post("/", requireAuth, (req, res) => {
  const {
    nombre, telefono, correo,
    contacto_emergencia_nombre, contacto_emergencia_telefono,
    foto_url, consentimiento_datos,
  } = req.body || {};

  if (!nombre) return res.status(400).json({ error: "nombre es requerido" });
  if (!consentimiento_datos) {
    return res.status(400).json({ error: "Se requiere el consentimiento de datos personales (LFPDPPP)" });
  }

  const folio = uuidv4().split("-")[0].toUpperCase();

  const info = db.prepare(`
    INSERT INTO socios (folio, nombre, telefono, correo, contacto_emergencia_nombre,
      contacto_emergencia_telefono, foto_url, consentimiento_datos)
    VALUES (?, ?, ?, ?, ?, ?, ?, 1)
  `).run(folio, nombre, telefono || null, correo || null, contacto_emergencia_nombre || null,
    contacto_emergencia_telefono || null, foto_url || null);

  registrarAuditoria(req.user.id, "alta_socio", `Alta de socio ${nombre} (folio ${folio})`);

  const socio = db.prepare("SELECT * FROM socios WHERE id = ?").get(info.lastInsertRowid);
  return res.status(201).json(socio);
});

// RF-08: Código QR del socio (codifica el folio) para el módulo de asistencia.
router.get("/:id/qr", requireAuth, async (req, res) => {
  const socio = db.prepare("SELECT * FROM socios WHERE id = ?").get(req.params.id);
  if (!socio) return res.status(404).json({ error: "Socio no encontrado" });

  const qrDataUrl = await QRCode.toDataURL(socio.folio);
  res.json({ folio: socio.folio, qr: qrDataUrl });
});

// RF-07: Búsqueda de socio por nombre, teléfono o folio.
router.get("/", requireAuth, (req, res) => {
  const { q } = req.query;
  let rows;
  if (q) {
    const like = `%${q}%`;
    rows = db.prepare(`
      SELECT * FROM socios
      WHERE activo = 1 AND (nombre LIKE ? OR telefono LIKE ? OR folio LIKE ?)
      ORDER BY nombre
    `).all(like, like, like);
  } else {
    rows = db.prepare("SELECT * FROM socios WHERE activo = 1 ORDER BY nombre").all();
  }
  res.json(rows);
});

router.get("/:id", requireAuth, (req, res) => {
  const socio = db.prepare("SELECT * FROM socios WHERE id = ?").get(req.params.id);
  if (!socio) return res.status(404).json({ error: "Socio no encontrado" });
  res.json(socio);
});

// RF-06: Edición y baja lógica de socio.
router.put("/:id", requireAuth, (req, res) => {
  const existing = db.prepare("SELECT * FROM socios WHERE id = ?").get(req.params.id);
  if (!existing) return res.status(404).json({ error: "Socio no encontrado" });

  const fields = ["nombre", "telefono", "correo", "contacto_emergencia_nombre",
    "contacto_emergencia_telefono", "foto_url"];
  const updates = fields.map((f) => (req.body[f] !== undefined ? req.body[f] : existing[f]));

  db.prepare(`
    UPDATE socios SET nombre=?, telefono=?, correo=?, contacto_emergencia_nombre=?,
      contacto_emergencia_telefono=?, foto_url=? WHERE id=?
  `).run(...updates, req.params.id);

  registrarAuditoria(req.user.id, "editar_socio", `Edición de socio #${req.params.id}`);
  res.json(db.prepare("SELECT * FROM socios WHERE id = ?").get(req.params.id));
});

router.delete("/:id", requireAuth, requireRole("administrador"), (req, res) => {
  const result = db.prepare("UPDATE socios SET activo = 0 WHERE id = ?").run(req.params.id);
  if (result.changes === 0) return res.status(404).json({ error: "Socio no encontrado" });

  registrarAuditoria(req.user.id, "baja_socio", `Baja lógica de socio #${req.params.id}`);
  res.json({ ok: true });
});

module.exports = router;
