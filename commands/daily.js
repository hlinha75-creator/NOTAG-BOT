const { SlashCommandBuilder } = require('discord.js');
const DailyRewardsHandler = require('../handlers/dailyRewardsHandler');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('checkin')
    .setDescription('Realiza check-in diário para ganhar recompensas'),

  async execute(interaction, client) {
    await DailyRewardsHandler.processCheckin(interaction);
  }
};