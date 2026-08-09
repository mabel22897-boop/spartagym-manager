const express = require("express");
const { db } = require("../config/db");
const { requireAuth } = require("../middleware/auth");
const { registrarAuditoria } = require("../models/auditoria");

const router = express.Router();

// RF-15: Registro de entrada por escaneo de QR/folio.
// RF-16: Alerta visual y restricción de acceso si la membresía está vencida.
router.post("/checkin", requireAuth, (req, res) => {
  const { folio } = req.body || {};
  if (!folio) return res.status(400).json({ error: "folio es requerido" });

  const socio = db.prepare("SELECT * FROM socios WHERE folio = ? AND activo = 1").get(folio);
  if (!socio) return res.status(404).json({ error: "Folio no reconocido" });

  const ultimoPago = db.prepare(`
    SELECT * FROM pagos WHERE socio_id = ? ORDER BY fecha_vencimiento DESC LIMIT 1
  `).get(socio.id);

  const vigente = ultimoPago && new Date(ultimoPago.fecha_vencimiento) >= new Date();
  const permitido = Boolean(vigente);
  const motivo = permitido ? "Membresía vigente" : "Membresía vencida o sin pagos registrados";

  db.prepare(`
    INSERT INTO asistencias (socio_id, acceso_permitido, motivo) VALUES (?, ?, ?)
  `).run(socio.id, permitido ? 1 : 0, motivo);

  registrarAuditoria(req.user.id, "checkin", `Check-in de ${socio.nombre} (${permitido ? "permitido" : "denegado"})`);

  res.json({
    socio: { id: socio.id, folio: socio.folio, nombre: socio.nombre },
    acceso_permitido: permitido,
    motivo,
    fecha_vencimiento: ultimoPago ? ultimoPago.fecha_vencimiento : null,
  });
});

// RF-17: Historial de asistencia por socio y fecha.
router.get("/socio/:socioId", requireAuth, (req, res) => {
  res.json(
    db.prepare("SELECT * FROM asistencias WHERE socio_id = ? ORDER BY fecha_hora DESC")
      .all(req.params.socioId)
  );
});

module.exports = router;
