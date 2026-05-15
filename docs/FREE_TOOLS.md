# Outils Gratuits Intégrés Au CRM

Objectif : garder le CRM exploitable sans abonnement obligatoire au départ.

## Audit Site

Gratuit et actif :

- Recherche locale OpenStreetMap/Nominatim sans clé.
- Annuaire Entreprises/data.gouv sans clé pour sociétés FR.
- Crawl email public sans clé pour domaines/entreprises.
- Recherche sociale publique DuckDuckGo sans clé.
- Google PageSpeed Insights uniquement si un quota/clé est disponible.
- Crawl HTML direct du site.
- Vérification `robots.txt`.
- Vérification `sitemap.xml`.
- Mini-crawler interne gratuit jusqu'à 10 pages par site.
- Détection title, meta description, canonical, H1/H2.
- Comptage texte, liens internes, images sans alt.
- Détection pixels Google Analytics, GTM, Meta, TikTok, LinkedIn.
- Détection formulaires, liens téléphone, email, WhatsApp, CTA.
- Signaux local SEO basiques : téléphone, adresse, horaires.

Limites :

- Pas de positions Google réelles.
- Pas de volume de recherche mots-clés.
- Pas de backlinks.
- Pas de trafic organique.
- Pas de crawl multi-pages profond au-delà de 10 pages.

Évolution recommandée :

- Ajouter analyse Google Business Profile si une API gratuite fiable est disponible.
- Ajouter PDF public partageable plus tard.

## Prospection Et Enrichissement

Gratuit ou freemium :

- Import CSV.
- DuckDuckGo HTML search pour recherche web simple.
- PageSpeed Insights en option.
- Pappers/Hunter/Apify en option selon quotas ou clés disponibles.

## IA

Configuration actuelle :

- Gemini, Groq, Claude ou OpenAI selon les clés configurées.
- Groq utile en fallback rapide et peu cher.

À vérifier avant production :

- Quotas réels.
- Logs de coût par agent.
- Rate limiting par utilisateur.

## Factures

Début recommandé :

- Suivi factures dans Supabase.
- Export CSV.
- PDF plus tard via API Vercel ou service dédié.

Le skill local Claude facture n'est pas utilisé en production Vercel, car il dépend de fichiers locaux et de Chrome desktop.
