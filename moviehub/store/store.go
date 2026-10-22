package store

import (
	"errors"

	"github.com/jackc/pgx/v5/pgxpool"
)

var (
	ErrNotFound        = errors.New("not found")
	ErrForbidden       = errors.New("forbidden")
	ErrDuplicateReview = errors.New("review already exists")
)

type Store struct {
	Pool *pgxpool.Pool
}
