import * as M from '../magasin.js';
import * as D from '../domaine.js';
import * as F from '../format.js';
import * as U from '../ui.js';
import { ouvrirSaisieRealisee } from './formulaires.js';

const { h } = U;

// Filtres conservés le temps de la session.
const filtres = { discipline: '', objectifId: '' };

export function ecranHistorique() {
  const conteneur = h('div.zone');
  const dessiner = () => {
    const liste = D.filtrerRealisees(M.etat.realisees, filtres);
    const semaines = D.totauxParSemaine(liste);
    U.vider(conteneur,
      semaines.length === 0
        ? h('p.vide.carte', M.etat.realisees.length ? 'Aucune séance ne correspond à ces filtres.' : 'Aucune séance réalisée pour l\'instant. Utilisez le bouton « ＋ Séance » de l\'accueil.')
        : semaines.map(s => h('section.carte',
          h('div.semaine-tete',
            h('h2', `Semaine du ${F.dateCourte(s.lundi)}`),
            h('span.semaine-total', `${s.nb} séance${s.nb > 1 ? 's' : ''} · ${F.duree(s.dureeS)}`)),
          h('p.semaine-disciplines', Object.entries(s.parDiscipline).map(([d, v]) =>
            `${D.discipline(d).icone} ${v.nb} · ${F.duree(v.dureeS)}${v.distanceKm ? ` · ${F.distance(v.distanceKm, d)}` : ''}`).join('   ')),
          s.seances.map(r => {
            const a = D.allure(r);
            return h('button.ligne-seance', { type: 'button', onclick: () => ouvrirSaisieRealisee({ id: r.id }) },
              h('span.ligne-icone', D.discipline(r.discipline).icone),
              h('span.ligne-texte',
                h('strong', F.capitaliser(F.dateCourte(r.date))),
                h('span', [F.duree(r.dureeS), r.distanceKm && F.distance(r.distanceKm, r.discipline), a?.texte].filter(Boolean).join(' · ')),
                r.notes && h('span.ligne-notes', r.notes)),
              r.ressenti && h('span.etiquette', { title: 'Ressenti' }, `${r.ressenti}/5`));
          }))));
  };

  const filtreDiscipline = U.selection('discipline', [{ id: '', libelle: 'Toutes disciplines' }, ...D.DISCIPLINES], filtres.discipline,
    { onchange: e => { filtres.discipline = e.target.value; dessiner(); }, 'aria-label': 'Filtrer par discipline' });
  const objectifs = [...M.etat.objectifs].sort((a, b) => b.dateEpreuve.localeCompare(a.dateEpreuve));
  if (filtres.objectifId && !M.objectif(filtres.objectifId)) filtres.objectifId = '';
  const filtreObjectif = U.selection('objectif', [{ id: '', libelle: 'Tous objectifs' }, ...objectifs.map(o => ({ id: o.id, libelle: o.nom }))], filtres.objectifId,
    { onchange: e => { filtres.objectifId = e.target.value; dessiner(); }, 'aria-label': 'Filtrer par objectif' });

  dessiner();
  return h('div.ecran',
    h('header.entete-ecran', h('h1', 'Historique')),
    h('div.filtres', filtreDiscipline, filtreObjectif),
    conteneur);
}
