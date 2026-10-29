// Génération du plan par l'IA — partie pure (sans réseau ni DOM), testée par tests/ia.test.js :
// contexte envoyé, prompt, schéma JSON de la réponse, validation stricte, remplacement des séances.
import * as D from './domaine.js';
import { ajouterJours, ecartJours, lundiDe } from './format.js';

const SEMAINES_HISTORIQUE = 8;

// ------------------------------------------------------------ Schéma de la réponse

const SEANCE = {
  type: 'object',
  additionalProperties: false,
  required: ['date', 'discipline', 'type', 'intensite', 'dureeMin', 'distanceKm', 'echauffement', 'corps', 'retourCalme', 'objectifIds'],
  properties: {
    date: { type: 'string', format: 'date', description: 'AAAA-MM-JJ, une des dates du calendrier' },
    discipline: { type: 'string', enum: D.DISCIPLINES.map(d => d.id) },
    type: { type: 'string', enum: D.TYPES_SEANCE.map(t => t.id) },
    intensite: { type: 'string', enum: D.INTENSITES.map(i => i.id) },
    dureeMin: { type: 'integer', description: 'Durée totale en minutes' },
    distanceKm: { type: ['number', 'null'], description: 'Distance en km (natation : 1.5 pour 1 500 m), null si sans objet' },
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

// Rassemble tout ce qui est envoyé à l'IA et sert ensuite à valider sa réponse.
export function construireContexte(etat, aujourdhui) {
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
  const plafond = Number(etat.semainier.plafondSeances) || 0;
  for (let lundi = lundiDe(aujourdhui); lundi < fin; lundi = ajouterJours(lundi, 7)) {
    const dimanche = ajouterJours(lundi, 6);
    const dansSemaine = x => x.date >= lundi && x.date <= dimanche;
    const dejaCompte = conservees.filter(dansSemaine).length + realisees.filter(dansSemaine).length;
    const jours = [];
    for (let i = 0; i < 7; i++) {
      const date = ajouterJours(lundi, i);
      if (date < aujourdhui || date >= fin || epreuves.has(date)) continue;
      const j = etat.semainier.jours[i];
      if (!j?.disponible || !j.disciplines?.length) continue;
      const occupe = [...conservees, ...realisees].filter(x => x.date === date).reduce((s, x) => s + (enMinutes(x.dureeS) ?? 0), 0);
      const dureeMaxMin = j.dureeMaxMin ? j.dureeMaxMin - occupe : null;
      if (dureeMaxMin !== null && dureeMaxMin <= 0) continue;
      jours.push({ date, jour: D.JOURS[i], dureeMaxMin, disciplines: [...j.disciplines] });
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
    semainier: etat.semainier.jours.map((j, i) => ({ jour: D.JOURS[i], ...j })),
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
      date: p.date, discipline: p.discipline, type: p.type, dureeMin: enMinutes(p.dureeS), distanceKm: p.distanceKm,
    })),
    calendrier: semaines,
  };
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
2. La somme des durées des séances d'un même jour ne dépasse jamais « dureeMaxMin » de ce jour (null = pas de limite).
3. Le nombre de séances d'une semaine ne dépasse jamais « plafondRestant » de cette semaine (null = pas de limite).
4. Aucune séance avant « debut », à partir de « fin », ni le jour d'une épreuve.
5. Les « seancesConservees » sont maintenues telles quelles : n'en crée pas de doublon et intègre-les dans la charge.

Principes de coaching à appliquer :
- progression du volume hebdomadaire limitée à environ 10 % d'une semaine à l'autre, en partant du volume récent réel (« volumesHebdoMin ») ;
- environ 80 % du volume en intensité facile ;
- une semaine allégée toutes les 3 à 4 semaines ;
- phases foncière, puis spécifique, puis affûtage, avec un affûtage adapté à la distance de chaque épreuve ;
- renforcement musculaire régulier ;
- enchaînements vélo-course réguliers pour le triathlon, surtout en phase spécifique ;
- prise en compte des antécédents de blessures du profil ;
- temps visés confrontés au niveau réel (performances, allures récentes) : dis franchement s'ils sont irréalistes et propose une cible crédible dans l'analyse.

Rédaction : en français, concis. Pour chaque séance, échauffement, corps de séance et retour au calme tiennent en une ou deux phrases précises (allures, zones, répétitions, récupérations). « dureeMin » est un entier en minutes. « distanceKm » est en kilomètres (natation : 1.5 pour 1 500 m) ou null pour le renforcement. « objectifIds » liste les identifiants des objectifs servis par la séance. « analyse » fait au plus 10 phrases.

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
    if (s.distanceKm !== null && s.distanceKm !== undefined && !(typeof s.distanceKm === 'number' && s.distanceKm >= 0)) {
      erreurs.push(`${ref} : « distanceKm » doit être un nombre positif ou null.`);
    }
    dureeParJour.set(date, (dureeParJour.get(date) ?? 0) + (Number(s.dureeMin) || 0));
    nbParSemaine.set(jour.lundi, (nbParSemaine.get(jour.lundi) ?? 0) + 1);

    // Rattachement : seuls les objectifs en cours qui incluent la discipline ; à défaut, tous ceux qui l'incluent.
    const compatibles = D.objectifsRattachables(s.discipline, contexte.objectifs.map(o => ({ ...o, statut: 'en_cours' })));
    const demandes = Array.isArray(s.objectifIds) ? s.objectifIds.filter(id => idsEnCours.includes(id) && compatibles.includes(id)) : [];
    seances.push({
      date,
      discipline: s.discipline,
      type: s.type,
      intensite: s.intensite,
      dureeS: (Number(s.dureeMin) || 0) * 60,
      distanceKm: typeof s.distanceKm === 'number' && s.distanceKm > 0 && s.discipline !== 'renforcement' ? s.distanceKm : null,
      description: { echauffement: texteSur(s.echauffement), corps: texteSur(s.corps), retourCalme: texteSur(s.retourCalme) },
      objectifIds: demandes.length ? demandes : compatibles,
    });
  });

  for (const [date, total] of dureeParJour) {
    const max = jours.get(date)?.dureeMaxMin;
    if (max !== null && max !== undefined && total > max) erreurs.push(`${date} : ${total} min de séances pour un maximum de ${max} min ce jour-là.`);
  }
  for (const [lundi, nb] of nbParSemaine) {
    const max = plafonds.get(lundi);
    if (max !== null && max !== undefined && nb > max) erreurs.push(`Semaine du ${lundi} : ${nb} séances pour un plafond restant de ${max}.`);
  }

  const phases = (Array.isArray(brut.phases) ? brut.phases : [])
    .filter(p => p && DATE.test(p.debut ?? '') && DATE.test(p.fin ?? '') && p.debut <= p.fin)
    .map(p => ({ nom: texteSur(p.nom), debut: p.debut, fin: p.fin, description: texteSur(p.description) }));

  seances.sort((a, b) => a.date.localeCompare(b.date));
  return {
    erreurs,
    plan: erreurs.length ? null : {
      analyse: texteSur(brut.analyse),
      phases,
      seances,
      objectifIds: idsEnCours,
      objectifsNoms: Object.fromEntries([...objectifsParId].map(([id, o]) => [id, o.nom])),
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
    meta: { genereLe: maintenant, analyse: plan.analyse, phases: plan.phases, objectifIds: plan.objectifIds },
  };
}

export function phaseDuJour(meta, date) {
  return meta?.phases?.find(p => p.debut <= date && date <= p.fin) ?? null;
}
