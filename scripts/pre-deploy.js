/**
 * pre-deploy.js
 * 
 * Execute ANTES de qualquer git pull ou deploy:
 *   node scripts/pre-deploy.js
 * 
 * O script faz backup do database.db e dos JSONs críticos
 * para data/backups/pre-deploy/ com timestamp, garantindo
 * que nenhum dado seja perdido durante atualizações de código.
 */

const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');
const BACKUP_DIR = path.join(DATA_DIR, 'backups', 'pre-deploy');

// Arquivos críticos a preservar
const CRITICAL_FILES = [
  'database.db',
  'active_events.json',
  'finished_events.json',
  'simulations.json',
  'pending_finance.json',
  'blacklist.json',
  'historico.json',
  'killboard_config.json',
  'active_raids.json',
  'items_cache.json',
];

function run() {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupTarget = path.join(BACKUP_DIR, timestamp);

  if (!fs.existsSync(backupTarget)) {
    fs.mkdirSync(backupTarget, { recursive: true });
  }

  let backed = 0;
  let missing = 0;

  for (const file of CRITICAL_FILES) {
    const src = path.join(DATA_DIR, file);
    const dst = path.join(backupTarget, file);

    if (fs.existsSync(src)) {
      fs.copyFileSync(src, dst);
      const size = (fs.statSync(dst).size / 1024).toFixed(1);
      console.log(`  ✅ Backup: ${file} (${size} KB)`);
      backed++;
    } else {
      console.log(`  ⚠️  Não encontrado: ${file}`);
      missing++;
    }
  }

  console.log(`\n📦 Backup concluído em: ${backupTarget}`);
  console.log(`   ${backed} arquivo(s) copiado(s), ${missing} ausente(s)`);
  console.log('\n✅ Agora é seguro executar git pull / deploy.\n');
}

run();
