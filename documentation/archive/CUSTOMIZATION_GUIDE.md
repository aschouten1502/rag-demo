# 🎨 Customization Guide - New Client Setup

> **Time Required**: 15-20 minutes
> **Difficulty**: Easy
> **Prerequisites**: Basic understanding of environment variables

This guide explains how to customize the HR Assistant AI for a new client. The platform is designed to be **multi-tenant** - you can deploy multiple instances with different branding and content by simply changing configuration files.

---

## 📋 Quick Checklist

- [ ] **Step 1**: Set up client's Pinecone Assistant with their HR docs
- [ ] **Step 2**: Configure environment variables (`.env.local`)
- [ ] **Step 3**: Customize branding (`lib/branding.config.ts`)
- [ ] **Step 4**: (Optional) Update example questions
- [ ] **Step 5**: Deploy to Vercel
- [ ] **Step 6**: Test with client

---

## 1️⃣ Step 1: Pinecone Assistant Setup (5 min)

### What You Need from Client:
- [ ] All HR documents in PDF format
- [ ] Document names and page numbers (for citation tracking)

### Steps:

1. **Log in to Pinecone** (https://www.pinecone.io)
   - Use Levtor account or create client-specific account

2. **Create New Assistant**
   - Click "+ New Assistant"
   - Name: `{client-name}-hr-assistant` (e.g., `acme-corp-hr-assistant`)
   - Model: `text-embedding-ada-002` (default)

3. **Upload HR Documents**
   - Upload all client PDFs
   - Wait for processing (5-15 min depending on document size)
   - Verify all documents are indexed

4. **Copy Assistant Details**
   ```
   Assistant Name: acme-corp-hr-assistant
   API Key: pcsk_xxxxx...
   ```

---

## 2️⃣ Step 2: Environment Variables (2 min)

### Create `.env.local` file:

```bash
# Copy from template
cp .env.example .env.local
```

### Fill in values:

```bash
# ============================================
# PINECONE (REQUIRED)
# ============================================
PINECONE_API_KEY=pcsk_xxxxx...
PINECONE_ASSISTANT_NAME=acme-corp-hr-assistant

# ============================================
# OPENAI (REQUIRED)
# ============================================
OPENAI_API_KEY=sk-proj-xxxxx...

# ============================================
# SUPABASE (OPTIONAL - for analytics)
# ============================================
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=xxxxx...
```

### Notes:
- **Pinecone**: Use client-specific assistant name
- **OpenAI**: Can reuse same key for all clients (billing tracked per org)
- **Supabase**: Optional but recommended for analytics. Create separate project per client OR use same project with client tagging.

---

## 3️⃣ Step 3: Branding Customization (5 min)

### Edit `lib/branding.config.ts`:

```typescript
export const BRANDING = {
  // ========================================
  // COMPANY INFORMATION
  // ========================================
  companyName: "Acme Corp HR Assistant",        // 👈 CHANGE THIS
  shortName: "Acme HR",                          // 👈 CHANGE THIS
  tagline: "Your Intelligent HR Assistant",     // 👈 OPTIONAL
  description: "AI-powered HR assistant for Acme Corp employees", // 👈 CHANGE THIS

  // ========================================
  // COLORS & STYLING
  // ========================================
  colors: {
    primary: "#FF6B35",           // 👈 Client brand color
    primaryDark: "#E55A2B",       // 👈 Darker variant (hover states)
    primaryLight: "#FF8555",      // 👈 Lighter variant (highlights)

    // Tailwind gradient (use same colors)
    gradient: "from-[#FF6B35] to-[#E55A2B]",

    // Browser theme color
    themeColor: "#FF6B35"
  },

  // ========================================
  // LOGO & ASSETS
  // ========================================
  logo: {
    main: "/logo.png",           // 👈 Replace file in /public
    icon: "/icon.png",           // 👈 Replace file in /public
    background: "/logo.png"
  },

  // ========================================
  // PWA SETTINGS
  // ========================================
  pwa: {
    name: "Acme Corp HR Assistant",
    shortName: "Acme HR",
    description: "AI-powered HR assistant for Acme Corp",
    themeColor: "#FF6B35",
    backgroundColor: "#ffffff",
    orientation: "portrait-primary" as const,
    display: "standalone" as const
  },

  // ========================================
  // URLS & METADATA
  // ========================================
  urls: {
    base: "https://hr-assistant.acmecorp.com",   // 👈 Client domain
    website: "https://acmecorp.com",
    support: "support@acmecorp.com"
  },

  // ========================================
  // FEATURES
  // ========================================
  features: {
    showPoweredBy: true,          // 👈 Set false to hide "Powered by Levtor"
    enableFeedback: false,        // 👈 Set true to enable feedback buttons
    enableAnalytics: true,
    showCostTracking: false       // 👈 Set true for cost visibility (dev mode)
  },

  version: "2.0.0"
};
```

### Color Picker Tips:
- Use client's brand guidelines
- Primary color should have good contrast with white text
- Test on mobile devices
- Common HR colors: Blue (#3B82F6), Green (#10B981), Navy (#1E3A8A)

---

## 4️⃣ Step 4: Example Questions (Optional, 3 min)

### Edit `app/translations.ts`:

Only change the **examples** array for the client's primary language(s):

```typescript
nl: {
  // ... other fields stay the same
  examples: [
    "Hoeveel vakantiedagen heb ik?",           // Keep generic
    "Wat is de thuiswerkregeling?",            // 👈 Add client-specific
    "Hoe claim ik mijn onkosten?",             // 👈 Add client-specific
    "Wanneer krijg ik mijn bonus uitbetaald?"  // 👈 Add client-specific
  ],
}
```

### Best Practices:
- Keep 4 examples max (UI constraint)
- Use questions clients actually ask
- Mix general (vacation) with specific (company policies)
- Test examples actually return good answers

---

## 5️⃣ Step 5: Logo & Assets (3 min)

### Replace PWA Icons:

**Option A: Use Client Logo**
1. Get client logo (PNG, square, high res)
2. Use online tool: https://favicon.io/favicon-converter/
3. Replace all files in `/public/icons/`
4. Replace `/public/Afbeeldingen/` logo

**Option B: Generate Generic Icons**
1. Use script: `npm run generate-icons`
2. Customize colors in `scripts/generate-icons.js`
3. Run: `node scripts/generate-icons.js`

### Required Sizes:
- 16x16, 32x32, 48x48 (favicons)
- 72x72, 96x96, 128x128, 144x144, 152x152 (PWA)
- 192x192, 384x384, 512x512 (Android)
- 180x180 (Apple Touch Icon)

---

## 6️⃣ Step 6: Deploy to Vercel (2 min)

### One-Click Deploy:

1. **Push to GitHub**
   ```bash
   git add .
   git commit -m "Setup for [Client Name]"
   git push origin main
   ```

2. **Connect to Vercel**
   - Go to https://vercel.com
   - Import Git repository
   - Project name: `{client-name}-hr-assistant`

3. **Add Environment Variables**
   - Copy all values from `.env.local`
   - Paste in Vercel dashboard → Settings → Environment Variables

4. **Deploy**
   - Click "Deploy"
   - Wait ~2 minutes
   - Visit URL and test

### Custom Domain (Optional):
1. Client provides domain or subdomain
2. Add in Vercel: Settings → Domains
3. Update DNS records (Vercel provides instructions)
4. Update `BRANDING.urls.base` in `lib/branding.config.ts`

---

## 7️⃣ Step 7: Testing Checklist

### Pre-Delivery Testing:

- [ ] **Branding**
  - [ ] Company name shows correctly
  - [ ] Colors match brand guidelines
  - [ ] Logo displays on all devices
  - [ ] PWA installs correctly (test on mobile)

- [ ] **Functionality**
  - [ ] Ask 5-10 test questions
  - [ ] Verify citations point to correct documents
  - [ ] Test all 4 example questions
  - [ ] Check responses in client's language

- [ ] **Analytics** (if Supabase enabled)
  - [ ] Logs appear in Supabase table
  - [ ] Cost tracking works
  - [ ] Session tracking works
  - [ ] No errors in Supabase logs

- [ ] **Performance**
  - [ ] Response time < 5 seconds
  - [ ] No console errors
  - [ ] Works on mobile (iOS & Android)
  - [ ] Works offline (PWA)

---

## 🔄 Updating Existing Client

If client wants to update their assistant (new documents, rebranding, etc.):

### Update Documents:
1. Add new PDFs to Pinecone Assistant
2. Delete outdated documents
3. Wait for re-indexing (5-15 min)
4. Test with questions about new content
5. No code changes needed! ✅

### Update Branding:
1. Edit `lib/branding.config.ts`
2. Replace logo files
3. Push to GitHub
4. Vercel auto-deploys in ~2 min

### Update Examples:
1. Edit `app/translations.ts`
2. Push to GitHub
3. Vercel auto-deploys

---

## 💰 Cost Estimates

### Per Client (1000 questions/month):

| Service | Cost/Month | Notes |
|---------|-----------|-------|
| Pinecone | $5 | Context retrieval (~5 tokens per question) |
| OpenAI | $3 | GPT-4o responses (~3 tokens per question) |
| Supabase | $0 | Free tier (500MB database) |
| Vercel | $0-20 | Free tier OK for <100k requests |
| **Total** | **~$8-28** | Depending on usage |

### Scaling:
- 10,000 questions/month: ~$80-100
- 100,000 questions/month: ~$800-1000
- Enterprise volume discounts available from Pinecone/OpenAI

---

## 🆘 Troubleshooting

### Problem: Bot returns generic answers (not using client docs)
**Solution**:
- Check Pinecone Assistant name matches `.env.local`
- Verify documents are indexed in Pinecone dashboard
- Test Pinecone query directly in dashboard

### Problem: Colors not updating
**Solution**:
- Hard refresh browser (Ctrl+Shift+R)
- Check Tailwind JIT generated classes
- Rebuild with `npm run build`

### Problem: Supabase logs not appearing
**Solution**:
- Check Service Role Key (not anon key!)
- Verify migrations ran successfully
- Check Supabase logs for errors
- Bot works without Supabase (logs to console)

### Problem: Slow responses
**Solution**:
- Check Pinecone region (should match Vercel region)
- Reduce `topK` in `lib/pinecone.ts` (currently 3)
- Check OpenAI API status
- Enable streaming (already enabled)

---

## 📞 Support

**For Levtor Team:**
- Internal wiki: [link]
- Slack channel: #hr-assistant-support

**For Clients:**
- Documentation: README.md
- Support email: support@levtor.com
- Response time: <24 hours

---

## 🎉 Success Checklist

Before marking client setup as complete:

- [ ] All environment variables configured
- [ ] Branding matches client guidelines
- [ ] Logo and colors updated
- [ ] 10+ test questions answered correctly
- [ ] PWA installs on mobile
- [ ] Analytics working (if enabled)
- [ ] Custom domain configured (if requested)
- [ ] Client trained on how to use bot
- [ ] Handoff documentation sent to client

---

**Next Steps**: See [README.md](README.md) for user documentation and [PROJECT_STRUCTURE.md](docs/guides/PROJECT_STRUCTURE.md) for technical details.
