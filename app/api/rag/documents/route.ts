/**
 * ========================================
 * RAG Documents API Route
 * ========================================
 *
 * GET /api/rag/documents?tenant_id=xxx
 * Lijst alle documenten voor een tenant
 *
 * DELETE /api/rag/documents?tenant_id=xxx&id=yyy
 * Verwijder een document
 *
 * Response (GET):
 * {
 *   documents: Document[]
 * }
 *
 * Response (DELETE):
 * {
 *   success: boolean
 * }
 */

import { NextRequest, NextResponse } from 'next/server';
import { listDocuments, deleteDocument, getDocument } from '@/lib/rag/processor';
import { checkRAGHealth } from '@/lib/rag/context';

// ========================================
// GET - List Documents
// ========================================

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const tenantIdParam = searchParams.get('tenant_id');
  const documentId = searchParams.get('id');
  const healthCheck = searchParams.get('health');

  // Use tenant_id from query or fallback to environment variable
  const tenantId = tenantIdParam || process.env.TENANT_ID;

  if (!tenantId) {
    return NextResponse.json(
      { error: 'tenant_id is required (provide in query or set TENANT_ID env var)' },
      { status: 400 }
    );
  }

  // Health check endpoint: GET /api/rag/documents?health=true
  if (healthCheck === 'true') {
    console.log('🏥 [Documents API] Health check for tenant:', tenantId);
    const health = await checkRAGHealth(tenantId);
    return NextResponse.json(health);
  }

  // Get single document: GET /api/rag/documents?id=xxx
  if (documentId) {
    console.log('📄 [Documents API] Get document:', documentId);
    const document = await getDocument(tenantId, documentId);

    if (!document) {
      return NextResponse.json(
        { error: 'Document not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ document });
  }

  // List all documents: GET /api/rag/documents
  console.log('📋 [Documents API] Listing documents for tenant:', tenantId);
  const documents = await listDocuments(tenantId);

  return NextResponse.json({
    documents,
    count: documents.length
  });
}

// ========================================
// DELETE - Delete Document
// ========================================

export async function DELETE(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const tenantIdParam = searchParams.get('tenant_id');
  const documentId = searchParams.get('id');

  // Use tenant_id from query or fallback to environment variable
  const tenantId = tenantIdParam || process.env.TENANT_ID;

  if (!tenantId) {
    return NextResponse.json(
      { error: 'tenant_id is required' },
      { status: 400 }
    );
  }

  if (!documentId) {
    return NextResponse.json(
      { error: 'id (document ID) is required' },
      { status: 400 }
    );
  }

  console.log('🗑️  [Documents API] Deleting document:', documentId);

  const success = await deleteDocument(tenantId, documentId);

  if (!success) {
    return NextResponse.json(
      { success: false, error: 'Delete failed' },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true });
}
