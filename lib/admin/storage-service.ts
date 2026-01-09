/**
 * ========================================
 * STORAGE SERVICE - File Upload Operations
 * ========================================
 *
 * Handles all file upload operations to Supabase Storage:
 * - Logo upload for tenant branding
 * - PDF document upload for RAG processing
 * - File URL generation
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';

// ========================================
// TYPES
// ========================================

export interface UploadResult {
  success: boolean;
  path?: string;
  publicUrl?: string;
  error?: string;
}

export interface FileInfo {
  name: string;
  size: number;
  type: string;
  lastModified: number;
}

// ========================================
// CONFIGURATION
// ========================================

const LOGO_BUCKET = 'tenant-logos';
const DOCUMENTS_BUCKET_PREFIX = 'tenant-documents';

// Max file sizes
const MAX_LOGO_SIZE = 2 * 1024 * 1024;        // 2MB
const MAX_DOCUMENT_SIZE = 50 * 1024 * 1024;   // 50MB

// Allowed file types
const ALLOWED_LOGO_TYPES = ['image/png', 'image/jpeg', 'image/svg+xml', 'image/webp'];
const ALLOWED_DOCUMENT_TYPES = ['application/pdf'];

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
// BUCKET MANAGEMENT
// ========================================

/**
 * Ensure a storage bucket exists (create if not)
 * Exported so tenant-service can create bucket at tenant creation time
 */
export async function ensureBucketExists(bucketName: string, isPublic: boolean = true): Promise<boolean> {
  const supabase = getSupabaseClient();

  // Check if bucket exists
  const { data: buckets } = await supabase.storage.listBuckets();
  const bucketExists = buckets?.some(b => b.name === bucketName);

  if (!bucketExists) {
    console.log(`📦 [Storage] Creating bucket: ${bucketName}`);
    const { error } = await supabase.storage.createBucket(bucketName, {
      public: isPublic,
      fileSizeLimit: MAX_DOCUMENT_SIZE
    });

    if (error) {
      console.error(`❌ [Storage] Failed to create bucket: ${error.message}`);
      return false;
    }
    console.log(`✅ [Storage] Bucket created: ${bucketName}`);
  }

  return true;
}

/**
 * Get the documents bucket name for a tenant
 */
export function getDocumentsBucket(tenantId: string): string {
  return `${tenantId}-hr-documents`;
}

// ========================================
// LOGO UPLOAD
// ========================================

/**
 * Upload a logo for a tenant
 */
export async function uploadLogo(
  tenantId: string,
  file: Buffer,
  filename: string,
  mimeType: string
): Promise<UploadResult> {
  const supabase = getSupabaseClient();

  console.log(`🖼️  [Storage] Uploading logo for tenant: ${tenantId}`);

  // Validate file type
  if (!ALLOWED_LOGO_TYPES.includes(mimeType)) {
    return {
      success: false,
      error: `Invalid file type. Allowed: ${ALLOWED_LOGO_TYPES.join(', ')}`
    };
  }

  // Validate file size
  const fileSize = file.length;
  if (fileSize > MAX_LOGO_SIZE) {
    return {
      success: false,
      error: `File too large. Maximum size: ${MAX_LOGO_SIZE / 1024 / 1024}MB`
    };
  }

  // Ensure bucket exists
  await ensureBucketExists(LOGO_BUCKET, true);

  // Generate unique filename
  const extension = filename.split('.').pop() || 'png';
  const storagePath = `${tenantId}/logo.${extension}`;

  try {
    const fileBuffer = file;

    // Upload file
    const { data, error } = await supabase.storage
      .from(LOGO_BUCKET)
      .upload(storagePath, fileBuffer, {
        contentType: mimeType,
        upsert: true  // Overwrite if exists
      });

    if (error) {
      console.error('❌ [Storage] Logo upload failed:', error);
      return { success: false, error: error.message };
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from(LOGO_BUCKET)
      .getPublicUrl(storagePath);

    console.log('✅ [Storage] Logo uploaded:', urlData.publicUrl);

    return {
      success: true,
      path: data.path,
      publicUrl: urlData.publicUrl
    };

  } catch (error) {
    console.error('❌ [Storage] Unexpected error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Delete a tenant's logo
 */
export async function deleteLogo(tenantId: string): Promise<boolean> {
  const supabase = getSupabaseClient();

  // List all files in tenant's logo folder
  const { data: files } = await supabase.storage
    .from(LOGO_BUCKET)
    .list(tenantId);

  if (!files || files.length === 0) return true;

  // Delete all logo files
  const paths = files.map(f => `${tenantId}/${f.name}`);
  const { error } = await supabase.storage
    .from(LOGO_BUCKET)
    .remove(paths);

  if (error) {
    console.error('❌ [Storage] Delete logo failed:', error);
    return false;
  }

  return true;
}

// ========================================
// DOCUMENT UPLOAD
// ========================================

/**
 * Upload a PDF document for a tenant
 */
export async function uploadDocument(
  tenantId: string,
  file: Buffer,
  filename: string,
  mimeType: string = 'application/pdf'
): Promise<UploadResult> {
  const supabase = getSupabaseClient();
  const bucketName = getDocumentsBucket(tenantId);

  console.log(`📄 [Storage] Uploading document for tenant: ${tenantId}`);
  console.log(`   File: ${filename}, Size: ${file.length} bytes`);

  // Validate file type
  if (!ALLOWED_DOCUMENT_TYPES.includes(mimeType)) {
    return {
      success: false,
      error: `Invalid file type. Only PDF files are allowed.`
    };
  }

  // Validate file size
  const fileSize = file.length;
  if (fileSize > MAX_DOCUMENT_SIZE) {
    return {
      success: false,
      error: `File too large. Maximum size: ${MAX_DOCUMENT_SIZE / 1024 / 1024}MB`
    };
  }

  // Ensure bucket exists
  await ensureBucketExists(bucketName, true);

  // Generate storage path (sanitize filename)
  const sanitizedFilename = filename
    .replace(/[^a-zA-Z0-9.-]/g, '_')
    .replace(/_+/g, '_');
  const storagePath = `documents/${sanitizedFilename}`;

  try {
    const fileBuffer = file;

    // Upload file
    const { data, error } = await supabase.storage
      .from(bucketName)
      .upload(storagePath, fileBuffer, {
        contentType: mimeType,
        upsert: true
      });

    if (error) {
      console.error('❌ [Storage] Document upload failed:', error);
      return { success: false, error: error.message };
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from(bucketName)
      .getPublicUrl(storagePath);

    console.log('✅ [Storage] Document uploaded:', data.path);

    return {
      success: true,
      path: data.path,
      publicUrl: urlData.publicUrl
    };

  } catch (error) {
    console.error('❌ [Storage] Unexpected error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Delete a document from storage
 */
export async function deleteDocument(
  tenantId: string,
  filePath: string
): Promise<boolean> {
  const supabase = getSupabaseClient();
  const bucketName = getDocumentsBucket(tenantId);

  const { error } = await supabase.storage
    .from(bucketName)
    .remove([filePath]);

  if (error) {
    console.error('❌ [Storage] Delete document failed:', error);
    return false;
  }

  return true;
}

/**
 * List all documents for a tenant
 */
export async function listDocuments(tenantId: string): Promise<FileInfo[]> {
  const supabase = getSupabaseClient();
  const bucketName = getDocumentsBucket(tenantId);

  const { data, error } = await supabase.storage
    .from(bucketName)
    .list('documents');

  if (error) {
    console.error('❌ [Storage] List documents failed:', error);
    return [];
  }

  return (data || []).map(file => ({
    name: file.name,
    size: file.metadata?.size || 0,
    type: file.metadata?.mimetype || 'application/pdf',
    lastModified: new Date(file.updated_at || file.created_at).getTime()
  }));
}

/**
 * Get public URL for a document
 */
export function getDocumentUrl(tenantId: string, filename: string): string {
  const supabase = getSupabaseClient();
  const bucketName = getDocumentsBucket(tenantId);

  const { data } = supabase.storage
    .from(bucketName)
    .getPublicUrl(`documents/${filename}`);

  return data.publicUrl;
}

// ========================================
// UTILITY FUNCTIONS
// ========================================

/**
 * Delete all storage for a tenant (logos and documents)
 */
export async function deleteTenantStorage(tenantId: string): Promise<boolean> {
  const supabase = getSupabaseClient();

  console.log(`🗑️  [Storage] Deleting all storage for tenant: ${tenantId}`);

  // Delete logo
  await deleteLogo(tenantId);

  // Delete documents bucket
  const bucketName = getDocumentsBucket(tenantId);
  const { data: buckets } = await supabase.storage.listBuckets();
  const bucketExists = buckets?.some(b => b.name === bucketName);

  if (bucketExists) {
    // First delete all files in bucket
    const { data: files } = await supabase.storage
      .from(bucketName)
      .list('documents');

    if (files && files.length > 0) {
      const paths = files.map(f => `documents/${f.name}`);
      await supabase.storage.from(bucketName).remove(paths);
    }

    // Then delete bucket
    const { error } = await supabase.storage.deleteBucket(bucketName);
    if (error) {
      console.error('❌ [Storage] Delete bucket failed:', error);
      return false;
    }
  }

  console.log(`✅ [Storage] All storage deleted for tenant: ${tenantId}`);
  return true;
}
