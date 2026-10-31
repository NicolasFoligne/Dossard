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
  assert.equal(json.format, 4);
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

// ------------------------------------------------------------ Catalogue et programmes personnels (v1.5.0)

import * as B from '../js/blessure-ia.js';

// Programme tel qu'une IA pourrait le proposer (2 phases).
// Fiche complète d'un exercice hors bibliothèque (obligatoire dans un programme collé).
const FICHE_COMPLETE = {
  objectif: 'Renforcer.', materiel: [], depart: 'Debout.', etapes: ['Penchez-vous.', 'Remontez.'], respiration: 'Libre.',
  sensation: 'Effort modéré.', erreurs: ['Dos rond.'], adaptation: 'Moins de charge.', facile: 'Sans charge.', difficile: 'Avec charge.',
};
const PROGRAMME_IA = {
  libelle: 'Tendinopathie haute des ischio-jambiers',
  court: 'Ischio-jambiers',
  description: 'Douleur profonde sous la fesse, assis et en côte.',
  regleDouleur: ['Douleur ≤ 3/10 pendant les exercices.'],
  aEviter: ['Étirements des ischio-jambiers en phase douloureuse.'],
  consulter: ['Hématome important ou douleur brutale avec claquement.'],
  avisMedical: 'Avis médical conseillé.',
  entretien: '2 séances de pont par semaine.',
  test: { nom: 'Test du pont sur une jambe', unite: 'répétitions', consigne: 'Pont fessier sur la jambe {cote}, jusqu\'à la fatigue.' },
  phases: [
    {
      numero: 1, nom: 'Calmer', dureeMinSem: 2, dureeMaxSem: 3, but: 'Calmer.',
      exercices: [
        { id: 'iso_pont', nom: 'Pont isométrique', cible: 'Ischio-jambiers', frequence: 'Tous les jours', alterne: false, facultatif: false, consignes: ['Tenez 30 s.'], dosage: ['5 × 30 s', 'Jambe {cote} seule · 5 × 30 s'], fiche: 'pont', seance: { tempo: null, motTenue: 'contraction' } },
        { id: 'marche', nom: 'Marche', cible: 'Circulation', frequence: 'Si besoin', alterne: false, facultatif: true, consignes: ['20 min.'], dosage: ['20 min'], details: FICHE_COMPLETE, seance: { recupS: 0 } },
      ],
      course: { texte: 'Footing facile 20 min si ≤ 3/10, sans côte.', autorisee: 'si_douleur_ok', intensites: ['facile'], types: ['endurance'], dureeMaxMin: 20 },
      conseils: ['Évitez la position assise prolongée.'],
      criteres: [
        { id: 'duree', type: 'duree', jours: 14, libelle: '2 semaines' },
        { id: 'test', type: 'test', nbMin: 20, douleurMax: 2, fenetre: 14, libelle: '20 ponts sur la jambe {cote}' },
      ],
    },
    {
      numero: 2, nom: 'Renforcer', dureeMinSem: 4, dureeMaxSem: 8, but: 'Renforcer.',
      exercices: [
        { id: 'souleve', nom: 'Soulevé de terre jambes tendues', cible: 'Ischio-jambiers', frequence: 'Un jour sur deux', alterne: true, consignes: ['Dos droit.'], dosage: ['3 × 10', null, '4 × 8'], details: FICHE_COMPLETE },
      ],
      course: { texte: 'Facile ≤ 45 min.', autorisee: true, intensites: ['facile', 'moderee'], types: ['endurance', 'sortie_longue'], dureeMaxMin: 45 },
      criteres: [{ id: 'course', type: 'derniere', champ: 'douleurCourse', max: 1, fenetre: 7, libelle: 'Course ≤ 1/10' }],
    },
  ],
};

test('catalogue : 7 programmes valides, utilisables de bout en bout (séances, critères, contraintes du plan IA)', () => {
  assert.deepEqual(S.PROGRAMMES.map(p => p.id), ['achille_corps', 'periostite', 'bandelette', 'femoro_patellaire', 'tendon_rotulien', 'aponevrosite', 'entorse_cheville']);
  for (const p of S.PROGRAMMES) {
    assert.deepEqual(B.validerProgramme(p).erreurs, [], p.id);
    const s = S.creerSuivi({ programme: p.id, cote: 'droit', debut: AUJ });
    assert.match(S.nomSuivi(s), / droite$/);
    const seances = S.reconcilierSoin([s], [], [], AUJ).aMettre;
    assert.deepEqual([...new Set(seances.map(x => x.phase))], p.phases.map(x => x.numero), p.id);
    assert.ok(seances.every(x => x.exercices.length > 0 && x.exercices.every(e => !e.dosage.includes('{cote}'))), p.id);
    assert.equal(S.criteresPassage(s, [], AUJ).criteres.length, p.phases[0].criteres.length);
    const ctx = S.contexteIa([s], [], AUJ)[0];
    assert.equal(ctx.projection.length, p.phases.length);
  }
  // Entorse : pas de course en phase 1 ; test d'équilibre en secondes.
  const entorse = S.creerSuivi({ programme: 'entorse_cheville', cote: 'gauche', debut: AUJ });
  assert.equal(S.contexteIa([entorse], [], AUJ)[0].projection[0].courseAutorisee, false);
  const p2 = S.changerPhase(entorse, 2, AUJ);
  const bilan = S.enregistrerBilan({ blessureId: p2.id, date: AUJ, raideurMatin: 0, douleurMarche: 0, douleurEscaliers: 0, testMonteesNb: 25, testMonteesDouleur: 0 }, p2, []);
  assert.equal(S.criteresPassage(p2, [bilan], AUJ).criteres.find(c => c.id === 'test').valeur, '25 secondes à 0/10');
});

test('programme proposé par une IA : validé, ajouté au référentiel, suivi comme un programme du catalogue', () => {
  const { programme, erreurs } = B.validerProgramme(PROGRAMME_IA, { maintenant: 1 });
  assert.deepEqual(erreurs, []);
  assert.match(programme.id, /^perso_[a-z0-9]+$/);
  assert.equal(programme.source, 'ia');
  assert.equal(programme.phases[1].exercices[0].dosage[1], null);
  assert.equal(S.programme(programme.id), null);
  S.definirProgrammesPerso([programme]);
  try {
    assert.equal(S.tousLesProgrammes().length, 8);
    const s = S.creerSuivi({ programme: programme.id, cote: 'gauche', debut: AUJ });
    assert.equal(S.nomSuivi(s), 'Ischio-jambiers gauche');
    const seances = S.reconcilierSoin([s], [], [], AUJ).aMettre;
    assert.deepEqual(seances[0].exercices.map(e => `${e.id} ${e.dosage}`), ['iso_pont 5 × 30 s']); // la marche facultative n'en fait pas partie
    assert.ok(seances.some(x => x.phase === 2 && x.exercices[0].id === 'souleve'));
    const ctx = S.contexteIa([s], [], AUJ)[0];
    assert.equal(ctx.projection[1].dureeMaxMin, 45);
    assert.deepEqual(S.erreursSeanceSoin({ date: AUJ, discipline: 'course', type: 'fractionne', intensite: 'facile', dureeMin: 20 }, [ctx]).length, 1);
  } finally {
    S.definirProgrammesPerso([]);
  }
});

test('programme proposé par une IA : refus motivés', () => {
  const erreurs = o => B.validerProgramme(o).erreurs.join(' | ');
  const avec = (chemin, valeur) => {
    const p = structuredClone(PROGRAMME_IA);
    chemin(p, valeur);
    return p;
  };
  assert.match(erreurs(null), /objet JSON/);
  assert.match(erreurs({ ...PROGRAMME_IA, consulter: [] }), /consulter/);
  assert.match(erreurs({ ...PROGRAMME_IA, phases: [PROGRAMME_IA.phases[0]] }), /2 à 4 phases/);
  assert.match(erreurs(avec(p => { p.phases[0].dureeMinSem = 4; })), /dureeMinSem/);
  assert.match(erreurs(avec(p => { p.phases[0].exercices[1].id = 'iso_pont'; })), /en double/);
  assert.match(erreurs(avec(p => { p.phases[0].exercices[0].id = 'Pont Iso'; })), /minuscules/);
  assert.match(erreurs(avec(p => { p.phases[1].exercices[0].dosage = [null, '3 × 10']; })), /dosé dès la semaine 1/);
  assert.match(erreurs(avec(p => { p.phases[0].course.autorisee = 'oui'; })), /autorisee/);
  assert.match(erreurs(avec(p => { p.phases[0].course.intensites = ['max']; })), /intensité de course inconnue/);
  assert.match(erreurs(avec(p => { p.phases[1].criteres[0].champ = 'douleurGenou'; })), /champ » parmi/);
  assert.match(erreurs(avec(p => { p.phases[1].criteres[0].type = 'humeur'; })), /type « humeur » inconnu/);
  assert.match(erreurs(avec(p => { delete p.test; })), /exige l'objet « test »/);
  // Exercice : soit une fiche de la bibliothèque, soit une fiche complète.
  assert.match(erreurs(avec(p => { p.phases[0].exercices[0].fiche = 'pont_inconnu'; })), /« fiche » « pont_inconnu » absente de la bibliothèque/);
  assert.match(erreurs(avec(p => { delete p.phases[1].exercices[0].details; })), /exercice hors bibliothèque — « details » obligatoire/);
  assert.match(erreurs(avec(p => { p.phases[1].exercices[0].details = { ...FICHE_COMPLETE, adaptation: '', materiel: undefined }; })), /il manque « materiel », « adaptation »/);
  // Programmes déjà enregistrés (sauvegarde) : fiches incomplètes tolérées.
  const ancien = avec(p => { delete p.phases[1].exercices[0].details; });
  assert.deepEqual(B.validerProgramme(ancien, { exigerFiches: false }).erreurs, []);
  assert.match(B.promptCorrection(['erreur A', 'erreur B']), /refusé[\s\S]*- erreur A\n- erreur B/);
});

test('texte à copier dans l\'IA : description, contexte sportif, catalogue et format attendu', () => {
  const objectif = D.demarrerObjectif(D.creerObjectif({ nom: 'Marathon de Paris', sport: 'course', type: 'marathon', dateEpreuve: '2027-04-11', tempsViseS: 3 * 3600 + 30 * 60 }), AUJ);
  const r = D.enregistrerRealisee({ date: '2026-10-27', discipline: 'course', dureeS: 3600, distanceKm: 12 }, [objectif]);
  const etat = { profil: { ...D.profilParDefaut(), niveau: 'Confirmé', blessures: 'entorse en 2024' }, objectifs: [objectif], realisees: [r] };
  const texte = B.promptBlessure({ zone: 'Cuisse (arrière)', cote: 'Gauche', debut: '2026-10-20', douleurCourse: 5, moments: ['Pendant l\'effort'], signes: ['Raideur'], libre: 'douleur sous la fesse' }, etat, AUJ);
  for (const attendu of ['Questions-réponses', 'Zone : Cuisse (arrière) · côté : Gauche', 'en courant : 5/10', 'Pendant l\'effort', 'douleur sous la fesse',
    'Niveau : Confirmé', 'entorse en 2024', 'Marathon de Paris (Marathon, le 2027-04-11, temps visé 3 h 30)', 'semaine du 2026-10-26 : 60 min (course)',
    'Périostite tibiale', '"si_douleur_ok"', '"douleurSautillements"', 'Commence par tes questions.',
    'Bibliothèque des exercices', '- iso_mollet : Isométrie du mollet, debout', '- glace : Glace et jambe surélevée', '"fiche": "iso_mollet"', '« adaptation » (que faire si douleur)']) {
    assert.ok(texte.includes(attendu), attendu);
  }
  assert.ok(!/cleApi|sk-ant|x-api-key/.test(texte), 'aucune clé API');
});

test('sauvegarde : programmes personnels exportés et réimportés, suivi sans programme refusé', () => {
  const { programme } = B.validerProgramme(PROGRAMME_IA, { maintenant: 1 });
  S.definirProgrammesPerso([programme]);
  try {
    const s = S.creerSuivi({ programme: programme.id, cote: 'droit', debut: AUJ });
    const etat = { profil: D.profilParDefaut(), semainier: D.semainierParDefaut(), reglages: D.reglagesParDefaut(), plan: null, objectifs: [], prevues: [], realisees: [], blessures: [s], bilans: [], seancesSoin: [], programmes: [programme] };
    const json = construireExport(etat);
    assert.equal(json.format, 4);
    const relu = lireImport(JSON.stringify(json));
    assert.deepEqual(relu.programmes, [programme]);
    const sans = { ...json, donnees: { ...json.donnees, programmes: [] } };
    assert.throws(() => lireImport(JSON.stringify(sans)), /programme est absent/);
    const abime = { ...json, donnees: { ...json.donnees, programmes: [{ ...programme, phases: [] }] } };
    assert.throws(() => lireImport(JSON.stringify(abime)), /programme de soin/);
  } finally {
    S.definirProgrammesPerso([]);
  }
});

// ------------------------------------------------------------ Séance guidée et bibliothèque des exercices (v1.6.0, v1.7.0)

import * as G from '../js/seance-guidee.js';
import * as X from '../js/exercices.js';

test('séance guidée : lecture des dosages', () => {
  assert.deepEqual(G.analyserDosage('Sur les 2 pieds · 5 × 45 s'), { mode: 'tenue', series: 5, dureeS: 45, parCote: false });
  assert.deepEqual(G.analyserDosage('Corde à sauter · 3 × 1 min'), { mode: 'tenue', series: 3, dureeS: 60, parCote: false });
  assert.deepEqual(G.analyserDosage('3 × 20 s par côté'), { mode: 'tenue', series: 3, dureeS: 20, parCote: true });
  assert.deepEqual(G.analyserDosage('Jambe gauche seule, si douleur ≤ 4/10 · 3 × 15'), { mode: 'reps', series: 3, reps: 15, parCote: false });
  assert.deepEqual(G.analyserDosage('4 × 10 avec 10 kg'), { mode: 'reps', series: 4, reps: 10, parCote: false });
  assert.deepEqual(G.analyserDosage('3 × 10 par jambe'), { mode: 'reps', series: 3, reps: 10, parCote: true });
  assert.deepEqual(G.analyserDosage('3 × 15, tenue 3 s'), { mode: 'reps', series: 3, reps: 15, parCote: false });
  assert.deepEqual(G.analyserDosage('3 × 10 fois 10 s'), { mode: 'tenues', series: 3, reps: 10, tenueS: 10, parCote: false });
  assert.deepEqual(G.analyserDosage('1 à 2 min'), { mode: 'duree', series: 1, dureeS: 120, parCote: false });
  assert.deepEqual(G.analyserDosage('15 min'), { mode: 'duree', series: 1, dureeS: 900, parCote: false });
  assert.equal(G.analyserDosage('Alphabet complet, 2 fois').mode, 'libre');
  assert.equal(G.dureeParlee(45), '45 secondes');
  assert.equal(G.dureeParlee(120), '2 minutes');
  assert.equal(G.dureeParlee(90), '1 minute 30');
});

test('séance guidée : étapes enchaînées (tenues, tempo, compteur, récupérations, transitions)', () => {
  const s = nouveauSuivi({ debut: '2026-10-20' }); // Achille, semaine 2 le 30/10 : 3 exercices
  const [seance] = S.reconcilierSoin([s], [], [], AUJ).aMettre;
  const phase = S.phaseDe(s);
  const exercices = seance.exercices.map(e => {
    const p = phase.exercices.find(q => q.id === e.id);
    return { ...e, fiche: p.fiche, seance: X.seanceDe(p) };
  });
  const etapes = G.etapesSeance(exercices);
  // Préparation de 10 s, puis isométrie : 5 tenues de 45 s séparées par 4 repos de 60 s (isométrique), puis transition.
  assert.equal(etapes[0].type, 'prepa');
  assert.equal(etapes[0].dureeS, 10);
  assert.equal(etapes[0].suivante, 'Isométrie debout, jambe tendue. Série 1 sur 5, contraction 45 secondes.');
  const iso = etapes.filter(e => e.exercice.id === 'iso_debout').slice(1);
  assert.deepEqual(iso.map(e => e.type), ['tenue', 'recup', 'tenue', 'recup', 'tenue', 'recup', 'tenue', 'recup', 'tenue', 'transition']);
  assert.equal(iso[0].dureeS, 45);
  assert.equal(iso[1].dureeS, 60);
  assert.equal(iso[1].annonce, 'Repos, 1 minute.');
  assert.equal(iso[1].suivante, 'Série 2 sur 5, contraction 45 secondes.');
  assert.equal(iso.at(-1).annonce, 'Exercice terminé.');
  assert.equal(iso.at(-1).suivante, 'Isométrie assis, genou plié. Série 1 sur 5, contraction 45 secondes.');
  // Repos réglé par l'utilisateur pour cet exercice de la bibliothèque.
  const regle = G.etapesSeance(exercices, { repos: { iso_mollet: 90 } }).filter(e => e.exercice.id === 'iso_debout' && e.type === 'recup');
  assert.ok(regle.length === 4 && regle.every(e => e.dureeS === 90 && e.exercice.reposS === 90));
  const sansRepos = G.etapesSeance(exercices, { repos: { iso_mollet: 0 } }).filter(e => e.exercice.id === 'iso_debout');
  assert.deepEqual(sansRepos.slice(1, 4).map(e => `${e.type} ${e.dureeS}`), ['tenue 45', 'prepa 5', 'tenue 45']);
  // Montées lentes : tempo 3 s / 3 s, 15 répétitions, 3 séries.
  const montees = etapes.filter(e => e.exercice.id === 'montees_lentes' && e.type === 'tempo');
  assert.equal(montees.length, 3);
  assert.deepEqual(montees[0].phases, [['Monte', 3], ['Descends', 3]]);
  assert.equal(montees[0].reps, 15);
  assert.equal(etapes.at(-1).exercice.id, 'montees_lentes'); // pas de transition ni de récupération à la fin
  assert.equal(etapes.at(-1).type, 'tempo');
  assert.ok(G.dureeEstimee(etapes) > 20 * 60);

  // Sautillements : compteur à la main ; gainage par côté : deux tenues par série.
  const autres = G.etapesSeance([
    { id: 'sautillements', nom: 'Sautillements', dosage: 'Sur les 2 pieds · 3 × 20', seance: { tempo: null, recupS: 90 } },
    { id: 'gainage', nom: 'Gainage latéral', dosage: '2 × 30 s par côté', seance: { recupS: 45, libelleTenue: 'Gainez' } },
    { id: 'alphabet', nom: 'Mobilité', dosage: 'Alphabet complet, 2 fois' },
  ]);
  assert.equal(autres[1].type, 'compteur');
  assert.equal(autres[1].annonce, 'Sautillements. Série 1 sur 3, 20 répétitions, à votre rythme.');
  const gainage = autres.filter(e => e.exercice.id === 'gainage' && e.type === 'tenue');
  assert.deepEqual(gainage.map(e => `${e.serie} ${e.cote}`), ['1 premier côté', '1 second côté', '2 premier côté', '2 second côté']);
  assert.equal(gainage[1].annonce, 'Série 1 sur 2, second côté, tenue 30 secondes.');
  assert.equal(autres.at(-1).type, 'libre');
});

test('séance guidée : chrono fondé sur l\'horodatage, rattrapage après un onglet ralenti', () => {
  const etapes = G.etapesSeance([
    { id: 'iso', nom: 'Isométrie', dosage: '2 × 30 s', seance: { recupS: 60, isometrique: true } },
    { id: 'montees', nom: 'Montées', dosage: '2 × 5', seance: { tempo: [['Monte', 3], ['Descends', 3]], recupS: 30 } },
    { id: 'sauts', nom: 'Sauts', dosage: '1 × 20', seance: { tempo: null } },
  ]);
  assert.deepEqual(etapes.map(e => `${e.type}:${G.dureeEtape(e)}`), ['prepa:10', 'tenue:30', 'recup:60', 'tenue:30', 'transition:15', 'tempo:30', 'recup:30', 'tempo:30', 'transition:15', 'compteur:60']);
  const t0 = 1_000_000;
  // Rien d'écoulé : on reste sur l'étape.
  assert.deepEqual(G.rattraper(etapes, 0, t0, t0 + 9_999), { i: 0, debutMs: t0, fini: false });
  // 2 min 5 s plus tard (onglet en arrière-plan) : prépa 10 + tenue 30 + repos 60 = 100 s, on est dans la 2e tenue depuis 25 s.
  assert.deepEqual(G.rattraper(etapes, 0, t0, t0 + 125_000), { i: 3, debutMs: t0 + 100_000, fini: false });
  // Bien plus tard : arrêt sur le compteur (non minuté), commencé à la fin exacte de la transition.
  assert.deepEqual(G.rattraper(etapes, 0, t0, t0 + 3_600_000), { i: 9, debutMs: t0 + 250_000, fini: false });
  assert.equal(G.estMinutee(etapes[5], true), false); // tempo compté à la main
  // Dernière étape minutée terminée : séance finie.
  const seul = G.etapesSeance([{ id: 'iso', nom: 'Isométrie', dosage: '1 × 30 s' }]);
  assert.deepEqual(G.rattraper(seul, 1, t0, t0 + 31_000), { i: 2, debutMs: t0 + 30_000, fini: true });
});

test('séance guidée : position dans un tempo', () => {
  const phases = [['Monte', 3], ['Descends', 3]];
  assert.deepEqual(G.positionTempo(phases, 15, 0), { rep: 1, phase: 0, libelle: 'Monte', resteS: 3, fini: false });
  assert.deepEqual(G.positionTempo(phases, 15, 4), { rep: 1, phase: 1, libelle: 'Descends', resteS: 2, fini: false });
  assert.equal(G.positionTempo(phases, 15, 6.5).rep, 2);
  assert.equal(G.positionTempo(phases, 15, 89.9).rep, 15);
  assert.equal(G.positionTempo(phases, 15, 90).fini, true);
});

test('bibliothèque : chaque exercice du catalogue y renvoie ; fiches complètes, schéma, rythme', () => {
  const ids = new Set();
  for (const x of X.EXERCICES) {
    assert.ok(!ids.has(x.id), `id en double : ${x.id}`);
    ids.add(x.id);
    for (const champ of ['nom', 'objectif', 'depart', 'sensation', 'adaptation']) assert.ok(x[champ], `${x.id} : ${champ}`);
    assert.ok(x.etapes.length >= 2 && x.erreurs.length >= 1 && x.materiel.length >= 1, x.id);
    assert.ok(Number.isInteger(x.seance.recupS), x.id);
    if (x.isometrique && x.id !== 'iso_eversion') assert.equal(x.seance.recupS, 60, `${x.id} : 60 s de repos par défaut (isométrique)`);
    const svg = X.schemaSvg(x);
    assert.match(svg, /^<svg class="schema" viewBox="0 0 160 110" role="img" aria-label="Schéma : [^"]+">/);
    assert.ok(!/(?:fill|stroke)="#/.test(svg), `${x.id} : couleurs portées par le CSS (mode sombre)`);
    assert.equal((svg.match(/<svg/g) ?? []).length, 1);
  }
  for (const p of S.PROGRAMMES) {
    for (const ph of p.phases) {
      for (const e of ph.exercices) {
        const ref = `${p.id}/${ph.numero}/${e.id}`;
        assert.ok(X.exercice(e.fiche), `${ref} : absent de la bibliothèque`);
        const f = X.ficheDe(e);
        assert.ok(f.bibliotheque && f.schema && f.objectif && f.etapes.length >= 2 && f.adaptation && f.materiel.length, ref);
        const seance = X.seanceDe(e);
        assert.ok(Number.isInteger(seance.recupS), ref);
        // Le dosage est lisible par la séance guidée (sauf exercice libre explicitement prévu).
        for (const d of e.dosage.filter(Boolean)) {
          const a = G.analyserDosage(d);
          assert.ok(a.mode !== 'libre' || e.id === 'alphabet', `${ref} : dosage « ${d} » non reconnu`);
          if (a.mode === 'reps' && seance.tempo === undefined) assert.fail(`${ref} : répétitions sans tempo défini`);
        }
      }
    }
  }
  // Exercice hors bibliothèque (programme d'une IA) : sa fiche, sans schéma (icône générique à l'écran).
  const f = X.ficheDe({ nom: 'Marche', details: FICHE_COMPLETE, consignes: ['20 min.'] });
  assert.equal(f.bibliotheque, false);
  assert.equal(f.schema, null);
  assert.equal(f.adaptation, 'Moins de charge.');
  assert.match(X.ICONE_GENERIQUE, /^<svg class="schema schema-generique"/);
  // Le rythme du programme remplace celui de la bibliothèque, champ par champ.
  assert.deepEqual(X.seanceDe({ fiche: 'squat', seance: { recupS: 150 } }), { tempo: [['Descends', 3], ['Remonte', 2]], recupS: 150 });
  assert.deepEqual(X.seanceDe({ fiche: 'chaise' }), { tempo: null, recupS: 60, motTenue: 'contraction', isometrique: true });
});

test('programme proposé par une IA : exercices de la bibliothèque et fiches complètes acceptés, rythme invalide refusé', () => {
  const { programme, erreurs } = B.validerProgramme(PROGRAMME_IA);
  assert.deepEqual(erreurs, []);
  const iso = programme.phases[0].exercices[0];
  assert.equal(iso.fiche, 'pont');
  assert.equal(iso.details, undefined);
  assert.deepEqual(iso.seance, { tempo: null, motTenue: 'contraction' });
  assert.deepEqual(X.seanceDe(iso), { tempo: null, recupS: 60, motTenue: 'contraction' }); // repos de la bibliothèque gardé
  assert.ok(X.ficheDe(iso).schema);
  const avec = structuredClone(PROGRAMME_IA);
  avec.phases[1].exercices[0].seance = { tempo: [['Descends', 3], ['Remonte', 2]], recupS: 90 };
  const relu = B.validerProgramme(avec).programme.phases[1].exercices[0];
  assert.deepEqual(relu.seance, { tempo: [['Descends', 3], ['Remonte', 2]], recupS: 90 });
  assert.deepEqual(relu.details, FICHE_COMPLETE);
  avec.phases[1].exercices[0].seance = { tempo: [['Descends', 60]], recupS: 90 };
  assert.match(B.validerProgramme(avec).erreurs.join(' | '), /seance\.tempo/);
  avec.phases[1].exercices[0].seance = { tempo: null, recupS: 9999 };
  assert.match(B.validerProgramme(avec).erreurs.join(' | '), /recupS/);
  const texte = B.promptBlessure({}, { profil: {}, objectifs: [], realisees: [] }, AUJ);
  assert.match(texte, /Choisis les exercices en priorité dans la bibliothèque/);
  assert.match(texte, /décris-le entièrement dans « details »/);
  assert.match(texte, /« seance » règle la séance guidée/);
});
