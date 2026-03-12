const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const database = require('../utils/database');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('saldos')
    .setDescription('📊 Mostra o ranking de saldos dos jogadores do servidor')
    .addIntegerOption(option => 
      option.setName('quantidade')
        .setDescription('Quantidade de jogadores no ranking (padrão: 15, máx: 30)')
        .setMinValue(1)
        .setMaxValue(30)),

  async execute(interaction) {
    await interaction.deferReply();

    const quantidade = interaction.options.getInteger('quantidade') || 15;
    const guild = interaction.guild;
    const callerId = interaction.user.id;

    try {
      // Buscar TOP jogadores do banco de dados
      const users = await database.db.allAsync(`
        SELECT user_id, saldo, total_recebido 
        FROM users 
        WHERE saldo > 0 
        ORDER BY saldo DESC 
        LIMIT ?
      `, [quantidade]);

      if (users.length === 0) {
        return interaction.editReply({
          content: '💸 **Nenhum jogador possui saldo no momento.**\nSeja o primeiro a fazer um depósito!'
        });
      }

      // Calcular estatísticas totais
      const totalSaldo = users.reduce((acc, u) => acc + u.saldo, 0);
      const totalRecebido = users.reduce((acc, u) => acc + (u.total_recebido || 0), 0);
      const userIds = users.map(u => u.user_id);
      const callerInList = userIds.includes(callerId);

      // Se o usuário não estiver no TOP, buscar posição dele separadamente
      let callerPosition = null;
      let callerSaldo = null;

      if (!callerInList) {
        callerSaldo = await database.getSaldo(callerId);
        if (callerSaldo > 0) {
          const count = await database.db.getAsync(`
            SELECT COUNT(*) as pos FROM users WHERE saldo > ?
          `, [callerSaldo]);
          callerPosition = count.pos + 1;
        }
      } else {
        // Se estiver na lista, pegar o saldo atualizado
        callerSaldo = users.find(u => u.user_id === callerId)?.saldo || 0;
      }

      // Construir lista formatada com fetch de membros
      const lista = [];
      const medalhas = ['🥇', '🥈', '🥉'];

      for (let i = 0; i < users.length; i++) {
        const userData = users[i];
        let displayName;
        let avatarURL;

        try {
          const member = await guild.members.fetch(userData.user_id);
          displayName = member.nickname || member.user.username;
          avatarURL = member.user.displayAvatarURL({ size: 128 });
        } catch {
          // Usuário saiu do servidor
          const userCache = interaction.client.users.cache.get(userData.user_id);
          displayName = userCache ? `${userCache.username} 👻` : 'Desconhecido';
          avatarURL = null;
        }

        // Limitar tamanho do nome para alinhamento
        if (displayName.length > 18) {
          displayName = displayName.substring(0, 15) + '...';
        }

        const saldoFmt = userData.saldo.toLocaleString('pt-BR');
        const icon = i < 3 ? medalhas[i] : `\`${(i + 1).toString().padStart(2, '0')}\``;

        // Formatação especial para TOP 3
        if (i < 3) {
          lista.push(`${icon} **\`${displayName.padEnd(16)}\`** ➜ **\`${saldoFmt}\`** 💰`);
        } else {
          lista.push(`${icon} \`${displayName.padEnd(16)}\` ➜ \`${saldoFmt}\` 💰`);
        }
      }

      // Criar embed principal
      const embed = new EmbedBuilder()
        .setTitle(`🏆 Ranking de Saldos - TOP ${users.length}`)
        .setDescription(
          '```yaml\n' +
          '💰 MAIORES FORTUNAS DO SERVIDOR 💰\n' +
          '```\n' +
          lista.join('\n')
        )
        .setColor(0xFFD700) // Dourado
        .setThumbnail('https://cdn-icons-png.flaticon.com/512/2913/2913465.png') // Ícone de tesouro
        .addFields(
          { 
            name: '💵 Total em Circulação', 
            value: `\`\`\`autohotkey\n${totalSaldo.toLocaleString('pt-BR')} silver\`\`\``, 
            inline: true 
          },
          { 
            name: '📈 Total Movimentado', 
            value: `\`\`\`autohotkey\n${totalRecebido.toLocaleString('pt-BR')} silver\`\`\``, 
            inline: true 
          },
          { 
            name: '👥 Jogadores no Ranking', 
            value: `\`\`\`autohotkey\n${users.length}\`\`\``, 
            inline: true 
          }
        )
        .setTimestamp()
        .setFooter({ 
          text: `💡 Seu saldo: ${callerSaldo.toLocaleString('pt-BR')} silver ${callerPosition ? `(Pos: #${callerPosition})` : ''}`, 
          iconURL: interaction.user.displayAvatarURL() 
        });

      // Se o usuário tem saldo mas não está no TOP, mostrar aviso
      if (!callerInList && callerSaldo > 0) {
        embed.addFields({
          name: '📍 Sua Posição no Ranking Geral',
          value: `Você está em **#${callerPosition}** lugar com **${callerSaldo.toLocaleString('pt-BR')}** 💰`,
          inline: false
        });
      } else if (callerSaldo === 0) {
        embed.addFields({
          name: '⚠️ Você não possui saldo',
          value: 'Faça um depósito para entrar no ranking!',
          inline: false
        });
      }

      // Adicionar imagem de ouro/prata/bronze lateral se quiser (opcional)
      if (users[0]) {
        try {
          const top1 = await guild.members.fetch(users[0].user_id);
          embed.setAuthor({
            name: `👑 Rei do Saldo: ${top1.nickname || top1.user.username}`,
            iconURL: top1.user.displayAvatarURL({ size: 64 })
          });
        } catch {
          // ignora se não encontrar
        }
      }

      await interaction.editReply({ embeds: [embed] });

    } catch (error) {
      console.error('[SaldosCommand] Erro ao executar:', error);
      await interaction.editReply({
        content: '❌ **Erro ao carregar ranking!**\nVerifique se o sistema de banco de dados está online.'
      });
    }
  }
};