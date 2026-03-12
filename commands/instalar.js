const { SlashCommandBuilder, PermissionFlagsBits, ChannelType } = require('discord.js');
const SetupManager = require('../handlers/setupManager');
const KillboardHandler = require('../handlers/killboardHandler');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('instalar')
        .setDescription('Instala a estrutura completa do servidor (canais, cargos e permissões)')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction, client) {
        const isADM = interaction.member.roles.cache.some(r => r.name === 'ADM') ||
            interaction.member.permissions.has(PermissionFlagsBits.Administrator);

        if (!isADM) {
            return interaction.reply({
                content: '❌ Apenas ADMs podem usar este comando!',
                ephemeral: true
            });
        }

        await interaction.deferReply({ ephemeral: true });

        try {
            const setup = new SetupManager(interaction.guild, interaction);
            const result = await setup.install();

            // 🎯 NOVO: Instalar Killboard automaticamente após setup principal
            try {
                await interaction.editReply({
                    content: '🏗️ Estrutura base instalada! Configurando Killboard...',
                    embeds: []
                });

                await this.installKillboard(interaction.guild);
                result.createdCategories.push('💀 KILLBOARD');
                result.createdChannels.push('💀-kill-feed');
                result.createdChannels.push('☠️-death-feed');
            } catch (killboardError) {
                console.log('[Instalar] Erro ao criar killboard (pode já existir):', killboardError.message);
            }

            // 🛒 NOVO: Instalar Mercado automaticamente
            try {
                await interaction.editReply({
                    content: '🏗️ Estrutura base instalada! Configurando Mercado...',
                    embeds: []
                });

                await this.installMarketStructure(interaction.guild);
                result.createdCategories.push('🛒 SHOPPING');
                result.createdChannels.push('🛒╠mercado-albion');
            } catch (marketError) {
                console.log('[Instalar] Erro ao criar mercado (pode já existir):', marketError.message);
            }

            const embedResumo = {
                color: 0x2ECC71,
                title: '🏗️ **INSTALAÇÃO CONCLUÍDA**',
                description: result.message + '\n\n💀 **Killboard configurado automaticamente!**\n🛒 **Mercado Albion configurado automaticamente!**\nUse `/killboard config [guildId]` para ativar o monitoramento.',
                fields: [
                    {
                        name: '🆕 Canais Criados',
                        value: result.createdChannels.length > 0
                            ? result.createdChannels.slice(0, 15).map(c => `• ${c}`).join('\n') +
                              (result.createdChannels.length > 15 ? `\n... e mais ${result.createdChannels.length - 15}` : '')
                            : 'Nenhum canal novo criado',
                        inline: false
                    },
                    {
                        name: '📁 Categorias Criadas',
                        value: result.createdCategories.length > 0
                            ? result.createdCategories.map(c => `• ${c}`).join('\n')
                            : 'Nenhuma categoria nova',
                        inline: true
                    },
                    {
                        name: '🎭 Cargos Verificados',
                        value: result.rolesChecked.length > 0
                            ? result.rolesChecked.map(r => `• ${r}`).join('\n')
                            : 'Nenhum cargo novo',
                        inline: true
                    }
                ],
                timestamp: new Date(),
                footer: {
                    text: 'Sistema de Setup • Guild Bot'
                }
            };

            if (result.existingChannels.length > 0) {
                embedResumo.fields.push({
                    name: '✅ Já Existentes (mantidos)',
                    value: `${result.existingChannels.length} canais/categorias já existiam`,
                    inline: false
                });
            }

            await interaction.editReply({
                content: null,
                embeds: [embedResumo]
            });

            console.log(`✅ Estrutura instalada por ${interaction.user.tag}`);

        } catch (error) {
            console.error('❌ Erro na instalação:', error);
            await interaction.editReply({
                content: `❌ **Erro na instalação:**\n\`\`\`${error.message}\`\`\``,
                embeds: []
            });
        }
    },

    /**
     * 🎯 NOVO: Instala a estrutura do Killboard
     */
    async installKillboard(guild) {
        const botMember = guild.members.me;

        // Verificar se já existe categoria
        const existingCategory = guild.channels.cache.find(
            c => c.name === '💀 KILLBOARD' && c.type === ChannelType.GuildCategory
        );

        let killboardCategory;

        if (!existingCategory) {
            // Criar categoria
            killboardCategory = await guild.channels.create({
                name: '💀 KILLBOARD',
                type: ChannelType.GuildCategory,
                position: 99, // Colocar no final
                permissionOverwrites: [
                    {
                        id: guild.id,
                        allow: [PermissionFlagsBits.ViewChannel],
                        deny: [PermissionFlagsBits.SendMessages, PermissionFlagsBits.Connect, PermissionFlagsBits.Speak]
                    },
                    {
                        id: botMember.id,
                        allow: [
                            PermissionFlagsBits.ViewChannel,
                            PermissionFlagsBits.SendMessages,
                            PermissionFlagsBits.EmbedLinks,
                            PermissionFlagsBits.AttachFiles,
                            PermissionFlagsBits.ReadMessageHistory
                        ]
                    }
                ]
            });
            console.log(`[Instalar] Categoria KILLBOARD criada: ${killboardCategory.id}`);
        } else {
            killboardCategory = existingCategory;
            console.log(`[Instalar] Categoria KILLBOARD já existe: ${killboardCategory.id}`);
        }

        // Verificar/criar canal de kills
        const existingKillChannel = guild.channels.cache.find(
            c => c.name === '💀-kill-feed' && c.parentId === killboardCategory.id
        );

        if (!existingKillChannel) {
            await guild.channels.create({
                name: '💀-kill-feed',
                type: ChannelType.GuildText,
                parent: killboardCategory.id,
                topic: '💀 Kills da Guilda - Monitoramento automático via API Albion Online',
                slowMode: 5, // 5 segundos entre mensagens (evitar spam)
                permissionOverwrites: [
                    {
                        id: guild.id,
                        allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.ReadMessageHistory],
                        deny: [PermissionFlagsBits.SendMessages, PermissionFlagsBits.AddReactions]
                    },
                    {
                        id: botMember.id,
                        allow: [
                            PermissionFlagsBits.ViewChannel,
                            PermissionFlagsBits.SendMessages,
                            PermissionFlagsBits.EmbedLinks,
                            PermissionFlagsBits.AttachFiles,
                            PermissionFlagsBits.ReadMessageHistory
                        ]
                    }
                ]
            });
            console.log('[Instalar] Canal 💀-kill-feed criado');
        }

        // Verificar/criar canal de deaths
        const existingDeathChannel = guild.channels.cache.find(
            c => c.name === '☠️-death-feed' && c.parentId === killboardCategory.id
        );

        if (!existingDeathChannel) {
            await guild.channels.create({
                name: '☠️-death-feed',
                type: ChannelType.GuildText,
                parent: killboardCategory.id,
                topic: '☠️ Mortes da Guilda - Monitoramento automático via API Albion Online',
                slowMode: 5,
                permissionOverwrites: [
                    {
                        id: guild.id,
                        allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.ReadMessageHistory],
                        deny: [PermissionFlagsBits.SendMessages, PermissionFlagsBits.AddReactions]
                    },
                    {
                        id: botMember.id,
                        allow: [
                            PermissionFlagsBits.ViewChannel,
                            PermissionFlagsBits.SendMessages,
                            PermissionFlagsBits.EmbedLinks,
                            PermissionFlagsBits.AttachFiles,
                            PermissionFlagsBits.ReadMessageHistory
                        ]
                    }
                ]
            });
            console.log('[Instalar] Canal ☠️-death-feed criado');
        }

        // Enviar mensagem de boas-vindas/configuração no canal de kills
        try {
            const killChannel = guild.channels.cache.find(c => c.name === '💀-kill-feed');
            if (killChannel) {
                await KillboardHandler.sendConfigPanel(killChannel);
            }
        } catch (e) {
            console.log('[Instalar] Não foi possível enviar painel de config:', e.message);
        }

        return {
            category: killboardCategory,
            success: true
        };
    },

    /**
     * 🛒 NOVO: Instala a estrutura do Mercado Albion
     */
    async installMarketStructure(guild) {
        const botMember = guild.members.me;

        // Verificar se já existe categoria
        const existingCategory = guild.channels.cache.find(
            c => c.name === '🛒 SHOPPING' && c.type === ChannelType.GuildCategory
        );

        let marketCategory;

        if (!existingCategory) {
            // Criar categoria
            marketCategory = await guild.channels.create({
                name: '🛒 SHOPPING',
                type: ChannelType.GuildCategory,
                position: 10,
                permissionOverwrites: [
                    {
                        id: guild.id,
                        allow: [PermissionFlagsBits.ViewChannel],
                        deny: [PermissionFlagsBits.SendMessages, PermissionFlagsBits.Connect, PermissionFlagsBits.Speak]
                    },
                    {
                        id: botMember.id,
                        allow: [
                            PermissionFlagsBits.ViewChannel,
                            PermissionFlagsBits.SendMessages,
                            PermissionFlagsBits.EmbedLinks,
                            PermissionFlagsBits.AttachFiles,
                            PermissionFlagsBits.ReadMessageHistory
                        ]
                    }
                ]
            });
            console.log(`[Instalar] Categoria SHOPPING criada: ${marketCategory.id}`);
        } else {
            marketCategory = existingCategory;
            console.log(`[Instalar] Categoria SHOPPING já existe: ${marketCategory.id}`);
        }

        // Verificar/criar canal de mercado
        const existingMarketChannel = guild.channels.cache.find(
            c => c.name === '🛒╠mercado-albion' && c.parentId === marketCategory.id
        );

        if (!existingMarketChannel) {
            const channel = await guild.channels.create({
                name: '🛒╠mercado-albion',
                type: ChannelType.GuildText,
                parent: marketCategory.id,
                topic: '🛒 Pesquisa de preços do Albion Online - Dados em tempo real',
                permissionOverwrites: [
                    {
                        id: guild.id,
                        allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.ReadMessageHistory],
                        deny: [PermissionFlagsBits.SendMessages]
                    },
                    {
                        id: botMember.id,
                        allow: [
                            PermissionFlagsBits.ViewChannel,
                            PermissionFlagsBits.SendMessages,
                            PermissionFlagsBits.EmbedLinks,
                            PermissionFlagsBits.AttachFiles,
                            PermissionFlagsBits.ReadMessageHistory
                        ]
                    }
                ]
            });
            console.log('[Instalar] Canal 🛒╠mercado-albion criado');

            // Enviar painel inicial
            const MarketHandler = require('../handlers/marketHandler');
            await MarketHandler.sendPanel(channel);
        }

        return {
            category: marketCategory,
            success: true
        };
    }
};