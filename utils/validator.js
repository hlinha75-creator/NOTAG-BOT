/**
 * Sistema centralizado de validação e sanitização
 * Previne injections, overflows e dados maliciosos
 */

class Validator {
  /**
   * Valida ID do Discord (snowflake)
   * @param {string} id - ID a ser validado
   * @returns {boolean}
   */
  static isValidSnowflake(id) {
    if (!id || typeof id !== 'string') return false;
    return /^\d{17,19}$/.test(id);
  }

  /**
   * Valida nome de usuário/nick (Albion/Dicord)
   * @param {string} nick - Nickname a validar
   * @param {number} maxLength - Tamanho máximo (padrão: 32)
   * @returns {{valid: boolean, error?: string, sanitized?: string}}
   */
  static validateNickname(nick, maxLength = 32) {
    if (!nick || typeof nick !== 'string') {
      return { valid: false, error: 'Nick não pode estar vazio' };
    }

    const trimmed = nick.trim();

    if (trimmed.length === 0) {
      return { valid: false, error: 'Nick não pode conter apenas espaços' };
    }

    if (trimmed.length > maxLength) {
      return { valid: false, error: `Nick deve ter no máximo ${maxLength} caracteres` };
    }

    // Previne mentions e formatação maliciosa
    const sanitized = trimmed
      .replace(/@(everyone|here)/gi, '[mention bloqueada]')
      .replace(/[<>]/g, '') // Remove tags HTML/Discord
      .replace(/[\x00-\x1F\x7F]/g, ''); // Remove caracteres de controle

    // Regex para caracteres permitidos (alfanumérico, espaços, underscores, hífens)
    if (!/^[\w\s\-_\.]+$/.test(sanitized)) {
      return { valid: false, error: 'Nick contém caracteres inválidos. Use apenas letras, números, espaços, underscores e hífens.' };
    }

    return { valid: true, sanitized };
  }

  /**
   * Valida valores monetários
   * @param {string|number} value 
   * @param {number} max - Valor máximo permitido (padrão: 999.999.999)
   * @returns {{valid: boolean, error?: string, value?: number}}
   */
  static validateCurrency(value, max = 999999999) {
    const num = parseInt(value);

    if (isNaN(num)) {
      return { valid: false, error: 'Valor deve ser um número válido' };
    }

    if (num <= 0) {
      return { valid: false, error: 'Valor deve ser maior que zero' };
    }

    if (num > max) {
      return { valid: false, error: `Valor máximo permitido: ${max.toLocaleString()}` };
    }

    // Verifica se é inteiro
    if (!Number.isInteger(num)) {
      return { valid: false, error: 'Valor deve ser um número inteiro' };
    }

    return { valid: true, value: num };
  }

  /**
   * Valida customId de interações
   * @param {string} customId 
   * @param {string} expectedPrefix 
   * @returns {{valid: boolean, id?: string, error?: string}}
   */
  static extractIdFromCustomId(customId, expectedPrefix) {
    if (!customId || typeof customId !== 'string') {
      return { valid: false, error: 'Invalid customId' };
    }

    if (!customId.startsWith(expectedPrefix)) {
      return { valid: false, error: 'Prefixo inválido' };
    }

    const id = customId.replace(expectedPrefix, '');

    if (!id || id.length === 0) {
      return { valid: false, error: 'ID vazio' };
    }

    return { valid: true, id };
  }

  /**
   * Sanitiza texto para embeds (previne quebras de formatação)
   * @param {string} text 
   * @param {number} maxLength 
   * @returns {string}
   */
  static sanitizeEmbedText(text, maxLength = 1024) {
    if (!text || typeof text !== 'string') return '';

    let sanitized = text
      .replace(/@(everyone|here)/gi, '@\u200Beveryone') // Zero-width space para quebrar mention
      .replace(/```/g, '`\u200B``') // Quebra code blocks
      .substring(0, maxLength);

    return sanitized;
  }

  /**
   * Valida URL de imagem (Albion screenshots)
   * @param {string} url 
   * @returns {boolean}
   */
  static isValidImageUrl(url) {
    if (!url || typeof url !== 'string') return false;

    try {
      const parsed = new URL(url);
      const validHosts = ['cdn.discordapp.com', 'media.discordapp.net', 'i.imgur.com', 'imgur.com'];
      const validExts = ['.png', '.jpg', '.jpeg', '.gif', '.webp'];

      const hasValidHost = validHosts.some(host => parsed.hostname.includes(host));
      const hasValidExt = validExts.some(ext => parsed.pathname.toLowerCase().endsWith(ext));

      return hasValidHost || hasValidExt;
    } catch {
      return false;
    }
  }

  /**
   * Valida duração/tempo (para eventos)
   * @param {string} time - Formato HH:MM ou minutos
   * @returns {{valid: boolean, minutes?: number, error?: string}}
   */
  static validateDuration(time) {
    // Verifica se é número simples (minutos)
    if (/^\d+$/.test(time)) {
      const mins = parseInt(time);
      if (mins > 0 && mins <= 1440) { // Max 24h
        return { valid: true, minutes: mins };
      }
      return { valid: false, error: 'Duração deve ser entre 1 e 1440 minutos (24h)' };
    }

    // Verifica formato HH:MM
    const match = time.match(/^(\d{1,2}):(\d{2})$/);
    if (match) {
      const hours = parseInt(match[1]);
      const mins = parseInt(match[2]);
      const total = hours * 60 + mins;

      if (hours >= 0 && hours <= 23 && mins >= 0 && mins <= 59 && total > 0) {
        return { valid: true, minutes: total };
      }
    }

    return { valid: false, error: 'Formato inválido. Use HH:MM ou minutos (ex: 90)' };
  }

  /**
   * Verifica se objeto existe no Map global antes de operar
   * @param {Map} map 
   * @param {string} key 
   * @param {string} context - Contexto para mensagem de erro
   * @returns {{exists: boolean, data?: any, error?: string}}
   */
  static checkGlobalMap(map, key, context = 'Item') {
    if (!map || !(map instanceof Map)) {
      return { exists: false, error: 'Sistema não inicializado' };
    }

    const data = map.get(key);
    if (!data) {
      return { exists: false, error: `${context} não encontrado ou expirado` };
    }

    return { exists: true, data };
  }

  /**
   * Valida permissões de usuário
   * @param {GuildMember} member 
   * @param {Array<string>} allowedRoles 
   * @param {boolean} requireAdmin 
   * @returns {boolean}
   */
  static hasPermission(member, allowedRoles = [], requireAdmin = false) {
    if (!member) return false;

    if (requireAdmin && member.permissions.has('Administrator')) return true;

    if (allowedRoles.length === 0) return true;

    return member.roles.cache.some(role => 
      allowedRoles.includes(role.name) || allowedRoles.includes(role.id)
    );
  }

  /**
   * Rate limiting simples (memória)
   * @param {Map} rateLimitMap 
   * @param {string} key 
   * @param {number} cooldownMs 
   * @returns {{allowed: boolean, remaining?: number}}
   */
  static checkRateLimit(rateLimitMap, key, cooldownMs = 5000) {
    const now = Date.now();
    const lastUsed = rateLimitMap.get(key);

    if (lastUsed && (now - lastUsed) < cooldownMs) {
      const remaining = Math.ceil((cooldownMs - (now - lastUsed)) / 1000);
      return { allowed: false, remaining };
    }

    rateLimitMap.set(key, now);
    return { allowed: true };
  }
}

module.exports = Validator;