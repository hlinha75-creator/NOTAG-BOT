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
const MarketHandler = require('./handlers/marketHandler'); // 🛒 NOVO
const MarketApi = require('./handlers/albionMarketApi'); // 🛒 NOVO

// ==================== IMPORTAR COMANDOS ====================
const instalarCommand = require('./commands/instalar');
const desistalarCommand = require('./commands/desistalar');
const atualizarCommand = require('./commands/atualizar');
const limparEventosCommand = require('./commands/limpar-eventos');
const limparSaldoCommand = require('./commands/limpar-saldo');
const limparXpCommand = require('./commands/limpar-xp');
const ajudaCommand = require('./commands/ajuda');
const killboardCommand = require('./commands/killboard');

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
global.marketSearches = new Map(); // 🛒 NOVO: Armazenar buscas de mercado
global.depositTemp = new Map(); // 💵 NOVO: Temporários para sistema de depósito direto

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
 console.log('📝 Sistemas inicializados: Database + Registro + Eventos');

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
 killboardCommand.data.toJSON()
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
 // COMANDOS SLASH
 if (interaction.isChatInputCommand()) {
 const command = client.commands.get(interaction.commandName);

 if (!command) {
 console.error(`❌ Comando não encontrado: ${interaction.commandName}`);
 return;
 }

 // Verificar permissões específicas
 if (command.data.name === 'instalar' || command.data.name === 'desistalar') {
 const isADM = interaction.member.roles.cache.some(r => r.name === 'ADM') ||
 interaction.member.permissions.has(PermissionFlagsBits.Administrator);

 if (!isADM) {
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
 }
 return;
 }

 // BOTÕES
 if (interaction.isButton()) {
 const customId = interaction.customId;

 if (customId === 'confirmar_limpar_eventos' || customId === 'cancelar_limpar_eventos' ||
 customId === 'confirmar_limpar_saldo' || customId === 'cancelar_limpar_saldo' ||
 customId === 'confirmar_limpar_xp' || customId === 'cancelar_limpar_xp') {
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
 return;
 }

 if (customId === 'killboard_test_kill' || customId === 'killboard_test_death') {
 await interaction.reply({
 content: '📤 Envio de teste em desenvolvimento...',
 ephemeral: true
 });
 return;
 }

 if (customId.startsWith('killboard_refresh_')) {
 const eventId = customId.replace('killboard_refresh_', '');
 await interaction.reply({
 content: `🔄 Atualizando dados do evento ${eventId}...`,
 ephemeral: true
 });
 return;
 }

 // 🛒 MERCADO ALBION - NOVO SISTEMA DE NAVEGAÇÃO
 if (customId === 'market_browse_category') {
 await MarketHandler.handleBrowseCategory(interaction);
 return;
 }

 if (customId === 'market_search_advanced') {
 await MarketHandler.handleAdvancedSearch(interaction);
 return;
 }

 if (customId === 'market_search_again') {
 await MarketHandler.sendPanel(interaction.channel);
 await interaction.reply({ content: '🔄 Iniciando nova pesquisa...', ephemeral: true });
 return;
 }

 if (customId.startsWith('market_back_category_')) {
 const searchId = customId.replace('market_back_category_', '');
 await MarketHandler.handleBrowseCategory(interaction);
 return;
 }

 if (customId.startsWith('market_search_confirm_')) {
 const searchId = customId.replace('market_search_confirm_', '');
 await MarketHandler.executeSearch(interaction, searchId);
 return;
 }

 if (customId.startsWith('market_cancel_')) {
 const searchId = customId.replace('market_cancel_', '');
 await MarketHandler.cancelSearch(interaction, searchId);
 return;
 }

 if (customId === 'market_help') {
 await MarketHandler.showHelp(interaction);
 return;
 }

 if (customId === 'market_update_cache') {
 await MarketHandler.handleUpdateCache(interaction);
 return;
 }

 // SISTEMA DE REGISTRO
 if (customId === 'btn_abrir_registro') {
 const modal = RegistrationModal.createRegistrationModal();
 await interaction.showModal(modal);
 return;
 }

 if (customId === 'btn_tentar_novamente_registro') {
 const modal = RegistrationModal.createRegistrationModal();
 await interaction.showModal(modal);
 return;
 }

 if (customId.startsWith('aprovar_membro_')) {
 const regId = customId.replace('aprovar_membro_', '');
 await RegistrationActions.approveAsMember(interaction, regId);
 return;
 }

 if (customId.startsWith('aprovar_alianca_')) {
 const regId = customId.replace('aprovar_alianca_', '');
 await RegistrationActions.approveAsAlianca(interaction, regId);
 return;
 }

 if (customId.startsWith('aprovar_convidado_')) {
 const regId = customId.replace('aprovar_convidado_', '');
 await RegistrationActions.approveAsConvidado(interaction, regId);
 return;
 }

 if (customId.startsWith('recusar_registro_')) {
 const regId = customId.replace('recusar_registro_', '');
 await RegistrationActions.handleRejectRegistration(interaction, regId);
 return;
 }

 if (customId.startsWith('blacklist_add_')) {
 const regId = customId.replace('blacklist_add_', '');
 await RegistrationActions.handleBlacklistAdd(interaction, regId);
 return;
 }

 // SISTEMA DE EVENTOS
 if (customId === 'btn_criar_evento') {
 const modal = EventPanel.createEventModal();
 await interaction.showModal(modal);
 return;
 }

 if (customId === 'btn_raid_avalon') {
 const modal = EventPanel.createRaidAvalonModal();
 await interaction.showModal(modal);
 return;
 }

 if (customId === 'btn_gank' || customId === 'btn_cta') {
 await interaction.reply({
 content: '🔒 Este recurso estará disponível em breve!',
 ephemeral: true
 });
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
 return;
 }

 if (customId.startsWith('raid_iniciar_')) {
 const raidId = customId.replace('raid_iniciar_', '');
 await RaidAvalonHandler.handleIniciar(interaction, raidId);
 return;
 }

 if (customId.startsWith('raid_finalizar_')) {
 const raidId = customId.replace('raid_finalizar_', '');
 await RaidAvalonHandler.handleFinalizar(interaction, raidId);
 return;
 }

 if (customId.startsWith('raid_cancelar_')) {
 const raidId = customId.replace('raid_cancelar_', '');
 await RaidAvalonHandler.handleCancelar(interaction, raidId);
 return;
 }

 // SISTEMA DE EVENTOS - Ações
 if (customId.startsWith('evt_participar_')) {
 const eventId = customId.replace('evt_participar_', '');
 await EventHandler.handleParticipar(interaction, eventId);
 return;
 }

 if (customId.startsWith('evt_iniciar_')) {
 const eventId = customId.replace('evt_iniciar_', '');
 await EventHandler.handleIniciar(interaction, eventId);
 return;
 }

 if (customId.startsWith('evt_pausar_global_')) {
 const eventId = customId.replace('evt_pausar_global_', '');
 await EventHandler.handlePausarGlobal(interaction, eventId, true);
 return;
 }

 if (customId.startsWith('evt_retomar_global_')) {
 const eventId = customId.replace('evt_retomar_global_', '');
 await EventHandler.handlePausarGlobal(interaction, eventId, false);
 return;
 }

 if (customId.startsWith('evt_pausar_')) {
 const eventId = customId.replace('evt_pausar_', '');
 await EventHandler.handlePausar(interaction, eventId);
 return;
 }

 if (customId.startsWith('evt_trancar_')) {
 const eventId = customId.replace('evt_trancar_', '');
 await EventHandler.handleTrancar(interaction, eventId);
 return;
 }

 if (customId.startsWith('evt_cancelar_')) {
 const eventId = customId.replace('evt_cancelar_', '');
 await EventHandler.handleCancelar(interaction, eventId);
 return;
 }

 if (customId.startsWith('evt_finalizar_')) {
 const eventId = customId.replace('evt_finalizar_', '');
 await EventHandler.handleFinalizar(interaction, eventId);
 return;
 }

 // LOOTSPLIT
 if (customId.startsWith('loot_simular_')) {
 const eventId = customId.replace('loot_simular_', '');
 const modal = LootSplitHandler.createSimulationModal(eventId);
 await interaction.showModal(modal);
 return;
 }

 if (customId.startsWith('loot_enviar_')) {
 const simulationId = customId.replace('loot_enviar_', '');
 await LootSplitHandler.handleEnviar(interaction, simulationId);
 return;
 }

 if (customId.startsWith('loot_recalcular_')) {
 const simulationId = customId.replace('loot_recalcular_', '');
 await LootSplitHandler.handleRecalcular(interaction, simulationId);
 return;
 }

 if (customId.startsWith('fin_aprovar_')) {
 const simulationId = customId.replace('fin_aprovar_', '');
 await LootSplitHandler.handleAprovacaoFinanceira(interaction, simulationId, true);
 return;
 }

 if (customId.startsWith('fin_recusar_')) {
 const simulationId = customId.replace('fin_recusar_', '');
 await LootSplitHandler.handleAprovacaoFinanceira(interaction, simulationId, false);
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
 return;
 }

 // DEPÓSITO - Sistema Antigo (mantido para compatibilidade)
 if (customId === 'btn_deposito_novo') {
 await DepositHandler.handleDepositoButton(interaction);
 return;
 }

 if (customId === 'btn_historico_depositos') {
 await DepositHandler.showHistorico(interaction);
 return;
 }

 if (customId === 'btn_ajuda_deposito') {
 await DepositHandler.showAjuda(interaction);
 return;
 }

 // 💵 NOVO SISTEMA DE DEPÓSITO - FLUXO DE SELEÇÃO DE USUÁRIOS
 if (customId === 'dep_select_users') {
 await DepositHandler.openUserSelection(interaction);
 return;
 }

 if (customId === 'dep_clear_users') {
 await DepositHandler.clearUserSelection(interaction);
 return;
 }

 if (customId === 'dep_proceed_to_modal') {
 await DepositHandler.openValorModal(interaction);
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
 return interaction.reply({ content: '❌ Apenas tesoureiros podem aprovar depósitos!', ephemeral: true });
 }

 await DepositHandler.handleAprovacao(interaction, depositId, userId, valor, true);
 return;
 }

 if (customId.startsWith('dep_recusar_')) {
 const depositId = customId.replace('dep_recusar_', '');
 const isTesoureiro = interaction.member.roles.cache.some(r => r.name === 'tesoureiro') ||
 interaction.member.roles.cache.some(r => r.name === 'ADM') ||
 interaction.member.permissions.has(PermissionFlagsBits.Administrator);

 if (!isTesoureiro) {
 return interaction.reply({ content: '❌ Apenas tesoureiros podem recusar depósitos!', ephemeral: true });
 }

 await DepositHandler.handleAprovacao(interaction, depositId, null, null, false);
 return;
 }

 if (customId.startsWith('dep_verificar_')) {
 const comprovante = customId.replace('dep_verificar_', '');
 await interaction.reply({ content: `📎 **Comprovante:** ${comprovante}`, ephemeral: true });
 return;
 }

 // CONSULTAR SALDO
 if (customId === 'btn_consultar_saldo') {
 await ConsultarSaldoHandler.handleConsultarSaldo(interaction);
 return;
 }

 if (customId === 'btn_sacar_saldo') {
 await ConsultarSaldoHandler.handleSacarSaldo(interaction);
 return;
 }

 if (customId === 'btn_solicitar_emprestimo') {
 await ConsultarSaldoHandler.handleSolicitarEmprestimo(interaction);
 return;
 }

 if (customId === 'btn_transferir_saldo') {
 await ConsultarSaldoHandler.handleTransferirSaldo(interaction);
 return;
 }

 // FINANCEIRO
 if (customId.startsWith('fin_confirmar_saque_')) {
 const withdrawalId = customId.replace('fin_confirmar_saque_', '');
 await FinanceHandler.handleConfirmWithdrawal(interaction, withdrawalId);
 return;
 }

 if (customId.startsWith('fin_recusar_saque_')) {
 const withdrawalId = customId.replace('fin_recusar_saque_', '');
 await FinanceHandler.handleRejectWithdrawal(interaction, withdrawalId);
 return;
 }

 if (customId.startsWith('fin_confirmar_emprestimo_')) {
 const loanId = customId.replace('fin_confirmar_emprestimo_', '');
 await FinanceHandler.handleConfirmLoan(interaction, loanId);
 return;
 }

 if (customId.startsWith('fin_recusar_emprestimo_')) {
 const loanId = customId.replace('fin_recusar_emprestimo_', '');
 await FinanceHandler.handleRejectLoan(interaction, loanId);
 return;
 }

 if (customId.startsWith('transf_aceitar_')) {
 const transferId = customId.replace('transf_aceitar_', '');
 await FinanceHandler.handleAcceptTransfer(interaction, transferId);
 return;
 }

 if (customId.startsWith('transf_recusar_')) {
 const transferId = customId.replace('transf_recusar_', '');
 await FinanceHandler.handleRejectTransfer(interaction, transferId);
 return;
 }

 // ALBION ACADEMY / PERFIL
 if (customId === 'btn_criar_xp_event') {
 await XpEventHandler.showCreateEventModal(interaction);
 return;
 }

 if (customId === 'btn_depositar_xp_manual') {
 await PerfilHandler.showDepositXpModal(interaction);
 return;
 }

 if (customId === 'xp_select_users') {
 await PerfilHandler.openUserSelection(interaction);
 return;
 }

 if (customId === 'xp_clear_users') {
 await PerfilHandler.clearUserSelection(interaction);
 return;
 }

 if (customId === 'xp_proceed_to_modal') {
 await PerfilHandler.createManualXpModal(interaction);
 return;
 }

 if (customId === 'btn_ver_perfil') {
 await PerfilHandler.showProfile(interaction);
 return;
 }

 if (customId === 'btn_depositar_orb') {
 await OrbHandler.showUserSelect(interaction);
 return;
 }

 // ORB HANDLERS
 if (customId === 'orb_select_users') {
 await OrbHandler.openUserSelection(interaction);
 return;
 }

 if (customId === 'orb_clear_users') {
 await OrbHandler.clearUserSelection(interaction);
 return;
 }

 if (customId === 'orb_proceed_to_modal') {
 await OrbHandler.openOrbModal(interaction);
 return;
 }

 if (customId.startsWith('orb_approve_')) {
 const depositId = customId.replace('orb_approve_', '');
 await OrbHandler.approveOrb(interaction, depositId);
 return;
 }

 if (customId.startsWith('orb_reject_')) {
 const depositId = customId.replace('orb_reject_', '');
 await OrbHandler.rejectOrb(interaction, depositId);
 return;
 }

 // LISTA DE MEMBROS
 if (customId === 'btn_atualizar_lista_membros') {
 await interaction.deferUpdate();
 const MemberListPanel = require('./handlers/memberListPanel');
 await MemberListPanel.handleAtualizar(interaction);
 return;
 }

 if (customId === 'btn_mlist_atualizar') {
 const MemberListPanel = require('./handlers/memberListPanel');
 await MemberListPanel.handleAtualizar(interaction);
 return;
 }

 if (customId === 'btn_mlist_ver_lista') {
 const MemberListPanel = require('./handlers/memberListPanel');
 const members = Array.from((await interaction.guild.members.fetch()).values());
 await MemberListPanel.showMemberPage(interaction, members, 1, Math.ceil(members.length/10), 'all');
 return;
 }

 if (customId.startsWith('btn_mlist_page_')) {
 const MemberListPanel = require('./handlers/memberListPanel');
 if (customId.includes('next')) {
 await MemberListPanel.handlePageNavigation(interaction, 'next');
 } else if (customId.includes('prev')) {
 await MemberListPanel.handlePageNavigation(interaction, 'prev');
 }
 return;
 }

 if (customId === 'btn_mlist_voltar_resumo') {
 const MemberListPanel = require('./handlers/memberListPanel');
 await MemberListPanel.handleVoltarResumo(interaction);
 return;
 }

 if (customId === 'btn_mlist_stats') {
 const MemberListPanel = require('./handlers/memberListPanel');
 await MemberListPanel.handleStatsDetailed(interaction);
 return;
 }

 if (customId === 'btn_mlist_export') {
 const MemberListPanel = require('./handlers/memberListPanel');
 await MemberListPanel.handleExport(interaction);
 return;
 }

 // ESTATÍSTICAS DE EVENTOS
 if (customId === 'btn_eventos_atualizar') {
 const EventStatsHandler = require('./handlers/eventStatsHandler');
 await EventStatsHandler.handleAtualizar(interaction);
 return;
 }

 if (customId === 'btn_eventos_exportar') {
 await interaction.reply({ content: '⏳ Exportação de dados em desenvolvimento...', ephemeral: true });
 return;
 }

 if (customId === 'btn_eventos_ajuda') {
 await interaction.reply({ content: '❓ **Painel de Eventos**\n\nUse os menus acima para filtrar eventos por período ou cargo.', ephemeral: true });
 return;
 }

 // CONFIGURAÇÕES
 if (customId === 'config_taxa_guilda') {
 await ConfigActions.handleTaxaGuilda(interaction);
 return;
 }

 if (customId === 'config_registrar_guilda') {
 await ConfigActions.handleRegistrarGuilda(interaction);
 return;
 }

 if (customId === 'config_xp') {
 await ConfigActions.handleXP(interaction);
 return;
 }

 if (customId === 'config_taxa_bau') {
 await ConfigActions.handleTaxaBau(interaction);
 return;
 }

 if (customId === 'config_taxa_emprestimo') {
 await ConfigActions.handleTaxaEmprestimo(interaction);
 return;
 }

 if (customId === 'config_atualizar_bot') {
 await ConfigActions.handleAtualizarBot(interaction);
 return;
 }

 if (customId.startsWith('confirmar_guilda_')) {
 const parts = customId.replace('confirmar_guilda_', '').split('_');
 const server = parts[0];
 const guildName = parts.slice(1).join('_');
 await ConfigActions.confirmarGuildaRegistro(interaction, server, guildName);
 return;
 }

 if (customId === 'cancelar_guilda_registro') {
 await ConfigActions.cancelarGuildaRegistro(interaction);
 return;
 }

 if (customId.startsWith('xp_event_ver_progresso_')) {
 const eventId = customId.replace('xp_event_ver_progresso_', '');
 await XpEventHandler.handleVerProgresso(interaction, eventId);
 return;
 }

 if (customId.startsWith('xp_event_atualizar_')) {
 const eventId = customId.replace('xp_event_atualizar_', '');
 await XpEventHandler.handleAtualizarProgresso(interaction, eventId);
 return;
 }

 if (customId.startsWith('xp_event_finalizar_')) {
 const eventId = customId.replace('xp_event_finalizar_', '');
 await XpEventHandler.finalizarXpEvent(interaction, eventId);
 return;
 }

 if (customId.startsWith('xp_event_cancelar_')) {
 const eventId = customId.replace('xp_event_cancelar_', '');
 await XpEventHandler.cancelarXpEvent(interaction, eventId);
 return;
 }
 }

 // SELECT MENUS
 if (interaction.isStringSelectMenu()) {
 if (interaction.customId === 'select_server_registro') {
 await RegistrationModal.processServerSelect(interaction);
 return;
 }

 if (interaction.customId === 'select_platform_registro') {
 await RegistrationModal.processPlatformSelect(interaction, client);
 return;
 }

 if (interaction.customId === 'select_taxa_guilda') {
 await ConfigActions.handleTaxaSelect(interaction);
 return;
 }

 if (interaction.customId === 'select_orb_type') {
 const orbType = interaction.values[0];
 if (!global.orbTemp) global.orbTemp = new Map();
 global.orbTemp.set(interaction.user.id, { orbType });
 await OrbHandler.showOrbTypeSelect(interaction);
 return;
 }

 if (interaction.customId === 'select_periodo_eventos') {
 const EventStatsHandler = require('./handlers/eventStatsHandler');
 await EventStatsHandler.handlePeriodSelect(interaction);
 return;
 }

 if (interaction.customId === 'select_cargo_eventos') {
 const EventStatsHandler = require('./handlers/eventStatsHandler');
 await EventStatsHandler.handleRoleSelect(interaction);
 return;
 }

 if (interaction.customId === 'mlist_filter_cargo') {
 const MemberListPanel = require('./handlers/memberListPanel');
 await MemberListPanel.handleFilterSelect(interaction);
 return;
 }

 if (interaction.customId === 'mlist_sort_by') {
 const MemberListPanel = require('./handlers/memberListPanel');
 await MemberListPanel.handleSortSelect(interaction);
 return;
 }

 if (interaction.customId.startsWith('raid_select_class_')) {
 const raidId = interaction.customId.replace('raid_select_class_', '');
 const classKey = interaction.values[0];
 await RaidAvalonHandler.showWeaponSelect(interaction, raidId, classKey);
 return;
 }

 if (interaction.customId.startsWith('raid_select_weapon_')) {
 const parts = interaction.customId.replace('raid_select_weapon_', '').split('_');
 const raidId = parts[0] + '_' + parts[1] + '_' + parts[2];
 const classKey = parts[3];
 const weaponKey = interaction.values[0];
 await RaidAvalonHandler.processWeaponSelect(interaction, raidId, classKey, weaponKey);
 return;
 }

 if (interaction.customId === 'select_server_guilda') {
 await ConfigActions.processGuildaServerSelect(interaction);
 return;
 }

 if (interaction.customId === 'select_orb_users') {
 await OrbHandler.processUserSelection(interaction);
 return;
 }

 if (interaction.customId === 'ajuda_menu') {
 return;
 }

 // 🛒 MERCADO - Navegação por Categoria
 if (interaction.customId.startsWith('market_select_category_')) {
 const searchId = interaction.customId.replace('market_select_category_', '');
 const category = interaction.values[0];
 await MarketHandler.showCategoryItems(interaction, category, searchId);
 return;
 }

 if (interaction.customId.startsWith('market_select_item_')) {
 const searchId = interaction.customId.replace('market_select_item_', '');
 const itemId = interaction.values[0];
 await MarketHandler.showItemFilters(interaction, itemId, searchId);
 return;
 }

 if (interaction.customId.startsWith('market_filter_tier_')) {
 const searchId = interaction.customId.replace('market_filter_tier_', '');
 const tier = interaction.values[0];
 await MarketHandler.updateFilter(interaction, 'tier', searchId, tier);
 return;
 }

 if (interaction.customId.startsWith('market_filter_enchant_')) {
 const searchId = interaction.customId.replace('market_filter_enchant_', '');
 const enchant = interaction.values[0];
 await MarketHandler.updateFilter(interaction, 'enchant', searchId, enchant);
 return;
 }

 if (interaction.customId.startsWith('market_filter_quality_')) {
 const searchId = interaction.customId.replace('market_filter_quality_', '');
 const quality = interaction.values[0];
 await MarketHandler.updateFilter(interaction, 'quality', searchId, quality);
 return;
 }
 }

 // USER SELECT MENUS
 if (interaction.isUserSelectMenu()) {
 if (interaction.customId === 'select_xp_target_users') {
 await PerfilHandler.processUserSelection(interaction);
 return;
 }

 if (interaction.customId === 'select_xp_target_user') {
 const targetUserId = interaction.values[0];
 await PerfilHandler.createManualXpModal(interaction, targetUserId);
 return;
 }

 if (interaction.customId === 'select_orb_users') {
 await OrbHandler.processUserSelection(interaction);
 return;
 }

 // 💵 NOVO: DEPÓSITO - Seleção de usuários
 if (interaction.customId === 'dep_select_users_menu') {
 await DepositHandler.processUserSelection(interaction);
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
 return;
 }

 await RegistrationModal.processRegistration(interaction, client);
 return;
 }

 if (interaction.customId.startsWith('modal_recusar_registro_')) {
 const regId = interaction.customId.replace('modal_recusar_registro_', '');
 await RegistrationActions.processRejectionWithReason(interaction, regId);
 return;
 }

 if (interaction.customId.startsWith('modal_blacklist_')) {
 const regId = interaction.customId.replace('modal_blacklist_', '');
 await RegistrationActions.processBlacklistAdd(interaction, regId);
 return;
 }

 if (interaction.customId === 'modal_criar_evento') {
 await EventHandler.createEvent(interaction);
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
 return;
 } catch (error) {
 console.error('[Index] Error processing raid modal:', error);
 await interaction.reply({ content: '❌ Erro ao processar formulário da raid.', ephemeral: true });
 return;
 }
 }

 if (interaction.customId.startsWith('raid_limit_')) {
 const classKey = interaction.customId.replace('raid_limit_', '');
 await RaidAvalonHandler.processClassLimit(interaction, classKey);
 return;
 }

 if (interaction.customId.startsWith('modal_simular_evento_')) {
 const eventId = interaction.customId.replace('modal_simular_evento_', '');
 await LootSplitHandler.processSimulation(interaction, eventId);
 return;
 }

 // 💵 DEPÓSITO - Novo fluxo (valor normal, sem milhões)
 if (interaction.customId === 'modal_deposito_valor') {
 await DepositHandler.processDeposito(interaction);
 return;
 }

 if (interaction.customId === 'modal_sacar_saldo') {
 await FinanceHandler.processWithdrawRequest(interaction);
 return;
 }

 if (interaction.customId === 'modal_solicitar_emprestimo') {
 await FinanceHandler.processLoanRequest(interaction);
 return;
 }

 if (interaction.customId === 'modal_transferir_saldo') {
 await FinanceHandler.processTransferRequest(interaction);
 return;
 }

 if (interaction.customId.startsWith('modal_motivo_recusa_saque_')) {
 const withdrawalId = interaction.customId.replace('modal_motivo_recusa_saque_', '');
 await FinanceHandler.processWithdrawalRejection(interaction, withdrawalId);
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
 return;
 }

 if (interaction.customId === 'modal_depositar_xp_multi') {
 await PerfilHandler.processManualXpDeposit(interaction);
 return;
 }

 if (interaction.customId.startsWith('modal_depositar_xp_')) {
 const targetUserId = interaction.customId.replace('modal_depositar_xp_', '');
 await PerfilHandler.processManualXpDeposit(interaction, targetUserId);
 return;
 }

 if (interaction.customId.startsWith('modal_depositar_orb_')) {
 await OrbHandler.processOrbDeposit(interaction);
 return;
 }

 if (interaction.customId === 'modal_taxa_guilda') {
 await ConfigActions.handleTaxaSelect(interaction);
 return;
 }

 if (interaction.customId === 'modal_taxas_bau') {
 await ConfigActions.processTaxaBau(interaction);
 return;
 }

 if (interaction.customId === 'modal_taxa_emprestimo') {
 await ConfigActions.processTaxaEmprestimo(interaction);
 return;
 }

 if (interaction.customId === 'modal_registrar_guilda_nome') {
 await ConfigActions.processGuildaNome(interaction);
 return;
 }

 if (interaction.customId === 'modal_criar_xp_event') {
 await XpEventHandler.processCreateXpEvent(interaction);
 return;
 }

 // 🛒 MERCADO - Busca Avançada
 if (interaction.customId === 'market_modal_search') {
 await MarketHandler.processSearchModal(interaction);
 return;
 }
 }

 } catch (error) {
 console.error('❌ Erro no handler de interações:', error);

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

 console.log('✅ Dados salvos com sucesso!');
 } catch (error) {
 console.error('❌ Erro ao salvar dados:', error);
 }
 process.exit();
});

// LOGIN DO BOT
client.login(process.env.TOKEN).then(() => {
 console.log('🔐 Login realizado com sucesso');
}).catch(error => {
 console.error('❌ Erro ao fazer login:', error);
 console.error('Verifique se o TOKEN no arquivo .env está correto.');
});