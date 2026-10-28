import * as M from '../magasin.js';
import * as D from '../domaine.js';
import * as F from '../format.js';
import * as U from '../ui.js';
import { ouvrirObjectif, ouvrirResultat } from './formulaires.js';

const { h } = U;

function descriptionDistances(o) {
  if (o.sport === 'triathlon') {
    return [o.natationM && `${o.natationM} m`, o.veloKm && `${F.nombre(o.veloKm)} km`, o.courseKm && `${F.nombre(o.courseKm)} km`]
      .filter(Boolean).join(' / ');
  }
  return o.distanceKm ? `${F.nombre(o.distanceKm, 2)} km` : '';
}

function carteObjectif(o, auj) {
  const jours = F.ecartJours(auj, o.dateEpreuve);
  const echeance = o.statut === 'termine' ? null
    : jours > 0 ? `J-${jours}` : jours === 0 ? 'Jour J' : 'Passée';
  const infos = [D.libelleTypeObjectif(o), descriptionDistances(o), o.deniveleM && `D+ ${o.deniveleM} m`].filter(Boolean).join(' · ');

  const actions = [];
  if (o.statut === 'a_demarrer') {
    actions.push(h('button.bouton', {
      type: 'button',
      onclick: async () => {
        if (!(await U.confirmer(`Démarrer l'objectif « ${o.nom} » ? Il passera « En cours » à partir d'aujourd'hui et les séances réalisées y seront rattachées.`, { ok: 'Démarrer' }))) return;
        if (await U.tenter(async () => { await M.demarrerObjectif(o.id); return true; })) U.toast('Objectif démarré 💪');
      },
    }, 'Démarrer l\'objectif'));
  }
  if (o.statut === 'en_cours') actions.push(h('button.bouton', { type: 'button', onclick: () => ouvrirResultat(o.id) }, 'Terminer'));
  actions.push(h('button.bouton.secondaire', { type: 'button', onclick: () => ouvrirObjectif({ id: o.id }) }, 'Modifier'));

  const r = o.resultat;
  return h('article.carte.objectif', { 'data-statut': o.statut },
    h('div.objectif-tete',
      h('div', h('h3', o.nom), h('p.objectif-infos', infos)),
      echeance && h('span.etiquette', { class: jours < 0 ? 'etiquette-ratee' : '' }, echeance)),
    h('p.objectif-dates',
      `Épreuve : ${F.dateFr(o.dateEpreuve)}`,
      o.dateDemarrage && ` · démarré le ${F.dateFr(o.dateDemarrage)}`,
      o.tempsViseS && ` · objectif ${F.chrono(o.tempsViseS)}`),
    r && h('div.resultat',
      h('strong', 'Résultat : '),
      [r.tempsS && F.chrono(r.tempsS), r.classement && `classement ${r.classement}`, r.ressenti && `ressenti ${r.ressenti}/5`].filter(Boolean).join(' · ') || 'saisi',
      r.commentaire && h('p', r.commentaire)),
    h('div.actions-carte', actions));
}

export function ecranObjectifs() {
  const auj = F.aujourdhui();
  const groupes = [
    ['en_cours', 'En cours'],
    ['a_demarrer', 'À démarrer'],
    ['termine', 'Terminés'],
  ];
  const tri = (a, b) => a.dateEpreuve.localeCompare(b.dateEpreuve);
  return h('div.ecran',
    h('header.entete-ecran', h('h1', 'Objectifs')),
    h('button.bouton.large', { type: 'button', onclick: () => ouvrirObjectif() }, '＋ Nouvel objectif'),
    M.etat.objectifs.length === 0 && h('p.vide.carte', 'Aucun objectif pour l\'instant. Créez votre premier objectif : un 10 km, un marathon, un triathlon…'),
    groupes.map(([statut, titre]) => {
      const liste = M.etat.objectifs.filter(o => o.statut === statut).sort(statut === 'termine' ? (a, b) => tri(b, a) : tri);
      return liste.length > 0 && h('section.groupe', h('h2.titre-groupe', `${titre} (${liste.length})`), liste.map(o => carteObjectif(o, auj)));
    }));
}
