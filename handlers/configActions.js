const {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  PermissionFlagsBits,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  ChannelType
} = require('discord.js');
const Database = require('../utils/database');

class ConfigActions {
  /**
   * Verifica se o usuário tem permissão de ADM
   */
  static async checkADM(interaction) {
    const isADM = interaction.member.roles.cache.some(r => r.name === 'ADM') ||
      interaction.member.permissions.has(PermissionFlagsBits.Administrator);

    if (!isADM) {
      await interaction.reply({
        content: '❌ Apenas ADMs podem alterar as configurações!',
        ephemeral: true
      });
      return false;
    }
    return true;
  }

  static async initialize() {
    console.log('[ConfigActions] Initialized');
  }

  // ✅ NOVO: Função para atualizar o painel de configurações no canal
  static async updateConfigPanel(guild) {
    try {
      // Buscar o canal de configurações
      const canalConfig = guild.channels.cache.find(
        c => c.name === '🔧╠configurações' && c.type === ChannelType.GuildText
      );

      if (!canalConfig) {
        console.log('[ConfigActions] Canal de configurações não encontrado');
        return;
      }

      // Buscar configurações atualizadas
      const config = global.guildConfig.get(guild.id) || {
        idioma: 'PT-BR',
        taxaGuilda: 10,
        guildaRegistrada: null,
        xpAtivo: true,
        taxasBau: { royal: 10, black: 15, brecilien: 12, avalon: 20 },
        taxaEmprestimo: 5
      };

      // Buscar mensagem do painel existente
      const messages = await canalConfig.messages.fetch({ limit: 50 });
      const painelConfig = messages.find(m =>
        m.author.bot &&
        m.embeds.length > 0 &&
        m.embeds[0].title?.includes('CONFIGURAÇÕES')
      );

      if (!painelConfig) {
        console.log('[ConfigActions] Painel de configurações não encontrado');
        return;
      }

      // Criar novo embed com valores atualizados
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
        .setFooter({ text: 'Clique nos botões abaixo para configurar • Valores atualizados automaticamente' })
        .setTimestamp();

      // Botões
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

      // Atualizar a mensagem
      await painelConfig.edit({
        embeds: [embed],
        components: buttons
      });

      console.log('[ConfigActions] Painel de configurações atualizado com sucesso');
    } catch (error) {
      console.error('[ConfigActions] Erro ao atualizar painel de configurações:', error);
    }
  }

  // Handler para taxa da guilda
  static async handleTaxaGuilda(interaction) {
    try {
      if (!(await this.checkADM(interaction))) return;

      const modal = new ModalBuilder()
        .setCustomId('modal_taxa_guilda')
        .setTitle('💰 Configurar Taxa da Guilda');

      const taxaInput = new TextInputBuilder()
        .setCustomId('valor_taxa')
        .setLabel('Nova taxa da guilda (%)')
        .setPlaceholder('Ex: 10')
        .setStyle(TextInputStyle.Short)
        .setRequired(true)
        .setMaxLength(3);

      modal.addComponents(new ActionRowBuilder().addComponents(taxaInput));
      await interaction.showModal(modal);

    } catch (error) {
      console.error(`[ConfigActions] Error handling taxa guilda:`, error);
      await interaction.reply({
        content: '❌ Erro ao abrir configuração de taxa.',
        ephemeral: true
      });
    }
  }

  static async handleTaxaSelect(interaction) {
    try {
      if (!(await this.checkADM(interaction))) return;

      const novaTaxa = parseInt(interaction.fields.getTextInputValue('valor_taxa'));

      if (isNaN(novaTaxa) || novaTaxa < 0 || novaTaxa > 100) {
        return interaction.reply({
          content: '❌ Taxa inválida! Digite um valor entre 0 e 100.',
          ephemeral: true
        });
      }

      // Salvar no banco de dados
      await Database.updateGuildConfig(interaction.guild.id, {
        taxaGuilda: novaTaxa
      });

      // Atualizar também no cache global (para compatibilidade)
      if (!global.guildConfig.has(interaction.guild.id)) {
        global.guildConfig.set(interaction.guild.id, {});
      }
      const config = global.guildConfig.get(interaction.guild.id);
      config.taxaGuilda = novaTaxa;
      global.guildConfig.set(interaction.guild.id, config);

      await interaction.reply({
        content: `✅ Taxa da guilda atualizada para \`${novaTaxa}%\`!`,
        ephemeral: true
      });

      // ✅ ATUALIZAR O PAINEL NO CANAL
      await this.updateConfigPanel(interaction.guild);

      console.log(`[ConfigActions] Taxa guilda updated to ${novaTaxa}% for guild ${interaction.guild.id}`);

    } catch (error) {
      console.error(`[ConfigActions] Error updating taxa:`, error);
      await interaction.reply({
        content: '❌ Erro ao atualizar taxa.',
        ephemeral: true
      });
    }
  }

  // Handler para taxa de baú
  static async handleTaxaBau(interaction) {
    try {
      if (!(await this.checkADM(interaction))) return;

      // Buscar do banco de dados
      const dbConfig = await Database.getGuildConfig(interaction.guild.id);
      const taxas = dbConfig.taxasBau || {
        royal: 10,
        black: 15,
        brecilien: 12,
        avalon: 20
      };

      const modal = new ModalBuilder()
        .setCustomId('modal_taxas_bau')
        .setTitle('📦 Configurar Taxas de Baú');

      const royalInput = new TextInputBuilder()
        .setCustomId('taxa_royal')
        .setLabel('Taxa Royal (%)')
        .setPlaceholder(`Atual: ${taxas.royal}%`)
        .setStyle(TextInputStyle.Short)
        .setRequired(true)
        .setMaxLength(3);

      const blackInput = new TextInputBuilder()
        .setCustomId('taxa_black')
        .setLabel('Taxa Black (%)')
        .setPlaceholder(`Atual: ${taxas.black}%`)
        .setStyle(TextInputStyle.Short)
        .setRequired(true)
        .setMaxLength(3);

      const brecilienInput = new TextInputBuilder()
        .setCustomId('taxa_brecilien')
        .setLabel('Taxa Brecilien (%)')
        .setPlaceholder(`Atual: ${taxas.brecilien}%`)
        .setStyle(TextInputStyle.Short)
        .setRequired(true)
        .setMaxLength(3);

      const avalonInput = new TextInputBuilder()
        .setCustomId('taxa_avalon')
        .setLabel('Taxa Avalon (%)')
        .setPlaceholder(`Atual: ${taxas.avalon}%`)
        .setStyle(TextInputStyle.Short)
        .setRequired(true)
        .setMaxLength(3);

      modal.addComponents(
        new ActionRowBuilder().addComponents(royalInput),
        new ActionRowBuilder().addComponents(blackInput),
        new ActionRowBuilder().addComponents(brecilienInput),
        new ActionRowBuilder().addComponents(avalonInput)
      );

      await interaction.showModal(modal);

    } catch (error) {
      console.error(`[ConfigActions] Error handling taxa bau:`, error);
      await interaction.reply({
        content: '❌ Erro ao abrir configuração de taxas de baú.',
        ephemeral: true
      });
    }
  }

  static async processTaxaBau(interaction) {
    try {
      if (!(await this.checkADM(interaction))) return;

      const royal = parseInt(interaction.fields.getTextInputValue('taxa_royal'));
      const black = parseInt(interaction.fields.getTextInputValue('taxa_black'));
      const brecilien = parseInt(interaction.fields.getTextInputValue('taxa_brecilien'));
      const avalon = parseInt(interaction.fields.getTextInputValue('taxa_avalon'));

      if ([royal, black, brecilien, avalon].some(t => isNaN(t) || t < 0 || t > 100)) {
        return interaction.reply({
          content: '❌ Todas as taxas devem ser números entre 0 e 100!',
          ephemeral: true
        });
      }

      const taxasBau = { royal, black, brecilien, avalon };

      // Salvar no banco de dados
      await Database.updateGuildConfig(interaction.guild.id, { taxasBau });

      // Atualizar cache global
      if (!global.guildConfig.has(interaction.guild.id)) {
        global.guildConfig.set(interaction.guild.id, {});
      }
      const config = global.guildConfig.get(interaction.guild.id);
      config.taxasBau = taxasBau;
      global.guildConfig.set(interaction.guild.id, config);

      const embed = new EmbedBuilder()
        .setTitle('✅ TAXAS DE BAÚ ATUALIZADAS')
        .setDescription(
          `**Royal:** \`${royal}%\`\n` +
          `**Black:** \`${black}%\`\n` +
          `**Brecilien:** \`${brecilien}%\`\n` +
          `**Avalon:** \`${avalon}%\``
        )
        .setColor(0x2ECC71)
        .setTimestamp();

      await interaction.reply({
        embeds: [embed],
        ephemeral: true
      });

      // ✅ ATUALIZAR O PAINEL NO CANAL
      await this.updateConfigPanel(interaction.guild);

      console.log(`[ConfigActions] Bau taxes updated for guild ${interaction.guild.id}`);

    } catch (error) {
      console.error(`[ConfigActions] Error processing taxa bau:`, error);
      await interaction.reply({
        content: '❌ Erro ao atualizar taxas de baú.',
        ephemeral: true
      });
    }
  }

  // Handler para taxa de empréstimo
  static async handleTaxaEmprestimo(interaction) {
    try {
      if (!(await this.checkADM(interaction))) return;

      // Buscar do banco de dados
      const dbConfig = await Database.getGuildConfig(interaction.guild.id);
      const taxaAtual = dbConfig.taxaEmprestimo || 5;

      const modal = new ModalBuilder()
        .setCustomId('modal_taxa_emprestimo')
        .setTitle('💳 Configurar Taxa de Empréstimo');

      const taxaInput = new TextInputBuilder()
        .setCustomId('valor_taxa_emprestimo')
        .setLabel('Taxa de juros do empréstimo (%)')
        .setPlaceholder(`Atual: ${taxaAtual}%`)
        .setStyle(TextInputStyle.Short)
        .setRequired(true)
        .setMaxLength(3);

      modal.addComponents(new ActionRowBuilder().addComponents(taxaInput));
      await interaction.showModal(modal);

    } catch (error) {
      console.error(`[ConfigActions] Error handling taxa emprestimo:`, error);
      await interaction.reply({
        content: '❌ Erro ao abrir configuração de taxa de empréstimo.',
        ephemeral: true
      });
    }
  }

  static async processTaxaEmprestimo(interaction) {
    try {
      if (!(await this.checkADM(interaction))) return;

      const taxa = parseInt(interaction.fields.getTextInputValue('valor_taxa_emprestimo'));

      if (isNaN(taxa) || taxa < 0 || taxa > 100) {
        return interaction.reply({
          content: '❌ Taxa inválida! Digite um valor entre 0 e 100.',
          ephemeral: true
        });
      }

      // Salvar no banco de dados
      await Database.updateGuildConfig(interaction.guild.id, { taxaEmprestimo: taxa });

      // Atualizar cache global
      if (!global.guildConfig.has(interaction.guild.id)) {
        global.guildConfig.set(interaction.guild.id, {});
      }
      const config = global.guildConfig.get(interaction.guild.id);
      config.taxaEmprestimo = taxa;
      global.guildConfig.set(interaction.guild.id, config);

      await interaction.reply({
        content: `✅ Taxa de empréstimo atualizada para \`${taxa}%\`!`,
        ephemeral: true
      });

      // ✅ ATUALIZAR O PAINEL NO CANAL
      await this.updateConfigPanel(interaction.guild);

      console.log(`[ConfigActions] Loan tax updated to ${taxa}% for guild ${interaction.guild.id}`);

    } catch (error) {
      console.error(`[ConfigActions] Error processing taxa emprestimo:`, error);
      await interaction.reply({
        content: '❌ Erro ao atualizar taxa de empréstimo.',
        ephemeral: true
      });
    }
  }

  // ==================== REGISTRO DE GUILDA - NOVO FLUXO ====================

  static async handleRegistrarGuilda(interaction) {
    try {
      if (!(await this.checkADM(interaction))) return;

      // Buscar config atual do banco para preencher placeholder
      const dbConfig = await Database.getGuildConfig(interaction.guild.id);
      const guildaAtual = dbConfig.guildaRegistrada;

      // Modal apenas com o nome da guilda
      const modal = new ModalBuilder()
        .setCustomId('modal_registrar_guilda_nome')
        .setTitle('🏰 Registrar Guilda - Passo 1/2');

      const nomeInput = new TextInputBuilder()
        .setCustomId('nome_guilda')
        .setLabel('Nome da Guilda (exatamente como no Albion)')
        .setPlaceholder(guildaAtual?.nome || 'Ex: NOTAG')
        .setStyle(TextInputStyle.Short)
        .setRequired(true)
        .setMaxLength(50);

      modal.addComponents(new ActionRowBuilder().addComponents(nomeInput));

      await interaction.showModal(modal);

    } catch (error) {
      console.error(`[ConfigActions] Error handling registrar guilda:`, error);
      await interaction.reply({
        content: '❌ Erro ao abrir registro de guilda.',
        ephemeral: true
      });
    }
  }

  /**
   * Processa o nome da guilda e mostra seleção de servidor
   */
  static async processGuildaNome(interaction) {
    try {
      if (!(await this.checkADM(interaction))) return;

      const nome = interaction.fields.getTextInputValue('nome_guilda').trim();

      if (!nome) {
        return interaction.reply({
          content: '❌ O nome da guilda é obrigatório!',
          ephemeral: true
        });
      }

      // Armazenar nome temporariamente
      if (!global.guildaRegistroTemp) global.guildaRegistroTemp = new Map();
      global.guildaRegistroTemp.set(interaction.user.id, { nome });

      // Criar menu de seleção de servidor
      const embed = new EmbedBuilder()
        .setTitle('🌍 Selecione o Servidor')
        .setDescription(
          `**Guilda:** \`${nome}\`\n\n` +
          `Selecione o servidor onde a guilda está registrada no Albion Online:`
        )
        .setColor(0x3498DB)
        .setTimestamp();

      const selectMenu = new StringSelectMenuBuilder()
        .setCustomId('select_server_guilda')
        .setPlaceholder('🌎 Escolha o servidor...')
        .addOptions([
          new StringSelectMenuOptionBuilder()
            .setLabel('Americas')
            .setValue('americas')
            .setDescription('Servidor das Américas (US East, US West, Brasil)')
            .setEmoji('🌎'),
          new StringSelectMenuOptionBuilder()
            .setLabel('Europe')
            .setValue('europe')
            .setDescription('Servidor Europeu')
            .setEmoji('🇪🇺'),
          new StringSelectMenuOptionBuilder()
            .setLabel('Asia')
            .setValue('asia')
            .setDescription('Servidor Asiático')
            .setEmoji('🌏')
        ]);

      const row = new ActionRowBuilder().addComponents(selectMenu);

      await interaction.reply({
        embeds: [embed],
        components: [row],
        ephemeral: true
      });

    } catch (error) {
      console.error(`[ConfigActions] Error processing guilda nome:`, error);
      await interaction.reply({
        content: '❌ Erro ao processar nome da guilda.',
        ephemeral: true
      });
    }
  }

  /**
   * Processa a seleção do servidor e verifica na API
   */
  static async processGuildaServerSelect(interaction) {
    try {
      if (!(await this.checkADM(interaction))) return;

      const server = interaction.values[0];
      const tempData = global.guildaRegistroTemp?.get(interaction.user.id);

      if (!tempData || !tempData.nome) {
        return interaction.reply({
          content: '❌ Dados do registro não encontrados. Comece novamente.',
          ephemeral: true
        });
      }

      const nome = tempData.nome;

      await interaction.deferReply({ ephemeral: true });

      // Verificar se a guilda existe na API
      console.log(`[ConfigActions] Verificando guilda "${nome}" no servidor ${server}...`);

      const guildInfo = await this.searchGuildInAPI(nome, server);

      if (!guildInfo.found) {
        // Limpar temp
        global.guildaRegistroTemp?.delete(interaction.user.id);

        return interaction.editReply({
          content: `❌ **Guilda não encontrada!**\n\n` +
            `Não foi possível encontrar a guilda "**${nome}**" no servidor **${server}**.\n\n` +
            `**Verifique:**\n` +
            `• O nome da guilda está escrito corretamente (exatamente como no jogo)\n` +
            `• O servidor está correto\n` +
            `• A guilda existe e é pública no Albion\n\n` +
            `Clique em "Registrar Guilda" novamente para tentar com outro nome.`,
        });
      }

      // Se encontrou, mostrar confirmação
      const guildNameToSave = guildInfo.exactName || nome;

      const embed = new EmbedBuilder()
        .setTitle('✅ Confirmar Registro')
        .setDescription(
          `**Guilda encontrada na API do Albion!**\n\n` +
          `**Nome:** \`${guildNameToSave}\`\n` +
          `**Servidor:** \`${server}\`\n` +
          `**ID Albion:** \`${guildInfo.guildId || 'N/A'}\`\n\n` +
          `Deseja confirmar o registro desta guilda?`
        )
        .setColor(0x2ECC71)
        .setTimestamp();

      const botoes = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`confirmar_guilda_${server}_${guildNameToSave.replace(/\s+/g, '_')}`)
          .setLabel('✅ Confirmar')
          .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
          .setCustomId('cancelar_guilda_registro')
          .setLabel('❌ Cancelar')
          .setStyle(ButtonStyle.Danger)
      );

      // Atualizar temp com dados completos
      tempData.server = server;
      tempData.exactName = guildNameToSave;
      tempData.guildId = guildInfo.guildId;
      global.guildaRegistroTemp.set(interaction.user.id, tempData);

      await interaction.editReply({
        embeds: [embed],
        components: [botoes]
      });

    } catch (error) {
      console.error(`[ConfigActions] Error processing server select:`, error);
      await interaction.editReply({
        content: '❌ Erro ao processar seleção de servidor.'
      });
    }
  }

  /**
   * Confirma o registro da guilda
   */
  static async confirmarGuildaRegistro(interaction, server, nomeGuilda) {
    try {
      if (!(await this.checkADM(interaction))) return;

      const tempData = global.guildaRegistroTemp?.get(interaction.user.id);

      if (!tempData) {
        return interaction.reply({
          content: '❌ Dados do registro expirados. Comece novamente.',
          ephemeral: true
        });
      }

      const nome = nomeGuilda.replace(/_/g, ' ');

      const guildaData = {
        nome: nome,
        server: server,
        dataRegistro: Date.now(),
        albionGuildId: tempData.guildId || null,
        verified: true
      };

      // Salvar no banco de dados
      await Database.updateGuildConfig(interaction.guild.id, {
        guildaRegistrada: guildaData
      });

      // Atualizar cache global
      if (!global.guildConfig.has(interaction.guild.id)) {
        global.guildConfig.set(interaction.guild.id, {});
      }
      const config = global.guildConfig.get(interaction.guild.id);
      config.guildaRegistrada = guildaData;
      global.guildConfig.set(interaction.guild.id, config);

      // Limpar temp
      global.guildaRegistroTemp?.delete(interaction.user.id);

      const embed = new EmbedBuilder()
        .setTitle('✅ GUILDA REGISTRADA COM SUCESSO')
        .setDescription(
          `**Nome:** ${nome}\n` +
          `**Servidor:** ${server}\n` +
          `**ID Albion:** ${tempData.guildId || 'N/A'}\n` +
          `**Registrado em:** ${new Date().toLocaleDateString('pt-BR')}\n\n` +
          `✅ A guilda foi verificada na API do Albion e salva no banco de dados!`
        )
        .setColor(0x2ECC71)
        .setTimestamp();

      await interaction.update({
        embeds: [embed],
        components: []
      });

      // ✅ ATUALIZAR O PAINEL NO CANAL
      await this.updateConfigPanel(interaction.guild);

      console.log(`[ConfigActions] Guild registered: ${nome} on ${server}`);

    } catch (error) {
      console.error(`[ConfigActions] Error confirming guild registration:`, error);
      await interaction.reply({
        content: '❌ Erro ao confirmar registro da guilda.',
        ephemeral: true
      });
    }
  }

  /**
   * Cancela o registro da guilda
   */
  static async cancelarGuildaRegistro(interaction) {
    try {
      global.guildaRegistroTemp?.delete(interaction.user.id);

      await interaction.update({
        content: '❌ Registro cancelado.',
        embeds: [],
        components: []
      });

    } catch (error) {
      console.error(`[ConfigActions] Error canceling guild registration:`, error);
    }
  }

  /**
   * Busca uma guilda na API do Albion Online
   */
  static async searchGuildInAPI(guildName, server) {
    try {
      const https = require('https');

      const baseUrl = 'gameinfo.albiononline.com';
      const encodedName = encodeURIComponent(guildName);

      console.log(`[AlbionAPI] Searching guild: "${guildName}" on ${server}`);

      return new Promise((resolve) => {
        const options = {
          hostname: baseUrl,
          path: `/api/gameinfo/search?q=${encodedName}`,
          method: 'GET',
          headers: {
            'Accept': 'application/json',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
          },
          timeout: 10000
        };

        const req = https.request(options, (res) => {
          let data = '';

          res.on('data', (chunk) => {
            data += chunk;
          });

          res.on('end', () => {
            try {
              if (!data || data.trim() === '') {
                console.log('[AlbionAPI] Empty response');
                resolve({ found: false });
                return;
              }

              const jsonData = JSON.parse(data);
              const guilds = jsonData.guilds || [];

              console.log(`[AlbionAPI] Found ${guilds.length} guilds`);

              if (guilds.length === 0) {
                resolve({ found: false });
                return;
              }

              // Buscar match exato (case insensitive)
              const exactMatch = guilds.find(g =>
                g.Name && g.Name.toLowerCase() === guildName.toLowerCase()
              );

              if (exactMatch) {
                console.log(`[AlbionAPI] Exact match found: ${exactMatch.Name}`);
                resolve({
                  found: true,
                  exactName: exactMatch.Name,
                  guildId: exactMatch.Id
                });
                return;
              }

              // Se não achou exato, verifica similaridade
              const similarMatch = guilds.find(g =>
                g.Name && (
                  g.Name.toLowerCase().includes(guildName.toLowerCase()) ||
                  guildName.toLowerCase().includes(g.Name.toLowerCase())
                )
              );

              if (similarMatch) {
                console.log(`[AlbionAPI] Similar match found: ${similarMatch.Name}`);
                resolve({
                  found: true,
                  exactName: similarMatch.Name,
                  guildId: similarMatch.Id
                });
                return;
              }

              // Retorna o primeiro resultado
              console.log(`[AlbionAPI] Using first result: ${guilds[0].Name}`);
              resolve({
                found: true,
                exactName: guilds[0].Name,
                guildId: guilds[0].Id
              });

            } catch (error) {
              console.error('[AlbionAPI] Error parsing response:', error);
              resolve({ found: false });
            }
          });
        });

        req.on('error', (error) => {
          console.error('[AlbionAPI] Request error:', error);
          resolve({ found: false });
        });

        req.on('timeout', () => {
          console.error('[AlbionAPI] Request timeout');
          req.destroy();
          resolve({ found: false });
        });

        req.end();
      });

    } catch (error) {
      console.error('[ConfigActions] Error in searchGuildInAPI:', error);
      return { found: false };
    }
  }

  static async handleXP(interaction) {
    try {
      if (!(await this.checkADM(interaction))) return;

      // Buscar do banco de dados
      const dbConfig = await Database.getGuildConfig(interaction.guild.id);
      const novoStatus = !dbConfig.xpAtivo;

      // Salvar no banco
      await Database.updateGuildConfig(interaction.guild.id, {
        xpAtivo: novoStatus
      });

      // Atualizar cache global
      if (!global.guildConfig.has(interaction.guild.id)) {
        global.guildConfig.set(interaction.guild.id, {});
      }
      const config = global.guildConfig.get(interaction.guild.id);
      config.xpAtivo = novoStatus;
      global.guildConfig.set(interaction.guild.id, config);

      const status = novoStatus ? '✅ ATIVADO' : '🔴 DESATIVADO';

      await interaction.reply({
        content: `Sistema XP ${status}!`,
        ephemeral: true
      });

      // ✅ ATUALIZAR O PAINEL NO CANAL
      await this.updateConfigPanel(interaction.guild);

    } catch (error) {
      console.error(`[ConfigActions] Error handling XP:`, error);
      await interaction.reply({
        content: '❌ Erro ao alterar configuração de XP.',
        ephemeral: true
      });
    }
  }

  static async handleAtualizarBot(interaction) {
    try {
      if (!(await this.checkADM(interaction))) return;

      const SetupManager = require('./setupManager');
      const setup = new SetupManager(interaction.guild, interaction);

      await interaction.deferReply({ ephemeral: true });

      const result = await setup.syncServer();

      const embed = new EmbedBuilder()
        .setTitle('🔄 SINCRONIZAÇÃO CONCLUÍDA')
        .setDescription(
          `✅ **Canais criados:** ${result.canaisCriados.length}\n` +
          `✅ **Cargos criados:** ${result.cargosCriados.length}\n` +
          `✅ **Painéis atualizados:** ${result.paineisAtualizados.length}\n` +
          `✅ **Comandos registrados:** ${result.comandosRegistrados ? 'Sim' : 'Não'}\n` +
          `✅ **Botões destravados:** ${result.botoesDestravados.length} canais\n\n` +
          `O painel de configurações foi atualizado automaticamente!`
        )
        .setColor(0x2ECC71)
        .setTimestamp();

      await interaction.editReply({
        embeds: [embed]
      });

    } catch (error) {
      console.error(`[ConfigActions] Error updating bot:`, error);
      await interaction.reply({
        content: '❌ Erro ao atualizar bot.',
        ephemeral: true
      });
    }
  }
}

module.exports = ConfigActions;