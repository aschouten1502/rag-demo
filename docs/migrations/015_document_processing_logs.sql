-- ============================================
-- MIGRATION 015: Document Processing Logs
-- ============================================
--
-- Creates a dedicated table for tracking document upload
-- and processing operations in the RAG system.
--
-- Tracks:
-- - Chunking method (smart/legacy)
-- - Structure detection results
-- - Processing costs (chunking, embedding, metadata)
-- - Processing duration and status
-- - Error tracking
--
-- ============================================

-- Create document processing logs table
CREATE TABLE IF NOT EXISTS document_processing_logs (
  -- Primary Key
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Multi-tenant identifier
  tenant_id TEXT NOT NULL,

  -- Reference to documents table (if exists)
  document_id UUID,

  -- Document info
  filename TEXT NOT NULL,
  file_size_bytes INTEGER,
  mime_type TEXT DEFAULT 'application/pdf',

  -- Processing status
  processing_status TEXT NOT NULL DEFAULT 'pending',
  -- Values: 'pending', 'uploading', 'parsing', 'chunking', 'embedding', 'metadata', 'completed', 'failed'

  -- Chunking details
  chunking_method TEXT,
  -- Values: 'smart', 'legacy', 'semantic', 'fixed'
  chunking_options JSONB DEFAULT '{}',
  -- Structure: { "structureDetection": true, "semanticChunking": false, "contextHeaders": true, ... }

  -- Results
  total_pages INTEGER,
  chunks_created INTEGER,
  structures_detected INTEGER,
  avg_chunk_size INTEGER,
  min_chunk_size INTEGER,
  max_chunk_size INTEGER,

  -- Metadata generation (if smart chunking)
  metadata_generated BOOLEAN DEFAULT false,
  keywords_count INTEGER,
  topics_count INTEGER,

  -- Costs breakdown (in USD)
  parsing_cost DECIMAL(10, 6) DEFAULT 0,
  chunking_cost DECIMAL(10, 6) DEFAULT 0,
  embedding_cost DECIMAL(10, 6) DEFAULT 0,
  embedding_tokens INTEGER DEFAULT 0,
  metadata_cost DECIMAL(10, 6) DEFAULT 0,
  metadata_tokens INTEGER DEFAULT 0,
  total_cost DECIMAL(10, 6) DEFAULT 0,

  -- Timing (in milliseconds)
  upload_duration_ms INTEGER,
  parsing_duration_ms INTEGER,
  chunking_duration_ms INTEGER,
  embedding_duration_ms INTEGER,
  metadata_duration_ms INTEGER,
  total_duration_ms INTEGER,

  -- Error tracking
  error_message TEXT,
  error_phase TEXT,
  -- Values: 'upload', 'parsing', 'chunking', 'embedding', 'metadata'
  error_details JSONB,

  -- Timestamps
  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- INDEXES
-- ============================================

-- Index for tenant-based queries
CREATE INDEX IF NOT EXISTS idx_doc_processing_tenant
ON document_processing_logs(tenant_id, created_at DESC);

-- Index for status monitoring
CREATE INDEX IF NOT EXISTS idx_doc_processing_status
ON document_processing_logs(processing_status, created_at DESC);

-- Index for document lookups
CREATE INDEX IF NOT EXISTS idx_doc_processing_document_id
ON document_processing_logs(document_id)
WHERE document_id IS NOT NULL;

-- Index for failed processing (for retry/monitoring)
CREATE INDEX IF NOT EXISTS idx_doc_processing_failed
ON document_processing_logs(tenant_id, started_at DESC)
WHERE processing_status = 'failed';

-- Index for cost analytics
CREATE INDEX IF NOT EXISTS idx_doc_processing_cost
ON document_processing_logs(tenant_id, total_cost DESC)
WHERE total_cost > 0;

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================

-- Enable RLS
ALTER TABLE document_processing_logs ENABLE ROW LEVEL SECURITY;

-- Policy for service role (full access)
CREATE POLICY "Service role full access to document_processing_logs"
ON document_processing_logs
FOR ALL USING (true) WITH CHECK (true);

-- ============================================
-- ANALYTICS VIEWS
-- ============================================

-- View: Document processing summary per tenant
CREATE OR REPLACE VIEW document_processing_summary AS
SELECT
  tenant_id,
  DATE(created_at) as date,
  COUNT(*) as total_documents,
  COUNT(*) FILTER (WHERE processing_status = 'completed') as completed,
  COUNT(*) FILTER (WHERE processing_status = 'failed') as failed,
  COUNT(*) FILTER (WHERE processing_status NOT IN ('completed', 'failed')) as in_progress,
  SUM(total_pages) as total_pages,
  SUM(chunks_created) as total_chunks,
  ROUND(AVG(chunks_created)::numeric, 0) as avg_chunks_per_doc,
  ROUND(SUM(total_cost)::numeric, 4) as total_cost,
  ROUND(AVG(total_duration_ms)::numeric, 0) as avg_duration_ms,
  -- Chunking method breakdown
  COUNT(*) FILTER (WHERE chunking_method = 'smart') as smart_chunking_count,
  COUNT(*) FILTER (WHERE chunking_method = 'legacy') as legacy_chunking_count,
  COUNT(*) FILTER (WHERE chunking_method = 'semantic') as semantic_chunking_count
FROM document_processing_logs
GROUP BY tenant_id, DATE(created_at)
ORDER BY date DESC, total_documents DESC;

-- View: Chunking method effectiveness
CREATE OR REPLACE VIEW chunking_method_analytics AS
SELECT
  tenant_id,
  chunking_method,
  COUNT(*) as document_count,
  ROUND(AVG(chunks_created)::numeric, 1) as avg_chunks,
  ROUND(AVG(avg_chunk_size)::numeric, 0) as avg_chunk_size,
  ROUND(AVG(structures_detected)::numeric, 1) as avg_structures,
  ROUND(AVG(total_duration_ms)::numeric, 0) as avg_duration_ms,
  ROUND(AVG(total_cost)::numeric, 6) as avg_cost,
  -- Success rate
  ROUND(
    COUNT(*) FILTER (WHERE processing_status = 'completed')::numeric /
    NULLIF(COUNT(*)::numeric, 0) * 100,
    1
  ) as success_rate_pct
FROM document_processing_logs
WHERE chunking_method IS NOT NULL
GROUP BY tenant_id, chunking_method
ORDER BY document_count DESC;

-- View: Cost breakdown per tenant
CREATE OR REPLACE VIEW document_processing_costs AS
SELECT
  tenant_id,
  DATE(created_at) as date,
  COUNT(*) as documents_processed,
  ROUND(SUM(parsing_cost)::numeric, 6) as total_parsing_cost,
  ROUND(SUM(chunking_cost)::numeric, 6) as total_chunking_cost,
  ROUND(SUM(embedding_cost)::numeric, 6) as total_embedding_cost,
  SUM(embedding_tokens) as total_embedding_tokens,
  ROUND(SUM(metadata_cost)::numeric, 6) as total_metadata_cost,
  SUM(metadata_tokens) as total_metadata_tokens,
  ROUND(SUM(total_cost)::numeric, 4) as total_cost,
  ROUND(AVG(total_cost)::numeric, 6) as avg_cost_per_doc
FROM document_processing_logs
WHERE processing_status = 'completed'
GROUP BY tenant_id, DATE(created_at)
ORDER BY date DESC;

-- ============================================
-- UTILITY FUNCTIONS
-- ============================================

-- Function: Get processing statistics for a tenant
CREATE OR REPLACE FUNCTION get_document_processing_stats(
  p_tenant_id TEXT,
  p_days INTEGER DEFAULT 30
)
RETURNS TABLE (
  total_documents BIGINT,
  completed_documents BIGINT,
  failed_documents BIGINT,
  total_pages BIGINT,
  total_chunks BIGINT,
  total_cost NUMERIC,
  avg_processing_time_ms NUMERIC,
  success_rate NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    COUNT(*)::BIGINT as total_documents,
    COUNT(*) FILTER (WHERE processing_status = 'completed')::BIGINT as completed_documents,
    COUNT(*) FILTER (WHERE processing_status = 'failed')::BIGINT as failed_documents,
    COALESCE(SUM(dpl.total_pages), 0)::BIGINT as total_pages,
    COALESCE(SUM(chunks_created), 0)::BIGINT as total_chunks,
    ROUND(COALESCE(SUM(dpl.total_cost), 0)::numeric, 4) as total_cost,
    ROUND(AVG(total_duration_ms)::numeric, 0) as avg_processing_time_ms,
    ROUND(
      COUNT(*) FILTER (WHERE processing_status = 'completed')::numeric /
      NULLIF(COUNT(*)::numeric, 0) * 100,
      1
    ) as success_rate
  FROM document_processing_logs dpl
  WHERE dpl.tenant_id = p_tenant_id
    AND created_at >= NOW() - (p_days || ' days')::INTERVAL;
END;
$$ LANGUAGE plpgsql;

-- Function: Log document processing start
CREATE OR REPLACE FUNCTION start_document_processing(
  p_tenant_id TEXT,
  p_filename TEXT,
  p_file_size_bytes INTEGER DEFAULT NULL,
  p_document_id UUID DEFAULT NULL,
  p_chunking_method TEXT DEFAULT 'smart',
  p_chunking_options JSONB DEFAULT '{}'
)
RETURNS UUID AS $$
DECLARE
  log_id UUID;
BEGIN
  INSERT INTO document_processing_logs (
    tenant_id, document_id, filename, file_size_bytes,
    processing_status, chunking_method, chunking_options, started_at
  ) VALUES (
    p_tenant_id, p_document_id, p_filename, p_file_size_bytes,
    'uploading', p_chunking_method, p_chunking_options, NOW()
  ) RETURNING id INTO log_id;

  RETURN log_id;
END;
$$ LANGUAGE plpgsql;

-- Function: Update document processing progress
CREATE OR REPLACE FUNCTION update_document_processing(
  p_log_id UUID,
  p_status TEXT,
  p_phase_duration_ms INTEGER DEFAULT NULL,
  p_error_message TEXT DEFAULT NULL
)
RETURNS VOID AS $$
BEGIN
  UPDATE document_processing_logs
  SET
    processing_status = p_status,
    -- Update phase-specific duration based on status
    parsing_duration_ms = CASE WHEN p_status = 'chunking' THEN p_phase_duration_ms ELSE parsing_duration_ms END,
    chunking_duration_ms = CASE WHEN p_status = 'embedding' THEN p_phase_duration_ms ELSE chunking_duration_ms END,
    embedding_duration_ms = CASE WHEN p_status = 'metadata' OR (p_status = 'completed' AND metadata_generated = false) THEN p_phase_duration_ms ELSE embedding_duration_ms END,
    metadata_duration_ms = CASE WHEN p_status = 'completed' AND metadata_generated = true THEN p_phase_duration_ms ELSE metadata_duration_ms END,
    -- Error handling
    error_message = COALESCE(p_error_message, error_message),
    error_phase = CASE WHEN p_status = 'failed' THEN
      CASE
        WHEN parsing_duration_ms IS NULL THEN 'parsing'
        WHEN chunking_duration_ms IS NULL THEN 'chunking'
        WHEN embedding_duration_ms IS NULL THEN 'embedding'
        ELSE 'metadata'
      END
    ELSE error_phase END,
    -- Completion
    completed_at = CASE WHEN p_status IN ('completed', 'failed') THEN NOW() ELSE completed_at END,
    total_duration_ms = CASE WHEN p_status IN ('completed', 'failed') THEN
      EXTRACT(EPOCH FROM (NOW() - started_at)) * 1000
    ELSE total_duration_ms END
  WHERE id = p_log_id;
END;
$$ LANGUAGE plpgsql;

-- Function: Complete document processing with all details
CREATE OR REPLACE FUNCTION complete_document_processing(
  p_log_id UUID,
  p_total_pages INTEGER,
  p_chunks_created INTEGER,
  p_structures_detected INTEGER DEFAULT 0,
  p_avg_chunk_size INTEGER DEFAULT NULL,
  p_embedding_tokens INTEGER DEFAULT 0,
  p_embedding_cost DECIMAL DEFAULT 0,
  p_metadata_tokens INTEGER DEFAULT 0,
  p_metadata_cost DECIMAL DEFAULT 0,
  p_metadata_generated BOOLEAN DEFAULT false
)
RETURNS VOID AS $$
BEGIN
  UPDATE document_processing_logs
  SET
    processing_status = 'completed',
    total_pages = p_total_pages,
    chunks_created = p_chunks_created,
    structures_detected = p_structures_detected,
    avg_chunk_size = p_avg_chunk_size,
    embedding_tokens = p_embedding_tokens,
    embedding_cost = p_embedding_cost,
    metadata_tokens = p_metadata_tokens,
    metadata_cost = p_metadata_cost,
    metadata_generated = p_metadata_generated,
    total_cost = COALESCE(parsing_cost, 0) + COALESCE(chunking_cost, 0) + p_embedding_cost + p_metadata_cost,
    completed_at = NOW(),
    total_duration_ms = EXTRACT(EPOCH FROM (NOW() - started_at)) * 1000
  WHERE id = p_log_id;
END;
$$ LANGUAGE plpgsql;

-- Grant permissions
GRANT ALL ON document_processing_logs TO service_role;
GRANT EXECUTE ON FUNCTION get_document_processing_stats TO service_role;
GRANT EXECUTE ON FUNCTION start_document_processing TO service_role;
GRANT EXECUTE ON FUNCTION update_document_processing TO service_role;
GRANT EXECUTE ON FUNCTION complete_document_processing TO service_role;

-- ============================================
-- VERIFICATION
-- ============================================

-- Verify table was created
SELECT table_name, table_type
FROM information_schema.tables
WHERE table_name = 'document_processing_logs';

-- Check columns
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'document_processing_logs'
ORDER BY ordinal_position;

-- Check indexes
SELECT indexname FROM pg_indexes
WHERE tablename = 'document_processing_logs';
