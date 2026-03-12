const { SlashCommandBuilder, PermissionFlagsBits, ChannelType } = require('discord.js');
const SetupManager = require('../handlers/setupManager');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('desistalar')
        .setDescription('Remove toda a estrutura criada pelo bot (canais, cargos e permissões)')
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

        // Verificar se o usuário realmente quer desinstalar
        await interaction.reply({
            content: '⚠️ **ATENÇÃO!** Você está prestes a remover TODA a estrutura do bot.\n' +
                     'Isso inclui: canais, categorias e cargos criados pelo bot.\n\n' +
                     '**Esta ação não pode ser desfeita!**\n\n' +
                     'Clique em ✅ **Confirmar** para prosseguir ou ❌ **Cancelar** para abortar.',
            components: [
                {
                    type: 1,
                    components: [
                        {
                            type: 2,
                            style: 4, // Danger
                            label: '✅ Confirmar Desinstalação',
                            custom_id: 'confirmar_desistalar',
                            emoji: '⚠️'
                        },
                        {
                            type: 2,
                            style: 2, // Secondary
                            label: '❌ Cancelar',
                            custom_id: 'cancelar_desistalar'
                        }
                    ]
                }
            ],
            ephemeral: true
        });

        // Criar collector para aguardar resposta
        const filter = i => i.user.id === interaction.user.id;
        const collector = interaction.channel.createMessageComponentCollector({ 
            filter, 
            time: 30000,
            max: 1 
        });

        collector.on('collect', async i => {
            if (i.customId === 'confirmar_desistalar') {
                await i.update({ content: '🗑️ Iniciando desinstalação...', components: [] });

                try {
                    const setup = new SetupManager(interaction.guild, interaction);

                    // 🛒 NOVO: Remover estrutura do Mercado primeiro (fora do SetupManager padrão)
                    await this.uninstallMarketStructure(interaction.guild);

                    // Remover estrutura principal
                    const result = await setup.uninstall();

                    // 🎯 NOVO: Remover estrutura do Killboard (se existir)
                    await this.uninstallKillboard(interaction.guild);

                    const embedResumo = {
                        color: result.success ? 0xE74C3C : 0xF39C12,
                        title: '🗑️ **DESINSTALAÇÃO CONCLUÍDA**',
                        description: result.message,
                        fields: [
                            {
                                name: '🗑️ Canais Removidos',
                                value: result.deletedChannels.length > 0
                                    ? result.deletedChannels.slice(0, 15).map(c => `• ${c}`).join('\n') +
                                      (result.deletedChannels.length > 15 ? `\n... e mais ${result.deletedChannels.length - 15}` : '')
                                    : 'Nenhum canal removido',
                                inline: false
                            },
                            {
                                name: '📁 Categorias Removidas',
                                value: result.deletedCategories.length > 0
                                    ? result.deletedCategories.map(c => `• ${c}`).join('\n')
                                    : 'Nenhuma categoria removida',
                                inline: true
                            },
                            {
                                name: '🎭 Cargos Removidos',
                                value: result.deletedRoles.length > 0
                                    ? result.deletedRoles.map(r => `• ${r}`).join('\n')
                                    : 'Nenhum cargo removido',
                                inline: true
                            }
                        ],
                        timestamp: new Date(),
                        footer: {
                            text: 'Sistema de Setup • Guild Bot'
                        }
                    };

                    if (result.errors.length > 0) {
                        embedResumo.fields.push({
                            name: '⚠️ Erros Encontrados',
                            value: `${result.errors.length} erro(s) ocorreram durante a desinstalação`,
                            inline: false
                        });
                    }

                    await i.editReply({
                        content: null,
                        embeds: [embedResumo]
                    });

                    console.log(`🗑️ Estrutura desinstalada por ${interaction.user.tag}`);

                } catch (error) {
                    console.error('❌ Erro na desinstalação:', error);
                    await i.editReply({
                        content: `❌ **Erro na desinstalação:**\n\`\`\`${error.message}\`\`\``,
                        embeds: []
                    });
                }
            } else {
                await i.update({ 
                    content: '✅ Desinstalação cancelada. Nenhuma alteração foi feita.',
                    components: [] 
                });
            }
        });

        collector.on('end', collected => {
            if (collected.size === 0) {
                interaction.editReply({ 
                    content: '⏱️ Tempo esgotado. Desinstalação cancelada automaticamente.',
                    components: [] 
                });
            }
        });
    },

    /**
     * 🛒 NOVO: Remove a estrutura do Mercado Albion
     */
    async uninstallMarketStructure(guild) {
        console.log('[Desistalar] Verificando estrutura do Mercado...');

        try {
            // Procurar e remover canal de mercado
            const marketChannel = guild.channels.cache.find(
                c => c.name === '🛒╠mercado-albion' && c.type === ChannelType.GuildText
            );

            if (marketChannel) {
                await marketChannel.delete('Desinstalação do bot');
                console.log('[Desistalar] Canal 🛒╠mercado-albion removido');
            }

            // Procurar e remover categoria de shopping
            const marketCategory = guild.channels.cache.find(
                c => c.name === '🛒 SHOPPING' && c.type === ChannelType.GuildCategory
            );

            if (marketCategory) {
                await marketCategory.delete('Desinstalação do bot');
                console.log('[Desistalar] Categoria 🛒 SHOPPING removida');
            }

            return { success: true };
        } catch (error) {
            console.error('[Desistalar] Erro ao remover estrutura do mercado:', error);
            return { success: false, error: error.message };
        }
    },

    /**
     * 🎯 NOVO: Remove a estrutura do Killboard
     */
    async uninstallKillboard(guild) {
        console.log('[Desistalar] Verificando estrutura do Killboard...');

        try {
            // Procurar e remover canais de killboard
            const killChannel = guild.channels.cache.find(
                c => c.name === '💀-kill-feed' && c.type === ChannelType.GuildText
            );

            if (killChannel) {
                await killChannel.delete('Desinstalação do bot');
                console.log('[Desistalar] Canal 💀-kill-feed removido');
            }

            const deathChannel = guild.channels.cache.find(
                c => c.name === '☠️-death-feed' && c.type === ChannelType.GuildText
            );

            if (deathChannel) {
                await deathChannel.delete('Desinstalação do bot');
                console.log('[Desistalar] Canal ☠️-death-feed removido');
            }

            // Procurar e remover categoria de killboard
            const killboardCategory = guild.channels.cache.find(
                c => c.name === '💀 KILLBOARD' && c.type === ChannelType.GuildCategory
            );

            if (killboardCategory) {
                await killboardCategory.delete('Desinstalação do bot');
                console.log('[Desistalar] Categoria 💀 KILLBOARD removida');
            }

            // Limpar configuração do killboard se existir
            if (global.guildConfig && global.guildConfig.has(guild.id)) {
                const config = global.guildConfig.get(guild.id);
                if (config.killboard) {
                    delete config.killboard;
                    global.guildConfig.set(guild.id, config);
                    console.log('[Desistalar] Configuração do Killboard removida');
                }
            }

            return { success: true };
        } catch (error) {
            console.error('[Desistalar] Erro ao remover estrutura do killboard:', error);
            return { success: false, error: error.message };
        }
    }
};