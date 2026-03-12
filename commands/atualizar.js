const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('atualizar')
    .setDescription('Atualiza informações de um membro no evento')
    .addUserOption(option =>
      option.setName('membro')
        .setDescription('Membro a ser atualizado')
        .setRequired(true))
    .addStringOption(option =>
      option.setName('porcentagem')
        .setDescription('Nova porcentagem de participação (0-100)')
        .setRequired(true)),

  async execute(interaction) {
    try {
      console.log(`[Command:atualizar] Executed by ${interaction.user.id}`);

      // Verificar permissões
      const isADM = interaction.member.roles.cache.some(r => r.name === 'ADM');
      const isStaff = interaction.member.roles.cache.some(r => r.name === 'Staff');

      if (!isADM && !isStaff) {
        return interaction.reply({
          content: '❌ Apenas ADM ou Staff podem usar este comando!',
          ephemeral: true
        });
      }

      const membro = interaction.options.getUser('membro');
      const porcentagemStr = interaction.options.getString('porcentagem');
      const porcentagem = parseFloat(porcentagemStr);

      if (isNaN(porcentagem) || porcentagem < 0 || porcentagem > 100) {
        return interaction.reply({
          content: '❌ Porcentagem inválida! Use um valor entre 0 e 100.',
          ephemeral: true
        });
      }

      // Buscar evento ativo no canal atual ou nos dados do usuário
      let eventoEncontrado = null;

      for (const [eventId, eventData] of global.activeEvents) {
        if (eventData.participantes.has(membro.id)) {
          eventoEncontrado = { id: eventId, data: eventData };
          break;
        }
      }

      if (!eventoEncontrado) {
        return interaction.reply({
          content: '❌ Membro não está participando de nenhum evento ativo!',
          ephemeral: true
        });
      }

      const participante = eventoEncontrado.data.participantes.get(membro.id);

      // Calcular novo tempo baseado na porcentagem
      // Se o evento tem X tempo total, o participante deve ter X * porcentagem/100
      let tempoTotalEvento = 0;
      if (eventoEncontrado.data.inicioTimestamp) {
        tempoTotalEvento = Date.now() - eventoEncontrado.data.inicioTimestamp;
      }

      const novoTempo = Math.floor(tempoTotalEvento * (porcentagem / 100));

      // Atualizar dados do participante
      const tempoAnterior = participante.tempoTotal;
      participante.tempoTotal = novoTempo;
      participante.tempoInicio = null; // Resetar tempo de início para não continuar contando

      console.log(`[Command:atualizar] Updated ${membro.id} in event ${eventoEncontrado.id}: ${tempoAnterior} -> ${novoTempo} (${porcentagem}%)`);

      await interaction.reply({
        content: `✅ **Participação atualizada!**\\n\\n` +
                 `**Membro:** <@${membro.id}>\\n` +
                 `**Evento:** ${eventoEncontrado.data.nome}\\n` +
                 `**Nova participação:** ${porcentagem}%\\n` +
                 `**Tempo calculado:** ${Math.floor(novoTempo / 1000 / 60)} minutos`,
        ephemeral: true
      });

    } catch (error) {
      console.error('[Command:atualizar] Error:', error);
      await interaction.reply({
        content: '❌ Erro ao atualizar participação.',
        ephemeral: true
      });
    }
  }
};