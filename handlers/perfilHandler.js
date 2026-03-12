const {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  UserSelectMenuBuilder
} = require('discord.js');
const XpHandler = require('./xpHandler');

/**
 * Handler do Perfil - Agora com sistema de seleção de usuários igual ao OrbHandler
 */
class PerfilHandler {
  static async sendPerfilPanel(channel) {
    const embed = new EmbedBuilder()
      .setTitle('👤 PERFIL DO JOGADOR')
      .setDescription(
        '**Gerencie seu perfil e progresso!**\n\n' +
        '📊 Veja suas estatísticas\n' +
        '🏅 Conquistas e condecorações\n' +
        '💎 Nível e XP\n\n' +
        'Use os botões abaixo para interagir:'
      )
      .setColor(0x3498DB)
      .setFooter({ text: 'Sistema de Perfil • NOTAG Bot' })
      .setTimestamp();

    const botoes = new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setCustomId('btn_criar_xp_event')
          .setLabel('🏆 Criar Evento XP')
          .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
          .setCustomId('btn_depositar_xp_manual')
          .setLabel('💎 Depositar XP')
          .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
          .setCustomId('btn_ver_perfil')
          .setLabel('👤 Meu Perfil')
          .setStyle(ButtonStyle.Secondary)
      );

    await channel.send({ embeds: [embed], components: [botoes] });
  }

  // ✅ NOVO: Sistema de seleção de usuários igual ao OrbHandler
  static async showDepositXpModal(interaction) {
    // Inicializar temp data
    if (!global.xpDepositTemp) global.xpDepositTemp = new Map();

    const tempData = global.xpDepositTemp.get(interaction.user.id) || {
      users: [],
      step: 'selecting'
    };
    global.xpDepositTemp.set(interaction.user.id, tempData);

    const embed = new EmbedBuilder()
      .setTitle('💎 DEPOSITAR XP MANUAL')
      .setDescription(
        '**Como funciona:**\n\n' +
        '1️⃣ Clique em **"Adicionar Participantes"** para selecionar jogadores\n' +
        '2️⃣ Você pode selecionar até 25 jogadores\n' +
        '3️⃣ Depois, você definirá a quantidade de XP e o motivo\n\n' +
        '💡 **Dica:** Segure Ctrl (ou Cmd no Mac) para selecionar múltiplos jogadores!\n\n' +
        '⚠️ **Apenas ADM ou Staff podem usar esta função!**'
      )
      .setColor(0x3498DB);

    const botoes = new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setCustomId('xp_select_users')
          .setLabel('👥 Adicionar Participantes')
          .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
          .setCustomId('xp_clear_users')
          .setLabel('🗑️ Limpar Seleção')
          .setStyle(ButtonStyle.Secondary)
      );

    // Mostrar participantes já selecionados (se houver)
    if (tempData.users.length > 0) {
      const mentions = tempData.users.map(id => `<@${id}>`).join(', ');
      embed.addFields({
        name: `✅ Participantes selecionados (${tempData.users.length})`,
        value: mentions
      });

      // Adicionar botão de prosseguir se já tiver participantes
      botoes.addComponents(
        new ButtonBuilder()
          .setCustomId('xp_proceed_to_modal')
          .setLabel('➡️ Prosseguir')
          .setStyle(ButtonStyle.Success)
      );
    }

    await interaction.reply({
      embeds: [embed],
      components: [botoes],
      ephemeral: true
    });
  }

  // ✅ NOVO: Abrir seleção de usuários (UserSelectMenu) - igual ao OrbHandler
  static async openUserSelection(interaction) {
    const row = new ActionRowBuilder()
      .addComponents(
        new UserSelectMenuBuilder()
          .setCustomId('select_xp_target_users')
          .setPlaceholder('🔍 Pesquise e selecione os jogadores...')
          .setMinValues(1)
          .setMaxValues(25)
      );

    await interaction.reply({
      content: '🔍 **Selecione os jogadores que receberão XP:**\n\n💡 Você pode digitar o nome para pesquisar!',
      components: [row],
      ephemeral: true
    });
  }

  // ✅ NOVO: Processar seleção de usuários - igual ao OrbHandler
  static async processUserSelection(interaction) {
    const selectedUsers = interaction.values;

    if (!global.xpDepositTemp) global.xpDepositTemp = new Map();
    const tempData = global.xpDepositTemp.get(interaction.user.id) || { users: [], step: 'selecting' };

    // Adicionar novos usuários (evitar duplicados)
    const existingUsers = new Set(tempData.users);
    selectedUsers.forEach(id => existingUsers.add(id));
    tempData.users = Array.from(existingUsers);

    global.xpDepositTemp.set(interaction.user.id, tempData);

    const mentions = tempData.users.map(id => `<@${id}>`).join(', ');

    // Atualizar a mensagem original
    const embed = new EmbedBuilder()
      .setTitle('👥 PARTICIPANTES SELECIONADOS')
      .setDescription(
        `✅ **${tempData.users.length} jogador(es) selecionado(s):**\n${mentions}\n\n` +
        'Clique em **"Prosseguir"** para continuar ou **"Adicionar Mais"** para incluir outros jogadores.'
      )
      .setColor(0x2ECC71);

    const botoes = new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setCustomId('xp_proceed_to_modal')
          .setLabel('➡️ Prosseguir para Depósito')
          .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
          .setCustomId('xp_select_users')
          .setLabel('➕ Adicionar Mais')
          .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
          .setCustomId('xp_clear_users')
          .setLabel('🗑️ Limpar')
          .setStyle(ButtonStyle.Secondary)
      );

    await interaction.update({
      content: null,
      embeds: [embed],
      components: [botoes]
    });
  }

  // ✅ NOVO: Limpar seleção - igual ao OrbHandler
  static async clearUserSelection(interaction) {
    if (!global.xpDepositTemp) global.xpDepositTemp = new Map();
    const tempData = global.xpDepositTemp.get(interaction.user.id);

    if (tempData) {
      tempData.users = [];
      global.xpDepositTemp.set(interaction.user.id, tempData);
    }

    await interaction.update({
      content: '🗑️ **Seleção limpa!** Clique em "Adicionar Participantes" para selecionar novamente.',
      embeds: [],
      components: [
        new ActionRowBuilder()
          .addComponents(
            new ButtonBuilder()
              .setCustomId('xp_select_users')
              .setLabel('👥 Adicionar Participantes')
              .setStyle(ButtonStyle.Primary)
          )
      ]
    });
  }

  // ✅ ATUALIZADO: Abre modal com múltiplos usuários selecionados
  static async createManualXpModal(interaction) {
    const tempData = global.xpDepositTemp?.get(interaction.user.id);

    if (!tempData || tempData.users.length === 0) {
      return interaction.reply({
        content: '❌ Nenhum participante selecionado! Selecione jogadores primeiro.',
        ephemeral: true
      });
    }

    const modal = new ModalBuilder()
      .setCustomId(`modal_depositar_xp_multi`)
      .setTitle(`💎 Depositar XP - ${tempData.users.length} jogadores`);

    const quantidadeInput = new TextInputBuilder()
      .setCustomId('quantidade_xp')
      .setLabel('Quantidade de XP por jogador')
      .setPlaceholder('Ex: 1000')
      .setStyle(TextInputStyle.Short)
      .setRequired(true)
      .setMaxLength(10);

    const motivoInput = new TextInputBuilder()
      .setCustomId('motivo_xp')
      .setLabel('Motivo')
      .setPlaceholder('Ex: Recompensa por excelente desempenho')
      .setStyle(TextInputStyle.Paragraph)
      .setRequired(true)
      .setMaxLength(500);

    modal.addComponents(
      new ActionRowBuilder().addComponents(quantidadeInput),
      new ActionRowBuilder().addComponents(motivoInput)
    );

    await interaction.showModal(modal);
  }

  // ✅ ATUALIZADO: Processa depósito para múltiplos usuários
  static async processManualXpDeposit(interaction) {
    try {
      const quantidade = parseInt(interaction.fields.getTextInputValue('quantidade_xp'));
      const motivo = interaction.fields.getTextInputValue('motivo_xp');

      if (isNaN(quantidade) || quantidade <= 0) {
        return interaction.reply({
          content: '❌ Quantidade inválida!',
          ephemeral: true
        });
      }

      const isADM = interaction.member.roles.cache.some(r => r.name === 'ADM');
      const isStaff = interaction.member.roles.cache.some(r => r.name === 'Staff');

      if (!isADM && !isStaff) {
        return interaction.reply({
          content: '❌ Apenas ADM ou Staff podem depositar XP manualmente!',
          ephemeral: true
        });
      }

      // Pegar usuários do temp
      const tempData = global.xpDepositTemp?.get(interaction.user.id);
      if (!tempData || tempData.users.length === 0) {
        return interaction.reply({
          content: '❌ Erro: Nenhum participante selecionado! Tente novamente.',
          ephemeral: true
        });
      }

      const userIds = tempData.users;
      const totalXp = quantidade * userIds.length;

      const canalLogXp = interaction.guild.channels.cache.find(c => c.name === '📜╠log-xp');

      // Depositar XP para todos os usuários selecionados
      let sucessos = 0;
      for (const userId of userIds) {
        try {
          await XpHandler.addXp(
            userId,
            quantidade,
            `Depósito Manual: ${motivo}`,
            interaction.guild,
            canalLogXp
          );
          sucessos++;
        } catch (e) {
          console.error(`[PerfilHandler] Erro ao depositar XP para ${userId}:`, e);
        }
      }

      // Limpar temp
      global.xpDepositTemp.delete(interaction.user.id);

      await interaction.reply({
        content: `✅ \`${quantidade}\` XP depositados para **${sucessos}/${userIds.length}** jogadores!\n**Motivo:** ${motivo}\n**Total distribuído:** ${totalXp.toLocaleString()} XP`,
        ephemeral: true
      });

    } catch (error) {
      console.error(`[PerfilHandler] Error processing manual XP:`, error);
      await interaction.reply({
        content: '❌ Erro ao depositar XP.',
        ephemeral: true
      });
    }
  }

  static async showProfile(interaction) {
    try {
      const embed = await XpHandler.showProfile(interaction.user.id, interaction.guild);

      if (embed) {
        try {
          await interaction.user.send({ embeds: [embed] });
          await interaction.reply({
            content: '✅ Seu perfil foi enviado no privado!',
            ephemeral: true
          });
        } catch (dmError) {
          console.error(`[PerfilHandler] Could not send DM:`, dmError);
          await interaction.reply({
            embeds: [embed],
            ephemeral: true
          });
        }
      } else {
        await interaction.reply({
          content: '❌ Erro ao carregar perfil.',
          ephemeral: true
        });
      }
    } catch (error) {
      console.error(`[PerfilHandler] Error showing profile:`, error);
      await interaction.reply({
        content: '❌ Erro ao mostrar perfil.',
        ephemeral: true
      });
    }
  }
}

module.exports = PerfilHandler;