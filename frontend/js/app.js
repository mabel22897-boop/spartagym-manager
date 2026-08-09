// ---- Estado y utilidades ----
let currentUser = JSON.parse(localStorage.getItem("sg_user") || "null");

function showView(id) {
  document.querySelectorAll(".view").forEach((v) => v.classList.add("hidden"));
  document.getElementById(id).classList.remove("hidden");
}

function fmtFecha(iso) {
  if (!iso) return "-";
  return new Date(iso).toLocaleString("es-MX", { dateStyle: "medium", timeStyle: "short" });
}

function applyRoleVisibility() {
  const isAdmin = currentUser && currentUser.rol === "administrador";
  document.querySelectorAll(".admin-only").forEach((el) => {
    el.classList.toggle("hidden", !isAdmin);
  });
}

// ---- Login ----
document.getElementById("form-login").addEventListener("submit", async (e) => {
  e.preventDefault();
  const usuario = document.getElementById("login-usuario").value.trim();
  const password = document.getElementById("login-password").value;
  const errorEl = document.getElementById("login-error");
  errorEl.textContent = "";

  try {
    const { token, usuario: u } = await Api.login(usuario, password);
    localStorage.setItem("sg_token", token);
    localStorage.setItem("sg_user", JSON.stringify(u));
    currentUser = u;
    bootApp();
  } catch (err) {
    errorEl.textContent = err.message;
  }
});

document.getElementById("btn-logout").addEventListener("click", () => {
  localStorage.removeItem("sg_token");
  localStorage.removeItem("sg_user");
  currentUser = null;
  showView("view-login");
});

// RF-03: cierre de sesión automático por inactividad (15 min).
let inactivityTimer;
function resetInactivityTimer() {
  clearTimeout(inactivityTimer);
  inactivityTimer = setTimeout(() => {
    localStorage.removeItem("sg_token");
    localStorage.removeItem("sg_user");
    window.location.reload();
  }, 15 * 60 * 1000);
}
["click", "keydown", "mousemove"].forEach((evt) =>
  document.addEventListener(evt, resetInactivityTimer)
);

// ---- Tabs ----
document.getElementById("nav-tabs").addEventListener("click", (e) => {
  const btn = e.target.closest("button[data-tab]");
  if (!btn) return;
  document.querySelectorAll("#nav-tabs .tab").forEach((b) => b.classList.remove("active"));
  btn.classList.add("active");
  document.querySelectorAll(".tab-panel").forEach((p) => p.classList.add("hidden"));
  document.getElementById(`tab-${btn.dataset.tab}`).classList.remove("hidden");

  if (btn.dataset.tab === "membresias") cargarVencimientos();
  if (btn.dataset.tab === "reportes") cargarReportes();
});

// ---- Socios ----
async function cargarSocios(q) {
  const rows = await Api.socios.list(q);
  const tbody = document.getElementById("socios-tbody");
  tbody.innerHTML = rows.map((s) => `
    <tr>
      <td><code>${s.folio}</code></td>
      <td>${s.nombre}</td>
      <td>${s.telefono || "-"}</td>
      <td>${s.correo || "-"}</td>
      <td>
        <button class="link-btn" data-qr="${s.id}">Ver QR</button>
        <button class="link-btn danger" data-baja="${s.id}">Baja</button>
      </td>
    </tr>
  `).join("") || `<tr><td colspan="5">Sin socios registrados todavía.</td></tr>`;
}

document.getElementById("socios-buscar").addEventListener("input", (e) => {
  cargarSocios(e.target.value);
});

document.getElementById("socios-tbody").addEventListener("click", async (e) => {
  const qrId = e.target.dataset.qr;
  const bajaId = e.target.dataset.baja;
  if (qrId) {
    const { qr, folio } = await Api.socios.qr(qrId);
    const w = window.open("", "_blank", "width=300,height=380");
    w.document.write(`<h3 style="font-family:sans-serif">Folio: ${folio}</h3><img src="${qr}" width="240" />`);
  }
  if (bajaId && confirm("¿Dar de baja a este socio?")) {
    await Api.socios.remove(bajaId);
    cargarSocios(document.getElementById("socios-buscar").value);
  }
});

// Modal nuevo socio
const modalSocio = document.getElementById("modal-socio");
document.getElementById("btn-nuevo-socio").addEventListener("click", () => {
  document.getElementById("form-socio").reset();
  document.getElementById("socio-qr-resultado").classList.add("hidden");
  modalSocio.classList.remove("hidden");
});
document.getElementById("btn-cancelar-socio").addEventListener("click", () => {
  modalSocio.classList.add("hidden");
});

document.getElementById("form-socio").addEventListener("submit", async (e) => {
  e.preventDefault();
  const payload = {
    nombre: document.getElementById("socio-nombre").value.trim(),
    telefono: document.getElementById("socio-telefono").value.trim(),
    correo: document.getElementById("socio-correo").value.trim(),
    contacto_emergencia_nombre: document.getElementById("socio-emergencia-nombre").value.trim(),
    contacto_emergencia_telefono: document.getElementById("socio-emergencia-telefono").value.trim(),
    consentimiento_datos: document.getElementById("socio-consentimiento").checked,
  };
  try {
    const socio = await Api.socios.create(payload);
    const { qr } = await Api.socios.qr(socio.id);
    const box = document.getElementById("socio-qr-resultado");
    box.classList.remove("hidden");
    box.innerHTML = `<p><strong>Folio generado:</strong> ${socio.folio}</p><img src="${qr}" />`;
    await cargarSocios();
  } catch (err) {
    alert(err.message);
  }
});

// ---- Membresías ----
async function cargarTiposMembresia() {
  const tipos = await Api.membresias.tipos();
  document.getElementById("pago-tipo").innerHTML = tipos
    .map((t) => `<option value="${t.id}">${t.nombre} — $${t.precio} (${t.duracion_dias} días)</option>`)
    .join("");
}

async function cargarVencimientos() {
  const rows = await Api.membresias.vencimientos();
  const tbody = document.getElementById("vencimientos-tbody");
  tbody.innerHTML = rows.map((r) => `
    <tr>
      <td><code>${r.folio}</code></td>
      <td>${r.nombre}</td>
      <td>${fmtFecha(r.fecha_vencimiento)}</td>
      <td><span class="status-badge ${r.estado}">${r.estado === "vencida" ? "Vencida" : "Por vencer"}</span></td>
    </tr>
  `).join("") || `<tr><td colspan="4">Sin socios próximos a vencer.</td></tr>`;
}
document.getElementById("btn-refrescar-vencimientos").addEventListener("click", cargarVencimientos);

document.getElementById("btn-registrar-pago").addEventListener("click", async () => {
  const folio = document.getElementById("pago-folio").value.trim();
  const tipoMembresiaId = document.getElementById("pago-tipo").value;
  const metodo = document.getElementById("pago-metodo").value;
  const box = document.getElementById("pago-resultado");

  try {
    const socios = await Api.socios.list(folio);
    const socio = socios.find((s) => s.folio.toUpperCase() === folio.toUpperCase());
    if (!socio) throw new Error("No se encontró un socio con ese folio");

    const pago = await Api.membresias.pagar({
      socio_id: socio.id, tipo_membresia_id: tipoMembresiaId, metodo,
    });

    box.classList.remove("hidden", "denied");
    box.innerHTML = `Pago registrado. Nueva vigencia: <strong>${fmtFecha(pago.fecha_vencimiento)}</strong>`;
    cargarVencimientos();
  } catch (err) {
    box.classList.remove("hidden");
    box.classList.add("denied");
    box.textContent = err.message;
  }
});

// ---- Asistencia ----
document.getElementById("btn-checkin").addEventListener("click", async () => {
  const folio = document.getElementById("checkin-folio").value.trim();
  const box = document.getElementById("checkin-resultado");
  if (!folio) return;

  try {
    const r = await Api.asistencia.checkin(folio);
    box.classList.remove("hidden", "denied");
    if (!r.acceso_permitido) box.classList.add("denied");
    box.innerHTML = `
      <strong>${r.socio.nombre}</strong> (${r.socio.folio})<br/>
      ${r.acceso_permitido ? "✅ Acceso permitido" : "⛔ Acceso denegado"} — ${r.motivo}
    `;
  } catch (err) {
    box.classList.remove("hidden");
    box.classList.add("denied");
    box.textContent = err.message;
  }
  document.getElementById("checkin-folio").value = "";
  document.getElementById("checkin-folio").focus();
});
document.getElementById("checkin-folio").addEventListener("keydown", (e) => {
  if (e.key === "Enter") document.getElementById("btn-checkin").click();
});

// ---- Reportes ----
async function cargarReportes() {
  if (!currentUser || currentUser.rol !== "administrador") return;
  const [socios, ingresos, horario] = await Promise.all([
    Api.reportes.socios(), Api.reportes.ingresos(), Api.reportes.horario(),
  ]);
  document.getElementById("reporte-socios").innerHTML = `
    <p>Activos: <strong>${socios.activos}</strong></p>
    <p>Inactivos: <strong>${socios.inactivos}</strong></p>
    <p>Vencidos: <strong>${socios.vencidos}</strong></p>
  `;
  document.getElementById("reporte-ingresos").innerHTML = ingresos.length
    ? ingresos.map((i) => `<p>${i.periodo}: <strong>$${i.total}</strong> (${i.pagos} pagos)</p>`).join("")
    : "<p>Sin pagos registrados.</p>";
  document.getElementById("reporte-horario").innerHTML = horario.length
    ? horario.map((h) => `<p>${h.hora}:00 — <strong>${h.visitas}</strong> visitas</p>`).join("")
    : "<p>Sin asistencias registradas.</p>";
}

// ---- Boot ----
function bootApp() {
  document.getElementById("user-label").textContent =
    `${currentUser.nombre} (${currentUser.rol})`;
  applyRoleVisibility();
  showView("view-app");
  cargarSocios();
  cargarTiposMembresia();
  resetInactivityTimer();
}

if (currentUser && localStorage.getItem("sg_token")) {
  bootApp();
} else {
  showView("view-login");
}
