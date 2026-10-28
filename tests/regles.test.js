// Tests des règles métier : node tests/regles.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as D from '../js/domaine.js';
import * as F from '../js/format.js';
import { construireExport, lireImport } from '../js/sauvegarde.js';

const AUJ = '2026-10-28'; // un mercredi

const nouvelObjectif = (o = {}) => D.creerObjectif({
  nom: 'Marathon de test', sport: 'course', type: 'marathon', dateEpreuve: '2027-04-11', distanceKm: 42.195, ...o,
});

// ------------------------------------------------------------ Cycle de vie

test('cycle de vie : À démarrer → En cours → Terminé', () => {
  const o = nouvelObjectif();
  assert.equal(o.statut, 'a_demarrer');
  assert.equal(o.dateDemarrage, null);

  const demarre = D.demarrerObjectif(o, AUJ);
  assert.equal(demarre.statut, 'en_cours');
  assert.equal(demarre.dateDemarrage, AUJ);

  const fini = D.terminerObjectif(demarre, { tempsS: 3 * 3600 + 25 * 60, classement: '512e', ressenti: 4, commentaire: ' Super ' }, '2027-04-11');
  assert.equal(fini.statut, 'termine');
  assert.deepEqual(fini.resultat, { tempsS: 12300, classement: '512e', ressenti: 4, commentaire: 'Super', dateSaisie: '2027-04-11' });
});

test('cycle de vie : transitions interdites', () => {
  const o = nouvelObjectif();
  assert.throws(() => D.terminerObjectif(o, {}, AUJ), /En cours/);
  const demarre = D.demarrerObjectif(o, AUJ);
  assert.throws(() => D.demarrerObjectif(demarre, AUJ), /À démarrer/);
  const fini = D.terminerObjectif(demarre, {}, AUJ);
  assert.throws(() => D.demarrerObjectif(fini, AUJ));
  assert.throws(() => D.terminerObjectif(fini, {}, AUJ));
  assert.throws(() => D.terminerObjectif(demarre, { ressenti: 7 }, AUJ), /1 à 5/);
});

test('cycle de vie : aucun changement de statut automatique (modification, date passée)', () => {
  const o = D.demarrerObjectif(nouvelObjectif({ dateEpreuve: '2026-01-01' }), '2025-09-01');
  const modifie = D.modifierObjectif(o, { nom: 'Autre nom', statut: 'termine', dateDemarrage: null });
  assert.equal(modifie.statut, 'en_cours');
  assert.equal(modifie.dateDemarrage, '2025-09-01');
  assert.equal(modifie.nom, 'Autre nom');
  // Une épreuve passée reste « En cours » : seule une alerte est levée.
  const al = D.alertes({ objectifs: [modifie], semainier: null, aujourdhui: AUJ });
  assert.equal(modifie.statut, 'en_cours');
  assert.ok(al.some(a => a.code === 'epreuve_passee'));
});

test('objectif : champs obligatoires et distances FFTri préremplies', () => {
  assert.throws(() => nouvelObjectif({ dateEpreuve: '' }), /date de l'épreuve/);
  assert.throws(() => nouvelObjectif({ nom: '  ' }), /nom/);
  assert.throws(() => nouvelObjectif({ type: 'XS' }), /type/);
  assert.deepEqual(D.distancesParDefaut('triathlon', 'M'), { natationM: 1500, veloKm: 40, courseKm: 10 });
  assert.deepEqual(D.distancesParDefaut('triathlon', 'XXL'), { natationM: 3800, veloKm: 180, courseKm: 42.195 });
  const tri = D.creerObjectif({ nom: 'Tri', sport: 'triathlon', type: 'S', dateEpreuve: '2027-06-01', natationM: '800', veloKm: '22,5', courseKm: 5 });
  assert.equal(tri.natationM, 800);
  assert.equal(tri.veloKm, 22.5);
  assert.equal(tri.distanceKm, undefined);
});

// ------------------------------------------------------------ Mutualisation

test('mutualisation : une séance est rattachée à tous les objectifs en cours de sa discipline', () => {
  const marathon = D.demarrerObjectif(nouvelObjectif(), AUJ);
  const tri = D.demarrerObjectif(D.creerObjectif({ nom: 'Tri M', sport: 'triathlon', type: 'M', dateEpreuve: '2027-06-01' }), AUJ);
  const futur = nouvelObjectif({ nom: '10 km pas démarré', type: '10km' });
  const objectifs = [marathon, tri, futur];

  const course = D.enregistrerRealisee({ date: AUJ, discipline: 'course', dureeS: 3600, distanceKm: 10 }, objectifs);
  assert.deepEqual(course.objectifIds.sort(), [marathon.id, tri.id].sort());

  const velo = D.enregistrerRealisee({ date: AUJ, discipline: 'velo', dureeS: 5400, distanceKm: 45 }, objectifs);
  assert.deepEqual(velo.objectifIds, [tri.id]);

  const renfo = D.enregistrerRealisee({ date: AUJ, discipline: 'renforcement', dureeS: 1800 }, objectifs);
  assert.deepEqual(renfo.objectifIds.sort(), [marathon.id, tri.id].sort());

  const enchainement = D.enregistrerRealisee({ date: AUJ, discipline: 'enchainement', dureeS: 4000, distanceKm: 35 }, objectifs);
  assert.deepEqual(enchainement.objectifIds, [tri.id]);
});

test('mutualisation : un objectif terminé garde ses séances, sans en recevoir de nouvelles', () => {
  const a = D.demarrerObjectif(nouvelObjectif(), AUJ);
  const r = D.enregistrerRealisee({ date: AUJ, discipline: 'course', dureeS: 3600 }, [a]);
  const fini = D.terminerObjectif(a, {}, AUJ);
  const b = D.demarrerObjectif(nouvelObjectif({ nom: 'Suivant' }), AUJ);
  // Modification de la séance après la fin de l'objectif A : le lien historique est conservé.
  const modifiee = D.enregistrerRealisee({ ...r, notes: 'corrigée' }, [fini, b], r);
  assert.deepEqual(modifiee.objectifIds.sort(), [a.id, b.id].sort());
  assert.equal(modifiee.id, r.id);
  // Nouvelle séance : pas de rattachement à l'objectif terminé.
  const nouvelle = D.enregistrerRealisee({ date: AUJ, discipline: 'course', dureeS: 1200 }, [fini, b]);
  assert.deepEqual(nouvelle.objectifIds, [b.id]);
});

test('séance réalisée : validations', () => {
  assert.throws(() => D.enregistrerRealisee({ date: AUJ, discipline: 'course' }, []), /durée/);
  assert.throws(() => D.enregistrerRealisee({ date: '', discipline: 'course', dureeS: 60 }, []), /date/);
  assert.throws(() => D.enregistrerRealisee({ date: AUJ, discipline: 'ski', dureeS: 60 }, []), /discipline/);
  assert.throws(() => D.enregistrerRealisee({ date: AUJ, discipline: 'course', dureeS: 60, ressenti: 0 }, []), /1 à 5/);
});

test('saisie rapide : préremplissage depuis la séance prévue du jour', () => {
  const p = D.creerPrevue({ date: AUJ, discipline: 'course', type: 'fractionne', dureeS: 2700, distanceKm: 8 });
  const autre = D.creerPrevue({ date: '2026-10-29', discipline: 'velo', dureeS: 3600 });
  const duJour = D.prevuesAFaire([p, autre], AUJ);
  assert.deepEqual(duJour.map(x => x.id), [p.id]);
  const b = D.brouillonDepuisPrevue(duJour[0], AUJ);
  assert.equal(b.prevueId, p.id);
  assert.equal(b.dureeS, 2700);
  assert.equal(b.distanceKm, 8);
  assert.equal(D.prochaineSeance([autre, p], AUJ).id, p.id);
  assert.throws(() => D.creerPrevue({ date: AUJ, discipline: 'course' }), /durée et\/ou une distance/);
});

// ------------------------------------------------------------ Allure / vitesse

test("calcul d'allure et de vitesse", () => {
  assert.equal(D.allure({ discipline: 'course', dureeS: 3000, distanceKm: 10 }).texte, '5:00 /km');
  assert.equal(D.allure({ discipline: 'course', dureeS: 3 * 3600 + 30 * 60, distanceKm: 42.195 }).texte, '4:59 /km');
  assert.equal(D.allure({ discipline: 'natation', dureeS: 1800, distanceKm: 1.5 }).texte, '2:00 /100 m');
  assert.equal(D.allure({ discipline: 'velo', dureeS: 5400, distanceKm: 45 }).texte, '30 km/h');
  assert.equal(D.allure({ discipline: 'velo', dureeS: 3600, distanceKm: 28.44 }).texte, '28,4 km/h');
  assert.equal(D.allure({ discipline: 'renforcement', dureeS: 1800, distanceKm: 1 }), null);
  assert.equal(D.allure({ discipline: 'course', dureeS: 1800, distanceKm: null }), null);
});

test('formats français', () => {
  assert.equal(F.duree(45 * 60), '45 min');
  assert.equal(F.duree(65 * 60), '1 h 05');
  assert.equal(F.duree(2 * 3600), '2 h');
  assert.equal(F.chrono(3 * 3600 + 5 * 60 + 9), '3:05:09');
  assert.equal(F.chrono(42 * 60 + 15), '42:15');
  assert.equal(F.hmsVersSecondes('1', '05', ''), 3900);
  assert.equal(F.hmsVersSecondes('', '', ''), null);
  assert.equal(F.lireNombre('12,5'), 12.5);
  assert.equal(F.lireNombre('1 500'), 1500);
  assert.equal(F.lireNombre('abc'), null);
  assert.equal(F.dateFr('2026-10-28'), '28 octobre 2026');
  assert.equal(F.lundiDe('2026-10-28'), '2026-10-26');
  assert.equal(F.lundiDe('2026-11-01'), '2026-10-26'); // dimanche
  assert.equal(F.ajouterJours('2026-10-24', 2), '2026-10-26'); // passage à l'heure d'hiver
  assert.equal(F.distance(1.5, 'natation'), '1500 m');
});

// ------------------------------------------------------------ Alertes

test('alerte : délai trop court selon le type', () => {
  const marathon = nouvelObjectif({ dateEpreuve: F.ajouterJours(AUJ, 10 * 7) }); // 10 semaines < 16
  const dixKm = nouvelObjectif({ type: '10km', dateEpreuve: F.ajouterJours(AUJ, 10 * 7) }); // 10 ≥ 8
  const al = D.alertes({ objectifs: [marathon, dixKm], semainier: null, aujourdhui: AUJ });
  assert.deepEqual(al.filter(a => a.code === 'delai_court').map(a => a.objectifId), [marathon.id]);
  // En cours : le délai se mesure depuis la date de démarrage.
  const demarre = D.demarrerObjectif(nouvelObjectif({ dateEpreuve: '2027-03-01' }), '2026-10-01'); // 21 semaines
  assert.equal(D.alertes({ objectifs: [demarre], semainier: null, aujourdhui: '2027-02-01' }).length, 0);
  // Trail : seuil selon la distance.
  assert.equal(D.semainesMinimales({ sport: 'course', type: 'trail', distanceKm: 25 }), 10);
  assert.equal(D.semainesMinimales({ sport: 'course', type: 'trail', distanceKm: 45 }), 16);
  assert.equal(D.semainesMinimales({ sport: 'course', type: 'trail', distanceKm: 80 }), 20);
  assert.equal(D.semainesMinimales({ sport: 'triathlon', type: 'XXL' }), 24);
});

test('alerte : semainier insuffisant (jours et disciplines)', () => {
  const s = D.semainierParDefaut();
  s.plafondSeances = 4;
  s.jours[1] = { disponible: true, dureeMaxMin: 60, disciplines: ['course'] };
  s.jours[3] = { disponible: true, dureeMaxMin: 60, disciplines: ['course', 'velo'] };
  s.jours[5] = { disponible: false, dureeMaxMin: 60, disciplines: ['natation'] }; // indisponible : ne compte pas
  const tri = D.demarrerObjectif(D.creerObjectif({ nom: 'Tri', sport: 'triathlon', type: 'S', dateEpreuve: '2027-09-01' }), AUJ);
  const al = D.alertes({ objectifs: [tri], semainier: s, aujourdhui: AUJ });
  assert.ok(al.some(a => a.code === 'semainier_jours' && a.message.includes('2 jours disponibles')));
  const disc = al.find(a => a.code === 'semainier_disciplines');
  assert.ok(disc && disc.message.includes('natation'));

  s.plafondSeances = 2;
  s.jours[5].disponible = true;
  assert.deepEqual(D.alertes({ objectifs: [tri], semainier: s, aujourdhui: AUJ }), []);
});

test('alerte : rappel de sauvegarde après 30 jours', () => {
  const base = { objectifs: [], semainier: null, aujourdhui: AUJ, aDesDonnees: true };
  assert.equal(D.alertes({ ...base, derniereSauvegarde: '2026-10-01' }).length, 0);
  assert.equal(D.alertes({ ...base, derniereSauvegarde: '2026-09-28' })[0].code, 'sauvegarde');
  assert.equal(D.alertes({ ...base, premiereUtilisation: '2026-09-01' })[0].code, 'sauvegarde');
  assert.equal(D.alertes({ ...base, premiereUtilisation: '2026-10-20' }).length, 0);
  assert.equal(D.alertes({ ...base, aDesDonnees: false, premiereUtilisation: '2026-01-01' }).length, 0);
});

// ------------------------------------------------------------ Agrégats

test('avancement et totaux par semaine', () => {
  const o = D.demarrerObjectif(nouvelObjectif({ dateEpreuve: '2026-11-25' }), '2026-10-01'); // 55 jours
  const r1 = D.enregistrerRealisee({ date: '2026-10-27', discipline: 'course', dureeS: 3600, distanceKm: 12 }, [o]);
  const r2 = D.enregistrerRealisee({ date: '2026-10-25', discipline: 'renforcement', dureeS: 1800 }, [o]);
  const r3 = D.enregistrerRealisee({ date: '2026-10-28', discipline: 'velo', dureeS: 3600, distanceKm: 30 }, [o]);
  const a = D.avancement(o, [r1, r2, r3], AUJ);
  assert.equal(a.pctTemps, Math.round((27 / 55) * 100));
  assert.equal(a.nbSeances, 2); // le vélo n'alimente pas un marathon
  assert.equal(a.joursRestants, 28);
  assert.equal(a.semainesRestantes, 4);

  const semaines = D.totauxParSemaine([r1, r2, r3]);
  assert.deepEqual(semaines.map(s => s.lundi), ['2026-10-26', '2026-10-19']);
  assert.equal(semaines[0].nb, 2);
  assert.equal(semaines[0].dureeS, 7200);
  assert.equal(semaines[0].parDiscipline.velo.distanceKm, 30);

  assert.deepEqual(D.filtrerRealisees([r1, r2, r3], { discipline: 'velo' }).map(r => r.id), [r3.id]);
  assert.deepEqual(D.filtrerRealisees([r1, r2, r3], { objectifId: o.id }).map(r => r.id), [r1.id, r2.id]);
});

// ------------------------------------------------------------ Export / import

test('export / import : aller-retour complet, sans clé API', () => {
  const o = D.demarrerObjectif(nouvelObjectif(), AUJ);
  const p = D.creerPrevue({ date: AUJ, discipline: 'course', dureeS: 1800, objectifIds: [o.id] });
  const r = D.enregistrerRealisee({ date: AUJ, discipline: 'course', dureeS: 1800, distanceKm: 6, prevueId: p.id }, [o]);
  const etat = {
    profil: { ...D.profilParDefaut(), niveau: 'Intermédiaire' },
    semainier: D.semainierParDefaut(),
    reglages: { modeleIa: 'claude-sonnet-5-5', cleApi: 'sk-ant-secret' },
    objectifs: [o], prevues: [p], realisees: [r],
    appareil: { cleApi: 'sk-ant-secret', derniereSauvegarde: AUJ },
  };
  const json = construireExport(etat);
  const texte = JSON.stringify(json);
  assert.ok(!texte.includes('sk-ant-secret'), 'la clé API ne doit jamais être exportée');
  assert.ok(!texte.includes('derniereSauvegarde'));
  assert.equal(json.application, 'dossard');

  const relu = lireImport(texte);
  assert.deepEqual(relu.objectifs, [o]);
  assert.deepEqual(relu.prevues, [p]);
  assert.deepEqual(relu.realisees, [r]);
  assert.equal(relu.profil.niveau, 'Intermédiaire');
  assert.equal(relu.reglages.modeleIa, 'claude-sonnet-5-5');
});

test('import : fichiers invalides refusés', () => {
  assert.throws(() => lireImport('pas du json'), /JSON/);
  assert.throws(() => lireImport('{"application":"autre"}'), /Dossard/);
  assert.throws(() => lireImport('{"application":"dossard","format":99,"donnees":{}}'), /format/);
  assert.throws(() => lireImport('{"application":"dossard","format":1,"donnees":{"objectifs":[],"prevues":[]}}'), /realisees/);
  assert.throws(() => lireImport('{"application":"dossard","format":1,"donnees":{"objectifs":[{"nom":"x"}],"prevues":[],"realisees":[]}}'), /identifiant/);
  // Une clé API glissée dans un fichier n'est pas importée.
  const d = lireImport('{"application":"dossard","format":1,"donnees":{"objectifs":[],"prevues":[],"realisees":[],"reglages":{"cleApi":"x"}}}');
  assert.equal(d.reglages.cleApi, undefined);
  assert.equal(d.semainier.jours.length, 7);
});
