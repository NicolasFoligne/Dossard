// Suivi de blessure : carte verte de l'accueil, écran du suivi (#/soin), bilan du jour, création du suivi.
import * as M from '../magasin.js';
import * as S from '../soin.js';
import * as F from '../format.js';
import * as U from '../ui.js';
import { ouvrirPlanIa } from './planIa.js';
import { ouvrirAjoutBlessure } from './blessure.js';
import { ouvrirSeanceGuidee } from './seanceGuidee.js';

const { h } = U;

const zoneErreur = () => h('p.erreur', { role: 'alert' });
const note = v => (v === null || v === undefined ? '–' : `${v}/10`);
const objectifsEnCours = () => M.etat.objectifs.some(o => o.statut === 'en_cours');

function sousTitrePhase(s, date) {
  const p = S.phaseDe(s);
  return `Phase ${p.numero}/${S.programme(s.programme).phases.length} · ${p.nom} · semaine ${S.semaineDansPhase(s, date)}`;
}

function resumeBilan(b) {
  const parties = [`Réveil ${note(b.raideurMatin)}`, `marche ${note(b.douleurMarche)}`, `escaliers ${note(b.douleurEscaliers)}`];
  if (b.douleurCourse !== null) parties.push(`course ${note(b.douleurCourse)}`);
  return parties.join(' · ');
}

function listeAlertes(alertes) {
  return alertes.length > 0 && h('div.alertes-soin', alertes.map(a => h('p.alerte', { class: `alerte-${a.niveau}` },
    h('span.alerte-icone', a.niveau === 'danger' ? '⛔' : '⚠️'), h('span', a.message))));
}

// Exercices cochés pour la journée : ceux du bilan, plus ceux d'une séance de soin marquée « faite ».
function exercicesFaits(s, date) {
  const bilan = S.bilanDuJour(s, M.etat.bilans, date);
  const seance = M.etat.seancesSoin.find(x => x.blessureId === s.id && x.date === date);
  return new Set([...(bilan?.exercices ?? []), ...(seance?.etat === 'faite' ? seance.exercices.map(e => e.id) : [])]);
}

export const LIBELLES_ETAT_SOIN = { a_faire: 'À faire', faite: 'Faite', ratee: 'Ratée' };

// « Comment faire » : consignes détaillées d'un exercice (fiche du programme), repliées par défaut.
export function ficheExercice(e, cote) {
  const d = e?.details;
  if (!d) return e?.consignes?.length ? h('ul.fiche-consignes', e.consignes.map(c => h('li', S.avecCote(c, cote)))) : null;
  const t = v => S.avecCote(v, cote);
  const utile = v => v && v !== '—';
  return h('details.fiche',
    h('summary', 'Comment faire'),
    h('div.fiche-corps',
      e.consignes?.length > 0 && h('ul.fiche-consignes', e.consignes.map(c => h('li', t(c)))),
      utile(d.depart) && [h('h4', 'Position de départ'), h('p', t(d.depart))],
      d.etapes?.length > 0 && [h('h4', 'Étapes'), h('ol', d.etapes.map(x => h('li', t(x))))],
      utile(d.respiration) && [h('h4', 'Respiration'), h('p', t(d.respiration))],
      utile(d.sensation) && [h('h4', 'Ce que vous devez ressentir'), h('p', t(d.sensation))],
      d.erreurs?.length > 0 && [h('h4', 'Erreurs fréquentes'), h('ul', d.erreurs.map(x => h('li', t(x))))],
      (utile(d.facile) || utile(d.difficile)) && h('p.aide',
        utile(d.facile) && [h('strong', 'Plus facile : '), t(d.facile)], utile(d.facile) && utile(d.difficile) && h('br'),
        utile(d.difficile) && [h('strong', 'Plus difficile : '), t(d.difficile)])));
}

// Exercice complet (fiche, rythme) d'une séance de soin, retrouvé dans la phase du programme.
const exerciceDuProgramme = (s, numeroPhase, id) => (s ? S.phaseDe(s, numeroPhase)?.exercices.find(e => e.id === id) : null) ?? null;
const seanceDuJourSoin = (s, date) => M.etat.seancesSoin.find(x => x.blessureId === s.id && x.date === date) ?? null;

// Libellé court d'une séance de soin (planning).
export function libelleSeanceSoin(x) {
  const s = M.suivi(x.blessureId);
  return `${s ? S.nomSuivi(s) : 'Soin'} · ${x.exercices.length} exercice${x.exercices.length > 1 ? 's' : ''}`;
}

// Détail d'une séance de soin : exercices du jour et changement d'état (reporté dans le bilan du jour).
export function ouvrirSeanceSoin(id) {
  const x = M.seanceSoin(id);
  if (!x) return;
  const s = M.suivi(x.blessureId);
  const phase = s ? S.phaseDe(s, x.phase) : null;
  const changer = (etat, fermer, message) => async () => {
    if (await U.tenter(async () => { await M.changerEtatSeanceSoin(x.id, etat); return true; })) { fermer(); U.toast(message); }
  };
  U.ouvrirFeuille('Séance de soin', fermer => h('div.detail.detail-soin',
    h('p.detail-date', F.dateLongue(x.date)),
    h('p.detail-titre', s ? S.nomSuivi(s) : 'Soin'),
    h('p.detail-meta', [phase && `Phase ${phase.numero} « ${phase.nom} »`, `semaine ${x.semaine}`, `État : ${LIBELLES_ETAT_SOIN[x.etat]}`].filter(Boolean).join(' · ')),
    h('ul.soin-exercices', x.exercices.map(e => h('li', { class: x.etat === 'faite' ? 'fait' : '' },
      h('span.soin-coche', { 'aria-hidden': 'true' }, x.etat === 'faite' ? '✓' : '○'),
      h('span', h('strong', e.nom), h('span.soin-dosage', e.dosage), ficheExercice(exerciceDuProgramme(s, x.phase, e.id), s?.cote))))),
    h('button.bouton.large.bouton-soin', { type: 'button', onclick: () => ouvrirSeanceGuidee(x.id) }, '▶ Commencer la séance guidée'),
    h('p.aide', 'Séance obligatoire, en plus de l\'entraînement : elle ne dépend pas du semainier. Passer la séance à « Faite » coche ses exercices dans le bilan du jour.'),
    h('div.actions-formulaire',
      x.etat !== 'faite' && h('button.bouton.large.bouton-soin', { type: 'button', onclick: changer('faite', fermer, 'Séance de soin faite ✓') }, 'Marquer faite'),
      x.etat === 'a_faire' && h('button.bouton.secondaire', { type: 'button', onclick: changer('ratee', fermer, 'Séance de soin marquée ratée') }, 'Marquer ratée'),
      x.etat !== 'a_faire' && h('button.bouton.secondaire', { type: 'button', onclick: changer('a_faire', fermer, 'Séance de soin remise à faire') }, 'Remettre à faire'),
      s && h('a.bouton.secondaire', { href: `#/soin/${s.id}` }, 'Voir le suivi'))));
}

// ------------------------------------------------------------ Carte de l'accueil

export function carteSoinAccueil() {
  const auj = F.aujourdhui();
  const actifs = S.suivisActifs(M.etat.blessures);
  if (!actifs.length) {
    return h('a.lien-soin', { href: '#/soin' }, h('span', '🩹'), h('span', 'Suivi de blessure'), h('span.chevron', '›'));
  }
  return actifs.map(s => {
    const bilan = S.bilanDuJour(s, M.etat.bilans, auj);
    const seance = S.seanceDuJour(s, auj);
    const passage = S.criteresPassage(s, M.etat.bilans, auj);
    const faits = exercicesFaits(s, auj);
    return h('section.carte.carte-soin', { 'aria-label': `Suivi ${S.nomSuivi(s)}` },
      h('a.soin-tete', { href: `#/soin/${s.id}` },
        h('span.soin-icone', { 'aria-hidden': 'true' }, '🩹'),
        h('span.ligne-texte', h('strong', S.nomSuivi(s)), h('span', sousTitrePhase(s, auj))),
        h('span.chevron', '›')),
      listeAlertes(S.alertesSoin(s, M.etat.bilans, auj)),
      !S.planAJour(M.etat.plan, M.etat.blessures) && h('a.alerte.alerte-attention', { href: '#/plan' },
        h('span.alerte-icone', '⚠️'), h('span', `Le plan d'entraînement ne tient pas compte de la phase ${s.phase} : recalculez-le.`)),
      h('ul.soin-exercices', seance.exercices.filter(e => !e.facultatif).map(e => h('li', { class: faits.has(e.id) ? 'fait' : e.repos ? 'repos' : '' },
        h('span.soin-coche', { 'aria-hidden': 'true' }, faits.has(e.id) ? '✓' : e.repos ? '–' : '○'),
        h('span', h('strong', e.nom), h('span.soin-dosage', e.repos && !faits.has(e.id) ? 'Repos aujourd\'hui (un jour sur deux)' : e.dosage))))),
      seanceDuJourSoin(s, auj) && h('button.bouton.large.bouton-soin', { type: 'button', onclick: () => ouvrirSeanceGuidee(seanceDuJourSoin(s, auj).id) }, '▶ Séance guidée'),
      passage.pret && h('a.soin-pret', { href: `#/soin/${s.id}` },
        passage.suivante ? `✓ Critères remplis : passer en phase ${passage.suivante.numero} ?` : '✓ Critères remplis : fin du programme ?'),
      bilan
        ? h('button.ligne-bilan', { type: 'button', onclick: () => ouvrirBilan({ suiviId: s.id, id: bilan.id }) },
          h('span', h('strong', 'Bilan du jour fait'), h('span', resumeBilan(bilan))), h('span.chevron', '›'))
        : h('button.bouton.large.bouton-soin', { type: 'button', onclick: () => ouvrirBilan({ suiviId: s.id }) }, 'Faire le bilan du jour'));
  });
}

// ------------------------------------------------------------ Écran du suivi

export function ecranSoin(sous) {
  const actifs = S.suivisActifs(M.etat.blessures);
  // #/soin : le suivi en cours s'il est unique ; #/soin/liste : toujours la liste ; #/soin/<id> : ce suivi.
  const choisi = sous && sous !== 'liste' ? M.suivi(sous) : !sous && actifs.length === 1 ? actifs[0] : null;
  if (choisi) return ecranSuivi(choisi);

  const termines = M.etat.blessures.filter(s => s.statut === 'termine').sort((a, b) => b.fin.localeCompare(a.fin));
  const ligne = s => h('a.ligne-seance', { href: `#/soin/${s.id}` },
    h('span.ligne-icone.icone-soin', '🩹'),
    h('span.ligne-texte', h('strong', S.nomSuivi(s)),
      h('span', s.statut === 'termine' ? `Du ${F.dateFr(s.debut)} au ${F.dateFr(s.fin)}` : sousTitrePhase(s, F.aujourdhui()))),
    h('span.chevron', '›'));

  return h('div.ecran',
    enteteRetour('Suivi de blessure', '#/accueil'),
    actifs.length > 0 && h('section.carte.carte-soin', h('h2', 'En cours'), actifs.map(ligne)),
    !actifs.length && h('section.carte.carte-soin',
      h('h2', 'Programme de soin'),
      h('p', 'Suivez une blessure à part de vos séances : exercices du jour, bilan quotidien de la douleur, critères de passage d\'une phase à l\'autre.'),
      h('p.aide', 'Le plan d\'entraînement IA tient compte de la phase en cours (course limitée ou suspendue).')),
    h('button.bouton.large.bouton-soin', { type: 'button', onclick: () => ouvrirAjoutBlessure() }, '＋ Ajouter une blessure'),
    termines.length > 0 && h('section.carte', h('h2', 'Suivis terminés'), termines.map(ligne)),
    programmesPerso());
}

// Programmes personnels (proposés par une IA) : supprimables s'ils ne servent à aucun suivi.
function programmesPerso() {
  const perso = S.tousLesProgrammes().filter(p => p.source === 'ia');
  if (!perso.length) return null;
  return h('section.carte', h('h2', 'Mes programmes'),
    h('p.aide', 'Programmes proposés par une IA et importés. Ils apparaissent dans le choix des blessures.'),
    perso.map(p => {
      const utilise = M.etat.blessures.some(s => s.programme === p.id);
      return h('div.ligne-programme',
        h('span.ligne-texte', h('strong', p.libelle), h('span', `${p.phases.length} phases${utilise ? ' · utilisé par un suivi' : ''}`)),
        !utilise && h('button.bouton.secondaire.petit.danger-texte', {
          type: 'button',
          onclick: async () => {
            if (!(await U.confirmer(`Supprimer le programme « ${p.libelle} » ?`, { ok: 'Supprimer', danger: true }))) return;
            if (await U.tenter(async () => { await M.supprimerProgrammePerso(p.id); return true; })) { U.toast('Programme supprimé'); location.hash = '#/soin/liste'; }
          },
        }, 'Supprimer'));
    }));
}

function enteteRetour(titre, retour, sousTitre = null) {
  return h('header.entete-ecran.avec-retour',
    h('a.bouton-icone', { href: retour, 'aria-label': 'Retour' }, '‹'),
    h('div', h('h1', titre), sousTitre && h('p.sous-titre', sousTitre)));
}

function ecranSuivi(s) {
  const auj = F.aujourdhui();
  const prog = S.programme(s.programme);
  const enCours = s.statut === 'en_cours';
  const bilans = S.bilansDe(s, M.etat.bilans);
  const bilan = S.bilanDuJour(s, M.etat.bilans, auj);
  const seance = S.seanceDuJour(s, auj);
  const passage = S.criteresPassage(s, M.etat.bilans, auj);
  const faits = exercicesFaits(s, auj);
  const phase = S.phaseDe(s);

  const progression = h('div.soin-phases', { role: 'img', 'aria-label': `Phase ${s.phase} sur 3` },
    prog.phases.map(p => h('div.soin-phase', { class: p.numero < s.phase ? 'passee' : p.numero === s.phase ? 'actuelle' : '' },
      h('span.soin-phase-barre'), h('span.soin-phase-nom', `${p.numero}. ${p.nom}`))));

  return h('div.ecran.ecran-soin',
    enteteRetour(S.nomSuivi(s), M.etat.blessures.length > 1 ? '#/soin/liste' : '#/accueil',
      enCours ? `Depuis le ${F.dateFr(s.debut)}` : `Terminé le ${F.dateFr(s.fin)}`),

    h('section.carte.carte-soin',
      progression,
      enCours
        ? h('p', h('strong', sousTitrePhase(s, auj)), h('span.aide', ` — ${phase.but}`))
        : h('p', 'Programme terminé. ', h('span.aide', prog.entretien)),
      enCours && listeAlertes(S.alertesSoin(s, M.etat.bilans, auj)),
      enCours && !S.planAJour(M.etat.plan, M.etat.blessures) && h('a.alerte.alerte-attention', { href: '#/plan' },
        h('span.alerte-icone', '⚠️'), h('span', `Le plan d'entraînement a été calculé pour une autre phase : recalculez-le dans l'onglet Plan.`))),

    enCours && h('section.carte.carte-soin',
      h('h2', 'Aujourd\'hui'),
      seance.exercices.map(e => h('details.exercice', { class: faits.has(e.id) ? 'fait' : '' },
        h('summary',
          h('span.soin-coche', { 'aria-hidden': 'true' }, faits.has(e.id) ? '✓' : e.repos ? '–' : '○'),
          h('span.ligne-texte', h('strong', e.nom),
            h('span', e.repos && !faits.has(e.id) ? `Repos aujourd'hui · ${e.frequence}` : `${e.dosage} · ${e.frequence}`))),
        h('div.exercice-corps',
          h('p.aide', `Cible : ${e.cible}`),
          ficheExercice({ ...e, consignes: e.consignes }, s.cote)))),
      seanceDuJourSoin(s, auj) && h('button.bouton.large.bouton-soin', { type: 'button', onclick: () => ouvrirSeanceGuidee(seanceDuJourSoin(s, auj).id) }, '▶ Séance guidée'),
      h('p.soin-course', h('strong', '🏃 Course : '), phase.course.texte),
      phase.conseils.map(c => h('p.aide', `💡 ${S.avecCote(c, s.cote)}`)),
      bilan
        ? h('button.ligne-bilan', { type: 'button', onclick: () => ouvrirBilan({ suiviId: s.id, id: bilan.id }) },
          h('span', h('strong', 'Bilan du jour fait'), h('span', resumeBilan(bilan))), h('span.chevron', '›'))
        : h('button.bouton.large.bouton-soin', { type: 'button', onclick: () => ouvrirBilan({ suiviId: s.id }) }, 'Faire le bilan du jour')),

    enCours && h('section.carte',
      h('h2', passage.suivante ? `Passage en phase ${passage.suivante.numero} « ${passage.suivante.nom} »` : 'Fin du programme'),
      h('ul.criteres', passage.criteres.map(c => h('li', { class: c.ok ? 'ok' : '' },
        h('span.critere-coche', { 'aria-hidden': 'true' }, c.ok ? '✓' : '○'),
        h('span', h('span.critere-libelle', c.libelle), h('span.critere-valeur', c.valeur)),
        h('span.visuellement-cache', c.ok ? 'rempli' : 'non rempli')))),
      !passage.criteres.find(c => c.id === 'test')?.ok && passage.criteres.some(c => c.id === 'test')
      && h('p.aide', `Le « ${prog.test?.nom ?? 'test'} » se saisit dans le bilan du jour.`),
      passage.pret
        ? h('button.bouton.large.bouton-soin', { type: 'button', onclick: () => (passage.suivante ? passerPhase(s, passage.suivante) : terminer(s, true)) },
          passage.suivante ? `Passer en phase ${passage.suivante.numero}` : 'Terminer le programme')
        : h('p.aide', 'L\'application vous proposera le passage quand tous les critères seront remplis.'),
      s.phase > 1 && h('button.bouton.secondaire.petit', { type: 'button', onclick: () => passerPhase(s, S.phaseDe(s, s.phase - 1), true) },
        `Revenir en phase ${s.phase - 1}`)),

    h('section.carte',
      h('h2', 'Raideur au réveil'),
      graphiqueRaideur(bilans, auj)),

    h('section.carte',
      h('div.semaine-tete', h('h2', 'Journal'), h('span.aide', `${bilans.length} bilan${bilans.length > 1 ? 's' : ''}`)),
      bilans.length
        ? [...bilans].reverse().slice(0, 14).map(b => ligneBilan(s, b))
        : h('p.vide', 'Aucun bilan pour l\'instant.'),
      bilans.length > 14 && h('details', h('summary', 'Bilans plus anciens'), [...bilans].reverse().slice(14).map(b => ligneBilan(s, b)))),

    h('section.carte',
      h('h2', 'Programme complet'),
      detailProgramme(prog, s.cote, enCours ? s.phase : null)),

    h('section.carte',
      h('h2', 'Règles de sécurité'),
      h('h3', 'Pilotage par la douleur'), h('ul', prog.regleDouleur.map(r => h('li', r))),
      h('h3', 'À éviter'), h('ul', prog.aEviter.map(r => h('li', r))),
      h('div.soin-urgence', h('h3', '⛔ Consultez sans attendre en cas de\u00a0:'), h('ul', prog.consulter.map(r => h('li', r)))),
      h('p.aide', prog.avisMedical)),

    h('div.actions-carte',
      h('button.bouton.secondaire', { type: 'button', onclick: () => ouvrirSuivi(s.id) }, 'Modifier'),
      enCours && h('button.bouton.secondaire', { type: 'button', onclick: () => terminer(s, false) }, 'Terminer le suivi'),
      h('button.bouton.secondaire.danger-texte', { type: 'button', onclick: () => supprimer(s) }, 'Supprimer')));
}

// Phases, exercices dosés, règles de course et critères d'un programme. `phaseOuverte` : phase dépliée.
export function detailProgramme(prog, cote, phaseOuverte = null) {
  return [
    h('p.aide', prog.description),
    prog.phases.map(p => h('details.phase-programme', { open: p.numero === phaseOuverte },
      h('summary', `Phase ${p.numero} · ${p.nom} (${p.dureeMinSem} à ${p.dureeMaxSem} semaines)`),
      h('div.exercice-corps',
        h('p', p.but),
        p.exercices.map(e => h('div.programme-exercice',
          h('strong', S.avecCote(e.nom, cote)), h('span.aide', ` · ${e.frequence}${e.facultatif ? ' · facultatif' : ''}`),
          ficheExercice(e, cote),
          h('p.aide', 'Progression : ' + e.dosage.map((d, i) => (d ? `sem. ${i + 1}${i === e.dosage.length - 1 && e.dosage.length > 1 ? '+' : ''} : ${S.avecCote(d, cote)}` : null)).filter(Boolean).join(' · ')))),
        h('p', h('strong', 'Course : '), p.course.texte),
        p.conseils.map(c => h('p.aide', `💡 ${S.avecCote(c, cote)}`)),
        h('p', h('strong', 'Critères pour passer à la suite : ')),
        h('ul', p.criteres.map(c => h('li', S.avecCote(c.libelle, cote))))))),
    prog.test && h('p.aide', h('strong', `${prog.test.nom} : `), S.avecCote(prog.test.consigne, cote)),
    prog.entretien && h('p.aide', prog.entretien),
  ];
}

function ligneBilan(s, b) {
  return h('button.ligne-seance', { type: 'button', onclick: () => ouvrirBilan({ suiviId: s.id, id: b.id }) },
    h('span.ligne-icone.icone-soin', String(b.raideurMatin)),
    h('span.ligne-texte',
      h('strong', F.capitaliser(F.dateCourte(b.date))),
      h('span', resumeBilan(b)),
      b.notes && h('span.ligne-notes', b.notes)),
    h('span.chevron', '›'));
}

// Barres de la raideur au réveil sur les 28 derniers jours (un seul indicateur : pas de légende).
function graphiqueRaideur(bilans, auj) {
  const debut = F.ajouterJours(auj, -27);
  const recents = bilans.filter(b => b.date >= debut && b.date <= auj);
  if (!recents.length) return h('p.vide', 'Faites un bilan chaque matin : la courbe apparaîtra ici.');
  const L = 320, H = 132, G = 22, B = 18, pas = (L - G) / 28;
  const y = v => 8 + (H - 8 - B) * (1 - v / 10);
  const ns = 'http://www.w3.org/2000/svg';
  const el = (tag, attrs, ...enfants) => {
    const e = document.createElementNS(ns, tag);
    for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
    enfants.forEach(x => e.append(x));
    return e;
  };
  const svg = el('svg', { viewBox: `0 0 ${L} ${H}`, class: 'graphique', role: 'img',
    'aria-label': `Raideur au réveil sur 28 jours, dernier bilan ${recents.at(-1).raideurMatin} sur 10` });
  for (const v of [0, 5, 10]) {
    svg.append(el('line', { x1: G, x2: L, y1: y(v), y2: y(v), class: v === 0 ? 'axe' : 'grille' }));
    svg.append(el('text', { x: G - 6, y: y(v) + 4, class: 'graduation', 'text-anchor': 'end' }, String(v)));
  }
  for (const b of recents) {
    const i = F.ecartJours(debut, b.date);
    const x = G + i * pas + 1, l = pas - 2, haut = y(b.raideurMatin), bas = y(0);
    const hauteur = Math.max(bas - haut, 1.5);
    const r = Math.min(2, l / 2, hauteur);
    // Barre arrondie en haut, ancrée sur l'axe.
    const d = `M${x},${bas} V${bas - hauteur + r} Q${x},${bas - hauteur} ${x + r},${bas - hauteur} H${x + l - r} Q${x + l},${bas - hauteur} ${x + l},${bas - hauteur + r} V${bas} Z`;
    svg.append(el('g', { class: 'barre-soin' },
      el('title', {}, `${F.capitaliser(F.dateCourte(b.date))} : ${b.raideurMatin}/10`),
      el('rect', { x: G + i * pas, y: 0, width: pas, height: H - B, class: 'cible' }),
      el('path', { d })));
  }
  svg.append(el('text', { x: G, y: H - 4, class: 'graduation' }, F.jourMois(debut)));
  svg.append(el('text', { x: L, y: H - 4, class: 'graduation', 'text-anchor': 'end' }, 'Aujourd\'hui'));
  const sept = recents.filter(b => b.date > F.ajouterJours(auj, -7)).map(b => b.raideurMatin);
  const moy = sept.length ? F.nombre(sept.reduce((a, b) => a + b, 0) / sept.length) : null;
  return [svg, h('p.aide', `Dernier bilan : ${recents.at(-1).raideurMatin}/10${moy !== null ? ` · moyenne sur 7 jours : ${moy}/10` : ''}. Objectif : une courbe qui descend.`)];
}

// ------------------------------------------------------------ Actions

async function passerPhase(s, cible, retour = false) {
  const message = retour
    ? `Revenir en phase ${cible.numero} « ${cible.nom} » ? À faire si la douleur repart à la hausse malgré l'allègement.`
    : `Passer en phase ${cible.numero} « ${cible.nom} » à partir d'aujourd'hui ?`;
  if (!(await U.confirmer(message, { ok: retour ? 'Revenir' : 'Passer' }))) return;
  const ok = await U.tenter(() => M.changerPhaseSuivi(s.id, cible.numero));
  if (!ok) return;
  U.toast(`Phase ${cible.numero} « ${cible.nom} » commencée`);
  if (objectifsEnCours() && await U.confirmer('Recalculer maintenant le plan d\'entraînement avec les règles de course de cette phase ?', { ok: 'Recalculer', annuler: 'Plus tard' })) {
    ouvrirPlanIa();
  }
}

async function terminer(s, gueri) {
  const message = gueri
    ? `Tous les critères sont remplis : terminer le programme ? ${S.programme(s.programme)?.entretien ?? ''}`.trim()
    : 'Terminer ce suivi ? Le plan d\'entraînement n\'en tiendra plus compte.';
  if (!(await U.confirmer(message, { ok: 'Terminer' }))) return;
  const ok = await U.tenter(() => M.terminerSuivi(s.id));
  if (!ok) return;
  U.toast(gueri ? 'Programme terminé, bravo 👏' : 'Suivi terminé');
  if (objectifsEnCours() && await U.confirmer('Recalculer le plan d\'entraînement sans les restrictions de course ?', { ok: 'Recalculer', annuler: 'Plus tard' })) {
    ouvrirPlanIa();
  }
}

async function supprimer(s) {
  if (!(await U.confirmer(`Supprimer le suivi « ${S.nomSuivi(s)} » et tous ses bilans ?`, { ok: 'Supprimer', danger: true }))) return;
  await U.tenter(() => M.supprimerSuivi(s.id));
  location.hash = '#/accueil';
  U.toast('Suivi supprimé');
}

// ------------------------------------------------------------ Création / modification du suivi

export function ouvrirSuivi(id = null, programmeId = null) {
  const existant = id ? M.suivi(id) : null;
  U.ouvrirFeuille(existant ? 'Modifier le suivi' : 'Nouveau suivi de blessure', fermer => {
    const erreur = zoneErreur();
    const form = h('form.formulaire', { novalidate: true, autocomplete: 'off' });
    let prog = S.programme(existant?.programme ?? programmeId) ?? S.PROGRAMMES[0];
    const description = h('p.aide', prog.description);
    const avis = h('p.bandeau-info', prog.avisMedical);
    const choixPhase = h('div.zone');
    const dessinerPhases = () => U.vider(choixPhase, !existant && U.champ('Phase de départ',
      U.selection('phase', prog.phases.map(p => ({ id: String(p.numero), libelle: `${p.numero}. ${p.nom}` })), '1'),
      'Commencez par la phase 1 si la douleur est encore présente au quotidien.'));
    const programmes = S.tousLesProgrammes().map(p => ({ id: p.id, libelle: p.source === 'ia' ? `${p.libelle} (programme personnel)` : p.libelle }));
    form.append(
      U.champ('Programme', U.selection('programme', programmes, prog.id, {
        disabled: !!existant,
        onchange: e => { prog = S.programme(e.target.value); description.textContent = prog.description; avis.textContent = prog.avisMedical; dessinerPhases(); },
      })),
      description,
      h('fieldset.champ', h('legend.champ-libelle', 'Côté atteint'),
        h('div.puces.puces-uniques', { role: 'radiogroup' }, S.COTES.map(c => h('label.puce',
          h('input', { type: 'radio', name: 'cote', value: c.id, checked: (existant?.cote ?? '') === c.id }),
          h('span', c.libelle))))),
      U.champ('Date de début', U.date('debut', existant?.debut ?? F.aujourdhui(), { max: F.aujourdhui() })),
      choixPhase,
      U.champ('Notes', U.zoneTexte('notes', existant?.notes ?? '', { placeholder: 'Antécédents, avis médical, examens…' })),
      avis,
      erreur,
      h('div.actions-formulaire', h('button.bouton.large.bouton-soin', { type: 'submit' }, existant ? 'Enregistrer' : 'Démarrer le suivi')));
    dessinerPhases();

    form.addEventListener('submit', async e => {
      e.preventDefault();
      const donnees = {
        programme: existant?.programme ?? U.valeur(form, 'programme'),
        cote: form.querySelector('[name="cote"]:checked')?.value ?? '',
        debut: U.valeur(form, 'debut'),
        phase: Number(U.valeur(form, 'phase') || 1),
        notes: U.valeur(form, 'notes'),
      };
      const r = await U.tenter(() => (existant ? M.modifierSuivi(existant.id, donnees) : M.creerSuivi(donnees)), erreur);
      if (!r) return;
      fermer();
      U.toast(existant ? 'Suivi modifié' : 'Suivi démarré');
      if (!existant) {
        location.hash = `#/soin/${r.id}`;
        if (objectifsEnCours() && await U.confirmer('Recalculer le plan d\'entraînement pour tenir compte de ce suivi (course limitée) ?', { ok: 'Recalculer', annuler: 'Plus tard' })) {
          ouvrirPlanIa();
        }
      }
    });
    return form;
  });
}

// ------------------------------------------------------------ Bilan du jour

export function ouvrirBilan({ suiviId, id = null, date = null }) {
  const s = M.suivi(suiviId);
  const existant = id ? M.bilan(id) : null;
  const auj = F.aujourdhui();
  const depart = existant ?? { date: date ?? auj, exercices: [] };

  U.ouvrirFeuille(existant ? 'Modifier le bilan' : 'Bilan du jour', fermer => {
    const erreur = zoneErreur();
    const form = h('form.formulaire.formulaire-soin', { novalidate: true, autocomplete: 'off' });
    const zoneExercices = h('div.zone');
    const avant = S.criteresPassage(s, M.etat.bilans, auj).pret;

    const dessinerExercices = () => {
      const d = U.valeur(form, 'date') || depart.date;
      const seance = S.seanceDuJour(s, d);
      // Nouveau bilan : on part des exercices cochés à l'écran, ou de ceux d'une séance de soin déjà marquée « faite ».
      const saisis = [...zoneExercices.querySelectorAll('input:checked')].map(i => i.value);
      const coches = existant ? depart.exercices : saisis.length ? saisis : [...exercicesFaits(s, d)];
      U.vider(zoneExercices, h('fieldset.champ', h('legend.champ-libelle', 'Exercices faits'),
        U.puces('exercices', seance.exercices.map(e => ({ id: e.id, libelle: e.nom })), coches)));
    };

    const champNote = (c, aide = null) => h('fieldset.champ', h('legend.champ-libelle', c.libelle),
      U.echelle(c.id, depart[c.id], { vide: c.vide ?? null, libelle: c.libelle }), aide && h('span.champ-aide', aide));
    const champs = Object.fromEntries(S.CHAMPS_DOULEUR.map(c => [c.id, c]));
    const prog = S.programme(s.programme);
    // Douleur aux sautillements : demandée si la phase en parle (critère ou exercice), ou si elle a déjà été notée.
    const phase = S.phaseDe(s);
    const avecSautillements = phase.criteres.some(c => c.champ === 'douleurSautillements') || phase.exercices.some(e => e.id.includes('saut'))
      || (depart.douleurSautillements !== null && depart.douleurSautillements !== undefined);
    const testRenseigne = depart.testMonteesNb !== null && depart.testMonteesNb !== undefined;

    form.append(
      U.champ('Date', U.date('date', depart.date, { max: auj, min: s.debut, onchange: dessinerExercices })),
      champNote(champs.raideurMatin, 'Aux premiers pas du matin.'),
      champNote(champs.douleurMarche),
      champNote(champs.douleurEscaliers),
      champNote(champs.douleurCourse, 'Pendant la course ou le soir même.'),
      zoneExercices,
      champNote(champs.douleurExercices, 'Règle : ≤ 4/10.'),
      avecSautillements && champNote(champs.douleurSautillements),
      prog.test && h('details.test-montees', { open: testRenseigne },
        h('summary', `${prog.test.nom} (facultatif)`),
        h('div.formulaire',
          h('p.aide', S.avecCote(prog.test.consigne, s.cote)),
          U.champ(`Résultat (${prog.test.unite})`, U.nombre('testMonteesNb', depart.testMonteesNb ?? null, { inputMode: 'numeric', placeholder: 'ex. 15' })),
          h('fieldset.champ', h('legend.champ-libelle', 'Douleur pendant le test'),
            U.echelle('testMonteesDouleur', depart.testMonteesDouleur ?? null, { vide: 'Non testé', libelle: 'Douleur pendant le test' })))),
      U.champ('Notes', U.zoneTexte('notes', depart.notes ?? '', { placeholder: 'Charge utilisée, sensations, chaussures…' })),
      erreur,
      h('div.actions-formulaire',
        h('button.bouton.large.bouton-soin', { type: 'submit' }, 'Enregistrer'),
        existant && h('button.bouton.secondaire.danger-texte', {
          type: 'button',
          onclick: async () => {
            if (!(await U.confirmer('Supprimer ce bilan ?', { ok: 'Supprimer', danger: true }))) return;
            await U.tenter(() => M.supprimerBilan(existant.id));
            fermer();
            U.toast('Bilan supprimé');
          },
        }, 'Supprimer')));
    dessinerExercices();

    form.addEventListener('submit', async e => {
      e.preventDefault();
      const nb = U.valeurNombre(form, 'testMonteesNb');
      const donnees = {
        id: existant?.id,
        blessureId: s.id,
        date: U.valeur(form, 'date'),
        exercices: U.lirePuces(zoneExercices),
        testMonteesNb: nb,
        testMonteesDouleur: U.lireEchelle(form, 'testMonteesDouleur'),
        notes: U.valeur(form, 'notes'),
      };
      for (const c of S.CHAMPS_DOULEUR) donnees[c.id] = U.lireEchelle(form, c.id);
      const ok = await U.tenter(() => M.enregistrerBilan(donnees), erreur);
      if (!ok) return;
      fermer();
      const apres = S.criteresPassage(M.suivi(s.id), M.etat.bilans, auj);
      U.toast(apres.pret && !avant
        ? (apres.suivante ? `✓ Critères remplis : vous pouvez passer en phase ${apres.suivante.numero}` : '✓ Critères de fin de programme remplis')
        : 'Bilan enregistré');
    });
    return form;
  });
}
