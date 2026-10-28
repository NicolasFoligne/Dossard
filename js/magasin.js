// État de l'application en mémoire, synchronisé avec IndexedDB.
// Les écrans lisent `etat` et passent par les actions ci-dessous pour toute modification.
import * as db from './db.js';
import * as D from './domaine.js';
import { aujourdhui } from './format.js';
import { construireExport } from './sauvegarde.js';

export const etat = {
  profil: D.profilParDefaut(),
  semainier: D.semainierParDefaut(),
  reglages: D.reglagesParDefaut(),
  objectifs: [],
  prevues: [],
  realisees: [],
  appareil: {},
};

const abonnes = new Set();
export const abonner = f => abonnes.add(f);
const notifier = () => abonnes.forEach(f => f());

export async function charger() {
  const d = await db.lireTout();
  etat.profil = { ...D.profilParDefaut(), ...d.profil, materiel: { ...D.profilParDefaut().materiel, ...d.profil?.materiel } };
  etat.semainier = d.semainier ?? D.semainierParDefaut();
  etat.reglages = { ...D.reglagesParDefaut(), ...d.reglages };
  etat.objectifs = d.objectifs;
  etat.prevues = d.prevues;
  etat.realisees = d.realisees;
  etat.appareil = d.appareil;
  if (!etat.appareil.premiereUtilisation) await ecrireAppareil('premiereUtilisation', aujourdhui());
}

async function ecrireAppareil(cle, valeur) {
  await db.ecrireAppareil(cle, valeur);
  etat.appareil[cle] = valeur;
}

const remplacerDans = (liste, objet) => {
  const i = liste.findIndex(x => x.id === objet.id);
  if (i >= 0) liste[i] = objet; else liste.push(objet);
};

export const objectif = id => etat.objectifs.find(o => o.id === id);
export const prevue = id => etat.prevues.find(p => p.id === id);
export const realisee = id => etat.realisees.find(r => r.id === id);

export const aDesDonnees = () => etat.objectifs.length + etat.prevues.length + etat.realisees.length > 0;

// ------------------------------------------------------------ Profil, semainier, réglages

export async function enregistrerProfil(profil) {
  await db.ecrireKv('profil', profil);
  etat.profil = profil;
  notifier();
}

export async function enregistrerSemainier(semainier) {
  await db.ecrireKv('semainier', semainier);
  etat.semainier = semainier;
  notifier();
}

export async function enregistrerReglages(reglages) {
  await db.ecrireKv('reglages', reglages);
  etat.reglages = reglages;
  notifier();
}

export async function enregistrerCleApi(cle) {
  await ecrireAppareil('cleApi', cle);
  notifier();
}

export async function supprimerCleApi() {
  await db.supprimerAppareil('cleApi');
  delete etat.appareil.cleApi;
  notifier();
}

// ------------------------------------------------------------ Objectifs

async function sauverObjectif(o) {
  await db.mettre('objectifs', o);
  remplacerDans(etat.objectifs, o);
  notifier();
  return o;
}

export const creerObjectif = donnees => sauverObjectif(D.creerObjectif(donnees));
export const modifierObjectif = (id, donnees) => sauverObjectif(D.modifierObjectif(objectif(id), donnees));
export const demarrerObjectif = id => sauverObjectif(D.demarrerObjectif(objectif(id), aujourdhui()));
export const terminerObjectif = (id, resultat) => sauverObjectif(D.terminerObjectif(objectif(id), resultat, aujourdhui()));

// Supprime l'objectif et retire son identifiant des séances qui y étaient rattachées.
export async function supprimerObjectif(id) {
  const ops = [{ magasin: 'objectifs', supprimer: id }];
  const maj = [];
  for (const [magasin, liste] of [['prevues', etat.prevues], ['realisees', etat.realisees]]) {
    for (const s of liste.filter(x => x.objectifIds?.includes(id))) {
      const n = { ...s, objectifIds: s.objectifIds.filter(x => x !== id) };
      ops.push({ magasin, mettre: n });
      maj.push([liste, n]);
    }
  }
  await db.appliquer(ops);
  etat.objectifs = etat.objectifs.filter(o => o.id !== id);
  maj.forEach(([liste, n]) => remplacerDans(liste, n));
  notifier();
}

// ------------------------------------------------------------ Séances prévues

export async function enregistrerPrevue(donnees) {
  const ancienne = donnees.id ? prevue(donnees.id) : null;
  const p = D.creerPrevue({ ...ancienne, ...donnees });
  await db.mettre('prevues', p);
  remplacerDans(etat.prevues, p);
  notifier();
  return p;
}

export async function changerEtatPrevue(id, etatPrevue) {
  const p = { ...prevue(id), etat: etatPrevue, modifieLe: Date.now() };
  await db.mettre('prevues', p);
  remplacerDans(etat.prevues, p);
  notifier();
}

export async function supprimerPrevue(id) {
  const ops = [{ magasin: 'prevues', supprimer: id }];
  const liees = etat.realisees.filter(r => r.prevueId === id).map(r => ({ ...r, prevueId: null }));
  liees.forEach(r => ops.push({ magasin: 'realisees', mettre: r }));
  await db.appliquer(ops);
  etat.prevues = etat.prevues.filter(p => p.id !== id);
  liees.forEach(r => remplacerDans(etat.realisees, r));
  notifier();
}

// ------------------------------------------------------------ Séances réalisées

// Crée ou modifie une séance réalisée ; tient à jour l'état de la séance prévue liée.
export async function enregistrerRealisee(donnees, id = null) {
  const ancienne = id ? realisee(id) : null;
  const r = D.enregistrerRealisee(donnees, etat.objectifs, ancienne);
  const ops = [{ magasin: 'realisees', mettre: r }];
  const prevuesMaj = [];
  if (ancienne?.prevueId && ancienne.prevueId !== r.prevueId) {
    const p = prevue(ancienne.prevueId);
    if (p && p.etat === 'faite') prevuesMaj.push({ ...p, etat: 'a_faire', modifieLe: Date.now() });
  }
  if (r.prevueId) {
    const p = prevue(r.prevueId);
    if (p && p.etat !== 'faite') prevuesMaj.push({ ...p, etat: 'faite', modifieLe: Date.now() });
  }
  prevuesMaj.forEach(p => ops.push({ magasin: 'prevues', mettre: p }));
  await db.appliquer(ops);
  remplacerDans(etat.realisees, r);
  prevuesMaj.forEach(p => remplacerDans(etat.prevues, p));
  notifier();
  return r;
}

export async function supprimerRealisee(id) {
  const r = realisee(id);
  const ops = [{ magasin: 'realisees', supprimer: id }];
  const p = r?.prevueId ? prevue(r.prevueId) : null;
  const pMaj = p && p.etat === 'faite' ? { ...p, etat: 'a_faire', modifieLe: Date.now() } : null;
  if (pMaj) ops.push({ magasin: 'prevues', mettre: pMaj });
  await db.appliquer(ops);
  etat.realisees = etat.realisees.filter(x => x.id !== id);
  if (pMaj) remplacerDans(etat.prevues, pMaj);
  notifier();
}

// ------------------------------------------------------------ Sauvegarde

export async function exporter() {
  const json = construireExport(etat);
  await ecrireAppareil('derniereSauvegarde', aujourdhui());
  notifier();
  return json;
}

export async function importer(donnees) {
  await db.remplacerTout(donnees);
  etat.profil = donnees.profil;
  etat.semainier = donnees.semainier;
  etat.reglages = donnees.reglages;
  etat.objectifs = donnees.objectifs;
  etat.prevues = donnees.prevues;
  etat.realisees = donnees.realisees;
  notifier();
}
