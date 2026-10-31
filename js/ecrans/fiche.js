// Fiche d'un exercice de soin (bibliothèque js/exercices.js, ou fiche fournie par une IA) : schéma, objectif, matériel,
// position de départ, étapes, sensation, erreurs, adaptation si douleur. S'ouvre d'un tap sur un exercice, y compris
// pendant la séance guidée (le chrono continue dessous).
import * as X from '../exercices.js';
import { avecCote } from '../soin.js';
import * as U from '../ui.js';

const { h } = U;

// Élément SVG à partir du schéma (texte produit par js/exercices.js, jamais par une IA).
function schema(svg) {
  const div = h('div.fiche-schema');
  div.innerHTML = svg;
  return div;
}

const utile = v => (Array.isArray(v) ? v.length > 0 : !!v && v !== '—');

// Contenu de la fiche (`e` : exercice du programme, avec `fiche` ou `details`).
export function contenuFiche(e, cote) {
  const f = X.ficheDe(e);
  const t = v => avecCote(v, cote);
  return h('div.fiche-corps',
    schema(f.schema ?? X.ICONE_GENERIQUE),
    !f.bibliotheque && h('p.aide.fiche-source', 'Exercice proposé par une IA, sans schéma.'),
    f.nomBibliotheque && f.nomBibliotheque !== f.nom && h('p.aide', `Fiche : ${f.nomBibliotheque}`),
    utile(f.objectif) && h('p.fiche-objectif', h('strong', 'Objectif : '), t(f.objectif)),
    f.cible && h('p.aide', `Cible : ${f.cible}`),
    utile(f.materiel) && [h('h4', 'Matériel'), h('ul', f.materiel.map(x => h('li', t(x))))],
    f.consignes.length > 0 && [h('h4', 'Dans ce programme'), h('ul', f.consignes.map(x => h('li', t(x))))],
    utile(f.depart) && [h('h4', 'Position de départ'), h('p', t(f.depart))],
    utile(f.etapes) && [h('h4', 'Étapes'), h('ol', f.etapes.map(x => h('li', t(x))))],
    utile(f.sensation) && [h('h4', 'Sensation attendue et intensité'), h('p', t(f.sensation))],
    utile(f.respiration) && [h('h4', 'Respiration'), h('p', t(f.respiration))],
    utile(f.erreurs) && [h('h4', 'Erreurs fréquentes'), h('ul', f.erreurs.map(x => h('li', t(x))))],
    utile(f.adaptation) && h('div.fiche-douleur', h('h4', 'Si douleur'), h('p', t(f.adaptation))),
    (utile(f.facile) || utile(f.difficile)) && h('p.aide',
      utile(f.facile) && [h('strong', 'Plus facile : '), t(f.facile)], utile(f.facile) && utile(f.difficile) && h('br'),
      utile(f.difficile) && [h('strong', 'Plus difficile : '), t(f.difficile)]));
}

export function ouvrirFiche(e, cote) {
  if (!e) return;
  U.ouvrirFeuille(avecCote(e.nom, cote), fermer => h('div.fiche',
    contenuFiche(e, cote),
    h('button.bouton.large.secondaire', { type: 'button', onclick: fermer }, 'Fermer la fiche')));
}

// Bouton « ? » qui ouvre la fiche.
export function boutonFiche(e, cote, nom = e?.nom) {
  return h('button.bouton-fiche', {
    type: 'button',
    'aria-label': `Fiche de l'exercice ${avecCote(nom ?? '', cote)}`,
    onclick: ev => { ev.stopPropagation(); ouvrirFiche(e, cote); },
  }, '?');
}

// Exercice touchable dans une liste : tout l'élément ouvre la fiche (le « ? » le signale).
export function exerciceTouchable(e, cote, ...contenu) {
  return h('button.exercice-touchable', { type: 'button', onclick: () => ouvrirFiche(e, cote) },
    h('span.exercice-touchable-texte', ...contenu),
    h('span.bouton-fiche', { 'aria-hidden': 'true' }, '?'));
}
