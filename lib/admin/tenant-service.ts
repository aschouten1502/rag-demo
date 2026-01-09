/**
 * ========================================
 * TENANT SERVICE - CRUD Operations
 * ========================================
 *
 * Handles all tenant-related database operations:
 * - Create, Read, Update, Delete tenants
 * - Tenant statistics and analytics
 * - Document management per tenant
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { ensureBucketExists, getDocumentsBucket } from './storage-service';

// ========================================
// TYPES
// ========================================

export interface Tenant {
  id: string;
  name: string;
  logo_url?: string;
  primary_color: string;
  secondary_color?: string;
  welcome_message?: string;
  contact_email?: string;
  is_active: boolean;
  is_demo: boolean;
  // Multilingual RAG support (v2.2)
  document_language: string;
  website_url?: string;
  created_at: string;
  updated_at: string;
}

export interface TenantCreateInput {
  id: string;           // slug/identifier (lowercase-with-dashes)
  name: string;         // Display name
  logo_url?: string;
  primary_color?: string;
  secondary_color?: string;
  welcome_message?: string;
  contact_email?: string;
  is_demo?: boolean;    // Mark as demo/test tenant
  // Multilingual RAG support (v2.2)
  document_language?: string;  // nl, de, fr, en, etc.
  website_url?: string;        // For auto-branding extraction
}

export interface TenantUpdateInput {
  name?: string;
  logo_url?: string;
  primary_color?: string;
  secondary_color?: string;
  welcome_message?: string;
  contact_email?: string;
  is_active?: boolean;
  is_demo?: boolean;
}

export interface TenantStats {
  tenant_id: string;
  document_count: number;
  chunk_count: number;
  chat_count: number;
  total_cost: number;
  last_chat_at?: string;
}

export interface TenantWithStats extends Tenant {
  stats: TenantStats;
}

// ========================================
// SUPABASE CLIENT
// ========================================

let supabaseClient: SupabaseClient | null = null;

/**
 * Check if Supabase is configured
 */
export function isSupabaseConfigured(): boolean {
  return !!(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

function getSupabaseClient(): SupabaseClient | null {
  if (!supabaseClient) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!url || !key) {
      console.warn('⚠️ [TenantService] Supabase not configured - set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');
      return null;
    }

    supabaseClient = createClient(url, key);
  }
  return supabaseClient;
}

// ========================================
// CREATE
// ========================================

/**
 * Create a new tenant
 */
export async function createTenant(input: TenantCreateInput): Promise<{ success: boolean; tenant?: Tenant; error?: string }> {
  const supabase = getSupabaseClient();

  if (!supabase) {
    return { success: false, error: 'Supabase not configured' };
  }

  console.log('🏢 [TenantService] Creating tenant:', input.id);

  // Validate tenant ID format (lowercase, dashes allowed)
  const tenantIdRegex = /^[a-z0-9][a-z0-9-]*[a-z0-9]$|^[a-z0-9]$/;
  if (!tenantIdRegex.test(input.id)) {
    return {
      success: false,
      error: 'Tenant ID must be lowercase letters, numbers, and dashes (e.g., "acme-corp")'
    };
  }

  try {
    const { data, error } = await supabase
      .from('tenants')
      .insert({
        id: input.id,
        name: input.name,
        logo_url: input.logo_url || null,
        primary_color: input.primary_color || '#0066CC',
        secondary_color: input.secondary_color || null,
        welcome_message: input.welcome_message || null,
        contact_email: input.contact_email || null,
        is_active: true,
        is_demo: input.is_demo || false,
        // Multilingual RAG support (v2.2)
        document_language: input.document_language || 'nl',
        website_url: input.website_url || null
      })
      .select()
      .single();

    if (error) {
      console.error('❌ [TenantService] Create failed:', error);

      if (error.code === '23505') {
        return { success: false, error: 'A tenant with this ID already exists' };
      }

      return { success: false, error: error.message };
    }

    console.log('✅ [TenantService] Tenant created:', data.id);

    // Automatically create the storage bucket for this tenant
    const bucketName = getDocumentsBucket(input.id);
    console.log(`📦 [TenantService] Creating storage bucket: ${bucketName}`);
    const bucketCreated = await ensureBucketExists(bucketName, true);

    if (!bucketCreated) {
      console.warn(`⚠️ [TenantService] Failed to create bucket ${bucketName}, but tenant was created`);
      // Don't fail tenant creation if bucket creation fails - it will be created on first upload
    } else {
      console.log(`✅ [TenantService] Storage bucket created: ${bucketName}`);
    }

    return { success: true, tenant: data };

  } catch (error) {
    console.error('❌ [TenantService] Unexpected error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

// ========================================
// READ
// ========================================

/**
 * Get all tenants
 */
export async function getAllTenants(): Promise<Tenant[]> {
  const supabase = getSupabaseClient();

  if (!supabase) {
    return [];
  }

  const { data, error } = await supabase
    .from('tenants')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('❌ [TenantService] List failed:', error);
    return [];
  }

  return data || [];
}

/**
 * Get a single tenant by ID
 */
export async function getTenantById(tenantId: string): Promise<Tenant | null> {
  const supabase = getSupabaseClient();

  if (!supabase) {
    return null;
  }

  const { data, error } = await supabase
    .from('tenants')
    .select('*')
    .eq('id', tenantId)
    .single();

  if (error) {
    console.error('❌ [TenantService] Get tenant failed:', error);
    return null;
  }

  return data;
}

/**
 * Get tenant statistics
 */
export async function getTenantStats(tenantId: string): Promise<TenantStats> {
  const supabase = getSupabaseClient();

  if (!supabase) {
    return {
      tenant_id: tenantId,
      document_count: 0,
      chunk_count: 0,
      chat_count: 0,
      total_cost: 0
    };
  }

  // Get document count
  const { count: documentCount } = await supabase
    .from('documents')
    .select('*', { count: 'exact', head: true })
    .eq('tenant_id', tenantId);

  // Get chunk count
  const { count: chunkCount } = await supabase
    .from('document_chunks')
    .select('*', { count: 'exact', head: true })
    .eq('tenant_id', tenantId);

  // Get chat stats
  const { data: chatStats } = await supabase
    .from('chat_logs')
    .select('total_cost, created_at')
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false });

  const chatCount = chatStats?.length || 0;
  const totalCost = chatStats?.reduce((sum, log) => sum + (parseFloat(log.total_cost) || 0), 0) || 0;
  const lastChatAt = chatStats?.[0]?.created_at;

  return {
    tenant_id: tenantId,
    document_count: documentCount || 0,
    chunk_count: chunkCount || 0,
    chat_count: chatCount,
    total_cost: totalCost,
    last_chat_at: lastChatAt
  };
}

/**
 * Get all tenants with their statistics
 */
export async function getAllTenantsWithStats(): Promise<TenantWithStats[]> {
  const tenants = await getAllTenants();

  const tenantsWithStats = await Promise.all(
    tenants.map(async (tenant) => {
      const stats = await getTenantStats(tenant.id);
      return { ...tenant, stats };
    })
  );

  return tenantsWithStats;
}

// ========================================
// UPDATE
// ========================================

/**
 * Update a tenant
 */
export async function updateTenant(
  tenantId: string,
  input: TenantUpdateInput
): Promise<{ success: boolean; tenant?: Tenant; error?: string }> {
  const supabase = getSupabaseClient();

  if (!supabase) {
    return { success: false, error: 'Supabase not configured' };
  }

  console.log('🔄 [TenantService] Updating tenant:', tenantId);

  try {
    const { data, error } = await supabase
      .from('tenants')
      .update({
        ...input,
        updated_at: new Date().toISOString()
      })
      .eq('id', tenantId)
      .select()
      .single();

    if (error) {
      console.error('❌ [TenantService] Update failed:', error);
      return { success: false, error: error.message };
    }

    console.log('✅ [TenantService] Tenant updated:', tenantId);
    return { success: true, tenant: data };

  } catch (error) {
    console.error('❌ [TenantService] Unexpected error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

// ========================================
// DELETE
// ========================================

/**
 * Delete a tenant and all associated data
 * WARNING: This will delete all documents, chunks, and chat logs!
 */
export async function deleteTenant(
  tenantId: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = getSupabaseClient();

  if (!supabase) {
    return { success: false, error: 'Supabase not configured' };
  }

  console.log('🗑️  [TenantService] Deleting tenant:', tenantId);

  try {
    // Delete in order due to foreign key constraints:
    // 1. document_chunks (references documents)
    // 2. documents (references tenants)
    // 3. chat_logs (references tenants)
    // 4. tenants

    // Delete document chunks
    const { error: chunksError } = await supabase
      .from('document_chunks')
      .delete()
      .eq('tenant_id', tenantId);

    if (chunksError) {
      console.error('❌ [TenantService] Delete chunks failed:', chunksError);
      return { success: false, error: `Failed to delete chunks: ${chunksError.message}` };
    }

    // Delete documents
    const { error: docsError } = await supabase
      .from('documents')
      .delete()
      .eq('tenant_id', tenantId);

    if (docsError) {
      console.error('❌ [TenantService] Delete documents failed:', docsError);
      return { success: false, error: `Failed to delete documents: ${docsError.message}` };
    }

    // Delete chat logs
    const { error: logsError } = await supabase
      .from('chat_logs')
      .delete()
      .eq('tenant_id', tenantId);

    if (logsError) {
      console.error('❌ [TenantService] Delete chat logs failed:', logsError);
      return { success: false, error: `Failed to delete chat logs: ${logsError.message}` };
    }

    // Finally delete the tenant
    const { error: tenantError } = await supabase
      .from('tenants')
      .delete()
      .eq('id', tenantId);

    if (tenantError) {
      console.error('❌ [TenantService] Delete tenant failed:', tenantError);
      return { success: false, error: tenantError.message };
    }

    console.log('✅ [TenantService] Tenant deleted:', tenantId);
    return { success: true };

  } catch (error) {
    console.error('❌ [TenantService] Unexpected error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

// ========================================
// UTILITY FUNCTIONS
// ========================================

/**
 * Generate a tenant slug from a company name
 */
export function generateTenantSlug(companyName: string): string {
  return companyName
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')  // Remove special characters
    .replace(/\s+/g, '-')          // Replace spaces with dashes
    .replace(/-+/g, '-')           // Replace multiple dashes with single
    .replace(/^-|-$/g, '');        // Remove leading/trailing dashes
}

/**
 * Check if a tenant ID is available
 */
export async function isTenantIdAvailable(tenantId: string): Promise<boolean> {
  const supabase = getSupabaseClient();

  if (!supabase) {
    return true; // Assume available if not configured
  }

  const { data, error } = await supabase
    .from('tenants')
    .select('id')
    .eq('id', tenantId)
    .single();

  if (error && error.code === 'PGRST116') {
    // No rows returned = ID is available
    return true;
  }

  return !data;
}
