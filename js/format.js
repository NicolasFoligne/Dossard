// Formats français : dates, durées, distances, allures et vitesses.
// Les dates « jour » sont toujours des chaînes locales AAAA-MM-JJ (jamais toISOString,
// qui décalerait d'un jour selon le fuseau).

const JOUR_MS = 86400000;

export function aujourdhui(date = new Date()) {
  return versIso(date);
}

export function versIso(date) {
  const a = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const j = String(date.getDate()).padStart(2, '0');
  return `${a}-${m}-${j}`;
}

export function depuisIso(iso) {
  const [a, m, j] = iso.split('-').map(Number);
  return new Date(a, m - 1, j, 12); // midi : évite les surprises de changement d'heure
}

export function ajouterJours(iso, n) {
  const d = depuisIso(iso);
  d.setDate(d.getDate() + n);
  return versIso(d);
}

export function ecartJours(isoA, isoB) {
  return Math.round((depuisIso(isoB) - depuisIso(isoA)) / JOUR_MS);
}

// Semaine française : du lundi au dimanche.
export function lundiDe(iso) {
  const d = depuisIso(iso);
  const decalage = (d.getDay() + 6) % 7; // lundi = 0
  return ajouterJours(iso, -decalage);
}

export function joursDeLaSemaine(lundi) {
  return Array.from({ length: 7 }, (_, i) => ajouterJours(lundi, i));
}

const fmtDateLongue = new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
const fmtDateCourte = new Intl.DateTimeFormat('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' });
const fmtDate = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
const fmtJourSemaine = new Intl.DateTimeFormat('fr-FR', { weekday: 'short' });
const fmtJourMois = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short' });

export const dateLongue = iso => (iso ? fmtDateLongue.format(depuisIso(iso)) : '');
export const dateCourte = iso => (iso ? fmtDateCourte.format(depuisIso(iso)) : '');
export const dateFr = iso => (iso ? fmtDate.format(depuisIso(iso)) : '');
export const jourMois = iso => (iso ? fmtJourMois.format(depuisIso(iso)) : '');
export const capitaliser = s => s.charAt(0).toUpperCase() + s.slice(1);
export const jourCourt = iso => fmtJourSemaine.format(depuisIso(iso)).replace('.', '');

export function dateHeureFr(horodatage) {
  if (!horodatage) return '';
  return new Intl.DateTimeFormat('fr-FR', { dateStyle: 'long', timeStyle: 'short' }).format(new Date(horodatage));
}

const fmtNombre1 = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 1 });
const fmtNombre2 = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 2 });

export const nombre = (n, decimales = 1) => (decimales === 2 ? fmtNombre2 : fmtNombre1).format(n);

// Accepte « 12,5 » comme « 12.5 ». Renvoie null si vide ou invalide.
export function lireNombre(texte) {
  if (texte === null || texte === undefined) return null;
  const t = String(texte).replace(/[\s  ]/g, '').replace(',', '.');
  if (t === '') return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

// Durée lisible : « 45 min », « 1 h 05 », « 2 h ».
export function duree(secondes) {
  if (!secondes && secondes !== 0) return '';
  const totalMin = Math.round(secondes / 60);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h === 0) return `${m} min`;
  if (m === 0) return `${h} h`;
  return `${h} h ${String(m).padStart(2, '0')}`;
}

// Chrono : « 42:15 » ou « 1:02:15 ».
export function chrono(secondes) {
  if (!secondes && secondes !== 0) return '';
  const s = Math.round(secondes);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = s % 60;
  const mm = String(m).padStart(h ? 2 : 1, '0');
  const ss = String(r).padStart(2, '0');
  return h ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

export function hmsVersSecondes(h, m, s) {
  const vals = [h, m, s].map(v => lireNombre(v) ?? 0);
  if (vals.some(v => v < 0)) return null;
  const total = vals[0] * 3600 + vals[1] * 60 + vals[2];
  return total > 0 ? Math.round(total) : null;
}

export function secondesVersHms(secondes) {
  if (!secondes) return { h: '', m: '', s: '' };
  const t = Math.round(secondes);
  return { h: Math.floor(t / 3600), m: Math.floor((t % 3600) / 60), s: t % 60 };
}

// Allure « 5:12 » (min:s) à partir d'un nombre de secondes par unité.
export function allureMinSec(secParUnite) {
  const t = Math.round(secParUnite);
  return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`;
}

// Disciplines dont la distance se saisit et s'affiche en mètres (stockée en km comme les autres).
export const DISCIPLINES_EN_METRES = new Set(['natation', 'rameur']);

export function distance(km, discipline) {
  if (!km && km !== 0) return '';
  if (DISCIPLINES_EN_METRES.has(discipline)) return `${Math.round(km * 1000)} m`;
  return `${nombre(km, km < 10 ? 2 : 1)} km`;
}

// Heures : minutes depuis minuit ↔ « 18:30 » (stockage, IA) ; affichage français « 18 h 30 », « 6 h ».
export const minutesVersHeure = m => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
export function heureVersMinutes(texte) {
  const r = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(texte ?? '');
  return r ? Number(r[1]) * 60 + Number(r[2]) : null;
}
export function heureFr(m) {
  if (typeof m === 'string') m = heureVersMinutes(m);
  if (m === null || m === undefined) return '';
  const h = Math.floor(m / 60);
  const mn = m % 60;
  return mn ? `${h} h ${String(mn).padStart(2, '0')}` : `${h} h`;
}
