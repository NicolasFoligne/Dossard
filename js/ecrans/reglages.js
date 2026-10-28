import * as M from '../magasin.js';
import * as D from '../domaine.js';
import * as F from '../format.js';
import * as U from '../ui.js';
import { lireImport, resumeImport } from '../sauvegarde.js';
import { VERSION } from '../version.js';
import { rechercherMiseAJour } from '../miseajour.js';

const { h } = U;

const SECTIONS = [
  { id: 'profil', titre: 'Profil sportif', icone: '👤', ecran: ecranProfil },
  { id: 'semainier', titre: 'Semainier', icone: '📅', ecran: ecranSemainier },
  { id: 'ia', titre: 'Clé API et modèle IA', icone: '🔑', ecran: ecranIa },
  { id: 'sauvegarde', titre: 'Sauvegarde', icone: '💾', ecran: ecranSauvegarde },
  { id: 'apropos', titre: 'À propos', icone: 'ℹ️', ecran: ecranAPropos },
];

export function ecranReglages(sous = null) {
  const section = SECTIONS.find(s => s.id === sous);
  if (section) {
    return h('div.ecran',
      h('header.entete-ecran.avec-retour',
        h('a.bouton-icone', { href: '#/reglages', 'aria-label': 'Retour aux réglages' }, '‹'),
        h('h1', section.titre)),
      section.ecran());
  }
  return h('div.ecran',
    h('header.entete-ecran', h('h1', 'Réglages')),
    h('nav.carte.liste-reglages', SECTIONS.map(s => h('a.ligne-seance', { href: `#/reglages/${s.id}` },
      h('span.ligne-icone', s.icone), h('span.ligne-texte', h('strong', s.titre)), h('span.chevron', '›')))));
}

const zoneErreur = () => h('p.erreur', { role: 'alert' });

// ------------------------------------------------------------ Profil

function ecranProfil() {
  const p = M.etat.profil;
  const erreur = zoneErreur();
  const form = h('form.formulaire.carte', { novalidate: true },
    U.champ('Niveau', U.selection('niveau', [{ id: '', libelle: 'Non renseigné' }, ...D.NIVEAUX.map(n => ({ id: n, libelle: n }))], p.niveau)),
    U.champ('Allure habituelle en course', U.texte('allureHabituelle', p.allureHabituelle, { placeholder: 'ex. 5:30 /km en endurance' })),
    U.champ('Performances récentes', U.zoneTexte('performances', p.performances, { placeholder: 'ex. 10 km en 48:30 (mars 2026)' })),
    U.champ('Antécédents de blessures', U.zoneTexte('blessures', p.blessures, { placeholder: 'ex. périostite en 2025, fragilité du genou gauche' })),
    h('fieldset.champ', h('legend.champ-libelle', 'Matériel'),
      U.interrupteur('montreGps', p.materiel.montreGps, 'Montre GPS'),
      U.interrupteur('velo', p.materiel.velo, 'Vélo'),
      U.interrupteur('piscine', p.materiel.piscine, 'Accès à une piscine')),
    U.champ('Remarques', U.zoneTexte('remarques', p.remarques)),
    erreur,
    h('div.actions-formulaire', h('button.bouton.large', { type: 'submit' }, 'Enregistrer le profil')));
  form.addEventListener('submit', async e => {
    e.preventDefault();
    const ok = await U.tenter(async () => {
      await M.enregistrerProfil({
        niveau: U.valeur(form, 'niveau'),
        allureHabituelle: U.valeur(form, 'allureHabituelle').trim(),
        performances: U.valeur(form, 'performances').trim(),
        blessures: U.valeur(form, 'blessures').trim(),
        materiel: { montreGps: U.coche(form, 'montreGps'), velo: U.coche(form, 'velo'), piscine: U.coche(form, 'piscine') },
        remarques: U.valeur(form, 'remarques').trim(),
      });
      return true;
    }, erreur);
    if (ok) U.toast('Profil enregistré');
  });
  return form;
}

// ------------------------------------------------------------ Semainier

function ecranSemainier() {
  const s = M.etat.semainier;
  const erreur = zoneErreur();
  const options = D.DISCIPLINES.map(d => ({ id: d.id, libelle: `${d.icone} ${d.court}` }));
  const blocsJours = D.JOURS.map((nom, i) => {
    const j = s.jours[i];
    const details = h('div.jour-details',
      U.champ('Durée maximale (min)', U.nombre(`duree_${i}`, j.dureeMaxMin, { inputMode: 'numeric' })),
      h('fieldset.champ', h('legend.champ-libelle', 'Disciplines possibles'), U.puces(`disciplines_${i}`, options, j.disciplines)));
    const bascule = U.interrupteur(`dispo_${i}`, j.disponible, nom);
    const majVisibilite = () => { details.hidden = !bascule.querySelector('input').checked; };
    bascule.addEventListener('change', majVisibilite);
    majVisibilite();
    return h('div.jour-semainier', bascule, details);
  });
  const form = h('form.formulaire', { novalidate: true },
    h('div.carte', U.champ('Plafond de séances par semaine', U.nombre('plafond', s.plafondSeances, { inputMode: 'numeric' }))),
    h('div.carte', blocsJours),
    erreur,
    h('div.actions-formulaire', h('button.bouton.large', { type: 'submit' }, 'Enregistrer le semainier')));
  form.addEventListener('submit', async e => {
    e.preventDefault();
    const ok = await U.tenter(async () => {
      const plafond = U.valeurNombre(form, 'plafond');
      if (plafond === null || plafond < 0 || !Number.isInteger(plafond)) throw new D.ErreurMetier('Le plafond doit être un nombre entier de séances.');
      const jours = D.JOURS.map((_, i) => {
        const duree = U.valeurNombre(form, `duree_${i}`);
        return {
          disponible: U.coche(form, `dispo_${i}`),
          dureeMaxMin: duree && duree > 0 ? Math.round(duree) : null,
          disciplines: U.lirePuces(form.querySelector(`[data-puces="disciplines_${i}"]`)),
        };
      });
      const sansDiscipline = jours.findIndex(j => j.disponible && j.disciplines.length === 0);
      if (sansDiscipline >= 0) throw new D.ErreurMetier(`${D.JOURS[sansDiscipline]} : choisissez au moins une discipline possible.`);
      await M.enregistrerSemainier({ jours, plafondSeances: plafond });
      return true;
    }, erreur);
    if (ok) U.toast('Semainier enregistré');
  });
  return form;
}

// ------------------------------------------------------------ Clé API et modèle

function ecranIa() {
  const conteneur = h('div');
  const dessiner = () => {
    const cle = M.etat.appareil.cleApi ?? '';
    const champCle = h('input', { type: 'password', name: 'cle', value: cle, autocomplete: 'off', spellcheck: false, placeholder: 'sk-ant-…', autocapitalize: 'off' });
    const form = h('form.formulaire.carte', { novalidate: true },
      h('p.aide', 'La génération du plan par l\'IA arrive au lot 2. La clé est stockée uniquement sur ce téléphone et n\'est jamais incluse dans l\'export.'),
      U.champ('Clé API Anthropic', champCle, cle ? 'Une clé est enregistrée sur ce téléphone.' : 'Aucune clé enregistrée.'),
      h('label.interrupteur', h('input', { type: 'checkbox', onchange: e => { champCle.type = e.target.checked ? 'text' : 'password'; } }), h('span', 'Afficher la clé')),
      U.champ('Modèle', U.texte('modele', M.etat.reglages.modeleIa, { autocapitalize: 'off', spellcheck: false }), `Par défaut : ${D.reglagesParDefaut().modeleIa}`),
      h('div.actions-formulaire',
        h('button.bouton.large', { type: 'submit' }, 'Enregistrer'),
        cle && h('button.bouton.secondaire.danger-texte', {
          type: 'button',
          onclick: async () => {
            if (!(await U.confirmer('Supprimer la clé API de ce téléphone ?', { ok: 'Supprimer', danger: true }))) return;
            await U.tenter(() => M.supprimerCleApi());
            U.toast('Clé supprimée');
            dessiner();
          },
        }, 'Supprimer la clé')));
    form.addEventListener('submit', async e => {
      e.preventDefault();
      const ok = await U.tenter(async () => {
        const nouvelle = champCle.value.trim();
        if (nouvelle) await M.enregistrerCleApi(nouvelle); else if (cle) await M.supprimerCleApi();
        await M.enregistrerReglages({ ...M.etat.reglages, modeleIa: U.valeur(form, 'modele').trim() || D.reglagesParDefaut().modeleIa });
        return true;
      });
      if (ok) { U.toast('Réglages IA enregistrés'); dessiner(); }
    });
    U.vider(conteneur, form);
  };
  dessiner();
  return conteneur;
}

// ------------------------------------------------------------ Sauvegarde

function nomFichier() {
  return `dossard-sauvegarde-${F.aujourdhui()}.json`;
}

async function exporter({ partager = false } = {}) {
  const json = await M.exporter();
  const fichier = new File([JSON.stringify(json, null, 2)], nomFichier(), { type: 'application/json' });
  if (partager && navigator.canShare?.({ files: [fichier] })) {
    try {
      await navigator.share({ files: [fichier], title: 'Sauvegarde Dossard' });
    } catch (e) {
      if (e.name !== 'AbortError') throw e;
    }
    return;
  }
  const url = URL.createObjectURL(fichier);
  const a = h('a', { href: url, download: fichier.name });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}

function ecranSauvegarde() {
  const conteneur = h('div.zone');
  const dessiner = () => {
    const derniere = M.etat.appareil.derniereSauvegarde;
    const joursDepuis = derniere ? F.ecartJours(derniere, F.aujourdhui()) : null;
    const champFichier = h('input', { type: 'file', accept: 'application/json,.json', hidden: true });
    champFichier.addEventListener('change', async () => {
      const f = champFichier.files[0];
      champFichier.value = '';
      if (!f) return;
      await U.tenter(async () => {
        const donnees = lireImport(await f.text());
        const ok = await U.confirmer(`Importer cette sauvegarde (${resumeImport(donnees)}${donnees.exporteLe ? `, du ${F.dateHeureFr(donnees.exporteLe)}` : ''}) ? Toutes les données actuelles de l'application seront remplacées. La clé API n'est pas concernée.`,
          { ok: 'Remplacer mes données', danger: true });
        if (!ok) return;
        await M.importer(donnees);
        U.toast('Sauvegarde importée');
        dessiner();
      });
    });
    const peutPartager = typeof navigator.canShare === 'function';
    U.vider(conteneur,
      h('section.carte',
        h('h2', 'Exporter'),
        h('p', derniere ? `Dernier export : ${F.dateFr(derniere)} (il y a ${joursDepuis} jour${joursDepuis > 1 ? 's' : ''}).` : 'Aucun export réalisé sur ce téléphone.'),
        joursDepuis === null || joursDepuis >= 30 ? h('p.alerte.alerte-info', 'Pensez à exporter régulièrement vos données (au moins tous les 30 jours).') : null,
        h('p.aide', 'Fichier JSON complet : profil, semainier, objectifs, séances. La clé API n\'y figure jamais.'),
        h('div.actions-formulaire',
          h('button.bouton.large', { type: 'button', onclick: async () => { if (await U.tenter(async () => { await exporter(); return true; })) { U.toast('Export téléchargé'); dessiner(); } } }, 'Télécharger la sauvegarde'),
          peutPartager && h('button.bouton.secondaire', { type: 'button', onclick: async () => { if (await U.tenter(async () => { await exporter({ partager: true }); return true; })) dessiner(); } }, 'Partager la sauvegarde…'))),
      h('section.carte',
        h('h2', 'Importer'),
        h('p.aide', 'Remplace toutes les données actuelles par celles du fichier. Une confirmation vous sera demandée.'),
        champFichier,
        h('div.actions-formulaire', h('button.bouton.secondaire', { type: 'button', onclick: () => champFichier.click() }, 'Choisir un fichier…'))));
  };
  dessiner();
  return conteneur;
}

// ------------------------------------------------------------ À propos

function ecranAPropos() {
  const statut = h('p.aide', { 'aria-live': 'polite' });
  return h('section.carte',
    h('p', h('strong', 'Dossard'), ` — version ${VERSION}`),
    h('p.aide', 'Préparation sportive multi-objectifs. Vos données restent sur ce téléphone (IndexedDB).'),
    h('div.actions-formulaire', h('button.bouton.secondaire', {
      type: 'button',
      onclick: async () => {
        statut.textContent = 'Recherche en cours…';
        statut.textContent = await rechercherMiseAJour();
      },
    }, 'Rechercher une mise à jour')),
    statut);
}
