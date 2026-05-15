# Revolution CRM

CRM agence pour prospection, scraping, scoring IA, séquences d'outreach, clients, factures et reporting.

## Stack

- React 18 + Vite + TypeScript
- Tailwind + shadcn/ui
- Supabase Auth, Database, Realtime et Edge Functions
- Vitest pour les tests unitaires

## Installation locale

```bash
npm install
cp .env.example .env
npm run dev
```

Renseigner au minimum `VITE_SUPABASE_URL` et `VITE_SUPABASE_PUBLISHABLE_KEY`.

## Scripts

```bash
npm run dev
npm run lint
npm run test
npm run build
```

## Sécurité

- Ne jamais commiter `.env`.
- Le mode démo est désactivé par défaut. Active-le seulement en local avec `VITE_ENABLE_DEMO_MODE=true`.
- Les fonctions de scraping exigent un utilisateur Supabase connecté et vérifient que le job appartient à cet utilisateur.
- `sequence-runner` exige un admin ou le header `x-cron-secret` correspondant à `CRON_SECRET`.
- Les migrations Supabase doivent être versionnées dans `supabase/migrations`.

## Déploiement Supabase

```bash
supabase link --project-ref <project-ref>
supabase db push
supabase functions deploy
supabase secrets set CRON_SECRET=...
```

Ajoute aussi les clés optionnelles selon les intégrations utilisées : `SERPAPI_KEY`, `HUNTER_API_KEY`, `APIFY_API_TOKEN`, `PAPPERS_API_KEY`, `GROQ_API_KEY`, `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `GEMINI_API_KEY`.

## Outils gratuits

Voir [docs/FREE_TOOLS.md](docs/FREE_TOOLS.md) pour la liste des outils gratuits intégrés, leurs limites et les évolutions recommandées.

Voir [docs/FUNNEL_AUTOMATIONS.md](docs/FUNNEL_AUTOMATIONS.md) pour les règles funnel gratuites à utiliser au quotidien.
