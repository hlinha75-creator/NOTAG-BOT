const {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ChannelType,
  PermissionFlagsBits
} = require('discord.js');
const Database = require('../utils/database');
const XpHandler = require('./xpHandler');
const XpEventHandler = require('./xpEventHandler');

class LootSplitHandler {
  constructor() {
    this.simulations = new Map();
    this.pendingApprovals = new Map();
  }

  // ✅ CONSTANTES DE XP
  static XP_RATES = {
    EVENTO_NORMAL: 1, // 1 XP por minuto
    RAID_AVALON: 2    // 2 XP por minuto (dobro)
  };

  // ✅ FUNÇÃO AUXILIAR: Formatar tempo em HH:MM:SS
  static formatTime(milliseconds) {
    if (!milliseconds || milliseconds <= 0) return '00:00:00';

    const totalSeconds = Math.floor(milliseconds / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    const pad = (num) => num.toString().padStart(2, '0');
    return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
  }

  static createSimulationModal(eventId) {
    const modal = new ModalBuilder()
      .setCustomId(`modal_simular_evento_${eventId}`)
      .setTitle('💰 Simular Divisão de Loot');

    const valorTotalInput = new TextInputBuilder()
      .setCustomId('valor_total')
      .setLabel('💎 Valor Total do Evento')
      .setPlaceholder('Ex: 1000000')
      .setStyle(TextInputStyle.Short)
      .setRequired(true)
      .setMaxLength(12);

    const valorSacosInput = new TextInputBuilder()
      .setCustomId('valor_sacos')
      .setLabel('🎒 Valor dos Sacos (adicional)')
      .setPlaceholder('Valor extra dos sacos (será adicionado ao total)')
      .setStyle(TextInputStyle.Short)
      .setRequired(false)
      .setMaxLength(12);

    const valorReparoInput = new TextInputBuilder()
      .setCustomId('valor_reparo')
      .setLabel('🔧 Valor do Reparo (descontar)')
      .setPlaceholder('Ex: 50000')
      .setStyle(TextInputStyle.Short)
      .setRequired(false)
      .setMaxLength(12);

    modal.addComponents(
      new ActionRowBuilder().addComponents(valorTotalInput),
      new ActionRowBuilder().addComponents(valorSacosInput),
      new ActionRowBuilder().addComponents(valorReparoInput)
    );

    return modal;
  }

  static async processSimulation(interaction, eventId) {
    try {
      console.log(`[LootSplit] Processing simulation for event: ${eventId}`);

      const valorTotal = parseInt(interaction.fields.getTextInputValue('valor_total'));
      const valorSacosInput = interaction.fields.getTextInputValue('valor_sacos');
      const valorReparoInput = interaction.fields.getTextInputValue('valor_reparo');

      if (isNaN(valorTotal) || valorTotal <= 0) {
        return interaction.reply({
          content: '❌ Valor total inválido!',
          ephemeral: true
        });
      }

      const valorSacos = valorSacosInput ? parseInt(valorSacosInput) : 0;
      const valorReparo = valorReparoInput ? parseInt(valorReparoInput) : 0;

      if ((valorSacosInput && isNaN(valorSacos)) || (valorReparoInput && isNaN(valorReparo))) {
        return interaction.reply({
          content: '❌ Valores de sacos ou reparo inválidos!',
          ephemeral: true
        });
      }

      let eventData = global.activeEvents.get(eventId);
      if (!eventData) {
        eventData = global.finishedEvents?.get(eventId);
      }

      if (!eventData) {
        return interaction.reply({
          content: '❌ Evento não encontrado!',
          ephemeral: true
        });
      }

      const config = global.guildConfig?.get(interaction.guild.id) || {};
      const taxaGuilda = config.taxaGuilda || 10;

      // ✅ Calcular tempo total do evento
      let tempoTotalEvento = 0;
      if (eventData.inicioTimestamp && eventData.finalizadoEm) {
        tempoTotalEvento = eventData.finalizadoEm - eventData.inicioTimestamp;
      } else if (eventData.inicioTimestamp) {
        tempoTotalEvento = Date.now() - eventData.inicioTimestamp;
      }

      let tempoTotalParticipacao = 0;
      const participantes = Array.from(eventData.participantes.entries());

      participantes.forEach(([userId, data]) => {
        let tempo = data.tempoTotal || 0;
        if (!eventData.finalizadoEm && !data.pausado && data.tempoInicio && eventData.status === 'em_andamento') {
          tempo += Date.now() - data.tempoInicio;
        }
        tempoTotalParticipacao += tempo;
      });

      if (tempoTotalParticipacao === 0) {
        tempoTotalParticipacao = tempoTotalEvento * participantes.length;
      }

      const valorBase = valorTotal + valorSacos - valorReparo;
      const valorTaxa = Math.floor(valorBase * (taxaGuilda / 100));
      const valorDistribuir = valorBase - valorTaxa;

      const distribuicao = participantes.map(([userId, data]) => {
        let tempoParticipacao = data.tempoTotal || 0;
        if (!eventData.finalizadoEm && !data.pausado && data.tempoInicio && eventData.status === 'em_andamento') {
          tempoParticipacao += Date.now() - data.tempoInicio;
        }

        const percentagem = tempoTotalParticipacao > 0 ?
          (tempoParticipacao / tempoTotalParticipacao) :
          (1 / participantes.length);

        const valorReceber = Math.floor(valorDistribuir * percentagem);

        return {
          userId,
          nick: data.nick,
          tempo: tempoParticipacao,
          percentagem: (percentagem * 100).toFixed(2),
          valor: valorReceber
        };
      });

      const simulationId = `sim_${Date.now()}_${eventId}`;
      const simulationData = {
        id: simulationId,
        eventId: eventId,
        guildId: interaction.guild.id,
        canalEventoId: interaction.channel.id,
        criadorId: interaction.user.id,
        valorTotal,
        valorSacos,
        valorReparo,
        valorTaxa,
        taxaGuilda,
        valorDistribuir,
        distribuicao,
        tempoTotalEvento: tempoTotalEvento, // ✅ Armazenar tempo total
        eventoNome: eventData.nome,
        status: 'simulado',
        timestamp: Date.now()
      };

      if (!global.simulations) global.simulations = new Map();
      global.simulations.set(simulationId, simulationData);

      console.log(`[LootSplit] Simulation ${simulationId} created. Base: ${valorBase} (Total: ${valorTotal} + Sacos: ${valorSacos} - Reparo: ${valorReparo})`);

      const embed = this.createSimulationEmbed(simulationData, eventData);

      const botoes = new ActionRowBuilder()
        .addComponents(
          new ButtonBuilder()
            .setCustomId(`loot_enviar_${simulationId}`)
            .setLabel('📤 Enviar para Financeiro')
            .setStyle(ButtonStyle.Success),
          new ButtonBuilder()
            .setCustomId(`loot_recalcular_${simulationId}`)
            .setLabel('🔄 Recalcular')
            .setStyle(ButtonStyle.Primary),
          new ButtonBuilder()
            .setCustomId(`loot_atualizar_part_${simulationId}`)
            .setLabel('⚙️ Atualizar Participação')
            .setStyle(ButtonStyle.Secondary)
        );

      await interaction.reply({
        embeds: [embed],
        components: [botoes],
        ephemeral: false
      });

    } catch (error) {
      console.error(`[LootSplit] Error processing simulation:`, error);
      await interaction.reply({
        content: '❌ Erro ao processar simulação. Verifique os valores informados.',
        ephemeral: true
      });
    }
  }

  // ✅ ATUALIZADO: Mostrar tempo em HH:MM:SS e % de participação
  static createSimulationEmbed(simulation, eventData) {
    // Calcular tempo total do evento
    const tempoTotalEvento = simulation.tempoTotalEvento || 0;
    const tempoTotalFormatado = this.formatTime(tempoTotalEvento);

    const embed = new EmbedBuilder()
      .setTitle('💰 SIMULAÇÃO DE DIVISÃO DE LOOT')
      .setDescription(
        `## ${eventData.nome || simulation.eventoNome}\n\n` +
        `**⏱️ Duração Total do Evento:** \`${tempoTotalFormatado}\`\n\n` +
        `**💎 Valor Base:** \`${simulation.valorTotal.toLocaleString()}\`\n` +
        `**🎒 Sacos (adicional):** \`${simulation.valorSacos.toLocaleString()}\`\n` +
        `**🔧 Reparo:** \`${simulation.valorReparo.toLocaleString()}\`\n` +
        `**📊 Taxa Guilda (${simulation.taxaGuilda}%):** \`${simulation.valorTaxa.toLocaleString()}\`\n` +
        `**💵 Valor a Distribuir:** \`${simulation.valorDistribuir.toLocaleString()}\``
      )
      .setColor(0xF1C40F)
      .setTimestamp();

    // Lista de participantes com % de participação baseada no tempo total do evento
    const listaParticipantes = simulation.distribuicao.map(p => {
      const tempoFormatado = this.formatTime(p.tempo || 0);

      // Calcular % de participação em relação ao tempo total do evento
      let percentParticipacao = 0;
      if (tempoTotalEvento > 0) {
        percentParticipacao = ((p.tempo || 0) / tempoTotalEvento) * 100;
      }

      // Limitar a 100% (caso algum erro de timing)
      percentParticipacao = Math.min(percentParticipacao, 100);

      return `\`${p.nick}\`\n> 💰 **Valor:** \`${p.valor.toLocaleString()}\` | ⏱️ **Tempo:** \`${tempoFormatado}\` | 📊 **Participação:** \`${percentParticipacao.toFixed(1)}%\``;
    }).join('\n\n');

    embed.addFields({
      name: `👥 Participantes (${simulation.distribuicao.length}) - Participação baseada no tempo total`,
      value: listaParticipantes || 'Nenhum participante',
      inline: false
    });

    // Adicionar legenda explicativa
    embed.setFooter({
      text: '💡 100% = Participou todo o evento | 50% = Participou metade do tempo | Formato: HH:MM:SS'
    });

    return embed;
  }

  static async handleEnviar(interaction, simulationId) {
    try {
      console.log(`[LootSplit] Sending simulation ${simulationId} to financeiro`);

      const simulation = global.simulations?.get(simulationId);
      if (!simulation) {
        return interaction.reply({
          content: '❌ Simulação não encontrada!',
          ephemeral: true
        });
      }

      const eventData = global.activeEvents.get(simulation.eventId) || global.finishedEvents?.get(simulation.eventId);
      const canalFinanceiro = interaction.guild.channels.cache.find(c => c.name === '📊╠financeiro');

      if (!canalFinanceiro) {
        return interaction.reply({
          content: '❌ Canal financeiro não encontrado!',
          ephemeral: true
        });
      }

      const embedAprovacao = new EmbedBuilder()
        .setTitle('🔔 PAGAMENTO PENDENTE DE APROVAÇÃO')
        .setDescription(
          `**Evento:** ${eventData?.nome || 'Desconhecido'}\n` +
          `**Criador:** <@${simulation.criadorId}>\n` +
          `**Valor Total:** \`${simulation.valorTotal.toLocaleString()}\`\n` +
          `**Sacos:** \`${simulation.valorSacos.toLocaleString()}\`\n` +
          `**Taxa Guilda:** \`${simulation.valorTaxa.toLocaleString()}\`\n` +
          `**A Distribuir:** \`${simulation.valorDistribuir.toLocaleString()}\``
        )
        .setColor(0xE74C3C)
        .setTimestamp();

      const botoesAprovacao = new ActionRowBuilder()
        .addComponents(
          new ButtonBuilder()
            .setCustomId(`fin_aprovar_${simulationId}`)
            .setLabel('✅ Confirmar e Depositar')
            .setStyle(ButtonStyle.Success),
          new ButtonBuilder()
            .setCustomId(`fin_recusar_${simulationId}`)
            .setLabel('❌ Recusar Depósito')
            .setStyle(ButtonStyle.Danger)
        );

      const admRole = interaction.guild.roles.cache.find(r => r.name === 'ADM');
      const staffRole = interaction.guild.roles.cache.find(r => r.name === 'Staff');

      let mentions = '';
      if (admRole) mentions += `<@&${admRole.id}> `;
      if (staffRole) mentions += `<@&${staffRole.id}>`;

      await canalFinanceiro.send({
        content: mentions ? `🔔 ${mentions} Nova solicitação de pagamento!` : '🔔 Nova solicitação de pagamento!',
        embeds: [embedAprovacao],
        components: [botoesAprovacao]
      });

      await interaction.update({
        content: '✅ Solicitação enviada para o canal financeiro!',
        components: []
      });

    } catch (error) {
      console.error(`[LootSplit] Error sending to financeiro:`, error);
      await interaction.reply({
        content: '❌ Erro ao enviar para financeiro.',
        ephemeral: true
      });
    }
  }

  static async handleRecalcular(interaction, simulationId) {
    try {
      console.log(`[LootSplit] Recalculating simulation ${simulationId}`);

      const simulation = global.simulations?.get(simulationId);
      if (!simulation) {
        return interaction.reply({
          content: '❌ Simulação não encontrada!',
          ephemeral: true
        });
      }

      const modal = this.createSimulationModal(simulation.eventId);
      await interaction.showModal(modal);

    } catch (error) {
      console.error(`[LootSplit] Error recalculating:`, error);
      await interaction.reply({
        content: '❌ Erro ao recalcular.',
        ephemeral: true
      });
    }
  }

  static async handleAprovacaoFinanceira(interaction, simulationId, aprovar) {
    try {
      console.log(`[LootSplit] Processing financial approval for ${simulationId}: ${aprovar}`);

      const simulation = global.simulations?.get(simulationId);
      if (!simulation) {
        return interaction.reply({
          content: '❌ Simulação não encontrada!',
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

      await interaction.deferUpdate();

      let sucessos = 0;
      let falhas = 0;
      const totalParticipantes = simulation.distribuicao.length;

      const batchSize = 5;
      for (let i = 0; i < simulation.distribuicao.length; i += batchSize) {
        const batch = simulation.distribuicao.slice(i, i + batchSize);

        await Promise.all(batch.map(async (participante) => {
          try {
            if (!participante.valor || participante.valor <= 0) {
              console.log(`[LootSplit] Valor inválido para ${participante.userId}`);
              return;
            }

            const sucesso = await Database.addSaldo(
              participante.userId,
              participante.valor,
              `loot_split_evento_${simulation.eventId}`
            );

            if (sucesso) {
              sucessos++;
              console.log(`[LootSplit] +${participante.valor} adicionado para ${participante.userId}`);
            } else {
              falhas++;
              console.error(`[LootSplit] Falha ao adicionar saldo para ${participante.userId}`);
            }

            interaction.client.users.fetch(participante.userId).then(user => {
              Database.getSaldo(participante.userId).then(novoSaldo => {
                const embed = new EmbedBuilder()
                  .setTitle('💰 PAGAMENTO RECEBIDO')
                  .setDescription(
                    `🎉 **Parabéns!** Você recebeu um pagamento!\n\n` +
                    `\> **Valor:** \`${participante.valor.toLocaleString()}\`\n` +
                    `\> **Evento:** ${simulation.eventId}\n` +
                    `\> **Data:** ${new Date().toLocaleString('pt-BR')}\n\n` +
                    `💎 **Seu Novo Saldo:** \`${novoSaldo.toLocaleString()}\``
                  )
                  .setColor(0x2ECC71)
                  .setTimestamp();

                user.send({ embeds: [embed] }).catch(() => {});
              });
            }).catch(() => {});

          } catch (error) {
            console.error(`[LootSplit] Error depositing to ${participante.userId}:`, error);
            falhas++;
          }
        }));
      }

      if (simulation.valorTaxa > 0) {
        await Database.addTransaction({
          type: 'credito',
          userId: 'GUILD_BANK',
          amount: simulation.valorTaxa,
          reason: 'taxa_guilda',
          guildId: interaction.guild.id,
          eventId: simulation.eventId,
          approvedBy: interaction.user.id,
          approvedAt: Date.now()
        });
        console.log(`[LootSplit] Taxa guilda registrada: ${simulation.valorTaxa}`);
      }

      simulation.status = 'pago';
      simulation.aprovadoPor = interaction.user.id;
      simulation.aprovadoEm = Date.now();

      await interaction.editReply({
        content: `✅ Pagamento aprovado! ${sucessos} participantes receberam o loot. ${falhas > 0 ? `${falhas} falhas.` : ''}`,
        components: []
      });

      const canalEvento = interaction.guild.channels.cache.get(simulation.canalEventoId);
      if (canalEvento) {
        const embedConfirmado = new EmbedBuilder()
          .setTitle('✅ PAGAMENTO CONFIRMADO')
          .setDescription(
            `**Evento pago por:** <@${interaction.user.id}>\n` +
            `**Total distribuído:** \`${simulation.valorDistribuir.toLocaleString()}\`\n` +
            `**Taxa guilda:** \`${simulation.valorTaxa.toLocaleString()}\``
          )
          .setColor(0x2ECC71)
          .setTimestamp();

        const botaoArquivar = new ActionRowBuilder()
          .addComponents(
            new ButtonBuilder()
              .setCustomId(`loot_arquivar_${simulationId}`)
              .setLabel('📁 Arquivar Evento')
              .setStyle(ButtonStyle.Primary)
          );

        await canalEvento.send({
          embeds: [embedConfirmado],
          components: [botaoArquivar]
        });
      }

      const canalLogs = interaction.guild.channels.cache.find(c => c.name === '📜╠logs-banco');
      if (canalLogs) {
        await canalLogs.send({
          embeds: [
            new EmbedBuilder()
              .setTitle('📝 LOG: PAGAMENTO DE EVENTO')
              .setDescription(
                `**Evento:** ${simulation.eventId}\n` +
                `**Aprovado por:** <@${interaction.user.id}>\n` +
                `**Valor Total:** \`${simulation.valorTotal.toLocaleString()}\`\n` +
                `**Sacos:** \`${simulation.valorSacos.toLocaleString()}\`\n` +
                `**Participantes:** ${simulation.distribuicao.length}\n` +
                `**Data:** ${new Date().toLocaleString()}`
              )
              .setColor(0x3498DB)
              .setTimestamp()
          ]
        });
      }

    } catch (error) {
      console.error(`[LootSplit] Error in financial approval:`, error);
      await interaction.followUp({
        content: '❌ Erro ao processar aprovação.',
        ephemeral: true
      });
    }
  }

  // ✅ ATUALIZADO: Distribuir XP proporcional ao tempo no arquivamento
  static async handleArquivar(interaction, eventId, simulationId) {
    try {
      console.log(`[LootSplit] Archiving event ${eventId} with simulation ${simulationId}`);

      const simulation = global.simulations?.get(simulationId);
      if (!simulation) {
        return interaction.reply({
          content: '❌ Simulação não encontrada!',
          ephemeral: true
        });
      }

      // Determinar se é Raid Avalon ou Evento Normal
      const eventData = global.finishedEvents?.get(simulation.eventId) || global.activeEvents?.get(simulation.eventId);

      // Verificar se é raid avalon pelo ID ou pelos dados do evento
      const isRaidAvalon = eventId?.includes('raid') ||
        simulation.eventId?.includes('raid') ||
        eventData?.tipo === 'raid_avalon';

      // Definir taxa de XP baseado no tipo de evento
      const xpRate = isRaidAvalon ? this.XP_RATES.RAID_AVALON : this.XP_RATES.EVENTO_NORMAL;
      const eventoTipo = isRaidAvalon ? '🔥 RAID AVALON' : '⚔️ Evento Normal';

      console.log(`[LootSplit] Arquivando ${eventoTipo} - Taxa XP: ${xpRate} XP/min`);

      // DISTRIBUIR XP AOS PARTICIPANTES
      let totalXpDistribuido = 0;
      const canalLogXp = interaction.guild.channels.cache.find(c => c.name === '📜╠log-xp');

      if (simulation.distribuicao && simulation.distribuicao.length > 0) {
        console.log(`[LootSplit] Distribuindo XP para ${simulation.distribuicao.length} participantes...`);

        for (const participante of simulation.distribuicao) {
          try {
            // Calcular tempo em minutos
            const tempoMinutos = Math.floor((participante.tempo || 0) / 1000 / 60);

            // Calcular XP (tempo em minutos × taxa)
            const xpGanho = tempoMinutos * xpRate;

            if (xpGanho > 0) {
              // Adicionar XP usando o handler
              await XpHandler.addXp(
                participante.userId,
                xpGanho,
                `Participação em ${eventoTipo} - ${simulation.eventId}`,
                interaction.guild,
                canalLogXp
              );

              totalXpDistribuido += xpGanho;

              // Notificar usuário por DM
              try {
                const user = await interaction.client.users.fetch(participante.userId);
                const embedXp = new EmbedBuilder()
                  .setTitle('🎉 XP RECEBIDO POR PARTICIPAÇÃO')
                  .setDescription(
                    `✨ **Você ganhou XP por participar de um evento!**\n\n` +
                    `📅 **Evento:** ${eventoTipo}\n` +
                    `⏱️ **Tempo Participado:** ${this.formatTime(participante.tempo || 0)}\n` +
                    `💎 **XP Ganho:** \`${xpGanho.toLocaleString()} XP\`\n` +
                    `📈 **Taxa:** ${xpRate} XP/minuto\n\n` +
                    `🎊 Continue participando dos eventos da guilda para subir de nível!`
                  )
                  .setColor(isRaidAvalon ? 0x9B59B6 : 0x2ECC71)
                  .setTimestamp();

                await user.send({ embeds: [embedXp] });
              } catch (dmError) {
                console.log(`[LootSplit] Não foi possível DM o usuário ${participante.userId}`);
              }

              console.log(`[LootSplit] +${xpGanho} XP para ${participante.userId} (${tempoMinutos}min)`);
            }
          } catch (xpError) {
            console.error(`[LootSplit] Erro ao adicionar XP para ${participante.userId}:`, xpError);
          }
        }
      }

      // Salvar no histórico
      await Database.addEventHistory({
        eventId: eventId || simulation.eventId,
        simulationId: simulationId,
        guildId: interaction.guild.id,
        arquivadoPor: interaction.user.id,
        timestamp: Date.now(),
        dados: {
          ...simulation,
          xpDistribuido: totalXpDistribuido,
          tipoEvento: isRaidAvalon ? 'raid_avalon' : 'evento_normal',
          xpRate: xpRate
        }
      });

      // ✅ INTEGRAÇÃO AUTOMÁTICA: Verificar eventos XP ativos
      try {
        await XpEventHandler.verificarEventosAtivos(interaction.guild, simulation.eventoNome);
      } catch (e) {
        console.error('[LootSplit] Error auto-checking XP events:', e);
      }

      // Criar embed de confirmação do arquivamento com info de XP
      const embedArquivamento = new EmbedBuilder()
        .setTitle('📁 EVENTO ARQUIVADO')
        .setDescription(
          `✅ **Evento arquivado com sucesso!**\n\n` +
          `🏷️ **Tipo:** ${eventoTipo}\n` +
          `👥 **Participantes:** ${simulation.distribuicao?.length || 0}\n` +
          `💰 **Valor Total:** \`${(simulation.valorTotal || 0).toLocaleString()}\`\n` +
          `💎 **XP Total Distribuído:** \`${totalXpDistribuido.toLocaleString()} XP\`\n` +
          `📈 **Taxa XP:** ${xpRate} XP/minuto\n` +
          `👤 **Arquivado por:** <@${interaction.user.id}>`
        )
        .setColor(isRaidAvalon ? 0x9B59B6 : 0x3498DB)
        .setTimestamp();

      const canalEvento = interaction.guild.channels.cache.get(interaction.channel.id);
      if (canalEvento) {
        await interaction.update({
          content: '',
          embeds: [embedArquivamento],
          components: []
        });

        // Deletar canal após 10 segundos
        setTimeout(async () => {
          try {
            await canalEvento.delete('Evento arquivado');
            console.log(`[LootSplit] Deleted archived event channel: ${canalEvento.id}`);
          } catch (e) {
            console.error('[LootSplit] Error deleting channel:', e);
          }
        }, 10000);
      }

      // Log no canal de logs
      const canalLogs = interaction.guild.channels.cache.find(c => c.name === '📜╠logs-banco');
      if (canalLogs) {
        await canalLogs.send({
          embeds: [
            new EmbedBuilder()
              .setTitle('📝 LOG: EVENTO ARQUIVADO')
              .setDescription(
                `**Evento:** ${eventId || simulation.eventId}\n` +
                `**Tipo:** ${eventoTipo}\n` +
                `**Arquivado por:** <@${interaction.user.id}>\n` +
                `**XP Distribuído:** \`${totalXpDistribuido.toLocaleString()} XP\`\n` +
                `**Taxa:** ${xpRate} XP/min\n` +
                `**Data:** ${new Date().toLocaleString()}`
              )
              .setColor(isRaidAvalon ? 0x9B59B6 : 0x3498DB)
              .setTimestamp()
          ]
        });
      }

      console.log(`[LootSplit] Evento arquivado. Total XP distribuído: ${totalXpDistribuido}`);

    } catch (error) {
      console.error(`[LootSplit] Error archiving event:`, error);
      await interaction.reply({
        content: '❌ Erro ao arquivar evento.',
        ephemeral: true
      });
    }
  }
}

module.exports = LootSplitHandler;