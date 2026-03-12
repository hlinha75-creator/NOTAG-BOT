const { PermissionFlagsBits } = require('discord.js');
const Validator = require('./validator');

/**
 * Middleware de segurança centralizado
 * Gerencia permissões, sanitização e auditoria de ações
 */

class SecurityMiddleware {
  constructor() {
    this.rateLimits = new Map();
    this.suspiciousActions = new Map();
    this.locks = new Map(); // Para prevenir race conditions
  }

  /**
   * Middleware de permissão reutilizável
   * @param {Object} options 
   * @param {string[]} options.roles - Nomes ou IDs de cargos permitidos
   * @param {boolean} options.adminOnly 
   * @param {boolean} options.creatorOnly - Apenas criador do evento/item
   * @param {string} options.customIdPrefix - Prefixo para extrair ID
   */
  requirePermission(options = {}) {
    return async (interaction, next) => {
      try {
        const { roles = [], adminOnly = false, creatorOnly = false, customIdPrefix } = options;

        // Verifica rate limit
        const rateLimitKey = `${interaction.user.id}-${interaction.customId || interaction.commandName}`;
        const rateCheck = Validator.checkRateLimit(this.rateLimits, rateLimitKey, 1000);
        if (!rateCheck.allowed) {
          return interaction.reply({
            content: `⏳ Aguarde ${rateCheck.remaining}s antes de tentar novamente.`,
            ephemeral: true
          });
        }

        // Verifica admin
        if (adminOnly && !interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
          await this.logDeniedAccess(interaction, 'ADMIN_REQUIRED');
          return interaction.reply({
            content: '❌ Apenas administradores podem realizar esta ação.',
            ephemeral: true
          });
        }

        // Verifica cargos
        if (roles.length > 0 && !Validator.hasPermission(interaction.member, roles, adminOnly)) {
          await this.logDeniedAccess(interaction, 'ROLE_REQUIRED');
          return interaction.reply({
            content: `❌ Você precisa de um dos cargos: ${roles.join(', ')}`,
            ephemeral: true
          });
        }

        // Verifica se é criador (para eventos específicos)
        if (creatorOnly && customIdPrefix) {
          const extraction = Validator.extractIdFromCustomId(interaction.customId, customIdPrefix);
          if (extraction.valid) {
            const eventId = extraction.id;
            const eventData = global.activeEvents?.get(eventId) || global.finishedEvents?.get(eventId);

            if (eventData && eventData.criadorId !== interaction.user.id) {
              // Se não é criador, verifica se é ADM/Staff
              const isStaff = Validator.hasPermission(interaction.member, ['ADM', 'Staff']);
              if (!isStaff) {
                await this.logDeniedAccess(interaction, 'CREATOR_REQUIRED');
                return interaction.reply({
                  content: '❌ Apenas o criador do evento ou Staff pode fazer isso.',
                  ephemeral: true
                });
              }
            }
          }
        }

        // Se passou todas as verificações, prossegue
        await next();

      } catch (error) {
        console.error('[Security] Error in permission middleware:', error);
        if (!interaction.replied && !interaction.deferred) {
          await interaction.reply({
            content: '❌ Erro de segurança. Contate um administrador.',
            ephemeral: true
          });
        }
      }
    };
  }

  /**
   * Sanitiza inputs de modais
   * @param {ModalSubmitInteraction} interaction 
   * @param {Object} fields - Map de field IDs e suas validações
   */
  async validateModalInputs(interaction, fields) {
    const results = {};
    const errors = [];

    for (const [fieldId, validation] of Object.entries(fields)) {
      try {
        const rawValue = interaction.fields.getTextInputValue(fieldId);
        let sanitized = rawValue;

        // Aplica sanitização base
        if (validation.type === 'nickname') {
          const check = Validator.validateNickname(rawValue, validation.maxLength);
          if (!check.valid) errors.push(`${fieldId}: ${check.error}`);
          else sanitized = check.sanitized;
        }
        else if (validation.type === 'currency') {
          const check = Validator.validateCurrency(rawValue, validation.max);
          if (!check.valid) errors.push(`${fieldId}: ${check.error}`);
          else sanitized = check.value;
        }
        else if (validation.type === 'text') {
          sanitized = Validator.sanitizeEmbedText(rawValue, validation.maxLength || 1000);
        }
        else if (validation.type === 'duration') {
          const check = Validator.validateDuration(rawValue);
          if (!check.valid) errors.push(`${fieldId}: ${check.error}`);
          else sanitized = check.minutes;
        }

        results[fieldId] = sanitized;
      } catch (error) {
        errors.push(`${fieldId}: Valor não fornecido ou inválido`);
      }
    }

    if (errors.length > 0) {
      throw new Error(`Validação falhou:\n${errors.join('\n')}`);
    }

    return results;
  }

  /**
   * Log de acessos negados (para auditoria)
   */
  async logDeniedAccess(interaction, reason) {
    console.warn(`[Security] Access denied: User ${interaction.user.id} (${interaction.user.tag}) | Action: ${interaction.customId || interaction.commandName} | Reason: ${reason}`);

    // Aqui poderia enviar para um canal de logs de segurança
    if (global.client && process.env.SECURITY_LOG_CHANNEL) {
      try {
        const channel = await global.client.channels.fetch(process.env.SECURITY_LOG_CHANNEL);
        if (channel) {
          await channel.send({
            embeds: [{
              title: '🛡️ Tentativa de Acesso Negado',
              description: `**Usuário:** <@${interaction.user.id}> (${interaction.user.tag})\n**Ação:** \`${interaction.customId || interaction.commandName}\`\n**Motivo:** ${reason}\n**Canal:** <#${interaction.channel.id}>`,
              color: 0xE74C3C,
              timestamp: new Date()
            }]
          });
        }
      } catch (e) {
        console.error('[Security] Failed to log denied access:', e);
      }
    }
  }

  /**
   * Lock para operações críticas (previne race conditions)
   * @param {string} resourceId 
   * @param {Function} operation 
   */
  async withLock(resourceId, operation) {
    if (this.locks.has(resourceId)) {
      throw new Error('Recurso está sendo processado. Aguarde.');
    }

    this.locks.set(resourceId, Date.now());

    try {
      const result = await operation();
      return result;
    } finally {
      this.locks.delete(resourceId);
    }
  }

  /**
   * Verifica se ação é suspeita (anti-spam/anti-fraud)
   * @param {string} userId 
   * @param {string} actionType 
   * @param {number} threshold 
   */
  checkSuspiciousActivity(userId, actionType, threshold = 10) {
    const key = `${userId}-${actionType}`;
    const count = (this.suspiciousActions.get(key) || 0) + 1;

    this.suspiciousActions.set(key, count);

    // Limpa após 5 minutos
    setTimeout(() => {
      const current = this.suspiciousActions.get(key);
      if (current > 1) this.suspiciousActions.set(key, current - 1);
      else this.suspiciousActions.delete(key);
    }, 300000);

    if (count > threshold) {
      console.warn(`[Security] Suspicious activity detected: User ${userId} | Action: ${actionType} | Count: ${count}`);
      return { suspicious: true, count };
    }

    return { suspicious: false, count };
  }
}

module.exports = new SecurityMiddleware();
