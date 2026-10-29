// Tests de la génération IA (sans réseau : l'API est simulée) : node tests/ia.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as D from '../js/domaine.js';
import * as IA from '../js/ia.js';
import { genererPlan, decouperSse, URL_API } from '../js/ia-api.js';
import { construireExport, lireImport } from '../js/sauvegarde.js';

const AUJ = '2026-10-28'; // mercredi

function etatDeTest() {
  const semainier = D.semainierParDefaut();
  semainier.plafondSeances = 3;
  semainier.jours[1] = { disponible: true, dureeMaxMin: 60, disciplines: ['course', 'renforcement'] }; // mardi
  semainier.jours[3] = { disponible: true, dureeMaxMin: 60, disciplines: ['course', 'natation'] }; // jeudi
  semainier.jours[5] = { disponible: true, dureeMaxMin: 180, disciplines: ['velo', 'course', 'enchainement'] }; // samedi
  semainier.jours[6] = { disponible: true, dureeMaxMin: 120, disciplines: ['course'] }; // dimanche
  const semi = D.demarrerObjectif(D.creerObjectif({ nom: 'Semi', sport: 'course', type: 'semi', dateEpreuve: '2026-12-13', tempsViseS: 6300 }), '2026-10-01');
  const tri = D.demarrerObjectif(D.creerObjectif({ nom: 'Tri S', sport: 'triathlon', type: 'S', dateEpreuve: '2027-01-10' }), AUJ);
  const futur = D.creerObjectif({ nom: 'Pas démarré', sport: 'course', type: '10km', dateEpreuve: '2027-05-01' });
  const vieille = D.enregistrerRealisee({ date: '2026-08-01', discipline: 'course', dureeS: 3600 }, [semi]); // > 8 semaines
  const recente = D.enregistrerRealisee({ date: '2026-10-27', discipline: 'course', dureeS: 2700, distanceKm: 8, ressenti: 4 }, [semi]); // mardi
  const iaFuture = D.creerPrevue({ date: '2026-10-31', discipline: 'velo', dureeS: 3600, source: 'ia' });
  const iaPassee = D.creerPrevue({ date: '2026-10-20', discipline: 'course', dureeS: 3600, source: 'ia' });
  const iaFaite = { ...D.creerPrevue({ date: '2026-10-29', discipline: 'course', dureeS: 1800, source: 'ia' }), etat: 'faite' };
  const manuelle = D.creerPrevue({ date: '2026-11-01', discipline: 'course', dureeS: 5400, source: 'manuel' }); // dimanche
  return {
    profil: { ...D.profilParDefaut(), niveau: 'Intermédiaire', blessures: 'périostite' },
    semainier,
    objectifs: [semi, tri, futur],
    prevues: [iaFuture, iaPassee, iaFaite, manuelle],
    realisees: [vieille, recente],
    ids: { semi: semi.id, tri: tri.id, futur: futur.id, iaFuture: iaFuture.id, iaPassee: iaPassee.id, iaFaite: iaFaite.id, manuelle: manuelle.id },
  };
}

// Plan valide construit à partir du calendrier autorisé.
function planValide(contexte) {
  const seances = [];
  for (const s of contexte.calendrier) {
    for (const j of s.jours.slice(0, s.plafondRestant ?? 7)) {
      seances.push({
        date: j.date, discipline: j.disciplines[0], type: 'endurance', intensite: 'facile',
        dureeMin: Math.min(45, j.dureeMaxMin ?? 45), distanceKm: j.disciplines[0] === 'renforcement' ? null : 8,
        echauffement: '10 min', corps: 'Footing', retourCalme: '5 min', objectifIds: [],
      });
    }
  }
  return { analyse: 'Objectif réaliste.', phases: [{ nom: 'foncière', debut: contexte.debut, fin: '2026-11-15', description: 'Base' }], seances };
}

test('contexte : uniquement les objectifs en cours, 8 semaines de séances, calendrier des créneaux autorisés', () => {
  const e = etatDeTest();
  const c = IA.construireContexte(e, AUJ);
  assert.deepEqual(c.objectifs.map(o => o.nom), ['Semi', 'Tri S']);
  assert.equal(c.fin, '2027-01-10');
  assert.equal(c.objectifs[0].tempsVise, '1:45:00');
  assert.deepEqual(c.realisees.map(r => r.date), ['2026-10-27']);
  assert.equal(c.realisees[0].allure, '5:38 /km');
  assert.deepEqual(c.seancesConservees.map(s => s.date), ['2026-11-01']); // la séance manuelle

  const s1 = c.calendrier[0];
  assert.equal(s1.lundi, '2026-10-26');
  // Mardi 27 est passé ; restent jeudi, samedi, dimanche (dimanche réduit par la séance manuelle de 90 min).
  assert.deepEqual(s1.jours.map(j => j.date), ['2026-10-29', '2026-10-31', '2026-11-01']);
  assert.equal(s1.jours[2].dureeMaxMin, 30);
  assert.equal(s1.plafondRestant, 1); // 3 - 1 réalisée - 1 manuelle
  // Aucun créneau le jour d'une épreuve ni après la dernière.
  const toutes = c.calendrier.flatMap(s => s.jours.map(j => j.date));
  assert.ok(!toutes.includes('2026-12-13'));
  assert.ok(toutes.every(d => d < '2027-01-10'));

  const { systeme, utilisateur } = IA.construirePrompt(c);
  assert.match(systeme, /10 %/);
  assert.match(systeme, /80 %/);
  assert.match(systeme, /affûtage/);
  assert.match(utilisateur, /Date du jour : 2026-10-28/);
  assert.match(utilisateur, /périostite/);
  assert.ok(!utilisateur.includes('Pas démarré'));
  assert.match(IA.construirePrompt(c, ['erreur A']).utilisateur, /rejetée[\s\S]*erreur A/);
  assert.match(IA.promptACopier(c), /Réponds uniquement par un objet JSON/);
});

test('contexte : erreurs si aucun objectif en cours ou épreuves passées', () => {
  const e = etatDeTest();
  assert.throws(() => IA.construireContexte({ ...e, objectifs: [e.objectifs[2]] }, AUJ), /Aucun objectif en cours/);
  assert.throws(() => IA.construireContexte(e, '2027-02-01'), /Aucune épreuve à venir/);
});

test('validation : un plan conforme est accepté et normalisé', () => {
  const c = IA.construireContexte(etatDeTest(), AUJ);
  const { plan, erreurs } = IA.validerPlan(planValide(c), c);
  assert.deepEqual(erreurs, []);
  assert.ok(plan.seances.length > 10);
  const s = plan.seances[0];
  assert.equal(s.dureeS, 45 * 60);
  // objectifIds vides : rattachement automatique aux objectifs qui incluent la discipline.
  const course = plan.seances.find(x => x.discipline === 'course');
  assert.equal(course.objectifIds.length, 2);
  const natation = plan.seances.find(x => x.discipline === 'natation');
  assert.equal(natation, undefined); // jeudi : course listée en premier
  assert.deepEqual(IA.pointsAttention(plan, c), []);
});

test('aperçu : points d\'attention sur la progression et l\'intensité', () => {
  const c = IA.construireContexte(etatDeTest(), AUJ);
  const s = (date, min, intensite = 'facile') => ({ date, discipline: 'course', intensite, dureeS: min * 60 });
  // Semaine 1 : 45 min du plan + 45 min réalisées + 90 min conservées = 180 min ; semaine 2 : 300 min.
  const plan = { seances: [s('2026-10-29', 45), s('2026-11-03', 100, 'soutenue'), s('2026-11-05', 100, 'soutenue'), s('2026-11-07', 100, 'soutenue')] };
  const points = IA.pointsAttention(plan, c);
  assert.ok(points.some(p => /Semaine du 2026-11-02 : volume en hausse de 67 %/.test(p)), points.join(' | '));
  assert.ok(points.some(p => /13 % du volume en intensité facile/.test(p)), points.join(' | '));
  assert.deepEqual(IA.resumeParSemaine(plan.seances).map(x => [x.lundi, x.nb]), [['2026-10-26', 1], ['2026-11-02', 3]]);
});

test('validation : respect strict du semainier et du plafond', () => {
  const c = IA.construireContexte(etatDeTest(), AUJ);
  const base = { type: 'endurance', intensite: 'facile', distanceKm: null, echauffement: '', corps: '', retourCalme: '', objectifIds: [] };
  const verifier = (seances, motif) => {
    const { plan, erreurs } = IA.validerPlan({ analyse: '', phases: [], seances }, c);
    assert.equal(plan, null);
    assert.ok(erreurs.some(e => motif.test(e)), `attendu ${motif}, obtenu ${erreurs.join(' | ')}`);
  };
  verifier([{ ...base, date: '2026-11-02', discipline: 'course', dureeMin: 30 }], /pas une date disponible/); // lundi indisponible
  verifier([{ ...base, date: '2026-10-27', discipline: 'course', dureeMin: 30 }], /pas une date disponible/); // passé
  verifier([{ ...base, date: '2026-12-13', discipline: 'course', dureeMin: 30 }], /pas une date disponible/); // jour d'épreuve
  verifier([{ ...base, date: '2027-01-10', discipline: 'course', dureeMin: 30 }], /pas une date disponible/); // fin
  verifier([{ ...base, date: '2026-11-03', discipline: 'natation', dureeMin: 30 }], /n'est pas possible le mardi/);
  verifier([{ ...base, date: '2026-11-03', discipline: 'course', dureeMin: 75 }], /maximum de 60 min/);
  verifier([{ ...base, date: '2026-11-01', discipline: 'course', dureeMin: 40 }], /maximum de 30 min/); // dimanche réduit
  verifier([
    { ...base, date: '2026-10-29', discipline: 'course', dureeMin: 30 },
    { ...base, date: '2026-10-31', discipline: 'velo', dureeMin: 60 },
  ], /plafond restant de 1/);
  verifier([{ ...base, date: '2026-11-03', discipline: 'course', dureeMin: 30.5 }], /entier positif/);
  verifier([{ ...base, date: '2026-11-03', discipline: 'course', dureeMin: 30, type: 'sieste' }], /type inconnu/);
  verifier([{ ...base, date: '2026-11-03', discipline: 'course', dureeMin: 30, intensite: 'max' }], /intensité inconnue/);
  verifier([], /aucune séance/);
  assert.match(IA.validerPlan('texte', c).erreurs[0], /objet/);
});

test('validation : rattachement limité aux objectifs compatibles', () => {
  const e = etatDeTest();
  const c = IA.construireContexte(e, AUJ);
  const { plan } = IA.validerPlan({
    analyse: '', phases: [],
    seances: [{ date: '2026-10-31', discipline: 'velo', type: 'endurance', intensite: 'facile', dureeMin: 90, distanceKm: 40, echauffement: '', corps: '', retourCalme: '', objectifIds: [e.ids.semi, 'inconnu'] }],
  }, c);
  assert.deepEqual(plan.seances[0].objectifIds, [e.ids.tri]); // le vélo ne sert pas le semi
});

test('remplacement : seules les séances IA futures « à faire » sont remplacées', () => {
  const e = etatDeTest();
  const c = IA.construireContexte(e, AUJ);
  const { plan } = IA.validerPlan(planValide(c), c);
  const r = IA.remplacement(e.prevues, plan, AUJ);
  assert.deepEqual(r.aSupprimer, [e.ids.iaFuture]); // ni la passée, ni la faite, ni la manuelle
  assert.ok(r.aAjouter.every(p => p.source === 'ia' && p.etat === 'a_faire' && p.date >= AUJ));
  assert.equal(r.meta.analyse, 'Objectif réaliste.');
  assert.equal(IA.phaseDuJour(r.meta, '2026-11-02').nom, 'foncière');
  assert.equal(IA.phaseDuJour(r.meta, '2026-12-01'), null);
});

test('extraction du JSON (bloc de code, texte autour)', () => {
  assert.deepEqual(IA.extraireJson('Voici :\n```json\n{"a":1}\n```\nBon courage'), { a: 1 });
  assert.deepEqual(IA.extraireJson('Plan : {"a":{"b":2}} fin'), { a: { b: 2 } });
  assert.throws(() => IA.extraireJson('pas de json'), /JSON valide/);
});

test('sauvegarde : le plan IA est exporté et réimporté', () => {
  const e = etatDeTest();
  const meta = { genereLe: 1, analyse: 'x', phases: [], objectifIds: [], modele: 'm' };
  const relu = lireImport(JSON.stringify(construireExport({ ...e, reglages: D.reglagesParDefaut(), plan: meta })));
  assert.deepEqual(relu.plan, meta);
});

// ------------------------------------------------------------ API simulée

test('SSE : découpage des événements, y compris coupés entre deux paquets', () => {
  const a = decouperSse('event: x\ndata: {"type":"a"}\n\nevent: y\ndata: {"ty');
  assert.deepEqual(a.evenements, [{ type: 'a' }]);
  const b = decouperSse(a.reste + 'pe":"b"}\n\n');
  assert.deepEqual(b.evenements, [{ type: 'b' }]);
  assert.equal(b.reste, '');
});

function fluxSse(texte, { raison = 'end_turn', prefixe = [] } = {}) {
  const ev = [
    { type: 'message_start', message: { id: 'msg_1' } },
    ...prefixe,
    { type: 'content_block_start', index: 0, content_block: { type: 'text', text: '' } },
    // découpe en morceaux pour simuler le flux
    ...(texte.match(/[\s\S]{1,500}/g) ?? []).map(t => ({ type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: t } })),
    { type: 'content_block_stop', index: 0 },
    { type: 'message_delta', delta: { stop_reason: raison }, usage: { output_tokens: 10 } },
    { type: 'message_stop' },
  ];
  const corps = ev.map(e => `event: ${e.type}\ndata: ${JSON.stringify(e)}\n\n`).join('');
  const octets = new TextEncoder().encode(corps);
  return new Response(new ReadableStream({
    start(c) { for (let i = 0; i < octets.length; i += 333) c.enqueue(octets.slice(i, i + 333)); c.close(); },
  }), { status: 200, headers: { 'content-type': 'text/event-stream' } });
}

function fausseApi(reponses) {
  const appels = [];
  const fetchImpl = async (url, init) => {
    appels.push({ url, init, corps: JSON.parse(init.body) });
    const r = reponses[appels.length - 1];
    return typeof r === 'function' ? r() : r;
  };
  return { appels, fetchImpl };
}

test('API : requête conforme (en-têtes, streaming, sortie JSON structurée) et plan valide du premier coup', async () => {
  const c = IA.construireContexte(etatDeTest(), AUJ);
  const api = fausseApi([fluxSse(JSON.stringify(planValide(c)))]);
  const progres = [];
  const { plan, essais } = await genererPlan({ cle: 'cle-test', modele: 'claude-sonnet-5-5', contexte: c, fetchImpl: api.fetchImpl, surProgres: p => progres.push(p) });
  assert.equal(essais, 1);
  assert.ok(plan.seances.length > 10);
  const [appel] = api.appels;
  assert.equal(appel.url, URL_API);
  assert.equal(appel.init.headers['x-api-key'], 'cle-test');
  assert.equal(appel.init.headers['anthropic-version'], '2023-06-01');
  assert.equal(appel.init.headers['anthropic-dangerous-direct-browser-access'], 'true');
  assert.equal(appel.corps.model, 'claude-sonnet-5-5');
  assert.equal(appel.corps.stream, true);
  assert.equal(appel.corps.output_config.format.type, 'json_schema');
  assert.equal(appel.corps.messages[0].role, 'user');
  assert.ok(progres.some(p => p.etape === 'redaction' && p.seances > 0));
});

test('API : un plan invalide déclenche un nouvel essai avec les motifs de rejet', async () => {
  const c = IA.construireContexte(etatDeTest(), AUJ);
  const mauvais = planValide(c);
  mauvais.seances[0] = { ...mauvais.seances[0], date: '2026-11-02' }; // lundi indisponible
  const api = fausseApi([fluxSse('```json\n' + JSON.stringify(mauvais) + '\n```'), fluxSse(JSON.stringify(planValide(c)))]);
  const { essais } = await genererPlan({ cle: 'k', modele: 'm', contexte: c, fetchImpl: api.fetchImpl });
  assert.equal(essais, 2);
  assert.match(api.appels[1].corps.messages[0].content, /rejetée[\s\S]*2026-11-02/);
});

test('API : échec après deux essais invalides, réponse tronquée, refus', async () => {
  const c = IA.construireContexte(etatDeTest(), AUJ);
  const api = fausseApi([() => fluxSse('pas du json'), () => fluxSse('{"seances":[]}')]);
  await assert.rejects(genererPlan({ cle: 'k', modele: 'm', contexte: c, fetchImpl: api.fetchImpl }), /après 2 essais/);

  const tronque = fausseApi([fluxSse('{"seances":[', { raison: 'max_tokens' }), fluxSse(JSON.stringify(planValide(c)))]);
  await genererPlan({ cle: 'k', modele: 'm', contexte: c, fetchImpl: tronque.fetchImpl });
  assert.match(tronque.appels[1].corps.messages[0].content, /tronquée/);

  const refus = fausseApi([fluxSse('', { raison: 'refusal' })]);
  await assert.rejects(genererPlan({ cle: 'k', modele: 'm', contexte: c, fetchImpl: refus.fetchImpl }), /refusé/);
});

test('API : bascule vers un autre modèle en cours de flux (le texte repart de zéro)', async () => {
  const c = IA.construireContexte(etatDeTest(), AUJ);
  const debutAbandonne = { type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: '{"debut":"abandonné' } };
  const bascule = { type: 'content_block_start', index: 1, content_block: { type: 'fallback' } };
  const api = fausseApi([fluxSse(JSON.stringify(planValide(c)), { prefixe: [debutAbandonne, bascule] })]);
  const { essais } = await genererPlan({ cle: 'k', modele: 'm', contexte: c, fetchImpl: api.fetchImpl });
  assert.equal(essais, 1);
});

test('API : erreurs HTTP (clé refusée, options non acceptées, surcharge)', async () => {
  const c = IA.construireContexte(etatDeTest(), AUJ);
  const json = (status, message) => new Response(JSON.stringify({ type: 'error', error: { type: 'x', message } }), { status });

  const cle = fausseApi([json(401, 'invalid x-api-key')]);
  await assert.rejects(genererPlan({ cle: 'k', modele: 'm', contexte: c, fetchImpl: cle.fetchImpl }), /Clé API refusée/);

  // 400 sur les options avancées : nouvel appel sans sortie structurée ni repli.
  const options = fausseApi([json(400, 'output_config: unsupported'), fluxSse(JSON.stringify(planValide(c)))]);
  const r = await genererPlan({ cle: 'k', modele: 'm', contexte: c, fetchImpl: options.fetchImpl });
  assert.equal(r.essais, 1);
  assert.equal(options.appels[1].corps.output_config, undefined);
  assert.equal(options.appels[1].init.headers['anthropic-beta'], undefined);

  const surcharge = fausseApi([json(529, 'Overloaded'), fluxSse(JSON.stringify(planValide(c)))]);
  assert.equal((await genererPlan({ cle: 'k', modele: 'm', contexte: c, fetchImpl: surcharge.fetchImpl })).plan.seances.length > 0, true);

  const reseau = fausseApi([() => { throw new TypeError('Failed to fetch'); }, () => { throw new TypeError('Failed to fetch'); }]);
  await assert.rejects(genererPlan({ cle: 'k', modele: 'm', contexte: c, fetchImpl: reseau.fetchImpl }), /Connexion impossible/);
  assert.equal(reseau.appels[1].init.headers['anthropic-beta'], undefined);
});
