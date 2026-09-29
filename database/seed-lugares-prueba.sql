BEGIN;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM usuarios WHERE rol = 'admin') THEN
        RAISE EXCEPTION 'Se necesita al menos un usuario admin para asignar los lugares de demostracion.';
    END IF;
END $$;

WITH propietario AS (
    SELECT id
    FROM usuarios
    WHERE rol = 'admin' AND estado = 'activo'
    ORDER BY id
    LIMIT 1
),
lugares_demo(nombre, descripcion, direccion, latitud, longitud, propietario_nombre, telefono, servicios, capacidad_maxima, precio_aprox) AS (
    VALUES
      ('DEMO - Refugio Valle Escondido', 'Lugar de demostracion para probar busqueda, fichas y edicion. Confirmar datos reales antes de uso.', 'Tiquipaya, Cochabamba', -17.3381::numeric, -66.2208::numeric, 'Equipo ACJ Camp', '70001001', '["agua","banos","senderos"]'::jsonb, 80, 25.00),
      ('DEMO - Campamento Quebrada Verde', 'Registro ficticio de prueba. No usar como ubicacion confirmada para actividades.', 'Coroico, La Paz', -16.1880::numeric, -67.7270::numeric, 'Equipo ACJ Camp', '70001002', '["agua","fogata","senderos"]'::jsonb, 60, 30.00),
      ('DEMO - Bosque de los Pinos', 'Lugar de demostracion para validar la gestion de campamentos y sus servicios.', 'Samaipata, Santa Cruz', -18.1800::numeric, -63.8750::numeric, 'Equipo ACJ Camp', '70001003', '["agua","banos","cocina"]'::jsonb, 100, 40.00),
      ('DEMO - Mirador de las Lomas', 'Registro ficticio para pruebas del mapa y los filtros de capacidad.', 'Lomas de Arena, Santa Cruz', -17.9160::numeric, -63.0670::numeric, 'Equipo ACJ Camp', '70001004', '["agua","estacionamiento","fogata"]'::jsonb, 120, 35.00),
      ('DEMO - Pampa de las Estrellas', 'Lugar de demostracion. La ubicacion y el contacto deben verificarse antes de una visita.', 'Achocalla, La Paz', -16.5680::numeric, -68.1850::numeric, 'Equipo ACJ Camp', '70001005', '["agua","carpa","senderos"]'::jsonb, 70, 20.00),
      ('DEMO - Orillas del Rio Claro', 'Registro de prueba para ensayar la edicion posterior por el propietario.', 'Villa Tunari, Cochabamba', -16.9720::numeric, -65.4190::numeric, 'Equipo ACJ Camp', '70001006', '["rio","agua","banos"]'::jsonb, 150, 45.00),
      ('DEMO - Jardin Alto del Sur', 'Lugar ficticio para verificar los marcadores de camping en el sur del pais.', 'Tarija, Tarija', -21.5350::numeric, -64.7300::numeric, 'Equipo ACJ Camp', '70001007', '["agua","electricidad","cocina"]'::jsonb, 90, 32.00),
      ('DEMO - Mirador de los Valles', 'Registro de demostracion editable; no representa una reserva ni disponibilidad confirmada.', 'Sucre, Chuquisaca', -19.0350::numeric, -65.2590::numeric, 'Equipo ACJ Camp', '70001008', '["agua","banos","estacionamiento"]'::jsonb, 110, 38.00)
)
INSERT INTO lugares_camping (
    nombre, descripcion, direccion, latitud, longitud, propietario, telefono,
    servicios, capacidad_maxima, precio_aprox, fotos, creado_por, estado
)
SELECT d.nombre, d.descripcion, d.direccion, d.latitud, d.longitud, d.propietario_nombre,
       d.telefono, d.servicios, d.capacidad_maxima, d.precio_aprox, '[]'::jsonb,
       propietario.id, 'activo'
FROM lugares_demo d
CROSS JOIN propietario
WHERE NOT EXISTS (
    SELECT 1 FROM lugares_camping existente WHERE existente.nombre = d.nombre
);

COMMIT;