/**
 * API Route: Extract Branding from URL
 *
 * POST /api/admin/branding/extract-from-url
 *
 * Extracts branding information (colors, logo, company name) from a website URL.
 */

import { NextRequest, NextResponse } from 'next/server';
import { extractBrandingFromUrl } from '@/lib/admin/url-extractor';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { url } = body;

    // Validate URL
    if (!url || typeof url !== 'string') {
      return NextResponse.json(
        { error: 'URL is required' },
        { status: 400 }
      );
    }

    // Basic URL validation
    const urlPattern = /^(https?:\/\/)?[\w.-]+\.[a-z]{2,}(\/.*)?$/i;
    if (!urlPattern.test(url.trim())) {
      return NextResponse.json(
        { error: 'Invalid URL format' },
        { status: 400 }
      );
    }

    console.log(`🌐 [API] Extracting branding from: ${url}`);

    // Extract branding
    const result = await extractBrandingFromUrl(url);

    if (!result.success) {
      console.error(`❌ [API] Extraction failed:`, result.errors);
      return NextResponse.json(
        {
          error: 'Failed to extract branding',
          details: result.errors,
          extracted: result.extracted, // Return partial results
        },
        { status: 422 }
      );
    }

    console.log(`✅ [API] Branding extracted successfully:`, {
      name: result.extracted.name,
      primary_color: result.extracted.primary_color,
      has_logo: !!result.extracted.logo_url,
    });

    return NextResponse.json({
      success: true,
      extracted: result.extracted,
      source_url: result.source_url,
    });

  } catch (error: any) {
    console.error(`❌ [API] Error in extract-from-url:`, error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}
