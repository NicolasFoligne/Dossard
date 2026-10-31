// Feuille « Plan d'entraînement » : génération par l'IA (ou mode secours), aperçu, validation.
import * as M from '../magasin.js';
import * as D from '../domaine.js';
import * as F from '../format.js';
import * as U from '../ui.js';
import * as IA from '../ia.js';
import { genererPlan } from '../ia-api.js';
import { libellePrevue } from './formulaires.js';

const { h } = U;

// Garde l'écran allumé pendant la génération (si le navigateur le permet).
async function garderEcranAllume() {
  try {
    return await navigator.wakeLock?.request('screen');
  } catch {
    return null;
  }
}

export function ouvrirPlanIa({ auto = false } = {}) {
  const auj = F.aujourdhui();
  let contexte;
  try {
    const maintenant = new Date();
    contexte = IA.construireContexte(M.etat, auj, { minutesActuelles: maintenant.getHours() * 60 + maintenant.getMinutes() });
  } catch (e) {
    U.toast(e.message, { erreur: true });
    return;
  }
  const cle = M.etat.appareil.cleApi ?? '';
  const modele = M.etat.reglages.modeleIa || D.reglagesParDefaut().modeleIa;
  let controleur = null;

  U.ouvrirFeuille('Plan d\'entraînement', fermer => {
    const zoneGeneration = h('section.zone');
    const zoneApercu = h('section.zone');
    const erreur = h('p.erreur', { role: 'alert' });
    const nbCreneaux = contexte.calendrier.reduce((s, x) => s + x.jours.length, 0);

    const afficherApercu = (plan, source) => {
      const semaines = IA.resumeParSemaine(plan.seances);
      const points = IA.pointsAttention(plan, contexte);
      const remplaces = M.etat.prevues.filter(p => IA.estRemplacable(p, auj)).length;
      U.vider(zoneApercu,
        h('div.carte.apercu',
          h('h2', 'Aperçu du plan'),
          h('p.aide', `${plan.seances.length} séances sur ${semaines.length} semaines${source ? ` · ${source}` : ''}.`
            + (remplaces ? ` Remplacera ${remplaces} séance${remplaces > 1 ? 's' : ''} IA à venir.` : '')),
          plan.analyse && h('div.bloc-description', h('h3', 'Analyse du coach'), h('p', plan.analyse)),
          points.length > 0 && h('div.alerte.alerte-attention', h('span.alerte-icone', '⚠️'),
            h('div', h('strong', 'Points d\'attention'), h('ul.liste-points', points.map(p => h('li', p))))),
          plan.phases.length > 0 && h('div',
            h('h3.titre-groupe', 'Phases'),
            h('ul.liste-phases', plan.phases.map(p => h('li',
              h('strong', F.capitaliser(p.nom)), ` · ${F.dateCourte(p.debut)} → ${F.dateCourte(p.fin)}`,
              p.description && h('span.aide', ` — ${p.description}`))))),
          h('h3.titre-groupe', 'Semaines'),
          semaines.map(s => h('details.semaine-apercu',
            h('summary', h('span', `Semaine du ${F.jourMois(s.lundi)}`), h('span.aide', `${s.nb} séance${s.nb > 1 ? 's' : ''} · ${F.duree(s.dureeS)}`)),
            s.seances.map(x => h('div.ligne-apercu',
              h('strong', F.capitaliser(F.dateCourte(x.date))),
              h('span', libellePrevue(x)),
              x.description.corps && h('span.aide', x.description.corps))))),
          h('div.actions-formulaire',
            h('button.bouton.large', {
              type: 'button',
              onclick: async () => {
                const ok = await U.tenter(async () => { await M.appliquerPlan(plan, source === 'mode secours' ? 'mode secours' : modele); return true; });
                if (ok) { fermer(); U.toast('Plan enregistré 🗓️'); location.hash = '#/plan'; }
              },
            }, `Valider le plan (${plan.seances.length} séances)`),
            h('button.bouton.secondaire', { type: 'button', onclick: () => U.vider(zoneApercu) }, 'Annuler'))));
      zoneApercu.scrollIntoView({ behavior: 'smooth', block: 'start' });
    };

    // -------------------------------------------------------- Génération par l'API
    const progres = h('p.progres', { 'aria-live': 'polite' });
    const boutonGenerer = h('button.bouton.large', { type: 'button', onclick: () => lancer() },
      M.etat.plan ? 'Recalculer le plan avec l\'IA' : 'Générer le plan avec l\'IA');
    const boutonAnnuler = h('button.bouton.secondaire', { type: 'button', hidden: true, onclick: () => controleur?.abort() }, 'Arrêter');
    const debut = { t: 0 };

    const lancer = async () => {
      U.vider(zoneApercu);
      erreur.textContent = '';
      controleur = new AbortController();
      boutonGenerer.disabled = true;
      boutonAnnuler.hidden = false;
      debut.t = Date.now();
      const verrou = await garderEcranAllume();
      try {
        const { plan, essais } = await genererPlan({
          cle, modele, contexte, signal: controleur.signal,
          surProgres: p => {
            const secondes = Math.round((Date.now() - debut.t) / 1000);
            const essai = p.essai > 1 ? ` (2e essai, après correction)` : '';
            progres.textContent = p.etape === 'redaction'
              ? `Rédaction du plan${essai} : ${p.seances} séance${p.seances > 1 ? 's' : ''} reçue${p.seances > 1 ? 's' : ''}… (${secondes} s)`
              : `Le coach réfléchit${essai}… (${secondes} s)`;
          },
        });
        progres.textContent = '';
        afficherApercu(plan, essais > 1 ? `${modele}, corrigé au 2e essai` : modele);
      } catch (e) {
        progres.textContent = '';
        if (e?.name === 'AbortError') U.toast('Génération arrêtée');
        else erreur.textContent = e?.message || 'La génération a échoué.';
      } finally {
        verrou?.release?.().catch(() => {});
        controleur = null;
        boutonGenerer.disabled = false;
        boutonAnnuler.hidden = true;
      }
    };

    U.vider(zoneGeneration,
      h('div.carte',
        h('p', `Un plan unique pour : ${contexte.objectifs.map(o => o.nom).join(', ')}.`),
        h('p.aide', `Du ${F.dateFr(contexte.debut)} à la veille du ${F.dateFr(contexte.fin)} · ${nbCreneaux} créneau${nbCreneaux > 1 ? 'x' : ''} disponible${nbCreneaux > 1 ? 's' : ''} selon votre semainier. `
          + 'Les séances passées, réalisées ou ajoutées à la main ne sont jamais modifiées.'),
        nbCreneaux === 0 && h('p.alerte.alerte-attention', 'Aucun créneau disponible : complétez votre semainier dans Réglages.'),
        cle
          ? [h('p.aide', `Envoyé à l'API Anthropic (modèle ${modele}) : profil, semainier, objectifs en cours, séances des 8 dernières semaines. La génération peut prendre quelques minutes : gardez l'application ouverte.`),
            boutonGenerer, boutonAnnuler, progres]
          : h('p.bandeau-info', 'Aucune clé API enregistrée : utilisez le mode secours ci-dessous, ou ajoutez une clé dans Réglages.')),
      erreur);

    // -------------------------------------------------------- Mode secours
    const zoneReponse = U.zoneTexte('reponse', '', { rows: 6, placeholder: 'Collez ici la réponse JSON de Claude', spellcheck: false });
    const zonePrompt = h('textarea', { rows: 4, readOnly: true, hidden: true, 'aria-label': 'Prompt à copier' });
    const erreurSecours = h('p.erreur', { role: 'alert' });
    const secours = h('details.carte.secours', { open: !cle },
      h('summary', h('strong', 'Mode secours (sans clé API)')),
      h('ol.etapes',
        h('li', 'Copiez le prompt.'),
        h('li', 'Collez-le dans une conversation avec Claude (application ou claude.ai).'),
        h('li', 'Copiez sa réponse et collez-la ci-dessous.')),
      h('button.bouton.secondaire', {
        type: 'button',
        onclick: async () => {
          const texte = IA.promptACopier(contexte);
          try {
            await navigator.clipboard.writeText(texte);
            U.toast('Prompt copié');
          } catch {
            // Presse-papiers indisponible : on affiche le texte à copier à la main.
            zonePrompt.value = texte;
            zonePrompt.hidden = false;
            zonePrompt.select();
            U.toast('Sélectionnez et copiez le texte affiché');
          }
        },
      }, 'Copier le prompt'),
      zonePrompt,
      U.champ('Coller la réponse', zoneReponse),
      erreurSecours,
      h('button.bouton.secondaire', {
        type: 'button',
        onclick: () => {
          erreurSecours.textContent = '';
          try {
            const { plan, erreurs } = IA.validerPlan(IA.extraireJson(zoneReponse.value), contexte);
            if (!plan) {
              erreurSecours.textContent = `Réponse rejetée : ${erreurs.slice(0, 6).join(' ; ')}${erreurs.length > 6 ? '…' : ''} `
                + 'Demandez à Claude de corriger ces points, puis collez la nouvelle réponse.';
              return;
            }
            afficherApercu(plan, 'mode secours');
          } catch (e) {
            erreurSecours.textContent = e.message;
          }
        },
      }, 'Analyser la réponse'));

    if (auto && cle && nbCreneaux > 0) setTimeout(lancer, 0);
    return h('div.formulaire', zoneGeneration, secours, zoneApercu);
  }, { surFermeture: () => controleur?.abort() });
}
