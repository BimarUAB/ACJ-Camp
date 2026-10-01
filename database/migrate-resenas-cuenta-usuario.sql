BEGIN;

ALTER TABLE resenas
    ALTER COLUMN reserva_id DROP NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_resenas_usuario_lugar_unique
    ON resenas (usuario_id, lugar_id);

COMMIT;