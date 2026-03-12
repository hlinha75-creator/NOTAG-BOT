const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const AuditHandler = require('../handlers/auditHandler');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('audit')
    .setDescription('Sistema de auditoria financeira')
    .addSubcommand(subcommand =>
      subcommand
        .setName('usuario')
        .setDescription('Audita transações de usuário')
        .addUserOption(option =>
          option.setName('usuario')
            .setDescription('Usuário para auditar')
            .setRequired(true))
        .addIntegerOption(option =>
          option.setName('dias')
            .setDescription('Período em dias (padrão: 30)')
            .setRequired(false)))
    .addSubcommand(subcommand =>
      subcommand
        .setName('estornar')
        .setDescription('Estorna uma transação')
        .addStringOption(option =>
          option.setName('transacao')
            .setDescription('ID da transação')
            .setRequired(true))
        .addStringOption(option =>
          option.setName('motivo')
            .setDescription('Motivo do estorno')
            .setRequired(true)))
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction, client) {
    const subcommand = interaction.options.getSubcommand();

    if (subcommand === 'usuario') {
      const user = interaction.options.getUser('usuario');
      const days = interaction.options.getInteger('dias') || 30;
      await AuditHandler.generateUserAuditReport(interaction, user.id, days);
    }
    else if (subcommand === 'estornar') {
      const txnId = interaction.options.getString('transacao');
      const reason = interaction.options.getString('motivo');
      await AuditHandler.reverseTransaction(interaction, txnId, reason);
    }
  }
};