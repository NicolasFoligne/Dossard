// Nouvelle blessure hors catalogue : texte à copier dans une IA (questions-réponses, hypothèse de diagnostic,
// puis programme de soin au format de l'application) et validation stricte du programme collé en retour.
// Règles pures (sans DOM ni IndexedDB), testées par tests/soin.test.js.
import * as D from './domaine.js';
import { CHAMPS_DOULEUR, PROGRAMMES } from './soin.js';
import { ajouterJours, lundiDe } from './format.js';

// ------------------------------------------------------------ Description de la blessure (formulaire)

export const ZONES = [
  'Pied / talon', 'Cheville', 'Tendon d\'Achille', 'Mollet', 'Tibia', 'Genou (devant)', 'Genou (côté externe)',
  'Genou (côté interne)', 'Genou (derrière)', 'Cuisse (avant)', 'Cuisse (arrière)', 'Hanche / fessier', 'Aine', 'Bas du dos', 'Autre',
];
export const COTES_BLESSURE = ['Gauche', 'Droit', 'Les deux', 'Sans objet'];
export const APPARITIONS = ['Progressive (sans événement précis)', 'Brutale (faux mouvement, choc, chute)'];
export const MOMENTS = ['Au réveil', 'Au début de l\'effort', 'Pendant l\'effort', 'Après l\'effort', 'Au repos', 'La nuit', 'Dans les escaliers'];
export const SIGNES = ['Gonflement', 'Bleu (hématome)', 'Raideur', 'Craquements', 'Sensation d\'instabilité', 'Blocage', 'Fourmillements ou engourdissement', 'Chaleur ou rougeur'];

export const descriptionVide = () => ({
  zone: '', cote: '', debut: '', apparition: '', douleurRepos: null, douleurMarche: null, douleurCourse: null,
  moments: [], signes: [], aggrave: '', diagnostic: '', libre: '',
});

const note = v => (v === null || v === undefined || v === '' ? 'non renseignée' : `${v}/10`);
const liste = l => (l?.length ? l.join(', ') : 'non renseigné');

// ------------------------------------------------------------ Format attendu du programme

// Exemple abrégé donné à l'IA (une phase et un exercice ; le vrai programme en compte davantage).
const EXEMPLE = {
  libelle: 'Tendinopathie d\'Achille (corps du tendon)',
  court: 'Tendon d\'Achille',
  description: 'Douleur 2 à 6 cm au-dessus du talon, raideur au réveil…',
  regleDouleur: ['Pendant l\'effort, la douleur reste ≤ 4/10.'],
  aEviter: ['Étirements forcés du mollet.'],
  consulter: ['Claquement ou sensation de coup de pied derrière la jambe.'],
  avisMedical: 'Avis médical conseillé (médecin du sport, échographie).',
  entretien: 'Après le programme : 2 séances par semaine de montées sur pointe lourdes.',
  test: { nom: 'Test des montées sur pointe', unite: 'montées', consigne: 'Sur la jambe {cote} seule, montées complètes jusqu\'à la fatigue.' },
  phases: [{
    numero: 1, nom: 'Calmer', dureeMinSem: 2, dureeMaxSem: 4, but: 'Faire baisser la douleur sans repos complet.',
    exercices: [{
      id: 'iso_debout', nom: 'Isométrie debout', cible: 'Mollet', frequence: 'Tous les jours', alterne: false, facultatif: false,
      consignes: ['Montez à mi-hauteur sur la pointe du pied et tenez 45 s.'],
      dosage: ['Sur les 2 pieds · 5 × 45 s', 'Jambe {cote} seule · 5 × 45 s'],
    }],
    course: {
      texte: 'Footing facile de 30 min au plus si la douleur reste ≤ 4/10.',
      autorisee: 'si_douleur_ok', intensites: ['facile'], types: ['endurance', 'recuperation'], dureeMaxMin: 30,
    },
    conseils: ['Talonnette de 6 à 8 mm dans les chaussures de ville.'],
    criteres: [
      { id: 'duree', type: 'duree', jours: 14, libelle: 'Au moins 2 semaines dans la phase' },
      { id: 'marche', type: 'derniere', champ: 'douleurMarche', max: 2, fenetre: 7, libelle: 'Marche ≤ 2/10' },
      { id: 'test', type: 'test', nbMin: 15, douleurMax: 4, fenetre: 14, libelle: '15 montées sur la jambe {cote} seule, douleur ≤ 4/10' },
    ],
  }],
};

const REGLES_FORMAT = `Règles du JSON (il sera vérifié automatiquement par l'application et refusé s'il ne les respecte pas) :
- 2 à 4 phases progressives (par exemple : calmer, renforcer, reprendre), « numero » 1, 2, 3… ; « dureeMinSem » ≤ « dureeMaxSem » (en semaines, 1 à 20).
- Dans chaque phase : 1 à 6 exercices réalisables à la maison avec du matériel simple ; au moins un exercice non facultatif dosé dès la semaine 1.
- Exercice : « id » court en minuscules sans espace ni accent (unique dans la phase) ; « alterne » : true si l'exercice se fait un jour sur deux ; « facultatif » : true s'il est optionnel ;
  « dosage » : une entrée par semaine de la phase (la dernière se répète ensuite), null si l'exercice n'est pas encore introduit cette semaine-là.
- Écris « {cote} » là où il faut nommer le côté atteint (« Jambe {cote} seule ») : l'application le remplace par gauche ou droite.
- Course : « autorisee » vaut true, false ou "si_douleur_ok" (seulement si la dernière douleur de course des 7 derniers jours est ≤ 4/10) ;
  « intensites » parmi ${D.INTENSITES.map(i => `"${i.id}"`).join(', ')} ; « types » parmi ${D.TYPES_SEANCE.map(t => `"${t.id}"`).join(', ')} ;
  « dureeMaxMin » : durée maximale d'une course en minutes. Ces règles limitent ensuite le plan d'entraînement.
- Critères de passage à la phase suivante (1 à 6 par phase), uniquement de ces types, fondés sur le bilan quotidien de l'application :
  « duree » { jours } : jours minimum dans la phase ;
  « derniere » { champ, max, fenetre } : la dernière note du champ, sur les « fenetre » derniers jours, est ≤ « max » ; champs possibles : ${CHAMPS_DOULEUR.map(c => `"${c.id}" (${c.libelle.toLowerCase()})`).join(', ')} ;
  « raideur » { maxMoyenne, baisse } : moyenne de la raideur du matin sur les 3 derniers bilans ≤ « maxMoyenne », ou en baisse d'au moins « baisse » points depuis le début de la phase (baisse : null pour l'ignorer) ;
  « test » { nbMin, douleurMax, fenetre } : résultat du test du programme (objet « test » obligatoire : nom, unité, consigne) — au moins « nbMin » avec une douleur ≤ « douleurMax ».
- Textes en français, courts et concrets. Aucun nom, aucune date, aucune donnée personnelle dans le JSON.`;

// ------------------------------------------------------------ Texte à copier dans l'IA

// `etat` : état de l'application (profil, objectifs, séances réalisées) pour le contexte sportif.
export function promptBlessure(description, etat, aujourdhui) {
  const d = { ...descriptionVide(), ...description };
  const enCours = etat.objectifs.filter(o => o.statut === 'en_cours');
  const debut4 = ajouterJours(lundiDe(aujourdhui), -28);
  const recentes = etat.realisees.filter(r => r.date >= debut4 && r.date <= aujourdhui);
  const volumes = new Map();
  for (const r of recentes) {
    const l = lundiDe(r.date);
    const v = volumes.get(l) ?? { minutes: 0, disciplines: new Set() };
    v.minutes += Math.round((r.dureeS ?? 0) / 60);
    v.disciplines.add(D.discipline(r.discipline).court.toLowerCase());
    volumes.set(l, v);
  }
  const p = etat.profil ?? {};
  const catalogue = PROGRAMMES.map(x => x.libelle).join(' ; ');

  return `Tu es un kinésithérapeute du sport expérimenté qui accompagne un coureur / triathlète. Je décris ci-dessous une douleur ou une blessure.

Ta mission, en deux temps :
1. Questions-réponses. Pose-moi des questions ciblées pour préciser la blessure (5 au plus par message, numérotées) : localisation exacte, mécanisme, comportement de la douleur, tests simples que je peux faire seul. Attends mes réponses avant de continuer.
   Si un signe d'alerte évoque une lésion qui doit être examinée (fracture, rupture, atteinte nerveuse ou vasculaire, infection, douleur nocturne inexpliquée…), dis-le clairement, conseille de consulter rapidement et ne propose pas de programme.
2. Hypothèse et programme. Quand tu as assez d'éléments, donne ton hypothèse de diagnostic, ton niveau de certitude et les diagnostics à écarter, en rappelant qu'elle ne remplace pas un examen médical. Si la blessure correspond à l'un de ces programmes déjà disponibles dans mon application, dis-le simplement : ${catalogue}.
   Sinon, après mon accord, donne un programme de soin progressif, piloté par la douleur et adapté à mon contexte sportif, dans un seul bloc \`\`\`json, sans aucun commentaire dans le JSON, au format de cet exemple abrégé :
${JSON.stringify(EXEMPLE, null, 1)}

${REGLES_FORMAT}

--- Ma blessure ---
Zone : ${d.zone || 'non renseignée'} · côté : ${d.cote || 'non renseigné'}
Depuis le : ${d.debut || 'non renseigné'} · apparition : ${d.apparition || 'non renseignée'}
Douleur au repos : ${note(d.douleurRepos)} · à la marche : ${note(d.douleurMarche)} · en courant : ${note(d.douleurCourse)}
Moments où ça fait mal : ${liste(d.moments)}
Signes associés : ${liste(d.signes)}
Ce qui aggrave ou soulage : ${d.aggrave || 'non renseigné'}
Diagnostic, examens ou soins déjà faits : ${d.diagnostic || 'aucun'}
Description libre : ${d.libre || '—'}

--- Mon contexte sportif (date du jour : ${aujourdhui}) ---
Niveau : ${p.niveau || 'non renseigné'} · allure habituelle : ${p.allureHabituelle || 'non renseignée'}
Performances récentes : ${p.performances || 'non renseignées'}
Antécédents de blessures : ${p.blessures || 'aucun'}
Objectifs en cours : ${enCours.length ? enCours.map(o => `${o.nom} (${D.libelleTypeObjectif(o)}, le ${o.dateEpreuve}${o.tempsViseS ? `, temps visé ${Math.floor(o.tempsViseS / 3600)} h ${String(Math.floor((o.tempsViseS % 3600) / 60)).padStart(2, '0')}` : ''})`).join(' ; ') : 'aucun'}
Volume des 4 dernières semaines : ${volumes.size ? [...volumes].sort().map(([l, v]) => `semaine du ${l} : ${v.minutes} min (${[...v.disciplines].join(', ')})`).join(' ; ') : 'aucune séance enregistrée'}

Commence par tes questions.`;
}

// ------------------------------------------------------------ Validation du programme collé

const texte = (v, max = 400) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const textes = (v, max = 10) => (Array.isArray(v) ? v.map(x => texte(x)).filter(Boolean).slice(0, max) : []);
const entier = (v, min, max) => Number.isInteger(v) && v >= min && v <= max;
const ID = /^[a-z0-9_]{1,40}$/;
const CHAMPS = CHAMPS_DOULEUR.map(c => c.id);

// Vérifie un programme (collé depuis l'IA, ou importé d'une sauvegarde). Renvoie { programme, erreurs } :
// `programme` normalisé (identifiant `perso_…`, source « ia ») si `erreurs` est vide.
export function validerProgramme(brut, { id = null, maintenant = Date.now() } = {}) {
  const erreurs = [];
  if (!brut || typeof brut !== 'object' || Array.isArray(brut)) return { programme: null, erreurs: ['Le programme doit être un objet JSON.'] };
  const libelle = texte(brut.libelle, 100);
  if (!libelle) erreurs.push('« libelle » (nom de la blessure) est obligatoire.');
  const consulter = textes(brut.consulter);
  if (!consulter.length) erreurs.push('« consulter » doit lister au moins un signe qui impose de consulter.');
  let test = null;
  if (brut.test !== undefined && brut.test !== null) {
    test = { nom: texte(brut.test.nom, 80), unite: texte(brut.test.unite, 30), consigne: texte(brut.test.consigne) };
    if (!test.nom || !test.unite || !test.consigne) erreurs.push('« test » doit avoir un nom, une unité et une consigne.');
  }
  const phasesBrutes = Array.isArray(brut.phases) ? brut.phases : [];
  if (phasesBrutes.length < 2 || phasesBrutes.length > 4) erreurs.push('Le programme doit compter 2 à 4 phases.');

  const phases = phasesBrutes.slice(0, 4).map((ph, i) => {
    const ref = `Phase ${i + 1}`;
    if (!ph || typeof ph !== 'object') { erreurs.push(`${ref} : format invalide.`); return null; }
    if (!texte(ph.nom, 60)) erreurs.push(`${ref} : « nom » obligatoire.`);
    if (!entier(ph.dureeMinSem, 1, 20) || !entier(ph.dureeMaxSem, 1, 20) || ph.dureeMinSem > ph.dureeMaxSem) {
      erreurs.push(`${ref} : « dureeMinSem » et « dureeMaxSem » doivent être des entiers de 1 à 20, le minimum ≤ le maximum.`);
    }
    const exBruts = Array.isArray(ph.exercices) ? ph.exercices : [];
    if (exBruts.length < 1 || exBruts.length > 6) erreurs.push(`${ref} : 1 à 6 exercices.`);
    const ids = new Set();
    const exercices = exBruts.slice(0, 6).map((e, k) => {
      const refE = `${ref}, exercice ${k + 1}`;
      if (!e || typeof e !== 'object') { erreurs.push(`${refE} : format invalide.`); return null; }
      if (!ID.test(e.id ?? '')) erreurs.push(`${refE} : « id » en minuscules, chiffres et _ uniquement.`);
      else if (ids.has(e.id)) erreurs.push(`${refE} : « id » « ${e.id} » en double dans la phase.`);
      ids.add(e.id);
      if (!texte(e.nom, 80)) erreurs.push(`${refE} : « nom » obligatoire.`);
      const consignes = textes(e.consignes, 8);
      if (!consignes.length) erreurs.push(`${refE} : au moins une consigne.`);
      const dosage = Array.isArray(e.dosage) ? e.dosage.slice(0, 20).map(x => (x === null ? null : texte(x, 120) || null)) : [];
      if (!dosage.some(x => x !== null)) erreurs.push(`${refE} : « dosage » doit contenir au moins une semaine renseignée.`);
      if (typeof e.alterne !== 'boolean') erreurs.push(`${refE} : « alterne » doit valoir true ou false.`);
      return {
        id: e.id, nom: texte(e.nom, 80), cible: texte(e.cible, 80), frequence: texte(e.frequence, 80) || (e.alterne ? 'Un jour sur deux' : 'Tous les jours'),
        alterne: e.alterne === true, facultatif: e.facultatif === true, consignes, dosage,
      };
    }).filter(Boolean);
    if (!exercices.some(e => !e.facultatif && e.dosage[0])) erreurs.push(`${ref} : au moins un exercice non facultatif doit être dosé dès la semaine 1.`);

    const c = ph.course ?? {};
    if (![true, false, 'si_douleur_ok'].includes(c.autorisee)) erreurs.push(`${ref} : « course.autorisee » vaut true, false ou "si_douleur_ok".`);
    const intensites = Array.isArray(c.intensites) ? c.intensites : [];
    const types = Array.isArray(c.types) ? c.types : [];
    if (intensites.some(x => !D.INTENSITES.some(y => y.id === x))) erreurs.push(`${ref} : intensité de course inconnue (${intensites.join(', ')}).`);
    if (types.some(x => !D.TYPES_SEANCE.some(y => y.id === x))) erreurs.push(`${ref} : type de course inconnu (${types.join(', ')}).`);
    if (c.autorisee !== false && (!intensites.length || !types.length)) erreurs.push(`${ref} : course autorisée sans « intensites » ni « types ».`);
    if (!entier(c.dureeMaxMin, 0, 240)) erreurs.push(`${ref} : « course.dureeMaxMin » doit être un entier de 0 à 240.`);

    const crBruts = Array.isArray(ph.criteres) ? ph.criteres : [];
    if (crBruts.length < 1 || crBruts.length > 6) erreurs.push(`${ref} : 1 à 6 critères de passage.`);
    const criteres = crBruts.slice(0, 6).map((cr, k) => {
      const refC = `${ref}, critère ${k + 1}`;
      if (!cr || typeof cr !== 'object') { erreurs.push(`${refC} : format invalide.`); return null; }
      const base = { id: ID.test(cr.id ?? '') ? cr.id : `critere_${k + 1}`, type: cr.type, libelle: texte(cr.libelle, 120) };
      if (!base.libelle) erreurs.push(`${refC} : « libelle » obligatoire.`);
      if (cr.type === 'duree') {
        if (!entier(cr.jours, 1, 140)) erreurs.push(`${refC} : « jours » entier de 1 à 140.`);
        return { ...base, jours: cr.jours };
      }
      if (cr.type === 'derniere') {
        if (!CHAMPS.includes(cr.champ)) erreurs.push(`${refC} : « champ » parmi ${CHAMPS.join(', ')}.`);
        if (!entier(cr.max, 0, 10) || !entier(cr.fenetre, 1, 28)) erreurs.push(`${refC} : « max » de 0 à 10 et « fenetre » de 1 à 28 jours.`);
        return { ...base, champ: cr.champ, max: cr.max, fenetre: cr.fenetre };
      }
      if (cr.type === 'raideur') {
        const okMax = typeof cr.maxMoyenne === 'number' && cr.maxMoyenne >= 0 && cr.maxMoyenne <= 10;
        const okBaisse = cr.baisse === null || cr.baisse === undefined || (typeof cr.baisse === 'number' && cr.baisse > 0 && cr.baisse <= 10);
        if (!okMax || !okBaisse) erreurs.push(`${refC} : « maxMoyenne » de 0 à 10 et « baisse » positive ou null.`);
        return { ...base, maxMoyenne: cr.maxMoyenne, baisse: cr.baisse ?? null };
      }
      if (cr.type === 'test') {
        if (!test) erreurs.push(`${refC} : un critère « test » exige l'objet « test » du programme.`);
        if (!entier(cr.nbMin, 1, 200) || !entier(cr.douleurMax, 0, 10) || !entier(cr.fenetre, 1, 28)) {
          erreurs.push(`${refC} : « nbMin » de 1 à 200, « douleurMax » de 0 à 10, « fenetre » de 1 à 28 jours.`);
        }
        return { ...base, nbMin: cr.nbMin, douleurMax: cr.douleurMax, fenetre: cr.fenetre };
      }
      erreurs.push(`${refC} : type « ${cr.type} » inconnu (duree, derniere, raideur ou test).`);
      return null;
    }).filter(Boolean);

    return {
      numero: i + 1,
      nom: texte(ph.nom, 60),
      dureeMinSem: ph.dureeMinSem,
      dureeMaxSem: ph.dureeMaxSem,
      but: texte(ph.but),
      exercices,
      course: { texte: texte(c.texte) || 'Voir les règles de la phase.', autorisee: c.autorisee, intensites, types, dureeMaxMin: c.dureeMaxMin },
      conseils: textes(ph.conseils, 6),
      criteres,
    };
  }).filter(Boolean);

  if (erreurs.length) return { programme: null, erreurs };
  return {
    erreurs,
    programme: {
      id: id ?? `perso_${D.uid().replace(/-/g, '').slice(0, 12)}`,
      source: 'ia',
      libelle,
      court: texte(brut.court, 40) || libelle.slice(0, 40),
      description: texte(brut.description, 800),
      regleDouleur: textes(brut.regleDouleur),
      aEviter: textes(brut.aEviter),
      consulter,
      avisMedical: texte(brut.avisMedical) || 'Ce programme a été proposé par une IA : faites-le valider par un médecin ou un kinésithérapeute.',
      entretien: texte(brut.entretien),
      test,
      phases,
      creeLe: maintenant,
    },
  };
}

// Texte à renvoyer à l'IA quand le programme collé est refusé.
export function promptCorrection(erreurs) {
  return `L'application a refusé ce programme pour ces raisons. Corrige-les toutes et redonne le programme complet, dans un seul bloc \`\`\`json :\n- ${erreurs.slice(0, 30).join('\n- ')}`;
}
