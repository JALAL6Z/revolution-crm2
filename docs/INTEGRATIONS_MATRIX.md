# Matrice Integrations

## IA

| Provider | Cout | Recommande | Usage |
| --- | --- | --- | --- |
| Gemini | Freemium | Oui | Volume, analyse, generation rapide |
| Groq | Free | Oui | Drafts rapides, fallback Llama |
| Claude | Paid | Oui | Raisonnement, briefs, scripts longs |
| OpenAI | Paid | Optionnel | Qualite stable, usage premium |

## SMMA / Acquisition

| Outil | Cout | Recommande | Usage |
| --- | --- | --- | --- |
| DuckDuckGo | Free | Oui | Recherche web simple |
| OpenStreetMap / Nominatim | Free | Oui | Scraping local sans clé |
| Annuaire Entreprises data.gouv | Free | Oui | Sociétés FR sans clé |
| Crawl email public | Free | Oui | Emails publics depuis sites |
| DuckDuckGo HTML | Free | Oui | Recherche web/social publique |
| Google PageSpeed | Free/quota | Optionnel | Audit perf si quota disponible |
| Hunter | Freemium | Oui | Enrichissement email |
| Apify | Paid | Optionnel | Scraping avance |
| Pappers | Freemium | Oui | SIREN / verification entreprise |
| SerpAPI | Paid | Optionnel | Google Maps / SERP |

## Delivery / Ops

| Outil | Cout | Recommande | Usage |
| --- | --- | --- | --- |
| Google Sheets | Free | Oui | Pipeline leger / imports |
| Slack | Freemium | Oui | Alertes internes |
| Discord webhooks | Free | Optionnel | Notifications |
| Notion | Freemium | Optionnel | Base de suivi |
| HubSpot / Pipedrive | Paid | Optionnel | CRM externe |
| Stripe / PayPal | Paid | Selon besoin | Paiement |

## CLI Ou API

Pour ce CRM deploye sur Vercel, l'API est la bonne option.

- CLI: utile sur une VM, un worker Docker ou une machine controlee
- API: compatible Vercel, scalable, simple a monitorer
- En prod CRM, evite de dependre d'une CLI interactive pour les agents

## Stack Recommandee

1. Base gratuite: Gemini + Groq + DuckDuckGo + PageSpeed + CSV
2. Stack equilibree: Gemini + Claude + Sheets + Slack
3. Stack premium: OpenAI + Claude + HubSpot/Pipedrive + Ads APIs
