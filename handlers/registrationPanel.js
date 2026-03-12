const {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  AttachmentBuilder
} = require('discord.js');
const fs = require('fs');
const path = require('path');

class RegistrationPanel {
  // Criar embed do painel de boas-vindas
  static async createWelcomeEmbed() {
    const embed = new EmbedBuilder()
      .setTitle('🛡️ Bem-vindo à Guilda!')
      .setDescription(
        '> Olá, aventureiro! Para fazer parte da nossa guilda, você precisa se registrar.\n\n' +
        '**Como funciona:**\n' +
        '1️⃣ Clique no botão **Registrar** abaixo\n' +
        '2️⃣ Preencha seus dados do Albion Online\n' +
        '3️⃣ Selecione seu servidor e plataforma\n' +
        '4️⃣ Aguarde a validação automática e aprovação da staff\n\n' +
        '**Requisitos:**\n' +
        '• Ter o jogo Albion Online\n' +
        '• Informar seu nick exato do jogo\n' +
        '• Estar na guilda (ou informar guilda atual)\n\n' +
        '_Após o registro, nossa staff irá analisar e atribuir o cargo adequado._'
      )
      .setColor(0x3498DB)
      .setFooter({ text: 'Sistema de Registro • Guild Bot' })
      .setTimestamp();

    return embed;
  }

  // Verificar se imagem existe e retornar attachment
  static async getImageAttachment() {
    try {
      const imagePath = path.join(__dirname, '..', 'png', 'registrar.png');

      if (fs.existsSync(imagePath)) {
        return new AttachmentBuilder(imagePath, { name: 'registrar.png' });
      }

      console.log('⚠️ Imagem png/registrar.png não encontrada');
      return null;
    } catch (error) {
      console.error('Erro ao carregar imagem:', error);
      return null;
    }
  }

  // Criar botão de registrar
  static createRegisterButton() {
    return new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('btn_abrir_registro')
        .setLabel('📝 Registrar')
        .setStyle(ButtonStyle.Success)
        .setEmoji('✨')
    );
  }

  // Enviar painel no canal
  static async sendPanel(channel) {
    try {
      const embed = await this.createWelcomeEmbed();
      const button = this.createRegisterButton();
      const attachment = await this.getImageAttachment();

      const messageOptions = {
        embeds: [embed],
        components: [button]
      };

      if (attachment) {
        messageOptions.files = [attachment];
        embed.setImage('attachment://registrar.png');
      }

      await channel.send(messageOptions);
      console.log(`✅ Painel de registro enviado em ${channel.name}`);
      return true;
    } catch (error) {
      console.error('❌ Erro ao enviar painel:', error);
      return false;
    }
  }

  // Atualizar painel existente
  static async updatePanel(message) {
    try {
      const embed = await this.createWelcomeEmbed();
      const button = this.createRegisterButton();
      const attachment = await this.getImageAttachment();

      const messageOptions = {
        embeds: [embed],
        components: [button]
      };

      if (attachment) {
        messageOptions.files = [attachment];
        embed.setImage('attachment://registrar.png');
      }

      await message.edit(messageOptions);
      return true;
    } catch (error) {
      console.error('❌ Erro ao atualizar painel:', error);
      return false;
    }
  }
}

module.exports = RegistrationPanel;