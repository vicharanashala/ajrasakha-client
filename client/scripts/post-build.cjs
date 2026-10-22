const fs = require('fs-extra');

async function postBuild() {
  try {
    await fs.copy('public/assets', 'dist/assets');
    await fs.copy('public/robots.txt', 'dist/robots.txt');
    await fs.copy('public/sw.js', 'dist/sw.js');
    await fs.copy('public/manifest.json', 'dist/manifest.json');
    console.log('✅ PWA icons, manifest.json, robots.txt and sw.js copied successfully. Glob pattern warnings resolved.');
  } catch (err) {
    console.error('❌ Error copying files:', err);
    process.exit(1);
  }
}

postBuild();
