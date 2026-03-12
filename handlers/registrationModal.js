const {
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  EmbedBuilder,
  ButtonBuilder,
  ButtonStyle
} = require('discord.js');
const AlbionAPI = require('./albionApi');

class RegistrationModal {
  static createRegistrationModal() {
    const modal = new ModalBuilder()
      .setCustomId('modal_registro')
      .setTitle('📝 Registro de Novo Membro');

    const nickInput = new TextInputBuilder()
      .setCustomId('reg_nick')
      .setLabel('🎮 Seu Nick no Albion Online')
      .setPlaceholder('Ex: TTV_SeuNome')
      .setStyle(TextInputStyle.Short)
      .setRequired(true)
      .setMaxLength(32)
      .setMinLength(2);

    const guildaInput = new TextInputBuilder()
      .setCustomId('reg_guilda')
      .setLabel('🏰 Guilda Atual (ou "Nenhuma")')
      .setPlaceholder('Ex: MinhaGuilda ou Nenhuma')
      .setStyle(TextInputStyle.Short)
      .setRequired(true)
      .setMaxLength(50);

    const armaInput = new TextInputBuilder()
      .setCustomId('reg_arma')
      .setLabel('⚔️ Arma Principal / Spec')
      .setPlaceholder('Ex: Arco 700/700, Frost 600/700...')
      .setStyle(TextInputStyle.Paragraph)
      .setRequired(true)
      .setMaxLength(200);

    const convidadoPorInput = new TextInputBuilder()
      .setCustomId('reg_convidado_por')
      .setLabel('👥 Quem te convidou? (Opcional)')
      .setPlaceholder('Ex: @usuario ou Nick do jogador')
      .setStyle(TextInputStyle.Short)
      .setRequired(false)
      .setMaxLength(50);

    const row1 = new ActionRowBuilder().addComponents(nickInput);
    const row2 = new ActionRowBuilder().addComponents(guildaInput);
    const row3 = new ActionRowBuilder().addComponents(armaInput);
    const row4 = new ActionRowBuilder().addComponents(convidadoPorInput);

    modal.addComponents(row1, row2, row3, row4);
    return modal;
  }

  static createServerSelectMenu() {
    const select = new StringSelectMenuBuilder()
      .setCustomId('select_server_registro')
      .setPlaceholder('🌍 Selecione seu servidor')
      .addOptions(
        new StringSelectMenuOptionBuilder()
          .setLabel('Américas')
          .setDescription('Servidor Americas (US)')
          .setValue('americas')
          .setEmoji('🌎'),
        new StringSelectMenuOptionBuilder()
          .setLabel('Europa')
          .setDescription('Servidor Europe (EU)')
          .setValue('europe')
          .setEmoji('🌍'),
        new StringSelectMenuOptionBuilder()
          .setLabel('Ásia')
          .setDescription('Servidor Asia')
          .setValue('asia')
          .setEmoji('🌏')
      );

    return new ActionRowBuilder().addComponents(select);
  }

  static createPlatformSelectMenu() {
    const select = new StringSelectMenuBuilder()
      .setCustomId('select_platform_registro')
      .setPlaceholder('💻 Selecione sua plataforma')
      .addOptions(
        new StringSelectMenuOptionBuilder()
          .setLabel('PC (Steam/Cliente)')
          .setDescription('Joga no computador')
          .setValue('PC')
          .setEmoji('💻'),
        new StringSelectMenuOptionBuilder()
          .setLabel('Mobile')
          .setDescription('Joga no celular/tablet')
          .setValue('Mobile')
          .setEmoji('📱'),
        new StringSelectMenuOptionBuilder()
          .setLabel('PC e Mobile')
          .setDescription('Joga em ambas as plataformas')
          .setValue('PC e Mobile')
          .setEmoji('🖥️')
      );

    return new ActionRowBuilder().addComponents(select);
  }

  static async processRegistration(interaction, client) {
    try {
      await interaction.deferReply({ ephemeral: true });

      const nick = interaction.fields.getTextInputValue('reg_nick').trim();
      const guilda = interaction.fields.getTextInputValue('reg_guilda').trim();
      const arma = interaction.fields.getTextInputValue('reg_arma').trim();
      const convidadoPor = interaction.fields.getTextInputValue('reg_convidado_por')?.trim() || null;

      const RegistrationActions = require('./registrationActions');
      const blacklistCheck = RegistrationActions.checkBlacklist(nick, interaction.user.id);
      if (blacklistCheck.isBlacklisted) {
        return await interaction.editReply({
          content: `🚫 **Você está na blacklist!**\n\nMotivo: ${blacklistCheck.reason}\n\nEntre em contato com a staff se acredita que houve um erro.`,
          components: []
        });
      }

      // Verificar se existe registro pendente deste usuário
      if (!global.registrosPendentes) global.registrosPendentes = new Map();

      const registroExistente = Array.from(global.registrosPendentes.entries()).find(
        ([id, reg]) => reg.userId === interaction.user.id
      );

      if (registroExistente) {
        return await interaction.editReply({
          content: '❌ Você já tem um registro pendente! Aguarde a análise da staff.'
        });
      }

      if (!global.registroTemp) global.registroTemp = new Map();

      global.registroTemp.set(interaction.user.id, {
        nick,
        guilda,
        arma,
        convidadoPor,
        etapa: 'selecionar_servidor'
      });

      const embed = new EmbedBuilder()
        .setTitle('🌍 Selecione seu Servidor')
        .setDescription('Por favor, selecione o servidor onde você joga Albion Online:')
        .setColor(0x3498DB)
        .setFooter({ text: 'Etapa 1/2 • Dados do Registro' });

      await interaction.editReply({
        embeds: [embed],
        components: [this.createServerSelectMenu()]
      });

    } catch (error) {
      console.error('Erro ao processar modal:', error);
      await interaction.editReply({
        content: '❌ Erro ao processar registro. Tente novamente.'
      });
    }
  }

  static async processServerSelect(interaction) {
    try {
      await interaction.deferUpdate();

      const server = interaction.values[0];
      const tempData = global.registroTemp?.get(interaction.user.id);

      if (!tempData) {
        return await interaction.editReply({
          content: '❌ Sessão expirada. Por favor, inicie o registro novamente.',
          components: [],
          embeds: []
        });
      }

      tempData.server = server;
      tempData.etapa = 'selecionar_plataforma';
      global.registroTemp.set(interaction.user.id, tempData);

      const serverNames = {
        'americas': '🌎 Américas',
        'europe': '🌍 Europa',
        'asia': '🌏 Ásia'
      };

      const embed = new EmbedBuilder()
        .setTitle('💻 Selecione sua Plataforma')
        .setDescription(`Servidor selecionado: ${serverNames[server]}\n\nAgora selecione em qual plataforma você joga:`)
        .setColor(0x3498DB)
        .setFooter({ text: 'Etapa 2/2 • Dados do Registro' });

      await interaction.editReply({
        embeds: [embed],
        components: [this.createPlatformSelectMenu()]
      });

    } catch (error) {
      console.error('Erro em processServerSelect:', error);
    }
  }

  static async processPlatformSelect(interaction, client) {
    try {
      await interaction.deferUpdate();

      const platform = interaction.values[0];
      const tempData = global.registroTemp?.get(interaction.user.id);

      if (!tempData) {
        return await interaction.editReply({
          content: '❌ Sessão expirada. Por favor, inicie o registro novamente.',
          components: [],
          embeds: []
        });
      }

      await interaction.editReply({
        content: '⏳ Consultando API do Albion Online...\nIsso pode levar alguns segundos...',
        components: [],
        embeds: []
      });

      tempData.platform = platform;
      const { nick, guilda, arma, server, convidadoPor } = tempData;

      // 🎯 NOVA LÓGICA: Verificação com tratamento de erro aprimorado
      let verification = { valid: false, error: null, details: null, apiStatus: null };
      let usarRegistroOffline = false;
      let apiError = false;

      try {
        verification = await AlbionAPI.verifyPlayerGuild(nick, guilda, server);

        // Se API retornar indisponível, usar modo offline
        if (verification.apiStatus === 'API_UNAVAILABLE' || verification.apiStatus === 'ERROR') {
          usarRegistroOffline = true;
          apiError = true;
          console.log('⚠️ API indisponível ou erro, usando modo offline para registro');
        }

      } catch (apiErr) {
        console.error('❌ Erro na API:', apiErr);
        usarRegistroOffline = true;
        apiError = true;
        verification.error = 'API indisponível ou timeout';
        verification.apiStatus = 'ERROR';
      }

      // Determinar se está validado (apenas se não for erro de API)
      const apiVerified = verification.valid && !usarRegistroOffline;

      if (!apiVerified && !usarRegistroOffline) {
        // API funcionou mas jogador não foi validado (nick errado, guilda errada, etc)
        console.log(`⚠️ API não validou jogador "${nick}": ${verification.error}`);

        // Ainda assim permitimos o registro, mas marcamos como não verificado
        // Se quiser BLOQUEAR registros não validados, descomente o código abaixo:
        /*
        return await interaction.editReply({
          content: `❌ **Validação falhou:** ${verification.error}\n\nVerifique se o nick e a guilda estão corretos e tente novamente.`,
          components: [],
          embeds: []
        });
        */
      }

      const RegistrationActions = require('./registrationActions');
      const historico = RegistrationActions.getHistoricoRecusas(interaction.user.id, nick);
      const tentativasAnteriores = historico.length;

      const registroId = `reg_${Date.now()}_${interaction.user.id}`;

      // Estrutura dos dados compatível com registrationActions
      const registroData = {
        id: registroId,
        userId: interaction.user.id,
        userTag: interaction.user.tag,
        dados: {
          nick: nick,
          nickDoJogo: nick,
          guilda: guilda,
          server: server,
          platform: platform,
          arma: arma,
          convidadoPor: convidadoPor
        },
        albionData: verification.details || null,
        apiVerified: apiVerified,
        apiError: apiError,
        apiStatus: verification.apiStatus,
        status: 'pendente',
        tentativasAnteriores: tentativasAnteriores,
        historicoRecusas: historico,
        timestamp: Date.now()
      };

      if (!global.registrosPendentes) global.registrosPendentes = new Map();

      // Usar registroId como chave para compatibilidade com botões
      global.registrosPendentes.set(registroId, registroData);

      global.registroTemp.delete(interaction.user.id);

      await this.sendToApprovalChannel(interaction, registroData, client);

      // Mensagem de sucesso diferenciada baseada no status da API
      let mensagemSucesso;
      if (apiVerified) {
        mensagemSucesso = '✅ Registro validado pela API e enviado para análise!';
      } else if (usarRegistroOffline) {
        mensagemSucesso = '⚠️ Registro enviado para análise!\n\n_Note: API do Albion temporariamente indisponível. A staff irá verificar manualmente._';
      } else {
        mensagemSucesso = '⚠️ Registro enviado para análise!\n\n_Note: Não foi possível verificar automaticamente na API do Albion. A staff irá analisar manualmente._';
      }

      if (tentativasAnteriores > 0) {
        mensagemSucesso += `\n\n⚠️ **Atenção:** Esta é sua tentativa **#${tentativasAnteriores + 1}** de registro.`;
      }

      const successEmbed = new EmbedBuilder()
        .setTitle(apiVerified ? '✅ Registro Enviado!' : '⚠️ Registro Enviado (Verificação Manual)')
        .setDescription(mensagemSucesso)
        .addFields(
          { name: '🎮 Nick', value: nick, inline: true },
          { name: '🏰 Guilda', value: guilda || 'Nenhuma', inline: true },
          { name: '🌍 Servidor', value: server, inline: true },
          { name: '💻 Plataforma', value: platform, inline: true },
          { name: '⚔️ Arma/Spec', value: arma, inline: false }
        )
        .setColor(apiVerified ? 0x2ECC71 : 0xF39C12)
        .setFooter({ text: 'Você receberá uma DM quando for analisado' });

      if (convidadoPor) {
        successEmbed.addFields({
          name: '👥 Convidado por',
          value: convidadoPor,
          inline: false
        });
      }

      await interaction.editReply({
        content: null,
        embeds: [successEmbed],
        components: []
      });

    } catch (error) {
      console.error('Erro em processPlatformSelect:', error);
      await interaction.editReply({
        content: '❌ Erro ao processar registro. Tente novamente.',
        components: []
      });
    }
  }

  static async sendToApprovalChannel(interaction, registroData, client) {
    try {
      const guild = interaction.guild;
      const canalSolicitacao = guild.channels.cache.find(
        c => c.name === '📨╠solicitação-registro'
      );

      if (!canalSolicitacao) {
        throw new Error('Canal de solicitação de registro não encontrado!');
      }

      const serverEmoji = {
        'americas': '🌎',
        'europe': '🌍',
        'asia': '🌏'
      };

      const dados = registroData.dados;

      // Definir cor e status baseado na verificação
      let embedColor = 0x2ECC71; // Verde (validado)
      let footerText = `ID: ${registroData.id} | ✅ Verificado via API`;
      let apiField = {
        name: '✅ Validação API',
        value: `Jogador encontrado!\nGuilda atual: ${registroData.albionData?.guildName || 'Sem guilda'}`,
        inline: false
      };

      if (registroData.apiError) {
        embedColor = 0xE74C3C; // Vermelho (erro API)
        footerText = `ID: ${registroData.id} | 🔴 API Indisponível`;
        apiField = {
          name: '🔴 ATENÇÃO - API INDISPONÍVEL',
          value: 'Não foi possível conectar à API do Albion. Verifique manualmente se o jogador existe antes de aprovar!',
          inline: false
        };
      } else if (!registroData.apiVerified) {
        embedColor = 0xF39C12; // Laranja (não verificado)
        footerText = `ID: ${registroData.id} | ⚠️ NÃO verificado na API`;
        apiField = {
          name: '⚠️ ATENÇÃO',
          value: 'Este nick não foi encontrado na API do Albion Online.\nVerifique manualmente se o jogador existe antes de aprovar!',
          inline: false
        };
      }

      const embed = new EmbedBuilder()
        .setTitle('📝 Nova Solicitação de Registro')
        .setDescription(`Registro de ${interaction.user}`)
        .setColor(embedColor)
        .setThumbnail(interaction.user.displayAvatarURL({ dynamic: true }))
        .addFields(
          { name: '👤 Usuário Discord', value: `${interaction.user} (\`${interaction.user.id}\`)`, inline: false },
          { name: '🎮 Nick no Albion', value: `\`${dados.nick}\``, inline: true },
          { name: '🏰 Guilda Informada', value: dados.guilda || 'Nenhuma', inline: true },
          { name: '🌍 Servidor', value: `${serverEmoji[dados.server]} ${dados.server.toUpperCase()}`, inline: true },
          { name: '💻 Plataforma', value: dados.platform, inline: true },
          { name: '⚔️ Arma/Spec', value: dados.arma, inline: false },
          apiField
        )
        .setFooter({ text: footerText })
        .setTimestamp();

      if (dados.convidadoPor) {
        embed.addFields({
          name: '👥 Convidado por',
          value: dados.convidadoPor,
          inline: true
        });
      }

      if (registroData.tentativasAnteriores > 0) {
        const ultimasRecusas = registroData.historicoRecusas.slice(-3).map((h, i) =>
          `${i + 1}. ${h.motivo} (${new Date(h.data).toLocaleDateString()})`
        ).join('\n');

        embed.addFields({
          name: `📜 Histórico de Recusas (${registroData.tentativasAnteriores} tentativa(s))`,
          value: ultimasRecusas || 'Ver histórico completo',
          inline: false
        });

        // Se tem muitas tentativas, destacar em vermelho
        if (registroData.tentativasAnteriores >= 2) {
          embed.setColor(0xE74C3C);
        }
      }

      const row1 = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`aprovar_membro_${registroData.id}`)
          .setLabel('✅ Membro')
          .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
          .setCustomId(`aprovar_alianca_${registroData.id}`)
          .setLabel('🤝 Aliança')
          .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
          .setCustomId(`aprovar_convidado_${registroData.id}`)
          .setLabel('👋 Convidado')
          .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
          .setCustomId(`recusar_registro_${registroData.id}`)
          .setLabel('❌ Recusar')
          .setStyle(ButtonStyle.Danger)
      );

      const row2 = new ActionRowBuilder();
      if (registroData.tentativasAnteriores >= 2) {
        row2.addComponents(
          new ButtonBuilder()
            .setCustomId(`blacklist_add_${registroData.id}`)
            .setLabel('🚫 Blacklist (Banir Nick)')
            .setStyle(ButtonStyle.Danger)
        );
      }

      const components = [row1];
      if (row2.components.length > 0) components.push(row2);

      const recrutadorRole = guild.roles.cache.find(r => r.name === 'Recrutador');
      const admRole = guild.roles.cache.find(r => r.name === 'ADM');

      const recrutadorMention = recrutadorRole ? `<@&${recrutadorRole.id}>` : '@Recrutador';
      const admMention = admRole ? `<@&${admRole.id}>` : '@ADM';

      const msg = await canalSolicitacao.send({
        content: `📢 ${recrutadorMention} ${admMention} Nova solicitação de registro!`,
        embeds: [embed],
        components: components
      });

      registroData.messageId = msg.id;
      registroData.channelId = msg.channel.id;

      // Atualizar o registro no Map com os dados da mensagem
      global.registrosPendentes.set(registroData.id, registroData);

    } catch (error) {
      console.error('Erro ao enviar para canal de aprovação:', error);
      throw error;
    }
  }
}

module.exports = RegistrationModal;