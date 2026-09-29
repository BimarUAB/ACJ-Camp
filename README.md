# ACJ Camp – Sistema de Gestión de Campamentos

Plataforma web responsive para la gestión de lugares de campamento, reservas, reseñas y administración de clubes juveniles adventistas en Bolivia.

## Tecnologías

- **Backend:** Node.js 20 + Express 4, API REST con arquitectura MVC
- **Frontend:** React 18 + Vite + Tailwind CSS 3.4, React Router y Axios
- **Base de datos:** PostgreSQL 15+ + PostGIS 3.4 y `btree_gist`
- **Mapas:** Leaflet 1.9 + React-Leaflet sobre OpenStreetMap
- **Imágenes:** Cloudinary en producción; almacenamiento local de desarrollo si faltan credenciales
- **Autenticación:** JWT (7 días), bcrypt (12 rounds), límite de login y bloqueo temporal
- **Mensajes:** SweetAlert2 en español

## Estructura del proyecto

```
campusab/
├── backend/          # API REST
│   ├── controllers/  # Lógica de negocio
│   ├── routes/       # Definición de endpoints
│   ├── middleware/   # Autenticación, subida de archivos
│   └── config/       # Configuración de base de datos
├── frontend/         # Aplicación React
│   └── src/
│       ├── pages/    # Vistas principales
│       ├── components/  # Componentes reutilizables
│       └── services/    # Llamadas a la API
└── database/         # Scripts SQL
```

## Requisitos previos

- Node.js 20
- PostgreSQL 15+ con extensión PostGIS
- Extensión `btree_gist` (se habilita desde el esquema; puede requerir permisos de administrador)
- Cuenta en Cloudinary para producción; en desarrollo las imágenes se guardan en `backend/uploads` si no hay credenciales

## Instalación

### 1. Clonar o ubicar el proyecto

```bash
cd campusab
```

### 2. Instalar dependencias

```bash
cd backend
npm install
cd ../frontend
npm install
cd ..
```

### 3. Configurar la base de datos

El esquema habilita PostGIS y `btree_gist`, crea índices GIST y prohíbe solapamientos de reservas. Ejecuta desde la raíz del proyecto:

```bash
createdb -U postgres campusab
psql -U postgres -d campusab -f database/schema.sql
```

En Windows, si PostgreSQL no está en `PATH`, usa las rutas a `createdb.exe` y `psql.exe` de la versión instalada. Para una base ya existente no vuelvas a ejecutar `schema.sql`: revisa sus datos y aplica `database/migrate.sql`. La migración se detiene ante conflictos históricos para evitar borrar registros.

Para cargar ocho lugares marcados explícitamente como demostración, ejecuta el seed idempotente desde la raíz después de que PostgreSQL acepte conexiones:

```bash
psql -U postgres -d campusab -f database/seed-lugares-prueba.sql
```

Los registros quedan activos para probar el mapa y asignados a un administrador existente, que puede editarlos desde **Mis lugares**. Ejecutar el seed otra vez no duplica esos sitios.

En la base local inspeccionada durante esta implementación, PostgreSQL 18 está activo pero no tiene instalados los archivos de extensión de PostGIS ni `btree_gist`. Instala PostGIS 3.4 compatible con la versión de PostgreSQL que vayas a usar (o usa PostgreSQL 15 + PostGIS 3.4 como en el stack requerido) y confirma que `pg_available_extensions` lista ambas antes de ejecutar cualquiera de los scripts.

Para cargar ocho lugares de demostración en una base ya instalada, ejecuta desde la raíz del proyecto:

```bash
psql -U postgres -d campusab -f database/seed-lugares-prueba.sql
```

El seed es idempotente: no vuelve a insertar lugares con esos nombres. Los registros quedan asignados a un administrador activo para que puedan gestionarse desde **Mis lugares**; son datos ficticios y deben verificarse antes de usarlos como destinos reales.

La misma base tiene una reseña asociada a una reserva aún marcada `confirmada` y un director asociado a dos clubes. Verifica la visita y reasigna el liderazgo antes de migrar; no marques una visita como completada sin confirmarla ni quites un director de un club sin decidir quién lo administrará. Consultas de revisión:

```sql
SELECT r.id, r.reserva_id, b.estado, r.usuario_id, r.lugar_id
FROM resenas r LEFT JOIN reservas b ON b.id = r.reserva_id
WHERE r.reserva_id IS NULL OR b.estado <> 'completada';

SELECT director_id, array_agg(id) AS clubs
FROM clubs WHERE director_id IS NOT NULL
GROUP BY director_id HAVING count(*) > 1;
```

> Nota: el script incluye datos de ejemplo (iglesias, clubs, lugares, reservas y reseñas) y un usuario admin por defecto.

### 4. Configurar variables de entorno

Copia el archivo de ejemplo en `backend/.env`:

```bash
cd backend
cp .env.example .env
```

Edita `.env` con tus credenciales:

```env
DB_HOST=localhost
DB_PORT=5432
DB_NAME=campusab
DB_USER=postgres
DB_PASSWORD=TU_PASSWORD

PORT=5000
FRONTEND_URL=http://localhost:3000

JWT_SECRET=tu_clave_secreta_larga_y_aleatoria

CLOUDINARY_CLOUD_NAME=tu_cloud_name
CLOUDINARY_API_KEY=tu_api_key
CLOUDINARY_API_SECRET=tu_api_secret
```

En producción añade `NODE_ENV=production`, una `JWT_SECRET` aleatoria de al menos 32 caracteres, el origen del frontend en `FRONTEND_URL` y `TRUST_PROXY=true` si el backend está detrás de un proxy. Se admiten varios orígenes separados por comas.

### 5. Iniciar el proyecto

Backend:

```bash
cd backend
npm run dev
```

Frontend (en otra terminal; Vite usa el puerto 3000):

```bash
cd frontend
npm run dev
```

La aplicación estará disponible en `http://localhost:3000` y la API en `http://localhost:5000`.

## Usuario por defecto

- **Usuario:** `bimarjr@gmail.com`
- **Contraseña:** `admin123`
- **Rol:** admin

> Cambia esta contraseña inmediatamente en producción.

## Funcionalidades principales

- Registro e inicio de sesión con roles (`lider`, `director`, `admin`)
- Gestión de clubes por iglesia y director
- CRUD de lugares de campamento con geolocalización
- Cada usuario autenticado puede registrar lugares y editar los propios desde **Mis lugares**; un administrador los aprueba antes de publicarlos en el mapa.
- Cualquier usuario registrado puede agregar lugares; el autor puede editarlos posteriormente desde **Mis lugares**. Las propuestas nuevas quedan pendientes de aprobación antes de publicarse.
- Búsqueda con filtros por distancia, servicios, capacidad y calificación
- Capas de mapa OpenStreetMap y puntos de camping/caravanas comunitarios consultados por área visible
- Sistema de reservas con validación de conflictos de fechas
- Calendario de disponibilidad por lugar
- Reseñas y calificaciones (solo usuarios con reserva completada)
- Panel de administración con reportes y estadísticas
- Exportación de reportes a Excel (`.xlsx`) con encabezados en español

## Endpoints principales de la API

- `POST /api/auth/register` – Registro de usuario
- `POST /api/auth/login` – Inicio de sesión
- `GET /api/auth/profile` – Perfil del usuario autenticado
- `GET /api/auth/iglesias` – Iglesias disponibles
- `GET /api/auth/users?busqueda=...` – Buscar usuarios (admin)
- `GET /api/lugares` – Listar lugares (con filtros)
- `GET /api/mapa/campings-osm?bbox=sur,oeste,norte,este` – Consultar puntos de acampada OSM del área visible
- `POST /api/lugares` – Crear lugar (requiere autenticación)
- `GET /api/reservas/mis` – Mis reservas
- `POST /api/reservas` – Crear reserva
- `GET /api/resenas` – Listar reseñas
- `POST /api/resenas` – Crear reseña
- `GET /api/reportes/dashboard` – Estadísticas (admin)
- `GET /api/reportes/exportar-lugares` – Descargar Excel (admin)
- `GET /api/health` – Estado de API y base de datos

## Scripts útiles

```bash
# Backend
npm run dev       # Iniciar en modo desarrollo con nodemon
npm start         # Iniciar en modo producción

# Frontend
npm run dev       # Servidor de desarrollo
npm run build     # Build de producción
npm run preview   # Previsualizar build
```

## Notas de seguridad

- El backend valida roles y propiedad de recursos.
- No se acepta `usuario_id` desde el body; siempre se usa el ID del token JWT.
- Las contraseñas se almacenan con bcrypt y salt 12.
- El autorregistro siempre crea usuarios con rol `lider`; un administrador asigna roles.
- El login limita cinco intentos por IP y bloquea una cuenta durante 15 minutos tras cinco fallos.
- PostgreSQL impide reservas solapadas concurrentes; las cancelaciones conservan el historial.
- Las reseñas requieren una reserva completada del mismo usuario y lugar.
- En producción, usa HTTPS y una clave JWT segura.

## Despliegue

- **Backend:** despliega `backend/` en Render como servicio Node. Configura DB, `PORT`, `NODE_ENV=production`, `JWT_SECRET`, `FRONTEND_URL` y `TRUST_PROXY=true`. Verifica que PostgreSQL permita PostGIS y `btree_gist`.
- **Frontend:** despliega `frontend/` en Vercel como aplicación Vite y define `VITE_API_URL` con la URL pública del backend terminada en `/api`.
- **Base de datos:** usa PostgreSQL institucional o administrado; ejecuta `schema.sql` en una base nueva o `migrate.sql` tras revisar la base existente.
- **Imágenes:** carga las credenciales de Cloudinary solo en el entorno del backend. No publiques secretos en Vercel ni en el repositorio.

La matriz de pruebas está en [database/acceptance-tests.md](database/acceptance-tests.md). Los flujos que dependen de PostgreSQL/PostGIS todavía requieren ejecución contra una base configurada antes de producción.

### Capas y puntos de acampada

En el mapa abre **Capas del mapa**. Ahí puedes cambiar el mapa base, activar/desactivar **Puntos de acampada OSM** y actualizar esos puntos. La consulta sigue el rectángulo visible, se cachea diez minutos y usa servicios Overpass de respaldo. Los marcadores de OpenStreetMap son independientes de la base PostgreSQL de ACJ Camp; tus lugares registrados y aprobados se muestran aparte cuando la base está disponible.

Los puntos comunitarios aparecen si alguien los ha registrado en OpenStreetMap con `tourism=camp_site` o `tourism=caravan_site`. Desde el popup se abre el objeto en OpenStreetMap para revisarlo o contribuir. Los datos de OpenStreetMap se atribuyen a sus colaboradores y se publican bajo ODbL. La disponibilidad y actualización de Overpass dependen de servicios públicos externos, por lo que se conserva una respuesta en caché si el servicio falla.

## Licencia

Proyecto académico – Universidad Adventista de Bolivia.
