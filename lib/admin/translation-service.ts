/**
 * ========================================
 * TRANSLATION SERVICE
 * ========================================
 * Vertaalt UI teksten van Nederlands naar andere talen
 * met behulp van OpenAI GPT-4o.
 */

import OpenAI from 'openai';
import { LanguageTexts, UITexts } from './branding-service';

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// ========================================
// SUPPORTED LANGUAGES
// ========================================

export const SUPPORTED_LANGUAGES = [
  { code: 'nl', name: 'Nederlands', flag: '🇳🇱' },
  { code: 'en', name: 'English', flag: '🇬🇧' },
  { code: 'de', name: 'Deutsch', flag: '🇩🇪' },
  { code: 'fr', name: 'Français', flag: '🇫🇷' },
  { code: 'es', name: 'Español', flag: '🇪🇸' },
  { code: 'it', name: 'Italiano', flag: '🇮🇹' },
  { code: 'pl', name: 'Polski', flag: '🇵🇱' },
  { code: 'tr', name: 'Türkçe', flag: '🇹🇷' },
  { code: 'ar', name: 'العربية', flag: '🇸🇦' },
  { code: 'zh', name: '中文', flag: '🇨🇳' },
  { code: 'pt', name: 'Português', flag: '🇵🇹' },
  { code: 'ro', name: 'Română', flag: '🇷🇴' }
] as const;

export type LanguageCode = typeof SUPPORTED_LANGUAGES[number]['code'];

// ========================================
// TRANSLATION FUNCTIONS
// ========================================

/**
 * Vertaal Nederlandse UI teksten naar alle ondersteunde talen
 */
export async function translateUITexts(dutchTexts: LanguageTexts): Promise<UITexts> {
  console.log('🌍 [TranslationService] Starting translation to 11 languages...');

  const result: UITexts = {
    nl: dutchTexts // Nederlands is de bron
  };

  // Vertaal naar alle andere talen parallel
  const targetLanguages = SUPPORTED_LANGUAGES.filter(lang => lang.code !== 'nl');

  const translations = await Promise.all(
    targetLanguages.map(async (lang) => {
      try {
        const translated = await translateToLanguage(dutchTexts, lang.code, lang.name);
        return { code: lang.code, texts: translated };
      } catch (error) {
        console.error(`❌ [TranslationService] Failed to translate to ${lang.name}:`, error);
        // Return Dutch as fallback
        return { code: lang.code, texts: dutchTexts };
      }
    })
  );

  // Verzamel alle vertalingen
  translations.forEach(({ code, texts }) => {
    result[code] = texts;
  });

  console.log('✅ [TranslationService] Translation complete');
  return result;
}

/**
 * Vertaal naar één specifieke taal
 */
async function translateToLanguage(
  dutchTexts: LanguageTexts,
  targetCode: string,
  targetName: string
): Promise<LanguageTexts> {
  const prompt = `Je bent een professionele vertaler. Vertaal de volgende UI teksten van een HR chatbot van Nederlands naar ${targetName}.

BELANGRIJK:
- Houd de toon professioneel en vriendelijk
- Dit zijn labels en teksten voor een chatbot interface
- Behoud dezelfde structuur en formatting
- Vertaal ALLEEN de tekst, niet de JSON keys
- Zorg dat de vertaling natuurlijk klinkt in ${targetName}

Nederlandse teksten om te vertalen:
${JSON.stringify(dutchTexts, null, 2)}

Geef je antwoord als valide JSON in EXACT dezelfde structuur.`;

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: 'Je bent een professionele vertaler gespecialiseerd in UI/UX teksten. Je geeft alleen valide JSON terug, zonder markdown code blocks.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.3, // Lager voor consistentere vertalingen
      response_format: { type: 'json_object' }
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error('Empty response from OpenAI');
    }

    const translated = JSON.parse(content) as LanguageTexts;

    // Valideer dat alle velden aanwezig zijn
    const requiredFields = [
      'appTitle', 'appSubtitle', 'welcomeTitle', 'welcomeSubtitle',
      'languageHint', 'exampleLabel', 'examples', 'inputPlaceholder',
      'citationsLabel', 'pageLabel', 'viewButton'
    ];

    for (const field of requiredFields) {
      if (!(field in translated)) {
        console.warn(`⚠️ [TranslationService] Missing field ${field} in ${targetName} translation, using Dutch`);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (translated as any)[field] = (dutchTexts as any)[field];
      }
    }

    // Valideer examples array
    if (!Array.isArray(translated.examples) || translated.examples.length !== 4) {
      console.warn(`⚠️ [TranslationService] Invalid examples in ${targetName} translation, using Dutch`);
      translated.examples = dutchTexts.examples;
    }

    console.log(`✅ [TranslationService] Translated to ${targetName}`);
    return translated;

  } catch (error) {
    console.error(`❌ [TranslationService] Translation to ${targetName} failed:`, error);
    throw error;
  }
}

/**
 * Vertaal een enkele taal opnieuw (voor updates)
 */
export async function retranslateLanguage(
  dutchTexts: LanguageTexts,
  targetCode: LanguageCode
): Promise<LanguageTexts> {
  if (targetCode === 'nl') {
    return dutchTexts;
  }

  const language = SUPPORTED_LANGUAGES.find(l => l.code === targetCode);
  if (!language) {
    throw new Error(`Unsupported language code: ${targetCode}`);
  }

  return translateToLanguage(dutchTexts, targetCode, language.name);
}

/**
 * Extraheer fun facts uit een PDF document
 */
export async function extractFunFactsFromText(documentText: string): Promise<string[]> {
  console.log('📄 [TranslationService] Extracting fun facts from document...');

  const prompt = `Lees de volgende tekst en extraheer 5-8 interessante "wist je dat" feiten over het bedrijf.

REGELS:
- Focus op: bedrijfsgeschiedenis, interessante cijfers, tradities, leuke weetjes
- Elke fact moet kort zijn (max 15 woorden)
- Elke fact moet passen na "Wist je dat..."
- Gebruik de "je" vorm (informeel)
- Begin NIET met "Wist je dat" - dat wordt automatisch toegevoegd
- Eindig met een vraagteken

VOORBEELD OUTPUT:
- "...wij al 25 jaar bestaan?"
- "...ons hoofdkantoor in Amsterdam staat?"
- "...we meer dan 500 medewerkers hebben?"

DOCUMENT:
${documentText.substring(0, 10000)} // Limit to first 10k chars

Geef je antwoord als JSON array met alleen de fact teksten (zonder "Wist je dat" prefix).`;

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: 'Je extraheert interessante feiten uit bedrijfsdocumenten. Je geeft alleen valide JSON arrays terug.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.5,
      response_format: { type: 'json_object' }
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error('Empty response from OpenAI');
    }

    const parsed = JSON.parse(content);

    // Handle different response formats
    let facts: string[] = [];
    if (Array.isArray(parsed)) {
      facts = parsed;
    } else if (parsed.facts && Array.isArray(parsed.facts)) {
      facts = parsed.facts;
    } else if (parsed.fun_facts && Array.isArray(parsed.fun_facts)) {
      facts = parsed.fun_facts;
    }

    // Clean up facts
    facts = facts
      .map((fact: string) => {
        // Remove leading "..." or "Wist je dat"
        let cleaned = fact.trim();
        if (cleaned.startsWith('...')) {
          cleaned = cleaned.substring(3).trim();
        }
        if (cleaned.toLowerCase().startsWith('wist je dat')) {
          cleaned = cleaned.substring(11).trim();
        }
        // Ensure ends with ?
        if (!cleaned.endsWith('?')) {
          cleaned += '?';
        }
        return cleaned;
      })
      .filter((fact: string) => fact.length > 5 && fact.length < 100);

    console.log(`✅ [TranslationService] Extracted ${facts.length} fun facts`);
    return facts;

  } catch (error) {
    console.error('❌ [TranslationService] Fun facts extraction failed:', error);
    throw error;
  }
}
