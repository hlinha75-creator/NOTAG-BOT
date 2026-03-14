const {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  PermissionFlagsBits,
  ChannelType
} = require('discord.js');

/**
 * Handler para Raid Avalon - Sistema de Classes e Armas
 */
class RaidAvalonHandler {
  constructor() {
    // Configuração das classes e armas disponíveis
    this.classes = {
      tank: {
        nome: 'Tank',
        emoji: '🛡️',
        cor: 0x3498DB,
        armas: ['Martelo', 'Incubus']
      },
      dps: {
        nome: 'DPS',
        emoji: '⚔️',
        cor: 0xE74C3C,
        armas: ['Fura-bruma', 'Fulgurante', 'Aguia', 'Quebra-reinos']
      },
      healer: {
        nome: 'Healer',
        emoji: '💚',
        cor: 0x2ECC71,
        armas: ['Queda-santa', 'Crosta']
      },
      suporte: {
        nome: 'Suporte',
        emoji: '✨',
        cor: 0x9B59B6,
        armas: ['Chama-sombra', 'Para-tempo']
      },
      scout: {
        nome: 'Scout',
        emoji: '👁️',
        cor: 0xF39C12,
        armas: ['Para-tempo']
      }
    };
  }

  /**
   * Cria o modal de configuração de classes (após o modal inicial)
   */
  static async showClassConfigModal(interaction, raidData) {
    try {
      // Armazenar dados temporários
      if (!global.raidTemp) global.raidTemp = new Map();
      global.raidTemp.set(interaction.user.id, raidData);

      // Criar embed de configuração
      const embed = new EmbedBuilder()
        .setTitle('🏰 Configurar Classes - Raid Avalon')
        .setDescription(
          `\*\*${raidData.nome}\*\*\n\n` +
          `Configure os limites de participantes por classe:\n` +
          `• Deixe em branco ou 0 para não ter limite\n` +
          `• O limite total é: ${raidData.limiteTotal || 'Sem limite'}\n\n` +
          `Clique nos botões abaixo para configurar cada classe:`
        )
        .setColor(0x9B59B6)
        .setTimestamp();

      // Botões para configurar cada classe
      const rows = [];

      // Primeira linha de classes
      const row1 = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('raid_config_tank')
          .setLabel('🛡️ Configurar Tank')
          .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
          .setCustomId('raid_config_dps')
          .setLabel('⚔️ Configurar DPS')
          .setStyle(ButtonStyle.Danger),
        new ButtonBuilder()
          .setCustomId('raid_config_healer')
          .setLabel('💚 Configurar Healer')
          .setStyle(ButtonStyle.Success)
      );
      rows.push(row1);

      // Segunda linha de classes
      const row2 = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('raid_config_suporte')
          .setLabel('✨ Configurar Suporte')
          .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
          .setCustomId('raid_config_scout')
          .setLabel('👁️ Configurar Scout')
          .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
          .setCustomId('raid_config_finalizar')
          .setLabel('✅ Criar Raid')
          .setStyle(ButtonStyle.Success)
      );
      rows.push(row2);

      // Mostrar configurações atuais
      const configEmbed = await this.createConfigPreviewEmbed(raidData);

      await interaction.reply({
        embeds: [embed, configEmbed],
        components: rows,
        ephemeral: true
      });

    } catch (error) {
      console.error('[RaidAvalon] Error showing class config:', error);
      await interaction.reply({
        content: '❌ Erro ao abrir configuração de classes.',
        ephemeral: true
      });
    }
  }

  /**
   * Cria embed com preview das configurações atuais
   */
  static async createConfigPreviewEmbed(raidData) {
    const embed = new EmbedBuilder()
      .setTitle('📋 Configurações Atuais')
      .setColor(0x95A5A6);

    let description = '';
    const classes = {
      tank: { nome: '🛡️ Tank', limite: raidData.classes?.tank?.limite || 0 },
      dps: { nome: '⚔️ DPS', limite: raidData.classes?.dps?.limite || 0 },
      healer: { nome: '💚 Healer', limite: raidData.classes?.healer?.limite || 0 },
      suporte: { nome: '✨ Suporte', limite: raidData.classes?.suporte?.limite || 0 },
      scout: { nome: '👁️ Scout', limite: raidData.classes?.scout?.limite || 0 }
    };

    for (const [key, data] of Object.entries(classes)) {
      const limiteText = data.limite > 0 ? `${data.limite} vagas` : 'Ilimitado';
      description += `${data.nome}: ${limiteText}\n`;
    }

    description += `\n👥 \*\*Limite Total:\*\* ${raidData.limiteTotal || 'Sem limite'}`;

    embed.setDescription(description);
    return embed;
  }

  /**
   * Mostra modal para configurar limite de uma classe específica
   */
  static async showClassLimitModal(interaction, classKey) {
    try {
      const classNames = {
        tank: 'Tank',
        dps: 'DPS',
        healer: 'Healer',
        suporte: 'Suporte',
        scout: 'Scout'
      };

      const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require('discord.js');

      const modal = new ModalBuilder()
        .setCustomId(`raid_limit_${classKey}`)
        .setTitle(`Configurar ${classNames[classKey]}`);

      const limiteInput = new TextInputBuilder()
        .setCustomId('limite_classe')
        .setLabel('Limite de participantes (0 = ilimitado)')
        .setPlaceholder('Ex: 5')
        .setStyle(TextInputStyle.Short)
        .setRequired(false)
        .setMaxLength(2);

      modal.addComponents(new ActionRowBuilder().addComponents(limiteInput));

      await interaction.showModal(modal);

    } catch (error) {
      console.error('[RaidAvalon] Error showing class limit modal:', error);
      await interaction.reply({
        content: '❌ Erro ao abrir configuração.',
        ephemeral: true
      });
    }
  }

  /**
   * Processa o limite de uma classe
   */
  static async processClassLimit(interaction, classKey) {
    try {
      const limite = parseInt(interaction.fields.getTextInputValue('limite_classe')) || 0;

      const raidData = global.raidTemp?.get(interaction.user.id);
      if (!raidData) {
        return interaction.reply({
          content: '❌ Dados da raid não encontrados. Comece novamente.',
          ephemeral: true
        });
      }

      if (!raidData.classes) raidData.classes = {};
      raidData.classes[classKey] = {
        limite: limite,
        participantes: []
      };

      global.raidTemp.set(interaction.user.id, raidData);

      // Atualizar mensagem com novas configurações
      const configEmbed = await this.createConfigPreviewEmbed(raidData);

      await interaction.update({
        embeds: [interaction.message.embeds[0], configEmbed],
        components: interaction.message.components
      });

    } catch (error) {
      console.error('[RaidAvalon] Error processing class limit:', error);
      await interaction.reply({
        content: '❌ Erro ao salvar configuração.',
        ephemeral: true
      });
    }
  }

  /**
   * Cria a raid final
   */
  static async createRaid(interaction) {
    try {
      const raidData = global.raidTemp?.get(interaction.user.id);
      if (!raidData) {
        return interaction.reply({
          content: '❌ Dados da raid não encontrados.',
          ephemeral: true
        });
      }

      await interaction.deferReply({ ephemeral: true });

      const guild = interaction.guild;
      const eventId = `raid_${Date.now()}_${interaction.user.id}`;

      // Criar canal de voz
      const categoriaAtivos = guild.channels.cache.find(
        c => c.name === '⚔️ EVENTOS ATIVOS' && c.type === ChannelType.GuildCategory
      );

      const canalParticipar = guild.channels.cache.find(
        c => c.name === '👋╠participar'
      );

      if (!categoriaAtivos || !canalParticipar) {
        return interaction.editReply({
          content: '❌ Estrutura de canais não encontrada! Use /instalar primeiro.'
        });
      }

      const canalVoz = await guild.channels.create({
        name: `🏰-${raidData.nome.substring(0, 20)}`,
        type: ChannelType.GuildVoice,
        parent: categoriaAtivos.id,
        permissionOverwrites: [
          {
            id: guild.id,
            allow: [PermissionFlagsBits.ViewChannel],
            deny: [PermissionFlagsBits.Connect, PermissionFlagsBits.Speak]
          }
        ]
      });

      // Permitir para criador e staff
      const cargosPermitidos = ['ADM', 'Staff'];
      for (const nomeCargo of cargosPermitidos) {
        const cargo = guild.roles.cache.find(r => r.name === nomeCargo);
        if (cargo) {
          await canalVoz.permissionOverwrites.create(cargo.id, {
            Connect: true,
            Speak: true,
            ViewChannel: true
          });
        }
      }

      await canalVoz.permissionOverwrites.create(interaction.user.id, {
        Connect: true,
        Speak: true,
        ViewChannel: true
      });

      // Completar dados da raid
      raidData.id = eventId;
      raidData.guildId = guild.id;
      raidData.criadorId = interaction.user.id;
      raidData.criadorTag = interaction.user.tag;
      raidData.canalVozId = canalVoz.id;
      raidData.canalTextoId = canalParticipar.id;
      raidData.status = 'aguardando';
      raidData.messageId = null;
      raidData.tipo = 'raid_avalon';

      // Inicializar classes se não configuradas
      if (!raidData.classes) {
        raidData.classes = {
          tank: { limite: 0, participantes: [] },
          dps: { limite: 0, participantes: [] },
          healer: { limite: 0, participantes: [] },
          suporte: { limite: 0, participantes: [] },
          scout: { limite: 0, participantes: [] }
        };
      }

      // Garantir que todas as classes tenham estrutura
      for (const key of ['tank', 'dps', 'healer', 'suporte', 'scout']) {
        if (!raidData.classes[key]) {
          raidData.classes[key] = { limite: 0, participantes: [] };
        }
      }

      // Criar embed e botões
      const embed = this.createRaidEmbed(raidData);
      const botoes = this.createRaidButtons(raidData);

      const msg = await canalParticipar.send({
        content: `🏰 <@&${guild.roles.cache.find(r => r.name === 'Membro')?.id}> Nova Raid Avalon criada!`,
        embeds: [embed],
        components: botoes
      });

      raidData.messageId = msg.id;

      if (!global.activeRaids) global.activeRaids = new Map();
      global.activeRaids.set(eventId, raidData);

      // Adicionar também em activeEvents para compatibilidade com lootsplit
      global.activeEvents.set(eventId, {
        ...raidData,
        participantes: this.getAllParticipantsMap(raidData)
      });

      // Limpar temp
      global.raidTemp.delete(interaction.user.id);

      await interaction.editReply({
        content: `✅ \*\*Raid Avalon criada com sucesso!\*\*\n\n🏰 \*\*${raidData.nome}\*\*\n🕐 ${raidData.horario}\n🔊 Canal: <#${canalVoz.id}>`
      });

      console.log(`🏰 Raid Avalon criada: ${raidData.nome} por ${interaction.user.tag}`);

    } catch (error) {
      console.error('[RaidAvalon] Error creating raid:', error);
      await interaction.editReply({
        content: '❌ Erro ao criar raid. Verifique as permissões do bot.'
      });
    }
  }

  /**
   * Converte participantes de todas as classes para um Map único (compatibilidade)
   */
  static getAllParticipantsMap(raidData) {
    const map = new Map();
    for (const classe of Object.values(raidData.classes || {})) {
      for (const participante of classe.participantes || []) {
        map.set(participante.userId, {
          nick: participante.nick,
          userId: participante.userId,
          tempoInicio: null,
          tempoTotal: 0,
          pausado: false,
          classe: participante.classe,
          arma: participante.arma
        });
      }
    }
    return map;
  }

  /**
   * Cria embed da raid
   */
  static createRaidEmbed(raidData) {
    const statusEmojis = {
      'aguardando': '⏳',
      'em_andamento': '🔴',
      'encerrado': '✅'
    };

    let classesText = '';
    const classEmojis = {
      tank: '🛡️',
      dps: '⚔️',
      healer: '💚',
      suporte: '✨',
      scout: '👁️'
    };

    for (const [key, data] of Object.entries(raidData.classes || {})) {
      const total = data.participantes?.length || 0;
      const limite = data.limite > 0 ? `/${data.limite}` : '';
      classesText += `${classEmojis[key]} \*\*${key.toUpperCase()}\*\*: ${total}${limite}\n`;

      if (data.participantes && data.participantes.length > 0) {
        data.participantes.forEach(p => {
          classesText += ` └ ${p.arma} - ${p.nick}\n`;
        });
      }
      classesText += '\n';
    }

    const embed = new EmbedBuilder()
      .setTitle(`${statusEmojis[raidData.status] || '⏳'} 🏰 RAID AVALON ┃ ${raidData.nome}`)
      .setDescription(
        `\\> ${raidData.descricao}\n\n` +
        `\*\*👤 Criador:\*\* <@${raidData.criadorId}>\n` +
        `\*\*🕐 Horário:\*\* \\`${raidData.horario}\\`\n` +
        `\*\*📊 Status:\*\* ${raidData.status === 'aguardando' ? 'Aguardando' : 'Em Andamento'}\n` +
        `\*\*🔊 Canal:\*\* <#${raidData.canalVozId}>\n` +
        `\*\*👥 Total:\*\* ${this.getTotalParticipants(raidData)}/${raidData.limiteTotal || '∞'}`
      )
      .setColor(0x9B59B6)
      .addFields({
        name: '📋 Classes e Participantes',
        value: classesText || 'Nenhum participante ainda',
        inline: false
      })
      .setFooter({
        text: `ID: ${raidData.id} • Selecione sua classe abaixo`,
        iconURL: 'https://i.imgur.com/5K9Q5ZK.png'
      })
      .setTimestamp();

    return embed;
  }

  /**
   * Cria botões da raid
   */
  static createRaidButtons(raidData) {
    const rows = [];

    // Menu de seleção de classe (apenas se não estiver em_andamento)
    if (raidData.status === 'aguardando') {
      const selectMenu = new StringSelectMenuBuilder()
        .setCustomId(`raid_select_class_${raidData.id}`)
        .setPlaceholder('🎮 Selecione sua classe...')
        .addOptions([
          new StringSelectMenuOptionBuilder()
            .setLabel('Tank')
            .setValue('tank')
            .setDescription('Defesa e agro')
            .setEmoji('🛡️'),
          new StringSelectMenuOptionBuilder()
            .setLabel('DPS')
            .setValue('dps')
            .setDescription('Dano em área/single target')
            .setEmoji('⚔️'),
          new StringSelectMenuOptionBuilder()
            .setLabel('Healer')
            .setValue('healer')
            .setDescription('Cura e suporte')
            .setEmoji('💚'),
          new StringSelectMenuOptionBuilder()
            .setLabel('Suporte')
            .setValue('suporte')
            .setDescription('Buffs e controle')
            .setEmoji('✨'),
          new StringSelectMenuOptionBuilder()
            .setLabel('Scout')
            .setValue('scout')
            .setDescription('Reconhecimento')
            .setEmoji('👁️')
        ]);

      rows.push(new ActionRowBuilder().addComponents(selectMenu));
    }

    // Botões de controle (apenas criador/staff)
    const controleRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`raid_iniciar_${raidData.id}`)
        .setLabel('▶️ Iniciar')
        .setStyle(ButtonStyle.Success)
        .setDisabled(raidData.status !== 'aguardando'),
      new ButtonBuilder()
        .setCustomId(`raid_finalizar_${raidData.id}`)
        .setLabel('🏁 Finalizar')
        .setStyle(ButtonStyle.Danger),
      new ButtonBuilder()
        .setCustomId(`raid_cancelar_${raidData.id}`)
        .setLabel('❌ Cancelar')
        .setStyle(ButtonStyle.Secondary)
    );
    rows.push(controleRow);

    return rows;
  }

  /**
   * Mostra seleção de arma após escolher classe
   */
  static async showWeaponSelect(interaction, raidId, classKey) {
    try {
      const raidData = global.activeRaids?.get(raidId);
      if (!raidData) {
        return interaction.reply({
          content: '❌ Raid não encontrada!',
          ephemeral: true
        });
      }

      // Verificar se raid já iniciou
      if (raidData.status !== 'aguardando') {
        return interaction.reply({
          content: '❌ A raid já foi iniciada! Não é mais possível entrar.',
          ephemeral: true
        });
      }

      // Verificar limite
      const classe = raidData.classes?.[classKey];
      if (classe && classe.limite > 0 && classe.participantes.length >= classe.limite) {
        return interaction.reply({
          content: `❌ A classe ${classKey.toUpperCase()} já atingiu o limite de ${classe.limite} participantes!`,
          ephemeral: true
        });
      }

      // Verificar limite total
      const totalAtual = this.getTotalParticipants(raidData);
      if (raidData.limiteTotal > 0 && totalAtual >= raidData.limiteTotal) {
        return interaction.reply({
          content: `❌ A raid já atingiu o limite total de ${raidData.limiteTotal} participantes!`,
          ephemeral: true
        });
      }

      // Verificar se já está participando
      for (const [key, data] of Object.entries(raidData.classes || {})) {
        const jaParticipa = data.participantes?.find(p => p.userId === interaction.user.id);
        if (jaParticipa) {
          return interaction.reply({
            content: `❌ Você já está participando como ${key.toUpperCase()} com ${jaParticipa.arma}!`,
            ephemeral: true
          });
        }
      }

      const armas = this.getArmasPorClasse(classKey);

      const selectMenu = new StringSelectMenuBuilder()
        .setCustomId(`raid_select_weapon_${raidId}_${classKey}`)
        .setPlaceholder('⚔️ Escolha sua arma...');

      armas.forEach(arma => {
        selectMenu.addOptions(
          new StringSelectMenuOptionBuilder()
            .setLabel(arma)
            .setValue(arma.toLowerCase().replace(/\s+/g, '-'))
            .setDescription(`Usar ${arma}`)
        );
      });

      const row = new ActionRowBuilder().addComponents(selectMenu);

      await interaction.reply({
        content: `🎮 \*\*Escolha sua arma para ${classKey.toUpperCase()}:\*\*`,
        components: [row],
        ephemeral: true
      });

    } catch (error) {
      console.error('[RaidAvalon] Error showing weapon select:', error);
      await interaction.reply({
        content: '❌ Erro ao mostrar seleção de arma.',
        ephemeral: true
      });
    }
  }

  /**
   * Processa seleção de arma e adiciona participante
   */
  static async processWeaponSelect(interaction, raidId, classKey, weaponKey) {
    try {
      const raidData = global.activeRaids?.get(raidId);
      if (!raidData) {
        return interaction.reply({
          content: '❌ Raid não encontrada!',
          ephemeral: true
        });
      }

      const armaNome = this.getArmaNomeByKey(weaponKey);
      const member = interaction.member;

      // Adicionar participante
      if (!raidData.classes[classKey].participantes) {
        raidData.classes[classKey].participantes = [];
      }

      raidData.classes[classKey].participantes.push({
        userId: member.id,
        nick: member.nickname || member.user.username,
        arma: armaNome,
        classe: classKey,
        joinedAt: Date.now()
      });

      // Atualizar também no activeEvents para compatibilidade
      const eventData = global.activeEvents.get(raidId);
      if (eventData) {
        eventData.participantes.set(member.id, {
          nick: member.nickname || member.user.username,
          userId: member.id,
          tempoInicio: null,
          tempoTotal: 0,
          pausado: false,
          classe: classKey,
          arma: armaNome
        });
      }

      // Atualizar painel
      await this.updateRaidPanel(interaction, raidData);

      // Enviar imagens do set + arma
      const armaImagePath = `png/raid/${weaponKey}.png`;
      const setSkipPath = `png/raid/set-skip.png`;

      try {
        await interaction.reply({
          content: `✅ \*\*Você entrou na raid como ${classKey.toUpperCase()}!\*\*\n\n` +
            `⚔️ \*\*Arma:\*\* ${armaNome}\n` +
            `📋 \*\*Set recomendado:\*\*`,
          files: [armaImagePath, setSkipPath],
          ephemeral: true
        });
      } catch (imgError) {
        // Tentar enviar só o set se a imagem da arma não existir
        try {
          await interaction.reply({
            content: `✅ \*\*Você entrou na raid como ${classKey.toUpperCase()}!\*\*\n\n` +
              `⚔️ \*\*Arma:\*\* ${armaNome}\n` +
              `📋 \*\*Set recomendado:\*\*`,
            files: [setSkipPath],
            ephemeral: true
          });
        } catch (setError) {
          // Se nem o set existir, envia sem imagens
          await interaction.reply({
            content: `✅ \*\*Você entrou na raid como ${classKey.toUpperCase()}!\*\*\n\n` +
              `⚔️ \*\*Arma:\*\* ${armaNome}\n\n` +
              `⚠️ \*Imagens do set não encontradas.\*`,
            ephemeral: true
          });
        }
      }

    } catch (error) {
      console.error('[RaidAvalon] Error processing weapon select:', error);
      await interaction.reply({
        content: '❌ Erro ao processar seleção.',
        ephemeral: true
      });
    }
  }

  /**
   * Retorna armas disponíveis por classe
   */
  static getArmasPorClasse(classKey) {
    const armas = {
      tank: ['Martelo', 'Incubus'],
      dps: ['Fura-bruma', 'Fulgurante', 'Aguia', 'Quebra-reinos'],
      healer: ['Queda-santa', 'Crosta'],
      suporte: ['Chama-sombra', 'Para-tempo'],
      scout: ['Para-tempo']
    };
    return armas[classKey] || [];
  }

  /**
   * Retorna nome da arma pelo key
   */
  static getArmaNomeByKey(key) {
    const map = {
      'martelo': 'Martelo',
      'incubus': 'Incubus',
      'fura-bruma': 'Fura-bruma',
      'fulgurante': 'Fulgurante',
      'aguia': 'Águia',
      'quebra-reinos': 'Quebra-reinos',
      'queda-santa': 'Queda-santa',
      'crosta': 'Crosta',
      'chama-sombra': 'Chama-sombra',
      'para-tempo': 'Para-tempo'
    };
    return map[key] || key;
  }

  /**
   * Atualiza painel da raid
   */
  static async updateRaidPanel(interaction, raidData) {
    try {
      const canal = interaction.guild.channels.cache.get(raidData.canalTextoId);
      if (!canal) return;

      const msg = await canal.messages.fetch(raidData.messageId).catch(() => null);
      if (!msg) return;

      const embed = this.createRaidEmbed(raidData);
      const botoes = this.createRaidButtons(raidData);

      await msg.edit({
        embeds: [embed],
        components: botoes
      });

    } catch (error) {
      console.error('[RaidAvalon] Error updating panel:', error);
    }
  }

  /**
   * Retorna total de participantes
   */
  static getTotalParticipants(raidData) {
    let total = 0;
    for (const data of Object.values(raidData.classes || {})) {
      total += data.participantes?.length || 0;
    }
    return total;
  }

  /**
   * Handlers para botões de controle
   */
  static async handleIniciar(interaction, raidId) {
    try {
      // ✅ CORREÇÃO: Adicionado deferReply no início para evitar timeout
      await interaction.deferReply({ ephemeral: true });

      const raidData = global.activeRaids?.get(raidId);
      if (!raidData) {
        return interaction.editReply({ content: '❌ Raid não encontrada!', ephemeral: true });
      }

      const isCriador = interaction.user.id === raidData.criadorId;
      const isStaff = interaction.member.roles.cache.some(r => ['ADM', 'Staff'].includes(r.name));

      if (!isCriador && !isStaff) {
        return interaction.editReply({
          content: '❌ Apenas o criador ou staff pode iniciar!',
          ephemeral: true
        });
      }

      raidData.status = 'em_andamento';
      raidData.inicioTimestamp = Date.now();

      // MOVER TODOS OS PARTICIPANTES PARA O CANAL DE VOZ
      const canalVoz = interaction.guild.channels.cache.get(raidData.canalVozId);
      const canalAguardando = interaction.guild.channels.cache.find(
        c => c.name === '🔊╠Aguardando-Evento'
      );

      if (canalVoz) {
        for (const classe of Object.values(raidData.classes || {})) {
          for (const participante of classe.participantes || []) {
            const member = await interaction.guild.members.fetch(participante.userId).catch(() => null);
            if (member) {
              // Conceder permissão no canal de voz
              try {
                await canalVoz.permissionOverwrites.create(participante.userId, {
                  Connect: true,
                  Speak: true,
                  ViewChannel: true
                });
              } catch (e) {
                console.log(`[RaidAvalon] Could not grant permission to ${participante.userId}`);
              }

              // Mover para o canal se estiver em "Aguardando-Evento"
              if (member.voice.channelId === canalAguardando?.id) {
                try {
                  await member.voice.setChannel(canalVoz.id);
                  console.log(`[RaidAvalon] Moved ${participante.nick} to voice channel`);
                } catch (e) {
                  console.log(`[RaidAvalon] Could not move ${participante.userId}: ${e.message}`);
                }
              }
            }
          }
        }
      }

      // Atualizar também em activeEvents
      const eventData = global.activeEvents.get(raidId);
      if (eventData) {
        eventData.status = 'em_andamento';
        eventData.inicioTimestamp = Date.now();
      }

      await this.updateRaidPanel(interaction, raidData);

      // ✅ CORREÇÃO: Usar editReply em vez de reply
      await interaction.editReply({
        content: '🚀 \*\*Raid iniciada!\*\* Todos os participantes foram movidos para o canal de voz!',
        ephemeral: true
      });

    } catch (error) {
      console.error('[RaidAvalon] Error starting raid:', error);
      // ✅ CORREÇÃO: Verificar se já foi deferido antes de responder
      if (interaction.deferred) {
        await interaction.editReply({ content: '❌ Erro ao iniciar raid.', ephemeral: true });
      } else {
        await interaction.reply({ content: '❌ Erro ao iniciar raid.', ephemeral: true });
      }
    }
  }

  static async handleFinalizar(interaction, raidId) {
    try {
      // ✅ CORREÇÃO: Adicionado deferReply no início para evitar timeout
      await interaction.deferReply({ ephemeral: true });

      const raidData = global.activeRaids?.get(raidId);
      if (!raidData) {
        return interaction.editReply({ content: '❌ Raid não encontrada!', ephemeral: true });
      }

      const isCriador = interaction.user.id === raidData.criadorId;
      const isStaff = interaction.member.roles.cache.some(r => ['ADM', 'Staff'].includes(r.name));

      if (!isCriador && !isStaff) {
        return interaction.editReply({
          content: '❌ Apenas o criador ou staff pode finalizar!',
          ephemeral: true
        });
      }

      raidData.status = 'encerrado';
      raidData.finalizadoEm = Date.now();

      // Calcular tempo de participação para todos
      if (raidData.inicioTimestamp) {
        const tempoTotal = Date.now() - raidData.inicioTimestamp;
        for (const classe of Object.values(raidData.classes || {})) {
          for (const participante of classe.participantes || []) {
            participante.tempoTotal = tempoTotal;
          }
        }
      }

      // Mover todos para Aguardando-Evento
      const canalAguardando = interaction.guild.channels.cache.find(
        c => c.name === '🔊╠Aguardando-Evento'
      );
      const canalVoz = interaction.guild.channels.cache.get(raidData.canalVozId);

      if (canalVoz && canalAguardando) {
        for (const classe of Object.values(raidData.classes || {})) {
          for (const participante of classe.participantes || []) {
            const member = await interaction.guild.members.fetch(participante.userId).catch(() => null);
            if (member && member.voice.channelId === canalVoz.id) {
              try {
                await member.voice.setChannel(canalAguardando.id);
              } catch (e) {
                console.log(`[RaidAvalon] Could not move ${participante.userId}`);
              }
            }
          }
        }

        // ✅ CORREÇÃO: Try-catch ao deletar canal para evitar crash se canal já foi deletado
        try {
          await canalVoz.delete('Raid finalizada');
        } catch (e) {
          console.log(`[RaidAvalon] Could not delete voice channel: ${e.message}`);
        }
      }

      // Criar resumo em canal de eventos encerrados com botão de lootsplit
      await this.createFinishedRaidSummary(interaction, raidData);

      // Deletar mensagem original
      const canalParticipar = interaction.guild.channels.cache.get(raidData.canalTextoId);
      if (canalParticipar) {
        const msg = await canalParticipar.messages.fetch(raidData.messageId).catch(() => null);
        if (msg) await msg.delete();
      }

      // Salvar em eventos finalizados para lootsplit
      if (!global.finishedEvents) global.finishedEvents = new Map();

      // Converter participantes para o formato do lootsplit
      const participantesMap = new Map();
      for (const classe of Object.values(raidData.classes || {})) {
        for (const participante of classe.participantes || []) {
          participantesMap.set(participante.userId, {
            nick: participante.nick,
            userId: participante.userId,
            tempoTotal: participante.tempoTotal || 0,
            pausado: false,
            classe: participante.classe,
            arma: participante.arma
          });
        }
      }

      // ✅ CORREÇÃO: Garantir guildId ao salvar em finishedEvents
      global.finishedEvents.set(raidId, {
        ...raidData,
        guildId: raidData.guildId || interaction.guild.id,
        participantes: participantesMap,
        finalizadoEm: Date.now()
      });

      global.activeRaids.delete(raidId);
      global.activeEvents.delete(raidId);

      // ✅ CORREÇÃO: Usar editReply em vez de reply
      await interaction.editReply({
        content: '✅ \*\*Raid finalizada com sucesso!\*\*\n💰 Use o botão "Simular Evento" no canal de eventos encerrados para calcular o loot.',
        ephemeral: true
      });

    } catch (error) {
      console.error('[RaidAvalon] Error finishing raid:', error);
      // ✅ CORREÇÃO: Verificar se já foi deferido antes de responder
      if (interaction.deferred) {
        await interaction.editReply({ content: '❌ Erro ao finalizar raid.', ephemeral: true });
      } else {
        await interaction.reply({ content: '❌ Erro ao finalizar raid.', ephemeral: true });
      }
    }
  }

  static async handleCancelar(interaction, raidId) {
    try {
      // ✅ CORREÇÃO: Adicionado deferReply para consistência e segurança
      await interaction.deferReply({ ephemeral: true });

      const raidData = global.activeRaids?.get(raidId);
      if (!raidData) {
        return interaction.editReply({ content: '❌ Raid não encontrada!', ephemeral: true });
      }

      const isCriador = interaction.user.id === raidData.criadorId;
      const isStaff = interaction.member.roles.cache.some(r => ['ADM', 'Staff'].includes(r.name));

      if (!isCriador && !isStaff) {
        return interaction.editReply({
          content: '❌ Apenas o criador ou staff pode cancelar!',
          ephemeral: true
        });
      }

      const canalVoz = interaction.guild.channels.cache.get(raidData.canalVozId);
      if (canalVoz) {
        try {
          await canalVoz.delete('Raid cancelada');
        } catch (e) {
          console.log(`[RaidAvalon] Could not delete channel: ${e.message}`);
        }
      }

      const canalParticipar = interaction.guild.channels.cache.get(raidData.canalTextoId);
      if (canalParticipar) {
        const msg = await canalParticipar.messages.fetch(raidData.messageId).catch(() => null);
        if (msg) await msg.delete();
      }

      global.activeRaids.delete(raidId);
      global.activeEvents.delete(raidId);

      // ✅ CORREÇÃO: Usar editReply
      await interaction.editReply({
        content: '🗑️ \*\*Raid cancelada!\*\*',
        ephemeral: true
      });

    } catch (error) {
      console.error('[RaidAvalon] Error canceling raid:', error);
      // ✅ CORREÇÃO: Verificar se já foi deferido
      if (interaction.deferred) {
        await interaction.editReply({ content: '❌ Erro ao cancelar raid.', ephemeral: true });
      } else {
        await interaction.reply({ content: '❌ Erro ao cancelar raid.', ephemeral: true });
      }
    }
  }

  static async createFinishedRaidSummary(interaction, raidData) {
    try {
      const categoriaEncerrados = interaction.guild.channels.cache.find(
        c => c.name === '📁 EVENTOS ENCERRADOS' && c.type === ChannelType.GuildCategory
      );

      if (!categoriaEncerrados) {
        console.error('[RaidAvalon] Categoria de eventos encerrados não encontrada');
        return;
      }

      // Buscar taxa da guilda
      const config = global.guildConfig?.get(interaction.guild.id) || {};
      const taxaGuilda = config.taxaGuilda || 10;

      // Calcular tempo total
      let tempoTotalMin = 0;
      if (raidData.inicioTimestamp && raidData.finalizadoEm) {
        tempoTotalMin = Math.floor((raidData.finalizadoEm - raidData.inicioTimestamp) / 1000 / 60);
      }

      let resumo = '';
      let totalParticipantes = 0;
      for (const [key, data] of Object.entries(raidData.classes || {})) {
        resumo += `\*\*${key.toUpperCase()}\*\* (${data.participantes?.length || 0}):\n`;
        totalParticipantes += data.participantes?.length || 0;
        if (data.participantes) {
          data.participantes.forEach(p => {
            resumo += `• ${p.nick} - ${p.arma}\n`;
          });
        }
        resumo += '\n';
      }

      const embed = new EmbedBuilder()
        .setTitle(`✅ RAID AVALON FINALIZADA ┃ ${raidData.nome}`)
        .setDescription(
          `\*\*Criador:\*\* <@${raidData.criadorId}>\n` +
          `\*\*Horário:\*\* ${raidData.horario}\n` +
          `\*\*Duração:\*\* ${tempoTotalMin} minutos\n` +
          `\*\*Total:\*\* ${totalParticipantes} participantes\n` +
          `\*\*Taxa Guilda:\*\* ${taxaGuilda}%\n\n` +
          `\*\*Participantes por Classe:\*\*\n${resumo}`
        )
        .setColor(0x2ECC71)
        .setTimestamp();

      // Criar botão de lootsplit igual ao do evento normal
      const botoes = new ActionRowBuilder()
        .addComponents(
          new ButtonBuilder()
            .setCustomId(`loot_simular_${raidData.id}`)
            .setLabel('💰 Simular Evento')
            .setStyle(ButtonStyle.Success)
            .setEmoji('💎')
        );

      const canal = await interaction.guild.channels.create({
        name: `📁-raid-${raidData.nome.substring(0, 15)}`,
        type: ChannelType.GuildText,
        parent: categoriaEncerrados.id,
        permissionOverwrites: [
          {
            id: interaction.guild.id,
            allow: [PermissionFlagsBits.ViewChannel],
            deny: [PermissionFlagsBits.SendMessages]
          }
        ]
      });

      await canal.send({
        embeds: [embed],
        components: [botoes]
      });

      console.log(`[RaidAvalon] Created finished raid channel: ${canal.name}`);

    } catch (error) {
      console.error('[RaidAvalon] Error creating summary:', error);
    }
  }
}

module.exports = RaidAvalonHandler;