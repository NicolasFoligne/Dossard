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
  const form = h('form.formulaire.carte', { novalidate: true, autocomplete: 'off' },
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

// Éditeur des créneaux d'un jour : une ligne de temps de 5 h à 23 h par créneau, avec deux curseurs (début, fin)
// au pas de 15 min. `creneaux` est modifié sur place ; `surChangement` est appelé à chaque modification.
function editeurCreneaux(creneaux, nomJour, surChangement) {
  const { CRENEAU_MIN: MIN, CRENEAU_MAX: MAX, CRENEAU_PAS: PAS } = D;
  const pct = m => `${((m - MIN) / (MAX - MIN)) * 100}%`;
  const liste = h('div.creneaux');
  const total = h('p.aide.creneaux-total', { 'aria-live': 'polite' });
  const reperes = () => h('div.creneau-reperes', { 'aria-hidden': 'true' },
    [6, 9, 12, 15, 18, 21].map(heure => h('span', { style: { left: pct(heure * 60) } }, `${heure} h`)));

  const majTotal = () => {
    const minutes = creneaux.reduce((t, c) => t + c.fin - c.debut, 0);
    total.textContent = creneaux.length ? `Disponible : ${F.duree(minutes * 60)}` : 'Aucun créneau : ajoutez-en au moins un.';
  };

  const ligne = c => {
    const debut = h('input', { type: 'range', min: MIN, max: MAX, step: PAS, value: c.debut, 'aria-label': `${nomJour} : début du créneau` });
    const fin = h('input', { type: 'range', min: MIN, max: MAX, step: PAS, value: c.fin, 'aria-label': `${nomJour} : fin du créneau` });
    const plage = h('span.creneau-plage');
    const autres = h('span.creneau-autres');
    const libelle = h('strong.creneau-libelle');
    const dessiner = () => {
      plage.style.left = pct(c.debut);
      plage.style.width = `${((c.fin - c.debut) / (MAX - MIN)) * 100}%`;
      libelle.textContent = `${F.heureFr(c.debut)} – ${F.heureFr(c.fin)} · ${F.duree((c.fin - c.debut) * 60)}`;
      debut.setAttribute('aria-valuetext', F.heureFr(c.debut));
      fin.setAttribute('aria-valuetext', F.heureFr(c.fin));
      // Les autres créneaux du jour, en grisé, pour éviter les chevauchements.
      U.vider(autres, creneaux.filter(x => x !== c).map(x => h('span', { style: { left: pct(x.debut), width: `${((x.fin - x.debut) / (MAX - MIN)) * 100}%` } })));
    };
    // Un curseur qui rattrape l'autre le pousse : le créneau dure toujours au moins 15 min.
    const bouger = source => {
      let d = Number(debut.value);
      let f = Number(fin.value);
      if (source === debut) { d = Math.min(d, MAX - PAS); if (f - d < PAS) f = d + PAS; } else { f = Math.max(f, MIN + PAS); if (f - d < PAS) d = f - PAS; }
      debut.value = d;
      fin.value = f;
      c.debut = d;
      c.fin = f;
      liste.querySelectorAll('.creneau').forEach(el => el.dessiner?.());
      majTotal();
      surChangement();
    };
    debut.addEventListener('input', () => bouger(debut));
    fin.addEventListener('input', () => bouger(fin));
    const el = h('div.creneau',
      h('div.creneau-tete', libelle,
        h('button.bouton-icone.petit', {
          type: 'button', 'aria-label': `Supprimer le créneau de ${nomJour.toLowerCase()}`,
          onclick: () => { creneaux.splice(creneaux.indexOf(c), 1); dessinerTout(); surChangement(); },
        }, '✕')),
      h('div.creneau-piste', autres, plage, debut, fin),
      reperes());
    el.dessiner = dessiner;
    dessiner();
    return el;
  };

  // Nouveau créneau : la première heure libre parmi 18 h, 7 h, 12 h, puis n'importe quelle heure de la journée.
  const ajouter = () => {
    const libre = d => d + 60 <= MAX && !creneaux.some(c => d < c.fin && d + 60 > c.debut);
    const candidats = [18 * 60, 7 * 60, 12 * 60, ...Array.from({ length: (MAX - MIN) / PAS }, (_, k) => MIN + k * PAS)];
    const d = candidats.find(libre);
    if (d === undefined) { U.toast('Plus de place pour un créneau d\'une heure ce jour-là.', { erreur: true }); return; }
    creneaux.push({ debut: d, fin: d + 60 });
    creneaux.sort((a, b) => a.debut - b.debut);
    dessinerTout();
    surChangement();
  };

  const dessinerTout = () => {
    U.vider(liste, creneaux.map(ligne));
    majTotal();
  };
  dessinerTout();
  return h('div.zone', liste, total,
    h('button.bouton.secondaire.petit', { type: 'button', onclick: ajouter }, '＋ Ajouter un créneau'));
}

function ecranSemainier() {
  const s = D.normaliserSemainier(M.etat.semainier);
  const erreur = zoneErreur();
  const options = D.DISCIPLINES.map(d => ({ id: d.id, libelle: `${d.icone} ${d.court}` }));
  // Copie de travail des créneaux, modifiée par les curseurs ; enregistrée au clic sur « Enregistrer ».
  const creneaux = s.jours.map(j => j.creneaux.map(c => ({ ...c })));
  const blocsJours = D.JOURS.map((nom, i) => {
    const j = s.jours[i];
    const details = h('div.jour-details',
      h('fieldset.champ', h('legend.champ-libelle', 'Créneaux disponibles'), editeurCreneaux(creneaux[i], nom, () => {})),
      h('fieldset.champ', h('legend.champ-libelle', 'Disciplines possibles'), U.puces(`disciplines_${i}`, options, j.disciplines)));
    const bascule = U.interrupteur(`dispo_${i}`, j.disponible, nom);
    const majVisibilite = () => {
      const dispo = bascule.querySelector('input').checked;
      details.hidden = !dispo;
      // Jour activé sans créneau : on en propose un d'office (18 h – 19 h).
      if (dispo && !creneaux[i].length) {
        creneaux[i].push({ debut: 18 * 60, fin: 19 * 60 });
        U.vider(details.firstChild, h('legend.champ-libelle', 'Créneaux disponibles'), editeurCreneaux(creneaux[i], nom, () => {}));
      }
    };
    bascule.addEventListener('change', majVisibilite);
    majVisibilite();
    return h('div.jour-semainier', bascule, details);
  });
  const form = h('form.formulaire', { novalidate: true, autocomplete: 'off' },
    h('div.carte', U.champ('Plafond de séances par semaine', U.nombre('plafond', s.plafondSeances, { inputMode: 'numeric' }))),
    h('div.carte', h('p.aide', 'Faites glisser les curseurs pour indiquer vos plages disponibles (de 5 h à 23 h, par quart d\'heure). '
      + 'Le plan IA place chaque séance dans l\'un de ces créneaux.'), blocsJours),
    erreur,
    h('div.actions-formulaire', h('button.bouton.large', { type: 'submit' }, 'Enregistrer le semainier')));
  form.addEventListener('submit', async e => {
    e.preventDefault();
    const ok = await U.tenter(async () => {
      const plafond = U.valeurNombre(form, 'plafond');
      if (plafond === null || plafond < 0 || !Number.isInteger(plafond)) throw new D.ErreurMetier('Le plafond doit être un nombre entier de séances.');
      const jours = D.JOURS.map((nom, i) => {
        const disponible = U.coche(form, `dispo_${i}`);
        const disciplines = U.lirePuces(form.querySelector(`[data-puces="disciplines_${i}"]`));
        if (disponible && !disciplines.length) throw new D.ErreurMetier(`${nom} : choisissez au moins une discipline possible.`);
        if (disponible && !creneaux[i].length) throw new D.ErreurMetier(`${nom} : ajoutez au moins un créneau.`);
        const problemes = D.erreursCreneaux(creneaux[i]);
        if (disponible && problemes.length) throw new D.ErreurMetier(`${nom} : ${problemes.join(', ')}.`);
        return { disponible, creneaux: disponible ? creneaux[i].map(c => ({ ...c })) : [], disciplines };
      });
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
    const form = h('form.formulaire.carte', { novalidate: true, autocomplete: 'off' },
      h('p.aide', 'La clé sert à générer le plan d\'entraînement. Elle est stockée uniquement sur ce téléphone, envoyée seulement à l\'API Anthropic, et n\'est jamais incluse dans l\'export.'),
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
