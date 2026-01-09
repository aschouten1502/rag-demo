/**
 * ========================================
 * DOCUMENT PROCESSING LOGGER
 * ========================================
 *
 * Logs document processing events to the database
 * for tracking upload/chunking/embedding operations.
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';

// ========================================
// TYPES
// ========================================

export interface ProcessingLogInput {
  tenantId: string;
  filename: string;
  documentId?: string;
  fileSizeBytes?: number;
  mimeType?: string;
  chunkingMethod?: 'smart' | 'legacy' | 'semantic' | 'fixed';
  chunkingOptions?: {
    structureDetection?: boolean;
    semanticChunking?: boolean;
    contextHeaders?: boolean;
    smartBoundaries?: boolean;
    targetChunkSize?: number;
  };
}

export interface ProcessingUpdateInput {
  status?: string;
  phaseDurationMs?: number;
  errorMessage?: string;
  totalPages?: number;
  chunksCreated?: number;
  structuresDetected?: number;
  avgChunkSize?: number;
  embeddingTokens?: number;
  embeddingCost?: number;
  metadataTokens?: number;
  metadataCost?: number;
  metadataGenerated?: boolean;
}

// ========================================
// SUPABASE CLIENT
// ========================================

let supabaseClient: SupabaseClient | null = null;

function getSupabaseClient(): SupabaseClient | null {
  if (!supabaseClient) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!url || !key) {
      console.warn('⚠️ [DocLogger] Supabase not configured');
      return null;
    }

    supabaseClient = createClient(url, key);
  }
  return supabaseClient;
}

// ========================================
// LOGGING FUNCTIONS
// ========================================

/**
 * Start logging a document processing operation
 * Returns the log ID for subsequent updates
 */
export async function startDocumentProcessing(
  input: ProcessingLogInput
): Promise<string | null> {
  const supabase = getSupabaseClient();
  if (!supabase) {
    console.warn('⚠️ [DocLogger] Skipping log - Supabase not configured');
    return null;
  }

  try {
    const { data, error } = await supabase
      .from('document_processing_logs')
      .insert({
        tenant_id: input.tenantId,
        document_id: input.documentId || null,
        filename: input.filename,
        file_size_bytes: input.fileSizeBytes || null,
        mime_type: input.mimeType || 'application/pdf',
        processing_status: 'uploading',
        chunking_method: input.chunkingMethod || 'smart',
        chunking_options: input.chunkingOptions || {},
        started_at: new Date().toISOString()
      })
      .select('id')
      .single();

    if (error) {
      console.error('❌ [DocLogger] Failed to start log:', error);
      return null;
    }

    console.log('✅ [DocLogger] Started processing log:', data.id);
    return data.id;
  } catch (err) {
    console.error('❌ [DocLogger] Unexpected error:', err);
    return null;
  }
}

/**
 * Update processing status
 */
export async function updateProcessingStatus(
  logId: string,
  status: 'parsing' | 'chunking' | 'embedding' | 'metadata' | 'completed' | 'failed',
  update?: ProcessingUpdateInput
): Promise<boolean> {
  const supabase = getSupabaseClient();
  if (!supabase || !logId) {
    return false;
  }

  try {
    const updateData: any = {
      processing_status: status
    };

    // Add optional updates
    if (update?.totalPages !== undefined) {
      updateData.total_pages = update.totalPages;
    }
    if (update?.chunksCreated !== undefined) {
      updateData.chunks_created = update.chunksCreated;
    }
    if (update?.structuresDetected !== undefined) {
      updateData.structures_detected = update.structuresDetected;
    }
    if (update?.avgChunkSize !== undefined) {
      updateData.avg_chunk_size = update.avgChunkSize;
    }
    if (update?.embeddingTokens !== undefined) {
      updateData.embedding_tokens = update.embeddingTokens;
    }
    if (update?.embeddingCost !== undefined) {
      updateData.embedding_cost = update.embeddingCost;
    }
    if (update?.metadataTokens !== undefined) {
      updateData.metadata_tokens = update.metadataTokens;
    }
    if (update?.metadataCost !== undefined) {
      updateData.metadata_cost = update.metadataCost;
    }
    if (update?.metadataGenerated !== undefined) {
      updateData.metadata_generated = update.metadataGenerated;
    }
    if (update?.errorMessage) {
      updateData.error_message = update.errorMessage;
    }

    // Set completion time if status is completed or failed
    if (status === 'completed' || status === 'failed') {
      updateData.completed_at = new Date().toISOString();
    }

    const { error } = await supabase
      .from('document_processing_logs')
      .update(updateData)
      .eq('id', logId);

    if (error) {
      console.error('❌ [DocLogger] Failed to update log:', error);
      return false;
    }

    console.log(`✅ [DocLogger] Updated status to ${status}:`, logId);
    return true;
  } catch (err) {
    console.error('❌ [DocLogger] Unexpected error:', err);
    return false;
  }
}

/**
 * Complete document processing with all final data
 */
export async function completeDocumentProcessing(
  logId: string,
  result: {
    totalPages: number;
    chunksCreated: number;
    structuresDetected?: number;
    avgChunkSize?: number;
    minChunkSize?: number;
    maxChunkSize?: number;
    embeddingTokens: number;
    embeddingCost: number;
    chunkingTokens?: number;
    chunkingCost?: number;
    metadataTokens?: number;
    metadataCost?: number;
    metadataGenerated?: boolean;
  }
): Promise<boolean> {
  const supabase = getSupabaseClient();
  if (!supabase || !logId) {
    return false;
  }

  try {
    // First, get the started_at to calculate duration
    const { data: existingLog } = await supabase
      .from('document_processing_logs')
      .select('started_at')
      .eq('id', logId)
      .single();

    const completedAt = new Date();
    let totalDurationMs: number | null = null;

    if (existingLog?.started_at) {
      const startedAt = new Date(existingLog.started_at);
      totalDurationMs = completedAt.getTime() - startedAt.getTime();
    }

    // Calculate total cost from all components (properly separated)
    const totalCost = (result.embeddingCost || 0) + (result.chunkingCost || 0) + (result.metadataCost || 0);

    const { error } = await supabase
      .from('document_processing_logs')
      .update({
        processing_status: 'completed',
        total_pages: result.totalPages,
        chunks_created: result.chunksCreated,
        structures_detected: result.structuresDetected || 0,
        avg_chunk_size: result.avgChunkSize || null,
        min_chunk_size: result.minChunkSize || null,
        max_chunk_size: result.maxChunkSize || null,
        embedding_tokens: result.embeddingTokens,
        embedding_cost: result.embeddingCost,
        chunking_cost: result.chunkingCost || 0,
        metadata_tokens: result.metadataTokens || 0,
        metadata_cost: result.metadataCost || 0,
        metadata_generated: result.metadataGenerated || false,
        total_cost: totalCost,
        total_duration_ms: totalDurationMs,
        completed_at: completedAt.toISOString()
      })
      .eq('id', logId);

    if (error) {
      console.error('❌ [DocLogger] Failed to complete log:', error);
      return false;
    }

    console.log('✅ [DocLogger] Completed processing log:', logId, totalDurationMs ? `(${(totalDurationMs / 1000).toFixed(1)}s)` : '');
    return true;
  } catch (err) {
    console.error('❌ [DocLogger] Unexpected error:', err);
    return false;
  }
}

/**
 * Mark document processing as failed
 */
export async function failDocumentProcessing(
  logId: string,
  errorMessage: string,
  errorPhase?: string
): Promise<boolean> {
  const supabase = getSupabaseClient();
  if (!supabase || !logId) {
    return false;
  }

  try {
    // First, get the started_at to calculate duration
    const { data: existingLog } = await supabase
      .from('document_processing_logs')
      .select('started_at')
      .eq('id', logId)
      .single();

    const completedAt = new Date();
    let totalDurationMs: number | null = null;

    if (existingLog?.started_at) {
      const startedAt = new Date(existingLog.started_at);
      totalDurationMs = completedAt.getTime() - startedAt.getTime();
    }

    const { error } = await supabase
      .from('document_processing_logs')
      .update({
        processing_status: 'failed',
        error_message: errorMessage,
        error_phase: errorPhase || null,
        total_duration_ms: totalDurationMs,
        completed_at: completedAt.toISOString()
      })
      .eq('id', logId);

    if (error) {
      console.error('❌ [DocLogger] Failed to mark as failed:', error);
      return false;
    }

    console.log('❌ [DocLogger] Marked processing as failed:', logId, errorMessage);
    return true;
  } catch (err) {
    console.error('❌ [DocLogger] Unexpected error:', err);
    return false;
  }
}
