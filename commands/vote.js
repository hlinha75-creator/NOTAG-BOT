const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const VotingHandler = require('../handlers/votingHandler');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('vote')
    .setDescription('Cria uma votação oficial da guilda')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageEvents),

  async execute(interaction, client) {
    const modal = VotingHandler.createVotingModal();
    await interaction.showModal(modal);
  }
};