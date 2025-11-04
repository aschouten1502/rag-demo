/**
 * PDF URL mapping for Supabase Storage
 * Maps PDF filenames to their public URLs
 */

const SUPABASE_STORAGE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace('/rest/v1', '') || '';
const BUCKET_NAME = 'Geostick-HR-documenten';

/**
 * Get the public URL for a PDF document
 * @param filename - The PDF filename (e.g., "Personeelsgids_versie_HRM_2023_V17.pdf")
 * @returns The public URL to the PDF
 */
export function getPdfUrl(filename: string): string {
  const encodedFilename = encodeURIComponent(filename);
  const encodedBucket = encodeURIComponent(BUCKET_NAME);
  return `${SUPABASE_STORAGE_URL}/storage/v1/object/public/${encodedBucket}/${encodedFilename}`;
}

/**
 * Check if a filename corresponds to a known PDF document
 * @param filename - The filename to check
 * @returns true if this is a known PDF
 */
export function isPdfAvailable(filename: string): boolean {
  const knownPdfs = [
    'Betaaldata 2025.pdf',
    'Flyer_ASF-RVU_Eerder-stoppen-met-werken_Werknemer.pdf',
    'Geostick Extra info.pdf',
    'Grafimedia-cao-2024-2025.pdf',
    'Indienst - AFAS_handleiding.pdf',
    'LEASE_A_BIKE___werknemer_brochure_2021.pdf',
    'Personeelsgids_versie_HRM_2023_V17.pdf',
    'PGB - Pensioen 1-2-3 - 2025.pdf',
    'Proces eerlijk werven final versie 16-4-2025.pdf',
    'WTV regeling.pdf'
  ];

  return knownPdfs.includes(filename);
}
