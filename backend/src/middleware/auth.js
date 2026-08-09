const jwt = require("jsonwebtoken");

function requireAuth(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: "Token no proporcionado" });

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET || "dev-secret-change-me");
    req.user = payload; // { id, usuario, rol }
    return next();
  } catch (err) {
    return res.status(401).json({ error: "Token inválido o expirado" });
  }
}

// RF-02: Roles Administrador y Recepcionista con permisos diferenciados.
function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.rol)) {
      return res.status(403).json({ error: "No tienes permisos para esta operación" });
    }
    return next();
  };
}

module.exports = { requireAuth, requireRole };
