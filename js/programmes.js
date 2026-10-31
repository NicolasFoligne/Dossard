// Catalogue des programmes de soin (contenu générique, sans donnée personnelle) : référentiel de js/soin.js.
// Chaque programme : phases progressives, exercices dosés semaine par semaine, règle de course, critères de passage
// fondés sur les mesures du bilan quotidien (voir CHAMPS_DOULEUR et criteresPassage de js/soin.js), test facultatif.

// Dosage d'un exercice : une entrée par semaine de la phase (la dernière se répète ensuite) ;
// null = exercice pas encore introduit cette semaine-là. « {cote} » est remplacé par le côté atteint.
// Course : `autorisee` vaut true, false ou 'si_douleur_ok' (seulement si la dernière douleur de course
// des 7 derniers jours est ≤ 4/10) ; `intensites`, `types` et `dureeMaxMin` limitent les séances autorisées.
const ACHILLE = {
  id: 'achille_corps',
  libelle: 'Tendinopathie d\'Achille (corps du tendon)',
  court: 'Tendon d\'Achille',
  description: 'Douleur 2 à 6 cm au-dessus du talon, raideur au réveil, douleur qui cède à l\'échauffement puis revient après l\'effort. '
    + 'Traitement de référence : charge progressive (isométrie, renforcement lourd et lent, puis pliométrie) pendant au moins 12 semaines, piloté par la douleur.',
  regleDouleur: [
    'Pendant l\'effort, la douleur reste ≤ 4/10.',
    'Le lendemain matin, la raideur n\'est pas pire que d\'habitude.',
    'Si l\'une des deux règles n\'est pas respectée : on réduit la charge, sans passer au repos complet.',
  ],
  aEviter: [
    'Infiltration de corticoïdes : elle augmente le risque de rupture.',
    'Anti-inflammatoires au long cours.',
    'Étirements forcés du mollet.',
    'Gestes explosifs (foot, sprints, sauts) avant la phase 3.',
  ],
  consulter: [
    'Claquement ou sensation de coup de pied derrière la jambe.',
    'Douleur brutale ou gros gonflement.',
    'Impossible de monter sur la pointe du pied.',
  ],
  avisMedical: 'Avis médical conseillé (médecin du sport, échographie), surtout en cas d\'antécédent de rupture.',
  entretien: 'Après le programme : gardez 2 séances par semaine de montées sur pointe lourdes pendant toute la préparation.',
  test: {
    nom: 'Test des montées sur pointe',
    unite: 'montées',
    consigne: 'Sur la jambe {cote} seule, montées complètes jusqu\'à la fatigue ou une douleur supérieure à 4/10. À faire une fois par semaine environ.',
  },
  phases: [
    {
      numero: 1,
      nom: 'Calmer',
      dureeMinSem: 2,
      dureeMaxSem: 4,
      but: 'Faire baisser la douleur sans mettre le tendon au repos complet.',
      exercices: [
        {
          id: 'iso_debout',
          nom: 'Isométrie debout, jambe tendue',
          cible: 'Mollet (gastrocnémiens)',
          frequence: '1 à 2 fois par jour',
          alterne: false,
          consignes: [
            'Face à un mur, les mains en appui pour l\'équilibre.',
            'Montez à mi-hauteur sur la pointe du pied et tenez 45 s, immobile.',
            'Récupérez 2 min entre les répétitions.',
            'Effort ressenti : environ 70 %. La douleur doit rester ≤ 3/10 ; elle baisse souvent pendant l\'exercice.',
          ],
          dosage: ['Sur les 2 pieds · 5 × 45 s', 'Jambe {cote} seule · 5 × 45 s', 'Jambe {cote} seule + sac 5 kg · 5 × 45 s', 'Jambe {cote} seule + 10 kg · 5 × 45 s'],
        },
        {
          id: 'iso_assis',
          nom: 'Isométrie assis, genou plié',
          cible: 'Soléaire',
          frequence: '1 à 2 fois par jour',
          alterne: false,
          consignes: [
            'Assis, pied à plat, une charge posée sur le genou (sac lesté, packs d\'eau).',
            'Levez le talon à mi-hauteur et tenez 45 s.',
          ],
          dosage: [null, '5 kg · 5 × 45 s', '10 kg · 5 × 45 s', '15 kg · 5 × 45 s'],
        },
        {
          id: 'montees_lentes',
          nom: 'Montées lentes sur pointe',
          cible: 'Mollet et tendon',
          frequence: 'Un jour sur deux',
          alterne: true,
          consignes: ['Comptez 3 s pour monter et 3 s pour descendre.'],
          dosage: [null, 'Sur les 2 pieds · 3 × 15', 'Plus de poids sur la jambe {cote} · 3 × 15', 'Jambe {cote} seule, si douleur ≤ 4/10 · 3 × 15'],
        },
      ],
      course: {
        texte: 'Suspendue tant qu\'elle dépasse 4/10. Remplacez-la par vélo, elliptique ou natation (douleur ≤ 3/10). '
          + 'Si elle reste ≤ 4/10 : footing facile de 30 min au plus.',
        autorisee: 'si_douleur_ok',
        intensites: ['facile'],
        types: ['endurance', 'recuperation'],
        dureeMaxMin: 30,
      },
      conseils: ['Talonnette de 6 à 8 mm dans les chaussures de ville pendant cette phase : elle soulage le tendon.'],
      criteres: [
        { id: 'duree', type: 'duree', jours: 14, libelle: 'Au moins 2 semaines dans la phase' },
        { id: 'marche', type: 'derniere', champ: 'douleurMarche', max: 2, fenetre: 7, libelle: 'Marche ≤ 2/10' },
        { id: 'escaliers', type: 'derniere', champ: 'douleurEscaliers', max: 3, fenetre: 7, libelle: 'Escaliers ≤ 3/10' },
        { id: 'raideur', type: 'raideur', maxMoyenne: 2, baisse: 2, libelle: 'Raideur du matin en nette baisse' },
        { id: 'test', type: 'test', nbMin: 15, douleurMax: 4, fenetre: 14, libelle: '15 montées sur la jambe {cote} seule, douleur ≤ 4/10' },
      ],
    },
    {
      numero: 2,
      nom: 'Renforcer',
      dureeMinSem: 8,
      dureeMaxSem: 12,
      but: 'Rendre le tendon capable d\'encaisser de nouveau la charge : renforcement lourd et lent.',
      exercices: [
        {
          id: 'montees_debout',
          nom: 'Montées sur pointe debout, jambe tendue',
          cible: 'Mollet (gastrocnémiens) et tendon',
          frequence: '3 fois par semaine, un jour sur deux',
          alterne: true,
          consignes: [
            'Sur une marche, l\'avant du pied en appui, talon libre.',
            '3 s pour monter, 3 s pour descendre, amplitude complète.',
            'Charge (sac à dos, haltère) choisie pour finir chaque série fatigué, douleur ≤ 4/10.',
            '2 à 3 min de récupération entre les séries.',
          ],
          dosage: ['3 × 15 lourdes', '3 × 12 lourdes', '3 × 12 lourdes', '4 × 10 lourdes', '4 × 10 lourdes', '4 × 8 lourdes', '4 × 8 lourdes', '4 × 8 lourdes', '4 × 6 lourdes'],
        },
        {
          id: 'montees_assis',
          nom: 'Montées sur pointe assis, genou plié',
          cible: 'Soléaire',
          frequence: '3 fois par semaine, un jour sur deux',
          alterne: true,
          consignes: [
            'Assis, l\'avant du pied sur une cale, une charge lourde posée sur le genou.',
            'Même rythme : 3 s pour monter, 3 s pour descendre.',
          ],
          dosage: ['3 × 15 lourdes', '3 × 12 lourdes', '3 × 12 lourdes', '4 × 10 lourdes', '4 × 10 lourdes', '4 × 8 lourdes', '4 × 8 lourdes', '4 × 8 lourdes', '4 × 6 lourdes'],
        },
        {
          id: 'iso_debout',
          nom: 'Isométrie debout (jours sans renforcement)',
          cible: 'Antidouleur',
          frequence: 'Les jours de repos, si besoin',
          alterne: false,
          facultatif: true,
          consignes: ['Comme en phase 1 : 5 × 45 s à mi-hauteur, sur la jambe {cote}, pour calmer une douleur.'],
          dosage: ['Jambe {cote} seule · 5 × 45 s'],
        },
      ],
      course: {
        texte: 'Footing facile uniquement, 45 min au plus, si la douleur reste ≤ 4/10 et que la raideur du lendemain n\'augmente pas. '
          + 'Ni fractionné, ni côtes, ni sprints.',
        autorisee: true,
        intensites: ['facile'],
        types: ['endurance', 'recuperation', 'sortie_longue'],
        dureeMaxMin: 45,
      },
      conseils: ['Notez la charge utilisée dans les notes du bilan pour suivre la progression.'],
      criteres: [
        { id: 'duree', type: 'duree', jours: 56, libelle: 'Au moins 8 semaines dans la phase' },
        { id: 'test', type: 'test', nbMin: 25, douleurMax: 3, fenetre: 14, libelle: '25 montées sur la jambe {cote} seule, douleur ≤ 3/10' },
        { id: 'escaliers', type: 'derniere', champ: 'douleurEscaliers', max: 2, fenetre: 7, libelle: 'Escaliers ≤ 2/10' },
        { id: 'raideur', type: 'raideur', maxMoyenne: 2, baisse: null, libelle: 'Raideur du matin ≤ 2/10 (moyenne des 3 derniers bilans)' },
      ],
    },
    {
      numero: 3,
      nom: 'Rendre élastique',
      dureeMinSem: 4,
      dureeMaxSem: 6,
      but: 'Retrouver l\'élasticité du tendon et reprendre la course progressivement.',
      exercices: [
        {
          id: 'sautillements',
          nom: 'Sautillements',
          cible: 'Élasticité du tendon',
          frequence: '3 fois par semaine, un jour sur deux',
          alterne: true,
          consignes: [
            'Petits rebonds sur l\'avant du pied, genoux souples, sur sol amorti.',
            'Arrêtez la série si la douleur dépasse 3/10.',
          ],
          dosage: ['Sur les 2 pieds · 3 × 20', 'Sur les 2 pieds · 3 × 30', 'Jambe {cote} seule · 3 × 15', 'Corde à sauter · 3 × 1 min'],
        },
        {
          id: 'montees_debout',
          nom: 'Montées sur pointe lourdes (entretien)',
          cible: 'Mollet et tendon',
          frequence: '2 fois par semaine',
          alterne: true,
          consignes: ['Comme en phase 2, avec la dernière charge utilisée.'],
          dosage: ['4 × 6 lourdes, debout puis assis'],
        },
      ],
      course: {
        texte: 'Reprise progressive : alternance course/marche (par exemple 5 × 4 min de course + 1 min de marche), puis course continue facile, '
          + '+10 % par semaine. Intensité facile ou modérée, 60 min au plus. Fractionné et côtes en dernier, après la phase.',
        autorisee: true,
        intensites: ['facile', 'moderee'],
        types: ['endurance', 'recuperation', 'sortie_longue', 'seuil'],
        dureeMaxMin: 60,
      },
      conseils: ['Courez le lendemain d\'un jour sans sautillements.'],
      criteres: [
        { id: 'duree', type: 'duree', jours: 28, libelle: 'Au moins 4 semaines dans la phase' },
        { id: 'sautillements', type: 'derniere', champ: 'douleurSautillements', max: 2, fenetre: 14, libelle: 'Sautillements ≤ 2/10' },
        { id: 'course', type: 'derniere', champ: 'douleurCourse', max: 2, fenetre: 7, libelle: 'Course ≤ 2/10' },
        { id: 'raideur', type: 'raideur', maxMoyenne: 1, baisse: null, libelle: 'Raideur du matin ≤ 1/10 (moyenne des 3 derniers bilans)' },
      ],
    },
  ],
};

// Règle de pilotage par la douleur commune aux programmes de surcharge.
const REGLE_DOULEUR = [
  'Pendant l\'effort, la douleur reste ≤ 3 à 4/10 et redescend dans l\'heure qui suit.',
  'Le lendemain matin, la douleur n\'est pas pire que d\'habitude.',
  'Si l\'une des deux règles n\'est pas respectée : on réduit la charge (séries, poids, durée de course), sans passer au repos complet.',
];

const TEST_DESCENTE = {
  nom: 'Test de descente de marche',
  unite: 'descentes',
  consigne: 'Debout sur une marche, sur la jambe {cote} seule : descendez lentement l\'autre talon vers le sol puis remontez, genou dans l\'axe du pied. '
    + 'Comptez les descentes contrôlées jusqu\'à la fatigue ou une douleur supérieure à 4/10. Une fois par semaine environ.',
};

const TEST_MONTEES = {
  nom: 'Test des montées sur pointe',
  unite: 'montées',
  consigne: 'Sur la jambe {cote} seule, montées complètes sur la pointe du pied jusqu\'à la fatigue ou une douleur supérieure à 4/10. Une fois par semaine environ.',
};

// Exercices réutilisés par plusieurs programmes.
const pontFessier = (dosage, id = 'pont_fessier') => ({
  id, nom: 'Pont fessier', cible: 'Fessiers', frequence: 'Un jour sur deux', alterne: true,
  consignes: ['Allongé sur le dos, genoux pliés : soulevez le bassin jusqu\'à aligner épaules, hanches et genoux, tenez 2 s, redescendez lentement.'],
  dosage,
});
const releveLateral = dosage => ({
  id: 'releve_lateral', nom: 'Relevés de jambe latéraux', cible: 'Moyen fessier (abducteurs)', frequence: 'Un jour sur deux', alterne: true,
  consignes: ['Couché sur le côté sain, jambe du dessous pliée : montez la jambe {cote} tendue, légèrement en arrière, pointe de pied vers le sol, sans rouler le bassin.'],
  dosage,
});
const equilibre = dosage => ({
  id: 'equilibre', nom: 'Équilibre sur une jambe', cible: 'Proprioception', frequence: 'Tous les jours', alterne: false,
  consignes: ['Debout sur la jambe {cote}, genou légèrement fléchi, près d\'un appui. Progressez : yeux ouverts, yeux fermés, puis sur un coussin.'],
  dosage,
});
const sautillements = (dosage, consignes = []) => ({
  id: 'sautillements', nom: 'Sautillements', cible: 'Élasticité et réception', frequence: '3 fois par semaine, un jour sur deux', alterne: true,
  consignes: ['Petits rebonds sur l\'avant du pied, genoux souples, sur sol amorti.', 'Arrêtez la série si la douleur dépasse 3/10.', ...consignes],
  dosage,
});

const COURSE_REPRISE = {
  autorisee: true,
  intensites: ['facile', 'moderee'],
  types: ['endurance', 'recuperation', 'sortie_longue', 'seuil'],
  dureeMaxMin: 60,
};

// ------------------------------------------------------------ Périostite tibiale

const PERIOSTITE = {
  id: 'periostite',
  libelle: 'Périostite tibiale (syndrome de stress tibial médial)',
  court: 'Périostite',
  description: 'Douleur diffuse sur 5 cm ou plus le long du bord interne du tibia (tiers inférieur), au début de la course puis après l\'effort. '
    + 'Liée à une surcharge (hausse rapide du volume, sol dur, chaussures usées). Traitement : réduction de la charge d\'impact, renforcement du mollet et du pied, reprise progressive.',
  regleDouleur: REGLE_DOULEUR,
  aEviter: [
    'Continuer à courir avec une douleur qui augmente au fil de la sortie.',
    'Augmenter le volume de plus de 10 % par semaine à la reprise.',
    'Sols très durs et descentes en début de reprise.',
  ],
  consulter: [
    'Douleur très localisée sur un point précis de l\'os (sur moins de 5 cm) : risque de fracture de fatigue.',
    'Douleur la nuit ou au repos complet.',
    'Engourdissement, fourmillements ou pied froid pendant l\'effort (syndrome des loges).',
  ],
  avisMedical: 'Avis médical conseillé si la douleur persiste au-delà de 2 semaines malgré la réduction de charge (radiographie ou IRM pour écarter une fracture de fatigue).',
  entretien: 'Après le programme : gardez 2 séances par semaine de montées sur pointe et d\'équilibre, et changez de chaussures tous les 600 à 800 km.',
  test: TEST_MONTEES,
  phases: [
    {
      numero: 1, nom: 'Calmer', dureeMinSem: 1, dureeMaxSem: 3,
      but: 'Faire baisser la douleur en réduisant les impacts, tout en entretenant le mollet.',
      exercices: [
        {
          id: 'montees_2_pieds', nom: 'Montées lentes sur pointe', cible: 'Mollet', frequence: 'Tous les jours', alterne: false,
          consignes: ['Debout, mains en appui : 3 s pour monter, 3 s pour descendre.', 'Douleur ≤ 3/10.'],
          dosage: ['Sur les 2 pieds · 3 × 15', 'Plus de poids sur la jambe {cote} · 3 × 15', 'Jambe {cote} seule · 3 × 12'],
        },
        {
          id: 'releveurs', nom: 'Releveurs du pied à l\'élastique', cible: 'Muscle tibial antérieur', frequence: 'Tous les jours', alterne: false,
          consignes: ['Assis, élastique autour de l\'avant du pied : tirez la pointe du pied vers vous, lentement, puis revenez.'],
          dosage: ['3 × 15', '3 × 20'],
        },
        {
          id: 'massage', nom: 'Auto-massage du mollet', cible: 'Détente musculaire', frequence: 'Si besoin', alterne: false, facultatif: true,
          consignes: ['Rouleau ou balle sous le mollet, 1 à 2 min, sans appuyer sur l\'os douloureux.'],
          dosage: ['1 à 2 min'],
        },
      ],
      course: {
        texte: 'Suspendue tant qu\'elle dépasse 4/10. Remplacez-la par vélo, natation ou elliptique. Si elle reste ≤ 4/10 : footing facile de 20 min au plus, sur sol souple.',
        autorisee: 'si_douleur_ok', intensites: ['facile'], types: ['endurance', 'recuperation'], dureeMaxMin: 20,
      },
      conseils: ['Vérifiez l\'usure de vos chaussures ; privilégiez les sols souples (chemin, piste).'],
      criteres: [
        { id: 'duree', type: 'duree', jours: 7, libelle: 'Au moins 1 semaine dans la phase' },
        { id: 'marche', type: 'derniere', champ: 'douleurMarche', max: 1, fenetre: 7, libelle: 'Marche ≤ 1/10' },
        { id: 'test', type: 'test', nbMin: 20, douleurMax: 2, fenetre: 14, libelle: '20 montées sur la jambe {cote} seule, douleur ≤ 2/10' },
      ],
    },
    {
      numero: 2, nom: 'Renforcer', dureeMinSem: 3, dureeMaxSem: 6,
      but: 'Rendre la jambe capable d\'encaisser de nouveau les impacts : mollet, soléaire et muscles du pied.',
      exercices: [
        {
          id: 'montees_unipodales', nom: 'Montées sur pointe sur une jambe', cible: 'Mollet', frequence: 'Un jour sur deux', alterne: true,
          consignes: ['Sur une marche, talon libre, sur la jambe {cote} : 3 s pour monter, 3 s pour descendre, amplitude complète.', 'Ajoutez un sac à dos lesté quand la série devient facile.'],
          dosage: ['3 × 15', '3 × 15 avec 5 kg', '4 × 12 avec 5 kg', '4 × 10 avec 10 kg'],
        },
        {
          id: 'soleaire', nom: 'Montées sur pointe assis, genou plié', cible: 'Soléaire', frequence: 'Un jour sur deux', alterne: true,
          consignes: ['Assis, charge posée sur le genou {cote} (sac lesté, packs d\'eau) : montez le talon, 3 s / 3 s.'],
          dosage: ['3 × 15 avec 10 kg', '3 × 15 avec 15 kg', '4 × 12 avec 20 kg'],
        },
        equilibre(['3 × 30 s yeux ouverts', '3 × 30 s yeux fermés', '3 × 30 s sur coussin']),
      ],
      course: {
        texte: 'Reprise facile uniquement, 40 min au plus, en alternant course et marche au début (ex. 4 min / 1 min). +10 % par semaine au plus.',
        autorisee: true, intensites: ['facile'], types: ['endurance', 'recuperation'], dureeMaxMin: 40,
      },
      conseils: ['Augmentez la durée de course avant d\'ajouter de l\'intensité.'],
      criteres: [
        { id: 'duree', type: 'duree', jours: 21, libelle: 'Au moins 3 semaines dans la phase' },
        { id: 'course', type: 'derniere', champ: 'douleurCourse', max: 2, fenetre: 7, libelle: 'Course ≤ 2/10' },
        { id: 'test', type: 'test', nbMin: 25, douleurMax: 1, fenetre: 14, libelle: '25 montées sur la jambe {cote} seule, douleur ≤ 1/10' },
      ],
    },
    {
      numero: 3, nom: 'Reprendre', dureeMinSem: 3, dureeMaxSem: 4,
      but: 'Retrouver la tolérance aux impacts et le volume de course habituel.',
      exercices: [
        sautillements(['Sur les 2 pieds · 3 × 20', 'Sur les 2 pieds · 3 × 30', 'Jambe {cote} seule · 3 × 15', 'Corde à sauter · 3 × 1 min']),
        {
          id: 'montees_entretien', nom: 'Montées sur pointe lestées (entretien)', cible: 'Mollet', frequence: '2 à 3 fois par semaine', alterne: true,
          consignes: ['Comme en phase 2, avec la dernière charge utilisée.'],
          dosage: ['4 × 10 lestées, debout puis assis'],
        },
      ],
      course: { texte: 'Course facile ou modérée, 60 min au plus, +10 % par semaine. Le fractionné revient après la phase.', ...COURSE_REPRISE },
      conseils: ['Courez le lendemain d\'un jour sans sautillements.'],
      criteres: [
        { id: 'duree', type: 'duree', jours: 21, libelle: 'Au moins 3 semaines dans la phase' },
        { id: 'sautillements', type: 'derniere', champ: 'douleurSautillements', max: 1, fenetre: 14, libelle: 'Sautillements ≤ 1/10' },
        { id: 'course', type: 'derniere', champ: 'douleurCourse', max: 1, fenetre: 7, libelle: 'Course ≤ 1/10' },
      ],
    },
  ],
};

// ------------------------------------------------------------ Syndrome de la bandelette ilio-tibiale

const BANDELETTE = {
  id: 'bandelette',
  libelle: 'Syndrome de la bandelette ilio-tibiale (« essuie-glace »)',
  court: 'Bandelette ilio-tibiale',
  description: 'Douleur sur la face externe du genou, qui apparaît après un temps ou une distance assez fixe et oblige souvent à s\'arrêter ; '
    + 'aggravée en descente. Traitement : réduction temporaire de la course, renforcement des fessiers et contrôle du genou, reprise progressive.',
  regleDouleur: REGLE_DOULEUR,
  aEviter: [
    'Courir jusqu\'à l\'apparition de la douleur en serrant les dents.',
    'Descentes, pistes en virage toujours dans le même sens et dévers au début de la reprise.',
    'Étirements ou massages agressifs directement sur la zone douloureuse.',
  ],
  consulter: [
    'Genou gonflé, qui se bloque ou se dérobe.',
    'Douleur après un choc ou une torsion.',
    'Douleur qui persiste au repos ou la nuit.',
  ],
  avisMedical: 'Avis médical ou kinésithérapique conseillé si la douleur persiste après 3 à 4 semaines de programme.',
  entretien: 'Après le programme : gardez 2 séances par semaine de renforcement des fessiers (pont, gainage latéral, descentes de marche).',
  test: TEST_DESCENTE,
  phases: [
    {
      numero: 1, nom: 'Calmer', dureeMinSem: 1, dureeMaxSem: 3,
      but: 'Faire baisser l\'irritation et réveiller les muscles stabilisateurs de la hanche.',
      exercices: [
        {
          id: 'iso_abduction', nom: 'Isométrie d\'abduction contre un mur', cible: 'Moyen fessier', frequence: 'Tous les jours', alterne: false,
          consignes: ['Debout sur la jambe saine, le côté {cote} contre un mur : poussez le genou {cote} contre le mur, sans bouger, 30 s.'],
          dosage: ['5 × 30 s', '5 × 45 s'],
        },
        pontFessier(['3 × 15', '3 × 15, tenue 3 s']),
        releveLateral(['3 × 12', '3 × 15']),
      ],
      course: {
        texte: 'Pause tant que la douleur dépasse 4/10. Sinon, footing facile de 20 min au plus, sur plat, en s\'arrêtant avant l\'apparition de la douleur.',
        autorisee: 'si_douleur_ok', intensites: ['facile'], types: ['endurance', 'recuperation'], dureeMaxMin: 20,
      },
      conseils: ['Le vélo est souvent bien toléré s\'il ne déclenche pas la douleur ; montez un peu la selle.'],
      criteres: [
        { id: 'duree', type: 'duree', jours: 7, libelle: 'Au moins 1 semaine dans la phase' },
        { id: 'escaliers', type: 'derniere', champ: 'douleurEscaliers', max: 1, fenetre: 7, libelle: 'Escaliers ≤ 1/10' },
        { id: 'test', type: 'test', nbMin: 15, douleurMax: 2, fenetre: 14, libelle: '15 descentes de marche sur la jambe {cote}, douleur ≤ 2/10' },
      ],
    },
    {
      numero: 2, nom: 'Renforcer', dureeMinSem: 3, dureeMaxSem: 6,
      but: 'Renforcer les fessiers et le contrôle du genou pour soulager la bandelette.',
      exercices: [
        {
          id: 'descente_marche', nom: 'Descentes de marche contrôlées', cible: 'Quadriceps et contrôle du genou', frequence: 'Un jour sur deux', alterne: true,
          consignes: ['Sur la jambe {cote}, descendez lentement l\'autre talon vers le sol (3 s), genou dans l\'axe du pied, bassin horizontal.'],
          dosage: ['3 × 10', '3 × 12', '3 × 15', '3 × 12 avec sac de 5 kg'],
        },
        pontFessier(['3 × 12 sur la jambe {cote}', '3 × 15 sur la jambe {cote}', '4 × 12 sur la jambe {cote}, lesté'], 'pont_unipodal'),
        {
          id: 'marche_laterale', nom: 'Pas chassés avec élastique', cible: 'Moyen fessier', frequence: 'Un jour sur deux', alterne: true,
          consignes: ['Élastique autour des chevilles, genoux légèrement fléchis : 10 pas d\'un côté, 10 pas de l\'autre, sans relâcher la tension.'],
          dosage: ['3 × 10 pas de chaque côté', '3 × 15 pas de chaque côté'],
        },
        {
          id: 'gainage_lateral', nom: 'Gainage latéral', cible: 'Fessiers et tronc', frequence: 'Un jour sur deux', alterne: true,
          consignes: ['En appui sur l\'avant-bras, corps aligné, côté {cote} vers le sol puis de l\'autre côté.'],
          dosage: ['3 × 20 s par côté', '3 × 30 s par côté', '3 × 45 s par côté'],
        },
      ],
      course: {
        texte: 'Footing facile, 40 min au plus, sur terrain plat et varié ; arrêtez la sortie si la douleur dépasse 3/10. Descentes plus tard.',
        autorisee: true, intensites: ['facile'], types: ['endurance', 'recuperation'], dureeMaxMin: 40,
      },
      conseils: ['Raccourcissez légèrement la foulée (cadence un peu plus élevée) : la bandelette est moins sollicitée.'],
      criteres: [
        { id: 'duree', type: 'duree', jours: 21, libelle: 'Au moins 3 semaines dans la phase' },
        { id: 'course', type: 'derniere', champ: 'douleurCourse', max: 2, fenetre: 7, libelle: 'Course ≤ 2/10' },
        { id: 'test', type: 'test', nbMin: 25, douleurMax: 1, fenetre: 14, libelle: '25 descentes de marche sur la jambe {cote}, douleur ≤ 1/10' },
      ],
    },
    {
      numero: 3, nom: 'Reprendre', dureeMinSem: 2, dureeMaxSem: 4,
      but: 'Retrouver le volume habituel, puis les descentes et l\'intensité.',
      exercices: [
        {
          id: 'fentes', nom: 'Fentes avant marchées', cible: 'Quadriceps, fessiers', frequence: 'Un jour sur deux', alterne: true,
          consignes: ['Grand pas en avant, genou arrière vers le sol, genou avant dans l\'axe du pied.'],
          dosage: ['3 × 10 par jambe', '3 × 12 par jambe, lestées'],
        },
        {
          id: 'descente_lestee', nom: 'Descentes de marche lestées (entretien)', cible: 'Contrôle du genou', frequence: '2 fois par semaine', alterne: true,
          consignes: ['Comme en phase 2, avec un sac à dos de 5 à 10 kg.'],
          dosage: ['3 × 15'],
        },
      ],
      course: { texte: 'Course facile ou modérée, 60 min au plus, +10 % par semaine ; réintroduisez les descentes progressivement.', ...COURSE_REPRISE },
      conseils: ['Testez une courte descente en fin de footing avant de reprendre le trail.'],
      criteres: [
        { id: 'duree', type: 'duree', jours: 14, libelle: 'Au moins 2 semaines dans la phase' },
        { id: 'course', type: 'derniere', champ: 'douleurCourse', max: 1, fenetre: 7, libelle: 'Course ≤ 1/10' },
        { id: 'escaliers', type: 'derniere', champ: 'douleurEscaliers', max: 0, fenetre: 7, libelle: 'Escaliers sans douleur' },
      ],
    },
  ],
};

// ------------------------------------------------------------ Syndrome fémoro-patellaire

const FEMORO_PATELLAIRE = {
  id: 'femoro_patellaire',
  libelle: 'Syndrome fémoro-patellaire (douleur autour de la rotule)',
  court: 'Genou (rotule)',
  description: 'Douleur diffuse devant ou autour de la rotule, aggravée par les escaliers (surtout en descente), l\'accroupissement, '
    + 'la position assise prolongée et la course en descente. Traitement : adaptation de la charge, renforcement de la hanche et du quadriceps.',
  regleDouleur: REGLE_DOULEUR,
  aEviter: [
    'Accroupissements profonds et escaliers répétés pendant la phase douloureuse.',
    'Descentes en course au début de la reprise.',
    'Repos complet prolongé : le genou a besoin de charge adaptée.',
  ],
  consulter: [
    'Genou gonflé, qui se bloque ou se dérobe.',
    'Douleur apparue après un choc ou une torsion.',
    'Rotule qui semble se déplacer (sensation de déboîtement).',
  ],
  avisMedical: 'Avis kinésithérapique conseillé : l\'analyse de la course et du contrôle du genou aide beaucoup.',
  entretien: 'Après le programme : gardez 2 séances par semaine de renforcement (squat partiel, descentes de marche, pont fessier).',
  test: TEST_DESCENTE,
  phases: [
    {
      numero: 1, nom: 'Calmer', dureeMinSem: 1, dureeMaxSem: 3,
      but: 'Calmer le genou avec des exercices peu irritants pour la rotule.',
      exercices: [
        {
          id: 'chaise', nom: 'Chaise contre le mur (isométrie)', cible: 'Quadriceps', frequence: 'Tous les jours', alterne: false,
          consignes: ['Dos au mur, genoux fléchis à 45° environ (pas plus bas), tenez immobile. Douleur ≤ 3/10 ; remontez si besoin.'],
          dosage: ['5 × 30 s', '5 × 45 s'],
        },
        pontFessier(['3 × 15', '3 × 15, tenue 3 s']),
        releveLateral(['3 × 12', '3 × 15']),
      ],
      course: {
        texte: 'Si la douleur reste ≤ 4/10 : footing facile de 20 min au plus, sur plat. Sinon, vélo à résistance légère ou natation (crawl).',
        autorisee: 'si_douleur_ok', intensites: ['facile'], types: ['endurance', 'recuperation'], dureeMaxMin: 20,
      },
      conseils: ['Évitez de rester assis longtemps genoux pliés : étendez la jambe régulièrement.'],
      criteres: [
        { id: 'duree', type: 'duree', jours: 7, libelle: 'Au moins 1 semaine dans la phase' },
        { id: 'escaliers', type: 'derniere', champ: 'douleurEscaliers', max: 2, fenetre: 7, libelle: 'Escaliers ≤ 2/10' },
        { id: 'test', type: 'test', nbMin: 10, douleurMax: 3, fenetre: 14, libelle: '10 descentes de marche sur la jambe {cote}, douleur ≤ 3/10' },
      ],
    },
    {
      numero: 2, nom: 'Renforcer', dureeMinSem: 4, dureeMaxSem: 8,
      but: 'Renforcer quadriceps et fessiers pour mieux répartir les contraintes sur la rotule.',
      exercices: [
        {
          id: 'squat_partiel', nom: 'Squat partiel', cible: 'Quadriceps, fessiers', frequence: 'Un jour sur deux', alterne: true,
          consignes: ['Pieds largeur de hanches, descendez jusqu\'à 60° de flexion (pas plus bas au début), genoux dans l\'axe des pieds, 3 s pour descendre.'],
          dosage: ['3 × 12', '3 × 15', '4 × 12 avec 5 kg', '4 × 10 avec 10 kg'],
        },
        {
          id: 'montee_marche', nom: 'Montées de marche', cible: 'Quadriceps', frequence: 'Un jour sur deux', alterne: true,
          consignes: ['Pied {cote} sur une marche, montez en poussant sur ce pied, genou dans l\'axe, redescendez lentement.'],
          dosage: ['3 × 10', '3 × 12', '3 × 12 avec sac de 5 kg'],
        },
        {
          id: 'marche_laterale', nom: 'Pas chassés avec élastique', cible: 'Moyen fessier', frequence: 'Un jour sur deux', alterne: true,
          consignes: ['Élastique autour des chevilles, genoux légèrement fléchis : 10 pas d\'un côté, 10 pas de l\'autre.'],
          dosage: ['3 × 10 pas de chaque côté', '3 × 15 pas de chaque côté'],
        },
      ],
      course: {
        texte: 'Footing facile, 40 min au plus, sur plat ; foulée un peu plus courte et plus rapide. Pas de descente longue.',
        autorisee: true, intensites: ['facile'], types: ['endurance', 'recuperation'], dureeMaxMin: 40,
      },
      conseils: ['Approfondissez le squat seulement si la douleur reste ≤ 2/10.'],
      criteres: [
        { id: 'duree', type: 'duree', jours: 28, libelle: 'Au moins 4 semaines dans la phase' },
        { id: 'escaliers', type: 'derniere', champ: 'douleurEscaliers', max: 1, fenetre: 7, libelle: 'Escaliers ≤ 1/10' },
        { id: 'test', type: 'test', nbMin: 20, douleurMax: 2, fenetre: 14, libelle: '20 descentes de marche sur la jambe {cote}, douleur ≤ 2/10' },
      ],
    },
    {
      numero: 3, nom: 'Reprendre', dureeMinSem: 3, dureeMaxSem: 4,
      but: 'Retrouver le volume de course habituel, les descentes et les sauts.',
      exercices: [
        {
          id: 'fentes', nom: 'Fentes avant', cible: 'Quadriceps, fessiers', frequence: 'Un jour sur deux', alterne: true,
          consignes: ['Grand pas en avant, genou arrière vers le sol, genou avant au-dessus de la cheville.'],
          dosage: ['3 × 10 par jambe', '3 × 12 par jambe, lestées'],
        },
        sautillements(['Sur les 2 pieds · 3 × 20', 'Sur les 2 pieds · 3 × 30', 'Jambe {cote} seule · 3 × 15']),
      ],
      course: { texte: 'Course facile ou modérée, 60 min au plus, +10 % par semaine ; descentes réintroduites progressivement.', ...COURSE_REPRISE },
      conseils: ['Gardez le squat et le pont fessier une fois par semaine pendant cette phase.'],
      criteres: [
        { id: 'duree', type: 'duree', jours: 21, libelle: 'Au moins 3 semaines dans la phase' },
        { id: 'course', type: 'derniere', champ: 'douleurCourse', max: 1, fenetre: 7, libelle: 'Course ≤ 1/10' },
        { id: 'escaliers', type: 'derniere', champ: 'douleurEscaliers', max: 0, fenetre: 7, libelle: 'Escaliers sans douleur' },
      ],
    },
  ],
};

// ------------------------------------------------------------ Tendinopathie rotulienne

const ROTULIEN = {
  id: 'tendon_rotulien',
  libelle: 'Tendinopathie rotulienne (tendon sous la rotule)',
  court: 'Tendon rotulien',
  description: 'Douleur localisée juste sous la pointe de la rotule, à l\'impulsion, aux sauts, aux squats et en descente ; '
    + 'raideur au démarrage. Traitement de référence : charge progressive (isométrie, renforcement lourd et lent, puis pliométrie), pilotée par la douleur.',
  regleDouleur: REGLE_DOULEUR,
  aEviter: [
    'Infiltration de corticoïdes dans le tendon.',
    'Sauts et sprints avant la phase 3.',
    'Repos complet prolongé : le tendon a besoin de charge adaptée.',
  ],
  consulter: [
    'Impossible de tendre la jambe ou douleur brutale avec craquement.',
    'Genou gonflé ou chaud.',
    'Douleur la nuit ou au repos complet.',
  ],
  avisMedical: 'Avis médical (médecin du sport, échographie) conseillé si la douleur dure depuis plus de 3 mois.',
  entretien: 'Après le programme : gardez 2 séances par semaine de squat lourd et lent pendant toute la préparation.',
  test: TEST_DESCENTE,
  phases: [
    {
      numero: 1, nom: 'Calmer', dureeMinSem: 2, dureeMaxSem: 4,
      but: 'Faire baisser la douleur par l\'isométrie, sans mettre le tendon au repos complet.',
      exercices: [
        {
          id: 'chaise', nom: 'Chaise contre le mur (isométrie)', cible: 'Quadriceps et tendon', frequence: '1 à 2 fois par jour', alterne: false,
          consignes: ['Dos au mur, genoux à 60° environ, tenez immobile 45 s. Effort d\'environ 70 %, douleur ≤ 3/10.', 'Récupérez 2 min entre les répétitions.'],
          dosage: ['Sur les 2 jambes · 5 × 45 s', 'Plus de poids sur la jambe {cote} · 5 × 45 s', 'Jambe {cote} seule, appui léger de l\'autre · 5 × 45 s'],
        },
        pontFessier(['3 × 15', '3 × 15, tenue 3 s']),
      ],
      course: {
        texte: 'Si la douleur reste ≤ 4/10 : footing facile de 30 min au plus, sur plat. Évitez les côtes et les descentes.',
        autorisee: 'si_douleur_ok', intensites: ['facile'], types: ['endurance', 'recuperation'], dureeMaxMin: 30,
      },
      conseils: ['Faites l\'isométrie avant la course : elle diminue souvent la douleur pendant quelques heures.'],
      criteres: [
        { id: 'duree', type: 'duree', jours: 14, libelle: 'Au moins 2 semaines dans la phase' },
        { id: 'escaliers', type: 'derniere', champ: 'douleurEscaliers', max: 3, fenetre: 7, libelle: 'Escaliers ≤ 3/10' },
        { id: 'raideur', type: 'raideur', maxMoyenne: 2, baisse: 2, libelle: 'Raideur du matin en nette baisse' },
      ],
    },
    {
      numero: 2, nom: 'Renforcer', dureeMinSem: 8, dureeMaxSem: 12,
      but: 'Renforcer le tendon par un travail lourd et lent.',
      exercices: [
        {
          id: 'squat_lent', nom: 'Squat lourd et lent', cible: 'Quadriceps et tendon', frequence: '3 fois par semaine, un jour sur deux', alterne: true,
          consignes: ['3 s pour descendre (jusqu\'à 90° au plus), 3 s pour remonter.', 'Charge (sac à dos, haltères) choisie pour finir chaque série fatigué, douleur ≤ 4/10.'],
          dosage: ['3 × 15', '3 × 12', '3 × 12', '4 × 10', '4 × 10', '4 × 8', '4 × 8', '4 × 8', '4 × 6'],
        },
        {
          id: 'fente_bulgare', nom: 'Fente bulgare lente', cible: 'Quadriceps, fessiers', frequence: '3 fois par semaine, un jour sur deux', alterne: true,
          consignes: ['Pied arrière posé sur une chaise, jambe {cote} devant : descendez en 3 s, remontez en 3 s.'],
          dosage: ['3 × 10', '3 × 10', '3 × 12', '4 × 10 lestée', '4 × 8 lestée'],
        },
      ],
      course: {
        texte: 'Footing facile uniquement, 45 min au plus, si la douleur reste ≤ 4/10. Ni fractionné, ni côtes, ni sprints.',
        autorisee: true, intensites: ['facile'], types: ['endurance', 'recuperation', 'sortie_longue'], dureeMaxMin: 45,
      },
      conseils: ['Notez la charge utilisée dans les notes du bilan pour suivre la progression.'],
      criteres: [
        { id: 'duree', type: 'duree', jours: 56, libelle: 'Au moins 8 semaines dans la phase' },
        { id: 'test', type: 'test', nbMin: 20, douleurMax: 2, fenetre: 14, libelle: '20 descentes de marche sur la jambe {cote}, douleur ≤ 2/10' },
        { id: 'escaliers', type: 'derniere', champ: 'douleurEscaliers', max: 1, fenetre: 7, libelle: 'Escaliers ≤ 1/10' },
      ],
    },
    {
      numero: 3, nom: 'Rendre élastique', dureeMinSem: 4, dureeMaxSem: 6,
      but: 'Retrouver l\'élasticité du tendon (sauts) et l\'intensité de course.',
      exercices: [
        sautillements(['Sur les 2 pieds · 3 × 20', 'Sauts sur place · 3 × 10', 'Jambe {cote} seule · 3 × 10', 'Sauts sur une marche · 3 × 10']),
        {
          id: 'squat_entretien', nom: 'Squat lourd (entretien)', cible: 'Quadriceps et tendon', frequence: '2 fois par semaine', alterne: true,
          consignes: ['Comme en phase 2, avec la dernière charge utilisée.'],
          dosage: ['4 × 6 lourds'],
        },
      ],
      course: { texte: 'Course facile ou modérée, 60 min au plus ; côtes et fractionné réintroduits en fin de phase.', ...COURSE_REPRISE },
      conseils: ['Courez le lendemain d\'un jour sans sauts.'],
      criteres: [
        { id: 'duree', type: 'duree', jours: 28, libelle: 'Au moins 4 semaines dans la phase' },
        { id: 'sautillements', type: 'derniere', champ: 'douleurSautillements', max: 2, fenetre: 14, libelle: 'Sauts ≤ 2/10' },
        { id: 'course', type: 'derniere', champ: 'douleurCourse', max: 2, fenetre: 7, libelle: 'Course ≤ 2/10' },
      ],
    },
  ],
};

// ------------------------------------------------------------ Aponévrosite plantaire

const APONEVROSITE = {
  id: 'aponevrosite',
  libelle: 'Aponévrosite plantaire (douleur sous le talon)',
  court: 'Aponévrose plantaire',
  description: 'Douleur sous le talon (côté interne), très forte aux premiers pas du matin ou après être resté assis, qui diminue en marchant. '
    + 'Traitement : étirement de l\'aponévrose, renforcement du mollet et du pied (montées sur pointe orteils relevés), reprise progressive.',
  regleDouleur: REGLE_DOULEUR,
  aEviter: [
    'Marcher pieds nus sur sol dur pendant la phase douloureuse.',
    'Chaussures plates et usées.',
    'Infiltrations répétées (risque de rupture de l\'aponévrose).',
  ],
  consulter: [
    'Douleur brutale avec craquement sous le pied.',
    'Fourmillements ou brûlures sous le pied.',
    'Talon gonflé, rouge ou chaud, ou douleur la nuit.',
  ],
  avisMedical: 'Avis médical ou podologique conseillé si la douleur dure plus de 6 semaines (semelles, ondes de choc).',
  entretien: 'Après le programme : gardez 2 séances par semaine de montées sur pointe orteils relevés et l\'étirement du matin.',
  test: TEST_MONTEES,
  phases: [
    {
      numero: 1, nom: 'Calmer', dureeMinSem: 2, dureeMaxSem: 4,
      but: 'Diminuer la douleur du matin et assouplir l\'aponévrose.',
      exercices: [
        {
          id: 'etirement_aponevrose', nom: 'Étirement de l\'aponévrose', cible: 'Aponévrose plantaire', frequence: 'Matin et soir', alterne: false,
          consignes: ['Assis, pied {cote} sur le genou opposé : tirez les orteils vers vous avec la main jusqu\'à sentir la tension sous le pied, 10 s.', 'À faire avant le premier pas du matin.'],
          dosage: ['3 × 10 fois 10 s'],
        },
        {
          id: 'montees_lentes', nom: 'Montées lentes sur pointe', cible: 'Mollet et pied', frequence: 'Tous les jours', alterne: false,
          consignes: ['Debout, mains en appui : 3 s pour monter, 3 s pour descendre. Douleur ≤ 3/10.'],
          dosage: ['Sur les 2 pieds · 3 × 15', 'Plus de poids sur le pied {cote} · 3 × 15'],
        },
        {
          id: 'massage_balle', nom: 'Massage sous le pied', cible: 'Aponévrose plantaire', frequence: 'Si besoin', alterne: false, facultatif: true,
          consignes: ['Faites rouler une balle ou une bouteille d\'eau congelée sous le pied {cote}, 2 min.'],
          dosage: ['2 min'],
        },
      ],
      course: {
        texte: 'Si la douleur reste ≤ 4/10 : footing facile de 30 min au plus, sur sol souple, avec des chaussures amortissantes.',
        autorisee: 'si_douleur_ok', intensites: ['facile'], types: ['endurance', 'recuperation'], dureeMaxMin: 30,
      },
      conseils: ['Portez des chaussures avec un léger talon dès le lever ; évitez de marcher pieds nus.'],
      criteres: [
        { id: 'duree', type: 'duree', jours: 14, libelle: 'Au moins 2 semaines dans la phase' },
        { id: 'raideur', type: 'raideur', maxMoyenne: 3, baisse: 2, libelle: 'Douleur des premiers pas du matin en nette baisse' },
        { id: 'marche', type: 'derniere', champ: 'douleurMarche', max: 2, fenetre: 7, libelle: 'Marche ≤ 2/10' },
      ],
    },
    {
      numero: 2, nom: 'Renforcer', dureeMinSem: 6, dureeMaxSem: 10,
      but: 'Renforcer le mollet et le pied pour soulager l\'aponévrose.',
      exercices: [
        {
          id: 'montees_serviette', nom: 'Montées sur pointe orteils relevés', cible: 'Aponévrose et mollet', frequence: 'Un jour sur deux', alterne: true,
          consignes: ['Serviette roulée sous les orteils du pied {cote}, sur une marche : 3 s pour monter, 2 s en haut, 3 s pour descendre.', 'Ajoutez un sac à dos lesté quand la série devient facile.'],
          dosage: ['3 × 12', '3 × 12 avec 5 kg', '4 × 10 avec 5 kg', '4 × 8 avec 10 kg', '5 × 8 avec 10 kg'],
        },
        {
          id: 'pied_court', nom: 'Pied court et serviette', cible: 'Muscles du pied', frequence: 'Tous les jours', alterne: false,
          consignes: ['Assis puis debout : rapprochez l\'avant du pied du talon en creusant la voûte, sans plier les orteils, 5 s.', 'Puis ramassez une serviette avec les orteils.'],
          dosage: ['3 × 10 fois 5 s'],
        },
        {
          id: 'soleaire', nom: 'Montées sur pointe assis, genou plié', cible: 'Soléaire', frequence: 'Un jour sur deux', alterne: true,
          consignes: ['Assis, charge posée sur le genou {cote} : montez le talon, 3 s / 3 s.'],
          dosage: ['3 × 15 avec 10 kg', '4 × 12 avec 15 kg'],
        },
      ],
      course: {
        texte: 'Footing facile, 45 min au plus, en augmentant de 10 % par semaine au plus.',
        autorisee: true, intensites: ['facile'], types: ['endurance', 'recuperation', 'sortie_longue'], dureeMaxMin: 45,
      },
      conseils: ['Continuez l\'étirement du matin pendant toute la phase.'],
      criteres: [
        { id: 'duree', type: 'duree', jours: 42, libelle: 'Au moins 6 semaines dans la phase' },
        { id: 'raideur', type: 'raideur', maxMoyenne: 1, baisse: null, libelle: 'Premiers pas du matin ≤ 1/10 (moyenne des 3 derniers bilans)' },
        { id: 'test', type: 'test', nbMin: 25, douleurMax: 2, fenetre: 14, libelle: '25 montées sur le pied {cote} seul, douleur ≤ 2/10' },
      ],
    },
    {
      numero: 3, nom: 'Reprendre', dureeMinSem: 3, dureeMaxSem: 4,
      but: 'Retrouver le volume et l\'intensité de course habituels.',
      exercices: [
        sautillements(['Sur les 2 pieds · 3 × 20', 'Sur les 2 pieds · 3 × 30', 'Pied {cote} seul · 3 × 15']),
        {
          id: 'montees_entretien', nom: 'Montées orteils relevés (entretien)', cible: 'Aponévrose et mollet', frequence: '2 fois par semaine', alterne: true,
          consignes: ['Comme en phase 2, avec la dernière charge utilisée.'],
          dosage: ['4 × 8 lestées'],
        },
      ],
      course: { texte: 'Course facile ou modérée, 60 min au plus, +10 % par semaine.', ...COURSE_REPRISE },
      conseils: ['Changez de chaussures si elles ont plus de 600 à 800 km.'],
      criteres: [
        { id: 'duree', type: 'duree', jours: 21, libelle: 'Au moins 3 semaines dans la phase' },
        { id: 'course', type: 'derniere', champ: 'douleurCourse', max: 1, fenetre: 7, libelle: 'Course ≤ 1/10' },
        { id: 'raideur', type: 'raideur', maxMoyenne: 1, baisse: null, libelle: 'Premiers pas du matin ≤ 1/10' },
      ],
    },
  ],
};

// ------------------------------------------------------------ Entorse de cheville

const ENTORSE_CHEVILLE = {
  id: 'entorse_cheville',
  libelle: 'Entorse de la cheville (ligament externe)',
  court: 'Cheville',
  description: 'Entorse « en dedans » (pied qui tourne vers l\'intérieur), douleur et gonflement sur la face externe de la cheville. '
    + 'Traitement : protection et mobilisation précoces, renforcement des muscles de la cheville et travail d\'équilibre pour éviter les récidives.',
  regleDouleur: [
    'Les exercices peuvent être un peu inconfortables, mais la douleur reste ≤ 3/10.',
    'Le gonflement ne doit pas augmenter le lendemain.',
    'Si c\'est le cas : on revient aux exercices de la veille ou de la semaine précédente.',
  ],
  aEviter: [
    'Immobilisation stricte prolongée sans avis médical.',
    'Reprendre la course sur terrain irrégulier (trail) avant la fin du programme.',
    'Sports avec changements de direction avant d\'avoir retrouvé un bon équilibre.',
  ],
  consulter: [
    'Impossible de faire 4 pas juste après l\'accident ou les jours suivants.',
    'Douleur à la pression sur l\'os (bord postérieur ou pointe des malléoles, base du 5e métatarsien, os naviculaire) : radiographie nécessaire.',
    'Gonflement très important, déformation, ou entorses à répétition.',
  ],
  avisMedical: 'Un examen médical est conseillé après toute entorse (gravité, attelle éventuelle) ; consultez rapidement en cas de signe ci-dessous.',
  entretien: 'Après le programme : gardez 2 à 3 séances d\'équilibre par semaine (5 min) pendant au moins 3 mois : c\'est le meilleur moyen d\'éviter la récidive.',
  test: {
    nom: 'Test d\'équilibre sur une jambe',
    unite: 'secondes',
    consigne: 'Pieds nus, sur la jambe {cote}, les yeux fermés, mains sur les hanches : comptez les secondes avant de poser l\'autre pied ou de perdre l\'équilibre (60 au plus).',
  },
  phases: [
    {
      numero: 1, nom: 'Protéger', dureeMinSem: 1, dureeMaxSem: 2,
      but: 'Limiter le gonflement, retrouver la mobilité et la marche normale.',
      exercices: [
        {
          id: 'alphabet', nom: 'Mobilité de la cheville', cible: 'Mobilité', frequence: '2 à 3 fois par jour', alterne: false,
          consignes: ['Assis ou allongé, jambe surélevée : écrivez l\'alphabet avec la pointe du pied {cote}, sans forcer.'],
          dosage: ['Alphabet complet, 2 fois'],
        },
        {
          id: 'iso_eversion', nom: 'Isométrie de la cheville', cible: 'Muscles péroniers', frequence: 'Tous les jours', alterne: false,
          consignes: ['Assis, bord externe du pied {cote} contre un pied de table : poussez vers l\'extérieur, sans bouger, 10 s.'],
          dosage: ['10 × 10 s'],
        },
        {
          id: 'glace', nom: 'Glace et jambe surélevée', cible: 'Gonflement', frequence: 'Si besoin', alterne: false, facultatif: true,
          consignes: ['Glace dans un linge, 15 min, jambe surélevée.'],
          dosage: ['15 min'],
        },
      ],
      course: {
        texte: 'Pas de course pendant cette phase. Vélo d\'appartement sans résistance et natation (sans battements forcés) si indolores.',
        autorisee: false, intensites: [], types: [], dureeMaxMin: 0,
      },
      conseils: ['Marchez dès que possible avec des chaussures stables, en déroulant bien le pied.'],
      criteres: [
        { id: 'duree', type: 'duree', jours: 5, libelle: 'Au moins 5 jours dans la phase' },
        { id: 'marche', type: 'derniere', champ: 'douleurMarche', max: 1, fenetre: 7, libelle: 'Marche normale, ≤ 1/10' },
        { id: 'escaliers', type: 'derniere', champ: 'douleurEscaliers', max: 2, fenetre: 7, libelle: 'Escaliers ≤ 2/10' },
      ],
    },
    {
      numero: 2, nom: 'Renforcer et équilibrer', dureeMinSem: 2, dureeMaxSem: 4,
      but: 'Renforcer les muscles de la cheville et retrouver l\'équilibre sur une jambe.',
      exercices: [
        equilibre(['3 × 30 s yeux ouverts', '3 × 30 s yeux fermés', '3 × 30 s sur coussin', '3 × 30 s sur coussin, yeux fermés']),
        {
          id: 'eversion_elastique', nom: 'Éversion à l\'élastique', cible: 'Muscles péroniers', frequence: 'Un jour sur deux', alterne: true,
          consignes: ['Assis, élastique autour de l\'avant du pied {cote} : tournez la plante du pied vers l\'extérieur, lentement, puis revenez.'],
          dosage: ['3 × 15', '3 × 20', '3 × 20, élastique plus fort'],
        },
        {
          id: 'montees_pointe', nom: 'Montées sur pointe', cible: 'Mollet et stabilité', frequence: 'Un jour sur deux', alterne: true,
          consignes: ['Montez lentement sur la pointe des pieds, cheville bien droite (sans partir vers l\'extérieur).'],
          dosage: ['Sur les 2 pieds · 3 × 15', 'Pied {cote} seul · 3 × 12', 'Pied {cote} seul · 3 × 15'],
        },
      ],
      course: {
        texte: 'Reprise facile, 30 min au plus, sur terrain plat et régulier (route, piste), en alternant course et marche au début.',
        autorisee: true, intensites: ['facile'], types: ['endurance', 'recuperation'], dureeMaxMin: 30,
      },
      conseils: ['Une chevillère peut rassurer pendant la reprise, sans remplacer le travail d\'équilibre.'],
      criteres: [
        { id: 'duree', type: 'duree', jours: 14, libelle: 'Au moins 2 semaines dans la phase' },
        { id: 'course', type: 'derniere', champ: 'douleurCourse', max: 2, fenetre: 7, libelle: 'Course ≤ 2/10' },
        { id: 'test', type: 'test', nbMin: 20, douleurMax: 2, fenetre: 14, libelle: '20 s d\'équilibre yeux fermés sur la jambe {cote}' },
      ],
    },
    {
      numero: 3, nom: 'Reprendre', dureeMinSem: 2, dureeMaxSem: 4,
      but: 'Retrouver les appuis dynamiques, les changements de direction et le terrain varié.',
      exercices: [
        sautillements(['Sur les 2 pieds · 3 × 20', 'Avant-arrière et côté-côté · 3 × 20', 'Pied {cote} seul · 3 × 15'],
          ['Ajoutez des sauts latéraux au-dessus d\'une ligne quand ils sont indolores.']),
        equilibre(['Sur coussin en lançant une balle · 3 × 30 s']),
      ],
      course: {
        texte: 'Course facile ou modérée, 60 min au plus ; terrain varié et trail réintroduits progressivement, en fin de phase.',
        ...COURSE_REPRISE,
      },
      conseils: ['Gardez l\'équilibre sur une jambe 2 à 3 fois par semaine après le programme.'],
      criteres: [
        { id: 'duree', type: 'duree', jours: 14, libelle: 'Au moins 2 semaines dans la phase' },
        { id: 'sautillements', type: 'derniere', champ: 'douleurSautillements', max: 1, fenetre: 14, libelle: 'Sautillements ≤ 1/10' },
        { id: 'test', type: 'test', nbMin: 30, douleurMax: 1, fenetre: 14, libelle: '30 s d\'équilibre yeux fermés sur la jambe {cote}' },
      ],
    },
  ],
};

// ------------------------------------------------------------ Fiches détaillées des exercices

// Une fiche par exercice, partagée entre programmes : consignes détaillées (`details`) et rythme de la séance guidée (`seance`).
// `seance.tempo` : phases d'une répétition [libellé, secondes] (null = on compte soi-même, ex. sauts) ;
// `seance.recupS` : récupération entre deux séries ; `seance.libelleTenue` : consigne annoncée pendant une tenue.
const LENT_3_3 = [['Monte', 3], ['Descends', 3]];
const FICHES = {
  iso_mollet: {
    details: {
      depart: 'Debout face à un mur, pieds à largeur de hanches, mains posées à plat sur le mur pour l\'équilibre. Genou tendu (sans le verrouiller).',
      etapes: [
        'Montez lentement sur la pointe des pieds jusqu\'à mi-hauteur (talons à environ 5 cm du sol).',
        'Arrêtez-vous et tenez la position, immobile, pendant toute la durée indiquée.',
        'Redescendez doucement, talons au sol, puis récupérez avant la série suivante.',
        'Sur une jambe : décollez l\'autre pied du sol et gardez le genou de la jambe d\'appui tendu.',
      ],
      respiration: 'Respirez calmement et régulièrement ; ne bloquez pas votre souffle.',
      sensation: 'Effort franc du mollet (environ 7 sur 10). Douleur du tendon tolérée jusqu\'à 3/10 ; elle diminue souvent pendant l\'exercice.',
      erreurs: ['Monter trop haut (tenue moins efficace).', 'Laisser la cheville partir vers l\'extérieur.', 'Plier le genou ou se pencher en avant.'],
      facile: 'Sur les deux pieds, en tenant 30 s au lieu de 45 s.',
      difficile: 'Sur une jambe avec un sac à dos lesté (5 puis 10 kg).',
    },
    seance: { recupS: 120 },
  },
  iso_soleaire: {
    details: {
      depart: 'Assis sur une chaise, pied à plat, genou plié à angle droit. Posez une charge sur le genou (sac lesté, packs d\'eau).',
      etapes: [
        'Soulevez le talon à mi-hauteur en gardant l\'avant du pied au sol.',
        'Tenez immobile pendant la durée indiquée, en poussant sur l\'avant du pied.',
        'Reposez lentement le talon et récupérez.',
      ],
      respiration: 'Respiration calme et continue.',
      sensation: 'Travail en profondeur du bas du mollet (soléaire). Douleur ≤ 3/10.',
      erreurs: ['Soulever la charge avec les bras.', 'Monter le talon au maximum.'],
      facile: 'Sans charge, ou avec une charge plus légère.',
      difficile: 'Augmentez la charge de 5 kg d\'une semaine à l\'autre.',
    },
    seance: { recupS: 120 },
  },
  montees_lentes: {
    details: {
      depart: 'Debout, pieds à largeur de hanches, mains en appui léger sur un mur ou une chaise. Genoux tendus sans être verrouillés.',
      etapes: [
        'Montez sur la pointe des pieds en 3 secondes, jusqu\'en haut.',
        'Redescendez en 3 secondes, talons qui touchent juste le sol.',
        'Enchaînez sans rebond, au rythme donné par l\'application.',
        '« Plus de poids sur la jambe atteinte » : décalez le poids du corps de son côté, l\'autre pied ne fait qu\'aider.',
      ],
      respiration: 'Expirez en montant, inspirez en descendant.',
      sensation: 'Fatigue du mollet en fin de série. Douleur ≤ 3 à 4/10 et pas d\'aggravation le lendemain.',
      erreurs: ['Aller trop vite ou rebondir en bas.', 'Rouler sur le bord externe du pied.', 'Plier les genoux pour s\'aider.'],
      facile: 'Amplitude plus petite, sur les deux pieds.',
      difficile: 'Sur une jambe, puis sur une marche, talon dans le vide.',
    },
    seance: { tempo: LENT_3_3, recupS: 90 },
  },
  montees_lourdes: {
    details: {
      depart: 'Sur une marche, l\'avant du pied en appui, talon dans le vide, une main sur la rampe. Chargez-vous d\'un sac à dos lesté si indiqué.',
      etapes: [
        'Laissez descendre le talon sous le niveau de la marche, sans à-coup.',
        'Montez sur la pointe en 3 secondes, le plus haut possible.',
        'Redescendez en 3 secondes jusqu\'en bas de l\'amplitude.',
        'Choisissez une charge qui rend les dernières répétitions difficiles mais propres.',
      ],
      respiration: 'Expirez en montant, inspirez en descendant.',
      sensation: 'Série vraiment fatigante (dernières répétitions dures). Douleur ≤ 4/10, pas pire le lendemain matin.',
      erreurs: ['Trop de charge : mouvement saccadé ou incomplet.', 'Genou qui se plie (on travaille moins le mollet).', 'Rebondir en bas de la marche.'],
      facile: 'Sur le sol plat, ou sans charge.',
      difficile: 'Ajoutez 2 à 5 kg quand toutes les séries sont faciles.',
    },
    seance: { tempo: LENT_3_3, recupS: 150 },
  },
  montees_assis_lourdes: {
    details: {
      depart: 'Assis, genou plié à angle droit, l\'avant du pied sur une cale (livre, marche), une charge lourde posée sur le genou.',
      etapes: [
        'Laissez le talon descendre sous le niveau de la cale.',
        'Montez le talon en 3 secondes, le plus haut possible.',
        'Redescendez en 3 secondes.',
      ],
      respiration: 'Expirez en montant, inspirez en descendant.',
      sensation: 'Brûlure en profondeur du bas du mollet en fin de série. Douleur ≤ 4/10.',
      erreurs: ['Pousser la charge avec les mains.', 'Écourter l\'amplitude.'],
      facile: 'Charge plus légère, sans cale.',
      difficile: 'Augmentez la charge par paliers de 5 kg.',
    },
    seance: { tempo: LENT_3_3, recupS: 120 },
  },
  sautillements: {
    details: {
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
      facile: 'Moins de rebonds par série, sur les deux pieds.',
      difficile: 'Sur une jambe, puis à la corde à sauter.',
    },
    seance: { tempo: null, recupS: 90, libelleTenue: 'Sautez' },
  },
  releveurs: {
    details: {
      depart: 'Assis, jambe tendue devant vous. Fixez un élastique à un pied de table et passez-le sur le dessus de l\'avant du pied.',
      etapes: [
        'Tirez la pointe du pied vers vous contre l\'élastique, en 2 secondes.',
        'Revenez lentement en 2 secondes, sans relâcher d\'un coup.',
      ],
      respiration: 'Expirez en tirant, inspirez en revenant.',
      sensation: 'Fatigue sur le devant du tibia. Pas de douleur vive.',
      erreurs: ['Bouger tout le genou.', 'Laisser l\'élastique ramener le pied d\'un coup.'],
      facile: 'Élastique plus souple.',
      difficile: 'Élastique plus fort ou plus de répétitions.',
    },
    seance: { tempo: [['Tire', 2], ['Reviens', 2]], recupS: 60 },
  },
  automassage: {
    details: {
      depart: 'Assis au sol ou sur une chaise, avec un rouleau, une balle ou une bouteille.',
      etapes: [
        'Faites rouler lentement le rouleau ou la balle sur la zone indiquée.',
        'Insistez quelques secondes sur les zones tendues, sans appuyer sur l\'os ni sur la zone la plus douloureuse.',
      ],
      respiration: 'Respirez lentement pour relâcher.',
      sensation: 'Détente, légère gêne acceptable ; jamais de douleur vive.',
      erreurs: ['Appuyer fort sur un tendon ou sur l\'os.'],
      facile: 'Pression plus légère.',
      difficile: '—',
    },
    seance: { recupS: 0, libelleTenue: 'Massez' },
  },
  equilibre: {
    details: {
      depart: 'Debout sur la jambe atteinte, pieds nus, près d\'un mur ou d\'une chaise pour se rattraper. Genou légèrement fléchi.',
      etapes: [
        'Levez l\'autre pied et trouvez votre équilibre, bassin horizontal, regard fixé devant.',
        'Tenez la durée indiquée en corrigeant les petits déséquilibres avec la cheville.',
        'Progressez : yeux ouverts, puis yeux fermés, puis sur un coussin.',
      ],
      respiration: 'Respiration calme ; relâchez les épaules.',
      sensation: 'Petits ajustements de la cheville et du pied : c\'est normal et c\'est le but.',
      erreurs: ['Genou verrouillé.', 'Se tenir en permanence au mur.', 'Bassin qui penche.'],
      facile: 'Yeux ouverts, un doigt posé sur le mur.',
      difficile: 'Yeux fermés sur un coussin, ou en lançant une balle.',
    },
    seance: { recupS: 30, libelleTenue: 'Tenez l\'équilibre' },
  },
  iso_abduction: {
    details: {
      depart: 'Debout sur la jambe saine, côté atteint contre un mur, genou atteint légèrement plié et décollé du sol.',
      etapes: [
        'Poussez le genou (ou la cuisse) contre le mur, vers l\'extérieur.',
        'Tenez la poussée sans bouger pendant la durée indiquée.',
        'Relâchez et récupérez.',
      ],
      respiration: 'Respirez normalement pendant la poussée.',
      sensation: 'Travail sur le côté de la hanche (fessier). Pas de douleur au genou.',
      erreurs: ['Pencher le buste vers le mur.', 'Pousser trop fort au début.'],
      facile: 'Poussée plus légère, durée plus courte.',
      difficile: 'Poussée plus forte, sur une jambe d\'appui légèrement fléchie.',
    },
    seance: { recupS: 60, libelleTenue: 'Poussez' },
  },
  pont: {
    details: {
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
      facile: 'Amplitude plus petite, sur les deux jambes.',
      difficile: 'Sur une jambe, puis avec une charge sur le bassin.',
    },
    seance: { tempo: [['Monte', 2], ['Tenez', 2], ['Descends', 2]], recupS: 60 },
  },
  releve_lateral: {
    details: {
      depart: 'Couché sur le côté sain, jambe du dessous pliée, tête posée sur le bras, bassin bien de profil.',
      etapes: [
        'Montez la jambe du dessus tendue, légèrement en arrière, pointe de pied tournée vers le sol.',
        'Montez jusqu\'à 30 à 40 cm, sans rouler le bassin vers l\'arrière.',
        'Redescendez lentement sans poser la jambe.',
      ],
      respiration: 'Expirez en montant, inspirez en descendant.',
      sensation: 'Brûlure sur le côté de la fesse en fin de série.',
      erreurs: ['Lever la jambe vers l\'avant (on travaille alors la cuisse).', 'Basculer le bassin en arrière.', 'Aller trop vite.'],
      facile: 'Amplitude plus faible.',
      difficile: 'Ajoutez un élastique autour des chevilles ou un lest.',
    },
    seance: { tempo: [['Monte', 2], ['Descends', 2]], recupS: 60 },
  },
  descente_marche: {
    details: {
      depart: 'Debout sur une marche (ou un step) sur la jambe atteinte, l\'autre jambe dans le vide, main près d\'un appui.',
      etapes: [
        'Pliez lentement le genou d\'appui pour descendre le talon libre vers le sol, en 3 secondes.',
        'Gardez le genou dans l\'axe du pied et le bassin horizontal.',
        'Effleurez le sol avec le talon libre, sans prendre appui, puis remontez en 2 secondes.',
      ],
      respiration: 'Inspirez en descendant, expirez en remontant.',
      sensation: 'Travail de la cuisse et de la fesse ; pas de douleur vive au genou.',
      erreurs: ['Genou qui part vers l\'intérieur.', 'Bassin qui tombe du côté de la jambe libre.', 'Se laisser tomber.'],
      facile: 'Marche plus basse.',
      difficile: 'Marche plus haute ou sac à dos lesté.',
    },
    seance: { tempo: [['Descends', 3], ['Remonte', 2]], recupS: 90 },
  },
  pas_chasses: {
    details: {
      depart: 'Élastique autour des chevilles (ou au-dessus des genoux), pieds écartés, genoux légèrement fléchis, buste droit.',
      etapes: [
        'Faites un pas sur le côté en gardant l\'élastique tendu.',
        'Ramenez l\'autre pied à moitié seulement, sans relâcher la tension.',
        'Faites tous les pas d\'un côté, puis revenez de l\'autre.',
      ],
      respiration: 'Respiration libre et régulière.',
      sensation: 'Chauffe sur le côté des hanches.',
      erreurs: ['Pieds qui se touchent (élastique relâché).', 'Buste qui se balance.'],
      facile: 'Élastique plus souple.',
      difficile: 'Élastique plus fort, genoux plus fléchis.',
    },
    seance: { tempo: null, recupS: 45 },
  },
  gainage_lateral: {
    details: {
      depart: 'Couché sur le côté, en appui sur l\'avant-bras (coude sous l\'épaule), jambes tendues l\'une sur l\'autre.',
      etapes: [
        'Soulevez le bassin pour aligner chevilles, hanches et épaules.',
        'Tenez la position pendant la durée indiquée.',
        'Changez de côté.',
      ],
      respiration: 'Respirez calmement, ne bloquez pas.',
      sensation: 'Travail du flanc et de la fesse du côté au sol.',
      erreurs: ['Bassin qui s\'affaisse.', 'Fesses en arrière.'],
      facile: 'En appui sur les genoux pliés.',
      difficile: 'Levez la jambe du dessus.',
    },
    seance: { recupS: 45, libelleTenue: 'Gainez' },
  },
  fentes: {
    details: {
      depart: 'Debout, pieds à largeur de hanches, mains sur les hanches.',
      etapes: [
        'Faites un grand pas en avant.',
        'Descendez le genou arrière vers le sol en 2 secondes, genou avant au-dessus de la cheville.',
        'Remontez en poussant sur le talon avant, puis changez de jambe (ou avancez pour les fentes marchées).',
      ],
      respiration: 'Inspirez en descendant, expirez en remontant.',
      sensation: 'Travail des cuisses et des fessiers ; pas de douleur vive au genou.',
      erreurs: ['Genou avant qui dépasse largement les orteils ou rentre vers l\'intérieur.', 'Buste penché en avant.'],
      facile: 'Descente moins profonde.',
      difficile: 'Avec des haltères ou un sac lesté.',
    },
    seance: { tempo: [['Descends', 2], ['Remonte', 2]], recupS: 90 },
  },
  chaise: {
    details: {
      depart: 'Dos plaqué contre un mur, pieds à environ 50 cm du mur, écartés à largeur de hanches.',
      etapes: [
        'Glissez le dos le long du mur jusqu\'à l\'angle de genou indiqué (45° à 60°, pas plus bas au début).',
        'Tenez immobile pendant la durée indiquée, poids réparti sur les talons.',
        'Remontez en glissant le long du mur et récupérez.',
      ],
      respiration: 'Respirez calmement ; ne bloquez pas.',
      sensation: 'Effort franc des cuisses (environ 7/10). Douleur du genou ≤ 3/10, souvent soulagée par l\'exercice.',
      erreurs: ['Descendre trop bas.', 'Genoux qui rentrent vers l\'intérieur.', 'Décoller le dos du mur.'],
      facile: 'Angle plus petit (moins fléchi), durée plus courte.',
      difficile: 'Plus de poids sur la jambe atteinte, puis sur une jambe.',
    },
    seance: { recupS: 90 },
  },
  squat: {
    details: {
      depart: 'Debout, pieds à largeur de hanches, pointes légèrement ouvertes ; tenez une charge contre la poitrine si indiqué.',
      etapes: [
        'Descendez en reculant les fesses, comme pour vous asseoir, en 3 secondes.',
        'Arrêtez-vous à la profondeur indiquée (60° à 90° de flexion de genou), genoux dans l\'axe des pieds.',
        'Remontez au rythme indiqué en poussant sur toute la plante des pieds.',
      ],
      respiration: 'Inspirez en descendant, expirez en remontant.',
      sensation: 'Fatigue des cuisses et des fessiers ; douleur du genou ≤ 4/10.',
      erreurs: ['Genoux qui rentrent vers l\'intérieur.', 'Talons qui décollent.', 'Dos rond.'],
      facile: 'Descente moins profonde, sans charge, ou en s\'asseyant sur une chaise.',
      difficile: 'Ajoutez de la charge par paliers de 2 à 5 kg.',
    },
    seance: { tempo: [['Descends', 3], ['Remonte', 2]], recupS: 90 },
  },
  montee_marche: {
    details: {
      depart: 'Face à une marche (15 à 20 cm), pied de la jambe atteinte posé à plat sur la marche.',
      etapes: [
        'Montez en poussant sur le pied posé, sans vous aider de l\'autre jambe.',
        'Tenez-vous droit en haut, genou dans l\'axe du pied.',
        'Redescendez lentement en 3 secondes.',
      ],
      respiration: 'Expirez en montant, inspirez en descendant.',
      sensation: 'Travail de la cuisse ; pas de douleur vive.',
      erreurs: ['Pousser avec le pied resté au sol.', 'Genou qui part vers l\'intérieur.'],
      facile: 'Marche plus basse.',
      difficile: 'Marche plus haute ou sac lesté.',
    },
    seance: { tempo: [['Monte', 2], ['Descends', 3]], recupS: 90 },
  },
  fente_bulgare: {
    details: {
      depart: 'Dos à une chaise, posez le dessus du pied arrière sur l\'assise ; pied avant (jambe atteinte) un grand pas devant.',
      etapes: [
        'Descendez lentement en 3 secondes en pliant le genou avant, buste droit.',
        'Arrêtez-vous quand la cuisse avant approche de l\'horizontale.',
        'Remontez en 3 secondes en poussant sur le talon avant.',
      ],
      respiration: 'Inspirez en descendant, expirez en remontant.',
      sensation: 'Effort important de la cuisse avant et du fessier.',
      erreurs: ['Genou avant qui rentre vers l\'intérieur.', 'Pied avant trop près de la chaise.'],
      facile: 'Descente partielle, une main sur un appui.',
      difficile: 'Avec haltères ou sac lesté.',
    },
    seance: { tempo: LENT_3_3, recupS: 120 },
  },
  etirement_aponevrose: {
    details: {
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
      facile: 'Tension plus légère.',
      difficile: 'Tenue plus longue.',
    },
    seance: { recupS: 30, libelleTenue: 'Étirez' },
  },
  montees_serviette: {
    details: {
      depart: 'Sur une marche, une serviette roulée sous les orteils du pied atteint (orteils relevés), talon dans le vide, main sur la rampe.',
      etapes: [
        'Montez sur la pointe en 3 secondes, orteils toujours relevés sur la serviette.',
        'Tenez 2 secondes en haut.',
        'Redescendez en 3 secondes, talon sous le niveau de la marche.',
      ],
      respiration: 'Expirez en montant, inspirez en descendant.',
      sensation: 'Tension sous le pied et fatigue du mollet ; douleur ≤ 4/10.',
      erreurs: ['Serviette qui glisse.', 'Mouvement rapide ou incomplet.'],
      facile: 'Sans charge, au sol.',
      difficile: 'Sac à dos lesté.',
    },
    seance: { tempo: [['Monte', 3], ['Tenez', 2], ['Descends', 3]], recupS: 120 },
  },
  pied_court: {
    details: {
      depart: 'Assis, pieds à plat au sol (puis debout quand c\'est facile).',
      etapes: [
        'Rapprochez l\'avant du pied du talon en creusant la voûte, sans plier les orteils.',
        'Tenez la contraction pendant la durée indiquée, puis relâchez.',
        'Ensuite, ramassez une serviette posée au sol avec les orteils, plusieurs fois.',
      ],
      respiration: 'Respiration calme.',
      sensation: 'Petite crampe sous le pied : c\'est le muscle qui travaille.',
      erreurs: ['Recroqueviller les orteils.', 'Soulever le talon.'],
      facile: 'Assis, tenue plus courte.',
      difficile: 'Debout sur une jambe.',
    },
    seance: { recupS: 30, libelleTenue: 'Creusez la voûte' },
  },
  alphabet: {
    details: {
      depart: 'Assis ou allongé, jambe atteinte surélevée sur un coussin.',
      etapes: [
        'Avec la pointe du pied, « écrivez » les lettres de l\'alphabet en majuscules, lentement.',
        'Faites des mouvements amples mais sans forcer.',
      ],
      respiration: 'Respiration calme.',
      sensation: 'Raideur qui diminue ; légère gêne acceptable.',
      erreurs: ['Bouger tout le genou au lieu de la cheville.', 'Forcer dans la douleur.'],
      facile: 'Lettres plus petites.',
      difficile: '—',
    },
    seance: { recupS: 0 },
  },
  iso_eversion: {
    details: {
      depart: 'Assis, genou plié, bord externe du pied atteint contre un pied de table ou un mur.',
      etapes: [
        'Poussez le bord externe du pied vers l\'extérieur, contre l\'obstacle, sans bouger.',
        'Tenez la poussée pendant la durée indiquée, puis relâchez.',
      ],
      respiration: 'Respirez normalement pendant la poussée.',
      sensation: 'Contraction sur le côté externe de la jambe ; pas de douleur vive.',
      erreurs: ['Tourner tout le genou.', 'Pousser trop fort au début.'],
      facile: 'Poussée légère.',
      difficile: 'Poussée plus forte.',
    },
    seance: { recupS: 10, libelleTenue: 'Poussez' },
  },
  eversion_elastique: {
    details: {
      depart: 'Assis, jambe tendue, élastique autour de l\'avant du pied atteint, fixé de l\'autre côté (vers l\'intérieur).',
      etapes: [
        'Tournez la plante du pied vers l\'extérieur contre l\'élastique, en 2 secondes.',
        'Revenez lentement en 2 secondes.',
      ],
      respiration: 'Expirez en tirant, inspirez en revenant.',
      sensation: 'Fatigue sur le côté externe de la jambe.',
      erreurs: ['Bouger le genou ou la hanche.', 'Relâcher d\'un coup.'],
      facile: 'Élastique plus souple.',
      difficile: 'Élastique plus fort.',
    },
    seance: { tempo: [['Tire', 2], ['Reviens', 2]], recupS: 60 },
  },
  glace: {
    details: {
      depart: 'Allongé, jambe surélevée sur des coussins (cheville plus haute que le genou).',
      etapes: [
        'Posez une poche de glace enveloppée dans un linge sur la zone gonflée.',
        'Laissez en place la durée indiquée, sans contact direct avec la peau.',
      ],
      respiration: '—',
      sensation: 'Froid supportable ; retirez si la peau brûle ou devient blanche.',
      erreurs: ['Glace directement sur la peau.', 'Plus de 20 minutes d\'affilée.'],
      facile: '—',
      difficile: '—',
    },
    seance: { recupS: 0, libelleTenue: 'Glace' },
  },
};

// Fiche de chaque exercice, par programme. Une valeur [fiche, seance] remplace le rythme de la fiche.
const FICHES_PAR_PROGRAMME = {
  achille_corps: { iso_debout: 'iso_mollet', iso_assis: 'iso_soleaire', montees_lentes: 'montees_lentes', montees_debout: 'montees_lourdes', montees_assis: 'montees_assis_lourdes', sautillements: 'sautillements' },
  periostite: { montees_2_pieds: 'montees_lentes', releveurs: 'releveurs', massage: 'automassage', montees_unipodales: 'montees_lourdes', soleaire: 'montees_assis_lourdes', equilibre: 'equilibre', sautillements: 'sautillements', montees_entretien: 'montees_lourdes' },
  bandelette: { iso_abduction: 'iso_abduction', pont_fessier: 'pont', releve_lateral: 'releve_lateral', descente_marche: 'descente_marche', pont_unipodal: 'pont', marche_laterale: 'pas_chasses', gainage_lateral: 'gainage_lateral', fentes: 'fentes', descente_lestee: 'descente_marche' },
  femoro_patellaire: { chaise: 'chaise', pont_fessier: 'pont', releve_lateral: 'releve_lateral', squat_partiel: 'squat', montee_marche: 'montee_marche', marche_laterale: 'pas_chasses', fentes: 'fentes', sautillements: 'sautillements' },
  tendon_rotulien: { chaise: ['chaise', { recupS: 120 }], pont_fessier: 'pont', squat_lent: ['squat', { tempo: LENT_3_3, recupS: 150 }], fente_bulgare: 'fente_bulgare', sautillements: 'sautillements', squat_entretien: ['squat', { tempo: LENT_3_3, recupS: 150 }] },
  aponevrosite: { etirement_aponevrose: 'etirement_aponevrose', montees_lentes: 'montees_lentes', massage_balle: 'automassage', montees_serviette: 'montees_serviette', pied_court: 'pied_court', soleaire: 'montees_assis_lourdes', sautillements: 'sautillements', montees_entretien: 'montees_serviette' },
  entorse_cheville: { alphabet: 'alphabet', iso_eversion: 'iso_eversion', glace: 'glace', equilibre: 'equilibre', eversion_elastique: 'eversion_elastique', montees_pointe: 'montees_lentes', sautillements: 'sautillements' },
};

function avecFiches(programme) {
  const table = FICHES_PAR_PROGRAMME[programme.id] ?? {};
  return {
    ...programme,
    phases: programme.phases.map(ph => ({
      ...ph,
      exercices: ph.exercices.map(e => {
        const ref = table[e.id];
        if (!ref) return e;
        const [cle, seance] = Array.isArray(ref) ? ref : [ref, null];
        const fiche = FICHES[cle];
        return { ...e, details: fiche.details, seance: { ...fiche.seance, ...seance } };
      }),
    })),
  };
}

export const PROGRAMMES = [ACHILLE, PERIOSTITE, BANDELETTE, FEMORO_PATELLAIRE, ROTULIEN, APONEVROSITE, ENTORSE_CHEVILLE].map(avecFiches);
