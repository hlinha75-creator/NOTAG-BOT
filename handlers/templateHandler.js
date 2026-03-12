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
const Database = require('../utils/database');
const Validator = require('../utils/validator');

/**
 * Sistema de Templates de Eventos
 * Permite criar, salvar e reutilizar configurações de eventos
 */

class TemplateHandler {
  /**
   * Cria modal para novo template
   */
  static createTemplateModal() {
    const modal = new ModalBuilder()
      .setCustomId('modal_create_template')
      .setTitle('📋 Criar Template de Evento');

    const nameInput = new TextInputBuilder()
      .setCustomId('template_name')
      .setLabel('Nome do Template')
      .setPlaceholder('Ex: Raid Avalon 8.1')
      .setStyle(TextInputStyle.Short)
      .setRequired(true)
      .setMaxLength(50);

    const descInput = new TextInputBuilder()
      .setCustomId('template_desc')
      .setLabel('Descrição Padrão')
      .setPlaceholder('Descreva o evento...')
      .setStyle(TextInputStyle.Paragraph)
      .setRequired(true)
      .setMaxLength(1000);

    const reqsInput = new TextInputBuilder()
      .setCustomId('template_reqs')
      .setLabel('Requisitos Padrão')
      .setPlaceholder('Ex: IP 1400+, Build de tank...')
      .setStyle(TextInputStyle.Paragraph)
      .setRequired(false)
      .setMaxLength(500);

    const durationInput = new TextInputBuilder()
      .setCustomId('template_duration')
      .setLabel('Duração Padrão (minutos)')
      .setPlaceholder('Ex: 120')
      .setStyle(TextInputStyle.Short)
      .setRequired(true)
      .setMaxLength(4);

    modal.addComponents(
      new ActionRowBuilder().addComponents(nameInput),
      new ActionRowBuilder().addComponents(descInput),
      new ActionRowBuilder().addComponents(reqsInput),
      new ActionRowBuilder().addComponents(durationInput)
    );

    return modal;
  }

  /**
   * Processa criação de template
   */
  static async processCreateTemplate(interaction) {
    try {
      const name = interaction.fields.getTextInputValue('template_name');
      const description = interaction.fields.getTextInputValue('template_desc');
      const requirements = interaction.fields.getTextInputValue('template_reqs') || 'Nenhum';
      const durationStr = interaction.fields.getTextInputValue('template_duration');

      // Validação
      const nameCheck = Validator.validateNickname(name, 50);
      if (!nameCheck.valid) {
        return interaction.reply({ content: `❌ ${nameCheck.error}`, ephemeral: true });
      }

      const durationCheck = Validator.validateDuration(durationStr);
      if (!durationCheck.valid) {
        return interaction.reply({ content: `❌ ${durationCheck.error}`, ephemeral: true });
      }

      const template = {
        name: nameCheck.sanitized,
        description: Validator.sanitizeEmbedText(description, 1000),
        requirements: Validator.sanitizeEmbedText(requirements, 500),
        duration: durationCheck.minutes,
        recurrence: {} // Será configurado depois se necessário
      };

      Database.saveTemplate(interaction.guild.id, interaction.user.id, template);

      // Log
      Database.logAudit('TEMPLATE_CREATED', interaction.user.id, {
        templateName: template.name,
        duration: template.duration
      }, interaction.guild.id);

      const embed = new EmbedBuilder()
        .setTitle('✅ Template Criado')
        .setDescription(`**${template.name}** foi salvo com sucesso!`)
        .addFields(
          { name: '⏱️ Duração', value: `${template.duration} minutos`, inline: true },
          { name: '📝 Requisitos', value: template.requirements, inline: false }
        )
        .setColor(0x2ECC71)
        .setTimestamp();

      await interaction.reply({ embeds: [embed], ephemeral: true });

    } catch (error) {
      console.error('[Template] Error creating template:', error);
      await interaction.reply({ content: '❌ Erro ao criar template.', ephemeral: true });
    }
  }

  /**
   * Mostra lista de templates para seleção
   */
  static async showTemplateSelector(interaction, action = 'use') {
    const templates = Database.getTemplates(interaction.guild.id);

    if (templates.length === 0) {
      return interaction.reply({ 
        content: '❌ Nenhum template criado ainda. Use `/template criar` primeiro.', 
        ephemeral: true 
      });
    }

    const options = templates.map(t => 
      new StringSelectMenuOptionBuilder()
        .setLabel(t.name.substring(0, 25))
        .setDescription(`Duração: ${t.default_duration}min | ${t.description.substring(0, 50)}...`)
        .setValue(`${action}_${t.id}`)
    );

    const selectMenu = new StringSelectMenuBuilder()
      .setCustomId('select_template_action')
      .setPlaceholder('Selecione um template...')
      .addOptions(options.slice(0, 25)); // Limite Discord

    const row = new ActionRowBuilder().addComponents(selectMenu);

    const embed = new EmbedBuilder()
      .setTitle('📋 Templates de Eventos')
      .setDescription(`Selecione um template para ${action === 'use' ? 'criar evento' : 'editar'}:`)
      .setColor(0x3498DB);

    await interaction.reply({ embeds: [embed], components: [row], ephemeral: true });
  }

  /**
   * Carrega template para criar evento
   */
  static async loadTemplateForEvent(interaction, templateId) {
    const templates = Database.getTemplates(interaction.guild.id);
    const template = templates.find(t => t.id === parseInt(templateId));

    if (!template) {
      return interaction.reply({ content: '❌ Template não encontrado.', ephemeral: true });
    }

    // Preenche modal com dados do template
    const modal = new ModalBuilder()
      .setCustomId(`modal_criar_evento_template_${template.id}`)
      .setTitle(`🎮 ${template.name}`);

    const nomeInput = new TextInputBuilder()
      .setCustomId('evt_nome')
      .setLabel('Nome do Evento')
      .setValue(template.name)
      .setStyle(TextInputStyle.Short)
      .setRequired(true);

    const descInput = new TextInputBuilder()
      .setCustomId('evt_descricao')
      .setLabel('Descrição')
      .setValue(template.description)
      .setStyle(TextInputStyle.Paragraph)
      .setRequired(true);

    const reqsInput = new TextInputBuilder()
      .setCustomId('evt_requisitos')
      .setLabel('Requisitos')
      .setValue(template.requirements)
      .setStyle(TextInputStyle.Paragraph)
      .setRequired(false);

    const horarioInput = new TextInputBuilder()
      .setCustomId('evt_horario')
      .setLabel('Horário (HH:MM)')
      .setPlaceholder('20:00')
      .setStyle(TextInputStyle.Short)
      .setRequired(true);

    modal.addComponents(
      new ActionRowBuilder().addComponents(nomeInput),
      new ActionRowBuilder().addComponents(descInput),
      new ActionRowBuilder().addComponents(reqsInput),
      new ActionRowBuilder().addComponents(horarioInput)
    );

    await interaction.showModal(modal);
  }

  /**
   * Configura recorrência para template
   */
  static async setupRecurrence(interaction, templateId) {
    const templates = Database.getTemplates(interaction.guild.id);
    const template = templates.find(t => t.id === parseInt(templateId));

    if (!template) return;

    const modal = new ModalBuilder()
      .setCustomId(`modal_recurrence_${templateId}`)
      .setTitle('🔄 Configurar Recorrência');

    const cronInput = new TextInputBuilder()
      .setCustomId('recurrence_cron')
      .setLabel('Regra de Recorrência')
      .setPlaceholder('0 20 * * 2 = Toda terça 20:00')
      .setStyle(TextInputStyle.Short)
      .setRequired(true)
      .setMaxLength(50);

    const endDateInput = new TextInputBuilder()
      .setCustomId('recurrence_end')
      .setLabel('Data final (DD/MM/YYYY ou deixe vazio)')
      .setPlaceholder('31/12/2024')
      .setStyle(TextInputStyle.Short)
      .setRequired(false);

    modal.addComponents(
      new ActionRowBuilder().addComponents(cronInput),
      new ActionRowBuilder().addComponents(endDateInput)
    );

    await interaction.showModal(modal);
  }
}

module.exports = TemplateHandler;