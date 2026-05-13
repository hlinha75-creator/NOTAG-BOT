/**
 * eventSaldoPanelHandler.js
 *
 * Painel de saldo TOTAL ACUMULADO de todos os eventos arquivados.
 * Exibe, no canal ID 1499357332231163924, uma tabela com
 * todos os participantes e o total acumulado em TODOS os eventos
 * arquivados da guilda.
 *
 * O painel é criado/atualizado automaticamente sempre que
 * um evento é arquivado (handleArquivar no lootSplitHandler).
 */

const { EmbedBuilder } = require('discord.js');
const Database = require('../utils/database');

// ID do canal onde o painel será publicado
const PAINEL_CANAL_ID = '1499357332231163924';

// Identificador único da mensagem do painel (para editar em vez de recriar)
const PAINEL_TITLE_MARKER = '📊 SALDO — TOTAL ACUMULADO';

class EventSaldoPanelHandler {
  /**
   * Atualiza (ou cria) o painel no canal configurado.
   * Chamado automaticamente após cada evento arquivado.
   *
   * @param {import('discord.js').Guild} guild
   */
  static async update(guild) {
    try {
      const canal = guild.channels.cache.get(PAINEL_CANAL_ID);
      if (!canal || !canal.isTextBased()) {
        console.warn('[EventSaldoPanel] Canal não encontrado ou não é texto:', PAINEL_CANAL_ID);
        return;
      }

      // Buscar TODOS os eventos arquivados desta guilda (sem limite)
      const historico = await Database.getEventHistory(guild.id);

      if (!historico || historico.length === 0) {
        console.log('[EventSaldoPanel] Nenhum evento arquivado ainda.');
        return;
      }

      // Montar estrutura: { userId -> { nick, total } }
      const participantes = new Map();

      for (const entry of historico) {
        const dados = entry.dados || {};
        const distribuicao = dados.distribuicao || [];

        for (const p of distribuicao) {
          const uid   = p.userId || '';
          const nick  = p.nick   || uid.substring(0, 12);
          const valor = p.valor  || 0;

          if (!participantes.has(uid)) {
            participantes.set(uid, { nick, total: 0 });
          }

          participantes.get(uid).total += valor;
        }
      }

      // Ordenar por total decrescente
      const sorted = Array.from(participantes.values())
        .sort((a, b) => b.total - a.total);

      // Timestamp Unix do momento atual (para exibição relativa)
      const now = Math.floor(Date.now() / 1000);

      // Construir embeds (Discord limita 4096 chars na description)
      const embeds = this._buildEmbeds(sorted, historico.length, now);

      // Buscar mensagem existente do painel para editar
      const messages = await canal.messages.fetch({ limit: 50 });
      const existentes = messages.filter(m =>
        m.author.id === canal.client.user.id &&
        m.embeds.length > 0 &&
        m.embeds[0].title?.startsWith(PAINEL_TITLE_MARKER)
      );

      if (existentes.size > 0) {
        // Editar a primeira mensagem encontrada (e deletar extras se houver)
        const [primeira, ...extras] = existentes
          .sort((a, b) => a.createdTimestamp - b.createdTimestamp)
          .values();

        await primeira.edit({ embeds: [embeds[0]] });

        for (const extra of extras) {
          await extra.delete().catch(() => {});
        }

        // Enviar embeds adicionais se houver (quando há muitos participantes)
        for (let i = 1; i < embeds.length; i++) {
          await canal.send({ embeds: [embeds[i]] });
        }

        console.log('[EventSaldoPanel] Painel atualizado.');
      } else {
        // Criar novas mensagens
        for (const embed of embeds) {
          await canal.send({ embeds: [embed] });
        }
        console.log('[EventSaldoPanel] Painel criado.');
      }
    } catch (error) {
      console.error('[EventSaldoPanel] Erro ao atualizar painel:', error);
    }
  }

  /**
   * Constrói os embeds do painel.
   * Divide em múltiplos embeds se necessário (limite de 4096 chars).
   *
   * @param {Array}  sorted        - Participantes ordenados por total desc
   * @param {number} totalEventos  - Total de eventos arquivados
   * @param {number} nowUnix       - Timestamp Unix atual (segundos)
   */
  static _buildEmbeds(sorted, totalEventos, nowUnix) {
    // Linhas da tabela de ranking
    const linhas = sorted.map((p, i) => {
      const pos   = (i + 1).toString().padStart(2, ' ');
      const nick  = p.nick.substring(0, 18).padEnd(18, ' ');
      const total = p.total.toLocaleString('pt-BR').padStart(13, ' ');
      return `\`${pos}\` \`${nick}\` \`${total}\``;
    });

    const embeds = [];
    const CHUNK  = 25; // participantes por embed

    for (let start = 0; start < linhas.length; start += CHUNK) {
      const chunk      = linhas.slice(start, start + CHUNK);
      const isFirst    = start === 0;
      const pageNum    = Math.floor(start / CHUNK) + 1;
      const totalPages = Math.ceil(linhas.length / CHUNK);

      const embed = new EmbedBuilder()
        .setColor(0xF1C40F)
        .setTimestamp()
        .setFooter({
          text: `Atualizado automaticamente a cada evento arquivado • ${sorted.length} membros`
        });

      if (isFirst) {
        embed
          .setTitle(PAINEL_TITLE_MARKER)
          .setDescription(
            `📦 **${totalEventos} evento(s) arquivado(s) no total**\n` +
            `🕐 Última atualização: <t:${nowUnix}:R>\n\n` +
            `\`##\` \`${'MEMBRO'.padEnd(18, ' ')}\` \`${'SILVER TOTAL'.padStart(13, ' ')}\`\n` +
            `${'─'.repeat(42)}\n` +
            chunk.join('\n')
          );
      } else {
        embed
          .setTitle(`${PAINEL_TITLE_MARKER} (página ${pageNum}/${totalPages})`)
          .setDescription(chunk.join('\n'));
      }

      embeds.push(embed);
    }

    return embeds;
  }
}

module.exports = EventSaldoPanelHandler;