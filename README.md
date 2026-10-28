# Dossard

Application mobile personnelle (PWA) de préparation sportive multi-objectifs : course à pied et triathlon.

- HTML, CSS et JavaScript natifs, sans dépendance ni compilation.
- Données stockées uniquement sur le téléphone (IndexedDB), export/import JSON.
- Hébergée sur GitHub Pages sous `/dossard/`, installable et utilisable hors ligne.

Le cahier des charges et les conventions du projet sont dans [CLAUDE.md](CLAUDE.md).

## Tests

```sh
node tests/regles.test.js     # règles métier
node tests/statique.test.js   # manifest, service worker, chemins relatifs
node tests/e2e.cjs            # parcours complet dans Chromium (nécessite Playwright)
```
