// Point d'entrée : chargement des données, navigation par onglets (#/…), service worker.
import * as M from './magasin.js';
import { h, vider, fermerToutesFeuilles } from './ui.js';
import { ecranAccueil } from './ecrans/accueil.js';
import { ecranPlan } from './ecrans/plan.js';
import { ecranObjectifs } from './ecrans/objectifs.js';
import { ecranHistorique } from './ecrans/historique.js';
import { ecranReglages } from './ecrans/reglages.js';
import { ecranSoin } from './ecrans/soin.js';
import { enregistrerServiceWorker } from './miseajour.js';

const ROUTES = {
  accueil: ecranAccueil,
  plan: ecranPlan,
  objectifs: ecranObjectifs,
  historique: ecranHistorique,
  reglages: ecranReglages,
  soin: ecranSoin, // hors barre d'onglets : accessible depuis la carte verte de l'accueil
};

function routeCourante() {
  const [nom = 'accueil', sous = null] = location.hash.replace(/^#\/?/, '').split('/');
  return ROUTES[nom] ? { nom, sous } : { nom: 'accueil', sous: null };
}

let derniereRoute = '';

function afficher() {
  const { nom, sous } = routeCourante();
  const cle = `${nom}/${sous ?? ''}`;
  const principal = document.getElementById('principal');
  // On conserve la position de défilement lors d'un simple rafraîchissement du même écran.
  const defilement = cle === derniereRoute ? window.scrollY : 0;
  const ecran = ROUTES[nom](sous);
  vider(principal, ecran);
  window.scrollTo(0, defilement);
  derniereRoute = cle;
  document.querySelectorAll('.onglet').forEach(o => {
    const actif = o.dataset.route === nom;
    o.classList.toggle('actif', actif);
    if (actif) o.setAttribute('aria-current', 'page'); else o.removeAttribute('aria-current');
  });
}

async function demarrer() {
  try {
    await M.charger();
  } catch (e) {
    console.error(e);
    vider(document.getElementById('principal'),
      h('div.ecran', h('p.erreur', 'Impossible d\'ouvrir la base de données du téléphone. Vérifiez que la navigation privée est désactivée.')));
    return;
  }
  M.abonner(() => {
    // Les formulaires de réglages gèrent eux-mêmes leur affichage après enregistrement.
    if (routeCourante().nom !== 'reglages') afficher();
  });
  window.addEventListener('hashchange', () => { fermerToutesFeuilles(); afficher(); });
  afficher();
  enregistrerServiceWorker();
}

// Touche Échap (clavier) : ferme la feuille ouverte.
window.addEventListener('keydown', e => {
  if (e.key === 'Escape') document.querySelector('.feuille:last-child .feuille-entete button')?.click();
});

demarrer();
