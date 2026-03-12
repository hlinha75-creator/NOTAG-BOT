const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');
const { promisify } = require('util');

/**
 * Database Manager - Versão SQLite3 para Replit
 * API idêntica à versão better-sqlite3 para compatibilidade
 */
class DatabaseManager {
 constructor() {
 this.dbPath = path.join(__dirname, '..', 'data', 'database.db');
 this.db = null;
 this.initialized = false;
 this.statements = {};
 }

 async initialize() {
 try {
 const dir = path.dirname(this.dbPath);
 if (!fs.existsSync(dir)) {
 fs.mkdirSync(dir, { recursive: true });
 }

 this.db = new sqlite3.Database(this.dbPath);

 this.db.runAsync = promisify(this.db.run.bind(this.db));
 this.db.getAsync = promisify(this.db.get.bind(this.db));
 this.db.allAsync = promisify(this.db.all.bind(this.db));

 await this.createTables();
 await this.migrateSchema();
 await this.createMissingIndexes(); // ✅ NOVO: Criar índices adicionais
 await this.migrateFromJSON();

 this.initialized = true;
 console.log('[Database] SQLite3 initialized successfully (Replit Mode)');

 setInterval(() => this.cleanup(), 24 * 60 * 60 * 1000);

 } catch (error) {
 console.error('[Database] Failed to initialize:', error);
 throw error;
 }
 }

 async createTables() {
 await this.db.runAsync(`
 CREATE TABLE IF NOT EXISTS users (
 user_id TEXT PRIMARY KEY,
 saldo INTEGER DEFAULT 0,
 total_recebido INTEGER DEFAULT 0,
 total_sacado INTEGER DEFAULT 0,
 emprestimos_pendentes INTEGER DEFAULT 0,
 total_emprestimos INTEGER DEFAULT 0,
 level INTEGER DEFAULT 1,
 xp INTEGER DEFAULT 0,
 total_xp INTEGER DEFAULT 0,
 insignias TEXT DEFAULT '[]',
 eventos_participados INTEGER DEFAULT 0,
 ultimo_login INTEGER,
 streak_diaria INTEGER DEFAULT 0,
 ultimo_checkin INTEGER DEFAULT 0,
 created_at INTEGER DEFAULT (strftime('%s', 'now') * 1000),
 updated_at INTEGER DEFAULT (strftime('%s', 'now') * 1000)
 )
 `);

 await this.db.runAsync(`
 CREATE TABLE IF NOT EXISTS transactions (
 id TEXT PRIMARY KEY,
 type TEXT NOT NULL,
 user_id TEXT NOT NULL,
 amount INTEGER NOT NULL,
 reason TEXT,
 guild_id TEXT,
 event_id TEXT,
 approved_by TEXT,
 approved_at INTEGER,
 created_at INTEGER DEFAULT (strftime('%s', 'now') * 1000)
 )
 `);

 await this.db.runAsync(`
 CREATE TABLE IF NOT EXISTS events (
 event_id TEXT PRIMARY KEY,
 guild_id TEXT NOT NULL,
 creator_id TEXT NOT NULL,
 nome TEXT NOT NULL,
 descricao TEXT,
 tipo TEXT,
 status TEXT DEFAULT 'aguardando',
 valor_total INTEGER,
 taxa_guilda INTEGER,
 participantes TEXT DEFAULT '[]',
 started_at INTEGER,
 ended_at INTEGER,
 created_at INTEGER DEFAULT (strftime('%s', 'now') * 1000)
 )
 `);

 await this.db.runAsync(`
 CREATE TABLE IF NOT EXISTS blacklist (
 user_id TEXT PRIMARY KEY,
 nick TEXT,
 guilda TEXT,
 motivo TEXT,
 added_by TEXT,
 created_at INTEGER DEFAULT (strftime('%s', 'now') * 1000)
 )
 `);

 await this.db.runAsync(`
 CREATE TABLE IF NOT EXISTS audit_logs (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 action_type TEXT NOT NULL,
 user_id TEXT NOT NULL,
 target_id TEXT,
 guild_id TEXT,
 details TEXT,
 created_at INTEGER DEFAULT (strftime('%s', 'now') * 1000)
 )
 `);

 await this.db.runAsync(`
 CREATE TABLE IF NOT EXISTS event_templates (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 guild_id TEXT NOT NULL,
 creator_id TEXT NOT NULL,
 name TEXT NOT NULL,
 description TEXT,
 requirements TEXT,
 default_duration INTEGER,
 recurrence_rule TEXT,
 created_at INTEGER DEFAULT (strftime('%s', 'now') * 1000)
 )
 `);

 await this.db.runAsync(`
 CREATE TABLE IF NOT EXISTS votes (
 vote_id TEXT PRIMARY KEY,
 guild_id TEXT NOT NULL,
 creator_id TEXT NOT NULL,
 title TEXT NOT NULL,
 description TEXT,
 options TEXT NOT NULL,
 votes TEXT DEFAULT '{}',
 ends_at INTEGER NOT NULL,
 status TEXT DEFAULT 'active',
 created_at INTEGER DEFAULT (strftime('%s', 'now') * 1000)
 )
 `);

 await this.db.runAsync(`
 CREATE TABLE IF NOT EXISTS daily_checkins (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 user_id TEXT NOT NULL,
 guild_id TEXT NOT NULL,
 date TEXT NOT NULL,
 reward_xp INTEGER,
 reward_saldo INTEGER,
 streak INTEGER,
 UNIQUE(user_id, date)
 )
 `);

 await this.db.runAsync(`
 CREATE TABLE IF NOT EXISTS guild_config (
 guild_id TEXT PRIMARY KEY,
 idioma TEXT DEFAULT 'PT-BR',
 taxa_guilda INTEGER DEFAULT 10,
 guilda_nome TEXT,
 guilda_server TEXT,
 guilda_registrada_em INTEGER,
 xp_ativo INTEGER DEFAULT 0,
 taxas_bau TEXT DEFAULT '{"royal": 10, "black": 15, "brecilien": 12, "avalon": 20}',
 taxa_emprestimo INTEGER DEFAULT 5,
 updated_at INTEGER DEFAULT (strftime('%s', 'now') * 1000)
 )
 `);

 await this.db.runAsync(`
 CREATE TABLE IF NOT EXISTS event_history (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 event_id TEXT NOT NULL,
 simulation_id TEXT,
 guild_id TEXT NOT NULL,
 arquivado_por TEXT NOT NULL,
 timestamp INTEGER NOT NULL,
 dados TEXT DEFAULT '{}'
 )
 `);

 // Índices originais
 await this.db.runAsync(`CREATE INDEX IF NOT EXISTS idx_transactions_user ON transactions(user_id)`);
 await this.db.runAsync(`CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(created_at)`);
 await this.db.runAsync(`CREATE INDEX IF NOT EXISTS idx_events_guild ON events(guild_id)`);
 await this.db.runAsync(`CREATE INDEX IF NOT EXISTS idx_audit_user ON audit_logs(user_id)`);
 await this.db.runAsync(`CREATE INDEX IF NOT EXISTS idx_guild_config ON guild_config(guild_id)`);
 }

 // ✅ NOVO: Criar índices adicionais para performance do lootsplit
 async createMissingIndexes() {
 try {
 console.log('[Database] Criando índices adicionais...');

 await this.db.runAsync(`CREATE INDEX IF NOT EXISTS idx_transactions_guild ON transactions(guild_id)`);
 await this.db.runAsync(`CREATE INDEX IF NOT EXISTS idx_transactions_reason ON transactions(reason)`);
 await this.db.runAsync(`CREATE INDEX IF NOT EXISTS idx_transactions_guild_reason ON transactions(guild_id, reason)`);

 console.log('[Database] Índices adicionais criados/verificados');
 } catch (error) {
 console.error('[Database] Erro ao criar índices adicionais:', error);
 }
 }

 async migrateSchema() {
 try {
 console.log('[Database] Checking schema migrations...');
 const tableInfo = await this.db.allAsync(`PRAGMA table_info(guild_config)`);
 const existingColumns = tableInfo.map(col => col.name);

 const requiredColumns = {
 'guilda_nome': 'TEXT',
 'guilda_server': 'TEXT',
 'guilda_registrada_em': 'INTEGER',
 'xp_ativo': 'INTEGER DEFAULT 0',
 'taxas_bau': 'TEXT DEFAULT \'{"royal": 10, "black": 15, "brecilien": 12, "avalon": 20}\'',
 'taxa_emprestimo': 'INTEGER DEFAULT 5'
 };

 for (const [columnName, columnType] of Object.entries(requiredColumns)) {
 if (!existingColumns.includes(columnName)) {
 console.log(`[Database] Adding missing column: ${columnName}`);
 try {
 await this.db.runAsync(`ALTER TABLE guild_config ADD COLUMN ${columnName} ${columnType}`);
 console.log(`[Database] Column ${columnName} added successfully`);
 } catch (alterError) {
 console.error(`[Database] Error adding column ${columnName}:`, alterError);
 }
 }
 }
 console.log('[Database] Schema migration completed');
 } catch (error) {
 console.error('[Database] Error during schema migration:', error);
 }
 }

 // ==================== GUILD CONFIG ====================

 async getGuildConfig(guildId) {
 try {
 const row = await this.db.getAsync('SELECT * FROM guild_config WHERE guild_id = ?', [guildId]);

 if (!row) {
 await this.db.runAsync(`
 INSERT INTO guild_config (guild_id, updated_at) VALUES (?, ?)
 `, [guildId, Date.now()]);
 return this.getGuildConfig(guildId);
 }

 return {
 idioma: row.idioma || 'PT-BR',
 taxaGuilda: row.taxa_guilda || 10,
 guildaRegistrada: row.guilda_nome ? {
 nome: row.guilda_nome,
 server: row.guilda_server,
 dataRegistro: row.guilda_registrada_em
 } : null,
 xpAtivo: Boolean(row.xp_ativo),
 taxasBau: JSON.parse(row.taxas_bau || '{"royal": 10, "black": 15, "brecilien": 12, "avalon": 20}'),
 taxaEmprestimo: row.taxa_emprestimo || 5
 };
 } catch (error) {
 console.error('[Database] Error getting guild config:', error);
 return {
 idioma: 'PT-BR',
 taxaGuilda: 10,
 guildaRegistrada: null,
 xpAtivo: false,
 taxasBau: { royal: 10, black: 15, brecilien: 12, avalon: 20 },
 taxaEmprestimo: 5
 };
 }
 }

 async updateGuildConfig(guildId, data) {
 try {
 const fields = [];
 const values = [];

 const fieldMap = {
 idioma: 'idioma',
 taxaGuilda: 'taxa_guilda',
 xpAtivo: 'xp_ativo',
 taxasBau: 'taxas_bau',
 taxaEmprestimo: 'taxa_emprestimo'
 };

 if (data.guildaRegistrada !== undefined) {
 if (data.guildaRegistrada === null) {
 fields.push('guilda_nome = NULL');
 fields.push('guilda_server = NULL');
 fields.push('guilda_registrada_em = NULL');
 } else {
 fields.push('guilda_nome = ?');
 fields.push('guilda_server = ?');
 fields.push('guilda_registrada_em = ?');
 values.push(data.guildaRegistrada.nome);
 values.push(data.guildaRegistrada.server);
 values.push(data.guildaRegistrada.dataRegistro || Date.now());
 }
 }

 for (const [key, value] of Object.entries(data)) {
 if (key === 'guildaRegistrada') continue;
 const dbField = fieldMap[key];
 if (!dbField) continue;

 fields.push(`${dbField} = ?`);
 if (key === 'taxasBau') {
 values.push(JSON.stringify(value));
 } else if (key === 'xpAtivo') {
 values.push(value ? 1 : 0);
 } else {
 values.push(value);
 }
 }

 fields.push('updated_at = ?');
 values.push(Date.now());
 values.push(guildId);

 const sql = `UPDATE guild_config SET ${fields.join(', ')} WHERE guild_id = ?`;
 await this.db.runAsync(sql, values);

 console.log(`[Database] Guild config updated for ${guildId}`);
 } catch (error) {
 console.error('[Database] Error updating guild config:', error);
 throw error;
 }
 }

 // ==================== USERS ====================

 async getUser(userId) {
 const row = await this.db.getAsync('SELECT * FROM users WHERE user_id = ?', [userId]);

 if (!row) {
 await this.db.runAsync(
 'INSERT INTO users (user_id, ultimo_login) VALUES (?, ?)',
 [userId, Date.now()]
 );
 return this.getUser(userId);
 }

 return this.parseUser(row);
 }

 async updateUser(userId, data) {
 const fields = [];
 const values = [];

 Object.entries(data).forEach(([key, value]) => {
 if (key === 'user_id') return;
 fields.push(`${key} = ?`);
 values.push(value);
 });

 values.push(Date.now(), userId);

 const sql = `UPDATE users SET ${fields.join(', ')}, updated_at = ? WHERE user_id = ?`;
 await this.db.runAsync(sql, values);
 }

 parseUser(row) {
 if (!row) return null;
 return {
 userId: row.user_id,
 saldo: row.saldo,
 totalRecebido: row.total_recebido,
 totalSacado: row.total_sacado,
 emprestimosPendentes: row.emprestimos_pendentes,
 totalEmprestimos: row.total_emprestimos,
 level: row.level,
 xp: row.xp,
 totalXp: row.total_xp,
 insignias: JSON.parse(row.insignias || '[]'),
 eventosParticipados: row.eventos_participados,
 streakDiaria: row.streak_diaria,
 ultimoCheckin: row.ultimo_checkin
 };
 }

 // ==================== TRANSACTIONS ====================

 async addTransaction(transaction) {
 const id = transaction.id || `txn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

 // ✅ CORREÇÃO CRÍTICA: Garantir que guildId não seja undefined
 const guildId = transaction.guildId || '';
 if (!guildId) {
 console.warn(`[Database] ⚠️ Transação ${id} sendo salva SEM guildId!`);
 console.warn(`[Database] Dados da transação:`, {
   type: transaction.type,
   userId: transaction.userId,
   amount: transaction.amount,
   reason: transaction.reason
 });
 }

 try {
 await this.db.runAsync(`
   INSERT INTO transactions 
   (id, type, user_id, amount, reason, guild_id, event_id, approved_by, approved_at)
   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
 `, [
   id,
   transaction.type,
   transaction.userId,
   transaction.amount,
   transaction.reason || '',
   guildId, // ✅ Garantido que não é undefined (string vazia se necessário)
   transaction.eventId || '',
   transaction.approvedBy || null,
   transaction.approvedAt || null
 ]);

 console.log(`[Database] ✅ Transação registrada: ${id}, guild: ${guildId || 'N/A'}, amount: ${transaction.amount}, reason: ${transaction.reason}`);

 return true; // ✅ Retornar confirmação de sucesso
 } catch (error) {
 console.error(`[Database] ❌ Erro ao salvar transação ${id}:`, error);
 return false; // ✅ Retornar falha
 }
 }

 async getUserTransactions(userId, limit = 50) {
 return await this.db.allAsync(`
 SELECT * FROM transactions
 WHERE user_id = ?
 ORDER BY created_at DESC
 LIMIT ?
 `, [userId, limit]);
 }

 async getGuildBalance(guildId) {
 const result = await this.db.getAsync(`
 SELECT SUM(amount) as total
 FROM transactions
 WHERE guild_id = ? AND reason = 'taxa_guilda'
 `, [guildId]);
 return result?.total || 0;
 }

 // ==================== SALDO ====================

 async getSaldo(userId) {
 const user = await this.getUser(userId);
 return user?.saldo || 0;
 }

 async addSaldo(userId, amount, reason = 'deposit') {
 const user = await this.getUser(userId);
 const newSaldo = (user?.saldo || 0) + amount;

 await this.updateUser(userId, {
 saldo: newSaldo,
 total_recebido: (user?.totalRecebido || 0) + amount
 });

 await this.addTransaction({
 type: 'credito',
 userId: userId,
 amount: amount,
 reason: reason
 });

 return true;
 }

 async removeSaldo(userId, amount, reason = 'withdraw') {
 const user = await this.getUser(userId);
 const current = user?.saldo || 0;

 if (current < amount) return false;

 await this.updateUser(userId, {
 saldo: current - amount,
 total_sacado: (user?.totalSacado || 0) + amount
 });

 await this.addTransaction({
 type: 'debito',
 userId: userId,
 amount: amount,
 reason: reason
 });

 return true;
 }

 async getUserHistory(userId, limit = 50) {
 return await this.getUserTransactions(userId, limit);
 }

 // ==================== GUILD FINANCE ====================

 async getGuildDetailedStats(guildId) {
 try {
 console.log(`[Database] Buscando stats para guild: ${guildId}`);

 // ✅ Query SQL corrigida e otimizada com índices
 const saldoGeral = await this.db.getAsync(`
   SELECT SUM(saldo) as total FROM users
 `) || { total: 0 };

 const taxas = await this.db.getAsync(`
   SELECT SUM(amount) as total FROM transactions
   WHERE guild_id = ? AND (reason = 'taxa_guilda' OR reason LIKE '%taxa%')
 `, [guildId]) || { total: 0 };

 // ✅ LOG DEBUG: Mostrar exatamente quanto encontrou
 console.log(`[Database] Query taxas executada para guild ${guildId}:`, {
   resultado: taxas,
   total: taxas?.total || 0,
   tipo: typeof taxas?.total
 });

 const emprestimos = await this.db.getAsync(`
   SELECT SUM(emprestimos_pendentes) as total FROM users
 `) || { total: 0 };

 const membrosAtivos = await this.db.getAsync(`
   SELECT COUNT(*) as count FROM users WHERE saldo > 0
 `) || { count: 0 };

 const result = {
   saldoGeral: saldoGeral.total || 0,
   arrecadacaoTaxas: taxas.total || 0,
   emprestimosPendentes: emprestimos.total || 0,
   saldoLiquido: (saldoGeral.total || 0) - (emprestimos.total || 0),
   membrosAtivos: membrosAtivos.count || 0
 };

 console.log(`[Database] Stats calculados para guild ${guildId}:`, result);
 return result;
 } catch (error) {
 console.error('[Database] Error getting guild stats:', error);
 return {
   saldoGeral: 0,
   arrecadacaoTaxas: 0,
   emprestimosPendentes: 0,
   saldoLiquido: 0,
   membrosAtivos: 0
 };
 }
 }

 // ==================== EVENT STATS ====================

 async getEventParticipationStats(guildId, periodDays = 30, roleFilter = null) {
 try {
 const since = Date.now() - (periodDays * 24 * 60 * 60 * 1000);

 const events = await this.db.allAsync(`
 SELECT * FROM events
 WHERE guild_id = ? AND created_at > ?
 `, [guildId, since]);

 const stats = new Map();

 for (const event of events) {
 let participantes = [];
 try {
 participantes = JSON.parse(event.participantes || '[]');
 if (!Array.isArray(participantes)) participantes = [];
 } catch (e) {
 participantes = [];
 }

 for (const [userId, data] of participantes) {
 if (!stats.has(userId)) {
 stats.set(userId, {
 userId: userId,
 totalEvents: 0,
 totalLoot: 0,
 categories: new Set()
 });
 }

 const userStat = stats.get(userId);
 userStat.totalEvents++;
 userStat.totalLoot += data?.valor || 0;
 userStat.categories.add(event.tipo || 'normal');
 }
 }

 return Array.from(stats.values())
 .sort((a, b) => b.totalEvents - a.totalEvents);

 } catch (error) {
 console.error('[Database] Error getting event stats:', error);
 return [];
 }
 }

 async getEventsByPeriod(guildId, days) {
 try {
 const since = days === 0 ? 0 : Date.now() - (days * 24 * 60 * 60 * 1000);

 const events = await this.db.allAsync(`
 SELECT * FROM events
 WHERE guild_id = ? AND created_at > ?
 ORDER BY created_at DESC
 `, [guildId, since]);

 return events;
 } catch (error) {
 console.error('[Database] Error getting events by period:', error);
 return [];
 }
 }

 // ==================== EVENT HISTORY (FUNÇÕES ADICIONADAS) ====================

 async addEventHistory(historyData) {
 try {
 await this.db.runAsync(`
 INSERT INTO event_history (event_id, simulation_id, guild_id, arquivado_por, timestamp, dados)
 VALUES (?, ?, ?, ?, ?, ?)
 `, [
 historyData.eventId,
 historyData.simulationId,
 historyData.guildId,
 historyData.arquivadoPor,
 historyData.timestamp,
 JSON.stringify(historyData.dados || {})
 ]);
 console.log(`[Database] Event history added for ${historyData.eventId}`);
 } catch (error) {
 console.error('[Database] Error adding event history:', error);
 throw error;
 }
 }

 async getEventHistory(guildId, limit = 50) {
 try {
 const rows = await this.db.allAsync(`
 SELECT * FROM event_history
 WHERE guild_id = ?
 ORDER BY timestamp DESC
 LIMIT ?
 `, [guildId, limit]);

 return rows.map(row => ({
 ...row,
 dados: JSON.parse(row.dados || '{}')
 }));
 } catch (error) {
 console.error('[Database] Error getting event history:', error);
 return [];
 }
 }

 // ==================== AUDIT ====================

 async logAudit(actionType, userId, details = {}, guildId = null, targetId = null) {
 await this.db.runAsync(`
 INSERT INTO audit_logs (action_type, user_id, target_id, guild_id, details)
 VALUES (?, ?, ?, ?, ?)
 `, [
 actionType,
 userId,
 targetId,
 guildId,
 JSON.stringify(details)
 ]);
 }

 async getAuditLogs(filters = {}, limit = 100) {
 let query = 'SELECT * FROM audit_logs WHERE 1=1';
 const params = [];

 if (filters.userId) {
 query += ' AND user_id = ?';
 params.push(filters.userId);
 }
 if (filters.guildId) {
 query += ' AND guild_id = ?';
 params.push(filters.guildId);
 }
 if (filters.actionType) {
 query += ' AND action_type = ?';
 params.push(filters.actionType);
 }

 query += ' ORDER BY created_at DESC LIMIT ?';
 params.push(limit);

 const rows = await this.db.allAsync(query, params);
 return rows.map(row => ({
 ...row,
 details: JSON.parse(row.details || '{}')
 }));
 }

 // ==================== EVENTS ====================

 async saveEvent(eventData) {
 await this.db.runAsync(`
 INSERT OR REPLACE INTO events
 (event_id, guild_id, creator_id, nome, descricao, tipo, status, valor_total, taxa_guilda, participantes, started_at, ended_at)
 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
 `, [
 eventData.id,
 eventData.guildId,
 eventData.criadorId,
 eventData.nome,
 eventData.descricao || '',
 eventData.tipo || 'normal',
 eventData.status,
 eventData.valorTotal || 0,
 eventData.taxaGuilda || 10,
 JSON.stringify(Array.from(eventData.participantes?.entries() || [])),
 eventData.inicioTimestamp,
 eventData.finalizadoEm
 ]);
 }

 async getEventHistoryTable(guildId, limit = 50) {
 return await this.db.allAsync(`
 SELECT * FROM events
 WHERE guild_id = ?
 ORDER BY created_at DESC
 LIMIT ?
 `, [guildId, limit]);
 }

 // ==================== DAILY CHECKINS ====================

 async recordCheckin(userId, guildId, rewards) {
 const today = new Date().toISOString().split('T')[0];

 await this.db.runAsync(`
 INSERT INTO daily_checkins (user_id, guild_id, date, reward_xp, reward_saldo, streak)
 VALUES (?, ?, ?, ?, ?, ?)
 ON CONFLICT(user_id, date) DO UPDATE SET
 reward_xp = excluded.reward_xp,
 reward_saldo = excluded.reward_saldo
 `, [userId, guildId, today, rewards.xp, rewards.saldo, rewards.streak]);

 await this.updateUser(userId, {
 streak_diaria: rewards.streak,
 ultimo_checkin: Date.now()
 });

 return rewards;
 }

 async getTodayCheckin(userId) {
 const today = new Date().toISOString().split('T')[0];
 return await this.db.getAsync(`
 SELECT * FROM daily_checkins
 WHERE user_id = ? AND date = ?
 `, [userId, today]);
 }

 // ==================== TEMPLATES ====================

 async saveTemplate(guildId, creatorId, template) {
 const result = await this.db.runAsync(`
 INSERT INTO event_templates (guild_id, creator_id, name, description, requirements, default_duration, recurrence_rule)
 VALUES (?, ?, ?, ?, ?, ?, ?)
 `, [
 guildId,
 creatorId,
 template.name,
 template.description,
 template.requirements,
 template.duration,
 JSON.stringify(template.recurrence || {})
 ]);

 return result.lastID;
 }

 async getTemplates(guildId) {
 const rows = await this.db.allAsync(`
 SELECT * FROM event_templates
 WHERE guild_id = ?
 ORDER BY created_at DESC
 `, [guildId]);

 return rows.map(t => ({
 ...t,
 recurrenceRule: JSON.parse(t.recurrence_rule || '{}')
 }));
 }

 // ==================== VOTES ====================

 async createVote(voteData) {
 await this.db.runAsync(`
 INSERT INTO votes (vote_id, guild_id, creator_id, title, description, options, ends_at)
 VALUES (?, ?, ?, ?, ?, ?, ?)
 `, [
 voteData.id,
 voteData.guildId,
 voteData.creatorId,
 voteData.title,
 voteData.description,
 JSON.stringify(voteData.options),
 voteData.endsAt
 ]);
 }

 async getVote(voteId) {
 const row = await this.db.getAsync('SELECT * FROM votes WHERE vote_id = ?', [voteId]);
 if (row) {
 row.options = JSON.parse(row.options);
 row.votes = JSON.parse(row.votes);
 }
 return row;
 }

 async castVote(voteId, userId, optionIndex) {
 const vote = await this.getVote(voteId);
 if (!vote || vote.status !== 'active') return false;
 if (Date.now() > vote.ends_at) return false;

 const votes = JSON.parse(vote.votes);
 if (votes[userId] !== undefined) return false;

 votes[userId] = optionIndex;

 await this.db.runAsync('UPDATE votes SET votes = ? WHERE vote_id = ?',
 [JSON.stringify(votes), voteId]);
 return true;
 }

 // ==================== CLEANUP & MIGRATION ====================

 async cleanup() {
 console.log('[Database] Running cleanup...');
 const ninetyDaysAgo = Date.now() - (90 * 24 * 60 * 60 * 1000);
 await this.db.runAsync('DELETE FROM events WHERE ended_at < ?', [ninetyDaysAgo]);
 }

 async migrateFromJSON() {
 const fs = require('fs');
 const path = require('path');
 const dataDir = path.join(__dirname, '..', 'data');

 const blacklistPath = path.join(dataDir, 'blacklist.json');
 if (fs.existsSync(blacklistPath)) {
 try {
 const data = JSON.parse(fs.readFileSync(blacklistPath, 'utf8'));

 for (const [userId, entry] of Object.entries(data)) {
 await this.db.runAsync(`
 INSERT OR IGNORE INTO blacklist (user_id, nick, guilda, motivo, added_by)
 VALUES (?, ?, ?, ?, ?)
 `, [userId, entry.nick, entry.guilda, entry.motivo || '', entry.adicionadoPor || '']);
 }
 console.log('[Database] Migrated blacklist from JSON');
 } catch (e) {
 console.error('[Database] Failed to migrate blacklist:', e);
 }
 }
 }

 close() {
 if (this.db) {
 this.db.close();
 console.log('[Database] Connection closed');
 }
 }
}

module.exports = new DatabaseManager();