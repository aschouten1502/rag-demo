# New Client Deployment Checklist

Complete guide for deploying the HR Assistant AI for a new client.

**Estimated Time**: 30-45 minutes per client
**Prerequisites**: Pinecone account, OpenAI API key, Supabase account (optional), Vercel account

---

## Pre-Deployment Checklist

- [ ] Client has provided HR documentation (PDFs, Word docs, etc.)
- [ ] Client has approved branding (company name, colors, logo)
- [ ] Client domain is ready (if using custom domain)
- [ ] All API keys have been obtained (Pinecone, OpenAI)
- [ ] Deployment strategy chosen (see options below)

---

## Deployment Options

### Option A: Separate Vercel Project (RECOMMENDED)
**Best for**: 1-50 clients, complete isolation, different update schedules
- Each client gets their own Vercel project
- Independent environment variables
- Client-specific domains
- Pros: Complete isolation, easy rollback, client-specific features
- Cons: Manual updates across projects

### Option B: Shared Infrastructure with Tenant ID
**Best for**: 50+ clients, SaaS model, centralized management
- Single Vercel deployment
- Tenant routing based on domain/subdomain
- Shared Supabase database with tenant_id
- Pros: Centralized updates, easier maintenance, lower cost
- Cons: More complex setup, shared resources

**This guide covers Option A (Separate Projects)**

---

## Step 1: Pinecone Setup (10 minutes)

### 1.1 Create Pinecone Assistant

1. Go to [Pinecone Console](https://app.pinecone.io)
2. Click **Assistants** → **Create Assistant**
3. Configure:
   - **Name**: `{client-slug}-hr-assistant` (e.g., `acme-corp-hr-assistant`)
   - **Model**: Recommended default
   - **Embedding Model**: Keep default
4. Click **Create**

### 1.2 Upload Client Documents

1. Open the created assistant
2. Click **Upload Files**
3. Upload all client HR documents:
   - Employee handbooks
   - Policies and procedures
   - Benefits documentation
   - Any relevant HR PDFs/docs
4. Wait for indexing to complete (usually 2-5 minutes)
5. Test with a sample question to verify

### 1.3 Copy Configuration

- [ ] Copy **API Key** (starts with `pcsk_`)
- [ ] Copy **Assistant Name** (e.g., `acme-corp-hr-assistant`)

**Save these values** - you'll need them for environment variables.

---

## Step 2: Supabase Setup (15 minutes) - OPTIONAL

> **Note**: The app works WITHOUT Supabase (logs go to console only). Supabase is only needed for analytics and logging.

### 2.1 Choose Database Strategy

**Option A: Shared Database (Recommended for multiple clients)**
- Use same Supabase project for all clients
- Set `TENANT_ID={client-slug}` per deployment
- Table name: `chat_logs` (generic)
- Row-level tenant isolation

**Option B: Separate Database per Client**
- Create new Supabase project per client
- Complete data isolation
- Higher cost, simpler security

**This guide covers Option A (Shared Database)**

### 2.2 Create/Use Supabase Project

**If first client** (create new project):
1. Go to [Supabase Dashboard](https://app.supabase.com)
2. Click **New Project**
3. Configure:
   - **Name**: `hr-assistant-multi-tenant` (or your preferred name)
   - **Database Password**: Generate strong password
   - **Region**: Choose closest to clients
4. Wait for project creation (~2 minutes)

**If subsequent clients** (use existing project):
- Skip to Step 2.3

### 2.3 Run Database Migration

1. In Supabase dashboard, go to **SQL Editor**
2. Click **New Query**
3. Copy contents of `docs/migrations/MULTI_TENANT_SETUP.sql`
4. Paste into SQL editor
5. Click **Run**
6. Verify success:
   ```sql
   SELECT * FROM chat_logs LIMIT 1;
   ```
   Should return empty result (no error)

### 2.4 Create Storage Bucket for PDFs

1. Go to **Storage** in Supabase dashboard
2. Click **Create Bucket**
3. Configure:
   - **Name**: `{client-slug}-hr-documents` (e.g., `acme-corp-hr-documents`)
   - **Public**: ✅ **YES** (required for citation links)
   - **File size limit**: 50 MB
   - **Allowed MIME types**: `application/pdf`
4. Click **Create Bucket**

### 2.5 Upload Client PDFs to Storage

1. Open the created bucket
2. Click **Upload Files**
3. Upload all client HR PDFs (same ones uploaded to Pinecone)
4. Verify files are accessible

### 2.6 Copy Configuration

- [ ] Copy **Project URL** (e.g., `https://xxxxx.supabase.co`)
- [ ] Copy **Service Role Key** (Settings → API → `service_role` key)
- [ ] Note **Bucket Name** (e.g., `acme-corp-hr-documents`)

**Save these values** - you'll need them for environment variables.

---

## Step 3: Branding Customization (5 minutes)

### 3.1 Collect Branding Information

Get from client:
- [ ] Company name (e.g., "Acme Corporation")
- [ ] Short name for mobile (e.g., "Acme HR")
- [ ] Primary brand color (hex code, e.g., `#FF5733`)
- [ ] Logo files (if available):
  - Square icon: 192x192px PNG (for PWA)
  - Optional: 512x512px PNG (for high-res PWA)

### 3.2 Prepare Logo Files (if provided)

1. Rename client logo to `icon-192x192.png`
2. If high-res available, rename to `icon-512x512.png`
3. Save locally - you'll upload to Vercel later

---

## Step 4: Environment Configuration (5 minutes)

### 4.1 Create `.env.local` File

1. Copy template from `.env.example`
2. Fill in values:

```bash
# ============================================
# TENANT CONFIGURATION
# ============================================
TENANT_ID=acme-corp                    # Lowercase with dashes
TENANT_NAME=Acme Corporation

# ============================================
# PINECONE
# ============================================
PINECONE_API_KEY=pcsk_xxxxx           # From Step 1.3
PINECONE_ASSISTANT_NAME=acme-corp-hr-assistant  # From Step 1.3

# ============================================
# OPENAI
# ============================================
OPENAI_API_KEY=sk-proj-xxxxx          # Your OpenAI API key

# ============================================
# SUPABASE (Optional - skip if not using)
# ============================================
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co  # From Step 2.6
SUPABASE_SERVICE_ROLE_KEY=xxxxx       # From Step 2.6
SUPABASE_TABLE_NAME=chat_logs         # Generic table for shared DB
STORAGE_BUCKET_NAME=acme-corp-hr-documents  # From Step 2.4

# ============================================
# BRANDING (Optional - can use branding.config.ts instead)
# ============================================
NEXT_PUBLIC_COMPANY_NAME=Acme Corporation
NEXT_PUBLIC_COMPANY_SHORT=Acme HR
NEXT_PUBLIC_PRIMARY_COLOR=#FF5733     # Client brand color
NEXT_PUBLIC_PRIMARY_DARK=#D64525      # Darker variant (optional)
```

### 4.2 Alternative: Edit `lib/branding.config.ts`

If NOT using environment variables for branding:

1. Open `lib/branding.config.ts`
2. Update values directly:
   ```typescript
   companyName: "Acme Corporation",
   shortName: "Acme HR",
   colors: {
     primary: "#FF5733",
     // ...
   }
   ```

**Recommendation**: Use environment variables (Step 4.1) for easier multi-tenant management.

---

## Step 5: Vercel Deployment (10 minutes)

### 5.1 Create New Vercel Project

1. Go to [Vercel Dashboard](https://vercel.com)
2. Click **Add New** → **Project**
3. **Import Git Repository**:
   - If first deployment: Import this repository
   - If subsequent: **Clone** the project or use same repo with different config
4. Configure:
   - **Project Name**: `acme-corp-hr-assistant` (client-specific)
   - **Framework Preset**: Next.js (auto-detected)
   - **Root Directory**: `./`
   - **Build Command**: `npm run build`
   - **Output Directory**: `.next`

### 5.2 Add Environment Variables

1. In Vercel project settings, go to **Environment Variables**
2. Add ALL variables from your `.env.local` (Step 4.1):

For each variable:
- Click **Add**
- Enter **Key** (e.g., `TENANT_ID`)
- Enter **Value** (e.g., `acme-corp`)
- Select **All Environments** (Production, Preview, Development)
- Click **Save**

**Critical variables** (must be set):
- ✅ `TENANT_ID`
- ✅ `PINECONE_API_KEY`
- ✅ `PINECONE_ASSISTANT_NAME`
- ✅ `OPENAI_API_KEY`

**Optional variables** (if using Supabase):
- `NEXT_PUBLIC_SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_TABLE_NAME`
- `STORAGE_BUCKET_NAME`

**Branding variables** (if not editing config file):
- `NEXT_PUBLIC_COMPANY_NAME`
- `NEXT_PUBLIC_COMPANY_SHORT`
- `NEXT_PUBLIC_PRIMARY_COLOR`

### 5.3 Upload Logo Files (if provided)

1. Before deploying, replace logo files in `/public/icons/`:
   - Replace `icon-192x192.png` with client logo
   - Replace `icon-512x512.png` if available
2. Commit and push to repository

OR:

1. After deployment, use Vercel's file upload feature
2. Upload to `/public/icons/` directory

### 5.4 Deploy

1. Click **Deploy**
2. Wait for build to complete (~2-3 minutes)
3. Verify deployment succeeded

---

## Step 6: Testing & Verification (5 minutes)

### 6.1 Basic Functionality Tests

Visit the deployed URL and test:

- [ ] **Page loads** without errors
- [ ] **Branding** shows client name and colors
- [ ] **Language selector** works (switch between languages)
- [ ] **Ask test questions**:
  - General HR question (e.g., "What are the vacation policies?")
  - Specific document question (e.g., "What is the sick leave policy?")
  - Non-HR question (should be rejected)
- [ ] **Citations appear** below answers with correct document names
- [ ] **PDF links work** (click citation → opens PDF)
- [ ] **Mobile view** works correctly

### 6.2 Verify Configuration

Open browser console and check:

```javascript
// Should log tenant configuration
// Look for: "🔧 [Supabase] Multi-tenant configuration"
```

Expected output:
```
{
  tenant: { id: 'acme-corp', name: 'Acme Corporation' },
  database: { table: 'chat_logs', tenantIdEnabled: true },
  storage: { bucket: 'acme-corp-hr-documents' }
}
```

### 6.3 Verify Supabase Logging (if enabled)

1. Go to Supabase dashboard
2. Navigate to **Table Editor** → `chat_logs`
3. Refresh table
4. Verify recent test questions appear
5. Check `tenant_id` column shows correct value (`acme-corp`)

### 6.4 Cost Estimation Verification

After 5-10 test questions:

1. Check Supabase `chat_logs` table
2. Review `total_cost` column
3. Expected: ~$0.008-0.015 per question
   - Pinecone: ~$0.005
   - OpenAI: ~$0.003-0.010

---

## Step 7: Custom Domain Setup (Optional, 10 minutes)

### 7.1 Configure Domain in Vercel

1. In Vercel project, go to **Settings** → **Domains**
2. Click **Add Domain**
3. Enter client domain (e.g., `hr-assistant.acme-corp.com`)
4. Click **Add**

### 7.2 Update DNS Records

Provide client with DNS instructions:

**If using subdomain** (e.g., `hr.acme-corp.com`):
```
Type: CNAME
Name: hr
Value: cname.vercel-dns.com
```

**If using root domain** (e.g., `acme-hr.com`):
```
Type: A
Name: @
Value: 76.76.21.21

Type: CNAME
Name: www
Value: cname.vercel-dns.com
```

### 7.3 Verify SSL

1. Wait 1-5 minutes for DNS propagation
2. Verify SSL certificate is active (green padlock)
3. Test `https://` access

---

## Step 8: Client Handoff (5 minutes)

### 8.1 Share Access Credentials

Provide client with:

- [ ] **Deployed URL** (e.g., `https://acme-corp-hr-assistant.vercel.app`)
- [ ] **Custom domain** (if configured)
- [ ] **Mobile installation instructions**:
  - iOS: Open in Safari → Share → Add to Home Screen
  - Android: Open in Chrome → Menu → Install App

### 8.2 Documentation for Client

Share these docs:
- [ ] `README.md` - Overview and features
- [ ] User guide (optional - create based on README)
- [ ] Contact for support

### 8.3 Analytics Access (Optional)

If client wants analytics access:
1. Invite client to Supabase project (Settings → Team)
2. Grant read-only access to `chat_logs` table
3. Share analytics queries from `docs/SUPABASE_ANALYTICS.md`

---

## Post-Deployment Monitoring

### Week 1 Checklist

- [ ] **Day 1**: Verify 10+ real user questions logged
- [ ] **Day 3**: Review `is_complete` rate (should be >99%)
- [ ] **Day 7**: Check average costs per request
- [ ] **Day 7**: Review client feedback

### Ongoing Monitoring

**Weekly**:
- [ ] Check error logs in Vercel
- [ ] Review cost analytics in Supabase
- [ ] Monitor OpenAI API usage

**Monthly**:
- [ ] Review total costs per tenant
- [ ] Check for incomplete logs
- [ ] Update client documents if needed

### Common Issues & Solutions

| Issue | Cause | Solution |
|-------|-------|----------|
| No citations appear | Storage bucket not public | Make bucket public in Supabase |
| PDF links broken | Wrong bucket name in env | Update `STORAGE_BUCKET_NAME` |
| Incorrect answers | Documents not indexed in Pinecone | Re-upload documents to Pinecone |
| High costs | Too many tokens per request | Reduce Pinecone `topK` (default: 3) |
| Logs not saving | Supabase credentials wrong | Verify `SUPABASE_SERVICE_ROLE_KEY` |
| Tenant logs mixed | Missing `TENANT_ID` | Set `TENANT_ID` environment variable |

---

## Troubleshooting

### Build Fails in Vercel

**Error**: `Module not found` or `Type error`

**Solutions**:
1. Check all dependencies installed: `npm install`
2. Verify TypeScript errors: `npx tsc --noEmit`
3. Check Next.js version compatibility
4. Review Vercel build logs for specific errors

### Supabase Connection Issues

**Error**: Logs not appearing in database

**Solutions**:
1. Verify `NEXT_PUBLIC_SUPABASE_URL` is correct (not the `supabase.co/dashboard` URL)
2. Check `SUPABASE_SERVICE_ROLE_KEY` is service role (not anon key)
3. Ensure table `chat_logs` exists
4. Check Vercel environment variables are set for Production

### Pinecone Errors

**Error**: `Assistant not found` or `No context retrieved`

**Solutions**:
1. Verify `PINECONE_ASSISTANT_NAME` matches exactly (case-sensitive)
2. Check documents are indexed in Pinecone dashboard
3. Test assistant in Pinecone console with sample question
4. Verify `PINECONE_API_KEY` is correct and active

---

## Cost Optimization Tips

### Reduce Pinecone Costs
- Lower `topK` value in `lib/pinecone.ts` (default: 3)
- Reduce document overlap when uploading
- Archive old/unused documents

### Reduce OpenAI Costs
- Switch to `gpt-4o-mini` in `lib/openai.ts` (90% cheaper, good quality)
- Reduce system prompt length
- Limit conversation history length

### Reduce Supabase Costs
- Use shared Supabase project (not per-client)
- Clean up old logs with `cleanup_old_logs(90)` function
- Use Supabase free tier (500MB storage, sufficient for most)

---

## Rollback Procedure

If deployment has critical issues:

1. **Vercel**: Go to **Deployments** → Click previous working deployment → **Promote to Production**
2. **Environment Variables**: Revert to previous values if changed
3. **Database**: Restore from Supabase backup (if available)
4. **Notify Client**: Inform of temporary rollback and ETA for fix

---

## Multi-Client Management Tools

### Tracking Spreadsheet (Recommended)

Create spreadsheet with columns:
- Client Name
- Tenant ID
- Vercel Project URL
- Custom Domain
- Deployment Date
- Pinecone Assistant Name
- Supabase Bucket Name
- Monthly Cost Estimate
- Support Contact
- Last Updated

### Cost Dashboard (Optional)

Query all tenants' costs:
```sql
SELECT * FROM get_tenant_stats();
```

Export to CSV and visualize in Excel/Google Sheets.

---

## Next Steps

After successful deployment:

1. **Schedule check-in** with client (Week 1)
2. **Review usage analytics** (Week 2)
3. **Collect feedback** for improvements
4. **Plan next client deployment** using this checklist

---

## Support & Maintenance

**For Levtor Internal Team**:
- Deployment issues: See Vercel logs
- Database issues: Check Supabase dashboard
- Code updates: Push to main branch → Vercel auto-deploys

**For Clients**:
- Provide support email/contact
- Document common user questions
- Offer optional training sessions

---

**Deployment Complete!** ✅

Client is now live with their own multi-tenant HR Assistant AI instance.
