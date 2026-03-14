const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const Database = require('../utils/database');

module.exports = {
 data: new SlashCommandBuilder()
 .setName('saldos')
 .setDescription('💰 Lista todos os membros e seus saldos (ADM/Tesoureiro)')
 .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

 async execute(interaction) {
 try {
 await interaction.deferReply({ ephemeral: true });

 // Buscar TODOS os usuários do banco (sem limite de 30)
 const allUsers = await Database.db.allAsync(`
 SELECT user_id, saldo, level, eventos_participados, total_recebido, total_sacado 
 FROM users 
 WHERE saldo > 0 OR eventos_participados > 0
 ORDER BY saldo DESC
 `);

 if (allUsers.length === 0) {
 return interaction.editReply({
 content: '❌ Nenhum membro encontrado no banco de dados.'
 });
 }

 // Buscar informações dos membros do Discord
 const guild = interaction.guild;
 const members = await guild.members.fetch();

 // Combinar dados do banco com dados do Discord
 const membrosCompletos = [];

 for (const user of allUsers) {
 const member = members.get(user.user_id);
 if (member) {
 membrosCompletos.push({
 userId: user.user_id,
 displayName: member.displayName || member.user.username,
 saldo: user.saldo || 0,
 level: user.level || 1,
 eventos: user.eventos_participados || 0,
 recebido: user.total_recebido || 0,
 sacado: user.total_sacado || 0,
 avatar: member.user.displayAvatarURL({ dynamic: true })
 });
 }
 }

 // Calcular totais
 const totalSaldo = membrosCompletos.reduce((acc, m) => acc + m.saldo, 0);
 const totalMembros = membrosCompletos.length;

 // Configuração de paginação
 const itemsPerPage = 10; // 10 membros por página
 const totalPages = Math.ceil(membrosCompletos.length / itemsPerPage);

 // Mostrar primeira página
 await this.showPage(interaction, membrosCompletos, 1, totalPages, totalSaldo, totalMembros, itemsPerPage);

 } catch (error) {
 console.error('Erro ao listar saldos:', error);
 await interaction.editReply({
 content: '❌ Erro ao carregar lista de saldos.'
 });
 }
 },

 async showPage(interaction, membros, page, totalPages, totalSaldo, totalMembros, itemsPerPage) {
 const start = (page - 1) * itemsPerPage;
 const end = start + itemsPerPage;
 const pageMembers = membros.slice(start, end);

 // Criar descrição formatada
 let description = `💰 **Total em caixa:** ${totalSaldo.toLocaleString('pt-BR')} silver\n`;
 description += `👥 **Membros cadastrados:** ${totalMembros}\n\n`;
 description += '```\n';
 description += 'Pos. Nome                Saldo         Lvl  Eventos\n';
 description += '═══════════════════════════════════════════════════\n';

 for (let i = 0; i < pageMembers.length; i++) {
 const membro = pageMembers[i];
 const pos = start + i + 1;
 const nome = membro.displayName.substring(0, 18).padEnd(18, ' ');
 const saldo = membro.saldo.toLocaleString('pt-BR').padStart(12, ' ');
 const lvl = membro.level.toString().padStart(3, ' ');
 const evts = membro.eventos.toString().padStart(7, ' ');

 description += `${pos.toString().padStart(3, ' ')} ${nome} ${saldo} ${lvl} ${evts}\n`;
 }

 description += '```';

 const embed = new EmbedBuilder()
 .setTitle(`📊 Ranking de Saldos - Página ${page}/${totalPages}`)
 .setDescription(description)
 .setColor(0xFFD700)
 .setFooter({ 
 text: `Total: ${totalMembros} membros • Página ${page} de ${totalPages}`,
 iconURL: interaction.guild.iconURL({ dynamic: true })
 })
 .setTimestamp();

 // Botões de navegação
 const components = [];
 if (totalPages > 1) {
 const row = new ActionRowBuilder()
 .addComponents(
 new ButtonBuilder()
 .setCustomId(`saldos_prev_${page}_${totalPages}`)
 .setLabel('◀️ Anterior')
 .setStyle(ButtonStyle.Secondary)
 .setDisabled(page <= 1),
 new ButtonBuilder()
 .setCustomId(`saldos_info_${page}`)
 .setLabel(`${page}/${totalPages}`)
 .setStyle(ButtonStyle.Secondary)
 .setDisabled(true),
 new ButtonBuilder()
 .setCustomId(`saldos_next_${page}_${totalPages}`)
 .setLabel('Próxima ▶️')
 .setStyle(ButtonStyle.Secondary)
 .setDisabled(page >= totalPages),
 new ButtonBuilder()
 .setCustomId('saldos_refresh')
 .setLabel('🔄 Atualizar')
 .setStyle(ButtonStyle.Success)
 );
 components.push(row);
 }

 // Botão de exportar CSV (se quiser)
 const exportRow = new ActionRowBuilder()
 .addComponents(
 new ButtonBuilder()
 .setCustomId('saldos_export_csv')
 .setLabel('📥 Exportar CSV Completo')
 .setStyle(ButtonStyle.Primary)
 );
 components.push(exportRow);

 await interaction.editReply({ 
 embeds: [embed], 
 components: components 
 });

 // Coletor para botões
 const filter = i => i.user.id === interaction.user.id && i.customId.startsWith('saldos_');
 const collector = interaction.channel.createMessageComponentCollector({ 
 filter, 
 time: 300000 // 5 minutos
 });

 collector.on('collect', async i => {
 try {
 if (i.customId === 'saldos_refresh') {
 await i.deferUpdate();
 await this.execute(interaction);
 collector.stop();
 return;
 }

 if (i.customId === 'saldos_export_csv') {
 await i.deferUpdate();
 await this.exportCSV(interaction, membros);
 return;
 }

 const parts = i.customId.split('_');
 const action = parts[1];
 const currentPage = parseInt(parts[2]);

 let newPage = currentPage;
 if (action === 'prev') newPage = currentPage - 1;
 if (action === 'next') newPage = currentPage + 1;

 await i.deferUpdate();
 await this.showPage(interaction, membros, newPage, totalPages, totalSaldo, totalMembros, itemsPerPage);

 } catch (error) {
 console.error('Erro na navegação:', error);
 }
 });

 collector.on('end', () => {
 // Desabilitar botões quando expirar
 const disabledComponents = components.map(row => {
 const newRow = ActionRowBuilder.from(row);
 newRow.components.forEach(button => button.setDisabled(true));
 return newRow;
 });

 interaction.editReply({ components: disabledComponents }).catch(() => {});
 });
 },

 async exportCSV(interaction, membros) {
 try {
 let csv = 'ID,Nome,Saldo,Level,Eventos,Total_Recebido,Total_Sacado\n';

 for (const m of membros) {
 csv += `${m.userId},"${m.displayName}",${m.saldo},${m.level},${m.eventos},${m.recebido},${m.sacado}\n`;
 }

 const fs = require('fs');
 const path = require('path');
 const fileName = `saldos_completos_${interaction.guild.id}_${Date.now()}.csv`;
 const filePath = path.join(__dirname, '..', 'data', 'exports', fileName);

 // Criar pasta se não existir
 const dir = path.dirname(filePath);
 if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

 fs.writeFileSync(filePath, csv, 'utf8');

 await interaction.followUp({
 content: `✅ Exportação completa! ${membros.length} membros exportados.`,
 files: [filePath],
 ephemeral: true
 });

 // Deletar arquivo após 5 minutos
 setTimeout(() => {
 if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
 }, 5 * 60 * 1000);

 } catch (error) {
 console.error('Erro ao exportar CSV:', error);
 await interaction.followUp({
 content: '❌ Erro ao exportar CSV.',
 ephemeral: true
 });
 }
 }
};