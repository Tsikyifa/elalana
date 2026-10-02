# Plan d'Analyse et d'Optimisation - Suivi de Travaux

## 🎯 Objectif
Diagnostiquer et résoudre les problèmes de performance rencontrés lors des opérations sur l'avancement des travaux (ajout/suppression de données d'avancement).

## 👥 Acteurs Identifiés

### Utilisateurs du Système

1. **Administrateur / Admin**
   - Rôle : Accès complet à l’ensemble du système
   - Accès : Tous les marchés, toutes les données, tous les modules et gestion des utilisateurs
   - Interface : Administration générale de la plateforme

2. **Chef de projet**
   - Rôle : Responsable d’un ou plusieurs marchés attribués
   - Accès : Uniquement les marchés, projets et éléments liés à son périmètre
   - Contexte visible : marché, axe/route et projet concerné
   - Limite : Ne voit pas l’ensemble des marchés de l’application
   - Interface : Suivi ciblé, saisie d’avancement et gestion de son périmètre

3. **DRTP / Gestionnaire de référence**
   - Rôle : Saisie et mise à jour des données de référence et référentiels métier
   - Accès : Données de base, projets, référentiels et marchés liés à son périmètre
   - Interface : Paramétrage, référentiel et données de base

4. **Visiteur**
   - Rôle : Consultation et suivi stratégique
   - Accès : Vue globale, synthèses, tableaux de bord, cartographie et rapports
   - Limite : Aucun droit d’édition ni de gestion des données
   - Interface : Dashboard de pilotage et consultation

### Modèle d’accès retenu
- La gestion des utilisateurs repose sur les groupes Django et non sur une seule colonne `role` dans la table utilisateur.
- Les rôles actifs du système sont limités à : `admin`, `chef_de_projet`, `drtp` et `visiteur`.
- Les anciens groupes hérités ne sont conservés que comme alias de compatibilité, mais ne doivent pas être utilisés comme rôles métiers actifs.
- L’accès aux données est filtré selon l’affectation utilisateur → marché / projet / axe, ainsi que selon le groupe utilisateur.

### Règle métier clé
- Le chef de projet ne voit pas tous les marchés du système.
- Il voit uniquement les marchés qui lui sont attribués et le contexte fonctionnel associé : axe, route et projet.
- La logique de visibilité doit donc être fondée sur l’affectation utilisateur → marché / projet / axe, puis sur les permissions du groupe auquel il appartient.
- Cela permet un modèle plus simple, plus lisible, plus cohérent avec les besoins actuels du projet.

## 🖥️ Interface Actuelle
- **Interface Web Unique** : Application React/TypeScript unique
- **URL d'accès** : Non spécifiée (probablement localhost:3000 en dev)
- **Authentification** : Système basé sur tokens (DRF)
- **Résponsivité** : Non spécifiée dans l'analyse initiale

## 📋 Étapes du Processus d'Analyse

### Phase 1 : Analyse Initiale (En Cours)
1. [x] Revue du codebase existant (git status, structure fichiers)
2. [x] Identification des points d'entrée frontend liés à l'avancement
3. [x] Analyse des appels API et du état frontend
4. [x] Examen des modèles Django et des relations
5. [x] Revue des sérialiseurs et vues API
6. [x] Identification des goulots d'étranglement potentiels

### Phase 2 : Diagnostic Approfondi
1. [ ] Profiler les requêtes API lentes
   - Mesurer temps de réponse des endpoints `/travaux/marches/` et `/travaux/avancements/`
   - Utiliser les outils de développement du navigateur (Network tab)
2. [ ] Analyser les requêtes SQL exécutées
   - Activer le logging des requêtes Django ou utiliser Django Debug Toolbar
   - Identifier les problèmes N+1 et les jointures coûteuses
3. [ ] Profiler le rendu frontend
   - Utiliser React DevTools pour identifier les re-rendus inutiles
   - Mesurer le temps de mise à jour du DOM après opérations
4. [ ] Analyser l'utilisation de la mémoire
   - Vérifier les fuites mémoire potentielles dans les états React
   - Analyser la taille des payloads JSON transférés

### Phase 3 : Implémentation des Optimisations
#### Optimisations Frontend
1. [ ] Éliminer les rechargements complets inutiles
   - Modifier `AvancementView.tsx` pour éviter `loadData()` après suppressions/ajouts ciblés
   - Implémenter des mises à jour d'état optimistes sans rechargement API complet
2. [ ] Optimiser la récupération de données
   - Implémenter la pagination ou le défilement infini si nécessaire
   - Ajouter du caching côté client pour les données de référence
3. [ ] Améliorer les performances de rendu
   - Utiliser `React.memo`, `useMemo`, `useCallback` là où approprié
   - Virtualiser les longues listes si applicable
4. [ ] Appliquer le filtrage métier par acteur
   - Le chef de projet doit recevoir uniquement les marchés affectés à son profil
   - Le front doit afficher le périmètre de l’axe / route / projet associé à ce marché
   - Les filtres globaux doivent rester visibles pour les profils décisionnels seulement

#### Optimisations Backend
1. [ ] Résoudre les problèmes N+1 dans les sérialiseurs
   - Utiliser `prefetch_related` avec `Prefetch` et `Subquery` pour charger les derniers avancements
   - Exemple : `Prefetch('avancements', queryset=Avancement.objects.order_by('-date_avancement')[:1])`
2. [ ] Ajouter des index de base de données
   - Identifier les colonnes fréquemment utilisées dans les WHERE, JOIN, ORDER BY
   - Créer des index appropriés sur les clés étrangères et champs de filtrage
3. [ ] Optimiser les propriétés modèles coûteuses
   - Considérer la mise en cache des propriétés calculées (avec invalidation appropriée)
   - Pré-calculer certaines valeurs lors de la sauvegarde si approprié
4. [ ] Optimiser les vues Django
   - Réduire le traitement en Python après récupération des données
   - Déplacer davantage de logique vers la base de données quand possible

### Phase 4 : Validation et Tests
1. [ ] Mesurer les améliorations de performance
   - Comparer les temps de réponse avant/après optimisation
   - Tester avec des volumes de données représentatifs
2. [ ] Vérifier l'absence de régressions fonctionnelles
   - S'assurer que toutes les fonctionnalités existent toujours
   - Valider que les calculs d'avancement restent corrects
3. [ ] Tests de charge (si applicable)
   - Simuler plusieurs utilisateurs concurrentiels
   - Vérifier la stabilité sous charge

### Phase 5 : Documentation et Suivi
1. [ ] Documenter les changements apportés
2. [ ] Créer un guide de bonnes pratiques pour les développements futurs
3. [ ] Établir des métriques de performance à surveiller
4. [ ] Planifier des revues de performance périodiques

## 📊 Métriques de Performance à Suivre
- Temps de réponse des API clés (< 2s idéal)
- Nombre de requêtes SQL par opération
- Temps de rendu initial de la page
- Temps de mise à jour après ajout/suppression d'avancement
- Taille moyenne des payloads JSON
- Utilisation de la mémoire côté client
- Nombre de marchés visibles par profil d’utilisateur
- Vérification du respect du périmètre métier par acteur (chef de projet, admin, décideur)

## ⚠️ Contraintes et Considérations
- **Compatibilité** : Maintenir la compatibilité avec les navigateurs supportés
- **Sécurité** : Ne pas introduire de vulnérabilités lors des optimisations
- **Maintenabilité** : Le code doit rester lisible et maintenable
- **Déploiement** : Les changements doivent être déployables sans interruption de service
- **Données existantes** : Préserver l'intégrité des données historiques

## 📁 Fichiers Clés à Examiner
### Frontend
- `frontend/src/pages/travaux/avancement/AvancementView.tsx`
- `frontend/src/api/travaux.api.ts`
- `frontend/src/components/layout/` (Header, Sidebar)
- `frontend/src/pages/cartographie/CartographieView.tsx` (respect du périmètre d’axe / marché selon profil)

### Backend
- `TPAPP/travaux/models.py` (modèles Marche, Avancement)
- `TPAPP/travaux/serializers.py` (MarcheListSerializer, AvancementMiniSerializer)
- `TPAPP/travaux/views.py` (fonctions liées à l'avancement et aux marchés)
- `TPAPP/travaux/permissions.py` ou équivalent (contrôle d’accès par rôle et périmètre)
- `TPAPP/travoux/filters.py` (si existe)

## 🔲 Suivi
Ce document sera mis à jour au fur et à mesure de notre progression dans l'analyse et l'implémentation des optimisations.

*Créé le : $(date)*
*Dernière mise à jour : $(date)*