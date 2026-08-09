// Pruebas mínimas de integración (INF-08), corren con: npm test
// Usan una base de datos SQLite temporal y aislada por ejecución.
process.env.DB_PATH = require("path").join(__dirname, "..", "..", "data", "test.db");
process.env.JWT_SECRET = "test-secret";

const fs = require("fs");
const path = require("path");
const test = require("node:test");
const assert = require("node:assert/strict");
const request = require("supertest");

const dbFile = process.env.DB_PATH;
for (const ext of ["", "-wal", "-shm"]) {
  if (fs.existsSync(dbFile + ext)) fs.unlinkSync(dbFile + ext);
}

const app = require("../app");
const { db } = require("../config/db");
const bcrypt = require("bcryptjs");

// Usuario administrador de prueba
db.prepare(`INSERT INTO usuarios (nombre, usuario, password_hash, rol) VALUES (?, ?, ?, ?)`)
  .run("Test Admin", "test-admin", bcrypt.hashSync("Password123!", 10), "administrador");

// Catálogo mínimo de membresía para pruebas
db.prepare(`INSERT INTO tipos_membresia (nombre, precio, duracion_dias) VALUES (?, ?, ?)`)
  .run("Mensual", 450, 30);

let token;

test("RF-01: login con credenciales válidas devuelve un token", async () => {
  const res = await request(app)
    .post("/api/auth/login")
    .send({ usuario: "test-admin", password: "Password123!" });

  assert.equal(res.status, 200);
  assert.ok(res.body.token);
  token = res.body.token;
});

test("RF-01: login con credenciales inválidas es rechazado", async () => {
  const res = await request(app)
    .post("/api/auth/login")
    .send({ usuario: "test-admin", password: "incorrecta" });

  assert.equal(res.status, 401);
});

test("Rutas protegidas rechazan peticiones sin token", async () => {
  const res = await request(app).get("/api/socios");
  assert.equal(res.status, 401);
});

test("RF-05/RF-09: alta de socio requiere consentimiento de datos", async () => {
  const sinConsentimiento = await request(app)
    .post("/api/socios")
    .set("Authorization", `Bearer ${token}`)
    .send({ nombre: "Juan Pérez" });
  assert.equal(sinConsentimiento.status, 400);

  const conConsentimiento = await request(app)
    .post("/api/socios")
    .set("Authorization", `Bearer ${token}`)
    .send({ nombre: "Juan Pérez", consentimiento_datos: true });
  assert.equal(conConsentimiento.status, 201);
  assert.ok(conConsentimiento.body.folio);
});

test("RF-11/RF-16: registrar pago habilita el check-in; sin pago se deniega", async () => {
  const socioRes = await request(app)
    .post("/api/socios")
    .set("Authorization", `Bearer ${token}`)
    .send({ nombre: "Ana López", consentimiento_datos: true });
  const folio = socioRes.body.folio;
  const socioId = socioRes.body.id;

  // Sin pago -> acceso denegado
  const checkinSinPago = await request(app)
    .post("/api/asistencia/checkin")
    .set("Authorization", `Bearer ${token}`)
    .send({ folio });
  assert.equal(checkinSinPago.status, 200);
  assert.equal(checkinSinPago.body.acceso_permitido, false);

  const tipos = await request(app)
    .get("/api/membresias/tipos")
    .set("Authorization", `Bearer ${token}`);
  const tipoId = tipos.body[0].id;

  const pago = await request(app)
    .post("/api/membresias/pagos")
    .set("Authorization", `Bearer ${token}`)
    .send({ socio_id: socioId, tipo_membresia_id: tipoId });
  assert.equal(pago.status, 201);
  assert.ok(new Date(pago.body.fecha_vencimiento) > new Date());

  // Con pago vigente -> acceso permitido
  const checkinConPago = await request(app)
    .post("/api/asistencia/checkin")
    .set("Authorization", `Bearer ${token}`)
    .send({ folio });
  assert.equal(checkinConPago.body.acceso_permitido, true);
});

test.after(() => {
  db.close();
  for (const ext of ["", "-wal", "-shm"]) {
    const f = dbFile + ext;
    if (fs.existsSync(f)) fs.unlinkSync(f);
  }
});
