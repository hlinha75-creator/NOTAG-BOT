const {
 EmbedBuilder,
 ActionRowBuilder,
 ButtonBuilder,
 ButtonStyle,
 ChannelType,
 PermissionFlagsBits
} = require('discord.js');
const https = require('https');
const AlbionAPI = require('./albionApi');

/**
 * Sistema de Killboard - Monitora kills e deaths da guilda
 * Features:
 * - Polling automático a cada 30s
 * - Imagens de equipamentos via render.albiononline.com
 * - Cálculo de valores via Albion Data Project
 * - Cache anti-duplicados
 * - Canais separados para kills e deaths
 */
class KillboardHandler {
 constructor() {
 this.pollingIntervals = new Map(); // guildId -> interval
 this.lastEventIds = new Map(); // guildId -> Set(eventIds)
 this.processedEvents = new Map(); // guildId -> Map(eventId -> timestamp)
 this.maxCacheSize = 1000; // Manter últimos 1000 eventos em cache
 }

 /**
 * Inicializa o sistema de killboard para uma guilda
 */
 async initialize(guild, config = {}) {
 try {
 const guildId = guild.id;

 // Configurações padrão
 const killboardConfig = {
 enabled: true,
 killChannelId: null,
 deathChannelId: null,
 guildIdAlbion: null, // ID da guilda no Albion Online
 allianceId: null, // ID da aliança (opcional)
 trackKills: true,
 trackDeaths: true,
 minFame: 0, // Fama mínima para notificar
 showInventory: true,
 showGear: true,
 language: 'pt',
 ...config
 };

 // Criar canais se não existirem
 if (!killboardConfig.killChannelId) {
 const killChannel = await this.createKillChannel(guild);
 killboardConfig.killChannelId = killChannel.id;
 }

 if (!killboardConfig.deathChannelId) {
 const deathChannel = await this.createDeathChannel(guild);
 killboardConfig.deathChannelId = deathChannel.id;
 }

 // Salvar configuração
 if (!global.guildConfig) global.guildConfig = new Map();
 const currentConfig = global.guildConfig.get(guildId) || {};
 global.guildConfig.set(guildId, {
 ...currentConfig,
 killboard: killboardConfig
 });

 // Iniciar polling se tiver guilda do Albion configurada
 if (killboardConfig.guildIdAlbion) {
 this.startPolling(guildId, killboardConfig);
 }

 console.log(`[Killboard] Inicializado para guild ${guildId}`);
 return killboardConfig;
 } catch (error) {
 console.error('[Killboard] Erro na inicialização:', error);
 throw error;
 }
 }

 /**
 * Cria canal de kills
 */
 async createKillChannel(guild) {
 try {
 const channel = await guild.channels.create({
 name: '💀-kill-feed',
 type: ChannelType.GuildText,
 topic: '💀 Kills da Guilda - Monitoramento automático',
 permissionOverwrites: [
 {
 id: guild.id,
 allow: [PermissionFlagsBits.ViewChannel],
 deny: [PermissionFlagsBits.SendMessages]
 }
 ]
 });
 console.log(`[Killboard] Canal de kills criado: ${channel.id}`);
 return channel;
 } catch (error) {
 console.error('[Killboard] Erro ao criar canal de kills:', error);
 throw error;
 }
 }

 /**
 * Cria canal de deaths
 */
 async createDeathChannel(guild) {
 try {
 const channel = await guild.channels.create({
 name: '☠️-death-feed',
 type: ChannelType.GuildText,
 topic: '☠️ Mortes da Guilda - Monitoramento automático',
 permissionOverwrites: [
 {
 id: guild.id,
 allow: [PermissionFlagsBits.ViewChannel],
 deny: [PermissionFlagsBits.SendMessages]
 }
 ]
 });
 console.log(`[Killboard] Canal de deaths criado: ${channel.id}`);
 return channel;
 } catch (error) {
 console.error('[Killboard] Erro ao criar canal de deaths:', error);
 throw error;
 }
 }

 /**
 * Configura o ID da guilda do Albion
 */
 async setGuildId(guildId, albionGuildId) {
 try {
 const config = global.guildConfig?.get(guildId)?.killboard || {};
 config.guildIdAlbion = albionGuildId;

 // Buscar dados da guilda para confirmar
 const guildData = await AlbionAPI.getGuildInfo(albionGuildId);
 if (guildData) {
 config.allianceId = guildData.AllianceId;
 }

 // Atualizar config
 const currentConfig = global.guildConfig.get(guildId) || {};
 global.guildConfig.set(guildId, {
 ...currentConfig,
 killboard: config
 });

 // Reiniciar polling
 this.stopPolling(guildId);
 this.startPolling(guildId, config);

 return guildData;
 } catch (error) {
 console.error('[Killboard] Erro ao configurar guilda:', error);
 throw error;
 }
 }

 /**
 * Inicia o polling de eventos
 */
 startPolling(guildId, config) {
 if (this.pollingIntervals.has(guildId)) {
 clearInterval(this.pollingIntervals.get(guildId));
 }

 console.log(`[Killboard] Iniciando polling para guild ${guildId}`);

 // Primeira execução imediata
 this.checkNewEvents(guildId, config);

 // Polling a cada 30 segundos
 const interval = setInterval(() => {
 this.checkNewEvents(guildId, config);
 }, 30000);

 this.pollingIntervals.set(guildId, interval);
 }

 /**
 * Para o polling
 */
 stopPolling(guildId) {
 if (this.pollingIntervals.has(guildId)) {
 clearInterval(this.pollingIntervals.get(guildId));
 this.pollingIntervals.delete(guildId);
 console.log(`[Killboard] Polling parado para guild ${guildId}`);
 }
 }

 /**
 * Verifica novos eventos na API
 */
 async checkNewEvents(guildId, config) {
 try {
 if (!config.guildIdAlbion) return;

 const client = global.client;
 const guild = client.guilds.cache.get(guildId);
 if (!guild) return;

 // Buscar últimos eventos da guilda
 const events = await this.fetchGuildEvents(config.guildIdAlbion, 50);
 if (!events || events.length === 0) return;

 // Inicializar cache se necessário
 if (!this.processedEvents.has(guildId)) {
 this.processedEvents.set(guildId, new Map());
 }
 const guildCache = this.processedEvents.get(guildId);

 // Processar cada evento
 for (const event of events) {
 // Verificar se já processamos este evento (últimas 24h)
 if (guildCache.has(event.EventId)) continue;

 // Adicionar ao cache
 guildCache.set(event.EventId, Date.now());

 // Limpar cache antigo (manter apenas últimos 1000)
 if (guildCache.size > this.maxCacheSize) {
 const oldestKey = guildCache.keys().next().value;
 guildCache.delete(oldestKey);
 }

 // Verificar se é kill ou death da nossa guilda
 const isOurGuildKill = event.Killer?.GuildId === config.guildIdAlbion;
 const isOurGuildDeath = event.Victim?.GuildId === config.guildIdAlbion;

 // Se for kill da nossa guilda e estiver habilitado
 if (isOurGuildKill && config.trackKills) {
 await this.processKill(guild, event, config);
 }

 // Se for death da nossa guilda e estiver habilitado
 if (isOurGuildDeath && config.trackDeaths) {
 await this.processDeath(guild, event, config);
 }
 }
 } catch (error) {
 console.error(`[Killboard] Erro no polling da guild ${guildId}:`, error);
 }
 }

 /**
 * Busca eventos da guilda na API com retry e fallback robusto
 */
 async fetchGuildEvents(guildId, limit = 50) {
 const maxAttempts = 3;
 const timeout = 30000; // ⬅️ 30 segundos (era 10s)

 // Endpoints para fallback (Europa, Américas, Ásia)
 const endpoints = [
 'gameinfo.albiononline.com',
 'gameinfo-ams.albiononline.com',
 'gameinfo-sgp.albiononline.com'
 ];

 for (const endpoint of endpoints) {
 for (let attempt = 1; attempt <= maxAttempts; attempt++) {
 try {
 console.log(`[Killboard] Buscando eventos em ${endpoint} (tentativa ${attempt}/${maxAttempts})`);

 const result = await new Promise((resolve, reject) => {
 const options = {
 hostname: endpoint,
 path: `/api/gameinfo/events?guildId=${guildId}&limit=${limit}&offset=0`,
 method: 'GET',
 headers: {
 'Accept': 'application/json',
 'User-Agent': 'Mozilla/5.0'
 },
 timeout: timeout
 };

 const req = https.request(options, (res) => {
 let data = '';
 res.on('data', chunk => data += chunk);
 res.on('end', () => {
 try {
 if (res.statusCode === 200) {
 const json = JSON.parse(data);
 resolve({ success: true, data: json });
 } else if (res.statusCode === 404) {
 resolve({ success: true, data: [] });
 } else if (res.statusCode === 429) {
 reject({ type: 'RATE_LIMIT', status: res.statusCode });
 } else {
 reject({ type: 'HTTP_ERROR', status: res.statusCode });
 }
 } catch (e) {
 reject({ type: 'PARSE_ERROR', message: e.message });
 }
 });
 });

 req.on('timeout', () => {
 req.destroy();
 reject({ type: 'TIMEOUT', message: `Timeout após ${timeout}ms` });
 });

 req.on('error', (error) => {
 reject({ type: 'NETWORK_ERROR', message: error.message, code: error.code });
 });

 req.end();
 });

 if (result.success) {
 if (endpoint !== endpoints[0]) {
 console.log(`[Killboard] ✅ Sucesso usando endpoint alternativo: ${endpoint}`);
 }
 return result.data;
 }

 } catch (error) {
 const errorMsg = error.type || error.message || 'Erro desconhecido';
 console.error(`[Killboard] ❌ Falha em ${endpoint} (tentativa ${attempt}): ${errorMsg}`);

 // Se for rate limit, espera mais
 if (error.type === 'RATE_LIMIT') {
 await this.delay(3000);
 continue;
 }

 // Se não for última tentativa, aguarda com backoff exponencial
 if (attempt < maxAttempts) {
 const backoff = 2000 * Math.pow(2, attempt - 1); // 2s, 4s
 console.log(`[Killboard] ⏳ Aguardando ${backoff}ms antes de retry...`);
 await this.delay(backoff);
 }
 }
 }

 console.log(`[Killboard] ⚠️ Endpoint ${endpoint} falhou, tentando próximo...`);
 }

 // Todas as tentativas em todos os endpoints falharam
 console.error(`[Killboard] 🔴 Todos os endpoints falharam para guilda ${guildId}`);
 return []; // Retorna vazio para não quebrar o polling
 }

 /**
 * Delay helper
 */
 delay(ms) {
 return new Promise(resolve => setTimeout(resolve, ms));
 }

 /**
 * Processa um evento de kill
 */
 async processKill(guild, event, config) {
 try {
 const channel = guild.channels.cache.get(config.killChannelId);
 if (!channel) return;

 const embed = await this.createKillEmbed(event, config);
 const components = this.createEventComponents(event);

 await channel.send({ embeds: [embed], components });
 console.log(`[Killboard] Kill processado: ${event.EventId}`);
 } catch (error) {
 console.error('[Killboard] Erro ao processar kill:', error);
 }
 }

 /**
 * Processa um evento de death
 */
 async processDeath(guild, event, config) {
 try {
 const channel = guild.channels.cache.get(config.deathChannelId);
 if (!channel) return;

 const embed = await this.createDeathEmbed(event, config);
 const components = this.createEventComponents(event);

 await channel.send({ embeds: [embed], components });
 console.log(`[Killboard] Death processado: ${event.EventId}`);
 } catch (error) {
 console.error('[Killboard] Erro ao processar death:', error);
 }
 }

 /**
 * Cria embed para kill (verde/vitória)
 */
 async createKillEmbed(event, config) {
 const killer = event.Killer;
 const victim = event.Victim;
 const participants = event.Participants || [];
 const groupMembers = event.GroupMembers || [];

 // Calcular valores totais
 const totalVictimValue = await this.calculateTotalValue(victim.Equipment, victim.Inventory);
 const fameGained = event.TotalVictimKillFame || 0;

 const embed = new EmbedBuilder()
 .setTitle('💀 KILL CONFIRMADO')
 .setDescription(`**${killer.Name}** matou **${victim.Name}**`)
 .setColor(0x2ECC71) // Verde
 .setThumbnail(this.getItemImageUrl(killer.Equipment?.MainHand?.Type, killer.Equipment?.MainHand?.Quality))
 .setImage('https://media.discordapp.net/attachments/881536030156480552/123456789/kill_banner.png') // Opcional: banner decorativo
 .setTimestamp(new Date(event.TimeStamp))
 .setFooter({ text: `Event ID: ${event.EventId} • Albion Killboard` });

 // Informações do Killer (nosso membro)
 embed.addFields({
 name: `⚔️ ${killer.Name} ${killer.GuildName ? `[${killer.GuildName}]` : ''}`,
 value: [
 `🏆 **Fama Ganha:** ${fameGained.toLocaleString()}`,
 `⚔️ **IP Médio:** ${Math.round(killer.AverageItemPower || 0)}`,
 `👥 **Participantes:** ${participants.length}`,
 killer.AllianceName ? `🤝 **Aliança:** ${killer.AllianceName}` : ''
 ].filter(Boolean).join('\n'),
 inline: true
 });

 // Informações da Vítima
 embed.addFields({
 name: `☠️ ${victim.Name} ${victim.GuildName ? `[${victim.GuildName}]` : ''}`,
 value: [
 `💰 **Valor Total:** ${this.formatSilver(totalVictimValue)}`,
 `🛡️ **IP Médio:** ${Math.round(victim.AverageItemPower || 0)}`,
 victim.AllianceName ? `🤝 **Aliança:** ${victim.AllianceName}` : ''
 ].filter(Boolean).join('\n'),
 inline: true
 });

 // Equipamento do Killer (resumo)
 if (config.showGear) {
 const gearText = this.formatEquipment(killer.Equipment);
 if (gearText) {
 embed.addFields({
 name: '🎒 Equipamento Usado',
 value: gearText,
 inline: false
 });
 }
 }

 // Loot/Equipamento da Vítima (destaque)
 if (config.showGear) {
 const victimGearText = this.formatEquipment(victim.Equipment, true);
 if (victimGearText) {
 embed.addFields({
 name: '💎 Loot Disponível',
 value: victimGearText,
 inline: false
 });
 }
 }

 // Inventário da vítima (itens na bag)
 if (config.showInventory && victim.Inventory && victim.Inventory.length > 0) {
 const inventoryValue = await this.calculateInventoryValue(victim.Inventory);
 const inventoryText = this.formatInventory(victim.Inventory);

 embed.addFields({
 name: `🎒 Inventário (${victim.Inventory.length} itens) - ${this.formatSilver(inventoryValue)}`,
 value: inventoryText || '*Inventário vazio*',
 inline: false
 });
 }

 // Localização (se disponível)
 if (event.Location) {
 embed.addFields({
 name: '🗺️ Localização',
 value: event.Location,
 inline: true
 });
 }

 return embed;
 }

 /**
 * Cria embed para death (vermelho/derrota)
 */
 async createDeathEmbed(event, config) {
 const killer = event.Killer;
 const victim = event.Victim; // Nosso membro

 // Calcular valores totais perdidos
 const totalLostValue = await this.calculateTotalValue(victim.Equipment, victim.Inventory);
 const fameLost = event.TotalVictimKillFame || 0;

 const embed = new EmbedBuilder()
 .setTitle('☠️ MEMBRO MORTO')
 .setDescription(`**${victim.Name}** foi morto por **${killer.Name}**`)
 .setColor(0xE74C3C) // Vermelho
 .setThumbnail(this.getItemImageUrl(victim.Equipment?.MainHand?.Type, victim.Equipment?.MainHand?.Quality))
 .setTimestamp(new Date(event.TimeStamp))
 .setFooter({ text: `Event ID: ${event.EventId} • Albion Killboard` });

 // Nosso membro (vítima) - destaque
 embed.addFields({
 name: `☠️ ${victim.Name} [PERDEU]`,
 value: [
 `💰 **Valor Perdido:** ${this.formatSilver(totalLostValue)}`,
 `🏆 **Fama Perdida:** ${fameLost.toLocaleString()}`,
 `🛡️ **IP Médio:** ${Math.round(victim.AverageItemPower || 0)}`,
 victim.GuildName ? `🏰 **Guilda:** ${victim.GuildName}` : ''
 ].filter(Boolean).join('\n'),
 inline: true
 });

 // Killer (inimigo)
 embed.addFields({
 name: `⚔️ ${killer.Name} [MATOU]`,
 value: [
 `⚔️ **IP Médio:** ${Math.round(killer.AverageItemPower || 0)}`,
 killer.GuildName ? `🏰 **Guilda:** ${killer.GuildName}` : '',
 killer.AllianceName ? `🤝 **Aliança:** ${killer.AllianceName}` : ''
 ].filter(Boolean).join('\n'),
 inline: true
 });

 // Equipamento perdido (DETALHADO)
 if (config.showGear) {
 const lostGearText = this.formatEquipment(victim.Equipment, true, true);
 if (lostGearText) {
 embed.addFields({
 name: '💔 Equipamento Perdido',
 value: lostGearText,
 inline: false
 });
 }
 }

 // Inventário perdido
 if (config.showInventory && victim.Inventory && victim.Inventory.length > 0) {
 const inventoryValue = await this.calculateInventoryValue(victim.Inventory);
 const inventoryText = this.formatInventory(victim.Inventory);

 embed.addFields({
 name: `🎒 Inventário Perdido (${victim.Inventory.length} itens) - ${this.formatSilver(inventoryValue)}`,
 value: inventoryText || '*Inventário vazio*',
 inline: false
 });
 }

 // Análise de risco (opcional)
 const riskLevel = this.calculateRiskLevel(totalLostValue);
 embed.addFields({
 name: '⚠️ Nível de Risco',
 value: riskLevel,
 inline: true
 });

 return embed;
 }

 /**
 * Formata equipamento para exibição
 */
 formatEquipment(equipment, showValues = false, highlightLost = false) {
 if (!equipment) return null;

 const slots = [
 { key: 'MainHand', icon: '⚔️', name: 'Arma' },
 { key: 'OffHand', icon: '🛡️', name: 'Offhand' },
 { key: 'Head', icon: '🎩', name: 'Capacete' },
 { key: 'Armor', icon: '👕', name: 'Armadura' },
 { key: 'Shoes', icon: '👢', name: 'Botas' },
 { key: 'Cape', icon: '🦇', name: 'Capa' },
 { key: 'Mount', icon: '🐴', name: 'Montaria' },
 { key: 'Bag', icon: '🎒', name: 'Bolsa' },
 { key: 'Potion', icon: '🧪', name: 'Poção' },
 { key: 'Food', icon: '🍖', name: 'Comida' }
 ];

 const lines = [];

 for (const slot of slots) {
 const item = equipment[slot.key];
 if (item && item.Type) {
 const tier = this.getItemTier(item.Type);
 const enchant = item.Count > 1 ? `.${item.Count - 1}` : '';
 const quality = this.getQualityStars(item.Quality);
 const itemValue = showValues ? `(${this.formatSilver(this.getItemValue(item))})` : '';

 // Link para imagem do item
 const itemImage = this.getItemImageUrl(item.Type, item.Quality);

 lines.push(`${slot.icon} **${slot.name}:** ${tier}${enchant} ${quality} ${itemValue}`);
 } else if (highlightLost) {
 lines.push(`${slot.icon} **${slot.name}:** ❌ *Vazio*`);
 }
 }

 return lines.join('\n') || null;
 }

 /**
 * Formata inventário
 */
 formatInventory(inventory) {
 if (!inventory || inventory.length === 0) return null;

 const items = inventory
 .filter(item => item && item.Type)
 .slice(0, 15) // Limitar a 15 itens no embed
 .map(item => {
 const tier = this.getItemTier(item.Type);
 const count = item.Count > 1 ? ` x${item.Count}` : '';
 return `• ${tier}${count}`;
 });

 if (inventory.length > 15) {
 items.push(`... e mais ${inventory.length - 15} itens`);
 }

 return items.join('\n');
 }

 /**
 * Calcula valor total de equipamento + inventário
 */
 async calculateTotalValue(equipment, inventory) {
 let total = 0;

 // Valor do equipamento (estimativa baseada no tier/quality)
 if (equipment) {
 for (const [slot, item] of Object.entries(equipment)) {
 if (item && item.Type) {
 total += this.getItemValue(item);
 }
 }
 }

 // Valor do inventário
 if (inventory) {
 total += await this.calculateInventoryValue(inventory);
 }

 return total;
 }

 /**
 * Calcula valor do inventário
 */
 async calculateInventoryValue(inventory) {
 if (!inventory) return 0;

 let total = 0;
 for (const item of inventory) {
 if (item && item.Type) {
 total += this.getItemValue(item) * (item.Count || 1);
 }
 }
 return total;
 }

 /**
 * Estima valor de um item baseado no tier/quality
 * (Simplificado - em produção, consultar API de preços)
 */
 getItemValue(item) {
 if (!item || !item.Type) return 0;

 const tier = this.getItemTier(item.Type);
 const tierNum = parseInt(tier.replace('T', '')) || 1;
 const quality = item.Quality || 1;
 const enchant = item.Count > 1 ? (item.Count - 1) : 0;

 // Fórmula estimada (muito simplificada)
 const baseValue = Math.pow(2, tierNum) * 100;
 const qualityMultiplier = [1, 1, 1.5, 2, 2.5, 3][quality] || 1;
 const enchantMultiplier = 1 + (enchant * 0.5);

 return Math.round(baseValue * qualityMultiplier * enchantMultiplier);
 }

 /**
 * Obtém tier do item pelo ID
 */
 getItemTier(itemType) {
 if (!itemType) return 'T1';
 const match = itemType.match(/T(\d+)/);
 return match ? `T${match[1]}` : 'T1';
 }

 /**
 * Converte qualidade para estrelas
 */
 getQualityStars(quality) {
 const stars = ['', '⭐', '⭐⭐', '⭐⭐⭐', '⭐⭐⭐⭐', '⭐⭐⭐⭐⭐'];
 return stars[quality] || '';
 }

 /**
 * Formata prata (silver)
 */
 formatSilver(amount) {
 if (amount >= 1000000) {
 return `${(amount / 1000000).toFixed(1)}M 💰`;
 } else if (amount >= 1000) {
 return `${(amount / 1000).toFixed(1)}k 💰`;
 }
 return `${amount} 💰`;
 }

 /**
 * Calcula nível de risco baseado no valor perdido
 */
 calculateRiskLevel(value) {
 if (value > 10000000) return '🔴 **CRÍTICO** - Perda Mássima!';
 if (value > 5000000) return '🟠 **ALTO** - Perda Significativa';
 if (value > 1000000) return '🟡 **MÉDIO** - Perda Moderada';
 if (value > 500000) return '🟢 **BAIXO** - Perda Pequena';
 return '⚪ **MÍNIMO** - Sem grandes perdas';
 }

 /**
 * Gera URL da imagem do item
 */
 getItemImageUrl(itemType, quality = 1) {
 if (!itemType) return 'https://render.albiononline.com/v1/item/EMPTY.png';
 return `https://render.albiononline.com/v1/item/${itemType}.png?quality=${quality}&size=64`;
 }

 /**
 * Cria componentes (botões) para o evento
 */
 createEventComponents(event) {
 return new ActionRowBuilder()
 .addComponents(
 new ButtonBuilder()
 .setLabel('🔗 Ver no Albion Online')
 .setStyle(ButtonStyle.Link)
 .setURL(`https://albiononline.com/pt/killboard/kill/${event.EventId}`),
 new ButtonBuilder()
 .setLabel('🔄 Atualizar Dados')
 .setStyle(ButtonStyle.Secondary)
 .setCustomId(`killboard_refresh_${event.EventId}`)
 );
 }

 /**
 * Envia painel de configuração do killboard
 */
 async sendConfigPanel(channel) {
 const embed = new EmbedBuilder()
 .setTitle('💀 Sistema de Killboard')
 .setDescription(
 '**Monitoramento automático de Kills e Deaths**\n\n' +
 '📊 **Canais:**\n' +
 '• 💀-kill-feed - Kills da guilda\n' +
 '• ☠️-death-feed - Mortes da guilda\n\n' +
 '**Features:**\n' +
 '✅ Atualização automática a cada 30s\n' +
 '✅ Imagens de equipamentos\n' +
 '✅ Cálculo de valores\n' +
 '✅ Fama PvP\n' +
 '✅ Inventário completo\n\n' +
 '**Comandos:**\n' +
 '`/killboard config [guildId]` - Configurar guilda\n' +
 '`/killboard toggle` - Ativar/Desativar\n' +
 '`/killboard test` - Testar envio'
 )
 .setColor(0x9B59B6);

 const buttons = new ActionRowBuilder()
 .addComponents(
 new ButtonBuilder()
 .setCustomId('killboard_config')
 .setLabel('⚙️ Configurar')
 .setStyle(ButtonStyle.Primary),
 new ButtonBuilder()
 .setCustomId('killboard_test_kill')
 .setLabel('💀 Testar Kill')
 .setStyle(ButtonStyle.Success),
 new ButtonBuilder()
 .setCustomId('killboard_test_death')
 .setLabel('☠️ Testar Death')
 .setStyle(ButtonStyle.Danger)
 );

 await channel.send({ embeds: [embed], components: [buttons] });
 }
}

module.exports = new KillboardHandler();