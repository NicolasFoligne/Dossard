// Petits utilitaires d'interface : création d'éléments, feuilles modales, champs de formulaire.
import { secondesVersHms, hmsVersSecondes, lireNombre } from './format.js';
import { ErreurMetier } from './domaine.js';

// h('div.carte', { onclick }, enfant1, 'texte', …)
export function h(sel, attrs, ...enfants) {
  if (attrs === null || typeof attrs !== 'object' || attrs instanceof Node || Array.isArray(attrs)) {
    enfants.unshift(attrs);
    attrs = {};
  }
  const [tag, ...classes] = sel.split('.');
  const el = document.createElement(tag || 'div');
  if (classes.length) el.className = classes.join(' ');
  for (const [k, v] of Object.entries(attrs)) {
    if (v === undefined || v === null || v === false) continue;
    if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else if (k === 'class') el.className += (el.className ? ' ' : '') + v;
    else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
    else if (k in el && k !== 'list' && k !== 'form') el[k] = v;
    else el.setAttribute(k, v === true ? '' : v);
  }
  ajouter(el, enfants);
  return el;
}

function ajouter(el, enfants) {
  for (const e of enfants.flat(Infinity)) {
    if (e === null || e === undefined || e === false) continue;
    el.append(e instanceof Node ? e : document.createTextNode(String(e)));
  }
}

export function vider(el, ...enfants) {
  el.replaceChildren();
  ajouter(el, enfants);
  return el;
}

// ------------------------------------------------------------ Notifications

export function toast(message, { erreur = false } = {}) {
  const zone = document.getElementById('toasts');
  const t = h('div.toast', { role: 'status', class: erreur ? 'toast-erreur' : '' }, message);
  zone.replaceChildren(t); // un seul message à la fois
  setTimeout(() => t.classList.add('sortie'), 2600);
  setTimeout(() => t.remove(), 3000);
}

// ------------------------------------------------------------ Feuilles modales

const pile = [];

// Ouvre une feuille plein écran. `contenu` reçoit la fonction de fermeture.
// `surFermeture` est appelée quelle que soit la façon dont la feuille se ferme.
export function ouvrirFeuille(titre, construire, { actions = null, surFermeture = null } = {}) {
  const fermer = () => {
    surFermeture?.();
    feuille.classList.add('sortie');
    setTimeout(() => feuille.remove(), 180);
    const i = pile.indexOf(feuille);
    if (i >= 0) pile.splice(i, 1);
    document.body.classList.toggle('feuille-ouverte', pile.length > 0);
  };
  const corps = h('div.feuille-corps');
  const feuille = h('div.feuille', { role: 'dialog', 'aria-modal': 'true', 'aria-label': titre },
    h('header.feuille-entete',
      h('button.bouton-icone', { type: 'button', 'aria-label': 'Fermer', onclick: fermer }, '✕'),
      h('h2', titre),
      actions ?? h('span.espace-icone')),
    corps);
  ajouter(corps, [construire(fermer)]);
  document.getElementById('feuilles').append(feuille);
  feuille.surFermeture = surFermeture;
  pile.push(feuille);
  document.body.classList.add('feuille-ouverte');
  return fermer;
}

export function fermerToutesFeuilles() {
  for (const f of [...pile]) { f.surFermeture?.(); f.remove(); }
  pile.length = 0;
  document.body.classList.remove('feuille-ouverte');
}

// Boîte de confirmation (remplace window.confirm, plus lisible sur mobile).
export function confirmer(message, { ok = 'Confirmer', annuler = 'Annuler', danger = false } = {}) {
  return new Promise(resoudre => {
    const fond = h('div.boite-fond');
    const fermer = v => { fond.remove(); resoudre(v); };
    fond.append(h('div.boite', { role: 'alertdialog', 'aria-modal': 'true' },
      h('p', message),
      h('div.boite-actions',
        h('button.bouton.secondaire', { type: 'button', onclick: () => fermer(false) }, annuler),
        h('button.bouton', { type: 'button', class: danger ? 'danger' : '', onclick: () => fermer(true) }, ok))));
    document.body.append(fond);
  });
}

// ------------------------------------------------------------ Champs de formulaire

export function champ(libelle, controle, aide = null) {
  return h('label.champ', h('span.champ-libelle', libelle), controle, aide && h('span.champ-aide', aide));
}

export function texte(nom, valeur = '', attrs = {}) {
  return h('input', { type: 'text', name: nom, value: valeur ?? '', autocomplete: 'off', 'data-1p-ignore': true, 'data-lpignore': 'true', 'data-form-type': 'other', ...attrs });
}

// Zone de texte libre : ni autoremplissage du navigateur (adresse e-mail, contacts…), ni gestionnaire de mots de passe.
export function zoneTexte(nom, valeur = '', attrs = {}) {
  return h('textarea', {
    name: nom, rows: 3, autocomplete: 'off', autocapitalize: 'sentences', spellcheck: true,
    'data-1p-ignore': true, 'data-lpignore': 'true', 'data-bwignore': true, 'data-form-type': 'other', ...attrs,
  }, valeur ?? '');
}

export function nombre(nom, valeur, attrs = {}) {
  return h('input', {
    type: 'text', inputMode: 'decimal', name: nom, autocomplete: 'off',
    value: valeur === null || valeur === undefined ? '' : String(valeur).replace('.', ','), ...attrs,
  });
}

export function date(nom, valeur, attrs = {}) {
  return h('input', { type: 'date', name: nom, value: valeur ?? '', ...attrs });
}

export function selection(nom, options, valeur, attrs = {}) {
  return h('select', { name: nom, ...attrs },
    options.map(o => h('option', { value: o.id, selected: o.id === valeur }, o.libelle)));
}

export function interrupteur(nom, coche, libelle) {
  return h('label.interrupteur', h('input', { type: 'checkbox', name: nom, checked: !!coche }), h('span', libelle));
}

// Puces à choix multiple : renvoie l'élément ; lecture via lirePuces(el).
export function puces(nom, options, choisis = []) {
  return h('div.puces', { 'data-puces': nom },
    options.map(o => h('label.puce',
      h('input', { type: 'checkbox', value: o.id, checked: choisis.includes(o.id) }),
      h('span', o.libelle))));
}
export const lirePuces = el => [...el.querySelectorAll('input:checked')].map(i => i.value);

// Durée en heures / minutes / secondes.
export function duree(nom, secondes, { avecSecondes = true } = {}) {
  const v = secondesVersHms(secondes);
  const morceau = (suffixe, val, unite, max) => h('span.duree-morceau',
    h('input', { type: 'text', inputMode: 'numeric', name: `${nom}_${suffixe}`, value: val === '' ? '' : String(val), placeholder: '0', maxLength: max, 'aria-label': unite, autocomplete: 'off' }),
    h('span', unite));
  return h('div.duree', { 'data-duree': nom },
    morceau('h', v.h, 'h', 2), morceau('m', v.m, 'min', 2), avecSecondes && morceau('s', v.s, 's', 2));
}

export function lireDuree(form, nom) {
  const val = s => form.querySelector(`[name="${nom}_${s}"]`)?.value ?? '';
  return hmsVersSecondes(val('h'), val('m'), val('s'));
}

// Ressenti de 1 à 5.
export function ressenti(nom, valeur) {
  const libelles = ['Très dur', 'Dur', 'Correct', 'Bien', 'Excellent'];
  return h('div.ressenti', { role: 'radiogroup' },
    [1, 2, 3, 4, 5].map(n => h('label.ressenti-choix',
      h('input', { type: 'radio', name: nom, value: n, checked: valeur === n }),
      h('span.ressenti-note', String(n)),
      h('span.ressenti-libelle', libelles[n - 1]))));
}

export function lireRessenti(form, nom) {
  const v = form.querySelector(`[name="${nom}"]:checked`)?.value;
  return v ? Number(v) : null;
}

// Note de douleur de 0 à 10 (boutons radio). `vide` : libellé d'un choix « sans note » (champ facultatif).
export function echelle(nom, valeurInitiale, { vide = null, libelle = '' } = {}) {
  const niveau = n => (n <= 2 ? 'bas' : n <= 4 ? 'moyen' : 'haut');
  return h('div.echelle', { role: 'radiogroup', 'aria-label': libelle },
    vide && h('label.echelle-vide',
      h('input', { type: 'radio', name: nom, value: '', checked: valeurInitiale === null || valeurInitiale === undefined }),
      h('span', vide)),
    h('div.echelle-notes', Array.from({ length: 11 }, (_, n) => h('label.echelle-choix', { 'data-niveau': niveau(n) },
      h('input', { type: 'radio', name: nom, value: n, checked: valeurInitiale === n, 'aria-label': `${n} sur 10` }),
      h('span', String(n))))),
    h('div.echelle-reperes', { 'aria-hidden': 'true' }, h('span', 'Aucune'), h('span', 'Maximale')));
}

export function lireEchelle(form, nom) {
  const v = form.querySelector(`[name="${nom}"]:checked`)?.value;
  return v === undefined || v === '' ? null : Number(v);
}

export const valeur = (form, nom) => form.elements[nom]?.value ?? '';
export const valeurNombre = (form, nom) => lireNombre(valeur(form, nom));
export const coche = (form, nom) => !!form.elements[nom]?.checked;

// Exécute une action asynchrone en affichant l'erreur métier éventuelle.
export async function tenter(action, zoneErreur = null) {
  try {
    if (zoneErreur) zoneErreur.textContent = '';
    return await action();
  } catch (e) {
    // Les erreurs de saisie (règles métier) sont affichées à l'utilisateur, pas journalisées.
    if (!(e instanceof ErreurMetier)) console.error(e);
    const message = e?.message || 'Une erreur est survenue.';
    if (zoneErreur) {
      zoneErreur.textContent = message;
      zoneErreur.scrollIntoView({ block: 'center', behavior: 'smooth' });
    } else toast(message, { erreur: true });
    return undefined;
  }
}
