const {
  ChannelType,
  PermissionFlagsBits,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle
} = require('discord.js');

class SetupManager {
  constructor(guild, interaction = null) {
      this.guild = guild;
      this.interaction = interaction;
      this.createdChannels = [];
      this.createdCategories = [];
      this.existingChannels = [];
      this.rolesChecked = [];
      this.deletedChannels = [];
      this.deletedCategories = [];
      this.deletedRoles = [];
      this.errors = [];
  }

  getServerStructure() {
      return [
          {
              name: '🛡️ RECRUTAMENTO',
              type: ChannelType.GuildCategory,
              channels: [
                  { name: '📋╠registrar', type: ChannelType.GuildText },
                  { name: '🎤╠Recrutamento', type: ChannelType.GuildVoice },
                  { name: '📅╠agendamentos', type: ChannelType.GuildText }
              ]
          },
          {
              name: '⚙️ CONFIG',
              type: ChannelType.GuildCategory,
              channels: [
                  { name: '🔧╠configurações', type: ChannelType.GuildText }
              ]
          },
          {
              name: '💰 BANCO DA GUILDA',
              type: ChannelType.GuildCategory,
              channels: [
                  { name: '➕╠criar-evento', type: ChannelType.GuildText },
                  { name: '👋╠participar', type: ChannelType.GuildText },
                  { name: '🔍╠consultar-saldo', type: ChannelType.GuildText },
                  { name: '💰╠venda-de-baú', type: ChannelType.GuildText },
                  { name: '📊╠financeiro', type: ChannelType.GuildText },
                  { name: '💵╠depósitos', type: ChannelType.GuildText },
                  { name: '📜╠logs-banco', type: ChannelType.GuildText },
                  { name: '🔊╠Aguardando-Evento', type: ChannelType.GuildVoice }
              ]
          },
          {
              name: '⚔️ EVENTOS ATIVOS',
              type: ChannelType.GuildCategory,
              channels: []
          },
          {
              name: '📁 EVENTOS ENCERRADOS',
              type: ChannelType.GuildCategory,
              channels: []
          },
          {
              name: '👥 GESTÃO DE MEMBROS',
              type: ChannelType.GuildCategory,
              channels: [
                  { name: '📨╠solicitação-registro', type: ChannelType.GuildText },
                  { name: '🚪╠saída-membros', type: ChannelType.GuildText },
                  { name: '📋╠lista-membros', type: ChannelType.GuildText }
              ]
          },
          {
              name: '👑 GESTÃO DE GUILDA',
              type: ChannelType.GuildCategory,
              channels: [
                  { name: '📊╠painel-de-eventos', type: ChannelType.GuildText },
                  { name: '🏦╠saldo-guilda', type: ChannelType.GuildText }
              ]
          },
          {
              name: '🎓 ALBION ACADEMY',
              type: ChannelType.GuildCategory,
              channels: [
                  { name: '👤╠perfil', type: ChannelType.GuildText },
                  { name: '⭐╠xp-event', type: ChannelType.GuildText },
                  { name: '📜╠log-xp', type: ChannelType.GuildText },
                  { name: '🔮╠orb-xp', type: ChannelType.GuildText },
                  { name: '📊╠painel-xp', type: ChannelType.GuildText }
              ]
          },
          // 🛒 NOVO: Categoria Shopping com Mercado Albion
          {
              name: '🛒 SHOPPING',
              type: ChannelType.GuildCategory,
              channels: [
                  { name: '🛒╠mercado-albion', type: ChannelType.GuildText }
              ]
          }
      ];
  }

  getRequiredRoles() {
      return [
          'ADM',
          'Staff',
          'Caller',
          'tesoureiro',
          'Recrutador',
          'Membro',
          'Convidado',
          'Aliança'
      ];
  }

  async install() {
      console.log('🏗️ Iniciando instalação da estrutura...');

      await this.setupRoles();

      const structure = this.getServerStructure();

      for (const categoryData of structure) {
          try {
              let category = this.guild.channels.cache.find(
                  c => c.name === categoryData.name && c.type === ChannelType.GuildCategory
              );

              if (!category) {
                  category = await this.guild.channels.create({
                      name: categoryData.name,
                      type: ChannelType.GuildCategory,
                      permissionOverwrites: [
                          {
                              id: this.guild.id,
                              allow: [PermissionFlagsBits.ViewChannel],
                              deny: [PermissionFlagsBits.SendMessages, PermissionFlagsBits.Connect]
                          }
                      ]
                  });
                  this.createdCategories.push(categoryData.name);
                  console.log(`✅ Categoria criada: ${categoryData.name}`);
              } else {
                  this.existingChannels.push(categoryData.name);
                  console.log(`⚠️ Categoria já existe: ${categoryData.name}`);
              }

              for (const channelData of categoryData.channels) {
                  const channel = await this.createChannel(channelData, category);

                  if (channel && channelData.name === '📋╠registrar') {
                      const RegistrationPanel = require('./registrationPanel');
                      const messages = await channel.messages.fetch({ limit: 10 });
                      const existePainel = messages.some(m =>
                          m.author.bot &&
                          m.embeds.length > 0 &&
                          m.embeds[0].title?.includes('Bem-vindo')
                      );
                      if (!existePainel) {
                          await RegistrationPanel.sendPanel(channel);
                      }
                  }

                  if (channel && channelData.name === '🔧╠configurações') {
                      const existePainel = await this.checkExistingPanel(channel, 'CONFIGURAÇÕES');
                      if (!existePainel) {
                          await this.sendConfigPanel(channel);
                      }
                  }

                  if (channel && channelData.name === '📋╠lista-membros') {
                      const existePainel = await this.checkExistingPanel(channel, 'LISTA DE MEMBROS');
                      if (!existePainel) {
                          const MemberListPanel = require('./memberListPanel');
                          await MemberListPanel.sendPanel(channel, this.guild);
                      }
                  }

                  if (channel && channelData.name === '➕╠criar-evento') {
                      const existePainel = await this.checkExistingPanel(channel, 'CENTRAL DE EVENTOS');
                      if (!existePainel) {
                          const EventPanel = require('./eventPanel');
                          await EventPanel.sendPanel(channel);
                          console.log(`✅ Painel de eventos enviado em ${channel.name}`);
                      }
                  }

                  if (channel && channelData.name === '🔍╠consultar-saldo') {
                      const existePainel = await this.checkExistingPanel(channel, 'CONSULTAR SALDO');
                      if (!existePainel) {
                          const ConsultarSaldoHandler = require('./consultarSaldoHandler');
                          await ConsultarSaldoHandler.sendPanel(channel);
                          console.log(`✅ Painel de consultar saldo enviado em ${channel.name}`);
                      }
                  }

                  if (channel && channelData.name === '🏦╠saldo-guilda') {
                      const existePainel = await this.checkExistingPanel(channel, 'SALDO DA GUILDA');
                      if (!existePainel) {
                          const BalancePanelHandler = require('./balancePanelHandler');
                          await BalancePanelHandler.createAndSendPanel(channel, this.guild);
                          console.log(`✅ Painel de saldo da guilda enviado em ${channel.name}`);
                      }
                  }

                  if (channel && channelData.name === '💰╠venda-de-baú') {
                      const existePainel = await this.checkExistingPanel(channel, 'VENDA DE BAÚ');
                      if (!existePainel) {
                          const BauSaleHandler = require('./bauSaleHandler');
                          await BauSaleHandler.sendPanel(channel);
                          console.log(`✅ Painel de venda de baú enviado em ${channel.name}`);
                      }
                  }

                  if (channel && channelData.name === '📊╠painel-de-eventos') {
                      const existePainel = await this.checkExistingPanel(channel, 'PAINEL DE EVENTOS');
                      if (!existePainel) {
                          const EventStatsHandler = require('./eventStatsHandler');
                          await EventStatsHandler.sendPanel(channel, this.guild);
                          console.log(`✅ Painel de estatísticas de eventos enviado em ${channel.name}`);
                      }
                  }

                  // 🎯 Painel de Depósitos
                  if (channel && channelData.name === '💵╠depósitos') {
                      const existePainel = await this.checkExistingPanel(channel, 'SISTEMA DE DEPÓSITOS');
                      if (!existePainel) {
                          const DepositHandler = require('./depositHandler');
                          await DepositHandler.sendPanel(channel);
                          console.log(`✅ Painel de depósitos enviado em ${channel.name}`);
                      }
                  }

                  // Canais de XP
                  if (channel && channelData.name === '👤╠perfil') {
                      const existePainel = await this.checkExistingPanel(channel, 'PERFIL');
                      if (!existePainel) {
                          const PerfilHandler = require('./perfilHandler');
                          await PerfilHandler.sendPerfilPanel(channel);
                          console.log(`✅ Painel de perfil enviado em ${channel.name}`);
                      }
                  }

                  if (channel && channelData.name === '⭐╠xp-event') {
                      const existePainel = await this.checkExistingPanel(channel, 'EVENTOS DE CONQUISTA');
                      if (!existePainel) {
                          const embed = new EmbedBuilder()
                              .setTitle('⭐ EVENTOS DE CONQUISTA')
                              .setDescription('Aqui aparecerão os eventos de conquista ativos!\n\nUse o botão no canal 👤╠perfil para criar novos eventos.')
                              .setColor(0xFFD700)
                              .setFooter({ text: 'Sistema de XP • NOTAG Bot' });
                          await channel.send({ embeds: [embed] });
                          console.log(`✅ Painel de XP event enviado em ${channel.name}`);
                      }
                  }

                  if (channel && channelData.name === '🔮╠orb-xp') {
                      const existePainel = await this.checkExistingPanel(channel, 'DEPÓSITO DE ORBS');
                      if (!existePainel) {
                          const OrbHandler = require('./orbHandler');
                          await OrbHandler.sendOrbPanel(channel);
                          console.log(`✅ Painel de orb XP enviado em ${channel.name}`);
                      }
                  }

                  if (channel && channelData.name === '📊╠painel-xp') {
                      const existePainel = await this.checkExistingPanel(channel, 'RANKING XP');
                      if (!existePainel) {
                          const embed = new EmbedBuilder()
                              .setTitle('📊 RANKING DE XP')
                              .setDescription('Aqui será exibido o ranking de XP dos membros!\n\nO ranking é atualizado automaticamente.')
                              .setColor(0x3498DB)
                              .setFooter({ text: 'Sistema de XP • NOTAG Bot' });

                          const botao = new ActionRowBuilder()
                              .addComponents(
                                  new ButtonBuilder()
                                      .setCustomId('btn_atualizar_ranking_xp')
                                      .setLabel('🔄 Atualizar Ranking')
                                      .setStyle(ButtonStyle.Primary)
                              );

                          await channel.send({ embeds: [embed], components: [botao] });
                          console.log(`✅ Painel de ranking XP enviado em ${channel.name}`);
                      }
                  }

                  // 🛒 NOVO: Painel do Mercado Albion
                  if (channel && channelData.name === '🛒╠mercado-albion') {
                      const existePainel = await this.checkExistingPanel(channel, 'MERCADO ALBION');
                      if (!existePainel) {
                          const MarketHandler = require('./marketHandler');
                          await MarketHandler.sendPanel(channel);
                          console.log(`✅ Painel de mercado enviado em ${channel.name}`);
                      }
                  }
              }

          } catch (error) {
              console.error(`❌ Erro ao criar categoria ${categoryData.name}:`, error);
              this.errors.push(`${categoryData.name}: ${error.message}`);
          }
      }

      return {
          success: true,
          message: `Estrutura instalada com sucesso!\n🆕 ${this.createdChannels.length} canais criados\n📁 ${this.createdCategories.length} categorias criadas\n🎭 ${this.rolesChecked.length} cargos verificados`,
          createdChannels: this.createdChannels,
          createdCategories: this.createdCategories,
          existingChannels: this.existingChannels,
          rolesChecked: this.rolesChecked,
          errors: this.errors
      };
  }

  async update() {
      console.log('🔄 Iniciando atualização da estrutura...');

      await this.setupRoles();

      const structure = this.getServerStructure();

      for (const categoryData of structure) {
          try {
              let category = this.guild.channels.cache.find(
                  c => c.name === categoryData.name && c.type === ChannelType.GuildCategory
              );

              if (!category) {
                  category = await this.guild.channels.create({
                      name: categoryData.name,
                      type: ChannelType.GuildCategory,
                      permissionOverwrites: [
                          {
                              id: this.guild.id,
                              allow: [PermissionFlagsBits.ViewChannel],
                              deny: [PermissionFlagsBits.SendMessages, PermissionFlagsBits.Connect]
                          }
                      ]
                  });
                  this.createdCategories.push(categoryData.name);
                  console.log(`✅ Categoria criada: ${categoryData.name}`);
              }

              for (const channelData of categoryData.channels) {
                  const channel = await this.createChannel(channelData, category);

                  if (channel) {
                      if (channelData.name === '📋╠registrar') {
                          const RegistrationPanel = require('./registrationPanel');
                          const existePainel = await this.checkExistingPanel(channel, 'Bem-vindo');
                          if (!existePainel) {
                              await RegistrationPanel.sendPanel(channel);
                          }
                      }

                      if (channelData.name === '🔧╠configurações') {
                          const existePainel = await this.checkExistingPanel(channel, 'CONFIGURAÇÕES');
                          if (!existePainel) {
                              await this.sendConfigPanel(channel);
                          }
                      }

                      if (channelData.name === '📋╠lista-membros') {
                          const MemberListPanel = require('./memberListPanel');
                          const existePainel = await this.checkExistingPanel(channel, 'LISTA DE MEMBROS');
                          if (!existePainel) {
                              await MemberListPanel.sendPanel(channel, this.guild);
                          } else {
                              await MemberListPanel.updatePanel(existePainel, this.guild);
                          }
                      }

                      if (channelData.name === '➕╠criar-evento') {
                          const EventPanel = require('./eventPanel');
                          const existePainel = await this.checkExistingPanel(channel, 'CENTRAL DE EVENTOS');
                          if (!existePainel) {
                              await EventPanel.sendPanel(channel);
                          }
                      }

                      if (channelData.name === '🔍╠consultar-saldo') {
                          const ConsultarSaldoHandler = require('./consultarSaldoHandler');
                          const existePainel = await this.checkExistingPanel(channel, 'CONSULTAR SALDO');
                          if (!existePainel) {
                              await ConsultarSaldoHandler.sendPanel(channel);
                          }
                      }

                      if (channelData.name === '🏦╠saldo-guilda') {
                          const BalancePanelHandler = require('./balancePanelHandler');
                          const existePainel = await this.checkExistingPanel(channel, 'SALDO DA GUILDA');
                          if (!existePainel) {
                              await BalancePanelHandler.createAndSendPanel(channel, this.guild);
                          }
                      }

                      if (channelData.name === '💰╠venda-de-baú') {
                          const BauSaleHandler = require('./bauSaleHandler');
                          const existePainel = await this.checkExistingPanel(channel, 'VENDA DE BAÚ');
                          if (!existePainel) {
                              await BauSaleHandler.sendPanel(channel);
                          }
                      }

                      if (channelData.name === '📊╠painel-de-eventos') {
                          const EventStatsHandler = require('./eventStatsHandler');
                          const existePainel = await this.checkExistingPanel(channel, 'PAINEL DE EVENTOS');
                          if (!existePainel) {
                              await EventStatsHandler.sendPanel(channel, this.guild);
                          }
                      }

                      // Painel de Depósitos
                      if (channelData.name === '💵╠depósitos') {
                          const DepositHandler = require('./depositHandler');
                          const existePainel = await this.checkExistingPanel(channel, 'SISTEMA DE DEPÓSITOS');
                          if (!existePainel) {
                              await DepositHandler.sendPanel(channel);
                              console.log(`✅ Painel de depósitos enviado em ${channel.name}`);
                          }
                      }

                      // Atualizar/criar painéis de XP
                      if (channelData.name === '👤╠perfil') {
                          const PerfilHandler = require('./perfilHandler');
                          const existePainel = await this.checkExistingPanel(channel, 'PERFIL');
                          if (!existePainel) {
                              await PerfilHandler.sendPerfilPanel(channel);
                          }
                      }

                      if (channelData.name === '🔮╠orb-xp') {
                          const OrbHandler = require('./orbHandler');
                          const existePainel = await this.checkExistingPanel(channel, 'DEPÓSITO DE ORBS');
                          if (!existePainel) {
                              await OrbHandler.sendOrbPanel(channel);
                          }
                      }

                      // 🛒 NOVO: Atualizar painel do mercado
                      if (channelData.name === '🛒╠mercado-albion') {
                          const MarketHandler = require('./marketHandler');
                          const existePainel = await this.checkExistingPanel(channel, 'MERCADO ALBION');
                          if (!existePainel) {
                              await MarketHandler.sendPanel(channel);
                              console.log(`✅ Painel de mercado enviado em ${channel.name}`);
                          }
                      }
                  }
              }

          } catch (error) {
              console.error(`❌ Erro: ${error.message}`);
              this.errors.push(error.message);
          }
      }

      return {
          success: true,
          message: `Atualização concluída!`,
          createdChannels: this.createdChannels,
          createdCategories: this.createdCategories,
          existingChannels: this.existingChannels,
          rolesChecked: this.rolesChecked,
          errors: this.errors
      };
  }

  async checkExistingPanel(channel, tituloContains) {
      try {
          const messages = await channel.messages.fetch({ limit: 50 });
          return messages.find(m =>
              m.author.bot &&
              m.embeds.length > 0 &&
              m.embeds[0].title?.includes(tituloContains)
          );
      } catch (error) {
          return null;
      }
  }

  async sendConfigPanel(channel) {
      try {
          if (!global.guildConfig) global.guildConfig = new Map();
          if (!global.guildConfig.has(this.guild.id)) {
              global.guildConfig.set(this.guild.id, {
                  idioma: 'PT-BR',
                  taxaGuilda: 10,
                  guildaRegistrada: null,
                  xpAtivo: true,
                  taxasBau: {
                      royal: 10,
                      black: 15,
                      brecilien: 12,
                      avalon: 20
                  },
                  taxaEmprestimo: 5
              });
          }

          const config = global.guildConfig.get(this.guild.id);

          const embed = new EmbedBuilder()
              .setTitle('⚙️ **PAINEL DE CONFIGURAÇÕES**')
              .setDescription('Configure as opções do bot para este servidor.\n\n*Apenas membros com cargo **ADM** podem alterar estas configurações.*')
              .setColor(0x3498DB)
              .addFields(
                  {
                      name: '🌐 **Idioma**',
                      value: `\`${config.idioma}\`\n*(Fixo por enquanto)*`,
                      inline: true
                  },
                  {
                      name: '💰 **Taxa da Guilda**',
                      value: `\`${config.taxaGuilda}%\`\nTaxa em eventos`,
                      inline: true
                  },
                  {
                      name: '🏰 **Guilda Registrada**',
                      value: config.guildaRegistrada
                          ? `**${config.guildaRegistrada.nome}**\n🌍 ${config.guildaRegistrada.server}\n✅ Verificada`
                          : '❌ *Nenhuma guilda registrada*',
                      inline: false
                  },
                  {
                      name: '⭐ **Sistema XP**',
                      value: config.xpAtivo ? '✅ Ativado' : '🔴 Desativado',
                      inline: true
                  },
                  {
                      name: '📦 **Taxa Venda Baú**',
                      value: config.taxasBau
                          ? `👑 ${config.taxasBau.royal}% | ⚫ ${config.taxasBau.black}%\n🌲 ${config.taxasBau.brecilien}% | 🔴 ${config.taxasBau.avalon}%`
                          : '🔴 Não configurado',
                      inline: true
                  },
                  {
                      name: '💳 **Taxa Empréstimo**',
                      value: `\`${config.taxaEmprestimo || 5}%\`\n✅ Ativo`,
                      inline: true
                  }
              )
              .setFooter({ text: 'Clique nos botões abaixo para configurar' })
              .setTimestamp();

          const buttons = [
              new ActionRowBuilder().addComponents(
                  new ButtonBuilder()
                      .setCustomId('config_idioma')
                      .setLabel('🌐 Idioma')
                      .setStyle(ButtonStyle.Secondary)
                      .setDisabled(true),
                  new ButtonBuilder()
                      .setCustomId('config_taxa_guilda')
                      .setLabel('💰 Taxa Guilda')
                      .setStyle(ButtonStyle.Primary),
                  new ButtonBuilder()
                      .setCustomId('config_registrar_guilda')
                      .setLabel('🏰 Registrar Guilda')
                      .setStyle(ButtonStyle.Success)
              ),
              new ActionRowBuilder().addComponents(
                  new ButtonBuilder()
                      .setCustomId('config_xp')
                      .setLabel('⭐ Ativar/Desativar XP')
                      .setStyle(ButtonStyle.Secondary),
                  new ButtonBuilder()
                      .setCustomId('config_taxa_bau')
                      .setLabel('📦 Taxas Baú')
                      .setStyle(ButtonStyle.Primary),
                  new ButtonBuilder()
                      .setCustomId('config_taxa_emprestimo')
                      .setLabel('💳 Taxa Empréstimo')
                      .setStyle(ButtonStyle.Primary)
              ),
              new ActionRowBuilder().addComponents(
                  new ButtonBuilder()
                      .setCustomId('config_atualizar_bot')
                      .setLabel('🔄 Atualizar Bot')
                      .setStyle(ButtonStyle.Danger)
                      .setEmoji('🔄')
              )
          ];

          await channel.send({
              embeds: [embed],
              components: buttons
          });

          console.log(`✅ Painel de configurações enviado em ${channel.name}`);
      } catch (error) {
          console.error('❌ Erro ao enviar painel de config:', error);
          this.errors.push(`Painel config: ${error.message}`);
      }
  }

  async createChannel(channelData, category) {
      try {
          const existingChannel = this.guild.channels.cache.find(
              c => c.name === channelData.name && c.parentId === category.id
          );

          if (existingChannel) {
              this.existingChannels.push(channelData.name);
              return existingChannel;
          }

          const permissions = this.getChannelPermissions(channelData.name);

          const channel = await this.guild.channels.create({
              name: channelData.name,
              type: channelData.type,
              parent: category.id,
              permissionOverwrites: permissions
          });

          this.createdChannels.push(channelData.name);
          console.log(`✅ Canal criado: ${channelData.name}`);
          return channel;

      } catch (error) {
          console.error(`❌ Erro ao criar canal ${channelData.name}:`, error);
          this.errors.push(`${channelData.name}: ${error.message}`);
          throw error;
      }
  }

  getChannelPermissions(channelName) {
      const permissions = [];

      permissions.push({
          id: this.guild.id,
          allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.ReadMessageHistory],
          deny: [PermissionFlagsBits.SendMessages]
      });

      const admRole = this.guild.roles.cache.find(r => r.name === 'ADM');
      const staffRole = this.guild.roles.cache.find(r => r.name === 'Staff');
      const tesoureiroRole = this.guild.roles.cache.find(r => r.name === 'tesoureiro');
      const recrutadorRole = this.guild.roles.cache.find(r => r.name === 'Recrutador');
      const membroRole = this.guild.roles.cache.find(r => r.name === 'Membro');

      if (admRole) {
          permissions.push({
              id: admRole.id,
              allow: [
                  PermissionFlagsBits.ViewChannel,
                  PermissionFlagsBits.SendMessages,
                  PermissionFlagsBits.ManageMessages,
                  PermissionFlagsBits.ManageChannels,
                  PermissionFlagsBits.Connect,
                  PermissionFlagsBits.Speak
              ]
          });
      }

      if (staffRole) {
          permissions.push({
              id: staffRole.id,
              allow: [
                  PermissionFlagsBits.ViewChannel,
                  PermissionFlagsBits.SendMessages,
                  PermissionFlagsBits.ManageMessages,
                  PermissionFlagsBits.Connect,
                  PermissionFlagsBits.Speak
              ]
          });
      }

      if (channelName.includes('registrar')) {
          const everyonePerms = permissions.find(p => p.id === this.guild.id);
          if (everyonePerms) {
              everyonePerms.deny = everyonePerms.deny.filter(d => d !== PermissionFlagsBits.SendMessages);
              everyonePerms.allow.push(PermissionFlagsBits.SendMessages);
          }
      }

      if (channelName.includes('criar-evento') || channelName.includes('venda-de-baú') || channelName.includes('mercado-albion')) {
          const everyonePerms = permissions.find(p => p.id === this.guild.id);
          if (everyonePerms) {
              everyonePerms.deny = everyonePerms.deny.filter(d => d !== PermissionFlagsBits.SendMessages);
              everyonePerms.allow.push(PermissionFlagsBits.UseApplicationCommands);
          }
      }

      if (channelName.includes('configurações')) {
          const everyonePerms = permissions.find(p => p.id === this.guild.id);
          if (everyonePerms) {
              everyonePerms.deny = [
                  PermissionFlagsBits.SendMessages,
                  PermissionFlagsBits.Connect,
                  PermissionFlagsBits.AddReactions
              ];
              everyonePerms.allow = [
                  PermissionFlagsBits.ViewChannel,
                  PermissionFlagsBits.ReadMessageHistory
              ];
          }

          if (admRole) {
              permissions.push({
                  id: admRole.id,
                  allow: [
                      PermissionFlagsBits.ViewChannel,
                      PermissionFlagsBits.SendMessages,
                      PermissionFlagsBits.ManageMessages,
                      PermissionFlagsBits.UseApplicationCommands
                  ]
              });
          }
      }

      if (channelName.includes('solicitação-registro')) {
          if (recrutadorRole) {
              permissions.push({
                  id: recrutadorRole.id,
                  allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ManageMessages]
              });
          }
          if (membroRole) {
              permissions.push({
                  id: membroRole.id,
                  allow: [PermissionFlagsBits.ViewChannel],
                  deny: [PermissionFlagsBits.SendMessages]
              });
          }
      }

      if (channelName.includes('financeiro') ||
          channelName.includes('depósitos') ||
          channelName.includes('logs-banco') ||
          channelName.includes('saldo-guilda') ||
          channelName.includes('log-xp')) {
          if (tesoureiroRole) {
              permissions.push({
                  id: tesoureiroRole.id,
                  allow: [
                      PermissionFlagsBits.ViewChannel,
                      PermissionFlagsBits.SendMessages,
                      PermissionFlagsBits.ManageMessages
                  ]
              });
          }
      }

      return permissions;
  }

  async setupRoles() {
      const requiredRoles = this.getRequiredRoles();

      for (const roleName of requiredRoles) {
          try {
              const existingRole = this.guild.roles.cache.find(r => r.name === roleName);
              if (!existingRole) {
                  const newRole = await this.guild.roles.create({
                      name: roleName,
                      color: this.getRoleColor(roleName),
                      permissions: this.getRolePermissions(roleName),
                      reason: 'Setup inicial do bot'
                  });

                  this.rolesChecked.push(`${roleName} (novo)`);
                  console.log(`✅ Cargo criado: ${roleName}`);
              } else {
                  this.rolesChecked.push(`${roleName} (existente)`);
                  console.log(`⚠️ Cargo já existe: ${roleName}`);
              }
          } catch (error) {
              console.error(`❌ Erro ao criar cargo ${roleName}:`, error);
              this.errors.push(`Cargo ${roleName}: ${error.message}`);
          }
      }
  }

  getRoleColor(roleName) {
      const colors = {
          'ADM': 0xE74C3C,
          'Staff': 0x9B59B6,
          'Caller': 0xF1C40F,
          'tesoureiro': 0x2ECC71,
          'Recrutador': 0x3498DB,
          'Membro': 0x1ABC9C,
          'Convidado': 0x95A5A6,
          'Aliança': 0xE67E22
      };
      return colors[roleName] || 0xFFFFFF;
  }

  getRolePermissions(roleName) {
      switch (roleName) {
          case 'ADM':
              return [PermissionFlagsBits.Administrator];
          case 'Staff':
              return [
                  PermissionFlagsBits.KickMembers,
                  PermissionFlagsBits.BanMembers,
                  PermissionFlagsBits.ManageMessages,
                  PermissionFlagsBits.ManageChannels,
                  PermissionFlagsBits.ViewAuditLog
              ];
          case 'tesoureiro':
              return [PermissionFlagsBits.ManageMessages];
          case 'Recrutador':
              return [PermissionFlagsBits.ManageMessages];
          default:
              return [];
      }
  }

  async uninstall() {
      console.log('🗑️ Iniciando desinstalação completa...');

      const structure = this.getServerStructure();
      const channelsToDelete = [];
      const categoriesToDelete = [];

      for (const categoryData of structure) {
          const category = this.guild.channels.cache.find(
              c => c.name === categoryData.name && c.type === ChannelType.GuildCategory
          );
          if (category) {
              categoriesToDelete.push(category);

              for (const channelData of categoryData.channels) {
                  const channel = this.guild.channels.cache.find(
                      c => c.name === channelData.name && c.parentId === category.id
                  );
                  if (channel) {
                      channelsToDelete.push(channel);
                  }
              }
          }
      }

      for (const channel of channelsToDelete) {
          try {
              await channel.delete('Desinstalação do bot');
              this.deletedChannels.push(channel.name);
              console.log(`🗑️ Canal deletado: ${channel.name}`);
          } catch (error) {
              console.error(`❌ Erro ao deletar canal ${channel.name}:`, error);
              this.errors.push(`Canal ${channel.name}: ${error.message}`);
          }
      }

      for (const category of categoriesToDelete) {
          try {
              await category.delete('Desinstalação do bot');
              this.deletedCategories.push(category.name);
              console.log(`🗑️ Categoria deletada: ${category.name}`);
          } catch (error) {
              console.error(`❌ Erro ao deletar categoria ${category.name}:`, error);
              this.errors.push(`Categoria ${category.name}: ${error.message}`);
          }
      }

      const rolesToDelete = this.getRequiredRoles();

      for (const roleName of rolesToDelete) {
          try {
              const role = this.guild.roles.cache.find(r => r.name === roleName);

              if (role) {
                  if (role.id === this.guild.id) {
                      console.log(`⏭️ Pulando cargo @everyone`);
                      continue;
                  }

                  await role.delete('Desinstalação do bot');
                  this.deletedRoles.push(roleName);
                  console.log(`🗑️ Cargo deletado: ${roleName}`);
              } else {
                  console.log(`⚠️ Cargo não encontrado: ${roleName}`);
              }
          } catch (error) {
              console.error(`❌ Erro ao deletar cargo ${roleName}:`, error);
              this.errors.push(`Cargo ${roleName}: ${error.message}`);
          }
      }

      return {
          success: this.errors.length === 0,
          message: `Desinstalação concluída!\n🗑️ ${this.deletedChannels.length} canais removidos\n📁 ${this.deletedCategories.length} categorias removidas\n🎭 ${this.deletedRoles.length} cargos removidos`,
          deletedChannels: this.deletedChannels,
          deletedCategories: this.deletedCategories,
          deletedRoles: this.deletedRoles,
          errors: this.errors
      };
  }

  /**
   * Sincroniza o servidor com a estrutura atual do bot
   * Cria canais/cargos faltantes, atualiza painéis, destrava botões
   * @returns {Object} Resultado da sincronização
   */
  async syncServer() {
      console.log('🔄 Iniciando sincronização completa do servidor...');

      const resultado = {
          canaisCriados: [],
          cargosCriados: [],
          paineisAtualizados: [],
          comandosRegistrados: false,
          botoesDestravados: [],
          erros: []
      };

      try {
          // 1. SINCRONIZAR CARGOS
          console.log('📋 Verificando cargos...');
          const requiredRoles = this.getRequiredRoles();

          for (const roleName of requiredRoles) {
              try {
                  const existingRole = this.guild.roles.cache.find(r => r.name === roleName);
                  if (!existingRole) {
                      const newRole = await this.guild.roles.create({
                          name: roleName,
                          color: this.getRoleColor(roleName),
                          permissions: this.getRolePermissions(roleName),
                          reason: 'Sincronização via Atualizar Bot'
                      });
                      resultado.cargosCriados.push(roleName);
                      console.log(`✅ Cargo criado: ${roleName}`);
                  }
              } catch (error) {
                  console.error(`❌ Erro ao criar cargo ${roleName}:`, error);
                  resultado.erros.push(`Cargo ${roleName}: ${error.message}`);
              }
          }

          // 2. SINCRONIZAR ESTRUTURA DE CANAIS
          console.log('🏗️ Verificando estrutura de canais...');
          const structure = this.getServerStructure();

          for (const categoryData of structure) {
              try {
                  // Verifica/cria categoria
                  let category = this.guild.channels.cache.find(
                      c => c.name === categoryData.name && c.type === ChannelType.GuildCategory
                  );

                  if (!category) {
                      category = await this.guild.channels.create({
                          name: categoryData.name,
                          type: ChannelType.GuildCategory,
                          permissionOverwrites: [
                              {
                                  id: this.guild.id,
                                  allow: [PermissionFlagsBits.ViewChannel],
                                  deny: [PermissionFlagsBits.SendMessages, PermissionFlagsBits.Connect]
                              }
                          ]
                      });
                      resultado.canaisCriados.push(`📁 ${categoryData.name}`);
                      console.log(`✅ Categoria criada: ${categoryData.name}`);
                  }

                  // Verifica/cria canais dentro da categoria
                  for (const channelData of categoryData.channels) {
                      try {
                          const existingChannel = this.guild.channels.cache.find(
                              c => c.name === channelData.name && c.parentId === category.id
                          );

                          if (!existingChannel) {
                              const permissions = this.getChannelPermissions(channelData.name);
                              const channel = await this.guild.channels.create({
                                  name: channelData.name,
                                  type: channelData.type,
                                  parent: category.id,
                                  permissionOverwrites: permissions
                              });
                              resultado.canaisCriados.push(` └─ #${channelData.name}`);
                              console.log(`✅ Canal criado: ${channelData.name}`);

                              // Envia painel para o novo canal
                              await this.sendPanelToChannel(channel, channelData.name);
                          } else {
                              // Canal existe, verifica se precisa atualizar painel
                              await this.updatePanelInChannel(existingChannel, channelData.name);
                          }
                      } catch (channelError) {
                          console.error(`❌ Erro ao processar canal ${channelData.name}:`, channelError);
                          resultado.erros.push(`Canal ${channelData.name}: ${channelError.message}`);
                      }
                  }
              } catch (categoryError) {
                  console.error(`❌ Erro ao processar categoria ${categoryData.name}:`, categoryError);
                  resultado.erros.push(`Categoria ${categoryData.name}: ${categoryError.message}`);
              }
          }

          // 3. ATUALIZAR PAINEIS EXISTENTES (Força recriação)
          console.log('🎨 Atualizando painéis existentes...');

          // Mapeamento de canais para handlers de painel
          const panelMap = [
              { name: '📋╠registrar', handler: 'registrationPanel', method: 'sendPanel' },
              { name: '🔧╠configurações', handler: 'setupManager', method: 'sendConfigPanel', self: true },
              { name: '📋╠lista-membros', handler: 'memberListPanel', method: 'sendPanel', args: [this.guild] },
              { name: '➕╠criar-evento', handler: 'eventPanel', method: 'sendPanel' },
              { name: '🔍╠consultar-saldo', handler: 'consultarSaldoHandler', method: 'sendPanel' },
              { name: '🏦╠saldo-guilda', handler: 'balancePanelHandler', method: 'createAndSendPanel', args: [this.guild] },
              { name: '💰╠venda-de-baú', handler: 'bauSaleHandler', method: 'sendPanel' },
              { name: '📊╠painel-de-eventos', handler: 'eventStatsHandler', method: 'sendPanel', args: [this.guild] },
              { name: '👤╠perfil', handler: 'perfilHandler', method: 'sendPerfilPanel' },
              { name: '🔮╠orb-xp', handler: 'orbHandler', method: 'sendOrbPanel' },
              { name: '💵╠depósitos', handler: 'depositHandler', method: 'sendPanel' },
              // 🛒 NOVO: Adicionar painel do mercado na sincronização
              { name: '🛒╠mercado-albion', handler: 'marketHandler', method: 'sendPanel' }
          ];

          for (const panel of panelMap) {
              try {
                  const channel = this.guild.channels.cache.find(c => c.name === panel.name);
                  if (!channel) continue;

                  // Deleta mensagens antigas do bot (paineis antigos)
                  const messages = await channel.messages.fetch({ limit: 50 });
                  const botMessages = messages.filter(m => m.author.bot && m.embeds.length > 0);

                  for (const [msgId, msg] of botMessages) {
                      try {
                          await msg.delete();
                          console.log(`🗑️ Painel antigo deletado em #${panel.name}`);
                      } catch (e) {
                          console.log(`⚠️ Não foi possível deletar mensagem em #${panel.name}`);
                      }
                  }

                  // Envia novo painel
                  if (panel.self) {
                      await this.sendConfigPanel(channel);
                  } else {
                      const Handler = require(`./${panel.handler}`);
                      if (panel.args) {
                          await Handler[panel.method](channel, ...panel.args);
                      } else {
                          await Handler[panel.method](channel);
                      }
                  }

                  resultado.paineisAtualizados.push(panel.name);
                  console.log(`✅ Painel atualizado: ${panel.name}`);

              } catch (panelError) {
                  console.error(`❌ Erro ao atualizar painel ${panel.name}:`, panelError);
                  resultado.erros.push(`Painel ${panel.name}: ${panelError.message}`);
              }
          }

          // 4. REGISTRAR COMANDOS SLASH (via REST API)
          console.log('⚡ Sincronizando comandos slash...');
          try {
              const { REST, Routes } = require('discord.js');
              const fs = require('fs');
              const path = require('path');

              const commands = [];
              const commandsPath = path.join(__dirname, '..', 'commands');
              const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));

              for (const file of commandFiles) {
                  const command = require(path.join(commandsPath, file));
                  if (command.data) {
                      commands.push(command.data.toJSON());
                  }
              }

              const rest = new REST({ version: '10' }).setToken(process.env.TOKEN);
              await rest.put(
                  Routes.applicationCommands(this.guild.client.user.id),
                  { body: commands }
              );

              resultado.comandosRegistrados = true;
              console.log(`✅ ${commands.length} comandos slash registrados`);
          } catch (cmdError) {
              console.error('❌ Erro ao registrar comandos:', cmdError);
              resultado.erros.push(`Comandos: ${cmdError.message}`);
          }

          // 5. DESTRAVAR BOTÕES (Edita mensagens com componentes desabilitados)
          console.log('🔓 Verificando botões travados...');
          try {
              // Percorre todos os canais de texto procurando mensagens com botões travados
              const textChannels = this.guild.channels.cache.filter(c => c.isTextBased());

              for (const [channelId, channel] of textChannels) {
                  try {
                      const messages = await channel.messages.fetch({ limit: 100 });

                      for (const [msgId, message] of messages) {
                          if (message.author.id !== this.guild.client.user.id) continue;
                          if (!message.components || message.components.length === 0) continue;

                          // Verifica se há botões desabilitados
                          let needsUpdate = false;
                          const newComponents = [];

                          for (const row of message.components) {
                              const newRow = ActionRowBuilder.from(row);
                              let rowChanged = false;

                              for (const component of row.components) {
                                  if (component.disabled) {
                                      component.setDisabled(false);
                                      needsUpdate = true;
                                      rowChanged = true;
                                  }
                              }

                              if (rowChanged) {
                                  newComponents.push(newRow);
                              } else {
                                  newComponents.push(row);
                              }
                          }

                          if (needsUpdate) {
                              await message.edit({ components: newComponents });
                              resultado.botoesDestravados.push(`#${channel.name}`);
                              console.log(`🔓 Botões destravados em #${channel.name}`);
                          }
                      }
                  } catch (channelError) {
                      // Ignora erros de permissão
                  }
              }
          } catch (unlockError) {
              console.error('❌ Erro ao destravar botões:', unlockError);
              resultado.erros.push(`Destravar botões: ${unlockError.message}`);
          }

          console.log('✅ Sincronização concluída!');
          return resultado;

      } catch (error) {
          console.error('❌ Erro fatal na sincronização:', error);
          resultado.erros.push(`Fatal: ${error.message}`);
          return resultado;
      }
  }

  /**
   * Envia painel para um canal específico (auxiliar)
   */
  async sendPanelToChannel(channel, channelName) {
      try {
          if (channelName === '📋╠registrar') {
              const RegistrationPanel = require('./registrationPanel');
              await RegistrationPanel.sendPanel(channel);
          } else if (channelName === '🔧╠configurações') {
              await this.sendConfigPanel(channel);
          } else if (channelName === '📋╠lista-membros') {
              const MemberListPanel = require('./memberListPanel');
              await MemberListPanel.sendPanel(channel, this.guild);
          } else if (channelName === '➕╠criar-evento') {
              const EventPanel = require('./eventPanel');
              await EventPanel.sendPanel(channel);
          } else if (channelName === '🔍╠consultar-saldo') {
              const ConsultarSaldoHandler = require('./consultarSaldoHandler');
              await ConsultarSaldoHandler.sendPanel(channel);
          } else if (channelName === '🏦╠saldo-guilda') {
              const BalancePanelHandler = require('./balancePanelHandler');
              await BalancePanelHandler.createAndSendPanel(channel, this.guild);
          } else if (channelName === '💰╠venda-de-baú') {
              const BauSaleHandler = require('./bauSaleHandler');
              await BauSaleHandler.sendPanel(channel);
          } else if (channelName === '📊╠painel-de-eventos') {
              const EventStatsHandler = require('./eventStatsHandler');
              await EventStatsHandler.sendPanel(channel, this.guild);
          } else if (channelName === '👤╠perfil') {
              const PerfilHandler = require('./perfilHandler');
              await PerfilHandler.sendPerfilPanel(channel);
          } else if (channelName === '🔮╠orb-xp') {
              const OrbHandler = require('./orbHandler');
              await OrbHandler.sendOrbPanel(channel);
          } else if (channelName === '💵╠depósitos') {
              const DepositHandler = require('./depositHandler');
              await DepositHandler.sendPanel(channel);
          } else if (channelName === '🛒╠mercado-albion') {
              // 🛒 NOVO: Handler para painel de mercado
              const MarketHandler = require('./marketHandler');
              await MarketHandler.sendPanel(channel);
          }
      } catch (error) {
          console.error(`[SetupManager] Erro ao enviar painel para ${channelName}:`, error);
      }
  }

  /**
   * Atualiza painel em canal existente (auxiliar)
   */
  async updatePanelInChannel(channel, channelName) {
      try {
          // Verifica se já existe painel do bot
          const messages = await channel.messages.fetch({ limit: 10 });
          const hasPanel = messages.some(m =>
              m.author.bot &&
              m.embeds.length > 0 &&
              !m.content.includes('❌') // Não conta mensagens de erro
          );

          if (!hasPanel) {
              console.log(`⚠️ Canal ${channelName} existe mas sem painel. Criando...`);
              await this.sendPanelToChannel(channel, channelName);
          }
      } catch (error) {
          console.error(`[SetupManager] Erro ao verificar painel em ${channelName}:`, error);
      }
  }
}

module.exports = SetupManager;