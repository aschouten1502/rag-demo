import { NextRequest, NextResponse } from 'next/server';
import { getAllTenantCosts, getTenantCostDetails, getGlobalCostStats } from '@/lib/admin/cost-service';

/**
 * GET /api/admin/costs
 * Get cost overview for all tenants
 *
 * Query params:
 * - tenant_id: Optional, get detailed costs for specific tenant
 * - summary: If "true", return only global stats
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const tenantId = searchParams.get('tenant_id');
    const summaryOnly = searchParams.get('summary') === 'true';

    // Global stats only
    if (summaryOnly) {
      const stats = await getGlobalCostStats();
      return NextResponse.json(stats);
    }

    // Specific tenant details
    if (tenantId) {
      const details = await getTenantCostDetails(tenantId);

      if (!details) {
        return NextResponse.json(
          { error: 'Tenant not found' },
          { status: 404 }
        );
      }

      return NextResponse.json(details);
    }

    // All tenants overview
    const costs = await getAllTenantCosts();
    return NextResponse.json({ costs });

  } catch (error) {
    console.error('❌ [API] Error fetching costs:', error);
    return NextResponse.json(
      { error: 'Failed to fetch costs' },
      { status: 500 }
    );
  }
}
