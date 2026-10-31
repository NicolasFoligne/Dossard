// Règles métier pures (sans DOM ni IndexedDB), testées par tests/regles.test.js.
import { ecartJours, lundiDe, joursDeLaSemaine, allureMinSec, nombre, DISCIPLINES_EN_METRES, heureVersMinutes } from './format.js';

export function uid() {
  if (globalThis.crypto?.randomUUID) return crypto.randomUUID();
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
}

// ---------------------------------------------------------------- Référentiels

// `allure` : min_km, min_100m, min_500m (allure) ou kmh (vitesse) ; null = ni distance ni allure.
// `famille` : velo (compte comme du vélo) ou complementaire (entraînement complémentaire, rattaché à tous les objectifs).
export const DISCIPLINES = [
  { id: 'course', libelle: 'Course à pied', court: 'Course', icone: '🏃', allure: 'min_km' },
  { id: 'velo', libelle: 'Vélo', court: 'Vélo', icone: '🚴', allure: 'kmh', famille: 'velo' },
  { id: 'natation', libelle: 'Natation', court: 'Natation', icone: '🏊', allure: 'min_100m' },
  { id: 'renforcement', libelle: 'Renforcement', court: 'Renfo', icone: '💪', allure: null, famille: 'complementaire' },
  { id: 'enchainement', libelle: 'Enchaînement vélo-course', court: 'Enchaînement', icone: '🔁', allure: 'kmh' },
  { id: 'home_trainer', libelle: 'Home trainer', court: 'Home trainer', icone: '🚲', allure: 'kmh', famille: 'velo' },
  { id: 'vtt', libelle: 'VTT', court: 'VTT', icone: '🚵', allure: 'kmh', famille: 'velo' },
  { id: 'elliptique', libelle: 'Elliptique', court: 'Elliptique', icone: '🌀', allure: 'kmh', famille: 'complementaire' },
  { id: 'rameur', libelle: 'Rameur', court: 'Rameur', icone: '🚣', allure: 'min_500m', famille: 'complementaire' },
  { id: 'marche', libelle: 'Marche / randonnée', court: 'Marche', icone: '🥾', allure: 'min_km', famille: 'complementaire' },
  { id: 'mobilite', libelle: 'Mobilité / yoga / étirements', court: 'Mobilité', icone: '🧘', allure: null, famille: 'complementaire' },
].map(d => ({ ...d, distance: d.allure === null ? null : DISCIPLINES_EN_METRES.has(d.id) ? 'm' : 'km' }));
export const discipline = id => DISCIPLINES.find(d => d.id === id) ?? { id, libelle: id, court: id, icone: '•', allure: null, distance: null };
const famille = f => DISCIPLINES.filter(d => d.famille === f).map(d => d.id);

export const TYPES_SEANCE = [
  { id: 'endurance', libelle: 'Endurance' },
  { id: 'fractionne', libelle: 'Fractionné' },
  { id: 'seuil', libelle: 'Seuil / tempo' },
  { id: 'sortie_longue', libelle: 'Sortie longue' },
  { id: 'technique', libelle: 'Technique' },
  { id: 'enchainement', libelle: 'Enchaînement' },
  { id: 'renforcement', libelle: 'Renforcement' },
  { id: 'recuperation', libelle: 'Récupération' },
  { id: 'competition', libelle: 'Compétition' },
  { id: 'autre', libelle: 'Autre' },
];

export const INTENSITES = [
  { id: 'facile', libelle: 'Facile (Z1-Z2)' },
  { id: 'moderee', libelle: 'Modérée (Z3)' },
  { id: 'soutenue', libelle: 'Soutenue (Z4)' },
  { id: 'tres_soutenue', libelle: 'Très soutenue (Z5)' },
];

export const STATUTS = [
  { id: 'a_demarrer', libelle: 'À démarrer' },
  { id: 'en_cours', libelle: 'En cours' },
  { id: 'termine', libelle: 'Terminé' },
];
export const libelleStatut = id => STATUTS.find(s => s.id === id)?.libelle ?? id;

export const ETATS_PREVUE = [
  { id: 'a_faire', libelle: 'À faire' },
  { id: 'faite', libelle: 'Faite' },
  { id: 'ratee', libelle: 'Ratée' },
];

export const NIVEAUX = ['Débutant', 'Intermédiaire', 'Confirmé', 'Expert'];

// Délais minimaux de préparation (semaines) : barème « standard » validé par l'utilisateur.
// Distances triathlon : formats FFTri (préremplis, modifiables dans chaque objectif).
export const TYPES_OBJECTIF = {
  course: [
    { id: '5km', libelle: '5 km', distanceKm: 5, minSemaines: 6 },
    { id: '10km', libelle: '10 km', distanceKm: 10, minSemaines: 8 },
    { id: 'semi', libelle: 'Semi-marathon', distanceKm: 21.0975, minSemaines: 10 },
    { id: 'marathon', libelle: 'Marathon', distanceKm: 42.195, minSemaines: 16 },
    { id: 'trail', libelle: 'Trail', distanceKm: null, minSemaines: null },
    { id: 'autre', libelle: 'Autre', distanceKm: null, minSemaines: 6 },
  ],
  triathlon: [
    { id: 'XS', libelle: 'XS', natationM: 400, veloKm: 10, courseKm: 2.5, minSemaines: 6 },
    { id: 'S', libelle: 'S', natationM: 750, veloKm: 20, courseKm: 5, minSemaines: 8 },
    { id: 'M', libelle: 'M', natationM: 1500, veloKm: 40, courseKm: 10, minSemaines: 12 },
    { id: 'L', libelle: 'L', natationM: 1900, veloKm: 90, courseKm: 21.1, minSemaines: 16 },
    { id: 'XL', libelle: 'XL', natationM: 4000, veloKm: 120, courseKm: 30, minSemaines: 20 },
    { id: 'XXL', libelle: 'XXL', natationM: 3800, veloKm: 180, courseKm: 42.195, minSemaines: 24 },
  ],
};

export const SPORTS = [
  { id: 'course', libelle: 'Course à pied' },
  { id: 'triathlon', libelle: 'Triathlon' },
];

export function typeObjectif(sport, type) {
  return TYPES_OBJECTIF[sport]?.find(t => t.id === type) ?? null;
}

export function libelleTypeObjectif(obj) {
  const t = typeObjectif(obj.sport, obj.type);
  if (!t) return obj.type;
  return obj.sport === 'triathlon' ? `Triathlon ${t.libelle}` : t.libelle;
}

// Distances préremplies pour un type donné (l'utilisateur peut ensuite les modifier).
export function distancesParDefaut(sport, type) {
  const t = typeObjectif(sport, type);
  if (!t) return {};
  if (sport === 'triathlon') return { natationM: t.natationM, veloKm: t.veloKm, courseKm: t.courseKm };
  return { distanceKm: t.distanceKm };
}

export function semainesMinimales(obj) {
  if (obj.sport === 'course' && obj.type === 'trail') {
    const d = obj.distanceKm ?? 0;
    if (d < 30) return 10;
    if (d < 60) return 16;
    return 20;
  }
  return typeObjectif(obj.sport, obj.type)?.minSemaines ?? 6;
}

// Disciplines qui alimentent un objectif (mutualisation) : l'entraînement complémentaire (renforcement, elliptique,
// rameur, marche, mobilité) compte pour tous ; home trainer et VTT comptent comme du vélo (triathlon).
export function disciplinesObjectif(obj) {
  if (obj.sport === 'triathlon') return ['course', ...famille('velo'), 'natation', 'enchainement', ...famille('complementaire')];
  return ['course', ...famille('complementaire')];
}

// Disciplines indispensables à la préparation (contrôle du semainier). Le vélo est couvert par toute la famille vélo.
export function disciplinesNecessaires(obj) {
  if (obj.sport === 'triathlon') return ['course', 'velo', 'natation'];
  return ['course'];
}
const couvertePar = d => (d === 'velo' ? famille('velo') : [d]);

// ---------------------------------------------------------------- Valeurs par défaut

export const JOURS = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'];

// Créneaux du semainier : plages horaires { debut, fin } en minutes depuis minuit, entre 5 h et 23 h, par pas de 15 min.
export const CRENEAU_MIN = 5 * 60;
export const CRENEAU_MAX = 23 * 60;
export const CRENEAU_PAS = 15;

export function semainierParDefaut() {
  return {
    jours: JOURS.map(() => ({ disponible: false, creneaux: [], dureeMaxMin: 0, disciplines: [] })),
    plafondSeances: 3,
  };
}

const sommeCreneaux = creneaux => creneaux.reduce((s, c) => s + (c.fin - c.debut), 0);

// Créneau proposé pour remplacer une ancienne « durée maximale » (semainiers d'avant les créneaux) :
// le soir à partir de 18 h si ça tient, sinon à partir de 8 h, sinon la journée entière.
export function creneauDepuisDuree(dureeMaxMin) {
  const d = Number(dureeMaxMin) > 0 ? Math.min(Math.round(dureeMaxMin / CRENEAU_PAS) * CRENEAU_PAS || CRENEAU_PAS, CRENEAU_MAX - CRENEAU_MIN) : null;
  if (d === null) return { debut: CRENEAU_MIN, fin: CRENEAU_MAX };
  const debut = 18 * 60 + d <= CRENEAU_MAX ? 18 * 60 : 8 * 60 + d <= CRENEAU_MAX ? 8 * 60 : CRENEAU_MIN;
  return { debut, fin: debut + d };
}

// Met un semainier (éventuellement ancien) au format courant : créneaux triés, `dureeMaxMin` = durée totale des créneaux.
export function normaliserSemainier(semainier) {
  const s = semainier ?? semainierParDefaut();
  return {
    ...s,
    jours: JOURS.map((_, i) => {
      const j = s.jours?.[i] ?? { disponible: false, disciplines: [] };
      const creneaux = Array.isArray(j.creneaux)
        ? j.creneaux.map(c => ({ debut: c.debut, fin: c.fin })).sort((a, b) => a.debut - b.debut)
        : j.disponible ? [creneauDepuisDuree(j.dureeMaxMin)] : [];
      return { disponible: !!j.disponible, creneaux, dureeMaxMin: sommeCreneaux(creneaux), disciplines: [...(j.disciplines ?? [])] };
    }),
  };
}

// Contrôle d'un jour du semainier : créneaux dans la plage, au pas de 15 min, d'au moins 15 min, sans chevauchement.
export function erreursCreneaux(creneaux) {
  const tries = [...creneaux].sort((a, b) => a.debut - b.debut);
  const erreurs = [];
  tries.forEach((c, i) => {
    if (!(Number.isInteger(c.debut) && Number.isInteger(c.fin) && c.debut >= CRENEAU_MIN && c.fin <= CRENEAU_MAX
      && c.debut % CRENEAU_PAS === 0 && c.fin % CRENEAU_PAS === 0 && c.fin - c.debut >= CRENEAU_PAS)) erreurs.push('créneau invalide');
    if (i > 0 && c.debut < tries[i - 1].fin) erreurs.push('créneaux qui se chevauchent');
  });
  return [...new Set(erreurs)];
}

export function profilParDefaut() {
  return {
    niveau: '',
    allureHabituelle: '', // texte libre, ex. « 5:30 /km »
    performances: '',
    blessures: '',
    materiel: { montreGps: false, velo: false, piscine: false },
    remarques: '',
  };
}

export function reglagesParDefaut() {
  return { modeleIa: 'claude-sonnet-5-5' };
}

// ---------------------------------------------------------------- Objectifs : cycle de vie

export class ErreurMetier extends Error {}

function exiger(condition, message) {
  if (!condition) throw new ErreurMetier(message);
}

function nettoyerObjectif(donnees) {
  const sport = donnees.sport;
  exiger(SPORTS.some(s => s.id === sport), 'Choisissez un sport.');
  exiger(typeObjectif(sport, donnees.type), "Choisissez un type d'objectif.");
  exiger(donnees.nom && donnees.nom.trim(), "Donnez un nom à l'objectif.");
  exiger(/^\d{4}-\d{2}-\d{2}$/.test(donnees.dateEpreuve ?? ''), "La date de l'épreuve est obligatoire.");
  const o = {
    nom: donnees.nom.trim(),
    sport,
    type: donnees.type,
    dateEpreuve: donnees.dateEpreuve,
    deniveleM: positifOuNull(donnees.deniveleM),
    tempsViseS: positifOuNull(donnees.tempsViseS),
  };
  if (sport === 'triathlon') {
    o.natationM = positifOuNull(donnees.natationM);
    o.veloKm = positifOuNull(donnees.veloKm);
    o.courseKm = positifOuNull(donnees.courseKm);
  } else {
    o.distanceKm = positifOuNull(donnees.distanceKm);
  }
  return o;
}

function positifOuNull(v) {
  const n = typeof v === 'string' ? Number(v.replace(',', '.')) : v;
  return Number.isFinite(n) && n > 0 ? n : null;
}

export function creerObjectif(donnees, maintenant = Date.now()) {
  return {
    id: uid(),
    ...nettoyerObjectif(donnees),
    statut: 'a_demarrer',
    dateDemarrage: null,
    resultat: null,
    creeLe: maintenant,
    modifieLe: maintenant,
  };
}

// La modification ne touche jamais au statut ni aux dates du cycle de vie.
export function modifierObjectif(obj, donnees, maintenant = Date.now()) {
  return { ...obj, ...nettoyerObjectif({ ...obj, ...donnees }), modifieLe: maintenant };
}

export function demarrerObjectif(obj, aujourdhui, maintenant = Date.now()) {
  exiger(obj.statut === 'a_demarrer', 'Seul un objectif « À démarrer » peut être démarré.');
  return { ...obj, statut: 'en_cours', dateDemarrage: aujourdhui, modifieLe: maintenant };
}

export function terminerObjectif(obj, resultat, aujourdhui, maintenant = Date.now()) {
  exiger(obj.statut === 'en_cours', 'Seul un objectif « En cours » peut être terminé.');
  const ressenti = resultat?.ressenti == null || resultat.ressenti === '' ? null : Number(resultat.ressenti);
  exiger(ressenti === null || (Number.isInteger(ressenti) && ressenti >= 1 && ressenti <= 5), 'Le ressenti va de 1 à 5.');
  return {
    ...obj,
    statut: 'termine',
    resultat: {
      tempsS: positifOuNull(resultat?.tempsS),
      classement: (resultat?.classement ?? '').toString().trim() || null,
      ressenti,
      commentaire: (resultat?.commentaire ?? '').trim(),
      dateSaisie: aujourdhui,
    },
    modifieLe: maintenant,
  };
}

// ---------------------------------------------------------------- Séances

function nettoyerSeanceBase(donnees) {
  exiger(/^\d{4}-\d{2}-\d{2}$/.test(donnees.date ?? ''), 'La date est obligatoire.');
  exiger(DISCIPLINES.some(d => d.id === donnees.discipline), 'Choisissez une discipline.');
  return {
    date: donnees.date,
    discipline: donnees.discipline,
    dureeS: positifOuNull(donnees.dureeS),
    distanceKm: positifOuNull(donnees.distanceKm),
  };
}

export function creerPrevue(donnees, maintenant = Date.now()) {
  const base = nettoyerSeanceBase(donnees);
  exiger(base.dureeS || base.distanceKm, 'Indiquez une durée et/ou une distance.');
  const heure = donnees.heureDebut ? heureVersMinutes(donnees.heureDebut) : null;
  exiger(!donnees.heureDebut || heure !== null, 'Heure de début invalide.');
  return {
    id: donnees.id ?? uid(),
    ...base,
    heureDebut: heure === null ? null : donnees.heureDebut, // « HH:MM » facultative (séances IA : toujours renseignée)
    type: donnees.type || 'endurance',
    intensite: donnees.intensite || 'facile',
    description: {
      echauffement: (donnees.description?.echauffement ?? '').trim(),
      corps: (donnees.description?.corps ?? '').trim(),
      retourCalme: (donnees.description?.retourCalme ?? '').trim(),
    },
    objectifIds: [...new Set(donnees.objectifIds ?? [])],
    etat: ETATS_PREVUE.some(e => e.id === donnees.etat) ? donnees.etat : 'a_faire',
    source: donnees.source ?? 'manuel',
    creeLe: donnees.creeLe ?? maintenant,
    modifieLe: maintenant,
  };
}

// Mutualisation : ids des objectifs « En cours » qui incluent la discipline.
export function objectifsRattachables(disciplineId, objectifs) {
  return objectifs
    .filter(o => o.statut === 'en_cours' && disciplinesObjectif(o).includes(disciplineId))
    .map(o => o.id);
}

// Crée (ou met à jour, si `ancienne` est fournie) une séance réalisée.
// Les rattachements sont calculés automatiquement ; lors d'une modification on
// conserve les liens vers les objectifs déjà terminés (historique), s'ils restent compatibles.
export function enregistrerRealisee(donnees, objectifs, ancienne = null, maintenant = Date.now()) {
  const base = nettoyerSeanceBase(donnees);
  exiger(base.dureeS, 'La durée est obligatoire.');
  const ressenti = donnees.ressenti == null || donnees.ressenti === '' ? null : Number(donnees.ressenti);
  exiger(ressenti === null || (Number.isInteger(ressenti) && ressenti >= 1 && ressenti <= 5), 'Le ressenti va de 1 à 5.');
  const enCours = objectifsRattachables(base.discipline, objectifs);
  const conserves = (ancienne?.objectifIds ?? []).filter(id => {
    const o = objectifs.find(x => x.id === id);
    return o && o.statut !== 'en_cours' && disciplinesObjectif(o).includes(base.discipline);
  });
  return {
    id: ancienne?.id ?? uid(),
    ...base,
    ressenti,
    notes: (donnees.notes ?? '').trim(),
    prevueId: donnees.prevueId || null,
    objectifIds: [...new Set([...conserves, ...enCours])],
    creeLe: ancienne?.creeLe ?? maintenant,
    modifieLe: maintenant,
  };
}

// Brouillon de séance réalisée prérempli depuis une séance prévue.
export function brouillonDepuisPrevue(prevue, date) {
  return {
    date: date ?? prevue.date,
    discipline: prevue.discipline,
    dureeS: prevue.dureeS,
    distanceKm: prevue.distanceKm,
    prevueId: prevue.id,
    ressenti: null,
    notes: '',
  };
}

export function prevuesAFaire(prevues, date) {
  return prevues.filter(p => p.date === date && p.etat === 'a_faire');
}

export function prochaineSeance(prevues, aujourdhui) {
  return prevues
    .filter(p => p.etat === 'a_faire' && p.date >= aujourdhui)
    .sort((a, b) => a.date.localeCompare(b.date) || a.creeLe - b.creeLe)[0] ?? null;
}

// Allure ou vitesse selon la discipline. Renvoie null si non calculable.
export function allure(seance) {
  const { dureeS, distanceKm } = seance;
  const mode = discipline(seance.discipline).allure;
  if (!dureeS || !distanceKm || !mode) return null;
  if (mode === 'min_km') {
    return { valeur: dureeS / distanceKm, unite: 's/km', texte: `${allureMinSec(dureeS / distanceKm)} /km` };
  }
  if (mode === 'min_100m') {
    const parCent = dureeS / (distanceKm * 10);
    return { valeur: parCent, unite: 's/100m', texte: `${allureMinSec(parCent)} /100 m` };
  }
  if (mode === 'min_500m') {
    const par500 = dureeS / (distanceKm * 2);
    return { valeur: par500, unite: 's/500m', texte: `${allureMinSec(par500)} /500 m` };
  }
  const kmh = distanceKm / (dureeS / 3600);
  return { valeur: kmh, unite: 'km/h', texte: `${nombre(kmh)} km/h` };
}
export const estVitesse = a => a?.unite === 'km/h';

// ---------------------------------------------------------------- Agrégats

export function avancement(obj, realisees, aujourdhui) {
  const debut = obj.dateDemarrage ?? aujourdhui;
  const total = Math.max(1, ecartJours(debut, obj.dateEpreuve));
  const ecoule = Math.min(total, Math.max(0, ecartJours(debut, aujourdhui)));
  const liees = realisees.filter(r => r.objectifIds?.includes(obj.id));
  const parDiscipline = {};
  for (const r of liees) {
    const p = (parDiscipline[r.discipline] ??= { nb: 0, dureeS: 0, distanceKm: 0 });
    p.nb++;
    p.dureeS += r.dureeS ?? 0;
    p.distanceKm += r.distanceKm ?? 0;
  }
  const joursRestants = ecartJours(aujourdhui, obj.dateEpreuve);
  return {
    pctTemps: Math.round((ecoule / total) * 100),
    joursRestants,
    semainesRestantes: Math.max(0, Math.ceil(joursRestants / 7)),
    nbSeances: liees.length,
    dureeS: liees.reduce((s, r) => s + (r.dureeS ?? 0), 0),
    parDiscipline,
  };
}

export function semaine(lundi, prevues, realisees) {
  const jours = joursDeLaSemaine(lundi).map(date => ({
    date,
    prevues: prevues.filter(p => p.date === date),
    realisees: realisees.filter(r => r.date === date),
  }));
  const p = jours.flatMap(j => j.prevues);
  const r = jours.flatMap(j => j.realisees);
  return {
    lundi,
    jours,
    prevu: { nb: p.length, dureeS: p.reduce((s, x) => s + (x.dureeS ?? 0), 0) },
    realise: { nb: r.length, dureeS: r.reduce((s, x) => s + (x.dureeS ?? 0), 0) },
  };
}

export function filtrerRealisees(realisees, { discipline = '', objectifId = '' } = {}) {
  return realisees.filter(r =>
    (!discipline || r.discipline === discipline) && (!objectifId || r.objectifIds?.includes(objectifId)));
}

// Totaux par semaine (du lundi), semaines les plus récentes d'abord.
export function totauxParSemaine(realisees) {
  const semaines = new Map();
  for (const r of realisees) {
    const l = lundiDe(r.date);
    if (!semaines.has(l)) semaines.set(l, { lundi: l, nb: 0, dureeS: 0, parDiscipline: {}, seances: [] });
    const s = semaines.get(l);
    s.nb++;
    s.dureeS += r.dureeS ?? 0;
    s.seances.push(r);
    const d = (s.parDiscipline[r.discipline] ??= { nb: 0, dureeS: 0, distanceKm: 0 });
    d.nb++;
    d.dureeS += r.dureeS ?? 0;
    d.distanceKm += r.distanceKm ?? 0;
  }
  const liste = [...semaines.values()].sort((a, b) => b.lundi.localeCompare(a.lundi));
  for (const s of liste) s.seances.sort((a, b) => b.date.localeCompare(a.date) || b.creeLe - a.creeLe);
  return liste;
}

// ---------------------------------------------------------------- Alertes

export function alertes({ objectifs, semainier, aujourdhui, derniereSauvegarde = null, premiereUtilisation = null, aDesDonnees = false }) {
  const liste = [];
  const ouverts = objectifs.filter(o => o.statut !== 'termine');

  for (const o of ouverts) {
    if (o.dateEpreuve < aujourdhui) {
      liste.push({
        code: 'epreuve_passee', niveau: 'danger', objectifId: o.id,
        message: `L'épreuve « ${o.nom} » est passée : terminez l'objectif et saisissez votre résultat.`,
      });
      continue;
    }
    const depart = o.statut === 'en_cours' && o.dateDemarrage ? o.dateDemarrage : aujourdhui;
    const semaines = ecartJours(depart, o.dateEpreuve) / 7;
    const mini = semainesMinimales(o);
    if (semaines < mini) {
      liste.push({
        code: 'delai_court', niveau: 'attention', objectifId: o.id,
        message: `Délai court pour « ${o.nom} » : ${nombre(semaines)} semaine${semaines >= 2 ? 's' : ''} de préparation, `
          + `alors qu'un objectif ${libelleTypeObjectif(o)} en demande au moins ${mini}.`,
      });
    }
  }

  if (semainier) {
    const dispo = semainier.jours.filter(j => j.disponible);
    const plafond = Number(semainier.plafondSeances) || 0;
    if (plafond > 0 && dispo.length < plafond) {
      liste.push({
        code: 'semainier_jours', niveau: 'attention',
        message: `Semainier insuffisant : ${dispo.length} jour${dispo.length > 1 ? 's' : ''} disponible${dispo.length > 1 ? 's' : ''} `
          + `pour un plafond de ${plafond} séances par semaine.`,
      });
    }
    const possibles = new Set(dispo.flatMap(j => j.disciplines));
    for (const o of objectifs.filter(x => x.statut === 'en_cours')) {
      const manquantes = disciplinesNecessaires(o).filter(d => !couvertePar(d).some(x => possibles.has(x)));
      if (manquantes.length) {
        liste.push({
          code: 'semainier_disciplines', niveau: 'attention', objectifId: o.id,
          message: `Semainier insuffisant pour « ${o.nom} » : aucun jour disponible pour `
            + manquantes.map(d => discipline(d).libelle.toLowerCase()).join(', ') + '.',
        });
      }
    }
  }

  if (aDesDonnees) {
    const reference = derniereSauvegarde ?? premiereUtilisation;
    if (reference && ecartJours(reference, aujourdhui) >= 30) {
      liste.push({
        code: 'sauvegarde', niveau: 'info',
        message: derniereSauvegarde
          ? `Aucune sauvegarde depuis ${ecartJours(reference, aujourdhui)} jours : pensez à exporter vos données.`
          : "Vous n'avez encore jamais exporté vos données : pensez à faire une sauvegarde.",
      });
    }
  }
  return liste;
}
