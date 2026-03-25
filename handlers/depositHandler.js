const {
 EmbedBuilder,
 ActionRowBuilder,
 ButtonBuilder,
 ButtonStyle,
 ModalBuilder,
 TextInputBuilder,
 TextInputStyle,
 UserSelectMenuBuilder
} = require('discord.js');
const Database = require('../utils/database');

/**
 * Handler de Depósitos - Versão Direta com Seleção de Usuários
 * Fluxo: Selecionar Usuários → Definir Valor → Depósito Direto (sem aprovação)
 */
class DepositHandler {

 // ==================== PAINEL PRINCIPAL ====================

 static async sendPanel(channel) {
 try {
 const embed = new EmbedBuilder()
 .setTitle('💵 SISTEMA DE DEPÓSITOS')
 .setDescription(
 'Bem-vindo ao sistema de depósitos do banco da guilda!\n\n' +
 'Aqui você pode adicionar fundos diretamente às contas dos jogadores.\n\n' +
 '**Como funciona:**\n' +
 '1️⃣ Clique em **"Realizar Depósito"**\n' +
 '2️⃣ Selecione o(s) jogador(es) que receberão o valor\n' +
 '3️⃣ Informe o valor desejado (valores normais: 1, 10, 100, 1000...)\n' +
 '4️⃣ O saldo é creditado **instantaneamente** na conta do jogador'
 )
 .setColor(0x2ECC71)
 .addFields(
 {
 name: '💰 Saldo em Conta',
 value: 'Use o canal <#consultar-saldo> para verificar seu saldo atual',
 inline: false
 },
 {
 name: '📋 Histórico',
 value: 'Todos os depósitos são registrados e auditados automaticamente',
 inline: false
 },
 {
 name: '⚡ Acesso Direto',
 value: 'Apenas **ADM** e **Staff** podem realizar depósitos diretos',
 inline: false
 }
 )
 .setFooter({ text: 'Sistema Bancário • NOTAG Bot' })
 .setTimestamp();

 const buttons = new ActionRowBuilder()
 .addComponents(
 new ButtonBuilder()
 .setCustomId('btn_deposito_novo')
 .setLabel('💵 Realizar Depósito')
 .setStyle(ButtonStyle.Success),
 new ButtonBuilder()
 .setCustomId('btn_historico_depositos')
 .setLabel('📋 Meu Histórico')
 .setStyle(ButtonStyle.Primary),
 new ButtonBuilder()
 .setCustomId('btn_ajuda_deposito')
 .setLabel('❓ Ajuda')
 .setStyle(ButtonStyle.Secondary)
 );

 await channel.send({ embeds: [embed], components: [buttons] });
 console.log(`[DepositHandler] Painel de depósitos enviado em #${channel.name}`);
 } catch (error) {
 console.error('[DepositHandler] Erro ao enviar painel:', error);
 throw error;
 }
 }

 // ==================== ETAPA 1: SELEÇÃO DE USUÁRIOS ====================

 static async handleDepositoButton(interaction) {
 try {
 // Verificar permissões - Apenas ADM/Staff
 const isADM = interaction.member.roles.cache.some(r => r.name === 'ADM');
 const isStaff = interaction.member.roles.cache.some(r => r.name === 'Staff');

 if (!isADM && !isStaff) {
 return interaction.reply({
 content: '❌ Apenas **ADM** ou **Staff** podem realizar depósitos diretos!\n\n💡 Se você quer adicionar fundos à sua própria conta, utilize o sistema de depósito com comprovante ou contate um administrador.',
 ephemeral: true
 });
 }

 // Inicializar temp data
 if (!global.depositTemp) global.depositTemp = new Map();

 const tempData = global.depositTemp.get(interaction.user.id) || {
 users: [],
 step: 'selecting'
 };
 global.depositTemp.set(interaction.user.id, tempData);

 const embed = new EmbedBuilder()
 .setTitle('💵 SELECIONAR DESTINATÁRIO(S)')
 .setDescription(
 '**Como funciona:**\n\n' +
 '1️⃣ Clique em **"Adicionar Jogador(es)"** para selecionar\n' +
 '2️⃣ Você pode selecionar **até 25 jogadores** de uma vez\n' +
 '3️⃣ Depois, você definirá o valor a ser depositado\n' +
 '4️⃣ O valor será creditado **diretamente** nas contas selecionadas\n\n' +
 '💡 **Dica:** Segure Ctrl (ou Cmd no Mac) para selecionar múltiplos jogadores!'
 )
 .setColor(0x2ECC71);

 const botoes = new ActionRowBuilder()
 .addComponents(
 new ButtonBuilder()
 .setCustomId('dep_select_users')
 .setLabel('👥 Adicionar Jogador(es)')
 .setStyle(ButtonStyle.Primary),
 new ButtonBuilder()
 .setCustomId('dep_clear_users')
 .setLabel('🗑️ Limpar Seleção')
 .setStyle(ButtonStyle.Secondary)
 );

 // Mostrar participantes já selecionados (se houver)
 let content = '💵 **Selecione quem receberá o depósito:**';

 if (tempData.users.length > 0) {
 const mentions = tempData.users.map(id => `<@${id}>`).join(', ');
 content += `\n\n✅ **Jogadores selecionados (${tempData.users.length}):** ${mentions}`;

 // Adicionar botão de prosseguir se já tiver participantes
 botoes.addComponents(
 new ButtonBuilder()
 .setCustomId('dep_proceed_to_modal')
 .setLabel('➡️ Prosseguir para Valor')
 .setStyle(ButtonStyle.Success)
 );
 }

 await interaction.reply({
 content: content,
 embeds: [embed],
 components: [botoes],
 ephemeral: true
 });

 console.log(`[DepositHandler] Interface de seleção aberta por ${interaction.user.tag}`);

 } catch (error) {
 console.error(`[DepositHandler] Erro ao abrir seleção:`, error);
 await interaction.reply({
 content: '❌ Erro ao abrir formulário de depósito.',
 ephemeral: true
 });
 }
 }

 // ==================== ABRIR SELEÇÃO DE USUÁRIOS ====================

 static async openUserSelection(interaction) {
 try {
 const row = new ActionRowBuilder()
 .addComponents(
 new UserSelectMenuBuilder()
 .setCustomId('dep_select_users_menu')
 .setPlaceholder('🔍 Pesquise e selecione os jogadores...')
 .setMinValues(1)
 .setMaxValues(25)
 );

 await interaction.reply({
 content: '🔍 **Selecione os jogadores que receberão o depósito:**\n\n💡 Você pode digitar o nome para pesquisar!',
 components: [row],
 ephemeral: true
 });
 } catch (error) {
 console.error(`[DepositHandler] Erro ao abrir UserSelectMenu:`, error);
 await interaction.reply({
 content: '❌ Erro ao abrir seleção de usuários.',
 ephemeral: true
 });
 }
 }

 // ==================== PROCESSAR SELEÇÃO DE USUÁRIOS ====================

 static async processUserSelection(interaction) {
 try {
 const selectedUsers = interaction.values;

 if (!global.depositTemp) global.depositTemp = new Map();
 const tempData = global.depositTemp.get(interaction.user.id) || { users: [], step: 'selecting' };

 // Adicionar novos usuários (evitar duplicados)
 const existingUsers = new Set(tempData.users);
 selectedUsers.forEach(id => existingUsers.add(id));
 tempData.users = Array.from(existingUsers);

 global.depositTemp.set(interaction.user.id, tempData);

 const mentions = tempData.users.map(id => `<@${id}>`).join(', ');

 // Atualizar a mensagem original
 const embed = new EmbedBuilder()
 .setTitle('👥 JOGADORES SELECIONADOS')
 .setDescription(
 `✅ **${tempData.users.length} jogador(es) selecionado(s):**\n${mentions}\n\n` +
 'Clique em **"Prosseguir para Valor"** para definir o valor do depósito \n' +
 'ou **"Adicionar Mais"** para incluir outros jogadores.'
 )
 .setColor(0x2ECC71);

 const botoes = new ActionRowBuilder()
 .addComponents(
 new ButtonBuilder()
 .setCustomId('dep_proceed_to_modal')
 .setLabel('➡️ Prosseguir para Valor')
 .setStyle(ButtonStyle.Success),
 new ButtonBuilder()
 .setCustomId('dep_select_users')
 .setLabel('➕ Adicionar Mais')
 .setStyle(ButtonStyle.Primary),
 new ButtonBuilder()
 .setCustomId('dep_clear_users')
 .setLabel('🗑️ Limpar')
 .setStyle(ButtonStyle.Secondary)
 );

 await interaction.update({
 content: null,
 embeds: [embed],
 components: [botoes]
 });

 console.log(`[DepositHandler] ${tempData.users.length} usuários selecionados por ${interaction.user.tag}`);

 } catch (error) {
 console.error(`[DepositHandler] Erro ao processar seleção:`, error);
 await interaction.reply({
 content: '❌ Erro ao processar seleção de usuários.',
 ephemeral: true
 });
 }
 }

 // ==================== LIMPAR SELEÇÃO ====================

 static async clearUserSelection(interaction) {
 try {
 if (!global.depositTemp) global.depositTemp = new Map();
 const tempData = global.depositTemp.get(interaction.user.id);

 if (tempData) {
 tempData.users = [];
 global.depositTemp.set(interaction.user.id, tempData);
 }

 await interaction.update({
 content: '🗑️ **Seleção limpa!** Clique em "Adicionar Jogador(es)" para selecionar novamente.',
 embeds: [],
 components: [
 new ActionRowBuilder()
 .addComponents(
 new ButtonBuilder()
 .setCustomId('dep_select_users')
 .setLabel('👥 Adicionar Jogador(es)')
 .setStyle(ButtonStyle.Primary)
 )
 ]
 });

 console.log(`[DepositHandler] Seleção limpa por ${interaction.user.tag}`);

 } catch (error) {
 console.error(`[DepositHandler] Erro ao limpar seleção:`, error);
 await interaction.reply({
 content: '❌ Erro ao limpar seleção.',
 ephemeral: true
 });
 }
 }

 // ==================== ETAPA 2: MODAL DE VALOR ====================

 static async openValorModal(interaction) {
 try {
 const tempData = global.depositTemp?.get(interaction.user.id);

 if (!tempData || tempData.users.length === 0) {
 return interaction.reply({
 content: '❌ Nenhum jogador selecionado! Selecione jogadores primeiro.',
 ephemeral: true
 });
 }

 const modal = new ModalBuilder()
 .setCustomId('modal_deposito_valor')
 .setTitle(`💵 Depósito para ${tempData.users.length} jogador(es)`);

 // Campo 1: Valor do depósito (VALOR NORMAL, não em milhões)
 const valorInput = new TextInputBuilder()
 .setCustomId('valor_deposito')
 .setLabel('Valor do depósito por jogador')
 .setPlaceholder('Ex: 1000 (para 1.000 de saldo)')
 .setStyle(TextInputStyle.Short)
 .setRequired(true)
 .setMaxLength(15);

 // Campo 2: Motivo/Observação
 const motivoInput = new TextInputBuilder()
 .setCustomId('motivo_deposito')
 .setLabel('Motivo/Observação (opcional)')
 .setPlaceholder('Ex: Premiação de evento, reembolso, etc.')
 .setStyle(TextInputStyle.Paragraph)
 .setRequired(false)
 .setMaxLength(200);

 modal.addComponents(
 new ActionRowBuilder().addComponents(valorInput),
 new ActionRowBuilder().addComponents(motivoInput)
 );

 await interaction.showModal(modal);

 console.log(`[DepositHandler] Modal de valor aberto por ${interaction.user.tag} para ${tempData.users.length} usuários`);

 } catch (error) {
 console.error(`[DepositHandler] Erro ao abrir modal de valor:`, error);
 await interaction.reply({
 content: '❌ Erro ao abrir formulário de valor.',
 ephemeral: true
 });
 }
 }

 // ==================== PROCESSAR DEPÓSITO DIRETO ====================

 static async processDeposito(interaction) {
 try {
 // Verificar permissões novamente (segurança)
 const isADM = interaction.member.roles.cache.some(r => r.name === 'ADM');
 const isStaff = interaction.member.roles.cache.some(r => r.name === 'Staff');

 if (!isADM && !isStaff) {
 return interaction.reply({
 content: '❌ Apenas **ADM** ou **Staff** podem realizar depósitos!',
 ephemeral: true
 });
 }

 // Pegar dados do modal
 const valorInput = interaction.fields.getTextInputValue('valor_deposito').trim();
 const motivo = interaction.fields.getTextInputValue('motivo_deposito') || 'Depósito manual';

 // Validar valor (VALOR NORMAL - não multiplicar por milhões)
 const valor = parseInt(valorInput.replace(/\./g, '').replace(/,/g, ''));

 if (isNaN(valor) || valor <= 0) {
 return interaction.reply({
 content: '❌ Valor inválido! Digite apenas números positivos (ex: 100, 1000, 10000).',
 ephemeral: true
 });
 }

 if (valor > 100000000) {
 return interaction.reply({
 content: '❌ Valor muito alto! Máximo permitido: 100.000.000.',
 ephemeral: true
 });
 }

 // Pegar usuários do temp
 const tempData = global.depositTemp?.get(interaction.user.id);
 if (!tempData || tempData.users.length === 0) {
 return interaction.reply({
 content: '❌ Erro: Nenhum jogador selecionado! Tente novamente.',
 ephemeral: true
 });
 }

 const userIds = tempData.users;
 const totalValor = valor * userIds.length;

 await interaction.deferReply({ ephemeral: true });

 // Processar depósito para todos os usuários selecionados
 let sucessos = [];
 let falhas = [];

 for (const userId of userIds) {
 try {
 // Adicionar saldo diretamente - sem aprovação do financeiro
 await Database.addSaldo(
 userId, 
 valor, 
 `Depósito direto: ${motivo} (por ${interaction.user.tag})`
 );
 sucessos.push(userId);
 } catch (e) {
 console.error(`[DepositHandler] Erro ao depositar para ${userId}:`, e);
 falhas.push(userId);
 }
 }

 // Limpar temp
 global.depositTemp.delete(interaction.user.id);

 // Criar resumo
 const embedResultado = new EmbedBuilder()
 .setTitle('✅ DEPÓSITO REALIZADO COM SUCESSO')
 .setDescription(
 `💰 **Valor por jogador:** ${valor.toLocaleString()}\n` +
 `👥 **Jogadores:** ${sucessos.length}\n` +
 `💵 **Total depositado:** ${totalValor.toLocaleString()}\n` +
 `📝 **Motivo:** ${motivo}\n` +
 `👤 **Realizado por:** ${interaction.user}`
 )
 .setColor(0x2ECC71)
 .setTimestamp();

 if (falhas.length > 0) {
 embedResultado.addFields({
 name: '⚠️ Falhas',
 value: `${falhas.length} jogador(es) não puderam receber o depósito.`
 });
 embedResultado.setColor(0xF1C40F);
 }

 // Listar jogadores que receberam
 const mentions = sucessos.map(id => `<@${id}>`).join(', ');
 embedResultado.addFields({
 name: '✅ Jogadores Creditados',
 value: mentions || 'Nenhum'
 });

 await interaction.editReply({
 embeds: [embedResultado]
 });

 // Notificar jogadores que receberam o depósito
 for (const userId of sucessos) {
 try {
 const user = await interaction.client.users.fetch(userId);
 const embedDM = new EmbedBuilder()
 .setTitle('💰 DEPÓSITO RECEBIDO!')
 .setDescription(
 `🎉 **Você recebeu um depósito!**\n\n` +
 `💵 **Valor:** ${valor.toLocaleString()}\n` +
 `📝 **Motivo:** ${motivo}\n` +
 `👤 **Depositado por:** ${interaction.user.tag}\n\n` +
 `💡 Use o comando de saldo para verificar sua conta.`
 )
 .setColor(0x2ECC71)
 .setTimestamp();

 await user.send({ embeds: [embedDM] });
 } catch (e) {
 console.log(`[DepositHandler] Não foi possível notificar usuário ${userId}`);
 }
 }

 console.log(`[DepositHandler] Depósito realizado: ${valor} para ${sucessos.length}/${userIds.length} usuários por ${interaction.user.tag}`);

 // Log para canal de auditoria (opcional)
 const canalAuditoria = interaction.guild.channels.cache.find(c => c.name === '📜╠logs-banco');
 if (canalAuditoria) {
 const embedLog = new EmbedBuilder()
 .setTitle('💵 DEPÓSITO DIRETO REALIZADO')
 .setDescription(
 `👤 **Realizado por:** ${interaction.user} (${interaction.user.id})\n` +
 `💰 **Valor por jogador:** ${valor.toLocaleString()}\n` +
 `👥 **Quantidade:** ${sucessos.length} jogador(es)\n` +
 `💵 **Total:** ${totalValor.toLocaleString()}\n` +
 `📝 **Motivo:** ${motivo}`
 )
 .setColor(0x3498DB)
 .setTimestamp();

 canalAuditoria.send({ embeds: [embedLog] }).catch(() => {});
 }

 } catch (error) {
 console.error(`[DepositHandler] Erro ao processar depósito:`, error);

 // Limpar temp em caso de erro
 if (global.depositTemp) {
 global.depositTemp.delete(interaction.user.id);
 }

 await interaction.reply({
 content: '❌ Erro ao processar depósito. Verifique os dados e tente novamente.',
 ephemeral: true
 });
 }
 }

 // ==================== HISTÓRICO DE DEPÓSITOS ====================

 static async showHistorico(interaction) {
 try {
 let history = [];
 try {
 const result = await Database.getUserHistory(interaction.user.id);
 history = Array.isArray(result) ? result : [];
 } catch (dbError) {
 console.error(`[DepositHandler] Erro ao buscar histórico:`, dbError);
 history = [];
 }

 // Filtrar apenas depósitos (créditos)
 const depositos = history
 .filter(t => t.type === 'credito' && t.reason && t.reason.includes('Depósito'))
 .slice(-10);

 if (depositos.length === 0) {
 return interaction.reply({
 content: '❌ Você não possui depósitos registrados.',
 ephemeral: true
 });
 }

 const embed = new EmbedBuilder()
 .setTitle('📋 HISTÓRICO DE DEPÓSITOS')
 .setDescription(`Últimos ${depositos.length} depósitos:`)
 .setColor(0x3498DB);

 depositos.forEach((dep, index) => {
 const date = new Date(dep.created_at || dep.timestamp || Date.now()).toLocaleDateString('pt-BR');
 const amount = dep.amount || 0;
 const reason = dep.reason || 'Depósito';
 embed.addFields({
 name: `${index + 1}. ${date}`,
 value: `💰 ${amount.toLocaleString()} - ${reason}`,
 inline: false
 });
 });

 await interaction.reply({ embeds: [embed], ephemeral: true });

 } catch (error) {
 console.error(`[DepositHandler] Erro ao mostrar histórico:`, error);
 await interaction.reply({
 content: '❌ Erro ao carregar histórico.',
 ephemeral: true
 });
 }
 }

 // ==================== AJUDA ====================

 static async showAjuda(interaction) {
 const embed = new EmbedBuilder()
 .setTitle('❓ AJUDA - SISTEMA DE DEPÓSITOS')
 .setDescription(
 '**Como realizar um depósito direto:**\n\n' +
 '1️⃣ Clique em **"Realizar Depósito"**\n' +
 '2️⃣ Selecione o(s) jogador(es) usando o menu de busca\n' +
 '3️⃣ Digite o valor (números normais: 100, 1000, 10000)\n' +
 '4️⃣ Adicione um motivo opcional\n' +
 '5️⃣ O valor será creditado **instantaneamente**\n\n' +
 '**⚠️ Importante:**\n' +
 '• Apenas **ADM** e **Staff** podem fazer depósitos diretos\n' +
 '• Os jogadores receberão notificação no privado\n' +
 '• Todos os depósitos são registrados para auditoria\n' +
 '• Não é necessário aprovação do financeiro'
 )
 .setColor(0x95A5A6);

 await interaction.reply({ embeds: [embed], ephemeral: true });
 }
}

module.exports = DepositHandler;