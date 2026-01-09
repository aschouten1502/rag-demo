-- ============================================
-- MIGRATION 014: Add RAG Details Column
-- ============================================
--
-- Adds `rag_details` JSONB column to chat_logs table
-- to capture comprehensive RAG pipeline data for debugging
-- and analytics.
--
-- This enables "holographic view" of all RAG operations:
-- - Query expansion and alternatives
-- - All search candidates (not just final results)
-- - Reranking position changes
-- - Token usage and costs per phase
-- - Timing breakdown
--
-- ============================================

-- Add rag_details JSONB column
ALTER TABLE chat_logs
ADD COLUMN IF NOT EXISTS rag_details JSONB;

-- Add comment explaining the structure
COMMENT ON COLUMN chat_logs.rag_details IS 'Complete RAG pipeline details for debugging. Structure:
{
  "query": {
    "original": "user query",
    "expanded": "expanded query with terms",
    "alternativeQueries": ["alt1", "alt2"],
    "expansionTerms": ["term1", "term2"]
  },
  "search": {
    "type": "enhanced_hybrid",
    "vectorTopK": 30,
    "finalTopK": 8,
    "rerankingEnabled": true,
    "queries": [{ "query": "...", "tokens": N, "cost": N, "resultsCount": N }],
    "rawResults": [{ "filename": "...", "similarity": N, "pageNumber": N, ... }],
    "matchedTerms": ["term1", "term2"],
    "mergeStats": { "totalBeforeMerge": N, "totalAfterMerge": N, "duplicatesRemoved": N }
  },
  "reranking": {
    "enabled": true,
    "model": "rerank-v3.5",
    "inputDocuments": 30,
    "outputDocuments": 8,
    "latencyMs": N,
    "cost": N,
    "results": [{ "filename": "...", "beforeScore": N, "afterScore": N, "positionBefore": N, "positionAfter": N }]
  },
  "openai": {
    "model": "gpt-4o",
    "temperature": N,
    "systemPromptTokens": N,
    "inputTokens": N,
    "outputTokens": N,
    "streamingDurationMs": N
  },
  "costs": { "embedding": N, "reranking": N, "openai": N, "total": N },
  "timing": { "embeddingMs": N, "searchMs": N, "rerankingMs": N, "openaiMs": N, "totalMs": N }
}';

-- Create GIN index for efficient JSONB queries
CREATE INDEX IF NOT EXISTS idx_chat_logs_rag_details_gin
ON chat_logs USING GIN (rag_details);

-- Create partial index for queries that have reranking data
CREATE INDEX IF NOT EXISTS idx_chat_logs_rag_reranking
ON chat_logs ((rag_details->'reranking'->'enabled'))
WHERE rag_details IS NOT NULL;

-- ============================================
-- ANALYTICS VIEWS FOR RAG DETAILS
-- ============================================

-- View: RAG performance metrics
CREATE OR REPLACE VIEW rag_performance_metrics AS
SELECT
  DATE(timestamp) as date,
  tenant_id,
  COUNT(*) as total_requests,
  -- Timing averages
  ROUND(AVG((rag_details->'timing'->>'embeddingMs')::numeric), 0) as avg_embedding_ms,
  ROUND(AVG((rag_details->'timing'->>'searchMs')::numeric), 0) as avg_search_ms,
  ROUND(AVG((rag_details->'timing'->>'rerankingMs')::numeric), 0) as avg_reranking_ms,
  ROUND(AVG((rag_details->'timing'->>'openaiMs')::numeric), 0) as avg_openai_ms,
  ROUND(AVG((rag_details->'timing'->>'totalMs')::numeric), 0) as avg_total_ms,
  -- Cost breakdown
  ROUND(SUM((rag_details->'costs'->>'embedding')::numeric), 6) as total_embedding_cost,
  ROUND(SUM((rag_details->'costs'->>'reranking')::numeric), 6) as total_reranking_cost,
  ROUND(SUM((rag_details->'costs'->>'openai')::numeric), 4) as total_openai_cost,
  -- Reranking stats
  COUNT(*) FILTER (WHERE (rag_details->'reranking'->>'enabled')::boolean = true) as reranked_requests,
  ROUND(AVG((rag_details->'reranking'->>'inputDocuments')::numeric), 0) as avg_rerank_input_docs,
  ROUND(AVG((rag_details->'reranking'->>'outputDocuments')::numeric), 0) as avg_rerank_output_docs
FROM chat_logs
WHERE rag_details IS NOT NULL
  AND is_complete = true
GROUP BY DATE(timestamp), tenant_id
ORDER BY date DESC;

-- View: Query expansion effectiveness
CREATE OR REPLACE VIEW query_expansion_analytics AS
SELECT
  DATE(timestamp) as date,
  tenant_id,
  COUNT(*) as total_queries,
  -- Expansion stats
  COUNT(*) FILTER (WHERE jsonb_array_length(COALESCE(rag_details->'query'->'expansionTerms', '[]'::jsonb)) > 0) as queries_with_expansion,
  ROUND(AVG(jsonb_array_length(COALESCE(rag_details->'query'->'expansionTerms', '[]'::jsonb))), 1) as avg_expansion_terms,
  ROUND(AVG(jsonb_array_length(COALESCE(rag_details->'query'->'alternativeQueries', '[]'::jsonb))), 1) as avg_alternative_queries,
  -- Keyword matches
  ROUND(AVG(jsonb_array_length(COALESCE(rag_details->'search'->'matchedTerms', '[]'::jsonb))), 1) as avg_matched_terms
FROM chat_logs
WHERE rag_details IS NOT NULL
  AND is_complete = true
GROUP BY DATE(timestamp), tenant_id
ORDER BY date DESC;

-- ============================================
-- UTILITY FUNCTIONS
-- ============================================

-- Function: Get reranking impact analysis
CREATE OR REPLACE FUNCTION get_reranking_impact(
  p_tenant_id VARCHAR DEFAULT NULL,
  p_start_date TIMESTAMPTZ DEFAULT (NOW() - INTERVAL '7 days'),
  p_end_date TIMESTAMPTZ DEFAULT NOW()
)
RETURNS TABLE (
  total_reranked BIGINT,
  avg_position_improvement NUMERIC,
  avg_score_improvement NUMERIC,
  avg_latency_ms NUMERIC,
  total_cost NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    COUNT(*)::BIGINT as total_reranked,
    ROUND(AVG(
      COALESCE((rag_details->'reranking'->'results'->0->>'positionBefore')::numeric, 0) -
      COALESCE((rag_details->'reranking'->'results'->0->>'positionAfter')::numeric, 0)
    ), 2) as avg_position_improvement,
    ROUND(AVG(
      COALESCE((rag_details->'reranking'->'results'->0->>'afterScore')::numeric, 0) -
      COALESCE((rag_details->'reranking'->'results'->0->>'beforeScore')::numeric, 0)
    ), 4) as avg_score_improvement,
    ROUND(AVG((rag_details->'reranking'->>'latencyMs')::numeric), 0) as avg_latency_ms,
    ROUND(SUM((rag_details->'reranking'->>'cost')::numeric), 4) as total_cost
  FROM chat_logs
  WHERE rag_details IS NOT NULL
    AND (rag_details->'reranking'->>'enabled')::boolean = true
    AND timestamp BETWEEN p_start_date AND p_end_date
    AND (p_tenant_id IS NULL OR tenant_id = p_tenant_id);
END;
$$ LANGUAGE plpgsql;

-- Function: Get search performance by query type
CREATE OR REPLACE FUNCTION get_search_performance(
  p_tenant_id VARCHAR DEFAULT NULL,
  p_days INTEGER DEFAULT 7
)
RETURNS TABLE (
  search_type TEXT,
  total_searches BIGINT,
  avg_results_count NUMERIC,
  avg_similarity_score NUMERIC,
  avg_search_ms NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    rag_details->'search'->>'type' as search_type,
    COUNT(*)::BIGINT as total_searches,
    ROUND(AVG((rag_details->'search'->>'vectorTopK')::numeric), 0) as avg_results_count,
    ROUND(AVG((rag_details->'search'->'rawResults'->0->>'similarity')::numeric), 4) as avg_similarity_score,
    ROUND(AVG((rag_details->'timing'->>'searchMs')::numeric), 0) as avg_search_ms
  FROM chat_logs
  WHERE rag_details IS NOT NULL
    AND timestamp >= NOW() - (p_days || ' days')::INTERVAL
    AND (p_tenant_id IS NULL OR tenant_id = p_tenant_id)
  GROUP BY rag_details->'search'->>'type'
  ORDER BY total_searches DESC;
END;
$$ LANGUAGE plpgsql;

-- Grant permissions
GRANT EXECUTE ON FUNCTION get_reranking_impact TO service_role;
GRANT EXECUTE ON FUNCTION get_search_performance TO service_role;

-- ============================================
-- VERIFICATION
-- ============================================

-- Verify column was added
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'chat_logs' AND column_name = 'rag_details';

-- Verify indexes were created
SELECT indexname FROM pg_indexes
WHERE tablename = 'chat_logs' AND indexname LIKE '%rag%';
