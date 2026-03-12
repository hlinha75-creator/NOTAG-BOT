const {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder
} = require('discord.js');
const XpHandler = require('./xpHandler');
const Database = require('../utils/database');

class XpEventHandler {
  constructor() {
    this.activeXpEvents = new Map();
  }

  /**
   * Cria o modal para criar evento de XP - Versão Aprimorada com Níveis
   */
  static async createXpEventModal() {
    const modal = new ModalBuilder()
      .setCustomId('modal_criar_xp_event')
      .setTitle('🏆 Criar Evento de Conquista');

    const nomeInput = new TextInputBuilder()
      .setCustomId('nome_evento')
      .setLabel('Nome do Evento')
      .setPlaceholder('Ex: Raid Avalon Expert')
      .setStyle(TextInputStyle.Short)
      .setRequired(true)
      .setMaxLength(100);

    const descricaoInput = new TextInputBuilder()
      .setCustomId('descricao')
      .setLabel('Descrição detalhada')
      .setPlaceholder('Descreva o objetivo do evento...')
      .setStyle(TextInputStyle.Paragraph)
      .setRequired(true)
      .setMaxLength(1000);

    const padraoInput = new TextInputBuilder()
      .setCustomId('padrao_busca')
      .setLabel('Padrão de busca (nome dos eventos)')
      .setPlaceholder('Ex: Raid Avalon (irá buscar eventos com esse nome)')
      .setStyle(TextInputStyle.Short)
      .setRequired(true)
      .setMaxLength(100);

    const configNiveisInput = new TextInputBuilder()
      .setCustomId('config_niveis')
      .setLabel('Configuração de Níveis (Formato: Nome:Qtd:Insignia)')
      .setPlaceholder('Bronze:3:Conquistador Bronze,Prata:6:Conquistador Prata,Ouro:10:Mestre Avalon')
      .setStyle(TextInputStyle.Paragraph)
      .setRequired(true)
      .setMaxLength(500);

    const xpBaseInput = new TextInputBuilder()
      .setCustomId('xp_base')
      .setLabel('XP por participação em cada evento')
      .setPlaceholder('Ex: 100 (será multiplicado pelo nível)')
      .setStyle(TextInputStyle.Short)
      .setRequired(true)
      .setMaxLength(10);

    modal.addComponents(
      new ActionRowBuilder().addComponents(nomeInput),
      new ActionRowBuilder().addComponents(descricaoInput),
      new ActionRowBuilder().addComponents(padraoInput),
      new ActionRowBuilder().addComponents(configNiveisInput),
      new ActionRowBuilder().addComponents(xpBaseInput)
    );

    return modal;
  }

  /**
   * Mostra o modal de criação de evento
   */
  static async showCreateEventModal(interaction) {
    try {
      console.log(`[XpEventHandler] Showing create event modal for user ${interaction.user.id}`);

      const modal = await this.createXpEventModal();
      await interaction.showModal(modal);

      console.log(`[XpEventHandler] Modal shown successfully`);
    } catch (error) {
      console.error(`[XpEventHandler] Error showing create event modal:`, error);

      if (interaction.isRepliable() && !interaction.replied && !interaction.deferred) {
        await interaction.reply({
          content: '❌ Erro ao abrir modal de criação de evento. Tente novamente.',
          ephemeral: true
        });
      }
    }
  }

  /**
   * Parse da configuração de níveis
   * Formato: Bronze:3:Insignia Bronze,Silver:6:Insignia Prata,Gold:10:Insignia Ouro
   */
  static parseNiveis(configText) {
    const niveis = [];
    const partes = configText.split(',');

    for (const parte of partes) {
      const [nome, quantidadeStr, insignia] = parte.trim().split(':');
      if (nome && quantidadeStr && insignia) {
        niveis.push({
          nome: nome.trim(),
          quantidade: parseInt(quantidadeStr.trim()),
          insignia: insignia.trim(),
          xpBonus: niveis.length + 1 // Bronze=1x, Silver=2x, Gold=3x
        });
      }
    }

    // Ordenar por quantidade crescente
    return niveis.sort((a, b) => a.quantidade - b.quantidade);
  }

  static async processCreateXpEvent(interaction) {
    try {
      const nome = interaction.fields.getTextInputValue('nome_evento');
      const descricao = interaction.fields.getTextInputValue('descricao');
      const padraoBusca = interaction.fields.getTextInputValue('padrao_busca');
      const configNiveis = interaction.fields.getTextInputValue('config_niveis');
      const xpBase = parseInt(interaction.fields.getTextInputValue('xp_base'));

      if (isNaN(xpBase) || xpBase <= 0) {
        return interaction.reply({
          content: '❌ Valor de XP base inválido!',
          ephemeral: true
        });
      }

      const niveis = this.parseNiveis(configNiveis);
      if (niveis.length === 0) {
        return interaction.reply({
          content: '❌ Configuração de níveis inválida! Use o formato: Bronze:3:Nome Insignia,Prata:6:Nome Insignia,Ouro:10:Nome Insignia',
          ephemeral: true
        });
      }

      const eventId = `xp_event_${Date.now()}`;
      const eventData = {
        id: eventId,
        nome: nome,
        descricao: descricao,
        padraoBusca: padraoBusca.toLowerCase(), // Padrão para buscar eventos
        niveis: niveis, // Array de {nome, quantidade, insignia, xpBonus}
        xpBase: xpBase,
        criadorId: interaction.user.id,
        guildId: interaction.guild.id,
        status: 'ativo',
        progresso: new Map(), // Map<userId, {count, eventsParticipated[], nivelAlcancado}>
        criadoEm: Date.now()
      };

      if (!global.activeXpEvents) global.activeXpEvents = new Map();
      global.activeXpEvents.set(eventId, eventData);

      console.log(`[XpEvent] Created XP event: ${nome} com ${niveis.length} niveis`);

      // Enviar para canal xp-event
      const canalXpEvent = interaction.guild.channels.cache.find(c => c.name === '⭐╠xp-event');
      if (canalXpEvent) {
        await this.sendXpEventPanel(canalXpEvent, eventData);
      }

      await interaction.reply({
        content: `✅ Evento de conquista "${nome}" criado com ${niveis.length} níveis!`,
        ephemeral: true
      });

    } catch (error) {
      console.error(`[XpEvent] Error creating XP event:`, error);
      await interaction.reply({
        content: '❌ Erro ao criar evento de conquista.',
        ephemeral: true
      });
    }
  }

  static async sendXpEventPanel(channel, eventData) {
    // Criar texto de níveis
    let niveisText = '';
    for (const nivel of eventData.niveis) {
      niveisText += `\n${nivel.nome}: ${nivel.quantidade} eventos (+${nivel.xpBonus * eventData.xpBase} XP) - 🏅 ${nivel.insignia}`;
    }

    const embed = new EmbedBuilder()
      .setTitle(`🏆 ${eventData.nome}`)
      .setDescription(
        `📋 **${eventData.descricao}**\n\n` +
        `🎯 **Padrão de busca:** \`${eventData.padraoBusca}\`\n` +
        `💎 **XP Base:** \`${eventData.xpBase}\` por evento\n` +
        `📊 **Níveis:**${niveisText}\n\n` +
        `👤 **Criado por:** <@${eventData.criadorId}>\n` +
        `📅 **Início:** ${new Date(eventData.criadoEm).toLocaleDateString('pt-BR')}`
      )
      .setColor(0xFFD700)
      .setThumbnail('https://i.imgur.com/5K9Q5ZK.png')
      .setFooter({ text: 'Evento de Conquista • NOTAG Bot' })
      .setTimestamp();

    const botoes = new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setCustomId(`xp_event_ver_progresso_${eventData.id}`)
          .setLabel('📊 Ver Progresso')
          .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
          .setCustomId(`xp_event_atualizar_${eventData.id}`)
          .setLabel('🔄 Atualizar Progresso')
          .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
          .setCustomId(`xp_event_finalizar_${eventData.id}`)
          .setLabel('✅ Finalizar Evento')
          .setStyle(ButtonStyle.Danger)
      );

    await channel.send({
      content: `🔔 Novo evento de conquista disponível!`,
      embeds: [embed],
      components: [botoes]
    });
  }

  /**
   * Atualiza o progresso do evento XP baseado no histórico
   * Chamado manualmente ou automaticamente ao arquivar evento
   */
  static async atualizarProgresso(eventId, guild) {
    try {
      const eventData = global.activeXpEvents?.get(eventId);
      if (!eventData || eventData.status !== 'ativo') return null;

      // Buscar histórico de eventos
      const eventHistory = await Database.getEventHistory(guild.id, 200);

      // Filtrar eventos que batem com o padrão
      const matchingEvents = eventHistory.filter(e => {
        const eventNome = (e.dados?.eventoNome || '').toLowerCase();
        return eventNome.includes(eventData.padraoBusca);
      });

      console.log(`[XpEvent] Encontrados ${matchingEvents.length} eventos para o padrão "${eventData.padraoBusca}"`);

      // Contar participações por usuário
      const contagem = new Map();

      for (const event of matchingEvents) {
        if (event.dados?.distribuicao) {
          for (const participant of event.dados.distribuicao) {
            if (!contagem.has(participant.userId)) {
              contagem.set(participant.userId, {
                count: 0,
                events: []
              });
            }
            const userData = contagem.get(participant.userId);
            userData.count++;
            userData.events.push({
              eventId: event.event_id,
              nome: event.dados.eventoNome,
              data: event.timestamp
            });
          }
        }
      }

      // Atualizar progresso no eventData
      for (const [userId, data] of contagem) {
        const nivelAtual = this.calcularNivelAtual(data.count, eventData.niveis);

        eventData.progresso.set(userId, {
          userId: userId,
          count: data.count,
          events: data.events,
          nivelAlcancado: nivelAtual?.nome || null,
          proximoNivel: this.calcularProximoNivel(data.count, eventData.niveis)
        });
      }

      return eventData;

    } catch (error) {
      console.error(`[XpEvent] Error updating progress:`, error);
      return null;
    }
  }

  /**
   * Calcula qual nível o usuário alcançou baseado na contagem
   */
  static calcularNivelAtual(count, niveis) {
    let nivelAlcancado = null;
    for (const nivel of niveis) {
      if (count >= nivel.quantidade) {
        nivelAlcancado = nivel;
      } else {
        break;
      }
    }
    return nivelAlcancado;
  }

  /**
   * Calcula próximo nível e quanto falta
   */
  static calcularProximoNivel(count, niveis) {
    for (const nivel of niveis) {
      if (count < nivel.quantidade) {
        return {
          nome: nivel.nome,
          quantidade: nivel.quantidade,
          falta: nivel.quantidade - count
        };
      }
    }
    return null; // Já completou todos
  }

  /**
   * Handler para ver progresso
   */
  static async handleVerProgresso(interaction, eventId) {
    try {
      const eventData = global.activeXpEvents?.get(eventId);
      if (!eventData) {
        return interaction.reply({
          content: '❌ Evento não encontrado!',
          ephemeral: true
        });
      }

      await interaction.deferReply({ ephemeral: true });

      // Atualizar progresso antes de mostrar
      await this.atualizarProgresso(eventId, interaction.guild);

      // Criar embed de progresso
      const embed = await this.createProgressEmbed(eventData);

      await interaction.editReply({
        embeds: [embed]
      });

    } catch (error) {
      console.error(`[XpEvent] Error showing progress:`, error);
      await interaction.editReply({
        content: '❌ Erro ao mostrar progresso.'
      });
    }
  }

  /**
   * Cria embed mostrando progresso de todos
   */
  static async createProgressEmbed(eventData) {
    let description = `**🎯 Padrão:** \`${eventData.padraoBusca}\`\n`;
    description += `**💎 XP Base:** \`${eventData.xpBase}\`\n\n`;
    description += `**📊 Níveis:**\n`;

    for (const nivel of eventData.niveis) {
      description += `${nivel.nome}: ${nivel.quantidade} eventos (+${nivel.xpBonus * eventData.xpBase} XP)\n`;
    }

    description += `\n**👥 Progresso dos Participantes:**\n\n`;

    if (eventData.progresso.size === 0) {
      description += '*Nenhuma participação registrada ainda*';
    } else {
      // Ordenar por quantidade (decrescente)
      const sorted = Array.from(eventData.progresso.values())
        .sort((a, b) => b.count - a.count);

      for (const userProgress of sorted.slice(0, 20)) { // Limitar a 20 para não floodar
        const medalha = userProgress.nivelAlcancado ? `🏅 ${userProgress.nivelAlcancado}` : '🥉 Iniciante';
        const progressBar = this.createProgressBar(userProgress.count, eventData.niveis[eventData.niveis.length - 1].quantidade);

        description += `<@${userProgress.userId}>: ${medalha}\n`;
        description += `${progressBar} (${userProgress.count}/${userProgress.nivelAlcancado ? '✅' : userProgress.proximoNivel?.quantidade || 'MAX'})\n\n`;
      }

      if (sorted.length > 20) {
        description += `*... e mais ${sorted.length - 20} participantes*`;
      }
    }

    return new EmbedBuilder()
      .setTitle(`📊 Progresso: ${eventData.nome}`)
      .setDescription(description)
      .setColor(0x3498DB)
      .setTimestamp();
  }

  /**
   * Cria barra de progresso visual
   */
  static createProgressBar(current, max) {
    const percent = Math.min((current / max) * 10, 10);
    const filled = '█'.repeat(Math.floor(percent));
    const empty = '░'.repeat(10 - Math.floor(percent));
    return `\`${filled}${empty}\``;
  }

  /**
   * Handler para atualizar progresso manualmente
   */
  static async handleAtualizarProgresso(interaction, eventId) {
    try {
      const eventData = global.activeXpEvents?.get(eventId);
      if (!eventData) {
        return interaction.reply({
          content: '❌ Evento não encontrado!',
          ephemeral: true
        });
      }

      const isADM = interaction.member.roles.cache.some(r => r.name === 'ADM');
      const isStaff = interaction.member.roles.cache.some(r => r.name === 'Staff');

      if (!isADM && !isStaff) {
        return interaction.reply({
          content: '❌ Apenas ADM ou Staff podem atualizar!',
          ephemeral: true
        });
      }

      await interaction.deferReply({ ephemeral: true });

      await this.atualizarProgresso(eventId, interaction.guild);

      const embed = await this.createProgressEmbed(eventData);

      await interaction.editReply({
        content: '✅ Progresso atualizado!',
        embeds: [embed]
      });

    } catch (error) {
      console.error(`[XpEvent] Error updating progress:`, error);
      await interaction.reply({
        content: '❌ Erro ao atualizar progresso.',
        ephemeral: true
      });
    }
  }

  /**
   * Finaliza o evento e distribui recompensas baseado no nível alcançado
   */
  static async finalizarXpEvent(interaction, eventId) {
    try {
      const eventData = global.activeXpEvents?.get(eventId);
      if (!eventData) {
        return interaction.reply({
          content: '❌ Evento não encontrado!',
          ephemeral: true
        });
      }

      const isADM = interaction.member.roles.cache.some(r => r.name === 'ADM');
      const isStaff = interaction.member.roles.cache.some(r => r.name === 'Staff');

      if (!isADM && !isStaff) {
        return interaction.reply({
          content: '❌ Apenas ADM ou Staff podem finalizar!',
          ephemeral: true
        });
      }

      await interaction.deferReply({ ephemeral: false });

      // Última atualização do progresso
      await this.atualizarProgresso(eventId, interaction.guild);

      const recompensas = [];
      const canalLogXp = interaction.guild.channels.cache.find(c => c.name === '📜╠log-xp');

      // Para cada participante, dar recompensa baseada no nível alcançado
      for (const [userId, progresso] of eventData.progresso) {
        if (progresso.count > 0) {
          const nivel = eventData.niveis.find(n => n.nome === progresso.nivelAlcancado);

          if (nivel) {
            const xpTotal = eventData.xpBase * nivel.xpBonus;

            // Dar XP
            await XpHandler.addXp(
              userId,
              xpTotal,
              `${eventData.nome} - Nível ${nivel.nome} (${progresso.count} participações)`,
              interaction.guild,
              canalLogXp
            );

            // Dar insígnia específica do nível
            const insigniaId = `${eventData.id}_${nivel.nome}_${Date.now()}`;
            await XpHandler.addInsignia(userId, insigniaId, nivel.insignia);

            recompensas.push({
              userId,
              nivel: nivel.nome,
              xp: xpTotal,
              insignia: nivel.insignia,
              participacoes: progresso.count
            });

            // Notificar usuário
            try {
              const user = await interaction.client.users.fetch(userId);
              const embedXp = new EmbedBuilder()
                .setTitle('🎉 CONQUISTA COMPLETADA!')
                .setDescription(
                  `✨ **Parabéns! Você completou uma conquista!**\n\n` +
                  `🏆 **Evento:** ${eventData.nome}\n` +
                  `🥇 **Nível Alcançado:** ${nivel.nome}\n` +
                  `📊 **Participações:** ${progresso.count}\n` +
                  `💎 **XP Ganho:** \`${xpTotal}\`\n` +
                  `🏅 **Insígnia:** ${nivel.insignia}\n\n` +
                  `🎊 Continue participando dos eventos da guilda!`
                )
                .setColor(0xFFD700)
                .setTimestamp();

              await user.send({ embeds: [embedXp] });
            } catch (dmError) {
              console.log(`[XpEvent] Não foi possível DM o usuário ${userId}`);
            }
          }
        }
      }

      eventData.status = 'finalizado';
      eventData.finalizadoPor = interaction.user.id;
      eventData.finalizadoEm = Date.now();
      eventData.recompensas = recompensas;

      // Criar resumo
      const embedResumo = new EmbedBuilder()
        .setTitle(`✅ Evento Finalizado: ${eventData.nome}`)
        .setDescription(
          `📊 **Total de recompensas distribuídas:** ${recompensas.length}\n\n` +
          recompensas.map(r => 
            `<@${r.userId}>: ${r.nivel} (${r.participacoes}x) - ${r.xp} XP - ${r.insignia}`
          ).join('\n')
        )
        .setColor(0x2ECC71)
        .setTimestamp();

      await interaction.editReply({
        content: `✅ **Evento "${eventData.nome}" finalizado!**`,
        embeds: [embedResumo],
        components: []
      });

      console.log(`[XpEvent] Finalized XP event: ${eventData.nome} with ${recompensas.length} rewards`);

    } catch (error) {
      console.error(`[XpEvent] Error finalizing event:`, error);
      await interaction.followUp({
        content: '❌ Erro ao finalizar evento.',
        ephemeral: true
      });
    }
  }

  static async cancelarXpEvent(interaction, eventId) {
    try {
      const eventData = global.activeXpEvents?.get(eventId);
      if (!eventData) {
        return interaction.reply({
          content: '❌ Evento não encontrado!',
          ephemeral: true
        });
      }

      const isADM = interaction.member.roles.cache.some(r => r.name === 'ADM');
      const isStaff = interaction.member.roles.cache.some(r => r.name === 'Staff');

      if (!isADM && !isStaff) {
        return interaction.reply({
          content: '❌ Apenas ADM ou Staff podem cancelar!',
          ephemeral: true
        });
      }

      eventData.status = 'cancelado';
      eventData.canceladoPor = interaction.user.id;

      await interaction.update({
        content: `❌ Evento cancelado por ${interaction.user.tag}`,
        components: []
      });

    } catch (error) {
      console.error(`[XpEvent] Error canceling event:`, error);
      await interaction.reply({
        content: '❌ Erro ao cancelar evento.',
        ephemeral: true
      });
    }
  }

  /**
   * Verifica automaticamente se algum evento XP deve ser atualizado
   * Chamado quando um evento normal é arquivado
   */
  static async verificarEventosAtivos(guild, eventoArquivadoNome) {
    try {
      if (!global.activeXpEvents || global.activeXpEvents.size === 0) return;

      const eventoNomeLower = eventoArquivadoNome.toLowerCase();
      let atualizados = [];

      for (const [eventId, eventData] of global.activeXpEvents) {
        if (eventData.status !== 'ativo') continue;
        if (eventData.guildId !== guild.id) continue;

        // Verifica se o evento arquivado bate com o padrão
        if (eventoNomeLower.includes(eventData.padraoBusca) || 
            eventData.padraoBusca.includes(eventoNomeLower)) {

          await this.atualizarProgresso(eventId, guild);
          atualizados.push(eventData.nome);

          // Notificar no canal xp-event sobre progresso atualizado
          const canalXpEvent = guild.channels.cache.find(c => c.name === '⭐╠xp-event');
          if (canalXpEvent) {
            const ultimoProgresso = Array.from(eventData.progresso.values())
              .sort((a, b) => b.count - a.count)[0];

            if (ultimoProgresso && ultimoProgresso.proximoNivel && ultimoProgresso.proximoNivel.falta === 1) {
              // Está perto de completar!
              await canalXpEvent.send({
                content: `🎯 **Atualização de Progresso!**\n` +
                        `O evento "${eventData.nome}" recebeu novas participações!\n` +
                        `<@${ultimoProgresso.userId}> está a 1 evento de alcançar ${ultimoProgresso.proximoNivel.nome}!`,
                allowedMentions: { parse: [] } // Evitar flood de mentions
              });
            }
          }
        }
      }

      if (atualizados.length > 0) {
        console.log(`[XpEvent] Auto-updated events: ${atualizados.join(', ')}`);
      }

    } catch (error) {
      console.error(`[XpEvent] Error in auto-check:`, error);
    }
  }
}

module.exports = XpEventHandler;