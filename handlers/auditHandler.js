const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const Database = require('../utils/database');
const Validator = require('../utils/validator');

/**
 * Handler de Auditoria Financeira
 * Rastreia todas as movimentações com detalhes completos
 */

class AuditHandler {
  /**
   * Registra transação com auditoria completa
   * @param {Object} transaction 
   */
  static async recordTransaction(transaction) {
    // Gera ID único auditável
    const auditId = `AUD-${Date.now()}-${Math.random().toString(36).substr(2, 5).toUpperCase()}`;

    const record = {
      id: auditId,
      timestamp: Date.now(),
      ...transaction,
      ip: transaction.ip || 'discord-internal', // Se disponível
      userAgent: 'discord-bot'
    };

    // Salva no banco
    Database.addTransaction(record);

    // Log em canal se configurado
    await this.logToChannel(record);

    return auditId;
  }

  /**
   * Cria log em canal de auditoria
   */
  static async logToChannel(record) {
    if (!global.client) return;

    try {
      // Busca canal de logs (pode ser configurável)
      const channels = global.client.channels.cache.filter(
        c => c.name === '🔒╠auditoria-financeira' || c.name === 'auditoria'
      );

      if (channels.size === 0) return;

      const embed = new EmbedBuilder()
        .setTitle(`📝 Transação ${record.type.toUpperCase()}`)
        .setDescription(`**ID Auditoria:** \`${record.id}\``)
        .addFields(
          { name: '💰 Valor', value: `\`${record.amount.toLocaleString()}\``, inline: true },
          { name: '👤 Usuário', value: `<@${record.userId}>`, inline: true },
          { name: '📋 Motivo', value: record.reason || 'N/A', inline: true },
          { name: '🏰 Guilda', value: record.guildId || 'N/A', inline: true },
          { name: '⏰ Timestamp', value: `<t:${Math.floor(record.created_at / 1000)}:f>`, inline: true },
          { name: '✅ Aprovado por', value: record.approvedBy ? `<@${record.approvedBy}>` : 'Sistema', inline: true }
        )
        .setColor(this.getColorForType(record.type))
        .setTimestamp();

      if (record.eventId) {
        embed.addFields({ name: '🎮 Evento', value: record.eventId, inline: false });
      }

      for (const channel of channels.values()) {
        await channel.send({ embeds: [embed] }).catch(() => {});
      }
    } catch (error) {
      console.error('[Audit] Error logging to channel:', error);
    }
  }

  static getColorForType(type) {
    const colors = {
      'credito': 0x2ECC71,
      'debito': 0xE74C3C,
      'emprestimo': 0x3498DB,
      'pagamento_emprestimo': 0x9B59B6,
      'transferencia_enviada': 0xF39C12,
      'transferencia_recebida': 0x2ECC71,
      'taxa_guilda': 0x1ABC9C,
      'loot_split_evento': 0x3498DB,
      'saque_aprovado': 0xE74C3C,
      'estorno': 0x95A5A6
    };
    return colors[type] || 0x95A5A6;
  }

  /**
   * Gera relatório de auditoria para usuário específico
   * @param {CommandInteraction} interaction 
   * @param {string} targetUserId 
   * @param {number} days 
   */
  static async generateUserAuditReport(interaction, targetUserId, days = 30) {
    await interaction.deferReply({ ephemeral: true });

    try {
      const since = Date.now() - (days * 24 * 60 * 60 * 1000);
      const transactions = Database.getUserTransactions(targetUserId, 100)
        .filter(t => t.created_at >= since);

      if (transactions.length === 0) {
        return interaction.editReply({
          content: `📭 Nenhuma transação encontrada para <@${targetUserId}> nos últimos ${days} dias.`
        });
      }

      // Calcula estatísticas
      const stats = {
        totalIn: 0,
        totalOut: 0,
        byType: {}
      };

      transactions.forEach(t => {
        if (t.amount > 0) {
          if (['debito', 'transferencia_enviada', 'saque_aprovado'].includes(t.type)) {
            stats.totalOut += t.amount;
          } else {
            stats.totalIn += t.amount;
          }
        }

        stats.byType[t.type] = (stats.byType[t.type] || 0) + 1;
      });

      const embed = new EmbedBuilder()
        .setTitle(`📊 Relatório de Auditoria - ${days} dias`)
        .setDescription(`Usuário: <@${targetUserId}>`)
        .addFields(
          { name: '💰 Total Recebido', value: `\`${stats.totalIn.toLocaleString()}\``, inline: true },
          { name: '💸 Total Gasto', value: `\`${stats.totalOut.toLocaleString()}\``, inline: true },
          { name: '📊 Saldo Líquido', value: `\`${(stats.totalIn - stats.totalOut).toLocaleString()}\``, inline: true },
          { name: '📝 Total Transações', value: `\`${transactions.length}\``, inline: true }
        )
        .setColor(0x3498DB)
        .setTimestamp();

      // Adiciona últimas 5 transações
      const last5 = transactions.slice(0, 5).map(t => {
        const date = new Date(t.created_at).toLocaleDateString('pt-BR');
        return `\`${date}\` | ${t.type} | \`${t.amount.toLocaleString()}\``;
      }).join('\n');

      embed.addFields({ name: '📋 Últimas Transações', value: last5 || 'N/A', inline: false });

      await interaction.editReply({ embeds: [embed] });

    } catch (error) {
      console.error('[Audit] Error generating report:', error);
      await interaction.editReply({ content: '❌ Erro ao gerar relatório de auditoria.' });
    }
  }

  /**
   * Realiza estorno de transação
   * @param {CommandInteraction} interaction 
   * @param {string} transactionId 
   * @param {string} reason 
   */
  static async reverseTransaction(interaction, transactionId, reason) {
    try {
      // Busca transação original
      const stmt = Database.db.prepare('SELECT * FROM transactions WHERE id = ?');
      const original = stmt.get(transactionId);

      if (!original) {
        return interaction.reply({ content: '❌ Transação não encontrada.', ephemeral: true });
      }

      if (original.type === 'estorno') {
        return interaction.reply({ content: '❌ Não é possível estornar um estorno.', ephemeral: true });
      }

      // Verifica se já foi estornado
      const checkStmt = Database.db.prepare('SELECT * FROM transactions WHERE original_id = ? AND type = ?');
      const existing = checkStmt.get(transactionId, 'estorno');

      if (existing) {
        return interaction.reply({ content: '❌ Esta transação já foi estornada anteriormente.', ephemeral: true });
      }

      // Calcula valor a devolver (inverte sinal)
      const reverseAmount = -original.amount;

      // Atualiza saldo do usuário
      const user = Database.getUser(original.user_id);
      const newSaldo = user.saldo + reverseAmount;

      if (newSaldo < 0) {
        return interaction.reply({ 
          content: `❌ Estorno deixaria saldo negativo (\`${newSaldo}\`). Não é possível prosseguir.`, 
          ephemeral: true 
        });
      }

      Database.updateUser(original.user_id, { saldo: newSaldo });

      // Registra estorno
      const estornoId = await this.recordTransaction({
        type: 'estorno',
        userId: original.user_id,
        amount: reverseAmount,
        reason: `Estorno de ${original.id}: ${reason}`,
        guildId: original.guild_id,
        approvedBy: interaction.user.id,
        originalId: transactionId
      });

      // Log de auditoria
      Database.logAudit('TRANSACTION_REVERSAL', interaction.user.id, {
        originalTransaction: transactionId,
        estornoId: estornoId,
        amount: reverseAmount,
        reason: reason
      }, interaction.guild.id, original.user_id);

      await interaction.reply({
        content: `✅ Transação \`${transactionId}\` estornada com sucesso.\n**Valor:** \`${Math.abs(reverseAmount).toLocaleString()}\`\n**Novo Estorno ID:** \`${estornoId}\``,
        ephemeral: true
      });

    } catch (error) {
      console.error('[Audit] Error reversing transaction:', error);
      await interaction.reply({ content: '❌ Erro ao processar estorno.', ephemeral: true });
    }
  }

  /**
   * Exporta relatório completo para CSV
   */
  static async exportToCSV(guildId, since = null) {
    const transactions = Database.getAuditLogs({ guildId, since }, 1000);

    let csv = 'ID,Date,Type,UserID,Amount,Reason,ApprovedBy\n';

    transactions.forEach(t => {
      csv += `${t.id},${new Date(t.created_at).toISOString()},${t.action_type},${t.user_id},${t.details.amount || 0},"${t.details.reason || ''}",${t.details.approvedBy || ''}\n`;
    });

    return csv;
  }
}

module.exports = AuditHandler;