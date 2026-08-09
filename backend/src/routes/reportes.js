const express = require("express");
const { db } = require("../config/db");
const { requireAuth, requireRole } = require("../middleware/auth");

const router = express.Router();

// RF-20: Reporte de ingresos por periodo (día/semana/mes).
router.get("/ingresos", requireAuth, requireRole("administrador"), (req, res) => {
  const periodo = req.query.periodo === "semana" ? "%Y-%W"
    : req.query.periodo === "mes" ? "%Y-%m"
    : "%Y-%m-%d";

  const rows = db.prepare(`
    SELECT strftime('${periodo}', fecha_pago) AS periodo, SUM(monto) AS total, COUNT(*) AS pagos
    FROM pagos GROUP BY periodo ORDER BY periodo DESC
  `).all();
  res.json(rows);
});

// RF-21: Reporte de socios activos, inactivos y vencidos.
router.get("/socios", requireAuth, requireRole("administrador"), (req, res) => {
  const activos = db.prepare("SELECT COUNT(*) c FROM socios WHERE activo = 1").get().c;
  const inactivos = db.prepare("SELECT COUNT(*) c FROM socios WHERE activo = 0").get().c;
  const vencidos = db.prepare(`
    SELECT COUNT(*) c FROM (
      SELECT s.id, MAX(p.fecha_vencimiento) AS venc FROM socios s
      JOIN pagos p ON p.socio_id = s.id WHERE s.activo = 1 GROUP BY s.id
      HAVING venc < datetime('now')
    )
  `).get().c;
  res.json({ activos, inactivos, vencidos });
});

// RF-22: Reporte de asistencia por horario (horas de mayor demanda).
router.get("/asistencia-horario", requireAuth, requireRole("administrador"), (req, res) => {
  const rows = db.prepare(`
    SELECT strftime('%H', fecha_hora) AS hora, COUNT(*) AS visitas
    FROM asistencias WHERE acceso_permitido = 1
    GROUP BY hora ORDER BY hora
  `).all();
  res.json(rows);
});

module.exports = router;
