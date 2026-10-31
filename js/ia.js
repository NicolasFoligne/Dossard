// Génération du plan par l'IA — partie pure (sans réseau ni DOM), testée par tests/ia.test.js :
// contexte envoyé, prompt, schéma JSON de la réponse, validation stricte, remplacement des séances.
import * as D from './domaine.js';
import * as S from './soin.js';
import { ajouterJours, ecartJours, lundiDe, minutesVersHeure, heureVersMinutes } from './format.js';

const SEMAINES_HISTORIQUE = 8;

// ------------------------------------------------------------ Schéma de la réponse

const SEANCE = {
  type: 'object',
  additionalProperties: false,
  required: ['date', 'heureDebut', 'discipline', 'type', 'intensite', 'dureeMin', 'distanceKm', 'echauffement', 'corps', 'retourCalme', 'objectifIds'],
  properties: {
    date: { type: 'string', format: 'date', description: 'AAAA-MM-JJ, une des dates du calendrier' },
    discipline: { type: 'string', enum: D.DISCIPLINES.map(d => d.id) },
    type: { type: 'string', enum: D.TYPES_SEANCE.map(t => t.id) },
    intensite: { type: 'string', enum: D.INTENSITES.map(i => i.id) },
    heureDebut: { type: 'string', description: 'HH:MM : la séance tient entièrement dans un des créneaux du jour' },
    dureeMin: { type: 'integer', description: 'Durée totale en minutes' },
    distanceKm: { type: ['number', 'null'], description: 'Distance en km (natation et rameur : 1.5 pour 1 500 m), null si sans objet' },
    echauffement: { type: 'string' },
    corps: { type: 'string' },
    retourCalme: { type: 'string' },
    objectifIds: { type: 'array', items: { type: 'string' } },
  },
};

export const SCHEMA_PLAN = {
  type: 'object',
  additionalProperties: false,
  required: ['analyse', 'phases', 'seances'],
  properties: {
    analyse: { type: 'string', description: 'Analyse du niveau réel, réalisme des temps visés, points de vigilance' },
    phases: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['nom', 'debut', 'fin', 'description'],
        properties: {
          nom: { type: 'string', enum: ['foncière', 'spécifique', 'affûtage', 'récupération'] },
          debut: { type: 'string', format: 'date' },
          fin: { type: 'string', format: 'date' },
          description: { type: 'string' },
        },
      },
    },
    seances: { type: 'array', items: SEANCE },
  },
};

// ------------------------------------------------------------ Contexte envoyé

const enMinutes = s => (s ? Math.round(s / 60) : null);

// Séances futures conservées par un recalcul : tout sauf les séances IA « à faire ».
export const estRemplacable = (p, aujourdhui) => p.source === 'ia' && p.etat === 'a_faire' && p.date >= aujourdhui;

// Retire l'intervalle [a, b[ d'une liste de créneaux (en minutes) ; ne garde que les morceaux d'au moins 15 min.
function soustraire(creneaux, a, b) {
  return creneaux.flatMap(c => (b <= c.debut || a >= c.fin ? [c] : [{ debut: c.debut, fin: a }, { debut: b, fin: c.fin }]))
    .filter(c => c.fin - c.debut >= D.CRENEAU_PAS);
}

// Rassemble tout ce qui est envoyé à l'IA et sert ensuite à valider sa réponse.
// `minutesActuelles` (heure courante, en minutes) : les créneaux du jour déjà passés sont retirés.
export function construireContexte(etat, aujourdhui, { minutesActuelles = null } = {}) {
  const semainier = D.normaliserSemainier(etat.semainier);
  const objectifs = etat.objectifs.filter(o => o.statut === 'en_cours');
  if (!objectifs.length) throw new D.ErreurMetier('Aucun objectif en cours : démarrez un objectif pour générer un plan.');
  const fin = objectifs.map(o => o.dateEpreuve).sort().at(-1);
  if (fin <= aujourdhui) throw new D.ErreurMetier('Aucune épreuve à venir parmi les objectifs en cours : terminez les objectifs dont l\'épreuve est passée.');
  const epreuves = new Set(objectifs.map(o => o.dateEpreuve));

  const conservees = etat.prevues
    .filter(p => p.date >= aujourdhui && !estRemplacable(p, aujourdhui) && p.etat === 'a_faire')
    .sort((a, b) => a.date.localeCompare(b.date));
  const debutHistorique = ajouterJours(lundiDe(aujourdhui), -7 * SEMAINES_HISTORIQUE);
  const realisees = etat.realisees
    .filter(r => r.date >= debutHistorique && r.date <= aujourdhui)
    .sort((a, b) => a.date.localeCompare(b.date));

  // Calendrier des créneaux autorisés, semaine par semaine, déduction faite de ce qui est déjà prévu ou réalisé.
  const semaines = [];
  const plafond = Number(semainier.plafondSeances) || 0;
  for (let lundi = lundiDe(aujourdhui); lundi < fin; lundi = ajouterJours(lundi, 7)) {
    const dimanche = ajouterJours(lundi, 6);
    const dansSemaine = x => x.date >= lundi && x.date <= dimanche;
    const dejaCompte = conservees.filter(dansSemaine).length + realisees.filter(dansSemaine).length;
    const jours = [];
    for (let i = 0; i < 7; i++) {
      const date = ajouterJours(lundi, i);
      if (date < aujourdhui || date >= fin || epreuves.has(date)) continue;
      const j = semainier.jours[i];
      if (!j.disponible || !j.disciplines.length || !j.creneaux.length) continue;
      let creneaux = j.creneaux;
      // Aujourd'hui : on ne propose que ce qui reste de la journée (au quart d'heure suivant).
      if (date === aujourdhui && minutesActuelles !== null) {
        creneaux = soustraire(creneaux, 0, Math.ceil(minutesActuelles / D.CRENEAU_PAS) * D.CRENEAU_PAS);
      }
      // Séances déjà prévues ce jour-là : celles qui ont une heure libèrent leur intervalle, les autres réduisent la durée disponible.
      let sansHeure = 0;
      for (const x of [...conservees, ...realisees].filter(y => y.date === date)) {
        const h = heureVersMinutes(x.heureDebut);
        if (h !== null && x.dureeS) creneaux = soustraire(creneaux, h, h + enMinutes(x.dureeS));
        else sansHeure += enMinutes(x.dureeS) ?? 0;
      }
      const dureeMaxMin = creneaux.reduce((s, c) => s + c.fin - c.debut, 0) - sansHeure;
      if (!creneaux.length || dureeMaxMin <= 0) continue;
      jours.push({
        date, jour: D.JOURS[i],
        creneaux: creneaux.map(c => ({ debut: minutesVersHeure(c.debut), fin: minutesVersHeure(c.fin) })),
        dureeMaxMin, disciplines: [...j.disciplines],
      });
    }
    semaines.push({ lundi, plafondRestant: plafond ? Math.max(0, plafond - dejaCompte) : null, jours });
  }

  const volumes = new Map();
  for (const r of realisees) {
    const l = lundiDe(r.date);
    volumes.set(l, (volumes.get(l) ?? 0) + (enMinutes(r.dureeS) ?? 0));
  }

  return {
    aujourdhui,
    debut: aujourdhui,
    fin,
    profil: etat.profil,
    plafondSeances: plafond || null,
    semainier: semainier.jours.map((j, i) => ({
      jour: D.JOURS[i], disponible: j.disponible, disciplines: j.disciplines,
      creneaux: j.creneaux.map(c => `${minutesVersHeure(c.debut)}-${minutesVersHeure(c.fin)}`),
    })),
    objectifs: objectifs.map(o => ({
      id: o.id,
      nom: o.nom,
      sport: o.sport,
      type: D.libelleTypeObjectif(o),
      ...(o.sport === 'triathlon'
        ? { natationM: o.natationM, veloKm: o.veloKm, courseKm: o.courseKm }
        : { distanceKm: o.distanceKm }),
      deniveleM: o.deniveleM,
      dateEpreuve: o.dateEpreuve,
      dateDemarrage: o.dateDemarrage,
      tempsVise: o.tempsViseS ? chronoTexte(o.tempsViseS) : null,
      semainesAvantEpreuve: Math.round(ecartJours(aujourdhui, o.dateEpreuve) / 7),
      disciplines: D.disciplinesObjectif(o),
    })),
    realisees: realisees.map(r => ({
      date: r.date,
      discipline: r.discipline,
      dureeMin: enMinutes(r.dureeS),
      distanceKm: r.distanceKm,
      allure: D.allure(r)?.texte ?? null,
      ressenti: r.ressenti,
      notes: r.notes || undefined,
    })),
    volumesHebdoMin: [...volumes].sort().map(([lundi, minutes]) => ({ lundi, minutes })),
    seancesConservees: conservees.map(p => ({
      date: p.date, heureDebut: p.heureDebut ?? null, discipline: p.discipline, type: p.type, dureeMin: enMinutes(p.dureeS), distanceKm: p.distanceKm,
    })),
    calendrier: semaines,
    ...blessuresContexte(etat, aujourdhui),
  };
}

// Suivis de blessure en cours : phase, projection des phases et règles de course (contraintes validées).
function blessuresContexte(etat, aujourdhui) {
  const blessures = S.contexteIa(etat.blessures ?? [], etat.bilans ?? [], aujourdhui);
  return blessures.length ? { blessures } : {};
}

function chronoTexte(s) {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = s % 60;
  return `${h}:${String(m).padStart(2, '0')}:${String(r).padStart(2, '0')}`;
}

// ------------------------------------------------------------ Prompt

const SYSTEME = `Tu es un entraîneur expert en course à pied et en triathlon. Tu construis UN plan d'entraînement unique et mutualisé couvrant tous les objectifs en cours de l'athlète.

Contraintes impératives (une réponse qui ne les respecte pas est rejetée automatiquement) :
1. Une séance ne peut être placée qu'à une date figurant dans « calendrier », avec une discipline listée pour ce jour.
2. Chaque séance a une « heureDebut » (HH:MM) et tient entièrement dans l'un des « creneaux » de son jour (de « debut » à « fin ») ; deux séances d'un même jour ne se chevauchent pas ; la somme des durées d'un jour ne dépasse jamais « dureeMaxMin ».
3. Le nombre de séances d'une semaine ne dépasse jamais « plafondRestant » de cette semaine (null = pas de limite).
4. Aucune séance avant « debut », à partir de « fin », ni le jour d'une épreuve.
5. Les « seancesConservees » sont maintenues telles quelles : n'en crée pas de doublon et intègre-les dans la charge.
6. Si « blessures » est présent, chaque séance de course ou d'enchaînement respecte la fenêtre de « projection » qui contient sa date : aucune course si « courseAutorisee » est false ; sinon uniquement les « intensites » et « types » listés, et pas plus de « dureeMaxMin » minutes de course. Aucune course ni enchaînement jusqu'à « courseInterditeJusquau » inclus.

Principes de coaching à appliquer :
- progression du volume hebdomadaire limitée à environ 10 % d'une semaine à l'autre, en partant du volume récent réel (« volumesHebdoMin ») ;
- environ 80 % du volume en intensité facile ;
- une semaine allégée toutes les 3 à 4 semaines ;
- phases foncière, puis spécifique, puis affûtage, avec un affûtage adapté à la distance de chaque épreuve ;
- renforcement musculaire régulier ; les disciplines complémentaires (home trainer, VTT, elliptique, rameur, marche, mobilité) ne sont utilisées que les jours où elles sont listées ;
- enchaînements vélo-course réguliers pour le triathlon, surtout en phase spécifique ;
- prise en compte des antécédents de blessures du profil ;
- en cas de suivi de blessure (« blessures ») : l'athlète fait ses exercices de soin à part, ne les planifie pas ; les séances de renforcement du plan ne chargent pas la zone blessée (pas de sauts, de pliométrie ni de montées sur pointe) ; maintiens l'endurance par le vélo (ou home trainer), la natation, l'elliptique ou le rameur quand la course est limitée ; après la projection, reprise de course très progressive ; explique dans l'analyse l'effet de la blessure sur la préparation ;
- temps visés confrontés au niveau réel (performances, allures récentes) : dis franchement s'ils sont irréalistes et propose une cible crédible dans l'analyse.

Rédaction : en français, concis. Pour chaque séance, échauffement, corps de séance et retour au calme tiennent en une ou deux phrases précises (allures, zones, répétitions, récupérations). « dureeMin » est un entier en minutes. « distanceKm » est en kilomètres (natation et rameur : 1.5 pour 1 500 m) ou null pour le renforcement et la mobilité. « objectifIds » liste les identifiants des objectifs servis par la séance. « analyse » fait au plus 10 phrases.

Réponds uniquement par un objet JSON conforme à ce schéma, sans texte autour :
${JSON.stringify(SCHEMA_PLAN)}`;

// `erreurs` : motifs de rejet d'une tentative précédente, renvoyés au modèle pour correction.
export function construirePrompt(contexte, erreurs = null) {
  let utilisateur = `Date du jour : ${contexte.aujourdhui}.
Construis le plan du ${contexte.debut} au ${ajouterJours(contexte.fin, -1)} inclus, pour les objectifs en cours ci-dessous.

Données de l'athlète (JSON) :
${JSON.stringify(contexte)}`;
  if (erreurs?.length) {
    utilisateur += `\n\nATTENTION : ta proposition précédente a été rejetée pour ces raisons. Corrige-les toutes :\n- ${erreurs.slice(0, 40).join('\n- ')}`;
  }
  return { systeme: SYSTEME, utilisateur };
}

// Texte complet pour le mode secours (à coller dans une conversation Claude).
export function promptACopier(contexte) {
  const { systeme, utilisateur } = construirePrompt(contexte);
  return `${systeme}\n\n---\n\n${utilisateur}`;
}

// ------------------------------------------------------------ Lecture et validation de la réponse

// Extrait l'objet JSON d'une réponse (tolère un bloc ```json … ``` ou du texte autour).
export function extraireJson(texte) {
  const t = (texte ?? '').trim();
  const bloc = t.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidat = bloc ? bloc[1] : t.slice(t.indexOf('{'), t.lastIndexOf('}') + 1);
  try {
    return JSON.parse(candidat);
  } catch {
    throw new D.ErreurMetier('La réponse ne contient pas de JSON valide.');
  }
}

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const texteSur = v => (typeof v === 'string' ? v.trim() : '');

// Valide la réponse contre le schéma ET les contraintes du semainier.
// Renvoie { plan, erreurs } : `plan` normalisé (séances au format de l'application) si erreurs est vide.
export function validerPlan(brut, contexte) {
  const erreurs = [];
  if (!brut || typeof brut !== 'object' || !Array.isArray(brut.seances)) {
    return { plan: null, erreurs: ['La réponse doit être un objet avec une liste « seances ».'] };
  }
  if (!brut.seances.length) erreurs.push('Le plan ne contient aucune séance.');

  const jours = new Map(contexte.calendrier.flatMap(s => s.jours.map(j => [j.date, { ...j, lundi: s.lundi }])));
  const plafonds = new Map(contexte.calendrier.map(s => [s.lundi, s.plafondRestant]));
  const idsEnCours = contexte.objectifs.map(o => o.id);
  const objectifsParId = new Map(contexte.objectifs.map(o => [o.id, o]));
  const dureeParJour = new Map();
  const nbParSemaine = new Map();
  const horairesParJour = new Map(); // date → [{ debut, fin, ref }] pour détecter les chevauchements
  const seances = [];

  brut.seances.forEach((s, i) => {
    const ref = `Séance ${i + 1}${s?.date ? ` (${s.date})` : ''}`;
    if (!s || typeof s !== 'object') { erreurs.push(`${ref} : format invalide.`); return; }
    const date = texteSur(s.date);
    if (!DATE.test(date)) { erreurs.push(`${ref} : date invalide.`); return; }
    const jour = jours.get(date);
    if (!jour) {
      erreurs.push(`${ref} : ${date} n'est pas une date disponible du calendrier (jour indisponible, épreuve, hors période ou déjà complet).`);
      return;
    }
    if (!D.DISCIPLINES.some(d => d.id === s.discipline)) erreurs.push(`${ref} : discipline inconnue « ${s.discipline} ».`);
    else if (!jour.disciplines.includes(s.discipline)) {
      erreurs.push(`${ref} : la discipline « ${s.discipline} » n'est pas possible le ${jour.jour.toLowerCase()} ${date} (possibles : ${jour.disciplines.join(', ')}).`);
    }
    if (!D.TYPES_SEANCE.some(t => t.id === s.type)) erreurs.push(`${ref} : type inconnu « ${s.type} ».`);
    if (!D.INTENSITES.some(t => t.id === s.intensite)) erreurs.push(`${ref} : intensité inconnue « ${s.intensite} ».`);
    if (!Number.isInteger(s.dureeMin) || s.dureeMin <= 0) erreurs.push(`${ref} : « dureeMin » doit être un entier positif.`);
    const heure = heureVersMinutes(texteSur(s.heureDebut));
    if (heure === null) erreurs.push(`${ref} : « heureDebut » doit être une heure au format HH:MM.`);
    else if (Number.isInteger(s.dureeMin) && s.dureeMin > 0) {
      const fin = heure + s.dureeMin;
      const dedans = jour.creneaux.some(c => heureVersMinutes(c.debut) <= heure && fin <= heureVersMinutes(c.fin));
      if (!dedans) {
        erreurs.push(`${ref} : ${s.heureDebut} + ${s.dureeMin} min ne tient dans aucun créneau du ${jour.jour.toLowerCase()} ${date} `
          + `(créneaux : ${jour.creneaux.map(c => `${c.debut}-${c.fin}`).join(', ')}).`);
      }
      if (!horairesParJour.has(date)) horairesParJour.set(date, []);
      horairesParJour.get(date).push({ debut: heure, fin, ref });
    }
    if (s.distanceKm !== null && s.distanceKm !== undefined && !(typeof s.distanceKm === 'number' && s.distanceKm >= 0)) {
      erreurs.push(`${ref} : « distanceKm » doit être un nombre positif ou null.`);
    }
    for (const motif of S.erreursSeanceSoin({ date, discipline: s.discipline, type: s.type, intensite: s.intensite, dureeMin: s.dureeMin }, contexte.blessures)) {
      erreurs.push(`${ref} : ${motif}`);
    }
    dureeParJour.set(date, (dureeParJour.get(date) ?? 0) + (Number(s.dureeMin) || 0));
    nbParSemaine.set(jour.lundi, (nbParSemaine.get(jour.lundi) ?? 0) + 1);

    // Rattachement : seuls les objectifs en cours qui incluent la discipline ; à défaut, tous ceux qui l'incluent.
    const compatibles = D.objectifsRattachables(s.discipline, contexte.objectifs.map(o => ({ ...o, statut: 'en_cours' })));
    const demandes = Array.isArray(s.objectifIds) ? s.objectifIds.filter(id => idsEnCours.includes(id) && compatibles.includes(id)) : [];
    seances.push({
      date,
      heureDebut: heure === null ? null : texteSur(s.heureDebut),
      discipline: s.discipline,
      type: s.type,
      intensite: s.intensite,
      dureeS: (Number(s.dureeMin) || 0) * 60,
      distanceKm: typeof s.distanceKm === 'number' && s.distanceKm > 0 && D.discipline(s.discipline).distance !== null ? s.distanceKm : null,
      description: { echauffement: texteSur(s.echauffement), corps: texteSur(s.corps), retourCalme: texteSur(s.retourCalme) },
      objectifIds: demandes.length ? demandes : compatibles,
    });
  });

  for (const [date, total] of dureeParJour) {
    const max = jours.get(date)?.dureeMaxMin;
    if (max !== null && max !== undefined && total > max) erreurs.push(`${date} : ${total} min de séances pour un maximum de ${max} min ce jour-là.`);
  }
  for (const [date, horaires] of horairesParJour) {
    horaires.sort((a, b) => a.debut - b.debut);
    for (let k = 1; k < horaires.length; k++) {
      if (horaires[k].debut < horaires[k - 1].fin) erreurs.push(`${date} : ${horaires[k - 1].ref} et ${horaires[k].ref} se chevauchent.`);
    }
  }
  for (const [lundi, nb] of nbParSemaine) {
    const max = plafonds.get(lundi);
    if (max !== null && max !== undefined && nb > max) erreurs.push(`Semaine du ${lundi} : ${nb} séances pour un plafond restant de ${max}.`);
  }

  const phases = (Array.isArray(brut.phases) ? brut.phases : [])
    .filter(p => p && DATE.test(p.debut ?? '') && DATE.test(p.fin ?? '') && p.debut <= p.fin)
    .map(p => ({ nom: texteSur(p.nom), debut: p.debut, fin: p.fin, description: texteSur(p.description) }));

  seances.sort((a, b) => a.date.localeCompare(b.date) || (a.heureDebut ?? '').localeCompare(b.heureDebut ?? ''));
  return {
    erreurs,
    plan: erreurs.length ? null : {
      analyse: texteSur(brut.analyse),
      phases,
      seances,
      objectifIds: idsEnCours,
      objectifsNoms: Object.fromEntries([...objectifsParId].map(([id, o]) => [id, o.nom])),
      soin: (contexte.blessures ?? []).map(b => ({ id: b.id, phase: b.phaseActuelle.numero })),
    },
  };
}

// Points d'attention non bloquants affichés dans l'aperçu (principes de coaching).
export function pointsAttention(plan, contexte) {
  const points = [];
  // Volume hebdomadaire = séances du plan + séances conservées + séances déjà réalisées de la semaine.
  const premierLundi = contexte.calendrier[0]?.lundi ?? contexte.debut;
  const volumes = new Map();
  const ajouter = (date, minutes) => { const l = lundiDe(date); volumes.set(l, (volumes.get(l) ?? 0) + minutes); };
  for (const s of plan.seances) ajouter(s.date, s.dureeS / 60);
  for (const x of [...contexte.seancesConservees, ...contexte.realisees]) if (x.date >= premierLundi) ajouter(x.date, x.dureeMin ?? 0);
  const liste = [...volumes].sort(([a], [b]) => a.localeCompare(b));
  // Référence de la première semaine : moyenne des 4 semaines complètes précédentes (si l'historique existe).
  const historique = contexte.volumesHebdoMin.filter(v => v.lundi < premierLundi).slice(-4).map(v => v.minutes);
  let reference = historique.length ? historique.reduce((a, b) => a + b, 0) / historique.length : null;
  const precedentes = [];
  for (const [lundi, minutes] of liste) {
    const base = Math.max(reference ?? 0, ...precedentes.slice(-2));
    if (base > 0 && minutes > base * 1.15) {
      points.push(`Semaine du ${lundi} : volume en hausse de ${Math.round((minutes / base - 1) * 100)} % (principe : environ 10 %).`);
    }
    precedentes.push(minutes);
    reference = null;
  }
  const total = plan.seances.reduce((s, x) => s + x.dureeS, 0);
  const facile = plan.seances.filter(x => x.intensite === 'facile').reduce((s, x) => s + x.dureeS, 0);
  if (total > 0 && facile / total < 0.7) points.push(`Seulement ${Math.round((facile / total) * 100)} % du volume en intensité facile (principe : environ 80 %).`);
  return points;
}

// Volumes par semaine pour l'aperçu.
export function resumeParSemaine(seances) {
  const semaines = new Map();
  for (const s of seances) {
    const l = lundiDe(s.date);
    if (!semaines.has(l)) semaines.set(l, { lundi: l, nb: 0, dureeS: 0, seances: [] });
    const x = semaines.get(l);
    x.nb++;
    x.dureeS += s.dureeS;
    x.seances.push(s);
  }
  return [...semaines.values()].sort((a, b) => a.lundi.localeCompare(b.lundi));
}

// Calcule les changements à appliquer : on ne touche qu'aux séances IA futures encore « à faire ».
// Les séances passées, réalisées, faites, ratées ou ajoutées à la main sont conservées.
export function remplacement(prevues, plan, aujourdhui, maintenant = Date.now()) {
  return {
    aSupprimer: prevues.filter(p => estRemplacable(p, aujourdhui)).map(p => p.id),
    aAjouter: plan.seances.map(s => D.creerPrevue({ ...s, source: 'ia', etat: 'a_faire' }, maintenant)),
    meta: { genereLe: maintenant, analyse: plan.analyse, phases: plan.phases, objectifIds: plan.objectifIds, soin: plan.soin ?? [] },
  };
}

export function phaseDuJour(meta, date) {
  return meta?.phases?.find(p => p.debut <= date && date <= p.fin) ?? null;
}
