const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const TemplateHandler = require('../handlers/templateHandler');
const RecurrenceHandler = require('../handlers/recurrenceHandler');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('template')
    .setDescription('Gerencia templates de eventos')
    .addSubcommand(subcommand =>
      subcommand
        .setName('criar')
        .setDescription('Cria novo template de evento'))
    .addSubcommand(subcommand =>
      subcommand
        .setName('listar')
        .setDescription('Lista templates disponíveis'))
    .addSubcommand(subcommand =>
      subcommand
        .setName('usar')
        .setDescription('Cria evento a partir de template'))
    .addSubcommand(subcommand =>
      subcommand
        .setName('recorrencia')
        .setDescription('Configura recorrência automática')
        .addIntegerOption(option =>
          option.setName('id')
            .setDescription('ID do template')
            .setRequired(true)))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageEvents),

  async execute(interaction, client) {
    const subcommand = interaction.options.getSubcommand();

    switch (subcommand) {
      case 'criar':
        const modal = TemplateHandler.createTemplateModal();
        await interaction.showModal(modal);
        break;

      case 'listar':
        await TemplateHandler.showTemplateSelector(interaction, 'list');
        break;

      case 'usar':
        await TemplateHandler.showTemplateSelector(interaction, 'use');
        break;

      case 'recorrencia':
        const templateId = interaction.options.getInteger('id');
        await TemplateHandler.setupRecurrence(interaction, templateId);
        break;

      default:
        await interaction.reply({ content: '❌ Subcomando não reconhecido.', ephemeral: true });
    }
  }
};