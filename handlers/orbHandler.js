const {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  UserSelectMenuBuilder
} = require('discord.js');
const XpHandler = require('./xpHandler');

class OrbHandler {
  static async sendOrbPanel(channel) {
    const embed = new EmbedBuilder()
      .setTitle('🔮 DEPÓSITO DE ORBS XP')
      .setDescription(
        '**Deposite orbs para ganhar XP!**\n\n' +
        '🟢 **Orb Verde:** 40 XP (padrão)\n' +
        '🔵 **Orb Azul:** 90 XP (padrão)\n' +
        '🟣 **Orb Roxa:** 200 XP (padrão)\n' +
        '🟡 **Orb Dourada:** 500 XP (padrão)\n\n' +
        '💡 **Novo:** Você pode definir o valor de XP manualmente!\n\n' +
        '📸 **Anexe um print** comprovando a orb!'
      )
      .setColor(0x9B59B6)
      .setThumbnail('https://i.imgur.com/5K9Q5ZK.png')
      .setFooter({ text: 'Sistema de Orbs • NOTAG Bot' })
      .setTimestamp();

    const botao = new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setCustomId('btn_depositar_orb')
          .setLabel('🔮 Depositar Orb')
          .setStyle(ButtonStyle.Success)
      );

    await channel.send({ embeds: [embed], components: [botao] });
  }

  // ✅ NOVO: Etapa 1 - Seleção de usuários com busca/pesquisa
  static async showUserSelect(interaction) {
    // Primeiro, mostramos um modal para pesquisar/filter jogadores
    const embed = new EmbedBuilder()
      .setTitle('🔮 SELECIONAR PARTICIPANTES')
      .setDescription(
        '**Como funciona:**\n\n' +
        '1️⃣ Clique em **"Adicionar Participantes"** para selecionar jogadores\n' +
        '2️⃣ Você pode selecionar até 25 jogadores\n' +
        '3️⃣ Depois, você definirá o valor de XP e anexará o print\n\n' +
        '💡 **Dica:** Segure Ctrl (ou Cmd no Mac) para selecionar múltiplos jogadores!'
      )
      .setColor(0x9B59B6);

    const botoes = new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setCustomId('orb_select_users')
          .setLabel('👥 Adicionar Participantes')
          .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
          .setCustomId('orb_clear_users')
          .setLabel('🗑️ Limpar Seleção')
          .setStyle(ButtonStyle.Secondary)
      );

    // Inicializar temp data se não existir
    if (!global.orbTemp) global.orbTemp = new Map();

    const tempData = global.orbTemp.get(interaction.user.id) || {
      users: [],
      step: 'selecting'
    };
    global.orbTemp.set(interaction.user.id, tempData);

    // Mostrar participantes já selecionados (se houver)
    let content = '👥 **Selecione os participantes:**';
    if (tempData.users.length > 0) {
      const mentions = tempData.users.map(id => `<@${id}>`).join(', ');
      content += `\n\n✅ **Participantes selecionados (${tempData.users.length}):** ${mentions}`;

      // Adicionar botão de prosseguir se já tiver participantes
      botoes.addComponents(
        new ButtonBuilder()
          .setCustomId('orb_proceed_to_modal')
          .setLabel('➡️ Prosseguir')
          .setStyle(ButtonStyle.Success)
      );
    }

    await interaction.reply({
      content: content,
      embeds: [embed],
      components: [botoes],
      ephemeral: true
    });
  }

  // ✅ NOVO: Abrir seleção de usuários (UserSelectMenu)
  static async openUserSelection(interaction) {
    const row = new ActionRowBuilder()
      .addComponents(
        new UserSelectMenuBuilder()
          .setCustomId('select_orb_users')
          .setPlaceholder('🔍 Pesquise e selecione os jogadores...')
          .setMinValues(1)
          .setMaxValues(25)
      );

    await interaction.reply({
      content: '🔍 **Selecione os jogadores que participaram da orb:**\n\n💡 Você pode digitar o nome para pesquisar!',
      components: [row],
      ephemeral: true
    });
  }

  // ✅ NOVO: Processar seleção de usuários
  static async processUserSelection(interaction) {
    const selectedUsers = interaction.values;

    if (!global.orbTemp) global.orbTemp = new Map();
    const tempData = global.orbTemp.get(interaction.user.id) || { users: [], step: 'selecting' };

    // Adicionar novos usuários (evitar duplicados)
    const existingUsers = new Set(tempData.users);
    selectedUsers.forEach(id => existingUsers.add(id));
    tempData.users = Array.from(existingUsers);

    global.orbTemp.set(interaction.user.id, tempData);

    const mentions = tempData.users.map(id => `<@${id}>`).join(', ');

    // Atualizar a mensagem original
    const embed = new EmbedBuilder()
      .setTitle('🔮 PARTICIPANTES SELECIONADOS')
      .setDescription(
        `✅ **${tempData.users.length} jogador(es) selecionado(s):**\n${mentions}\n\n` +
        'Clique em **"Prosseguir"** para continuar ou **"Adicionar Mais"** para incluir outros jogadores.'
      )
      .setColor(0x2ECC71);

    const botoes = new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setCustomId('orb_proceed_to_modal')
          .setLabel('➡️ Prosseguir para Depósito')
          .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
          .setCustomId('orb_select_users')
          .setLabel('➕ Adicionar Mais')
          .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
          .setCustomId('orb_clear_users')
          .setLabel('🗑️ Limpar')
          .setStyle(ButtonStyle.Secondary)
      );

    await interaction.update({
      content: null,
      embeds: [embed],
      components: [botoes]
    });
  }

  // ✅ NOVO: Limpar seleção
  static async clearUserSelection(interaction) {
    if (!global.orbTemp) global.orbTemp = new Map();
    const tempData = global.orbTemp.get(interaction.user.id);

    if (tempData) {
      tempData.users = [];
      global.orbTemp.set(interaction.user.id, tempData);
    }

    await interaction.update({
      content: '🗑️ **Seleção limpa!** Clique em "Adicionar Participantes" para selecionar novamente.',
      embeds: [],
      components: [
        new ActionRowBuilder()
          .addComponents(
            new ButtonBuilder()
              .setCustomId('orb_select_users')
              .setLabel('👥 Adicionar Participantes')
              .setStyle(ButtonStyle.Primary)
          )
      ]
    });
  }

  // ✅ ATUALIZADO: Etapa 2 - Abrir modal com print E campo de XP customizado
  static async openOrbModal(interaction) {
    const tempData = global.orbTemp?.get(interaction.user.id);

    if (!tempData || tempData.users.length === 0) {
      return interaction.reply({
        content: '❌ Nenhum participante selecionado! Selecione jogadores primeiro.',
        ephemeral: true
      });
    }

    const modal = new ModalBuilder()
      .setCustomId(`modal_depositar_orb_${interaction.user.id}`)
      .setTitle('🔮 Depositar Orb XP');

    // Campo 1: Link do print
    const printInput = new TextInputBuilder()
      .setCustomId('link_print')
      .setLabel('📸 Link da print (Imgur, Discord, etc)')
      .setPlaceholder('https://i.imgur.com/exemplo.jpg')
      .setStyle(TextInputStyle.Short)
      .setRequired(true)
      .setMaxLength(500);

    // ✅ Campo 2: XP por participante (NOVO - customizado)
    const xpInput = new TextInputBuilder()
      .setCustomId('xp_amount')
      .setLabel('💎 XP por participante')
      .setPlaceholder('Ex: 40, 90, 200, 500 (ou qualquer valor)')
      .setStyle(TextInputStyle.Short)
      .setRequired(true)
      .setMaxLength(6);

    // Campo 3: Tipo de Orb (para referência)
    const tipoInput = new TextInputBuilder()
      .setCustomId('tipo_orb')
      .setLabel('🔮 Tipo de Orb (referência)')
      .setPlaceholder('Ex: Verde, Azul, Roxa, Dourada, Especial...')
      .setStyle(TextInputStyle.Short)
      .setRequired(false)
      .setMaxLength(50);

    // Campo 4: Observação
    const obsInput = new TextInputBuilder()
      .setCustomId('observacao')
      .setLabel('📝 Observação (opcional)')
      .setPlaceholder('Detalhes adicionais sobre o depósito...')
      .setStyle(TextInputStyle.Paragraph)
      .setRequired(false)
      .setMaxLength(500);

    modal.addComponents(
      new ActionRowBuilder().addComponents(printInput),
      new ActionRowBuilder().addComponents(xpInput), // ✅ Novo campo
      new ActionRowBuilder().addComponents(tipoInput),
      new ActionRowBuilder().addComponents(obsInput)
    );

    await interaction.showModal(modal);
  }

  // ✅ ATUALIZADO: Processar depósito com XP customizado
  static async processOrbDeposit(interaction) {
    try {
      const linkPrint = interaction.fields.getTextInputValue('link_print');
      const xpInput = interaction.fields.getTextInputValue('xp_amount').trim();
      const tipoOrb = interaction.fields.getTextInputValue('tipo_orb') || 'Não especificado';
      const observacao = interaction.fields.getTextInputValue('observacao') || 'Sem observação';

      // ✅ Validar XP
      const xpAmount = parseInt(xpInput.replace(/\./g, '').replace(/,/g, ''));

      if (isNaN(xpAmount) || xpAmount <= 0) {
        return interaction.reply({
          content: '❌ Valor de XP inválido! Digite apenas números.',
          ephemeral: true
        });
      }

      if (xpAmount > 10000) {
        return interaction.reply({
          content: '❌ Valor de XP muito alto! Máximo permitido: 10.000 XP.',
          ephemeral: true
        });
      }

      // Pegar usuários do temp
      const tempData = global.orbTemp?.get(interaction.user.id);
      if (!tempData || tempData.users.length === 0) {
        return interaction.reply({
          content: '❌ Erro: Nenhum participante selecionado! Tente novamente.',
          ephemeral: true
        });
      }

      const userIds = tempData.users;
      const totalXp = xpAmount * userIds.length;

      const depositId = `orb_${Date.now()}`;
      const depositData = {
        id: depositId,
        users: userIds,
        orbType: tipoOrb,
        xpAmount: xpAmount, // ✅ XP customizado
        totalXp: totalXp,
        print: linkPrint,
        observacao: observacao,
        depositorId: interaction.user.id,
        status: 'pendente',
        timestamp: Date.now()
      };

      if (!global.pendingOrbDeposits) global.pendingOrbDeposits = new Map();
      global.pendingOrbDeposits.set(depositId, depositData);

      // Limpar temp
      global.orbTemp.delete(interaction.user.id);

      // Enviar para financeiro
      const canalFinanceiro = interaction.guild.channels.cache.find(c => c.name === '📊╠financeiro');
      if (canalFinanceiro) {
        const userMentions = userIds.map(id => `<@${id}>`).join(', ');

        const embed = new EmbedBuilder()
          .setTitle('🔮 DEPÓSITO DE ORB XP PENDENTE')
          .setDescription(
            `**Depositante:** <@${interaction.user.id}>\n` +
            `**Jogadores:** ${userMentions}\n` +
            `**Quantidade:** ${userIds.length} participante(s)\n` +
            `**Tipo:** ${tipoOrb}\n` +
            `**XP por Jogador:** \`${xpAmount.toLocaleString()} XP\`\n` +
            `**XP Total:** \`${totalXp.toLocaleString()} XP\`\n` +
            `**Observação:** ${observacao}`
          )
          .setColor(0x9B59B6)
          .setImage(linkPrint)
          .setTimestamp();

        const botoes = new ActionRowBuilder()
          .addComponents(
            new ButtonBuilder()
              .setCustomId(`orb_approve_${depositId}`)
              .setLabel('✅ Aprovar')
              .setStyle(ButtonStyle.Success),
            new ButtonBuilder()
              .setCustomId(`orb_reject_${depositId}`)
              .setLabel('❌ Recusar')
              .setStyle(ButtonStyle.Danger)
          );

        const admRole = interaction.guild.roles.cache.find(r => r.name === 'ADM');
        const staffRole = interaction.guild.roles.cache.find(r => r.name === 'Staff');

        let mentions = '';
        if (admRole) mentions += `<@&${admRole.id}> `;
        if (staffRole) mentions += `<@&${staffRole.id}>`;

        await canalFinanceiro.send({
          content: mentions ? `🔔 ${mentions} Novo depósito de orb!` : '🔔 Novo depósito de orb!',
          embeds: [embed],
          components: [botoes]
        });
      }

      await interaction.reply({
        content: `✅ Depósito de orb enviado para aprovação!\n\n` +
                 `👥 **${userIds.length} jogadores** receberão **${xpAmount.toLocaleString()} XP** cada\n` +
                 `💎 **Total de XP:** ${totalXp.toLocaleString()}\n` +
                 `📸 **Print:** ${linkPrint}`,
        ephemeral: true
      });

    } catch (error) {
      console.error(`[OrbHandler] Error processing orb deposit:`, error);
      await interaction.reply({
        content: '❌ Erro ao processar depósito de orb.',
        ephemeral: true
      });
    }
  }

  // ✅ ATUALIZADO: Aprovar com XP customizado
  static async approveOrb(interaction, depositId) {
    try {
      const deposit = global.pendingOrbDeposits?.get(depositId);
      if (!deposit) {
        return interaction.reply({
          content: '❌ Depósito não encontrado!',
          ephemeral: true
        });
      }

      const isADM = interaction.member.roles.cache.some(r => r.name === 'ADM');
      const isStaff = interaction.member.roles.cache.some(r => r.name === 'Staff');

      if (!isADM && !isStaff) {
        return interaction.reply({
          content: '❌ Apenas ADM ou Staff podem aprovar!',
          ephemeral: true
        });
      }

      const canalLogXp = interaction.guild.channels.cache.find(c => c.name === '📜╠log-xp');

      // Distribuir XP para todos os usuários
      let sucessos = 0;
      for (const userId of deposit.users) {
        try {
          await XpHandler.addXp(
            userId,
            deposit.xpAmount,
            `Depósito de Orb (${deposit.orbType})`,
            interaction.guild,
            canalLogXp
          );
          sucessos++;
        } catch (e) {
          console.error(`[OrbHandler] Error adding XP to ${userId}:`, e);
        }
      }

      deposit.status = 'aprovado';
      deposit.aprovadoPor = interaction.user.id;

      await interaction.update({
        content: `✅ Orb aprovado por ${interaction.user.tag}!\n\n` +
                 `👥 ${sucessos}/${deposit.users.length} jogadores receberam ${deposit.xpAmount.toLocaleString()} XP\n` +
                 `💎 Total distribuído: ${(deposit.xpAmount * sucessos).toLocaleString()} XP`,
        components: []
      });

      // Notificar participantes
      for (const userId of deposit.users) {
        try {
          const user = await interaction.client.users.fetch(userId);
          const embed = new EmbedBuilder()
            .setTitle('✅ XP RECEBIDO - ORB APROVADA')
            .setDescription(
              `🎉 **Você recebeu XP!**\n\n` +
              `💎 **Valor:** \`${deposit.xpAmount.toLocaleString()} XP\`\n` +
              `🔮 **Tipo:** ${deposit.orbType}\n` +
              `✅ **Aprovado por:** \`${interaction.user.tag}\`\n\n` +
              `📸 **Print:** [Clique aqui](${deposit.print})`
            )
            .setColor(0x2ECC71)
            .setTimestamp();

          await user.send({ embeds: [embed] });
        } catch (e) {
          console.log(`[OrbHandler] Could not DM user ${userId}`);
        }
      }

    } catch (error) {
      console.error(`[OrbHandler] Error approving orb:`, error);
      await interaction.reply({
        content: '❌ Erro ao aprovar orb.',
        ephemeral: true
      });
    }
  }

  static async rejectOrb(interaction, depositId) {
    try {
      const deposit = global.pendingOrbDeposits?.get(depositId);
      if (!deposit) {
        return interaction.reply({
          content: '❌ Depósito não encontrado!',
          ephemeral: true
        });
      }

      const isADM = interaction.member.roles.cache.some(r => r.name === 'ADM');
      const isStaff = interaction.member.roles.cache.some(r => r.name === 'Staff');

      if (!isADM && !isStaff) {
        return interaction.reply({
          content: '❌ Apenas ADM ou Staff podem recusar!',
          ephemeral: true
        });
      }

      deposit.status = 'recusado';
      deposit.recusadoPor = interaction.user.id;

      // Notificar participantes
      for (const userId of deposit.users) {
        try {
          const user = await interaction.client.users.fetch(userId);
          const embed = new EmbedBuilder()
            .setTitle('❌ ORB RECUSADA')
            .setDescription(
              `⚠️ Um depósito de orb que você participou foi recusado.\n\n` +
              `🔮 **Tipo:** ${deposit.orbType}\n` +
              `💎 **XP que seria recebido:** \`${deposit.xpAmount.toLocaleString()}\`\n` +
              `❌ **Recusado por:** \`${interaction.user.tag}\`\n\n` +
              `💡 Entre em contato com a staff para mais informações.`
            )
            .setColor(0xE74C3C)
            .setTimestamp();

          await user.send({ embeds: [embed] });
        } catch (e) {
          console.log(`[OrbHandler] Could not DM user ${userId}`);
        }
      }

      await interaction.update({
        content: `❌ Orb recusado por ${interaction.user.tag}`,
        components: []
      });

    } catch (error) {
      console.error(`[OrbHandler] Error rejecting orb:`, error);
      await interaction.reply({
        content: '❌ Erro ao recusar orb.',
        ephemeral: true
      });
    }
  }
}

module.exports = OrbHandler;