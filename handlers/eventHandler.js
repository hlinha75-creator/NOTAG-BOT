const {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  PermissionFlagsBits,
  ChannelType
} = require('discord.js');
const fs = require('fs');
const path = require('path');

class EventHandler {
  constructor() {
    this.activeEvents = new Map();
    this.dataPath = path.join(__dirname, '..', 'data', 'active_events.json');
  }

  static initialize() {
    if (!global.activeEvents) global.activeEvents = new Map();

    // ✅ CORREÇÃO: Carregar eventos salvos do arquivo
    this.loadEvents();

    console.log(`📝 EventHandler inicializado. Eventos ativos carregados: ${global.activeEvents.size}`);
  }

  // ✅ NOVO: Salvar eventos em arquivo
  static saveEvents() {
    try {
      const dataDir = path.join(__dirname, '..', 'data');
      if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
      }

      const eventsArray = [];

      for (const [eventId, eventData] of global.activeEvents) {
        // Converter Map de participantes para array
        const participantesArray = [];
        if (eventData.participantes instanceof Map) {
          for (const [userId, data] of eventData.participantes) {
            participantesArray.push([userId, data]);
          }
        } else if (typeof eventData.participantes === 'object') {
          // Se já for objeto (depois de recuperado), converter
          for (const [userId, data] of Object.entries(eventData.participantes)) {
            participantesArray.push([userId, data]);
          }
        }

        eventsArray.push([
          eventId,
          {
            ...eventData,
            participantes: participantesArray
          }
        ]);
      }

      fs.writeFileSync(
        path.join(dataDir, 'active_events.json'),
        JSON.stringify(eventsArray, null, 2)
      );

      console.log(`💾 ${eventsArray.length} eventos ativos salvos.`);
    } catch (error) {
      console.error('❌ Erro ao salvar eventos:', error);
    }
  }

  // ✅ NOVO: Carregar eventos do arquivo
  static loadEvents() {
    try {
      const filePath = path.join(__dirname, '..', 'data', 'active_events.json');

      if (!fs.existsSync(filePath)) {
        console.log('📁 Nenhum arquivo de eventos ativos encontrado.');
        return;
      }

      const data = fs.readFileSync(filePath, 'utf8');
      const eventsArray = JSON.parse(data);

      for (const [eventId, eventData] of eventsArray) {
        // Converter array de participantes de volta para Map
        const participantesMap = new Map();
        if (Array.isArray(eventData.participantes)) {
          for (const [userId, data] of eventData.participantes) {
            participantesMap.set(userId, data);
          }
        }

        eventData.participantes = participantesMap;
        global.activeEvents.set(eventId, eventData);
      }

      console.log(`✅ ${eventsArray.length} eventos ativos carregados do arquivo.`);
    } catch (error) {
      console.error('❌ Erro ao carregar eventos:', error);
    }
  }

  static async createEvent(interaction) {
    try {
      await interaction.deferReply({ ephemeral: true });

      const nome = interaction.fields.getTextInputValue('evt_nome');
      const descricao = interaction.fields.getTextInputValue('evt_descricao');
      const requisitos = interaction.fields.getTextInputValue('evt_requisitos') || 'Nenhum';
      const horario = interaction.fields.getTextInputValue('evt_horario');

      const guild = interaction.guild;
      const eventId = `event_${Date.now()}_${interaction.user.id}`;

      const categoriaAtivos = guild.channels.cache.find(
        c => c.name === '⚔️ EVENTOS ATIVOS' && c.type === ChannelType.GuildCategory
      );

      const canalParticipar = guild.channels.cache.find(
        c => c.name === '👋╠participar'
      );

      if (!categoriaAtivos) {
        return interaction.editReply({
          content: '❌ Categoria "⚔️ EVENTOS ATIVOS" não encontrada! Use /instalar primeiro.'
        });
      }

      if (!canalParticipar) {
        return interaction.editReply({
          content: '❌ Canal "👋╠participar" não encontrado!'
        });
      }

      // Criar canal de voz com permissões básicas
      const canalVoz = await guild.channels.create({
        name: `⚔️-${nome.substring(0, 20)}`,
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

      // Permitir falar para cargos específicos (mas não conectar ainda)
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

      // Permitir falar para o criador do evento
      await canalVoz.permissionOverwrites.create(interaction.user.id, {
        Connect: true,
        Speak: true,
        ViewChannel: true
      });

      const eventData = {
        id: eventId,
        guildId: guild.id,
        nome: nome,
        descricao: descricao,
        requisitos: requisitos,
        horario: horario,
        criadorId: interaction.user.id,
        criadorTag: interaction.user.tag,
        canalVozId: canalVoz.id,
        canalTextoId: canalParticipar.id,
        status: 'aguardando',
        participantes: new Map(),
        inicioTimestamp: null,
        finalizadoEm: null,
        pausadoGlobal: false,
        trancado: false,
        messageId: null
      };

      const embed = this.createEventEmbed(eventData);
      const botoes = this.createEventButtons(eventData, 'aguardando');

      const msg = await canalParticipar.send({
        content: `📢 <@&${guild.roles.cache.find(r => r.name === 'Membro')?.id}> Novo evento criado!`,
        embeds: [embed],
        components: botoes
      });

      eventData.messageId = msg.id;
      global.activeEvents.set(eventId, eventData);

      // ✅ CORREÇÃO: Salvar eventos após criar
      this.saveEvents();

      await interaction.editReply({
        content: `✅ **Evento criado com sucesso!**\n\n🎮 **${nome}**\n🕐 ${horario}\n🔊 Canal: <#${canalVoz.id}>`
      });

      console.log(`⚔️ Evento criado: ${nome} por ${interaction.user.tag}`);

    } catch (error) {
      console.error('[handleCreateEvent] Erro ao criar evento:', error);
      await interaction.editReply({
        content: '❌ Erro ao criar evento. Verifique as permissões do bot.'
      });
    }
  }

  static createEventEmbed(eventData) {
    const statusEmojis = {
      'aguardando': '⏳',
      'em_andamento': '🔴',
      'pausado': '⏸️',
      'encerrado': '✅'
    };

    const statusTextos = {
      'aguardando': 'Aguardando Início',
      'em_andamento': '🔥 Em Andamento',
      'pausado': '⏸️ Pausado Globalmente',
      'encerrado': '✅ Encerrado'
    };

    let participantesTexto = '';
    if (eventData.participantes.size === 0) {
      participantesTexto = '```diff\n- Nenhum participante ainda\n```';
    } else {
      const lista = Array.from(eventData.participantes.entries())
        .map(([userId, data]) => {
          const pausaIcon = data.pausado ? ' ⏸️' : ' 🟢';
          const tempo = data.tempoTotal > 0 ? ` (${Math.floor(data.tempoTotal / 1000 / 60)}min)` : '';
          return `${pausaIcon} ${data.nick}${tempo}`;
        })
        .join('\n');
      participantesTexto = '```yaml\n' + lista + '\n```';
    }

    const embed = new EmbedBuilder()
      .setTitle(`${statusEmojis[eventData.status]} ┃ ${eventData.nome}`)
      .setDescription(
        `\\> ${eventData.descricao}\n\n` +
        `**👤 Criador:** <@${eventData.criadorId}>\n` +
        `**🕐 Horário:** \`${eventData.horario}\`\n` +
        `**📊 Status:** ${statusTextos[eventData.status]}\n` +
        `**🔊 Canal:** <#${eventData.canalVozId}>`
      )
      .setColor(this.getStatusColor(eventData.status))
      .addFields(
        {
          name: '⚠️ Requisitos',
          value: `\`\`\`${eventData.requisitos}\`\`\``,
          inline: false
        },
        {
          name: `👥 Participantes (${eventData.participantes.size}) ${eventData.trancado ? '🔒' : ''}`,
          value: participantesTexto,
          inline: false
        }
      )
      .setFooter({
        text: `ID: ${eventData.id} • Use os botões abaixo`,
        iconURL: 'https://cdn.discordapp.com/emojis/1051892919120793710.webp?size=96'
      })
      .setTimestamp();

    if (eventData.status === 'em_andamento' && eventData.inicioTimestamp) {
      const duracao = Math.floor((Date.now() - eventData.inicioTimestamp) / 1000 / 60);
      embed.addFields({
        name: '⏱️ Tempo Decorrido',
        value: `\`${duracao}\` minutos`,
        inline: true
      });
    }

    if (eventData.status === 'pausado') {
      embed.addFields({
        name: '⏸️ Pausado',
        value: 'O evento está pausado globalmente',
        inline: true
      });
    }

    return embed;
  }

  static createEventButtons(eventData, status) {
    const rows = [];

    // ROW 1: Ações de Participação (Todos podem usar)
    const rowParticipacao = new ActionRowBuilder();

    if (status === 'aguardando' || status === 'em_andamento' || status === 'pausado') {
      rowParticipacao.addComponents(
        new ButtonBuilder()
          .setCustomId(`evt_participar_${eventData.id}`)
          .setLabel(eventData.trancado ? '🔒 Evento Trancado' : '✋ Entrar no Evento')
          .setStyle(eventData.trancado ? ButtonStyle.Secondary : ButtonStyle.Success)
          .setEmoji(eventData.trancado ? '🔒' : '🎮')
          .setDisabled(eventData.trancado || status === 'encerrado')
      );

      if (status === 'em_andamento' || status === 'pausado') {
        rowParticipacao.addComponents(
          new ButtonBuilder()
            .setCustomId(`evt_pausar_${eventData.id}`)
            .setLabel('⏸️ Minha Participação')
            .setStyle(ButtonStyle.Primary)
            .setEmoji('⏸️')
        );
      }
    }

    if (rowParticipacao.components.length > 0) {
      rows.push(rowParticipacao);
    }

    // ROW 2: Controles do Evento (Apenas Criador/Staff)
    const rowControles = new ActionRowBuilder();

    if (status === 'aguardando') {
      rowControles.addComponents(
        new ButtonBuilder()
          .setCustomId(`evt_iniciar_${eventData.id}`)
          .setLabel('▶️ Iniciar Evento')
          .setStyle(ButtonStyle.Success)
          .setEmoji('🚀'),
        new ButtonBuilder()
          .setCustomId(`evt_trancar_${eventData.id}`)
          .setLabel(eventData.trancado ? '🔓 Destrancar' : '🔒 Trancar')
          .setStyle(eventData.trancado ? ButtonStyle.Success : ButtonStyle.Secondary)
          .setEmoji(eventData.trancado ? '🔓' : '🔒'),
        new ButtonBuilder()
          .setCustomId(`evt_cancelar_${eventData.id}`)
          .setLabel('❌ Cancelar')
          .setStyle(ButtonStyle.Danger)
          .setEmoji('🗑️')
      );
    } else if (status === 'em_andamento') {
      rowControles.addComponents(
        new ButtonBuilder()
          .setCustomId(`evt_pausar_global_${eventData.id}`)
          .setLabel('⏸️ Pausar Evento')
          .setStyle(ButtonStyle.Primary)
          .setEmoji('⏸️'),
        new ButtonBuilder()
          .setCustomId(`evt_trancar_${eventData.id}`)
          .setLabel(eventData.trancado ? '🔓 Destrancar' : '🔒 Trancar')
          .setStyle(eventData.trancado ? ButtonStyle.Success : ButtonStyle.Secondary)
          .setEmoji(eventData.trancado ? '🔓' : '🔒'),
        new ButtonBuilder()
          .setCustomId(`evt_finalizar_${eventData.id}`)
          .setLabel('🏁 Finalizar')
          .setStyle(ButtonStyle.Danger)
          .setEmoji('✅')
      );
    } else if (status === 'pausado') {
      rowControles.addComponents(
        new ButtonBuilder()
          .setCustomId(`evt_retomar_global_${eventData.id}`)
          .setLabel('▶️ Retomar Evento')
          .setStyle(ButtonStyle.Success)
          .setEmoji('▶️'),
        new ButtonBuilder()
          .setCustomId(`evt_trancar_${eventData.id}`)
          .setLabel(eventData.trancado ? '🔓 Destrancar' : '🔒 Trancar')
          .setStyle(eventData.trancado ? ButtonStyle.Success : ButtonStyle.Secondary)
          .setEmoji(eventData.trancado ? '🔓' : '🔒'),
        new ButtonBuilder()
          .setCustomId(`evt_finalizar_${eventData.id}`)
          .setLabel('🏁 Finalizar')
          .setStyle(ButtonStyle.Danger)
          .setEmoji('✅')
      );
    }

    if (rowControles.components.length > 0) {
      rows.push(rowControles);
    }

    return rows;
  }

  static async updateEventPanel(interaction, eventData, userId = null) {
    try {
      const canal = interaction.guild.channels.cache.get(eventData.canalTextoId);
      if (!canal) return;

      const msg = await canal.messages.fetch(eventData.messageId).catch(() => null);
      if (!msg) return;

      const embed = this.createEventEmbed(eventData);
      const botoes = this.createEventButtons(eventData, eventData.status);

      await msg.edit({
        embeds: [embed],
        components: botoes
      });

      // ✅ CORREÇÃO: Salvar estado após atualizar painel
      this.saveEvents();

    } catch (error) {
      console.error('[updateEventPanel] Erro ao atualizar painel:', error);
    }
  }

  static getStatusColor(status) {
    const cores = {
      'aguardando': 0x3498DB,
      'em_andamento': 0xE74C3C,
      'pausado': 0xF39C12,
      'encerrado': 0x2ECC71
    };
    return cores[status] || 0x95A5A6;
  }

  static async handleParticipar(interaction, eventId) {
    try {
      const eventData = global.activeEvents.get(eventId);
      if (!eventData) {
        return interaction.reply({ content: '❌ Evento não encontrado! Ele pode ter sido encerrado ou cancelado.', ephemeral: true });
      }

      if (eventData.trancado) {
        return interaction.reply({
          content: '🔒 Este evento está trancado! Apenas membros já participantes podem interagir.',
          ephemeral: true
        });
      }

      const member = interaction.member;
      const canalVoz = interaction.guild.channels.cache.get(eventData.canalVozId);

      // Conceder permissão de conectar e falar no canal de voz
      if (canalVoz) {
        try {
          await canalVoz.permissionOverwrites.create(member.id, {
            Connect: true,
            Speak: true,
            ViewChannel: true
          });
          console.log(`[EventHandler] Permissão concedida para ${member.id} no canal ${canalVoz.id}`);
        } catch (e) {
          console.log('[EventHandler] Não foi possível conceder permissão:', e.message);
        }
      }

      if (eventData.participantes.has(member.id)) {
        const participante = eventData.participantes.get(member.id);
        if (member.voice.channel && canalVoz) {
          try {
            await member.voice.setChannel(canalVoz.id);
          } catch (e) {
            console.log('Não foi possível mover usuário:', e.message);
          }
        }

        if (eventData.status === 'em_andamento' && !participante.pausado && !participante.tempoInicio) {
          participante.tempoInicio = Date.now();
        }

        // ✅ Salvar após modificar participante
        this.saveEvents();

        return interaction.reply({
          content: `✅ Você já está no evento! ${eventData.status === 'em_andamento' ? 'Sua participação está sendo contada!' : ''}`,
          ephemeral: true
        });
      }

      eventData.participantes.set(member.id, {
        nick: member.nickname || member.user.username,
        userId: member.id,
        tempoInicio: eventData.status === 'em_andamento' ? Date.now() : null,
        tempoTotal: 0,
        pausado: false
      });

      if (member.voice.channel && canalVoz) {
        try {
          await member.voice.setChannel(canalVoz.id);
        } catch (e) {
          console.log('Não foi possível mover usuário:', e.message);
        }
      }

      await this.updateEventPanel(interaction, eventData);

      const mensagem = eventData.status === 'em_andamento'
        ? `🎮 Você entrou no evento **${eventData.nome}**!\n⏱️ Sua participação começou a ser contada agora!`
        : `✋ Você entrou na lista de participantes do evento **${eventData.nome}**!\n⏳ Aguarde o início do evento para começar a contagem.`;

      await interaction.reply({
        content: mensagem,
        ephemeral: true
      });

      // ✅ Salvar após adicionar participante
      this.saveEvents();

    } catch (error) {
      console.error('[handleParticipar] Erro ao participar:', error);
      await interaction.reply({ content: '❌ Erro ao participar do evento.', ephemeral: true });
    }
  }

  static async handlePausar(interaction, eventId) {
    try {
      const eventData = global.activeEvents.get(eventId);
      if (!eventData) {
        return interaction.reply({ content: '❌ Evento não encontrado!', ephemeral: true });
      }

      const participante = eventData.participantes.get(interaction.user.id);
      if (!participante) {
        return interaction.reply({
          content: '❌ Você não está participando deste evento! Clique em "Entrar no Evento" primeiro.',
          ephemeral: true
        });
      }

      if (participante.pausado) {
        participante.pausado = false;
        if (eventData.status === 'em_andamento') {
          participante.tempoInicio = Date.now();
        }

        await this.updateEventPanel(interaction, eventData);

        await interaction.reply({
          content: '▶️ **Participação retomada!**\nSua contagem de tempo voltou a contar.',
          ephemeral: true
        });

      } else {
        participante.pausado = true;
        if (participante.tempoInicio) {
          participante.tempoTotal += Date.now() - participante.tempoInicio;
          participante.tempoInicio = null;
        }

        await this.updateEventPanel(interaction, eventData);

        await interaction.reply({
          content: '⏸️ **Participação pausada!**\nSua contagem de tempo foi pausada. Clique novamente para retomar.',
          ephemeral: true
        });
      }

      // ✅ Salvar após pausar/retomar
      this.saveEvents();

    } catch (error) {
      console.error('[handlePausar] Erro ao pausar:', error);
      await interaction.reply({ content: '❌ Erro ao pausar participação.', ephemeral: true });
    }
  }

  static async handleIniciar(interaction, eventId) {
    try {
      const eventData = global.activeEvents.get(eventId);
      if (!eventData) {
        return interaction.reply({ content: '❌ Evento não encontrado!', ephemeral: true });
      }

      const isCriador = interaction.user.id === eventData.criadorId;
      const isStaff = interaction.member.roles.cache.some(r => ['ADM', 'Staff'].includes(r.name));

      if (!isCriador && !isStaff) {
        return interaction.reply({
          content: '❌ Apenas o criador ou staff pode iniciar!',
          ephemeral: true
        });
      }

      eventData.status = 'em_andamento';
      eventData.inicioTimestamp = Date.now();

      eventData.participantes.forEach(part => {
        if (!part.pausado) {
          part.tempoInicio = Date.now();
        }
      });

      await this.updateEventPanel(interaction, eventData);

      await interaction.reply({
        content: '🚀 **Evento iniciado!**\nA contagem de participação começou para todos os participantes!',
        ephemeral: true
      });

      // ✅ Salvar após iniciar
      this.saveEvents();

    } catch (error) {
      console.error('[handleIniciar] Erro ao iniciar:', error);
      await interaction.reply({ content: '❌ Erro ao iniciar evento.', ephemeral: true });
    }
  }

  static async handlePausarGlobal(interaction, eventId, pausar) {
    try {
      const eventData = global.activeEvents.get(eventId);
      if (!eventData) {
        return interaction.reply({ content: '❌ Evento não encontrado!', ephemeral: true });
      }

      const isCriador = interaction.user.id === eventData.criadorId;
      const isStaff = interaction.member.roles.cache.some(r => ['ADM', 'Staff'].includes(r.name));

      if (!isCriador && !isStaff) {
        return interaction.reply({
          content: '❌ Apenas o criador ou staff pode pausar/retomar!',
          ephemeral: true
        });
      }

      if (pausar) {
        eventData.status = 'pausado';
        eventData.pausadoGlobal = true;
        eventData.participantes.forEach(part => {
          if (!part.pausado && part.tempoInicio) {
            part.tempoTotal += Date.now() - part.tempoInicio;
            part.tempoInicio = null;
          }
        });
        await interaction.reply({ content: '⏸️ Evento pausado globalmente! Todos os timers foram pausados.', ephemeral: true });
      } else {
        eventData.status = 'em_andamento';
        eventData.pausadoGlobal = false;
        eventData.participantes.forEach(part => {
          if (!part.pausado) {
            part.tempoInicio = Date.now();
          }
        });
        await interaction.reply({ content: '▶️ Evento retomado! Os timers voltaram a contar!', ephemeral: true });
      }

      await this.updateEventPanel(interaction, eventData);

      // ✅ Salvar após pausar/retomar global
      this.saveEvents();

    } catch (error) {
      console.error('[handlePausarGlobal] Erro ao pausar/retomar global:', error);
      await interaction.reply({ content: '❌ Erro ao pausar evento.', ephemeral: true });
    }
  }

  static async handleTrancar(interaction, eventId) {
    try {
      const eventData = global.activeEvents.get(eventId);
      if (!eventData) {
        return interaction.reply({ content: '❌ Evento não encontrado!', ephemeral: true });
      }

      const isCriador = interaction.user.id === eventData.criadorId;
      const isStaff = interaction.member.roles.cache.some(r => ['ADM', 'Staff'].includes(r.name));

      if (!isCriador && !isStaff) {
        return interaction.reply({
          content: '❌ Apenas o criador ou staff pode trancar/destrancar!',
          ephemeral: true
        });
      }

      eventData.trancado = !eventData.trancado;

      await this.updateEventPanel(interaction, eventData);

      await interaction.reply({
        content: eventData.trancado
          ? '🔒 **Evento trancado!** Novos participantes não poderão entrar.'
          : '🔓 **Evento destrancado!** Novos participantes podem entrar agora.',
        ephemeral: true
      });

      // ✅ Salvar após trancar/destrancar
      this.saveEvents();

    } catch (error) {
      console.error('[handleTrancar] Erro ao trancar:', error);
      await interaction.reply({ content: '❌ Erro ao trancar evento.', ephemeral: true });
    }
  }

  static async handleCancelar(interaction, eventId) {
    try {
      const eventData = global.activeEvents.get(eventId);
      if (!eventData) {
        return interaction.reply({ content: '❌ Evento não encontrado!', ephemeral: true });
      }

      const isCriador = interaction.user.id === eventData.criadorId;
      const isStaff = interaction.member.roles.cache.some(r => ['ADM', 'Staff'].includes(r.name));

      if (!isCriador && !isStaff) {
        return interaction.reply({
          content: '❌ Apenas o criador ou staff pode cancelar!',
          ephemeral: true
        });
      }

      const canalVoz = interaction.guild.channels.cache.get(eventData.canalVozId);
      if (canalVoz) {
        await canalVoz.delete('Evento cancelado');
      }

      const canalParticipar = interaction.guild.channels.cache.get(eventData.canalTextoId);
      if (canalParticipar) {
        const msg = await canalParticipar.messages.fetch(eventData.messageId).catch(() => null);
        if (msg) await msg.delete();
      }

      global.activeEvents.delete(eventId);

      // ✅ Salvar após cancelar (remover do arquivo)
      this.saveEvents();

      await interaction.reply({
        content: '🗑️ **Evento cancelado** e todos os recursos foram liberados.',
        ephemeral: true
      });

    } catch (error) {
      console.error('[handleCancelar] Erro ao cancelar:', error);
      await interaction.reply({ content: '❌ Erro ao cancelar evento.', ephemeral: true });
    }
  }

  static async handleFinalizar(interaction, eventId) {
    try {
      console.log(`[handleFinalizar] Iniciando finalização do evento ${eventId} por ${interaction.user.id}`);

      const eventData = global.activeEvents.get(eventId);
      if (!eventData) {
        console.error(`[handleFinalizar] Evento ${eventId} não encontrado em global.activeEvents`);
        return interaction.reply({ content: '❌ Evento não encontrado! Ele pode ter sido encerrado ou cancelado anteriormente.', ephemeral: true });
      }

      const isCriador = interaction.user.id === eventData.criadorId;
      const isStaff = interaction.member.roles.cache.some(r => ['ADM', 'Staff'].includes(r.name));

      if (!isCriador && !isStaff) {
        console.warn(`[handleFinalizar] Permissão negada para ${interaction.user.id}`);
        return interaction.reply({
          content: '❌ Apenas o criador ou staff pode finalizar!',
          ephemeral: true
        });
      }

      // Calcular tempo final dos participantes
      if (eventData.status === 'em_andamento') {
        eventData.participantes.forEach(part => {
          if (!part.pausado && part.tempoInicio) {
            part.tempoTotal += Date.now() - part.tempoInicio;
          }
        });
      }

      eventData.finalizadoEm = Date.now();
      eventData.status = 'encerrado';

      // Mover todos para "Aguardando-Evento"
      const canalAguardando = interaction.guild.channels.cache.find(
        c => c.name === '🔊╠Aguardando-Evento'
      );

      const canalVoz = interaction.guild.channels.cache.get(eventData.canalVozId);

      if (canalVoz && canalAguardando) {
        for (const [memberId] of eventData.participantes) {
          const member = await interaction.guild.members.fetch(memberId).catch(() => null);
          if (member && member.voice.channelId === canalVoz.id) {
            try {
              await member.voice.setChannel(canalAguardando.id);
            } catch (e) {
              console.log(`[handleFinalizar] Não foi possível mover ${memberId}`);
            }
          }
        }
      }

      if (canalVoz) {
        await canalVoz.delete('Evento finalizado');
      }

      // Criar resumo em canal de eventos encerrados
      await this.createFinishedEventChannel(interaction, eventData);

      // Deletar mensagem original
      const canalParticipar = interaction.guild.channels.cache.get(eventData.canalTextoId);
      if (canalParticipar) {
        const msg = await canalParticipar.messages.fetch(eventData.messageId).catch(() => null);
        if (msg) await msg.delete();
      }

      // ✅ CORREÇÃO: Garantir que guildId está presente antes de salvar
      const eventDataToSave = {
        ...eventData,
        guildId: eventData.guildId || interaction.guild.id,
        participantes: new Map(eventData.participantes)
      };

      // Salvar em eventos finalizados antes de deletar
      if (!global.finishedEvents) global.finishedEvents = new Map();
      global.finishedEvents.set(eventId, eventDataToSave);
      console.log(`[EventHandler] Event ${eventId} saved to finishedEvents with guildId: ${eventDataToSave.guildId}`);

      global.activeEvents.delete(eventId);

      // ✅ Salvar após finalizar (remover do arquivo de ativos)
      this.saveEvents();

      await interaction.reply({
        content: '✅ **Evento finalizado com sucesso!**\n📊 Resumo criado em eventos encerrados.',
        ephemeral: true
      });

    } catch (error) {
      console.error('[handleFinalizar] Erro ao finalizar:', error);
      await interaction.reply({ content: '❌ Erro ao finalizar evento.', ephemeral: true });
    }
  }

  static async createFinishedEventChannel(interaction, eventData) {
    try {
      const categoriaEncerrados = interaction.guild.channels.cache.find(
        c => c.name === '📁 EVENTOS ENCERRADOS' && c.type === ChannelType.GuildCategory
      );

      if (!categoriaEncerrados) {
        console.error('[EventHandler] Categoria de eventos encerrados não encontrada');
        return;
      }

      // Buscar taxa da guilda
      const config = global.guildConfig?.get(interaction.guild.id) || {};
      const taxaGuilda = config.taxaGuilda || 10;

      // Calcular tempo total do evento
      let tempoTotalEvento = 0;
      if (eventData.inicioTimestamp && eventData.finalizadoEm) {
        tempoTotalEvento = eventData.finalizadoEm - eventData.inicioTimestamp;
      } else if (eventData.inicioTimestamp) {
        tempoTotalEvento = Date.now() - eventData.inicioTimestamp;
      }

      const tempoTotalMin = Math.floor(tempoTotalEvento / 1000 / 60);

      // Calcular tempo total de participação
      let tempoTotalParticipacao = 0;
      const participantesArray = Array.from(eventData.participantes.entries());

      participantesArray.forEach(([userId, data]) => {
        let tempo = data.tempoTotal || 0;
        if (!data.pausado && data.tempoInicio) {
          tempo += Date.now() - data.tempoInicio;
        }
        tempoTotalParticipacao += tempo;
      });

      // Criar lista detalhada de participantes
      const participantesDetalhados = participantesArray
        .map(([userId, data], index) => {
          let tempo = data.tempoTotal || 0;
          if (!data.pausado && data.tempoInicio) {
            tempo += Date.now() - data.tempoInicio;
          }

          const percentagem = tempoTotalParticipacao > 0 ?
            ((tempo / tempoTotalParticipacao) * 100).toFixed(2) :
            (100 / participantesArray.length).toFixed(2);

          const tempoMin = Math.floor(tempo / 1000 / 60);

          return `${index + 1}. **${data.nick}** — \`${tempoMin} min\` — **${percentagem}%**`;
        })
        .join('\n');

      const canalEncerrado = await interaction.guild.channels.create({
        name: `📁-${eventData.nome.substring(0, 20)}`,
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

      // Criar embed moderno
      const embedResumo = new EmbedBuilder()
        .setTitle(`✅ ┃ ${eventData.nome.toUpperCase()}`)
        .setDescription(
          `\\> ${eventData.descricao}\n\n` +
          `**👤 Criador:** <@${eventData.criadorId}>\n` +
          `**🕐 Horário:** \`${eventData.horario}\`\n` +
          `**⏱️ Duração Total:** \`${tempoTotalMin}\` minutos\n` +
          `**👥 Total de Participantes:** \`${eventData.participantes.size}\`\n` +
          `**📊 Taxa da Guilda:** \`${taxaGuilda}%\``
        )
        .setColor(0x2ECC71)
        .setThumbnail(interaction.guild.iconURL({ dynamic: true }))
        .addFields(
          {
            name: '🏆 Ranking de Participação',
            value: participantesDetalhados || '> Nenhum participante registrado',
            inline: false
          }
        )
        .setFooter({
          text: `ID: ${eventData.id} • Evento encerrado`,
          iconURL: interaction.user.displayAvatarURL()
        })
        .setTimestamp();

      // Botões de ação
      const botoes = new ActionRowBuilder()
        .addComponents(
          new ButtonBuilder()
            .setCustomId(`loot_simular_${eventData.id}`)
            .setLabel('💰 Simular Evento')
            .setStyle(ButtonStyle.Success)
            .setEmoji('💎')
        );

      await canalEncerrado.send({
        embeds: [embedResumo],
        components: [botoes]
      });

      console.log(`[EventHandler] Created finished event channel: ${canalEncerrado.name}`);

    } catch (error) {
      console.error('[EventHandler] Error creating finished event channel:', error);
    }
  }
}

module.exports = EventHandler;