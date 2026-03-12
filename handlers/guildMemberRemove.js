const { EmbedBuilder } = require('discord.js');

class GuildMemberRemoveHandler {
  static async handle(member) {
    try {
      const guild = member.guild;

      // Verificar se o membro tinha algum cargo de registro
      const cargosRegistro = ['Membro', 'Aliança', 'Convidado'];
      const teveCargo = member.roles.cache.some(r => cargosRegistro.includes(r.name));

      // Só logar se teve cargo de registro (evita logar quem entrou e saiu sem se registrar)
      if (!teveCargo) return;

      const canalSaida = guild.channels.cache.find(c => c.name === '🚪╠saída-membros');
      if (!canalSaida) return;

      const embed = new EmbedBuilder()
        .setTitle('🚪 Membro Saiu do Servidor')
        .setDescription(`**${member.user.tag}** saiu do Discord`)
        .setColor(0xE74C3C)
        .setThumbnail(member.user.displayAvatarURL({ dynamic: true }))
        .addFields(
          { name: '👤 Nick no Discord', value: member.nickname || member.user.username, inline: true },
          { name: '🆔 ID', value: member.id, inline: true },
          {
            name: '📅 Entrou em',
            value: member.joinedAt ? `<t:${Math.floor(member.joinedAt.getTime() / 1000)}:D>` : 'Desconhecido',
            inline: true
          },
          { name: '⏱️ Tempo no Servidor', value: this.calculateTime(member.joinedAt), inline: true }
        )
        .setFooter({ text: `Total de membros agora: ${guild.memberCount}` })
        .setTimestamp();

      await canalSaida.send({ embeds: [embed] });

    } catch (error) {
      console.error('Erro ao processar saída de membro:', error);
    }
  }

  static calculateTime(joinedAt) {
    if (!joinedAt) return 'Desconhecido';

    const now = new Date();
    const diff = now - joinedAt;

    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const months = Math.floor(days / 30);
    const years = Math.floor(months / 12);

    if (years > 0) return `${years} ano(s) e ${months % 12} mês(es)`;
    if (months > 0) return `${months} mês(es) e ${days % 30} dia(s)`;
    return `${days} dia(s)`;
  }
}

module.exports = GuildMemberRemoveHandler;