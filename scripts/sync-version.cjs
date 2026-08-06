const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');
const packageJsonPath = path.join(rootDir, 'package.json');
const tauriConfPath = path.join(rootDir, 'src-tauri', 'tauri.conf.json');
const cargoTomlPath = path.join(rootDir, 'src-tauri', 'Cargo.toml');
const shellCargoTomlPath = path.join(rootDir, 'src-tauri', 'shell_ext_crate', 'Cargo.toml');

if (!fs.existsSync(packageJsonPath)) {
  console.error('Error: package.json not found at:', packageJsonPath);
  process.exit(1);
}

const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
const version = packageJson.version;

console.log(`[Version Sync] Propagating Single Source of Truth version: v${version}...`);

// 1. Update src-tauri/tauri.conf.json
if (fs.existsSync(tauriConfPath)) {
  const tauriConf = JSON.parse(fs.readFileSync(tauriConfPath, 'utf8'));
  tauriConf.version = version;
  if (tauriConf.app && tauriConf.app.windows && tauriConf.app.windows[0]) {
    tauriConf.app.windows[0].title = `ALITKEN v${version}`;
  }
  fs.writeFileSync(tauriConfPath, JSON.stringify(tauriConf, null, 2) + '\n');
  console.log(`  ✓ Updated src-tauri/tauri.conf.json → v${version}`);
}

// 2. Update src-tauri/Cargo.toml
if (fs.existsSync(cargoTomlPath)) {
  let content = fs.readFileSync(cargoTomlPath, 'utf8');
  content = content.replace(/^version\s*=\s*"[^"]+"/m, `version = "${version}"`);
  fs.writeFileSync(cargoTomlPath, content);
  console.log(`  ✓ Updated src-tauri/Cargo.toml → v${version}`);
}

// 3. Update src-tauri/shell_ext_crate/Cargo.toml
if (fs.existsSync(shellCargoTomlPath)) {
  let content = fs.readFileSync(shellCargoTomlPath, 'utf8');
  content = content.replace(/^version\s*=\s*"[^"]+"/m, `version = "${version}"`);
  fs.writeFileSync(shellCargoTomlPath, content);
  console.log(`  ✓ Updated src-tauri/shell_ext_crate/Cargo.toml → v${version}`);
}

console.log(`\n🎉 Single Source of Truth version sync complete! All targets updated to v${version}.\n`);
