# 🏋️ SpartaGym Manager

Sistema web para la administración integral de gimnasios: socios, membresías
y pagos, control de asistencia por código QR, reportes y notificaciones.

![status](https://img.shields.io/badge/estado-Beta-blue) ![license](https://img.shields.io/badge/licencia-MIT-green)

## Tabla de contenidos

1. [Descripción](#descripción)
2. [Problema identificado](#problema-identificado)
3. [Solución](#solución)
4. [Arquitectura](#arquitectura)
5. [Requerimientos](#requerimientos)
6. [Instalación](#instalación)
   - [Ambiente de desarrollo](#ambiente-de-desarrollo)
   - [Ejecutar pruebas](#ejecutar-pruebas)
   - [Producción (Heroku o local)](#producción-heroku-o-local)
7. [Configuración](#configuración)
8. [Uso](#uso)
   - [Usuario final (Recepcionista)](#usuario-final-recepcionista)
   - [Usuario administrador](#usuario-administrador)
9. [Contribución](#contribución)
10. [Roadmap](#roadmap)
11. [Licencia](#licencia)

Para el detalle completo de requerimientos funcionales (RF-01 a RF-28) y el
plan de trabajo por milestones, ver la [wiki del repositorio](../../wiki) o
el documento de la Fase 3 (plan de acción).

---

## Descripción

SpartaGym Manager centraliza el registro de socios, el cobro y la vigencia
de membresías, el control de acceso por código QR y la generación de
reportes, con roles diferenciados de **Administrador** y **Recepcionista**.

## Problema identificado

Los gimnasios pequeños y medianos administran socios, pagos y asistencia de
forma manual (hojas de cálculo o papel), lo que provoca membresías vencidas
no detectadas a tiempo, pérdida de historial de pagos y control de acceso
deficiente en la entrada.

## Solución

Una aplicación web con una API REST (backend) y una interfaz de una sola
página (frontend) que resuelve, para el alcance Beta:

- Autenticación con roles (RF-01, RF-02) y expiración de sesión por
  inactividad (RF-03).
- Alta, edición y baja lógica de socios con consentimiento LFPDPPP
  (RF-05, RF-06, RF-09) y folio/QR único (RF-08).
- Catálogo de membresías, registro de pagos y cálculo automático de
  vencimiento (RF-10, RF-11), con identificación de vencidos/por vencer
  (RF-14).
- Check-in por folio/QR con bloqueo si la membresía está vencida
  (RF-15, RF-16).
- Contraseñas con hash (RF-24) y bitácora de auditoría de operaciones
  críticas (RF-25).
- Reportes básicos de socios, ingresos y asistencia por horario
  (RF-20, RF-21, RF-22) para el rol Administrador.

Los requerimientos del milestone **GA** (pasarela de pago externa,
notificaciones automáticas, exportación de reportes, etc.) se listan en el
[Roadmap](#roadmap).

## Arquitectura

Arquitectura cliente-servidor en tres capas, comunicadas por una API
REST/JSON:

```
┌─────────────────────┐        HTTPS/JSON        ┌──────────────────────┐        SQL        ┌──────────────┐
│  Frontend (SPA JS)   │ ────────────────────────▶ │  Backend (Node/Express) │ ─────────────────▶ │  Base de datos │
│  frontend/           │ ◀──────────────────────── │  backend/src/          │ ◀───────────────── │  SQLite/Postgres│
└─────────────────────┘                            └──────────────────────┘                    └──────────────┘
```

- **Frontend**: HTML/CSS/JS plano (sin build step), consume la API vía
  `fetch`. Se sirve como archivos estáticos desde el propio backend.
- **Backend**: Node.js + Express, autenticación con JWT, contraseñas con
  bcrypt, generación de QR con la librería `qrcode`.
- **Base de datos**: SQLite (`better-sqlite3`) para desarrollo y para la
  demo, por no requerir un servidor de base de datos independiente. Para un
  despliegue GA con persistencia real en Heroku se recomienda cambiar a
  PostgreSQL (ver [Roadmap](#roadmap)); el único archivo que cambiaría es
  `backend/src/config/db.js`.
- **Proxy/HTTPS**: en producción on-premise, Nginx actúa como proxy inverso
  y termina TLS frente al proceso de Node (RF-27); en Heroku, esto lo
  resuelve la plataforma.

## Requerimientos

| Componente | Detalle |
|---|---|
| Runtime | Node.js 18 LTS o superior |
| Gestor de paquetes | npm 9+ |
| Base de datos | SQLite (incluida vía `better-sqlite3`, no requiere instalación aparte) |
| Paquetes clave del backend | `express`, `better-sqlite3`, `bcryptjs`, `jsonwebtoken`, `qrcode`, `uuid`, `cors`, `dotenv` |
| Pruebas | `node:test` + `supertest` (incluidas como devDependency) |
| Producción (opcional) | Nginx (proxy inverso/TLS) si se despliega on-premise |

## Instalación

### Ambiente de desarrollo

```bash
# 1. Clonar el repositorio
git clone https://github.com/<owner>/spartagym-manager.git
cd spartagym-manager/backend

# 2. Instalar dependencias
npm install

# 3. Configurar variables de entorno
cp .env.example .env

# 4. Crear la base de datos y los datos iniciales (usuarios demo + catálogo)
npm run seed

# 5. Levantar el servidor (backend + frontend en el mismo puerto)
npm run dev
```

La aplicación queda disponible en **http://localhost:3000**. El seed crea
dos cuentas de prueba:

| Usuario | Contraseña | Rol |
|---|---|---|
| `admin` | `Admin123!` | administrador |
| `recepcion` | `Recepcion123!` | recepcionista |

> Cambia estas contraseñas antes de cualquier despliegue real.

### Ejecutar pruebas

```bash
cd backend
npm test
```

Corre la suite de integración (`backend/src/tests/api.test.js`) contra una
base de datos SQLite temporal, cubriendo login (RF-01), alta de socio con
consentimiento (RF-05/RF-09) y el ciclo pago→check-in (RF-11/RF-16).

### Producción (Heroku o local)

**Opción 1 — Heroku:**

```bash
heroku create spartagym-manager
heroku config:set JWT_SECRET="$(openssl rand -hex 32)"
git subtree push --prefix backend heroku master   # o conectar el repo desde el dashboard
heroku run npm run seed
```

> Nota: el sistema de archivos de Heroku es efímero, por lo que la base
> SQLite se reinicia en cada reinicio de dyno. Para una demo esto es
> aceptable; para GA, migrar `DB_PATH`/`db.js` a PostgreSQL usando el
> add-on `heroku-postgresql` y la variable `DATABASE_URL`.

**Opción 2 — Servidor local/on-premise:**

```bash
# En el servidor (Node.js 18 y Nginx instalados)
cd backend && npm install --omit=dev
npm run seed
npm start   # o gestionarlo con pm2 / systemd
```

Configura Nginx como proxy inverso hacia `localhost:3000` y habilita
HTTPS/TLS con un certificado (por ejemplo, Let's Encrypt) sobre el
dominio/subdominio propio.

## Configuración

| Archivo | Propósito |
|---|---|
| `backend/.env` | Variables de entorno: `PORT`, `JWT_SECRET`, `DB_PATH`. Se genera copiando `.env.example`. |
| `backend/src/config/db.js` | Conexión y esquema de base de datos; punto único de cambio para migrar a PostgreSQL/MySQL. |
| `backend/src/seed.js` | Datos iniciales (usuarios demo y catálogo de membresías). |

Variables de entorno (`backend/.env.example`):

```
PORT=3000
JWT_SECRET=change-this-to-a-long-random-string-in-production
DB_PATH=./data/spartagym.db
```

## Uso

### Usuario final (Recepcionista)

1. Iniciar sesión con usuario y contraseña.
2. En la pestaña **Socios**: registrar altas (nombre, teléfono, correo,
   contacto de emergencia) marcando el consentimiento de datos personales;
   el sistema genera folio y código QR automáticamente.
3. En la pestaña **Membresías**: capturar el folio del socio, elegir el
   tipo de membresía y registrar el pago; la vigencia se calcula sola.
4. En la pestaña **Asistencia**: capturar/escanear el folio para registrar
   la entrada; el sistema muestra si el acceso está permitido o denegado
   por membresía vencida.

### Usuario administrador

Además de lo anterior, el rol administrador puede:

- Dar de baja socios y restablecer contraseñas de otros usuarios.
- Ver la pestaña **Reportes**: socios activos/inactivos/vencidos, ingresos
  por periodo y asistencia por horario.
- Administrar el catálogo de tipos de membresía.

## Contribución

1. Clonar el repositorio:
   ```bash
   git clone https://github.com/<owner>/spartagym-manager.git
   ```
2. Crear un branch a partir de `develop` con el formato
   `feature/<id-issue>-descripcion-corta`:
   ```bash
   git checkout -b feature/RF-11-registro-pago
   ```
3. Hacer los cambios, agregar/actualizar pruebas y confirmar que
   `npm test` pasa localmente.
4. Hacer commit con mensajes descriptivos que referencien el issue y subir
   el branch:
   ```bash
   git commit -m "RF-11: calcula vencimiento automático al registrar pago"
   git push origin feature/RF-11-registro-pago
   ```
5. Abrir un Pull Request hacia `develop`, referenciando el issue (por
   ejemplo, `Closes #11`) para que se cierre automáticamente al hacer merge.
6. Esperar la revisión y, si aplica, el pipeline de CI; atender comentarios.
7. Una vez aprobado, el mantenedor hace merge a `develop`. Al cerrar un
   milestone, `develop` se integra a `master` vía un PR adicional y se
   etiqueta la release (por ejemplo, `v0.1.0-beta`).

## Roadmap

Elementos del milestone **GA** aún no incluidos en esta versión Beta:

- RF-04 Restablecimiento de contraseña por administrador vía UI de gestión de usuarios.
- RF-07 Búsqueda avanzada de socios.
- RF-12/RF-13 Pagos con tarjeta vía pasarela externa (Stripe/Mercado Pago) y comprobante imprimible.
- RF-17 Historial de asistencia detallado en el frontend.
- RF-18/RF-19 Notificaciones automáticas (WhatsApp/correo) y mensajes masivos.
- RF-23 Exportación de reportes en PDF/Excel.
- RF-26 Respaldos automáticos periódicos de base de datos.
- RF-28 Aviso de privacidad completo (LFPDPPP) en el frontend.
- Migración de SQLite a PostgreSQL para persistencia real en la nube.

Fuera de alcance de la v1 (backlog, ver issues `FUT-01` a `FUT-03`):
aplicación móvil nativa, integración con nómina de instructores, módulo de
venta de productos.

## Licencia

Este proyecto se distribuye bajo la licencia [MIT](LICENSE).

---

*Documentación generada como parte de la Fase IV del proyecto.*
