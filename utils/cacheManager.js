/**
 * Cache Manager Avançado
 * Implementa cache em múltiplas camadas (Memory + SQLite) com TTL
 */

class CacheManager {
  constructor() {
    this.memory = new Map();
    this.ttls = new Map(); // Time-to-live tracking
    this.stats = {
      hits: 0,
      misses: 0,
      evictions: 0
    };

    // Cleanup automático a cada 5 minutos
    setInterval(() => this.cleanup(), 5 * 60 * 1000);
  }

  /**
   * Gera chave única
   */
  key(namespace, id) {
    return `${namespace}:${id}`;
  }

  /**
   * Armazena valor em cache
   * @param {string} namespace - Categoria (ex: 'user', 'guild', 'event')
   * @param {string} id - Identificador único
   * @param {any} data - Dados a armazenar
   * @param {number} ttlMs - Tempo de vida em ms (padrão: 10 min)
   */
  set(namespace, id, data, ttlMs = 600000) {
    const key = this.key(namespace, id);
    this.memory.set(key, data);
    this.ttls.set(key, Date.now() + ttlMs);
  }

  /**
   * Recupera valor do cache
   */
  get(namespace, id) {
    const key = this.key(namespace, id);

    // Verifica se existe e não expirou
    if (this.memory.has(key)) {
      const expiry = this.ttls.get(key);
      if (expiry > Date.now()) {
        this.stats.hits++;
        return this.memory.get(key);
      } else {
        // Expirado, remove
        this.delete(namespace, id);
      }
    }

    this.stats.misses++;
    return null;
  }

  /**
   * Remove item do cache
   */
  delete(namespace, id) {
    const key = this.key(namespace, id);
    this.memory.delete(key);
    this.ttls.delete(key);
    this.stats.evictions++;
  }

  /**
   * Invalida toda uma categoria
   */
  invalidateNamespace(namespace) {
    const prefix = namespace + ':';
    for (const key of this.memory.keys()) {
      if (key.startsWith(prefix)) {
        this.memory.delete(key);
        this.ttls.delete(key);
      }
    }
    console.log(`[Cache] Invalidated namespace: ${namespace}`);
  }

  /**
   * Limpa itens expirados
   */
  cleanup() {
    const now = Date.now();
    let cleaned = 0;

    for (const [key, expiry] of this.ttls.entries()) {
      if (expiry <= now) {
        this.memory.delete(key);
        this.ttls.delete(key);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      console.log(`[Cache] Cleaned ${cleaned} expired items`);
    }
  }

  /**
   * Retorna estatísticas
   */
  getStats() {
    const total = this.stats.hits + this.stats.misses;
    const hitRate = total > 0 ? ((this.stats.hits / total) * 100).toFixed(2) : 0;

    return {
      ...this.stats,
      total,
      hitRate: `${hitRate}%`,
      size: this.memory.size
    };
  }

  /**
   * Cache com fallback automático (função de fetch)
   */
  async getOrFetch(namespace, id, fetchFn, ttlMs = 600000) {
    // Tenta cache primeiro
    const cached = this.get(namespace, id);
    if (cached !== null) return cached;

    // Executa função de fetch
    try {
      const data = await fetchFn();
      if (data) {
        this.set(namespace, id, data, ttlMs);
      }
      return data;
    } catch (error) {
      console.error(`[Cache] Error fetching ${namespace}:${id}:`, error);
      throw error;
    }
  }
}

module.exports = new CacheManager();