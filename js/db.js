// Accès IndexedDB. Tout est stocké sur le téléphone.
// Magasins exportés : kv (profil, semainier, réglages, plan IA), objectifs, prevues, realisees,
// blessures (suivis de blessure), bilans (bilans quotidiens des suivis) et seancesSoin (séances de soin du planning).
// Magasin « appareil » : propre au téléphone, jamais exporté (clé API, date du dernier export…).

const NOM_BASE = 'dossard';
const VERSION_BASE = 3; // 2 : magasins « blessures » et « bilans » · 3 : magasin « seancesSoin »
export const MAGASINS_LISTES = ['objectifs', 'prevues', 'realisees', 'blessures', 'bilans', 'seancesSoin'];
const INDEX_DATE = { objectifs: 'dateEpreuve', prevues: 'date', realisees: 'date', blessures: 'debut', bilans: 'date', seancesSoin: 'date' };
const MAGASINS_EXPORTES = ['kv', ...MAGASINS_LISTES];

let base = null;

function promesse(requete) {
  return new Promise((ok, ko) => {
    requete.onsuccess = () => ok(requete.result);
    requete.onerror = () => ko(requete.error);
  });
}

function fin(tx) {
  return new Promise((ok, ko) => {
    tx.oncomplete = () => ok();
    tx.onerror = () => ko(tx.error);
    tx.onabort = () => ko(tx.error ?? new Error('Transaction annulée'));
  });
}

export async function ouvrir() {
  if (base) return base;
  const req = indexedDB.open(NOM_BASE, VERSION_BASE);
  req.onupgradeneeded = () => {
    const db = req.result;
    if (!db.objectStoreNames.contains('kv')) db.createObjectStore('kv', { keyPath: 'cle' });
    if (!db.objectStoreNames.contains('appareil')) db.createObjectStore('appareil', { keyPath: 'cle' });
    for (const nom of MAGASINS_LISTES) {
      if (!db.objectStoreNames.contains(nom)) db.createObjectStore(nom, { keyPath: 'id' }).createIndex('date', INDEX_DATE[nom]);
    }
  };
  base = await promesse(req);
  return base;
}

export async function lireTout() {
  const db = await ouvrir();
  const tx = db.transaction([...MAGASINS_EXPORTES, 'appareil'], 'readonly');
  const [kv, objectifs, prevues, realisees, blessures, bilans, seancesSoin, appareil] = await Promise.all(
    [...MAGASINS_EXPORTES, 'appareil'].map(n => promesse(tx.objectStore(n).getAll())));
  const valeurs = Object.fromEntries(kv.map(e => [e.cle, e.valeur]));
  return {
    profil: valeurs.profil,
    semainier: valeurs.semainier,
    reglages: valeurs.reglages,
    plan: valeurs.plan,
    objectifs,
    prevues,
    realisees,
    blessures,
    bilans,
    seancesSoin,
    appareil: Object.fromEntries(appareil.map(e => [e.cle, e.valeur])),
  };
}

// Écrit plusieurs changements dans une seule transaction (tout ou rien).
// ops : [{ magasin, mettre: objet } | { magasin, supprimer: id }]
export async function appliquer(ops) {
  const db = await ouvrir();
  const noms = [...new Set(ops.map(o => o.magasin))];
  const tx = db.transaction(noms, 'readwrite');
  for (const op of ops) {
    const m = tx.objectStore(op.magasin);
    if (op.supprimer !== undefined) m.delete(op.supprimer);
    else m.put(op.mettre);
  }
  return fin(tx);
}

export const mettre = (magasin, objet) => appliquer([{ magasin, mettre: objet }]);
export const supprimer = (magasin, id) => appliquer([{ magasin, supprimer: id }]);
export const ecrireKv = (cle, valeur) => mettre('kv', { cle, valeur });
export const ecrireAppareil = (cle, valeur) => mettre('appareil', { cle, valeur });
export const supprimerAppareil = cle => supprimer('appareil', cle);

// Remplace toutes les données exportables (import). Le magasin « appareil » est conservé.
export async function remplacerTout(d) {
  const db = await ouvrir();
  const tx = db.transaction(MAGASINS_EXPORTES, 'readwrite');
  for (const n of MAGASINS_EXPORTES) tx.objectStore(n).clear();
  const kv = tx.objectStore('kv');
  kv.put({ cle: 'profil', valeur: d.profil });
  kv.put({ cle: 'semainier', valeur: d.semainier });
  kv.put({ cle: 'reglages', valeur: d.reglages });
  if (d.plan) kv.put({ cle: 'plan', valeur: d.plan });
  for (const n of MAGASINS_LISTES) for (const x of d[n] ?? []) tx.objectStore(n).put(x);
  return fin(tx);
}
