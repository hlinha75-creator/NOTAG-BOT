/**
 * restore-data.js
 * 
 * Use APÓS um git pull que tenha sobrescrito/apagado os dados:
 *   node scripts/restore-data.js
 * 
 * Restaura o backup mais recente de data/backups/pre-deploy/
 * para a pasta data/, recuperando saldos e estado do bot.
 */

const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');
const BACKUP_BASE = path.join(DATA_DIR, 'backups', 'pre-deploy');

function getLatestBackup() {
  if (!fs.existsSync(BACKUP_BASE)) {
    console.error('❌ Nenhum backup pre-deploy encontrado em:', BACKUP_BASE);
    process.exit(1);
  }

  const entries = fs.readdirSync(BACKUP_BASE)
    .filter(e => fs.statSync(path.join(BACKUP_BASE, e)).isDirectory())
    .sort()
    .reverse();

  if (entries.length === 0) {
    console.error('❌ Pasta de backup vazia.');
    process.exit(1);
  }

  return path.join(BACKUP_BASE, entries[0]);
}

function run() {
  const latest = getLatestBackup();
  console.log(`\n🔄 Restaurando backup de: ${path.basename(latest)}\n`);

  const files = fs.readdirSync(latest);
  let restored = 0;

  for (const file of files) {
    const src = path.join(latest, file);
    const dst = path.join(DATA_DIR, file);

    // Não sobrescrever se o destino for mais recente (proteção extra)
    if (fs.existsSync(dst)) {
      const srcMtime = fs.statSync(src).mtimeMs;
      const dstMtime = fs.statSync(dst).mtimeMs;
      if (dstMtime > srcMtime) {
        console.log(`  ⏭️  Pulando ${file} (destino mais recente que o backup)`);
        continue;
      }
    }

    fs.copyFileSync(src, dst);
    const size = (fs.statSync(dst).size / 1024).toFixed(1);
    console.log(`  ✅ Restaurado: ${file} (${size} KB)`);
    restored++;
  }

  console.log(`\n✅ Restauração concluída. ${restored} arquivo(s) restaurado(s).\n`);
  console.log('🚀 Agora inicie o bot normalmente: npm start\n');
}

run();
