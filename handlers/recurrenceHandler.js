const Scheduler = require('../services/scheduler');
const Database = require('../utils/database');
const EventHandler = require('./eventHandler');

/**
 * Sistema de Eventos Recorrentes
 * Gerencia criação automática de eventos baseados em templates
 */

class RecurrenceHandler {
  constructor() {
    this.activeSchedules = new Map();
    this.loadActiveRecurrences();
  }

  /**
   * Carrega recorrências ativas do banco ao iniciar
   */
  loadActiveRecurrences() {
    try {
      const stmt = Database.db.prepare(`
        SELECT * FROM event_templates 
        WHERE recurrence_rule IS NOT NULL 
        AND recurrence_rule != '{}'
      `);

      const templates = stmt.all();

      templates.forEach(t => {
        if (t.recurrence_rule) {
          this.scheduleTemplate(t);
        }
      });

      console.log(`[Recurrence] Loaded ${templates.length} recurring schedules`);
    } catch (error) {
      console.error('[Recurrence] Error loading schedules:', error);
    }
  }

  /**
   * Agenda template recorrente
   */
  scheduleTemplate(template) {
    try {
      const rule = JSON.parse(template.recurrence_rule || '{}');
      if (!rule.cron) return;

      // Parse cron simples: "minuto hora * * dia"
      // Ex: "0 20 * * 2" = Terça 20:00
      const parts = rule.cron.split(' ');
      if (parts.length !== 5) return;

      const [minute, hour, , , dayOfWeek] = parts;

      // Converte para agendamento JavaScript
      const days = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
      const targetDay = parseInt(dayOfWeek);

      // Cancela agendamento existente
      const scheduleId = `recurring_${template.id}`;
      Scheduler.cancelInterval(scheduleId);

      // Cria novo agendamento semanal
      Scheduler.scheduleInterval(scheduleId, 24 * 60 * 60 * 1000, async () => {
        const now = new Date();

        // Verifica se é o dia correto
        if (now.getDay() === targetDay) {
          // Verifica se é hora correta (com margem de 1 minuto)
          if (now.getHours() === parseInt(hour) && now.getMinutes() === parseInt(minute)) {
            await this.createEventFromTemplate(template);
          }
        }
      });

      console.log(`[Recurrence] Scheduled "${template.name}" for ${days[targetDay]} at ${hour}:${minute}`);

    } catch (error) {
      console.error('[Recurrence] Error scheduling template:', error);
    }
  }

  /**
   * Cria evento automaticamente a partir de template
   */
  async createEventFromTemplate(template) {
    try {
      // Verifica se já existe evento ativo com mesmo nome hoje
      const today = new Date().toISOString().split('T')[0];
      const checkStmt = Database.db.prepare(`
        SELECT COUNT(*) as count FROM events 
        WHERE nome = ? 
        AND DATE(created_at/1000, 'unixepoch') = ?
        AND status != 'cancelado'
      `);

      const exists = checkStmt.get(template.name, today);
      if (exists.count > 0) {
        console.log(`[Recurrence] Event "${template.name}" already created today`);
        return;
      }

      // Busca guild do template
      const guild = global.client.guilds.cache.get(template.guild_id);
      if (!guild) return;

      // Cria evento
      const eventData = {
        id: `event_${Date.now()}_${template.id}`,
        guildId: template.guild_id,
        criadorId: template.creator_id,
        nome: `${template.name} (Auto)`,
        descricao: template.description,
        requisitos: template.requirements,
        horario: this.getNextOccurrenceTime(template.recurrence_rule),
        tipo: 'automatico',
        status: 'aguardando',
        taxaGuilda: 10
      };

      // Chama EventHandler para criar o evento completo (canais, etc)
      await EventHandler.createEventFromData(guild, eventData);

      console.log(`[Recurrence] Auto-created event: ${eventData.nome}`);

      // Notifica canal de eventos
      const eventChannel = guild.channels.cache.find(c => c.name === '📅╠eventos');
      if (eventChannel) {
        await eventChannel.send({
          embeds: [{
            title: '🔄 Evento Recorrente Criado',
            description: `**${eventData.nome}** foi criado automaticamente pelo template.`,
            color: 0x3498DB,
            timestamp: new Date()
          }]
        });
      }

    } catch (error) {
      console.error('[Recurrence] Error creating event from template:', error);
    }
  }

  /**
   * Calcula próximo horário baseado na regra
   */
  getNextOccurrenceTime(ruleStr) {
    try {
      const rule = JSON.parse(ruleStr || '{}');
      if (!rule.cron) return '20:00';

      const parts = rule.cron.split(' ');
      return `${parts[1].padStart(2, '0')}:${parts[0].padStart(2, '0')}`;
    } catch {
      return '20:00';
    }
  }

  /**
   * Processa configuração de recorrência
   */
  static async processRecurrenceConfig(interaction, templateId) {
    try {
      const cron = interaction.fields.getTextInputValue('recurrence_cron');
      const endDateStr = interaction.fields.getTextInputValue('recurrence_end');

      // Valida cron básico
      if (!/^\d{1,2} \d{1,2} \* \* \d$/.test(cron)) {
        return interaction.reply({ 
          content: '❌ Formato inválido. Use: `minuto hora * * dia` (0-6, onde 0=Domingo)\nExemplo: `0 20 * * 2` = Toda terça às 20:00', 
          ephemeral: true 
        });
      }

      let endDate = null;
      if (endDateStr) {
        const [day, month, year] = endDateStr.split('/');
        endDate = new Date(year, month - 1, day).getTime();
      }

      const recurrenceRule = {
        cron: cron,
        endDate: endDate,
        createdBy: interaction.user.id
      };

      // Atualiza no banco
      const stmt = Database.db.prepare(`
        UPDATE event_templates 
        SET recurrence_rule = ? 
        WHERE id = ? AND guild_id = ?
      `);

      stmt.run(JSON.stringify(recurrenceRule), templateId, interaction.guild.id);

      // Recarrega agendamento
      const templates = Database.getTemplates(interaction.guild.id);
      const template = templates.find(t => t.id === parseInt(templateId));

      if (template) {
        // Instancia handler global se necessário
        if (!global.recurrenceHandler) {
          global.recurrenceHandler = new RecurrenceHandler();
        }
        global.recurrenceHandler.scheduleTemplate({...template, recurrence_rule: JSON.stringify(recurrenceRule)});
      }

      await interaction.reply({
        content: `✅ Recorrência configurada!\n**Agendamento:** ${cron}\n**Encerra:** ${endDate ? new Date(endDate).toLocaleDateString() : 'Nunca'}`,
        ephemeral: true
      });

    } catch (error) {
      console.error('[Recurrence] Error configuring:', error);
      await interaction.reply({ content: '❌ Erro ao configurar recorrência.', ephemeral: true });
    }
  }

  /**
   * Lista eventos recorrentes ativos
   */
  static async listRecurringEvents(interaction) {
    const stmt = Database.db.prepare(`
      SELECT id, name, recurrence_rule 
      FROM event_templates 
      WHERE guild_id = ? 
      AND recurrence_rule IS NOT NULL
      AND recurrence_rule != '{}'
    `);

    const recurrences = stmt.all(interaction.guild.id);

    if (recurrences.length === 0) {
      return interaction.reply({ content: '📭 Nenhum evento recorrente configurado.', ephemeral: true });
    }

    const embed = new EmbedBuilder()
      .setTitle('🔄 Eventos Recorrentes')
      .setDescription('Eventos criados automaticamente:')
      .setColor(0x3498DB);

    recurrences.forEach(r => {
      const rule = JSON.parse(r.recurrence_rule || '{}');
      embed.addFields({
        name: r.name,
        value: `📅 **Agendamento:** \`${rule.cron || 'N/A'}\`\n⏰ **Próximo:** Em breve`,
        inline: false
      });
    });

    await interaction.reply({ embeds: [embed], ephemeral: true });
  }
}

module.exports = RecurrenceHandler;