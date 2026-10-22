ALTER TABLE movies
    ADD COLUMN IF NOT EXISTS original_title TEXT NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS original_language TEXT NOT NULL DEFAULT 'en',
    ADD COLUMN IF NOT EXISTS overview TEXT,
    ADD COLUMN IF NOT EXISTS overview_th TEXT,
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

UPDATE movies SET original_title = title WHERE original_title = '';

CREATE OR REPLACE VIEW movie_vote_stats AS
SELECT movie_id, count(*)::BIGINT AS vote_count, avg(score)::NUMERIC(4,1) AS vote_average
FROM votes
GROUP BY movie_id;
