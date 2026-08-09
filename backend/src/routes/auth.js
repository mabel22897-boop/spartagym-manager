const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { db } = require("../config/db");
const { requireAuth, requireRole } = require("../middleware/auth");
const { registrarAuditoria } = require("../models/auditoria");

const router = express.Router();

// RF-01: Inicio de sesión con usuario y contraseña.
router.post("/login", (req, res) => {
  const { usuario, password } = req.body || {};
  if (!usuario || !password) {
    return res.status(400).json({ error: "usuario y password son requeridos" });
  }

  const row = db.prepare("SELECT * FROM usuarios WHERE usuario = ?").get(usuario);
  if (!row) return res.status(401).json({ error: "Credenciales inválidas" });

  // RF-24: contraseñas almacenadas con hash (bcrypt), nunca en texto plano.
  const ok = bcrypt.compareSync(password, row.password_hash);
  if (!ok) return res.status(401).json({ error: "Credenciales inválidas" });

  const token = jwt.sign(
    { id: row.id, usuario: row.usuario, rol: row.rol, nombre: row.nombre },
    process.env.JWT_SECRET || "dev-secret-change-me",
    { expiresIn: "15m" } // RF-03: alineado al cierre de sesión por inactividad (15 min)
  );

  registrarAuditoria(row.id, "login", `Inicio de sesión de ${row.usuario}`);

  return res.json({
    token,
    usuario: { id: row.id, usuario: row.usuario, rol: row.rol, nombre: row.nombre },
  });
});

// RF-04: Restablecimiento de contraseña por Administrador.
router.post("/reset-password", requireAuth, requireRole("administrador"), (req, res) => {
  const { usuario_id, nueva_password } = req.body || {};
  if (!usuario_id || !nueva_password) {
    return res.status(400).json({ error: "usuario_id y nueva_password son requeridos" });
  }
  const hash = bcrypt.hashSync(nueva_password, 10);
  const result = db.prepare("UPDATE usuarios SET password_hash = ? WHERE id = ?").run(hash, usuario_id);
  if (result.changes === 0) return res.status(404).json({ error: "Usuario no encontrado" });

  registrarAuditoria(req.user.id, "reset-password", `Restablecimiento de contraseña para usuario #${usuario_id}`);
  return res.json({ ok: true });
});

router.get("/me", requireAuth, (req, res) => {
  res.json({ usuario: req.user });
});

module.exports = router;
