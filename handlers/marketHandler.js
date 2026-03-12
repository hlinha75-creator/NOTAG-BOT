const {
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    StringSelectMenuBuilder,
    StringSelectMenuOptionBuilder,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle
} = require('discord.js');
const MarketApi = require('./albionMarketApi');

/**
 * MarketHandler - Sistema de Pesquisa de Preços do Albion Online
 * Sistema de navegação por menus igual ao ORB XP
 */
class MarketHandler {
    constructor() {
        // Armazenar buscas em andamento
        this.activeSearches = new Map();

        // CATEGORIAS DE ITENS ORGANIZADAS
        this.itemCategories = {
            weapons: {
                name: 'Armas',
                emoji: '⚔️',
                items: [
                    { id: 'T4_MAIN_SWORD', name: 'Espada (Sword)', tiers: [4,5,6,7,8] },
                    { id: 'T4_MAIN_AXE', name: 'Machado (Axe)', tiers: [4,5,6,7,8] },
                    { id: 'T4_MAIN_MACE', name: 'Maça (Mace)', tiers: [4,5,6,7,8] },
                    { id: 'T4_MAIN_SPEAR', name: 'Lança (Spear)', tiers: [4,5,6,7,8] },
                    { id: 'T4_MAIN_NATURESTAFF', name: 'Cajado Natural', tiers: [4,5,6,7,8] },
                    { id: 'T4_MAIN_FIRESTAFF', name: 'Cajado de Fogo', tiers: [4,5,6,7,8] },
                    { id: 'T4_MAIN_FROSTSTAFF', name: 'Cajado de Gelo', tiers: [4,5,6,7,8] },
                    { id: 'T4_MAIN_ARCANESTAFF', name: 'Cajado Arcano', tiers: [4,5,6,7,8] },
                    { id: 'T4_MAIN_HOLYSTAFF', name: 'Cajado Sagrado', tiers: [4,5,6,7,8] },
                    { id: 'T4_MAIN_CURSESTAFF', name: 'Cajado Amaldiçoado', tiers: [4,5,6,7,8] },
                    { id: 'T4_MAIN_DAGGER', name: 'Adaga (Dagger)', tiers: [4,5,6,7,8] },
                    { id: 'T4_MAIN_BOW', name: 'Arco (Bow)', tiers: [4,5,6,7,8] },
                    { id: 'T4_2H_CROSSBOW', name: 'Besta (Crossbow)', tiers: [4,5,6,7,8] },
                    { id: 'T4_MAIN_HAMMER', name: 'Martelo (Hammer)', tiers: [4,5,6,7,8] },
                    { id: 'T4_MAIN_SCYTHE', name: 'Foice (Scythe)', tiers: [5,6,7,8] }
                ]
            },
            offhands: {
                name: 'Escudos e Off-hands',
                emoji: '🛡️',
                items: [
                    { id: 'T4_OFF_SHIELD', name: 'Escudo (Shield)', tiers: [4,5,6,7,8] },
                    { id: 'T4_OFF_TORCH', name: 'Tocha (Torch)', tiers: [4,5,6,7,8] },
                    { id: 'T4_OFF_BOOK', name: 'Livro de Feitiços', tiers: [4,5,6,7,8] },
                    { id: 'T4_OFF_ORB_MORGANA', name: 'Orbe de Morgana', tiers: [4,5,6,7,8] },
                    { id: 'T4_OFF_HORN_KEEPER', name: 'Chifre do Guardião', tiers: [4,5,6,7,8] },
                    { id: 'T4_OFF_JESTERCANE', name: 'Bengala do Bobo', tiers: [4,5,6,7,8] }
                ]
            },
            armor: {
                name: 'Armaduras',
                emoji: '🦾',
                items: [
                    { id: 'T4_ARMOR_PLATE_SET1', name: 'Armadura de Placas (Soldier)', tiers: [4,5,6,7,8] },
                    { id: 'T4_ARMOR_LEATHER_SET1', name: 'Armadura de Couro (Mercenary)', tiers: [4,5,6,7,8] },
                    { id: 'T4_ARMOR_CLOTH_SET1', name: 'Vestes de Tecido (Scholar)', tiers: [4,5,6,7,8] },
                    { id: 'T4_ARMOR_PLATE_SET2', name: 'Armadura de Guerreiro (Knight)', tiers: [4,5,6,7,8] },
                    { id: 'T4_ARMOR_LEATHER_SET2', name: 'Armadura de Caçador (Hunter)', tiers: [4,5,6,7,8] },
                    { id: 'T4_ARMOR_CLOTH_SET2', name: 'Vestes de Mago (Mage)', tiers: [4,5,6,7,8] },
                    { id: 'T4_ARMOR_PLATE_SET3', name: 'Armadura de Guardião (Guardian)', tiers: [4,5,6,7,8] },
                    { id: 'T4_ARMOR_LEATHER_SET3', name: 'Armadura de Assassino (Assassin)', tiers: [4,5,6,7,8] },
                    { id: 'T4_ARMOR_CLOTH_SET3', name: 'Vestes de Druid (Druid)', tiers: [4,5,6,7,8] }
                ]
            },
            head: {
                name: 'Capacetes',
                emoji: '👷',
                items: [
                    { id: 'T4_HEAD_PLATE_SET1', name: 'Capacete de Placas (Soldier)', tiers: [4,5,6,7,8] },
                    { id: 'T4_HEAD_LEATHER_SET1', name: 'Capacete de Couro (Mercenary)', tiers: [4,5,6,7,8] },
                    { id: 'T4_HEAD_CLOTH_SET1', name: 'Capuz de Tecido (Scholar)', tiers: [4,5,6,7,8] },
                    { id: 'T4_HEAD_PLATE_SET2', name: 'Capacete de Guerreiro (Knight)', tiers: [4,5,6,7,8] },
                    { id: 'T4_HEAD_LEATHER_SET2', name: 'Capacete de Caçador (Hunter)', tiers: [4,5,6,7,8] }
                ]
            },
            shoes: {
                name: 'Botas',
                emoji: '👢',
                items: [
                    { id: 'T4_SHOES_PLATE_SET1', name: 'Botas de Placas (Soldier)', tiers: [4,5,6,7,8] },
                    { id: 'T4_SHOES_LEATHER_SET1', name: 'Botas de Couro (Mercenary)', tiers: [4,5,6,7,8] },
                    { id: 'T4_SHOES_CLOTH_SET1', name: 'Sapatos de Tecido (Scholar)', tiers: [4,5,6,7,8] },
                    { id: 'T4_SHOES_PLATE_SET2', name: 'Botas de Guerreiro (Knight)', tiers: [4,5,6,7,8] },
                    { id: 'T4_SHOES_LEATHER_SET2', name: 'Botas de Caçador (Hunter)', tiers: [4,5,6,7,8] }
                ]
            },
            bags: {
                name: 'Bolsas',
                emoji: '🎒',
                items: [
                    { id: 'T4_BAG', name: 'Bolsa Normal', tiers: [4,5,6,7,8] },
                    { id: 'T4_BAG_INSIGHT', name: 'Bolsa de Insight', tiers: [4,5,6,7,8] },
                    { id: 'T4_BAG_SILVERTHORN', name: 'Bolsa Silverthorn', tiers: [4,5,6,7,8] },
                    { id: 'T4_BAG_MIST', name: 'Bolsa da Névoa', tiers: [4,5,6,7,8] },
                    { id: 'T4_BAG_ASCENDANT', name: 'Bolsa Ascendente', tiers: [4,5,6,7,8] },
                    { id: 'T4_BAG_ADVENTURER', name: 'Bolsa do Aventureiro', tiers: [4,5,6,7,8] }
                ]
            },
            capes: {
                name: 'Capas',
                emoji: '🦸',
                items: [
                    { id: 'T4_CAPE', name: 'Capa Normal', tiers: [4,5,6,7,8] },
                    { id: 'T4_CAPEITEM_FW_BRIDGEWATCH', name: 'Capa de Bridgewatch', tiers: [4,5,6,7,8] },
                    { id: 'T4_CAPEITEM_FW_CAERLEON', name: 'Capa de Caerleon', tiers: [4,5,6,7,8] },
                    { id: 'T4_CAPEITEM_FW_FORTSTERLING', name: 'Capa de Fort Sterling', tiers: [4,5,6,7,8] },
                    { id: 'T4_CAPEITEM_FW_LYMHURST', name: 'Capa de Lymhurst', tiers: [4,5,6,7,8] },
                    { id: 'T4_CAPEITEM_FW_MARTLOCK', name: 'Capa de Martlock', tiers: [4,5,6,7,8] },
                    { id: 'T4_CAPEITEM_FW_THETFORD', name: 'Capa de Thetford', tiers: [4,5,6,7,8] },
                    { id: 'T4_CAPEITEM_HERETIC', name: 'Capa Herege', tiers: [4,5,6,7,8] },
                    { id: 'T4_CAPEITEM_UNDEAD', name: 'Capa Morto-vivo', tiers: [4,5,6,7,8] },
                    { id: 'T4_CAPEITEM_KEEPER', name: 'Capa do Guardião', tiers: [4,5,6,7,8] },
                    { id: 'T4_CAPEITEM_MORGANA', name: 'Capa de Morgana', tiers: [4,5,6,7,8] },
                    { id: 'T4_CAPEITEM_DEMON', name: 'Capa do Demônio', tiers: [4,5,6,7,8] }
                ]
            },
            mounts: {
                name: 'Montarias',
                emoji: '🐎',
                items: [
                    { id: 'T3_MOUNT_HORSE', name: 'Cavalo (T3)', tiers: [3,4,5,6,7,8] },
                    { id: 'T5_MOUNT_ARMORED_HORSE', name: 'Cavalo Blindado', tiers: [5,6,7,8] },
                    { id: 'T6_MOUNT_OX', name: 'Boi', tiers: [6,7,8] },
                    { id: 'T4_MOUNT_GIANTSTAG', name: 'Cervo Gigante', tiers: [4,5,6,7,8] },
                    { id: 'T5_MOUNT_MOABIRD_FW_BRIDGEWATCH', name: 'Pássaro Moá (Bridgewatch)', tiers: [5,6,7,8] },
                    { id: 'T5_MOUNT_SWAMPDRAGON_FW_THETFORD', name: 'Dragão do Pântano (Thetford)', tiers: [5,6,7,8] },
                    { id: 'T5_MOUNT_GREYWOLF_FW_FORTSTERLING', name: 'Lobo Cinzento (Fort Sterling)', tiers: [5,6,7,8] },
                    { id: 'T5_MOUNT_WILDBOAR_FW_LYMHURST', name: 'Javali Selvagem (Lymhurst)', tiers: [5,6,7,8] },
                    { id: 'T5_MOUNT_RAM_FW_MARTLOCK', name: 'Carneiro (Martlock)', tiers: [5,6,7,8] },
                    { id: 'T5_MOUNT_SWAMPDRAGON_FW_CAERLEON', name: 'Basilisco (Caerleon)', tiers: [5,6,7,8] }
                ]
            },
            consumables: {
                name: 'Consumíveis',
                emoji: '🧪',
                items: [
                    { id: 'T4_POTION_HEAL', name: 'Poção de Vida', tiers: [4,5,6,7,8] },
                    { id: 'T4_POTION_ENERGY', name: 'Poção de Energia', tiers: [4,5,6,7,8] },
                    { id: 'T4_POTION_REVIVE', name: 'Poção de Reviver', tiers: [4,5,6,7,8] },
                    { id: 'T4_POTION_STONESKIN', name: 'Poção de Pele de Pedra', tiers: [4,5,6,7,8] },
                    { id: 'T4_POTION_SLOWFIELD', name: 'Poção de Lentidão', tiers: [4,5,6,7,8] },
                    { id: 'T4_POTION_CLEANSE', name: 'Poção de Purificação', tiers: [4,5,6,7,8] },
                    { id: 'T4_FOOD_MEAL_SOUP', name: 'Sopa', tiers: [4,5,6,7,8] },
                    { id: 'T4_FOOD_MEAL_SALAD', name: 'Salada', tiers: [4,5,6,7,8] },
                    { id: 'T4_FOOD_MEAL_PIE', name: 'Torta', tiers: [4,5,6,7,8] },
                    { id: 'T4_FOOD_MEAL_OMELETTE', name: 'Omelete', tiers: [4,5,6,7,8] },
                    { id: 'T4_FOOD_MEAL_STEW', name: 'Ensopado', tiers: [4,5,6,7,8] },
                    { id: 'T4_FOOD_MEAL_SANDWICH', name: 'Sanduíche', tiers: [4,5,6,7,8] }
                ]
            },
            resources: {
                name: 'Recursos',
                emoji: '⛏️',
                items: [
                    { id: 'T4_METALBAR', name: 'Barra de Metal', tiers: [4,5,6,7,8] },
                    { id: 'T4_LEATHER', name: 'Couro', tiers: [4,5,6,7,8] },
                    { id: 'T4_CLOTH', name: 'Tecido', tiers: [4,5,6,7,8] },
                    { id: 'T4_PLANKS', name: 'Tábuas', tiers: [4,5,6,7,8] },
                    { id: 'T4_STONEBLOCK', name: 'Bloco de Pedra', tiers: [4,5,6,7,8] },
                    { id: 'T4_ORE', name: 'Minério', tiers: [4,5,6,7,8] },
                    { id: 'T4_HIDE', name: 'Pele Bruta', tiers: [4,5,6,7,8] },
                    { id: 'T4_FIBER', name: 'Fibra', tiers: [4,5,6,7,8] },
                    { id: 'T4_WOOD', name: 'Madeira', tiers: [4,5,6,7,8] },
                    { id: 'T4_ROCK', name: 'Pedra', tiers: [4,5,6,7,8] }
                ]
            }
        };

        // Mapeamento de qualidades
        this.qualities = [
            { value: '1', name: 'Normal', emoji: '⚪' },
            { value: '2', name: 'Bom', emoji: '🟢' },
            { value: '3', name: 'Notável', emoji: '🔵' },
            { value: '4', name: 'Excelente', emoji: '🟣' },
            { value: '5', name: 'Obra-prima', emoji: '🟡' }
        ];

        // Mapeamento de encantamentos
        this.enchants = [
            { value: '0', label: 'Normal (.0)' },
            { value: '1', label: 'Encantado .1' },
            { value: '2', label: 'Encantado .2' },
            { value: '3', label: 'Encantado .3' },
            { value: '4', label: 'Encantado .4' }
        ];
    }

    /**
     * Envia o painel principal do mercado
     */
    async sendPanel(channel) {
        try {
            const embed = new EmbedBuilder()
                .setTitle('🛒 **MERCADO ALBION**')
                .setDescription(
                    'Pesquise preços de itens em tempo real nas cidades do Albion Online.\n\n' +
                    '**Como usar:**\n' +
                    '1️⃣ Clique em **🗂️ Navegar por Categoria** para selecionar o item\n' +
                    '2️⃣ Escolha o tipo de item (Armas, Armaduras, etc)\n' +
                    '3️⃣ Selecione o item específico\n' +
                    '4️⃣ Configure Tier, Encantamento e Qualidade\n' +
                    '5️⃣ Veja os preços em todas as cidades!\n\n' +
                    '💡 *Dica: Você também pode usar **🔍 Busca Avançada** para pesquisar pelo nome exato*'
                )
                .setColor(0xF39C12)
                .setThumbnail('https://render.albiononline.com/v1/item/T4_BAG.png')
                .addFields(
                    {
                        name: '📊 **Funcionalidades**',
                        value: '• Preços em tempo real\n• Comparação entre cidades\n• Black Market incluído\n• Melhor preço destacado',
                        inline: true
                    },
                    {
                        name: '⚡ **Dicas**',
                        value: '• Use categorias para navegar rápido\n• Black Market mostra preços de venda\n• Qualidade afeta apenas itens equipáveis',
                        inline: true
                    }
                )
                .setFooter({ text: 'Sistema de Mercado • NOTAG Bot' })
                .setTimestamp();

            const buttons = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId('market_browse_category')
                        .setLabel('🗂️ Navegar por Categoria')
                        .setStyle(ButtonStyle.Primary),
                    new ButtonBuilder()
                        .setCustomId('market_search_advanced')
                        .setLabel('🔍 Busca Avançada')
                        .setStyle(ButtonStyle.Secondary),
                    new ButtonBuilder()
                        .setCustomId('market_help')
                        .setLabel('❓ Ajuda')
                        .setStyle(ButtonStyle.Success)
                );

            await channel.send({
                embeds: [embed],
                components: [buttons]
            });

            console.log(`[MarketHandler] Painel enviado em ${channel.name}`);
        } catch (error) {
            console.error('[MarketHandler] Erro ao enviar painel:', error);
            throw error;
        }
    }

    /**
     * Inicia navegação por categoria
     */
    async handleBrowseCategory(interaction) {
        try {
            const searchId = `${interaction.user.id}_${Date.now()}`;

            // Criar options para categorias (SEM EMOJI nos options para evitar erro)
            const categoryOptions = Object.keys(this.itemCategories).map(key => {
                const cat = this.itemCategories[key];
                return new StringSelectMenuOptionBuilder()
                    .setLabel(cat.name)
                    .setValue(key)
                    .setDescription(`Ver itens de ${cat.name}`);
            });

            const selectMenu = new StringSelectMenuBuilder()
                .setCustomId(`market_select_category_${searchId}`)
                .setPlaceholder('Selecione uma categoria...')
                .addOptions(categoryOptions);

            const row = new ActionRowBuilder().addComponents(selectMenu);

            const embed = new EmbedBuilder()
                .setTitle('🗂️ Navegar por Categoria')
                .setDescription('Selecione o tipo de item que deseja pesquisar:')
                .setColor(0x3498DB);

            await interaction.reply({
                embeds: [embed],
                components: [row],
                ephemeral: true
            });

        } catch (error) {
            console.error('[MarketHandler] Erro ao mostrar categorias:', error);
            await interaction.reply({
                content: '❌ Erro ao carregar categorias: ' + error.message,
                ephemeral: true
            });
        }
    }

    /**
     * Mostra itens da categoria selecionada
     */
    async showCategoryItems(interaction, categoryKey, searchId) {
        try {
            const category = this.itemCategories[categoryKey];
            if (!category) {
                await interaction.update({
                    content: '❌ Categoria não encontrada.',
                    components: [],
                    embeds: []
                });
                return;
            }

            // Criar options para itens (máximo 25 por menu)
            const itemOptions = category.items.slice(0, 25).map(item => {
                return new StringSelectMenuOptionBuilder()
                    .setLabel(item.name.substring(0, 100))
                    .setValue(item.id)
                    .setDescription(`Tiers: T${item.tiers.join(', T')}`);
            });

            const selectMenu = new StringSelectMenuBuilder()
                .setCustomId(`market_select_item_${searchId}`)
                .setPlaceholder(`Selecione um item de ${category.name}...`)
                .addOptions(itemOptions);

            const row = new ActionRowBuilder().addComponents(selectMenu);

            const backButton = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId(`market_back_category_${searchId}`)
                        .setLabel('⬅️ Voltar às Categorias')
                        .setStyle(ButtonStyle.Secondary)
                );

            const embed = new EmbedBuilder()
                .setTitle(`${category.emoji} ${category.name}`)
                .setDescription(`Selecione um item específico para ver os preços:`)
                .setColor(0xE67E22);

            await interaction.update({
                embeds: [embed],
                components: [row, backButton]
            });

            // Armazenar dados da busca
            this.activeSearches.set(searchId, {
                category: categoryKey,
                step: 'selecting_item'
            });

        } catch (error) {
            console.error('[MarketHandler] Erro ao mostrar itens:', error);
            throw error;
        }
    }

    /**
     * Mostra seleção de Tier, Encantamento e Qualidade
     */
    async showItemFilters(interaction, itemId, searchId) {
        try {
            // Encontrar item nas categorias
            let selectedItem = null;
            let itemCategory = null;

            for (const [catKey, cat] of Object.entries(this.itemCategories)) {
                const found = cat.items.find(i => i.id === itemId);
                if (found) {
                    selectedItem = found;
                    itemCategory = cat;
                    break;
                }
            }

            if (!selectedItem) {
                // Tentar buscar no cache da API
                selectedItem = { 
                    id: itemId, 
                    name: itemId.split('_').slice(1).join(' '),
                    tiers: [4, 5, 6, 7, 8]
                };
            }

            // Armazenar dados
            const searchData = this.activeSearches.get(searchId) || {};
            searchData.item = selectedItem;
            searchData.step = 'selecting_filters';
            this.activeSearches.set(searchId, searchData);

            // Criar selects para Tier, Enchant e Quality
            const tierOptions = selectedItem.tiers.map(t => 
                new StringSelectMenuOptionBuilder()
                    .setLabel(`Tier ${t}`)
                    .setValue(`${t}`)
            );

            const tierSelect = new StringSelectMenuBuilder()
                .setCustomId(`market_filter_tier_${searchId}`)
                .setPlaceholder('Selecione o Tier')
                .addOptions(tierOptions);

            const enchantSelect = new StringSelectMenuBuilder()
                .setCustomId(`market_filter_enchant_${searchId}`)
                .setPlaceholder('Selecione o Encantamento')
                .addOptions(
                    this.enchants.map(e => new StringSelectMenuOptionBuilder()
                        .setLabel(e.label)
                        .setValue(e.value)
                    )
                );

            const qualitySelect = new StringSelectMenuBuilder()
                .setCustomId(`market_filter_quality_${searchId}`)
                .setPlaceholder('Selecione a Qualidade')
                .addOptions(
                    this.qualities.map(q => new StringSelectMenuOptionBuilder()
                        .setLabel(q.name)
                        .setValue(q.value)
                    )
                );

            const row1 = new ActionRowBuilder().addComponents(tierSelect);
            const row2 = new ActionRowBuilder().addComponents(enchantSelect);
            const row3 = new ActionRowBuilder().addComponents(qualitySelect);

            const embed = new EmbedBuilder()
                .setTitle(`⚙️ Configurar: ${selectedItem.name}`)
                .setDescription(
                    `**Item:** ${selectedItem.name}\n` +
                    `**ID:** \`${selectedItem.id}\`\n\n` +
                    `Selecione as opções abaixo para ver os preços:`
                )
                .setColor(0x9B59B6)
                .setThumbnail(`https://render.albiononline.com/v1/item/${selectedItem.id}.png`);

            const buttons = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId(`market_search_confirm_${searchId}`)
                        .setLabel('🔍 Buscar Preços')
                        .setStyle(ButtonStyle.Success)
                        .setDisabled(true),
                    new ButtonBuilder()
                        .setCustomId(`market_cancel_${searchId}`)
                        .setLabel('❌ Cancelar')
                        .setStyle(ButtonStyle.Danger)
                );

            await interaction.update({
                embeds: [embed],
                components: [row1, row2, row3, buttons]
            });

        } catch (error) {
            console.error('[MarketHandler] Erro ao mostrar filtros:', error);
            throw error;
        }
    }

    /**
     * Atualiza filtros quando usuário seleciona - CORRIGIDO
     */
    async updateFilter(interaction, type, searchId, value) {
        try {
            const searchData = this.activeSearches.get(searchId);
            if (!searchData) {
                await interaction.reply({
                    content: '❌ Sessão expirada. Comece uma nova pesquisa.',
                    ephemeral: true
                });
                return;
            }

            // Atualizar valor do filtro
            if (type === 'tier') searchData.tier = value;
            if (type === 'enchant') searchData.enchant = value;
            if (type === 'quality') searchData.quality = value;

            this.activeSearches.set(searchId, searchData);

            // Verificar se pode habilitar botão de busca
            const canSearch = searchData.tier && searchData.enchant !== undefined && searchData.quality;

            // Atualizar embed com seleções
            const embed = EmbedBuilder.from(interaction.message.embeds[0])
                .setFields(
                    {
                        name: '🎚️ Tier',
                        value: searchData.tier ? `T${searchData.tier}` : '⏳ Não selecionado',
                        inline: true
                    },
                    {
                        name: '✨ Encantamento',
                        value: searchData.enchant !== undefined ? `.${searchData.enchant}` : '⏳ Não selecionado',
                        inline: true
                    },
                    {
                        name: '💎 Qualidade',
                        value: searchData.quality ? this.qualities.find(q => q.value === searchData.quality)?.name || 'N/A' : '⏳ Não selecionado',
                        inline: true
                    }
                );

            // ⭐ CORREÇÃO: Recriar os selects do zero com as seleções marcadas
            const selectedItem = searchData.item;

            // Recriar select de Tier
            const tierOptions = selectedItem.tiers.map(t => 
                new StringSelectMenuOptionBuilder()
                    .setLabel(`Tier ${t}`)
                    .setValue(`${t}`)
                    .setDefault(searchData.tier === `${t}`)
            );

            const tierSelect = new StringSelectMenuBuilder()
                .setCustomId(`market_filter_tier_${searchId}`)
                .setPlaceholder('Selecione o Tier')
                .addOptions(tierOptions);

            // Recriar select de Enchant
            const enchantSelect = new StringSelectMenuBuilder()
                .setCustomId(`market_filter_enchant_${searchId}`)
                .setPlaceholder('Selecione o Encantamento')
                .addOptions(
                    this.enchants.map(e => new StringSelectMenuOptionBuilder()
                        .setLabel(e.label)
                        .setValue(e.value)
                        .setDefault(searchData.enchant === e.value)
                    )
                );

            // Recriar select de Quality
            const qualitySelect = new StringSelectMenuBuilder()
                .setCustomId(`market_filter_quality_${searchId}`)
                .setPlaceholder('Selecione a Qualidade')
                .addOptions(
                    this.qualities.map(q => new StringSelectMenuOptionBuilder()
                        .setLabel(q.name)
                        .setValue(q.value)
                        .setDefault(searchData.quality === q.value)
                    )
                );

            const row1 = new ActionRowBuilder().addComponents(tierSelect);
            const row2 = new ActionRowBuilder().addComponents(enchantSelect);
            const row3 = new ActionRowBuilder().addComponents(qualitySelect);

            // ⭐ CORREÇÃO: Recriar botões do zero (não podemos editar componentes recebidos)
            const buttons = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId(`market_search_confirm_${searchId}`)
                        .setLabel('🔍 Buscar Preços')
                        .setStyle(ButtonStyle.Success)
                        .setDisabled(!canSearch),
                    new ButtonBuilder()
                        .setCustomId(`market_cancel_${searchId}`)
                        .setLabel('❌ Cancelar')
                        .setStyle(ButtonStyle.Danger)
                );

            await interaction.update({
                embeds: [embed],
                components: [row1, row2, row3, buttons]
            });

        } catch (error) {
            console.error('[MarketHandler] Erro ao atualizar filtro:', error);
            await interaction.reply({
                content: '❌ Erro ao atualizar filtro.',
                ephemeral: true
            });
        }
    }

    /**
     * Busca Avançada - Modal para digitar nome
     */
    async handleAdvancedSearch(interaction) {
        try {
            const modal = new ModalBuilder()
                .setCustomId('market_modal_search')
                .setTitle('🔍 Busca Avançada');

            const itemInput = new TextInputBuilder()
                .setCustomId('market_item_name')
                .setLabel('Nome do Item (em inglês)')
                .setPlaceholder('Ex: T4_BAG, Adepts Staff, Cape...')
                .setStyle(TextInputStyle.Short)
                .setRequired(true)
                .setMinLength(2)
                .setMaxLength(50);

            modal.addComponents(new ActionRowBuilder().addComponents(itemInput));

            await interaction.showModal(modal);

        } catch (error) {
            console.error('[MarketHandler] Erro ao abrir modal:', error);
            await interaction.reply({
                content: '❌ Erro ao iniciar pesquisa.',
                ephemeral: true
            });
        }
    }

    /**
     * Processa a busca avançada
     */
    async processSearchModal(interaction) {
        try {
            const itemName = interaction.fields.getTextInputValue('market_item_name').trim().toUpperCase();

            // Tentar encontrar item nas categorias primeiro
            let foundItems = [];

            // Buscar em todas as categorias
            for (const cat of Object.values(this.itemCategories)) {
                for (const item of cat.items) {
                    if (item.id.includes(itemName) || 
                        item.name.toUpperCase().includes(itemName)) {
                        foundItems.push(item);
                    }
                }
            }

            // Se não encontrou nas categorias, tentar no cache da API
            if (foundItems.length === 0 && MarketApi.itemsCache.size > 0) {
                const apiResults = MarketApi.searchItems(itemName, 10);
                foundItems = apiResults.map(item => ({
                    id: item.id,
                    name: item.name,
                    tiers: [4, 5, 6, 7, 8]
                }));
            }

            if (foundItems.length === 0) {
                await interaction.reply({
                    content: `❌ Nenhum item encontrado para "**${itemName}**".\n\nTente usar categorias ou verifique o nome em inglês.`,
                    ephemeral: true
                });
                return;
            }

            // Se encontrou apenas 1, ir direto para filtros
            if (foundItems.length === 1) {
                const searchId = `${interaction.user.id}_${Date.now()}`;
                this.activeSearches.set(searchId, { item: foundItems[0] });
                await this.showItemFilters(interaction, foundItems[0].id, searchId);
                return;
            }

            // Mostrar resultados em select menu
            const searchId = `${interaction.user.id}_${Date.now()}`;
            const options = foundItems.slice(0, 25).map(item => 
                new StringSelectMenuOptionBuilder()
                    .setLabel(item.name.substring(0, 100))
                    .setValue(item.id)
                    .setDescription(`ID: ${item.id}`)
            );

            const selectMenu = new StringSelectMenuBuilder()
                .setCustomId(`market_select_item_${searchId}`)
                .setPlaceholder('Selecione um item da lista...')
                .addOptions(options);

            const row = new ActionRowBuilder().addComponents(selectMenu);

            const embed = new EmbedBuilder()
                .setTitle('📋 Resultados da Busca')
                .setDescription(`Foram encontrados ${foundItems.length} itens. Selecione um:`)
                .setColor(0x3498DB);

            await interaction.reply({
                embeds: [embed],
                components: [row],
                ephemeral: true
            });

        } catch (error) {
            console.error('[MarketHandler] Erro na busca avançada:', error);
            await interaction.reply({
                content: '❌ Erro ao processar busca.',
                ephemeral: true
            });
        }
    }

    /**
     * Executa a busca de preços
     */
    async executeSearch(interaction, searchId) {
        try {
            const searchData = this.activeSearches.get(searchId);
            if (!searchData || !searchData.item) {
                await interaction.reply({
                    content: '❌ Sessão expirada.',
                    ephemeral: true
                });
                return;
            }

            await interaction.deferReply({ ephemeral: false });

            // Construir ID do item completo
            let fullItemId = searchData.item.id;

            // Ajustar tier se necessário
            if (searchData.tier) {
                fullItemId = fullItemId.replace(/^T\d+/, `T${searchData.tier}`);
            }

            // Adicionar encantamento
            if (searchData.enchant && searchData.enchant !== '0') {
                fullItemId += `@${searchData.enchant}`;
            }

            // Buscar preços
            const priceData = await MarketApi.getItemPrices(fullItemId, {
                quality: parseInt(searchData.quality) || 1
            });

            if (priceData.prices.length === 0) {
                await interaction.editReply({
                    content: `❌ Nenhum preço encontrado para **${searchData.item.name}** (T${searchData.tier}.${searchData.enchant})`,
                    embeds: []
                });
                return;
            }

            // Criar embed de resultados
            const embed = await this.createPriceEmbed(priceData, searchData);

            // Criar botões de ação
            const buttons = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId(`market_search_again`)
                        .setLabel('🔍 Nova Pesquisa')
                        .setStyle(ButtonStyle.Secondary)
                );

            await interaction.editReply({
                content: null,
                embeds: [embed],
                components: [buttons]
            });

            // Limpar sessão
            this.activeSearches.delete(searchId);

        } catch (error) {
            console.error('[MarketHandler] Erro ao executar busca:', error);
            await interaction.editReply({
                content: `❌ Erro ao buscar preços: ${error.message}`,
                embeds: []
            });
        }
    }

    /**
     * Cria embed com resultados de preços
     */
    async createPriceEmbed(priceData, searchData) {
        const itemName = searchData.item.name;
        const tier = searchData.tier || '4';
        const enchant = searchData.enchant || '0';
        const quality = searchData.quality || '1';

        const embed = new EmbedBuilder()
            .setTitle(`🛒 ${itemName}`)
            .setDescription(
                `**Tier:** T${tier} **|** ` +
                `**Encantamento:** .${enchant} **|** ` +
                `**Qualidade:** ${this.qualities.find(q => q.value === quality)?.name || 'Normal'}`
            )
            .setColor(0x2ECC71)
            .setThumbnail(`https://render.albiononline.com/v1/item/${priceData.itemId}.png`)
            .setFooter({ text: `Dados: Albion Online Data Project • Atualizado: ${MarketApi.getTimeSince(priceData.lastUpdate)}` });

        // Ordenar preços por melhor venda (menor preço)
        const sellPrices = priceData.prices
            .filter(p => p.sellPrice > 0)
            .sort((a, b) => a.sellPrice - b.sellPrice);

        // Ordenar preços de compra (maior preço)
        const buyPrices = priceData.prices
            .filter(p => p.buyPrice > 0)
            .sort((a, b) => b.buyPrice - a.buyPrice);

        // Field de melhor preço de venda (para quem quer comprar)
        if (sellPrices.length > 0) {
            const best = sellPrices[0];
            embed.addFields({
                name: '💰 Melhor Preço de Venda (para comprar)',
                value: `**${MarketApi.formatPrice(best.sellPrice)}** silver em **${best.location}** ${this.qualities.find(q => q.value == best.quality)?.emoji || ''}`,
                inline: false
            });
        }

        // Field de melhor preço de compra (para quem quer vender)
        if (buyPrices.length > 0) {
            const best = buyPrices[0];
            embed.addFields({
                name: '💵 Melhor Preço de Compra (para vender)',
                value: `**${MarketApi.formatPrice(best.buyPrice)}** silver em **${best.location}** ${this.qualities.find(q => q.value == best.quality)?.emoji || ''}`,
                inline: false
            });
        }

        // Tabela de preços por cidade
        let pricesText = '';
        const locations = ['Bridgewatch', 'Caerleon', 'Fort Sterling', 'Lymhurst', 'Martlock', 'Thetford'];

        for (const loc of locations) {
            const locData = priceData.prices.find(p => p.location === loc);
            if (locData) {
                const sell = locData.sellPrice > 0 ? MarketApi.formatPrice(locData.sellPrice) : '---';
                const buy = locData.buyPrice > 0 ? MarketApi.formatPrice(locData.buyPrice) : '---';
                pricesText += `**${loc}:** Venda ${sell} | Compra ${buy}\n`;
            }
        }

        // Black Market separado
        const bmData = priceData.prices.find(p => p.location === 'Black Market');
        if (bmData) {
            const sell = bmData.sellPrice > 0 ? MarketApi.formatPrice(bmData.sellPrice) : '---';
            pricesText += `\n⚫ **Black Market:** ${sell}`;
        }

        if (pricesText) {
            embed.addFields({
                name: '📍 Preços por Cidade',
                value: pricesText || 'Sem dados disponíveis',
                inline: false
            });
        }

        return embed;
    }

    /**
     * Mostra ajuda do sistema
     */
    async showHelp(interaction) {
        const embed = new EmbedBuilder()
            .setTitle('❓ Ajuda - Mercado Albion')
            .setDescription(
                '**Como usar o sistema de pesquisa:**\n\n' +
                '🗂️ **Navegar por Categoria**\n' +
                'Use o menu de categorias para encontrar itens organizados (Armas, Armaduras, etc).\n\n' +
                '🔍 **Busca Avançada**\n' +
                'Digite o nome exato ou parte do ID do item (em inglês).\n\n' +
                '**Entendendo os Preços:**\n' +
                '• **Venda:** Preço que você paga para comprar o item\n' +
                '• **Compra:** Preço que você recebe ao vender o item\n' +
                '• **Black Market:** Preço de venda para o jogo (geralmente maior)\n\n' +
                '**Dicas:**\n' +
                '• Black Market tem taxa de 15%\n' +
                '• Qualidade afeta apenas atributos de itens equipáveis\n' +
                '• Dados atualizados pela comunidade'
            )
            .setColor(0x3498DB);

        await interaction.reply({
            embeds: [embed],
            ephemeral: true
        });
    }

    /**
     * Cancela pesquisa
     */
    async cancelSearch(interaction, searchId) {
        this.activeSearches.delete(searchId);
        await interaction.update({
            content: '❌ Pesquisa cancelada.',
            components: [],
            embeds: []
        }).catch(() => {});
    }

    /**
     * Helper para obter emoji do tier
     */
    getTierEmoji(tier) {
        const emojis = ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣'];
        return emojis[tier] || '📦';
    }

    /**
     * Atualiza o cache de itens
     */
    async handleUpdateCache(interaction) {
        try {
            await interaction.deferReply({ ephemeral: true });

            await MarketApi.refreshItemsCache();

            await interaction.editReply({
                content: `✅ Cache de itens atualizado!\nTotal: **${MarketApi.itemsCache.size}** itens indexados.`
            });

        } catch (error) {
            console.error('[MarketHandler] Erro ao atualizar cache:', error);
            await interaction.editReply({
                content: '❌ Erro ao atualizar cache de itens.'
            });
        }
    }
}

// Exportar instância singleton
const marketHandler = new MarketHandler();
module.exports = marketHandler;