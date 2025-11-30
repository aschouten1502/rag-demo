/**
 * PDF URL mapping for Supabase Storage (Multi-Tenant)
 *
 * This module generates public URLs for PDF documents stored in Supabase Storage.
 * Works with any tenant's storage bucket configured via STORAGE_BUCKET_NAME env var.
 *
 * MULTI-TENANT ARCHITECTURE:
 * - Each client has their own storage bucket: "{tenant-id}-hr-documents"
 * - Bucket name is configured via environment variable
 * - No hardcoded PDF lists - all PDFs in bucket are considered valid
 *
 * LEGACY SUPPORT:
 * - Backwards compatible with legacy storage buckets
 * - Falls back to generic "hr-documents" if not configured
 */

import { STORAGE_CONFIG } from './supabase/config';

const SUPABASE_STORAGE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace('/rest/v1', '') || '';

/**
 * Get the storage bucket name from configuration
 * @returns The configured bucket name or fallback
 */
export function getBucketName(): string {
  return STORAGE_CONFIG.bucketName;
}

/**
 * Get the public URL for a PDF document
 *
 * @param filename - The PDF filename (e.g., "Employee_Handbook_2024.pdf")
 * @returns The public URL to the PDF in Supabase Storage
 *
 * @example
 * ```typescript
 * const url = getPdfUrl("Employee_Handbook.pdf");
 * // Returns: "https://xxx.supabase.co/storage/v1/object/public/acme-corp-hr-documents/Employee_Handbook.pdf"
 * ```
 */
export function getPdfUrl(filename: string): string {
  if (!SUPABASE_STORAGE_URL) {
    console.warn('⚠️ [PDF URLs] NEXT_PUBLIC_SUPABASE_URL not configured - PDF links will not work');
    return '#'; // Return placeholder if Supabase not configured
  }

  const encodedFilename = encodeURIComponent(filename);
  const encodedBucket = encodeURIComponent(STORAGE_CONFIG.bucketName);
  return `${SUPABASE_STORAGE_URL}/storage/v1/object/public/${encodedBucket}/${encodedFilename}`;
}

/**
 * Check if a filename corresponds to a PDF document
 *
 * MULTI-TENANT MODE:
 * - Returns true for ANY .pdf filename (assumes all PDFs in bucket are valid)
 * - No hardcoded list needed - client uploads their own documents
 *
 * LEGACY MODE (if USE_DYNAMIC_PDF_LIST=false):
 * - Uses hardcoded PDF list for backwards compatibility
 *
 * @param filename - The filename to check
 * @returns true if this appears to be a valid PDF
 */
export function isPdfAvailable(filename: string): boolean {
  // Multi-tenant mode: Accept any .pdf file
  if (STORAGE_CONFIG.useDynamicPdfList) {
    return filename.toLowerCase().endsWith('.pdf');
  }

  // Legacy mode: Use hardcoded list for backwards compatibility
  const legacyPdfs = [
    'Betaaldata 2025.pdf',
    'Flyer_ASF-RVU_Eerder-stoppen-met-werken_Werknemer.pdf',
    'Grafimedia-cao-2024-2025.pdf',
    'Indienst - AFAS_handleiding.pdf',
    'LEASE_A_BIKE___werknemer_brochure_2021.pdf',
    'Personeelsgids_versie_HRM_2023_V17.pdf',
    'PGB - Pensioen 1-2-3 - 2025.pdf',
    'Proces eerlijk werven final versie 16-4-2025.pdf',
    'WTV regeling.pdf'
  ];

  return legacyPdfs.includes(filename);
}

/**
 * Validate that PDF URL configuration is working
 * @returns Configuration status with helpful error messages
 */
export function validatePdfConfig(): {
  isValid: boolean;
  message: string;
  bucket: string;
  supabaseConfigured: boolean;
} {
  const supabaseConfigured = !!SUPABASE_STORAGE_URL;
  const bucket = STORAGE_CONFIG.bucketName;

  if (!supabaseConfigured) {
    return {
      isValid: false,
      message: 'Supabase not configured. Set NEXT_PUBLIC_SUPABASE_URL in .env.local',
      bucket: bucket,
      supabaseConfigured: false,
    };
  }

  if (bucket === 'hr-documents') {
    return {
      isValid: true,
      message: 'Using default bucket name. Set STORAGE_BUCKET_NAME={tenant-id}-hr-documents in .env.local',
      bucket: bucket,
      supabaseConfigured: true,
    };
  }

  return {
    isValid: true,
    message: `PDF URLs configured correctly for bucket: ${bucket}`,
    bucket: bucket,
    supabaseConfigured: true,
  };
}
