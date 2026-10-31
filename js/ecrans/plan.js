import * as M from '../magasin.js';
import * as D from '../domaine.js';
import * as F from '../format.js';
import { h } from '../ui.js';
import { ouvrirPrevue, ouvrirDetailPrevue, libellePrevue } from './formulaires.js';
import { ouvrirPlanIa } from './planIa.js';
import { phaseDuJour } from '../ia.js';
import * as S from '../soin.js';
import { ouvrirSeanceSoin, libelleSeanceSoin, LIBELLES_ETAT_SOIN } from './soin.js';

// Seules les premières semaines sont affichées d'emblée (un plan complet peut en compter plus de 20).
const SEMAINES_VISIBLES = 4;
let toutAfficher = false;

const libelleEtat = id => D.ETATS_PREVUE.find(e => e.id === id)?.libelle ?? id;

export function ecranPlan() {
  const auj = F.aujourdhui();
  const lundi = F.lundiDe(auj);
  const trier = (a, b) => a.date.localeCompare(b.date) || a.creeLe - b.creeLe;
  // Séances d'entraînement et séances de soin (repérées par `blessureId`), affichées ensemble.
  const toutes = [...M.etat.prevues, ...M.etat.seancesSoin];
  const enRetard = toutes.filter(p => p.date < auj && p.etat === 'a_faire').sort(trier);
  const avenir = toutes.filter(p => p.date >= lundi).sort(trier);

  const semaines = new Map();
  for (const p of avenir) {
    const l = F.lundiDe(p.date);
    if (!semaines.has(l)) semaines.set(l, []);
    semaines.get(l).push(p);
  }

  const ligneSoin = x => h('button.ligne-seance.ligne-soin', { type: 'button', class: `etat-${x.etat}`, onclick: () => ouvrirSeanceSoin(x.id) },
    h('span.ligne-icone.icone-soin', '✚'),
    h('span.ligne-texte',
      h('strong', F.capitaliser(F.dateCourte(x.date))),
      h('span', `Soin · ${libelleSeanceSoin(x)}`)),
    h('span.etiquette', { class: `etiquette-${x.etat}` }, LIBELLES_ETAT_SOIN[x.etat]));

  const ligne = p => p.blessureId ? ligneSoin(p) : h('button.ligne-seance', { type: 'button', class: `etat-${p.etat}`, onclick: () => ouvrirDetailPrevue(p.id) },
    h('span.ligne-icone', D.discipline(p.discipline).icone),
    h('span.ligne-texte',
      h('strong', F.capitaliser(F.dateCourte(p.date))),
      h('span', libellePrevue(p))),
    p.source === 'ia' && h('span.etiquette.etiquette-ia', { title: 'Séance générée par l\'IA' }, 'IA'),
    h('span.etiquette', { class: `etiquette-${p.etat}` }, libelleEtat(p.etat)));

  const enCours = M.etat.objectifs.filter(o => o.statut === 'en_cours');
  const meta = M.etat.plan;
  const phase = phaseDuJour(meta, auj);
  const cartePlan = h('section.carte',
    h('h2', 'Plan IA'),
    meta
      ? [h('p.aide', `Généré le ${F.dateHeureFr(meta.genereLe)}${meta.modele ? ` (${meta.modele})` : ''}.`),
        phase && h('p', h('strong', `Phase actuelle : ${phase.nom}`), ` · jusqu'au ${F.dateCourte(phase.fin)}`, phase.description && h('span.aide', ` — ${phase.description}`)),
        meta.analyse && h('details', h('summary', 'Analyse du coach'), h('p.texte-analyse', meta.analyse)),
        meta.phases?.length > 0 && h('details', h('summary', 'Phases du plan'),
          h('ul.liste-phases', meta.phases.map(x => h('li', h('strong', F.capitaliser(x.nom)), ` · ${F.dateCourte(x.debut)} → ${F.dateCourte(x.fin)}`))))]
      : h('p.aide', enCours.length
        ? 'Aucun plan généré pour l\'instant.'
        : 'Démarrez un objectif pour que l\'IA génère votre plan.'),
    S.suivisActifs(M.etat.blessures).map(s => h('a.soin-plan', { href: `#/soin/${s.id}` },
      `🩹 ${S.nomSuivi(s)} en phase ${s.phase} « ${S.phaseDe(s).nom} » : la course est limitée dans le plan.`,
      meta && !S.planAJour(meta, M.etat.blessures) ? ' Le plan a été calculé pour une autre phase : recalculez-le.' : '')),
    enCours.length > 0 && h('button.bouton.large', { type: 'button', onclick: () => ouvrirPlanIa() }, meta ? 'Recalculer le plan' : 'Générer le plan'));

  return h('div.ecran',
    h('header.entete-ecran', h('h1', 'Plan'), h('p.sous-titre', 'Séances prévues')),
    cartePlan,
    h('button.bouton.large.secondaire', { type: 'button', onclick: () => ouvrirPrevue() }, '＋ Ajouter une séance à la main'),
    enRetard.length > 0 && h('section.carte',
      h('h2', 'En retard'), h('p.aide', 'Séances passées encore « à faire » : indiquez si elles ont été faites ou ratées.'),
      enRetard.map(ligne)),
    semaines.size === 0
      ? h('p.vide.carte', 'Aucune séance prévue à partir de cette semaine.')
      : [...semaines].slice(0, toutAfficher ? undefined : SEMAINES_VISIBLES).map(([l, liste]) => h('section.carte',
        h('h2', l === lundi ? 'Cette semaine' : `Semaine du ${F.jourMois(l)}`),
        liste.map(ligne))),
    !toutAfficher && semaines.size > SEMAINES_VISIBLES && h('button.bouton.large.secondaire', {
      type: 'button',
      onclick: () => { toutAfficher = true; document.getElementById('principal').replaceChildren(ecranPlan()); },
    }, `Afficher les ${semaines.size - SEMAINES_VISIBLES} semaines suivantes`));
}
