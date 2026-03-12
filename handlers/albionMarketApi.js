const axios = require('axios');
const fs = require('fs');

/**
 * Albion Market API Handler
 * Integração com Albion Online Data Project API
 * Documentação: https://www.albion-online-data.com/api
 */
class AlbionMarketApi {
    constructor() {
        // APIs por região
        this.apiUrls = {
            americas: 'https://west.albion-online-data.com',
            asia: 'https://east.albion-online-data.com',
            europe: 'https://europe.albion-online-data.com'
        };

        // Cache de itens para busca rápida
        this.itemsCache = new Map();
        this.cacheTimeout = 3600000; // 1 hora

        // Mapeamento de qualidades
        this.qualities = {
            1: { name: 'Normal', emoji: '⚪', color: 0x95A5A6 },
            2: { name: 'Bom', emoji: '🟢', color: 0x2ECC71 },
            3: { name: 'Notável', emoji: '🔵', color: 0x3498DB },
            4: { name: 'Excelente', emoji: '🟣', color: 0x9B59B6 },
            5: { name: 'Obra-prima', emoji: '🟡', color: 0xF1C40F }
        };

        // Mapeamento de cidades
        this.locations = [
            'Bridgewatch', 'Caerleon', 'Fort Sterling', 
            'Lymhurst', 'Martlock', 'Thetford', 'Black Market'
        ];

        // Carregar cache de itens ao iniciar
        this.loadItemsCache();
    }

    /**
     * Carrega o cache de itens do arquivo ou API
     */
    async loadItemsCache() {
        try {
            // Tentar carregar do arquivo local se existir
            if (fs.existsSync('./data/items_cache.json')) {
                const data = JSON.parse(fs.readFileSync('./data/items_cache.json', 'utf8'));
                this.itemsCache = new Map(data);
                console.log(`[AlbionMarketApi] Cache carregado: ${this.itemsCache.size} itens`);
                return;
            }

            // Se não existe, buscar da API
            await this.refreshItemsCache();
        } catch (error) {
            console.error('[AlbionMarketApi] Erro ao carregar cache:', error);
        }
    }

    /**
     * Atualiza o cache de itens da API oficial
     */
    async refreshItemsCache() {
        try {
            console.log('[AlbionMarketApi] Atualizando cache de itens...');

            // URL dos metadados de itens
            const response = await axios.get('https://raw.githubusercontent.com/ao-data/ao-bin-dumps/master/formatted/items.json', {
                timeout: 30000
            });

            const items = response.data;
            this.itemsCache.clear();

            // Processar e indexar itens
            for (const item of items) {
                if (item.UniqueName && item.LocalizedNames?.EN) {
                    const itemId = item.UniqueName;
                    const itemName = item.LocalizedNames.EN;

                    // Extrair tier do ID (ex: T4_BAG -> T4)
                    const tierMatch = itemId.match(/^(T\d+)/);
                    const tier = tierMatch ? tierMatch[1] : null;

                    this.itemsCache.set(itemId.toLowerCase(), {
                        id: itemId,
                        name: itemName,
                        tier: tier,
                        category: item.Category || 'Outros',
                        description: item.LocalizedDescriptions?.EN || ''
                    });
                }
            }

            // Salvar em arquivo para cache local
            if (!fs.existsSync('./data')) {
                fs.mkdirSync('./data', { recursive: true });
            }

            fs.writeFileSync('./data/items_cache.json', JSON.stringify([...this.itemsCache], null, 2));
            console.log(`[AlbionMarketApi] Cache atualizado: ${this.itemsCache.size} itens`);

        } catch (error) {
            console.error('[AlbionMarketApi] Erro ao atualizar cache:', error);
            throw error;
        }
    }

    /**
     * Busca itens por nome (fuzzy search)
     */
    searchItems(query, limit = 10) {
        try {
            const searchTerm = query.toLowerCase().trim();
            const results = [];

            // Buscar por ID ou nome
            for (const [id, item] of this.itemsCache) {
                if (id.includes(searchTerm) || 
                    item.name.toLowerCase().includes(searchTerm)) {
                    results.push(item);

                    if (results.length >= limit) break;
                }
            }

            // Ordenar por relevância (exato primeiro)
            results.sort((a, b) => {
                const aExact = a.name.toLowerCase() === searchTerm;
                const bExact = b.name.toLowerCase() === searchTerm;

                if (aExact && !bExact) return -1;
                if (!aExact && bExact) return 1;

                return a.name.localeCompare(b.name);
            });

            return results.slice(0, limit);

        } catch (error) {
            console.error(`[AlbionMarketApi] Erro na busca: ${error.message}`);
            return [];
        }
    }

    /**
     * Busca preços de itens na API de mercado
     */
    async getItemPrices(itemId, options = {}) {
        try {
            const { 
                locations = this.locations,
                quality = null,
                server = 'americas'
            } = options;

            const baseUrl = this.apiUrls[server] || this.apiUrls.americas;

            // Construir URL
            let url = `${baseUrl}/api/v2/stats/prices/${itemId}.json`;

            // Adicionar parâmetros
            const params = [];
            if (locations.length > 0) {
                params.push(`locations=${locations.join(',')}`);
            }
            if (quality) {
                params.push(`qualities=${quality}`);
            }

            if (params.length > 0) {
                url += `?${params.join('&')}`;
            }

            console.log(`[AlbionMarketApi] Buscando preços: ${url}`);

            const response = await axios.get(url, {
                timeout: 10000,
                headers: {
                    'Accept': 'application/json',
                    'Accept-Encoding': 'gzip'
                }
            });

            return this.processPriceData(response.data, itemId);

        } catch (error) {
            console.error(`[AlbionMarketApi] Erro ao buscar preços: ${error.message}`);
            throw error;
        }
    }

    /**
     * Processa dados de preços da API
     */
    processPriceData(data, itemId) {
        if (!Array.isArray(data) || data.length === 0) {
            return { 
                itemId, 
                prices: [], 
                message: 'Nenhum dado de preço encontrado' 
            };
        }

        const processed = {
            itemId,
            prices: [],
            bestSell: null,
            bestBuy: null,
            lastUpdate: null
        };

        for (const entry of data) {
            const location = entry.city || entry.location || 'Desconhecido';
            const quality = entry.quality || 1;

            // Dados de venda (sell orders)
            const sellPrice = entry.sell_price_min || 0;
            const sellCount = entry.sell_price_min_date ? 1 : 0;

            // Dados de compra (buy orders)
            const buyPrice = entry.buy_price_max || 0;
            const buyCount = entry.buy_price_max_date ? 1 : 0;

            const priceInfo = {
                location,
                quality,
                qualityName: this.qualities[quality]?.name || 'Normal',
                sellPrice,
                sellPriceDate: entry.sell_price_min_date,
                buyPrice,
                buyPriceDate: entry.buy_price_max_date
            };

            processed.prices.push(priceInfo);

            // Atualizar melhores preços
            if (sellPrice > 0 && (!processed.bestSell || sellPrice < processed.bestSell.price)) {
                processed.bestSell = { location, price: sellPrice, quality };
            }

            if (buyPrice > 0 && (!processed.bestBuy || buyPrice > processed.bestBuy.price)) {
                processed.bestBuy = { location, price: buyPrice, quality };
            }

            // Última atualização
            const updateDate = entry.sell_price_min_date || entry.buy_price_max_date;
            if (updateDate && (!processed.lastUpdate || new Date(updateDate) > new Date(processed.lastUpdate))) {
                processed.lastUpdate = updateDate;
            }
        }

        return processed;
    }

    /**
     * Busca histórico de preços
     */
    async getPriceHistory(itemId, timeScale = 6, count = 24) {
        try {
            const baseUrl = this.apiUrls.americas;
            const url = `${baseUrl}/api/v2/stats/history/${itemId}.json?time-scale=${timeScale}&count=${count}`;

            const response = await axios.get(url, { timeout: 10000 });
            return response.data;

        } catch (error) {
            console.error(`[AlbionMarketApi] Erro ao buscar histórico: ${error.message}`);
            return [];
        }
    }

    /**
     * Formata preço em silver
     */
    formatPrice(price) {
        if (price >= 1000000) {
            return `${(price / 1000000).toFixed(2)}M`;
        } else if (price >= 1000) {
            return `${(price / 1000).toFixed(1)}k`;
        }
        return price.toString();
    }

    /**
     * Calcula tempo desde a última atualização
     */
    getTimeSince(dateString) {
        if (!dateString) return 'Desconhecido';

        const date = new Date(dateString);
        const now = new Date();
        const diff = Math.floor((now - date) / 1000); // segundos

        if (diff < 60) return `${diff}s atrás`;
        if (diff < 3600) return `${Math.floor(diff / 60)}m atrás`;
        if (diff < 86400) return `${Math.floor(diff / 3600)}h atrás`;
        return `${Math.floor(diff / 86400)}d atrás`;
    }

    /**
     * Retorna lista de tiers disponíveis para um item
     */
    getAvailableTiers(baseItemId) {
        const tiers = [];
        const baseName = baseItemId.replace(/^(T\d+)/, '');

        for (let t = 4; t <= 8; t++) {
            const tierId = `T${t}${baseName}`;
            if (this.itemsCache.has(tierId.toLowerCase())) {
                tiers.push({ tier: t, id: tierId });
            }
        }

        return tiers;
    }

    /**
     * Constrói ID do item com tier e encantamento
     */
    buildItemId(baseId, tier, enchant = 0) {
        // Remover tier existente
        let cleanId = baseId.replace(/^T\d+/, '');

        // Adicionar novo tier
        let newId = `T${tier}${cleanId}`;

        // Adicionar encantamento se > 0
        if (enchant > 0) {
            newId += `@${enchant}`;
        }

        return newId;
    }
}

// Singleton instance
const marketApi = new AlbionMarketApi();
module.exports = marketApi;