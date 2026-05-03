-- Sprint 36: Add pgvector embedding column to rag_documents.
-- Gemini text-embedding-004 produces 768-dim vectors.
-- pgvector extension enabled at DB-level (datasource db.extensions = [pgvector]).

ALTER TABLE "rag_documents" ADD COLUMN IF NOT EXISTS "embedding" vector(768);

-- Ivfflat index for fast cosine similarity search.
-- lists=10 for small dataset (<10k rows). Increase to 100 when dataset grows.
-- Cosine ops: vector_cosine_ops. Distance operator <=> in queries.
CREATE INDEX IF NOT EXISTS "rag_documents_embedding_idx"
  ON "rag_documents"
  USING ivfflat ("embedding" vector_cosine_ops)
  WITH (lists = 10);
