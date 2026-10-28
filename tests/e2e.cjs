// Test de bout en bout dans Chromium (Playwright), application servie sous /dossard/ comme sur GitHub Pages.
// Usage : node tests/e2e.cjs [dossier-captures]
// Vérifie : aucune erreur JavaScript, service worker, parcours principal, export/import, hors ligne, mise à jour.
const { chromium } = require('playwright');
const { spawn } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const assert = require('assert/strict');

const RACINE = path.join(__dirname, '..');
const CAPTURES = process.argv[2] || null;
const PORT = 8765 + Math.floor(Math.random() * 1000);

function copierSite() {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'dossard-e2e-'));
  const site = path.join(base, 'dossard');
  fs.mkdirSync(site);
  for (const f of ['index.html', 'sw.js', 'manifest.webmanifest', 'css', 'js', 'icons']) {
    fs.cpSync(path.join(RACINE, f), path.join(site, f), { recursive: true });
  }
  return { base, site };
}

const iso = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const dansJours = n => { const d = new Date(); d.setDate(d.getDate() + n); return iso(d); };

async function main() {
  const { base, site } = copierSite();
  const serveur = spawn('python3', ['-m', 'http.server', String(PORT), '--bind', '127.0.0.1'], { cwd: base, stdio: 'ignore' });
  await new Promise(r => setTimeout(r, 800));
  const URL_APP = `http://127.0.0.1:${PORT}/dossard/`;
  const navigateur = await chromium.launch();
  const erreurs = [];
  try {
    const contexte = await navigateur.newContext({
      viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2,
      locale: 'fr-FR', timezoneId: 'Europe/Paris', acceptDownloads: true,
    });
    const page = await contexte.newPage();
    page.on('pageerror', e => erreurs.push(`pageerror: ${e.message}`));
    page.on('console', m => { if (m.type() === 'error') erreurs.push(`console: ${m.text()}`); });
    page.on('response', r => { if (r.status() >= 400) erreurs.push(`HTTP ${r.status()} ${r.url()}`); });
    const capture = async nom => { if (CAPTURES) await page.waitForTimeout(300); if (CAPTURES) await page.screenshot({ path: path.join(CAPTURES, `${nom}.png`), fullPage: true }); };
    const etape = t => console.log(`• ${t}`);

    etape('Chargement sous /dossard/');
    await page.goto(URL_APP);
    await page.getByRole('heading', { name: 'Dossard' }).waitFor();
    const portee = await page.evaluate(async () => (await navigator.serviceWorker.ready).scope);
    assert.equal(portee, URL_APP);
    const manifeste = await page.evaluate(async () => (await fetch(document.querySelector('link[rel=manifest]').href)).json());
    assert.equal(manifeste.start_url, './');
    await capture('01-accueil-vide');

    etape('Création et démarrage d\'un objectif course');
    await page.getByRole('link', { name: 'Objectifs', exact: true }).click();
    await page.getByRole('button', { name: '＋ Nouvel objectif' }).click();
    await page.locator('.feuille [name=nom]').fill('Semi de Lyon');
    await page.locator('.feuille [name=type]').selectOption('semi');
    assert.equal(await page.locator('.feuille [name=distanceKm]').inputValue(), '21,0975');
    await page.locator('.feuille [name=dateEpreuve]').fill(dansJours(7 * 20));
    await page.locator('.feuille [name=tempsVise_h]').fill('1');
    await page.locator('.feuille [name=tempsVise_m]').fill('45');
    await page.getByRole('button', { name: 'Enregistrer' }).click();
    await page.locator('.objectif', { hasText: 'Semi de Lyon' }).waitFor();
    assert.match(await page.locator('.objectif', { hasText: 'Semi de Lyon' }).textContent(), /objectif 1:45:00/);
    await page.getByRole('button', { name: 'Démarrer l\'objectif' }).click();
    await page.locator('.boite').getByRole('button', { name: 'Démarrer' }).click();
    await page.locator('.objectif[data-statut=en_cours]', { hasText: 'Semi de Lyon' }).waitFor();

    etape('Objectif triathlon : distances FFTri préremplies, délai court signalé');
    await page.getByRole('button', { name: '＋ Nouvel objectif' }).click();
    await page.locator('.feuille [name=nom]').fill('Tri de Paris');
    await page.locator('.feuille .puce', { hasText: 'Triathlon' }).click();
    assert.equal(await page.locator('.feuille [name=type]').inputValue(), 'M');
    assert.equal(await page.locator('.feuille [name=natationM]').inputValue(), '1500');
    await page.locator('.feuille [name=type]').selectOption('XS');
    assert.equal(await page.locator('.feuille [name=veloKm]').inputValue(), '10');
    await page.locator('.feuille [name=type]').selectOption('L');
    await page.locator('.feuille [name=dateEpreuve]').fill(dansJours(7 * 6));
    await page.getByRole('button', { name: 'Enregistrer' }).click();
    await page.locator('.objectif[data-statut=a_demarrer]', { hasText: 'Tri de Paris' }).waitFor();
    await capture('02-objectifs');
    await page.getByRole('link', { name: 'Accueil', exact: true }).click();
    await page.locator('.alerte', { hasText: 'Délai court pour « Tri de Paris »' }).waitFor();

    etape('Séance prévue ajoutée à la main');
    await page.getByRole('link', { name: 'Plan', exact: true }).click();
    await page.getByRole('button', { name: '＋ Ajouter une séance prévue' }).click();
    await page.locator('.feuille [name=type]').selectOption('fractionne');
    await page.locator('.feuille [name=duree_m]').fill('45');
    await page.locator('.feuille [name=distance]').fill('8');
    await page.locator('.feuille [name=corps]').fill('6 × 1 000 m allure 10 km');
    // Rattachement par défaut à l'objectif en cours.
    assert.equal(await page.locator('.feuille [data-puces=objectifs] input:checked').count(), 1);
    await page.getByRole('button', { name: 'Enregistrer' }).click();
    await page.locator('.ligne-seance', { hasText: 'Fractionné' }).waitFor();
    await capture('03-plan');

    etape('Saisie rapide depuis l\'accueil, préremplie par la séance prévue');
    await page.getByRole('link', { name: 'Accueil', exact: true }).click();
    await page.locator('.carte', { hasText: 'Prochaine séance' }).getByText('Aujourd\'hui').waitFor();
    await page.getByRole('button', { name: 'Saisir une séance réalisée' }).click();
    assert.equal(await page.locator('.feuille [name=duree_m]').inputValue(), '45');
    assert.equal(await page.locator('.feuille [name=distance]').inputValue(), '8');
    assert.equal(await page.locator('.feuille .calcul').textContent(), 'Allure : 5:38 /km');
    assert.match(await page.locator('.feuille .aide-rattachement').textContent(), /Semi de Lyon/);
    await page.locator('.feuille .ressenti-choix', { hasText: '4' }).click();
    await capture('04-saisie-rapide');
    await page.getByRole('button', { name: 'Enregistrer' }).click();
    await page.locator('.toast', { hasText: 'Séance enregistrée' }).waitFor();
    await page.locator('.pastille-prevue.etat-faite').waitFor();
    assert.match(await page.locator('.bilan-semaine').textContent(), /Réalisé1 séance45 min/);

    etape('Saisie libre (vélo) : vitesse calculée');
    await page.getByRole('button', { name: 'Saisir une séance réalisée' }).click();
    await page.locator('.feuille .puce', { hasText: 'Vélo' }).click();
    await page.locator('.feuille [name=duree_h]').fill('1');
    await page.locator('.feuille [name=duree_m]').fill('30');
    await page.locator('.feuille [name=distance]').fill('45');
    assert.equal(await page.locator('.feuille .calcul').textContent(), 'Vitesse : 30 km/h');
    assert.match(await page.locator('.feuille .aide-rattachement').textContent(), /Aucun objectif en cours/);
    await page.getByRole('button', { name: 'Enregistrer' }).click();
    await page.locator('.toast', { hasText: 'Séance enregistrée' }).last().waitFor();
    await capture('05-accueil');

    etape('Historique : totaux et filtres');
    await page.getByRole('link', { name: 'Historique', exact: true }).click();
    assert.match(await page.locator('.semaine-total').first().textContent(), /2 séances · 2 h 15/);
    await page.locator('select[name=discipline]').selectOption('velo');
    assert.equal(await page.locator('.ecran .ligne-seance').count(), 1);
    await page.locator('select[name=discipline]').selectOption('');
    const idSemi = await page.evaluate(() => [...document.querySelectorAll('select[name=objectif] option')].find(o => o.textContent === 'Semi de Lyon').value);
    await page.locator('select[name=objectif]').selectOption(idSemi);
    assert.equal(await page.locator('.ecran .ligne-seance').count(), 1);
    await capture('06-historique');

    etape('Réglages : semainier insuffisant, clé API');
    await page.goto(`${URL_APP}#/reglages/semainier`);
    await page.locator('[name=plafond]').fill('3');
    await page.locator('.interrupteur', { hasText: 'Mardi' }).click();
    await page.locator('[data-puces=disciplines_1] .puce', { hasText: 'Course' }).click();
    await page.getByRole('button', { name: 'Enregistrer le semainier' }).click();
    await page.locator('.toast', { hasText: 'Semainier enregistré' }).waitFor();
    await capture('07-semainier');
    await page.goto(`${URL_APP}#/reglages/ia`);
    assert.equal(await page.locator('[name=cle]').getAttribute('type'), 'password');
    await page.locator('[name=cle]').fill('cle-de-test-locale');
    await page.getByRole('button', { name: 'Enregistrer' }).click();
    await page.getByText('Une clé est enregistrée sur ce téléphone.').waitFor();
    await page.goto(`${URL_APP}#/accueil`);
    await page.locator('.alerte', { hasText: '1 jour disponible pour un plafond de 3' }).waitFor();

    etape('Cycle de vie : terminer avec résultat');
    await page.getByRole('link', { name: 'Objectifs', exact: true }).click();
    await page.locator('.objectif', { hasText: 'Semi de Lyon' }).getByRole('button', { name: 'Terminer' }).click();
    await page.locator('.feuille [name=temps_h]').fill('1');
    await page.locator('.feuille [name=temps_m]').fill('44');
    await page.locator('.feuille [name=temps_s]').fill('12');
    await page.locator('.feuille [name=classement]').fill('230e');
    await page.getByRole('button', { name: 'Terminer l\'objectif' }).click();
    await page.locator('.objectif[data-statut=termine]', { hasText: 'Semi de Lyon' }).waitFor();
    assert.match(await page.locator('.objectif[data-statut=termine] .resultat').textContent(), /1:44:12 · classement 230e/);

    etape('Export JSON (sans clé API) puis import avec confirmation');
    await page.goto(`${URL_APP}#/reglages/sauvegarde`);
    const [telechargement] = await Promise.all([
      page.waitForEvent('download'),
      page.getByRole('button', { name: 'Télécharger la sauvegarde' }).click(),
    ]);
    const cheminExport = await telechargement.path();
    const exportTexte = fs.readFileSync(cheminExport, 'utf8');
    assert.ok(!exportTexte.includes('cle-de-test-locale'), 'la clé API ne doit pas être exportée');
    const exportJson = JSON.parse(exportTexte);
    assert.equal(exportJson.donnees.objectifs.length, 2);
    assert.equal(exportJson.donnees.realisees.length, 2);
    assert.match(telechargement.suggestedFilename(), /^dossard-sauvegarde-\d{4}-\d{2}-\d{2}\.json$/);
    await page.getByText(/Dernier export : /).waitFor();

    // On supprime un objectif, puis on restaure la sauvegarde.
    await page.getByRole('link', { name: 'Objectifs', exact: true }).click();
    await page.locator('.objectif', { hasText: 'Tri de Paris' }).getByRole('button', { name: 'Modifier' }).click();
    await page.getByRole('button', { name: 'Supprimer l\'objectif' }).click();
    await page.locator('.boite').getByRole('button', { name: 'Supprimer' }).click();
    await page.locator('.toast', { hasText: 'Objectif supprimé' }).waitFor();
    assert.equal(await page.locator('.objectif').count(), 1);

    await page.goto(`${URL_APP}#/reglages/sauvegarde`);
    await page.locator('input[type=file]').setInputFiles(cheminExport);
    await page.locator('.boite', { hasText: '2 objectif(s), 1 séance(s) prévue(s), 2 séance(s) réalisée(s)' }).waitFor();
    await page.locator('.boite').getByRole('button', { name: 'Annuler' }).click();
    await page.locator('input[type=file]').setInputFiles(cheminExport);
    await page.locator('.boite').getByRole('button', { name: 'Remplacer mes données' }).click();
    await page.locator('.toast', { hasText: 'Sauvegarde importée' }).waitFor();
    await page.getByRole('link', { name: 'Objectifs', exact: true }).click();
    await page.locator('.objectif', { hasText: 'Tri de Paris' }).waitFor();
    assert.equal(await page.locator('.objectif').count(), 2);
    await page.goto(`${URL_APP}#/reglages/ia`);
    await page.getByText('Une clé est enregistrée sur ce téléphone.').waitFor(); // la clé n'est pas écrasée par l'import

    etape('Persistance après rechargement');
    await page.reload();
    await page.goto(`${URL_APP}#/historique`);
    await page.locator('.semaine-total').first().waitFor();
    assert.equal(await page.locator('.ecran .ligne-seance').count(), 2);

    etape('Fonctionnement hors ligne');
    await contexte.setOffline(true);
    await page.goto(`${URL_APP}#/accueil`);
    await page.reload();
    await page.getByRole('heading', { name: 'Dossard' }).waitFor();
    await page.locator('.avancement, .carte').first().waitFor();
    await contexte.setOffline(false);

    etape('Mise à jour : nouvelle version détectée, bandeau puis rechargement');
    const swChemin = path.join(site, 'sw.js');
    fs.writeFileSync(swChemin, fs.readFileSync(swChemin, 'utf8').replace(/const VERSION = '([^']+)'/, "const VERSION = '$1-test'"));
    await page.goto(`${URL_APP}#/reglages/apropos`);
    await page.getByRole('button', { name: 'Rechercher une mise à jour' }).click();
    await page.locator('#maj', { hasText: 'Nouvelle version disponible' }).waitFor({ state: 'visible' });
    await capture('08-mise-a-jour');
    await Promise.all([page.waitForEvent('load'), page.locator('#maj button').click()]);
    const caches = await page.evaluate(() => caches.keys());
    assert.ok(caches.some(c => c.endsWith('-test')) && caches.length === 1, `caches inattendus : ${caches}`);

    etape('Mode sombre');
    await page.emulateMedia({ colorScheme: 'dark' });
    await page.goto(`${URL_APP}#/accueil`);
    await page.getByRole('heading', { name: 'Dossard' }).waitFor();
    const fond = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
    assert.equal(fond, 'rgb(22, 24, 29)');
    await capture('09-accueil-sombre');
    await page.getByRole('link', { name: 'Objectifs', exact: true }).click();
    await capture('10-objectifs-sombre');

    assert.deepEqual(erreurs, [], 'aucune erreur JavaScript ou HTTP attendue');
    console.log('\nTous les contrôles de bout en bout sont passés ✔');
  } finally {
    await navigateur.close();
    serveur.kill();
    fs.rmSync(base, { recursive: true, force: true });
  }
}

main().catch(e => { console.error(e); process.exit(1); });
