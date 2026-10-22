BEGIN;

CREATE TABLE genres (
    id      SERIAL PRIMARY KEY,
    name_en TEXT NOT NULL UNIQUE,
    name_th TEXT NOT NULL
);

CREATE TABLE movies (
    id                BIGINT PRIMARY KEY,
    title             TEXT NOT NULL,
    title_th          TEXT,
    original_title    TEXT NOT NULL DEFAULT '',
    original_language TEXT NOT NULL DEFAULT 'en',
    overview          TEXT,
    overview_th       TEXT,
    release_date      DATE,
    vote_average      NUMERIC(4,1) NOT NULL DEFAULT 0 CHECK (vote_average BETWEEN 0 AND 10),
    popularity        NUMERIC(12,4) NOT NULL DEFAULT 0,
    poster_path       TEXT,
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE movie_genres (
    movie_id  BIGINT NOT NULL REFERENCES movies(id) ON DELETE CASCADE,
    genre_id  INT NOT NULL REFERENCES genres(id),
    position  INT NOT NULL DEFAULT 0 CHECK (position >= 0),
    PRIMARY KEY (movie_id, genre_id),
    UNIQUE (movie_id, position)
);

CREATE TABLE members (
    id            BIGSERIAL PRIMARY KEY,
    email         TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    display_name  TEXT NOT NULL,
    role          TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('member', 'admin')),
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX members_email_lower_unique ON members (lower(email));

CREATE TABLE reviews (
    id         BIGSERIAL PRIMARY KEY,
    member_id  BIGINT NOT NULL REFERENCES members(id) ON DELETE CASCADE,
    movie_id   BIGINT NOT NULL REFERENCES movies(id) ON DELETE CASCADE,
    text       TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (member_id, movie_id)
);

CREATE TABLE votes (
    member_id BIGINT NOT NULL REFERENCES members(id) ON DELETE CASCADE,
    movie_id  BIGINT NOT NULL REFERENCES movies(id) ON DELETE CASCADE,
    score     SMALLINT NOT NULL CHECK (score BETWEEN 1 AND 10),
    PRIMARY KEY (member_id, movie_id)
);

CREATE TABLE wishlist_items (
    member_id BIGINT NOT NULL REFERENCES members(id) ON DELETE CASCADE,
    movie_id  BIGINT NOT NULL REFERENCES movies(id) ON DELETE CASCADE,
    note      TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (member_id, movie_id)
);

UPDATE movies SET original_title = title WHERE original_title = '';

CREATE VIEW movie_vote_stats AS
SELECT movie_id, count(*)::BIGINT AS vote_count, avg(score)::NUMERIC(4,1) AS vote_average
FROM votes
GROUP BY movie_id;

CREATE INDEX movies_title_lower_idx ON movies (lower(title));
CREATE INDEX movies_popularity_idx ON movies (popularity DESC);
CREATE INDEX reviews_movie_created_idx ON reviews (movie_id, created_at DESC);

INSERT INTO genres (name_en, name_th) VALUES
    ('Action', 'บู๊'),
    ('Adventure', 'ผจญภัย'),
    ('Animation', 'แอนิเมชัน'),
    ('Comedy', 'ตลก'),
    ('Crime', 'อาชญากรรม'),
    ('Documentary', 'สารคดี'),
    ('Drama', 'ดราม่า'),
    ('Family', 'ครอบครัว'),
    ('Fantasy', 'แฟนตาซี'),
    ('History', 'ประวัติศาสตร์'),
    ('Horror', 'สยองขวัญ'),
    ('Music', 'เพลง'),
    ('Mystery', 'ลึกลับ'),
    ('Romance', 'โรแมนติก'),
    ('Science Fiction', 'ไซไฟ'),
    ('TV Movie', 'ภาพยนตร์โทรทัศน์'),
    ('Thriller', 'ระทึกขวัญ'),
    ('War', 'สงคราม'),
    ('Western', 'ตะวันตก');

ALTER TABLE members ENABLE ROW LEVEL SECURITY;
ALTER TABLE movies ENABLE ROW LEVEL SECURITY;
ALTER TABLE genres ENABLE ROW LEVEL SECURITY;
ALTER TABLE movie_genres ENABLE ROW LEVEL SECURITY;
ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE wishlist_items ENABLE ROW LEVEL SECURITY;

COMMIT;
