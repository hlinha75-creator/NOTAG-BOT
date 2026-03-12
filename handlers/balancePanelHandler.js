const { 
 EmbedBuilder, 
 ActionRowBuilder, 
 ButtonBuilder, 
 ButtonStyle, 
 PermissionFlagsBits 
} = require('discord.js');
const Database = require('../utils/database');

/**
 * Handler do Painel de Saldo da Guilda - Versão Moderna
 * Mostra: Saldo Geral, Arrecadação de Taxas, Empréstimos, Saldo Líquido
 * Atualização automática a cada 2 minutos
 */

class BalancePanelHandler {
 static activeIntervals = new Map(); // Controle de intervals por guilda

 /**
  * Wrapper para compatibilidade
  */
 static async sendPanel(channel, guild) {
  try {
   console.log(`[BalancePanel] Wrapper sendPanel chamado`);
   return await this.createAndSendPanel(channel, guild);
  } catch (error) {
   console.error(`[BalancePanel] Erro no wrapper:`, error);
   throw error;
  }
 }

 /**
  * Cria e envia o painel moderno
  */
 static async createAndSendPanel(channel, guild) {
  try {
   if (!channel || !guild) {
    console.error('[BalancePanel] Channel ou Guild undefined');
    return;
   }

   if (!channel.isTextBased()) {
    console.error('[BalancePanel] Canal não é texto');
    return;
   }

   const botMember = await guild.members.fetch(channel.client.user.id).catch(() => guild.members.me);
   if (!botMember) {
    console.error('[BalancePanel] Bot member não encontrado');
    return;
   }

   const permissions = channel.permissionsFor(botMember);
   if (!permissions?.has(PermissionFlagsBits.SendMessages)) {
    console.error('[BalancePanel] Sem permissão para enviar mensagens');
    return;
   }

   // Busca dados financeiros detalhados
   const stats = await Database.getGuildDetailedStats(guild.id);

   const embed = this.createModernEmbed(stats, guild);
   const components = this.createComponents();

   // Limpa interval anterior se existir
   if (this.activeIntervals.has(guild.id)) {
    clearInterval(this.activeIntervals.get(guild.id));
   }

   const message = await channel.send({
    embeds: [embed],
    components: components
   });

   console.log(`[BalancePanel] Painel enviado em #${channel.name}`);

   // Inicia auto-update a cada 2 minutos (120000ms)
   const intervalId = setInterval(async () => {
    try {
     const freshStats = await Database.getGuildDetailedStats(guild.id);
     const updatedEmbed = this.createModernEmbed(freshStats, guild);

     await message.edit({ embeds: [updatedEmbed] });
     console.log(`[BalancePanel] Auto-atualizado em #${channel.name} - ${new Date().toLocaleTimeString()}`);
    } catch (err) {
     console.error('[BalancePanel] Erro no auto-update:', err);
    }
   }, 120000); // 2 minutos

   this.activeIntervals.set(guild.id, intervalId);

   // Auto-limpa após 24h para evitar memory leak
   setTimeout(() => {
    if (this.activeIntervals.has(guild.id)) {
     clearInterval(this.activeIntervals.get(guild.id));
     this.activeIntervals.delete(guild.id);
    }
   }, 24 * 60 * 60 * 1000);

  } catch (error) {
   console.error('[BalancePanel] Erro criando painel:', error);
  }
 }

 /**
  * Cria embed moderno e estilizado
  */
 static createModernEmbed(stats, guild) {
  const { 
   saldoGeral, 
   arrecadacaoTaxas, 
   emprestimosPendentes, 
   saldoLiquido,
   membrosAtivos 
  } = stats;

  // Calcula porcentagens para visualização
  const taxaPercent = saldoGeral > 0 ? ((arrecadacaoTaxas / saldoGeral) * 100).toFixed(1) : 0;
  const emprestimoPercent = saldoGeral > 0 ? ((emprestimosPendentes / saldoGeral) * 100).toFixed(1) : 0;

  const embed = new EmbedBuilder()
   .setTitle('🏦 SALDO DA GUILDA')
   .setDescription(
    `> **${guild.name}**\n` +
    `> Sistema Financeiro Integrado\n` +
    `> Atualizado: <t:${Math.floor(Date.now() / 1000)}:R>`
   )
   .setColor(0x2ECC71) // Verde esmeralda
   .setThumbnail(guild.iconURL({ dynamic: true, size: 128 }) || 'https://i.imgur.com/5K9Q5ZK.png')
   .setImage('https://i.imgur.com/JPepvGx.png') // Banner decorativo opcional
   .addFields(
    {
     name: '💰 SALDO GERAL',
     value: `\`\`\`fix\n${this.formatNumber(saldoGeral)} pratas\`\`\``,
     inline: false
    },
    {
     name: '📊 ARRECADAÇÃO DE TAXAS',
     value: `\`\`\`yaml\n${this.formatNumber(arrecadacaoTaxas)} pratas\n(${taxaPercent}% do total)\`\`\``,
     inline: true
    },
    {
     name: '💳 EMPRÉSTIMOS PENDENTES',
     value: `\`\`\`diff\n- ${this.formatNumber(emprestimosPendentes)} pratas\n(${emprestimoPercent}% do total)\`\`\``,
     inline: true
    },
    {
     name: '✨ SALDO LÍQUIDO',
     value: `\`\`\`diff\n+ ${this.formatNumber(saldoLiquido)} pratas\n(Livre de dívidas)\`\`\``,
     inline: false
    },
    {
     name: '👥 MEMBROS ATIVOS',
     value: `\`${membrosAtivos} membros\``,
     inline: true
    },
    {
     name: '🔄 AUTO-UPDATE',
     value: '`A cada 2 minutos`',
     inline: true
    }
   )
   .setFooter({ 
    text: 'NOTAG Bot • Sistema Financeiro Avançado', 
    iconURL: 'https://i.imgur.com/8QBYRrm.png' 
   })
   .setTimestamp();

  return embed;
 }

 /**
  * Cria botões modernos
  */
 static createComponents() {
  return [
   new ActionRowBuilder().addComponents(
    new ButtonBuilder()
     .setCustomId('btn_saldo_atualizar')
     .setLabel('🔄 Atualizar Agora')
     .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
     .setCustomId('btn_saldo_detalhes')
     .setLabel('📊 Ver Detalhes')
     .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
     .setCustomId('btn_saldo_historico')
     .setLabel('📜 Histórico')
     .setStyle(ButtonStyle.Secondary)
   )
  ];
 }

 /**
  * Handler para atualização manual
  */
 static async handleAtualizar(interaction) {
  try {
   await interaction.deferUpdate();

   const stats = await Database.getGuildDetailedStats(interaction.guild.id);
   const embed = this.createModernEmbed(stats, interaction.guild);

   await interaction.editReply({ embeds: [embed] });

   // Log silencioso
   console.log(`[BalancePanel] Atualizado manualmente por ${interaction.user.tag}`);

  } catch (error) {
   console.error('[BalancePanel] Erro na atualização manual:', error);
   await interaction.followUp({
    content: '❌ Erro ao atualizar painel.',
    ephemeral: true
   });
  }
 }

 /**
  * Handler para ver detalhes (mostra top membros)
  */
 static async handleDetalhes(interaction) {
  try {
   await interaction.deferReply({ ephemeral: true });

   // Busca top 10 membros com maior saldo
   const topUsers = await Database.db.allAsync(`
    SELECT user_id, saldo, total_recebido, total_sacado 
    FROM users 
    ORDER BY saldo DESC 
    LIMIT 10
   `) || [];

   let description = '**💎 TOP 10 MEMBROS (Por Saldo)**\n\n';

   if (topUsers.length === 0) {
    description += '*Nenhum dado disponível*';
   } else {
    topUsers.forEach((user, index) => {
     const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : '•';
     description += `${medal} <@${user.user_id}>: \`${this.formatNumber(user.saldo)}\` pratas\n`;
    });
   }

   const embed = new EmbedBuilder()
    .setTitle('📊 Detalhes Financeiros')
    .setDescription(description)
    .setColor(0x3498DB)
    .setTimestamp();

   await interaction.editReply({ embeds: [embed] });

  } catch (error) {
   console.error('[BalancePanel] Erro ao mostrar detalhes:', error);
   await interaction.editReply({
    content: '❌ Erro ao carregar detalhes.'
   });
  }
 }

 /**
  * Formata números grandes
  */
 static formatNumber(num) {
  if (num === undefined || num === null || isNaN(num)) return '0';
  return num.toLocaleString('pt-BR');
 }
}

module.exports = BalancePanelHandler;