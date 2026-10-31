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
- **Semainier** : pour chaque jour, disponible oui/non, créneaux horaires disponibles (v1.4.0 ; remplacent la durée maximale), disciplines possibles ce jour-là. Plus un plafond de séances par semaine.
- **Objectif** : nom, sport (course ou triathlon), type, distance et dénivelé (modifiables), date de l'épreuve (= date de fin, obligatoire), temps visé (facultatif), statut, date de démarrage, résultat.
  - Types course : 5 km, 10 km, semi-marathon, marathon, trail (distance et dénivelé libres), autre.
  - Types triathlon : XS, S, M, L, XL, XXL, distances standard de la Fédération française de triathlon préremplies et modifiables.
- **Séance prévue** : date, discipline, type (endurance, fractionné, sortie longue, technique, enchaînement…), durée et/ou distance, intensité, description (échauffement, corps de séance, retour au calme), objectifs rattachés, état (à faire, faite, ratée).
- **Séance réalisée** : date, discipline, durée, distance, allure ou vitesse calculée automatiquement, ressenti de 1 à 5, notes, lien facultatif vers une séance prévue.
- **Disciplines** : course, vélo, natation, renforcement, enchaînement vélo-course ; depuis la v1.4.0 : home trainer, VTT, elliptique, rameur, marche / randonnée, mobilité / yoga / étirements.

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
  M 1 500 m / 40 km / 10 km · L 1 900 m / 90 km / 21,1 km (format « half » / 70.3, choisi par l'utilisateur au lot 2) ·
  XL 4 000 m / 120 km / 30 km · XXL 3 800 m / 180 km / 42,195 km.
- Lier une séance réalisée à une séance prévue passe celle-ci à « faite » ; supprimer ou délier la séance réalisée la remet « à faire ».
- Allure : course en min/km, natation en min/100 m, vélo et enchaînement en km/h, rien pour le renforcement.
- Semaine du lundi au dimanche. Dates stockées en chaînes locales `AAAA-MM-JJ`, durées en secondes, distances en km
  (la natation est saisie et affichée en mètres).

### Génération du plan par l'IA (lot 2)

- **Horizon** : le plan couvre d'aujourd'hui à la veille de la dernière épreuve des objectifs en cours ; aucune séance un jour d'épreuve.
- **Recalcul** : seules les séances **IA futures « à faire »** sont remplacées. Les séances passées, réalisées, faites,
  ratées ou ajoutées à la main sont conservées ; les séances manuelles futures sont envoyées à l'IA comme contraintes.
- **« Démarrer l'objectif »** : l'objectif démarre, puis la feuille « Plan d'entraînement » s'ouvre ; avec une clé, la génération
  se lance automatiquement ; sans clé, la feuille s'ouvre sur le mode secours (« Copier le prompt » / « Coller la réponse »).
- **Calendrier envoyé** : l'application calcule elle-même les créneaux autorisés (date, jour, durée maximale restante,
  disciplines possibles) et le plafond restant par semaine, déduction faite des séances conservées et réalisées.
  L'IA ne choisit que parmi ces créneaux ; la réponse est rejetée sinon.
- **Validation stricte** avant aperçu : dates du calendrier, discipline possible ce jour, heure de début dans un créneau (v1.4.0),
  pas de chevauchement dans la journée, somme des durées ≤ durée disponible,
  nombre de séances ≤ plafond restant, énumérations (discipline, type, intensité), durée entière positive.
  Les `objectifIds` sont restreints aux objectifs en cours compatibles avec la discipline (à défaut : tous les compatibles).
- **Points d'attention** (non bloquants, affichés dans l'aperçu) : hausse de volume hebdomadaire > 15 %, moins de 70 % du volume en facile.
- **Appel API** : `fetch` direct en streaming SSE, `max_tokens` 64 000, sortie JSON structurée (`output_config.format` json_schema)
  et repli serveur en cas de refus (`fallbacks: "default"`, en-tête `anthropic-beta: server-side-fallback-2026-07-01`).
  Si l'API refuse ces options (400) ou après une coupure réseau, nouvel appel sans elles.
  Un plan invalide (ou tronqué) déclenche **un** nouvel essai, qui reçoit la liste des motifs de rejet. Refus du modèle : message d'erreur.
- Pendant la génération : progression (réflexion, nombre de séances reçues), écran maintenu allumé (Wake Lock), bouton « Arrêter ».
- Les métadonnées du dernier plan validé (analyse, phases, date, modèle) sont stockées dans `kv` sous la clé `plan` et exportées.
  La phase en cours est affichée sur l'accueil et dans l'onglet Plan ; les séances IA portent l'étiquette « IA ».

### Suivi de blessure (lot 3)

- **Principe** : suivi propre, séparé des séances d'entraînement, repéré par une couleur **verte** dédiée (`--soin`).
  Premier programme : tendinopathie d'Achille (corps du tendon), côté gauche ou droit, en 3 phases
  (1. Calmer : isométrie, 2 à 4 sem. · 2. Renforcer : montées lourdes et lentes, 8 à 12 sem. · 3. Rendre élastique : sautillements
  et reprise de course, 4 à 6 sem.). Le contenu des programmes est générique (référentiel `PROGRAMMES` de `js/soin.js`) ;
  le côté, les dates et les bilans restent sur le téléphone.
- **Bilan du jour** (un par jour et par suivi) : raideur au réveil, douleur à la marche et dans les escaliers (obligatoires, 0 à 10),
  douleur en courant, pendant les exercices, aux sautillements (facultatives), exercices faits, test des montées sur pointe
  (nombre + douleur), notes. Les bilans ne créent **pas** de séance réalisée.
- **Exercices du jour** : dosage selon la semaine dans la phase ; les exercices « un jour sur deux » suivent une **alternance fixe**
  depuis le début de la phase (jour d'exercice le 1er jour, puis tous les 2 jours), identique sur la carte, le bilan et le planning.
- **Alertes** : raideur en hausse deux jours de suite ; course > 4/10 (pas de course pendant 7 jours) ; exercices > 4/10.
- **Passage de phase** : l'application évalue les critères (durée minimale, dernières douleurs, raideur moyenne des 3 derniers bilans,
  test des montées) et **propose** le passage ; l'utilisateur confirme. Retour à la phase précédente possible. En fin de phase 3 :
  « Terminer le programme ». Après chaque changement : proposition de recalculer le plan.
- **Plan IA** : `contexte.blessures` décrit chaque suivi en cours avec une **projection des phases** à durée maximale (la phase actuelle
  dure au moins 7 jours) et la règle de course de chaque fenêtre (autorisée ou non, intensités, types, durée max). Phase 1 : course
  seulement si la dernière douleur de course (7 jours) est ≤ 4/10, footing facile ≤ 30 min. Phase 2 : facile ≤ 45 min, ni fractionné ni seuil.
  Phase 3 : facile ou modérée ≤ 60 min, pas de fractionné. Au-delà de la projection : pas de contrainte. Ces règles sont **validées
  strictement** (course et enchaînement). Le plan mémorise la phase de chaque suivi (`plan.soin`) ; un avertissement invite à le recalculer
  quand la phase a changé.
- **Écrans** : carte verte sur l'accueil (phase, exercices du jour, bilan, alertes) ou lien « Suivi de blessure » s'il n'y en a pas ;
  écran `#/soin` (`#/soin/<id>`, `#/soin/liste`) hors barre d'onglets.
- **Sauvegarde** : format 3 (format 2 : ajout de `blessures` et `bilans` ; format 3 : `seancesSoin`) ; les sauvegardes
  aux formats 1 et 2 restent importables (listes absentes = vides, puis le planning de soin est régénéré).

### Séances de soin dans le planning (lot 3, versions 1.3.0 et 1.3.1)

- **Stockage** : magasin IndexedDB dédié `seancesSoin` (et non `prevues` avec `source: 'soin'`). Les séances de soin sont ainsi
  invisibles par construction pour le plan IA (calendrier, durées, plafond restant, séances conservées), les volumes hebdomadaires,
  les compteurs « Prévu / Réalisé », la prochaine séance et la saisie rapide. Champs : `blessureId`, `date`, `phase`, `semaine`,
  `exercices` (id, nom, dosage du jour), `etat` (`a_faire`, `faite`, `ratee`).
- **Une séance par jour d'exercices et par suivi** : elle regroupe les exercices **obligatoires** du jour avec leur dosage
  (`exercicesObligatoires` de `js/soin.js`). Pas de séance les jours sans exercice obligatoire (phases 2 et 3 : un jour sur deux) ;
  l'isométrie facultative de la phase 2 n'en fait pas partie. Les séances sont obligatoires : elles ne dépendent pas du semainier
  et ne comptent pas dans le plafond.
- **Génération** (`reconcilierSoin`) : d'aujourd'hui à la **fin du programme** (v1.3.1 ; en 1.3.0, seulement la phase en cours) :
  la phase en cours puis les phases suivantes, enchaînées à leur **durée maximale** — même projection que pour le plan IA
  (`projectionPhases` ; la phase en cours dure au moins 7 jours à partir d'aujourd'hui). Dans une phase projetée, dosage et alternance
  partent de son début projeté. Génération à l'ouverture de l'application et après chaque création, modification, changement de phase,
  retour en arrière, fin de suivi et import : un vrai changement de phase recale donc les phases suivantes.
  Seules les séances futures (aujourd'hui compris) « à faire » sont créées, mises à jour ou supprimées ; les séances passées,
  faites ou ratées sont conservées. Supprimer un suivi supprime toutes ses séances.
- **Lien avec le bilan du jour, dans les deux sens** : passer la séance à « Faite » coche ses exercices dans le bilan du jour
  (s'il existe ; sinon ils seront précochés à la création du bilan) ; « À faire » ou « Ratée » les décoche. Enregistrer un bilan qui coche
  tous les exercices de la séance la passe « Faite » ; en décocher un repasse une séance faite « À faire ». Supprimer un bilan ne change
  pas l'état de la séance. Une séance créée un jour dont le bilan coche déjà tout naît « faite ».
- **Affichage** (vert `--soin`) : onglet Plan (lignes vertes dans les semaines et dans « En retard »), semaine de l'accueil
  (une pastille par séance, remplace l'ancienne pastille ✚ : pointillés = à faire, pleine ✓ = faite, rouge ✕ = ratée),
  compteur « Soin » (faites / prévues de la semaine, « hors plafond ») sous Prévu / Réalisé. Détail d'une séance : feuille
  « Séance de soin » (exercices, dosage, Marquer faite / ratée, Remettre à faire, Voir le suivi).

### Créneaux horaires et nouvelles disciplines (version 1.4.0)

- **Créneaux du semainier** : chaque jour disponible a un ou plusieurs créneaux `{ debut, fin }` en minutes depuis minuit,
  entre 5 h et 23 h, au pas de 15 min, d'au moins 15 min, sans chevauchement (`erreursCreneaux`). Saisie par deux curseurs
  (début, fin) sur une ligne de temps par créneau ; un curseur qui rattrape l'autre le pousse ; « ＋ Ajouter un créneau » propose
  la première heure libre parmi 18 h, 7 h, 12 h ; activer un jour propose 18 h – 19 h. `dureeMaxMin` est conservé et vaut la durée
  totale des créneaux (`normaliserSemainier`).
- **Migration** des semainiers d'avant la v1.4.0 (chargement, import) : l'ancienne durée maximale devient un créneau à 18 h
  s'il tient avant 23 h, sinon à 8 h, sinon de 5 h à 23 h (durée vide = journée entière).
- **Plan IA** : le calendrier envoyé donne les créneaux restants de chaque jour (« HH:MM ») ; ceux d'aujourd'hui déjà passés
  sont retirés (au quart d'heure suivant l'heure de génération) ; une séance conservée avec heure libère son intervalle, une séance
  sans heure (ou réalisée) réduit seulement la durée disponible. Chaque séance générée a une `heureDebut` obligatoire, doit tenir
  entièrement dans un créneau et ne pas chevaucher une autre séance du jour (validation stricte). L'heure s'affiche dans le planning.
- **Séance prévue** : `heureDebut` facultative (« HH:MM ») pour les séances ajoutées à la main.
- **Nouvelles disciplines** (référentiel `DISCIPLINES` de `js/domaine.js`, avec `allure` et `famille`) :
  home trainer et VTT (famille vélo : vitesse en km/h, rattachés aux objectifs triathlon, couvrent le vélo nécessaire au triathlon
  dans le contrôle du semainier) ; elliptique (km/h), rameur (distance en mètres, allure /500 m), marche / randonnée (allure /km),
  mobilité / yoga / étirements (ni distance ni allure) — entraînement complémentaire rattaché à tous les objectifs, comme le renforcement.
  Distances en mètres : natation et rameur (`DISCIPLINES_EN_METRES` de `js/format.js`).
- **Autoremplissage** : les formulaires et champs ont `autocomplete="off"` (et les attributs d'exclusion des gestionnaires
  de mots de passe). Cela ne suffit pas sur iPhone : Safari ignore `autocomplete="off"` et proposait l'adresse e-mail au-dessus
  du clavier dans les zones de texte. Depuis la v1.4.1, les **zones de texte libre** (`U.zoneTexte` : notes, antécédents, remarques,
  descriptions, commentaire, réponse collée du mode secours) sont des zones **éditables** (`contenteditable="plaintext-only"`,
  repli sur `true` avec collage en texte brut), que Safari ne préremplit pas. Elles gardent un attribut `name` et une propriété
  `value` ; `U.valeur(form, nom)` les lit ; un appui sur le libellé leur donne le focus. Plus aucun `<textarea>` dans l'application.

### Architecture

- `index.html`, `manifest.webmanifest`, `sw.js` à la racine ; `.nojekyll` pour que GitHub Pages serve les fichiers tels quels.
- `js/` (modules ES natifs, imports relatifs) :
  - `format.js` : formats français (dates, durées, allures, nombres) ;
  - `domaine.js` : règles métier pures (référentiels, cycle de vie, mutualisation, allure, alertes, agrégats) ;
  - `sauvegarde.js` : construction et validation de l'export JSON (pur) ;
  - `soin.js` : suivi de blessure — programmes, bilans, exercices du jour, alertes, critères de passage, contraintes du plan IA,
    séances de soin du planning (génération, lien avec le bilan) (pur) ;
  - `ia.js` : contexte envoyé, prompt, schéma JSON de la réponse, validation, remplacement des séances (pur) ;
  - `ia-api.js` : appel de l'API Anthropic en streaming, essais et gestion des erreurs ;
  - `db.js` : IndexedDB (base `dossard`, version 3) ; magasins `kv` (profil, semainier, réglages), `objectifs`, `prevues`, `realisees`, `blessures`, `bilans`, `seancesSoin`
    — exportés (dont `kv.plan`) — et `appareil` (clé API, date du dernier export, première utilisation) — **jamais exporté** ;
  - `magasin.js` : état en mémoire + actions qui écrivent dans IndexedDB ;
  - `ui.js` : création d'éléments, feuilles modales, champs ; `miseajour.js` : service worker et bandeau de mise à jour ;
  - `ecrans/` : accueil, plan, planIa (génération, mode secours, aperçu), objectifs, historique, réglages, formulaires, soin (suivi de blessure).
- Navigation par ancre (`#/accueil`, `#/plan`, `#/objectifs`, `#/historique`, `#/reglages[/profil|semainier|ia|sauvegarde|apropos]`, `#/soin[/<id>|/liste]`).
- L'onglet **Plan** : carte du plan IA (phase, analyse, « Recalculer le plan »), séances prévues (4 semaines affichées, puis bouton « Afficher les semaines suivantes »), ajout manuel.

### Livraison et mises à jour

- À chaque livraison : incrémenter `VERSION` dans `sw.js` **et** dans `js/version.js` (un test vérifie qu'elles sont identiques).
- Tout nouveau fichier de l'application doit être ajouté à la liste `FICHIERS` de `sw.js` (vérifié par le test statique).
- Le service worker n'active pas la nouvelle version tout seul : bandeau « Nouvelle version disponible » → bouton « Mettre à jour ».

### Tests (à lancer avant chaque livraison)

- `node tests/regles.test.js` : règles métier (cycle de vie, mutualisation, allure, alertes, export/import).
- `node tests/soin.test.js` : suivi de blessure (cycle de vie, bilans, exercices du jour, alertes, critères, contraintes et validation du plan IA,
  séances de soin du planning : génération, régénération, lien avec le bilan, isolement du plan IA, export/import).
- `node tests/ia.test.js` : génération IA (contexte, validation stricte, remplacement, streaming et essais avec API simulée).
- `node tests/statique.test.js` : manifest, service worker, chemins relatifs, version, absence de secrets.
- `node tests/e2e.cjs [dossier-captures]` : parcours complet dans Chromium (Playwright), servi sous `/dossard/`,
  génération IA (API simulée), mode secours, hors ligne et mise à jour compris ; échoue à la moindre erreur JavaScript ou HTTP.
- `node outils/generer-icones.cjs icons` : régénère les PNG à partir de `icons/icone.svg`.
