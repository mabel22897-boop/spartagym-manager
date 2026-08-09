// Cliente ligero para consumir la API REST del backend.
const Api = (() => {
  function token() { return localStorage.getItem("sg_token"); }

  async function request(method, path, body) {
    const headers = { "Content-Type": "application/json" };
    const t = token();
    if (t) headers.Authorization = `Bearer ${t}`;

    const res = await fetch(`/api${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });

    if (res.status === 401) {
      // RF-03: sesión expirada o inválida -> forzar logout.
      localStorage.removeItem("sg_token");
      localStorage.removeItem("sg_user");
      window.location.reload();
      throw new Error("Sesión expirada");
    }

    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || "Error inesperado");
    return data;
  }

  return {
    login: (usuario, password) => request("POST", "/auth/login", { usuario, password }),
    socios: {
      list: (q) => request("GET", `/socios${q ? `?q=${encodeURIComponent(q)}` : ""}`),
      create: (data) => request("POST", "/socios", data),
      qr: (id) => request("GET", `/socios/${id}/qr`),
      remove: (id) => request("DELETE", `/socios/${id}`),
    },
    membresias: {
      tipos: () => request("GET", "/membresias/tipos"),
      pagar: (data) => request("POST", "/membresias/pagos", data),
      vencimientos: () => request("GET", "/membresias/vencimientos?dias=7"),
    },
    asistencia: {
      checkin: (folio) => request("POST", "/asistencia/checkin", { folio }),
    },
    reportes: {
      socios: () => request("GET", "/reportes/socios"),
      ingresos: () => request("GET", "/reportes/ingresos?periodo=dia"),
      horario: () => request("GET", "/reportes/asistencia-horario"),
    },
  };
})();
