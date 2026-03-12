const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const Database = require('../utils/database');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('limpar-saldo')
    .setDescription('⚠️ [DONO] Zera os saldos de TODOS os jogadores')
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
        .setTitle('⚠️ CONFIRMAÇÃO DE SEGURANÇA - RESET DE SALDOS')
        .setDescription(
          '**⚠️ ATENÇÃO: AÇÃO IRREVERSÍVEL ⚠️**\n\n' +
          '💰 **Ação:** Zerar saldos de TODOS os jogadores\n' +
          '📊 **Dados que serão perdidos:**\n' +
          '• Saldo atual de todos (voltará para 0)\n' +
          '• Total recebido (histórico financeiro)\n' +
          '• Total sacado\n' +
          '• Empréstimos pendentes\n\n' +
          '❌ **ESTA AÇÃO NÃO PODE SER DESFEITA!**\n' +
          '💸 **Todo o dinheiro dos jogadores será perdido!**\n\n' +
          '**Tem certeza absoluta que deseja prosseguir?**'
        )
        .setColor(0xFF0000)
        .setThumbnail('https://i.imgur.com/8QBYRrm.png')
        .setFooter({ text: 'Comando restrito ao Dono • NOTAG Bot' })
        .setTimestamp();

      const botoes = new ActionRowBuilder()
        .addComponents(
          new ButtonBuilder()
            .setCustomId('confirmar_limpar_saldo')
            .setLabel('⚠️ SIM, ZERAR TUDO')
            .setStyle(ButtonStyle.Danger),
          new ButtonBuilder()
            .setCustomId('cancelar_limpar_saldo')
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
          (i.customId === 'confirmar_limpar_saldo' || i.customId === 'cancelar_limpar_saldo'),
        time: 30000,
        max: 1
      });

      collector.on('collect', async (i) => {
        if (i.customId === 'confirmar_limpar_saldo') {
          await i.deferUpdate();

          try {
            // Buscar todos os usuários do banco
            const users = await Database.db.allAsync('SELECT * FROM users') || [];
            let count = 0;
            let totalSaldo = 0;

            // Zerar saldo de todos os usuários
            for (const user of users) {
              totalSaldo += user.saldo || 0;

              await Database.db.runAsync(`
                UPDATE users SET 
                  saldo = 0, 
                  total_recebido = 0, 
                  total_sacado = 0, 
                  emprestimos_pendentes = 0, 
                  total_emprestimos = 0,
                  updated_at = ?
                WHERE user_id = ?
              `, [Date.now(), user.user_id]);

              count++;
            }

            const embedSuccess = new EmbedBuilder()
              .setTitle('✅ RESET DE SALDOS CONCLUÍDO')
              .setDescription(
                '💸 **Todos os saldos foram zerados!**\n\n' +
                `📊 **Estatísticas:**\n` +
                `• Jogadores afetados: ${count}\n` +
                `• Total de prata removida: ${totalSaldo.toLocaleString()}\n` +
                `• Empréstimos cancelados: Todos\n` +
                `• Data do reset: ${new Date().toLocaleString('pt-BR')}\n\n` +
                `👤 **Executado por:** ${interaction.user.tag}\n\n` +
                `⚠️ Todos os jogadores começarão com 0 de saldo.`
              )
              .setColor(0x00FF00)
              .setTimestamp();

            await i.editReply({
              embeds: [embedSuccess],
              components: []
            });

            console.log(`[ADMIN] ${interaction.user.tag} zerou os saldos de ${count} jogadores. Total removido: ${totalSaldo}`);

          } catch (error) {
            console.error('[LimparSaldo] Erro ao limpar:', error);
            await i.editReply({
              content: '❌ Erro ao zerar saldos. Verifique o console.',
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
      console.error('[LimparSaldo] Erro:', error);
      await interaction.reply({
        content: '❌ Erro ao processar comando.',
        ephemeral: true
      });
    }
  }
};