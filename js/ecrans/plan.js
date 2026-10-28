import * as M from '../magasin.js';
import * as D from '../domaine.js';
import * as F from '../format.js';
import { h } from '../ui.js';
import { ouvrirPrevue, ouvrirDetailPrevue, libellePrevue } from './formulaires.js';
import { capitaliser } from './accueil.js';

const libelleEtat = id => D.ETATS_PREVUE.find(e => e.id === id)?.libelle ?? id;

export function ecranPlan() {
  const auj = F.aujourdhui();
  const lundi = F.lundiDe(auj);
  const trier = (a, b) => a.date.localeCompare(b.date) || a.creeLe - b.creeLe;
  const enRetard = M.etat.prevues.filter(p => p.date < auj && p.etat === 'a_faire').sort(trier);
  const avenir = M.etat.prevues.filter(p => p.date >= lundi).sort(trier);

  const semaines = new Map();
  for (const p of avenir) {
    const l = F.lundiDe(p.date);
    if (!semaines.has(l)) semaines.set(l, []);
    semaines.get(l).push(p);
  }

  const ligne = p => h('button.ligne-seance', { type: 'button', class: `etat-${p.etat}`, onclick: () => ouvrirDetailPrevue(p.id) },
    h('span.ligne-icone', D.discipline(p.discipline).icone),
    h('span.ligne-texte',
      h('strong', capitaliser(F.dateCourte(p.date))),
      h('span', libellePrevue(p))),
    h('span.etiquette', { class: `etiquette-${p.etat}` }, libelleEtat(p.etat)));

  return h('div.ecran',
    h('header.entete-ecran', h('h1', 'Plan'), h('p.sous-titre', 'Séances prévues')),
    h('p.bandeau-info', 'La génération automatique du plan par l\'IA arrive au lot 2. Vous pouvez ajouter des séances prévues à la main.'),
    h('button.bouton.large', { type: 'button', onclick: () => ouvrirPrevue() }, '＋ Ajouter une séance prévue'),
    enRetard.length > 0 && h('section.carte',
      h('h2', 'En retard'), h('p.aide', 'Séances passées encore « à faire » : indiquez si elles ont été faites ou ratées.'),
      enRetard.map(ligne)),
    semaines.size === 0
      ? h('p.vide.carte', 'Aucune séance prévue à partir de cette semaine.')
      : [...semaines].map(([l, liste]) => h('section.carte',
        h('h2', l === lundi ? 'Cette semaine' : `Semaine du ${F.dateCourte(l)}`),
        liste.map(ligne))));
}
