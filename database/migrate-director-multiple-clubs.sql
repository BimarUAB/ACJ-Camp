BEGIN;

ALTER TABLE clubs DROP CONSTRAINT IF EXISTS clubs_director_id_key;
DROP INDEX IF EXISTS idx_clubs_director_unico;

COMMIT;