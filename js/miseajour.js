// Service worker : enregistrement et message « Nouvelle version disponible ».
let enregistrement = null;
let rechargementDemande = false;

function afficherBandeau(worker) {
  const bandeau = document.getElementById('maj');
  bandeau.hidden = false;
  bandeau.querySelector('button').onclick = () => {
    rechargementDemande = true;
    worker.postMessage({ type: 'SKIP_WAITING' });
  };
}

function surveiller(reg) {
  if (reg.waiting && navigator.serviceWorker.controller) afficherBandeau(reg.waiting);
  reg.addEventListener('updatefound', () => {
    const nouveau = reg.installing;
    nouveau?.addEventListener('statechange', () => {
      // Une version est déjà active : la nouvelle attend l'accord de l'utilisateur.
      if (nouveau.state === 'installed' && navigator.serviceWorker.controller) afficherBandeau(nouveau);
    });
  });
}

export async function enregistrerServiceWorker() {
  if (!('serviceWorker' in navigator)) return;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (rechargementDemande) location.reload();
  });
  try {
    enregistrement = await navigator.serviceWorker.register('./sw.js', { scope: './' });
    surveiller(enregistrement);
    // Au retour sur l'application (installée), on vérifie s'il existe une nouvelle version.
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') enregistrement.update().catch(() => {});
    });
  } catch (e) {
    console.warn('Service worker non enregistré', e);
  }
}

export async function rechercherMiseAJour() {
  if (!enregistrement) return 'Mode hors ligne indisponible sur ce navigateur.';
  try {
    await enregistrement.update();
  } catch {
    return 'Impossible de vérifier (pas de connexion ?).';
  }
  if (enregistrement.waiting || enregistrement.installing) return 'Une nouvelle version est disponible : utilisez le bandeau en haut de l\'écran.';
  return 'Vous utilisez la dernière version.';
}
