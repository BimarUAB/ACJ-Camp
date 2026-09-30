-- ============================================================
-- BASE DE DATOS: campusab
-- Sistema de Gestión de Campamentos para Clubes Juveniles Adventistas
-- ============================================================

CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- Tabla: IGLESIA
CREATE TABLE iglesias (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(200) NOT NULL,
    direccion TEXT,
    zona VARCHAR(100),
    distrito VARCHAR(100),
    union_adventista VARCHAR(100),
    latitud DECIMAL(10, 8),
    longitud DECIMAL(11, 8),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabla: USUARIO
CREATE TABLE usuarios (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(150) NOT NULL,
    email VARCHAR(150) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    telefono VARCHAR(20),
    rol VARCHAR(20) DEFAULT 'lider' CHECK (rol IN ('lider', 'director', 'admin')),
    estado VARCHAR(20) DEFAULT 'activo' CHECK (estado IN ('activo', 'inactivo')),
    iglesia_id INTEGER REFERENCES iglesias(id),
    intentos_login_fallidos INTEGER NOT NULL DEFAULT 0,
    bloqueado_hasta TIMESTAMPTZ,
    ultimo_login TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabla: CLUB
CREATE TABLE clubs (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(150) NOT NULL,
    tipo VARCHAR(30) CHECK (tipo IN ('conquistadores', 'aventureros', 'ja')),
    iglesia_id INTEGER REFERENCES iglesias(id),
    director_id INTEGER REFERENCES usuarios(id),
    logo_url VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE club_lideres (
    club_id INTEGER NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
    lider_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (club_id, lider_id)
);

CREATE INDEX idx_club_lideres_lider_id ON club_lideres (lider_id);

-- Tabla: LUGAR_CAMPING
CREATE TABLE lugares_camping (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(200) NOT NULL,
    descripcion TEXT,
    direccion TEXT,
    latitud DECIMAL(10, 8) NOT NULL,
    longitud DECIMAL(11, 8) NOT NULL,
    propietario VARCHAR(150),
    contacto VARCHAR(150),
    telefono VARCHAR(20),
    servicios JSONB DEFAULT '[]',
    capacidad_maxima INTEGER,
    precio_aprox DECIMAL(10, 2),
    fotos JSONB DEFAULT '[]',
    estado VARCHAR(20) DEFAULT 'pendiente' CHECK (estado IN ('pendiente', 'activo', 'inactivo')),
    creado_por INTEGER REFERENCES usuarios(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabla: RESERVA
CREATE TABLE reservas (
    id SERIAL PRIMARY KEY,
    lugar_id INTEGER REFERENCES lugares_camping(id) ON DELETE CASCADE,
    club_id INTEGER REFERENCES clubs(id),
    usuario_id INTEGER REFERENCES usuarios(id),
    fecha_inicio DATE NOT NULL,
    fecha_fin DATE NOT NULL,
    proposito VARCHAR(100),
    estado VARCHAR(20) DEFAULT 'pendiente' CHECK (estado IN ('pendiente', 'confirmada', 'cancelada', 'completada')),
    notas TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMPTZ,
    CONSTRAINT fechas_validas CHECK (fecha_fin >= fecha_inicio),
    CONSTRAINT reservas_sin_solapamiento EXCLUDE USING GIST (
        lugar_id WITH =,
        daterange(fecha_inicio, fecha_fin, '[]') WITH &&
    ) WHERE (estado IN ('confirmada', 'completada'))
);

-- Tabla: RESENA (sin caracteres especiales para evitar problemas de codificación)
CREATE TABLE resenas (
    id SERIAL PRIMARY KEY,
    lugar_id INTEGER REFERENCES lugares_camping(id) ON DELETE CASCADE,
    usuario_id INTEGER REFERENCES usuarios(id),
    reserva_id INTEGER NOT NULL UNIQUE REFERENCES reservas(id),
    calificacion INTEGER NOT NULL CHECK (calificacion >= 1 AND calificacion <= 5),
    comentario TEXT,
    fotos JSONB DEFAULT '[]',
    fecha_visita DATE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Índices
CREATE INDEX idx_usuarios_email ON usuarios(email);
CREATE INDEX idx_usuarios_rol ON usuarios(rol);
CREATE INDEX idx_lugares_estado ON lugares_camping(estado);
CREATE INDEX idx_lugares_ubicacion_gist ON lugares_camping USING GIST (
    (ST_SetSRID(ST_MakePoint(longitud::double precision, latitud::double precision), 4326)::geography)
);
CREATE INDEX idx_reservas_fechas ON reservas(fecha_inicio, fecha_fin);
CREATE INDEX idx_resenas_lugar_id ON resenas(lugar_id);
CREATE INDEX idx_resenas_usuario_id ON resenas(usuario_id);

-- Datos de ejemplo: Iglesias en Bolivia
INSERT INTO iglesias (nombre, direccion, zona, distrito, union_adventista, latitud, longitud) VALUES
('Iglesia Adventista Central de Cochabamba', 'Av. América, Cochabamba', 'Central', 'Cochabamba', 'Unión Boliviana', -17.3895, -66.1568),
('Iglesia Adventista de La Paz', 'Calle 21 de Calacoto, La Paz', 'Sur', 'La Paz', 'Unión Boliviana', -16.5384, -68.0897),
('Iglesia Adventista de Santa Cruz', 'Av. San Martín, Santa Cruz', 'Norte', 'Santa Cruz', 'Unión Boliviana', -17.7833, -63.1821),
('Iglesia Adventista de Sucre', 'Calle Nicolás Ortiz, Sucre', 'Centro', 'Sucre', 'Unión Boliviana', -19.0353, -65.2592),
('Iglesia Adventista de Tarija', 'Calle Suipacha, Tarija', 'Sur', 'Tarija', 'Unión Boliviana', -21.5355, -64.7296);

-- Usuario admin por defecto (contraseña: admin123)
INSERT INTO usuarios (nombre, email, password_hash, telefono, rol, estado, iglesia_id) VALUES
('Administrador CampUSAB', 'bimarjr@gmail.com', '$2a$12$AlcriFB4vab3weOIlB31YuXxcFXDjnaugnXzogUWKE9MG7co8Tv9q', '70000000', 'admin', 'activo', 1);

-- Usuario director de ejemplo (contraseña: admin)
INSERT INTO usuarios (nombre, email, password_hash, telefono, rol, estado, iglesia_id) VALUES
('Director Ejemplo', 'director', '$2a$12$QQftSqjMttO.LX2bSd3N2eUj175MKL0kCzBv08A8yz2KPOA6SJWoa', '70000001', 'director', 'activo', 2);

INSERT INTO usuarios (nombre, email, password_hash, telefono, rol, estado, iglesia_id) VALUES
('Directora Ejemplo', 'directora', '$2a$12$QQftSqjMttO.LX2bSd3N2eUj175MKL0kCzBv08A8yz2KPOA6SJWoa', '70000002', 'director', 'activo', 2);

-- Clubs de ejemplo
INSERT INTO clubs (nombre, tipo, iglesia_id, director_id) VALUES
('Conquistadores Cochabamba Central', 'conquistadores', 1, 2),
('Aventureros La Paz Sur', 'aventureros', 2, 3);

-- Lugares de camping de ejemplo en Bolivia
INSERT INTO lugares_camping (nombre, descripcion, direccion, latitud, longitud, propietario, contacto, telefono, servicios, capacidad_maxima, precio_aprox, estado, creado_por) VALUES
('Campamento Tunari', 'Amplio campamento en las faldas del Tunari, ideal para actividades de clubes juveniles. Baños, agua y áreas de fogata.', 'Parque Nacional Tunari, Cochabamba', -17.2833, -66.5167, 'Municipio de Cochabamba', 'tunari@campusab.com', '4444444', '["agua", "baños", "fogata", "senderos"]', 200, 150.00, 'activo', 1),
('Campamento Lomas de Arena', 'Zona de arena y bosque cercano a Santa Cruz, perfecto para campamentos y caminatas.', 'Lomas de Arena, Santa Cruz', -17.9167, -63.0667, 'Privado', 'lomas@campusab.com', '3333333', '["agua", "electricidad", "fogata", "estacionamiento"]', 120, 200.00, 'activo', 1),
('Campamento Coroico', 'Campamento con vista a los Yungas, clima cálido y espacios verdes.', 'Coroico, La Paz', -16.1889, -67.7278, 'Privado', 'coroico@campusab.com', '2222222', '["agua", "baños", "carpa", "senderos"]', 80, 120.00, 'activo', 1),
('Campamento Samaipata', 'Cerca de las ruinas precolombinas de El Fuerte, ideal para retiros.', 'Samaipata, Santa Cruz', -18.1803, -63.8756, 'Municipio Samaipata', 'samaipata@campusab.com', '5555555', '["agua", "baños", "electricidad", "cocina"]', 150, 180.00, 'pendiente', 2);

-- Reservas de ejemplo
INSERT INTO reservas (lugar_id, club_id, usuario_id, fecha_inicio, fecha_fin, proposito, estado) VALUES
(1, 1, 2, '2026-09-15', '2026-09-17', 'Campamento de conquistadores', 'completada'),
(2, 2, 2, '2026-10-05', '2026-10-07', 'Caminata aventureros', 'pendiente');

-- Reseñas de ejemplo
INSERT INTO resenas (lugar_id, usuario_id, reserva_id, calificacion, comentario, fecha_visita) VALUES
(1, 2, 1, 5, 'Excelente lugar, muy buena infraestructura y ambiente natural.', '2026-09-17');
