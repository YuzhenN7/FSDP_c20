-- SCRUM-5: keep server-side record of logged-out JWTs (hashes only, never plaintext tokens).
-- Apply only to the main-branch PostgreSQL schema on a disposable test database first.
CREATE TABLE IF NOT EXISTS revoked_tokens (
  token_hash TEXT PRIMARY KEY,
  expires_at TIMESTAMPTZ NOT NULL
);
