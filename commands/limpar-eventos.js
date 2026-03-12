const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const Database = require('../utils/database');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('limpar-eventos')
    .setDescription('⚠️ [DONO] Limpa todo o histórico de eventos do servidor')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction, client) {
    try {
      // Verificar se é o dono do bot
      const ownerId = process.env.OWNER_ID;
      if (interaction.user.id !== ownerId) {
        return interaction.reply({
          content: '⛔ **ACESSO NEGADO**\n\nEste comando é restrito ao dono do bot!',
          ephemeral: true
        });
      }

      // Embed de confirmação de segurança
      const embed = new EmbedBuilder()
        .setTitle('⚠️ CONFIRMAÇÃO DE SEGURANÇA')
        .setDescription(
          '**Você está prestes a executar uma ação irreversível!**\n\n' +
          '🗑️ **Ação:** Limpar todo o histórico de eventos\n' +
          '📊 **Dados afetados:**\n' +
          '• Histórico de todos os eventos finalizados\n' +
          '• Dados de participação em eventos\n' +
          '• Estatísticas de eventos\n\n' +
          '❌ **Esta ação não pode ser desfeita!**\n\n' +
          '**Tem certeza absoluta que deseja prosseguir?**'
        )
        .setColor(0xFF0000)
        .setThumbnail('https://i.imgur.com/8QBYRrm.png')
        .setFooter({ text: 'Comando restrito ao Dono • NOTAG Bot' })
        .setTimestamp();

      const botoes = new ActionRowBuilder()
        .addComponents(
          new ButtonBuilder()
            .setCustomId('confirmar_limpar_eventos')
            .setLabel('✅ SIM, LIMPAR TUDO')
            .setStyle(ButtonStyle.Danger),
          new ButtonBuilder()
            .setCustomId('cancelar_limpar_eventos')
            .setLabel('❌ CANCELAR')
            .setStyle(ButtonStyle.Success)
        );

      await interaction.reply({
        embeds: [embed],
        components: [botoes],
        ephemeral: true
      });

      // Criar collector para a confirmação
      const collector = interaction.channel.createMessageComponentCollector({
        filter: i => i.user.id === ownerId &&
          (i.customId === 'confirmar_limpar_eventos' || i.customId === 'cancelar_limpar_eventos'),
        time: 30000, // 30 segundos para confirmar
        max: 1
      });

      collector.on('collect', async (i) => {
        if (i.customId === 'confirmar_limpar_eventos') {
          // Executar limpeza
          await i.deferUpdate();

          try {
            // Contar eventos no banco antes de limpar
            const events = await Database.db.allAsync('SELECT * FROM events') || [];
            const eventCount = events.length;

            // Limpar tabela de eventos no banco
            await Database.db.runAsync('DELETE FROM events');

            // Limpar eventos globais
            const activeCount = global.finishedEvents?.size || 0;
            if (global.finishedEvents) global.finishedEvents.clear();
            if (global.activeEvents) global.activeEvents.clear();
            if (global.simulations) global.simulations.clear();

            const embedSuccess = new EmbedBuilder()
              .setTitle('✅ LIMPEZA CONCLUÍDA')
              .setDescription(
                '🗑️ **Todos os eventos foram apagados!**\n\n' +
                `📊 **Estatísticas:**\n` +
                `• Eventos no histórico removidos: ${eventCount}\n` +
                `• Eventos ativos/finalizados removidos: ${activeCount}\n` +
                `• Data da limpeza: ${new Date().toLocaleString('pt-BR')}\n\n` +
                `👤 **Executado por:** ${interaction.user.tag}`
              )
              .setColor(0x00FF00)
              .setTimestamp();

            await i.editReply({
              embeds: [embedSuccess],
              components: []
            });

            // Log no console
            console.log(`[ADMIN] ${interaction.user.tag} limpou todo o histórico de eventos. Eventos removidos: ${eventCount}`);

          } catch (error) {
            console.error('[LimparEventos] Erro ao limpar:', error);
            await i.editReply({
              content: '❌ Erro ao limpar eventos. Verifique o console.',
              components: [],
              embeds: []
            });
          }

        } else {
          // Cancelado
          await i.update({
            content: '✅ **Operação cancelada.** Nenhum dado foi alterado.',
            components: [],
            embeds: []
          });
        }
      });

      collector.on('end', (collected) => {
        if (collected.size === 0) {
          interaction.editReply({
            content: '⏱️ **Tempo esgotado.** Operação cancelada automaticamente.',
            components: [],
            embeds: []
          }).catch(() => {});
        }
      });

    } catch (error) {
      console.error('[LimparEventos] Erro:', error);
      await interaction.reply({
        content: '❌ Erro ao processar comando.',
        ephemeral: true
      });
    }
  }
};