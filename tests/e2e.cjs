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
      locale: 'fr-FR', timezoneId: 'Europe/Paris', acceptDownloads: true, permissions: ['clipboard-read', 'clipboard-write'],
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
    // Sans clé API, le démarrage ouvre la génération du plan en mode secours.
    await page.locator('.feuille details.secours[open]').waitFor();
    await page.getByText('Aucune clé API enregistrée').waitFor();
    await page.locator('.feuille').getByRole('button', { name: 'Fermer' }).click();
    await page.locator('.feuille').waitFor({ state: 'detached' });

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
    await page.getByRole('button', { name: '＋ Ajouter une séance à la main' }).click();
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

    etape('Nouvelles disciplines : rameur (allure /500 m, distance en mètres), mobilité, marche rattachée aux objectifs');
    await page.getByRole('button', { name: 'Saisir une séance réalisée' }).click();
    await page.locator('.feuille .puce', { hasText: 'Rameur' }).click();
    await page.locator('.feuille [name=duree_h]').fill('');
    await page.locator('.feuille [name=duree_m]').fill('8');
    await page.locator('.feuille').getByText('Distance (m)').waitFor();
    await page.locator('.feuille [name=distance]').fill('2000');
    assert.equal(await page.locator('.feuille .calcul').textContent(), 'Allure : 2:00 /500 m');
    await page.locator('.feuille .puce', { hasText: 'Mobilité' }).click();
    assert.equal(await page.locator('.feuille [name=distance]').count(), 0);
    await page.locator('.feuille .puce', { hasText: 'Marche' }).click();
    assert.match(await page.locator('.feuille .aide-rattachement').textContent(), /Semi de Lyon/);
    await page.locator('.feuille .puce', { hasText: 'Home trainer' }).click();
    await page.locator('.feuille [name=distance]').fill('20');
    assert.equal(await page.locator('.feuille .calcul').textContent(), 'Vitesse : 150 km/h');
    await capture('05b-disciplines');
    await page.locator('.feuille').getByRole('button', { name: 'Fermer' }).click();
    await page.locator('.feuille').waitFor({ state: 'detached' });

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
    // Créneaux : 18 h – 19 h proposé d'office, puis un second créneau réglé avec les curseurs.
    const mardi = page.locator('.jour-semainier').nth(1);
    await mardi.locator('.creneau-libelle', { hasText: '18 h – 19 h · 1 h' }).waitFor();
    await mardi.getByRole('button', { name: '＋ Ajouter un créneau' }).click();
    const matin = mardi.locator('.creneau').first();
    await matin.locator('.creneau-libelle', { hasText: '7 h – 8 h · 1 h' }).waitFor();
    await matin.getByLabel('Mardi : début du créneau').fill('390');
    await matin.getByLabel('Mardi : fin du créneau').fill('450');
    await matin.locator('.creneau-libelle', { hasText: '6 h 30 – 7 h 30 · 1 h' }).waitFor();
    await matin.getByLabel('Mardi : fin du créneau').fill('375'); // pousse le début : 15 min minimum
    await matin.locator('.creneau-libelle', { hasText: '6 h – 6 h 15 · 15 min' }).waitFor();
    await matin.getByLabel('Mardi : fin du créneau').fill('450');
    await matin.locator('.creneau-libelle', { hasText: '6 h – 7 h 30 · 1 h 30' }).waitFor();
    await mardi.getByText('Disponible : 2 h 30').waitFor();
    await page.getByRole('button', { name: 'Enregistrer le semainier' }).click();
    await page.locator('.toast', { hasText: 'Semainier enregistré' }).waitFor();
    const mardiEnregistre = await page.evaluate(async () => (await import('./js/magasin.js')).etat.semainier.jours[1]);
    assert.deepEqual(mardiEnregistre.creneaux, [{ debut: 360, fin: 450 }, { debut: 1080, fin: 1140 }]);
    assert.equal(mardiEnregistre.dureeMaxMin, 150);
    await capture('07b-semainier-creneaux');
    // Profil : les zones de texte ne déclenchent pas l'autoremplissage du navigateur (adresse e-mail…).
    await page.goto(`${URL_APP}#/reglages/profil`);
    assert.equal(await page.locator('form').getAttribute('autocomplete'), 'off');
    assert.equal(await page.locator('textarea[name=blessures]').getAttribute('autocomplete'), 'off');
    await capture('07-semainier');
    await page.goto(`${URL_APP}#/reglages/ia`);
    assert.equal(await page.locator('[name=cle]').getAttribute('type'), 'password');
    await page.locator('[name=cle]').fill('cle-de-test-locale');
    await page.getByRole('button', { name: 'Enregistrer' }).click();
    await page.getByText('Une clé est enregistrée sur ce téléphone.').waitFor();
    await page.goto(`${URL_APP}#/accueil`);
    await page.locator('.alerte', { hasText: '1 jour disponible pour un plafond de 3' }).waitFor();

    etape('Plan IA : génération (API simulée), aperçu, validation');
    // Plan conforme calculé dans la page à partir du contexte réel (mêmes modules que l'application).
    const planConforme = () => page.evaluate(async () => {
      const IA = await import('./js/ia.js');
      const M = await import('./js/magasin.js');
      const F = await import('./js/format.js');
      const maintenant = new Date();
      const c = IA.construireContexte(M.etat, F.aujourdhui(), { minutesActuelles: maintenant.getHours() * 60 + maintenant.getMinutes() });
      const seances = c.calendrier.flatMap(sem => sem.jours.slice(0, sem.plafondRestant ?? 7).map(j => ({
        date: j.date, heureDebut: j.creneaux[0].debut, discipline: j.disciplines[0], type: 'endurance', intensite: 'facile', dureeMin: 15,
        distanceKm: 7, echauffement: '10 min très facile', corps: '25 min en endurance fondamentale', retourCalme: '5 min de marche', objectifIds: c.objectifs.map(o => o.id),
      })));
      return { analyse: 'Temps visé ambitieux mais crédible.', phases: [{ nom: 'foncière', debut: c.debut, fin: F.ajouterJours(c.debut, 27), description: 'Construire la base' }], seances };
    });
    const sse = texte => [
      { type: 'message_start', message: { id: 'msg_test' } },
      { type: 'content_block_start', index: 0, content_block: { type: 'text', text: '' } },
      ...texte.match(/[\s\S]{1,400}/g).map(t => ({ type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: t } })),
      { type: 'content_block_stop', index: 0 },
      { type: 'message_delta', delta: { stop_reason: 'end_turn' }, usage: { output_tokens: 1 } },
      { type: 'message_stop' },
    ].map(e => `event: ${e.type}\ndata: ${JSON.stringify(e)}\n\n`).join('');
    const appelsApi = [];
    await page.route('https://api.anthropic.com/v1/messages', async route => {
      const req = route.request();
      appelsApi.push({ entetes: req.headers(), corps: req.postDataJSON() });
      const plan = await planConforme();
      await route.fulfill({ status: 200, headers: { 'content-type': 'text/event-stream', 'access-control-allow-origin': '*' }, body: sse(JSON.stringify(plan)) });
    });
    await page.getByRole('link', { name: 'Plan', exact: true }).click();
    await page.getByRole('button', { name: 'Générer le plan', exact: true }).click();
    await page.getByRole('button', { name: 'Générer le plan avec l\'IA' }).click();
    const boutonValider = page.getByRole('button', { name: /^Valider le plan \(\d+ séances\)$/ });
    await boutonValider.waitFor();
    assert.equal(appelsApi.length, 1);
    assert.equal(appelsApi[0].entetes['x-api-key'], 'cle-de-test-locale');
    assert.equal(appelsApi[0].entetes['anthropic-version'], '2023-06-01');
    assert.equal(appelsApi[0].entetes['anthropic-dangerous-direct-browser-access'], 'true');
    assert.equal(appelsApi[0].corps.model, 'claude-sonnet-5-5');
    assert.equal(appelsApi[0].corps.stream, true);
    assert.match(appelsApi[0].corps.messages[0].content, /Semi de Lyon/);
    assert.ok(!appelsApi[0].corps.messages[0].content.includes('Tri de Paris'), 'seuls les objectifs en cours sont envoyés');
    await page.getByText('Temps visé ambitieux mais crédible.').waitFor();
    await capture('11-apercu-plan');
    const nbSeancesIa = Number((await boutonValider.textContent()).match(/\d+/)[0]);
    assert.ok(nbSeancesIa >= 15, `séances générées : ${nbSeancesIa}`);
    await boutonValider.click();
    await page.locator('.toast', { hasText: 'Plan enregistré' }).waitFor();
    await page.getByText('Phase actuelle : foncière').waitFor();
    // Chaque séance IA est placée dans un créneau : son heure de début s'affiche dans le planning.
    await page.locator('.ligne-seance', { hasText: /🏃 · (6 h|18 h)\b.* · Endurance · 15 min/ }).first().waitFor();
    assert.ok(await page.locator('.ecran .etiquette-ia').count() < nbSeancesIa); // 4 semaines affichées d'emblée
    await page.getByRole('button', { name: /^Afficher les \d+ semaines suivantes$/ }).click();
    assert.equal(await page.locator('.ecran .etiquette-ia').count(), nbSeancesIa);
    // La séance ajoutée à la main (faite) est toujours là.
    await page.locator('.ecran .ligne-seance', { hasText: 'Fractionné' }).waitFor();
    await capture('12-plan-ia');

    etape('Plan IA : « Démarrer l\'objectif » relance la génération pour tous les objectifs en cours');
    await page.getByRole('link', { name: 'Objectifs', exact: true }).click();
    await page.locator('.objectif', { hasText: 'Tri de Paris' }).getByRole('button', { name: 'Démarrer l\'objectif' }).click();
    await page.locator('.boite').getByRole('button', { name: 'Démarrer' }).click();
    await boutonValider.waitFor();
    assert.equal(appelsApi.length, 2);
    assert.ok(['Semi de Lyon', 'Tri de Paris'].every(n => appelsApi[1].corps.messages[0].content.includes(n)), 'plan mutualisé : les deux objectifs en cours sont envoyés');
    await boutonValider.click();
    await page.locator('.toast', { hasText: 'Plan enregistré' }).waitFor();
    // Recalcul : les séances IA à venir sont remplacées, pas dupliquées.
    const iaApres = await page.evaluate(async () => (await import('./js/magasin.js')).etat.prevues.filter(p => p.source === 'ia').length);
    assert.equal(iaApres, nbSeancesIa);

    etape('Plan IA : mode secours (copier le prompt, coller la réponse)');
    await page.getByRole('button', { name: 'Recalculer le plan', exact: true }).click();
    await page.locator('.secours summary').click();
    await page.getByRole('button', { name: 'Copier le prompt' }).click();
    await page.locator('.toast', { hasText: 'Prompt copié' }).waitFor();
    const prompt = await page.evaluate(() => navigator.clipboard.readText());
    assert.match(prompt, /Réponds uniquement par un objet JSON/);
    assert.match(prompt, /Tri de Paris/);
    assert.ok(!prompt.includes('cle-de-test-locale'));
    await page.locator('.feuille [name=reponse]').fill('{"analyse":"","phases":[],"seances":[{"date":"2000-01-01","discipline":"course","type":"endurance","intensite":"facile","dureeMin":30,"distanceKm":null,"echauffement":"","corps":"","retourCalme":"","objectifIds":[]}]}');
    await page.getByRole('button', { name: 'Analyser la réponse' }).click();
    await page.getByText(/Réponse rejetée : .*2000-01-01/).waitFor();
    await page.locator('.feuille [name=reponse]').fill('Voici le plan :\n```json\n' + JSON.stringify(await planConforme()) + '\n```');
    await page.getByRole('button', { name: 'Analyser la réponse' }).click();
    await boutonValider.click();
    await page.locator('.toast', { hasText: 'Plan enregistré' }).waitFor();
    await page.getByText(/Généré le .*\(mode secours\)/).waitFor();
    assert.equal(appelsApi.length, 2, 'le mode secours n\'appelle pas l\'API');
    await page.unroute('https://api.anthropic.com/v1/messages');

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

    etape('Suivi de blessure : démarrage, bilan du jour, carte verte, contrainte du plan IA');
    await page.goto(`${URL_APP}#/accueil`);
    await page.locator('a.lien-soin').click();
    await page.getByRole('button', { name: '＋ Démarrer un suivi' }).click();
    await page.locator('.feuille').getByRole('button', { name: 'Démarrer le suivi' }).click();
    await page.getByText('Choisissez le côté atteint.').waitFor();
    await page.locator('.feuille .puce', { hasText: 'Gauche' }).click();
    await page.locator('.feuille').getByRole('button', { name: 'Démarrer le suivi' }).click();
    await page.locator('.boite', { hasText: 'Recalculer le plan' }).getByRole('button', { name: 'Plus tard' }).click();
    await page.getByRole('heading', { name: 'Tendon d\'Achille gauche' }).waitFor();
    await page.getByText('Phase 1/3 · Calmer · semaine 1').waitFor();
    await capture('13-soin');
    await page.getByRole('button', { name: 'Faire le bilan du jour' }).first().click();
    await page.locator('.feuille').getByRole('button', { name: 'Enregistrer' }).click();
    await page.getByText('Raideur au réveil : note obligatoire.').waitFor();
    await page.locator('.feuille [name=raideurMatin][value="5"]').check({ force: true });
    await page.locator('.feuille [name=douleurMarche][value="4"]').check({ force: true });
    await page.locator('.feuille [name=douleurEscaliers][value="6"]').check({ force: true });
    await page.locator('.feuille .puce', { hasText: 'Isométrie debout' }).click();
    await capture('14-bilan');
    await page.locator('.feuille').getByRole('button', { name: 'Enregistrer' }).click();
    await page.locator('.toast', { hasText: 'Bilan enregistré' }).waitFor();
    assert.match(await page.locator('.ecran .ligne-bilan').textContent(), /Réveil 5\/10 · marche 4\/10 · escaliers 6\/10/);
    await page.locator('.graphique .barre-soin').waitFor();
    await page.goto(`${URL_APP}#/accueil`);
    await page.locator('.carte-soin', { hasText: 'Bilan du jour fait' }).waitFor();
    await page.locator('.jour-auj .pastille-soin').waitFor();
    await capture('15-accueil-soin');
    await page.getByRole('link', { name: 'Plan', exact: true }).click();
    await page.locator('.soin-plan', { hasText: 'Tendon d\'Achille gauche en phase 1' }).waitFor();
    await page.getByText('Le plan a été calculé pour une autre phase').waitFor(); // plan généré avant le suivi
    const contexteSoin = await page.evaluate(async () => {
      const M = await import('./js/magasin.js');
      const IA = await import('./js/ia.js');
      const F = await import('./js/format.js');
      return IA.construireContexte(M.etat, F.aujourdhui()).blessures;
    });
    assert.equal(contexteSoin.length, 1);
    assert.equal(contexteSoin[0].projection[0].courseAutorisee, false);

    etape('Séances de soin dans le planning : pastille, compteur Soin, lien avec le bilan, onglet Plan, régénération');
    const etatSoin = () => page.evaluate(async () => {
      const M = await import('./js/magasin.js');
      const F = await import('./js/format.js');
      const auj = F.aujourdhui();
      const seance = M.etat.seancesSoin.find(x => x.date === auj);
      const bilan = M.etat.bilans.find(b => b.date === auj);
      return { nb: M.etat.seancesSoin.length, etat: seance?.etat, phase: seance?.phase, exercices: seance?.exercices.map(e => e.id), bilan: bilan?.exercices ?? null,
        futures: M.etat.seancesSoin.filter(x => x.date > auj).sort((a, b) => a.date.localeCompare(b.date)).map(x => ({ etat: x.etat, phase: x.phase })) };
    });
    // Le bilan du jour cochait déjà tous les exercices de la séance (isométrie debout en semaine 1) : séance « faite ».
    let soin = await etatSoin();
    assert.equal(soin.etat, 'faite');
    assert.deepEqual(soin.exercices, ['iso_debout']);
    assert.ok(soin.futures.every(x => x.etat === 'a_faire'));
    // Planning sur les 3 phases (durées maximales) : phase 1, puis 2, puis 3, dans l'ordre des dates.
    assert.deepEqual([...new Set(soin.futures.map(x => x.phase))], [1, 2, 3]);
    assert.ok(soin.futures.length >= 70, `séances de soin à venir : ${soin.futures.length}`);
    await page.goto(`${URL_APP}#/accueil`);
    const pastilleDuJour = page.locator('.jour-auj .pastille-soin');
    await pastilleDuJour.and(page.locator('.etat-faite')).waitFor();
    assert.match(await page.locator('.bilan-soin').textContent(), /^Soin1\/\d+ faitehors plafond$/);
    // Les compteurs d'entraînement ne comptent pas le soin.
    const prevuSemaine = await page.evaluate(async () => {
      const M = await import('./js/magasin.js'); const D = await import('./js/domaine.js'); const F = await import('./js/format.js');
      return D.semaine(F.lundiDe(F.aujourdhui()), M.etat.prevues, M.etat.realisees).prevu.nb;
    });
    assert.match(await page.locator('.bilan-semaine > div').first().textContent(), new RegExp(`^Prévu${prevuSemaine} séance`));
    await capture('16-accueil-seance-soin');

    // Séance → bilan : « Remettre à faire » décoche l'exercice, « Marquer faite » le recoche.
    await pastilleDuJour.click();
    await page.locator('.feuille .detail-soin', { hasText: 'Sur les 2 pieds · 5 × 45 s' }).waitFor();
    await capture('17-seance-soin');
    await page.getByRole('button', { name: 'Remettre à faire' }).click();
    await page.locator('.toast', { hasText: 'remise à faire' }).waitFor();
    soin = await etatSoin();
    assert.equal(soin.etat, 'a_faire');
    assert.deepEqual(soin.bilan, []);
    await pastilleDuJour.and(page.locator('.etat-a_faire')).waitFor();
    await pastilleDuJour.click();
    await page.getByRole('button', { name: 'Marquer faite' }).click();
    await page.locator('.toast', { hasText: 'Séance de soin faite' }).waitFor();
    soin = await etatSoin();
    assert.equal(soin.etat, 'faite');
    assert.deepEqual(soin.bilan, ['iso_debout']);

    // Bilan → séance : décocher l'exercice repasse la séance « à faire », le recocher la repasse « faite ».
    await page.locator('.carte-soin .ligne-bilan').click();
    await page.locator('.feuille .puce', { hasText: 'Isométrie debout' }).click();
    await page.locator('.feuille').getByRole('button', { name: 'Enregistrer' }).click();
    await page.locator('.feuille').waitFor({ state: 'detached' });
    await pastilleDuJour.and(page.locator('.etat-a_faire')).waitFor();
    assert.equal((await etatSoin()).etat, 'a_faire');
    await page.locator('.carte-soin .ligne-bilan').click();
    await page.locator('.feuille .puce', { hasText: 'Isométrie debout' }).click();
    await page.locator('.feuille').getByRole('button', { name: 'Enregistrer' }).click();
    await page.locator('.feuille').waitFor({ state: 'detached' });
    await pastilleDuJour.and(page.locator('.etat-faite')).waitFor();
    assert.equal((await etatSoin()).etat, 'faite');

    // Onglet Plan : séances de soin en vert, et « En retard » pour une séance passée encore à faire.
    await page.evaluate(async () => {
      const M = await import('./js/magasin.js'); const db = await import('./js/db.js'); const F = await import('./js/format.js');
      const modele = M.etat.seancesSoin[0];
      const passee = { ...modele, id: 'soin-hier', date: F.ajouterJours(F.aujourdhui(), -1), etat: 'a_faire' };
      await db.mettre('seancesSoin', passee);
      M.etat.seancesSoin.push(passee);
    });
    await page.getByRole('link', { name: 'Plan', exact: true }).click();
    await page.locator('.ligne-soin', { hasText: 'Soin · Tendon d\'Achille gauche · 1 exercice' }).first().waitFor();
    await page.locator('.carte', { hasText: 'En retard' }).locator('.ligne-soin').waitFor();
    await capture('18-plan-soin');
    await page.locator('.carte', { hasText: 'En retard' }).locator('.ligne-soin').click();
    await page.getByRole('button', { name: 'Marquer ratée' }).click();
    await page.locator('.toast', { hasText: 'ratée' }).waitFor();
    assert.equal(await page.locator('.carte', { hasText: 'En retard' }).count(), 0);

    // Changement de phase : les séances futures « à faire » sont régénérées (phase 2 : un jour sur deux),
    // la séance faite du jour est conservée ; retour en phase 1 par le bouton de l'écran du suivi.
    await page.evaluate(async () => {
      const M = await import('./js/magasin.js');
      await M.changerPhaseSuivi(M.etat.blessures[0].id, 2);
    });
    soin = await etatSoin();
    assert.equal(soin.etat, 'faite');
    assert.equal(soin.phase, 1);
    assert.deepEqual([...new Set(soin.futures.map(x => x.phase))], [2, 3]);
    await page.goto(`${URL_APP}#/soin`);
    await page.getByRole('button', { name: 'Revenir en phase 1' }).click();
    await page.locator('.boite').getByRole('button', { name: 'Revenir' }).click();
    await page.locator('.boite', { hasText: 'Recalculer' }).getByRole('button', { name: 'Plus tard' }).click();
    soin = await etatSoin();
    assert.deepEqual([...new Set(soin.futures.map(x => x.phase))], [1, 2, 3]);

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
    assert.equal(exportJson.donnees.blessures.length, 1);
    assert.equal(exportJson.donnees.bilans.length, 1);
    assert.equal(exportJson.format, 3);
    assert.ok(exportJson.donnees.seancesSoin.length >= 70);
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
    await page.locator('.boite', { hasText: /2 objectif\(s\), \d+ séance\(s\) prévue\(s\), 2 séance\(s\) réalisée\(s\)/ }).waitFor();
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
