const {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  UserSelectMenuBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ChannelType,
  PermissionFlagsBits
} = require('discord.js');
const Database = require('../utils/database');

const confiscarTemp = new Map();

class AdminPanelHandler {

  // ==================== CRIAR CANAL E PAINEL ====================

  static async setupChannel(guild) {
    try {
      const botMember = guild.members.me;

      const channelSlug = 'painel-administrativo';

      // Verificar se o canal já existe em qualquer lugar da guild (evita duplicatas entre reinícios)
      const existingAnywhere = guild.channels.cache.find(
        c => c.name === channelSlug && c.type === ChannelType.GuildText
      );
      if (existingAnywhere) {
        console.log(`[AdminPanel] Canal "${channelSlug}" já existe na guild ${guild.name}.`);
        return existingAnywhere;
      }

      // Buscar categoria "gestão de guilda" (parcial e case-insensitive para tolerar emojis e maiúsculas)
      let category = guild.channels.cache.find(
        c => c.type === ChannelType.GuildCategory &&
             c.name.toLowerCase().includes('gestão de guilda')
      );

      if (!category) {
        // Fallback: criar categoria própria apenas se não existir nenhuma "gestão de guilda"
        category = await guild.channels.create({
          name: 'gestão de guilda',
          type: ChannelType.GuildCategory,
          permissionOverwrites: [
            {
              id: guild.id,
              deny: [PermissionFlagsBits.ViewChannel]
            },
            {
              id: botMember.id,
              allow: [
                PermissionFlagsBits.ViewChannel,
                PermissionFlagsBits.SendMessages,
                PermissionFlagsBits.EmbedLinks,
                PermissionFlagsBits.ReadMessageHistory
              ]
            }
          ]
        });
        console.log(`[AdminPanel] Categoria "gestão de guilda" criada.`);
      }

      const admRole = guild.roles.cache.find(r => r.name === 'ADM');
      const staffRole = guild.roles.cache.find(r => r.name === 'Staff');
      const tesoureiroRole = guild.roles.cache.find(r => r.name === 'tesoureiro');

      const permOverwrites = [
        {
          id: guild.id,
          deny: [PermissionFlagsBits.ViewChannel]
        },
        {
          id: botMember.id,
          allow: [
            PermissionFlagsBits.ViewChannel,
            PermissionFlagsBits.SendMessages,
            PermissionFlagsBits.EmbedLinks,
            PermissionFlagsBits.ReadMessageHistory,
            PermissionFlagsBits.ManageMessages
          ]
        }
      ];

      for (const role of [admRole, staffRole, tesoureiroRole]) {
        if (role) {
          permOverwrites.push({
            id: role.id,
            allow: [
              PermissionFlagsBits.ViewChannel,
              PermissionFlagsBits.ReadMessageHistory
            ],
            deny: [PermissionFlagsBits.SendMessages]
          });
        }
      }

      const channel = await guild.channels.create({
        name: channelSlug,
        type: ChannelType.GuildText,
        parent: category.id,
        topic: '🛡️ Painel Administrativo — Ferramentas exclusivas para ADM e Staff',
        permissionOverwrites: permOverwrites
      });

      console.log(`[AdminPanel] Canal "${channelSlug}" criado: ${channel.id}`);
      await AdminPanelHandler.sendPanel(channel);
      return channel;

    } catch (error) {
      console.error('[AdminPanel] Erro ao configurar canal:', error);
      throw error;
    }
  }

  // ==================== ENVIAR PAINEL ====================

  static async sendPanel(channel) {
    try {
      const embed = new EmbedBuilder()
        .setTitle('🛡️ PAINEL ADMINISTRATIVO')
        .setDescription(
          '**Ferramentas exclusivas para ADM, Staff e Tesoureiro.**\n\n' +
          '💰 **Confiscar Saldo** — Remove saldo de um ou mais jogadores\n\n' +
          '> Selecione a ação desejada abaixo.'
        )
        .setColor(0xE74C3C)
        .setFooter({ text: 'NOTAG Bot • Painel Administrativo' })
        .setTimestamp();

      const botoes = new ActionRowBuilder()
        .addComponents(
          new ButtonBuilder()
            .setCustomId('adm_confiscar_saldo')
            .setLabel('💰 Confiscar Saldo')
            .setStyle(ButtonStyle.Danger)
        );

      await channel.send({ embeds: [embed], components: [botoes] });
      console.log(`[AdminPanel] Painel enviado para ${channel.name}`);
    } catch (error) {
      console.error('[AdminPanel] Erro ao enviar painel:', error);
      throw error;
    }
  }

  // ==================== STEP 1: ABRIR SELEÇÃO DE JOGADORES ====================

  static async handleConfiscarSaldo(interaction) {
    try {
      const isADM = interaction.member.roles.cache.some(r => r.name === 'ADM');
      const isStaff = interaction.member.roles.cache.some(r => r.name === 'Staff');
      const isTesoureiro = interaction.member.roles.cache.some(r => r.name === 'tesoureiro');

      if (!isADM && !isStaff && !isTesoureiro) {
        return interaction.reply({
          content: '❌ Apenas ADM, Staff ou Tesoureiro podem usar esta função!',
          ephemeral: true
        });
      }

      confiscarTemp.set(interaction.user.id, { users: [], step: 'selecting' });

      const embed = new EmbedBuilder()
        .setTitle('💰 CONFISCAR SALDO')
        .setDescription(
          '**Como funciona:**\n\n' +
          '1️⃣ Clique em **"Selecionar Jogador(es)"** para escolher os alvos\n' +
          '2️⃣ Você pode selecionar **múltiplos jogadores** de uma vez\n' +
          '3️⃣ Depois, defina o valor a ser confiscado\n' +
          '4️⃣ Confirme a operação\n\n' +
          '⚠️ O valor será deduzido do saldo de cada jogador selecionado.'
        )
        .setColor(0xE74C3C);

      const botoes = new ActionRowBuilder()
        .addComponents(
          new ButtonBuilder()
            .setCustomId('adm_confiscar_select_users')
            .setLabel('👥 Selecionar Jogador(es)')
            .setStyle(ButtonStyle.Primary),
          new ButtonBuilder()
            .setCustomId('adm_confiscar_clear')
            .setLabel('🗑️ Limpar Seleção')
            .setStyle(ButtonStyle.Secondary)
        );

      await interaction.reply({
        embeds: [embed],
        components: [botoes],
        ephemeral: true
      });

    } catch (error) {
      console.error('[AdminPanel] Erro ao iniciar confisco:', error);
      await interaction.reply({
        content: '❌ Erro ao abrir painel de confisco.',
        ephemeral: true
      });
    }
  }

  // ==================== STEP 1b: ABRIR USER SELECT MENU ====================

  static async openUserSelect(interaction) {
    try {
      const row = new ActionRowBuilder()
        .addComponents(
          new UserSelectMenuBuilder()
            .setCustomId('adm_confiscar_users_menu')
            .setPlaceholder('🔍 Pesquise e selecione os jogadores...')
            .setMinValues(1)
            .setMaxValues(25)
        );

      await interaction.reply({
        content: '🔍 **Selecione os jogadores que terão o saldo confiscado:**',
        components: [row],
        ephemeral: true
      });
    } catch (error) {
      console.error('[AdminPanel] Erro ao abrir user select:', error);
      await interaction.reply({
        content: '❌ Erro ao abrir seleção de jogadores.',
        ephemeral: true
      });
    }
  }

  // ==================== STEP 2: PROCESSAR SELEÇÃO ====================

  static async processUserSelection(interaction) {
    try {
      const selectedUsers = interaction.values;
      const temp = confiscarTemp.get(interaction.user.id) || { users: [], step: 'selecting' };

      const existingSet = new Set(temp.users);
      selectedUsers.forEach(id => existingSet.add(id));
      temp.users = Array.from(existingSet);
      confiscarTemp.set(interaction.user.id, temp);

      const mentions = temp.users.map(id => `<@${id}>`).join(', ');

      const embed = new EmbedBuilder()
        .setTitle('👥 JOGADORES SELECIONADOS')
        .setDescription(
          `✅ **${temp.users.length} jogador(es) selecionado(s):**\n${mentions}\n\n` +
          'Clique em **"Prosseguir para Valor"** para definir o valor do confisco\n' +
          'ou **"Adicionar Mais"** para incluir outros jogadores.'
        )
        .setColor(0xE74C3C);

      const botoes = new ActionRowBuilder()
        .addComponents(
          new ButtonBuilder()
            .setCustomId('adm_confiscar_proceed')
            .setLabel('➡️ Prosseguir para Valor')
            .setStyle(ButtonStyle.Danger),
          new ButtonBuilder()
            .setCustomId('adm_confiscar_select_users')
            .setLabel('➕ Adicionar Mais')
            .setStyle(ButtonStyle.Primary),
          new ButtonBuilder()
            .setCustomId('adm_confiscar_clear')
            .setLabel('🗑️ Limpar')
            .setStyle(ButtonStyle.Secondary)
        );

      await interaction.update({
        content: null,
        embeds: [embed],
        components: [botoes]
      });

    } catch (error) {
      console.error('[AdminPanel] Erro ao processar seleção:', error);
    }
  }

  // ==================== STEP 2b: LIMPAR SELEÇÃO ====================

  static async clearSelection(interaction) {
    try {
      confiscarTemp.set(interaction.user.id, { users: [], step: 'selecting' });

      const embed = new EmbedBuilder()
        .setTitle('💰 CONFISCAR SALDO')
        .setDescription(
          '🗑️ Seleção limpa.\n\n' +
          'Clique em **"Selecionar Jogador(es)"** para escolher os alvos.'
        )
        .setColor(0xE74C3C);

      const botoes = new ActionRowBuilder()
        .addComponents(
          new ButtonBuilder()
            .setCustomId('adm_confiscar_select_users')
            .setLabel('👥 Selecionar Jogador(es)')
            .setStyle(ButtonStyle.Primary),
          new ButtonBuilder()
            .setCustomId('adm_confiscar_clear')
            .setLabel('🗑️ Limpar Seleção')
            .setStyle(ButtonStyle.Secondary)
        );

      await interaction.update({
        content: null,
        embeds: [embed],
        components: [botoes]
      });
    } catch (error) {
      console.error('[AdminPanel] Erro ao limpar seleção:', error);
    }
  }

  // ==================== STEP 3: ABRIR MODAL DE VALOR ====================

  static async openValorModal(interaction) {
    try {
      const temp = confiscarTemp.get(interaction.user.id);
      if (!temp || temp.users.length === 0) {
        return interaction.reply({
          content: '❌ Nenhum jogador selecionado! Selecione ao menos um jogador.',
          ephemeral: true
        });
      }

      const modal = new ModalBuilder()
        .setCustomId('modal_adm_confiscar_valor')
        .setTitle('💰 Valor do Confisco');

      const valorInput = new TextInputBuilder()
        .setCustomId('valor_confisco')
        .setLabel(`Valor a confiscar de cada jogador (em pratas)`)
        .setPlaceholder('Ex: 1000000 para 1M')
        .setStyle(TextInputStyle.Short)
        .setRequired(true)
        .setMaxLength(15);

      const motivoInput = new TextInputBuilder()
        .setCustomId('motivo_confisco')
        .setLabel('Motivo do confisco')
        .setPlaceholder('Ex: Penalidade por inatividade')
        .setStyle(TextInputStyle.Short)
        .setRequired(true)
        .setMaxLength(100);

      modal.addComponents(
        new ActionRowBuilder().addComponents(valorInput),
        new ActionRowBuilder().addComponents(motivoInput)
      );

      await interaction.showModal(modal);

    } catch (error) {
      console.error('[AdminPanel] Erro ao abrir modal de valor:', error);
      await interaction.reply({
        content: '❌ Erro ao abrir formulário de valor.',
        ephemeral: true
      });
    }
  }

  // ==================== STEP 4: PROCESSAR MODAL — MOSTRAR CONFIRMAÇÃO ====================

  static async processValorModal(interaction) {
    try {
      const valorInput = interaction.fields.getTextInputValue('valor_confisco').trim();
      const valorLimpo = valorInput.replace(/\./g, '').replace(/,/g, '');
      const valor = parseInt(valorLimpo);
      const motivo = interaction.fields.getTextInputValue('motivo_confisco').trim();

      if (isNaN(valor) || valor <= 0) {
        return interaction.reply({
          content: '❌ Valor inválido! Digite apenas números (ex: 500000 para 500k).',
          ephemeral: true
        });
      }

      const temp = confiscarTemp.get(interaction.user.id);
      if (!temp || temp.users.length === 0) {
        return interaction.reply({
          content: '❌ Sessão expirada. Inicie o processo novamente.',
          ephemeral: true
        });
      }

      const confiscoId = `conf_${Date.now()}_${interaction.user.id}`;
      temp.valor = valor;
      temp.motivo = motivo;
      temp.confiscoId = confiscoId;
      temp.step = 'confirming';
      confiscarTemp.set(interaction.user.id, temp);

      const mentions = temp.users.map(id => `<@${id}>`).join(', ');
      const totalGeral = valor * temp.users.length;

      const embed = new EmbedBuilder()
        .setTitle('⚠️ CONFIRMAÇÃO DE CONFISCO')
        .setDescription(
          `**Revise os dados antes de confirmar:**\n\n` +
          `👥 **Jogadores (${temp.users.length}):** ${mentions}\n` +
          `💰 **Valor por jogador:** \`${valor.toLocaleString()}\`\n` +
          `💸 **Total confiscado:** \`${totalGeral.toLocaleString()}\`\n` +
          `📝 **Motivo:** ${motivo}\n\n` +
          `⚠️ *Esta ação irá deduzir o saldo de cada jogador selecionado. Se o jogador não tiver saldo suficiente, o confisco será parcial.*`
        )
        .setColor(0xFF6600)
        .setFooter({ text: 'NOTAG Bot • Painel Administrativo' })
        .setTimestamp();

      const botoes = new ActionRowBuilder()
        .addComponents(
          new ButtonBuilder()
            .setCustomId(`adm_confiscar_confirm_${confiscoId}`)
            .setLabel('✅ Confirmar Confisco')
            .setStyle(ButtonStyle.Danger),
          new ButtonBuilder()
            .setCustomId(`adm_confiscar_cancel_${confiscoId}`)
            .setLabel('❌ Cancelar')
            .setStyle(ButtonStyle.Secondary)
        );

      await interaction.reply({
        embeds: [embed],
        components: [botoes],
        ephemeral: true
      });

    } catch (error) {
      console.error('[AdminPanel] Erro ao processar modal de valor:', error);
      await interaction.reply({
        content: '❌ Erro ao processar valor.',
        ephemeral: true
      });
    }
  }

  // ==================== STEP 5: EXECUTAR CONFISCO ====================

  static async executeConfisco(interaction, confiscoId) {
    try {
      const temp = confiscarTemp.get(interaction.user.id);
      if (!temp || temp.confiscoId !== confiscoId) {
        return interaction.reply({
          content: '❌ Sessão expirada ou operação inválida.',
          ephemeral: true
        });
      }

      await interaction.deferUpdate();

      const { users, valor, motivo } = temp;
      const resultados = [];

      for (const userId of users) {
        const userData = await Database.getUser(userId);
        const saldoAtual = userData?.saldo || 0;
        const valorConfiscado = Math.min(valor, saldoAtual);

        if (valorConfiscado > 0) {
          await Database.removeSaldo(userId, valorConfiscado, `confisco: ${motivo}`, interaction.guild.id);
          resultados.push({ userId, valorConfiscado, saldoAnterior: saldoAtual, status: 'ok' });
        } else {
          resultados.push({ userId, valorConfiscado: 0, saldoAnterior: saldoAtual, status: 'sem_saldo' });
        }
      }

      confiscarTemp.delete(interaction.user.id);

      const linhasResultado = resultados.map(r => {
        if (r.status === 'ok') {
          return `✅ <@${r.userId}> — \`${r.valorConfiscado.toLocaleString()}\` confiscado (saldo anterior: \`${r.saldoAnterior.toLocaleString()}\`)`;
        }
        return `⚠️ <@${r.userId}> — Sem saldo suficiente (saldo: \`${r.saldoAnterior.toLocaleString()}\`)`;
      }).join('\n');

      const totalConfiscado = resultados.reduce((acc, r) => acc + r.valorConfiscado, 0);

      const embedFinal = new EmbedBuilder()
        .setTitle('✅ CONFISCO EXECUTADO')
        .setDescription(
          `**Operação concluída!**\n\n` +
          `${linhasResultado}\n\n` +
          `💸 **Total confiscado:** \`${totalConfiscado.toLocaleString()}\`\n` +
          `📝 **Motivo:** ${motivo}\n` +
          `👤 **Executado por:** ${interaction.user.tag}`
        )
        .setColor(0x2ECC71)
        .setFooter({ text: 'NOTAG Bot • Painel Administrativo' })
        .setTimestamp();

      await interaction.editReply({
        embeds: [embedFinal],
        components: []
      });

      const canalLogs = interaction.guild.channels.cache.find(c => c.name === '📜╠logs-banco');
      if (canalLogs) {
        await canalLogs.send({
          embeds: [
            new EmbedBuilder()
              .setTitle('📝 LOG: CONFISCO DE SALDO')
              .setDescription(
                `**Executado por:** <@${interaction.user.id}>\n` +
                `**Jogadores afetados (${users.length}):** ${users.map(id => `<@${id}>`).join(', ')}\n` +
                `**Valor por jogador:** \`${valor.toLocaleString()}\`\n` +
                `**Total confiscado:** \`${totalConfiscado.toLocaleString()}\`\n` +
                `**Motivo:** ${motivo}`
              )
              .setColor(0xE74C3C)
              .setTimestamp()
          ]
        });
      }

    } catch (error) {
      console.error('[AdminPanel] Erro ao executar confisco:', error);
      await interaction.editReply({
        content: '❌ Erro ao executar confisco.',
        components: []
      });
    }
  }

  // ==================== CANCELAR CONFISCO ====================

  static async cancelConfisco(interaction, confiscoId) {
    try {
      confiscarTemp.delete(interaction.user.id);
      await interaction.update({
        content: '❌ **Confisco cancelado.** Nenhum saldo foi alterado.',
        embeds: [],
        components: []
      });
    } catch (error) {
      console.error('[AdminPanel] Erro ao cancelar confisco:', error);
    }
  }
}

module.exports = AdminPanelHandler;
