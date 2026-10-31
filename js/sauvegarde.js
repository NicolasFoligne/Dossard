// Export / import JSON (fonctions pures). La clé API vit dans le magasin « appareil »
// et n'est jamais incluse dans l'export.
import { profilParDefaut, semainierParDefaut, normaliserSemainier, reglagesParDefaut, ErreurMetier } from './domaine.js';

// 2 : ajout des suivis de blessure (blessures, bilans) · 3 : séances de soin du planning (seancesSoin).
// Les sauvegardes aux formats 1 et 2 restent lisibles (listes absentes = vides).
export const FORMAT_SAUVEGARDE = 3;

export function construireExport(donnees, maintenant = Date.now()) {
  const reglages = { ...donnees.reglages };
  delete reglages.cleApi;
  return {
    application: 'dossard',
    format: FORMAT_SAUVEGARDE,
    exporteLe: new Date(maintenant).toISOString(),
    donnees: {
      profil: donnees.profil,
      semainier: donnees.semainier,
      reglages,
      plan: donnees.plan ?? null,
      objectifs: donnees.objectifs,
      prevues: donnees.prevues,
      realisees: donnees.realisees,
      blessures: donnees.blessures ?? [],
      bilans: donnees.bilans ?? [],
      seancesSoin: donnees.seancesSoin ?? [],
    },
  };
}

function exiger(condition, message) {
  if (!condition) throw new ErreurMetier(`Fichier invalide : ${message}`);
}

const estObjet = v => v !== null && typeof v === 'object' && !Array.isArray(v);

// Lit et valide un fichier de sauvegarde. Renvoie les données prêtes à importer.
export function lireImport(texte) {
  let json;
  try {
    json = JSON.parse(texte);
  } catch {
    throw new ErreurMetier("Fichier invalide : ce n'est pas un JSON lisible.");
  }
  exiger(estObjet(json) && json.application === 'dossard', "ce n'est pas une sauvegarde Dossard.");
  exiger(Number.isInteger(json.format) && json.format <= FORMAT_SAUVEGARDE, 'format de sauvegarde inconnu (application à mettre à jour ?).');
  const d = json.donnees;
  exiger(estObjet(d), 'données absentes.');
  for (const cle of ['objectifs', 'prevues', 'realisees']) {
    exiger(Array.isArray(d[cle]), `liste « ${cle} » absente.`);
    exiger(d[cle].every(x => estObjet(x) && typeof x.id === 'string' && x.id), `élément sans identifiant dans « ${cle} ».`);
  }
  exiger(d.objectifs.every(o => typeof o.dateEpreuve === 'string' && o.statut), 'objectif incomplet.');
  exiger([...d.prevues, ...d.realisees].every(s => typeof s.date === 'string' && typeof s.discipline === 'string'), 'séance incomplète.');
  for (const cle of ['blessures', 'bilans', 'seancesSoin']) {
    exiger(d[cle] === undefined || (Array.isArray(d[cle]) && d[cle].every(x => estObjet(x) && typeof x.id === 'string' && x.id)), `liste « ${cle} » invalide.`);
  }
  const blessures = d.blessures ?? [];
  const bilans = d.bilans ?? [];
  exiger(blessures.every(b => typeof b.programme === 'string' && typeof b.debut === 'string' && Number.isInteger(b.phase)), 'suivi de blessure incomplet.');
  exiger(bilans.every(b => typeof b.date === 'string' && typeof b.blessureId === 'string'), 'bilan de soin incomplet.');
  const seancesSoin = d.seancesSoin ?? [];
  exiger(seancesSoin.every(x => typeof x.date === 'string' && typeof x.blessureId === 'string' && Array.isArray(x.exercices)
    && ['a_faire', 'faite', 'ratee'].includes(x.etat)), 'séance de soin incomplète.');
  const semainier = normaliserSemainier(estObjet(d.semainier) && Array.isArray(d.semainier.jours) && d.semainier.jours.length === 7
    ? d.semainier : semainierParDefaut());
  const reglages = { ...reglagesParDefaut(), ...(estObjet(d.reglages) ? d.reglages : {}) };
  delete reglages.cleApi;
  return {
    profil: { ...profilParDefaut(), ...(estObjet(d.profil) ? d.profil : {}) },
    semainier,
    reglages,
    plan: estObjet(d.plan) ? d.plan : null,
    objectifs: d.objectifs,
    prevues: d.prevues,
    realisees: d.realisees,
    blessures,
    bilans,
    seancesSoin,
    exporteLe: json.exporteLe ?? null,
  };
}

export function resumeImport(d) {
  const soin = d.blessures?.length ? `, ${d.blessures.length} suivi(s) de blessure et ${d.bilans.length} bilan(s)` : '';
  return `${d.objectifs.length} objectif(s), ${d.prevues.length} séance(s) prévue(s), ${d.realisees.length} séance(s) réalisée(s)${soin}`;
}
