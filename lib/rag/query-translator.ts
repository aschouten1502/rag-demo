/**
 * ========================================
 * QUERY TRANSLATOR - Multilingual RAG Support
 * ========================================
 *
 * Detecteert de taal van een vraag en vertaalt naar
 * de document_language van de tenant voor betere
 * vector search resultaten.
 *
 * Probleem: Embeddings zijn taalgebonden.
 * "krank" (DE) ligt ver van "ziek" (NL) in embedding space.
 *
 * Oplossing: Vertaal de query naar de document-taal
 * vóór embedding en search.
 *
 * Kosten: ~$0.0005 per vertaling (GPT-4o-mini)
 */

import OpenAI from 'openai';

// ========================================
// TYPES
// ========================================

export interface TranslationResult {
  originalQuery: string;
  originalLanguage: string;      // Gedetecteerde taal (de, fr, en, nl, etc.)
  translatedQuery: string;       // Query in document_language
  targetLanguage: string;        // Document taal van tenant
  wasTranslated: boolean;        // Was vertaling nodig?
  cost: number;                  // Kosten in USD
  latencyMs: number;             // Tijd voor vertaling
}

// Taal codes en namen
export const SUPPORTED_LANGUAGES: Record<string, string> = {
  'nl': 'Dutch',
  'en': 'English',
  'de': 'German',
  'fr': 'French',
  'es': 'Spanish',
  'it': 'Italian',
  'pl': 'Polish',
  'tr': 'Turkish',
  'pt': 'Portuguese',
  'ro': 'Romanian',
  'ar': 'Arabic',
  'zh': 'Chinese'
};

// ========================================
// CONFIGURATION
// ========================================

// GPT-4o-mini pricing (per 1M tokens)
const INPUT_COST_PER_1M = 0.15;   // $0.15 per 1M input tokens
const OUTPUT_COST_PER_1M = 0.60;  // $0.60 per 1M output tokens

// Model voor snelle, goedkope vertaling
const TRANSLATION_MODEL = 'gpt-4o-mini';

// ========================================
// OPENAI CLIENT
// ========================================

let openaiClient: OpenAI | null = null;

function getOpenAIClient(): OpenAI {
  if (!openaiClient) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error('OPENAI_API_KEY is not set');
    }
    openaiClient = new OpenAI({ apiKey });
  }
  return openaiClient;
}

// ========================================
// MAIN TRANSLATION FUNCTION
// ========================================

/**
 * Detecteert de taal van een vraag en vertaalt indien nodig
 * naar de document_language van de tenant.
 *
 * @param query - De originele vraag van de gebruiker
 * @param documentLanguage - De taal van de documenten (bijv. 'nl')
 * @returns TranslationResult met vertaalde query en metadata
 */
export async function translateQueryIfNeeded(
  query: string,
  documentLanguage: string
): Promise<TranslationResult> {
  const startTime = Date.now();

  // Valideer target language
  const targetLangName = SUPPORTED_LANGUAGES[documentLanguage] || 'Dutch';

  try {
    const openai = getOpenAIClient();

    // Combineer detectie en vertaling in één call voor efficiency
    const response = await openai.chat.completions.create({
      model: TRANSLATION_MODEL,
      temperature: 0.1, // Lage temperature voor consistente vertalingen
      messages: [
        {
          role: 'system',
          content: `You are a language detection and translation assistant. Your task:
1. Detect the language of the user's query
2. If the query is NOT in ${targetLangName}, translate it to ${targetLangName}
3. If the query is already in ${targetLangName}, return it unchanged

IMPORTANT:
- Keep the same intent and meaning
- Preserve any specific terms, names, or numbers
- For HR/employment questions, use formal language
- Respond ONLY with valid JSON, no other text

Response format (JSON only):
{
  "detected_language": "language_code",
  "translated_query": "the query in ${targetLangName}",
  "was_translated": true/false
}`
        },
        {
          role: 'user',
          content: query
        }
      ],
      response_format: { type: 'json_object' }
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error('Empty response from translation API');
    }

    const result = JSON.parse(content);

    // Bereken kosten
    const inputTokens = response.usage?.prompt_tokens || 0;
    const outputTokens = response.usage?.completion_tokens || 0;
    const cost = (inputTokens / 1_000_000) * INPUT_COST_PER_1M +
                 (outputTokens / 1_000_000) * OUTPUT_COST_PER_1M;

    const latencyMs = Date.now() - startTime;

    console.log('\n🌐 [QueryTranslator] ========== TRANSLATION ==========');
    console.log(`📝 [QueryTranslator] Original: "${query}"`);
    console.log(`🔍 [QueryTranslator] Detected language: ${result.detected_language}`);
    console.log(`🎯 [QueryTranslator] Target language: ${documentLanguage} (${targetLangName})`);

    if (result.was_translated) {
      console.log(`✅ [QueryTranslator] Translated: "${result.translated_query}"`);
    } else {
      console.log(`ℹ️  [QueryTranslator] No translation needed`);
    }

    console.log(`⏱️  [QueryTranslator] Latency: ${latencyMs}ms`);
    console.log(`💰 [QueryTranslator] Cost: $${cost.toFixed(6)}`);

    return {
      originalQuery: query,
      originalLanguage: result.detected_language || 'unknown',
      translatedQuery: result.translated_query || query,
      targetLanguage: documentLanguage,
      wasTranslated: result.was_translated || false,
      cost,
      latencyMs
    };

  } catch (error) {
    console.error('❌ [QueryTranslator] Translation error:', error);

    // Fallback: gebruik originele query
    return {
      originalQuery: query,
      originalLanguage: 'unknown',
      translatedQuery: query,
      targetLanguage: documentLanguage,
      wasTranslated: false,
      cost: 0,
      latencyMs: Date.now() - startTime
    };
  }
}

// ========================================
// SIMPLE LANGUAGE DETECTION (FALLBACK)
// ========================================

/**
 * Snelle heuristische taaldetectie zonder API call.
 * Gebruikt voor optimalisatie: skip translation API als
 * query waarschijnlijk al in target language is.
 *
 * @param query - De vraag
 * @returns Geschatte taalcode of 'unknown'
 */
export function detectLanguageHeuristic(query: string): string {
  const lowerQuery = query.toLowerCase();

  // Duitse indicatoren
  const germanWords = ['was', 'wie', 'wann', 'warum', 'können', 'müssen', 'haben', 'sein', 'werden', 'ich', 'mein', 'wenn', 'krankheit', 'krank', 'urlaub', 'gehalt', 'arbeits'];
  const germanScore = germanWords.filter(w => lowerQuery.includes(w)).length;

  // Franse indicatoren
  const frenchWords = ['que', 'quoi', 'comment', 'pourquoi', 'puis', 'dois', 'avoir', 'être', 'je', 'mon', 'ma', 'maladie', 'congé', 'salaire', 'travail'];
  const frenchScore = frenchWords.filter(w => lowerQuery.includes(w)).length;

  // Nederlandse indicatoren
  const dutchWords = ['wat', 'hoe', 'wanneer', 'waarom', 'kan', 'moet', 'hebben', 'zijn', 'worden', 'ik', 'mijn', 'als', 'ziekte', 'ziek', 'verlof', 'salaris', 'werk'];
  const dutchScore = dutchWords.filter(w => lowerQuery.includes(w)).length;

  // Engelse indicatoren
  const englishWords = ['what', 'how', 'when', 'why', 'can', 'must', 'have', 'be', 'my', 'if', 'sick', 'leave', 'salary', 'work', 'holiday'];
  const englishScore = englishWords.filter(w => lowerQuery.includes(w)).length;

  const scores = [
    { lang: 'de', score: germanScore },
    { lang: 'fr', score: frenchScore },
    { lang: 'nl', score: dutchScore },
    { lang: 'en', score: englishScore }
  ];

  const best = scores.sort((a, b) => b.score - a.score)[0];

  // Alleen returnen als er een duidelijke match is
  if (best.score >= 2) {
    return best.lang;
  }

  return 'unknown';
}

/**
 * Optimized translation: check heuristic first to potentially
 * skip the API call if query is already in target language.
 *
 * @param query - De vraag
 * @param documentLanguage - Target taal
 * @returns TranslationResult
 */
export async function translateQueryOptimized(
  query: string,
  documentLanguage: string
): Promise<TranslationResult> {
  const startTime = Date.now();

  // Quick heuristic check
  const detectedLang = detectLanguageHeuristic(query);

  // Als heuristic zegt dat het al in target language is, skip API call
  if (detectedLang === documentLanguage) {
    console.log(`ℹ️  [QueryTranslator] Heuristic: query already in ${documentLanguage}, skipping API call`);
    return {
      originalQuery: query,
      originalLanguage: documentLanguage,
      translatedQuery: query,
      targetLanguage: documentLanguage,
      wasTranslated: false,
      cost: 0,
      latencyMs: Date.now() - startTime
    };
  }

  // Anders: doe volledige detectie + vertaling via API
  return translateQueryIfNeeded(query, documentLanguage);
}

// ========================================
// EXPORTS
// ========================================

export {
  TRANSLATION_MODEL,
  INPUT_COST_PER_1M,
  OUTPUT_COST_PER_1M
};
