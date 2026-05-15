# Choix De Sécurité À Trancher

## 1. Mode démo

Option recommandée : garder `VITE_ENABLE_DEMO_MODE=false` en production et créer un vrai compte de démonstration avec données seedées.

Option rapide : activer le mode démo seulement sur une preview privée.

Option à éviter : laisser le bypass localStorage actif sur le domaine public.

## 2. Accès aux données

Option recommandée : modèle équipe unique pour l'agence, avec accès réservé aux membres présents dans `user_roles`.

Option plus stricte : ownership par utilisateur sur les prospects, clients et jobs via `created_by`.

Option future : multi-tenant avec table `workspaces` et `workspace_members`.

## 3. Séquences automatiques

Option recommandée : appeler `sequence-runner` avec un `CRON_SECRET` depuis Supabase Cron ou un scheduler externe.

Option manuelle : réserver l'exécution aux admins connectés.

Option future : passer par une file de jobs pour retries, quotas et observabilité.

## 4. IA et scraping

Option recommandée : ajouter quotas par utilisateur et journaliser chaque appel payant.

Option simple : quotas globaux par jour.

Option future : table `api_usage` avec coût estimé par provider.
