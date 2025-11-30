# HR Assistant AI - Opschaal Handleiding

**Versie 2.0** - Volledig Multi-Tenant Klaar

---

## 🎯 Wat Je Nu Hebt

Een **kant-en-klare HR chatbot** die je in **30-45 minuten** per nieuwe klant kunt deployen.

**Wat het doet**:
- Beantwoordt HR vragen van medewerkers
- Gebaseerd op klant's eigen HR documenten
- 12 talen ondersteund
- Volledig geïsoleerd per klant

**Wat het kost per klant**:
- Pinecone: €5-10/maand
- OpenAI: €3-8/maand
- Supabase: €0-2/maand (gedeeld)
- Vercel: €0-2/maand (gedeeld)
- **Totaal: €8-22/maand**

**Wat je kunt vragen**:
- €50-100/maand per klant
- **Winst: €30-90 per klant per maand**

---

## 🚀 Snelle Start: Eerste Klant

### Stap 1: Pinecone (10 min)

1. Ga naar [pinecone.io](https://pinecone.io)
2. Maak nieuwe Assistant: `bedrijfsnaam-hr-assistant`
3. Upload HR documenten van klant (PDF's)
4. Kopieer API key en assistant naam

### Stap 2: Vercel (10 min)

1. Ga naar [vercel.com](https://vercel.com)
2. Maak nieuw project
3. Geef naam: `bedrijfsnaam-hr-assistant`
4. Deploy

### Stap 3: Environment Variables (5 min)

Vercel → Settings → Environment Variables:

```bash
# Minimaal (verplicht):
TENANT_ID=bedrijfsnaam
PINECONE_API_KEY=pcsk_xxxxx
PINECONE_ASSISTANT_NAME=bedrijfsnaam-hr-assistant
OPENAI_API_KEY=sk-xxxxx

# Branding (3 vars voor complete branded look):
NEXT_PUBLIC_COMPANY_NAME=Bedrijfsnaam BV
NEXT_PUBLIC_PRIMARY_COLOR=#FF5733
NEXT_PUBLIC_LOGO_URL=https://bedrijf.nl/logo.png
```

**Zie [BRANDING_QUICK_REF.md](BRANDING_QUICK_REF.md) voor meer opties**

### Stap 4: Testen (5 min)

1. Open deployed URL
2. Stel 5 HR vragen
3. Check of antwoorden kloppen
4. Klaar! ✅

**Totaal: 30 minuten**

---

## 📈 Opschalen naar 10 Klanten

### Aanpak: Aparte Vercel Projecten

Elke klant krijgt eigen:
- ✅ Vercel project
- ✅ Pinecone assistant
- ✅ Environment variables
- ✅ Domein (optioneel)

**Voor elke nieuwe klant herhaal je Stap 1-4 hierboven.**

### Kosten bij 10 Klanten

| Item | Kosten |
|------|--------|
| Pinecone (10× €7) | €70/maand |
| OpenAI (10× €5) | €50/maand |
| Supabase (gedeeld) | €25/maand |
| Vercel Pro (onbeperkt) | €20/maand |
| **Totaal** | **€165/maand** |

**Omzet** (10× €75): €750/maand
**Winst**: €585/maand (78% marge)

---

## 📊 Supabase Optioneel Delen (Besparing)

Als je Supabase gebruikt (voor logging/analytics):

### Optie A: 1 Supabase voor Alle Klanten

**Setup (eenmalig)**:
1. Maak 1 Supabase project
2. Run SQL: `docs/migrations/MULTI_TENANT_SETUP.sql`
3. Kopieer URL en key

**Per klant**:
```bash
NEXT_PUBLIC_SUPABASE_URL=https://jouw-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=xxxxx
SUPABASE_TABLE_NAME=chat_logs  # Zelfde voor iedereen
TENANT_ID=klant-naam           # Uniek per klant!
```

**Voordeel**: €25/maand totaal in plaats van €25 per klant

### Optie B: Aparte Supabase per Klant

```bash
# Klant 1:
NEXT_PUBLIC_SUPABASE_URL=https://klant1.supabase.co
SUPABASE_TABLE_NAME=chat_logs

# Klant 2:
NEXT_PUBLIC_SUPABASE_URL=https://klant2.supabase.co
SUPABASE_TABLE_NAME=chat_logs
```

**Voordeel**: Complete isolatie
**Nadeel**: Duurder (€25 per klant)

---

## 🎨 Branding Aanpassen (Nieuw v2.0!)

**Volledige white-label UI** - pas ALLES aan zonder code!

### Quick Setup (3 variabelen)

```bash
NEXT_PUBLIC_COMPANY_NAME=Acme Corporation
NEXT_PUBLIC_PRIMARY_COLOR=#FF5733
NEXT_PUBLIC_LOGO_URL=https://acme.com/logo.png
```

**Resultaat**: Volledig branded HR assistant in 2 minuten!

### Complete Branding (20+ opties)

Pas **alles** aan:
- ✅ Bedrijfsnaam & tagline
- ✅ Alle kleuren (primary, secondary, background, text)
- ✅ Logo's (header, favicon, PWA icons)
- ✅ Watermark achtergrond

**Zie complete guide**: [BRANDING_SETUP.md](BRANDING_SETUP.md)
**Quick reference**: [BRANDING_QUICK_REF.md](BRANDING_QUICK_REF.md)

### Populaire Kleurenschema's

**Tech Blue**:
```bash
NEXT_PUBLIC_PRIMARY_COLOR=#3B82F6
NEXT_PUBLIC_PRIMARY_DARK=#2563EB
```

**Corporate Red**:
```bash
NEXT_PUBLIC_PRIMARY_COLOR=#EF4444
NEXT_PUBLIC_PRIMARY_DARK=#DC2626
```

**Healthcare Green**:
```bash
NEXT_PUBLIC_PRIMARY_COLOR=#10B981
NEXT_PUBLIC_PRIMARY_DARK=#059669
```

### Logo Hosting

**3 Opties**:

**1. Client's Website** (aanbevolen):
```bash
NEXT_PUBLIC_LOGO_URL=https://acme-corp.com/logo.png
```

**2. CDN** (snel):
```bash
NEXT_PUBLIC_LOGO_URL=https://res.cloudinary.com/acme/logo.png
```

**3. Vercel** (altijd beschikbaar):
```bash
NEXT_PUBLIC_LOGO_URL=/images/clients/acme/logo.png
```

---

## 📁 Wat Moet Je per Klant Hebben?

### Van de Klant:

1. **HR Documenten** (PDF's):
   - Personeelshandboek
   - Verlofregeling
   - Pensioenoverzicht
   - CAO (indien van toepassing)
   - Secundaire arbeidsvoorwaarden

2. **Branding**:
   - Bedrijfsnaam
   - Primaire kleur (hex code)
   - Logo (optioneel, 192×192px PNG)

3. **Contact**:
   - Email voor support
   - Naam contactpersoon

### Wat Jij Aanmaakt:

1. Pinecone assistant met hun documenten
2. Vercel project met juiste env vars
3. Supabase bucket (als je PDF links wilt)

---

## 🔄 Klanten Beheren

### Spreadsheet (Aanbevolen)

Maak een Google Sheet met:

| Klant | Tenant ID | Vercel URL | Domein | Deploy Datum | Kosten/mnd | Omzet/mnd |
|-------|-----------|------------|--------|--------------|------------|-----------|
| Acme | acme-corp | acme-hr.vercel.app | hr.acme.com | 2025-01-15 | €12 | €75 |
| TechStart | techstart | techstart-hr.vercel.app | - | 2025-01-20 | €10 | €50 |

### Kosten Tracking

Als je Supabase gebruikt, run deze query:

```sql
SELECT
  tenant_id,
  COUNT(*) as vragen,
  SUM(total_cost) as kosten
FROM chat_logs
WHERE timestamp >= NOW() - INTERVAL '30 days'
GROUP BY tenant_id;
```

Export naar CSV → Importeer in je spreadsheet.

---

## 🛠️ Onderhoud

### Maandelijks

- [ ] Check Supabase logs per klant
- [ ] Review kosten vs omzet
- [ ] Backup maken van belangrijke data
- [ ] Update documenten als klant wijzigingen heeft

### Per Kwartaal

- [ ] Code updates deployen naar alle projecten
- [ ] Performance review per klant
- [ ] Feedback verzamelen van gebruikers

### Bij Updates

**Als je de code update** (bugfix, nieuwe feature):

```bash
git push  # Push naar main branch
```

Dan voor **elke klant**:
- Ga naar Vercel dashboard
- Klik "Redeploy"

**Of automatiseer met GitHub Actions** (later opzetten).

---

## 💡 Opschaal Tips

### 1-10 Klanten
- ✅ Handmatig deployen (30 min per klant)
- ✅ Gebruik gedeelde Supabase
- ✅ Simpel spreadsheet voor tracking

### 10-30 Klanten
- ✅ Maak deployment script
- ✅ Automatiseer Pinecone setup
- ✅ Gebruik template systeem

### 30+ Klanten
- ✅ Bouw admin dashboard
- ✅ Self-service portal overwegen
- ✅ Dedicated support team

---

## 🎁 Verkoop Tips

### Pitch Punten

"Een AI assistent die 24/7 HR vragen beantwoordt van jullie medewerkers, gebaseerd op jullie eigen HR documenten."

**Voordelen voor klant**:
- ✅ HR team bespaart 5-10 uur per week
- ✅ Medewerkers krijgen direct antwoord
- ✅ 12 talen ondersteund (belangrijk voor internationale teams)
- ✅ Volledig gebaseerd op jullie documenten
- ✅ Installeerbaar als app op mobiel

**Prijsopties**:
- **Starter**: €50/maand (max 500 vragen)
- **Pro**: €75/maand (max 2000 vragen)
- **Enterprise**: €150/maand (onbeperkt + custom domain)

### Demo Maken

1. Deploy met je eigen branding: "Demo Company"
2. Upload algemene HR voorbeelden
3. Laat prospects zelf vragen stellen
4. Toon multilingual support
5. Laat PDF citations zien

### Onboarding Proces

1. **Week 1**: Documenten verzamelen
2. **Week 2**: Setup + testing (jij doet dit)
3. **Week 3**: Pilot met 5-10 medewerkers
4. **Week 4**: Volledige rollout

---

## 📋 Snelle Referentie

### Nieuwe Klant Checklist

```
□ Documenten ontvangen van klant
□ Pinecone assistant aangemaakt
□ Documenten geüpload naar Pinecone
□ Vercel project aangemaakt
□ Environment variables ingesteld
□ Getest met 10 vragen
□ Supabase bucket aangemaakt (optioneel)
□ PDF's geüpload (optioneel)
□ Custom domain geconfigureerd (optioneel)
□ Klant getraind
□ Go-live!
```

### Environment Variables Template

```bash
# Verplicht
TENANT_ID=klant-naam
PINECONE_API_KEY=pcsk_xxxxx
PINECONE_ASSISTANT_NAME=klant-naam-hr-assistant
OPENAI_API_KEY=sk-xxxxx

# Branding
NEXT_PUBLIC_COMPANY_NAME=Bedrijfsnaam
NEXT_PUBLIC_PRIMARY_COLOR=#FF5733

# Supabase (optioneel)
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=xxxxx
SUPABASE_TABLE_NAME=chat_logs
STORAGE_BUCKET_NAME=klant-naam-hr-documents
```

---

## 🆘 Hulp Nodig?

### Documentatie

- **Deployment**: [DEPLOYMENT_CHECKLIST.md](DEPLOYMENT_CHECKLIST.md) - Stap-voor-stap Engels
- **Technisch**: [MULTI_TENANT_ARCHITECTURE.md](MULTI_TENANT_ARCHITECTURE.md) - Diepgaand

### Problemen Oplossen

**Build faalt**:
- Check TypeScript errors: `npx tsc --noEmit`
- In Vercel werkt het altijd (local build issue met path)

**Geen antwoorden**:
- Check of Pinecone documenten geïndexeerd zijn
- Verifieer `PINECONE_ASSISTANT_NAME` klopt

**PDF links werken niet**:
- Check `STORAGE_BUCKET_NAME` in env vars
- Verifieer bucket is PUBLIC in Supabase

**Te duur**:
- Switch naar `gpt-4o-mini` in `lib/openai.ts` (90% goedkoper)
- Verlaag `topK` in `lib/pinecone.ts` van 3 naar 2

---

## 🎯 Actie Plan

### Deze Week
1. Deploy eerste test klant (eigen bedrijf?)
2. Test alle functionaliteit
3. Maak demo instance

### Volgende Week
1. Pitch naar 3 prospects
2. Sluit eerste betaalde klant
3. Setup spreadsheet voor tracking

### Deze Maand
1. Schaal naar 5 klanten
2. Automatiseer wat kan
3. Verzamel feedback voor v2.1

---

## 💰 Rekenvoorbeeld: 20 Klanten

### Kosten
- Pinecone: 20 × €7 = €140
- OpenAI: 20 × €5 = €100
- Supabase: €25 (gedeeld)
- Vercel: €20 (gedeeld)
- **Totaal: €285/maand**

### Omzet
- 20 × €75 = €1.500/maand

### Winst
- €1.500 - €285 = **€1.215/maand**
- **Winstmarge: 81%**

**Jaaromzet**: €18.000
**Jaarwinst**: €14.580

---

## 🚀 Succes!

Je hebt nu een **schaalbaar business model** met:
- ✅ Lage operationele kosten
- ✅ Hoge winstmarges
- ✅ Snelle deployment (30 min)
- ✅ Minimaal onderhoud
- ✅ Recurring revenue

**Start vandaag nog met je eerste klant!**

Voor vragen: check de Engelse documentatie in [DEPLOYMENT_CHECKLIST.md](DEPLOYMENT_CHECKLIST.md) en [MULTI_TENANT_ARCHITECTURE.md](MULTI_TENANT_ARCHITECTURE.md).
