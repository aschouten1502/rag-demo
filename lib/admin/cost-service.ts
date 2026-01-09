/**
 * ========================================
 * TENANT COST SERVICE
 * ========================================
 *
 * Service voor het ophalen van kosten per tenant.
 * Combineert document processing en chat kosten.
 *
 * v2.2: Comprehensive cost tracking per tenant
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';

// ========================================
// TYPES
// ========================================

export interface TenantCostSummary {
  tenant_id: string;
  tenant_name: string;
  document_count: number;
  total_pages: number;
  total_chunks: number;
  chat_count: number;

  // Document costs breakdown
  doc_costs: {
    chunking: number;
    embedding: number;
    metadata: number;
    total: number;
  };

  // Chat costs breakdown
  chat_costs: {
    embedding: number;
    reranking: number;
    translation: number;
    openai: number;
    total: number;
  };

  // Totals
  total_cost: number;
  avg_cost_per_chat: number;
  avg_cost_per_document: number;

  // Activity
  last_activity: string | null;
  is_active: boolean;
  created_at: string;
}

export interface TenantCostDetails {
  tenant_id: string;
  tenant_name: string;

  documents: {
    count: number;
    total_pages: number;
    total_chunks: number;
    costs: {
      chunking: number;
      embedding: number;
      metadata: number;
      total: number;
    };
    documents: Array<{
      filename: string;
      pages: number;
      chunks: number;
      costs: {
        chunking: number;
        embedding: number;
        metadata: number;
        total: number;
      };
      processed_at: string;
      duration_seconds: number;
    }>;
  };

  chats: {
    count: number;
    costs: {
      embedding: number;
      reranking: number;
      translation: number;
      openai: number;
      total: number;
    };
    avg_response_time_ms: number;
    last_chat: string | null;
  };

  total_cost: number;
}

// ========================================
// SUPABASE CLIENT
// ========================================

let supabaseClient: SupabaseClient | null = null;

function getSupabaseClient(): SupabaseClient {
  if (!supabaseClient) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!url || !key) {
      throw new Error('Supabase configuration missing');
    }

    supabaseClient = createClient(url, key);
  }
  return supabaseClient;
}

// ========================================
// MAIN FUNCTIONS
// ========================================

/**
 * Haalt kosten overzicht op voor alle tenants
 * Gebruikt de tenant_costs_summary view
 */
export async function getAllTenantCosts(): Promise<TenantCostSummary[]> {
  const supabase = getSupabaseClient();

  // Probeer eerst de view te gebruiken
  const { data: viewData, error: viewError } = await supabase
    .from('tenant_costs_summary')
    .select('*')
    .order('total_cost', { ascending: false });

  if (!viewError && viewData) {
    return viewData.map(row => ({
      tenant_id: row.tenant_id,
      tenant_name: row.tenant_name,
      document_count: row.document_count || 0,
      total_pages: row.total_pages || 0,
      total_chunks: row.total_chunks || 0,
      chat_count: row.chat_count || 0,
      doc_costs: {
        chunking: row.doc_chunking_cost || 0,
        embedding: row.doc_embedding_cost || 0,
        metadata: row.doc_metadata_cost || 0,
        total: row.doc_total_cost || 0
      },
      chat_costs: {
        embedding: row.chat_embedding_cost || 0,
        reranking: row.chat_rerank_cost || 0,
        translation: row.chat_translation_cost || 0,
        openai: row.chat_openai_cost || 0,
        total: row.chat_total_cost || 0
      },
      total_cost: row.total_cost || 0,
      avg_cost_per_chat: row.avg_cost_per_chat || 0,
      avg_cost_per_document: row.avg_cost_per_document || 0,
      last_activity: row.last_activity,
      is_active: row.is_active,
      created_at: row.created_at
    }));
  }

  // Fallback: handmatige aggregatie als view niet bestaat
  console.warn('⚠️ [CostService] View not found, using fallback aggregation');
  return await getAllTenantCostsFallback();
}

/**
 * Fallback functie als de view nog niet gedeployed is
 */
async function getAllTenantCostsFallback(): Promise<TenantCostSummary[]> {
  const supabase = getSupabaseClient();

  // Haal alle tenants op
  const { data: tenants, error: tenantsError } = await supabase
    .from('tenants')
    .select('id, name, created_at, is_active')
    .order('created_at', { ascending: false });

  if (tenantsError || !tenants) {
    console.error('❌ [CostService] Failed to fetch tenants:', tenantsError);
    return [];
  }

  // Haal document processing logs op
  const { data: docLogs } = await supabase
    .from('document_processing_logs')
    .select('tenant_id, total_pages, chunks_created, chunking_cost, embedding_cost, metadata_cost, total_cost, completed_at')
    .eq('processing_status', 'completed');

  // Haal chat logs op
  const { data: chatLogs } = await supabase
    .from('chat_logs')
    .select('tenant_id, total_cost, pinecone_cost, openai_cost, rag_details, created_at')
    .not('tenant_id', 'is', null);

  // Aggregeer per tenant
  return tenants.map(tenant => {
    const tenantDocs = docLogs?.filter(d => d.tenant_id === tenant.id) || [];
    const tenantChats = chatLogs?.filter(c => c.tenant_id === tenant.id) || [];

    const docStats = {
      count: tenantDocs.length,
      pages: tenantDocs.reduce((sum, d) => sum + (d.total_pages || 0), 0),
      chunks: tenantDocs.reduce((sum, d) => sum + (d.chunks_created || 0), 0),
      chunking: tenantDocs.reduce((sum, d) => sum + (d.chunking_cost || 0), 0),
      embedding: tenantDocs.reduce((sum, d) => sum + (d.embedding_cost || 0), 0),
      metadata: tenantDocs.reduce((sum, d) => sum + (d.metadata_cost || 0), 0),
      total: tenantDocs.reduce((sum, d) => sum + (d.total_cost || 0), 0),
      lastAt: tenantDocs.length > 0 ? tenantDocs[0].completed_at : null
    };

    const chatStats = {
      count: tenantChats.length,
      embedding: tenantChats.reduce((sum, c) => sum + (c.pinecone_cost || 0), 0),
      reranking: tenantChats.reduce((sum, c) => {
        const rerankCost = c.rag_details?.costs?.reranking || 0;
        return sum + rerankCost;
      }, 0),
      translation: tenantChats.reduce((sum, c) => {
        const transCost = c.rag_details?.query?.translation?.translationCost || 0;
        return sum + transCost;
      }, 0),
      openai: tenantChats.reduce((sum, c) => sum + (c.openai_cost || 0), 0),
      total: tenantChats.reduce((sum, c) => sum + (c.total_cost || 0), 0),
      lastAt: tenantChats.length > 0 ? tenantChats[0].created_at : null
    };

    const totalCost = docStats.total + chatStats.total;

    return {
      tenant_id: tenant.id,
      tenant_name: tenant.name,
      document_count: docStats.count,
      total_pages: docStats.pages,
      total_chunks: docStats.chunks,
      chat_count: chatStats.count,
      doc_costs: {
        chunking: docStats.chunking,
        embedding: docStats.embedding,
        metadata: docStats.metadata,
        total: docStats.total
      },
      chat_costs: {
        embedding: chatStats.embedding,
        reranking: chatStats.reranking,
        translation: chatStats.translation,
        openai: chatStats.openai,
        total: chatStats.total
      },
      total_cost: totalCost,
      avg_cost_per_chat: chatStats.count > 0 ? chatStats.total / chatStats.count : 0,
      avg_cost_per_document: docStats.count > 0 ? docStats.total / docStats.count : 0,
      last_activity: docStats.lastAt && chatStats.lastAt
        ? (new Date(docStats.lastAt) > new Date(chatStats.lastAt) ? docStats.lastAt : chatStats.lastAt)
        : (docStats.lastAt || chatStats.lastAt),
      is_active: tenant.is_active,
      created_at: tenant.created_at
    };
  });
}

/**
 * Haalt gedetailleerde kosten op voor een specifieke tenant
 */
export async function getTenantCostDetails(tenantId: string): Promise<TenantCostDetails | null> {
  const supabase = getSupabaseClient();

  // Probeer de database functie te gebruiken
  const { data: funcData, error: funcError } = await supabase
    .rpc('get_tenant_cost_details', { p_tenant_id: tenantId });

  if (!funcError && funcData) {
    return funcData as TenantCostDetails;
  }

  // Fallback: handmatige query
  console.warn('⚠️ [CostService] Function not found, using fallback query');
  return await getTenantCostDetailsFallback(tenantId);
}

/**
 * Fallback voor tenant cost details
 */
async function getTenantCostDetailsFallback(tenantId: string): Promise<TenantCostDetails | null> {
  const supabase = getSupabaseClient();

  // Tenant info
  const { data: tenant } = await supabase
    .from('tenants')
    .select('id, name')
    .eq('id', tenantId)
    .single();

  if (!tenant) {
    return null;
  }

  // Document logs
  const { data: docLogs } = await supabase
    .from('document_processing_logs')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('processing_status', 'completed')
    .order('completed_at', { ascending: false });

  // Chat logs
  const { data: chatLogs } = await supabase
    .from('chat_logs')
    .select('total_cost, pinecone_cost, openai_cost, rag_details, response_time_ms, created_at')
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false });

  const documents = docLogs || [];
  const chats = chatLogs || [];

  return {
    tenant_id: tenant.id,
    tenant_name: tenant.name,
    documents: {
      count: documents.length,
      total_pages: documents.reduce((sum, d) => sum + (d.total_pages || 0), 0),
      total_chunks: documents.reduce((sum, d) => sum + (d.chunks_created || 0), 0),
      costs: {
        chunking: documents.reduce((sum, d) => sum + (d.chunking_cost || 0), 0),
        embedding: documents.reduce((sum, d) => sum + (d.embedding_cost || 0), 0),
        metadata: documents.reduce((sum, d) => sum + (d.metadata_cost || 0), 0),
        total: documents.reduce((sum, d) => sum + (d.total_cost || 0), 0)
      },
      documents: documents.map(d => ({
        filename: d.filename,
        pages: d.total_pages || 0,
        chunks: d.chunks_created || 0,
        costs: {
          chunking: d.chunking_cost || 0,
          embedding: d.embedding_cost || 0,
          metadata: d.metadata_cost || 0,
          total: d.total_cost || 0
        },
        processed_at: d.completed_at,
        duration_seconds: (d.total_duration_ms || 0) / 1000
      }))
    },
    chats: {
      count: chats.length,
      costs: {
        embedding: chats.reduce((sum, c) => sum + (c.pinecone_cost || 0), 0),
        reranking: chats.reduce((sum, c) => sum + (c.rag_details?.costs?.reranking || 0), 0),
        translation: chats.reduce((sum, c) => sum + (c.rag_details?.query?.translation?.translationCost || 0), 0),
        openai: chats.reduce((sum, c) => sum + (c.openai_cost || 0), 0),
        total: chats.reduce((sum, c) => sum + (c.total_cost || 0), 0)
      },
      avg_response_time_ms: chats.length > 0
        ? chats.reduce((sum, c) => sum + (c.response_time_ms || 0), 0) / chats.length
        : 0,
      last_chat: chats.length > 0 ? chats[0].created_at : null
    },
    total_cost:
      documents.reduce((sum, d) => sum + (d.total_cost || 0), 0) +
      chats.reduce((sum, c) => sum + (c.total_cost || 0), 0)
  };
}

/**
 * Haalt globale kosten stats op (voor admin dashboard header)
 */
export async function getGlobalCostStats(): Promise<{
  total_cost: number;
  total_tenants: number;
  total_documents: number;
  total_chats: number;
}> {
  const tenantCosts = await getAllTenantCosts();

  return {
    total_cost: tenantCosts.reduce((sum, t) => sum + t.total_cost, 0),
    total_tenants: tenantCosts.length,
    total_documents: tenantCosts.reduce((sum, t) => sum + t.document_count, 0),
    total_chats: tenantCosts.reduce((sum, t) => sum + t.chat_count, 0)
  };
}
