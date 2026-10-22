package handler

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"moviehub/auth"
	"moviehub/mw"
)

func protectedReviewMux(t *testing.T) http.Handler {
	t.Helper()
	issuer := &auth.Issuer{Secret: []byte("test-secret-that-is-long-enough-for-jwt"), TTL: time.Hour}
	token, err := issuer.Issue(7, "member")
	if err != nil {
		t.Fatal(err)
	}
	handler := &Handler{}
	mux := http.NewServeMux()
	mux.HandleFunc("POST /api/movies/{id}/reviews", mw.RequireLogin(issuer, handler.CreateReview))
	mux.HandleFunc("PUT /api/movies/{id}/vote", mw.RequireLogin(issuer, handler.SetVote))
	mux.HandleFunc("PUT /api/me/wishlist/{movieId}", mw.RequireLogin(issuer, handler.AddWishlistItem))
	return authenticatedMux{Handler: mux, token: token}
}

type authenticatedMux struct {
	http.Handler
	token string
}

func (m authenticatedMux) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	r.Header.Set("Authorization", "Bearer "+m.token)
	m.Handler.ServeHTTP(w, r)
}

func TestProtectedReviewRoutesRejectAnonymousRequests(t *testing.T) {
	issuer := &auth.Issuer{Secret: []byte("test-secret-that-is-long-enough-for-jwt"), TTL: time.Hour}
	handler := &Handler{}
	mux := http.NewServeMux()
	mux.HandleFunc("POST /api/movies/{id}/reviews", mw.RequireLogin(issuer, handler.CreateReview))

	response := httptest.NewRecorder()
	mux.ServeHTTP(response, httptest.NewRequest(http.MethodPost, "/api/movies/42/reviews", strings.NewReader(`{"text":"review"}`)))

	if response.Code != http.StatusUnauthorized {
		t.Fatalf("status = %d, want %d", response.Code, http.StatusUnauthorized)
	}
}

func TestCreateReviewRejectsEmptyTextBeforeDatabaseAccess(t *testing.T) {
	mux := protectedReviewMux(t)
	response := httptest.NewRecorder()
	mux.ServeHTTP(response, httptest.NewRequest(http.MethodPost, "/api/movies/42/reviews", strings.NewReader(`{"text":"   "}`)))

	assertErrorCode(t, response, http.StatusBadRequest, "BAD_REVIEW")
}

func TestSetVoteRejectsOutOfRangeScoreBeforeDatabaseAccess(t *testing.T) {
	mux := protectedReviewMux(t)
	response := httptest.NewRecorder()
	mux.ServeHTTP(response, httptest.NewRequest(http.MethodPut, "/api/movies/42/vote", strings.NewReader(`{"score":11}`)))

	assertErrorCode(t, response, http.StatusBadRequest, "BAD_SCORE")
}

func TestAddWishlistRejectsLongNoteBeforeDatabaseAccess(t *testing.T) {
	mux := protectedReviewMux(t)
	body, err := json.Marshal(map[string]string{"note": strings.Repeat("a", 501)})
	if err != nil {
		t.Fatal(err)
	}
	response := httptest.NewRecorder()
	mux.ServeHTTP(response, httptest.NewRequest(http.MethodPut, "/api/me/wishlist/42", strings.NewReader(string(body))))

	assertErrorCode(t, response, http.StatusBadRequest, "BAD_NOTE")
}

func assertErrorCode(t *testing.T, response *httptest.ResponseRecorder, wantStatus int, wantCode string) {
	t.Helper()
	if response.Code != wantStatus {
		t.Fatalf("status = %d, want %d; body: %s", response.Code, wantStatus, response.Body.String())
	}
	var body struct {
		Error struct {
			Code string `json:"code"`
		} `json:"error"`
	}
	if err := json.Unmarshal(response.Body.Bytes(), &body); err != nil {
		t.Fatalf("decode error response: %v", err)
	}
	if body.Error.Code != wantCode {
		t.Fatalf("error code = %q, want %q", body.Error.Code, wantCode)
	}
}
