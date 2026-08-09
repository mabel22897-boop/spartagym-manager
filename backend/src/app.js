require("dotenv").config();
const path = require("path");
const express = require("express");
const cors = require("cors");
const { migrate } = require("./config/db");

migrate();

const app = express();

app.use(cors());
app.use(express.json());

// RF-27: en producción, HTTPS/TLS se termina en Nginx (proxy inverso) frente
// a este proceso; aquí solo forzamos algunas cabeceras básicas de seguridad.
app.use((req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  next();
});

app.get("/api/health", (req, res) => res.json({ status: "ok", version: "0.1.0-beta" }));

app.use("/api/auth", require("./routes/auth"));
app.use("/api/socios", require("./routes/socios"));
app.use("/api/membresias", require("./routes/membresias"));
app.use("/api/asistencia", require("./routes/asistencia"));
app.use("/api/reportes", require("./routes/reportes"));

// Sirve el frontend estático (SPA en HTML/JS plano, ver carpeta /frontend).
const frontendPath = path.join(__dirname, "..", "..", "frontend");
app.use(express.static(frontendPath));
app.get("*", (req, res, next) => {
  if (req.path.startsWith("/api/")) return next();
  res.sendFile(path.join(frontendPath, "index.html"));
});

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: "Error interno del servidor" });
});

const PORT = process.env.PORT || 3000;
if (require.main === module) {
  app.listen(PORT, () => console.log(`SpartaGym Manager API escuchando en puerto ${PORT}`));
}

module.exports = app;
