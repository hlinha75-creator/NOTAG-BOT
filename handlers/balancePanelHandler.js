const {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  PermissionFlagsBits
} = require('discord.js');
const Database = require('../utils/database');

class BalancePanelHandler {
  static activeIntervals = new Map();

  static async sendPanel(channel, guild) {
    try {
      console.log(`[BalancePanel] Wrapper sendPanel chamado`);
      return await this.createAndSendPanel(channel, guild);
    } catch (error) {
      console.error(`[BalancePanel] Erro no wrapper:`, error);
      throw error;
    }
  }

  static async createAndSendPanel(channel, guild) {
    try {
      if (!channel || !guild) {
        console.error('[BalancePanel] Channel ou Guild undefined');
        return;
      }

      if (!channel.isTextBased()) {
        console.error('[BalancePanel] Canal não é texto');
        return;
      }

      const botMember = await guild.members.fetch(channel.client.user.id).catch(() => guild.members.me);
      if (!botMember) {
        console.error('[BalancePanel] Bot member não encontrado');
        return;
      }

      const permissions = channel.permissionsFor(botMember);
      if (!permissions?.has(PermissionFlagsBits.SendMessages)) {
        console.error('[BalancePanel] Sem permissão para enviar mensagens');
        return;
      }

      console.log(`[BalancePanel] Buscando stats para guild: ${guild.id}`);
      const stats = await Database.getGuildDetailedStats(guild.id);

      console.log(`[BalancePanel] Stats carregados:`, {
        guildId: guild.id,
        saldoGeral: stats.saldoGeral,
        arrecadacaoTaxas: stats.arrecadacaoTaxas,
        emprestimosPendentes: stats.emprestimosPendentes,
        saldoLiquido: stats.saldoLiquido,
        membrosAtivos: stats.membrosAtivos
      });

      const embed = this.createModernEmbed(stats, guild);
      const components = this.createComponents();

      if (this.activeIntervals.has(guild.id)) {
        clearInterval(this.activeIntervals.get(guild.id));
      }

      const message = await channel.send({
        embeds: [embed],
        components: components
      });

      console.log(`[BalancePanel] Painel enviado em #${channel.name} (Guild: ${guild.id})`);

      const intervalId = setInterval(async () => {
        try {
          console.log(`[BalancePanel] Auto-atualizando painel para guild: ${guild.id}`);
          const freshStats = await Database.getGuildDetailedStats(guild.id);

          console.log(`[BalancePanel] Stats atualizados:`, {
            saldoGeral: freshStats.saldoGeral,
            arrecadacaoTaxas: freshStats.arrecadacaoTaxas
          });

          const updatedEmbed = this.createModernEmbed(freshStats, guild);

          await message.edit({ embeds: [updatedEmbed] });
          console.log(`[BalancePanel] Painel auto-atualizado em #${channel.name} - ${new Date().toLocaleTimeString()}`);
        } catch (err) {
          console.error('[BalancePanel] Erro no auto-update:', err);
        }
      }, 120000);

      this.activeIntervals.set(guild.id, intervalId);

      setTimeout(() => {
        if (this.activeIntervals.has(guild.id)) {
          clearInterval(this.activeIntervals.get(guild.id));
          this.activeIntervals.delete(guild.id);
        }
      }, 24 * 60 * 60 * 1000);

    } catch (error) {
      console.error('[BalancePanel] Erro criando painel:', error);
    }
  }

  static createModernEmbed(stats, guild) {
    const {
      saldoGeral,
      arrecadacaoTaxas,
      emprestimosPendentes,
      saldoLiquido,
      membrosAtivos
    } = stats;

    const taxaPercent = saldoGeral > 0 ? ((arrecadacaoTaxas / saldoGeral) * 100).toFixed(1) : 0;
    const emprestimoPercent = saldoGeral > 0 ? ((emprestimosPendentes / saldoGeral) * 100).toFixed(1) : 0;

    const formatNumber = (num) => {
      if (num === undefined || num === null || isNaN(num)) return '0';
      return num.toLocaleString('pt-BR');
    };

    const embed = new EmbedBuilder()
      .setTitle('🏦 SALDO DA GUILDA')
      .setDescription(
        `\> **${guild.name}**\n` +
        `\> Sistema Financeiro Integrado\n` +
        `\> Atualizado: `
      )
      .setColor(0x2ECC71)
      .setThumbnail(guild.iconURL({ dynamic: true, size: 128 }) || 'https://i.imgur.com/5K9Q5ZK.png')
      .setImage('https://i.imgur.com/JPepvGx.png')
      .addFields(
        {
          name: '💰 SALDO GERAL',
          value: `\`\`\`fix\n${formatNumber(saldoGeral)} pratas\`\`\``,
          inline: false
        },
        {
          name: '📊 ARRECADAÇÃO DE TAXAS',
          value: `\`\`\`yaml\n${formatNumber(arrecadacaoTaxas)} pratas\n(${taxaPercent}% do total)\`\`\``,
          inline: true
        },
        {
          name: '💳 EMPRÉSTIMOS PENDENTES',
          value: `\`\`\`diff\n- ${formatNumber(emprestimosPendentes)} pratas\n(${emprestimoPercent}% do total)\`\`\``,
          inline: true
        },
        {
          name: '✨ SALDO LÍQUIDO',
          value: `\`\`\`diff\n+ ${formatNumber(saldoLiquido)} pratas\n(Livre de dívidas)\`\`\``,
          inline: false
        },
        {
          name: '👥 MEMBROS ATIVOS',
          value: `\`${membrosAtivos} membros\``,
          inline: true
        },
        {
          name: '🔄 AUTO-UPDATE',
          value: '`A cada 2 minutos`',
          inline: true
        }
      )
      .setFooter({
        text: `NOTAG Bot • Guild ID: ${guild.id}`,
        iconURL: 'https://i.imgur.com/8QBYRrm.png'
      })
      .setTimestamp();

    return embed;
  }

  static createComponents() {
    return [
      new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('btn_saldo_atualizar')
          .setLabel('🔄 Atualizar Agora')
          .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
          .setCustomId('btn_saldo_detalhes')
          .setLabel('📊 Ver Detalhes')
          .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
          .setCustomId('btn_saldo_historico')
          .setLabel('📜 Histórico')
          .setStyle(ButtonStyle.Secondary)
      )
    ];
  }

  static async handleAtualizar(interaction) {
    try {
      await interaction.deferUpdate();

      console.log(`[BalancePanel] Atualização manual solicitada por ${interaction.user.tag} (Guild: ${interaction.guild.id})`);

      const stats = await Database.getGuildDetailedStats(interaction.guild.id);

      console.log(`[BalancePanel] Stats após atualização manual:`, {
        saldoGeral: stats.saldoGeral,
        arrecadacaoTaxas: stats.arrecadacaoTaxas
      });

      const embed = this.createModernEmbed(stats, interaction.guild);

      await interaction.editReply({ embeds: [embed] });

      console.log(`[BalancePanel] Painel atualizado manualmente por ${interaction.user.tag}`);

    } catch (error) {
      console.error('[BalancePanel] Erro na atualização manual:', error);
      await interaction.followUp({
        content: '❌ Erro ao atualizar painel.',
        ephemeral: true
      });
    }
  }

  static async handleDetalhes(interaction) {
    try {
      await interaction.deferReply({ ephemeral: true });

      const topUsers = await Database.db.allAsync(`
        SELECT user_id, saldo, total_recebido, total_sacado
        FROM users
        ORDER BY saldo DESC
        LIMIT 10
      `) || [];

      let description = '**💎 TOP 10 MEMBROS (Por Saldo)**\n\n';

      if (topUsers.length === 0) {
        description += '*Nenhum dado disponível*';
      } else {
        topUsers.forEach((user, index) => {
          const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : '•';
          const saldo = user.saldo || 0;
          description += `${medal} <@${user.user_id}>: \`${saldo.toLocaleString('pt-BR')}\` pratas\n`;
        });
      }

      const stats = await Database.getGuildDetailedStats(interaction.guild.id);
      description += `\n\n📊 **Info Arrecadação:**\n`;
      description += `Total em taxas: \`${(stats.arrecadacaoTaxas || 0).toLocaleString('pt-BR')}\` pratas\n`;
      description += `*Última verificação: ${new Date().toLocaleTimeString('pt-BR')}*`;

      const embed = new EmbedBuilder()
        .setTitle('📊 Detalhes Financeiros')
        .setDescription(description)
        .setColor(0x3498DB)
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });

    } catch (error) {
      console.error('[BalancePanel] Erro ao mostrar detalhes:', error);
      await interaction.editReply({
        content: '❌ Erro ao carregar detalhes.'
      });
    }
  }

  static async handleHistorico(interaction) {
    try {
      await interaction.deferReply({ ephemeral: true });

      const transacoes = await Database.db.allAsync(`
        SELECT tipo, valor, descricao, created_at
        FROM transactions
        ORDER BY created_at DESC
        LIMIT 15
      `) || [];

      let description = '**📜 ÚLTIMAS 15 TRANSAÇÕES DA GUILDA**\n\n';

      if (transacoes.length === 0) {
        description += '*Nenhuma transação encontrada.*';
      } else {
        transacoes.forEach((t) => {
          const data = new Date(t.created_at).toLocaleString('pt-BR');
          const sinal = t.tipo === 'credito' ? '➕' : '➖';
          const valor = (t.valor || 0).toLocaleString('pt-BR');
          const descricao = t.descricao || t.tipo;
          description += `${sinal} \`${valor}\` — ${descricao}\n*${data}*\n\n`;
        });
      }

      const embed = new EmbedBuilder()
        .setTitle('📜 Histórico Financeiro da Guilda')
        .setDescription(description)
        .setColor(0x95A5A6)
        .setFooter({ text: 'NOTAG Bot • Sistema Financeiro' })
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });

    } catch (error) {
      console.error('[BalancePanel] Erro ao mostrar histórico:', error);
      try {
        await interaction.editReply({ content: '❌ Erro ao carregar histórico.' });
      } catch (e) {
        await interaction.followUp({ content: '❌ Erro ao carregar histórico.', ephemeral: true });
      }
    }
  }

  static formatNumber(num) {
    if (num === undefined || num === null || isNaN(num)) return '0';
    return num.toLocaleString('pt-BR');
  }
}

module.exports = BalancePanelHandler;