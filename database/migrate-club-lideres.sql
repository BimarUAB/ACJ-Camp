BEGIN;

CREATE TABLE IF NOT EXISTS club_lideres (
    club_id INTEGER NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
    lider_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (club_id, lider_id)
);

CREATE INDEX IF NOT EXISTS idx_club_lideres_lider_id ON club_lideres (lider_id);

COMMIT;