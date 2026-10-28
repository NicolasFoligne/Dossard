// Génère les icônes PNG à partir de icons/icone.svg (Chromium via Playwright).
// Usage : node outils/generer-icones.cjs icons
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const dir = process.argv[2];
const svg = fs.readFileSync(path.join(dir, 'icone.svg'), 'utf8');
// Variante pleine (maskable / Apple) : fond plein, contenu réduit dans la zone sûre.
const plein = svg.replace('<rect width="512" height="512" rx="112" fill="#e8590c"/>', '<rect width="512" height="512" fill="#e8590c"/><g transform="translate(51.2 51.2) scale(0.8)">').replace('</svg>', '</g></svg>');
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage();
  const rendu = async (src, taille, fichier) => {
    await p.setViewportSize({ width: taille, height: taille });
    await p.setContent(`<html><body style="margin:0;background:transparent">${src.replace('<svg ', `<svg width="${taille}" height="${taille}" `)}</body></html>`);
    await p.screenshot({ path: path.join(dir, fichier), omitBackground: true });
  };
  await rendu(svg, 192, 'icone-192.png');
  await rendu(svg, 512, 'icone-512.png');
  await rendu(plein, 512, 'icone-maskable-512.png');
  await rendu(plein, 180, 'apple-touch-icon.png');
  await b.close();
})();
