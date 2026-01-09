# Supabase RAG Migration Prompt

Deze prompt is bedoeld voor Claude Code om Pinecone te vervangen door een eigen RAG-systeem gebaseerd op Supabase pgvector. Kopieer deze sectie naar je `CLAUDE.md` bestand.

---

## 🔄 MIGRATIE INSTRUCTIE: Pinecone naar Supabase RAG

### Wanneer te gebruiken

Wanneer de gebruiker vraagt om:
- "Vervang Pinecone door Supabase RAG"
- "Implementeer eigen RAG met pgvector"
- "Migreer naar Supabase vector search"
- "Maak RAG goedkoper met Supabase"

### Waarom Supabase RAG?

| Aspect | Pinecone | Supabase RAG |
|--------|----------|--------------|
| Retrieval kosten | $5 per 1M tokens | $0 (gratis pgvector) |
| Embedding kosten | Inclusief | $0.02 per 1M tokens (OpenAI) |
| Vaste kosten | $0.05/uur | Supabase plan |
| Multi-tenant | Per assistant | Per `tenant_id` kolom |
| Vendor lock-in | Hoog | Laag (PostgreSQL) |

**Geschatte besparing: 80-95% bij >10K queries/maand**

---

## Implementatie Stappen

Voer deze stappen uit in volgorde. Gebruik de TodoWrite tool om voortgang bij te houden.

### Stap 1: Database Schema Aanmaken

**Bestand**: `lib/supabase/migrations/rag_schema.sql`

```sql
-- ================================================
-- SUPABASE RAG SCHEMA - Multi-Tenant Vector Search
-- ================================================

-- Enable pgvector extension (gratis in Supabase)
CREATE EXTENSION IF NOT EXISTS vector;

-- ================================================
-- DOCUMENTS TABLE
-- Bevat metadata over geüploade documenten
-- ================================================
CREATE TABLE IF NOT EXISTS documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id TEXT NOT NULL,
  filename TEXT NOT NULL,
  file_path TEXT,                    -- Pad in Supabase Storage
  file_size INTEGER,
  mime_type TEXT DEFAULT 'application/pdf',
  total_pages INTEGER,
  total_chunks INTEGER DEFAULT 0,
  processing_status TEXT DEFAULT 'pending', -- pending, processing, completed, failed
  processing_error TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index voor tenant isolatie
CREATE INDEX idx_documents_tenant ON documents(tenant_id);
CREATE INDEX idx_documents_status ON documents(processing_status);

-- ================================================
-- DOCUMENT CHUNKS TABLE
-- Bevat tekst chunks met embeddings voor vector search
-- ================================================
CREATE TABLE IF NOT EXISTS document_chunks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id TEXT NOT NULL,
  document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  content_length INTEGER GENERATED ALWAYS AS (LENGTH(content)) STORED,
  embedding VECTOR(1536),            -- OpenAI text-embedding-3-small dimensie
  page_number INTEGER,
  chunk_index INTEGER,               -- Volgorde binnen document
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Vector similarity index (IVFFlat voor snelheid)
-- Pas 'lists' aan op basis van data volume:
-- - < 10K chunks: lists = 100
-- - 10K-100K chunks: lists = 250
-- - > 100K chunks: lists = 500
CREATE INDEX idx_chunks_embedding ON document_chunks
  USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);

-- Tenant isolatie index
CREATE INDEX idx_chunks_tenant ON document_chunks(tenant_id);
CREATE INDEX idx_chunks_document ON document_chunks(document_id);

-- ================================================
-- VECTOR SEARCH FUNCTION
-- Zoekt relevante chunks voor een query embedding
-- ================================================
CREATE OR REPLACE FUNCTION search_documents(
  p_tenant_id TEXT,
  p_query_embedding VECTOR(1536),
  p_top_k INTEGER DEFAULT 3,
  p_similarity_threshold FLOAT DEFAULT 0.5
)
RETURNS TABLE (
  chunk_id UUID,
  document_id UUID,
  filename TEXT,
  content TEXT,
  page_number INTEGER,
  similarity FLOAT
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    dc.id AS chunk_id,
    dc.document_id,
    d.filename,
    dc.content,
    dc.page_number,
    1 - (dc.embedding <=> p_query_embedding) AS similarity
  FROM document_chunks dc
  JOIN documents d ON d.id = dc.document_id
  WHERE dc.tenant_id = p_tenant_id
    AND dc.embedding IS NOT NULL
    AND 1 - (dc.embedding <=> p_query_embedding) >= p_similarity_threshold
  ORDER BY dc.embedding <=> p_query_embedding
  LIMIT p_top_k;
END;
$$;

-- ================================================
-- HELPER FUNCTIONS
-- ================================================

-- Statistieken per tenant
CREATE OR REPLACE FUNCTION get_rag_stats(p_tenant_id TEXT)
RETURNS TABLE (
  total_documents BIGINT,
  total_chunks BIGINT,
  avg_chunk_length NUMERIC,
  last_document_added TIMESTAMPTZ
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    COUNT(DISTINCT d.id)::BIGINT,
    COUNT(dc.id)::BIGINT,
    ROUND(AVG(dc.content_length), 0),
    MAX(d.created_at)
  FROM documents d
  LEFT JOIN document_chunks dc ON dc.document_id = d.id
  WHERE d.tenant_id = p_tenant_id;
END;
$$;

-- Cleanup incomplete documents
CREATE OR REPLACE FUNCTION cleanup_failed_documents(p_tenant_id TEXT)
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM documents
  WHERE tenant_id = p_tenant_id
    AND processing_status = 'failed'
    AND created_at < NOW() - INTERVAL '24 hours';

  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;

-- ================================================
-- ROW LEVEL SECURITY (optioneel maar aanbevolen)
-- ================================================
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_chunks ENABLE ROW LEVEL SECURITY;

-- Policy: Alleen eigen tenant data zichtbaar
-- (Werkt alleen als je Supabase Auth gebruikt met tenant claims)
-- CREATE POLICY "Tenant isolation" ON documents
--   FOR ALL USING (tenant_id = current_setting('app.tenant_id', true));
-- CREATE POLICY "Tenant isolation" ON document_chunks
--   FOR ALL USING (tenant_id = current_setting('app.tenant_id', true));
```

### Stap 2: TypeScript Types

**Bestand**: `lib/rag/types.ts`

```typescript
/**
 * ========================================
 * SUPABASE RAG - Type Definitions
 * ========================================
 */

// Document metadata
export interface Document {
  id: string;
  tenant_id: string;
  filename: string;
  file_path?: string;
  file_size?: number;
  mime_type: string;
  total_pages?: number;
  total_chunks: number;
  processing_status: 'pending' | 'processing' | 'completed' | 'failed';
  processing_error?: string;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

// Chunk met embedding
export interface DocumentChunk {
  id: string;
  tenant_id: string;
  document_id: string;
  content: string;
  content_length: number;
  embedding?: number[];
  page_number?: number;
  chunk_index: number;
  metadata: Record<string, unknown>;
  created_at: string;
}

// Search result
export interface SearchResult {
  chunk_id: string;
  document_id: string;
  filename: string;
  content: string;
  page_number?: number;
  similarity: number;
}

// Context retrieval response (compatible met bestaande Pinecone interface)
export interface ContextSnippet {
  content: string;
  score: number;
  reference?: {
    file?: {
      name: string;
    };
    pages?: number[];
  };
}

export interface Citation {
  position: number;
  preview: string;
  references: Array<{
    pages: number[];
    file?: {
      name: string;
    };
  }>;
}

export interface ContextResponse {
  contextText: string;
  citations: Citation[];
  embeddingTokens: number;
  embeddingCost: number;
}

// Chunking options
export interface ChunkingOptions {
  chunkSize: number;        // Target chunk size in characters
  chunkOverlap: number;     // Overlap between chunks
  minChunkSize: number;     // Minimum chunk size
}

// Embedding model config
export interface EmbeddingConfig {
  model: 'text-embedding-3-small' | 'text-embedding-3-large';
  dimensions: number;
  costPer1MTokens: number;
}

export const EMBEDDING_MODELS: Record<string, EmbeddingConfig> = {
  'text-embedding-3-small': {
    model: 'text-embedding-3-small',
    dimensions: 1536,
    costPer1MTokens: 0.02
  },
  'text-embedding-3-large': {
    model: 'text-embedding-3-large',
    dimensions: 3072,
    costPer1MTokens: 0.13
  }
};
```

### Stap 3: Embedding Service

**Bestand**: `lib/rag/embeddings.ts`

```typescript
/**
 * ========================================
 * SUPABASE RAG - OpenAI Embeddings Service
 * ========================================
 *
 * Genereert vector embeddings via OpenAI API.
 * Kosten: $0.02 per 1M tokens (text-embedding-3-small)
 */

import OpenAI from 'openai';
import { EMBEDDING_MODELS, EmbeddingConfig } from './types';

// Default model configuratie
const DEFAULT_MODEL = 'text-embedding-3-small';

// OpenAI client (hergebruikt bestaande OPENAI_API_KEY)
let openaiClient: OpenAI | null = null;

function getOpenAIClient(): OpenAI {
  if (!openaiClient) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error('OPENAI_API_KEY is not configured');
    }
    openaiClient = new OpenAI({ apiKey });
  }
  return openaiClient;
}

/**
 * Genereert een embedding voor een enkele tekst
 */
export async function generateEmbedding(
  text: string,
  modelName: string = DEFAULT_MODEL
): Promise<{
  embedding: number[];
  tokens: number;
  cost: number;
}> {
  const config = EMBEDDING_MODELS[modelName];
  if (!config) {
    throw new Error(`Unknown embedding model: ${modelName}`);
  }

  const client = getOpenAIClient();

  console.log(`🔢 [Embeddings] Generating embedding for ${text.length} chars`);

  const response = await client.embeddings.create({
    model: config.model,
    input: text,
    dimensions: config.dimensions
  });

  const tokens = response.usage?.total_tokens || 0;
  const cost = (tokens / 1_000_000) * config.costPer1MTokens;

  console.log(`✅ [Embeddings] Generated: ${tokens} tokens, $${cost.toFixed(6)}`);

  return {
    embedding: response.data[0].embedding,
    tokens,
    cost
  };
}

/**
 * Genereert embeddings voor meerdere teksten (batch)
 * Efficiënter voor document processing
 */
export async function generateEmbeddingsBatch(
  texts: string[],
  modelName: string = DEFAULT_MODEL
): Promise<{
  embeddings: number[][];
  totalTokens: number;
  totalCost: number;
}> {
  const config = EMBEDDING_MODELS[modelName];
  if (!config) {
    throw new Error(`Unknown embedding model: ${modelName}`);
  }

  const client = getOpenAIClient();

  console.log(`🔢 [Embeddings] Batch processing ${texts.length} texts`);

  // OpenAI ondersteunt max 2048 inputs per request
  const BATCH_SIZE = 100;
  const embeddings: number[][] = [];
  let totalTokens = 0;

  for (let i = 0; i < texts.length; i += BATCH_SIZE) {
    const batch = texts.slice(i, i + BATCH_SIZE);

    const response = await client.embeddings.create({
      model: config.model,
      input: batch,
      dimensions: config.dimensions
    });

    totalTokens += response.usage?.total_tokens || 0;

    response.data.forEach(item => {
      embeddings.push(item.embedding);
    });

    console.log(`   Batch ${Math.floor(i / BATCH_SIZE) + 1}: ${batch.length} texts processed`);
  }

  const totalCost = (totalTokens / 1_000_000) * config.costPer1MTokens;

  console.log(`✅ [Embeddings] Batch complete: ${totalTokens} tokens, $${totalCost.toFixed(6)}`);

  return {
    embeddings,
    totalTokens,
    totalCost
  };
}

/**
 * Schat het aantal tokens in een tekst (voor cost estimation)
 */
export function estimateTokens(text: string): number {
  // Ruwe schatting: ~4 characters per token voor Engelse tekst
  // Nederlandse tekst is vaak iets langer per token
  return Math.ceil(text.length / 4);
}
```

### Stap 4: Document Chunking

**Bestand**: `lib/rag/chunking.ts`

```typescript
/**
 * ========================================
 * SUPABASE RAG - Document Chunking
 * ========================================
 *
 * Splitst documenten in chunks voor embedding.
 * Gebruikt semantic chunking met overlap.
 */

import { ChunkingOptions } from './types';

// Default chunking parameters
const DEFAULT_OPTIONS: ChunkingOptions = {
  chunkSize: 1000,      // ~250 tokens per chunk
  chunkOverlap: 200,    // 20% overlap voor context behoud
  minChunkSize: 100     // Minimum 25 tokens
};

export interface TextChunk {
  content: string;
  pageNumber?: number;
  chunkIndex: number;
  metadata: {
    startChar: number;
    endChar: number;
    wordCount: number;
  };
}

/**
 * Splitst tekst in semantische chunks
 *
 * Strategie:
 * 1. Probeer te splitsen op paragrafen
 * 2. Als paragraaf te lang is, splits op zinnen
 * 3. Als zin te lang is, splits op woorden met overlap
 */
export function chunkText(
  text: string,
  pageNumber?: number,
  options: Partial<ChunkingOptions> = {}
): TextChunk[] {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const chunks: TextChunk[] = [];

  // Normaliseer whitespace
  const normalizedText = text.replace(/\s+/g, ' ').trim();

  if (normalizedText.length === 0) {
    return [];
  }

  // Als tekst kort genoeg is, return als enkele chunk
  if (normalizedText.length <= opts.chunkSize) {
    return [{
      content: normalizedText,
      pageNumber,
      chunkIndex: 0,
      metadata: {
        startChar: 0,
        endChar: normalizedText.length,
        wordCount: normalizedText.split(/\s+/).length
      }
    }];
  }

  // Split op paragrafen (dubbele newline of meerdere newlines)
  const paragraphs = text.split(/\n\s*\n/).map(p => p.trim()).filter(p => p.length > 0);

  let currentChunk = '';
  let chunkStartChar = 0;
  let currentPosition = 0;

  for (const paragraph of paragraphs) {
    // Als huidige chunk + nieuwe paragraaf past, voeg toe
    if (currentChunk.length + paragraph.length + 1 <= opts.chunkSize) {
      currentChunk = currentChunk ? `${currentChunk}\n\n${paragraph}` : paragraph;
    } else {
      // Sla huidige chunk op als die groot genoeg is
      if (currentChunk.length >= opts.minChunkSize) {
        chunks.push(createChunk(currentChunk, pageNumber, chunks.length, chunkStartChar));
      }

      // Start nieuwe chunk
      // Als paragraaf zelf te lang is, splits verder
      if (paragraph.length > opts.chunkSize) {
        const subChunks = splitLongParagraph(paragraph, opts);
        subChunks.forEach((subChunk, idx) => {
          chunks.push(createChunk(
            subChunk,
            pageNumber,
            chunks.length,
            currentPosition + (idx * (opts.chunkSize - opts.chunkOverlap))
          ));
        });
        currentChunk = '';
      } else {
        currentChunk = paragraph;
        chunkStartChar = currentPosition;
      }
    }

    currentPosition += paragraph.length + 2; // +2 voor \n\n
  }

  // Laatste chunk opslaan
  if (currentChunk.length >= opts.minChunkSize) {
    chunks.push(createChunk(currentChunk, pageNumber, chunks.length, chunkStartChar));
  }

  console.log(`📄 [Chunking] Created ${chunks.length} chunks from ${text.length} chars`);

  return chunks;
}

/**
 * Splitst een lange paragraaf in kleinere stukken
 */
function splitLongParagraph(text: string, opts: ChunkingOptions): string[] {
  const chunks: string[] = [];
  const sentences = text.match(/[^.!?]+[.!?]+/g) || [text];

  let currentChunk = '';

  for (const sentence of sentences) {
    if (currentChunk.length + sentence.length <= opts.chunkSize) {
      currentChunk += sentence;
    } else {
      if (currentChunk.length > 0) {
        chunks.push(currentChunk.trim());
      }

      // Als enkele zin te lang is, forceer splits met overlap
      if (sentence.length > opts.chunkSize) {
        const words = sentence.split(/\s+/);
        let wordChunk = '';

        for (const word of words) {
          if (wordChunk.length + word.length + 1 <= opts.chunkSize) {
            wordChunk = wordChunk ? `${wordChunk} ${word}` : word;
          } else {
            if (wordChunk.length > 0) {
              chunks.push(wordChunk);
            }
            wordChunk = word;
          }
        }

        if (wordChunk.length > 0) {
          currentChunk = wordChunk;
        }
      } else {
        currentChunk = sentence;
      }
    }
  }

  if (currentChunk.length > 0) {
    chunks.push(currentChunk.trim());
  }

  return chunks;
}

function createChunk(
  content: string,
  pageNumber: number | undefined,
  index: number,
  startChar: number
): TextChunk {
  return {
    content: content.trim(),
    pageNumber,
    chunkIndex: index,
    metadata: {
      startChar,
      endChar: startChar + content.length,
      wordCount: content.split(/\s+/).length
    }
  };
}

/**
 * Chunked een heel document met meerdere pagina's
 */
export function chunkDocument(
  pages: Array<{ pageNumber: number; text: string }>,
  options: Partial<ChunkingOptions> = {}
): TextChunk[] {
  const allChunks: TextChunk[] = [];

  for (const page of pages) {
    const pageChunks = chunkText(page.text, page.pageNumber, options);

    // Hernummer chunk indices voor globale volgorde
    pageChunks.forEach(chunk => {
      chunk.chunkIndex = allChunks.length;
      allChunks.push(chunk);
    });
  }

  console.log(`📚 [Chunking] Document: ${pages.length} pages → ${allChunks.length} chunks`);

  return allChunks;
}
```

### Stap 5: Context Retrieval (Vervangt Pinecone)

**Bestand**: `lib/rag/context.ts`

```typescript
/**
 * ========================================
 * SUPABASE RAG - Context Retrieval
 * ========================================
 *
 * Drop-in replacement voor lib/pinecone.ts
 * Gebruikt Supabase pgvector voor vector search.
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { generateEmbedding } from './embeddings';
import {
  ContextSnippet,
  Citation,
  ContextResponse,
  SearchResult
} from './types';

// Supabase client singleton
let supabaseClient: SupabaseClient | null = null;

function getSupabaseClient(): SupabaseClient {
  if (!supabaseClient) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!url || !key) {
      throw new Error('Supabase configuration missing (URL or SERVICE_ROLE_KEY)');
    }

    supabaseClient = createClient(url, key);
  }
  return supabaseClient;
}

/**
 * Haalt de eerste 3 en laatste 3 woorden uit een tekst als preview
 */
export function extractSnippetPreview(text: string): string {
  if (!text) return '';

  const cleaned = text.trim().replace(/\s+/g, ' ');
  const words = cleaned.split(' ');

  if (words.length <= 6) {
    return cleaned;
  }

  const firstThree = words.slice(0, 3).join(' ');
  const lastThree = words.slice(-3).join(' ');

  return `${firstThree} ... ${lastThree}`;
}

/**
 * Haalt relevante context op uit de document database
 *
 * Drop-in replacement voor Pinecone's retrieveContext()
 *
 * @param tenantId - Tenant identifier voor multi-tenant isolatie
 * @param userQuestion - De vraag van de gebruiker
 * @param topK - Aantal resultaten (default: 3)
 * @returns Object met contextText, citations en cost info
 */
export async function retrieveContext(
  tenantId: string,
  userQuestion: string,
  topK: number = 3
): Promise<ContextResponse> {
  const supabase = getSupabaseClient();

  console.log('\n📚 [RAG] ========== FETCHING CONTEXT ==========');
  console.log('🔍 [RAG] Query:', userQuestion);
  console.log('🏢 [RAG] Tenant:', tenantId);
  console.log('⚙️  [RAG] Settings: topK=' + topK);

  // 1. Genereer embedding voor de vraag
  console.log('\n🔢 [RAG] Generating query embedding...');
  const { embedding, tokens: embeddingTokens, cost: embeddingCost } =
    await generateEmbedding(userQuestion);

  console.log(`✅ [RAG] Query embedding: ${embeddingTokens} tokens, $${embeddingCost.toFixed(6)}`);

  // 2. Zoek in de vector database
  console.log('\n🔎 [RAG] Searching documents...');

  const { data: results, error } = await supabase.rpc('search_documents', {
    p_tenant_id: tenantId,
    p_query_embedding: `[${embedding.join(',')}]`,
    p_top_k: topK,
    p_similarity_threshold: 0.5
  });

  if (error) {
    console.error('❌ [RAG] Search error:', error);
    throw new Error(`RAG search failed: ${error.message}`);
  }

  const searchResults = (results || []) as SearchResult[];
  console.log('✅ [RAG] Found', searchResults.length, 'relevant chunks');

  // 3. Bouw context en citations
  let contextText = '';
  const citations: Citation[] = [];

  if (searchResults.length > 0) {
    console.log('\n📄 [RAG] ========== SEARCH RESULTS ==========');

    searchResults.forEach((result, idx) => {
      console.log(`📄 [RAG] Result ${idx + 1}:`);
      console.log(`   - Similarity: ${(result.similarity * 100).toFixed(1)}%`);
      console.log(`   - Source: ${result.filename}`);
      console.log(`   - Page: ${result.page_number || 'N/A'}`);
      console.log(`   - Length: ${result.content.length} chars`);

      // Voeg toe aan citations
      citations.push({
        position: idx,
        preview: extractSnippetPreview(result.content),
        references: [{
          pages: result.page_number ? [result.page_number] : [],
          file: { name: result.filename }
        }]
      });
    });

    // Bouw context string (zelfde formaat als Pinecone)
    contextText = searchResults.map((result, idx) => {
      return `[Document ${idx + 1}]\n${result.content}\n`;
    }).join('\n');
  }

  console.log('\n📊 [RAG] ========== CONTEXT SUMMARY ==========');
  console.log('📄 [RAG] Total context characters:', contextText.length);
  console.log('💵 [RAG] Embedding cost: $' + embeddingCost.toFixed(6));
  console.log('💵 [RAG] Search cost: $0.000000 (pgvector is free)');

  return {
    contextText,
    citations,
    embeddingTokens,
    embeddingCost
  };
}

/**
 * Hulpfunctie om te checken of RAG beschikbaar is
 */
export async function checkRAGHealth(tenantId: string): Promise<{
  healthy: boolean;
  documentCount: number;
  chunkCount: number;
  error?: string;
}> {
  try {
    const supabase = getSupabaseClient();

    const { data, error } = await supabase.rpc('get_rag_stats', {
      p_tenant_id: tenantId
    });

    if (error) throw error;

    const stats = data?.[0] || { total_documents: 0, total_chunks: 0 };

    return {
      healthy: true,
      documentCount: Number(stats.total_documents),
      chunkCount: Number(stats.total_chunks)
    };
  } catch (err) {
    return {
      healthy: false,
      documentCount: 0,
      chunkCount: 0,
      error: err instanceof Error ? err.message : 'Unknown error'
    };
  }
}
```

### Stap 6: Document Processor (Upload & Indexing)

**Bestand**: `lib/rag/processor.ts`

```typescript
/**
 * ========================================
 * SUPABASE RAG - Document Processor
 * ========================================
 *
 * Verwerkt PDF uploads:
 * 1. Extraheert tekst per pagina
 * 2. Chunked de content
 * 3. Genereert embeddings
 * 4. Slaat op in Supabase
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { chunkDocument, TextChunk } from './chunking';
import { generateEmbeddingsBatch } from './embeddings';
import { Document, DocumentChunk } from './types';

// PDF parsing (install: npm install pdf-parse)
// @ts-ignore - pdf-parse types
import pdf from 'pdf-parse';

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

export interface ProcessingResult {
  success: boolean;
  documentId?: string;
  chunksCreated: number;
  totalTokens: number;
  totalCost: number;
  error?: string;
}

/**
 * Verwerkt een PDF bestand en indexeert het in de RAG database
 */
export async function processDocument(
  tenantId: string,
  filename: string,
  fileBuffer: Buffer,
  filePath?: string
): Promise<ProcessingResult> {
  const supabase = getSupabaseClient();

  console.log('\n📄 [Processor] ========== PROCESSING DOCUMENT ==========');
  console.log('📁 [Processor] File:', filename);
  console.log('🏢 [Processor] Tenant:', tenantId);
  console.log('📦 [Processor] Size:', (fileBuffer.length / 1024).toFixed(1), 'KB');

  let documentId: string | undefined;

  try {
    // 1. Maak document record aan
    const { data: doc, error: docError } = await supabase
      .from('documents')
      .insert({
        tenant_id: tenantId,
        filename,
        file_path: filePath,
        file_size: fileBuffer.length,
        processing_status: 'processing'
      })
      .select()
      .single();

    if (docError) throw docError;
    documentId = doc.id;

    console.log('✅ [Processor] Document record created:', documentId);

    // 2. Parse PDF
    console.log('\n📖 [Processor] Parsing PDF...');
    const pdfData = await pdf(fileBuffer);

    // Extracteer tekst per pagina
    // pdf-parse geeft alleen volledige tekst, we moeten per pagina splitsen
    // Dit is een vereenvoudigde versie - voor productie gebruik pdf.js of pdf2json
    const pages = extractPagesFromPDF(pdfData);

    console.log(`✅ [Processor] Extracted ${pages.length} pages`);

    // 3. Chunk de content
    console.log('\n✂️  [Processor] Chunking content...');
    const chunks = chunkDocument(pages);

    if (chunks.length === 0) {
      throw new Error('No content could be extracted from PDF');
    }

    console.log(`✅ [Processor] Created ${chunks.length} chunks`);

    // 4. Genereer embeddings
    console.log('\n🔢 [Processor] Generating embeddings...');
    const { embeddings, totalTokens, totalCost } = await generateEmbeddingsBatch(
      chunks.map(c => c.content)
    );

    // 5. Sla chunks op in database
    console.log('\n💾 [Processor] Saving to database...');
    const chunkRecords = chunks.map((chunk, idx) => ({
      tenant_id: tenantId,
      document_id: documentId,
      content: chunk.content,
      embedding: `[${embeddings[idx].join(',')}]`,
      page_number: chunk.pageNumber,
      chunk_index: chunk.chunkIndex,
      metadata: chunk.metadata
    }));

    // Insert in batches van 100
    const BATCH_SIZE = 100;
    for (let i = 0; i < chunkRecords.length; i += BATCH_SIZE) {
      const batch = chunkRecords.slice(i, i + BATCH_SIZE);
      const { error: insertError } = await supabase
        .from('document_chunks')
        .insert(batch);

      if (insertError) throw insertError;

      console.log(`   Saved batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(chunkRecords.length / BATCH_SIZE)}`);
    }

    // 6. Update document status
    await supabase
      .from('documents')
      .update({
        total_pages: pages.length,
        total_chunks: chunks.length,
        processing_status: 'completed'
      })
      .eq('id', documentId);

    console.log('\n✅ [Processor] ========== PROCESSING COMPLETE ==========');
    console.log('📄 [Processor] Document ID:', documentId);
    console.log('📊 [Processor] Chunks created:', chunks.length);
    console.log('🔢 [Processor] Tokens used:', totalTokens);
    console.log('💵 [Processor] Total cost: $' + totalCost.toFixed(4));

    return {
      success: true,
      documentId,
      chunksCreated: chunks.length,
      totalTokens,
      totalCost
    };

  } catch (error) {
    console.error('❌ [Processor] Processing failed:', error);

    // Update document status to failed
    if (documentId) {
      await supabase
        .from('documents')
        .update({
          processing_status: 'failed',
          processing_error: error instanceof Error ? error.message : 'Unknown error'
        })
        .eq('id', documentId);
    }

    return {
      success: false,
      documentId,
      chunksCreated: 0,
      totalTokens: 0,
      totalCost: 0,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Verwijdert een document en alle chunks
 */
export async function deleteDocument(
  tenantId: string,
  documentId: string
): Promise<boolean> {
  const supabase = getSupabaseClient();

  const { error } = await supabase
    .from('documents')
    .delete()
    .eq('id', documentId)
    .eq('tenant_id', tenantId);

  if (error) {
    console.error('❌ [Processor] Delete failed:', error);
    return false;
  }

  console.log('✅ [Processor] Document deleted:', documentId);
  return true;
}

/**
 * Hulpfunctie om pagina's uit PDF te extraheren
 *
 * Note: pdf-parse geeft alleen volledige tekst.
 * Voor echte pagina-extractie gebruik pdf.js of pdf2json.
 */
function extractPagesFromPDF(pdfData: any): Array<{ pageNumber: number; text: string }> {
  // Vereenvoudigde versie - splitst op form feed of meerdere newlines
  const text = pdfData.text || '';
  const pageBreaks = text.split(/\f|\n{4,}/);

  return pageBreaks
    .map((pageText: string, idx: number) => ({
      pageNumber: idx + 1,
      text: pageText.trim()
    }))
    .filter((page: { text: string }) => page.text.length > 0);
}

/**
 * Lijst alle documenten voor een tenant
 */
export async function listDocuments(tenantId: string): Promise<Document[]> {
  const supabase = getSupabaseClient();

  const { data, error } = await supabase
    .from('documents')
    .select('*')
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('❌ [Processor] List failed:', error);
    return [];
  }

  return data || [];
}
```

### Stap 7: API Routes

**Bestand**: `app/api/rag/upload/route.ts`

```typescript
/**
 * POST /api/rag/upload
 * Upload een PDF document voor RAG indexering
 */

import { NextRequest, NextResponse } from 'next/server';
import { processDocument } from '@/lib/rag/processor';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const tenantId = formData.get('tenant_id') as string;

    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      );
    }

    if (!tenantId) {
      return NextResponse.json(
        { error: 'tenant_id is required' },
        { status: 400 }
      );
    }

    // Valideer file type
    if (!file.name.endsWith('.pdf')) {
      return NextResponse.json(
        { error: 'Only PDF files are supported' },
        { status: 400 }
      );
    }

    // Converteer naar Buffer
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Verwerk document
    const result = await processDocument(tenantId, file.name, buffer);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      documentId: result.documentId,
      chunksCreated: result.chunksCreated,
      cost: result.totalCost
    });

  } catch (error) {
    console.error('Upload error:', error);
    return NextResponse.json(
      { error: 'Upload failed' },
      { status: 500 }
    );
  }
}
```

**Bestand**: `app/api/rag/documents/route.ts`

```typescript
/**
 * GET /api/rag/documents - Lijst documenten
 * DELETE /api/rag/documents?id=xxx - Verwijder document
 */

import { NextRequest, NextResponse } from 'next/server';
import { listDocuments, deleteDocument } from '@/lib/rag/processor';

export async function GET(request: NextRequest) {
  const tenantId = request.nextUrl.searchParams.get('tenant_id');

  if (!tenantId) {
    return NextResponse.json(
      { error: 'tenant_id is required' },
      { status: 400 }
    );
  }

  const documents = await listDocuments(tenantId);
  return NextResponse.json({ documents });
}

export async function DELETE(request: NextRequest) {
  const tenantId = request.nextUrl.searchParams.get('tenant_id');
  const documentId = request.nextUrl.searchParams.get('id');

  if (!tenantId || !documentId) {
    return NextResponse.json(
      { error: 'tenant_id and id are required' },
      { status: 400 }
    );
  }

  const success = await deleteDocument(tenantId, documentId);

  if (!success) {
    return NextResponse.json(
      { error: 'Delete failed' },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true });
}
```

### Stap 8: Update Chat Route

**Wijziging in**: `app/api/chat/route.ts`

Vervang de Pinecone import en retrieval door:

```typescript
// VOOR (Pinecone):
// import { initializePinecone, retrieveContext } from '@/lib/pinecone';

// NA (Supabase RAG):
import { retrieveContext } from '@/lib/rag/context';

// In de POST handler, vervang:
// const pineconeClient = initializePinecone(process.env.PINECONE_API_KEY!);
// const { contextText, citations, pineconeTokens, pineconeCost } = await retrieveContext(
//   process.env.PINECONE_ASSISTANT_NAME!,
//   pineconeClient,
//   message
// );

// Door:
const tenantId = process.env.TENANT_ID!;
const { contextText, citations, embeddingTokens, embeddingCost } = await retrieveContext(
  tenantId,
  message
);

// Update cost variabelen:
// pineconeCost → embeddingCost
// pineconeTokens → embeddingTokens
```

### Stap 9: Environment Variables

**Voeg toe aan `.env.example`**:

```bash
# ================================================
# SUPABASE RAG (vervangt Pinecone)
# ================================================

# Supabase is nu REQUIRED (niet optional) voor RAG
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ...

# Tenant identificatie (gebruikt voor RAG isolatie)
TENANT_ID=acme-corp

# OpenAI blijft nodig voor embeddings en chat
OPENAI_API_KEY=sk-...

# Pinecone is DEPRECATED - verwijder deze na migratie:
# PINECONE_API_KEY=pcsk_...
# PINECONE_ASSISTANT_NAME=...
```

### Stap 10: Package Dependencies

**Voer uit**:

```bash
npm install pdf-parse
npm uninstall @pinecone-database/pinecone  # Optioneel na migratie
```

---

## Validatie & Testing

Na implementatie, test met:

```bash
# 1. Run migrations in Supabase SQL Editor
# 2. Start dev server
npm run dev

# 3. Upload een test document
curl -X POST http://localhost:3000/api/rag/upload \
  -F "file=@test.pdf" \
  -F "tenant_id=test-tenant"

# 4. Check document lijst
curl "http://localhost:3000/api/rag/documents?tenant_id=test-tenant"

# 5. Test chat
curl -X POST http://localhost:3000/api/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "Wat is het verlofbeleid?", "language": "nl"}'
```

---

## Migratie Checklist

Wanneer Claude Code deze migratie uitvoert, gebruik TodoWrite:

- [ ] Database schema aanmaken (migration uitvoeren)
- [ ] lib/rag/types.ts aanmaken
- [ ] lib/rag/embeddings.ts aanmaken
- [ ] lib/rag/chunking.ts aanmaken
- [ ] lib/rag/context.ts aanmaken
- [ ] lib/rag/processor.ts aanmaken
- [ ] API routes aanmaken (upload, documents)
- [ ] app/api/chat/route.ts updaten
- [ ] pdf-parse installeren
- [ ] .env.example updaten
- [ ] Test upload uitvoeren
- [ ] Test chat uitvoeren
- [ ] Pinecone code verwijderen (optioneel)
- [ ] Documentatie updaten

---

## Kostenvergelijking Log

Na elke chat request, log:

```
💰 [RAG] ========== COST COMPARISON ==========
📊 [RAG] This request:
   - Embedding: $0.000020 (1000 tokens)
   - Search: $0.000000 (pgvector free)
   - Total RAG: $0.000020

📊 [RAG] If using Pinecone:
   - Context: $0.005000 (1000 tokens @ $5/1M)
   - Savings: $0.004980 (99.6%)
```
