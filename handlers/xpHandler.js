const {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle
} = require('discord.js');
const Database = require('../utils/database');

class XpHandler {
  constructor() {
    this.xpConfig = {
      baseXp: 100,
      multiplier: 1.5,
      maxLevel: 100
    };
  }

  /**
   * Retorna XP necessário para próximo nível
   */
  static getXpForNextLevel(level) {
    return Math.floor(100 * Math.pow(1.5, level - 1));
  }

  /**
   * Adiciona XP a um usuário
   */
  static async addXp(userId, amount, reason, guild, channel) {
    try {
      const user = await Database.getUser(userId);

      if (!user) {
        console.error(`[XpHandler] User ${userId} not found in database`);
        return { success: false, error: 'User not found' };
      }

      // Inicializar XP se não existir
      if (user.xp === undefined) user.xp = 0;
      if (user.level === undefined) user.level = 1;
      if (user.totalXp === undefined) user.totalXp = 0;
      if (!user.insignias) user.insignias = [];

      const oldLevel = user.level;
      user.xp += amount;
      user.totalXp += amount;

      // Verificar level up
      let leveledUp = false;
      while (user.xp >= XpHandler.getXpForNextLevel(user.level)) {
        user.xp -= XpHandler.getXpForNextLevel(user.level);
        user.level++;
        leveledUp = true;
      }

      await Database.updateUser(userId, {
        xp: user.xp,
        level: user.level,
        total_xp: user.totalXp
      });

      // Enviar log no canal log-xp
      if (channel) {
        await XpHandler.sendXpLog(channel, userId, amount, reason, user.level, leveledUp);
      }

      // Se upou de nível, enviar DM
      if (leveledUp) {
        await XpHandler.sendLevelUpDM(userId, oldLevel, user.level, guild);
      }

      return { success: true, leveledUp, newLevel: user.level };
    } catch (error) {
      console.error(`[XpHandler] Error adding XP to ${userId}:`, error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Remove XP de um usuário
   */
  static async removeXp(userId, amount, reason, channel) {
    try {
      const user = await Database.getUser(userId);

      if (!user) {
        return { success: false, error: 'User not found' };
      }

      if (!user.xp) user.xp = 0;
      if (!user.totalXp) user.totalXp = 0;

      user.xp = Math.max(0, user.xp - amount);
      user.totalXp = Math.max(0, user.totalXp - amount);

      await Database.updateUser(userId, {
        xp: user.xp,
        total_xp: user.totalXp
      });

      if (channel) {
        const embed = new EmbedBuilder()
          .setTitle('📉 XP REMOVIDO')
          .setDescription(
            `**Usuário:** <@${userId}>\n` +
            `**XP Removido:** \`${amount.toLocaleString()}\`\n` +
            `**Motivo:** ${reason || 'Não especificado'}\n` +
            `**XP Atual:** \`${user.xp.toLocaleString()}\``
          )
          .setColor(0xE74C3C)
          .setTimestamp();

        await channel.send({ embeds: [embed] });
      }

      return { success: true };
    } catch (error) {
      console.error(`[XpHandler] Error removing XP from ${userId}:`, error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Envia log de XP no canal
   */
  static async sendXpLog(channel, userId, amount, reason, level, leveledUp) {
    try {
      const embed = new EmbedBuilder()
        .setTitle(leveledUp ? '🎉 XP ADICIONADO + LEVEL UP!' : '✨ XP ADICIONADO')
        .setDescription(
          `**Jogador:** <@${userId}>\n` +
          `**XP Ganho:** \`+${amount.toLocaleString()}\`\n` +
          `**Motivo:** ${reason || 'Participação em evento'}\n` +
          `**Nível Atual:** \`${level}\``
        )
        .setColor(leveledUp ? 0xFFD700 : 0x2ECC71)
        .setTimestamp();

      if (leveledUp) {
        embed.addFields({
          name: '🆙 NOVO NÍVEL!',
          value: `Parabéns por alcançar o nível ${level}!`
        });
      }

      await channel.send({ embeds: [embed] });
    } catch (error) {
      console.error(`[XpHandler] Error sending XP log:`, error);
    }
  }

  /**
   * Envia DM de level up
   */
  static async sendLevelUpDM(userId, oldLevel, newLevel, guild) {
    try {
      const user = await global.client.users.fetch(userId);

      const embed = new EmbedBuilder()
        .setTitle('🎉 LEVEL UP!')
        .setDescription(
          `🎊 **Parabéns! Você subiu de nível!**\n\n` +
          `⭐ **Nível Anterior:** \`${oldLevel}\`\n` +
          `🏆 **Novo Nível:** \`${newLevel}\`\n\n` +
          `🎁 **Recompensas desbloqueadas:**\n` +
          `\> Acesso a novos conteúdos\n` +
          `\> Reconhecimento na guilda\n` +
          `\> Benefícios exclusivos\n\n` +
          `💪 Continue participando de eventos para ganhar mais XP!`
        )
        .setColor(0xFFD700)
        .setFooter({
          text: `NOTAG Bot • Albion Academy • ${guild.name}`
        })
        .setTimestamp();

      await user.send({ embeds: [embed] });
    } catch (error) {
      console.log(`[XpHandler] Could not send level up DM to ${userId}`);
    }
  }

  /**
   * Mostra perfil de XP do usuário
   */
  static async showProfile(userId, guild) {
    try {
      const user = await Database.getUser(userId);

      if (!user) {
        throw new Error('Usuário não encontrado no banco de dados');
      }

      const discordUser = await global.client.users.fetch(userId).catch(() => null);

      const xp = user.xp || 0;
      const level = user.level || 1;
      const totalXp = user.totalXp || 0;
      const insignias = user.insignias || [];
      const xpForNext = XpHandler.getXpForNextLevel(level);
      const progressPercent = Math.floor((xp / xpForNext) * 100);

      // Criar barra de progresso
      const filledBars = Math.floor(progressPercent / 10);
      const emptyBars = 10 - filledBars;
      const progressBar = '█'.repeat(filledBars) + '░'.repeat(emptyBars);

      const embed = new EmbedBuilder()
        .setTitle(`👤 PERFIL DE ${discordUser?.username?.toUpperCase() || 'USUÁRIO'}`)
        .setDescription(
          `🎮 **Nível:** \`${level}\`\n` +
          `⭐ **XP Atual:** \`${xp.toLocaleString()} / ${xpForNext.toLocaleString()}\`\n` +
          `📊 **Progresso:** \`${progressBar}\` \`${progressPercent}%\`\n` +
          `🏆 **XP Total Acumulado:** \`${totalXp.toLocaleString()}\`\n\n` +
          `🎖️ **Insígnias:** ${insignias.length > 0 ? insignias.join(' ') : 'Nenhuma'}`
        )
        .setColor(0x9B59B6)
        .setThumbnail(discordUser?.displayAvatarURL() || null)
        .setFooter({
          text: `NOTAG Bot • Albion Academy • ${new Date().toLocaleDateString('pt-BR')}`
        })
        .setTimestamp();

      return embed;
    } catch (error) {
      console.error(`[XpHandler] Error showing profile for ${userId}:`, error);
      throw error;
    }
  }

  /**
   * Cria painel de XP para canal
   */
  static createXpPanel() {
    const embed = new EmbedBuilder()
      .setTitle('📚 ALBION ACADEMY - SISTEMA DE XP')
      .setDescription(
        '🎮 **Bem-vindo ao sistema de progressão!**\n\n' +
        '⭐ Ganhe XP participando de eventos\n' +
        '📈 Suba de nível e desbloqueie recompensas\n' +
        '🎖️ Colete insígnias exclusivas\n\n' +
        '**Ações disponíveis:**'
      )
      .setColor(0x9B59B6)
      .setTimestamp();

    const botoes = new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setCustomId('btn_criar_xp_event')
          .setLabel('🎮 Criar Evento XP')
          .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
          .setCustomId('btn_depositar_xp_manual')
          .setLabel('💎 Depositar XP')
          .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
          .setCustomId('btn_ver_perfil')
          .setLabel('👤 Meu Perfil')
          .setStyle(ButtonStyle.Secondary)
      );

    return { embeds: [embed], components: [botoes] };
  }

  /**
   * Mostra modal de criação de evento XP
   */
  static showCreateEventModal(interaction) {
    const modal = new ModalBuilder()
      .setCustomId('modal_criar_evento_xp')
      .setTitle('🎮 Criar Evento de XP');

    const nomeInput = new TextInputBuilder()
      .setCustomId('nome_evento_xp')
      .setLabel('Nome do Evento')
      .setPlaceholder('Ex: Dungeon Avaloneana')
      .setStyle(TextInputStyle.Short)
      .setRequired(true)
      .setMaxLength(100);

    const descInput = new TextInputBuilder()
      .setCustomId('desc_evento_xp')
      .setLabel('Descrição')
      .setPlaceholder('Descreva o evento...')
      .setStyle(TextInputStyle.Paragraph)
      .setRequired(false)
      .setMaxLength(500);

    const xpInput = new TextInputBuilder()
      .setCustomId('xp_base_evento')
      .setLabel('XP Base por Participação')
      .setPlaceholder('Ex: 1000')
      .setStyle(TextInputStyle.Short)
      .setRequired(true)
      .setMaxLength(10);

    modal.addComponents(
      new ActionRowBuilder().addComponents(nomeInput),
      new ActionRowBuilder().addComponents(descInput),
      new ActionRowBuilder().addComponents(xpInput)
    );

    return modal;
  }

  /**
   * Processa criação de evento XP
   */
  static async processXpEventCreation(interaction) {
    try {
      const nome = interaction.fields.getTextInputValue('nome_evento_xp');
      const descricao = interaction.fields.getTextInputValue('desc_evento_xp') || 'Sem descrição';
      const xpBaseInput = interaction.fields.getTextInputValue('xp_base_evento').trim();
      const xpBase = parseInt(xpBaseInput.replace(/\./g, '').replace(/,/g, ''));

      if (isNaN(xpBase) || xpBase <= 0) {
        return interaction.reply({
          content: '❌ XP base inválido! Digite apenas números.',
          ephemeral: true
        });
      }

      const canalLog = interaction.guild.channels.cache.find(c => c.name === 'log-xp');
      if (!canalLog) {
        return interaction.reply({
          content: '❌ Canal log-xp não encontrado! Crie o canal primeiro.',
          ephemeral: true
        });
      }

      const eventId = `xp_${Date.now()}_${interaction.user.id}`;

      const embed = new EmbedBuilder()
        .setTitle(`🎮 ${nome}`)
        .setDescription(descricao)
        .addFields(
          { name: '👤 Criador', value: `<@${interaction.user.id}>`, inline: true },
          { name: '⭐ XP Base', value: `\`${xpBase.toLocaleString()}\``, inline: true },
          { name: '📊 Status', value: '🟢 Ativo', inline: true }
        )
        .setColor(0x9B59B6)
        .setTimestamp();

      const botoes = new ActionRowBuilder()
        .addComponents(
          new ButtonBuilder()
            .setCustomId(`xp_event_participar_${eventId}`)
            .setLabel('✋ Participar')
            .setStyle(ButtonStyle.Success),
          new ButtonBuilder()
            .setCustomId(`xp_event_finalizar_${eventId}`)
            .setLabel('🏁 Finalizar')
            .setStyle(ButtonStyle.Danger)
        );

      if (!global.activeXpEvents) global.activeXpEvents = new Map();
      global.activeXpEvents.set(eventId, {
        id: eventId,
        nome: nome,
        criador: interaction.user.id,
        xpBase: xpBase,
        participantes: new Set(),
        status: 'ativo',
        createdAt: Date.now()
      });

      await interaction.reply({
        content: `✅ Evento **${nome}** criado! XP base: \`${xpBase.toLocaleString()}\``,
        ephemeral: true
      });

      await interaction.channel.send({
        embeds: [embed],
        components: [botoes]
      });

    } catch (error) {
      console.error(`[XpHandler] Error creating XP event:`, error);
      await interaction.reply({
        content: '❌ Erro ao criar evento de XP.',
        ephemeral: true
      });
    }
  }

  /**
   * Processa participação em evento XP
   */
  static async handleEventParticipation(interaction, eventId) {
    try {
      const event = global.activeXpEvents?.get(eventId);
      if (!event) {
        return interaction.reply({
          content: '❌ Evento não encontrado ou já finalizado!',
          ephemeral: true
        });
      }

      if (event.participantes.has(interaction.user.id)) {
        return interaction.reply({
          content: '⚠️ Você já está participando deste evento!',
          ephemeral: true
        });
      }

      event.participantes.add(interaction.user.id);

      await interaction.reply({
        content: `✅ Você entrou no evento **${event.nome}**! Receberá \`${event.xpBase.toLocaleString()}\` XP ao final.`,
        ephemeral: true
      });

    } catch (error) {
      console.error(`[XpHandler] Error in event participation:`, error);
      await interaction.reply({
        content: '❌ Erro ao processar participação.',
        ephemeral: true
      });
    }
  }

  /**
   * Finaliza evento XP e distribui XP
   */
  static async finalizeXpEvent(interaction, eventId) {
    try {
      const event = global.activeXpEvents?.get(eventId);
      if (!event) {
        return interaction.reply({
          content: '❌ Evento não encontrado!',
          ephemeral: true
        });
      }

      if (event.criador !== interaction.user.id) {
        const isADM = interaction.member.roles.cache.some(r => r.name === 'ADM');
        if (!isADM) {
          return interaction.reply({
            content: '❌ Apenas o criador ou ADMs podem finalizar o evento!',
            ephemeral: true
          });
        }
      }

      const canalLog = interaction.guild.channels.cache.find(c => c.name === 'log-xp');
      if (!canalLog) {
        return interaction.reply({
          content: '❌ Canal log-xp não encontrado!',
          ephemeral: true
        });
      }

      let distribuidos = 0;
      for (const userId of event.participantes) {
        await XpHandler.addXp(userId, event.xpBase, `Participação em: ${event.nome}`, interaction.guild, canalLog);
        distribuidos++;
      }

      event.status = 'finalizado';

      await interaction.reply({
        content: `✅ Evento **${event.nome}** finalizado! XP distribuído para \`${distribuidos}\` participantes.`,
        ephemeral: false
      });

      try {
        await interaction.message.edit({
          components: []
        });
      } catch (e) {
        console.log('[XpHandler] Could not edit original event message');
      }

    } catch (error) {
      console.error(`[XpHandler] Error finalizing XP event:`, error);
      await interaction.reply({
        content: '❌ Erro ao finalizar evento.',
        ephemeral: true
      });
    }
  }

  /**
   * Mostra ranking de XP
   */
  static async showRanking(guild, limit = 10) {
    try {
      const allUsers = await Database.getAllUsers();

      const sortedUsers = allUsers
        .filter(u => u.totalXp > 0)
        .sort((a, b) => (b.totalXp || 0) - (a.totalXp || 0))
        .slice(0, limit);

      const embed = new EmbedBuilder()
        .setTitle('🏆 RANKING DE XP - ALBION ACADEMY')
        .setDescription('Os jogadores mais dedicados da guilda!')
        .setColor(0xFFD700)
        .setTimestamp();

      if (sortedUsers.length === 0) {
        embed.addFields({
          name: '📊 Sem dados',
          value: 'Nenhum jogador possui XP ainda.'
        });
      } else {
        for (let i = 0; i < sortedUsers.length; i++) {
          const user = sortedUsers[i];
          const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : '▫️';

          try {
            const discordUser = await global.client.users.fetch(user.id);
            embed.addFields({
              name: `${medal} #${i + 1} ${discordUser.username}`,
              value: `Nível \`${user.level || 1}\` • \`${(user.totalXp || 0).toLocaleString()}\` XP total`,
              inline: false
            });
          } catch (e) {
            embed.addFields({
              name: `${medal} #${i + 1} Usuário desconhecido`,
              value: `Nível \`${user.level || 1}\` • \`${(user.totalXp || 0).toLocaleString()}\` XP total`,
              inline: false
            });
          }
        }
      }

      return embed;
    } catch (error) {
      console.error(`[XpHandler] Error showing ranking:`, error);
      throw error;
    }
  }

  /**
   * ✅ NOVO: Adiciona uma insígnia ao usuário
   * Usado pelo XpEventHandler para dar insígnias de conquistas
   */
  static async addInsignia(userId, insigniaId, insigniaNome = null) {
    try {
      const user = await Database.getUser(userId);
      let insignias = [];

      try {
        insignias = JSON.parse(user?.insignias || '[]');
        if (!Array.isArray(insignias)) insignias = [];
      } catch (e) {
        insignias = [];
      }

      insignias.push({
        id: insigniaId,
        nome: insigniaNome || `Insígnia ${Date.now()}`,
        obtidaEm: Date.now()
      });

      await Database.updateUser(userId, {
        insignias: JSON.stringify(insignias)
      });

      return true;
    } catch (error) {
      console.error('[XpHandler] Error adding insignia:', error);
      return false;
    }
  }
}

module.exports = XpHandler;