// Vérifications statiques : manifest, service worker, chemins relatifs, version, absence de secrets.
// node tests/statique.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const RACINE = join(dirname(fileURLToPath(import.meta.url)), '..');
const lire = f => readFileSync(join(RACINE, f), 'utf8');

function fichiers(dossier, ext) {
  return readdirSync(join(RACINE, dossier)).flatMap(n => {
    const chemin = join(dossier, n);
    if (statSync(join(RACINE, chemin)).isDirectory()) return fichiers(chemin, ext);
    return ext.some(e => n.endsWith(e)) ? [chemin] : [];
  });
}

const fichiersApp = ['index.html', 'sw.js', 'manifest.webmanifest', ...fichiers('js', ['.js']), ...fichiers('css', ['.css'])];

test('manifest valide et relatif', () => {
  const m = JSON.parse(lire('manifest.webmanifest'));
  assert.equal(m.start_url, './');
  assert.equal(m.scope, './');
  assert.equal(m.display, 'standalone');
  assert.equal(m.lang, 'fr');
  assert.ok(m.name && m.short_name);
  for (const i of m.icons) {
    assert.ok(!i.src.startsWith('/') && !/^https?:/.test(i.src), `icône non relative : ${i.src}`);
    assert.ok(existsSync(join(RACINE, i.src)), `icône manquante : ${i.src}`);
  }
  assert.ok(m.icons.some(i => i.sizes === '192x192'));
  assert.ok(m.icons.some(i => i.sizes === '512x512' && i.purpose === 'any'));
  assert.ok(m.icons.some(i => i.purpose === 'maskable'));
});

test('service worker : tous les fichiers mis en cache existent, et tous les fichiers de l\'app sont mis en cache', () => {
  const sw = lire('sw.js');
  const liste = JSON.parse(sw.match(/const FICHIERS = (\[[\s\S]*?\]);/)[1].replace(/'/g, '"').replace(/,\s*\]/, ']'));
  for (const f of liste) {
    assert.ok(!f.startsWith('/'), `chemin absolu dans le cache : ${f}`);
    if (f !== './') assert.ok(existsSync(join(RACINE, f)), `fichier absent : ${f}`);
  }
  const attendus = ['index.html', 'manifest.webmanifest', ...fichiers('js', ['.js']), ...fichiers('css', ['.css']), ...fichiers('icons', ['.png', '.svg'])];
  for (const f of attendus) assert.ok(liste.includes(f), `fichier non mis en cache par le service worker : ${f}`);
});

test('version identique dans sw.js et js/version.js', () => {
  const vSw = lire('sw.js').match(/const VERSION = '([^']+)'/)[1];
  const vApp = lire('js/version.js').match(/export const VERSION = '([^']+)'/)[1];
  assert.equal(vSw, vApp);
});

test('aucun chemin absolu (compatibilité GitHub Pages /dossard/)', () => {
  const motifs = [
    /\b(?:href|src)="\/(?!\/)/, // attributs HTML
    /\bregister\(\s*['"]\//, // enregistrement du service worker
    /\bimport\s[^'"]*['"]\//, // imports ES absolus
    /url\(\s*['"]?\//, // CSS
  ];
  for (const f of fichiersApp) {
    const contenu = lire(f);
    for (const m of motifs) assert.ok(!m.test(contenu), `${f} contient un chemin absolu (${m})`);
  }
  // Les imports ES doivent tous être relatifs (./ ou ../).
  for (const f of fichiers('js', ['.js'])) {
    for (const [, cible] of lire(f).matchAll(/^import .* from '([^']+)';$/gm)) {
      assert.ok(cible.startsWith('./') || cible.startsWith('../'), `${f} : import non relatif ${cible}`);
      assert.ok(existsSync(join(RACINE, dirname(f), cible)), `${f} : import introuvable ${cible}`);
    }
  }
});

test('aucune bibliothèque externe ni ressource distante', () => {
  for (const f of fichiersApp) {
    const contenu = lire(f);
    assert.ok(!/<script[^>]+src="https?:/.test(contenu), `${f} charge un script distant`);
    assert.ok(!/<link[^>]+href="https?:/.test(contenu), `${f} charge une feuille distante`);
    assert.ok(!/from 'https?:/.test(contenu), `${f} importe un module distant`);
  }
});

test('aucun secret dans le dépôt', () => {
  const tous = [...fichiersApp, 'CLAUDE.md', ...fichiers('tests', ['.js'])];
  for (const f of tous) {
    const contenu = lire(f);
    assert.ok(!/sk-ant-[A-Za-z0-9_-]{20,}/.test(contenu), `${relative(RACINE, f)} contient ce qui ressemble à une clé API`);
  }
});
