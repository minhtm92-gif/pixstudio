-- PixStudio Postgres dev seed
-- Per docker-compose.dev.yml — auto-runs once on volume creation
-- Phase 0-1 minimum schema; expand Sprint 1+ via Prisma migrations

-- Enable pgvector for RAG Phase 2+
CREATE EXTENSION IF NOT EXISTS vector;

-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Smoke test row (em verify schema initialized)
CREATE TABLE IF NOT EXISTS pxs_smoke (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  msg TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO pxs_smoke (msg) VALUES ('PixStudio dev DB initialized')
  ON CONFLICT DO NOTHING;

-- Sprint 1 schema sẽ ship via Prisma migrations:
-- - workspaces (name, region pinned VN/SG/EU/US, billing_tier)
-- - users (email, hashed_pw, roles)
-- - workspace_members (user_id, workspace_id, role: owner/editor/viewer)
-- - projects (workspace_id, name, yjs_doc_id reserved cho Phase 3)
-- See docs/cto/CTO-TECH-STACK-v04.md §3 cho 18 model schema
