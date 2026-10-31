// Formulaires présentés en feuilles : séance réalisée (saisie rapide), séance prévue,
// objectif, résultat, détail d'une séance prévue.
import * as M from '../magasin.js';
import * as D from '../domaine.js';
import * as F from '../format.js';
import * as U from '../ui.js';

const { h } = U;

// Choix unique présenté en grosses puces (boutons radio).
function choixUnique(nom, options, valeur, onchange) {
  return h('div.puces.puces-uniques', { role: 'radiogroup' },
    options.map(o => h('label.puce',
      h('input', { type: 'radio', name: nom, value: o.id, checked: o.id === valeur, onchange }),
      h('span', o.icone ? `${o.icone} ${o.court ?? o.libelle}` : o.libelle))));
}

const zoneErreur = () => h('p.erreur', { role: 'alert' });

// Distance saisie en mètres (natation, rameur) ou en km selon la discipline. Stockée en km.
const enMetres = disc => D.discipline(disc).distance === 'm';
function lireDistance(form, disc) {
  const n = U.valeurNombre(form, 'distance');
  if (n === null) return null;
  return enMetres(disc) ? n / 1000 : n;
}
function valeurDistance(km, disc) {
  if (!km) return '';
  return enMetres(disc) ? Math.round(km * 1000) : km;
}
// Champ distance adapté à la discipline (aucun pour le renforcement et la mobilité).
function champDistance(disc, km, attrs = {}) {
  if (D.discipline(disc).distance === null) return null;
  return U.champ(enMetres(disc) ? 'Distance (m)' : 'Distance (km)',
    U.nombre('distance', valeurDistance(km, disc), { placeholder: enMetres(disc) ? 'ex. 1500' : 'ex. 10,5', ...attrs }));
}

function nomsObjectifs(ids) {
  return ids.map(id => M.objectif(id)?.nom).filter(Boolean);
}

// ------------------------------------------------------------ Séance réalisée

export function ouvrirSaisieRealisee({ id = null, brouillon = null } = {}) {
  const existante = id ? M.realisee(id) : null;
  const auj = F.aujourdhui();
  const prevuesDuJour = existante ? [] : D.prevuesAFaire(M.etat.prevues, auj);
  let depart = existante ?? brouillon;
  if (!depart && prevuesDuJour.length) depart = D.brouillonDepuisPrevue(prevuesDuJour[0], auj);
  depart ??= { date: auj, discipline: 'course', dureeS: null, distanceKm: null, ressenti: null, notes: '', prevueId: null };

  U.ouvrirFeuille(existante ? 'Modifier la séance' : 'Séance réalisée', fermer => {
    const erreur = zoneErreur();
    const form = h('form.formulaire', { novalidate: true, autocomplete: 'off' });
    const infoAllure = h('p.calcul', { 'aria-live': 'polite' });
    const infoRattachement = h('p.aide-rattachement');
    const zoneDistance = h('div.zone');

    const disc = () => form.querySelector('[name="discipline"]:checked')?.value ?? 'course';

    const dessinerDistance = (km) => {
      U.vider(zoneDistance, champDistance(disc(), km, { oninput: majCalculs }));
    };

    const majCalculs = () => {
      const d = disc();
      const a = D.allure({ discipline: d, dureeS: U.lireDuree(form, 'duree'), distanceKm: lireDistance(form, d) });
      infoAllure.textContent = a ? `${D.estVitesse(a) ? 'Vitesse' : 'Allure'} : ${a.texte}` : '';
      const noms = nomsObjectifs(D.objectifsRattachables(d, M.etat.objectifs));
      infoRattachement.textContent = noms.length
        ? `Rattachée automatiquement à : ${noms.join(', ')}`
        : 'Aucun objectif en cours ne correspond à cette discipline.';
    };

    const remplir = b => {
      form.elements.date.value = b.date;
      form.querySelectorAll('[name="discipline"]').forEach(r => { r.checked = r.value === b.discipline; });
      const hms = F.secondesVersHms(b.dureeS);
      for (const s of ['h', 'm', 's']) form.elements[`duree_${s}`].value = hms[s] === '' ? '' : hms[s];
      dessinerDistance(b.distanceKm);
      majCalculs();
    };

    let choixPrevue = null;
    if (prevuesDuJour.length) {
      choixPrevue = U.selection('prevueId',
        [...prevuesDuJour.map(p => ({ id: p.id, libelle: libellePrevue(p) })), { id: '', libelle: 'Séance non prévue' }],
        depart.prevueId ?? '',
        { onchange: e => { const p = M.prevue(e.target.value); if (p) remplir(D.brouillonDepuisPrevue(p, auj)); } });
    }

    form.append(
      choixPrevue && U.champ('Séance prévue aujourd\'hui', choixPrevue, 'Le formulaire est prérempli à partir de la séance prévue.'),
      U.champ('Date', U.date('date', depart.date, { required: true, max: F.ajouterJours(auj, 1) })),
      h('fieldset.champ', h('legend.champ-libelle', 'Discipline'),
        choixUnique('discipline', D.DISCIPLINES, depart.discipline, () => { dessinerDistance(lireDistance(form, disc())); majCalculs(); })),
      U.champ('Durée', U.duree('duree', depart.dureeS)),
      zoneDistance,
      infoAllure,
      h('fieldset.champ', h('legend.champ-libelle', 'Ressenti'), U.ressenti('ressenti', depart.ressenti)),
      U.champ('Notes', U.zoneTexte('notes', depart.notes, { placeholder: 'Sensations, météo, parcours…' })),
      infoRattachement,
      erreur,
      h('div.actions-formulaire',
        h('button.bouton.large', { type: 'submit' }, 'Enregistrer'),
        existante && h('button.bouton.secondaire.danger-texte', {
          type: 'button',
          onclick: async () => {
            if (!(await U.confirmer('Supprimer cette séance réalisée ?', { ok: 'Supprimer', danger: true }))) return;
            await U.tenter(() => M.supprimerRealisee(existante.id));
            fermer();
            U.toast('Séance supprimée');
          },
        }, 'Supprimer')));

    form.querySelector('[data-duree]').addEventListener('input', majCalculs);
    dessinerDistance(depart.distanceKm);
    majCalculs();

    // Lien vers une séance prévue : choisi dans la liste du jour, ou hérité du brouillon / de la séance modifiée.
    const prevueLiee = () => (choixPrevue ? form.elements.prevueId.value || null : depart.prevueId ?? null);

    form.addEventListener('submit', async e => {
      e.preventDefault();
      const d = disc();
      const ok = await U.tenter(async () => {
        await M.enregistrerRealisee({
          date: U.valeur(form, 'date'),
          discipline: d,
          dureeS: U.lireDuree(form, 'duree'),
          distanceKm: D.discipline(d).distance === null ? null : lireDistance(form, d),
          ressenti: U.lireRessenti(form, 'ressenti'),
          notes: U.valeur(form, 'notes'),
          prevueId: prevueLiee(),
        }, existante?.id);
        return true;
      }, erreur);
      if (ok) { fermer(); U.toast(existante ? 'Séance modifiée' : 'Séance enregistrée 👏'); }
    });
    return form;
  });
}

export function libellePrevue(p) {
  const parties = [D.discipline(p.discipline).icone];
  if (p.heureDebut) parties.push(F.heureFr(p.heureDebut));
  parties.push(D.TYPES_SEANCE.find(t => t.id === p.type)?.libelle ?? p.type);
  if (p.dureeS) parties.push(F.duree(p.dureeS));
  if (p.distanceKm) parties.push(F.distance(p.distanceKm, p.discipline));
  return parties.join(' · ');
}

// ------------------------------------------------------------ Séance prévue

export function ouvrirPrevue({ id = null, date = null } = {}) {
  const existante = id ? M.prevue(id) : null;
  const depart = existante ?? {
    date: date ?? F.aujourdhui(), discipline: 'course', type: 'endurance', intensite: 'facile',
    dureeS: null, distanceKm: null, description: {}, objectifIds: null, etat: 'a_faire',
  };
  const objectifsOuverts = M.etat.objectifs.filter(o => o.statut !== 'termine' || depart.objectifIds?.includes(o.id));

  U.ouvrirFeuille(existante ? 'Modifier la séance prévue' : 'Nouvelle séance prévue', fermer => {
    const erreur = zoneErreur();
    const form = h('form.formulaire', { novalidate: true, autocomplete: 'off' });
    const zoneDistance = h('div.zone');
    const zoneObjectifs = h('div.zone');
    const disc = () => form.querySelector('[name="discipline"]:checked')?.value ?? 'course';
    let objectifsTouches = !!existante;

    const dessinerDistance = km => {
      U.vider(zoneDistance, champDistance(disc(), km));
    };
    const dessinerObjectifs = () => {
      if (!objectifsOuverts.length) {
        U.vider(zoneObjectifs, h('p.aide', 'Aucun objectif à rattacher pour l\'instant.'));
        return;
      }
      const choisis = objectifsTouches && zoneObjectifs.querySelector('[data-puces]')
        ? U.lirePuces(zoneObjectifs.querySelector('[data-puces]'))
        : depart.objectifIds ?? D.objectifsRattachables(disc(), M.etat.objectifs);
      const p = U.puces('objectifs', objectifsOuverts.map(o => ({ id: o.id, libelle: o.nom })), choisis);
      p.addEventListener('change', () => { objectifsTouches = true; });
      U.vider(zoneObjectifs, h('fieldset.champ', h('legend.champ-libelle', 'Objectifs rattachés'), p));
    };

    form.append(
      U.champ('Date', U.date('date', depart.date, { required: true })),
      h('fieldset.champ', h('legend.champ-libelle', 'Discipline'),
        choixUnique('discipline', D.DISCIPLINES, depart.discipline, () => { dessinerDistance(null); dessinerObjectifs(); })),
      h('div.grille-2',
        U.champ('Type', U.selection('type', D.TYPES_SEANCE, depart.type)),
        U.champ('Intensité', U.selection('intensite', D.INTENSITES, depart.intensite))),
      U.champ('Heure de début (facultative)', h('input', { type: 'time', name: 'heureDebut', value: depart.heureDebut ?? '', step: 900 })),
      U.champ('Durée', U.duree('duree', depart.dureeS, { avecSecondes: false })),
      zoneDistance,
      U.champ('Échauffement', U.zoneTexte('echauffement', depart.description?.echauffement, { rows: 2 })),
      U.champ('Corps de séance', U.zoneTexte('corps', depart.description?.corps)),
      U.champ('Retour au calme', U.zoneTexte('retourCalme', depart.description?.retourCalme, { rows: 2 })),
      zoneObjectifs,
      existante && U.champ('État', U.selection('etat', D.ETATS_PREVUE, depart.etat)),
      erreur,
      h('div.actions-formulaire',
        h('button.bouton.large', { type: 'submit' }, 'Enregistrer'),
        existante && h('button.bouton.secondaire.danger-texte', {
          type: 'button',
          onclick: async () => {
            if (!(await U.confirmer('Supprimer cette séance prévue ?', { ok: 'Supprimer', danger: true }))) return;
            await U.tenter(() => M.supprimerPrevue(existante.id));
            U.fermerToutesFeuilles();
            U.toast('Séance prévue supprimée');
          },
        }, 'Supprimer')));
    dessinerDistance(depart.distanceKm);
    dessinerObjectifs();

    form.addEventListener('submit', async e => {
      e.preventDefault();
      const d = disc();
      const puce = zoneObjectifs.querySelector('[data-puces]');
      const ok = await U.tenter(async () => {
        await M.enregistrerPrevue({
          id: existante?.id,
          date: U.valeur(form, 'date'),
          discipline: d,
          type: U.valeur(form, 'type'),
          intensite: U.valeur(form, 'intensite'),
          dureeS: U.lireDuree(form, 'duree'),
          heureDebut: U.valeur(form, 'heureDebut') || null,
          distanceKm: D.discipline(d).distance === null ? null : lireDistance(form, d),
          description: { echauffement: U.valeur(form, 'echauffement'), corps: U.valeur(form, 'corps'), retourCalme: U.valeur(form, 'retourCalme') },
          objectifIds: puce ? U.lirePuces(puce) : [],
          etat: existante ? U.valeur(form, 'etat') : 'a_faire',
        });
        return true;
      }, erreur);
      if (ok) { U.fermerToutesFeuilles(); U.toast(existante ? 'Séance prévue modifiée' : 'Séance prévue ajoutée'); }
    });
    return form;
  });
}

export function ouvrirDetailPrevue(id) {
  const p = M.prevue(id);
  if (!p) return;
  const intensite = D.INTENSITES.find(i => i.id === p.intensite)?.libelle;
  const etatLib = D.ETATS_PREVUE.find(e => e.id === p.etat)?.libelle;
  const bloc = (titre, txt) => txt && h('div.bloc-description', h('h3', titre), h('p', txt));
  U.ouvrirFeuille('Séance prévue', fermer => h('div.detail',
    h('p.detail-date', F.dateLongue(p.date)),
    h('p.detail-titre', libellePrevue(p)),
    h('p.detail-meta', [intensite, `État : ${etatLib}`].filter(Boolean).join(' · ')),
    p.objectifIds.length > 0 && h('p.detail-meta', `Objectifs : ${nomsObjectifs(p.objectifIds).join(', ')}`),
    bloc('Échauffement', p.description.echauffement),
    bloc('Corps de séance', p.description.corps),
    bloc('Retour au calme', p.description.retourCalme),
    h('div.actions-formulaire',
      p.etat !== 'faite' && h('button.bouton.large', {
        type: 'button',
        onclick: () => { fermer(); ouvrirSaisieRealisee({ brouillon: D.brouillonDepuisPrevue(p, p.date <= F.aujourdhui() ? p.date : F.aujourdhui()) }); },
      }, 'Je l\'ai faite'),
      p.etat === 'a_faire' && h('button.bouton.secondaire', {
        type: 'button',
        onclick: async () => { await U.tenter(() => M.changerEtatPrevue(p.id, 'ratee')); fermer(); U.toast('Séance marquée ratée'); },
      }, 'Marquer ratée'),
      p.etat === 'ratee' && h('button.bouton.secondaire', {
        type: 'button',
        onclick: async () => { await U.tenter(() => M.changerEtatPrevue(p.id, 'a_faire')); fermer(); },
      }, 'Remettre à faire'),
      h('button.bouton.secondaire', { type: 'button', onclick: () => ouvrirPrevue({ id: p.id }) }, 'Modifier'))));
}

// ------------------------------------------------------------ Objectif

export function ouvrirObjectif({ id = null } = {}) {
  const existant = id ? M.objectif(id) : null;
  const depart = existant ?? { nom: '', sport: 'course', type: '10km', dateEpreuve: '', ...D.distancesParDefaut('course', '10km') };

  U.ouvrirFeuille(existant ? 'Modifier l\'objectif' : 'Nouvel objectif', fermer => {
    const erreur = zoneErreur();
    const form = h('form.formulaire', { novalidate: true, autocomplete: 'off' });
    const zoneType = h('div.zone');
    const zoneDistances = h('div.zone');
    const sport = () => form.querySelector('[name="sport"]:checked')?.value ?? 'course';

    const dessinerDistances = valeurs => {
      if (sport() === 'triathlon') {
        U.vider(zoneDistances, h('div.grille-3',
          U.champ('Natation (m)', U.nombre('natationM', valeurs.natationM)),
          U.champ('Vélo (km)', U.nombre('veloKm', valeurs.veloKm)),
          U.champ('Course (km)', U.nombre('courseKm', valeurs.courseKm))),
          h('p.aide', 'Distances FFTri préremplies, modifiables selon votre épreuve.'),
          U.champ('Dénivelé (m)', U.nombre('deniveleM', valeurs.deniveleM)));
      } else {
        U.vider(zoneDistances, h('div.grille-2',
          U.champ('Distance (km)', U.nombre('distanceKm', valeurs.distanceKm)),
          U.champ('Dénivelé (m)', U.nombre('deniveleM', valeurs.deniveleM))));
      }
    };
    const dessinerType = type => {
      const s = sport();
      const sel = U.selection('type', D.TYPES_OBJECTIF[s].map(t => ({ id: t.id, libelle: s === 'triathlon' ? `${t.libelle} (${t.natationM} m / ${t.veloKm} km / ${F.nombre(t.courseKm)} km)` : t.libelle })), type,
        { onchange: e => dessinerDistances({ ...D.distancesParDefaut(s, e.target.value), deniveleM: U.valeurNombre(form, 'deniveleM') }) });
      U.vider(zoneType, U.champ('Type', sel));
    };

    form.append(
      U.champ('Nom', U.texte('nom', depart.nom, { placeholder: 'ex. Marathon de Paris', required: true })),
      h('fieldset.champ', h('legend.champ-libelle', 'Sport'),
        choixUnique('sport', D.SPORTS, depart.sport, () => {
          const t = D.TYPES_OBJECTIF[sport()][sport() === 'triathlon' ? 2 : 1].id;
          dessinerType(t);
          dessinerDistances(D.distancesParDefaut(sport(), t));
        })),
      zoneType,
      zoneDistances,
      U.champ('Date de l\'épreuve', U.date('dateEpreuve', depart.dateEpreuve, { required: true }), 'Obligatoire : c\'est la date de fin de la préparation.'),
      U.champ('Temps visé (facultatif)', U.duree('tempsVise', depart.tempsViseS)),
      erreur,
      h('div.actions-formulaire',
        h('button.bouton.large', { type: 'submit' }, 'Enregistrer'),
        existant && h('button.bouton.secondaire.danger-texte', {
          type: 'button',
          onclick: async () => {
            if (!(await U.confirmer(`Supprimer l'objectif « ${existant.nom} » ? Les séances sont conservées mais n'y seront plus rattachées.`, { ok: 'Supprimer', danger: true }))) return;
            await U.tenter(() => M.supprimerObjectif(existant.id));
            fermer();
            U.toast('Objectif supprimé');
          },
        }, 'Supprimer l\'objectif')));
    dessinerType(depart.type);
    dessinerDistances(depart);

    form.addEventListener('submit', async e => {
      e.preventDefault();
      const donnees = {
        nom: U.valeur(form, 'nom'),
        sport: sport(),
        type: U.valeur(form, 'type'),
        dateEpreuve: U.valeur(form, 'dateEpreuve'),
        deniveleM: U.valeurNombre(form, 'deniveleM'),
        tempsViseS: U.lireDuree(form, 'tempsVise'),
        distanceKm: U.valeurNombre(form, 'distanceKm'),
        natationM: U.valeurNombre(form, 'natationM'),
        veloKm: U.valeurNombre(form, 'veloKm'),
        courseKm: U.valeurNombre(form, 'courseKm'),
      };
      const ok = await U.tenter(async () => {
        if (existant) await M.modifierObjectif(existant.id, donnees);
        else await M.creerObjectif(donnees);
        return true;
      }, erreur);
      if (ok) { fermer(); U.toast(existant ? 'Objectif modifié' : 'Objectif créé'); }
    });
    return form;
  });
}

// ------------------------------------------------------------ Résultat (bouton « Terminer »)

export function ouvrirResultat(id) {
  const o = M.objectif(id);
  U.ouvrirFeuille('Terminer l\'objectif', fermer => {
    const erreur = zoneErreur();
    const form = h('form.formulaire', { novalidate: true, autocomplete: 'off' },
      h('p.aide', `Saisissez votre résultat pour « ${o.nom} ». L'objectif passera au statut « Terminé ».`),
      U.champ('Temps réalisé', U.duree('temps', null)),
      U.champ('Classement (facultatif)', U.texte('classement', '', { placeholder: 'ex. 152e / 1 800' })),
      h('fieldset.champ', h('legend.champ-libelle', 'Ressenti'), U.ressenti('ressenti', null)),
      U.champ('Commentaire', U.zoneTexte('commentaire', '', { placeholder: 'Déroulé de la course, points à retenir…' })),
      erreur,
      h('div.actions-formulaire', h('button.bouton.large', { type: 'submit' }, 'Terminer l\'objectif')));
    form.addEventListener('submit', async e => {
      e.preventDefault();
      const ok = await U.tenter(async () => {
        await M.terminerObjectif(o.id, {
          tempsS: U.lireDuree(form, 'temps'),
          classement: U.valeur(form, 'classement'),
          ressenti: U.lireRessenti(form, 'ressenti'),
          commentaire: U.valeur(form, 'commentaire'),
        });
        return true;
      }, erreur);
      if (ok) { fermer(); U.toast('Bravo ! Objectif terminé 🏅'); }
    });
    return form;
  });
}
