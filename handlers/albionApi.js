const https = require('https');

/**
 * AlbionAPI - Serviço unificado de integração com Albion Online
 * Consolida: handlers/albionApi.js + services/albionApi.js
 * Melhorias: Circuit Breaker, Cache Inteligente, Multi-endpoint, Retry com Backoff
 */
class AlbionAPI {
 constructor() {
 // Múltiplos endpoints para fallback (oficiais da Sandbox Interactive)
 this.endpoints = {
 europe: 'gameinfo.albiononline.com',
 americas: 'gameinfo-ams.albiononline.com',
 asia: 'gameinfo-sgp.albiononline.com'
 };

 this.timeout = 30000; // ⬅️ AUMENTADO: 30 segundos (era 10s)
 this.maxRetries = 3;  // ⬅️ AUMENTADO: 3 tentativas (era 2)

 // Cache em memória: Map
 this.cache = new Map();
 this.cacheTTL = 60 * 60 * 1000; // 1 hora

 // Cache negativo (jogadores não encontrados)
 this.negativeCache = new Map();
 this.negativeCacheTTL = 5 * 60 * 1000; // 5 minutos

 // Circuit breaker
 this.circuitBreaker = {
 failures: 0,
 lastFailure: null,
 state: 'CLOSED',
 threshold: 5,
 timeout: 5 * 60 * 1000
 };
 }

 checkCircuitBreaker() {
 if (this.circuitBreaker.state === 'OPEN') {
 const now = Date.now();
 if (now - this.circuitBreaker.lastFailure > this.circuitBreaker.timeout) {
 console.log('🔧 Circuit Breaker: HALF_OPEN');
 this.circuitBreaker.state = 'HALF_OPEN';
 return true;
 }
 return false;
 }
 return true;
 }

 recordSuccess() {
 if (this.circuitBreaker.state === 'HALF_OPEN') {
 console.log('✅ Circuit Breaker: CLOSED');
 this.circuitBreaker.state = 'CLOSED';
 this.circuitBreaker.failures = 0;
 }
 }

 recordFailure() {
 this.circuitBreaker.failures++;
 this.circuitBreaker.lastFailure = Date.now();
 if (this.circuitBreaker.failures >= this.circuitBreaker.threshold) {
 console.error('🔴 Circuit Breaker: OPEN (5min)');
 this.circuitBreaker.state = 'OPEN';
 }
 }

 getFromCache(key) {
 const cached = this.cache.get(key);
 if (!cached) return null;
 if (Date.now() - cached.timestamp > this.cacheTTL) {
 this.cache.delete(key);
 return null;
 }
 console.log(`📦 Cache hit: "${key}"`);
 return cached.data;
 }

 setCache(key, data) {
 this.cache.set(key, { data, timestamp: Date.now() });
 }

 getFromNegativeCache(key) {
 const cached = this.negativeCache.get(key);
 if (!cached) return null;
 if (Date.now() - cached.timestamp > this.negativeCacheTTL) {
 this.negativeCache.delete(key);
 return null;
 }
 return true; // Já sabemos que não existe
 }

 setNegativeCache(key) {
 this.negativeCache.set(key, { timestamp: Date.now() });
 }

 cleanupCache() {
 const now = Date.now();
 for (const [key, value] of this.cache.entries()) {
 if (now - value.timestamp > this.cacheTTL) this.cache.delete(key);
 }
 for (const [key, value] of this.negativeCache.entries()) {
 if (now - value.timestamp > this.negativeCacheTTL) this.negativeCache.delete(key);
 }
 }

 /**
  * ⬇️ MÉTODO MELHORADO: Com timeout maior e tratamento robusto
  */
 makeRequest(hostname, path, attempt = 1) {
 return new Promise((resolve, reject) => {
 console.log(`🌐 [AlbionAPI] Request: ${hostname}${path} (tentativa ${attempt})`);

 const options = {
 hostname: hostname,
 path: path,
 method: 'GET',
 headers: {
 'Accept': 'application/json',
 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
 },
 timeout: this.timeout // ⬅️ Usa o timeout de 30s da classe
 };

 const req = https.request(options, (res) => {
 let data = '';
 res.on('data', (chunk) => data += chunk);
 res.on('end', () => {
 try {
 if (res.statusCode === 200) {
 resolve({ success: true, data: JSON.parse(data) });
 } else if (res.statusCode === 429) {
 reject({ type: 'RATE_LIMIT', message: 'Rate limit atingido', status: 429 });
 } else if (res.statusCode === 503 || res.statusCode === 502) {
 reject({ type: 'SERVICE_UNAVAILABLE', message: `Serviço indisponível (${res.statusCode})`, status: res.statusCode });
 } else {
 reject({ type: 'HTTP_ERROR', message: `HTTP ${res.statusCode}`, status: res.statusCode });
 }
 } catch (error) {
 reject({ type: 'PARSE_ERROR', message: `Erro ao parsear JSON: ${error.message}` });
 }
 });
 });

 // ⬇️ TRATAMENTO MELHORADO DE ERROS DE CONEXÃO
 req.on('error', (error) => {
 console.error(`❌ [AlbionAPI] Network error (${hostname}):`, error.message);
 reject({ type: 'NETWORK_ERROR', message: error.message, code: error.code });
 });

 req.on('timeout', () => {
 console.error(`⏱️ [AlbionAPI] Timeout (${hostname}): ${this.timeout}ms excedido`);
 req.destroy();
 reject({ type: 'TIMEOUT', message: `Timeout após ${this.timeout}ms` });
 });

 req.end();
 });
 }

 /**
  * ⬇️ NOVO MÉTODO: Retry com fallback para múltiplos endpoints
  */
 async makeRequestWithRetry(path, preferredServer = 'europe') {
 const endpointsToTry = [
 this.endpoints[preferredServer] || this.endpoints.europe,
 ...Object.values(this.endpoints).filter(e => e !== (this.endpoints[preferredServer] || this.endpoints.europe))
 ];

 let lastError = null;

 for (const endpoint of endpointsToTry) {
 for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
 try {
 const result = await this.makeRequest(endpoint, path, attempt);
 if (result.success) {
 this.recordSuccess();
 return result.data;
 }
 } catch (error) {
 lastError = error;
 console.error(`❌ [AlbionAPI] Falha ${endpoint} tentativa ${attempt}:`, error.type || error.message);

 // Se for rate limit, espera mais tempo
 if (error.type === 'RATE_LIMIT') {
 await this.delay(3000 * attempt);
 continue;
 }

 // Se for timeout ou erro de rede, tenta novamente com backoff
 if (error.type === 'TIMEOUT' || error.type === 'NETWORK_ERROR') {
 if (attempt < this.maxRetries) {
 const backoff = 2000 * Math.pow(2, attempt - 1); // 2s, 4s, 8s
 console.log(`⏳ [AlbionAPI] Aguardando ${backoff}ms antes de retry...`);
 await this.delay(backoff);
 continue;
 }
 }

 // Erros HTTP 5xx devem tentar endpoint alternativo imediatamente
 if (error.status >= 500) {
 break; // Sai do loop de retry e vai para próximo endpoint
 }
 }
 }
 }

 // Todas as tentativas falharam
 this.recordFailure();
 throw lastError || new Error('Todas as tentativas falharam');
 }

 /**
  * Faz uma requisição com timeout customizado (para buscas rápidas)
  */
 makeRequestFast(hostname, path, timeout = 8000) {
 return new Promise((resolve, reject) => {
 const options = {
 hostname,
 path,
 method: 'GET',
 headers: {
 'Accept': 'application/json',
 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
 },
 timeout
 };

 const req = https.request(options, (res) => {
 let data = '';
 res.on('data', chunk => data += chunk);
 res.on('end', () => {
 try {
 if (res.statusCode === 200) {
 resolve(JSON.parse(data));
 } else {
 reject(new Error(`HTTP ${res.statusCode}`));
 }
 } catch (e) {
 reject(new Error(`Parse error: ${e.message}`));
 }
 });
 });

 req.on('timeout', () => { req.destroy(); reject(new Error('Timeout')); });
 req.on('error', e => reject(new Error(`Network: ${e.message}`)));
 req.end();
 });
 }

 /**
  * Busca jogador em TODOS os 3 servidores em paralelo.
  * Retorna o primeiro resultado válido encontrado.
  * Evita o problema de esperar timeout de um servidor antes de tentar outro.
  */
 async searchPlayerParallel(playerName) {
 const encodedName = encodeURIComponent(playerName);
 const path = `/api/gameinfo/search?q=${encodedName}`;

 console.log(`🔍 [AlbionAPI] Buscando "${playerName}" em paralelo nos 3 servidores...`);

 // Lança busca simultânea nos 3 servidores — retorna o primeiro que encontrar
 const serverPromises = Object.entries(this.endpoints).map(([serverName, hostname]) =>
 this.makeRequestFast(hostname, path, 8000)
 .then(data => {
 const playerData = this.processPlayerData(data, playerName);
 if (!playerData) throw new Error(`Não encontrado em ${serverName}`);
 console.log(`✅ [AlbionAPI] "${playerName}" encontrado em ${serverName}`);
 return playerData;
 })
 .catch(err => {
 // Silencia erros individuais — Promise.any ignora rejeições
 console.log(`⚠️ [AlbionAPI] ${serverName}: ${err.message}`);
 throw err;
 })
 );

 try {
 // Promise.any: resolve com o PRIMEIRO que tiver sucesso
 // Se TODOS falharem → AggregateError → catch → null
 return await Promise.any(serverPromises);
 } catch {
 console.log(`❌ [AlbionAPI] "${playerName}" não encontrado em nenhum servidor`);
 return null;
 }
 }

 async searchPlayer(playerName, server = 'europe') {
 console.log(`\n🔍 Buscando: "${playerName}" [hint: ${server}]`);

 const cacheKey = playerName.toLowerCase();

 // Cache positivo: se já encontramos esse jogador recentemente, usa cache
 const cached = this.getFromCache(cacheKey);
 if (cached) {
 console.log(`📦 [AlbionAPI] Cache hit para "${playerName}"`);
 return cached;
 }

 try {
 // Busca em paralelo nos 3 servidores (sem circuit breaker global)
 const playerData = await this.searchPlayerParallel(playerName);

 if (playerData) {
 // Salva no cache positivo (reutiliza setCache existente)
 this.setCache(cacheKey, playerData);
 this.recordSuccess();
 return playerData;
 }

 // Jogador genuinamente não encontrado em nenhum servidor
 // NÃO salva em cache negativo: próxima busca tenta de novo
 // (evita falsos negativos por falha temporária de rede)
 return null;

 } catch (error) {
 console.error(`🔴 [AlbionAPI] Erro inesperado na busca:`, error.message || error);
 return null;
 }
 }

 processPlayerData(apiData, searchName) {
 if (!apiData?.players?.length) return null;

 const exactMatch = apiData.players.find(p =>
 p.Name?.toLowerCase() === searchName.toLowerCase()
 );
 const player = exactMatch || apiData.players[0];

 if (!player.Name) return null;

 return {
 id: player.Id,
 name: player.Name,
 guildId: player.GuildId || null,
 guildName: player.GuildName || null,
 allianceId: player.AllianceId || null,
 allianceName: player.AllianceName || null,
 avatar: player.Avatar || null,
 avatarRing: player.AvatarRing || null,
 killFame: player.KillFame || 0,
 deathFame: player.DeathFame || 0,
 searchedAt: new Date().toISOString()
 };
 }

 async verifyPlayerGuild(playerName, guildName, server = 'europe') {
 console.log(`\n🚀 Verificação: "${playerName}" -> "${guildName}"`);
 const startTime = Date.now();

 try {
 const player = await this.searchPlayer(playerName, server);

 if (!player) {
 return {
 valid: false,
 error: `Jogador "${playerName}" não encontrado no servidor ${server}.`,
 details: null,
 apiStatus: 'NOT_FOUND',
 responseTime: Date.now() - startTime
 };
 }

 // Sem guilda informada ou "nenhuma"
 if (!guildName || ['nenhuma', 'none', ''].includes(guildName.toLowerCase().trim())) {
 if (!player.guildId) {
 return { valid: true, error: null, details: player, apiStatus: 'VALIDATED', responseTime: Date.now() - startTime };
 }
 return {
 valid: false,
 error: `Você informou "Nenhuma" guilda, mas o jogador está em "${player.guildName}".`,
 details: player,
 apiStatus: 'MISMATCH',
 responseTime: Date.now() - startTime
 };
 }

 // Jogador não tem guilda mas informou uma
 if (!player.guildId) {
 return {
 valid: false,
 error: `Jogador não está em nenhuma guilda, mas você informou "${guildName}".`,
 details: player,
 apiStatus: 'NO_GUILD',
 responseTime: Date.now() - startTime
 };
 }

 // Verificação de guilda (case insensitive e parcial)
 const playerGuild = (player.guildName || '').toLowerCase().trim();
 const inputGuild = guildName.toLowerCase().trim();
 const match = playerGuild === inputGuild ||
 playerGuild.includes(inputGuild) ||
 inputGuild.includes(playerGuild);

 if (!match) {
 return {
 valid: false,
 error: `Guilda incorreta. Informado: "${guildName}" | Real: "${player.guildName}".`,
 details: player,
 apiStatus: 'GUILD_MISMATCH',
 responseTime: Date.now() - startTime
 };
 }

 return { valid: true, error: null, details: player, apiStatus: 'VALIDATED', responseTime: Date.now() - startTime };

 } catch (error) {
 console.error('❌ Erro:', error);
 const isApiDown = this.circuitBreaker.state === 'OPEN';
 return {
 valid: false,
 error: isApiDown ? 'API temporariamente indisponível. Análise manual necessária.' : `Erro: ${error.message}`,
 details: null,
 apiStatus: isApiDown ? 'API_UNAVAILABLE' : 'ERROR',
 responseTime: Date.now() - startTime
 };
 }
 }

 // ==================== MÉTODOS DE GUILDA MELHORADOS ====================

 async getPlayerStats(playerId) {
 try {
 const path = `/api/gameinfo/players/${playerId}`;
 return await this.makeRequestWithRetry(path);
 } catch (error) {
 console.error('[AlbionAPI] Error getPlayerStats:', error.message);
 return null;
 }
 }

 async getPlayerKills(playerId, limit = 10) {
 try {
 const path = `/api/gameinfo/players/${playerId}/kills?limit=${limit}`;
 return await this.makeRequestWithRetry(path);
 } catch (error) {
 console.error('[AlbionAPI] Error getPlayerKills:', error.message);
 return [];
 }
 }

 async getGuildInfo(guildId) {
 try {
 const path = `/api/gameinfo/guilds/${guildId}`;
 console.log(`[AlbionAPI] Buscando info da guilda: ${guildId}`);
 const data = await this.makeRequestWithRetry(path);
 console.log(`[AlbionAPI] Guilda encontrada: ${data?.Name || 'Desconhecida'}`);
 return data;
 } catch (error) {
 console.error('[AlbionAPI] Error getGuildInfo:', error.message);
 return null;
 }
 }

 async getGuildMembers(guildId) {
 try {
 const path = `/api/gameinfo/guilds/${guildId}/members`;
 return await this.makeRequestWithRetry(path);
 } catch (error) {
 console.error('[AlbionAPI] Error getGuildMembers:', error.message);
 return [];
 }
 }

 async getGuildBattles(guildId, limit = 5) {
 try {
 const path = `/api/gameinfo/guilds/${guildId}/battles?limit=${limit}`;
 return await this.makeRequestWithRetry(path);
 } catch (error) {
 console.error('[AlbionAPI] Error getGuildBattles:', error.message);
 return [];
 }
 }

 async comparePlayers(playerId1, playerId2) {
 const [p1, p2] = await Promise.all([
 this.getPlayerStats(playerId1),
 this.getPlayerStats(playerId2)
 ]);

 if (!p1 || !p2) return null;

 return {
 player1: {
 name: p1.Name,
 fame: p1.LifetimeStatistics?.PvE?.Total || 0,
 pvpFame: p1.LifetimeStatistics?.PvP?.Total || 0,
 gatheringFame: p1.LifetimeStatistics?.Gathering?.All?.Total || 0
 },
 player2: {
 name: p2.Name,
 fame: p2.LifetimeStatistics?.PvE?.Total || 0,
 pvpFame: p2.LifetimeStatistics?.PvP?.Total || 0,
 gatheringFame: p2.LifetimeStatistics?.Gathering?.All?.Total || 0
 }
 };
 }

 async checkApiHealth() {
 const results = {};
 for (const [server, endpoint] of Object.entries(this.endpoints)) {
 try {
 const start = Date.now();
 await this.makeRequest(endpoint, '/api/gameinfo/search?q=test');
 results[server] = { status: 'UP', latency: Date.now() - start };
 } catch (error) {
 results[server] = { status: 'DOWN', error: error.type || error.message };
 }
 }
 return results;
 }

 delay(ms) {
 return new Promise(resolve => setTimeout(resolve, ms));
 }
}

module.exports = new AlbionAPI();