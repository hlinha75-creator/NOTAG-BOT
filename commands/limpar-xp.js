const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const Database = require('../utils/database');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('limpar-xp')
    .setDescription('⚠️ [DONO] Zera o XP, níveis e conquistas de TODOS os jogadores')
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
        .setTitle('⚠️ CONFIRMAÇÃO DE SEGURANÇA - RESET TOTAL DE XP')
        .setDescription(
          '**⚠️⚠️⚠️ ATENÇÃO: AÇÃO EXTREMA ⚠️⚠️⚠️**\n\n' +
          '🗑️ **Ação:** Zerar XP de TODOS os jogadores\n' +
          '📊 **Dados que serão perdidos:**\n' +
          '• Níveis de todos os jogadores (voltarão para 1)\n' +
          '• XP acumulado (total e atual)\n' +
          '• Conquistas/Insígnias de todos\n' +
          '• Histórico de progresso\n\n' +
          '❌ **ESTA AÇÃO É IRREVERSÍVEL!**\n' +
          '💀 **Todos os jogadores perderão seu progresso permanentemente!**\n\n' +
          '**Tem certeza absoluta que deseja prosseguir?**'
        )
        .setColor(0xFF0000)
        .setThumbnail('https://i.imgur.com/8QBYRrm.png')
        .setFooter({ text: 'Comando restrito ao Dono • NOTAG Bot' })
        .setTimestamp();

      const botoes = new ActionRowBuilder()
        .addComponents(
          new ButtonBuilder()
            .setCustomId('confirmar_limpar_xp')
            .setLabel('⚠️ SIM, RESETAR TUDO')
            .setStyle(ButtonStyle.Danger),
          new ButtonBuilder()
            .setCustomId('cancelar_limpar_xp')
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
          (i.customId === 'confirmar_limpar_xp' || i.customId === 'cancelar_limpar_xp'),
        time: 30000,
        max: 1
      });

      collector.on('collect', async (i) => {
        if (i.customId === 'confirmar_limpar_xp') {
          await i.deferUpdate();

          try {
            // Buscar todos os usuários
            const users = await Database.db.allAsync('SELECT * FROM users') || [];
            let count = 0;

            // Resetar XP de todos os usuários
            for (const user of users) {
              await Database.db.runAsync(`
                UPDATE users SET 
                  level = 1,
                  xp = 0,
                  total_xp = 0,
                  insignias = '[]',
                  eventos_participados = 0,
                  updated_at = ?
                WHERE user_id = ?
              `, [Date.now(), user.user_id]);
              count++;
            }

            const embedSuccess = new EmbedBuilder()
              .setTitle('✅ RESET DE XP CONCLUÍDO')
              .setDescription(
                '💀 **Todo o progresso foi resetado!**\n\n' +
                `📊 **Estatísticas:**\n` +
                `• Jogadores afetados: ${count}\n` +
                `• Níveis resetados: ${count}\n` +
                `• Conquistas removidas: Todas\n` +
                `• Data do reset: ${new Date().toLocaleString('pt-BR')}\n\n` +
                `👤 **Executado por:** ${interaction.user.tag}\n\n` +
                `⚠️ Todos os jogadores começarão do nível 1 novamente.`
              )
              .setColor(0x00FF00)
              .setTimestamp();

            await i.editReply({
              embeds: [embedSuccess],
              components: []
            });

            console.log(`[ADMIN] ${interaction.user.tag} resetou o XP de ${count} jogadores.`);

          } catch (error) {
            console.error('[LimparXP] Erro ao limpar:', error);
            await i.editReply({
              content: '❌ Erro ao resetar XP. Verifique o console.',
              components: [],
              embeds: []
            });
          }

        } else {
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
      console.error('[LimparXP] Erro:', error);
      await interaction.reply({
        content: '❌ Erro ao processar comando.',
        ephemeral: true
      });
    }
  }
};