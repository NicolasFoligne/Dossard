// Séance de soin guidée : lecture du dosage, enchaînement des étapes (tenues, répétitions au tempo, récupérations)
// et position dans un tempo. Règles pures (sans DOM), testées par tests/soin.test.js.

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

// Liste des étapes de la séance. `exercices` : [{ id, nom, dosage, seance? }] (dosage du jour, côté déjà remplacé).
export function etapesSeance(exercices) {
  const etapes = [];
  exercices.forEach((e, i) => {
    const a = analyserDosage(e.dosage);
    const seance = e.seance ?? {};
    const recupS = seance.recupS ?? (/lourd/i.test(e.dosage) ? 120 : 60);
    const libelleTenue = seance.libelleTenue ?? 'Tenez';
    const exercice = { id: e.id, nom: e.nom, dosage: e.dosage, index: i + 1, total: exercices.length };
    const cotes = a.parCote ? ['premier côté', 'second côté'] : [null];
    for (let serie = 1; serie <= a.series; serie++) {
      cotes.forEach((cote, k) => {
        const base = { exercice, serie, series: a.series, cote };
        const debut = `${e.nom}. ${a.series > 1 ? `Série ${serie} sur ${a.series}. ` : ''}${cote ? `${cote[0].toUpperCase()}${cote.slice(1)}. ` : ''}`;
        if (a.mode === 'tenue' || a.mode === 'duree') {
          etapes.push({ ...base, type: 'tenue', dureeS: a.dureeS, libelle: libelleTenue, annonce: `${debut}${libelleTenue} ${dureeParlee(a.dureeS)}.` });
        } else if (a.mode === 'tenues') {
          etapes.push({ ...base, type: 'tempo', reps: a.reps, phases: [[libelleTenue, a.tenueS], ['Relâchez', RELACHE_S]], annonce: `${debut}${a.reps} fois ${dureeParlee(a.tenueS)}.` });
        } else if (a.mode === 'reps' && seance.tempo) {
          etapes.push({ ...base, type: 'tempo', reps: a.reps, phases: seance.tempo, annonce: `${debut}${a.reps} répétitions.` });
        } else if (a.mode === 'reps') {
          etapes.push({ ...base, type: 'compteur', reps: a.reps, annonce: `${debut}${a.reps} répétitions, à votre rythme.` });
        } else {
          etapes.push({ ...base, type: 'libre', annonce: `${e.nom}. ${e.dosage}.` });
        }
        const derniere = serie === a.series && k === cotes.length - 1;
        if (!derniere && recupS > 0) {
          etapes.push({ ...base, type: 'recup', dureeS: recupS, libelle: 'Récupération', annonce: `Récupération, ${dureeParlee(recupS)}.` });
        }
      });
    }
    const suivant = exercices[i + 1];
    if (suivant) {
      etapes.push({ exercice, type: 'transition', dureeS: TRANSITION_S, libelle: 'Préparez-vous', suivant: suivant.nom, annonce: `Exercice suivant : ${suivant.nom}.` });
    }
  });
  return etapes;
}

const dureeCycle = phases => phases.reduce((s, [, d]) => s + d, 0);

// Durée estimée d'une étape (secondes) ; une répétition comptée à la main compte 3 s.
export function dureeEtape(etape) {
  if (etape.type === 'tempo') return etape.reps * dureeCycle(etape.phases);
  if (etape.type === 'compteur') return etape.reps * 3;
  if (etape.type === 'libre') return 120;
  return etape.dureeS;
}
export const dureeEstimee = etapes => etapes.reduce((s, e) => s + dureeEtape(e), 0);

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
