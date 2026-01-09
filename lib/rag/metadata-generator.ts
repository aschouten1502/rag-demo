/**
 * ========================================
 * AI METADATA GENERATOR
 * ========================================
 *
 * Genereert enhanced metadata voor document chunks:
 * - summary: Korte samenvatting
 * - keywords: Belangrijke termen
 * - topics: HR-categorieën
 * - alternativeTerms: Synoniemen en informele varianten
 *
 * Dit verbetert de zoekprestaties door informele queries
 * te matchen met formele documenttekst.
 */

import OpenAI from 'openai';
import { EnhancedChunkMetadata } from './types';

// ========================================
// TYPES
// ========================================

export interface MetadataGenerationResult {
  metadata: EnhancedChunkMetadata;
  inputTokens: number;
  outputTokens: number;
  cost: number;
}

export interface BatchMetadataResult {
  results: Map<number, EnhancedChunkMetadata>;
  totalCost: number;
  totalTokens: number;
}

// ========================================
// CONSTANTS
// ========================================

// GPT-4o-mini pricing (goedkoop voor metadata generatie)
const MODEL = 'gpt-4o-mini';
const INPUT_COST_PER_1M = 0.15;   // $0.15 per 1M input tokens
const OUTPUT_COST_PER_1M = 0.60;  // $0.60 per 1M output tokens

// HR-gerelateerde topics voor categorisatie
const HR_TOPICS = [
  'salaris',
  'verlof',
  'vakantie',
  'ziekte',
  'pensioen',
  'contract',
  'bonus',
  'uitkering',
  'cao',
  'arbeidsvoorwaarden',
  'lease',
  'thuiswerken',
  'onboarding',
  'ontslag',
  'verzekering',
  'training',
  'werktijden',
  'overwerk',
  'zwangerschap',
  'ouderschapsverlof'
];

// ========================================
// OPENAI CLIENT
// ========================================

let openaiClient: OpenAI | null = null;

function getOpenAIClient(): OpenAI {
  if (!openaiClient) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error('OPENAI_API_KEY environment variable is not set');
    }
    openaiClient = new OpenAI({ apiKey });
  }
  return openaiClient;
}

// ========================================
// METADATA GENERATION
// ========================================

/**
 * Genereert enhanced metadata voor een enkele chunk
 *
 * @param chunkContent - De tekst van de chunk
 * @param documentContext - Optionele context (bijv. documentnaam)
 * @returns Metadata met summary, keywords, topics, alternativeTerms
 */
export async function generateChunkMetadata(
  chunkContent: string,
  documentContext?: string
): Promise<MetadataGenerationResult> {
  const client = getOpenAIClient();

  const systemPrompt = `Je bent een HR-documentatie specialist. Analyseer de gegeven tekst en genereer metadata.

BELANGRIJKE REGELS:
1. Genereer een korte samenvatting (1-2 zinnen) in het Nederlands
2. Extract 3-7 belangrijke keywords (exacte termen uit de tekst)
3. Categoriseer in relevante HR topics uit deze lijst: ${HR_TOPICS.join(', ')}
4. Genereer 3-10 alternatieve termen/synoniemen die mensen zouden gebruiken om deze informatie te zoeken
   - Denk aan informele taal: "geld krijgen" voor "salaris", "1% regeling" voor "eenmalige bruto uitkering"
   - Denk aan afkortingen en variaties
   - Denk aan vragen die mensen zouden stellen

OUTPUT FORMAT (JSON):
{
  "summary": "string",
  "keywords": ["string"],
  "topics": ["string"],
  "alternativeTerms": ["string"]
}`;

  const userPrompt = `${documentContext ? `DOCUMENT: ${documentContext}\n\n` : ''}TEKST OM TE ANALYSEREN:
${chunkContent}`;

  try {
    const response = await client.chat.completions.create({
      model: MODEL,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.3,  // Lage temperature voor consistente output
      response_format: { type: 'json_object' }
    });

    const content = response.choices[0].message.content || '{}';
    const parsed = JSON.parse(content);

    // Token usage en kosten
    const inputTokens = response.usage?.prompt_tokens || 0;
    const outputTokens = response.usage?.completion_tokens || 0;
    const cost = (inputTokens / 1_000_000) * INPUT_COST_PER_1M +
                 (outputTokens / 1_000_000) * OUTPUT_COST_PER_1M;

    // Valideer en filter topics
    const validTopics = (parsed.topics || [])
      .map((t: string) => t.toLowerCase())
      .filter((t: string) => HR_TOPICS.includes(t));

    return {
      metadata: {
        summary: parsed.summary || '',
        keywords: parsed.keywords || [],
        topics: validTopics,
        alternativeTerms: parsed.alternativeTerms || []
      },
      inputTokens,
      outputTokens,
      cost
    };
  } catch (error) {
    console.error('❌ [MetadataGen] Failed to generate metadata:', error);
    // Return empty metadata on error (graceful degradation)
    return {
      metadata: {
        summary: '',
        keywords: [],
        topics: [],
        alternativeTerms: []
      },
      inputTokens: 0,
      outputTokens: 0,
      cost: 0
    };
  }
}

/**
 * Batch generatie voor meerdere chunks (met rate limiting)
 *
 * @param chunks - Array van chunks met content en index
 * @param documentContext - Optionele context (bijv. documentnaam)
 * @param concurrency - Max aantal parallelle requests (default: 5)
 * @returns Map van index naar metadata, plus totale kosten
 */
export async function generateMetadataBatch(
  chunks: Array<{ content: string; index: number }>,
  documentContext?: string,
  concurrency: number = 5
): Promise<BatchMetadataResult> {
  const results = new Map<number, EnhancedChunkMetadata>();
  let totalCost = 0;
  let totalTokens = 0;

  console.log(`\n🧠 [MetadataGen] ========== GENERATING AI METADATA ==========`);
  console.log(`📝 [MetadataGen] Processing ${chunks.length} chunks...`);

  // Process in batches for rate limiting
  for (let i = 0; i < chunks.length; i += concurrency) {
    const batch = chunks.slice(i, i + concurrency);

    const promises = batch.map(async (chunk) => {
      const result = await generateChunkMetadata(chunk.content, documentContext);
      return { index: chunk.index, result };
    });

    const batchResults = await Promise.all(promises);

    for (const { index, result } of batchResults) {
      results.set(index, result.metadata);
      totalCost += result.cost;
      totalTokens += result.inputTokens + result.outputTokens;
    }

    const processed = Math.min(i + concurrency, chunks.length);
    console.log(`   ✅ Processed ${processed}/${chunks.length} chunks`);

    // Small delay between batches to avoid rate limits
    if (i + concurrency < chunks.length) {
      await new Promise(resolve => setTimeout(resolve, 200));
    }
  }

  console.log(`\n✅ [MetadataGen] ========== METADATA GENERATION COMPLETE ==========`);
  console.log(`📊 [MetadataGen] Total chunks: ${results.size}`);
  console.log(`🔢 [MetadataGen] Total tokens: ${totalTokens}`);
  console.log(`💵 [MetadataGen] Total cost: $${totalCost.toFixed(4)}`);

  return { results, totalCost, totalTokens };
}

/**
 * Check of metadata generatie is ingeschakeld
 */
export function isMetadataGenerationEnabled(): boolean {
  return process.env.ENABLE_METADATA_GENERATION !== 'false';
}
