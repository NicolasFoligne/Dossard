// « Ajouter une blessure » : choix dans le catalogue des programmes de soin, ou description de la blessure
// à copier dans une IA (questions-réponses, hypothèse de diagnostic, programme) puis collage et vérification du programme.
import * as M from '../magasin.js';
import * as S from '../soin.js';
import * as B from '../blessure-ia.js';
import * as F from '../format.js';
import * as U from '../ui.js';
import { extraireJson } from '../ia.js';
import { ouvrirSuivi, detailProgramme } from './soin.js';

const { h } = U;

async function copier(texte, zoneSecours) {
  try {
    await navigator.clipboard.writeText(texte);
    U.toast('Texte copié');
  } catch {
    // Presse-papiers indisponible : on affiche le texte à sélectionner à la main.
    zoneSecours.value = texte;
    zoneSecours.hidden = false;
    U.toast('Sélectionnez et copiez le texte affiché');
  }
}

// ------------------------------------------------------------ Étape 1 : catalogue

export function ouvrirAjoutBlessure() {
  U.ouvrirFeuille('Ajouter une blessure', fermer => {
    const ligne = p => h('button.ligne-seance', {
      type: 'button',
      onclick: () => { fermer(); ouvrirSuivi(null, p.id); },
    },
    h('span.ligne-icone.icone-soin', '🩹'),
    h('span.ligne-texte', h('strong', p.libelle), h('span', p.source === 'ia' ? 'Programme personnel (proposé par une IA)' : `${p.phases.length} phases · ${p.phases.map(x => x.nom.toLowerCase()).join(', ')}`)),
    h('span.chevron', '›'));
    const perso = S.tousLesProgrammes().filter(p => p.source === 'ia');
    return h('div.formulaire',
      h('p.aide', 'Choisissez votre blessure : le programme de soin (exercices dosés, bilan du jour, séances dans le planning, règles de course pour le plan) démarre aussitôt.'),
      h('section.carte.carte-soin', h('h2', 'Catalogue'), S.PROGRAMMES.map(ligne)),
      perso.length > 0 && h('section.carte.carte-soin', h('h2', 'Mes programmes'), perso.map(ligne)),
      h('section.carte',
        h('h2', 'Autre blessure, ou vous n\'êtes pas sûr ?'),
        h('p.aide', 'Décrivez-la : l\'application prépare un texte à copier dans une IA (Claude…). Elle vous pose des questions, propose une hypothèse '
          + 'de diagnostic puis un programme de soin, que vous recollez ici pour le suivre comme les autres.'),
        h('button.bouton.large.bouton-soin', { type: 'button', onclick: () => ouvrirDescriptionBlessure() }, 'Décrire la blessure')),
      h('p.bandeau-info', 'Ces programmes ne remplacent pas un examen médical. En cas de doute, consultez un médecin ou un kinésithérapeute.'));
  });
}

// ------------------------------------------------------------ Étape 2 : description, texte pour l'IA, programme collé

const coteSuivi = cote => (cote === 'Droit' ? 'droit' : 'gauche');

export function ouvrirDescriptionBlessure() {
  const brouillon = M.etat.appareil.brouillonBlessure ?? {};
  const d = { ...B.descriptionVide(), ...brouillon.description };

  U.ouvrirFeuille('Décrire la blessure', fermer => {
    const form = h('form.formulaire.formulaire-soin', { novalidate: true, autocomplete: 'off' });
    const choixUnique = (nom, options, valeur) => h('div.puces.puces-uniques', { role: 'radiogroup' },
      options.map(o => h('label.puce', h('input', { type: 'radio', name: nom, value: o, checked: o === valeur }), h('span', o))));
    const lire = () => ({
      zone: U.valeur(form, 'zone'),
      cote: form.querySelector('[name="cote"]:checked')?.value ?? '',
      debut: U.valeur(form, 'debut'),
      apparition: form.querySelector('[name="apparition"]:checked')?.value ?? '',
      douleurRepos: U.lireEchelle(form, 'douleurRepos'),
      douleurMarche: U.lireEchelle(form, 'douleurMarche'),
      douleurCourse: U.lireEchelle(form, 'douleurCourse'),
      moments: U.lirePuces(form.querySelector('[data-puces="moments"]')),
      signes: U.lirePuces(form.querySelector('[data-puces="signes"]')),
      aggrave: U.valeur(form, 'aggrave').trim(),
      diagnostic: U.valeur(form, 'diagnostic').trim(),
      libre: U.valeur(form, 'libre').trim(),
    });
    const zoneProgramme = U.zoneTexte('programme', brouillon.reponse ?? '', { rows: 6, placeholder: 'Collez ici le programme proposé par l\'IA (bloc JSON)', spellcheck: false });
    // Brouillon gardé sur le téléphone : on peut quitter l'application le temps de l'échange avec l'IA.
    let minuterie = null;
    const sauver = () => {
      clearTimeout(minuterie);
      minuterie = setTimeout(() => M.enregistrerBrouillonBlessure({ description: lire(), reponse: zoneProgramme.value }).catch(() => {}), 400);
    };
    form.addEventListener('input', sauver);
    form.addEventListener('change', sauver);

    const secoursPrompt = U.zoneTexte('texteIa', '', { rows: 6, spellcheck: false });
    secoursPrompt.hidden = true;
    const secoursCorrection = U.zoneTexte('texteCorrection', '', { rows: 4, spellcheck: false });
    secoursCorrection.hidden = true;
    const resultat = h('div.zone', { 'aria-live': 'polite' });

    const verifier = () => {
      U.vider(resultat);
      secoursCorrection.hidden = true;
      let brut;
      try {
        brut = extraireJson(zoneProgramme.value);
      } catch (e) {
        U.vider(resultat, h('p.erreur', `${e.message} Copiez bien tout le bloc JSON proposé par l'IA.`));
        return;
      }
      const { programme, erreurs } = B.validerProgramme(brut);
      if (!programme) {
        U.vider(resultat,
          h('div.alerte.alerte-danger', h('span.alerte-icone', '⛔'),
            h('div', h('strong', 'Programme refusé'), h('ul.liste-points', erreurs.slice(0, 8).map(x => h('li', x))),
              erreurs.length > 8 && h('p', `… et ${erreurs.length - 8} autre(s).`))),
          h('button.bouton.secondaire', { type: 'button', onclick: () => copier(B.promptCorrection(erreurs), secoursCorrection) }, 'Copier les corrections pour l\'IA'),
          secoursCorrection);
        return;
      }
      const cote = coteSuivi(lire().cote);
      U.vider(resultat,
        h('section.carte.carte-soin',
          h('h2', programme.libelle),
          h('p.bandeau-info', 'Programme proposé par une IA : il ne remplace pas un examen. Faites-le valider par un médecin ou un kinésithérapeute.'),
          h('div.soin-urgence', h('h3', '⛔ Consultez sans attendre en cas de\u00a0:'), h('ul', programme.consulter.map(x => h('li', x)))),
          detailProgramme(programme, cote, 1),
          h('div.actions-formulaire',
            h('button.bouton.large.bouton-soin', {
              type: 'button',
              onclick: async () => {
                const ok = await U.tenter(async () => { await M.ajouterProgrammePerso(programme); await M.effacerBrouillonBlessure(); return true; });
                if (!ok) return;
                U.fermerToutesFeuilles();
                U.toast('Programme enregistré');
                ouvrirSuivi(null, programme.id);
              },
            }, 'Enregistrer et démarrer le suivi'))));
      resultat.scrollIntoView({ behavior: 'smooth', block: 'start' });
    };

    form.append(
      h('section.carte',
        h('h2', '1. Votre blessure'),
        U.champ('Zone', U.selection('zone', [{ id: '', libelle: 'Choisir…' }, ...B.ZONES.map(z => ({ id: z, libelle: z }))], d.zone)),
        h('fieldset.champ', h('legend.champ-libelle', 'Côté'), choixUnique('cote', B.COTES_BLESSURE, d.cote)),
        U.champ('Depuis le', U.date('debut', d.debut, { max: F.aujourdhui() })),
        h('fieldset.champ', h('legend.champ-libelle', 'Apparition'), choixUnique('apparition', B.APPARITIONS, d.apparition)),
        h('fieldset.champ', h('legend.champ-libelle', 'Douleur au repos'), U.echelle('douleurRepos', d.douleurRepos, { vide: 'Non renseignée', libelle: 'Douleur au repos' })),
        h('fieldset.champ', h('legend.champ-libelle', 'Douleur à la marche'), U.echelle('douleurMarche', d.douleurMarche, { vide: 'Non renseignée', libelle: 'Douleur à la marche' })),
        h('fieldset.champ', h('legend.champ-libelle', 'Douleur en courant'), U.echelle('douleurCourse', d.douleurCourse, { vide: 'Pas couru', libelle: 'Douleur en courant' })),
        h('fieldset.champ', h('legend.champ-libelle', 'Quand avez-vous mal ?'), U.puces('moments', B.MOMENTS.map(m => ({ id: m, libelle: m })), d.moments)),
        h('fieldset.champ', h('legend.champ-libelle', 'Signes associés'), U.puces('signes', B.SIGNES.map(m => ({ id: m, libelle: m })), d.signes)),
        U.champ('Ce qui aggrave ou soulage', U.zoneTexte('aggrave', d.aggrave, { placeholder: 'ex. pire en descente, mieux après échauffement' })),
        U.champ('Diagnostic, examens ou soins déjà faits', U.zoneTexte('diagnostic', d.diagnostic, { rows: 2, placeholder: 'ex. échographie, avis du kiné…' })),
        U.champ('Description libre', U.zoneTexte('libre', d.libre, { placeholder: 'Ce que vous ressentez, comment c\'est arrivé…' }))),
      h('section.carte',
        h('h2', '2. Échanger avec l\'IA'),
        h('ol.etapes',
          h('li', 'Copiez le texte ci-dessous.'),
          h('li', 'Collez-le dans une conversation avec Claude (ou une autre IA) et répondez à ses questions.'),
          h('li', 'Quand elle propose le programme (un bloc JSON), copiez-le et collez-le à l\'étape 3.')),
        h('p.aide', 'Le texte contient votre description et votre contexte sportif (profil, objectifs en cours, volume des 4 dernières semaines). '
          + 'Rien n\'est envoyé automatiquement. Votre description reste enregistrée sur ce téléphone le temps de l\'échange.'),
        h('button.bouton.large.bouton-soin', { type: 'button', onclick: () => copier(B.promptBlessure(lire(), M.etat, F.aujourdhui()), secoursPrompt) }, 'Copier le texte pour l\'IA'),
        secoursPrompt),
      h('section.carte',
        h('h2', '3. Coller le programme proposé'),
        U.champ('Programme (JSON)', zoneProgramme),
        h('button.bouton.secondaire', { type: 'button', onclick: verifier }, 'Vérifier le programme')),
      resultat);
    return form;
  });
}
