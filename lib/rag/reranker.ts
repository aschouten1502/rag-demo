/**
 * ========================================
 * COHERE RERANKER - Search Result Reranking
 * ========================================
 *
 * Gebruikt Cohere's rerank-v3.5 model om zoekresultaten
 * te herordenen op basis van relevantie.
 *
 * Dit is de grootste kwaliteitsboost voor RAG:
 * - Vector search geeft "semantisch vergelijkbaar"
 * - Reranker geeft "beste antwoord op de vraag"
 *
 * Kosten: $1 per 1000 searches (~$0.001 per query)
 * Model: rerank-v3.5 (multilingual, beste voor Nederlands)
 */

import { SearchResult } from './types';

// ========================================
// TYPES
// ========================================

export interface RerankResult {
  results: SearchResult[];
  scores: number[];
  cost: number;
  latencyMs: number;
}

/**
 * Extended rerank result with position tracking (for logging)
 */
export interface RerankResultWithPositions extends RerankResult {
  // Position tracking is done in context.ts, but we ensure latencyMs is available
}

interface CohereRerankResponse {
  id: string;
  results: Array<{
    index: number;
    relevance_score: number;
  }>;
  meta?: {
    billed_units?: {
      search_units?: number;
    };
  };
}

// ========================================
// CONFIGURATION
// ========================================

const COHERE_API_URL = 'https://api.cohere.com/v2/rerank';
const COHERE_MODEL = 'rerank-v3.5';

// Kosten per 1000 searches
const COST_PER_1000_SEARCHES = 1.0; // $1.00

// ========================================
// MAIN RERANK FUNCTION
// ========================================

/**
 * Herordent zoekresultaten met Cohere Rerank
 *
 * @param query - De originele zoekvraag
 * @param documents - De zoekresultaten om te reranken
 * @param topN - Aantal resultaten om terug te geven (default: 8)
 * @returns Gererankte resultaten met scores en kosten
 */
export async function rerankResults(
  query: string,
  documents: SearchResult[],
  topN: number = 8
): Promise<RerankResult> {
  const startTime = Date.now();

  // Check API key
  const apiKey = process.env.COHERE_API_KEY;
  if (!apiKey) {
    console.warn('⚠️ [Reranker] COHERE_API_KEY not set, using fallback ranking');
    return fallbackRanking(documents, topN, startTime);
  }

  // Skip reranking als te weinig documenten
  if (documents.length <= topN) {
    console.log(`ℹ️ [Reranker] Only ${documents.length} docs, skipping rerank`);
    return {
      results: documents,
      scores: documents.map(d => d.similarity),
      cost: 0,
      latencyMs: Date.now() - startTime
    };
  }

  console.log('\n🔄 [Reranker] ========== RERANKING ==========');
  console.log(`📝 [Reranker] Query: "${query.substring(0, 50)}..."`);
  console.log(`📄 [Reranker] Input: ${documents.length} docs → Top ${topN}`);

  try {
    // Prepare documents for Cohere API
    const docTexts = documents.map(doc => doc.content);

    const response = await fetch(COHERE_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: COHERE_MODEL,
        query: query,
        documents: docTexts,
        top_n: topN,
        return_documents: false // We hebben de originele docs al
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ [Reranker] API error: ${response.status} - ${errorText}`);
      return fallbackRanking(documents, topN, startTime);
    }

    const data: CohereRerankResponse = await response.json();

    // Map reranked indices terug naar originele documenten
    const rerankedResults: SearchResult[] = [];
    const scores: number[] = [];

    for (const result of data.results) {
      const originalDoc = documents[result.index];
      rerankedResults.push({
        ...originalDoc,
        similarity: result.relevance_score // Gebruik rerank score
      });
      scores.push(result.relevance_score);
    }

    // Calculate cost
    const searchUnits = data.meta?.billed_units?.search_units || 1;
    const cost = (searchUnits / 1000) * COST_PER_1000_SEARCHES;
    const latencyMs = Date.now() - startTime;

    // Log results
    console.log('\n✅ [Reranker] ========== RERANK COMPLETE ==========');
    console.log(`📊 [Reranker] Reranked ${data.results.length} results`);
    console.log(`⏱️  [Reranker] Latency: ${latencyMs}ms`);
    console.log(`💰 [Reranker] Cost: $${cost.toFixed(6)}`);

    // Log top 3 voor debugging
    console.log('\n🏆 [Reranker] Top 3 reranked results:');
    rerankedResults.slice(0, 3).forEach((doc, idx) => {
      console.log(`   ${idx + 1}. [${(doc.similarity * 100).toFixed(1)}%] ${doc.filename}`);
    });

    return {
      results: rerankedResults,
      scores,
      cost,
      latencyMs
    };

  } catch (error) {
    console.error('❌ [Reranker] Error during reranking:', error);
    return fallbackRanking(documents, topN, startTime);
  }
}

// ========================================
// FALLBACK RANKING
// ========================================

/**
 * Fallback ranking als Cohere niet beschikbaar is
 * Gebruikt originele similarity scores
 */
function fallbackRanking(
  documents: SearchResult[],
  topN: number,
  startTime: number
): RerankResult {
  console.log('⚠️ [Reranker] Using fallback (original similarity scores)');

  // Sorteer op originele similarity
  const sorted = [...documents].sort((a, b) => b.similarity - a.similarity);
  const topResults = sorted.slice(0, topN);

  return {
    results: topResults,
    scores: topResults.map(d => d.similarity),
    cost: 0,
    latencyMs: Date.now() - startTime
  };
}

// ========================================
// UTILITY FUNCTIONS
// ========================================

/**
 * Check of reranking is ingeschakeld
 */
export function isRerankingEnabled(): boolean {
  return !!process.env.COHERE_API_KEY;
}

/**
 * Schat de kosten voor een rerank operatie
 */
export function estimateRerankCost(numDocuments: number): number {
  // Elke rerank = 1 search unit
  return COST_PER_1000_SEARCHES / 1000;
}

// ========================================
// EXPORTS
// ========================================

export { COHERE_MODEL, COST_PER_1000_SEARCHES };
