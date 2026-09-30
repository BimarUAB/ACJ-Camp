BEGIN;

CREATE EXTENSION IF NOT EXISTS btree_gist;

DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM reservas a
        JOIN reservas b ON a.lugar_id = b.lugar_id AND a.id < b.id
        WHERE a.estado IN ('confirmada', 'completada')
          AND b.estado IN ('confirmada', 'completada')
          AND daterange(a.fecha_inicio, a.fecha_fin, '[]')
              && daterange(b.fecha_inicio, b.fecha_fin, '[]')
    ) THEN
        RAISE EXCEPTION 'Hay reservas confirmadas con fechas solapadas. Corríjalas antes de aplicar la restricción.';
    END IF;

    ALTER TABLE reservas DROP CONSTRAINT IF EXISTS reservas_sin_solapamiento;
    ALTER TABLE reservas ADD CONSTRAINT reservas_sin_solapamiento EXCLUDE USING GIST (
        lugar_id WITH =,
        daterange(fecha_inicio, fecha_fin, '[]') WITH &&
    ) WHERE (estado IN ('confirmada', 'completada'));
END $$;

COMMIT;