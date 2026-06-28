const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'manifest.json'), 'utf8'));

const requiredFiles = [
  manifest.action.default_popup,
  manifest.options_page,
  ...Object.values(manifest.icons || {})
];

for (const file of requiredFiles) {
  const fullPath = path.join(root, file);
  if (!fs.existsSync(fullPath)) {
    throw new Error(`Missing file referenced by manifest: ${file}`);
  }
}

for (const file of [
  'src/browser-api.js',
  'src/default-config.js',
  'src/shared.js',
  'src/popup.js',
  'src/options.js'
]) {
  new Function(fs.readFileSync(path.join(root, file), 'utf8'));
}

console.log('Extension manifest and scripts look valid.');
