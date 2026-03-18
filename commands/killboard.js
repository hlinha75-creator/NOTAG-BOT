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

          if (!global.guildConfig) global.guildConfig = new Map();

          const config = global.guildConfig.get(interaction.guild.id)?.killboard;
          if (!config) {
            return interaction.editReply({ content: '❌ Killboard não configurado! Use `/killboard setup` primeiro.' });
          }

          config.enabled = ativo;
          global.guildConfig.get(interaction.guild.id).killboard = config;

          // Salvar em disco
          KillboardHandler.saveConfig();

          if (ativo && config.guildIdAlbion) {
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

          const testConfig = global.guildConfig?.get(interaction.guild.id)?.killboard;
          if (!testConfig) {
            return interaction.editReply({
              content: '❌ Killboard não configurado! Use `/killboard setup` e `/killboard config` primeiro.'
            });
          }

          // Evento mockado para teste
          const mockEvent = {
            EventId: 999999999,
            TimeStamp: new Date().toISOString(),
            Location: 'Zona de Teste',
            TotalVictimKillFame: 125000,
            Killer: {
              Name: 'GuerreiroNOTAG',
              GuildId: testConfig.guildIdAlbion || 'guild-test',
              GuildName: 'NOTAG',
              AllianceName: 'NOTAG Alliance',
              AverageItemPower: 1450,
              Equipment: {
                MainHand: { Type: 'T8_MAIN_SWORD@3', Quality: 3 },
                Head: { Type: 'T8_HEAD_PLATE_SET3@2', Quality: 2 },
                Armor: { Type: 'T8_ARMOR_PLATE_SET3@2', Quality: 2 },
                Shoes: { Type: 'T8_SHOES_PLATE_SET3@1', Quality: 2 },
                Cape: { Type: 'T8_CAPE', Quality: 1 },
                Mount: { Type: 'T8_MOUNT_HORSE', Quality: 1 }
              }
            },
            Victim: {
              Name: 'InimigoTest',
              GuildId: 'guild-enemy',
              GuildName: 'Inimigos',
              AllianceName: null,
              AverageItemPower: 1200,
              Equipment: {
                MainHand: { Type: 'T7_MAIN_ARCANESTAFF@1', Quality: 2 },
                Head: { Type: 'T7_HEAD_CLOTH_SET1', Quality: 1 },
                Armor: { Type: 'T7_ARMOR_CLOTH_SET1', Quality: 1 },
                Shoes: { Type: 'T7_SHOES_CLOTH_SET1', Quality: 1 },
                Cape: { Type: 'T6_CAPE', Quality: 1 },
                Mount: { Type: 'T6_MOUNT_ARMORED_HORSE', Quality: 1 }
              },
              Inventory: [
                { Type: 'T8_ROCK', Count: 500 },
                { Type: 'T7_PLANKS', Count: 200 }
              ]
            },
            Participants: [{ Id: '1' }, { Id: '2' }, { Id: '3' }],
            GroupMembers: []
          };

          try {
            if (tipo === 'kill') {
              const killChannelId = testConfig.killChannelId;
              if (!killChannelId) {
                return interaction.editReply({ content: '❌ Canal de kills não configurado. Use `/killboard setup` primeiro.' });
              }
              const killChannel = interaction.guild.channels.cache.get(killChannelId);
              if (!killChannel) {
                return interaction.editReply({ content: `❌ Canal de kills não encontrado. ID salvo: ${killChannelId}` });
              }
              mockEvent.Killer.GuildId = testConfig.guildIdAlbion || 'guild-test';
              const killEmbed = await KillboardHandler.createKillEmbed(mockEvent, testConfig);
              const components = KillboardHandler.createEventComponents(mockEvent);
              await killChannel.send({ embeds: [killEmbed], components: [components] });
              await interaction.editReply({ content: `✅ Embed de kill de teste enviado em <#${killChannelId}>!` });
            } else {
              const deathChannelId = testConfig.deathChannelId;
              if (!deathChannelId) {
                return interaction.editReply({ content: '❌ Canal de deaths não configurado. Use `/killboard setup` primeiro.' });
              }
              const deathChannel = interaction.guild.channels.cache.get(deathChannelId);
              if (!deathChannel) {
                return interaction.editReply({ content: `❌ Canal de deaths não encontrado. ID salvo: ${deathChannelId}` });
              }
              mockEvent.Victim.GuildId = testConfig.guildIdAlbion || 'guild-test';
              mockEvent.Victim.GuildName = 'NOTAG';
              mockEvent.Killer.GuildId = 'guild-enemy';
              const deathEmbed = await KillboardHandler.createDeathEmbed(mockEvent, testConfig);
              const components = KillboardHandler.createEventComponents(mockEvent);
              await deathChannel.send({ embeds: [deathEmbed], components: [components] });
              await interaction.editReply({ content: `✅ Embed de death de teste enviado em <#${deathChannelId}>!` });
            }
          } catch (testError) {
            console.error('[Killboard Test] Erro:', testError);
            await interaction.editReply({ content: `❌ Erro ao enviar teste: ${testError.message}` });
          }
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