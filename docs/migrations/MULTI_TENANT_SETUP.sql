-- ============================================
-- MULTI-TENANT DATABASE SETUP
-- ============================================
--
-- This migration creates the generic chat_logs table for multi-tenant deployments.
--
-- DEPLOYMENT OPTIONS:
--
-- Option A: Shared Database with Tenant ID (RECOMMENDED for SaaS)
--   - Single Supabase project for all clients
--   - Each row has tenant_id column
--   - Use Row Level Security (RLS) for isolation
--   - Run this script ONCE
--   - Set environment: SUPABASE_TABLE_NAME=chat_logs
--
-- Option B: Separate Table per Tenant
--   - Single Supabase project
--   - Replace "chat_logs" with "{tenant-id}_chat_logs"
--   - Run this script for EACH tenant
--   - Set environment: SUPABASE_TABLE_NAME={tenant-id}_chat_logs
--
-- Option C: Separate Supabase Project per Tenant
--   - Different Supabase URL/keys per client
--   - Use generic "chat_logs" table name
--   - Run this script in EACH Supabase project
--   - Set different NEXT_PUBLIC_SUPABASE_URL per tenant
--
-- ============================================

-- Drop existing table if you're migrating from legacy
-- CAUTION: This will delete all existing data!
-- If you want to preserve data, use migration script below
-- DROP TABLE IF EXISTS chat_logs CASCADE;

-- Create main chat logs table
CREATE TABLE IF NOT EXISTS chat_logs (
  -- Primary Key
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Multi-tenant identifier (OPTIONAL - only for shared database)
  -- Set to NULL for single-tenant deployments
  tenant_id VARCHAR(100),

  -- Session tracking
  session_id VARCHAR(255),

  -- Timestamps
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Request data
  question TEXT NOT NULL,
  answer TEXT NOT NULL,
  language VARCHAR(10) DEFAULT 'nl',

  -- Performance metrics
  response_time_seconds DECIMAL(10, 3),
  response_time_ms INTEGER,

  -- Cost tracking - Pinecone
  pinecone_tokens INTEGER DEFAULT 0,
  pinecone_cost DECIMAL(10, 6) DEFAULT 0,

  -- Cost tracking - OpenAI
  openai_input_tokens INTEGER DEFAULT 0,
  openai_output_tokens INTEGER DEFAULT 0,
  openai_total_tokens INTEGER DEFAULT 0,
  openai_cost DECIMAL(10, 6) DEFAULT 0,

  -- Total cost
  total_cost DECIMAL(10, 6) DEFAULT 0,

  -- Context and citations
  snippets_used INTEGER DEFAULT 0,
  citations_count INTEGER DEFAULT 0,
  citations JSONB,

  -- Conversation context
  conversation_history_length INTEGER DEFAULT 0,

  -- Monitoring and completion tracking
  is_complete BOOLEAN DEFAULT true,
  completion_error TEXT,
  update_attempts INTEGER DEFAULT 0,

  -- Event classification
  blocked BOOLEAN DEFAULT false,
  event_type VARCHAR(50) DEFAULT 'chat_request',
  error_details TEXT,

  -- Feedback (schema ready, UI not yet implemented)
  feedback VARCHAR(20),
  feedback_comment TEXT,
  feedback_timestamp TIMESTAMPTZ
);

-- ============================================
-- INDEXES FOR PERFORMANCE
-- ============================================

-- Index for tenant-based queries (if using multi-tenant mode)
CREATE INDEX IF NOT EXISTS idx_tenant_timestamp
  ON chat_logs(tenant_id, timestamp DESC);

-- Index for session tracking
CREATE INDEX IF NOT EXISTS idx_session_timestamp
  ON chat_logs(session_id, timestamp DESC);

-- Index for date-based analytics
CREATE INDEX IF NOT EXISTS idx_timestamp
  ON chat_logs(timestamp DESC);

-- Index for monitoring incomplete requests
CREATE INDEX IF NOT EXISTS idx_incomplete
  ON chat_logs(is_complete, timestamp DESC)
  WHERE is_complete = false;

-- Index for cost analytics
CREATE INDEX IF NOT EXISTS idx_total_cost
  ON chat_logs(total_cost DESC)
  WHERE total_cost > 0;

-- Index for language-based queries
CREATE INDEX IF NOT EXISTS idx_language
  ON chat_logs(language, timestamp DESC);

-- Index for event type filtering
CREATE INDEX IF NOT EXISTS idx_event_type
  ON chat_logs(event_type, timestamp DESC);

-- ============================================
-- ROW LEVEL SECURITY (OPTIONAL - for shared database)
-- ============================================

-- Enable RLS if using shared database with multiple tenants
-- CAUTION: Only enable this if you're using tenant_id column
-- and want database-level isolation

-- Uncomment to enable RLS:
-- ALTER TABLE chat_logs ENABLE ROW LEVEL SECURITY;

-- Create policy for tenant isolation
-- This requires setting current_tenant in application context
-- Example in app: SET LOCAL app.current_tenant = 'acme-corp';

-- Uncomment to create tenant isolation policy:
-- CREATE POLICY tenant_isolation ON chat_logs
--   USING (tenant_id = current_setting('app.current_tenant', TRUE))
--   WITH CHECK (tenant_id = current_setting('app.current_tenant', TRUE));

-- ============================================
-- ANALYTICS VIEWS
-- ============================================

-- View: Daily request analytics
CREATE OR REPLACE VIEW request_analytics AS
SELECT
  DATE(timestamp) as date,
  tenant_id,
  language,
  COUNT(*) as total_requests,
  COUNT(*) FILTER (WHERE blocked = true) as blocked_requests,
  COUNT(*) FILTER (WHERE event_type = 'error') as error_requests,
  ROUND(AVG(response_time_seconds)::numeric, 3) as avg_response_time_seconds,
  ROUND(SUM(total_cost)::numeric, 4) as total_cost,
  ROUND(AVG(total_cost)::numeric, 6) as avg_cost_per_request,
  SUM(pinecone_tokens) as total_pinecone_tokens,
  ROUND(SUM(pinecone_cost)::numeric, 4) as total_pinecone_cost,
  SUM(openai_total_tokens) as total_openai_tokens,
  ROUND(SUM(openai_cost)::numeric, 4) as total_openai_cost
FROM chat_logs
WHERE is_complete = true
GROUP BY DATE(timestamp), tenant_id, language
ORDER BY date DESC, total_requests DESC;

-- View: Session quality metrics
CREATE OR REPLACE VIEW session_quality AS
SELECT
  session_id,
  tenant_id,
  COUNT(*) as total_messages,
  ROUND(AVG(response_time_seconds)::numeric, 3) as avg_response_time,
  ROUND(SUM(total_cost)::numeric, 4) as session_cost,
  MIN(timestamp) as session_start,
  MAX(timestamp) as session_end,
  MAX(timestamp) - MIN(timestamp) as session_duration,
  COUNT(*) FILTER (WHERE feedback = 'positive') as positive_feedback,
  COUNT(*) FILTER (WHERE feedback = 'negative') as negative_feedback,
  BOOL_OR(blocked) as had_blocked_requests
FROM chat_logs
WHERE session_id IS NOT NULL
GROUP BY session_id, tenant_id
ORDER BY session_start DESC;

-- View: Document citation analytics
CREATE OR REPLACE VIEW citation_analytics AS
SELECT
  tenant_id,
  DATE(timestamp) as date,
  jsonb_array_elements(citations)->>'file_name' as document_name,
  COUNT(*) as times_cited,
  ROUND(AVG(response_time_seconds)::numeric, 3) as avg_response_time
FROM chat_logs
WHERE citations IS NOT NULL
  AND jsonb_array_length(citations) > 0
  AND is_complete = true
GROUP BY tenant_id, DATE(timestamp), document_name
ORDER BY date DESC, times_cited DESC;

-- ============================================
-- UTILITY FUNCTIONS
-- ============================================

-- Function: Clean up old logs (optional, for GDPR compliance)
CREATE OR REPLACE FUNCTION cleanup_old_logs(days_to_keep INTEGER DEFAULT 90)
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM chat_logs
  WHERE timestamp < NOW() - (days_to_keep || ' days')::INTERVAL;

  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Function: Get tenant statistics
CREATE OR REPLACE FUNCTION get_tenant_stats(tenant_name VARCHAR DEFAULT NULL)
RETURNS TABLE (
  tenant_id VARCHAR,
  total_requests BIGINT,
  total_cost NUMERIC,
  avg_response_time NUMERIC,
  first_request TIMESTAMPTZ,
  last_request TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    cl.tenant_id,
    COUNT(*)::BIGINT as total_requests,
    ROUND(SUM(cl.total_cost)::numeric, 4) as total_cost,
    ROUND(AVG(cl.response_time_seconds)::numeric, 3) as avg_response_time,
    MIN(cl.timestamp) as first_request,
    MAX(cl.timestamp) as last_request
  FROM chat_logs cl
  WHERE cl.is_complete = true
    AND (tenant_name IS NULL OR cl.tenant_id = tenant_name)
  GROUP BY cl.tenant_id
  ORDER BY total_requests DESC;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- MIGRATION FROM LEGACY TABLE
-- ============================================

-- If you have existing data in geostick_logs_data_qabothr,
-- uncomment and run this to migrate:

/*
INSERT INTO chat_logs (
  id, session_id, timestamp, created_at, updated_at,
  question, answer, language, response_time_seconds, response_time_ms,
  pinecone_tokens, pinecone_cost,
  openai_input_tokens, openai_output_tokens, openai_total_tokens, openai_cost,
  total_cost, snippets_used, citations_count, citations,
  conversation_history_length, is_complete, completion_error, update_attempts,
  blocked, event_type, error_details,
  feedback, feedback_comment, feedback_timestamp,
  tenant_id  -- Set this to your tenant ID
)
SELECT
  id, session_id, timestamp, created_at, updated_at,
  question, answer, language, response_time_seconds, response_time_ms,
  pinecone_tokens, pinecone_cost,
  openai_input_tokens, openai_output_tokens, openai_total_tokens, openai_cost,
  total_cost, snippets_used, citations_count, citations,
  conversation_history_length, is_complete, completion_error, update_attempts,
  blocked, event_type, error_details,
  feedback, feedback_comment, feedback_timestamp,
  'geostick' as tenant_id  -- Replace 'geostick' with actual tenant ID
FROM geostick_logs_data_qabothr
WHERE NOT EXISTS (
  SELECT 1 FROM chat_logs WHERE chat_logs.id = geostick_logs_data_qabothr.id
);
*/

-- ============================================
-- VERIFICATION QUERIES
-- ============================================

-- Verify table was created
SELECT
  table_name,
  table_type
FROM information_schema.tables
WHERE table_name = 'chat_logs';

-- Check indexes
SELECT
  indexname,
  indexdef
FROM pg_indexes
WHERE tablename = 'chat_logs';

-- Check views
SELECT
  table_name
FROM information_schema.views
WHERE table_name IN ('request_analytics', 'session_quality', 'citation_analytics');

-- ============================================
-- EXAMPLE QUERIES
-- ============================================

-- Get all tenants and their request counts
-- SELECT * FROM get_tenant_stats();

-- Get stats for specific tenant
-- SELECT * FROM get_tenant_stats('acme-corp');

-- View daily analytics
-- SELECT * FROM request_analytics WHERE date >= CURRENT_DATE - INTERVAL '7 days';

-- View session quality
-- SELECT * FROM session_quality LIMIT 10;

-- View most cited documents
-- SELECT * FROM citation_analytics WHERE date >= CURRENT_DATE - INTERVAL '30 days';

-- Clean up logs older than 90 days (CAUTION: This deletes data!)
-- SELECT cleanup_old_logs(90);
