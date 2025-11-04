/**
 * ========================================
 * CHAT API ROUTE - Main Entry Point
 * ========================================
 *
 * Dit is de hoofdroute voor de chatbot. Wanneer een gebruiker een vraag stelt,
 * komt de request hier binnen.
 *
 * FLOW:
 * 1. Ontvang vraag van gebruiker + conversatie geschiedenis
 * 2. Haal relevante context op uit Pinecone (HR documenten)
 * 3. Genereer system prompt met context
 * 4. Vraag OpenAI om antwoord te genereren
 * 5. Stuur antwoord + citations terug naar gebruiker
 * 6. Log alles voor analytics en debugging
 */

import { NextRequest, NextResponse } from 'next/server';

// Import alle modules
import { initializePinecone, retrieveContext } from '@/lib/pinecone';
import { initializeOpenAI, prepareMessages, generateStreamingAnswer } from '@/lib/openai';
import { generateSystemPrompt } from '@/lib/prompts';
import {
  logSuccessfulRequest,
  logError,
  logContentFilter,
  isContentFilterError,
  getUserFriendlyErrorMessage,
  categorizeError,
  type RequestSummary
} from '@/lib/logging';
import { updateChatRequest } from '@/lib/supabase/supabase-client';

// ========================================
// MAIN API HANDLER
// ========================================

export async function POST(request: NextRequest) {
  // Start timing voor performance tracking
  const requestStartTime = Date.now();
  console.log('🚀 [API] Chat request received');
  console.log('⏱️  [API] Request start time:', new Date(requestStartTime).toISOString());

  // Initialiseer variabelen
  let message: string = '';
  let conversationHistory: any[] = [];
  let language: string = 'nl';

  try {
    // ========================================
    // STEP 1: Parse en valideer de request
    // ========================================
    const body = await request.json();
    message = body.message;
    conversationHistory = body.conversationHistory;
    language = body.language || 'nl';
    const sessionId = body.sessionId;

    console.log('\n📝 [API] ========== USER QUESTION ==========');
    console.log('🔑 [API] Session ID:', sessionId || 'NO_SESSION_ID');
    console.log('❓ [API] Question:', message);
    console.log('💬 [API] Conversation history length:', conversationHistory?.length || 0);
    console.log('🌐 [API] Selected language:', language);

    // Valideer dat er een message is
    if (!message) {
      console.log('❌ [API] No message provided');
      return NextResponse.json(
        { error: 'Message is required' },
        { status: 400 }
      );
    }

    // ========================================
    // STEP 2: Check environment configuratie
    // ========================================
    const pineconeApiKey = process.env.PINECONE_API_KEY;
    const openaiApiKey = process.env.OPENAI_API_KEY;
    const assistantName = process.env.PINECONE_ASSISTANT_NAME;

    console.log('🔑 [API] Pinecone API Key exists:', !!pineconeApiKey);
    console.log('🔑 [API] OpenAI API Key exists:', !!openaiApiKey);
    console.log('🤖 [API] Assistant name:', assistantName);

    if (!pineconeApiKey || !assistantName || !openaiApiKey) {
      console.log('❌ [API] Missing configuration');
      return NextResponse.json(
        { error: 'Server configuration error: Missing API keys or assistant name' },
        { status: 500 }
      );
    }

    // ========================================
    // STEP 3: Initialiseer Pinecone en haal context op
    // ========================================
    const pineconeClient = initializePinecone(pineconeApiKey);
    const {
      contextText,
      citations,
      pineconeTokens,
      pineconeCost
    } = await retrieveContext(assistantName, pineconeClient, message);

    // ========================================
    // STEP 4: Genereer system prompt
    // ========================================
    const systemPrompt = generateSystemPrompt(contextText, language);

    // ========================================
    // STEP 5: Initialiseer OpenAI en start streaming
    // ========================================
    const openaiClient = initializeOpenAI(openaiApiKey);
    const messages = prepareMessages(systemPrompt, conversationHistory, message);

    console.log('\n🌊 [API] Starting streaming response...');

    // BELANGRIJKE WIJZIGING: Maak een placeholder log VOOR streaming
    // Dit geeft ons een logId voor de feedback duimpjes
    // We updaten de log later met de echte data
    let logId: string | null = null;
    try {
      const placeholderSummary: RequestSummary = {
        session_id: sessionId || 'NO_SESSION_ID',
        timestamp: new Date(requestStartTime).toISOString(),
        question: message,
        answer: '[Streaming in progress...]', // Placeholder
        response_time_seconds: 0,
        response_time_ms: 0,
        pinecone_tokens: pineconeTokens,
        pinecone_cost: parseFloat(pineconeCost.toFixed(6)),
        openai_input_tokens: 0, // Wordt later geupdate
        openai_output_tokens: 0,
        openai_total_tokens: 0,
        openai_cost: 0,
        total_cost: parseFloat(pineconeCost.toFixed(6)),
        snippets_used: citations.length,
        citations_count: citations.length,
        conversation_history_length: conversationHistory?.length || 0,
        language: language,
        citations: citations
      };
      logId = await logSuccessfulRequest(placeholderSummary);
      console.log('✅ [API] Placeholder log created with ID:', logId);
    } catch (err) {
      console.error('⚠️ [API] Failed to create placeholder log:', err);
    }

    // Genereer streaming response
    const stream = await generateStreamingAnswer(openaiClient, messages, language);

    // Voeg metadata toe aan de stream (citations, pinecone cost, session, logId!)
    const encoder = new TextEncoder();
    const transformedStream = new ReadableStream({
      async start(controller) {
        // Track de finale data voor Supabase update
        let fullAnswer = '';
        let finalUsage: any = null;

        try {
          // Stuur eerst de metadata (citations, pinecone info, EN logId!)
          const metadataEvent = JSON.stringify({
            type: 'metadata',
            citations: citations,
            pineconeTokens: pineconeTokens,
            pineconeCost: parseFloat(pineconeCost.toFixed(6)),
            sessionId: sessionId || 'NO_SESSION_ID',
            requestStartTime: requestStartTime,
            logId: logId  // ← NU HEBBEN WE EEN LOGID!
          });
          controller.enqueue(encoder.encode(`data: ${metadataEvent}\n\n`));

          // Pipe de OpenAI stream door EN verzamel data voor update
          const reader = stream.getReader();
          const decoder = new TextDecoder();

          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            // Decode de chunk om de data te extraheren
            const chunk = decoder.decode(value, { stream: true });
            const lines = chunk.split('\n');

            for (const line of lines) {
              if (line.startsWith('data: ')) {
                try {
                  const eventData = JSON.parse(line.slice(6));

                  // Verzamel content voor fullAnswer
                  if (eventData.type === 'content') {
                    fullAnswer += eventData.content;
                  }

                  // Verzamel usage voor Supabase update
                  if (eventData.type === 'done') {
                    finalUsage = eventData.usage;
                    fullAnswer = eventData.fullAnswer || fullAnswer;
                  }
                } catch (e) {
                  // Parsing error, skip
                }
              }
            }

            // Forward de chunk naar de client
            controller.enqueue(value);
          }

          // Bereken timing
          const requestEndTime = Date.now();
          const responseTimeMs = requestEndTime - requestStartTime;
          const responseTimeSeconds = parseFloat((responseTimeMs / 1000).toFixed(2));

          console.log('\n⏱️  [API] ========== TIMING ==========');
          console.log('⏱️  [API] Total response time:', responseTimeSeconds, 'seconds');

          // Update de Supabase log met de echte data (non-blocking)
          if (logId && finalUsage && fullAnswer) {
            const totalCost = parseFloat(pineconeCost.toFixed(6)) + (finalUsage.totalCost || 0);

            console.log('🔄 [API] Updating Supabase log with final data...');
            updateChatRequest(logId, {
              answer: fullAnswer,
              response_time_seconds: responseTimeSeconds,
              response_time_ms: responseTimeMs,
              openai_input_tokens: finalUsage.inputTokens || 0,
              openai_output_tokens: finalUsage.outputTokens || 0,
              openai_total_tokens: finalUsage.totalTokens || 0,
              openai_cost: finalUsage.totalCost || 0,
              total_cost: totalCost
            }).then(result => {
              if (result.success) {
                console.log('✅ [API] Supabase log updated successfully');
              } else {
                console.error('⚠️ [API] Failed to update Supabase log:', result.error);
              }
            }).catch(err => {
              console.error('⚠️ [API] Error updating Supabase log:', err);
            });
          } else {
            console.warn('⚠️ [API] Missing data for Supabase update:', {
              hasLogId: !!logId,
              hasUsage: !!finalUsage,
              hasAnswer: !!fullAnswer
            });
          }

          controller.close();
        } catch (error) {
          console.error('❌ [API] Streaming error:', error);
          const errorEvent = JSON.stringify({
            type: 'error',
            message: error instanceof Error ? error.message : 'Streaming failed'
          });
          controller.enqueue(encoder.encode(`data: ${errorEvent}\n\n`));
          controller.close();
        }
      }
    });

    // Return streaming response
    return new Response(transformedStream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });

  } catch (error: any) {
    // ========================================
    // ERROR HANDLING
    // ========================================

    // Check of dit een content filter error is
    if (isContentFilterError(error)) {
      logContentFilter(requestStartTime, message, conversationHistory);

      return NextResponse.json(
        {
          error: 'content_filter',
          message: 'Je vraag bevat termen die automatisch worden geblokkeerd om misbruik te voorkomen. Als je vraag echt HR-gerelateerd is, neem dan contact op met je leidinggevende of de HR-afdeling voor een persoonlijk gesprek.',
          userFriendly: true
        },
        { status: 400 }
      );
    }

    // Log de error met volledige context
    logError(error, requestStartTime, message, conversationHistory, language);

    // Categoriseer de error en geef user-friendly message
    const { category, source } = categorizeError(error);
    const userMessage = getUserFriendlyErrorMessage(category);

    return NextResponse.json(
      {
        error: category,
        message: userMessage,
        details: error?.message || 'Unknown error',
        type: error?.name || 'Error',
        source: source
      },
      { status: 500 }
    );
  }
}
