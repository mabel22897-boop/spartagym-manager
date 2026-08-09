#!/usr/bin/env bash
# ============================================================
# Setup automático de GitHub para SpartaGym Manager (Fase 3)
# ============================================================
# Requisitos:
#   1. Tener instalado GitHub CLI:  https://cli.github.com
#   2. Haber corrido:  gh auth login
#   3. Ya debes tener el repo creado en GitHub (vacío o no).
#
# Uso:
#   chmod +x setup_github.sh
#   ./setup_github.sh <owner>/<repo>
#
# Ejemplo:
#   ./setup_github.sh miusuario/spartagym-manager
# ============================================================

set -e

REPO="$1"
if [ -z "$REPO" ]; then
  echo "Uso: ./setup_github.sh <owner>/<repo>"
  exit 1
fi

echo "Configurando repositorio: $REPO"
echo "------------------------------------------------------"

# ------------------------------------------------------------
# 1. Milestones
# ------------------------------------------------------------
echo "Creando milestones..."
gh api repos/$REPO/milestones -f title="Beta" -f description="Funcionalidades núcleo: autenticación, socios, membresías/pagos básicos, asistencia, seguridad base." -f state="open" || true
gh api repos/$REPO/milestones -f title="GA" -f description="Versión completa: notificaciones, reportes, exportaciones, integraciones externas y NFRs." -f state="open" || true
gh api repos/$REPO/milestones -f title="Backlog" -f description="Elementos fuera de alcance de la v1, solo referencia futura." -f state="open" || true

# ------------------------------------------------------------
# 2. Labels
# ------------------------------------------------------------
echo "Creando labels..."
LABELS=(infra setup docs git project-management ci-cd backend database design architecture testing
  M1-auth frontend M2-socios legal M3-membresias integracion-externa M4-asistencia
  M5-notificaciones M6-reportes M7-seguridad deployment fuera-de-alcance-v1 futuro)

for L in "${LABELS[@]}"; do
  gh label create "$L" --repo "$REPO" --color "ededed" 2>/dev/null || true
done

# ------------------------------------------------------------
# 3. Función helper para crear issues
# ------------------------------------------------------------
create_issue () {
  local title="$1"
  local labels="$2"
  local milestone="$3"
  local body="$4"
  echo "  -> $title"
  gh issue create --repo "$REPO" \
    --title "$title" \
    --body "$body" \
    --label "$labels" \
    --milestone "$milestone" || true
}

echo "------------------------------------------------------"
echo "Creando issues..."

# ---- 4.1 Infraestructura y configuración inicial ----
create_issue "INF-01: Configurar repositorio en GitHub (estructura, README, .gitignore, licencia)" "infra,setup,docs" "Beta" "Prioridad: Alta | Estimación: 0.5 día"
create_issue "INF-02: Crear branches develop y master, proteger master" "infra,git" "Beta" "Prioridad: Alta | Estimación: 0.25 día"
create_issue "INF-03: Integrar repositorio con Gitlo/Zube (tablero de proyecto)" "infra,project-management" "Beta" "Prioridad: Alta | Estimación: 0.5 día"
create_issue "INF-04: Configurar Travis CI (o Drone) y conectar repositorio" "infra,ci-cd" "Beta" "Prioridad: Alta | Estimación: 0.5 día"
create_issue "INF-05: Diseñar modelo entidad-relación de la base de datos" "backend,database,design" "Beta" "Prioridad: Alta | Estimación: 1.5 día"
create_issue "INF-06: Definir arquitectura de la aplicación y stack tecnológico" "architecture,design" "Beta" "Prioridad: Alta | Estimación: 1 día"
create_issue "INF-07: Configurar entorno base del proyecto (backend + frontend, linters)" "infra,setup" "Beta" "Prioridad: Alta | Estimación: 1 día"
create_issue "INF-08: Crear pruebas unitarias (JUnit/equivalente) mínimas e integrarlas al pipeline de CI" "testing,ci-cd" "Beta" "Prioridad: Alta | Estimación: 1 día"

# ---- 4.2 M1 - Autenticación y Roles ----
create_issue "RF-01: Inicio de sesión con usuario y contraseña" "M1-auth,backend,frontend" "Beta" "Prioridad: Alta | Estimación: 1 día"
create_issue "RF-02: Roles Administrador y Recepcionista con permisos diferenciados" "M1-auth,backend" "Beta" "Prioridad: Alta | Estimación: 1.5 día"
create_issue "RF-03: Cierre de sesión automático por inactividad (15 min)" "M1-auth,frontend" "Beta" "Prioridad: Media | Estimación: 0.5 día"
create_issue "RF-04: Restablecimiento de contraseña por Administrador" "M1-auth,backend" "GA" "Prioridad: Media | Estimación: 0.5 día"

# ---- 4.3 M2 - Gestión de Socios ----
create_issue "RF-05: Alta de socio (datos personales, contacto de emergencia, foto)" "M2-socios,backend,frontend" "Beta" "Prioridad: Alta | Estimación: 1.5 día"
create_issue "RF-06: Edición y baja lógica de socio" "M2-socios,backend,frontend" "Beta" "Prioridad: Alta | Estimación: 1 día"
create_issue "RF-07: Búsqueda de socio por nombre, teléfono o folio" "M2-socios,frontend" "GA" "Prioridad: Media | Estimación: 0.75 día"
create_issue "RF-08: Generación de código QR/folio único por socio" "M2-socios,backend" "Beta" "Prioridad: Alta | Estimación: 1 día"
create_issue "RF-09: Registro de consentimiento de datos personales (LFPDPPP)" "M2-socios,legal,backend" "Beta" "Prioridad: Alta | Estimación: 0.5 día"

# ---- 4.4 M3 - Membresías y Pagos ----
create_issue "RF-10: Catálogo de tipos de membresía (precio y vigencia)" "M3-membresias,backend,frontend" "Beta" "Prioridad: Alta | Estimación: 1 día"
create_issue "RF-11: Registro de pago y cálculo automático de vencimiento" "M3-membresias,backend" "Beta" "Prioridad: Alta | Estimación: 1.5 día"
create_issue "RF-12: Pagos en efectivo y con tarjeta vía pasarela externa (Stripe/Mercado Pago)" "M3-membresias,integracion-externa,backend" "GA" "Prioridad: Media | Estimación: 2 días"
create_issue "RF-13: Comprobante de pago digital con opción de impresión" "M3-membresias,frontend" "GA" "Prioridad: Media | Estimación: 1 día"
create_issue "RF-14: Identificación de socios con membresía vencida o próxima a vencer" "M3-membresias,backend" "Beta" "Prioridad: Alta | Estimación: 1 día"

# ---- 4.5 M4 - Control de Asistencia ----
create_issue "RF-15: Registro de entrada por escaneo de QR/folio" "M4-asistencia,backend,frontend" "Beta" "Prioridad: Alta | Estimación: 1 día"
create_issue "RF-16: Alerta visual y restricción de acceso si membresía vencida" "M4-asistencia,frontend" "Beta" "Prioridad: Alta | Estimación: 0.75 día"
create_issue "RF-17: Historial de asistencia por socio y fecha" "M4-asistencia,backend,frontend" "GA" "Prioridad: Media | Estimación: 1 día"

# ---- 4.6 M5 - Notificaciones ----
create_issue "RF-18: Recordatorio automático (WhatsApp/correo) de vencimiento" "M5-notificaciones,integracion-externa,backend" "GA" "Prioridad: Media | Estimación: 1.5 día"
create_issue "RF-19: Envío de mensajes masivos (promociones/avisos)" "M5-notificaciones,backend" "GA" "Prioridad: Baja | Estimación: 1 día"

# ---- 4.7 M6 - Reportes ----
create_issue "RF-20: Reporte de ingresos por periodo (día/semana/mes)" "M6-reportes,backend,frontend" "GA" "Prioridad: Media | Estimación: 1 día"
create_issue "RF-21: Reporte de socios activos, inactivos y vencidos" "M6-reportes,backend,frontend" "GA" "Prioridad: Media | Estimación: 1 día"
create_issue "RF-22: Reporte de asistencia por horario (horas de mayor demanda)" "M6-reportes,backend,frontend" "GA" "Prioridad: Baja | Estimación: 0.75 día"
create_issue "RF-23: Exportación de reportes en PDF/Excel" "M6-reportes,backend" "GA" "Prioridad: Baja | Estimación: 0.75 día"

# ---- 4.8 M7 - Seguridad (transversal) ----
create_issue "RF-24: Almacenamiento de contraseñas cifradas (hash)" "M7-seguridad,backend" "Beta" "Prioridad: Alta | Estimación: 0.5 día"
create_issue "RF-25: Bitácora de auditoría de operaciones críticas" "M7-seguridad,backend" "GA" "Prioridad: Alta | Estimación: 1 día"
create_issue "RF-26: Respaldos automáticos periódicos de base de datos" "M7-seguridad,infra" "GA" "Prioridad: Alta | Estimación: 0.5 día"
create_issue "RF-27: Cifrado de comunicación cliente-servidor (HTTPS/TLS)" "M7-seguridad,infra" "Beta" "Prioridad: Alta | Estimación: 0.5 día"
create_issue "RF-28: Cumplimiento LFPDPPP y aviso de privacidad" "M7-seguridad,legal,frontend" "GA" "Prioridad: Alta | Estimación: 0.5 día"

# ---- 4.9 Despliegue y documentación ----
create_issue "DEP-01: Despliegue en servidor accesible por internet con dominio/subdominio propio" "infra,deployment" "GA" "Prioridad: Alta | Estimación: 1 día"
create_issue "DEP-02: Elaboración de manual de usuario para personal de recepción" "docs" "GA" "Prioridad: Media | Estimación: 1 día"

# ---- 5. Backlog (fuera de alcance v1) ----
create_issue "FUT-01: Aplicación móvil nativa para socios" "fuera-de-alcance-v1,futuro" "Backlog" "Prioridad: Baja | Estimación: N/D"
create_issue "FUT-02: Integración con nómina de instructores" "fuera-de-alcance-v1,futuro" "Backlog" "Prioridad: Baja | Estimación: N/D"
create_issue "FUT-03: Módulo de venta de productos / tienda" "fuera-de-alcance-v1,futuro" "Backlog" "Prioridad: Baja | Estimación: N/D"

echo "------------------------------------------------------"
echo "Listo. Revisa: https://github.com/$REPO/issues y https://github.com/$REPO/milestones"
