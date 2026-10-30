// Suivi de blessure : programme de soin par phases, bilans quotidiens, critères de passage,
// contraintes transmises au plan IA. Règles pures (sans DOM ni IndexedDB), testées par tests/soin.test.js.
import { ajouterJours, ecartJours } from './format.js';
import { uid, ErreurMetier } from './domaine.js';

export const COTES = [
  { id: 'gauche', libelle: 'Gauche' },
  { id: 'droit', libelle: 'Droit' },
];

// ------------------------------------------------------------ Référentiel des programmes

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

export const PROGRAMMES = [ACHILLE];
export const programme = id => PROGRAMMES.find(p => p.id === id) ?? null;

const coteTexte = cote => (cote === 'droit' ? 'droite' : 'gauche');
export const avecCote = (texte, cote) => (texte ?? '').replaceAll('{cote}', coteTexte(cote));
export const nomSuivi = s => `${programme(s.programme)?.court ?? 'Blessure'} ${coteTexte(s.cote)}`;
export const phaseDe = (s, numero = s.phase) => programme(s.programme)?.phases.find(p => p.numero === numero) ?? null;

// ------------------------------------------------------------ Suivi : cycle de vie

const DATE = /^\d{4}-\d{2}-\d{2}$/;

function exiger(condition, message) {
  if (!condition) throw new ErreurMetier(message);
}

export function creerSuivi(donnees, maintenant = Date.now()) {
  const prog = programme(donnees.programme);
  exiger(prog, 'Choisissez un programme.');
  exiger(COTES.some(c => c.id === donnees.cote), 'Choisissez le côté atteint.');
  exiger(DATE.test(donnees.debut ?? ''), 'La date de début est obligatoire.');
  const phase = Number(donnees.phase ?? 1);
  exiger(prog.phases.some(p => p.numero === phase), 'Phase de départ inconnue.');
  return {
    id: uid(),
    programme: prog.id,
    cote: donnees.cote,
    debut: donnees.debut,
    phase,
    phaseDebut: donnees.debut,
    historique: [{ phase, debut: donnees.debut }],
    statut: 'en_cours',
    fin: null,
    notes: (donnees.notes ?? '').trim(),
    creeLe: maintenant,
    modifieLe: maintenant,
  };
}

export function modifierSuivi(suivi, donnees, maintenant = Date.now()) {
  exiger(COTES.some(c => c.id === donnees.cote), 'Choisissez le côté atteint.');
  exiger(DATE.test(donnees.debut ?? ''), 'La date de début est obligatoire.');
  exiger(suivi.historique.length === 1 || donnees.debut < suivi.historique[1].debut, 'La date de début ne peut pas suivre un changement de phase.');
  const premier = { ...suivi.historique[0], debut: donnees.debut };
  const unePhase = suivi.historique.length === 1;
  return {
    ...suivi,
    cote: donnees.cote,
    debut: donnees.debut,
    phaseDebut: unePhase ? donnees.debut : suivi.phaseDebut,
    historique: [premier, ...suivi.historique.slice(1)],
    notes: (donnees.notes ?? '').trim(),
    modifieLe: maintenant,
  };
}

// Passage à une autre phase (suivante, ou retour à la précédente) à la date indiquée.
export function changerPhase(suivi, numero, date, maintenant = Date.now()) {
  exiger(suivi.statut === 'en_cours', 'Ce suivi est terminé.');
  exiger(phaseDe(suivi, numero), 'Phase inconnue.');
  exiger(numero !== suivi.phase, 'Le suivi est déjà dans cette phase.');
  exiger(date >= suivi.phaseDebut, 'La date du changement précède le début de la phase actuelle.');
  return {
    ...suivi,
    phase: numero,
    phaseDebut: date,
    historique: [...suivi.historique, { phase: numero, debut: date }],
    modifieLe: maintenant,
  };
}

export function terminerSuivi(suivi, date, maintenant = Date.now()) {
  exiger(suivi.statut === 'en_cours', 'Ce suivi est déjà terminé.');
  return { ...suivi, statut: 'termine', fin: date, modifieLe: maintenant };
}

export const suivisActifs = suivis => suivis.filter(s => s.statut === 'en_cours');

// ------------------------------------------------------------ Bilans quotidiens

export const CHAMPS_DOULEUR = [
  { id: 'raideurMatin', libelle: 'Raideur au réveil', obligatoire: true },
  { id: 'douleurMarche', libelle: 'Douleur à la marche', obligatoire: true },
  { id: 'douleurEscaliers', libelle: 'Douleur dans les escaliers', obligatoire: true },
  { id: 'douleurCourse', libelle: 'Douleur en courant', obligatoire: false, vide: 'Pas couru' },
  { id: 'douleurExercices', libelle: 'Douleur pendant les exercices', obligatoire: false, vide: 'Pas d\'exercice' },
  { id: 'douleurSautillements', libelle: 'Douleur aux sautillements', obligatoire: false, vide: 'Non testé' },
];

const note010 = v => (v === null || v === undefined || v === '' ? null : Number(v));

// Un seul bilan par jour et par suivi : enregistrer un bilan à une date existante le remplace.
export function enregistrerBilan(donnees, suivi, bilans, maintenant = Date.now()) {
  exiger(suivi, 'Suivi introuvable.');
  exiger(DATE.test(donnees.date ?? ''), 'La date du bilan est obligatoire.');
  exiger(donnees.date >= suivi.debut, 'Le bilan précède le début du suivi.');
  const b = { blessureId: suivi.id, date: donnees.date };
  for (const c of CHAMPS_DOULEUR) {
    const v = note010(donnees[c.id]);
    exiger(v === null || (Number.isInteger(v) && v >= 0 && v <= 10), `${c.libelle} : note de 0 à 10.`);
    exiger(v !== null || !c.obligatoire, `${c.libelle} : note obligatoire.`);
    b[c.id] = v;
  }
  const nb = note010(donnees.testMonteesNb);
  const dt = note010(donnees.testMonteesDouleur);
  exiger(nb === null || (Number.isInteger(nb) && nb >= 0 && nb <= 200), 'Test des montées : nombre de répétitions invalide.');
  exiger(dt === null || (Number.isInteger(dt) && dt >= 0 && dt <= 10), 'Test des montées : douleur de 0 à 10.');
  exiger((nb === null) === (dt === null), 'Test des montées : indiquez le nombre de répétitions et la douleur.');
  b.testMonteesNb = nb;
  b.testMonteesDouleur = dt;
  b.exercices = Array.isArray(donnees.exercices) ? [...new Set(donnees.exercices)] : [];
  b.notes = (donnees.notes ?? '').trim();
  // Modification : on garde l'identifiant ; nouveau bilan à une date déjà saisie : on reprend celui du jour.
  const existant = donnees.id
    ? bilans.find(x => x.id === donnees.id)
    : bilans.find(x => x.blessureId === suivi.id && x.date === donnees.date);
  return { id: existant?.id ?? uid(), ...b, creeLe: existant?.creeLe ?? maintenant, modifieLe: maintenant };
}

export const bilansDe = (suivi, bilans) => bilans.filter(b => b.blessureId === suivi.id).sort((a, b) => a.date.localeCompare(b.date));
export const bilanDuJour = (suivi, bilans, date) => bilans.find(b => b.blessureId === suivi.id && b.date === date) ?? null;

// Dernier bilan renseignant `champ` dans les `fenetre` derniers jours (date incluse).
function dernierAvec(liste, champ, date, fenetre) {
  const debut = ajouterJours(date, -(fenetre - 1));
  return [...liste].reverse().find(b => b.date <= date && b.date >= debut && b[champ] !== null && b[champ] !== undefined) ?? null;
}

const moyenne = l => (l.length ? l.reduce((a, b) => a + b, 0) / l.length : null);
const arrondi1 = n => Math.round(n * 10) / 10;

// ------------------------------------------------------------ Séance du jour

export function semaineDansPhase(suivi, date) {
  return Math.max(1, Math.floor(ecartJours(suivi.phaseDebut, date) / 7) + 1);
}

// Exercices du jour avec leur dosage pour la semaine en cours de la phase.
// `repos` : exercice « un jour sur deux » déjà fait la veille.
export function seanceDuJour(suivi, bilans, date) {
  const phase = phaseDe(suivi);
  if (!phase) return null;
  const semaine = semaineDansPhase(suivi, date);
  const hier = bilanDuJour(suivi, bilans, ajouterJours(date, -1));
  const exercices = phase.exercices.map(e => {
    const dosage = e.dosage[Math.min(semaine, e.dosage.length) - 1];
    if (dosage === null) return null;
    return {
      ...e,
      nom: avecCote(e.nom, suivi.cote),
      dosage: avecCote(dosage, suivi.cote),
      consignes: e.consignes.map(c => avecCote(c, suivi.cote)),
      repos: !!(e.alterne && hier?.exercices?.includes(e.id)),
    };
  }).filter(Boolean);
  return { phase, semaine, exercices };
}

// ------------------------------------------------------------ Alertes

export function alertesSoin(suivi, bilans, date) {
  const liste = bilansDe(suivi, bilans).filter(b => b.date <= date);
  const alertes = [];
  // Raideur du matin en hausse deux jours de suite (trois bilans consécutifs, le dernier datant d'hier au plus tard).
  const trois = liste.slice(-3);
  if (trois.length === 3 && ecartJours(trois[2].date, date) <= 1 && ecartJours(trois[0].date, trois[2].date) === 2
    && trois[1].raideurMatin > trois[0].raideurMatin && trois[2].raideurMatin > trois[1].raideurMatin) {
    alertes.push({ code: 'raideur_hausse', niveau: 'attention', message: 'Raideur du matin en hausse deux jours de suite : revenez à la charge de la semaine précédente.' });
  }
  const course = dernierAvec(liste, 'douleurCourse', date, 7);
  if (course && course.douleurCourse > 4) {
    alertes.push({
      code: 'course_douloureuse', niveau: 'danger',
      message: `Course à ${course.douleurCourse}/10 : pas de course jusqu'au ${ajouterJours(course.date, 7)} inclus, remplacez-la par vélo, elliptique ou natation.`,
    });
  }
  const ex = dernierAvec(liste, 'douleurExercices', date, 3);
  if (ex && ex.douleurExercices > 4) {
    alertes.push({ code: 'exercices_douloureux', niveau: 'attention', message: `Exercices à ${ex.douleurExercices}/10 : allégez la charge (règle : ≤ 4/10).` });
  }
  return alertes;
}

// ------------------------------------------------------------ Critères de passage

// Évalue les critères de la phase actuelle. `pret` : tous remplis → proposer la phase suivante (ou la fin du suivi).
export function criteresPassage(suivi, bilans, date) {
  const phase = phaseDe(suivi);
  if (!phase) return { criteres: [], pret: false, suivante: null };
  const prog = programme(suivi.programme);
  const dansPhase = bilansDe(suivi, bilans).filter(b => b.date >= suivi.phaseDebut && b.date <= date);
  const criteres = phase.criteres.map(c => {
    const libelle = avecCote(c.libelle, suivi.cote);
    if (c.type === 'duree') {
      const jours = ecartJours(suivi.phaseDebut, date);
      return { id: c.id, libelle, ok: jours >= c.jours, valeur: `${jours} jour${jours > 1 ? 's' : ''}` };
    }
    if (c.type === 'derniere') {
      const b = dernierAvec(dansPhase, c.champ, date, c.fenetre);
      return { id: c.id, libelle, ok: !!b && b[c.champ] <= c.max, valeur: b ? `${b[c.champ]}/10` : 'non mesuré récemment' };
    }
    if (c.type === 'raideur') {
      if (dansPhase.length < 3) return { id: c.id, libelle, ok: false, valeur: `${dansPhase.length} bilan${dansPhase.length > 1 ? 's' : ''} sur 3 minimum` };
      const derniers = dansPhase.slice(-3);
      const recent = ecartJours(derniers[2].date, date) <= 2;
      const m = moyenne(derniers.map(b => b.raideurMatin));
      const depart = moyenne(dansPhase.slice(0, 3).map(b => b.raideurMatin));
      const enBaisse = c.baisse !== null && dansPhase.length >= 6 && m <= depart - c.baisse;
      const ok = recent && (m <= c.maxMoyenne || enBaisse);
      const valeur = recent
        ? `${arrondi1(m).toString().replace('.', ',')}/10${c.baisse !== null && dansPhase.length >= 6 ? ` (début de phase : ${arrondi1(depart).toString().replace('.', ',')})` : ''}`
        : 'pas de bilan récent';
      return { id: c.id, libelle, ok, valeur };
    }
    if (c.type === 'test') {
      const b = dernierAvec(dansPhase, 'testMonteesNb', date, c.fenetre);
      return {
        id: c.id, libelle,
        ok: !!b && b.testMonteesNb >= c.nbMin && b.testMonteesDouleur <= c.douleurMax,
        valeur: b ? `${b.testMonteesNb} montées à ${b.testMonteesDouleur}/10` : 'test à faire',
      };
    }
    return { id: c.id, libelle, ok: false, valeur: '' };
  });
  const suivante = prog.phases.find(p => p.numero === suivi.phase + 1) ?? null;
  return { criteres, pret: criteres.every(c => c.ok), suivante };
}

// ------------------------------------------------------------ Contraintes pour le plan IA

// Projection des phases à partir d'aujourd'hui, avec leur durée maximale (prudente) :
// la phase actuelle court au moins 7 jours, les suivantes s'enchaînent. Recalculer le plan à chaque changement de phase.
export function projectionPhases(suivi, aujourdhui) {
  const prog = programme(suivi.programme);
  const fenetres = [];
  let debut = aujourdhui;
  for (const p of prog.phases.filter(x => x.numero >= suivi.phase)) {
    let fin;
    if (p.numero === suivi.phase) {
      const finPrevue = ajouterJours(suivi.phaseDebut, p.dureeMaxSem * 7 - 1);
      fin = finPrevue < ajouterJours(aujourdhui, 6) ? ajouterJours(aujourdhui, 6) : finPrevue;
    } else fin = ajouterJours(debut, p.dureeMaxSem * 7 - 1);
    fenetres.push({ phase: p.numero, nom: p.nom, du: debut, au: fin });
    debut = ajouterJours(fin, 1);
  }
  return fenetres;
}

// Règle de course effective d'une phase (« si_douleur_ok » résolu avec le dernier bilan).
function regleCourse(phase, courseRecente) {
  const c = phase.course;
  const autorisee = c.autorisee === 'si_douleur_ok' ? !!courseRecente && courseRecente.douleurCourse <= 4 : c.autorisee;
  return autorisee
    ? { courseAutorisee: true, intensites: c.intensites, types: c.types, dureeMaxMin: c.dureeMaxMin }
    : { courseAutorisee: false, intensites: [], types: [], dureeMaxMin: 0 };
}

// Données transmises à l'IA pour chaque suivi en cours. Elles servent aussi à valider le plan.
export function contexteIa(suivis, bilans, aujourdhui) {
  return suivisActifs(suivis).map(s => {
    const prog = programme(s.programme);
    const phase = phaseDe(s);
    const liste = bilansDe(s, bilans).filter(b => b.date <= aujourdhui);
    const courseRecente = dernierAvec(liste, 'douleurCourse', aujourdhui, 7);
    const projection = projectionPhases(s, aujourdhui).map(f => {
      const p = phaseDe(s, f.phase);
      return { ...f, but: p.but, course: p.course.texte, ...regleCourse(p, f.phase === s.phase ? courseRecente : { douleurCourse: 0 }) };
    });
    const debutBilans = ajouterJours(aujourdhui, -13);
    return {
      id: s.id,
      blessure: avecCote(`${prog.libelle}, côté {cote}`, s.cote),
      phaseActuelle: { numero: phase.numero, nom: phase.nom, semaine: semaineDansPhase(s, aujourdhui), depuis: s.phaseDebut },
      projection,
      apresProjection: 'Course libre, en reprenant progressivement l\'intensité (fractionné et côtes en dernier). ' + prog.entretien,
      courseInterditeJusquau: courseRecente && courseRecente.douleurCourse > 4 ? ajouterJours(courseRecente.date, 7) : null,
      derniersBilans: liste.filter(b => b.date >= debutBilans).map(b => ({
        date: b.date,
        raideurMatin: b.raideurMatin,
        douleurMarche: b.douleurMarche,
        douleurEscaliers: b.douleurEscaliers,
        douleurCourse: b.douleurCourse,
      })),
      alertes: alertesSoin(s, bilans, aujourdhui).map(a => a.message),
    };
  });
}

const DISCIPLINES_COURSE = ['course', 'enchainement'];

// Contrôle d'une séance du plan IA contre les contraintes de soin. Renvoie la liste des motifs de rejet.
export function erreursSeanceSoin(seance, blessures) {
  if (!DISCIPLINES_COURSE.includes(seance.discipline) || !blessures?.length) return [];
  const erreurs = [];
  for (const b of blessures) {
    if (b.courseInterditeJusquau && seance.date <= b.courseInterditeJusquau) {
      erreurs.push(`course interdite jusqu'au ${b.courseInterditeJusquau} (douleur de course > 4/10, suivi « ${b.blessure} »).`);
      continue;
    }
    const f = b.projection.find(x => x.du <= seance.date && seance.date <= x.au);
    if (!f) continue;
    const ref = `phase ${f.phase} « ${f.nom} » du suivi « ${b.blessure} »`;
    if (!f.courseAutorisee) { erreurs.push(`pas de course pendant la ${ref} (jusqu'au ${f.au}).`); continue; }
    if (!f.intensites.includes(seance.intensite)) erreurs.push(`intensité « ${seance.intensite} » interdite pendant la ${ref} (autorisées : ${f.intensites.join(', ')}).`);
    if (seance.discipline === 'course') {
      if (!f.types.includes(seance.type)) erreurs.push(`type « ${seance.type} » interdit pendant la ${ref} (autorisés : ${f.types.join(', ')}).`);
      if (Number(seance.dureeMin) > f.dureeMaxMin) erreurs.push(`${seance.dureeMin} min de course pour un maximum de ${f.dureeMaxMin} min pendant la ${ref}.`);
    }
  }
  return erreurs;
}

// Le plan IA a-t-il été calculé pour la phase actuelle de chaque suivi en cours ?
export function planAJour(meta, suivis) {
  const actifs = suivisActifs(suivis);
  if (!meta || !actifs.length) return true;
  const phases = new Map((meta.soin ?? []).map(x => [x.id, x.phase]));
  return actifs.every(s => phases.get(s.id) === s.phase);
}
