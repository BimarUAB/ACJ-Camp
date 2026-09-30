BEGIN;

ALTER TABLE reservas ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;

UPDATE reservas
SET expires_at = created_at + INTERVAL '48 hours'
WHERE estado = 'pendiente' AND expires_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_reservas_pendientes_vencimiento
    ON reservas (expires_at)
    WHERE estado = 'pendiente';

COMMIT;