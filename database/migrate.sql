BEGIN;

CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS btree_gist;

ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS intentos_login_fallidos INTEGER NOT NULL DEFAULT 0;
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS bloqueado_hasta TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_lugares_ubicacion_gist ON lugares_camping USING GIST (
    (ST_SetSRID(ST_MakePoint(longitud::double precision, latitud::double precision), 4326)::geography)
);

DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM reservas a
        JOIN reservas b ON a.lugar_id = b.lugar_id AND a.id < b.id
        WHERE a.estado <> 'cancelada' AND b.estado <> 'cancelada'
          AND daterange(a.fecha_inicio, a.fecha_fin, '[]') && daterange(b.fecha_inicio, b.fecha_fin, '[]')
    ) THEN
        RAISE EXCEPTION 'Hay reservas solapadas. Resuelva los conflictos antes de instalar reservas_sin_solapamiento.';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'reservas_sin_solapamiento') THEN
        ALTER TABLE reservas ADD CONSTRAINT reservas_sin_solapamiento EXCLUDE USING GIST (
            lugar_id WITH =,
            daterange(fecha_inicio, fecha_fin, '[]') WITH &&
        ) WHERE (estado <> 'cancelada');
    END IF;

    IF EXISTS (SELECT 1 FROM resenas WHERE reserva_id IS NULL)
       OR EXISTS (SELECT reserva_id FROM resenas GROUP BY reserva_id HAVING COUNT(*) > 1)
       OR EXISTS (
           SELECT 1 FROM resenas r JOIN reservas b ON b.id = r.reserva_id
           WHERE b.estado <> 'completada'
       ) THEN
        RAISE EXCEPTION 'Hay reseñas sin reserva completada válida o repetida. Corrija esos datos antes de continuar.';
    END IF;

    ALTER TABLE resenas ALTER COLUMN reserva_id SET NOT NULL;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'resenas_reserva_id_key') THEN
        ALTER TABLE resenas ADD CONSTRAINT resenas_reserva_id_key UNIQUE (reserva_id);
    END IF;

END $$;

COMMIT;