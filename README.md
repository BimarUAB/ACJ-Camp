# CampUSAB – Sistema de Gestión de Campamentos

Plataforma web responsive para la gestión de lugares de campamento, reservas, reseñas y administración de clubes juveniles adventistas en Bolivia.

## Tecnologías

- **Backend:** Node.js + Express
- **Frontend:** React + Vite + Tailwind CSS
- **Base de datos:** PostgreSQL + PostGIS
- **Mapas:** Leaflet + OpenStreetMap
- **Imágenes:** Cloudinary
- **Autenticación:** JWT

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

- Node.js 18+
- PostgreSQL 15+ con extensión PostGIS
- Cuenta en Cloudinary (opcional, para imágenes)

## Instalación

### 1. Clonar o ubicar el proyecto

```bash
cd campusab
```

### 2. Instalar dependencias

```bash
cd backend && npm install
cd ../frontend && npm install
```

### 3. Configurar la base de datos

Si instalaste PostgreSQL en Windows, la ruta típica de `psql` es:

```bash
"C:\Program Files\PostgreSQL\18\bin\createdb.exe" -U postgres campusab
"C:\Program Files\PostgreSQL\18\bin\psql.exe" -U postgres -d campusab -f database/schema.sql
```

En Linux/macOS:

```bash
createdb campusab
psql -U postgres -d campusab -f database/schema.sql
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

### 5. Iniciar el proyecto

Backend:

```bash
cd backend
npm run dev
```

Frontend (en otra terminal):

```bash
cd frontend
npm run dev
```

La aplicación estará disponible en `http://localhost:3000` y la API en `http://localhost:5000`.

## Usuario por defecto

- **Usuario:** `bimarjr@gmail.com`
- **Contraseña:** `admin`
- **Rol:** admin

> Cambia esta contraseña inmediatamente en producción.

## Funcionalidades principales

- Registro e inicio de sesión con roles (`lider`, `director`, `admin`)
- Gestión de clubes por iglesia y director
- CRUD de lugares de campamento con geolocalización
- Búsqueda con filtros por distancia, servicios, capacidad y calificación
- Sistema de reservas con validación de conflictos de fechas
- Calendario de disponibilidad por lugar
- Reseñas y calificaciones (solo usuarios con reserva completada)
- Panel de administración con reportes y estadísticas
- Exportación de lugares a CSV

## Endpoints principales de la API

- `POST /api/auth/register` – Registro de usuario
- `POST /api/auth/login` – Inicio de sesión
- `GET /api/auth/profile` – Perfil del usuario autenticado
- `GET /api/lugares` – Listar lugares (con filtros)
- `POST /api/lugares` – Crear lugar (requiere autenticación)
- `GET /api/reservas/mis` – Mis reservas
- `POST /api/reservas` – Crear reserva
- `GET /api/resenas` – Listar reseñas
- `POST /api/resenas` – Crear reseña
- `GET /api/reportes/dashboard` – Estadísticas (admin)

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
- Las contraseñas se almacenan con bcrypt.
- En producción, usa HTTPS y una clave JWT segura.

## Licencia

Proyecto académico – Universidad Adventista de Bolivia.
