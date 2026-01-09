/**
 * ========================================
 * TENANT MIDDLEWARE
 * ========================================
 *
 * Detecteert de tenant ID uit verschillende bronnen en
 * voegt deze toe aan de request headers voor API routes.
 *
 * DETECTIE VOLGORDE (eerste match wint):
 * 1. Subdomain: acme.localhost:3000 → tenant_id = "acme"
 * 2. Query parameter: ?tenant=acme
 * 3. Header: X-Tenant-ID: acme
 * 4. Environment variable: TENANT_ID (fallback)
 *
 * GEBRUIK IN API ROUTES:
 * ```typescript
 * const tenantId = request.headers.get('x-tenant-id');
 * ```
 */

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/**
 * Extract tenant ID from subdomain
 * Examples:
 * - acme.localhost:3000 → "acme"
 * - acme.hr-assistant.vercel.app → "acme"
 * - localhost:3000 → null
 * - hr-assistant.vercel.app → null
 */
function getTenantFromSubdomain(hostname: string): string | null {
  // Remove port if present
  const host = hostname.split(':')[0];

  // Split by dots
  const parts = host.split('.');

  // Check for local development
  if (host === 'localhost' || host === '127.0.0.1') {
    return null;
  }

  // For subdomains like acme.localhost
  if (parts.length === 2 && parts[1] === 'localhost') {
    return parts[0];
  }

  // For production: acme.hr-assistant.vercel.app (4 parts)
  // or acme.customdomain.com (3 parts)
  if (parts.length >= 3) {
    const subdomain = parts[0];
    // Exclude common non-tenant subdomains
    const excludedSubdomains = ['www', 'api', 'app', 'admin', 'staging', 'dev'];
    if (!excludedSubdomains.includes(subdomain)) {
      return subdomain;
    }
  }

  return null;
}

/**
 * Extract tenant ID from query parameter
 */
function getTenantFromQuery(url: URL): string | null {
  return url.searchParams.get('tenant');
}

/**
 * Extract tenant ID from header
 */
function getTenantFromHeader(request: NextRequest): string | null {
  return request.headers.get('x-tenant-id');
}

/**
 * Get default tenant ID from environment
 */
function getDefaultTenant(): string | null {
  return process.env.TENANT_ID || null;
}

export function middleware(request: NextRequest) {
  const url = new URL(request.url);
  const hostname = request.headers.get('host') || '';

  // Detect tenant from various sources (priority order)
  let tenantId: string | null = null;
  let tenantSource: string = 'none';

  // 1. Try subdomain first
  tenantId = getTenantFromSubdomain(hostname);
  if (tenantId) {
    tenantSource = 'subdomain';
  }

  // 2. Try query parameter
  if (!tenantId) {
    tenantId = getTenantFromQuery(url);
    if (tenantId) {
      tenantSource = 'query';
    }
  }

  // 3. Try header
  if (!tenantId) {
    tenantId = getTenantFromHeader(request);
    if (tenantId) {
      tenantSource = 'header';
    }
  }

  // 4. Fallback to environment variable
  if (!tenantId) {
    tenantId = getDefaultTenant();
    if (tenantId) {
      tenantSource = 'env';
    }
  }

  // Log tenant detection in development
  if (process.env.NODE_ENV === 'development') {
    console.log(`🏢 [Middleware] Tenant: ${tenantId || 'NOT_SET'} (source: ${tenantSource})`);
  }

  // Clone the request headers and add tenant info
  const requestHeaders = new Headers(request.headers);

  if (tenantId) {
    requestHeaders.set('x-tenant-id', tenantId);
    requestHeaders.set('x-tenant-source', tenantSource);
  }

  // Return response with modified headers
  const response = NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });

  // Also set tenant in response headers for client-side access
  if (tenantId) {
    response.headers.set('x-tenant-id', tenantId);
  }

  return response;
}

// Configure which paths the middleware runs on
export const config = {
  matcher: [
    // Match all API routes
    '/api/:path*',
    // Match all pages except static files and Next.js internals
    '/((?!_next/static|_next/image|favicon.ico|icons|images|manifest.json|sw.js|workbox-*).*)',
  ],
};
