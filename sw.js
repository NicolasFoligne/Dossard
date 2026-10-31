// Service worker de Dossard : application disponible hors ligne.
// VERSION est à incrémenter à chaque livraison (identique à js/version.js) :
// le changement de ce fichier déclenche la mise à jour et le message « Nouvelle version disponible ».
const VERSION = '1.6.0';
const CACHE = `dossard-${VERSION}`;

const FICHIERS = [
  './',
  'index.html',
  'manifest.webmanifest',
  'css/app.css',
  'js/app.js',
  'js/db.js',
  'js/domaine.js',
  'js/format.js',
  'js/ia.js',
  'js/blessure-ia.js',
  'js/programmes.js',
  'js/seance-guidee.js',
  'js/ia-api.js',
  'js/magasin.js',
  'js/miseajour.js',
  'js/sauvegarde.js',
  'js/soin.js',
  'js/ui.js',
  'js/version.js',
  'js/ecrans/accueil.js',
  'js/ecrans/blessure.js',
  'js/ecrans/formulaires.js',
  'js/ecrans/historique.js',
  'js/ecrans/objectifs.js',
  'js/ecrans/plan.js',
  'js/ecrans/planIa.js',
  'js/ecrans/reglages.js',
  'js/ecrans/seanceGuidee.js',
  'js/ecrans/soin.js',
  'icons/icone.svg',
  'icons/icone-192.png',
  'icons/icone-512.png',
  'icons/icone-maskable-512.png',
  'icons/apple-touch-icon.png',
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE).then(cache =>
      // cache: 'reload' contourne le cache HTTP de GitHub Pages pour récupérer les nouveaux fichiers.
      cache.addAll(FICHIERS.map(f => new Request(f, { cache: 'reload' })))));
  // Pas de skipWaiting automatique : l'utilisateur choisit quand appliquer la mise à jour.
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const noms = await caches.keys();
    await Promise.all(noms.filter(n => n.startsWith('dossard-') && n !== CACHE).map(n => caches.delete(n)));
    await self.clients.claim();
  })());
});

self.addEventListener('message', event => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('fetch', event => {
  const req = event.request;
  const url = new URL(req.url);
  // Les appels externes (API Anthropic au lot 2) ne passent jamais par le cache.
  if (req.method !== 'GET' || url.origin !== self.location.origin) return;

  if (req.mode === 'navigate') {
    event.respondWith(caches.match('index.html', { cacheName: CACHE }).then(r => r ?? fetch(req)));
    return;
  }
  event.respondWith(
    caches.match(req, { cacheName: CACHE, ignoreSearch: true }).then(r => r ?? fetch(req)));
});
