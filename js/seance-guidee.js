// Séance de soin guidée : lecture du dosage, enchaînement des étapes (tenues, répétitions au tempo, repos), annonces
// de la voix, position dans un tempo et chrono fondé sur l'horodatage. Règles pures (sans DOM), testées par tests/soin.test.js.

const RELACHE_S = 3; // relâchement entre deux tenues courtes (ex. « 3 × 10 fois 10 s »)
const TRANSITION_S = 15; // préparation avant l'exercice suivant

// Lit un dosage libre (« Sur les 2 pieds · 5 × 45 s », « 3 × 15 lourdes », « 3 × 10 fois 10 s », « 1 à 2 min »…).
// Renvoie { mode, series, reps, dureeS, tenueS, parCote } ; mode : tenue, reps, tenues (répétitions de tenues), duree ou libre.
export function analyserDosage(texte) {
  const t = String(texte ?? '').split('·').at(-1).toLowerCase().replace(/\s+/g, ' ').trim();
  const parCote = /par côté|de chaque côté|par jambe/.test(t);
  const fois = /(\d+)\s*(?:×|x(?=\s*\d))\s*(\d+)\s*fois\s*(\d+)\s*s\b/.exec(t);
  if (fois) return { mode: 'tenues', series: +fois[1], reps: +fois[2], tenueS: +fois[3], parCote };
  const tenue = /(\d+)\s*(?:×|x(?=\s*\d))\s*(\d+)\s*(s|min)\b/.exec(t);
  if (tenue) return { mode: 'tenue', series: +tenue[1], dureeS: +tenue[2] * (tenue[3] === 'min' ? 60 : 1), parCote };
  const reps = /(\d+)\s*(?:×|x(?=\s*\d))\s*(\d+)/.exec(t);
  if (reps) return { mode: 'reps', series: +reps[1], reps: +reps[2], parCote };
  const duree = /(\d+)(?:\s*à\s*(\d+))?\s*min\b/.exec(t);
  if (duree) return { mode: 'duree', series: 1, dureeS: +(duree[2] ?? duree[1]) * 60, parCote: false };
  return { mode: 'libre', series: 1, parCote: false };
}

// « 45 secondes », « 2 minutes », « 1 minute 30 ».
export function dureeParlee(s) {
  const m = Math.floor(s / 60);
  const r = s % 60;
  if (!m) return `${r} seconde${r > 1 ? 's' : ''}`;
  return `${m} minute${m > 1 ? 's' : ''}${r ? ` ${r}` : ''}`;
}

// Clé du repos réglable d'un exercice (préférences de la séance guidée) : l'exercice de la bibliothèque, sinon son id.
export const cleRepos = e => e.fiche ?? e.id;

// Repos entre deux séries (secondes) : réglage de l'utilisateur, sinon rythme de la fiche, sinon 60 s (120 s si « lourdes »).
export function reposDe(e, reglages = {}) {
  const r = reglages[cleRepos(e)];
  if (Number.isInteger(r) && r >= 0) return r;
  return e.seance?.recupS ?? (/lourd/i.test(e.dosage ?? '') ? 120 : 60);
}

const PREPA_DEBUT_S = 10; // préparation avant le premier exercice
const PREPA_COURTE_S = 5; // entre deux séries sans repos
const majuscule = t => (t ? t[0].toUpperCase() + t.slice(1) : t);

// Ce qu'annonce la voix au début d'une série : « Série 2 sur 5, contraction 30 secondes ».
function annonceSerie(e, a, seance, serie, cote) {
  const quoi = a.mode === 'tenue' || a.mode === 'duree'
    ? `${seance.motTenue ?? (seance.isometrique ? 'contraction' : 'tenue')} ${dureeParlee(a.dureeS)}`
    : a.mode === 'tenues' ? `${a.reps} fois ${dureeParlee(a.tenueS)}`
      : a.mode === 'reps' ? `${a.reps} répétitions${seance.tempo ? '' : ', à votre rythme'}` : e.dosage;
  const parties = [a.series > 1 ? `Série ${serie} sur ${a.series}` : null, cote, quoi].filter(Boolean);
  return majuscule(parties.join(', '));
}

// Liste des étapes de la séance. `exercices` : [{ id, nom, dosage, seance?, fiche? }] (dosage du jour, côté déjà remplacé ;
// `seance` = rythme complet, voir seanceDe de js/exercices.js). `repos` : repos choisis par l'utilisateur, par cleRepos.
// Étapes de travail : tenue, tempo, compteur, libre. Pauses minutées : prepa (avant le premier exercice, ou entre deux séries
// sans repos), recup (repos entre deux séries), transition (avant l'exercice suivant) ; chacune porte l'annonce de la série
// qui suit (`suivante`), dite par la voix avant le décompte 3-2-1.
export function etapesSeance(exercices, { repos = {} } = {}) {
  const etapes = [];
  const pause = (base, type, dureeS, libelle, annonce) => etapes.push({ ...base, type, dureeS, libelle, annonce });
  exercices.forEach((e, i) => {
    const a = analyserDosage(e.dosage);
    const seance = e.seance ?? {};
    const reposS = reposDe(e, repos);
    const libelleTenue = seance.libelleTenue ?? 'Tenez';
    const exercice = { id: e.id, fiche: e.fiche ?? null, nom: e.nom, dosage: e.dosage, index: i + 1, total: exercices.length, reposS };
    if (i === 0) pause({ exercice }, 'prepa', PREPA_DEBUT_S, 'Préparez-vous', 'Préparez-vous.');
    const cotes = a.parCote ? ['premier côté', 'second côté'] : [null];
    for (let serie = 1; serie <= a.series; serie++) {
      cotes.forEach((cote, k) => {
        const base = { exercice, serie, series: a.series, cote };
        const premiere = serie === 1 && k === 0;
        const annonce = `${premiere ? `${e.nom}. ` : ''}${annonceSerie(e, a, seance, serie, cote)}.`;
        if (a.mode === 'tenue' || a.mode === 'duree') {
          etapes.push({ ...base, type: 'tenue', dureeS: a.dureeS, libelle: libelleTenue, annonce });
        } else if (a.mode === 'tenues') {
          etapes.push({ ...base, type: 'tempo', reps: a.reps, phases: [[libelleTenue, a.tenueS], ['Relâchez', RELACHE_S]], annonce });
        } else if (a.mode === 'reps' && seance.tempo) {
          etapes.push({ ...base, type: 'tempo', reps: a.reps, phases: seance.tempo, annonce });
        } else if (a.mode === 'reps') {
          etapes.push({ ...base, type: 'compteur', reps: a.reps, annonce });
        } else {
          etapes.push({ ...base, type: 'libre', annonce: `${e.nom}. ${e.dosage}.` });
        }
        const derniere = serie === a.series && k === cotes.length - 1;
        if (derniere) return;
        if (reposS > 0) pause(base, 'recup', reposS, 'Repos', `Repos, ${dureeParlee(reposS)}.`);
        else pause(base, 'prepa', PREPA_COURTE_S, 'Préparez-vous', cote && k === 0 ? 'Changez de côté.' : '');
      });
    }
    const suivant = exercices[i + 1];
    if (suivant) {
      etapes.push({ exercice, type: 'transition', dureeS: TRANSITION_S, libelle: 'Préparez-vous', suivant: suivant.nom, annonce: 'Exercice terminé.' });
    }
  });
  // Chaque pause annonce la série qui la suit.
  etapes.forEach((x, k) => { if (PAUSES.has(x.type) && etapes[k + 1]) x.suivante = etapes[k + 1].annonce; });
  return etapes;
}

export const PAUSES = new Set(['prepa', 'recup', 'transition']);
// Étapes minutées (elles s'enchaînent seules) ; un tempo compté à la main (`manuel`) ne l'est pas.
export const estMinutee = (e, manuel = false) => PAUSES.has(e.type) || e.type === 'tenue' || (e.type === 'tempo' && !manuel);

const dureeCycle = phases => phases.reduce((s, [, d]) => s + d, 0);

// Durée estimée d'une étape (secondes) ; une répétition comptée à la main compte 3 s.
export function dureeEtape(etape) {
  if (etape.type === 'tempo') return etape.reps * dureeCycle(etape.phases);
  if (etape.type === 'compteur') return etape.reps * 3;
  if (etape.type === 'libre') return 120;
  return etape.dureeS;
}
export const dureeEstimee = etapes => etapes.reduce((s, e) => s + dureeEtape(e), 0);

// Chrono fondé sur l'horodatage : l'étape `i` a commencé à `debutMs`. Si l'onglet a été ralenti ou mis en arrière-plan,
// passe les étapes minutées déjà terminées (chacune commence exactement à la fin de la précédente) et s'arrête sur une étape
// non minutée. Renvoie { i, debutMs, fini } ; `fini` : la dernière étape est terminée.
export function rattraper(etapes, i, debutMs, maintenantMs) {
  let k = i;
  let debut = debutMs;
  while (k < etapes.length && estMinutee(etapes[k])) {
    const finMs = debut + dureeEtape(etapes[k]) * 1000;
    if (maintenantMs < finMs) break;
    debut = finMs;
    k++;
  }
  return { i: k, debutMs: debut, fini: k >= etapes.length };
}

// Où en est-on dans un tempo après `ecouleS` secondes ? { rep (1 à reps), phase, libelle, resteS, fini }.
export function positionTempo(phases, reps, ecouleS) {
  const cycle = dureeCycle(phases);
  if (ecouleS >= reps * cycle) return { rep: reps, phase: phases.length - 1, libelle: phases.at(-1)[0], resteS: 0, fini: true };
  const rep = Math.floor(ecouleS / cycle) + 1;
  let t = ecouleS - (rep - 1) * cycle;
  for (let i = 0; i < phases.length; i++) {
    if (t < phases[i][1]) return { rep, phase: i, libelle: phases[i][0], resteS: phases[i][1] - t, fini: false };
    t -= phases[i][1];
  }
  return { rep, phase: phases.length - 1, libelle: phases.at(-1)[0], resteS: 0, fini: false };
}
