# 🤖 HR Assistant AI

**Version 2.0.0** - Multi-tenant White-Label HR Chatbot

> Transform your HR documentation into an intelligent AI assistant that answers employee questions 24/7 in 12 languages.

[![Next.js](https://img.shields.io/badge/Next.js-15.5-black)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-19-blue)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-blue)](https://www.typescriptlang.org/)
[![License](https://img.shields.io/badge/License-Proprietary-red)]()

---

## 🎯 What is HR Assistant AI?

An **enterprise-grade RAG (Retrieval-Augmented Generation)** chatbot that:

- 📚 Learns from your HR documents (PDFs)
- 🤖 Answers employee questions using AI (GPT-4o)
- 🌍 Supports 12 languages automatically
- 📱 Works as mobile app (PWA)
- 📊 Tracks costs and analytics
- 🎨 Fully white-labelable per client

**Perfect for**: HR teams, employee onboarding, policy Q&A, benefits explanations, and reducing HR support tickets.

---

## ✨ Key Features

### 🧠 Intelligent Answers
- **RAG Technology**: Retrieves relevant context from your docs before answering
- **Accurate Responses**: Only uses information from your documents (no hallucination)
- **Citations**: Shows source documents and page numbers
- **Multi-turn Conversations**: Remembers conversation history

### 🌐 Multi-Language Support
12 languages included:
- 🇳🇱 Nederlands
- 🇬🇧 English
- 🇩🇪 Deutsch
- 🇫🇷 Français
- 🇪🇸 Español
- 🇮🇹 Italiano
- 🇵🇱 Polski
- 🇹🇷 Türkçe
- 🇸🇦 العربية
- 🇨🇳 中文
- 🇵🇹 Português
- 🇷🇴 Română

### 📱 Modern User Experience
- **Progressive Web App (PWA)**: Install on any device
- **Offline Support**: Works without internet (cached)
- **Mobile-First Design**: Optimized for phones and tablets
- **Streaming Responses**: Real-time answer generation
- **Dark Mode Ready**: (Coming soon)

### 📊 Analytics & Monitoring
- **Cost Tracking**: Per-question cost breakdown
- **Usage Analytics**: Questions, sessions, popular docs
- **Performance Monitoring**: Response times, error rates
- **Feedback Collection**: (Optional) User satisfaction tracking

### 🎨 White-Label Ready
- **Customizable Branding**: Colors, logo, company name
- **Multi-Tenant Architecture**: Easy per-client deployment
- **Environment-Based Config**: Change settings without code changes

---

## 🚀 Quick Start (5 Minutes)

### Prerequisites

- Node.js 18+ and npm
- Pinecone account (for document storage)
- OpenAI API key (for AI responses)
- (Optional) Supabase account (for analytics)

### 1. Clone Repository

```bash
git clone https://github.com/your-org/hr-assistant-ai.git
cd hr-assistant-ai
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Configure Environment

```bash
# Copy example file
cp .env.example .env.local

# Edit .env.local with your values
# See .env.example for detailed instructions
```

Required variables:
```bash
PINECONE_API_KEY=pcsk_xxxxx
PINECONE_ASSISTANT_NAME=your-assistant-name
OPENAI_API_KEY=sk-xxxxx
```

### 4. Upload Your HR Documents

1. Create Pinecone Assistant at https://www.pinecone.io
2. Upload your HR PDFs
3. Copy Assistant name to `.env.local`

### 5. Run Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) and start asking questions!

---

## 📖 Full Documentation

### Getting Started
- **[QUICK_START.md](QUICK_START.md)** - 15-20 minute setup with CLIENT_CONFIG.md workflow ⭐
- **[CLIENT_CONFIG.example.md](CLIENT_CONFIG.example.md)** - Client configuration template ⭐
- **[CLAUDE.md](CLAUDE.md)** - Claude Code automation instructions ⭐
- **[.env.example](.env.example)** - Environment variable reference

### Extended Documentation
- **[documentation/](documentation/)** - Organized documentation library
  - [Setup & Deployment](documentation/setup/)
  - [Branding & Customization](documentation/branding/)
  - [Technical Documentation](documentation/technical/)
  - [Scaling Guide](documentation/guides/SCALING_GUIDE.md)

---

## 🏗️ Architecture

```
User Question
    ↓
Next.js API Route (app/api/chat/route.ts)
    ↓
Pinecone Assistant → Retrieve top 3 relevant snippets
    ↓
System Prompt Generation → Inject context + guardrails
    ↓
OpenAI GPT-4o → Generate streaming answer
    ↓
Response + Citations → Frontend
    ↓
Supabase Logging → Analytics (optional)
```

### Tech Stack

- **Framework**: Next.js 15 (App Router)
- **Language**: TypeScript 5
- **Styling**: Tailwind CSS 4
- **Vector DB**: Pinecone Assistant
- **LLM**: OpenAI GPT-4o
- **Database**: Supabase (PostgreSQL)
- **PWA**: @ducanh2912/next-pwa
- **Deployment**: Vercel (recommended)

---

## 💰 Cost Tracking

The application tracks costs per query:
- **Pinecone**: Context retrieval tokens
- **OpenAI**: Input and output tokens

View detailed cost breakdowns in:
- Developer sidebar (during chat)
- Supabase analytics dashboard
- [Analytics Documentation](documentation/technical/SUPABASE_ANALYTICS.md)

**Cost Optimization Tips**:
- Use `gpt-4o-mini` for lower costs (90% cheaper)
- Reduce `topK` in `lib/pinecone.ts` (currently 3)
- Limit conversation history (currently 10 messages)
- Monitor usage per client via Supabase

---

## 🎨 Multi-Tenant Deployment

**New in v2.0**: Automated client setup with CLIENT_CONFIG.md workflow!

### Quick Setup (15-20 minutes)

1. **Copy configuration template**:
   ```bash
   cp CLIENT_CONFIG.example.md CLIENT_CONFIG.md
   ```

2. **Fill in client details**:
   - Tenant ID and company name
   - Branding (colors, logo)
   - API keys (Pinecone, OpenAI)
   - Supabase settings (optional)

3. **Share with Claude Code**:
   ```
   "Configureer deze client op basis van CLIENT_CONFIG.md"
   ```

4. **Claude Code automatically**:
   - Generates `.env.local`
   - Sets up Supabase (if configured)
   - Validates configuration
   - Reports manual steps needed

See **[QUICK_START.md](QUICK_START.md)** for complete instructions.

### Manual Setup

See **[documentation/setup/DEPLOYMENT_GUIDE.md](documentation/setup/DEPLOYMENT_GUIDE.md)** for step-by-step manual deployment.

**Total time: 15-20 minutes**

---

## 📱 PWA Installation

### iOS (iPhone/iPad)

1. Open in Safari
2. Tap Share button
3. Tap "Add to Home Screen"
4. Tap "Add"

### Android

1. Open in Chrome
2. Tap menu (⋮)
3. Tap "Add to Home Screen"
4. Tap "Add"

### Desktop (Chrome/Edge)

1. Click install icon (⊕) in address bar
2. Click "Install"

---

## 🔧 Development

### Available Scripts

```bash
npm run dev          # Start dev server (http://localhost:3000)
npm run build        # Build for production
npm run start        # Start production server
npm run lint         # Run ESLint
npx tsc --noEmit     # TypeScript type checking
```

### Project Structure

```
├── app/
│   ├── api/chat/          # Main API endpoint
│   ├── components/        # React components
│   ├── translations.ts    # 12-language translations
│   └── page.tsx           # Main chat interface
├── lib/
│   ├── branding.config.ts # 🎨 Branding configuration
│   ├── pinecone.ts        # Context retrieval
│   ├── openai.ts          # LLM streaming
│   ├── prompts.ts         # System prompts
│   ├── logging.ts         # Error handling
│   └── supabase/          # Database integration
├── public/                # Static assets
├── docs/                  # Documentation
├── .env.example           # Environment template
└── CUSTOMIZATION_GUIDE.md # Client setup guide
```

---

## 🛠️ Troubleshooting

### Bot returns generic answers
- ✅ Check Pinecone Assistant name matches `.env.local`
- ✅ Verify documents are indexed in Pinecone dashboard

### Colors not updating
- ✅ Hard refresh browser (Ctrl+Shift+R)
- ✅ Rebuild with `npm run build`

### Slow responses
- ✅ Check Pinecone region matches Vercel region
- ✅ Reduce `topK` in `lib/pinecone.ts`

### Supabase logs not appearing
- ✅ Check Service Role Key (not anon key!)
- ✅ Verify migrations ran successfully
- ✅ Bot works without Supabase (logs to console)

See [CUSTOMIZATION_GUIDE.md](CUSTOMIZATION_GUIDE.md) for more troubleshooting.

---

## 🔐 Security

- ✅ All secrets in `.env.local` (not committed)
- ✅ Service Role Key is server-side only
- ✅ Input validation prevents prompt injection
- ✅ Content filter protection (OpenAI)
- ✅ No user data stored (unless Supabase enabled)
- ✅ HTTPS required in production

### Production Checklist
- [ ] Change all API keys from dev/demo
- [ ] Enable CORS restrictions
- [ ] Set up rate limiting
- [ ] Configure custom domain
- [ ] Enable Vercel authentication (for internal tools)

---

## 📊 Analytics Dashboards

If Supabase is enabled, you get:

- **Session Analytics**: Question count, response times, cost per session
- **Document Usage**: Most cited documents and pages
- **Performance Metrics**: P50/P90/P95 response times
- **Cost Analytics**: Daily/monthly cost breakdowns
- **Error Monitoring**: Failed requests, incomplete logs

See [docs/SUPABASE_ANALYTICS.md](docs/SUPABASE_ANALYTICS.md) for SQL queries.

---

## 🚀 Deployment

### Vercel (Recommended)

1. Push to GitHub
2. Import to Vercel
3. Add environment variables
4. Deploy

See [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) for detailed instructions.

### Other Platforms

Works on any Node.js hosting:
- AWS Amplify
- Azure Static Web Apps
- Railway
- Render
- Docker (Coming soon)

---

## 🤝 Support & Contributing

### For Levtor Team
- Internal docs: [wiki link]
- Slack: #hr-assistant-support

### For Clients
- Email: support@levtor.com
- Response time: <24 hours

### Contributing
This is proprietary software. Internal contributions only.

---

## 📄 License

**Proprietary** - © 2025 Levtor. All rights reserved.

This software is provided to clients under a commercial license.
Unauthorized copying, distribution, or modification is prohibited.

---

## 🎉 Success Stories

> "Reduced HR support tickets by 60% in the first month!"
> — HR Director, Tech Company (250 employees)

> "Employees love having 24/7 access to HR policies in their own language."
> — CHRO, International Manufacturing (1,200 employees)

> "Setup took 15 minutes. Best investment we made this year."
> — Startup Founder (50 employees)

---

## 🗺️ Roadmap

- [ ] **v2.1**: Dark mode support
- [ ] **v2.2**: Voice input/output
- [ ] **v2.3**: Advanced analytics dashboard
- [ ] **v2.4**: Microsoft Teams integration
- [ ] **v2.5**: Slack integration
- [ ] **v3.0**: Multi-document chat (compare policies)

---

## 📞 Contact

**Levtor**
- Website: https://levtor.com
- Email: info@levtor.com
- Support: support@levtor.com

---

**Built with ❤️ by [Levtor](https://levtor.com)** | **Powered by Next.js, OpenAI & Pinecone**
