'use client';

/**
 * ========================================
 * CLIENT LAYOUT
 * ========================================
 *
 * Client-side wrapper that provides tenant context to all pages.
 * Necessary because TenantProvider uses useSearchParams() which
 * requires a Suspense boundary.
 */

import { Suspense, ReactNode } from 'react';
import { TenantProvider } from './providers/TenantProvider';

// Loading component while tenant is being fetched
function TenantLoadingFallback() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="flex flex-col items-center gap-4">
        <div className="w-12 h-12 border-4 border-gray-200 border-t-purple-500 rounded-full animate-spin" />
        <p className="text-gray-500 text-sm">Loading...</p>
      </div>
    </div>
  );
}

interface ClientLayoutProps {
  children: ReactNode;
}

export default function ClientLayout({ children }: ClientLayoutProps) {
  return (
    <Suspense fallback={<TenantLoadingFallback />}>
      <TenantProvider>
        {children}
      </TenantProvider>
    </Suspense>
  );
}
