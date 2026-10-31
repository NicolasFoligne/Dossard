// Bibliothèque des exercices de soin (contenu générique, sans donnée personnelle) : fiche détaillée de chaque exercice,
// rythme de la séance guidée et schéma en bonhomme filaire. Les programmes du catalogue (js/programmes.js) et ceux proposés
// par une IA y renvoient par l'identifiant de l'exercice (champ `fiche`). Module pur (sans DOM), testé par tests/soin.test.js.
//
// Champs d'un exercice :
// - id, nom, objectif, materiel (liste) ;
// - depart (position de départ), etapes (numérotées), respiration, sensation (ce qu'on doit ressentir, intensité, douleur tolérée),
//   erreurs (fréquentes), adaptation (si douleur), facile / difficile (variantes) ;
// - seance : rythme de la séance guidée — tempo (phases d'une répétition [libellé, secondes], null = on compte soi-même),
//   recupS (repos entre deux séries, 60 s par défaut pour les isométriques), libelleTenue (consigne affichée pendant une tenue),
//   motTenue (mot annoncé par la voix : « Série 2 sur 5, contraction 30 secondes ») ;
// - isometrique : exercice tenu sans mouvement ;
// - schema : bonhomme filaire dans un cadre de 160 × 110 (sol à y = 100) — t : centre de la tête ; c : traits du corps
//   (polylignes « x,y x,y … ») ; d : décor (chemins SVG : mur, chaise, marche, charge…) ; e : élastique ; g : glace ;
//   a : mouvement circulaire ; f : flèches de mouvement [x1, y1, x2, y2, double] ; z : zone travaillée [x, y].

export const LENT_3_3 = [['Monte', 3], ['Descends', 3]];

export const EXERCICES = [
  {
    id: 'iso_mollet',
    nom: 'Isométrie du mollet, debout',
    objectif: 'Calmer la douleur du tendon d\'Achille et entretenir la force du mollet sans le fatiguer.',
    materiel: ['Un mur', 'Sac à dos lesté (selon la semaine)'],
    depart: 'Debout face à un mur, pieds à largeur de hanches, mains posées à plat sur le mur pour l\'équilibre. Genou tendu (sans le verrouiller).',
    etapes: [
      'Montez lentement sur la pointe des pieds jusqu\'à mi-hauteur (talons à environ 5 cm du sol).',
      'Arrêtez-vous et tenez la position, immobile, pendant toute la durée indiquée.',
      'Redescendez doucement, talons au sol, puis récupérez avant la série suivante.',
      'Sur une jambe : décollez l\'autre pied du sol et gardez le genou de la jambe d\'appui tendu.',
    ],
    respiration: 'Respirez calmement et régulièrement ; ne bloquez pas votre souffle.',
    sensation: 'Effort franc du mollet (environ 7 sur 10). Douleur du tendon tolérée jusqu\'à 3/10 ; elle diminue souvent pendant l\'exercice.',
    erreurs: [
      'Monter trop haut (tenue moins efficace).',
      'Laisser la cheville partir vers l\'extérieur.',
      'Plier le genou ou se pencher en avant.',
    ],
    adaptation: 'Douleur au-dessus de 3/10 : tenez plus bas (talons à peine décollés), sur les deux pieds, ou 30 s au lieu de 45 s. Si elle persiste, arrêtez et reprenez le lendemain.',
    facile: 'Sur les deux pieds, en tenant 30 s au lieu de 45 s.',
    difficile: 'Sur une jambe avec un sac à dos lesté (5 puis 10 kg).',
    seance: { tempo: null, recupS: 60, motTenue: 'contraction' },
    isometrique: true,
    schema: { t: [95, 14], c: ['95,21 95,56 95,76 95,93 102,100', '95,93 91,95', '95,27 106,35 119,32'], d: ['M120 8 V100'], f: [[86, 99, 86, 86]], z: [93, 82] },
  },
  {
    id: 'iso_soleaire',
    nom: 'Isométrie du soléaire, assis',
    objectif: 'Charger le soléaire (bas du mollet) en douceur, genou plié.',
    materiel: ['Chaise', 'Charge : sac lesté ou packs d\'eau'],
    depart: 'Assis sur une chaise, pied à plat, genou plié à angle droit. Posez une charge sur le genou (sac lesté, packs d\'eau).',
    etapes: [
      'Soulevez le talon à mi-hauteur en gardant l\'avant du pied au sol.',
      'Tenez immobile pendant la durée indiquée, en poussant sur l\'avant du pied.',
      'Reposez lentement le talon et récupérez.',
    ],
    respiration: 'Respiration calme et continue.',
    sensation: 'Travail en profondeur du bas du mollet (soléaire). Douleur ≤ 3/10.',
    erreurs: ['Soulever la charge avec les bras.', 'Monter le talon au maximum.'],
    adaptation: 'Douleur au-dessus de 3/10 : allégez la charge ou levez moins le talon.',
    facile: 'Sans charge, ou avec une charge plus légère.',
    difficile: 'Augmentez la charge de 5 kg d\'une semaine à l\'autre.',
    seance: { tempo: null, recupS: 60, motTenue: 'contraction' },
    isometrique: true,
    schema: { t: [52, 14], c: ['53,21 54,60 86,60 86,92 94,100', '86,92 82,94', '53,27 66,42 80,52'], d: ['M38 62 H72 M40 62 V100 M70 62 V100 M40 62 V24', 'M77 46 h14 v10 h-14 z'], f: [[78, 99, 78, 88]], z: [84, 80] },
  },
  {
    id: 'montees_lentes',
    nom: 'Montées lentes sur pointe',
    objectif: 'Reprendre en douceur le travail du mollet et du tendon, à rythme lent.',
    materiel: ['Un mur ou une chaise pour l\'appui'],
    depart: 'Debout, pieds à largeur de hanches, mains en appui léger sur un mur ou une chaise. Genoux tendus sans être verrouillés.',
    etapes: [
      'Montez sur la pointe des pieds en 3 secondes, jusqu\'en haut.',
      'Redescendez en 3 secondes, talons qui touchent juste le sol.',
      'Enchaînez sans rebond, au rythme donné par l\'application.',
      '« Plus de poids sur la jambe atteinte » : décalez le poids du corps de son côté, l\'autre pied ne fait qu\'aider.',
    ],
    respiration: 'Expirez en montant, inspirez en descendant.',
    sensation: 'Fatigue du mollet en fin de série. Douleur ≤ 3 à 4/10 et pas d\'aggravation le lendemain.',
    erreurs: [
      'Aller trop vite ou rebondir en bas.',
      'Rouler sur le bord externe du pied.',
      'Plier les genoux pour s\'aider.',
    ],
    adaptation: 'Douleur au-dessus de 4/10 : réduisez l\'amplitude, revenez sur les deux pieds ou faites 2 séries au lieu de 3.',
    facile: 'Amplitude plus petite, sur les deux pieds.',
    difficile: 'Sur une jambe, puis sur une marche, talon dans le vide.',
    seance: { tempo: LENT_3_3, recupS: 90 },
    schema: { t: [95, 14], c: ['95,21 95,56 95,76 95,93 102,100', '95,93 91,95', '95,27 106,35 119,32'], d: ['M120 8 V100'], f: [[84, 100, 84, 82, true]], z: [93, 82] },
  },
  {
    id: 'montees_lourdes',
    nom: 'Montées sur pointe lourdes, sur une marche',
    objectif: 'Renforcer lourdement le mollet et le tendon (renforcement lourd et lent).',
    materiel: ['Une marche avec rampe', 'Sac à dos lesté ou haltère'],
    depart: 'Sur une marche, l\'avant du pied en appui, talon dans le vide, une main sur la rampe. Chargez-vous d\'un sac à dos lesté si indiqué.',
    etapes: [
      'Laissez descendre le talon sous le niveau de la marche, sans à-coup.',
      'Montez sur la pointe en 3 secondes, le plus haut possible.',
      'Redescendez en 3 secondes jusqu\'en bas de l\'amplitude.',
      'Choisissez une charge qui rend les dernières répétitions difficiles mais propres.',
    ],
    respiration: 'Expirez en montant, inspirez en descendant.',
    sensation: 'Série vraiment fatigante (dernières répétitions dures). Douleur ≤ 4/10, pas pire le lendemain matin.',
    erreurs: [
      'Trop de charge : mouvement saccadé ou incomplet.',
      'Genou qui se plie (on travaille moins le mollet).',
      'Rebondir en bas de la marche.',
    ],
    adaptation: 'Douleur au-dessus de 4/10, ou raideur plus forte le lendemain : retirez de la charge, travaillez sur le sol plat et revenez au dosage de la semaine précédente.',
    facile: 'Sur le sol plat, ou sans charge.',
    difficile: 'Ajoutez 2 à 5 kg quand toutes les séries sont faciles.',
    seance: { tempo: LENT_3_3, recupS: 150 },
    schema: { t: [62, 10], c: ['62,16 62,46 62,63 62,80 72,84', '62,80 55,84', '62,22 74,30 86,26'], d: ['M60 100 V84 H120 V100', 'M88 100 V18', 'M49 22 h9 v16 h-9 z'], f: [[44, 92, 44, 70, true]], z: [60, 70] },
  },
  {
    id: 'montees_assis_lourdes',
    nom: 'Montées sur pointe assis, chargées',
    objectif: 'Renforcer le soléaire, très sollicité en course.',
    materiel: ['Chaise', 'Cale (livre, marche)', 'Charge lourde (sac, haltères)'],
    depart: 'Assis, genou plié à angle droit, l\'avant du pied sur une cale (livre, marche), une charge lourde posée sur le genou.',
    etapes: [
      'Laissez le talon descendre sous le niveau de la cale.',
      'Montez le talon en 3 secondes, le plus haut possible.',
      'Redescendez en 3 secondes.',
    ],
    respiration: 'Expirez en montant, inspirez en descendant.',
    sensation: 'Brûlure en profondeur du bas du mollet en fin de série. Douleur ≤ 4/10.',
    erreurs: ['Pousser la charge avec les mains.', 'Écourter l\'amplitude.'],
    adaptation: 'Douleur au-dessus de 4/10 : allégez la charge et retirez la cale.',
    facile: 'Charge plus légère, sans cale.',
    difficile: 'Augmentez la charge par paliers de 5 kg.',
    seance: { tempo: LENT_3_3, recupS: 120 },
    schema: { t: [52, 14], c: ['53,21 54,60 86,60 86,88 96,94', '86,88 82,92', '53,27 66,42 80,52'], d: ['M38 62 H72 M40 62 V100 M70 62 V100 M40 62 V24', 'M77 46 h14 v10 h-14 z', 'M90 94 h16 v6 h-16 z'], f: [[74, 100, 74, 82, true]], z: [84, 78] },
  },
  {
    id: 'sautillements',
    nom: 'Sautillements',
    objectif: 'Rendre le tendon de nouveau élastique avant la reprise de la course rapide.',
    materiel: ['Sol amorti (tapis, herbe, piste)'],
    depart: 'Debout sur un sol amorti (tapis, herbe, piste), pieds à largeur de hanches, genoux légèrement fléchis, regard devant.',
    etapes: [
      'Faites de petits rebonds sur l\'avant des pieds, talons qui ne touchent presque pas le sol.',
      'Gardez des sauts bas (2 à 5 cm), rapides et silencieux.',
      'Comptez vos rebonds avec le gros bouton de l\'application.',
      'Sur une jambe : même chose, en tenant un appui si besoin.',
    ],
    respiration: 'Respirez librement, sans bloquer.',
    sensation: 'Effort rapide et léger. Arrêtez la série si la douleur dépasse 3/10.',
    erreurs: ['Sauter trop haut.', 'Atterrir à plat ou sur les talons.', 'Genoux raides.'],
    adaptation: 'Douleur au-dessus de 4/10, ou raideur accrue le lendemain : moins de sauts, sur les deux pieds et plus bas ; revenez quelques jours au renforcement lent.',
    facile: 'Moins de rebonds par série, sur les deux pieds.',
    difficile: 'Sur une jambe, puis à la corde à sauter.',
    seance: { tempo: null, recupS: 90, libelleTenue: 'Sautez', motTenue: 'sauts' },
    schema: { t: [80, 10], c: ['80,17 80,50 84,68 80,86 88,90', '80,86 76,88', '80,23 70,36 76,46', '80,23 90,36 86,46'], d: [], f: [[108, 98, 108, 78, true]], z: [80, 80] },
  },
  {
    id: 'releveurs',
    nom: 'Releveurs du pied à l\'élastique',
    objectif: 'Renforcer les muscles de l\'avant du tibia, qui amortissent la pose du pied.',
    materiel: ['Élastique de rééducation', 'Pied de table ou point d\'attache'],
    depart: 'Assis, jambe tendue devant vous. Fixez un élastique à un pied de table et passez-le sur le dessus de l\'avant du pied.',
    etapes: [
      'Tirez la pointe du pied vers vous contre l\'élastique, en 2 secondes.',
      'Revenez lentement en 2 secondes, sans relâcher d\'un coup.',
    ],
    respiration: 'Expirez en tirant, inspirez en revenant.',
    sensation: 'Fatigue sur le devant du tibia. Pas de douleur vive.',
    erreurs: ['Bouger tout le genou.', 'Laisser l\'élastique ramener le pied d\'un coup.'],
    adaptation: 'Douleur au tibia au-dessus de 3/10 : élastique plus souple, amplitude plus petite.',
    facile: 'Élastique plus souple.',
    difficile: 'Élastique plus fort ou plus de répétitions.',
    seance: { tempo: [['Tire', 2], ['Reviens', 2]], recupS: 60 },
    schema: { t: [38, 50], c: ['38,57 36,92 72,94 106,94 110,84', '36,64 28,80 26,96'], d: ['M142 100 V40 M118 40 H154'], e: ['M110 86 L142 80'], f: [[122, 96, 114, 80]], z: [92, 92] },
  },
  {
    id: 'automassage',
    nom: 'Auto-massage',
    objectif: 'Détendre les tissus et diminuer la sensation de tension.',
    materiel: ['Rouleau, balle ou bouteille (fraîche pour le pied)'],
    depart: 'Assis au sol ou sur une chaise, avec un rouleau, une balle ou une bouteille.',
    etapes: [
      'Faites rouler lentement le rouleau ou la balle sur la zone indiquée.',
      'Insistez quelques secondes sur les zones tendues, sans appuyer sur l\'os ni sur la zone la plus douloureuse.',
    ],
    respiration: 'Respirez lentement pour relâcher.',
    sensation: 'Détente, légère gêne acceptable ; jamais de douleur vive.',
    erreurs: ['Appuyer fort sur un tendon ou sur l\'os.'],
    adaptation: 'Massez à côté de la zone douloureuse, jamais directement sur un point très sensible ; appuyez moins fort.',
    facile: 'Pression plus légère.',
    difficile: '—',
    seance: { tempo: null, recupS: 0, libelleTenue: 'Massez', motTenue: 'massage' },
    schema: { t: [36, 50], c: ['36,57 32,90 72,86 112,90 116,84', '34,64 24,80 20,96'], d: ['M80 95 a5 5 0 1 0 10 0 a5 5 0 1 0 -10 0'], f: [[68, 74, 102, 74, true]], z: [86, 86] },
  },
  {
    id: 'equilibre',
    nom: 'Équilibre sur une jambe',
    objectif: 'Retrouver la stabilité de la cheville et du pied (proprioception).',
    materiel: ['Un mur ou une chaise à portée de main', 'Coussin (variante difficile)'],
    depart: 'Debout sur la jambe atteinte, pieds nus, près d\'un mur ou d\'une chaise pour se rattraper. Genou légèrement fléchi.',
    etapes: [
      'Levez l\'autre pied et trouvez votre équilibre, bassin horizontal, regard fixé devant.',
      'Tenez la durée indiquée en corrigeant les petits déséquilibres avec la cheville.',
      'Progressez : yeux ouverts, puis yeux fermés, puis sur un coussin.',
    ],
    respiration: 'Respiration calme ; relâchez les épaules.',
    sensation: 'Petits ajustements de la cheville et du pied : c\'est normal et c\'est le but.',
    erreurs: ['Genou verrouillé.', 'Se tenir en permanence au mur.', 'Bassin qui penche.'],
    adaptation: 'Douleur ou instabilité : gardez une main sur l\'appui et raccourcissez la tenue.',
    facile: 'Yeux ouverts, un doigt posé sur le mur.',
    difficile: 'Yeux fermés sur un coussin, ou en lançant une balle.',
    seance: { tempo: null, recupS: 30, libelleTenue: 'Tenez l\'équilibre', motTenue: 'équilibre' },
    schema: { t: [80, 12], c: ['80,19 80,54 82,76 80,96 89,100', '80,96 77,100', '80,54 94,68 88,84', '80,26 66,36 56,38', '80,26 94,36 104,38'], d: ['M134 8 V100'], f: [], z: [80, 94] },
  },
  {
    id: 'iso_abduction',
    nom: 'Isométrie d\'abduction de hanche contre un mur',
    objectif: 'Activer le moyen fessier, qui stabilise le bassin et le genou, sans irriter la bandelette.',
    materiel: ['Un mur'],
    depart: 'Debout sur la jambe saine, côté atteint contre un mur, genou atteint légèrement plié et décollé du sol.',
    etapes: [
      'Poussez le genou (ou la cuisse) contre le mur, vers l\'extérieur.',
      'Tenez la poussée sans bouger pendant la durée indiquée.',
      'Relâchez et récupérez.',
    ],
    respiration: 'Respirez normalement pendant la poussée.',
    sensation: 'Travail sur le côté de la hanche (fessier). Pas de douleur au genou.',
    erreurs: ['Pencher le buste vers le mur.', 'Pousser trop fort au début.'],
    adaptation: 'Douleur au genou ou à la hanche : poussez moins fort (30 à 50 %) ou raccourcissez la tenue.',
    facile: 'Poussée plus légère, durée plus courte.',
    difficile: 'Poussée plus forte, sur une jambe d\'appui légèrement fléchie.',
    seance: { tempo: null, recupS: 60, libelleTenue: 'Poussez', motTenue: 'contraction' },
    isometrique: true,
    schema: { t: [80, 12], c: ['80,19 80,54', '76,54 74,77 74,98 68,100', '84,54 92,74 90,90', '80,26 68,40 66,54', '80,26 92,38 98,30'], d: ['M100 6 V100'], f: [[84, 70, 96, 70]], z: [86, 56] },
  },
  {
    id: 'pont',
    nom: 'Pont fessier',
    objectif: 'Renforcer les fessiers et l\'arrière des cuisses pour mieux stabiliser le bassin.',
    materiel: ['Tapis de sol'],
    depart: 'Allongé sur le dos, genoux pliés, pieds à plat à largeur de hanches, bras le long du corps.',
    etapes: [
      'Serrez les fessiers et soulevez le bassin jusqu\'à aligner épaules, hanches et genoux.',
      'Tenez 2 secondes en haut sans creuser le bas du dos.',
      'Redescendez lentement, vertèbre par vertèbre.',
      'Version sur une jambe : tendez l\'autre jambe dans l\'axe de la cuisse.',
    ],
    respiration: 'Expirez en montant, inspirez en descendant.',
    sensation: 'Travail des fessiers et de l\'arrière des cuisses ; pas de douleur dans le dos.',
    erreurs: ['Pousser avec le bas du dos (dos cambré).', 'Genoux qui s\'écartent ou se rapprochent.'],
    adaptation: 'Gêne dans le dos : montez moins haut et serrez les abdominaux ; douleur au genou : rapprochez les pieds des fesses.',
    facile: 'Amplitude plus petite, sur les deux jambes.',
    difficile: 'Sur une jambe, puis avec une charge sur le bassin.',
    seance: { tempo: [['Monte', 2], ['Tenez', 2], ['Descends', 2]], recupS: 60 },
    schema: { t: [28, 92], c: ['36,95 76,78 104,70 110,97 120,99', '40,98 72,99'], d: [], f: [[76, 98, 76, 84, true]], z: [76, 80] },
  },
  {
    id: 'releve_lateral',
    nom: 'Relevés de jambe latéraux',
    objectif: 'Renforcer le moyen fessier (stabilité de la hanche et du genou).',
    materiel: ['Tapis de sol', 'Élastique (variante difficile)'],
    depart: 'Couché sur le côté sain, jambe du dessous pliée, tête posée sur le bras, bassin bien de profil.',
    etapes: [
      'Montez la jambe du dessus tendue, légèrement en arrière, pointe de pied tournée vers le sol.',
      'Montez jusqu\'à 30 à 40 cm, sans rouler le bassin vers l\'arrière.',
      'Redescendez lentement sans poser la jambe.',
    ],
    respiration: 'Expirez en montant, inspirez en descendant.',
    sensation: 'Brûlure sur le côté de la fesse en fin de série.',
    erreurs: [
      'Lever la jambe vers l\'avant (on travaille alors la cuisse).',
      'Basculer le bassin en arrière.',
      'Aller trop vite.',
    ],
    adaptation: 'Douleur sur le côté de la hanche : amplitude plus petite, coussin entre les genoux.',
    facile: 'Amplitude plus faible.',
    difficile: 'Ajoutez un élastique autour des chevilles ou un lest.',
    seance: { tempo: [['Monte', 2], ['Descends', 2]], recupS: 60 },
    schema: { t: [22, 84], c: ['30,88 72,90 136,72', '72,92 96,98 76,99', '30,92 18,96 34,98'], d: [], f: [[144, 96, 144, 66, true]], z: [74, 88] },
  },
  {
    id: 'descente_marche',
    nom: 'Descentes de marche contrôlées',
    objectif: 'Contrôler le genou et la hanche en descente, comme à la réception de la foulée.',
    materiel: ['Marche ou step', 'Un appui à portée de main'],
    depart: 'Debout sur une marche (ou un step) sur la jambe atteinte, l\'autre jambe dans le vide, main près d\'un appui.',
    etapes: [
      'Pliez lentement le genou d\'appui pour descendre le talon libre vers le sol, en 3 secondes.',
      'Gardez le genou dans l\'axe du pied et le bassin horizontal.',
      'Effleurez le sol avec le talon libre, sans prendre appui, puis remontez en 2 secondes.',
    ],
    respiration: 'Inspirez en descendant, expirez en remontant.',
    sensation: 'Travail de la cuisse et de la fesse ; pas de douleur vive au genou.',
    erreurs: [
      'Genou qui part vers l\'intérieur.',
      'Bassin qui tombe du côté de la jambe libre.',
      'Se laisser tomber.',
    ],
    adaptation: 'Douleur au genou au-dessus de 3/10 : marche plus basse, descente moins profonde, une main en appui.',
    facile: 'Marche plus basse.',
    difficile: 'Marche plus haute ou sac à dos lesté.',
    seance: { tempo: [['Descends', 3], ['Remonte', 2]], recupS: 90 },
    schema: { t: [62, 11], c: ['62,17 62,45 70,59 62,73 72,76', '62,45 76,60 84,78 90,80', '62,24 76,32 86,28'], d: ['M30 100 V76 H80 V100'], f: [[100, 70, 100, 94, true]], z: [66, 58] },
  },
  {
    id: 'pas_chasses',
    nom: 'Pas chassés avec élastique',
    objectif: 'Renforcer les fessiers en charge et la stabilité latérale.',
    materiel: ['Mini-bande élastique'],
    depart: 'Élastique autour des chevilles (ou au-dessus des genoux), pieds écartés, genoux légèrement fléchis, buste droit.',
    etapes: [
      'Faites un pas sur le côté en gardant l\'élastique tendu.',
      'Ramenez l\'autre pied à moitié seulement, sans relâcher la tension.',
      'Faites tous les pas d\'un côté, puis revenez de l\'autre.',
    ],
    respiration: 'Respiration libre et régulière.',
    sensation: 'Chauffe sur le côté des hanches.',
    erreurs: ['Pieds qui se touchent (élastique relâché).', 'Buste qui se balance.'],
    adaptation: 'Douleur : élastique au-dessus des genoux (plus facile) et pas plus petits.',
    facile: 'Élastique plus souple.',
    difficile: 'Élastique plus fort, genoux plus fléchis.',
    seance: { tempo: null, recupS: 45 },
    schema: { t: [80, 16], c: ['80,23 80,54', '76,54 64,74 60,96 52,99', '84,54 96,74 100,96 108,99', '80,28 66,42 74,52', '80,28 94,42 86,52'], e: ['M61 90 L99 90'], d: [], f: [[114, 70, 144, 70]], z: [86, 58] },
  },
  {
    id: 'gainage_lateral',
    nom: 'Gainage latéral',
    objectif: 'Renforcer les muscles latéraux du tronc et de la hanche, pour un bassin stable en course.',
    materiel: ['Tapis de sol'],
    depart: 'Couché sur le côté, en appui sur l\'avant-bras (coude sous l\'épaule), jambes tendues l\'une sur l\'autre.',
    etapes: [
      'Soulevez le bassin pour aligner chevilles, hanches et épaules.',
      'Tenez la position pendant la durée indiquée.',
      'Changez de côté.',
    ],
    respiration: 'Respirez calmement, ne bloquez pas.',
    sensation: 'Travail du flanc et de la fesse du côté au sol.',
    erreurs: ['Bassin qui s\'affaisse.', 'Fesses en arrière.'],
    adaptation: 'Douleur à l\'épaule ou à la hanche : genoux pliés au sol, tenue plus courte.',
    facile: 'En appui sur les genoux pliés.',
    difficile: 'Levez la jambe du dessus.',
    seance: { tempo: null, recupS: 60, libelleTenue: 'Gainez', motTenue: 'gainage' },
    isometrique: true,
    schema: { t: [21, 71], c: ['30,76 85,87 142,98', '30,76 30,98 48,98', '30,76 56,72 80,82'], d: [], f: [[86, 100, 86, 92]], z: [84, 86] },
  },
  {
    id: 'fentes',
    nom: 'Fentes avant',
    objectif: 'Renforcer cuisses et fessiers, et le contrôle du genou sur une jambe.',
    materiel: ['Aucun (haltères en variante)'],
    depart: 'Debout, pieds à largeur de hanches, mains sur les hanches.',
    etapes: [
      'Faites un grand pas en avant.',
      'Descendez le genou arrière vers le sol en 2 secondes, genou avant au-dessus de la cheville.',
      'Remontez en poussant sur le talon avant, puis changez de jambe (ou avancez pour les fentes marchées).',
    ],
    respiration: 'Inspirez en descendant, expirez en remontant.',
    sensation: 'Travail des cuisses et des fessiers ; pas de douleur vive au genou.',
    erreurs: [
      'Genou avant qui dépasse largement les orteils ou rentre vers l\'intérieur.',
      'Buste penché en avant.',
    ],
    adaptation: 'Douleur au genou : fente moins profonde, une main posée sur une chaise.',
    facile: 'Descente moins profonde.',
    difficile: 'Avec des haltères ou un sac lesté.',
    seance: { tempo: [['Descends', 2], ['Remonte', 2]], recupS: 90 },
    schema: { t: [78, 12], c: ['78,19 78,56 102,64 102,96 112,100', '78,56 64,92 46,94 42,100', '78,26 68,40 76,52'], d: [], f: [[132, 48, 132, 78, true]], z: [92, 60] },
  },
  {
    id: 'chaise',
    nom: 'Chaise contre le mur',
    objectif: 'Charger la cuisse avant en isométrie : effet antidouleur sur le genou.',
    materiel: ['Un mur'],
    depart: 'Dos plaqué contre un mur, pieds à environ 50 cm du mur, écartés à largeur de hanches.',
    etapes: [
      'Glissez le dos le long du mur jusqu\'à l\'angle de genou indiqué (45° à 60°, pas plus bas au début).',
      'Tenez immobile pendant la durée indiquée, poids réparti sur les talons.',
      'Remontez en glissant le long du mur et récupérez.',
    ],
    respiration: 'Respirez calmement ; ne bloquez pas.',
    sensation: 'Effort franc des cuisses (environ 7/10). Douleur du genou ≤ 3/10, souvent soulagée par l\'exercice.',
    erreurs: ['Descendre trop bas.', 'Genoux qui rentrent vers l\'intérieur.', 'Décoller le dos du mur.'],
    adaptation: 'Douleur au-dessus de 3/10 : remontez un peu (genoux moins pliés) ou raccourcissez la tenue.',
    facile: 'Angle plus petit (moins fléchi), durée plus courte.',
    difficile: 'Plus de poids sur la jambe atteinte, puis sur une jambe.',
    seance: { tempo: null, recupS: 60, motTenue: 'contraction' },
    isometrique: true,
    schema: { t: [46, 20], c: ['46,27 46,64 80,64 80,96 90,100', '80,96 76,99', '46,34 60,48 72,58'], d: ['M39 6 V100'], f: [], z: [64, 62] },
  },
  {
    id: 'squat',
    nom: 'Squat',
    objectif: 'Renforcer cuisses et fessiers en contrôlant l\'alignement des genoux.',
    materiel: ['Charge facultative (sac, haltère)'],
    depart: 'Debout, pieds à largeur de hanches, pointes légèrement ouvertes ; tenez une charge contre la poitrine si indiqué.',
    etapes: [
      'Descendez en reculant les fesses, comme pour vous asseoir, en 3 secondes.',
      'Arrêtez-vous à la profondeur indiquée (60° à 90° de flexion de genou), genoux dans l\'axe des pieds.',
      'Remontez au rythme indiqué en poussant sur toute la plante des pieds.',
    ],
    respiration: 'Inspirez en descendant, expirez en remontant.',
    sensation: 'Fatigue des cuisses et des fessiers ; douleur du genou ≤ 4/10.',
    erreurs: ['Genoux qui rentrent vers l\'intérieur.', 'Talons qui décollent.', 'Dos rond.'],
    adaptation: 'Douleur au genou au-dessus de 3/10 : descendez moins bas, sans charge, ou tenez-vous à un appui.',
    facile: 'Descente moins profonde, sans charge, ou en s\'asseyant sur une chaise.',
    difficile: 'Ajoutez de la charge par paliers de 2 à 5 kg.',
    seance: { tempo: [['Descends', 3], ['Remonte', 2]], recupS: 90 },
    schema: { t: [86, 20], c: ['83,27 70,62 98,74 84,96 96,100', '84,96 80,99', '82,32 96,42 100,36'], d: ['M97 30 h10 v10 h-10 z'], f: [[126, 40, 126, 72, true]], z: [86, 68] },
  },
  {
    id: 'montee_marche',
    nom: 'Montées de marche',
    objectif: 'Renforcer la jambe en montée, sur un appui, en gardant le genou aligné.',
    materiel: ['Marche ou step de 15 à 20 cm'],
    depart: 'Face à une marche (15 à 20 cm), pied de la jambe atteinte posé à plat sur la marche.',
    etapes: [
      'Montez en poussant sur le pied posé, sans vous aider de l\'autre jambe.',
      'Tenez-vous droit en haut, genou dans l\'axe du pied.',
      'Redescendez lentement en 3 secondes.',
    ],
    respiration: 'Expirez en montant, inspirez en descendant.',
    sensation: 'Travail de la cuisse ; pas de douleur vive.',
    erreurs: ['Pousser avec le pied resté au sol.', 'Genou qui part vers l\'intérieur.'],
    adaptation: 'Douleur au genou : marche plus basse, une main en appui.',
    facile: 'Marche plus basse.',
    difficile: 'Marche plus haute ou sac lesté.',
    seance: { tempo: [['Monte', 2], ['Descends', 3]], recupS: 90 },
    schema: { t: [65, 13], c: ['64,20 62,52 62,74 60,96 68,100', '62,52 82,58 88,76 98,80', '64,26 56,38 60,48'], d: ['M80 100 V80 H140'], f: [[40, 88, 40, 56, true]], z: [74, 56] },
  },
  {
    id: 'fente_bulgare',
    nom: 'Fente bulgare',
    objectif: 'Renforcer lourdement la cuisse avant sur une jambe (tendon rotulien).',
    materiel: ['Chaise ou banc', 'Haltères (variante difficile)'],
    depart: 'Dos à une chaise, posez le dessus du pied arrière sur l\'assise ; pied avant (jambe atteinte) un grand pas devant.',
    etapes: [
      'Descendez lentement en 3 secondes en pliant le genou avant, buste droit.',
      'Arrêtez-vous quand la cuisse avant approche de l\'horizontale.',
      'Remontez en 3 secondes en poussant sur le talon avant.',
    ],
    respiration: 'Inspirez en descendant, expirez en remontant.',
    sensation: 'Effort important de la cuisse avant et du fessier.',
    erreurs: ['Genou avant qui rentre vers l\'intérieur.', 'Pied avant trop près de la chaise.'],
    adaptation: 'Douleur au tendon au-dessus de 4/10 : descente moins profonde, sans charge, ou revenez au squat.',
    facile: 'Descente partielle, une main sur un appui.',
    difficile: 'Avec haltères ou sac lesté.',
    seance: { tempo: LENT_3_3, recupS: 120 },
    schema: { t: [83, 15], c: ['82,22 80,56 104,68 104,96 114,100', '80,56 70,86 50,68 42,70', '82,28 74,42 80,54'], d: ['M18 70 H54 M22 70 V100 M50 70 V100 M22 70 V38'], f: [[132, 48, 132, 78, true]], z: [94, 62] },
  },
  {
    id: 'etirement_aponevrose',
    nom: 'Étirement de l\'aponévrose plantaire',
    objectif: 'Assouplir la voûte plantaire, surtout le matin avant les premiers pas.',
    materiel: ['Chaise'],
    depart: 'Assis, pied atteint posé sur le genou opposé.',
    etapes: [
      'Attrapez les orteils et tirez-les vers vous jusqu\'à sentir la tension sous le pied.',
      'Avec l\'autre main, vérifiez que la bande sous le pied est tendue.',
      'Tenez la durée indiquée, relâchez, puis recommencez.',
      'Faites-le avant le premier pas du matin.',
    ],
    respiration: 'Respirez lentement pendant la tenue.',
    sensation: 'Étirement net sous la voûte plantaire, sans douleur vive.',
    erreurs: ['Tirer d\'un coup.', 'Oublier de le faire avant de se lever.'],
    adaptation: 'Tirez moins fort : l\'étirement doit rester doux, jamais douloureux.',
    facile: 'Tension plus légère.',
    difficile: 'Tenue plus longue.',
    seance: { tempo: null, recupS: 30, libelleTenue: 'Étirez', motTenue: 'étirement' },
    schema: { t: [49, 18], c: ['48,25 46,60 80,60 80,96 90,100', '46,58 66,46 84,56 92,46', '48,32 70,40 90,46'], d: ['M30 62 H62 M32 62 V100 M60 62 V100 M32 62 V26'], f: [[100, 52, 96, 40]], z: [86, 52] },
  },
  {
    id: 'montees_serviette',
    nom: 'Montées sur pointe, orteils relevés',
    objectif: 'Renforcer la voûte plantaire et le mollet en tendant l\'aponévrose.',
    materiel: ['Une marche', 'Serviette roulée', 'Sac à dos lesté (selon la semaine)'],
    depart: 'Sur une marche, une serviette roulée sous les orteils du pied atteint (orteils relevés), talon dans le vide, main sur la rampe.',
    etapes: [
      'Montez sur la pointe en 3 secondes, orteils toujours relevés sur la serviette.',
      'Tenez 2 secondes en haut.',
      'Redescendez en 3 secondes, talon sous le niveau de la marche.',
    ],
    respiration: 'Expirez en montant, inspirez en descendant.',
    sensation: 'Tension sous le pied et fatigue du mollet ; douleur ≤ 4/10.',
    erreurs: ['Serviette qui glisse.', 'Mouvement rapide ou incomplet.'],
    adaptation: 'Douleur au-dessus de 4/10 : sans charge, sur les deux pieds, ou sans serviette.',
    facile: 'Sans charge, au sol.',
    difficile: 'Sac à dos lesté.',
    seance: { tempo: [['Monte', 3], ['Tenez', 2], ['Descends', 3]], recupS: 120 },
    schema: { t: [62, 10], c: ['62,16 62,46 62,63 62,80 72,82', '62,80 55,84', '62,22 74,30 86,26'], d: ['M60 100 V84 H120 V100', 'M88 100 V18', 'M68 81 a3 3 0 1 0 6 0 a3 3 0 1 0 -6 0'], f: [[44, 92, 44, 70, true]], z: [66, 82] },
  },
  {
    id: 'pied_court',
    nom: 'Pied court',
    objectif: 'Renforcer les petits muscles de la voûte plantaire.',
    materiel: ['Chaise', 'Serviette'],
    depart: 'Assis, pieds à plat au sol (puis debout quand c\'est facile).',
    etapes: [
      'Rapprochez l\'avant du pied du talon en creusant la voûte, sans plier les orteils.',
      'Tenez la contraction pendant la durée indiquée, puis relâchez.',
      'Ensuite, ramassez une serviette posée au sol avec les orteils, plusieurs fois.',
    ],
    respiration: 'Respiration calme.',
    sensation: 'Petite crampe sous le pied : c\'est le muscle qui travaille.',
    erreurs: ['Recroqueviller les orteils.', 'Soulever le talon.'],
    adaptation: 'Crampe ou douleur : relâchez ; contractions plus courtes et moins fortes.',
    facile: 'Assis, tenue plus courte.',
    difficile: 'Debout sur une jambe.',
    seance: { tempo: null, recupS: 60, libelleTenue: 'Creusez la voûte', motTenue: 'contraction' },
    isometrique: true,
    schema: { t: [52, 14], c: ['53,21 54,60 86,60 86,95 96,100', '86,95 82,100', '53,27 66,42 80,54'], d: ['M38 62 H72 M40 62 V100 M70 62 V100 M40 62 V24'], f: [[90, 100, 90, 92]], z: [89, 98] },
  },
  {
    id: 'alphabet',
    nom: 'Mobilité de la cheville (alphabet)',
    objectif: 'Retrouver l\'amplitude de la cheville et faire circuler le gonflement.',
    materiel: ['Coussin'],
    depart: 'Assis ou allongé, jambe atteinte surélevée sur un coussin.',
    etapes: [
      'Avec la pointe du pied, « écrivez » les lettres de l\'alphabet en majuscules, lentement.',
      'Faites des mouvements amples mais sans forcer.',
    ],
    respiration: 'Respiration calme.',
    sensation: 'Raideur qui diminue ; légère gêne acceptable.',
    erreurs: ['Bouger tout le genou au lieu de la cheville.', 'Forcer dans la douleur.'],
    adaptation: 'Douleur : mouvements plus petits et plus lents.',
    facile: 'Lettres plus petites.',
    difficile: '—',
    seance: { tempo: null, recupS: 0, motTenue: 'mobilité' },
    schema: { t: [38, 50], c: ['38,57 32,92 70,84 104,78 108,68', '36,64 26,80 22,96'], d: ['M74 92 q16 -18 34 0 z'], a: ['M100 60 A10 10 0 1 1 116 68'], f: [], z: [104, 76] },
  },
  {
    id: 'iso_eversion',
    nom: 'Isométrie de la cheville (éversion)',
    objectif: 'Réveiller les muscles qui protègent la cheville de l\'entorse, sans bouger l\'articulation.',
    materiel: ['Pied de table ou mur'],
    depart: 'Assis, genou plié, bord externe du pied atteint contre un pied de table ou un mur.',
    etapes: [
      'Poussez le bord externe du pied vers l\'extérieur, contre l\'obstacle, sans bouger.',
      'Tenez la poussée pendant la durée indiquée, puis relâchez.',
    ],
    respiration: 'Respirez normalement pendant la poussée.',
    sensation: 'Contraction sur le côté externe de la jambe ; pas de douleur vive.',
    erreurs: ['Tourner tout le genou.', 'Pousser trop fort au début.'],
    adaptation: 'Douleur au-dessus de 3/10 : poussez moins fort.',
    facile: 'Poussée légère.',
    difficile: 'Poussée plus forte.',
    seance: { tempo: null, recupS: 10, libelleTenue: 'Poussez', motTenue: 'contraction' },
    isometrique: true,
    schema: { t: [52, 14], c: ['53,21 54,60 86,60 86,95 96,100', '86,95 82,100', '53,27 66,42 80,54'], d: ['M38 62 H72 M40 62 V100 M70 62 V100 M40 62 V24', 'M104 100 V50 M90 50 H140'], f: [[88, 90, 102, 90]], z: [92, 96] },
  },
  {
    id: 'eversion_elastique',
    nom: 'Éversion à l\'élastique',
    objectif: 'Renforcer les muscles externes de la cheville (péroniers).',
    materiel: ['Élastique de rééducation', 'Point d\'attache'],
    depart: 'Assis, jambe tendue, élastique autour de l\'avant du pied atteint, fixé de l\'autre côté (vers l\'intérieur).',
    etapes: [
      'Tournez la plante du pied vers l\'extérieur contre l\'élastique, en 2 secondes.',
      'Revenez lentement en 2 secondes.',
    ],
    respiration: 'Expirez en tirant, inspirez en revenant.',
    sensation: 'Fatigue sur le côté externe de la jambe.',
    erreurs: ['Bouger le genou ou la hanche.', 'Relâcher d\'un coup.'],
    adaptation: 'Douleur : élastique plus souple, amplitude plus petite.',
    facile: 'Élastique plus souple.',
    difficile: 'Élastique plus fort.',
    seance: { tempo: [['Tire', 2], ['Reviens', 2]], recupS: 60 },
    schema: { t: [38, 50], c: ['38,57 36,92 72,94 106,94 110,84', '36,64 28,80 26,96'], d: ['M142 100 V40 M118 40 H154'], e: ['M110 88 L142 84'], f: [[114, 76, 124, 94]], z: [104, 92] },
  },
  {
    id: 'glace',
    nom: 'Glace et jambe surélevée',
    objectif: 'Limiter le gonflement les premiers jours.',
    materiel: ['Poche de glace (ou petits pois surgelés)', 'Linge', 'Coussins'],
    depart: 'Allongé, jambe surélevée sur des coussins (cheville plus haute que le genou).',
    etapes: [
      'Posez une poche de glace enveloppée dans un linge sur la zone gonflée.',
      'Laissez en place la durée indiquée, sans contact direct avec la peau.',
    ],
    respiration: '—',
    sensation: 'Froid supportable ; retirez si la peau brûle ou devient blanche.',
    erreurs: ['Glace directement sur la peau.', 'Plus de 20 minutes d\'affilée.'],
    adaptation: 'Peau qui brûle ou devient blanche : retirez la glace.',
    facile: '—',
    difficile: '—',
    seance: { tempo: null, recupS: 0, libelleTenue: 'Glace', motTenue: 'glace' },
    schema: { t: [18, 92], c: ['26,95 70,96 102,82 130,76 134,66', '30,98 52,99'], d: ['M100 100 V88 H146 V100', 'M106 88 V80 H142 V88'], g: ['M122 66 h12 v7 h-12 z'], f: [], z: [128, 76] },
  },
];

const INDEX = new Map(EXERCICES.map(e => [e.id, e]));

// Exercice de la bibliothèque (ou null).
export const exercice = id => INDEX.get(id) ?? null;

// Liste abrégée donnée à l'IA : identifiant, nom, objectif, rythme.
export function listePourIa() {
  return EXERCICES.map(e => `- ${e.id} : ${e.nom} — ${e.objectif}${e.isometrique ? ' (isométrique)' : ''}`).join('\n');
}

// Fiche d'un exercice de programme : celle de la bibliothèque s'il y renvoie (`fiche`), sinon ses `details` (programme
// proposé par une IA), complétée par le nom, la cible et les consignes propres au programme. `schema` : SVG ou null.
export function ficheDe(e) {
  const b = e?.fiche ? exercice(e.fiche) : null;
  const d = e?.details ?? {};
  // Champ de la bibliothèque, sinon celui des `details` ; vide s'il manque partout.
  const pris = (cle, vide = '') => [b?.[cle], d[cle]].find(v => v?.length && v !== '—') ?? vide;
  return {
    bibliotheque: !!b,
    nom: e?.nom ?? b?.nom ?? '',
    nomBibliotheque: b?.nom ?? null,
    cible: e?.cible ?? '',
    consignes: e?.consignes ?? [],
    objectif: pris('objectif'),
    materiel: pris('materiel', []),
    depart: pris('depart'),
    etapes: pris('etapes', []),
    respiration: pris('respiration'),
    sensation: pris('sensation'),
    erreurs: pris('erreurs', []),
    adaptation: pris('adaptation'),
    facile: pris('facile'),
    difficile: pris('difficile'),
    schema: b ? schemaSvg(b) : null,
  };
}

// Rythme de la séance guidée d'un exercice de programme : celui de la bibliothèque, remplacé champ par champ par le sien.
export function seanceDe(e) {
  const b = e?.fiche ? exercice(e.fiche) : null;
  return { ...(b?.seance ?? {}), ...(e?.seance ?? {}), ...(b?.isometrique ? { isometrique: true } : {}) };
}

// ------------------------------------------------------------ Schémas SVG

// Pointe de flèche en (x2, y2) pour un segment venant de (x1, y1).
function pointe(x1, y1, x2, y2) {
  const a = Math.atan2(y2 - y1, x2 - x1);
  const p = da => `${(x2 - 6 * Math.cos(a + da)).toFixed(1)},${(y2 - 6 * Math.sin(a + da)).toFixed(1)}`;
  return `<polyline points="${p(-0.5)} ${x2},${y2} ${p(0.5)}"/>`;
}

const chemins = (liste, classe) => (liste?.length ? `<g class="${classe}">${liste.map(d => `<path d="${d}"/>`).join('')}</g>` : '');

// Schéma d'un exercice de la bibliothèque : couleurs portées par les classes CSS (mode sombre compris).
export function schemaSvg(ex) {
  const s = ex.schema;
  const fleches = (s.f ?? []).map(([x1, y1, x2, y2, double]) => `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"/>${pointe(x1, y1, x2, y2)}${double ? pointe(x2, y2, x1, y1) : ''}`).join('');
  return `<svg class="schema" viewBox="0 0 160 110" role="img" aria-label="Schéma : ${ex.nom.replace(/"/g, '&quot;')}">`
    + '<path class="schema-sol" d="M4 100.5 H156"/>'
    + chemins(s.d, 'schema-decor')
    + chemins(s.g, 'schema-glace')
    + (s.z ? `<circle class="schema-zone" cx="${s.z[0]}" cy="${s.z[1]}" r="8"/>` : '')
    + `<g class="schema-corps"><circle cx="${s.t[0]}" cy="${s.t[1]}" r="6.5"/>${s.c.map(p => `<polyline points="${p}"/>`).join('')}</g>`
    + chemins(s.e, 'schema-elastique')
    + `<g class="schema-fleche">${fleches}${(s.a ?? []).map(d => `<path d="${d}"/>`).join('')}</g>`
    + '</svg>';
}

// Icône générique pour un exercice sans schéma (programme proposé par une IA, exercice hors bibliothèque).
export const ICONE_GENERIQUE = '<svg class="schema schema-generique" viewBox="0 0 160 110" role="img" aria-label="Exercice sans schéma">'
  + '<path class="schema-sol" d="M4 100.5 H156"/>'
  + '<g class="schema-corps"><circle cx="80" cy="16" r="6.5"/><polyline points="80,23 80,56 72,78 70,98"/><polyline points="80,56 88,78 90,98"/>'
  + '<polyline points="80,30 66,44 60,58"/><polyline points="80,30 94,44 100,58"/></g>'
  + '<g class="schema-fleche"><path d="M112 34 a10 10 0 1 1 12 10 v6"/><circle cx="124" cy="58" r="1.5"/></g>'
  + '</svg>';
