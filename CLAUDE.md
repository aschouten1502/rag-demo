# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**HR Assistant AI** (v2.0.0) is a **production-ready multi-tenant** Next.js 15 application that implements a multi-language HR assistant using RAG (Retrieval-Augmented Generation). The bot answers questions about HR policies, procedures, and employee benefits based on uploaded documentation.

**Multi-Tenant Architecture**: This is a **demo and template in one** - designed to be quickly deployed for multiple clients. Each client gets their own isolated instance with custom branding, documents, and data.

**Original Client**: GeoStick (production instance running since v1.0)
**Current Version**: White-label template for rapid deployment to new clients

## Development Commands

```bash
# Development
npm install              # Install dependencies
npm run dev              # Start dev server at http://localhost:3000
npm run build            # Build for production
npm start                # Start production server
npm run lint             # Run ESLint
npx tsc --noEmit         # TypeScript type checking
```

## Multi-Tenant Setup

**IMPORTANT**: This project is fully multi-tenant. Before deploying for a new client, see:
- **[DEPLOYMENT_CHECKLIST.md](DEPLOYMENT_CHECKLIST.md)** - Step-by-step deployment guide (30-45 min)
- **[MULTI_TENANT_ARCHITECTURE.md](MULTI_TENANT_ARCHITECTURE.md)** - Technical architecture details
- **[.env.example](.env.example)** - Complete environment variable reference

### Quick Start for New Client

1. **Copy `.env.example` to `.env.local`**
2. **Set tenant identification**:
   ```bash
   TENANT_ID=acme-corp                    # Unique client identifier
   TENANT_NAME=Acme Corporation
   ```

3. **Configure Pinecone** (client-specific assistant):
   ```bash
   PINECONE_API_KEY=pcsk_...
   PINECONE_ASSISTANT_NAME=acme-corp-hr-assistant  # Per-client assistant
   ```

4. **Configure OpenAI**:
   ```bash
   OPENAI_API_KEY=sk-...
   ```

5. **Configure Supabase** (OPTIONAL - for logging/analytics):
   ```bash
   NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
   SUPABASE_SERVICE_ROLE_KEY=...
   SUPABASE_TABLE_NAME=chat_logs              # Generic table for shared DB
   STORAGE_BUCKET_NAME=acme-corp-hr-documents # Per-client bucket
   ```

6. **Configure Branding** (OPTIONAL - can use env vars or edit config file):
   ```bash
   NEXT_PUBLIC_COMPANY_NAME=Acme Corporation
   NEXT_PUBLIC_PRIMARY_COLOR=#FF5733
   ```

**Note**: The bot works without Supabase, but logs only go to console.

### 🤖 AUTOMATED CLIENT SETUP (RECOMMENDED)

**NEW in v2.0**: Markdown-driven configuration with Claude Code automation!

Instead of manually editing `.env.local` and config files, use the `CLIENT_CONFIG.md` workflow:

#### Setup Flow

1. **User fills in `CLIENT_CONFIG.md`**:
   ```bash
   cp CLIENT_CONFIG.example.md CLIENT_CONFIG.md
   # Edit CLIENT_CONFIG.md with client details
   ```

2. **User shares with Claude Code**:
   ```
   "Configureer deze client op basis van CLIENT_CONFIG.md"
   ```

3. **Claude Code automatically**:
   - Reads and validates configuration
   - Generates `.env.local` with all environment variables
   - Optionally updates `lib/branding.config.ts` with branding
   - Launches `supabase-integration-manager` agent if Supabase configured
   - Validates complete setup
   - Reports manual steps still needed (Vercel deploy, Pinecone docs, bucket creation)

#### When Claude Code Sees CLIENT_CONFIG.md

Execute this automation workflow:

**1. Parse & Validate**
- Read all configuration values from CLIENT_CONFIG.md
- Validate required fields are filled in
- Check formats: hex colors (#RRGGBB), URLs, lowercase tenant IDs
- Report any missing or invalid values

**2. Generate .env.local**
```typescript
// Required variables
TENANT_ID={from config}
TENANT_NAME={from config}
PINECONE_API_KEY={from config}
PINECONE_ASSISTANT_NAME={from config}
OPENAI_API_KEY={from config}

// Branding (if provided)
NEXT_PUBLIC_COMPANY_NAME={from config}
NEXT_PUBLIC_PRIMARY_COLOR={from config}
NEXT_PUBLIC_PRIMARY_DARK={from config}
NEXT_PUBLIC_LOGO_URL={from config}
// ... all other branding variables

// Supabase (if configured)
NEXT_PUBLIC_SUPABASE_URL={from config}
SUPABASE_SERVICE_ROLE_KEY={from config}
SUPABASE_TABLE_NAME={from config}
STORAGE_BUCKET_NAME={from config}
```

**3. Supabase Setup (if configured)**
- If Supabase URL and service key provided in config:
  - Launch `supabase-integration-manager` agent
  - Agent should:
    - Test connection to Supabase
    - Run migration: `docs/migrations/MULTI_TENANT_SETUP.sql`
    - Create table (generic `chat_logs` or client-specific)
    - Verify table creation successful
    - Report status

**4. Validation**
- Test that `.env.local` file is valid
- Validate all environment variables are properly formatted
- Check that Pinecone API key format is correct (starts with `pcsk_`)
- Check that OpenAI API key format is correct (starts with `sk-`)
- Validate hex color codes

**5. Report Results**

Provide clear summary:
```
✅ Configuration Complete!
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

AUTOMATED:
✅ .env.local generated with {X} environment variables
✅ Branding configured: {company_name}, color {primary_color}
✅ Supabase database setup complete (table: {table_name})
✅ Configuration validated

MANUAL STEPS REQUIRED:
⚠️ Upload HR documents to Pinecone Assistant: {assistant_name}
   → Go to: https://pinecone.io
   → Upload PDFs to assistant
⚠️ Create Supabase Storage bucket: {bucket_name}
   → Go to: Supabase Dashboard → Storage
   → Create bucket (make it PUBLIC)
   → Upload PDFs for citations
⚠️ Deploy to Vercel:
   → git push (auto-deploy) OR
   → vercel deploy --prod
⚠️ Replace logo file (if using local path):
   → Add logo to /public/{logo_path}

TESTING:
1. Run: npm run dev
2. Test chatbot locally
3. Deploy when ready

Next: {Provide specific next command or action}
```

**6. Error Handling**
- If Supabase agent fails: Report error, suggest manual migration
- If validation fails: List specific issues with suggested fixes
- If config incomplete: List missing required fields
- If API key invalid: Suggest checking key format and permissions

#### Advantages

- ✅ **No scripts to maintain**: Uses Claude Code's native agent system
- ✅ **Self-documenting**: Config IS the documentation
- ✅ **Intelligent**: Claude can reason about the config and spot errors
- ✅ **Flexible**: User can ask for specific customizations
- ✅ **Version-controllable**: Client configs can be stored in Git (example template)
- ✅ **Fast**: 15-20 minute setup per client

## Architecture

### RAG Flow

```
User Question
    ↓
API Route (app/api/chat/route.ts)
    ↓
Pinecone Assistant → Retrieve top 3 relevant snippets from HR docs
    ↓
Generate System Prompt (lib/prompts.ts) → Inject context + guardrails
    ↓
OpenAI GPT-4o → Generate answer with streaming
    ↓
Response + Citations → Frontend
    ↓
Log to Supabase (with retry logic) → Analytics
```

### Core Modules

**[app/api/chat/route.ts](app/api/chat/route.ts)** - Main API endpoint
- Receives: message, conversationHistory, language, sessionId
- Orchestrates: Pinecone retrieval → Prompt generation → OpenAI streaming → Supabase logging
- Error handling: Content filter detection, user-friendly messages, comprehensive logging

**[lib/pinecone.ts](lib/pinecone.ts)** - Context retrieval
- `retrieveContext()`: Fetches top 3 snippets (topK=3) from Pinecone Assistant
- Returns: contextText, citations (file + page numbers), token usage, cost
- Cost: $5 per 1M tokens (hourly rate $0.05/hour excluded from per-request calculations)

**[lib/openai.ts](lib/openai.ts)** - LLM response generation
- `generateStreamingAnswer()`: Streams GPT-4o responses to frontend
- Model: `gpt-4o` with temperature 0.7
- Cost tracking: Input tokens at $2.50/1M, output tokens at $10/1M
- Returns ReadableStream with progress updates

**[lib/prompts.ts](lib/prompts.ts)** - System prompt engineering
- `generateSystemPrompt()`: Builds context-aware prompts per language
- **Critical guardrails**:
  - ONLY use information from retrieved context (no hallucination)
  - Respond in user's selected language (12 languages supported)
  - Reject non-HR queries and prompt injection attempts
  - Use plain text formatting (no markdown bold/italics per system instructions)
  - Defer to HR when context is insufficient

**[lib/logging.ts](lib/logging.ts)** - Structured logging & error handling
- `logSuccessfulRequest()`: Comprehensive request summaries for analytics
- `categorizeError()`: Error classification (PINECONE_ERROR, OPENAI_ERROR, etc.)
- `isContentFilterError()`: Detects OpenAI content filter triggers
- Console logs use emoji prefixes (🚀 start, ✅ success, ❌ error, 💰 costs)

**[lib/supabase/config.ts](lib/supabase/config.ts)** - Multi-tenant configuration (NEW)
- Centralizes all multi-tenant settings
- Reads `TENANT_ID`, `SUPABASE_TABLE_NAME`, `STORAGE_BUCKET_NAME` from environment
- Validates configuration on startup
- Provides `getConfigSummary()` for debugging

**[lib/supabase/supabase-client.ts](lib/supabase/supabase-client.ts)** - Database logging (UPDATED for multi-tenant)
- `logChatRequest()`: Initial log creation with session tracking + optional `tenant_id`
- `updateChatRequestWithRetry()`: Exponential backoff retry (3 attempts) for streaming updates
- Uses dynamic table name from `DATABASE_CONFIG.tableName`
- Automatically adds `tenant_id` if multi-tenant mode enabled
- Tracks: costs, tokens, response times, completion status, citations
- Fixed: 32% incomplete logs issue with retry logic (see [MIGRATION_TO_V2.md](MIGRATION_TO_V2.md))

**[lib/supabase/types.ts](lib/supabase/types.ts)** - Generic database types (UPDATED)
- Defines `ChatLogRow`, `ChatLogInsert`, `ChatLogUpdate` interfaces
- Supports both legacy (`geostick_logs_data_qabothr`) and generic (`chat_logs`) table names
- Includes optional `tenant_id` field for multi-tenant deployments
- Backwards compatible with existing GeoStick table

**[lib/pdf-urls.ts](lib/pdf-urls.ts)** - PDF URL generation (UPDATED for multi-tenant)
- `getPdfUrl()`: Generates public URLs for PDFs in Supabase Storage
- `getBucketName()`: Returns configured bucket name from environment
- `isPdfAvailable()`: Dynamic mode (any .pdf) or legacy mode (hardcoded list)
- `validatePdfConfig()`: Configuration validation for debugging
- Uses `STORAGE_CONFIG.bucketName` from environment (e.g., `acme-corp-hr-documents`)
- Backwards compatible with legacy GeoStick bucket

**[lib/branding.config.ts](lib/branding.config.ts)** - Branding configuration (UPDATED for multi-tenant)
- Environment variable overrides for all branding values
- Supports `NEXT_PUBLIC_COMPANY_NAME`, `NEXT_PUBLIC_PRIMARY_COLOR`, etc.
- Falls back to config file values if env vars not set
- Two deployment options:
  1. Edit config file directly (simple, requires rebuild)
  2. Use environment variables (recommended, no code changes)

**[app/api/feedback/route.ts](app/api/feedback/route.ts)** - Feedback collection
- `POST`: Saves user feedback (positive/negative) with optional comments
- Updates: `feedback`, `feedback_comment`, `feedback_timestamp` in database
- Schema ready, API implemented, UI not yet connected

### Multi-Language Support

12 languages supported (Dutch is default):
- 🇳🇱 Nederlands (nl), 🇬🇧 English (en), 🇩🇪 Deutsch (de), 🇫🇷 Français (fr)
- 🇪🇸 Español (es), 🇮🇹 Italiano (it), 🇵🇱 Polski (pl), 🇹🇷 Türkçe (tr)
- 🇸🇦 العربية (ar), 🇨🇳 中文 (zh), 🇵🇹 Português (pt), 🇷🇴 Română (ro)

Translations stored in [app/translations.ts](app/translations.ts). System prompts and responses automatically adapt to selected language.

### PDF Documents (Supabase Storage) - Multi-Tenant

**Per-Client Storage Buckets**:
- Each client has their own Supabase Storage bucket: `{tenant-id}-hr-documents`
- Examples: `acme-corp-hr-documents`, `techstart-hr-documents`
- Configured via environment variable: `STORAGE_BUCKET_NAME`

**Legacy GeoStick Bucket** (backwards compatible):
- Original bucket: `Geostick-HR-documenten`
- Contains 10 GeoStick HR documents (see list below)
- Still supported if `STORAGE_BUCKET_NAME` not set

**GeoStick Documents** (reference/demo):
- Betaaldata 2025.pdf
- Flyer_ASF-RVU_Eerder-stoppen-met-werken_Werknemer.pdf
- Geostick Extra info.pdf
- Grafimedia-cao-2024-2025.pdf
- Indienst - AFAS_handleiding.pdf
- LEASE_A_BIKE___werknemer_brochure_2021.pdf
- Personeelsgids_versie_HRM_2023_V17.pdf
- PGB - Pensioen 1-2-3 - 2025.pdf
- Proces eerlijk werven final versie 16-4-2025.pdf
- WTV regeling.pdf

Document URLs are dynamically generated via `getPdfUrl()` in [lib/pdf-urls.ts](lib/pdf-urls.ts) using configured bucket name.

## Database Schema (Supabase) - Multi-Tenant

**Generic Table** (recommended): `chat_logs`
**Legacy Table** (backwards compatible): `geostick_logs_data_qabothr`

**Configuration**: Set via `SUPABASE_TABLE_NAME` environment variable

Key columns:
- **Multi-tenant**: `tenant_id` (optional, for shared database deployments)
- **Request data**: `question`, `answer`, `language`, `session_id`, `conversation_history_length`
- **Citations**: `citations` (JSON), `citations_count`, `snippets_used`
- **Costs**: `pinecone_cost`, `openai_cost`, `total_cost`, token counts
- **Performance**: `response_time_ms`, `response_time_seconds`
- **Monitoring**: `is_complete`, `update_attempts`, `completion_error`, `updated_at`
- **Feedback**: `feedback`, `feedback_comment`, `feedback_timestamp` (schema ready, UI not implemented)
- **Flags**: `blocked` (content filter), `event_type`

**Multi-Tenant Setup**:
- **Generic migration**: [docs/migrations/MULTI_TENANT_SETUP.sql](docs/migrations/MULTI_TENANT_SETUP.sql)
  - Creates `chat_logs` table with optional `tenant_id` column
  - Includes indexes for tenant isolation
  - Analytics views per tenant
  - Utility functions (`get_tenant_stats()`, `cleanup_old_logs()`)

- **Legacy migrations**: [lib/supabase/migrations/](lib/supabase/migrations/) (GeoStick-specific)
  - `001_initial_schema.sql` - Original GeoStick table
  - `002-012` - Monitoring, analytics views, BI functions
  - Still compatible, see [MIGRATION_TO_V2.md](MIGRATION_TO_V2.md) for migration path

**Analytics**:
- Per-tenant cost tracking
- Session quality metrics
- Document citation analytics
- Performance monitoring

Query examples in [docs/SUPABASE_ANALYTICS.md](docs/SUPABASE_ANALYTICS.md).

## Key Implementation Patterns

### Streaming Responses
- OpenAI responses stream via `generateStreamingAnswer()` in [lib/openai.ts](lib/openai.ts)
- Frontend receives progressive chunks and updates UI in real-time
- Final completion triggers Supabase update with retry logic

### Citation Tracking
- Each Pinecone snippet includes metadata: `file_name`, `page_label`
- Citations grouped by document and deduplicated page numbers in frontend
- Displayed below assistant responses with page references
- Stored as JSON array in Supabase for analytics

### Error Handling Strategy
- Content filter errors return `userFriendly: true` flag → displayed as normal message
- All errors categorized and logged with structured format
- User-friendly messages via `getUserFriendlyErrorMessage()` in [lib/logging.ts](lib/logging.ts)
- Stack traces logged to console for debugging

### Cost Tracking
- Pinecone: Context retrieval tracked ($5/1M tokens)
- OpenAI: Input and output tokens tracked separately
- Combined cost per request logged to Supabase
- Frontend displays session-level aggregates in developer sidebar

### Retry Logic & Error Handling (Critical)

- Streaming updates use exponential backoff (3 attempts, 500ms → 1s → 2s delays)
- Tracks `update_attempts` and `completion_error` in database
- **Error catch block**: If streaming fails, the error handler updates the log with `[STREAMING ERROR]: <message>` and marks `is_complete: true`
- This prevents logs from being stuck in `"[Streaming in progress...]"` state forever
- Reduces incomplete logs from 32% to <1%

## Common Development Tasks

### Deploying for a New Client
**See**: [DEPLOYMENT_CHECKLIST.md](DEPLOYMENT_CHECKLIST.md) - Complete step-by-step guide (30-45 min)

**Quick summary**:
1. Create Pinecone Assistant with client's HR documents
2. Create Supabase Storage bucket (optional)
3. Configure environment variables (`.env.local` or Vercel)
4. Deploy to Vercel (new project per client)
5. Test and verify

### Modifying System Prompt Behavior
Edit `generateSystemPrompt()` in [lib/prompts.ts](lib/prompts.ts).
- **Note**: Prompts are now generic (no GeoStick-specific references)
- **Caution**: Strict guardrails prevent hallucination—modify carefully and test thoroughly

### Changing Pinecone Context Retrieval
- Adjust `topK` in [lib/pinecone.ts](lib/pinecone.ts:94) (default: 3)
- Lower topK reduces costs but may reduce answer quality

### Switching OpenAI Model
Edit model name in [lib/openai.ts](lib/openai.ts:133). Options:
- `gpt-4o` (current, best quality)
- `gpt-4o-mini` (90% cheaper, good quality)

### Customizing Branding for New Client
**Option 1**: Environment variables (recommended)
```bash
NEXT_PUBLIC_COMPANY_NAME=Acme Corporation
NEXT_PUBLIC_PRIMARY_COLOR=#FF5733
```

**Option 2**: Edit [lib/branding.config.ts](lib/branding.config.ts) directly

### Configuring Fun Facts (Loading Screen)
"Wist je dat..." facts shown while the bot is thinking. Configured per client.

**Option 1**: Via `CLIENT_CONFIG.md` (recommended)
```yaml
fun_facts:
  - wij al 25 jaar bestaan?
  - ons hoofdkantoor in Rotterdam staat?
```

**Option 2**: Environment variable
```bash
NEXT_PUBLIC_FUN_FACTS='["wij al 25 jaar bestaan?","ons hoofdkantoor in Rotterdam staat?"]'
NEXT_PUBLIC_FUN_FACTS_PREFIX=Wist je dat
NEXT_PUBLIC_FUN_FACTS_ENABLED=true
```

**Option 3**: Edit defaults in [lib/branding.config.ts](lib/branding.config.ts)

Facts rotate every 4 seconds with fade animation. Disable with `NEXT_PUBLIC_FUN_FACTS_ENABLED=false`.

### Adding a New Language
1. Add language name to `languageNames` in [lib/prompts.ts](lib/prompts.ts)
2. Add translations to `translations` object in [app/translations.ts](app/translations.ts)
3. Add language option to `LANGUAGES` array in [app/components/ChatHeader.tsx](app/components/ChatHeader.tsx)

### Running Database Migrations
**For new clients**: Use [docs/migrations/MULTI_TENANT_SETUP.sql](docs/migrations/MULTI_TENANT_SETUP.sql)

Apply via Supabase dashboard SQL editor:
1. Go to SQL Editor
2. Copy migration contents
3. Run migration
4. Verify table created: `SELECT * FROM chat_logs LIMIT 1;`

### Debugging Logs
Console logs use structured emoji prefixes:
- `🚀` = Request start
- `✅` = Success
- `❌` = Error
- `💰` = Cost summary
- `🔍` = Debug details
- `⏱️` = Timing

Prefixes `[API]`, `[Pinecone]`, `[OpenAI]`, `[Logging]` indicate source module.

## PWA (Progressive Web App)

This app is installable on mobile/desktop as a standalone app:
- Configured via [next.config.ts](next.config.ts) with `@ducanh2912/next-pwa`
- Manifest: [public/manifest.json](public/manifest.json)
- Service worker caching strategies:
  - **Google Fonts**: CacheFirst (1 year, max 4 entries)
  - **Images**: CacheFirst (30 days, max 64 entries)
  - **API (/api/chat)**: NetworkFirst (5 min cache, 10s timeout)
  - **Static resources (JS/CSS)**: StaleWhileRevalidate (24 hours, max 60 entries)
- Offline fallback: `/offline.html`
- PWA disabled in development for faster builds
- See [README.md](README.md) for installation instructions per platform

## Tech Stack

- **Framework**: Next.js 15.5.6 (App Router)
- **Language**: TypeScript 5
- **Styling**: Tailwind CSS 4
- **Vector DB**: Pinecone Assistant API
- **LLM**: OpenAI GPT-4o
- **Database**: Supabase (PostgreSQL)
- **PWA**: @ducanh2912/next-pwa
- **Deployment**: Vercel (recommended, see [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md))

## Important Notes

### Security
- Never commit `.env.local` (in `.gitignore`)
- `SUPABASE_SERVICE_ROLE_KEY` is server-side only (never exposed to client)
- Input validation prevents prompt injection
- Content filter protection via OpenAI moderation

### Production Considerations (Multi-Tenant)
- **Per-client setup**:
  - Create unique Pinecone Assistant per client
  - Upload client-specific HR documents
  - Configure unique `TENANT_ID` and storage bucket
- **Environment variables**:
  - Verify all variables set in Vercel/deployment platform
  - Never share Pinecone assistant names between clients
  - Use separate storage buckets per client
- **Monitoring**:
  - Monitor Supabase logs for incomplete requests (should be <1%)
  - Track costs per tenant using `tenant_id` column
  - Check cost analytics regularly (see [docs/SUPABASE_ANALYTICS.md](docs/SUPABASE_ANALYTICS.md))
- **Testing**:
  - Test with actual client HR documents before handoff
  - Verify citations link to correct PDFs
  - Confirm branding appears correctly

### Type Safety
- TypeScript strict mode enabled
- All Supabase types defined in [lib/supabase/types.ts](lib/supabase/types.ts)
- No `any` types except in legacy conversation history handling

### Build Configuration
- ESLint errors ignored during builds (`ignoreDuringBuilds: true`)
- TypeScript errors block builds (`ignoreBuildErrors: false`)
- PWA disabled in development mode for faster iteration
- Service worker only generated in production builds
- Config in [next.config.ts](next.config.ts)

## Documentation

### Multi-Tenant Deployment (NEW - v2.0)
- **[DEPLOYMENT_CHECKLIST.md](DEPLOYMENT_CHECKLIST.md)** - Step-by-step guide for new clients (30-45 min)
- **[MULTI_TENANT_ARCHITECTURE.md](MULTI_TENANT_ARCHITECTURE.md)** - Technical architecture details
- **[.env.example](.env.example)** - Complete environment variable reference
- **[docs/migrations/MULTI_TENANT_SETUP.sql](docs/migrations/MULTI_TENANT_SETUP.sql)** - Generic database schema
- **[MIGRATION_TO_V2.md](MIGRATION_TO_V2.md)** - Migrating from GeoStick to multi-tenant

### General Documentation
- **[README.md](README.md)** - Project overview, setup, features
- **[PROJECT_STRUCTURE.md](PROJECT_STRUCTURE.md)** - Detailed code structure and flow
- **[docs/README.md](docs/README.md)** - Complete setup guide
- **[docs/SUPABASE.md](docs/SUPABASE.md)** - Database schema and setup
- **[docs/SUPABASE_ANALYTICS.md](docs/SUPABASE_ANALYTICS.md)** - Analytics queries and insights
- **[docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)** - Production deployment guide
