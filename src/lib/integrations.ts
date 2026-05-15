export type IntegrationKind = "ai" | "enrichment" | "ads" | "ops" | "delivery";
export type IntegrationCost = "free" | "freemium" | "paid";

export type IntegrationCatalogItem = {
  provider: string;
  label: string;
  kind: IntegrationKind;
  cost: IntegrationCost;
  recommended: boolean;
  needsApiKey: boolean;
  defaultModel?: string;
  baseUrlHint?: string;
  description: string;
  value: string;
  cliSupport: "no" | "limited" | "yes";
};

export const AI_PROVIDER_CATALOG: IntegrationCatalogItem[] = [
  {
    provider: "gemini",
    label: "Gemini",
    kind: "ai",
    cost: "freemium",
    recommended: true,
    needsApiKey: true,
    defaultModel: "gemini-2.5-flash",
    baseUrlHint: "https://generativelanguage.googleapis.com/v1beta",
    description: "Bon ratio qualité / coût, utile pour la majorité des agents.",
    value: "Très bon choix pour l'analyse et la génération rapide.",
    cliSupport: "no",
  },
  {
    provider: "groq",
    label: "Groq",
    kind: "ai",
    cost: "free",
    recommended: true,
    needsApiKey: true,
    defaultModel: "openai/gpt-oss-20b",
    baseUrlHint: "https://api.groq.com/openai/v1/chat/completions",
    description: "API ultra rapide avec modèle Llama, très pratique pour les drafts.",
    value: "Excellent fallback gratuit.",
    cliSupport: "no",
  },
  {
    provider: "openai",
    label: "OpenAI",
    kind: "ai",
    cost: "paid",
    recommended: false,
    needsApiKey: true,
    defaultModel: "gpt-4o-mini",
    baseUrlHint: "https://api.openai.com/v1/chat/completions",
    description: "Option robuste si tu veux une qualité stable sur les prompts longs.",
    value: "Très bon pour les cas premium.",
    cliSupport: "no",
  },
  {
    provider: "claude",
    label: "Claude",
    kind: "ai",
    cost: "paid",
    recommended: false,
    needsApiKey: true,
    defaultModel: "claude-3-5-sonnet-latest",
    baseUrlHint: "https://api.anthropic.com/v1/messages",
    description: "Très fort sur le raisonnement, les textes et les analyses riches.",
    value: "Le meilleur choix pour les briefs et scripts complexes.",
    cliSupport: "no",
  },
];

export const INTEGRATION_CHOICES = [
  {
    title: "Base gratuite",
    label: "Gemini + Groq + APIs no-key",
    description: "Le plus rapide à mettre en place, sans abonnement au départ.",
    items: ["Gemini comme IA principale", "Groq en fallback", "PageSpeed, DuckDuckGo, CSV"],
  },
  {
    title: "Stack gratuite",
    label: "Gemini + Groq + outils no-key",
    description: "Le meilleur point de départ si tu veux éviter toute carte bancaire.",
    items: ["Gemini free tier", "Groq free plan", "DuckDuckGo, PSI, CSV, webhooks"],
  },
  {
    title: "Stack premium",
    label: "OpenAI + Claude + APIs métiers",
    description: "Option ultérieure si tu veux plus de stabilité et de profondeur.",
    items: ["OpenAI pour la fiabilité", "Claude pour le raisonnement", "Ads / CRM / reporting"],
  },
];

export const FREE_SMMA_TOOLS = [
  {
    name: "DuckDuckGo",
    use: "Recherche web rapide et gratuite.",
    cliSupport: "no",
  },
  {
    name: "Google PageSpeed Insights",
    use: "Audit SEO / perf / UX sans clé pour un usage modéré.",
    cliSupport: "no",
  },
  {
    name: "CSV import / export",
    use: "Onboarding et migration sans coût.",
    cliSupport: "yes",
  },
  {
    name: "Google Sheets",
    use: "Pipeline léger, reporting simple, imports batch.",
    cliSupport: "no",
  },
  {
    name: "Slack / Discord webhooks",
    use: "Notifications d'activité et alertes internes.",
    cliSupport: "limited",
  },
];
