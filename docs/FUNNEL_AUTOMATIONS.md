# Automatisations Funnel Gratuites

Ces automatisations utilisent uniquement Supabase, les Edge Functions existantes et les agents IA déjà intégrés.

## Actions immédiates

- Score lead >= 70 : appel direct ou message ultra personnalisé.
- Statut `a_contacter` : générer un message outbound.
- Statut `contacte` sans `last_contact_at` récent : relancer.
- Statut `rdv_pris` : générer script closer.
- Statut `rdv_effectue` : générer Offer Builder sous 24h.
- Statut `proposition` ou `negociation` : relancer après 48h sans réponse.
- Client actif depuis 60 jours : chercher upsell.
- Client dormant/churned : lancer Agent Reactivation.

## Automatisation active

- Depuis une fiche prospect, le bouton `Séquence auto 3 étapes` crée une séquence sur le canal actif.
- Le premier message est généré immédiatement en brouillon.
- Les relances suivantes sont planifiées automatiquement à J+3 puis J+7.
- La page Funnel permet de lancer manuellement le runner avec `Lancer automations`.
- Vercel Cron appelle `/api/automation-runner` une fois par jour en plan gratuit Hobby et déclenche `sequence-runner` via `CRON_SECRET`.
- Pour lancer les séquences plus souvent sans payer, utilise le bouton manuel `Lancer automations` dans Funnel.

## Mesures gratuites dans la page Funnel

- Hot leads par score.
- Offres à créer.
- Relances à faire.
- Montant à encaisser.
- Messages brouillons non envoyés.
- Séquences actives.
- Propositions à relancer.
- Performance par source.
- Opportunités par service recommandé.

## Prochaine évolution recommandée

La table `funnel_events` tracke maintenant :

- message généré
- message envoyé
- réponse reçue
- RDV pris
- RDV effectué
- proposition envoyée
- proposition relancée
- deal gagné/perdu

Certains événements sont déjà branchés :

- prospect créé
- statut changé
- analyse IA lancée
- message généré
- script closer généré
- concurrents analysés
- offre générée
- facture créée
- facture payée

À brancher ensuite :

- message réellement envoyé
- réponse reçue
- RDV créé/effectué
- proposition envoyée/relancée
