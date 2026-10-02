# Mémoire de soutenance - Projet ELALANA

## 1. Informations générales

- Titre du projet : ELALANA
- Type de projet : Application web de gestion du suivi des travaux publics
- Période de développement : 2025-2026
- Contexte : gestion technique et administrative des infrastructures routières et des interventions liées aux travaux
- Domaine d’application : administration publique / gestion des infrastructures / suivi de projets routiers

## 2. Contexte du projet

Le projet ELALANA a été conçu pour répondre à un besoin réel de digitalisation et de centralisation des informations au sein d’une structure publique engagée dans la gestion des infrastructures routières et du suivi des travaux. Avant la mise en place de cette solution, les informations concernant les routes, les tronçons, les marchés et les avancements étaient dispersées entre documents papiers, fichiers Excel et échanges informels. Cette situation rendait difficile le suivi de l’état d’avancement des projets, la planification des interventions et la fiabilité des données.

Cette plateforme vise à mettre en place un système unique capable de :

- gérer les axes routiers et leurs segments ;
- organiser les localisations par province, région et district ;
- suivre les marchés liés aux travaux ;
- suivre l’avancement des interventions ;
- centraliser les données techniques et administratives ;
- offrir une interface ergonomique et sécurisée pour les agents.

## 3. Problématique

Les services chargés de la gestion des travaux publics sont confrontés à plusieurs difficultés :

- absence d’une base de données centralisée ;
- manque de visibilité sur l’état réel des travaux ;
- difficulté de suivi des axes et des tronçons routiers ;
- traitement manuel des informations et des rapports ;
- faible traçabilité des interventions et des marchés ;
- difficulté de coordination entre les acteurs impliqués.

Cette situation entraîne des retards dans l’exécution des travaux, des erreurs de gestion et une mauvaise exploitation des données.

## 4. Objectifs du projet

### 4.1 Objectif général

Mettre en place une plateforme web de gestion du suivi des travaux publics afin d’améliorer la fiabilité, la traçabilité et l’efficacité de la gestion des infrastructures routières.

### 4.2 Objectifs spécifiques

- centraliser les informations relatives aux axes et voies routières ;
- suivre les marchés, les responsables et les calendriers ;
- organiser les segments par district et par localisation ;
- suivre les avancements et les étapes de réalisation ;
- mieux exploiter les données techniques pour la prise de décision ;
- sécuriser l’accès aux fonctionnalités selon les profils d’utilisateur ;
- développer une solution robuste avec un backend performant et une interface moderne.

## 5. Cible utilisateur

La solution est destinée principalement aux acteurs chargés de la gestion des travaux publics, notamment :

- responsables techniques ;
- gestionnaires de projets routiers ;
- agents de suivi et de contrôle ;
- services administratifs liés aux travaux ;
- utilisateurs autorisés à saisir, modifier et exploiter les données.

## 6. Périmètre fonctionnel du système

Le système est centré sur le module de suivi des travaux. Il permet de gérer plusieurs éléments interconnectés :

### 6.1 Gestion des localisations
Ce module permet de définir les lieux d’intervention selon la région, la province et le district. Il constitue la base géographique du système.

- Province ;
- Région ;
- District ;
- organisation des données de localisation.

### 6.2 Gestion des axes routiers
Il permet d’enregistrer les infrastructures concernées :

- désignation de l’axe ;
- type d’axe (route nationale, régionale, communale, etc.) ;
- description ;
- longueur totale ;
- départ et fin de l’axe selon les districts ;
- gestion de l’axe par l’utilisateur responsable.

### 6.3 Gestion des segments PK
Ce module permet de décomposer un axe en tronçons plus précis. Chaque segment contient :

- PK de début ;
- PK de fin ;
- district traversé ;
- lieu de début et de fin ;
- longueur calculée automatiquement ;
- validation des chevauchements entre segments.

Cela garantit une meilleure précision dans le suivi des interventions sur le terrain.

### 6.4 Gestion des marchés et financements
Ce module couvre la gestion des marchés liés aux travaux :

- numéro de marché ;
- axe concerné ;
- description et résumé ;
- catégorie du marché ;
- responsable institutionnel ;
- mode de financement ;
- montant ;
- tiers et titulaire ;
- dates d’ordonnancement et de délai.

### 6.5 Suivi de l’avancement des travaux
C’est le cœur fonctionnel du projet. Il permet d’enregistrer l’évolution du projet et de mesurer la progression selon plusieurs critères :

- situation actuelle ;
- % d’avancement ;
- étapes clés ;
- observations ;
- photos et pièces jointes ;
- historique des interventions.

## 7. Architecture technique

Le projet repose sur une architecture client-serveur avec une séparation claire entre le back-end et le front-end.

### 7.1 Front-end

Technologies utilisées :

- React
- TypeScript
- Vite
- Bootstrap
- CSS personnalisé

Le front-end est conçu pour offrir une interface fluide, claire et adaptée à la gestion des données de travaux publics.

### 7.2 Back-end

Technologies utilisées :

- Python
- Django
- Django REST Framework
- PostgreSQL
- JWT / cookies pour l’authentification
- django-filter, django-cors-headers, import-export

Le back-end gère la logique applicative, les données métiers, les API et la sécurité du système.

### 7.3 Sécurité et authentification

Le projet met en place des mécanismes de sécurité essentiels à l’usage en environnement administratif :

- authentification des utilisateurs ;
- gestion des accès selon les droits ;
- protection des API ;
- configuration CORS pour l’interopérabilité avec le front-end ;
- utilisation des variables d’environnement pour les informations sensibles.

## 8. Modèle de données

Le système repose sur plusieurs modèles essentiels pour la gestion des travaux. Les plus importants sont :

- Localisation
- Axe
- PKDistrict
- Marche
- Avancement
- MediaAvancement
- ConventionProgramme
- TravauxGlisse
- OS
- Bac

Ces modèles permettent de structurer le système selon les besoins techniques et administratifs du domaine routier.

## 9. Fonctionnalités principales

### 9.1 Gestion des infrastructures routières
- création et suivi des axes routiers ;
- gestion des localisations ;
- définition des segments de route ;
- calcul automatique des longueurs.

### 9.2 Gestion des marchés de travaux
- enregistrement des marchés ;
- suivi des financements et des responsables ;
- gestion des montants et des échéances ;
- organisation des interventions associées.

### 9.3 Suivi d’avancement
- suivi de la progression ;
- ajout d’observations ;
- exploitation des pièces jointes ;
- analyse des étapes effectuées.

### 9.4 Gestion des données techniques
- intégration de données de localisation ;
- validation des règles métier ;
- cohérence des données de PK ;
- structuration des travaux dans une base centralisée.

## 10. Technologies et choix de conception

Le choix des technologies repose sur des outils reconnus pour leur robustesse et leur pertinence dans le développement d’applications web de gestion. Django a été retenu pour sa performance, sa sécurité et la simplicité de modélisation des données. React a été choisi pour proposer une interface moderne, interactive et simple à manipuler.

L’architecture du projet a été pensée de manière modulaire. Chaque domaine fonctionnel est organisé autour d’un ensemble de modèles et de vues cohérents, ce qui facilite son extension et sa maintenance.

## 11. Structure du projet

Le dépôt est organisé en deux grands ensembles :

- Backend Django : dossier TPAPP
- Frontend React : dossier frontend

### Structure du backend

- TPAPP/TPAPP : configuration générale du projet
- travaux : gestion des axes, marchés, localisations et avancements
- media : stockage des fichiers et images liés aux travaux

### Structure du frontend

- src/api : accès aux endpoints API
- src/pages : pages de l’application
- src/components : composants réutilisables
- src/routes : gestion de navigation
- src/types : typage TypeScript
- src/styles : styles applicatifs

## 12. Développement et méthodologie

Le projet a été développé selon une approche progressive :

1. analyse du besoin métier ;
2. modélisation des données ;
3. développement des modèles Django ;
4. création des API REST ;
5. conception de l’interface front-end ;
6. intégration du front-end avec le back-end ;
7. validation fonctionnelle et correction des écarts ;
8. amélioration continue.

Cette méthode permet de mieux structurer le développement et d’aligner la solution sur les besoins réels de gestion des travaux.

## 13. Défis rencontrés

Pendant le développement, plusieurs défis ont été identifiés :

- gestion de la complexité des modèles métier ;
- exploitation des données géographiques et kilométriques ;
- sécurisation des accès ;
- intégration du front-end avec les API Django ;
- gestion des validations métier sur les segments et les avancements ;
- organisation efficace des informations techniques.

Ces défis ont permis d’améliorer la qualité du projet et de renforcer les compétences en développement web et en modélisation de données.

## 14. Bénéfices du système

L’implémentation de cette solution apporte plusieurs avantages :

- réduction du travail manuel ;
- meilleure traçabilité des interventions ;
- meilleur suivi des infrastructures et des travaux ;
- centralisation des informations ;
- amélioration de la prise de décision ;
- gain de temps dans l’exploitation des données ;
- meilleure organisation des activités techniques.

## 15. Limites et perspectives

### Limites

- nécessité d’une maintenance régulière des données ;
- dépendance à une bonne configuration serveur ;
- besoin d’ajustement selon les évolutions des procédures internes ;
- sécurisation à renforcer en environnement de production.

### Perspectives d’évolution

- ajout de tableaux de bord de suivi ;
- génération automatique de rapports ;
- exportation des données vers Excel ou PDF ;
- amélioration des filtres et des recherches ;
- ajout de notifications automatiques ;
- optimisation de l’interface pour une meilleure exploitation mobile.

## 16. Conclusion

Le projet ELALANA constitue une réponse concrète à un besoin réel de gestion et de suivi des travaux publics. En mettant en place un système basé sur Django et React, le projet permet de centraliser les données, améliorer la traçabilité des interventions et faciliter le suivi de l’avancement des infrastructures routières.

Au-delà de la simple création d’une application, ce projet montre l’importance de la numérisation des processus techniques et administratifs. Il offre une base solide pour une meilleure organisation, une meilleure gestion des projets et une optimisation des décisions liées aux travaux publics.

## 17. Plan de présentation pour la soutenance

### Introduction
- présentation du contexte du projet ;
- motivation et problématique.

### Analyse du besoin
- difficultés liées au suivi des travaux ;
- besoin de centralisation et de traçabilité.

### Solution proposée
- architecture du système ;
- modules principaux de gestion ;
- technologies utilisées.

### Démonstration
- présentation du suivi des axes ;
- gestion des segments PK ;
- gestion des marchés ;
- suivi de l’avancement des travaux.

### Défis et apprentissages
- complexité des données techniques ;
- organisation des modèles et des règles métier ;
- apprentissage en développement web et gestion de projet.

### Conclusion
- bilan de la solution ;
- perspectives d’amélioration.

## 18. Mots-clés

ELALANA, Django, React, suivi des travaux publics, infrastructures routières, gestion des marchés, avancement, données techniques, architecture logicielle.

## 19. Note finale

Ce document constitue une base solide pour la soutenance et peut être adapté selon le cadre académique exact demandé par le jury. Il met en avant le cœur du projet : la gestion et le suivi des travaux publics à travers une solution numérique moderne, cohérente et utile pour l’administration.

Le projet est basé sur une architecture client-serveur, avec une séparation claire entre le front-end et le back-end.

### 7.1 Front-end

Technologies utilisées :

- React
- TypeScript
- Vite
- Bootstrap
- CSS personnalisé
- Lucide React / Phosphor Icons

Le front-end est conçu pour fournir une interface utilisateur responsive, facile à naviguer et adaptée à un environnement d’administration publique.

### 7.2 Back-end

Technologies utilisées :

- Python
- Django
- Django REST Framework
- PostgreSQL
- JWT / cookies pour l’authentification
- django-allauth / dj-rest-auth
- django-filter, django-cors-headers, import-export

Le back-end gère la logique applicative, les modèles, les API, la sécurité, l’authentification et la persistance des données.

### 7.3 Sécurité et authentification

La configuration du projet inclut :

- API protégée par authentification ;
- support JWT et cookies ;
- gestion des CORS pour le front-end React ;
- contrôle d’accès selon les profils et modules ;
- utilisation des variables d’environnement pour les secrets.

## 8. Modèle de données

Le projet repose sur plusieurs modèles de données interconnectés. Les modèles principaux sont :

- Localisation
- Axe
- PKDistrict
- Marche
- Avancement / media d’avancement
- DirectionTP
- Personneltp
- Vehicle
- Mission
- Missionnaire
- CompteAgent
- VehicleStat
- Direction
- DemandeAudience
- Doleance
- Promesse
- Intervenant
- PieceJointe

Ces modèles reflètent la logique de gestion opérationnelle du projet : infrastructure, personnel, véhicules, missions, demandes administratives et suivi d’exécution.

## 9. Fonctionnalités principales

### 9.1 Gestion des travaux
- création et suivi des axes routiers ;
- gestion des segments PK ;
- calcul automatique des longueurs ;
- suivi des marchés et de leurs responsables ;
- suivi des étapes et des avancements.

### 9.2 Gestion des missions
- planification des missions ;
- affectation de personnel ;
- gestion des véhicules ;
- historique des statuts de véhicule ;
- suivi du lieu, de la date et de l’objectif de la mission.

### 9.3 Gestion des demandes d’audience
- enregistrement des demandes avec numérotation automatique ;
- suivi du statut ;
- redirection vers une direction compétente ;
- refus ou report selon les cas ;
- organisation du calendrier.

### 9.4 Gestion des doléances et promesses
- réception des doléances et des promesses ;
- classement par district, type d’autorité et statut ;
- suivi des étapes de traitement ;
- gestion des pièces jointes et des observations.

### 9.5 Authentification et gestion des comptes
- comptes d’utilisateurs ;
- profil d’agent associé à une personne et à une direction ;
- contrôle d’autorisation sur les actions sensibles.

## 10. Technologies et choix de conception

La solution a été construite avec des technologies modernes et adaptées à un environnement de gestion administrative. Le choix de Django a permis de bénéficier d’une architecture robuste, d’un ORM puissant et d’une organisation claire des modèles. Le choix de React a permis d’offrir une interface dynamique et conviviale.

Le projet adopte également une logique de développement modulaire. Chaque domaine fonctionnel est géré dans un module distinct, ce qui rend le projet extensible, plus lisible et plus facile à maintenir.

## 11. Structure du projet

Le dépôt est organisé en deux grandes parties :

- Backend Django : dossier TPAPP
- Frontend React : dossier frontend

### Structure du backend

- TPAPP/TPAPP : configuration générale du projet
- travaux : gestion des infrastructures et marchés
- om : gestion d’ordre de mission et véhicules
- audience : gestion des demandes d’audience
- apitp : doléances, promesses, interventions
- media : stockage des fichiers et images

### Structure du frontend

- src/api : accès aux endpoints API
- src/pages : pages de l’application
- src/components : composants réutilisables
- src/routes : gestion de navigation
- src/types : types TypeScript
- src/styles : styles applicatifs

## 12. Développement et méthodologie

Le projet a été développé selon une logique de conception progressive :

1. analyse du besoin métier ;
2. modélisation des données ;
3. développement des modèles Django ;
4. création des API REST ;
5. création de l’interface React ;
6. intégration du front-end avec le back-end ;
7. tests et validation fonctionnelle ;
8. amélioration continue et ajustements.

Cette approche permet de mieux cadrer le développement et d’aligner la solution sur les besoins opérationnels réels.

## 13. Défis rencontrés

Pendant le développement, plusieurs défis ont été identifiés :

- gestion de la complexité des modèles métier ;
- coordination entre modules inter-dépendants ;
- sécurisation des API et des accès ;
- intégration du front-end avec des endpoints Django ;
- gestion des informations géographiques et kilométriques ;
- adaptation de l’interface pour une utilisation administrative efficace ;
- gestion des pièces jointes, statuts et validations métier.

Ces défis ont permis de renforcer la qualité de la solution et d’approfondir les compétences en développement web et modélisation de données.

## 14. Bénéfices attendus

L’implémentation de cette solution apporte plusieurs avantages :

- réduction du travail manuel ;
- meilleure traçabilité des décisions ;
- plus grande fluidité dans la gestion des interventions ;
- temps de réponse plus rapide ;
- meilleure visibilité sur l’état des travaux et missions ;
- centralisation des données ;
- meilleure qualité de gestion administrative et technique.

## 15. Limites et perspectives

### Limites

- dépendance à une configuration serveur robuste ;
- nécessité d’une maintenance régulière des données ;
- besoin d’ajustement selon les évolutions des procédures administratives ;
- sécurité à renforcer en environnement de production avec gestion rigoureuse des permissions et des secrets.

### Perspectives d’évolution

- ajout de tableaux de bord analytiques et de statistiques ;
- génération de rapports PDF et Excel ;
- export et import de données avec meilleure ergonomie ;
- amélioration des filtres et recherches ;
- intégration de notifications automatiques ;
- ajout de rôles utilisateurs plus finement définis ;
- amélioration de la compatibilité mobile.

## 16. Conclusion

Le projet ELALANA constitue une réponse concrète à un besoin réel de digitalisation et de suivi des activités liées aux travaux publics et à la gestion administrative. En alliant un backend Django robuste, une API REST sécurisée et un front-end React moderne, la plateforme offre une solution cohérente, évolutive et adaptée à la gestion quotidienne des agents.

Au-delà de la simple mise en place d’un outil informatique, ce projet montre une réelle volonté d’optimiser les processus internes, de garantir la traçabilité, de réduire les pertes d’informations et de renforcer l’efficacité opérationnelle. Il représente ainsi une avancée importante dans la numérisation des services administratifs et techniques.

## 17. Plan de présentation pour la soutenance

### Introduction
- présentation du contexte et du besoin ;
- présentation générale du projet.

### Analyse du problème
- problèmes observés avant la solution ;
- impact sur le fonctionnement administratif.

### Solution proposée
- architecture ;
- modules clés ;
- technologies utilisées.

### Démonstration
- parcours utilisateur ;
- gestion des travaux ;
- gestion des missions et audience ;
- consultation des doléances et promesses.

### Défis et apprentissages
- difficultés rencontrées ;
- compétences acquises.

### Conclusion
- bilan du projet ;
- perspectives d’amélioration.

## 18. Mots-clés

ELALANA, Django, React, API REST, gestion des travaux publics, audience, doléances, promesses, missions, suivi administratif, développement web, sécurité, architecture logicielle.

## 19. Note finale

Ce document peut être adapté selon le cadre académique exact demandé par l’établissement et le jury. Il sert de base solide pour la préparation du mémoire de soutenance, avec un niveau de contenu suffisant pour exposer la problématique, la solution proposée, la structure technique et les apports du projet.
