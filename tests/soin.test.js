// Tests du suivi de blessure (programme de soin) : node tests/soin.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as D from '../js/domaine.js';
import * as S from '../js/soin.js';
import * as IA from '../js/ia.js';
import { ajouterJours } from '../js/format.js';
import { construireExport, lireImport, resumeImport } from '../js/sauvegarde.js';

const AUJ = '2026-10-30'; // vendredi

const nouveauSuivi = (o = {}) => S.creerSuivi({ programme: 'achille_corps', cote: 'gauche', debut: AUJ, ...o });

// Ajoute des bilans jour après jour (valeurs par défaut basses), à partir de `debut`.
function bilans(suivi, debut, liste) {
  const res = [];
  liste.forEach((v, i) => {
    res.push(S.enregistrerBilan({
      blessureId: suivi.id, date: ajouterJours(debut, i),
      raideurMatin: 1, douleurMarche: 1, douleurEscaliers: 1, ...v,
    }, suivi, res));
  });
  return res;
}

// ------------------------------------------------------------ Cycle de vie du suivi

test('suivi : création, changement de phase, retour, fin', () => {
  const s = nouveauSuivi();
  assert.equal(s.statut, 'en_cours');
  assert.equal(s.phase, 1);
  assert.equal(S.nomSuivi(s), 'Tendon d\'Achille gauche');
  assert.throws(() => S.creerSuivi({ programme: 'achille_corps', debut: AUJ }), /côté/);
  assert.throws(() => S.creerSuivi({ programme: 'inconnu', cote: 'droit', debut: AUJ }), /programme/);

  const p2 = S.changerPhase(s, 2, '2026-11-20');
  assert.equal(p2.phase, 2);
  assert.equal(p2.phaseDebut, '2026-11-20');
  assert.deepEqual(p2.historique.map(x => x.phase), [1, 2]);
  assert.throws(() => S.changerPhase(p2, 2, '2026-11-21'), /déjà/);
  assert.throws(() => S.changerPhase(p2, 3, '2026-11-01'), /précède/);
  const retour = S.changerPhase(p2, 1, '2026-11-25');
  assert.equal(retour.phase, 1);

  const fini = S.terminerSuivi(p2, '2027-03-01');
  assert.equal(fini.statut, 'termine');
  assert.throws(() => S.changerPhase(fini, 3, '2027-03-02'), /terminé/);
  assert.deepEqual(S.suivisActifs([s, fini]), [s]);
});

test('bilan : notes de 0 à 10, un seul bilan par jour, test des montées complet', () => {
  const s = nouveauSuivi();
  const b = S.enregistrerBilan({ blessureId: s.id, date: AUJ, raideurMatin: 5, douleurMarche: 4, douleurEscaliers: 6, douleurCourse: null, notes: ' ok ' }, s, []);
  assert.equal(b.douleurCourse, null);
  assert.equal(b.notes, 'ok');
  // Même jour, sans identifiant : on reprend le bilan existant.
  const b2 = S.enregistrerBilan({ blessureId: s.id, date: AUJ, raideurMatin: 4, douleurMarche: 4, douleurEscaliers: 5 }, s, [b]);
  assert.equal(b2.id, b.id);
  assert.throws(() => S.enregistrerBilan({ blessureId: s.id, date: AUJ, raideurMatin: 11, douleurMarche: 1, douleurEscaliers: 1 }, s, []), /0 à 10/);
  assert.throws(() => S.enregistrerBilan({ blessureId: s.id, date: AUJ, douleurMarche: 1, douleurEscaliers: 1 }, s, []), /obligatoire/);
  assert.throws(() => S.enregistrerBilan({ blessureId: s.id, date: '2026-10-01', raideurMatin: 1, douleurMarche: 1, douleurEscaliers: 1 }, s, []), /précède/);
  assert.throws(() => S.enregistrerBilan({ blessureId: s.id, date: AUJ, raideurMatin: 1, douleurMarche: 1, douleurEscaliers: 1, testMonteesNb: 15 }, s, []), /montées/);
});

// ------------------------------------------------------------ Séance du jour

test('séance du jour : dosage selon la semaine de la phase, côté, alternance fixe un jour sur deux', () => {
  const s = nouveauSuivi({ debut: '2026-10-20' }); // semaine 2 le 30/10
  const vide = S.seanceDuJour(s, '2026-10-20');
  assert.equal(vide.semaine, 1);
  assert.deepEqual(vide.exercices.map(e => e.id), ['iso_debout']); // assis et montées pas encore introduits
  assert.match(vide.exercices[0].dosage, /2 pieds/);

  // 30/10 = 10 jours après le début de la phase : jour pair, jour d'exercice pour les « un jour sur deux ».
  const j = S.seanceDuJour(s, AUJ);
  assert.equal(j.semaine, 2);
  assert.deepEqual(j.exercices.map(e => e.id), ['iso_debout', 'iso_assis', 'montees_lentes']);
  assert.equal(j.exercices[0].dosage, 'Jambe gauche seule · 5 × 45 s');
  assert.equal(j.exercices[0].repos, false); // tous les jours
  assert.equal(j.exercices[2].repos, false);
  // Le lendemain : repos pour les montées, quel que soit le bilan de la veille (alternance fixe).
  assert.equal(S.seanceDuJour(s, '2026-10-31').exercices[2].repos, true);
  assert.equal(S.jourAlterneActif(s, '2026-11-01'), true);

  const tard = S.seanceDuJour(s, '2026-12-30'); // au-delà de la dernière semaine décrite : dernier dosage
  assert.match(tard.exercices[0].dosage, /10 kg/);
});

// ------------------------------------------------------------ Alertes

test('alertes : raideur en hausse deux jours de suite, course > 4/10, exercices > 4/10', () => {
  const s = nouveauSuivi({ debut: '2026-10-20' });
  const liste = bilans(s, '2026-10-28', [{ raideurMatin: 2 }, { raideurMatin: 3 }, { raideurMatin: 5, douleurCourse: 6, douleurExercices: 5 }]);
  const codes = S.alertesSoin(s, liste, AUJ).map(a => a.code);
  assert.deepEqual(codes, ['raideur_hausse', 'course_douloureuse', 'exercices_douloureux']);
  assert.match(S.alertesSoin(s, liste, AUJ)[1].message, /2026-11-06/);
  // Une baisse interrompt la série ; un trou de plusieurs jours aussi.
  const stable = bilans(s, '2026-10-28', [{ raideurMatin: 2 }, { raideurMatin: 3 }, { raideurMatin: 3 }]);
  assert.deepEqual(S.alertesSoin(s, stable, AUJ), []);
  assert.deepEqual(S.alertesSoin(s, liste, '2026-11-12'), []);
});

// ------------------------------------------------------------ Critères de passage

test('critères phase 1 → 2 : durée, marche, escaliers, raideur en baisse, test des montées', () => {
  const s = nouveauSuivi({ debut: '2026-10-16' });
  const debut = Array.from({ length: 12 }, (_, i) => ({ raideurMatin: Math.max(1, 6 - Math.floor(i / 2)), douleurMarche: 2, douleurEscaliers: 3 }));
  let liste = bilans(s, '2026-10-16', debut);
  let r = S.criteresPassage(s, liste, '2026-10-27');
  assert.equal(r.suivante.numero, 2);
  assert.equal(r.pret, false);
  assert.deepEqual(r.criteres.filter(c => !c.ok).map(c => c.id), ['duree', 'test']);
  // Test des montées réussi + 14 jours écoulés.
  liste = bilans(s, '2026-10-16', [...debut, { raideurMatin: 1 }, { raideurMatin: 1, testMonteesNb: 15, testMonteesDouleur: 4 }, { raideurMatin: 1 }]);
  r = S.criteresPassage(s, liste, AUJ);
  assert.equal(r.pret, true, JSON.stringify(r.criteres));
  // Douleur au test trop forte : non rempli.
  liste[13] = { ...liste[13], testMonteesDouleur: 5 };
  assert.equal(S.criteresPassage(s, liste, AUJ).pret, false);
});

test('critères : raideur non mesurée récemment ou trop peu de bilans', () => {
  const s = nouveauSuivi({ debut: '2026-10-01' });
  const r = S.criteresPassage(s, bilans(s, '2026-10-01', [{}, {}]), AUJ);
  assert.match(r.criteres.find(c => c.id === 'raideur').valeur, /2 bilans sur 3/);
  const r2 = S.criteresPassage(s, bilans(s, '2026-10-01', [{}, {}, {}, {}]), AUJ);
  assert.equal(r2.criteres.find(c => c.id === 'raideur').ok, false); // dernier bilan trop ancien
  assert.equal(r2.criteres.find(c => c.id === 'marche').ok, false);
});

test('critères phase 3 : pas de phase suivante (fin du programme)', () => {
  const s = S.changerPhase(S.changerPhase(nouveauSuivi({ debut: '2026-06-01' }), 2, '2026-07-01'), 3, '2026-09-25');
  const liste = bilans(s, '2026-10-20', Array.from({ length: 11 }, () => ({ raideurMatin: 0, douleurCourse: 1, douleurSautillements: 1 })));
  const r = S.criteresPassage(s, liste, AUJ);
  assert.equal(r.suivante, null);
  assert.equal(r.pret, true, JSON.stringify(r.criteres));
});

// ------------------------------------------------------------ Contraintes du plan IA

test('projection des phases : durée maximale, phase actuelle prolongée d\'au moins 7 jours', () => {
  const s = nouveauSuivi({ debut: '2026-10-16' });
  assert.deepEqual(S.projectionPhases(s, AUJ), [
    { phase: 1, nom: 'Calmer', du: AUJ, au: '2026-11-12' },
    { phase: 2, nom: 'Renforcer', du: '2026-11-13', au: '2027-02-04' },
    { phase: 3, nom: 'Rendre élastique', du: '2027-02-05', au: '2027-03-18' },
  ]);
  const enRetard = nouveauSuivi({ debut: '2026-09-01' }); // phase 1 dépassée : au moins 7 jours
  assert.equal(S.projectionPhases(enRetard, AUJ)[0].au, '2026-11-05');
});

test('contexte IA : course de phase 1 interdite sans douleur de course ≤ 4/10 récente', () => {
  const s = nouveauSuivi({ debut: '2026-10-25' });
  let [b] = S.contexteIa([s], [], AUJ);
  assert.equal(b.blessure, 'Tendinopathie d\'Achille (corps du tendon), côté gauche');
  assert.equal(b.projection[0].courseAutorisee, false);
  assert.equal(b.projection[1].courseAutorisee, true);
  assert.deepEqual(b.projection[1].intensites, ['facile']);
  const ok = bilans(s, '2026-10-29', [{ douleurCourse: 3 }]);
  [b] = S.contexteIa([s], ok, AUJ);
  assert.equal(b.projection[0].courseAutorisee, true);
  assert.equal(b.projection[0].dureeMaxMin, 30);
  assert.equal(b.courseInterditeJusquau, null);
  const mal = bilans(s, '2026-10-29', [{ douleurCourse: 7 }]);
  [b] = S.contexteIa([s], mal, AUJ);
  assert.equal(b.courseInterditeJusquau, '2026-11-05');
  assert.equal(S.contexteIa([S.terminerSuivi(s, AUJ)], [], AUJ).length, 0);
});

test('validation des séances : fenêtres de phase, intensité, type, durée, blocage après douleur', () => {
  const s = nouveauSuivi({ debut: '2026-10-25' });
  const [b] = S.contexteIa([s], bilans(s, '2026-10-29', [{ douleurCourse: 3 }]), AUJ);
  const seance = o => S.erreursSeanceSoin({ discipline: 'course', type: 'endurance', intensite: 'facile', dureeMin: 30, ...o }, [b]);
  assert.deepEqual(seance({ date: '2026-11-03' }), []);
  assert.equal(seance({ date: '2026-11-03', dureeMin: 40 }).length, 1);
  assert.match(seance({ date: '2026-11-03', type: 'fractionne', intensite: 'soutenue' }).join(' '), /intensité.*type/);
  assert.deepEqual(seance({ date: '2026-12-01', dureeMin: 45 }), []); // phase 2
  assert.equal(seance({ date: '2027-02-20', intensite: 'moderee', type: 'seuil', dureeMin: 60 }).length, 0); // phase 3
  assert.deepEqual(seance({ date: '2027-06-01', type: 'fractionne', intensite: 'tres_soutenue', dureeMin: 90 }), []); // après la projection
  assert.deepEqual(S.erreursSeanceSoin({ date: '2026-11-03', discipline: 'velo', intensite: 'soutenue', dureeMin: 90 }, [b]), []);
  const [bloque] = S.contexteIa([s], bilans(s, '2026-10-29', [{ douleurCourse: 6 }]), AUJ);
  assert.match(S.erreursSeanceSoin({ date: '2026-11-05', discipline: 'enchainement', intensite: 'facile', dureeMin: 60 }, [bloque])[0], /interdite jusqu'au 2026-11-05/);
});

test('plan IA : contexte, rejet des courses interdites, phase mémorisée et plan à recalculer', () => {
  const semainier = D.semainierParDefaut();
  semainier.plafondSeances = 4;
  semainier.jours[1] = { disponible: true, dureeMaxMin: 60, disciplines: ['course', 'velo'] };
  semainier.jours[5] = { disponible: true, dureeMaxMin: 90, disciplines: ['course', 'velo'] };
  const semi = D.demarrerObjectif(D.creerObjectif({ nom: 'Semi', sport: 'course', type: 'semi', dateEpreuve: '2027-08-29' }), AUJ);
  const s = nouveauSuivi({ debut: '2026-10-25' });
  const etat = { profil: D.profilParDefaut(), semainier, objectifs: [semi], prevues: [], realisees: [], blessures: [s], bilans: [] };
  const c = IA.construireContexte(etat, AUJ);
  assert.equal(c.blessures.length, 1);
  assert.match(IA.construirePrompt(c).systeme, /courseAutorisee/);
  assert.equal('blessures' in IA.construireContexte({ ...etat, blessures: [] }, AUJ), false);

  const seances = c.calendrier.slice(0, 2).flatMap(sem => sem.jours.map(j => ({
    date: j.date, heureDebut: j.creneaux[0].debut, discipline: 'course', type: 'endurance', intensite: 'facile', dureeMin: 30, distanceKm: 5,
    echauffement: '', corps: '', retourCalme: '', objectifIds: [],
  })));
  const rejet = IA.validerPlan({ analyse: '', phases: [], seances }, c);
  assert.ok(rejet.erreurs.length > 0);
  assert.match(rejet.erreurs[0], /pas de course pendant la phase 1/);

  const velo = seances.map(x => ({ ...x, discipline: 'velo' }));
  const ok = IA.validerPlan({ analyse: '', phases: [], seances: velo }, c);
  assert.deepEqual(ok.erreurs, []);
  const r = IA.remplacement([], ok.plan, AUJ);
  assert.deepEqual(r.meta.soin, [{ id: s.id, phase: 1 }]);
  assert.equal(S.planAJour(r.meta, [s]), true);
  assert.equal(S.planAJour(r.meta, [S.changerPhase(s, 2, AUJ)]), false);
  assert.equal(S.planAJour(null, [s]), true);
});

// ------------------------------------------------------------ Sauvegarde

test('export/import : suivis, bilans et séances de soin inclus, anciennes sauvegardes (formats 1 et 2) toujours lisibles', () => {
  const s = nouveauSuivi();
  const liste = bilans(s, AUJ, [{ raideurMatin: 4 }]);
  const seancesSoin = S.reconcilierSoin([s], [], liste, AUJ).aMettre;
  const etat = { profil: D.profilParDefaut(), semainier: D.semainierParDefaut(), reglages: D.reglagesParDefaut(), plan: null, objectifs: [], prevues: [], realisees: [], blessures: [s], bilans: liste, seancesSoin };
  const json = construireExport(etat);
  assert.equal(json.format, 3);
  const relu = lireImport(JSON.stringify(json));
  assert.deepEqual(relu.blessures, [s]);
  assert.deepEqual(relu.bilans, liste);
  assert.deepEqual(relu.seancesSoin, seancesSoin);
  assert.match(resumeImport(relu), /1 suivi\(s\) de blessure et 1 bilan/);

  const v2 = { ...json, format: 2, donnees: { ...json.donnees } };
  delete v2.donnees.seancesSoin;
  assert.deepEqual(lireImport(JSON.stringify(v2)).seancesSoin, []);
  assert.deepEqual(lireImport(JSON.stringify(v2)).blessures, [s]);

  const ancien = { ...json, format: 1, donnees: { ...json.donnees } };
  delete ancien.donnees.blessures;
  delete ancien.donnees.bilans;
  delete ancien.donnees.seancesSoin;
  const r = lireImport(JSON.stringify(ancien));
  assert.deepEqual(r.blessures, []);
  assert.deepEqual(r.bilans, []);
  assert.deepEqual(r.seancesSoin, []);
  assert.throws(() => lireImport(JSON.stringify({ ...json, donnees: { ...json.donnees, bilans: [{ id: 'x' }] } })), /bilan/);
  assert.throws(() => lireImport(JSON.stringify({ ...json, donnees: { ...json.donnees, seancesSoin: [{ id: 'x', date: AUJ, blessureId: s.id, exercices: [], etat: 'bof' }] } })), /séance de soin/);
});

// ------------------------------------------------------------ Séances de soin du planning

test('planning de soin : une séance par jour d\'exercices, d\'aujourd\'hui à la fin du programme (3 phases)', () => {
  // Phases enchaînées à leur durée maximale : phase 1 jusqu'au 16/11 (4 sem. depuis le 20/10),
  // phase 2 du 17/11 au 08/02 (12 sem.), phase 3 du 09/02 au 22/03 (6 sem.).
  const s = nouveauSuivi({ debut: '2026-10-20' });
  assert.equal(S.finPlanificationSoin(s, AUJ), '2027-03-22');
  const { aMettre, aSupprimer } = S.reconcilierSoin([s], [], [], AUJ, 1);
  assert.deepEqual(aSupprimer, []);
  assert.ok(aMettre.every(x => x.blessureId === s.id && x.etat === 'a_faire'));
  const parPhase = n => aMettre.filter(x => x.phase === n);
  // Phase 1 : l'isométrie est quotidienne → une séance chaque jour du 30/10 au 16/11.
  assert.equal(parPhase(1).length, 18);
  assert.equal(parPhase(1)[0].date, AUJ);
  assert.equal(parPhase(1).at(-1).date, '2026-11-16');
  // Phase 2 projetée : un jour sur deux depuis son début projeté, dosage de sa semaine 1.
  assert.deepEqual(parPhase(2).slice(0, 2).map(x => [x.date, x.semaine]), [['2026-11-17', 1], ['2026-11-19', 1]]);
  assert.deepEqual(parPhase(2)[0].exercices.map(e => `${e.id} ${e.dosage}`), ['montees_debout 3 × 15 lourdes', 'montees_assis 3 × 15 lourdes']);
  assert.equal(parPhase(2).length, 42);
  // Phase 3 projetée : sautillements + montées d'entretien, jusqu'à la fin du programme.
  assert.equal(parPhase(3)[0].date, '2027-02-09');
  assert.deepEqual(parPhase(3)[0].exercices.map(e => e.id), ['sautillements', 'montees_debout']);
  assert.equal(aMettre.at(-1).date, '2027-03-21');
  assert.ok(aMettre.at(-1).date <= S.finPlanificationSoin(s, AUJ));
  // Alternance fixe : montées lentes les jours pairs depuis le début de phase (30/10, 01/11…), pas le 31/10.
  assert.deepEqual(aMettre[0].exercices.map(e => e.id), ['iso_debout', 'iso_assis', 'montees_lentes']);
  assert.deepEqual(aMettre[1].exercices.map(e => e.id), ['iso_debout', 'iso_assis']);
  assert.equal(aMettre[0].exercices[2].dosage, 'Sur les 2 pieds · 3 × 15');
  // Semaine 3 (à partir du 03/11) : dosage de la semaine suivante.
  assert.equal(aMettre.find(x => x.date === '2026-11-03').exercices[0].dosage, 'Jambe gauche seule + sac 5 kg · 5 × 45 s');
  // Phase dépassée : la phase en cours dure encore au moins 7 jours, les suivantes s'enchaînent ensuite.
  assert.deepEqual(S.projectionPhases(s, '2026-12-01').map(f => [f.du, f.au]),
    [['2026-12-01', '2026-12-07'], ['2026-12-08', '2027-03-01'], ['2027-03-02', '2027-04-12']]);
  assert.equal(S.finPlanificationSoin(s, '2026-12-01'), '2027-04-12');
  // Dernière phase : le planning s'arrête à sa fin prévue.
  const p3 = S.changerPhase(S.changerPhase(s, 2, AUJ), 3, AUJ);
  assert.equal(S.finPlanificationSoin(p3, AUJ), '2026-12-10');
  // Rien pour un suivi terminé.
  assert.deepEqual(S.reconcilierSoin([S.terminerSuivi(s, AUJ)], [], [], AUJ).aMettre, []);
});

test('planning de soin : phases 2 et 3, pas de séance les jours de repos (isométrie facultative exclue)', () => {
  const p2 = S.changerPhase(nouveauSuivi({ debut: '2026-10-01' }), 2, AUJ);
  const seances = S.reconcilierSoin([p2], [], [], AUJ).aMettre;
  assert.deepEqual(seances.slice(0, 3).map(x => x.date), [AUJ, '2026-11-01', '2026-11-03']); // un jour sur deux
  assert.deepEqual(seances[0].exercices.map(e => e.id), ['montees_debout', 'montees_assis']);
  assert.equal(seances.filter(x => x.phase === 2).at(-1).date <= '2027-01-21', true); // 12 semaines max à partir du 30/10
  const p3 = S.changerPhase(p2, 3, '2026-11-02');
  const s3 = S.reconcilierSoin([p3], [], [], '2026-11-02').aMettre;
  assert.deepEqual(s3[0].exercices.map(e => e.id), ['sautillements', 'montees_debout']);
  assert.equal(s3[1].date, '2026-11-04');
});

test('planning de soin : régénération au changement de phase, retour en arrière et fin du suivi', () => {
  const s = nouveauSuivi({ debut: '2026-10-20' });
  let seances = S.reconcilierSoin([s], [], [], AUJ, 1).aMettre;
  // Séance passée (hier) gardée telle quelle, séance du jour faite, séance de demain ratée.
  const hier = { ...seances[0], id: 'hier', date: '2026-10-29' };
  seances = [hier, { ...seances[0], etat: 'faite' }, { ...seances[1], etat: 'ratee' }, ...seances.slice(2)];
  // Rien à refaire tant que le suivi ne change pas.
  assert.deepEqual(S.reconcilierSoin([s], seances, [], AUJ), { aMettre: [], aSupprimer: [] });

  // Passage en phase 2 aujourd'hui : les séances futures « à faire » de la phase 1 disparaissent ou sont mises à jour,
  // la faite et la ratée sont conservées, la passée n'est pas touchée.
  const p2 = S.changerPhase(s, 2, AUJ);
  const r = S.reconcilierSoin([p2], seances, [], AUJ, 2);
  const conservees = new Set([hier.id, seances[1].id, seances[2].id]);
  assert.ok(r.aSupprimer.every(id => !conservees.has(id)));
  assert.ok(r.aMettre.every(x => !conservees.has(x.id)));
  const apres = [...seances.filter(x => !r.aSupprimer.includes(x.id) && !r.aMettre.some(y => y.id === x.id)), ...r.aMettre];
  const futuresAFaire = apres.filter(x => x.date >= AUJ && x.etat === 'a_faire').sort((a, b) => a.date.localeCompare(b.date));
  assert.ok(futuresAFaire.every(x => x.phase >= 2), 'plus aucune séance de phase 1 à faire');
  assert.ok(futuresAFaire.filter(x => x.date <= '2027-01-21').every(x => x.phase === 2 && x.exercices[0].id === 'montees_debout'));
  assert.ok(futuresAFaire.filter(x => x.date > '2027-01-21').every(x => x.phase === 3));
  assert.ok(apres.some(x => x.id === seances[1].id && x.etat === 'faite' && x.phase === 1));

  // Retour en phase 1 : les séances de phase 2 à faire sont régénérées en phase 1.
  const retour = S.changerPhase(p2, 1, AUJ);
  const r2 = S.reconcilierSoin([retour], apres, [], AUJ, 3);
  const apres2 = [...apres.filter(x => !r2.aSupprimer.includes(x.id) && !r2.aMettre.some(y => y.id === x.id)), ...r2.aMettre];
  const futures2 = apres2.filter(x => x.date >= AUJ && x.etat === 'a_faire');
  assert.ok(futures2.filter(x => x.date <= '2026-11-26').every(x => x.phase === 1)); // 4 sem. de phase 1 à partir d'aujourd'hui
  assert.ok(futures2.filter(x => x.date > '2026-11-26').every(x => x.phase >= 2));

  // Fin du suivi : toutes les séances futures « à faire » sont supprimées, les autres restent.
  const fin = S.reconcilierSoin([S.terminerSuivi(retour, AUJ)], apres2, [], AUJ);
  assert.deepEqual(fin.aMettre, []);
  const restantes = apres2.filter(x => !fin.aSupprimer.includes(x.id));
  assert.ok(restantes.every(x => x.date < AUJ || x.etat !== 'a_faire'));
  assert.ok(restantes.some(x => x.id === hier.id));
});

test('planning de soin : lien avec le bilan du jour dans les deux sens', () => {
  const s = nouveauSuivi({ debut: '2026-10-20' });
  const [seance] = S.reconcilierSoin([s], [], [], AUJ).aMettre; // iso_debout, iso_assis, montees_lentes
  const ids = seance.exercices.map(e => e.id);
  const bilan = S.enregistrerBilan({ blessureId: s.id, date: AUJ, raideurMatin: 3, douleurMarche: 2, douleurEscaliers: 3, exercices: ['iso_debout'] }, s, []);

  // Séance → bilan : « faite » coche ses exercices (sans toucher aux autres), « à faire » ou « ratée » les décoche.
  const coches = S.exercicesBilanApresEtat({ ...bilan, exercices: ['iso_debout', 'autre'] }, seance, 'faite');
  assert.deepEqual(coches.sort(), [...ids, 'autre'].sort());
  assert.deepEqual(S.exercicesBilanApresEtat({ ...bilan, exercices: coches }, seance, 'a_faire'), ['autre']);
  assert.deepEqual(S.exercicesBilanApresEtat({ ...bilan, exercices: coches }, seance, 'ratee'), ['autre']);

  // Bilan → séance : tous cochés → faite ; un décoché → à faire ; ratée reste ratée tant que tout n'est pas coché.
  assert.equal(S.etatApresBilan(seance, bilan), 'a_faire');
  assert.equal(S.etatApresBilan(seance, { ...bilan, exercices: ids }), 'faite');
  assert.equal(S.etatApresBilan({ ...seance, etat: 'faite' }, { ...bilan, exercices: ids.slice(1) }), 'a_faire');
  assert.equal(S.etatApresBilan({ ...seance, etat: 'ratee' }, bilan), 'ratee');
  assert.equal(S.etatApresBilan({ ...seance, etat: 'ratee' }, { ...bilan, exercices: ids }), 'faite');

  // Séance créée un jour dont le bilan coche déjà tout : elle naît « faite ».
  const complet = { ...bilan, exercices: ids };
  assert.equal(S.reconcilierSoin([s], [], [complet], AUJ).aMettre[0].etat, 'faite');
  assert.deepEqual(S.compteSoin([{ etat: 'faite' }, { etat: 'a_faire' }, { etat: 'ratee' }]), { nb: 3, faites: 1 });
});

test('planning de soin : invisible pour le plan IA (calendrier, plafond, séances conservées, volumes)', () => {
  const s = nouveauSuivi({ debut: '2026-10-20' });
  const semainier = D.semainierParDefaut();
  semainier.plafondSeances = 2;
  semainier.jours[5] = { disponible: true, dureeMaxMin: 60, disciplines: ['course', 'velo'] };
  semainier.jours[6] = { disponible: true, dureeMaxMin: 90, disciplines: ['velo'] };
  const objectif = D.demarrerObjectif(D.creerObjectif({ nom: '10 km', sport: 'course', type: '10km', dateEpreuve: '2027-01-17' }), AUJ);
  const base = { profil: D.profilParDefaut(), semainier, objectifs: [objectif], prevues: [], realisees: [], blessures: [s], bilans: [] };
  const sans = IA.construireContexte(base, AUJ);
  const seancesSoin = S.reconcilierSoin([s], [], [], AUJ).aMettre;
  const avec = IA.construireContexte({ ...base, seancesSoin }, AUJ);
  assert.deepEqual(avec, sans);
  assert.ok(!JSON.stringify(avec).includes('montees_lentes'));
  assert.equal(avec.calendrier[0].plafondRestant, 2);
  assert.ok(seancesSoin.length > 0);
});
