const {
 Client,
 GatewayIntentBits,
 Collection,
 REST,
 Routes,
 Events,
 PermissionFlagsBits,
 EmbedBuilder,
 ChannelType,
 ModalBuilder,
 TextInputBuilder,
 TextInputStyle,
 ActionRowBuilder
} = require('discord.js');
const fs = require('fs');
require('dotenv').config();

// ==================== GOOGLE DRIVE BACKUP ====================
const { google } = require('googleapis');

class GoogleDriveBackup {
 constructor() {
 this.auth = null;
 this.drive = null;
 this.backupFolderId = process.env.GOOGLE_DRIVE_FOLDER_ID || null;
 this.initialized = false;
 }

 async initialize() {
 try {
 if (!process.env.GOOGLE_CLIENT_EMAIL || !process.env.GOOGLE_PRIVATE_KEY) {
 console.log('⚠️ Credenciais do Google Drive não configuradas. Backup automático desabilitado.');
 return false;
 }

 const credentials = {
 type: 'service_account',
 project_id: process.env.GOOGLE_PROJECT_ID || 'notag-bot-backup',
 private_key_id: process.env.GOOGLE_PRIVATE_KEY_ID || '',
 private_key: process.env.GOOGLE_PRIVATE_KEY.replace(/\n/g, '\n'),
 client_email: process.env.GOOGLE_CLIENT_EMAIL,
 client_id: process.env.GOOGLE_CLIENT_ID || '',
 auth_uri: 'https://accounts.google.com/o/oauth2/auth',
 token_uri: 'https://oauth2.googleapis.com/token',
 auth_provider_x509_cert_url: 'https://www.googleapis.com/oauth2/v1/certs',
 client_x509_cert_url: `https://www.googleapis.com/robot/v1/metadata/x509/${encodeURIComponent(process.env.GOOGLE_CLIENT_EMAIL)}`
 };

 this.auth = new google.auth.GoogleAuth({
 credentials: credentials,
 scopes: ['https://www.googleapis.com/auth/drive']
 });

 this.drive = google.drive({ version: 'v3', auth: this.auth });

 if (!this.backupFolderId) {
 await this.createBackupFolder();
 }

 this.initialized = true;
 console.log('✅ Google Drive Backup inicializado com sucesso!');
 return true;
 } catch (error) {
 console.error('❌ Erro ao inicializar Google Drive Backup:', error.message);
 return false;
 }
 }

 async createBackupFolder() {
 try {
 const folderMetadata = {
 name: 'NOTAG-BOT-Backups',
 mimeType: 'application/vnd.google-apps.folder',
 parents: ['root']
 };

 const response = await this.drive.files.create({
 requestBody: folderMetadata,
 fields: 'id'
 });

 this.backupFolderId = response.data.id;
 console.log(`📁 Pasta de backup criada no Google Drive: ${this.backupFolderId}`);
 } catch (error) {
 console.error('❌ Erro ao criar pasta de backup:', error.message);
 }
 }

 async performBackup(manual = false) {
 if (!this.initialized) {
 console.log('⚠️ Backup solicitado mas Google Drive não está configurado.');
 return { success: false, error: 'Google Drive não configurado' };
 }

 const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
 const backupResults = [];

 try {
 console.log(`\n🔄 Iniciando backup ${manual ? 'manual' : 'automático'}...`);

 const filesToBackup = [
 { name: 'database.db', path: './data/database.db' },
 { name: 'blacklist.json', path: './data/blacklist.json' },
 { name: 'historico.json', path: './data/historico.json' },
 { name: 'killboard_config.json', path: './data/killboard_config.json' }
 ];

 for (const file of filesToBackup) {
 if (!fs.existsSync(file.path)) {
 console.log(`⚠️ Arquivo não encontrado: ${file.path}`);
 continue;
 }

 try {
 const fileMetadata = {
 name: `${timestamp}_${file.name}`,
 parents: [this.backupFolderId],
 description: `Backup automático NOTAG-BOT - ${file.name} - ${new Date().toLocaleString()}`
 };

 const media = {
 mimeType: file.name.endsWith('.json') ? 'application/json' : 'application/x-sqlite3',
 body: fs.createReadStream(file.path)
 };

 const response = await this.drive.files.create({
 requestBody: fileMetadata,
 media: media,
 fields: 'id, name'
 });

 backupResults.push({
 file: file.name,
 success: true,
 id: response.data.id,
 timestamp: timestamp
 });

 console.log(`✅ Backup realizado: ${file.name}`);
 } catch (fileError) {
 console.error(`❌ Erro ao fazer backup de ${file.name}:`, fileError.message);
 backupResults.push({
 file: file.name,
 success: false,
 error: fileError.message
 });
 }
 }

 await this.cleanupOldBackups();
 console.log(`✅ Backup ${manual ? 'manual' : 'automático'} concluído!`);
 return { success: true, results: backupResults, timestamp, folderId: this.backupFolderId };

 } catch (error) {
 console.error('❌ Erro durante o backup:', error.message);
 return { success: false, error: error.message };
 }
 }

 async cleanupOldBackups() {
 try {
 const response = await this.drive.files.list({
 q: `'${this.backupFolderId}' in parents and trashed=false`,
 orderBy: 'createdTime desc',
 fields: 'files(id, name, createdTime)'
 });

 const files = response.data.files;
 if (files.length > 40) {
 const filesToDelete = files.slice(40);
 for (const file of filesToDelete) {
 await this.drive.files.delete({ fileId: file.id });
 console.log(`🗑️ Backup antigo removido: ${file.name}`);
 }
 }
 } catch (error) {
 console.error('⚠️ Erro ao limpar backups antigos:', error.message);
 }
 }

 async listBackups() {
 if (!this.initialized) return { success: false, error: 'Não configurado' };
 try {
 const response = await this.drive.files.list({
 q: `'${this.backupFolderId}' in parents and trashed=false`,
 orderBy: 'createdTime desc',
 pageSize: 20,
 fields: 'files(id, name, createdTime, size)'
 });
 return { success: true, backups: response.data.files };
 } catch (error) {
 return { success: false, error: error.message };
 }
 }
}

const driveBackup = new GoogleDriveBackup();

// ==================== IMPORTAR HANDLERS ====================
const RegistrationModal = require('./handlers/registrationModal');
const RegistrationActions = require('./handlers/registrationActions');
const ConfigActions = require('./handlers/configActions');
const GuildMemberRemoveHandler = require('./handlers/guildMemberRemove');
const EventPanel = require('./handlers/eventPanel');
const EventHandler = require('./handlers/eventHandler');
const LootSplitHandler = require('./handlers/lootSplitHandler');
const Database = require('./utils/database');
const DepositHandler = require('./handlers/depositHandler');
const FinanceHandler = require('./handlers/financeHandler');
const ConsultarSaldoHandler = require('./handlers/consultarSaldoHandler');
const PerfilHandler = require('./handlers/perfilHandler');
const OrbHandler = require('./handlers/orbHandler');
const XpHandler = require('./handlers/xpHandler');
const XpEventHandler = require('./handlers/xpEventHandler');
const RaidAvalonHandler = require('./handlers/raidAvalonHandler');
const KillboardHandler = require('./handlers/killboardHandler');
const MarketHandler = require('./handlers/marketHandler');
const MarketApi = require('./handlers/albionMarketApi');
const BalancePanelHandler = require('./handlers/balancePanelHandler');
const AdminPanelHandler = require('./handlers/adminPanelHandler');

// ==================== IMPORTAR COMANDOS ====================
const instalarCommand = require('./commands/instalar');
const desistalarCommand = require('./commands/desistalar');
const atualizarCommand = require('./commands/atualizar');
const limparEventosCommand = require('./commands/limpar-eventos');
const limparSaldoCommand = require('./commands/limpar-saldo');
const limparXpCommand = require('./commands/limpar-xp');
const ajudaCommand = require('./commands/ajuda');
const killboardCommand = require('./commands/killboard');
const saldosCommand = require('./commands/saldos');

// Criar cliente
const client = new Client({
 intents: [
 GatewayIntentBits.Guilds,
 GatewayIntentBits.GuildMembers,
 GatewayIntentBits.GuildMessages,
 GatewayIntentBits.GuildVoiceStates,
 GatewayIntentBits.MessageContent,
 GatewayIntentBits.DirectMessages,
 GatewayIntentBits.GuildPresences
 ],
 partials: ['CHANNEL']
});

// Coleção de comandos
client.commands = new Collection();

// Registrar comandos na coleção
client.commands.set(instalarCommand.data.name, instalarCommand);
client.commands.set(desistalarCommand.data.name, desistalarCommand);
client.commands.set(atualizarCommand.data.name, atualizarCommand);
client.commands.set(limparEventosCommand.data.name, limparEventosCommand);
client.commands.set(limparSaldoCommand.data.name, limparSaldoCommand);
client.commands.set(limparXpCommand.data.name, limparXpCommand);
client.commands.set(ajudaCommand.data.name, ajudaCommand);
client.commands.set(killboardCommand.data.name, killboardCommand);
client.commands.set(saldosCommand.data.name, saldosCommand);

// ==================== INICIALIZAR VARIÁVEIS GLOBAIS ====================
global.registrosPendentes = new Map();
global.registroTemp = new Map();
global.guildConfig = new Map();
global.blacklist = new Map();
global.historicoRegistros = new Map();
global.activeEvents = new Map();
global.finishedEvents = new Map();
global.simulations = new Map();
global.pendingWithdrawals = new Map();
global.pendingLoans = new Map();
global.pendingLoanPayments = new Map();
global.pendingTransfers = new Map();
global.pendingOrbDeposits = new Map();
global.activeXpEvents = new Map();
global.activeRaids = new Map();
global.raidTemp = new Map();
global.orbTemp = new Map();
global.guildaRegistroTemp = new Map();
global.pendingBauSales = new Map();
global.client = client;
global.xpDepositTemp = new Map();
global.killboardProcessedEvents = new Map();
global.marketSearches = new Map();
global.depositTemp = new Map();
global.driveBackup = driveBackup; // 💾 BACKUP GLOBAL

// ✅ CORREÇÃO CRÍTICA: Sistema Global de Deduplicação de Interações
// Previne processamento duplicado de comandos/botões/modais
const processedInteractions = new Set();
const PROCESSING_TIMEOUT = 10 * 60 * 1000; // 10 minutos

function isInteractionProcessed(interactionId) {
 if (processedInteractions.has(interactionId)) {
 return true;
 }

 processedInteractions.add(interactionId);

 // Limpeza automática após timeout para evitar memory leak
 setTimeout(() => {
 processedInteractions.delete(interactionId);
 }, PROCESSING_TIMEOUT);

 return false;
}

// ✅ CORREÇÃO CRÍTICA: Sistema de Lock por Usuário+Comando
// Previne que o mesmo usuário execute o mesmo comando simultaneamente (race condition)
const userCommandLocks = new Map();
const LOCK_TIMEOUT = 30 * 1000; // 30 segundos de timeout para locks

function getLockKey(userId, commandKey) {
 return `${userId}_${commandKey}`;
}

function acquireLock(userId, commandKey) {
 const lockKey = getLockKey(userId, commandKey);

 if (userCommandLocks.has(lockKey)) {
 return false; // Já está lockado
 }

 userCommandLocks.set(lockKey, Date.now());

 // Auto-release após timeout de segurança
 setTimeout(() => {
 userCommandLocks.delete(lockKey);
 }, LOCK_TIMEOUT);

 return true;
}

function releaseLock(userId, commandKey) {
 const lockKey = getLockKey(userId, commandKey);
 userCommandLocks.delete(lockKey);
}

function getCommandKey(interaction) {
 // Gera uma chave única baseada no tipo de interação
 if (interaction.isChatInputCommand()) {
 return `cmd_${interaction.commandName}`;
 }
 if (interaction.isButton()) {
 // Agrupa botões relacionados (ex: consultar_saldo, sacar_saldo -> operacao_saldo)
 const customId = interaction.customId;
 if (customId === 'btn_consultar_saldo') return 'btn_consultar_saldo';
 if (customId === 'btn_sacar_saldo') return 'btn_sacar_saldo';
 if (customId === 'btn_solicitar_emprestimo') return 'btn_solicitar_emprestimo';
 if (customId === 'btn_transferir_saldo') return 'btn_transferir_saldo';
 if (customId === 'btn_quitar_emprestimo') return 'btn_quitar_emprestimo';
 if (customId.startsWith('fin_confirmar_saque_')) return 'fin_confirmar_saque';
 if (customId.startsWith('fin_recusar_saque_')) return 'fin_recusar_saque';
 if (customId.startsWith('dep_')) return 'dep_action';
 if (customId.startsWith('orb_')) return 'orb_action';
 return `btn_${customId.split('_')[0]}`;
 }
 if (interaction.isModalSubmit()) {
 const customId = interaction.customId;
 if (customId === 'modal_sacar_saldo') return 'modal_sacar_saldo';
 if (customId === 'modal_solicitar_emprestimo') return 'modal_solicitar_emprestimo';
 if (customId === 'modal_quitar_emprestimo') return 'modal_quitar_emprestimo';
 if (customId === 'modal_transferir_saldo') return 'modal_transferir_saldo';
 if (customId === 'modal_deposito_valor') return 'modal_deposito_valor';
 return `modal_${customId.split('_')[0]}`;
 }
 if (interaction.isStringSelectMenu()) {
 return `select_${interaction.customId.split('_')[0]}`;
 }
 if (interaction.isUserSelectMenu()) {
 return `userselect_${interaction.customId}`;
 }
 return `generic_${interaction.type}`;
}

// Carregar dados persistidos (blacklist e histórico)
try {
 if (!fs.existsSync('./data')) {
 fs.mkdirSync('./data', { recursive: true });
 }

 if (fs.existsSync('./data/blacklist.json')) {
 const blacklistData = JSON.parse(fs.readFileSync('./data/blacklist.json', 'utf8'));
 global.blacklist = new Map(blacklistData);
 console.log(`📋 Blacklist carregada: ${global.blacklist.size} jogadores banidos`);
 }

 if (fs.existsSync('./data/historico.json')) {
 const historicoData = JSON.parse(fs.readFileSync('./data/historico.json', 'utf8'));
 global.historicoRegistros = new Map(historicoData);
 console.log(`📜 Histórico carregado: ${global.historicoRegistros.size} usuários com histórico`);
 }

 if (fs.existsSync('./data/killboard_config.json')) {
 const killboardData = JSON.parse(fs.readFileSync('./data/killboard_config.json', 'utf8'));
 for (const [guildId, config] of killboardData) {
 const currentConfig = global.guildConfig.get(guildId) || {};
 global.guildConfig.set(guildId, { ...currentConfig, killboard: config });
 }
 console.log(`💀 Configurações do Killboard carregadas`);
 }
} catch (error) {
 console.error('❌ Erro ao carregar dados persistidos:', error);
}

// ==================== EVENTO READY ====================
client.once(Events.ClientReady, async () => {
 console.log(`✅ Bot logado como ${client.user.tag}`);
 console.log(`🤖 ID do Bot: ${client.user.id}`);
 console.log(`📅 Data de início: ${new Date().toLocaleString()}`);

 // Inicializar sistemas
 await Database.initialize();
 RegistrationActions.initialize();
 EventHandler.initialize();
 LootSplitHandler.loadSimulations();
 FinanceHandler.loadPendingFinance();
 console.log('📝 Sistemas inicializados: Database + Registro + Eventos');

 // Criar canal do painel administrativo em todas as guilds configuradas
 for (const guild of client.guilds.cache.values()) {
 try {
 await AdminPanelHandler.setupChannel(guild);
 } catch (err) {
 console.error(`❌ Erro ao configurar painel admin na guild ${guild.name}:`, err.message);
 }
 }

 // 💾 INICIALIZAR BACKUP DO GOOGLE DRIVE
 await driveBackup.initialize();

 // Agendar backup automático diário (às 3:00 AM)
 if (driveBackup.initialized) {
 const now = new Date();
 const nextBackup = new Date(now);
 nextBackup.setDate(nextBackup.getDate() + 1);
 nextBackup.setHours(3, 0, 0, 0);
 const msUntilNextBackup = nextBackup - now;

 setTimeout(() => {
 driveBackup.performBackup(false);
 setInterval(() => driveBackup.performBackup(false), 24 * 60 * 60 * 1000);
 }, msUntilNextBackup);

 console.log(`⏰ Backup automático agendado para: ${nextBackup.toLocaleString()}`);
 }

 // 🛒 NOVO: Inicializar cache de itens do mercado
 try {
 console.log('🛒 Inicializando sistema de mercado...');
 await MarketApi.loadItemsCache();
 } catch (error) {
 console.error('❌ Erro ao inicializar cache de mercado:', error);
 }

 try {
 let killboardsIniciados = 0;
 for (const [guildId, config] of global.guildConfig.entries()) {
 if (config.killboard?.enabled && config.killboard?.guildIdAlbion) {
 const guild = client.guilds.cache.get(guildId);
 if (guild) {
 KillboardHandler.startPolling(guildId, config.killboard);
 killboardsIniciados++;
 console.log(`💀 Killboard iniciado para guild: ${guild.name}`);
 }
 }
 }
 if (killboardsIniciados > 0) {
 console.log(`💀 Total de Killboards ativos: ${killboardsIniciados}`);
 }
 } catch (error) {
 console.error('❌ Erro ao iniciar killboards:', error);
 }

 // Registrar Slash Commands
 const commands = [
 instalarCommand.data.toJSON(),
 desistalarCommand.data.toJSON(),
 atualizarCommand.data.toJSON(),
 limparEventosCommand.data.toJSON(),
 limparSaldoCommand.data.toJSON(),
 limparXpCommand.data.toJSON(),
 ajudaCommand.data.toJSON(),
 killboardCommand.data.toJSON(),
 saldosCommand.data.toJSON()
 ];

 const rest = new REST({ version: '10' }).setToken(process.env.TOKEN);

 try {
 console.log('🔄 Iniciando registro dos comandos slash...');

 await rest.put(
 Routes.applicationCommands(client.user.id),
 { body: commands }
 );

 console.log('✅ Comandos slash registrados com sucesso!');
 console.log(`📋 Total de comandos: ${commands.length}`);
 } catch (error) {
 console.error('❌ Erro ao registrar comandos slash:', error);
 }
});

// ==================== VERIFICAÇÃO DE ENTRADA EM CALL DE EVENTO ====================
client.on(Events.VoiceStateUpdate, async (oldState, newState) => {
 try {
 if (!newState.channelId) return;
 if (oldState.channelId === newState.channelId) return;

 const member = newState.member;
 const channel = newState.channel;

 if (!channel.name.startsWith('⚔️-') && !channel.name.startsWith('🏰-')) return;

 let isParticipating = false;
 let eventData = null;

 for (const [eventId, event] of global.activeEvents) {
 if (event.canalVozId === channel.id) {
 eventData = event;
 if (event.participantes.has(member.id)) {
 isParticipating = true;
 }
 break;
 }
 }

 for (const [raidId, raid] of global.activeRaids || []) {
 if (raid.canalVozId === channel.id) {
 for (const classe of Object.values(raid.classes || {})) {
 if (classe.participantes?.find(p => p.userId === member.id)) {
 isParticipating = true;
 break;
 }
 }
 break;
 }
 }

 if (!isParticipating && eventData) {
 console.log(`[VoiceState] Usuário ${member.id} tentou entrar na call ${channel.id} sem participar do evento`);

 const canalAguardando = newState.guild.channels.cache.find(
 c => c.name === '🔊╠Aguardando-Evento' && c.type === ChannelType.GuildVoice
 );

 if (canalAguardando) {
 try {
 await member.voice.setChannel(canalAguardando.id);
 console.log(`[VoiceState] Movido ${member.id} para Aguardando-Evento`);
 } catch (e) {
 console.log(`[VoiceState] Não foi possível mover, desconectando...`);
 try {
 await member.voice.disconnect('Não está participando do evento');
 } catch (e2) {
 console.log(`[VoiceState] Não foi possível desconectar`);
 }
 }
 } else {
 try {
 await member.voice.disconnect('Não está participando do evento');
 } catch (e) {
 console.log(`[VoiceState] Não foi possível desconectar`);
 }
 }

 try {
 await member.send({
 embeds: [
 new EmbedBuilder()
 .setTitle('⚠️ Acesso Negado')
 .setDescription(
 `Você tentou entrar na call do evento **${eventData.nome}** sem estar na lista de participantes.\n\n` +
 `👉 Clique no botão **"✋ Entrar no Evento"** no canal <#${eventData.canalTextoId}> para participar primeiro!`
 )
 .setColor(0xE74C3C)
 .setTimestamp()
 ]
 });
 } catch (e) {}
 }

 } catch (error) {
 console.error('[VoiceState] Erro na verificação:', error);
 }
});

// ==================== HANDLER PRINCIPAL DE INTERAÇÕES ====================
client.on(Events.InteractionCreate, async interaction => {
 try {
 // ✅ CORREÇÃO CRÍTICA: Verificar duplicação GLOBAL antes de qualquer processamento
 if (isInteractionProcessed(interaction.id)) {
 console.log(`[InteractionCreate] Interação ${interaction.id} já processada. Ignorando duplicação.`);
 return;
 }

 // Log da interação recebida
 console.log(`[InteractionCreate] Tipo: ${interaction.type} | ID: ${interaction.id} | Usuário: ${interaction.user?.id}`);

 // ✅ CORREÇÃO CRÍTICA: Verificar lock por usuário+comando para prevenir race conditions
 const commandKey = getCommandKey(interaction);
 const userId = interaction.user.id;

 if (!acquireLock(userId, commandKey)) {
 console.log(`[InteractionCreate] Lock ativo para usuário ${userId} no comando ${commandKey}. Ignorando.`);
 try {
 if (!interaction.replied && !interaction.deferred) {
 await interaction.reply({
 content: '⏳ Você já tem uma operação em andamento. Aguarde alguns segundos.',
 ephemeral: true
 });
 }
 } catch (e) {}
 return;
 }

 // COMANDOS SLASH
 if (interaction.isChatInputCommand()) {
 const command = client.commands.get(interaction.commandName);

 if (!command) {
 console.error(`❌ Comando não encontrado: ${interaction.commandName}`);
 releaseLock(userId, commandKey);
 return;
 }

 // Verificar permissões específicas
 if (command.data.name === 'instalar' || command.data.name === 'desistalar') {
 const isADM = interaction.member.roles.cache.some(r => r.name === 'ADM') ||
 interaction.member.permissions.has(PermissionFlagsBits.Administrator);

 if (!isADM) {
 releaseLock(userId, commandKey);
 return interaction.reply({
 content: '❌ Apenas ADMs podem usar este comando!',
 ephemeral: true
 });
 }
 }

 try {
 await command.execute(interaction, client);
 } catch (error) {
 console.error(`❌ Erro ao executar comando ${interaction.commandName}:`, error);

 if (interaction.replied || interaction.deferred) {
 await interaction.followUp({
 content: '❌ Ocorreu um erro ao executar este comando!',
 ephemeral: true
 });
 } else {
 await interaction.reply({
 content: '❌ Ocorreu um erro ao executar este comando!',
 ephemeral: true
 });
 }
 } finally {
 releaseLock(userId, commandKey);
 }
 return;
 }

 // BOTÕES
 if (interaction.isButton()) {
 const customId = interaction.customId;

 if (customId === 'confirmar_limpar_eventos' || customId === 'cancelar_limpar_eventos' ||
 customId === 'confirmar_limpar_saldo' || customId === 'cancelar_limpar_saldo' ||
 customId === 'confirmar_limpar_xp' || customId === 'cancelar_limpar_xp') {
 releaseLock(userId, commandKey);
 return;
 }

 // KILLBOARD
 if (customId === 'killboard_config') {
 const modal = new ModalBuilder()
 .setCustomId('modal_killboard_config')
 .setTitle('⚙️ Configurar Killboard')
 .addComponents(
 new ActionRowBuilder().addComponents(
 new TextInputBuilder()
 .setCustomId('albion_guild_id')
 .setLabel('ID da Guilda no Albion')
 .setPlaceholder('Ex: 7YNYrLtkS0mKv3Ii3cHU1g')
 .setStyle(TextInputStyle.Short)
 .setRequired(true)
 .setMinLength(20)
 .setMaxLength(25)
 )
 );
 await interaction.showModal(modal);
 releaseLock(userId, commandKey);
 return;
 }

 if (customId === 'killboard_test_kill' || customId === 'killboard_test_death') {
 await interaction.deferReply({ ephemeral: true });

 const testKbConfig = global.guildConfig?.get(interaction.guild.id)?.killboard;
 if (!testKbConfig) {
 await interaction.editReply({ content: '❌ Killboard não configurado! Use `/killboard setup` e `/killboard config` primeiro.' });
 releaseLock(userId, commandKey);
 return;
 }

 const isKill = customId === 'killboard_test_kill';

 const mockKbEvent = {
 EventId: 999999999,
 TimeStamp: new Date().toISOString(),
 Location: 'Zona de Teste',
 TotalVictimKillFame: 125000,
 Killer: {
 Name: isKill ? 'GuerreiroNOTAG' : 'InimigoTest',
 GuildId: isKill ? (testKbConfig.guildIdAlbion || 'guild-test') : 'guild-enemy',
 GuildName: isKill ? 'NOTAG' : 'Inimigos',
 AllianceName: isKill ? 'NOTAG Alliance' : null,
 AverageItemPower: isKill ? 1450 : 1200,
 Equipment: {
 MainHand: { Type: isKill ? 'T8_MAIN_SWORD@3' : 'T7_MAIN_ARCANESTAFF@1', Quality: isKill ? 3 : 2 },
 Head: { Type: isKill ? 'T8_HEAD_PLATE_SET3@2' : 'T7_HEAD_CLOTH_SET1', Quality: isKill ? 2 : 1 },
 Armor: { Type: isKill ? 'T8_ARMOR_PLATE_SET3@2' : 'T7_ARMOR_CLOTH_SET1', Quality: isKill ? 2 : 1 },
 Shoes: { Type: isKill ? 'T8_SHOES_PLATE_SET3@1' : 'T7_SHOES_CLOTH_SET1', Quality: isKill ? 2 : 1 },
 Cape: { Type: 'T8_CAPE', Quality: 1 },
 Mount: { Type: 'T8_MOUNT_HORSE', Quality: 1 }
 }
 },
 Victim: {
 Name: isKill ? 'InimigoTest' : 'GuerreiroNOTAG',
 GuildId: isKill ? 'guild-enemy' : (testKbConfig.guildIdAlbion || 'guild-test'),
 GuildName: isKill ? 'Inimigos' : 'NOTAG',
 AllianceName: isKill ? null : 'NOTAG Alliance',
 AverageItemPower: isKill ? 1200 : 1450,
 Equipment: {
 MainHand: { Type: isKill ? 'T7_MAIN_ARCANESTAFF@1' : 'T8_MAIN_SWORD@3', Quality: isKill ? 2 : 3 },
 Head: { Type: isKill ? 'T7_HEAD_CLOTH_SET1' : 'T8_HEAD_PLATE_SET3@2', Quality: isKill ? 1 : 2 },
 Armor: { Type: isKill ? 'T7_ARMOR_CLOTH_SET1' : 'T8_ARMOR_PLATE_SET3@2', Quality: isKill ? 1 : 2 },
 Shoes: { Type: isKill ? 'T7_SHOES_CLOTH_SET1' : 'T8_SHOES_PLATE_SET3@1', Quality: isKill ? 1 : 2 },
 Cape: { Type: 'T6_CAPE', Quality: 1 },
 Mount: { Type: 'T6_MOUNT_ARMORED_HORSE', Quality: 1 }
 },
 Inventory: [
 { Type: 'T8_ROCK', Count: 500 },
 { Type: 'T7_PLANKS', Count: 200 }
 ]
 },
 Participants: [{ Id: '1' }, { Id: '2' }, { Id: '3' }],
 GroupMembers: []
 };

 try {
 if (isKill) {
 const killChannelId = testKbConfig.killChannelId;
 if (!killChannelId) {
 await interaction.editReply({ content: '❌ Canal de kills não configurado. Use `/killboard setup` primeiro.' });
 releaseLock(userId, commandKey);
 return;
 }
 const killChannel = interaction.guild.channels.cache.get(killChannelId);
 if (!killChannel) {
 await interaction.editReply({ content: `❌ Canal de kills não encontrado (ID: ${killChannelId}).` });
 releaseLock(userId, commandKey);
 return;
 }
 const killEmbed = await KillboardHandler.createKillEmbed(mockKbEvent, testKbConfig);
 const components = KillboardHandler.createEventComponents(mockKbEvent);
 await killChannel.send({ embeds: [killEmbed], components: [components] });
 await interaction.editReply({ content: `✅ Embed de **kill** de teste enviado em <#${killChannelId}>!` });
 } else {
 const deathChannelId = testKbConfig.deathChannelId;
 if (!deathChannelId) {
 await interaction.editReply({ content: '❌ Canal de deaths não configurado. Use `/killboard setup` primeiro.' });
 releaseLock(userId, commandKey);
 return;
 }
 const deathChannel = interaction.guild.channels.cache.get(deathChannelId);
 if (!deathChannel) {
 await interaction.editReply({ content: `❌ Canal de deaths não encontrado (ID: ${deathChannelId}).` });
 releaseLock(userId, commandKey);
 return;
 }
 const deathEmbed = await KillboardHandler.createDeathEmbed(mockKbEvent, testKbConfig);
 const components = KillboardHandler.createEventComponents(mockKbEvent);
 await deathChannel.send({ embeds: [deathEmbed], components: [components] });
 await interaction.editReply({ content: `✅ Embed de **death** de teste enviado em <#${deathChannelId}>!` });
 }
 } catch (kbTestErr) {
 console.error('[Killboard Test Button] Erro:', kbTestErr);
 await interaction.editReply({ content: `❌ Erro ao enviar teste: ${kbTestErr.message}` });
 }
 releaseLock(userId, commandKey);
 return;
 }

 if (customId.startsWith('killboard_refresh_')) {
 const eventId = customId.replace('killboard_refresh_', '');
 await interaction.reply({
 content: `🔄 Atualizando dados do evento ${eventId}...`,
 ephemeral: true
 });
 releaseLock(userId, commandKey);
 return;
 }

 // 🛒 MERCADO ALBION - NOVO SISTEMA DE NAVEGAÇÃO
 if (customId === 'market_browse_category') {
 await MarketHandler.handleBrowseCategory(interaction);
 releaseLock(userId, commandKey);
 return;
 }

 if (customId === 'market_search_advanced') {
 await MarketHandler.handleAdvancedSearch(interaction);
 releaseLock(userId, commandKey);
 return;
 }

 if (customId === 'market_search_again') {
 await MarketHandler.sendPanel(interaction.channel);
 await interaction.reply({ content: '🔄 Iniciando nova pesquisa...', ephemeral: true });
 releaseLock(userId, commandKey);
 return;
 }

 if (customId.startsWith('market_back_category_')) {
 const searchId = customId.replace('market_back_category_', '');
 await MarketHandler.handleBrowseCategory(interaction);
 releaseLock(userId, commandKey);
 return;
 }

 if (customId.startsWith('market_search_confirm_')) {
 const searchId = customId.replace('market_search_confirm_', '');
 await MarketHandler.executeSearch(interaction, searchId);
 releaseLock(userId, commandKey);
 return;
 }

 if (customId.startsWith('market_cancel_')) {
 const searchId = customId.replace('market_cancel_', '');
 await MarketHandler.cancelSearch(interaction, searchId);
 releaseLock(userId, commandKey);
 return;
 }

 if (customId === 'market_help') {
 await MarketHandler.showHelp(interaction);
 releaseLock(userId, commandKey);
 return;
 }

 if (customId === 'market_update_cache') {
 await MarketHandler.handleUpdateCache(interaction);
 releaseLock(userId, commandKey);
 return;
 }

 // SISTEMA DE REGISTRO
 if (customId === 'btn_abrir_registro') {
 const modal = RegistrationModal.createRegistrationModal();
 await interaction.showModal(modal);
 releaseLock(userId, commandKey);
 return;
 }

 if (customId === 'btn_tentar_novamente_registro') {
 const modal = RegistrationModal.createRegistrationModal();
 await interaction.showModal(modal);
 releaseLock(userId, commandKey);
 return;
 }

 if (customId.startsWith('aprovar_membro_')) {
 const regId = customId.replace('aprovar_membro_', '');
 await RegistrationActions.approveAsMember(interaction, regId);
 releaseLock(userId, commandKey);
 return;
 }

 if (customId.startsWith('aprovar_alianca_')) {
 const regId = customId.replace('aprovar_alianca_', '');
 await RegistrationActions.approveAsAlianca(interaction, regId);
 releaseLock(userId, commandKey);
 return;
 }

 if (customId.startsWith('aprovar_convidado_')) {
 const regId = customId.replace('aprovar_convidado_', '');
 await RegistrationActions.approveAsConvidado(interaction, regId);
 releaseLock(userId, commandKey);
 return;
 }

 if (customId.startsWith('recusar_registro_')) {
 const regId = customId.replace('recusar_registro_', '');
 await RegistrationActions.handleRejectRegistration(interaction, regId);
 releaseLock(userId, commandKey);
 return;
 }

 if (customId.startsWith('blacklist_add_')) {
 const regId = customId.replace('blacklist_add_', '');
 await RegistrationActions.handleBlacklistAdd(interaction, regId);
 releaseLock(userId, commandKey);
 return;
 }

 // SISTEMA DE EVENTOS
 if (customId === 'btn_criar_evento') {
 const modal = EventPanel.createEventModal();
 await interaction.showModal(modal);
 releaseLock(userId, commandKey);
 return;
 }

 if (customId === 'btn_raid_avalon') {
 const modal = EventPanel.createRaidAvalonModal();
 await interaction.showModal(modal);
 releaseLock(userId, commandKey);
 return;
 }

 if (customId === 'btn_gank' || customId === 'btn_cta') {
 await interaction.reply({
 content: '🔒 Este recurso estará disponível em breve!',
 ephemeral: true
 });
 releaseLock(userId, commandKey);
 return;
 }

 // RAID AVALON
 if (customId.startsWith('raid_config_')) {
 const action = customId.replace('raid_config_', '');
 if (action === 'finalizar') {
 await RaidAvalonHandler.createRaid(interaction);
 } else {
 await RaidAvalonHandler.showClassLimitModal(interaction, action);
 }
 releaseLock(userId, commandKey);
 return;
 }

 if (customId.startsWith('raid_iniciar_')) {
 const raidId = customId.replace('raid_iniciar_', '');
 await RaidAvalonHandler.handleIniciar(interaction, raidId);
 releaseLock(userId, commandKey);
 return;
 }

 if (customId.startsWith('raid_finalizar_')) {
 const raidId = customId.replace('raid_finalizar_', '');
 await RaidAvalonHandler.handleFinalizar(interaction, raidId);
 releaseLock(userId, commandKey);
 return;
 }

 if (customId.startsWith('raid_cancelar_')) {
 const raidId = customId.replace('raid_cancelar_', '');
 await RaidAvalonHandler.handleCancelar(interaction, raidId);
 releaseLock(userId, commandKey);
 return;
 }

 // SISTEMA DE EVENTOS - Ações
 if (customId.startsWith('evt_participar_')) {
 const eventId = customId.replace('evt_participar_', '');
 await EventHandler.handleParticipar(interaction, eventId);
 releaseLock(userId, commandKey);
 return;
 }

 if (customId.startsWith('evt_iniciar_')) {
 const eventId = customId.replace('evt_iniciar_', '');
 await EventHandler.handleIniciar(interaction, eventId);
 releaseLock(userId, commandKey);
 return;
 }

 if (customId.startsWith('evt_pausar_global_')) {
 const eventId = customId.replace('evt_pausar_global_', '');
 await EventHandler.handlePausarGlobal(interaction, eventId, true);
 releaseLock(userId, commandKey);
 return;
 }

 if (customId.startsWith('evt_retomar_global_')) {
 const eventId = customId.replace('evt_retomar_global_', '');
 await EventHandler.handlePausarGlobal(interaction, eventId, false);
 releaseLock(userId, commandKey);
 return;
 }

 if (customId.startsWith('evt_pausar_')) {
 const eventId = customId.replace('evt_pausar_', '');
 await EventHandler.handlePausar(interaction, eventId);
 releaseLock(userId, commandKey);
 return;
 }

 if (customId.startsWith('evt_trancar_')) {
 const eventId = customId.replace('evt_trancar_', '');
 await EventHandler.handleTrancar(interaction, eventId);
 releaseLock(userId, commandKey);
 return;
 }

 if (customId.startsWith('evt_cancelar_')) {
 const eventId = customId.replace('evt_cancelar_', '');
 await EventHandler.handleCancelar(interaction, eventId);
 releaseLock(userId, commandKey);
 return;
 }

 if (customId.startsWith('evt_finalizar_')) {
 const eventId = customId.replace('evt_finalizar_', '');
 await EventHandler.handleFinalizar(interaction, eventId);
 releaseLock(userId, commandKey);
 return;
 }

 // LOOTSPLIT
 if (customId.startsWith('loot_simular_')) {
 const eventId = customId.replace('loot_simular_', '');
 const modal = LootSplitHandler.createSimulationModal(eventId);
 await interaction.showModal(modal);
 releaseLock(userId, commandKey);
 return;
 }

 if (customId.startsWith('loot_enviar_')) {
 const simulationId = customId.replace('loot_enviar_', '');
 await LootSplitHandler.handleEnviar(interaction, simulationId);
 releaseLock(userId, commandKey);
 return;
 }

 if (customId.startsWith('loot_recalcular_')) {
 const simulationId = customId.replace('loot_recalcular_', '');
 await LootSplitHandler.handleRecalcular(interaction, simulationId);
 releaseLock(userId, commandKey);
 return;
 }

 if (customId.startsWith('fin_aprovar_')) {
 const simulationId = customId.replace('fin_aprovar_', '');
 await LootSplitHandler.handleAprovacaoFinanceira(interaction, simulationId, true);
 releaseLock(userId, commandKey);
 return;
 }

 // FINANCEIRO — rotas específicas antes da genérica do LootSplit
 if (customId.startsWith('fin_recusar_saque_')) {
 const withdrawalId = customId.replace('fin_recusar_saque_', '');
 await FinanceHandler.handleRejectWithdrawal(interaction, withdrawalId);
 releaseLock(userId, commandKey);
 return;
 }

 if (customId.startsWith('fin_recusar_emprestimo_')) {
 const loanId = customId.replace('fin_recusar_emprestimo_', '');
 await FinanceHandler.handleRejectLoan(interaction, loanId);
 releaseLock(userId, commandKey);
 return;
 }

 if (customId.startsWith('fin_recusar_quitacao_')) {
 const paymentId = customId.replace('fin_recusar_quitacao_', '');
 await FinanceHandler.handleRejectLoanPayment(interaction, paymentId);
 releaseLock(userId, commandKey);
 return;
 }

 if (customId.startsWith('fin_recusar_')) {
 const simulationId = customId.replace('fin_recusar_', '');
 await LootSplitHandler.handleAprovacaoFinanceira(interaction, simulationId, false);
 releaseLock(userId, commandKey);
 return;
 }

 if (customId.startsWith('loot_arquivar_')) {
 const simulationId = customId.replace('loot_arquivar_', '');
 const simulation = global.simulations?.get(simulationId);
 if (simulation) {
 await LootSplitHandler.handleArquivar(interaction, simulation.eventId, simulationId);
 } else {
 await interaction.reply({ content: '❌ Simulação não encontrada!', ephemeral: true });
 }
 releaseLock(userId, commandKey);
 return;
 }

 if (customId.startsWith('loot_atualizar_part_')) {
 const simulationId = customId.replace('loot_atualizar_part_', '');
 await LootSplitHandler.handleAtualizarParticipacao(interaction, simulationId);
 releaseLock(userId, commandKey);
 return;
 }

 if (customId.startsWith('loot_clear_users_')) {
 const simulationId = customId.replace('loot_clear_users_', '');
 await LootSplitHandler.clearUserSelection(interaction, simulationId);
 releaseLock(userId, commandKey);
 return;
 }

 if (customId.startsWith('loot_proceed_taxa_')) {
 const simulationId = customId.replace('loot_proceed_taxa_', '');
 await LootSplitHandler.openTaxaModal(interaction, simulationId);
 releaseLock(userId, commandKey);
 return;
 }

 // DEPÓSITO - Sistema Antigo (mantido para compatibilidade)
 if (customId === 'btn_deposito_novo') {
 await DepositHandler.handleDepositoButton(interaction);
 releaseLock(userId, commandKey);
 return;
 }

 if (customId === 'btn_historico_depositos') {
 await DepositHandler.showHistorico(interaction);
 releaseLock(userId, commandKey);
 return;
 }

 if (customId === 'btn_ajuda_deposito') {
 await DepositHandler.showAjuda(interaction);
 releaseLock(userId, commandKey);
 return;
 }

 // 💵 NOVO SISTEMA DE DEPÓSITO - FLUXO DE SELEÇÃO DE USUÁRIOS
 if (customId === 'dep_select_users') {
 await DepositHandler.openUserSelection(interaction);
 releaseLock(userId, commandKey);
 return;
 }

 if (customId === 'dep_clear_users') {
 await DepositHandler.clearUserSelection(interaction);
 releaseLock(userId, commandKey);
 return;
 }

 if (customId === 'dep_proceed_to_modal') {
 await DepositHandler.openValorModal(interaction);
 releaseLock(userId, commandKey);
 return;
 }

 // Sistema antigo de aprovação (mantido para compatibilidade com depósitos pendentes antigos)
 if (customId.startsWith('dep_aprovar_')) {
 const parts = customId.split('_');
 const depositId = parts[2];
 const userId = parts[3];
 const valor = parts[4];

 const isTesoureiro = interaction.member.roles.cache.some(r => r.name === 'tesoureiro') ||
 interaction.member.roles.cache.some(r => r.name === 'ADM') ||
 interaction.member.permissions.has(PermissionFlagsBits.Administrator);

 if (!isTesoureiro) {
 releaseLock(userId, commandKey);
 return interaction.reply({ content: '❌ Apenas tesoureiros podem aprovar depósitos!', ephemeral: true });
 }

 await DepositHandler.handleAprovacao(interaction, depositId, userId, valor, true);
 releaseLock(userId, commandKey);
 return;
 }

 if (customId.startsWith('dep_recusar_')) {
 const depositId = customId.replace('dep_recusar_', '');
 const isTesoureiro = interaction.member.roles.cache.some(r => r.name === 'tesoureiro') ||
 interaction.member.roles.cache.some(r => r.name === 'ADM') ||
 interaction.member.permissions.has(PermissionFlagsBits.Administrator);

 if (!isTesoureiro) {
 releaseLock(userId, commandKey);
 return interaction.reply({ content: '❌ Apenas tesoureiros podem recusar depósitos!', ephemeral: true });
 }

 await DepositHandler.handleAprovacao(interaction, depositId, null, null, false);
 releaseLock(userId, commandKey);
 return;
 }

 if (customId.startsWith('dep_verificar_')) {
 const comprovante = customId.replace('dep_verificar_', '');
 await interaction.reply({ content: `📎 **Comprovante:** ${comprovante}`, ephemeral: true });
 releaseLock(userId, commandKey);
 return;
 }

 // CONSULTAR SALDO
 if (customId === 'btn_consultar_saldo') {
 await ConsultarSaldoHandler.handleConsultarSaldo(interaction);
 releaseLock(userId, commandKey);
 return;
 }

 if (customId === 'btn_sacar_saldo') {
 await ConsultarSaldoHandler.handleSacarSaldo(interaction);
 releaseLock(userId, commandKey);
 return;
 }

 if (customId === 'btn_solicitar_emprestimo') {
 await ConsultarSaldoHandler.handleSolicitarEmprestimo(interaction);
 releaseLock(userId, commandKey);
 return;
 }

 if (customId === 'btn_transferir_saldo') {
 await ConsultarSaldoHandler.handleTransferirSaldo(interaction);
 releaseLock(userId, commandKey);
 return;
 }

 if (customId === 'btn_quitar_emprestimo') {
 await ConsultarSaldoHandler.handleQuitarEmprestimo(interaction);
 releaseLock(userId, commandKey);
 return;
 }

 // SALDO GUILDA
 if (customId === 'btn_saldo_atualizar') {
 await BalancePanelHandler.handleAtualizar(interaction);
 releaseLock(userId, commandKey);
 return;
 }

 if (customId === 'btn_saldo_detalhes') {
 await BalancePanelHandler.handleDetalhes(interaction);
 releaseLock(userId, commandKey);
 return;
 }

 if (customId === 'btn_saldo_historico') {
 await BalancePanelHandler.handleHistorico(interaction);
 releaseLock(userId, commandKey);
 return;
 }

 // PAINEL ADMINISTRATIVO
 if (customId === 'adm_confiscar_saldo') {
 await AdminPanelHandler.handleConfiscarSaldo(interaction);
 releaseLock(userId, commandKey);
 return;
 }

 if (customId === 'adm_confiscar_select_users') {
 await AdminPanelHandler.openUserSelect(interaction);
 releaseLock(userId, commandKey);
 return;
 }

 if (customId === 'adm_confiscar_clear') {
 await AdminPanelHandler.clearSelection(interaction);
 releaseLock(userId, commandKey);
 return;
 }

 if (customId === 'adm_confiscar_proceed') {
 await AdminPanelHandler.openValorModal(interaction);
 releaseLock(userId, commandKey);
 return;
 }

 if (customId.startsWith('adm_confiscar_confirm_')) {
 const confiscoId = customId.replace('adm_confiscar_confirm_', '');
 await AdminPanelHandler.executeConfisco(interaction, confiscoId);
 releaseLock(userId, commandKey);
 return;
 }

 if (customId.startsWith('adm_confiscar_cancel_')) {
 const confiscoId = customId.replace('adm_confiscar_cancel_', '');
 await AdminPanelHandler.cancelConfisco(interaction, confiscoId);
 releaseLock(userId, commandKey);
 return;
 }

 // FINANCEIRO — confirmações (recusas já tratadas acima, antes do loot split)
 if (customId.startsWith('fin_confirmar_saque_')) {
 const withdrawalId = customId.replace('fin_confirmar_saque_', '');
 await FinanceHandler.handleConfirmWithdrawal(interaction, withdrawalId);
 releaseLock(userId, commandKey);
 return;
 }

 if (customId.startsWith('fin_confirmar_emprestimo_')) {
 const loanId = customId.replace('fin_confirmar_emprestimo_', '');
 await FinanceHandler.handleConfirmLoan(interaction, loanId);
 releaseLock(userId, commandKey);
 return;
 }

 if (customId.startsWith('fin_confirmar_quitacao_')) {
 const paymentId = customId.replace('fin_confirmar_quitacao_', '');
 await FinanceHandler.handleConfirmLoanPayment(interaction, paymentId);
 releaseLock(userId, commandKey);
 return;
 }

 if (customId.startsWith('transf_aceitar_')) {
 const transferId = customId.replace('transf_aceitar_', '');
 await FinanceHandler.handleAcceptTransfer(interaction, transferId);
 releaseLock(userId, commandKey);
 return;
 }

 if (customId.startsWith('transf_recusar_')) {
 const transferId = customId.replace('transf_recusar_', '');
 await FinanceHandler.handleRejectTransfer(interaction, transferId);
 releaseLock(userId, commandKey);
 return;
 }

 // ALBION ACADEMY / PERFIL
 if (customId === 'btn_criar_xp_event') {
 await XpEventHandler.showCreateEventModal(interaction);
 releaseLock(userId, commandKey);
 return;
 }

 if (customId === 'btn_depositar_xp_manual') {
 await PerfilHandler.showDepositXpModal(interaction);
 releaseLock(userId, commandKey);
 return;
 }

 if (customId === 'xp_select_users') {
 await PerfilHandler.openUserSelection(interaction);
 releaseLock(userId, commandKey);
 return;
 }

 if (customId === 'xp_clear_users') {
 await PerfilHandler.clearUserSelection(interaction);
 releaseLock(userId, commandKey);
 return;
 }

 if (customId === 'xp_proceed_to_modal') {
 await PerfilHandler.createManualXpModal(interaction);
 releaseLock(userId, commandKey);
 return;
 }

 if (customId === 'btn_ver_perfil') {
 await PerfilHandler.showProfile(interaction);
 releaseLock(userId, commandKey);
 return;
 }

 if (customId === 'btn_depositar_orb') {
 await OrbHandler.showUserSelect(interaction);
 releaseLock(userId, commandKey);
 return;
 }

 // ORB HANDLERS
 if (customId === 'orb_select_users') {
 await OrbHandler.openUserSelection(interaction);
 releaseLock(userId, commandKey);
 return;
 }

 if (customId === 'orb_clear_users') {
 await OrbHandler.clearUserSelection(interaction);
 releaseLock(userId, commandKey);
 return;
 }

 if (customId === 'orb_proceed_to_modal') {
 await OrbHandler.openOrbModal(interaction);
 releaseLock(userId, commandKey);
 return;
 }

 if (customId.startsWith('orb_approve_')) {
 const depositId = customId.replace('orb_approve_', '');
 await OrbHandler.approveOrb(interaction, depositId);
 releaseLock(userId, commandKey);
 return;
 }

 if (customId.startsWith('orb_reject_')) {
 const depositId = customId.replace('orb_reject_', '');
 await OrbHandler.rejectOrb(interaction, depositId);
 releaseLock(userId, commandKey);
 return;
 }

 // LISTA DE MEMBROS
 if (customId === 'btn_atualizar_lista_membros') {
 await interaction.deferUpdate();
 const MemberListPanel = require('./handlers/memberListPanel');
 await MemberListPanel.handleAtualizar(interaction);
 releaseLock(userId, commandKey);
 return;
 }

 if (customId === 'btn_mlist_atualizar') {
 const MemberListPanel = require('./handlers/memberListPanel');
 await MemberListPanel.handleAtualizar(interaction);
 releaseLock(userId, commandKey);
 return;
 }

 if (customId === 'btn_mlist_ver_lista') {
 const MemberListPanel = require('./handlers/memberListPanel');
 const members = Array.from((await interaction.guild.members.fetch()).values());
 await MemberListPanel.showMemberPage(interaction, members, 1, Math.ceil(members.length/10), 'all');
 releaseLock(userId, commandKey);
 return;
 }

 if (customId.startsWith('btn_mlist_page_')) {
 const MemberListPanel = require('./handlers/memberListPanel');
 if (customId.includes('next')) {
 await MemberListPanel.handlePageNavigation(interaction, 'next');
 } else if (customId.includes('prev')) {
 await MemberListPanel.handlePageNavigation(interaction, 'prev');
 }
 releaseLock(userId, commandKey);
 return;
 }

 if (customId === 'btn_mlist_voltar_resumo') {
 const MemberListPanel = require('./handlers/memberListPanel');
 await MemberListPanel.handleVoltarResumo(interaction);
 releaseLock(userId, commandKey);
 return;
 }

 if (customId === 'btn_mlist_stats') {
 const MemberListPanel = require('./handlers/memberListPanel');
 await MemberListPanel.handleStatsDetailed(interaction);
 releaseLock(userId, commandKey);
 return;
 }

 if (customId === 'btn_mlist_export') {
 const MemberListPanel = require('./handlers/memberListPanel');
 await MemberListPanel.handleExport(interaction);
 releaseLock(userId, commandKey);
 return;
 }

 // ESTATÍSTICAS DE EVENTOS
 if (customId === 'btn_eventos_atualizar') {
 const EventStatsHandler = require('./handlers/eventStatsHandler');
 await EventStatsHandler.handleAtualizar(interaction);
 releaseLock(userId, commandKey);
 return;
 }

 if (customId === 'btn_eventos_exportar') {
 await interaction.reply({ content: '⏳ Exportação de dados em desenvolvimento...', ephemeral: true });
 releaseLock(userId, commandKey);
 return;
 }

 if (customId === 'btn_eventos_ajuda') {
 await interaction.reply({ content: '❓ **Painel de Eventos**\n\nUse os menus acima para filtrar eventos por período ou cargo.', ephemeral: true });
 releaseLock(userId, commandKey);
 return;
 }

 // CONFIGURAÇÕES
 if (customId === 'config_taxa_guilda') {
 await ConfigActions.handleTaxaGuilda(interaction);
 releaseLock(userId, commandKey);
 return;
 }

 if (customId === 'config_registrar_guilda') {
 await ConfigActions.handleRegistrarGuilda(interaction);
 releaseLock(userId, commandKey);
 return;
 }

 if (customId === 'config_xp') {
 await ConfigActions.handleXP(interaction);
 releaseLock(userId, commandKey);
 return;
 }

 if (customId === 'config_taxa_bau') {
 await ConfigActions.handleTaxaBau(interaction);
 releaseLock(userId, commandKey);
 return;
 }

 if (customId === 'config_taxa_emprestimo') {
 await ConfigActions.handleTaxaEmprestimo(interaction);
 releaseLock(userId, commandKey);
 return;
 }

 if (customId === 'config_atualizar_bot') {
 await ConfigActions.handleAtualizarBot(interaction);
 releaseLock(userId, commandKey);
 return;
 }

 if (customId.startsWith('confirmar_guilda_')) {
 const parts = customId.replace('confirmar_guilda_', '').split('_');
 const server = parts[0];
 const guildName = parts.slice(1).join('_');
 await ConfigActions.confirmarGuildaRegistro(interaction, server, guildName);
 releaseLock(userId, commandKey);
 return;
 }

 if (customId === 'cancelar_guilda_registro') {
 await ConfigActions.cancelarGuildaRegistro(interaction);
 releaseLock(userId, commandKey);
 return;
 }

 if (customId.startsWith('xp_event_ver_progresso_')) {
 const eventId = customId.replace('xp_event_ver_progresso_', '');
 await XpEventHandler.handleVerProgresso(interaction, eventId);
 releaseLock(userId, commandKey);
 return;
 }

 if (customId.startsWith('xp_event_atualizar_')) {
 const eventId = customId.replace('xp_event_atualizar_', '');
 await XpEventHandler.handleAtualizarProgresso(interaction, eventId);
 releaseLock(userId, commandKey);
 return;
 }

 if (customId.startsWith('xp_event_finalizar_')) {
 const eventId = customId.replace('xp_event_finalizar_', '');
 await XpEventHandler.finalizarXpEvent(interaction, eventId);
 releaseLock(userId, commandKey);
 return;
 }

 if (customId.startsWith('xp_event_cancelar_')) {
 const eventId = customId.replace('xp_event_cancelar_', '');
 await XpEventHandler.cancelarXpEvent(interaction, eventId);
 releaseLock(userId, commandKey);
 return;
 }
 }

 // SELECT MENUS
 if (interaction.isStringSelectMenu()) {
 if (interaction.customId === 'select_server_registro') {
 await RegistrationModal.processServerSelect(interaction);
 releaseLock(userId, commandKey);
 return;
 }

 if (interaction.customId === 'select_platform_registro') {
 await RegistrationModal.processPlatformSelect(interaction, client);
 releaseLock(userId, commandKey);
 return;
 }

 if (interaction.customId === 'select_taxa_guilda') {
 await ConfigActions.handleTaxaSelect(interaction);
 releaseLock(userId, commandKey);
 return;
 }

 if (interaction.customId === 'select_orb_type') {
 const orbType = interaction.values[0];
 if (!global.orbTemp) global.orbTemp = new Map();
 const existing = global.orbTemp.get(interaction.user.id) || {};
 global.orbTemp.set(interaction.user.id, { ...existing, orbType });
 await OrbHandler.showUserSelect(interaction);
 releaseLock(userId, commandKey);
 return;
 }

 if (interaction.customId === 'select_periodo_eventos') {
 const EventStatsHandler = require('./handlers/eventStatsHandler');
 await EventStatsHandler.handlePeriodSelect(interaction);
 releaseLock(userId, commandKey);
 return;
 }

 if (interaction.customId === 'select_cargo_eventos') {
 const EventStatsHandler = require('./handlers/eventStatsHandler');
 await EventStatsHandler.handleRoleSelect(interaction);
 releaseLock(userId, commandKey);
 return;
 }

 if (interaction.customId.startsWith('loot_select_users_')) {
 const simulationId = interaction.customId.replace('loot_select_users_', '');
 await LootSplitHandler.processUserSelection(interaction, simulationId);
 releaseLock(userId, commandKey);
 return;
 }

 if (interaction.customId === 'mlist_filter_cargo') {
 const MemberListPanel = require('./handlers/memberListPanel');
 await MemberListPanel.handleFilterSelect(interaction);
 releaseLock(userId, commandKey);
 return;
 }

 if (interaction.customId === 'mlist_sort_by') {
 const MemberListPanel = require('./handlers/memberListPanel');
 await MemberListPanel.handleSortSelect(interaction);
 releaseLock(userId, commandKey);
 return;
 }

 if (interaction.customId.startsWith('raid_select_class_')) {
 const raidId = interaction.customId.replace('raid_select_class_', '');
 const classKey = interaction.values[0];
 await RaidAvalonHandler.showWeaponSelect(interaction, raidId, classKey);
 releaseLock(userId, commandKey);
 return;
 }

 if (interaction.customId.startsWith('raid_select_weapon_')) {
 const parts = interaction.customId.replace('raid_select_weapon_', '').split('_');
 const raidId = parts[0] + '_' + parts[1] + '_' + parts[2];
 const classKey = parts[3];
 const weaponKey = interaction.values[0];
 await RaidAvalonHandler.processWeaponSelect(interaction, raidId, classKey, weaponKey);
 releaseLock(userId, commandKey);
 return;
 }

 if (interaction.customId === 'select_server_guilda') {
 await ConfigActions.processGuildaServerSelect(interaction);
 releaseLock(userId, commandKey);
 return;
 }

 if (interaction.customId === 'select_orb_users') {
 await OrbHandler.processUserSelection(interaction);
 releaseLock(userId, commandKey);
 return;
 }

 if (interaction.customId === 'ajuda_menu') {
 releaseLock(userId, commandKey);
 return;
 }

 // 🛒 MERCADO - Navegação por Categoria
 if (interaction.customId.startsWith('market_select_category_')) {
 const searchId = interaction.customId.replace('market_select_category_', '');
 const category = interaction.values[0];
 await MarketHandler.showCategoryItems(interaction, category, searchId);
 releaseLock(userId, commandKey);
 return;
 }

 if (interaction.customId.startsWith('market_select_item_')) {
 const searchId = interaction.customId.replace('market_select_item_', '');
 const itemId = interaction.values[0];
 await MarketHandler.showItemFilters(interaction, itemId, searchId);
 releaseLock(userId, commandKey);
 return;
 }

 if (interaction.customId.startsWith('market_filter_tier_')) {
 const searchId = interaction.customId.replace('market_filter_tier_', '');
 const tier = interaction.values[0];
 await MarketHandler.updateFilter(interaction, 'tier', searchId, tier);
 releaseLock(userId, commandKey);
 return;
 }

 if (interaction.customId.startsWith('market_filter_enchant_')) {
 const searchId = interaction.customId.replace('market_filter_enchant_', '');
 const enchant = interaction.values[0];
 await MarketHandler.updateFilter(interaction, 'enchant', searchId, enchant);
 releaseLock(userId, commandKey);
 return;
 }

 if (interaction.customId.startsWith('market_filter_quality_')) {
 const searchId = interaction.customId.replace('market_filter_quality_', '');
 const quality = interaction.values[0];
 await MarketHandler.updateFilter(interaction, 'quality', searchId, quality);
 releaseLock(userId, commandKey);
 return;
 }
 }

 // USER SELECT MENUS
 if (interaction.isUserSelectMenu()) {
 if (interaction.customId === 'select_xp_target_users') {
 await PerfilHandler.processUserSelection(interaction);
 releaseLock(userId, commandKey);
 return;
 }

 if (interaction.customId === 'select_xp_target_user') {
 const targetUserId = interaction.values[0];
 await PerfilHandler.createManualXpModal(interaction, targetUserId);
 releaseLock(userId, commandKey);
 return;
 }

 if (interaction.customId === 'select_orb_users') {
 await OrbHandler.processUserSelection(interaction);
 releaseLock(userId, commandKey);
 return;
 }

 // 💵 NOVO: DEPÓSITO - Seleção de usuários
 if (interaction.customId === 'dep_select_users_menu') {
 await DepositHandler.processUserSelection(interaction);
 releaseLock(userId, commandKey);
 return;
 }

 // PAINEL ADMINISTRATIVO - Seleção de jogadores para confisco
 if (interaction.customId === 'adm_confiscar_users_menu') {
 await AdminPanelHandler.processUserSelection(interaction);
 releaseLock(userId, commandKey);
 return;
 }
 }

 // MODALS
 if (interaction.isModalSubmit()) {
 if (interaction.customId === 'modal_registro') {
 const nick = interaction.fields.getTextInputValue('reg_nick').trim();
 const erros = await RegistrationActions.checkExistingRegistration(
 interaction.guild,
 interaction.user.id,
 nick
 );

 if (erros.length > 0) {
 await interaction.reply({
 content: `❌ **Não foi possível iniciar o registro:**\n\n${erros.join('\n')}`,
 ephemeral: true
 });
 releaseLock(userId, commandKey);
 return;
 }

 await RegistrationModal.processRegistration(interaction, client);
 releaseLock(userId, commandKey);
 return;
 }

 if (interaction.customId.startsWith('modal_recusar_registro_')) {
 const regId = interaction.customId.replace('modal_recusar_registro_', '');
 await RegistrationActions.processRejectionWithReason(interaction, regId);
 releaseLock(userId, commandKey);
 return;
 }

 if (interaction.customId.startsWith('modal_blacklist_')) {
 const regId = interaction.customId.replace('modal_blacklist_', '');
 await RegistrationActions.processBlacklistAdd(interaction, regId);
 releaseLock(userId, commandKey);
 return;
 }

 if (interaction.customId === 'modal_criar_evento') {
 await EventHandler.createEvent(interaction);
 releaseLock(userId, commandKey);
 return;
 }

 if (interaction.customId === 'modal_raid_avalon') {
 try {
 const nome = interaction.fields.getTextInputValue('raid_nome');
 const descricao = interaction.fields.getTextInputValue('raid_descricao');
 const horario = interaction.fields.getTextInputValue('raid_horario');
 const limite = parseInt(interaction.fields.getTextInputValue('raid_limite')) || 0;

 const raidData = {
 nome: nome,
 descricao: descricao,
 horario: horario,
 limiteTotal: limite,
 classes: {}
 };

 await RaidAvalonHandler.showClassConfigModal(interaction, raidData);
 releaseLock(userId, commandKey);
 return;
 } catch (error) {
 console.error('[Index] Error processing raid modal:', error);
 await interaction.reply({ content: '❌ Erro ao processar formulário da raid.', ephemeral: true });
 releaseLock(userId, commandKey);
 return;
 }
 }

 if (interaction.customId.startsWith('raid_limit_')) {
 const classKey = interaction.customId.replace('raid_limit_', '');
 await RaidAvalonHandler.processClassLimit(interaction, classKey);
 releaseLock(userId, commandKey);
 return;
 }

 if (interaction.customId.startsWith('modal_simular_evento_')) {
 const eventId = interaction.customId.replace('modal_simular_evento_', '');
 await LootSplitHandler.processSimulation(interaction, eventId);
 releaseLock(userId, commandKey);
 return;
 }

 // 💵 DEPÓSITO - Novo fluxo (valor normal, sem milhões)
 if (interaction.customId === 'modal_deposito_valor') {
 await DepositHandler.processDeposito(interaction);
 releaseLock(userId, commandKey);
 return;
 }

 if (interaction.customId === 'modal_sacar_saldo') {
 await FinanceHandler.processWithdrawRequest(interaction);
 releaseLock(userId, commandKey);
 return;
 }

 if (interaction.customId === 'modal_solicitar_emprestimo') {
 await FinanceHandler.processLoanRequest(interaction);
 releaseLock(userId, commandKey);
 return;
 }

 if (interaction.customId === 'modal_quitar_emprestimo') {
 await FinanceHandler.processLoanPaymentRequest(interaction);
 releaseLock(userId, commandKey);
 return;
 }

 if (interaction.customId.startsWith('modal_taxa_participacao_')) {
 const simulationId = interaction.customId.replace('modal_taxa_participacao_', '');
 await LootSplitHandler.processTaxaUpdate(interaction, simulationId);
 releaseLock(userId, commandKey);
 return;
 }

 if (interaction.customId === 'modal_transferir_saldo') {
 await FinanceHandler.processTransferRequest(interaction);
 releaseLock(userId, commandKey);
 return;
 }

 if (interaction.customId === 'modal_adm_confiscar_valor') {
 await AdminPanelHandler.processValorModal(interaction);
 releaseLock(userId, commandKey);
 return;
 }

 if (interaction.customId.startsWith('modal_motivo_recusa_saque_')) {
 const withdrawalId = interaction.customId.replace('modal_motivo_recusa_saque_', '');
 await FinanceHandler.processWithdrawalRejection(interaction, withdrawalId);
 releaseLock(userId, commandKey);
 return;
 }

 // KILLBOARD
 if (interaction.customId === 'modal_killboard_config') {
 const guildId = interaction.fields.getTextInputValue('albion_guild_id');
 await interaction.deferReply({ ephemeral: true });

 try {
 const guildData = await KillboardHandler.setGuildId(interaction.guild.id, guildId);
 await interaction.editReply({
 content: `✅ **Killboard configurado!**\n\n🏰 Guilda: ${guildData.Name}\n📊 Monitoramento iniciado automaticamente.`
 });
 } catch (error) {
 await interaction.editReply({
 content: `❌ Erro ao configurar: ${error.message}`
 });
 }
 releaseLock(userId, commandKey);
 return;
 }

 if (interaction.customId === 'modal_depositar_xp_multi') {
 await PerfilHandler.processManualXpDeposit(interaction);
 releaseLock(userId, commandKey);
 return;
 }

 if (interaction.customId.startsWith('modal_depositar_xp_')) {
 const targetUserId = interaction.customId.replace('modal_depositar_xp_', '');
 await PerfilHandler.processManualXpDeposit(interaction, targetUserId);
 releaseLock(userId, commandKey);
 return;
 }

 if (interaction.customId.startsWith('modal_depositar_orb_')) {
 await OrbHandler.processOrbDeposit(interaction);
 releaseLock(userId, commandKey);
 return;
 }

 if (interaction.customId === 'modal_taxa_guilda') {
 await ConfigActions.handleTaxaSelect(interaction);
 releaseLock(userId, commandKey);
 return;
 }

 if (interaction.customId === 'modal_taxas_bau') {
 await ConfigActions.processTaxaBau(interaction);
 releaseLock(userId, commandKey);
 return;
 }

 if (interaction.customId === 'modal_taxa_emprestimo') {
 await ConfigActions.processTaxaEmprestimo(interaction);
 releaseLock(userId, commandKey);
 return;
 }

 if (interaction.customId === 'modal_registrar_guilda_nome') {
 await ConfigActions.processGuildaNome(interaction);
 releaseLock(userId, commandKey);
 return;
 }

 if (interaction.customId === 'modal_criar_xp_event') {
 await XpEventHandler.processCreateXpEvent(interaction);
 releaseLock(userId, commandKey);
 return;
 }

 // 🛒 MERCADO - Busca Avançada
 if (interaction.customId === 'market_modal_search') {
 await MarketHandler.processSearchModal(interaction);
 releaseLock(userId, commandKey);
 return;
 }
 }

 // Se chegou aqui sem fazer return, libera o lock
 releaseLock(userId, commandKey);

 } catch (error) {
 console.error('❌ Erro no handler de interações:', error);

 // Libera o lock em caso de erro
 if (userId && commandKey) {
 releaseLock(userId, commandKey);
 }

 try {
 if (interaction.isRepliable() && !interaction.replied && !interaction.deferred) {
 await interaction.reply({
 content: '❌ Ocorreu um erro inesperado. Tente novamente.',
 ephemeral: true
 });
 } else if (interaction.isRepliable() && interaction.deferred && !interaction.replied) {
 await interaction.editReply({ content: '❌ Ocorreu um erro inesperado. Tente novamente.' });
 }
 } catch (replyError) {
 console.error('❌ Não foi possível responder ao usuário:', replyError);
 }
 }
});

// EVENTO: MEMBRO SAI DO SERVIDOR
client.on(Events.GuildMemberRemove, async (member) => {
 await GuildMemberRemoveHandler.handle(member);
});

// HANDLERS DE ERROS
process.on('unhandledRejection', error => {
 console.error('❌ Unhandled promise rejection:', error);
});

process.on('uncaughtException', error => {
 console.error('❌ Uncaught exception:', error);
});

// Salvar dados antes de encerrar
process.on('SIGINT', async () => {
 console.log('\n💾 Salvando dados antes de encerrar...');
 try {
 if (!fs.existsSync('./data')) {
 fs.mkdirSync('./data', { recursive: true });
 }

 fs.writeFileSync('./data/blacklist.json', JSON.stringify([...global.blacklist], null, 2));
 fs.writeFileSync('./data/historico.json', JSON.stringify([...global.historicoRegistros], null, 2));

 const killboardConfigs = [];
 for (const [guildId, config] of global.guildConfig.entries()) {
 if (config.killboard) {
 killboardConfigs.push([guildId, config.killboard]);
 }
 }
 fs.writeFileSync('./data/killboard_config.json', JSON.stringify(killboardConfigs, null, 2));

 // 💾 BACKUP FINAL NO GOOGLE DRIVE
 if (driveBackup.initialized) {
 console.log('🔄 Realizando backup final no Google Drive...');
 await driveBackup.performBackup(false);
 }

 console.log('✅ Dados salvos com sucesso!');
 } catch (error) {
 console.error('❌ Erro ao salvar dados:', error);
 }
 process.exit();
});

process.on('SIGTERM', async () => {
 console.log('\n💾 Salvando dados antes de encerrar (SIGTERM)...');
 try {
 if (!fs.existsSync('./data')) {
 fs.mkdirSync('./data', { recursive: true });
 }

 fs.writeFileSync('./data/blacklist.json', JSON.stringify([...global.blacklist], null, 2));
 fs.writeFileSync('./data/historico.json', JSON.stringify([...global.historicoRegistros], null, 2));

 const killboardConfigs = [];
 for (const [guildId, config] of global.guildConfig.entries()) {
 if (config.killboard) {
 killboardConfigs.push([guildId, config.killboard]);
 }
 }
 fs.writeFileSync('./data/killboard_config.json', JSON.stringify(killboardConfigs, null, 2));

 // 💾 BACKUP FINAL NO GOOGLE DRIVE
 if (driveBackup.initialized) {
 console.log('🔄 Realizando backup final no Google Drive...');
 await driveBackup.performBackup(false);
 }

 console.log('✅ Dados salvos com sucesso!');
 } catch (error) {
 console.error('❌ Erro ao salvar dados:', error);
 }
 process.exit();
});

// SERVIDOR HTTP — keepalive para o deploy (Replit VM exige porta aberta)
const http = require('http');
const PORT = process.env.PORT || 3000;
http.createServer((req, res) => {
 res.writeHead(200, { 'Content-Type': 'text/plain' });
 res.end('BOT_NOTAG online\n');
}).listen(PORT, '0.0.0.0', () => {
 console.log(`🌐 Servidor keepalive rodando na porta ${PORT}`);
});

// LOGIN DO BOT
client.login(process.env.TOKEN).then(() => {
 console.log('🔐 Login realizado com sucesso');
}).catch(error => {
 console.error('❌ Erro ao fazer login:', error);
 console.error('Verifique se o TOKEN no arquivo .env está correto.');
});
