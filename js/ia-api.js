// Appel direct de l'API Anthropic Messages depuis le navigateur, en streaming (SSE).
// La clé reste sur le téléphone : elle n'est envoyée qu'à api.anthropic.com.
import { ErreurMetier } from './domaine.js';
import { construirePrompt, extraireJson, validerPlan, SCHEMA_PLAN } from './ia.js';

export const URL_API = 'https://api.anthropic.com/v1/messages';
const MAX_TOKENS = 64000;

class ErreurReseau extends ErreurMetier {
  constructor(message, { reessayable = false, statut = null } = {}) {
    super(message);
    this.reessayable = reessayable;
    this.statut = statut;
  }
}

// Découpe un tampon SSE en événements complets ; renvoie aussi le reste non terminé.
export function decouperSse(tampon) {
  const blocs = tampon.replace(/\r\n/g, '\n').split('\n\n');
  const reste = blocs.pop();
  const evenements = [];
  for (const bloc of blocs) {
    const donnees = bloc.split('\n').filter(l => l.startsWith('data:')).map(l => l.slice(5).trim()).join('\n');
    if (!donnees) continue;
    try {
      evenements.push(JSON.parse(donnees));
    } catch {
      // ligne incomplète ou non JSON : ignorée
    }
  }
  return { evenements, reste };
}

// Requête complète (sortie JSON structurée + repli serveur en cas de refus), ou simple si l'API refuse ces options.
function corpsRequete(modele, prompt, complet) {
  const corps = {
    model: modele,
    max_tokens: MAX_TOKENS,
    stream: true,
    system: prompt.systeme,
    messages: [{ role: 'user', content: prompt.utilisateur }],
  };
  if (complet) {
    corps.output_config = { format: { type: 'json_schema', schema: SCHEMA_PLAN } };
    corps.fallbacks = 'default';
  }
  return corps;
}

function entetes(cle, complet) {
  const e = {
    'content-type': 'application/json',
    'x-api-key': cle,
    'anthropic-version': '2023-06-01',
    'anthropic-dangerous-direct-browser-access': 'true',
  };
  if (complet) e['anthropic-beta'] = 'server-side-fallback-2026-07-01';
  return e;
}

async function lireErreur(reponse) {
  let detail = '';
  try {
    detail = (await reponse.json())?.error?.message ?? '';
  } catch {
    // corps non JSON
  }
  const s = reponse.status;
  if (s === 401) return new ErreurReseau('Clé API refusée : vérifiez-la dans Réglages.', { statut: s });
  if (s === 403) return new ErreurReseau(`Accès refusé par l'API${detail ? ` : ${detail}` : ''}.`, { statut: s });
  if (s === 404) return new ErreurReseau(`Modèle introuvable : vérifiez son nom dans Réglages${detail ? ` (${detail})` : ''}.`, { statut: s });
  if (s === 429) return new ErreurReseau('Limite d\'utilisation de l\'API atteinte : réessayez dans quelques minutes.', { statut: s });
  if (s === 400) return new ErreurReseau(`Requête refusée par l'API${detail ? ` : ${detail}` : ''}.`, { statut: s });
  return new ErreurReseau(`L'API est indisponible (erreur ${s}). Réessayez plus tard.`, { statut: s, reessayable: s >= 500 });
}

// Un appel en streaming : renvoie le texte complet et la raison d'arrêt.
async function appeler({ cle, modele, prompt, complet, signal, surProgres, fetchImpl }) {
  let reponse;
  try {
    reponse = await fetchImpl(URL_API, { method: 'POST', headers: entetes(cle, complet), body: JSON.stringify(corpsRequete(modele, prompt, complet)), signal });
  } catch (e) {
    if (e?.name === 'AbortError') throw e;
    throw new ErreurReseau('Connexion impossible à l\'API : vérifiez votre connexion internet.', { reessayable: true });
  }
  if (!reponse.ok) throw await lireErreur(reponse);

  const lecteur = reponse.body.getReader();
  const decodeur = new TextDecoder();
  let tampon = '';
  let texte = '';
  let raison = null;
  for (;;) {
    const { done, value } = await lecteur.read();
    if (done) break;
    tampon += decodeur.decode(value, { stream: true });
    const { evenements, reste } = decouperSse(tampon);
    tampon = reste;
    for (const ev of evenements) {
      if (ev.type === 'content_block_start' && ev.content_block?.type === 'fallback') texte = ''; // un autre modèle reprend : on repart de zéro
      else if (ev.type === 'content_block_delta' && ev.delta?.type === 'text_delta') texte += ev.delta.text;
      else if (ev.type === 'message_delta' && ev.delta?.stop_reason) raison = ev.delta.stop_reason;
      else if (ev.type === 'error') {
        const type = ev.error?.type;
        throw new ErreurReseau(`L'API a interrompu la génération${ev.error?.message ? ` : ${ev.error.message}` : ''}.`, { reessayable: type === 'overloaded_error' || type === 'api_error' });
      }
    }
    surProgres?.({ etape: texte ? 'redaction' : 'reflexion', caracteres: texte.length, seances: (texte.match(/"dureeMin"/g) ?? []).length });
  }
  return { texte, raison };
}

// Génère et valide un plan. Deux essais au plus : le second reçoit les motifs de rejet du premier.
export async function genererPlan({ cle, modele, contexte, signal = null, surProgres = null, fetchImpl = globalThis.fetch.bind(globalThis) }) {
  let erreurs = null;
  let complet = true;
  let dernieresErreurs = [];
  for (let essai = 1; essai <= 2; essai++) {
    surProgres?.({ etape: 'envoi', essai });
    const prompt = construirePrompt(contexte, erreurs);
    let resultat;
    try {
      resultat = await appeler({ cle, modele, prompt, complet, signal, surProgres: p => surProgres?.({ ...p, essai }), fetchImpl });
    } catch (e) {
      // Options avancées non acceptées (autre modèle, compte…) : on retente sans elles.
      if (e.statut === 400 && complet) { complet = false; essai--; continue; }
      // Coupure réseau : nouvel essai, sans l'en-tête bêta au cas où le navigateur l'aurait bloqué (CORS).
      if (e.reessayable && !e.statut) complet = false;
      if (e.reessayable && essai === 1) continue;
      throw e;
    }
    if (resultat.raison === 'refusal') throw new ErreurMetier('Le modèle a refusé de générer ce plan. Essayez le mode secours ou un autre modèle.');
    if (resultat.raison === 'max_tokens') {
      erreurs = ['Ta réponse a été tronquée car trop longue : raccourcis fortement les descriptions des séances.'];
    } else {
      try {
        const { plan, erreurs: e } = validerPlan(extraireJson(resultat.texte), contexte);
        if (plan) return { plan, essais: essai };
        erreurs = e;
      } catch (e) {
        erreurs = [e.message];
      }
    }
    dernieresErreurs = erreurs;
  }
  const extrait = dernieresErreurs.slice(0, 5).join(' ; ');
  throw new ErreurMetier(`Le plan proposé ne respecte pas les contraintes après 2 essais : ${extrait}${dernieresErreurs.length > 5 ? '…' : ''}`);
}
