// Crea datos iniciales para poder iniciar sesión y probar el sistema
// inmediatamente después de instalar. Ejecutar con: npm run seed
const bcrypt = require("bcryptjs");
const { db, migrate } = require("./config/db");

migrate();

const existingAdmin = db.prepare("SELECT * FROM usuarios WHERE usuario = ?").get("admin");
if (!existingAdmin) {
  db.prepare(`
    INSERT INTO usuarios (nombre, usuario, password_hash, rol)
    VALUES (?, ?, ?, ?)
  `).run("Administrador General", "admin", bcrypt.hashSync("Admin123!", 10), "administrador");
  console.log("Usuario admin creado -> usuario: admin | password: Admin123!");
} else {
  console.log("Usuario admin ya existía, se omite.");
}

const existingRecep = db.prepare("SELECT * FROM usuarios WHERE usuario = ?").get("recepcion");
if (!existingRecep) {
  db.prepare(`
    INSERT INTO usuarios (nombre, usuario, password_hash, rol)
    VALUES (?, ?, ?, ?)
  `).run("Recepción Turno 1", "recepcion", bcrypt.hashSync("Recepcion123!", 10), "recepcionista");
  console.log("Usuario recepcion creado -> usuario: recepcion | password: Recepcion123!");
} else {
  console.log("Usuario recepcion ya existía, se omite.");
}

const tiposExistentes = db.prepare("SELECT COUNT(*) c FROM tipos_membresia").get().c;
if (tiposExistentes === 0) {
  const insert = db.prepare(
    "INSERT INTO tipos_membresia (nombre, precio, duracion_dias) VALUES (?, ?, ?)"
  );
  insert.run("Mensual", 450, 30);
  insert.run("Trimestral", 1200, 90);
  insert.run("Anual", 4200, 365);
  console.log("Catálogo de membresías creado (Mensual, Trimestral, Anual).");
}

console.log("Seed completado.");
