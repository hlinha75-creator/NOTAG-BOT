const Database = require('./database');

/**
 * Sistema de Analytics - Versão Replit (sem gráficos)
 * Gera relatórios textuais e CSV
 */

class Analytics {
  /**
   * Gera relatório de atividade financeira
   */
  async generateFinancialReport(guildId, days = 30) {
    const since = Date.now() - (days * 24 * 60 * 60 * 1000);

    const rows = await Database.db.allAsync(`
      SELECT DATE(created_at/1000, 'unixepoch') as date,
             type,
             SUM(amount) as total,
             COUNT(*) as count
      FROM transactions
      WHERE guild_id = ? AND created_at > ?
      GROUP BY DATE(created_at/1000, 'unixepoch'), type
      ORDER BY date
    `, [guildId, since]);

    return {
      data: rows,
      summary: this.summarizeData(rows)
    };
  }

  /**
   * Estatísticas de participação em eventos
   */
  async generateParticipationStats(guildId) {
    const stats = await Database.db.getAsync(`
      SELECT 
        COUNT(*) as total_events,
        SUM(CASE WHEN status = 'encerrado' THEN 1 ELSE 0 END) as completed_events,
        SUM(valor_total) as total_loot
      FROM events
      WHERE guild_id = ?
    `, [guildId]);

    return stats;
  }

  summarizeData(data) {
    const summary = {};
    data.forEach(row => {
      if (!summary[row.type]) summary[row.type] = { total: 0, count: 0 };
      summary[row.type].total += row.total;
      summary[row.type].count += row.count;
    });
    return summary;
  }

  /**
   * Exporta para CSV
   */
  async exportToCSV(guildId, since = null) {
    const transactions = await Database.getAuditLogs({ guildId, since }, 1000);

    let csv = 'ID,Date,Type,UserID,Amount,Reason,ApprovedBy\n';

    transactions.forEach(t => {
      const date = new Date(t.created_at).toISOString();
      const amount = t.details.amount || 0;
      const reason = (t.details.reason || '').replace(/"/g, '""');
      const approvedBy = t.details.approvedBy || '';
      csv += `"${t.id}","${date}","${t.action_type}","${t.user_id}",${amount},"${reason}","${approvedBy}"\n`;
    });

    return csv;
  }
}

module.exports = new Analytics();