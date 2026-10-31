// Signaux de la séance guidée : bips (Web Audio), voix française (synthèse vocale) et vibration (si l'appareil la permet).
// `prefs` ({ bips, voix, vibration }) est lu à chaque signal : un réglage changé en cours de séance s'applique aussitôt.

// Bips : [fréquence (Hz), début (s), durée (s)].
const SONS = {
  compte: [[660, 0, 0.12]], // 3-2-1 avant le début
  depart: [[990, 0, 0.5]], // bip de départ
  dernieres: [[880, 0, 0.1]], // 3 dernières secondes
  fin: [[880, 0, 0.22], [587, 0.26, 0.5]], // bip de fin
  repetition: [[990, 0, 0.06]],
  tempoHaut: [[880, 0, 0.08]],
  tempoBas: [[520, 0, 0.08]],
  termine: [[660, 0, 0.15], [880, 0.18, 0.15], [1175, 0.36, 0.45]],
};
const VIBRATIONS = { compte: 60, depart: 300, dernieres: 60, fin: [200, 100, 200], termine: [200, 100, 200, 100, 400] };

export const vibrationDisponible = () => typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function';
export const voixDisponible = () => typeof window !== 'undefined' && 'speechSynthesis' in window;

export function creerSignaux(prefs) {
  let audio = null;

  // À appeler dans le geste de l'utilisateur (« Démarrer ») : sur iPhone, son et voix restent muets sinon.
  const debloquer = () => {
    try {
      audio ??= new (window.AudioContext || window.webkitAudioContext)();
      audio.resume?.().catch(() => {});
      // Un échantillon silencieux joué pendant le geste déverrouille le son.
      const tampon = audio.createBuffer(1, 1, 22050);
      const source = audio.createBufferSource();
      source.buffer = tampon;
      source.connect(audio.destination);
      source.start(0);
    } catch {
      audio = null;
    }
    if (voixDisponible()) {
      try {
        const u = new SpeechSynthesisUtterance(' ');
        u.volume = 0;
        speechSynthesis.speak(u);
      } catch {
        // synthèse vocale indisponible
      }
    }
  };

  const jouer = tons => {
    if (!audio) return;
    try {
      if (audio.state === 'suspended') audio.resume().catch(() => {});
      const t0 = audio.currentTime + 0.02;
      for (const [frequence, debut, duree] of tons) {
        const o = audio.createOscillator();
        const g = audio.createGain();
        o.type = 'sine';
        o.frequency.value = frequence;
        g.gain.setValueAtTime(0.0001, t0 + debut);
        g.gain.exponentialRampToValueAtTime(0.4, t0 + debut + 0.01);
        g.gain.exponentialRampToValueAtTime(0.0001, t0 + debut + duree);
        o.connect(g).connect(audio.destination);
        o.start(t0 + debut);
        o.stop(t0 + debut + duree + 0.02);
      }
    } catch {
      // son indisponible : la séance continue
    }
  };

  const vibrer = motif => {
    if (!prefs.vibration || !vibrationDisponible() || motif === undefined) return;
    try { navigator.vibrate(motif); } catch { /* vibration refusée */ }
  };

  // Signal nommé (voir SONS) : bip et vibration selon les réglages.
  const signal = nom => {
    if (prefs.bips) jouer(SONS[nom] ?? []);
    vibrer(VIBRATIONS[nom]);
  };

  // Voix française. `couper` : interrompt l'annonce en cours (rythme du tempo) ; sinon, l'annonce attend son tour.
  const parler = (texte, { couper = false } = {}) => {
    if (!prefs.voix || !texte || !voixDisponible()) return;
    try {
      if (couper) speechSynthesis.cancel();
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

  const taire = () => {
    try { if (voixDisponible()) speechSynthesis.cancel(); } catch { /* rien */ }
  };

  const fermer = () => {
    taire();
    try { audio?.close?.(); } catch { /* rien */ }
    audio = null;
  };

  return { debloquer, signal, parler, taire, fermer };
}

// Écran maintenu allumé (Wake Lock) ; repris automatiquement quand l'application revient au premier plan.
export function garderEcranAllume() {
  let verrou = null;
  let actif = true;
  const demander = async () => {
    if (!actif || document.visibilityState !== 'visible' || !navigator.wakeLock) return;
    try { verrou = await navigator.wakeLock.request('screen'); } catch { verrou = null; }
  };
  const surVisibilite = () => { if (document.visibilityState === 'visible' && (!verrou || verrou.released)) demander(); };
  document.addEventListener('visibilitychange', surVisibilite);
  demander();
  return () => {
    actif = false;
    document.removeEventListener('visibilitychange', surVisibilite);
    verrou?.release?.().catch(() => {});
    verrou = null;
  };
}
