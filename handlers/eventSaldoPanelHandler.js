/**
 * eventSaldoPanelHandler.js
 *
 * Painel de saldo dos últimos 7 eventos arquivados.
 * Exibe, no canal ID 1499357332231163924, uma tabela com
 * todos os participantes, quanto receberam em cada evento
 * e o total acumulado nos últimos 7 eventos.
 *
 * O painel é criado/atualizado automaticamente sempre que
 * um evento é arquivado (handleArquivar no lootSplitHandler).
 */

const { EmbedBuilder } = require('discord.js');
const Database = require('../utils/database');

// ID do canal onde o painel será publicado
const PAINEL_CANAL_ID = '1499357332231163924';

// Identificador único da mensagem do painel (para editar em vez de recriar)
const PAINEL_TITLE_MARKER = '📊 SALDO — ÚLTIMOS 7 EVENTOS';

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

      // Buscar os últimos 7 eventos arquivados desta guilda
      const historico = await Database.getEventHistory(guild.id, 7);
      if (!historico || historico.length === 0) {
        console.log('[EventSaldoPanel] Nenhum evento arquivado ainda.');
        return;
      }

      // Montar estrutura: { userId -> { nick, eventos: [{nome, valor}], total } }
      const participantes = new Map();
      const eventosNomes = []; // ordem dos eventos (mais recente primeiro)

      for (const entry of historico) {
        const dados = entry.dados || {};
        const nomeEvento = dados.eventoNome || entry.event_id;
        const distribuicao = dados.distribuicao || [];

        // Abreviar nome do evento para caber na tabela
        const nomeAbrev = nomeEvento.length > 22
          ? nomeEvento.substring(0, 20) + '…'
          : nomeEvento;

        eventosNomes.push(nomeAbrev);

        for (const p of distribuicao) {
          const uid = p.userId || '';
          const nick = p.nick || uid.substring(0, 12);
          const valor = p.valor || 0;

          if (!participantes.has(uid)) {
            participantes.set(uid, { nick, total: 0, porEvento: {} });
          }

          const dados_p = participantes.get(uid);
          dados_p.total += valor;
          dados_p.porEvento[nomeAbrev] = (dados_p.porEvento[nomeAbrev] || 0) + valor;
        }
      }

      // Ordenar por total decrescente
      const sorted = Array.from(participantes.values())
        .sort((a, b) => b.total - a.total);

      // Construir embeds (Discord limita 4096 chars na description e 6000 no total)
      const embeds = this._buildEmbeds(sorted, eventosNomes, historico.length);

      // Buscar mensagem existente do painel para editar
      const messages = await canal.messages.fetch({ limit: 50 });
      const existentes = messages.filter(m =>
        m.author.id === canal.client.user.id &&
        m.embeds.length > 0 &&
        m.embeds[0].title?.startsWith(PAINEL_TITLE_MARKER)
      );

      if (existentes.size > 0) {
        // Editar a primeira mensagem encontrada (e deletar extras se houver)
        const [primeira, ...extras] = existentes.sort((a, b) => a.createdTimestamp - b.createdTimestamp).values();
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
   */
  static _buildEmbeds(sorted, eventosNomes, totalEventos) {
    const now = Math.floor(Date.now() / 1000);

    // Cabeçalho com nomes dos eventos
    const headerLines = eventosNomes.map((n, i) => `\`E${i + 1}\` ${n}`).join('\n');

    // Linhas da tabela
    const linhas = sorted.map((p, i) => {
      const pos = (i + 1).toString().padStart(2, ' ');
      const nick = p.nick.substring(0, 18).padEnd(18, ' ');
      const total = p.total.toLocaleString('pt-BR').padStart(13, ' ');
      return `\`${pos}\` \`${nick}\` \`${total}\``;
    });

    const embeds = [];
    const CHUNK = 25; // participantes por embed

    for (let start = 0; start < linhas.length; start += CHUNK) {
      const chunk = linhas.slice(start, start + CHUNK);
      const isFirst = start === 0;
      const pageNum = Math.floor(start / CHUNK) + 1;
      const totalPages = Math.ceil(linhas.length / CHUNK);

      const embed = new EmbedBuilder()
        .setColor(0xF1C40F)
        .setTimestamp()
        .setFooter({ text: `Atualizado automaticamente a cada evento arquivado • ${sorted.length} membros` });

      if (isFirst) {
        embed
          .setTitle(`${PAINEL_TITLE_MARKER}`)
          .setDescription(
            `📅 **Últimos ${totalEventos} evento(s) arquivado(s)**\n` +
            `🕐 Última atualização: <t:${now}:R>\n\n` +
            `**Legenda dos eventos:**\n${headerLines}\n\n` +
            `${'─'.repeat(42)}\n` +
            `\`Pos\` \`Nick              \` \`    Total (silver)\`\n` +
            `${'─'.repeat(42)}\n` +
            chunk.join('\n')
          );
      } else {
        embed
          .setTitle(`${PAINEL_TITLE_MARKER} (${pageNum}/${totalPages})`)
          .setDescription(chunk.join('\n'));
      }

      embeds.push(embed);
    }

    // Se não há participantes
    if (embeds.length === 0) {
      embeds.push(
        new EmbedBuilder()
          .setTitle(PAINEL_TITLE_MARKER)
          .setDescription('Nenhum participante encontrado nos últimos eventos.')
          .setColor(0x95A5A6)
          .setTimestamp()
      );
    }

    return embeds;
  }
}

module.exports = EventSaldoPanelHandler;