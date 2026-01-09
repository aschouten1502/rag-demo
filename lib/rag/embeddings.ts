/**
 * ========================================
 * SUPABASE RAG - OpenAI Embeddings Service
 * ========================================
 *
 * Genereert vector embeddings via OpenAI API.
 *
 * Kosten:
 * - text-embedding-3-small: $0.02 per 1M tokens
 * - text-embedding-3-large: $0.13 per 1M tokens
 *
 * Vergelijk met Pinecone: $5 per 1M tokens
 * Besparing: ~99%
 */

import OpenAI from 'openai';
import { EMBEDDING_MODELS, DEFAULT_EMBEDDING_MODEL, EmbeddingConfig } from './types';

// ========================================
// OPENAI CLIENT
// ========================================

let openaiClient: OpenAI | null = null;

/**
 * Krijg of maak de OpenAI client
 * Hergebruikt de bestaande OPENAI_API_KEY uit de environment
 */
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

// ========================================
// SINGLE EMBEDDING
// ========================================

/**
 * Genereert een embedding voor een enkele tekst
 *
 * @param text - De tekst om te embedden
 * @param modelName - Het embedding model (default: text-embedding-3-small)
 * @returns Object met embedding vector, tokens en kosten
 */
export async function generateEmbedding(
  text: string,
  modelName: string = DEFAULT_EMBEDDING_MODEL
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

// ========================================
// BATCH EMBEDDINGS
// ========================================

/**
 * Genereert embeddings voor meerdere teksten in batch
 * Efficiënter voor document processing
 *
 * @param texts - Array van teksten om te embedden
 * @param modelName - Het embedding model (default: text-embedding-3-small)
 * @returns Object met embedding vectors, totale tokens en kosten
 */
export async function generateEmbeddingsBatch(
  texts: string[],
  modelName: string = DEFAULT_EMBEDDING_MODEL
): Promise<{
  embeddings: number[][];
  totalTokens: number;
  totalCost: number;
}> {
  const config = EMBEDDING_MODELS[modelName];
  if (!config) {
    throw new Error(`Unknown embedding model: ${modelName}`);
  }

  if (texts.length === 0) {
    return {
      embeddings: [],
      totalTokens: 0,
      totalCost: 0
    };
  }

  const client = getOpenAIClient();

  console.log(`🔢 [Embeddings] Batch processing ${texts.length} texts`);

  // OpenAI ondersteunt max 2048 inputs per request
  // We gebruiken kleinere batches voor stabiliteit
  const BATCH_SIZE = 100;
  const embeddings: number[][] = [];
  let totalTokens = 0;

  for (let i = 0; i < texts.length; i += BATCH_SIZE) {
    const batch = texts.slice(i, i + BATCH_SIZE);
    const batchNumber = Math.floor(i / BATCH_SIZE) + 1;
    const totalBatches = Math.ceil(texts.length / BATCH_SIZE);

    console.log(`   Batch ${batchNumber}/${totalBatches}: ${batch.length} texts`);

    const response = await client.embeddings.create({
      model: config.model,
      input: batch,
      dimensions: config.dimensions
    });

    totalTokens += response.usage?.total_tokens || 0;

    // Voeg embeddings toe in dezelfde volgorde als input
    response.data
      .sort((a, b) => a.index - b.index)
      .forEach(item => {
        embeddings.push(item.embedding);
      });
  }

  const totalCost = (totalTokens / 1_000_000) * config.costPer1MTokens;

  console.log(`✅ [Embeddings] Batch complete: ${totalTokens} tokens, $${totalCost.toFixed(6)}`);

  return {
    embeddings,
    totalTokens,
    totalCost
  };
}

// ========================================
// UTILITY FUNCTIONS
// ========================================

/**
 * Schat het aantal tokens in een tekst (voor cost estimation)
 *
 * @param text - De tekst om te schatten
 * @returns Geschat aantal tokens
 */
export function estimateTokens(text: string): number {
  // Ruwe schatting: ~4 characters per token voor Engelse tekst
  // Nederlandse tekst is vaak iets langer per token (~3.5 chars)
  return Math.ceil(text.length / 4);
}

/**
 * Schat de kosten voor het embedden van tekst
 *
 * @param text - De tekst om te embedden
 * @param modelName - Het embedding model
 * @returns Geschatte kosten in USD
 */
export function estimateEmbeddingCost(
  text: string,
  modelName: string = DEFAULT_EMBEDDING_MODEL
): number {
  const config = EMBEDDING_MODELS[modelName];
  if (!config) {
    throw new Error(`Unknown embedding model: ${modelName}`);
  }

  const estimatedTokens = estimateTokens(text);
  return (estimatedTokens / 1_000_000) * config.costPer1MTokens;
}

/**
 * Krijg de configuratie van een embedding model
 *
 * @param modelName - De naam van het model
 * @returns Model configuratie of undefined
 */
export function getModelConfig(modelName: string): EmbeddingConfig | undefined {
  return EMBEDDING_MODELS[modelName];
}
