const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle
} = require('discord.js');
const KillboardHandler = require('../handlers/killboardHandler');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('killboard')
    .setDescription('💀 Gerencia o sistema de Killboard')
    .addSubcommand(subcommand =>
      subcommand
        .setName('setup')
        .setDescription('Inicializa o sistema de killboard com canais'))
    .addSubcommand(subcommand =>
      subcommand
        .setName('config')
        .setDescription('Configura o ID da guilda do Albion')
        .addStringOption(option =>
          option.setName('guildid')
            .setDescription('ID da guilda no Albion Online')
            .setRequired(true)))
    .addSubcommand(subcommand =>
      subcommand
        .setName('toggle')
        .setDescription('Ativa ou desativa o killboard')
        .addBooleanOption(option =>
          option.setName('ativo')
            .setDescription('Ativar/desativar')
            .setRequired(true)))
    .addSubcommand(subcommand =>
      subcommand
        .setName('status')
        .setDescription('Mostra status do killboard'))
    .addSubcommand(subcommand =>
      subcommand
        .setName('test')
        .setDescription('Envia mensagem de teste')
        .addStringOption(option =>
          option.setName('tipo')
            .setDescription('Tipo de teste')
            .setRequired(true)
            .addChoices(
              { name: 'Kill', value: 'kill' },
              { name: 'Death', value: 'death' }
            ))),

  async execute(interaction) {
    const subcommand = interaction.options.getSubcommand();
    const isADM = interaction.member.permissions.has(PermissionFlagsBits.Administrator);

    if (!isADM) {
      return interaction.reply({
        content: '❌ Apenas administradores podem usar este comando!',
        ephemeral: true
      });
    }

    try {
      switch (subcommand) {
        case 'setup':
          await interaction.deferReply({ ephemeral: true });

          // Verificar se já existe configuração
          const existingConfig = global.guildConfig?.get(interaction.guild.id)?.killboard;
          if (existingConfig?.killChannelId) {
            return interaction.editReply({
              content: '⚠️ Killboard já está configurado! Use `/killboard status` para ver os canais.'
            });
          }

          // Inicializar
          await KillboardHandler.initialize(interaction.guild);

          await interaction.editReply({
            content: '✅ **Killboard configurado!**\n\nCanais criados:\n• 💀-kill-feed\n• ☠️-death-feed\n\nUse `/killboard config [guildId]` para vincular sua guilda do Albion.'
          });
          break;

        case 'config':
          const guildId = interaction.options.getString('guildid');
          await interaction.deferReply({ ephemeral: true });

          try {
            const guildData = await KillboardHandler.setGuildId(interaction.guild.id, guildId);
            await interaction.editReply({
              content: `✅ **Guilda configurada!**\n\n🏰 **Nome:** ${guildData.Name}\n👥 **Membros:** ${guildData.MemberCount || 'N/A'}\n\nO sistema começará a monitorar automaticamente em instantes.`
            });
          } catch (error) {
            await interaction.editReply({
              content: `❌ Erro ao configurar guilda: ${error.message}\n\nVerifique se o ID está correto.`
            });
          }
          break;

        case 'toggle':
          const ativo = interaction.options.getBoolean('ativo');
          await interaction.deferReply({ ephemeral: true });

          const config = global.guildConfig?.get(interaction.guild.id)?.killboard || {};
          config.enabled = ativo;

          if (!global.guildConfig.has(interaction.guild.id)) {
            global.guildConfig.set(interaction.guild.id, {});
          }
          global.guildConfig.get(interaction.guild.id).killboard = config;

          if (ativo) {
            KillboardHandler.startPolling(interaction.guild.id, config);
          } else {
            KillboardHandler.stopPolling(interaction.guild.id);
          }

          await interaction.editReply({
            content: `✅ Killboard ${ativo ? '**ativado**' : '**desativado**'}!`
          });
          break;

        case 'status':
          const currentConfig = global.guildConfig?.get(interaction.guild.id)?.killboard;

          if (!currentConfig) {
            return interaction.reply({
              content: '❌ Killboard não configurado! Use `/killboard setup` primeiro.',
              ephemeral: true
            });
          }

          const embed = new EmbedBuilder()
            .setTitle('💀 Status do Killboard')
            .setColor(currentConfig.enabled ? 0x2ECC71 : 0xE74C3C)
            .addFields(
              { name: 'Status', value: currentConfig.enabled ? '🟢 Ativo' : '🔴 Desativado', inline: true },
              { name: 'Guilda Albion', value: currentConfig.guildIdAlbion ? `✅ ${currentConfig.guildIdAlbion}` : '❌ Não configurada', inline: true },
              { name: 'Canal Kills', value: currentConfig.killChannelId ? `<#${currentConfig.killChannelId}>` : '❌', inline: true },
              { name: 'Canal Deaths', value: currentConfig.deathChannelId ? `<#${currentConfig.deathChannelId}>` : '❌', inline: true }
            );

          await interaction.reply({ embeds: [embed], ephemeral: true });
          break;

        case 'test':
          const tipo = interaction.options.getString('tipo');
          await interaction.deferReply({ ephemeral: true });

          // Aqui você pode implementar um evento de teste mockado
          await interaction.editReply({
            content: `📤 Enviando mensagem de teste (${tipo})...`
          });

          // Implementar envio de embed de teste
          break;
      }
    } catch (error) {
      console.error('[Killboard Command] Erro:', error);
      await interaction.reply({
        content: '❌ Erro ao executar comando!',
        ephemeral: true
      });
    }
  }
};