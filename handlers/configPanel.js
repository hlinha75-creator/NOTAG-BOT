const {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle
} = require('discord.js');
const Database = require('../utils/database');

class ConfigPanel {
  // Criar embed do painel de configurações
  static async createConfigEmbed(guildId) {
    // Buscar do banco de dados em vez de global.guildConfig
    const dbConfig = await Database.getGuildConfig(guildId);

    return new EmbedBuilder()
      .setTitle('⚙️ **PAINEL DE CONFIGURAÇÕES**')
      .setDescription('Configure as opções do bot para este servidor.\n\n*Apenas membros com o cargo **ADM** podem alterar estas configurações.*')
      .setColor(0x3498DB)
      .addFields(
        {
          name: '🌐 **Idioma**',
          value: `\`${dbConfig.idioma}\`\n*(Fixo por enquanto)*`,
          inline: true
        },
        {
          name: '💰 **Taxa da Guilda**',
          value: `\`${dbConfig.taxaGuilda}%\`\nTaxa em eventos`,
          inline: true
        },
        {
          name: '🏰 **Guilda Registrada**',
          value: dbConfig.guildaRegistrada
            ? `**${dbConfig.guildaRegistrada.nome}**\n🌍 ${dbConfig.guildaRegistrada.server}\n✅ Verificada`
            : '❌ *Nenhuma guilda registrada*',
          inline: false
        },
        {
          name: '⭐ **Sistema XP**',
          value: dbConfig.xpAtivo ? '✅ Ativado' : '🔴 Desativado',
          inline: true
        },
        {
          name: '📦 **Taxa Venda Baú**',
          value: `Royal: \`${dbConfig.taxasBau.royal}%\`\nBlack: \`${dbConfig.taxasBau.black}%\`\nBrecilien: \`${dbConfig.taxasBau.brecilien}%\`\nAvalon: \`${dbConfig.taxasBau.avalon}%\``,
          inline: true
        },
        {
          name: '💳 **Taxa Empréstimo**',
          value: `\`${dbConfig.taxaEmprestimo}%\`\n${dbConfig.taxaEmprestimo > 0 ? '✅ Ativo' : '🔴 Inativo'}`,
          inline: true
        }
      )
      .setFooter({ text: 'Clique nos botões abaixo para configurar • Dados salvos automaticamente' })
      .setTimestamp();
  }

  // Criar botões do painel
  static createConfigButtons() {
    return [
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
          .setLabel('📦 Taxas de Baú')
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
  }

  // Enviar painel no canal
  static async sendPanel(channel) {
    try {
      const embed = await this.createConfigEmbed(channel.guild.id);
      const buttons = this.createConfigButtons();

      await channel.send({
        embeds: [embed],
        components: buttons
      });

      console.log(`✅ Painel de configurações enviado em ${channel.name}`);
      return true;
    } catch (error) {
      console.error('❌ Erro ao enviar painel de config:', error);
      return false;
    }
  }

  // Atualizar painel existente
  static async updatePanel(message) {
    try {
      const embed = await this.createConfigEmbed(message.guild.id);
      const buttons = this.createConfigButtons();

      await message.edit({
        embeds: [embed],
        components: buttons
      });
      return true;
    } catch (error) {
      console.error('❌ Erro ao atualizar painel:', error);
      return false;
    }
  }
}

module.exports = ConfigPanel;