const defaultProduits = require('../src/lib/defaultProduits.json');

function validate() {
  if (!Array.isArray(defaultProduits)) {
    console.error('defaultProduits is not an array');
    process.exit(1);
  }
  if (defaultProduits.length !== 5) {
    console.error(`expected 5 products, found ${defaultProduits.length}`);
    process.exit(1);
  }
  for (const [i, p] of defaultProduits.entries()) {
    if (!p.id || !p.nom || !p.modele) {
      console.error(`product at index ${i} is missing required fields`, p);
      process.exit(1);
    }
  }
  console.log('defaultProduits validation passed — 5 products present.');
  console.table(defaultProduits.map(p => ({ id: p.id, nom: p.nom, modele: p.modele, tarif24h: p.tarification?.tarif24hFcfa })));
}

validate();
