import * as M from '../magasin.js';
import * as D from '../domaine.js';
import * as F from '../format.js';
import { h } from '../ui.js';
import { ouvrirSaisieRealisee, ouvrirDetailPrevue, libellePrevue } from './formulaires.js';
import { phaseDuJour } from '../ia.js';
import { carteSoinAccueil, ouvrirSeanceSoin, libelleSeanceSoin, LIBELLES_ETAT_SOIN } from './soin.js';
import * as S from '../soin.js';

export function alertesCourantes() {
  return D.alertes({
    objectifs: M.etat.objectifs,
    semainier: M.etat.semainier,
    aujourdhui: F.aujourdhui(),
    derniereSauvegarde: M.etat.appareil.derniereSauvegarde ?? null,
    premiereUtilisation: M.etat.appareil.premiereUtilisation ?? null,
    aDesDonnees: M.aDesDonnees(),
  });
}

const cibleAlerte = { epreuve_passee: '#/objectifs', delai_court: '#/objectifs', semainier_jours: '#/reglages/semainier', semainier_disciplines: '#/reglages/semainier', sauvegarde: '#/reglages/sauvegarde' };

export function ecranAccueil() {
  const auj = F.aujourdhui();
  const alertes = alertesCourantes();
  const sem = D.semaine(F.lundiDe(auj), M.etat.prevues, M.etat.realisees);
  const prochaine = D.prochaineSeance(M.etat.prevues, auj);
  const phase = phaseDuJour(M.etat.plan, auj);
  const enCours = M.etat.objectifs.filter(o => o.statut === 'en_cours').sort((a, b) => a.dateEpreuve.localeCompare(b.dateEpreuve));
  // Séances de soin de la semaine : affichées et comptées à part de l'entraînement.
  const fin = F.ajouterJours(sem.lundi, 6);
  const soinSemaine = M.etat.seancesSoin.filter(x => x.date >= sem.lundi && x.date <= fin);
  const soin = S.compteSoin(soinSemaine);

  return h('div.ecran',
    h('header.entete-ecran', h('h1', 'Dossard'), h('p.sous-titre', F.capitaliser(F.dateLongue(auj)))),

    alertes.length > 0 && h('section.alertes', { 'aria-label': 'Alertes' },
      alertes.map(a => h('a.alerte', { href: cibleAlerte[a.code] ?? '#/', class: `alerte-${a.niveau}` },
        h('span.alerte-icone', a.niveau === 'danger' ? '⛔' : a.niveau === 'info' ? '💾' : '⚠️'),
        h('span', a.message)))),

    S.suivisActifs(M.etat.blessures).length > 0 && carteSoinAccueil(),

    h('section.carte',
      h('div.semaine-tete', h('h2', 'Cette semaine'), phase && h('span.etiquette', `Phase ${phase.nom}`)),
      h('div.semaine', sem.jours.map(j => h('div.jour', { class: j.date === auj ? 'jour-auj' : '' },
        h('span.jour-nom', F.jourCourt(j.date)),
        h('span.jour-num', String(F.depuisIso(j.date).getDate())),
        h('div.jour-seances',
          j.prevues.map(p => h('button.pastille', {
            type: 'button', class: `pastille-prevue etat-${p.etat}`, title: libellePrevue(p),
            'aria-label': `Prévue : ${libellePrevue(p)}`, onclick: () => ouvrirDetailPrevue(p.id),
          }, D.discipline(p.discipline).icone)),
          j.realisees.filter(r => !r.prevueId || !j.prevues.some(p => p.id === r.prevueId)).map(r => h('button.pastille.pastille-faite', {
            type: 'button', 'aria-label': `Réalisée : ${D.discipline(r.discipline).libelle}`,
            onclick: () => ouvrirSaisieRealisee({ id: r.id }),
          }, D.discipline(r.discipline).icone)),
          soinSemaine.filter(x => x.date === j.date).map(x => h('button.pastille.pastille-soin', {
            type: 'button', class: `etat-${x.etat}`, title: libelleSeanceSoin(x),
            'aria-label': `Soin (${LIBELLES_ETAT_SOIN[x.etat].toLowerCase()}) : ${libelleSeanceSoin(x)}`, onclick: () => ouvrirSeanceSoin(x.id),
          }, x.etat === 'faite' ? '✓' : x.etat === 'ratee' ? '✕' : '✚')))))),
      h('div.bilan-semaine',
        h('div', h('span.bilan-libelle', 'Prévu'), h('strong', `${sem.prevu.nb} séance${sem.prevu.nb > 1 ? 's' : ''}`), sem.prevu.dureeS > 0 && h('span', F.duree(sem.prevu.dureeS))),
        h('div', h('span.bilan-libelle', 'Réalisé'), h('strong', `${sem.realise.nb} séance${sem.realise.nb > 1 ? 's' : ''}`), sem.realise.dureeS > 0 && h('span', F.duree(sem.realise.dureeS))),
        soin.nb > 0 && h('div.bilan-soin', h('span.bilan-libelle', 'Soin'), h('strong', `${soin.faites}/${soin.nb} faite${soin.faites > 1 ? 's' : ''}`), h('span', 'hors plafond')))),

    h('section.carte',
      h('h2', 'Prochaine séance'),
      prochaine
        ? h('button.ligne-seance', { type: 'button', onclick: () => ouvrirDetailPrevue(prochaine.id) },
          h('span.ligne-icone', D.discipline(prochaine.discipline).icone),
          h('span.ligne-texte',
            h('strong', prochaine.date === auj ? 'Aujourd\'hui' : F.capitaliser(F.dateCourte(prochaine.date))),
            h('span', libellePrevue(prochaine))),
          h('span.chevron', '›'))
        : h('p.vide', 'Aucune séance prévue. ', h('a', { href: '#/plan' }, 'Générer ou compléter le plan'))),

    h('section.carte',
      h('h2', 'Objectifs en cours'),
      enCours.length
        ? enCours.map(o => carteAvancement(o, auj))
        : h('p.vide', 'Aucun objectif en cours. ', h('a', { href: '#/objectifs' }, 'Voir mes objectifs'))),

    !S.suivisActifs(M.etat.blessures).length && carteSoinAccueil(),

    h('button.fab', { type: 'button', onclick: () => ouvrirSaisieRealisee(), 'aria-label': 'Saisir une séance réalisée' },
      h('span', { 'aria-hidden': 'true' }, '＋'), h('span', 'Séance')));
}

function carteAvancement(o, auj) {
  const a = D.avancement(o, M.etat.realisees, auj);
  const restant = a.joursRestants === 0 ? 'C\'est le jour J !'
    : a.joursRestants < 0 ? 'Épreuve passée'
      : `J-${a.joursRestants} · ${a.semainesRestantes} semaine${a.semainesRestantes > 1 ? 's' : ''}`;
  const volumes = Object.entries(a.parDiscipline).map(([d, v]) =>
    `${D.discipline(d).icone} ${v.distanceKm ? F.distance(v.distanceKm, d) : F.duree(v.dureeS)}`);
  return h('a.avancement', { href: '#/objectifs' },
    h('div.avancement-tete', h('strong', o.nom), h('span', restant)),
    h('div.barre', { role: 'progressbar', 'aria-valuenow': a.pctTemps, 'aria-valuemin': 0, 'aria-valuemax': 100, 'aria-label': 'Temps de préparation écoulé' },
      h('span', { style: { width: `${a.pctTemps}%` } })),
    h('p.avancement-detail', `${a.pctTemps} % de la préparation · ${a.nbSeances} séance${a.nbSeances > 1 ? 's' : ''}`
      + (a.dureeS ? ` · ${F.duree(a.dureeS)}` : '')),
    volumes.length > 0 && h('p.avancement-volumes', volumes.join('   ')));
}

