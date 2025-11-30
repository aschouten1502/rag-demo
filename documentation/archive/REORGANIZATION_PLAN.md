# Documentation Reorganization Plan

## Current State Analysis

### Root Level Files (13 MD files)
✅ **KEEP - Core Files:**
1. `README.md` - Main project overview
2. `CLAUDE.md` - Instructions for Claude Code (CRITICAL)
3. `CLIENT_CONFIG.example.md` - New workflow template (CRITICAL)
4. `QUICK_START.md` - New 15-min setup guide (CRITICAL)

⚠️ **NEEDS REVIEW:**
5. `CUSTOMIZATION_GUIDE.md` - Overlaps with new CLIENT_CONFIG workflow?
6. `DEPLOYMENT_CHECKLIST.md` - Still useful or replaced by QUICK_START?
7. `MULTI_TENANT_ARCHITECTURE.md` - Technical deep-dive (useful for advanced users)
8. `OPSCHALEN_HANDLEIDING.md` - Dutch scaling guide (useful, but has prices)
9. `BRANDING_SETUP.md` - Detailed branding guide (useful reference)
10. `BRANDING_QUICK_REF.md` - Quick branding reference (useful)

❌ **REMOVE/ARCHIVE:**
11. `PROJECT_INDEX.md` - Unclear purpose, possibly obsolete
12. `MIGRATION_TO_V2.md` - Historical, archive it
13. `BUILD_NOTES.md` - Historical Windows build issue, archive it

### Docs Folder (8 MD files)
❌ **DUPLICATES:**
1. `docs/CLAUDE.md` - DUPLICATE of root CLAUDE.md (REMOVE)
2. `docs/DEPLOYMENT.md` - Overlaps with DEPLOYMENT_CHECKLIST.md
3. `docs/SETUP_CHECKLIST.md` - Overlaps with QUICK_START.md

✅ **KEEP - Technical Docs:**
4. `docs/SUPABASE.md` - Supabase setup details
5. `docs/SUPABASE_ANALYTICS.md` - Analytics queries
6. `docs/guides/PROJECT_STRUCTURE.md` - Code structure
7. `docs/migrations/README.md` - Migration documentation

⚠️ **ARCHIVE:**
8. `docs/guides/MIGRATION_GUIDE.md` - V1 to V2 migration (historical)
9. `docs/guides/STREAMING_UPDATE_BUG_FIX.md` - Specific bug fix (historical)
10. `docs/README.md` - Old setup guide (check if still relevant)

### Lib Folder (2 MD files)
✅ **KEEP:**
1. `lib/supabase/README.md` - Code documentation
2. `lib/supabase/SETUP.md` - Supabase library setup

### .claude Folder (1 MD file)
✅ **KEEP:**
1. `.claude/agents/supabase-integration-manager.md` - Agent definition

---

## Price/Cost References Found

Files containing € or $ amounts:
- ❌ `CLIENT_CONFIG.example.md` - Remove cost examples
- ❌ `MULTI_TENANT_ARCHITECTURE.md` - Remove cost calculations
- ❌ `OPSCHALEN_HANDLEIDING.md` - Remove all pricing sections
- ❌ `QUICK_START.md` - Remove cost overview table

---

## Proposed New Structure

```
rag-demo/
├── README.md                          # Main project overview
├── CLAUDE.md                          # Claude Code instructions (CRITICAL)
├── CLIENT_CONFIG.example.md           # Setup template (CRITICAL)
├── QUICK_START.md                     # 15-min setup guide (CRITICAL)
│
├── documentation/                     # All extended documentation
│   ├── README.md                      # Documentation index
│   │
│   ├── setup/                         # Setup guides
│   │   ├── DEPLOYMENT_GUIDE.md        # Deployment details
│   │   └── MULTI_TENANT_SETUP.md      # Multi-tenant architecture
│   │
│   ├── branding/                      # Branding documentation
│   │   ├── BRANDING_GUIDE.md          # Complete branding guide
│   │   └── BRANDING_REFERENCE.md      # Quick reference
│   │
│   ├── technical/                     # Technical docs
│   │   ├── PROJECT_STRUCTURE.md       # Code structure
│   │   ├── SUPABASE_SETUP.md          # Supabase details
│   │   └── SUPABASE_ANALYTICS.md      # Analytics queries
│   │
│   ├── guides/                        # How-to guides
│   │   └── SCALING_GUIDE.md           # Dutch/English scaling guide (no prices)
│   │
│   └── archive/                       # Historical docs
│       ├── MIGRATION_TO_V2.md         # V1→V2 migration
│       ├── BUILD_NOTES.md             # Windows build issue
│       ├── STREAMING_BUG_FIX.md       # Historical bug fix
│       └── LEGACY_GUIDES/             # Old setup guides
│
├── lib/supabase/
│   ├── README.md                      # Code docs (unchanged)
│   └── SETUP.md                       # Setup docs (unchanged)
│
├── .claude/agents/
│   └── supabase-integration-manager.md # Agent (unchanged)
│
└── docs/                              # REMOVE entire folder (duplicates moved)
```

---

## Actions Required

### 1. Remove Duplicates
- [ ] Delete `docs/CLAUDE.md` (duplicate of root CLAUDE.md)
- [ ] Consolidate deployment docs into one
- [ ] Remove old setup checklists

### 2. Remove Price References
- [ ] `OPSCHALEN_HANDLEIDING.md` - Remove pricing sections (keep scaling info)
- [ ] `MULTI_TENANT_ARCHITECTURE.md` - Remove cost calculations
- [ ] `QUICK_START.md` - Remove cost overview
- [ ] `CLIENT_CONFIG.example.md` - Remove any cost examples

### 3. Create New Structure
- [ ] Create `documentation/` folder
- [ ] Move files to appropriate subfolders
- [ ] Create `documentation/README.md` index
- [ ] Archive historical docs

### 4. Update Cross-References
- [ ] Update all internal links to new paths
- [ ] Update CLAUDE.md references
- [ ] Update README.md references

---

## Files to KEEP in Root (Clean & Essential)

1. **README.md** - Project overview, quick links
2. **CLAUDE.md** - Claude Code automation instructions
3. **CLIENT_CONFIG.example.md** - Setup template
4. **QUICK_START.md** - 15-minute setup guide

**Result:** 4 essential files in root, everything else organized in `/documentation/`
