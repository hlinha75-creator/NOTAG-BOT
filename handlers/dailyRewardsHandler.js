const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const Database = require('../utils/database');
const XpHandler = require('./xpHandler');

/**
 * Sistema de Presença Diária (Daily Check-in)
 * Streaks, recompensas crescentes, bônus por sequência
 */

class DailyRewardsHandler {
  constructor() {
    this.rewards = {
      baseXP: 50,
      baseSaldo: 1000,
      streakBonus: 0.1, // +10% por dia de streak
      maxStreakBonus: 2.0, // Máximo 200% bônus (10 dias)
      milestones: {
        7: { xp: 200, saldo: 5000, title: 'Semana Completa!' },
        30: { xp: 1000, saldo: 25000, title: 'Mensalista Fiel!' },
        100: { xp: 5000, saldo: 100000, title: 'Veterano Dedicado!' }
      }
    };
  }

  /**
   * Processa check-in diário
   */
  static async processCheckin(interaction) {
    try {
      const userId = interaction.user.id;
      const guildId = interaction.guild.id;

      // Verifica se já fez check-in hoje
      const todayCheck = Database.getTodayCheckin(userId);
      if (todayCheck) {
        const embed = new EmbedBuilder()
          .setTitle('📅 Check-in Diário')
          .setDescription('Você já fez check-in hoje!\nVolte amanhã para continuar sua streak.')
          .addFields(
            { name: '🔥 Streak Atual', value: `${todayCheck.streak} dias`, inline: true },
            { name: '⏰ Próximo check-in', value: '<t:' + Math.floor((Date.now() + 24 * 60 * 60 * 1000) / 1000) + ':R>', inline: true }
          )
          .setColor(0x95A5A6)
          .setTimestamp();

        return interaction.reply({ embeds: [embed], ephemeral: true });
      }

      // Calcula streak
      const user = Database.getUser(userId);
      let streak = 1;

      if (user.ultimoCheckin) {
        const lastCheck = new Date(user.ultimoCheckin);
        const today = new Date();
        const diffDays = Math.floor((today - lastCheck) / (1000 * 60 * 60 * 24));

        if (diffDays === 1) {
          streak = user.streakDiaria + 1; // Continua streak
        } else if (diffDays === 0) {
          // Já fez hoje (segunda verificação)
          return interaction.reply({ content: '❌ Você já fez check-in hoje!', ephemeral: true });
        }
        // Se diffDays > 1, streak resetada para 1
      }

      // Calcula recompensas
      const rewards = this.calculateRewards(streak);

      // Aplica recompensas
      Database.addSaldo(userId, rewards.saldo, 'daily_checkin');

      // Adiciona XP
      await XpHandler.addXp(userId, rewards.xp, 'daily_checkin', interaction.guild, interaction.channel);

      // Registra check-in
      Database.recordCheckin(userId, guildId, {
        xp: rewards.xp,
        saldo: rewards.saldo,
        streak: streak
      });

      // Verifica milestones
      let milestoneBonus = null;
      if (this.rewards.milestones[streak]) {
        milestoneBonus = this.rewards.milestones[streak];
        Database.addSaldo(userId, milestoneBonus.saldo, 'streak_milestone');
        await XpHandler.addXp(userId, milestoneBonus.xp, 'streak_milestone', interaction.guild, interaction.channel);
      }

      // Cria embed de resposta
      const embed = new EmbedBuilder()
        .setTitle('✅ Check-in Diário Realizado!')
        .setDescription(`Parabéns, <@${userId}>! Você recebeu suas recompensas diárias.`)
        .addFields(
          { 
            name: '💰 Recompensas Base', 
            value: `+${rewards.saldo.toLocaleString()} prata\n+${rewards.xp} XP`, 
            inline: true 
          },
          { 
            name: '🔥 Streak', 
            value: `${streak} dias ${streak > 1 ? '(+' + Math.floor((rewards.bonus - 1) * 100) + '% bônus)' : ''}`, 
            inline: true 
          }
        )
        .setColor(0x2ECC71)
        .setThumbnail(interaction.user.displayAvatarURL())
        .setTimestamp();

      if (milestoneBonus) {
        embed.addFields({
          name: '🎉 Bônus de Milestone!',
          value: `**${milestoneBonus.title}**\n+${milestoneBonus.saldo.toLocaleString()} prata\n+${milestoneBonus.xp} XP`,
          inline: false
        });
        embed.setColor(0xFFD700); // Dourado para milestones
      }

      // Botão para ver ranking
      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('btn_daily_ranking')
          .setLabel('📊 Ver Ranking')
          .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
          .setCustomId('btn_daily_info')
          .setLabel('ℹ️ Como funciona')
          .setStyle(ButtonStyle.Secondary)
      );

      await interaction.reply({ embeds: [embed], components: [row], ephemeral: false });

      // Log
      Database.logAudit('DAILY_CHECKIN', userId, {
        streak: streak,
        rewards: rewards
      }, guildId);

    } catch (error) {
      console.error('[Daily] Error processing checkin:', error);
      await interaction.reply({ content: '❌ Erro ao processar check-in.', ephemeral: true });
    }
  }

  /**
   * Calcula recompensas baseadas na streak
   */
  static calculateRewards(streak) {
    const base = {
      xp: this.rewards.baseXP,
      saldo: this.rewards.baseSaldo,
      bonus: 1
    };

    // Calcula bônus de streak (10% por dia, max 100%)
    const streakBonus = Math.min(streak * this.rewards.streakBonus, this.rewards.maxStreakBonus);
    base.bonus = 1 + streakBonus;

    base.xp = Math.floor(base.xp * base.bonus);
    base.saldo = Math.floor(base.saldo * base.bonus);

    return base;
  }

  /**
   * Mostra ranking de streaks
   */
  static async showRanking(interaction) {
    try {
      // Busca top 10 streaks do servidor
      const stmt = Database.db.prepare(`
        SELECT user_id, streak_diaria, ultimo_checkin 
        FROM users 
        WHERE streak_diaria > 0 
        ORDER BY streak_diaria DESC, ultimo_checkin DESC 
        LIMIT 10
      `);

      const topStreaks = stmt.all();

      const embed = new EmbedBuilder()
        .setTitle('🏆 Ranking de Streaks Diários')
        .setDescription('Os membros mais dedicados da guilda!')
        .setColor(0xF1C40F)
        .setTimestamp();

      if (topStreaks.length === 0) {
        embed.addFields({ name: '📭 Nenhum dado', value: 'Ninguém fez check-in ainda. Seja o primeiro!' });
      } else {
        topStreaks.forEach((entry, index) => {
          const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : '•';
          const date = entry.ultimo_checkin ? new Date(entry.ultimo_checkin).toLocaleDateString() : 'Nunca';

          embed.addFields({
            name: `${medal} ${index + 1}º Lugar`,
            value: `<@${entry.user_id}>\n🔥 ${entry.streak_diaria} dias\n📅 Último: ${date}`,
            inline: true
          });
        });
      }

      await interaction.reply({ embeds: [embed], ephemeral: true });

    } catch (error) {
      console.error('[Daily] Error showing ranking:', error);
      await interaction.reply({ content: '❌ Erro ao carregar ranking.', ephemeral: true });
    }
  }

  /**
   * Mostra informações do sistema
   */
  static async showInfo(interaction) {
    const embed = new EmbedBuilder()
      .setTitle('ℹ️ Sistema de Presença Diária')
      .setDescription('Ganhe recompensas todos os dias por fazer check-in!')
      .addFields(
        { 
          name: '💰 Recompensas Base', 
          value: `• ${this.rewards.baseSaldo.toLocaleString()} prata\n• ${this.rewards.baseXP} XP`, 
          inline: true 
        },
        { 
          name: '🔥 Bônus de Streak', 
          value: `+${(this.rewards.streakBonus * 100)}% por dia consecutivo\nMáximo: +${(this.rewards.maxStreakBonus * 100)}%`, 
          inline: true 
        },
        { 
          name: '🎯 Milestones', 
          value: '• 7 dias: +5k prata + 200 XP\n• 30 dias: +25k prata + 1k XP\n• 100 dias: +100k prata + 5k XP', 
          inline: false 
        },
        { 
          name: '⚠️ Importante', 
          value: 'Se perder um dia, sua streak volta para zero!\nUse `/checkin` ou o botão no canal de recompensas.', 
          inline: false 
        }
      )
      .setColor(0x3498DB)
      .setTimestamp();

    await interaction.reply({ embeds: [embed], ephemeral: true });
  }

  /**
   * Cria painel de check-in (para canal fixo)
   */
  static async createCheckinPanel(channel) {
    const embed = new EmbedBuilder()
      .setTitle('📅 Check-in Diário')
      .setDescription('Clique no botão abaixo para fazer seu check-in diário e ganhar recompensas!\n\n💰 Recompensas aumentam conforme sua streak!')
      .setColor(0x2ECC71)
      .setImage('https://i.imgur.com/JPepvGx.png') // Banner opcional
      .setTimestamp();

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('btn_daily_checkin')
        .setLabel('✅ Fazer Check-in')
        .setStyle(ButtonStyle.Success)
        .setEmoji('📅'),
      new ButtonBuilder()
        .setCustomId('btn_daily_ranking')
        .setLabel('🏆 Ranking')
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId('btn_daily_info')
        .setLabel('ℹ️ Info')
        .setStyle(ButtonStyle.Secondary)
    );

    await channel.send({ embeds: [embed], components: [row] });
  }
}

// Inicializa recompensas estáticas
DailyRewardsHandler.rewards = {
  baseXP: 50,
  baseSaldo: 1000,
  streakBonus: 0.1,
  maxStreakBonus: 2.0,
  milestones: {
    7: { xp: 200, saldo: 5000, title: 'Semana Completa!' },
    30: { xp: 1000, saldo: 25000, title: 'Mensalista Fiel!' },
    100: { xp: 5000, saldo: 100000, title: 'Veterano Dedicado!' }
  }
};

module.exports = DailyRewardsHandler;