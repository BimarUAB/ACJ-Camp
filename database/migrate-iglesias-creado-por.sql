BEGIN;

ALTER TABLE iglesias
    ADD COLUMN IF NOT EXISTS creado_por INTEGER REFERENCES usuarios(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_iglesias_creado_por ON iglesias (creado_por);

COMMIT;