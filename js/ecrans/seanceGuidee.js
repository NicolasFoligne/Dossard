// Séance de soin guidée : enchaîne exercices, séries et repos avec minuteur, tempo et compteur ; bips 3-2-1, bip de départ,
// bips des 3 dernières secondes et bip de fin, annonces vocales, vibration ; à la fin, propose de marquer la séance faite
// (reporté dans le bilan du jour). Le chrono repose sur l'horodatage (Date.now) : il reste juste si l'onglet ralentit.
import * as M from '../magasin.js';
import * as S from '../soin.js';
import * as G from '../seance-guidee.js';
import * as X from '../exercices.js';
import * as U from '../ui.js';
import { creerSignaux, garderEcranAllume, vibrationDisponible } from '../signaux.js';
import { ouvrirFiche, boutonFiche, exerciceTouchable } from './fiche.js';

const { h } = U;

const mmss = s => `${Math.floor(Math.max(0, s) / 60)}:${String(Math.max(0, s) % 60).padStart(2, '0')}`;

export const NOTE_SILENCIEUX = 'Sur iPhone, désactivez le mode silencieux pour entendre les sons.';

// Réglages de la séance guidée (sur le téléphone, jamais exportés).
export const preferencesSeance = () => ({ voix: true, bips: true, vibration: true, repos: {}, ...M.etat.appareil.preferencesSeance });

// Exercices de la séance avec leur exercice de programme (fiche) et leur rythme complet.
function exercicesDeLaSeance(x) {
  const s = M.suivi(x.blessureId);
  const phase = s ? S.phaseDe(s, x.phase) : null;
  return x.exercices.map(e => {
    const p = phase?.exercices.find(q => q.id === e.id) ?? null;
    return { ...e, fiche: p?.fiche ?? null, seance: X.seanceDe(p), programme: p ?? { nom: e.nom } };
  });
}

// Pas du réglage du repos entre séries.
const PAS_REPOS = 15;
const REPOS_MAX = 300;

export function ouvrirSeanceGuidee(seanceId) {
  const x = M.seanceSoin(seanceId);
  if (!x) return;
  const cote = M.suivi(x.blessureId)?.cote;
  const exercices = exercicesDeLaSeance(x);
  const prefs = preferencesSeance();
  const signaux = creerSignaux(prefs);
  const enregistrer = () => M.enregistrerPreferencesSeance(JSON.parse(JSON.stringify(prefs))).catch(() => {});

  let etapes = [];
  let minuterie = null;
  let libererEcran = null;
  let i = 0;
  let debutMs = 0; // début de l'étape en cours (horodatage)
  let pauseMs = null; // début de la pause, ou null
  let compte = 0;
  let manuel = false;
  let dernier = null; // dernière seconde ou dernière phase signalée
  let suivanteDite = false; // annonce de la série suivante faite pendant la pause en cours
  let annoncee = -1; // étape de travail déjà annoncée pendant la pause qui la précède
  let debutSeance = 0;
  let surVisibilite = null;

  const arreter = () => {
    clearInterval(minuterie);
    minuterie = null;
    signaux.fermer();
    libererEcran?.();
    libererEcran = null;
    if (surVisibilite) document.removeEventListener('visibilitychange', surVisibilite);
  };

  U.ouvrirFeuille('Séance guidée', fermer => {
    const zone = h('div.seance-guidee');
    // Éléments mis à jour à chaque tic (le reste est redessiné à chaque étape).
    const grand = h('div.minuteur-grand', { 'aria-live': 'off' });
    const phaseTexte = h('div.minuteur-phase', { 'aria-live': 'polite' });
    const barre = h('span');
    const boutonPause = h('button.bouton.secondaire', { type: 'button', onclick: () => basculerPause() }, '⏸ Pause');

    const ecoule = () => ((pauseMs ?? Date.now()) - debutMs) / 1000;
    const programmeDe = e => exercices[e.exercice.index - 1]?.programme;

    // Entrée dans l'étape `i` (son début `debutMs` est déjà fixé).
    const entrerEtape = () => {
      const e = etapes[i];
      compte = 0;
      manuel = false;
      dernier = null;
      suivanteDite = false;
      if (G.PAUSES.has(e.type)) {
        signaux.parler(e.annonce);
        // Pause courte : la série suivante est annoncée tout de suite ; sinon, quelques secondes avant la fin.
        if (e.suivante && e.dureeS <= 12) { signaux.parler(e.suivante); suivanteDite = true; annoncee = i + 1; }
      } else {
        signaux.signal('depart');
        if (annoncee !== i) signaux.parler(e.annonce);
      }
      dessinerEtape();
      tic();
    };
    // Fin naturelle d'une étape de travail : bip de fin.
    const finTravail = e => { if (!G.PAUSES.has(e.type) && e.type !== 'libre') signaux.signal('fin'); };
    // Passage manuel (bouton, compteur atteint) à l'étape suivante.
    const suivant = ({ naturel = false } = {}) => {
      if (naturel) finTravail(etapes[i]);
      i++;
      debutMs = Date.now();
      if (pauseMs !== null) pauseMs = debutMs;
      if (i >= etapes.length) terminer(); else entrerEtape();
    };
    const precedent = () => {
      if (ecoule() < 3 && i > 0) i--;
      annoncee = -1;
      debutMs = Date.now();
      if (pauseMs !== null) pauseMs = debutMs;
      entrerEtape();
    };
    const basculerPause = () => {
      if (pauseMs === null) {
        pauseMs = Date.now();
        signaux.taire();
        boutonPause.textContent = '▶ Reprendre';
        phaseTexte.textContent = 'En pause';
      } else {
        debutMs += Date.now() - pauseMs;
        pauseMs = null;
        boutonPause.textContent = '⏸ Pause';
        dernier = null;
        tic();
      }
    };
    const compter = () => {
      compte++;
      signaux.signal('repetition');
      const e = etapes[i];
      grand.textContent = `${compte} / ${e.reps}`;
      if (compte >= e.reps) suivant({ naturel: true });
    };

    const tic = () => {
      if (pauseMs !== null || i >= etapes.length) return;
      // Rattrapage : étapes minutées terminées pendant que l'onglet dormait (seul le dernier changement est signalé).
      if (G.estMinutee(etapes[i], manuel)) {
        const r = G.rattraper(etapes, i, debutMs, Date.now());
        if (r.i !== i) {
          finTravail(etapes[r.i - 1]);
          i = r.i;
          debutMs = r.debutMs;
          if (r.fini) { terminer(); return; }
          entrerEtape();
          return;
        }
      }
      const e = etapes[i];
      const t = ecoule();
      if (e.type === 'tenue' || G.PAUSES.has(e.type)) {
        const reste = Math.ceil(e.dureeS - t);
        grand.textContent = mmss(reste);
        barre.style.width = `${Math.min(100, (t / e.dureeS) * 100)}%`;
        if (G.PAUSES.has(e.type) && e.suivante && !suivanteDite && reste <= 8) {
          suivanteDite = true;
          annoncee = i + 1;
          signaux.parler(e.suivante);
        }
        if (reste !== dernier) {
          if (reste <= 3 && reste > 0 && dernier !== null) signaux.signal(G.PAUSES.has(e.type) ? 'compte' : 'dernieres');
          dernier = reste;
        }
      } else if (e.type === 'tempo' && !manuel) {
        const p = G.positionTempo(e.phases, e.reps, t);
        grand.textContent = `${p.rep} / ${e.reps}`;
        phaseTexte.textContent = `${p.libelle} · ${Math.ceil(p.resteS)} s`;
        barre.style.width = `${Math.min(100, (t / G.dureeEtape(e)) * 100)}%`;
        const cle = `${p.rep}-${p.phase}`;
        if (cle !== dernier) {
          // Le premier mouvement suit le bip de départ ; la voix donne ensuite le rythme (ou un bip si elle est coupée).
          if (dernier !== null || annoncee === i) {
            if (prefs.voix) signaux.parler(p.libelle, { couper: true }); else signaux.signal(p.phase === 0 ? 'tempoHaut' : 'tempoBas');
          }
          dernier = cle;
        }
      }
    };

    const dessinerEtape = () => {
      const e = etapes[i];
      const ex = e.exercice;
      const prog = programmeDe(e);
      const enPause = G.PAUSES.has(e.type);
      phaseTexte.textContent = e.libelle ?? '';
      barre.style.width = '0%';
      const actions = [];
      if (e.type === 'compteur' || (e.type === 'tempo' && manuel)) {
        grand.textContent = `${compte} / ${e.reps}`;
        phaseTexte.textContent = 'Touchez le bouton à chaque répétition';
        actions.push(h('button.bouton.large.bouton-soin.minuteur-plus', { type: 'button', onclick: compter }, '＋1'),
          h('button.bouton.secondaire', { type: 'button', onclick: () => suivant({ naturel: true }) }, 'Série terminée'));
      } else if (e.type === 'tempo') {
        actions.push(h('button.bouton.secondaire.petit', { type: 'button', onclick: () => { manuel = true; dessinerEtape(); } }, 'Je compte moi-même'));
      } else if (e.type === 'libre') {
        grand.textContent = '✓';
        phaseTexte.textContent = 'À votre rythme';
        actions.push(h('button.bouton.large.bouton-soin', { type: 'button', onclick: () => suivant() }, 'C\'est fait'));
      }
      // Exercice affiché : pendant une transition, celui qui arrive.
      const affiche = e.type === 'transition' ? etapes[i + 1] : e;
      const progAffiche = programmeDe(affiche) ?? prog;
      U.vider(zone,
        h('p.aide', `Exercice ${affiche.exercice.index} / ${ex.total} · étape ${i + 1} / ${etapes.length}`),
        h('div.minuteur-titre',
          h('button.minuteur-exercice', { type: 'button', onclick: () => ouvrirFiche(progAffiche, cote) },
            e.type === 'transition' ? `Suivant : ${e.suivant}` : ex.nom),
          boutonFiche(progAffiche, cote, affiche.exercice.nom)),
        h('p.minuteur-dosage', affiche.exercice.dosage),
        affiche.series > 1 && h('p.minuteur-serie', `Série ${affiche.serie} / ${affiche.series}${affiche.cote ? ` · ${affiche.cote}` : ''}`),
        h('div.minuteur-cadran', { class: `minuteur-${e.type}${enPause ? ' minuteur-pause' : ''}` }, grand, phaseTexte, h('div.barre', barre)),
        actions,
        h('div.minuteur-commandes',
          h('button.bouton.secondaire', { type: 'button', onclick: precedent, 'aria-label': 'Recommencer l\'étape ou revenir à la précédente' }, '⏮'),
          boutonPause,
          h('button.bouton.secondaire', { type: 'button', onclick: () => suivant(), 'aria-label': 'Passer l\'étape' }, '⏭ Passer')),
        h('button.bouton.secondaire.danger-texte.petit', { type: 'button', onclick: fermer }, 'Arrêter la séance'));
    };

    const terminer = () => {
      const minutes = Math.max(1, Math.round((Date.now() - debutSeance) / 60000));
      signaux.signal('termine');
      signaux.parler('Exercice terminé. Séance terminée, bravo !');
      // Laisse la voix finir avant de libérer le son et l'écran.
      clearInterval(minuterie);
      minuterie = null;
      setTimeout(() => { libererEcran?.(); libererEcran = null; }, 4000);
      const seance = M.seanceSoin(seanceId);
      U.vider(zone,
        h('div.minuteur-fin', h('p.minuteur-grand', '👏'), h('h2', 'Séance terminée'), h('p.aide', `${etapes.length} étapes en ${minutes} min environ.`)),
        h('div.actions-formulaire',
          seance && seance.etat !== 'faite'
            ? h('button.bouton.large.bouton-soin', {
              type: 'button',
              onclick: async () => {
                // Le détail de la séance, resté ouvert dessous, n'est plus à jour : on referme tout.
                if (await U.tenter(async () => { await M.changerEtatSeanceSoin(seanceId, 'faite'); return true; })) { U.fermerToutesFeuilles(); U.toast('Séance de soin faite ✓'); }
              },
            }, 'Marquer la séance faite')
            : h('p.aide', 'Séance déjà marquée faite.'),
          h('button.bouton.secondaire', { type: 'button', onclick: fermer }, 'Fermer')));
    };

    const demarrer = () => {
      // Dans le geste de l'utilisateur : déverrouille le son et la voix (iPhone), puis annonce la première étape.
      signaux.debloquer();
      etapes = G.etapesSeance(exercices, { repos: prefs.repos });
      libererEcran = garderEcranAllume();
      debutSeance = Date.now();
      debutMs = debutSeance;
      i = 0;
      annoncee = -1;
      entrerEtape();
      minuterie = setInterval(tic, 100);
      surVisibilite = () => { if (document.visibilityState === 'visible') tic(); };
      document.addEventListener('visibilitychange', surVisibilite);
    };

    // ------------------------------------------------------------ Écran de départ

    const choix = (cle, libelle, aide = null) => {
      const el = U.interrupteur(cle, prefs[cle], libelle);
      el.querySelector('input').addEventListener('change', ev => { prefs[cle] = ev.target.checked; enregistrer(); });
      return [el, aide && h('p.aide.interrupteur-aide', aide)];
    };
    const resume = h('p.aide');
    const majResume = () => {
      const n = exercices.length;
      resume.textContent = `${n} exercice${n > 1 ? 's' : ''} · environ ${Math.max(1, Math.round(G.dureeEstimee(G.etapesSeance(exercices, { repos: prefs.repos })) / 60))} min`;
    };
    // Repos entre séries, réglable par exercice (mémorisé sur le téléphone).
    const reglageRepos = e => {
      const a = G.analyserDosage(e.dosage);
      if (a.series < 2 && !a.parCote) return null;
      const cle = G.cleRepos(e);
      const valeur = h('output.repos-valeur');
      const afficher = () => { const r = G.reposDe(e, prefs.repos); valeur.textContent = r ? G.dureeParlee(r).replace('secondes', 's').replace('seconde', 's') : 'aucun'; };
      const changer = delta => () => {
        const r = Math.min(REPOS_MAX, Math.max(0, G.reposDe(e, prefs.repos) + delta));
        prefs.repos = { ...prefs.repos, [cle]: r };
        afficher();
        majResume();
        enregistrer();
      };
      afficher();
      return h('div.repos-reglage',
        h('span', 'Repos entre séries'),
        h('button.bouton-icone.petit', { type: 'button', onclick: changer(-PAS_REPOS), 'aria-label': `Moins de repos pour ${e.nom}` }, '−'),
        valeur,
        h('button.bouton-icone.petit', { type: 'button', onclick: changer(PAS_REPOS), 'aria-label': `Plus de repos pour ${e.nom}` }, '＋'));
    };

    majResume();
    U.vider(zone,
      resume,
      h('ul.soin-exercices', exercices.map(e => {
        const a = G.analyserDosage(e.dosage);
        const rythme = e.seance?.tempo ? ` · rythme ${e.seance.tempo.map(([l, d]) => `${l.toLowerCase()} ${d} s`).join(', ')}` : '';
        return h('li', h('span.soin-coche', { 'aria-hidden': 'true' }, '○'),
          h('div.exercice-depart',
            exerciceTouchable(e.programme, cote, h('strong', e.nom), h('span.soin-dosage', `${e.dosage}${a.mode === 'reps' ? rythme : ''}`)),
            reglageRepos(e)));
      })),
      h('p.aide', 'Touchez un exercice pour voir sa fiche ; le bouton « ? » reste disponible pendant la séance.'),
      choix('bips', 'Sons (bips 3-2-1, départ, fin)'),
      choix('voix', 'Voix (annonces en français)'),
      choix('vibration', 'Vibration', vibrationDisponible() ? null : 'Indisponible sur cet appareil (l\'iPhone ne permet pas la vibration aux applications web).'),
      h('p.bandeau-info', `🔔 ${NOTE_SILENCIEUX} L'écran reste allumé pendant la séance.`),
      h('button.bouton.large.bouton-soin', { type: 'button', onclick: demarrer }, '▶ Démarrer'));
    return zone;
  }, { surFermeture: arreter });
}
