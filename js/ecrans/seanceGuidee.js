// Séance de soin guidée : enchaîne exercices, séries et récupérations avec minuteur, tempo, compteur,
// bips et voix ; à la fin, propose de marquer la séance faite (reporté dans le bilan du jour).
import * as M from '../magasin.js';
import * as S from '../soin.js';
import * as G from '../seance-guidee.js';
import * as U from '../ui.js';

const { h } = U;

const mmss = s => `${Math.floor(s / 60)}:${String(Math.max(0, s) % 60).padStart(2, '0')}`;

// Exercices de la séance avec leur rythme (fiche du programme).
function exercicesDeLaSeance(x) {
  const s = M.suivi(x.blessureId);
  const phase = s ? S.phaseDe(s, x.phase) : null;
  return x.exercices.map(e => ({ ...e, seance: phase?.exercices.find(p => p.id === e.id)?.seance }));
}

export function ouvrirSeanceGuidee(seanceId) {
  const x = M.seanceSoin(seanceId);
  if (!x) return;
  const etapes = G.etapesSeance(exercicesDeLaSeance(x));
  const prefs = { voix: true, bips: true, ...M.etat.appareil.preferencesSeance };

  let audio = null;
  let verrou = null;
  let minuterie = null;
  let i = 0;
  let debut = 0;
  let pauseDebut = null;
  let compte = 0;
  let manuel = false;
  let dernier = null; // dernière seconde ou dernière phase signalée
  let debutSeance = 0;

  const bip = (frequence = 880, duree = 0.12) => {
    if (!prefs.bips || !audio) return;
    try {
      const o = audio.createOscillator();
      const g = audio.createGain();
      o.frequency.value = frequence;
      g.gain.setValueAtTime(0.3, audio.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, audio.currentTime + duree);
      o.connect(g).connect(audio.destination);
      o.start();
      o.stop(audio.currentTime + duree);
    } catch {
      // son indisponible : la séance continue
    }
  };
  const parler = texte => {
    if (!prefs.voix || !('speechSynthesis' in window)) return;
    try {
      speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(texte);
      u.lang = 'fr-FR';
      const voix = speechSynthesis.getVoices().find(v => v.lang?.toLowerCase().startsWith('fr'));
      if (voix) u.voice = voix;
      u.rate = 1.05;
      speechSynthesis.speak(u);
    } catch {
      // synthèse vocale indisponible
    }
  };
  const arreter = () => {
    clearInterval(minuterie);
    minuterie = null;
    try { speechSynthesis?.cancel(); } catch { /* rien */ }
    verrou?.release?.().catch(() => {});
    verrou = null;
  };

  U.ouvrirFeuille('Séance guidée', fermer => {
    const zone = h('div.seance-guidee');
    // Éléments mis à jour à chaque tic (le reste est redessiné à chaque étape).
    const grand = h('div.minuteur-grand', { 'aria-live': 'off' });
    const phaseTexte = h('div.minuteur-phase', { 'aria-live': 'polite' });
    const barre = h('span');
    const boutonPause = h('button.bouton.secondaire', { type: 'button', onclick: () => basculerPause() }, '⏸ Pause');

    const ecoule = () => ((pauseDebut ?? performance.now()) - debut) / 1000;

    const demarrerEtape = () => {
      debut = performance.now();
      if (pauseDebut !== null) pauseDebut = debut;
      compte = 0;
      manuel = false;
      dernier = null;
      const e = etapes[i];
      parler(e.annonce);
      bip(e.type === 'recup' || e.type === 'transition' ? 520 : 880, 0.18);
      dessinerEtape();
      tic();
    };
    const suivant = () => {
      i++;
      if (i >= etapes.length) terminer(); else demarrerEtape();
    };
    const precedent = () => {
      i = Math.max(0, i - (ecoule() < 3 && i > 0 ? 1 : 0));
      demarrerEtape();
    };
    const basculerPause = () => {
      if (pauseDebut === null) {
        pauseDebut = performance.now();
        try { speechSynthesis?.cancel(); } catch { /* rien */ }
        boutonPause.textContent = '▶ Reprendre';
        phaseTexte.textContent = 'En pause';
      } else {
        debut += performance.now() - pauseDebut;
        pauseDebut = null;
        boutonPause.textContent = '⏸ Pause';
        dernier = null;
      }
    };
    const compter = () => {
      compte++;
      bip(990, 0.06);
      const e = etapes[i];
      grand.textContent = `${compte} / ${e.reps}`;
      if (compte >= e.reps) { bip(990, 0.3); suivant(); }
    };

    const tic = () => {
      if (pauseDebut !== null || i >= etapes.length) return;
      const e = etapes[i];
      const t = ecoule();
      if (e.type === 'tenue' || e.type === 'recup' || e.type === 'transition') {
        const reste = Math.ceil(e.dureeS - t);
        grand.textContent = mmss(reste);
        barre.style.width = `${Math.min(100, (t / e.dureeS) * 100)}%`;
        if (reste !== dernier) {
          if (reste <= 3 && reste > 0) bip(660, 0.08);
          dernier = reste;
        }
        if (t >= e.dureeS) { bip(990, 0.3); suivant(); }
      } else if (e.type === 'tempo' && !manuel) {
        const p = G.positionTempo(e.phases, e.reps, t);
        if (p.fini) { bip(990, 0.3); suivant(); return; }
        grand.textContent = `${p.rep} / ${e.reps}`;
        phaseTexte.textContent = `${p.libelle} · ${Math.ceil(p.resteS)} s`;
        barre.style.width = `${Math.min(100, (t / G.dureeEtape(e)) * 100)}%`;
        const cle = `${p.rep}-${p.phase}`;
        if (cle !== dernier) {
          dernier = cle;
          if (prefs.voix) parler(p.libelle); else bip(p.phase === 0 ? 880 : 520, 0.08);
        }
      }
    };

    const dessinerEtape = () => {
      const e = etapes[i];
      const ex = e.exercice;
      phaseTexte.textContent = e.libelle ?? '';
      barre.style.width = '0%';
      const actions = [];
      if (e.type === 'compteur' || (e.type === 'tempo' && manuel)) {
        grand.textContent = `${compte} / ${e.reps}`;
        phaseTexte.textContent = 'Touchez le bouton à chaque répétition';
        actions.push(h('button.bouton.large.bouton-soin.minuteur-plus', { type: 'button', onclick: compter }, '＋1'),
          h('button.bouton.secondaire', { type: 'button', onclick: suivant }, 'Série terminée'));
      } else if (e.type === 'tempo') {
        actions.push(h('button.bouton.secondaire.petit', { type: 'button', onclick: () => { manuel = true; dessinerEtape(); } }, 'Je compte moi-même'));
      } else if (e.type === 'libre') {
        grand.textContent = '✓';
        phaseTexte.textContent = 'À votre rythme';
        actions.push(h('button.bouton.large.bouton-soin', { type: 'button', onclick: suivant }, 'C\'est fait'));
      }
      U.vider(zone,
        h('p.aide', `Exercice ${ex.index} / ${ex.total} · étape ${i + 1} / ${etapes.length}`),
        h('h2.minuteur-exercice', e.type === 'transition' ? `Suivant : ${e.suivant}` : ex.nom),
        e.type !== 'transition' && h('p.minuteur-dosage', ex.dosage),
        e.series > 1 && e.type !== 'transition' && h('p.minuteur-serie', `Série ${e.serie} / ${e.series}${e.cote ? ` · ${e.cote}` : ''}`),
        h('div.minuteur-cadran', { class: `minuteur-${e.type}` }, grand, phaseTexte, h('div.barre', barre)),
        actions,
        h('div.minuteur-commandes',
          h('button.bouton.secondaire', { type: 'button', onclick: precedent, 'aria-label': 'Recommencer l\'étape ou revenir à la précédente' }, '⏮'),
          boutonPause,
          h('button.bouton.secondaire', { type: 'button', onclick: suivant, 'aria-label': 'Passer l\'étape' }, '⏭ Passer')),
        h('button.bouton.secondaire.danger-texte.petit', { type: 'button', onclick: fermer }, 'Arrêter la séance'));
    };

    const terminer = () => {
      arreter();
      const minutes = Math.max(1, Math.round((performance.now() - debutSeance) / 60000));
      parler('Séance terminée. Bravo !');
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

    const demarrer = async () => {
      // Son et voix doivent être déclenchés par un geste de l'utilisateur (iPhone).
      try {
        audio = new (window.AudioContext || window.webkitAudioContext)();
        await audio.resume();
      } catch {
        audio = null;
      }
      try { verrou = await navigator.wakeLock?.request('screen'); } catch { verrou = null; }
      debutSeance = performance.now();
      i = 0;
      demarrerEtape();
      minuterie = setInterval(tic, 100);
    };

    const choix = (cle, libelle) => {
      const el = U.interrupteur(cle, prefs[cle], libelle);
      el.querySelector('input').addEventListener('change', ev => {
        prefs[cle] = ev.target.checked;
        M.enregistrerPreferencesSeance({ ...prefs }).catch(() => {});
      });
      return el;
    };

    const exercices = exercicesDeLaSeance(x);
    U.vider(zone,
      h('p.aide', `${exercices.length} exercice${exercices.length > 1 ? 's' : ''} · environ ${Math.max(1, Math.round(G.dureeEstimee(etapes) / 60))} min`),
      h('ul.soin-exercices', exercices.map(e => {
        const a = G.analyserDosage(e.dosage);
        const rythme = e.seance?.tempo ? ` · rythme ${e.seance.tempo.map(([l, d]) => `${l.toLowerCase()} ${d} s`).join(', ')}` : '';
        return h('li', h('span.soin-coche', { 'aria-hidden': 'true' }, '○'),
          h('span', h('strong', e.nom), h('span.soin-dosage', `${e.dosage}${a.mode === 'reps' ? rythme : ''}`)));
      })),
      choix('voix', 'Voix (annonces en français)'),
      choix('bips', 'Bips'),
      h('p.aide', 'L\'écran reste allumé pendant la séance. Gardez l\'application ouverte ; montez le son du téléphone.'),
      h('button.bouton.large.bouton-soin', { type: 'button', onclick: demarrer }, '▶ Démarrer'));
    return zone;
  }, { surFermeture: arreter });
}
