package store

import (
	"context"
	"errors"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
)

type ReviewAuthor struct {
	ID          int64  `json:"id"`
	DisplayName string `json:"displayName"`
}

type Review struct {
	ID        int64        `json:"id"`
	MemberID  int64        `json:"memberId"`
	MovieID   int64        `json:"movieId"`
	Text      string       `json:"text"`
	CreatedAt time.Time    `json:"createdAt"`
	UpdatedAt time.Time    `json:"updatedAt"`
	Member    ReviewAuthor `json:"member"`
	Score     *int16       `json:"score"`
}

func (s *Store) ListReviews(ctx context.Context, movieID int64) ([]Review, error) {
	rows, err := s.Pool.Query(ctx,
		`SELECT r.id, r.member_id, r.movie_id, r.text, r.created_at, r.updated_at,
                m.display_name, v.score
         FROM reviews r
         JOIN members m ON m.id = r.member_id
         LEFT JOIN votes v ON v.member_id = r.member_id AND v.movie_id = r.movie_id
         WHERE r.movie_id = $1
         ORDER BY r.created_at DESC`, movieID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []Review{}
	for rows.Next() {
		var r Review
		if err := rows.Scan(&r.ID, &r.MemberID, &r.MovieID, &r.Text,
			&r.CreatedAt, &r.UpdatedAt, &r.Member.DisplayName, &r.Score); err != nil {
			return nil, err
		}
		r.Member.ID = r.MemberID
		out = append(out, r)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	if len(out) == 0 {
		var movieExists bool
		if err := s.Pool.QueryRow(ctx,
			`SELECT EXISTS (SELECT 1 FROM movies WHERE id = $1)`, movieID).Scan(&movieExists); err != nil {
			return nil, err
		}
		if !movieExists {
			return nil, ErrNotFound
		}
	}
	return out, nil
}

func (s *Store) CreateReview(ctx context.Context, memberID, movieID int64, text string) (Review, error) {
	var review Review
	err := s.Pool.QueryRow(ctx,
		`WITH created AS (
             INSERT INTO reviews (member_id, movie_id, text)
             VALUES ($1, $2, $3)
             RETURNING id, member_id, movie_id, text, created_at, updated_at
         )
         SELECT r.id, r.member_id, r.movie_id, r.text, r.created_at, r.updated_at,
                m.display_name, v.score
         FROM created r
         JOIN members m ON m.id = r.member_id
         LEFT JOIN votes v ON v.member_id = r.member_id AND v.movie_id = r.movie_id`,
		memberID, movieID, text).
		Scan(&review.ID, &review.MemberID, &review.MovieID, &review.Text,
			&review.CreatedAt, &review.UpdatedAt, &review.Member.DisplayName, &review.Score)
	if err == nil {
		review.Member.ID = review.MemberID
		return review, nil
	}

	var pgErr *pgconn.PgError
	if errors.As(err, &pgErr) {
		switch pgErr.Code {
		case "23505":
			return Review{}, ErrDuplicateReview
		case "23503":
			return Review{}, ErrNotFound
		}
	}
	return Review{}, err
}

func (s *Store) DeleteReview(ctx context.Context, reviewID, memberID int64, isAdmin bool) error {
	tx, err := s.Pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	var ownerID int64
	err = tx.QueryRow(ctx,
		`SELECT member_id FROM reviews WHERE id = $1 FOR UPDATE`, reviewID).
		Scan(&ownerID)
	if errors.Is(err, pgx.ErrNoRows) {
		return ErrNotFound
	}
	if err != nil {
		return err
	}
	if ownerID != memberID && !isAdmin {
		return ErrForbidden
	}
	if _, err := tx.Exec(ctx, `DELETE FROM reviews WHERE id = $1`, reviewID); err != nil {
		return err
	}
	return tx.Commit(ctx)
}

type WishlistItem struct {
	Movie     Movie     `json:"movie"`
	Note      *string   `json:"note"`
	CreatedAt time.Time `json:"createdAt"`
}

func (s *Store) ListWishlist(ctx context.Context, memberID int64) ([]WishlistItem, error) {
	rows, err := s.Pool.Query(ctx,
		`SELECT m.id, m.title, m.title_th,
                (SELECT coalesce(g.name_th, g.name_en) FROM movie_genres mg
                   JOIN genres g ON g.id = mg.genre_id
                  WHERE mg.movie_id = m.id AND mg.position = 0),
                extract(year FROM m.release_date)::int,
                round(m.vote_average, 1)::float8,
                `+posterSQL+`,
                w.note, w.created_at
         FROM wishlist_items w
         JOIN movies m ON m.id = w.movie_id
         WHERE w.member_id = $1
         ORDER BY w.created_at DESC, m.title`, memberID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	items := []WishlistItem{}
	for rows.Next() {
		var item WishlistItem
		if err := rows.Scan(&item.Movie.ID, &item.Movie.Title, &item.Movie.TitleTh,
			&item.Movie.Genre, &item.Movie.Year, &item.Movie.Rating, &item.Movie.Poster,
			&item.Note, &item.CreatedAt); err != nil {
			return nil, err
		}
		items = append(items, item)
	}
	return items, rows.Err()
}

func (s *Store) AddWishlistItem(ctx context.Context, memberID, movieID int64, note *string) (WishlistItem, error) {
	var item WishlistItem
	err := s.Pool.QueryRow(ctx,
		`WITH saved AS (
             INSERT INTO wishlist_items (member_id, movie_id, note)
             VALUES ($1, $2, $3)
             ON CONFLICT (member_id, movie_id)
             DO UPDATE SET note = EXCLUDED.note
             RETURNING member_id, movie_id, note, created_at
         )
         SELECT m.id, m.title, m.title_th,
                (SELECT coalesce(g.name_th, g.name_en) FROM movie_genres mg
                   JOIN genres g ON g.id = mg.genre_id
                  WHERE mg.movie_id = m.id AND mg.position = 0),
                extract(year FROM m.release_date)::int,
                round(m.vote_average, 1)::float8,
                `+posterSQL+`,
                saved.note, saved.created_at
         FROM saved
         JOIN movies m ON m.id = saved.movie_id`, memberID, movieID, note).
		Scan(&item.Movie.ID, &item.Movie.Title, &item.Movie.TitleTh,
			&item.Movie.Genre, &item.Movie.Year, &item.Movie.Rating, &item.Movie.Poster,
			&item.Note, &item.CreatedAt)
	if err == nil {
		return item, nil
	}
	var pgErr *pgconn.PgError
	if errors.As(err, &pgErr) && pgErr.Code == "23503" {
		return WishlistItem{}, ErrNotFound
	}
	return WishlistItem{}, err
}

func (s *Store) RemoveWishlistItem(ctx context.Context, memberID, movieID int64) error {
	tag, err := s.Pool.Exec(ctx,
		`DELETE FROM wishlist_items WHERE member_id = $1 AND movie_id = $2`,
		memberID, movieID)
	if err != nil {
		return err
	}
	if tag.RowsAffected() > 0 {
		return nil
	}
	var movieExists bool
	if err := s.Pool.QueryRow(ctx,
		`SELECT EXISTS (SELECT 1 FROM movies WHERE id = $1)`, movieID).Scan(&movieExists); err != nil {
		return err
	}
	if !movieExists {
		return ErrNotFound
	}
	return nil
}

type Vote struct {
	MovieID int64 `json:"movieId"`
	Score   int16 `json:"score"`
}

func (s *Store) SetVote(ctx context.Context, memberID, movieID int64, score int16) (Vote, error) {
	var vote Vote
	err := s.Pool.QueryRow(ctx,
		`INSERT INTO votes (member_id, movie_id, score)
         VALUES ($1, $2, $3)
         ON CONFLICT (member_id, movie_id)
         DO UPDATE SET score = EXCLUDED.score
         RETURNING movie_id, score`, memberID, movieID, score).
		Scan(&vote.MovieID, &vote.Score)
	if err == nil {
		return vote, nil
	}
	var pgErr *pgconn.PgError
	if errors.As(err, &pgErr) && pgErr.Code == "23503" {
		return Vote{}, ErrNotFound
	}
	return Vote{}, err
}

func (s *Store) RemoveVote(ctx context.Context, memberID, movieID int64) error {
	tag, err := s.Pool.Exec(ctx,
		`DELETE FROM votes WHERE member_id = $1 AND movie_id = $2`,
		memberID, movieID)
	if err != nil {
		return err
	}
	if tag.RowsAffected() > 0 {
		return nil
	}
	var movieExists bool
	if err := s.Pool.QueryRow(ctx,
		`SELECT EXISTS (SELECT 1 FROM movies WHERE id = $1)`, movieID).Scan(&movieExists); err != nil {
		return err
	}
	if !movieExists {
		return ErrNotFound
	}
	return nil
}
