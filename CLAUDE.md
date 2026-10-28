# Dossard — cahier des charges et référence projet

> Fichier de référence pour toutes les sessions de développement.
> **À mettre à jour à chaque évolution d'une règle.** Les décisions prises en cours de route
> sont consignées dans la section « Décisions et conventions » en fin de fichier.

« Dossard » est une application mobile personnelle (PWA) de préparation sportive
multi-objectifs (course à pied et triathlon). L'utilisateur travaille et teste
uniquement depuis son téléphone.

---

## 1. Contraintes techniques

- HTML, CSS et JavaScript natifs, sans framework ni étape de compilation. Aucune bibliothèque externe en V1.
- Hébergement GitHub Pages sous le chemin `/dossard/` : tous les chemins doivent être relatifs (`start_url` et `scope` du manifest à `"./"`).
- PWA installable (manifest, service worker, icônes), utilisable hors ligne sauf pour l'appel IA. Gère les mises à jour : version de cache incrémentée à chaque livraison et message « Nouvelle version disponible ».
- Données stockées sur le téléphone dans IndexedDB.
- Interface en français, pensée d'abord pour le mobile : grandes zones tactiles, barre d'onglets en bas, mode sombre automatique, dates et durées au format français.
- Le dépôt est public : aucune clé, aucun secret, aucune donnée personnelle dans le code.

## 2. Modèle de données

- **Profil** : niveau, allure habituelle en course, performances récentes, antécédents de blessures, matériel (montre GPS, vélo, accès piscine), remarques.
- **Semainier** : pour chaque jour, disponible oui/non, durée maximale, disciplines possibles ce jour-là. Plus un plafond de séances par semaine.
- **Objectif** : nom, sport (course ou triathlon), type, distance et dénivelé (modifiables), date de l'épreuve (= date de fin, obligatoire), temps visé (facultatif), statut, date de démarrage, résultat.
  - Types course : 5 km, 10 km, semi-marathon, marathon, trail (distance et dénivelé libres), autre.
  - Types triathlon : XS, S, M, L, XL, XXL, distances standard de la Fédération française de triathlon préremplies et modifiables.
- **Séance prévue** : date, discipline, type (endurance, fractionné, sortie longue, technique, enchaînement…), durée et/ou distance, intensité, description (échauffement, corps de séance, retour au calme), objectifs rattachés, état (à faire, faite, ratée).
- **Séance réalisée** : date, discipline, durée, distance, allure ou vitesse calculée automatiquement, ressenti de 1 à 5, notes, lien facultatif vers une séance prévue.
- **Disciplines** : course, vélo, natation, renforcement, enchaînement vélo-course.

## 3. Règles métier

- **Cycle de vie** : création au statut « À démarrer » → bouton « Démarrer l'objectif » → « En cours » (date de démarrage enregistrée) → bouton « Terminer » qui ouvre la saisie du résultat (temps, classement facultatif, ressenti, commentaire) → « Terminé ». Aucun changement de statut automatique.
- **Mutualisation** : une séance réalisée est rattachée automatiquement à tous les objectifs en cours qui incluent sa discipline.
- **Alertes** : délai trop court avant l'épreuve pour le type d'objectif, semainier insuffisant au regard du plafond, épreuve passée non clôturée.

## 4. Écrans

- **Accueil** : semaine en cours (prévu et réalisé), prochaine séance, avancement de chaque objectif en cours, alertes.
- **Objectifs** : liste groupée par statut, création, modification, boutons du cycle de vie.
- **Saisie rapide** d'une séance réalisée, accessible en un geste depuis l'accueil, préremplie si une séance était prévue ce jour-là.
- **Historique** : filtres par discipline et par objectif, totaux par semaine.
- **Réglages** : profil, semainier, clé API, sauvegarde.
- **Sauvegarde** : export complet en JSON et import avec confirmation avant écrasement. Rappel si aucun export depuis 30 jours.

## 5. Génération IA (LOT 2 — consigné ici, NE PAS DÉVELOPPER EN LOT 1)

- Appel direct depuis le navigateur à l'API Anthropic Messages (`https://api.anthropic.com/v1/messages`), en-têtes `x-api-key`, `anthropic-version: 2023-06-01` et `anthropic-dangerous-direct-browser-access: true`. Modèle modifiable dans les réglages, par défaut `claude-sonnet-5-5`.
- Clé API saisie dans les réglages, stockée uniquement sur le téléphone, champ masqué, bouton de suppression, jamais incluse dans l'export JSON.
- Déclencheurs : bouton « Démarrer l'objectif » et bouton « Recalculer le plan ». Le recalcul ne modifie jamais les séances passées ou réalisées.
- Données envoyées : date du jour, profil, semainier, plafond, tous les objectifs en cours, séances réalisées des 8 dernières semaines.
- Un plan unique couvrant tous les objectifs en cours (mutualisation), dans le respect strict du semainier et du plafond.
- Principes de coaching imposés : progression du volume hebdomadaire limitée à environ 10 %, environ 80 % du volume en intensité facile, semaine allégée toutes les 3 à 4 semaines, phases foncière / spécifique / affûtage, affûtage adapté à la distance, renforcement régulier, enchaînements pour le triathlon, prise en compte des antécédents de blessures, temps visé confronté au niveau réel.
- Réponse en JSON strict selon un schéma défini dans le code, validée avant import, un nouvel essai en cas d'erreur, aperçu du plan avant validation.
- Mode secours sans clé : bouton « Copier le prompt » et zone « Coller la réponse ».

## 6. Déroulé en lots

- **Lot 1** : sections 1 à 4. Le plan reste vide, avec la possibilité d'ajouter une séance prévue à la main pour tester.
- **Lot 2** : section 5.
- **Lot 3** : finitions selon les retours de l'utilisateur.

## 7. Méthode de travail

- Si un point est ambigu, poser la question avant de coder.
- Avancer par petites étapes avec des commits clairs, puis ouvrir une pull request vers `main` en fin de lot.
- Avant de rendre la main, vérifier soi-même : aucune erreur JavaScript, chemins relatifs corrects, manifest et service worker valides, et tester par un petit script les règles métier (cycle de vie, mutualisation, calcul d'allure, export/import).
- Terminer par un résumé court en français : ce qui a été fait, puis la liste des vérifications à faire sur le téléphone après la fusion.

---

## Décisions et conventions

_(Section tenue à jour au fil des sessions.)_

### Règles métier précisées avec l'utilisateur (lot 1)

- **Délais minimaux de préparation** (alerte « délai trop court », barème standard) :
  5 km : 6 semaines · 10 km : 8 · semi-marathon : 10 · marathon : 16 · trail : 10 (< 30 km), 16 (< 60 km), 20 au-delà · autre : 6 ·
  triathlon XS : 6 · S : 8 · M : 12 · L : 16 · XL : 20 · XXL : 24.
  Pour un objectif « À démarrer », le délai se mesure depuis aujourd'hui ; pour un objectif « En cours », depuis sa date de démarrage.
- **Avancement** d'un objectif en cours : barre du temps écoulé entre démarrage et épreuve, jours/semaines restants,
  nombre de séances et volume réalisés rattachés à l'objectif.
- **Mutualisation** : le renforcement compte pour tous les objectifs.
  Course → course + renforcement. Triathlon → course, vélo, natation, enchaînement, renforcement.
  Le rattachement est calculé à l'enregistrement de la séance (objectifs « En cours » à ce moment-là).
  À la modification d'une séance, les liens vers des objectifs déjà terminés sont conservés (historique).
- **Semainier insuffisant** : moins de jours disponibles que le plafond de séances, OU une discipline nécessaire
  à un objectif en cours n'est possible aucun jour disponible (course : course ; triathlon : course, vélo, natation).
- **Épreuve passée non clôturée** : tout objectif non terminé dont la date d'épreuve est dépassée.
- **Rappel de sauvegarde** : si des données existent et qu'aucun export n'a eu lieu depuis 30 jours
  (ou depuis la première utilisation si aucun export n'a jamais été fait).
- **Distances FFTri préremplies** (modifiables) : XS 400 m / 10 km / 2,5 km · S 750 m / 20 km / 5 km ·
  M 1 500 m / 40 km / 10 km · L 3 000 m / 80 km / 30 km · XL 4 000 m / 120 km / 30 km · XXL 3 800 m / 180 km / 42,195 km.
- Lier une séance réalisée à une séance prévue passe celle-ci à « faite » ; supprimer ou délier la séance réalisée la remet « à faire ».
- Allure : course en min/km, natation en min/100 m, vélo et enchaînement en km/h, rien pour le renforcement.
- Semaine du lundi au dimanche. Dates stockées en chaînes locales `AAAA-MM-JJ`, durées en secondes, distances en km
  (la natation est saisie et affichée en mètres).

### Architecture

- `index.html`, `manifest.webmanifest`, `sw.js` à la racine ; `.nojekyll` pour que GitHub Pages serve les fichiers tels quels.
- `js/` (modules ES natifs, imports relatifs) :
  - `format.js` : formats français (dates, durées, allures, nombres) ;
  - `domaine.js` : règles métier pures (référentiels, cycle de vie, mutualisation, allure, alertes, agrégats) ;
  - `sauvegarde.js` : construction et validation de l'export JSON (pur) ;
  - `db.js` : IndexedDB (base `dossard`) ; magasins `kv` (profil, semainier, réglages), `objectifs`, `prevues`, `realisees`
    — exportés — et `appareil` (clé API, date du dernier export, première utilisation) — **jamais exporté** ;
  - `magasin.js` : état en mémoire + actions qui écrivent dans IndexedDB ;
  - `ui.js` : création d'éléments, feuilles modales, champs ; `miseajour.js` : service worker et bandeau de mise à jour ;
  - `ecrans/` : accueil, plan, objectifs, historique, réglages, formulaires.
- Navigation par ancre (`#/accueil`, `#/plan`, `#/objectifs`, `#/historique`, `#/reglages[/profil|semainier|ia|sauvegarde|apropos]`).
- L'onglet **Plan** liste les séances prévues (ajout manuel au lot 1, génération IA au lot 2).

### Livraison et mises à jour

- À chaque livraison : incrémenter `VERSION` dans `sw.js` **et** dans `js/version.js` (un test vérifie qu'elles sont identiques).
- Tout nouveau fichier de l'application doit être ajouté à la liste `FICHIERS` de `sw.js` (vérifié par le test statique).
- Le service worker n'active pas la nouvelle version tout seul : bandeau « Nouvelle version disponible » → bouton « Mettre à jour ».

### Tests (à lancer avant chaque livraison)

- `node tests/regles.test.js` : règles métier (cycle de vie, mutualisation, allure, alertes, export/import).
- `node tests/statique.test.js` : manifest, service worker, chemins relatifs, version, absence de secrets.
- `node tests/e2e.cjs [dossier-captures]` : parcours complet dans Chromium (Playwright), servi sous `/dossard/`,
  hors ligne et mise à jour compris ; échoue à la moindre erreur JavaScript ou HTTP.
- `node outils/generer-icones.cjs icons` : régénère les PNG à partir de `icons/icone.svg`.
