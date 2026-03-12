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
const Validator = require('../utils/validator');

/**
 * Sistema de Votações/Votação da Guilda
 * Permite criar enquetes e votações oficiais
 */

class VotingHandler {
  /**
   * Cria modal para nova votação
   */
  static createVotingModal() {
    const modal = new ModalBuilder()
      .setCustomId('modal_create_vote')
      .setTitle('🗳️ Criar Votação');

    const titleInput = new TextInputBuilder()
      .setCustomId('vote_title')
      .setLabel('Título da Votação')
      .setPlaceholder('Ex: Mudança de horário de CTA')
      .setStyle(TextInputStyle.Short)
      .setRequired(true)
      .setMaxLength(100);

    const descInput = new TextInputBuilder()
      .setCustomId('vote_desc')
      .setLabel('Descrição/Contexto')
      .setPlaceholder('Explique o motivo da votação...')
      .setStyle(TextInputStyle.Paragraph)
      .setRequired(true)
      .setMaxLength(2000);

    const optionsInput = new TextInputBuilder()
      .setCustomId('vote_options')
      .setLabel('Opções (uma por linha, máx 5)')
      .setPlaceholder('Sim\nNão\nAbster-se')
      .setStyle(TextInputStyle.Paragraph)
      .setRequired(true)
      .setMaxLength(500);

    const durationInput = new TextInputBuilder()
      .setCustomId('vote_duration')
      .setLabel('Duração (horas)')
      .setPlaceholder('24')
      .setStyle(TextInputStyle.Short)
      .setRequired(true)
      .setMaxLength(3);

    modal.addComponents(
      new ActionRowBuilder().addComponents(titleInput),
      new ActionRowBuilder().addComponents(descInput),
      new ActionRowBuilder().addComponents(optionsInput),
      new ActionRowBuilder().addComponents(durationInput)
    );

    return modal;
  }

  /**
   * Processa criação de votação
   */
  static async processCreateVote(interaction) {
    try {
      const title = interaction.fields.getTextInputValue('vote_title');
      const description = interaction.fields.getTextInputValue('vote_desc');
      const optionsText = interaction.fields.getTextInputValue('vote_options');
      const durationHours = parseInt(interaction.fields.getTextInputValue('vote_duration'));

      // Validações
      if (isNaN(durationHours) || durationHours < 1 || durationHours > 168) {
        return interaction.reply({ content: '❌ Duração deve ser entre 1 e 168 horas.', ephemeral: true });
      }

      const options = optionsText.split('\n').map(o => o.trim()).filter(o => o.length > 0);
      if (options.length < 2 || options.length > 5) {
        return interaction.reply({ content: '❌ Forneça entre 2 e 5 opções.', ephemeral: true });
      }

      const voteId = `vote_${Date.now()}_${interaction.user.id}`;
      const endsAt = Date.now() + (durationHours * 60 * 60 * 1000);

      const voteData = {
        id: voteId,
        guildId: interaction.guild.id,
        creatorId: interaction.user.id,
        title: Validator.sanitizeEmbedText(title, 100),
        description: Validator.sanitizeEmbedText(description, 2000),
        options: options,
        votes: {},
        endsAt: endsAt,
        status: 'active'
      };

      Database.createVote(voteData);

      // Cria embed de votação
      const embed = new EmbedBuilder()
        .setTitle('🗳️ ' + voteData.title)
        .setDescription(voteData.description)
        .addFields(
          { name: '👤 Criado por', value: `<@${interaction.user.id}>`, inline: true },
          { name: '⏰ Encerra em', value: `<t:${Math.floor(endsAt / 1000)}:R>`, inline: true },
          { name: '📊 Total de votos', value: '0', inline: true }
        )
        .setColor(0xF1C40F)
        .setTimestamp();

      // Adiciona opções como fields
      options.forEach((opt, idx) => {
        embed.addFields({ name: `${idx + 1}. ${opt}`, value: '0 votos (0%)', inline: false });
      });

      // Cria botões de voto
      const rows = [];
      let currentRow = new ActionRowBuilder();

      options.forEach((opt, idx) => {
        if (currentRow.components.length === 5) {
          rows.push(currentRow);
          currentRow = new ActionRowBuilder();
        }

        currentRow.addComponents(
          new ButtonBuilder()
            .setCustomId(`vote_cast_${voteId}_${idx}`)
            .setLabel(`${idx + 1}`)
            .setStyle(ButtonStyle.Primary)
        );
      });

      if (currentRow.components.length > 0) rows.push(currentRow);

      // Botão de encerrar (só criador/ADM)
      const adminRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`vote_end_${voteId}`)
          .setLabel('🔒 Encerrar Votação')
          .setStyle(ButtonStyle.Danger)
      );
      rows.push(adminRow);

      const message = await interaction.reply({ 
        embeds: [embed], 
        components: rows,
        fetchReply: true
      });

      // Agenda encerramento automático
      setTimeout(() => this.endVote(voteId, interaction.guild), durationHours * 60 * 60 * 1000);

      // Log
      Database.logAudit('VOTE_CREATED', interaction.user.id, {
        voteId: voteId,
        title: title,
        options: options
      }, interaction.guild.id);

    } catch (error) {
      console.error('[Voting] Error creating vote:', error);
      await interaction.reply({ content: '❌ Erro ao criar votação.', ephemeral: true });
    }
  }

  /**
   * Processa voto
   */
  static async processVote(interaction, voteId, optionIndex) {
    try {
      const vote = Database.getVote(voteId);

      if (!vote) {
        return interaction.reply({ content: '❌ Votação não encontrada.', ephemeral: true });
      }

      if (vote.status !== 'active') {
        return interaction.reply({ content: '❌ Esta votação já foi encerrada.', ephemeral: true });
      }

      if (Date.now() > vote.ends_at) {
        return interaction.reply({ content: '❌ O tempo de votação expirou.', ephemeral: true });
      }

      // Verifica se já votou
      const votes = JSON.parse(vote.votes || '{}');
      if (votes[interaction.user.id] !== undefined) {
        return interaction.reply({ content: '❌ Você já votou nesta enquete.', ephemeral: true });
      }

      // Registra voto
      const success = Database.castVote(voteId, interaction.user.id, parseInt(optionIndex));

      if (!success) {
        return interaction.reply({ content: '❌ Erro ao registrar voto.', ephemeral: true });
      }

      await interaction.reply({ 
        content: `✅ Voto registrado: **${vote.options[parseInt(optionIndex)]}**`, 
        ephemeral: true 
      });

      // Atualiza mensagem com resultados parciais
      await this.updateVoteDisplay(interaction, voteId);

    } catch (error) {
      console.error('[Voting] Error processing vote:', error);
      await interaction.reply({ content: '❌ Erro ao processar voto.', ephemeral: true });
    }
  }

  /**
   * Atualiza display da votação
   */
  static async updateVoteDisplay(interaction, voteId) {
    try {
      const vote = Database.getVote(voteId);
      if (!vote) return;

      const votes = JSON.parse(vote.votes || '{}');
      const totalVotes = Object.keys(votes).length;

      // Conta votos por opção
      const counts = new Array(vote.options.length).fill(0);
      Object.values(votes).forEach(v => counts[v]++);

      const embed = EmbedBuilder.from(interaction.message.embeds[0]);

      // Atualiza field de total
      embed.spliceFields(2, 1, { 
        name: '📊 Total de votos', 
        value: `${totalVotes}`, 
        inline: true 
      });

      // Atualiza opções com porcentagens
      let fieldIndex = 3; // Após os 3 primeiros fields
      vote.options.forEach((opt, idx) => {
        const count = counts[idx];
        const pct = totalVotes > 0 ? Math.round((count / totalVotes) * 100) : 0;
        const bar = '█'.repeat(Math.floor(pct / 10)) + '░'.repeat(10 - Math.floor(pct / 10));

        embed.spliceFields(fieldIndex + idx, 1, {
          name: `${idx + 1}. ${opt}`,
          value: `${bar} ${count} votos (${pct}%)`,
          inline: false
        });
      });

      await interaction.message.edit({ embeds: [embed] });

    } catch (error) {
      console.error('[Voting] Error updating display:', error);
    }
  }

  /**
   * Encerra votação
   */
  static async endVote(voteId, guild, forcedBy = null) {
    try {
      const vote = Database.getVote(voteId);
      if (!vote || vote.status === 'ended') return;

      // Atualiza status
      const stmt = Database.db.prepare("UPDATE votes SET status = 'ended' WHERE vote_id = ?");
      stmt.run(voteId);

      const votes = JSON.parse(vote.votes || '{}');
      const totalVotes = Object.keys(votes).length;

      // Calcula vencedor
      const counts = new Array(vote.options.length).fill(0);
      Object.values(votes).forEach(v => counts[v]++);

      let maxVotes = -1;
      let winnerIdx = -1;
      let tie = false;

      counts.forEach((count, idx) => {
        if (count > maxVotes) {
          maxVotes = count;
          winnerIdx = idx;
          tie = false;
        } else if (count === maxVotes && count > 0) {
          tie = true;
        }
      });

      // Cria embed final
      const embed = new EmbedBuilder()
        .setTitle('🗳️ ' + vote.title + ' [ENCERRADA]')
        .setDescription(vote.description)
        .addFields(
          { name: '📊 Total de votos', value: `${totalVotes}`, inline: true },
          { 
            name: '🏆 Resultado', 
            value: tie ? '⚠️ Empate!' : `**${vote.options[winnerIdx]}**`, 
            inline: true 
          }
        )
        .setColor(tie ? 0x95A5A6 : 0x2ECC71)
        .setTimestamp();

      if (forcedBy) {
        embed.addFields({ name: '🔒 Encerrado por', value: `<@${forcedBy}>`, inline: false });
      }

      // Adiciona resultados finais
      vote.options.forEach((opt, idx) => {
        const count = counts[idx];
        const pct = totalVotes > 0 ? Math.round((count / totalVotes) * 100) : 0;
        embed.addFields({
          name: `${idx + 1}. ${opt}`,
          value: `${count} votos (${pct}%)`,
          inline: true
        });
      });

      // Busca mensagem original e atualiza
      if (global.client) {
        const channels = guild.channels.cache.filter(c => c.isTextBased());

        for (const channel of channels.values()) {
          try {
            const messages = await channel.messages.fetch({ limit: 100 });
            const voteMsg = messages.find(m => 
              m.components.some(r => 
                r.components.some(b => b.customId?.includes(voteId))
              )
            );

            if (voteMsg) {
              await voteMsg.edit({ 
                embeds: [embed], 
                components: [] // Remove botões
              });
              break;
            }
          } catch (e) {}
        }
      }

      // Log
      Database.logAudit('VOTE_ENDED', forcedBy || 'SYSTEM', {
        voteId: voteId,
        totalVotes: totalVotes,
        winner: tie ? 'TIE' : vote.options[winnerIdx]
      }, guild.id);

    } catch (error) {
      console.error('[Voting] Error ending vote:', error);
    }
  }

  /**
   * Processa encerramento manual
   */
  static async processEndVote(interaction, voteId) {
    try {
      const vote = Database.getVote(voteId);

      if (!vote) {
        return interaction.reply({ content: '❌ Votação não encontrada.', ephemeral: true });
      }

      // Verifica permissão (criador ou ADM)
      const isCreator = vote.creator_id === interaction.user.id;
      const isAdmin = interaction.member.permissions.has('Administrator');

      if (!isCreator && !isAdmin) {
        return interaction.reply({ content: '❌ Apenas o criador ou ADM pode encerrar.', ephemeral: true });
      }

      await this.endVote(voteId, interaction.guild, interaction.user.id);

      await interaction.reply({ content: '✅ Votação encerrada com sucesso.', ephemeral: true });

    } catch (error) {
      console.error('[Voting] Error ending vote:', error);
      await interaction.reply({ content: '❌ Erro ao encerrar votação.', ephemeral: true });
    }
  }
}

module.exports = VotingHandler;