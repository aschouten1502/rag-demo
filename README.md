# HR Assistant AI

**Version 2.2.0** - Multi-tenant White-Label HR Chatbot with Supabase RAG

> Transform your HR documentation into an intelligent AI assistant that answers employee questions 24/7 in 12 languages.

[![Next.js](https://img.shields.io/badge/Next.js-15.5-black)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-19-blue)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-blue)](https://www.typescriptlang.org/)
[![License](https://img.shields.io/badge/License-Proprietary-red)]()

---

## What is HR Assistant AI?

An **enterprise-grade RAG (Retrieval-Augmented Generation)** chatbot that:

- Learns from your HR documents (PDFs) with **smart chunking**
- Answers employee questions using AI (GPT-4o)
- Supports **12 languages** with automatic query translation
- Works as mobile app (PWA)
- Tracks costs and analytics with **comprehensive logging**
- Fully white-labelable per client with **Admin Dashboard**

**Perfect for**: HR teams, employee onboarding, policy Q&A, benefits explanations, and reducing HR support tickets.

---

## Key Features (v2.2)

### Supabase RAG (NEW in v2.1)
- **pgvector Search**: 99.6% cheaper than Pinecone
- **Smart Chunking**: Fixed, smart, and semantic strategies
- **Query Translation**: Non-English queries translated for better search
- **Cohere Reranking**: Optional relevance improvement
- **RAG Details Logging**: 200+ fields for debugging

### Admin Dashboard (NEW in v2.0)
- **Tenant Management**: Create, edit, delete tenants
- **Branding Editor**: Live preview with color picker
- **Cost Analytics**: Per-tenant cost breakdown
- **Chat Logs Viewer**: Debug with RAG details
- **Document Management**: Upload and manage PDFs

### Multi-Tenant Architecture
- **Middleware Detection**: Subdomain, query param, header, or env
- **Isolated Data**: Each tenant has separate documents and logs
- **Database-Driven Config**: Tenant settings stored in Supabase
- **Client-Side Context**: TenantProvider for React components

### 12-Language Support
- Nederlands, English, Deutsch, Francais
- Espanol, Italiano, Polski, Turkce
- Arabic, Chinese, Portugues, Romana

### Modern UX
- **PWA**: Install on any device
- **Streaming Responses**: Real-time answer generation
- **Citations**: Source documents and page numbers
- **Conversation Memory**: Multi-turn conversations

---

## Quick Start (10 Minutes)

### Prerequisites

- Node.js 18+ and npm
- Supabase account (free tier works)
- OpenAI API key
- (Optional) Cohere API key for reranking

### 1. Clone & Install

```bash
git clone https://github.com/your-org/hr-assistant-ai.git
cd hr-assistant-ai
npm install
```

### 2. Configure Environment

```bash
cp .env.example .env.local
```

Edit `.env.local`:
```bash
# Required
TENANT_ID=acme-corp
TENANT_NAME=Acme Corporation
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ...
OPENAI_API_KEY=sk-...

# Optional
COHERE_API_KEY=...  # For reranking
NEXT_PUBLIC_COMPANY_NAME=Acme Corporation
NEXT_PUBLIC_PRIMARY_COLOR=#0066CC
```

### 3. Setup Database

Run migrations in Supabase SQL Editor:
- `lib/supabase/migrations/rag_schema.sql`
- `docs/migrations/MULTI_TENANT_SETUP.sql`

### 4. Run Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

### 5. Upload Documents

Use Admin Dashboard at `/admin` or API:
```bash
curl -X POST http://localhost:3000/api/rag/upload \
  -F "file=@document.pdf" \
  -F "tenant_id=acme-corp"
```

---

## Architecture

```
User Question
    |
middleware.ts --> Tenant Detection
    |
API Route (app/api/chat/route.ts)
    |
lib/rag/context.ts --> Supabase pgvector
    |-- Query Translation (non-English)
    |-- Embedding (text-embedding-3-small)
    |-- Vector Search (cosine similarity)
    |-- Cohere Reranking (optional)
    |
System Prompt (lib/prompts.ts)
    |
OpenAI GPT-4o --> Streaming response
    |
Supabase Logging (rag_details JSONB)
```

### Tech Stack

| Component | Technology |
|-----------|------------|
| Framework | Next.js 15 (App Router) |
| Language | TypeScript 5 |
| Styling | Tailwind CSS 4 |
| Vector DB | Supabase pgvector |
| Embeddings | OpenAI text-embedding-3-small |
| Reranking | Cohere (optional) |
| LLM | OpenAI GPT-4o |
| Database | Supabase (PostgreSQL) |
| PWA | @ducanh2912/next-pwa |

---

## Cost Tracking

### Per-Request Costs

| Component | Cost | Notes |
|-----------|------|-------|
| Embedding | $0.02/1M tokens | text-embedding-3-small |
| Reranking | $1/1000 searches | Cohere (optional) |
| OpenAI | $2.50 input, $10 output/1M | GPT-4o |

### Cost Savings vs Pinecone

- **Pinecone**: $5/1M tokens + $0.05/hour
- **Supabase pgvector**: $0.02/1M tokens
- **Savings**: ~99.6%

---

## Project Structure

```
app/
  api/
    chat/           # Main chat endpoint
    admin/          # Admin API routes
    rag/            # Document upload/management
    tenant/         # Tenant config API
  admin/            # Admin dashboard pages
  providers/        # TenantProvider context
  components/       # UI components

lib/
  rag/              # RAG system (11 files)
    context.ts      # Vector search
    embeddings.ts   # OpenAI embeddings
    chunking.ts     # Document chunking
    processor.ts    # Upload pipeline
    reranker.ts     # Cohere reranking
    query-translator.ts  # Multi-language
  admin/            # Admin services (9 files)
  supabase/         # Database client
  tenant-config.ts  # Tenant configuration

middleware.ts       # Tenant detection
```

---

## Documentation

### Setup & Deployment
- **[CLAUDE.md](CLAUDE.md)** - Developer guide (Claude Code)
- **[docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)** - Production deployment
- **[docs/RAG_SYSTEM.md](docs/RAG_SYSTEM.md)** - RAG architecture
- **[docs/ADMIN_GUIDE.md](docs/ADMIN_GUIDE.md)** - Admin dashboard

### Database
- **[docs/SUPABASE.md](docs/SUPABASE.md)** - Database schema
- **[docs/SUPABASE_ANALYTICS.md](docs/SUPABASE_ANALYTICS.md)** - Analytics queries
- **[docs/migrations/](docs/migrations/)** - SQL migrations

### Quick Setup
- **[QUICK_START.md](QUICK_START.md)** - 15-20 min setup
- **[CLIENT_CONFIG.example.md](CLIENT_CONFIG.example.md)** - Config template
- **[.env.example](.env.example)** - Environment reference

---

## Admin Dashboard

Access at `/admin`:

| Route | Purpose |
|-------|---------|
| `/admin` | Dashboard with stats |
| `/admin/tenants` | Manage tenants |
| `/admin/tenants/new` | Create tenant |
| `/admin/branding/[id]` | Edit branding |
| `/admin/logs` | View chat logs |
| `/admin/costs` | Cost analytics |

---

## Multi-Tenant Deployment

### Automated Setup with Claude Code

```bash
cp CLIENT_CONFIG.example.md CLIENT_CONFIG.md
# Fill in client details
# Then: "Configureer deze client op basis van CLIENT_CONFIG.md"
```

### Manual Setup

1. Create tenant in Admin Dashboard
2. Upload documents via `/admin/tenants/[id]`
3. Configure branding
4. Deploy to Vercel

---

## PWA Installation

### iOS
1. Open in Safari
2. Tap Share > "Add to Home Screen"

### Android
1. Open in Chrome
2. Tap menu > "Add to Home Screen"

### Desktop
1. Click install icon in address bar

---

## Development

```bash
npm run dev          # Start dev server
npm run build        # Build for production
npm run lint         # Run ESLint
npx tsc --noEmit     # Type check
```

---

## Security

- Secrets in `.env.local` (not committed)
- Service Role Key server-side only
- Input validation prevents injection
- Content filter via OpenAI
- Tenant isolation at database level

---

## Deployment

### Vercel (Recommended)

1. Push to GitHub
2. Import to Vercel
3. Add environment variables
4. Deploy

See [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) for details.

---

## Changelog

### v2.2.0 (Current)
- Query translation for multi-language search
- Enhanced RAG details logging
- Cohere reranking support

### v2.1.0
- Supabase pgvector RAG (replaced Pinecone)
- 99.6% cost reduction

### v2.0.0
- Admin Dashboard
- Multi-tenant architecture
- Middleware tenant detection

### v1.x
- Original GeoStick implementation
- Pinecone-based RAG

---

## License

**Proprietary** - 2025 Levtor. All rights reserved.

---

## Contact

**Levtor**
- Website: https://levtor.com
- Email: support@levtor.com

---

**Built with Next.js, OpenAI & Supabase pgvector**
