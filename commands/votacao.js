// Comando para adicionar reações ao post de votação
const { SlashCommandBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('votacao')
    .setDescription('Cria post de votação com reações automáticas'),

  async execute(interaction) {
    const embed = {
      color: 0x0099ff,
      title: '🗳️ ESCOLHER HORÁRIO / CONTEÚDO DIA 13/05/2026 UTC DO GAME',
      fields: [
        {
          name: '🎁 RAID AVALON - Escolha o horário:',
          value: '1️⃣ 18h | 2️⃣ 19h | 3️⃣ 20h | 4️⃣ 21h | 5️⃣ 22h | 6️⃣ 23h | 7️⃣ 00h',
          inline: false
        },
        {
          name: '🔮 ROAMING PVE + FIGHT + OC - Escolha o horário:',
          value: '🅰️ 18h | 🅱️ 19h | 🅲️ 20h | 🅳️ 21h | 🅴️ 22h | 🅵️ 23h | 🅶️ 00h',
          inline: false
        }
      ],
      footer: { text: '@Membro @Convidado - Votem agora! ⬇️' }
    };

    const message = await interaction.channel.send({ embeds: [embed] });

    // Reações para RAID AVALON (números)
    await message.react('1️⃣');
    await message.react('2️⃣');
    await message.react('3️⃣');
    await message.react('4️⃣');
    await message.react('5️⃣');
    await message.react('6️⃣');
    await message.react('7️⃣');

    // Reações para ROAMING (letras)
    await message.react('🅰️');
    await message.react('🅱️');
    await message.react('🅲️');
    await message.react('🅳️');
    await message.react('🅴️');
    await message.react('🅵️');
    await message.react('🅶️');

    await interaction.reply({ content: '✅ Post de votação criado com sucesso!', ephemeral: true });
  }
};
