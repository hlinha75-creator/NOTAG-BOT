const {
 EmbedBuilder,
 ActionRowBuilder,
 ButtonBuilder,
 ButtonStyle,
 PermissionFlagsBits,
 ModalBuilder,
 TextInputBuilder,
 TextInputStyle
} = require('discord.js');

class RegistrationActions {
 static initialize() {
 console.log('📝 Registration Actions initialized');
 // 🆕 NOVO: Map para controlar registros em processamento (evita duplo clique)
 this.processingRegistrations = new Map();
 }

 /**
 * Verifica se um usuário ou nick está na blacklist
 * @param {string} nick - Nickname do jogador
 * @param {string} userId - ID do usuário Discord
 * @returns {Object} - { isBlacklisted: boolean, reason: string }
 */
 static checkBlacklist(nick, userId) {
 // Verificar blacklist por userId
 if (global.blacklist.has(userId)) {
 const dados = global.blacklist.get(userId);
 return {
 isBlacklisted: true,
 reason: dados.motivo || 'Motivo não especificado'
 };
 }

 // Verificar blacklist por nick (case insensitive)
 for (const [id, dados] of global.blacklist.entries()) {
 if (dados.nick && dados.nick.toLowerCase() === nick.toLowerCase()) {
 return {
 isBlacklisted: true,
 reason: dados.motivo || 'Motivo não especificado'
 };
 }
 }

 return {
 isBlacklisted: false,
 reason: null
 };
 }

 /**
 * Retorna histórico de recusas de um usuário
 * @param {string} userId - ID do usuário
 * @param {string} nick - Nick do jogador
 * @returns {Array} - Lista de recusas anteriores
 */
 static getHistoricoRecusas(userId, nick) {
 if (!global.historicoRegistros || !global.historicoRegistros.has(userId)) {
 return [];
 }

 const historico = global.historicoRegistros.get(userId);
 return historico.filter(h => h.tipo === 'recusado') || [];
 }

 /**
 * Verifica permissões de recrutador (melhorado)
 */
 static async checkRecruiterPermission(interaction) {
 const isRecrutador = interaction.member.roles.cache.some(r =>
 r.name === 'Recrutador' ||
 r.name === 'Recrutadora' || // Variação de gênero
 r.name === 'ADM' ||
 r.name === 'Staff' ||
 r.name === 'Staffer'
 ) || interaction.member.permissions.has(PermissionFlagsBits.Administrator);

 if (!isRecrutador) {
 await interaction.reply({
 content: '❌ Apenas Recrutadores, Staff ou ADMs podem aprovar registros!',
 ephemeral: true
 });
 return false;
 }
 return true;
 }

 // 🆕 NOVO: Verifica se o registro já está sendo processado
 static isProcessing(regId) {
 return this.processingRegistrations?.has(regId);
 }

 // 🆕 NOVO: Marca registro como processando
 static markProcessing(regId) {
 if (!this.processingRegistrations) this.processingRegistrations = new Map();
 this.processingRegistrations.set(regId, Date.now());

 // Auto-remove após 10 segundos (prevenção de memory leak)
 setTimeout(() => {
 this.processingRegistrations?.delete(regId);
 }, 10000);
 }

 static async approveAsMember(interaction, regId) {
 try {
 // 🆕 NOVO: Verifica se já está processando
 if (this.isProcessing(regId)) {
 return interaction.reply({
 content: '⏳ Este registro já está sendo processado! Aguarde...',
 ephemeral: true
 });
 }

 if (!(await this.checkRecruiterPermission(interaction))) return;

 const registro = global.registrosPendentes.get(regId);

 // 🆕 NOVO: Se registro não existe, verifica se já foi processado anteriormente
 if (!registro) {
 return interaction.reply({
 content: '✅ Este registro já foi processado anteriormente! O cargo já foi atribuído.',
 ephemeral: true
 });
 }

 // 🆕 NOVO: Marca como processando
 this.markProcessing(regId);

 const dados = registro.dados || registro;
 const { nick, guilda, server, plataforma, arma } = dados;
 const member = registro.member || interaction.guild.members.cache.get(registro.userId);

 if (!member) {
 // Remove do processamento se falhar
 this.processingRegistrations?.delete(regId);
 return interaction.reply({
 content: '❌ Membro não encontrado no servidor!',
 ephemeral: true
 });
 }

 // Aplicar nickname
 try {
 await member.setNickname(nick);
 } catch (e) {
 console.log('[Registration] Não foi possível alterar nickname');
 }

 // Adicionar cargo de Membro
 const cargoMembro = interaction.guild.roles.cache.find(r => r.name === 'Membro');
 if (cargoMembro) {
 await member.roles.add(cargoMembro);
 }

 // Criar embed de aprovação
 const embedAprovado = new EmbedBuilder()
 .setTitle('✅ REGISTRO APROVADO - MEMBRO')
 .setDescription(
 `**Jogador:** ${nick}\n` +
 `**Guilda:** ${guilda}\n` +
 `**Server:** ${server}\n` +
 `**Plataforma:** ${plataforma || 'N/A'}\n` +
 `**Arma Principal:** ${arma}\n` +
 `**Aprovado por:** ${interaction.user.tag}\n` +
 `**Status:** Membro`
 )
 .setColor(0x2ECC71)
 .setTimestamp();

 // Enviar mensagem no canal de logs
 const canalLogs = interaction.guild.channels.cache.find(c => c.name === 'logs-registros');
 if (canalLogs) {
 await canalLogs.send({ embeds: [embedAprovado] });
 }

 // Enviar DM para o usuário
 try {
 await member.send({
 embeds: [
 new EmbedBuilder()
 .setTitle('✅ SEU REGISTRO FOI APROVADO!')
 .setDescription(`Parabéns! Você foi aceito como **Membro** da guilda.\nSeu nickname foi alterado para: \`${nick}\``)
 .setColor(0x2ECC71)
 .setTimestamp()
 ]
 });
 } catch (e) {
 console.log('[Registration] Não foi possível enviar DM');
 }

 // Limpar registro pendente
 global.registrosPendentes.delete(regId);
 global.registroTemp.delete(regId);
 // 🆕 NOVO: Remove do processamento
 this.processingRegistrations?.delete(regId);

 // 🆕 NOVO: Deleta a mensagem do canal de solicitação
 try {
 await interaction.message.delete();
 console.log(`[Registration] Mensagem de registro ${regId} deletada após aprovação`);
 } catch (e) {
 console.log('[Registration] Não foi possível deletar mensagem:', e);
 // Se não conseguir deletar, atualiza como fallback
 await interaction.update({
 content: `✅ **${nick}** aprovado como Membro!`,
 components: [],
 embeds: []
 });
 }

 } catch (error) {
 console.error('[Registration] Error approving member:', error);
 // 🆕 NOVO: Garante remoção do processamento em caso de erro
 this.processingRegistrations?.delete(regId);

 // Se já respondeu, não tenta responder novamente
 if (!interaction.replied && !interaction.deferred) {
 await interaction.reply({
 content: '❌ Erro ao aprovar membro.',
 ephemeral: true
 });
 }
 }
 }

 static async approveAsAlianca(interaction, regId) {
 try {
 // 🆕 NOVO: Verifica se já está processando
 if (this.isProcessing(regId)) {
 return interaction.reply({
 content: '⏳ Este registro já está sendo processado! Aguarde...',
 ephemeral: true
 });
 }

 if (!(await this.checkRecruiterPermission(interaction))) return;

 const registro = global.registrosPendentes.get(regId);

 // 🆕 NOVO: Se registro não existe, verifica se já foi processado anteriormente
 if (!registro) {
 return interaction.reply({
 content: '✅ Este registro já foi processado anteriormente! O cargo já foi atribuído.',
 ephemeral: true
 });
 }

 // 🆕 NOVO: Marca como processando
 this.markProcessing(regId);

 const dados = registro.dados || registro;
 const { nick, guilda, server, plataforma, arma } = dados;
 const member = registro.member || interaction.guild.members.cache.get(registro.userId);

 if (!member) {
 this.processingRegistrations?.delete(regId);
 return interaction.reply({
 content: '❌ Membro não encontrado no servidor!',
 ephemeral: true
 });
 }

 try {
 await member.setNickname(nick);
 } catch (e) {
 console.log('[Registration] Não foi possível alterar nickname');
 }

 const cargoAlianca = interaction.guild.roles.cache.find(r => r.name === 'Aliança');
 if (cargoAlianca) {
 await member.roles.add(cargoAlianca);
 }

 const embedAprovado = new EmbedBuilder()
 .setTitle('✅ REGISTRO APROVADO - ALIANÇA')
 .setDescription(
 `**Jogador:** ${nick}\n` +
 `**Guilda:** ${guilda}\n` +
 `**Server:** ${server}\n` +
 `**Plataforma:** ${plataforma || 'N/A'}\n` +
 `**Arma Principal:** ${arma}\n` +
 `**Aprovado por:** ${interaction.user.tag}\n` +
 `**Status:** Aliança`
 )
 .setColor(0x3498DB)
 .setTimestamp();

 const canalLogs = interaction.guild.channels.cache.find(c => c.name === 'logs-registros');
 if (canalLogs) {
 await canalLogs.send({ embeds: [embedAprovado] });
 }

 try {
 await member.send({
 embeds: [
 new EmbedBuilder()
 .setTitle('✅ SEU REGISTRO FOI APROVADO!')
 .setDescription(`Parabéns! Você foi aceito como **Aliança**.\nSeu nickname foi alterado para: \`${nick}\``)
 .setColor(0x3498DB)
 .setTimestamp()
 ]
 });
 } catch (e) {
 console.log('[Registration] Não foi possível enviar DM');
 }

 global.registrosPendentes.delete(regId);
 global.registroTemp.delete(regId);
 this.processingRegistrations?.delete(regId);

 // 🆕 NOVO: Deleta a mensagem do canal de solicitação
 try {
 await interaction.message.delete();
 console.log(`[Registration] Mensagem de registro ${regId} deletada após aprovação`);
 } catch (e) {
 console.log('[Registration] Não foi possível deletar mensagem:', e);
 await interaction.update({
 content: `✅ **${nick}** aprovado como Aliança!`,
 components: [],
 embeds: []
 });
 }

 } catch (error) {
 console.error('[Registration] Error approving alliance:', error);
 this.processingRegistrations?.delete(regId);

 if (!interaction.replied && !interaction.deferred) {
 await interaction.reply({
 content: '❌ Erro ao aprovar aliança.',
 ephemeral: true
 });
 }
 }
 }

 static async approveAsConvidado(interaction, regId) {
 try {
 // 🆕 NOVO: Verifica se já está processando
 if (this.isProcessing(regId)) {
 return interaction.reply({
 content: '⏳ Este registro já está sendo processado! Aguarde...',
 ephemeral: true
 });
 }

 if (!(await this.checkRecruiterPermission(interaction))) return;

 const registro = global.registrosPendentes.get(regId);

 // 🆕 NOVO: Se registro não existe, verifica se já foi processado anteriormente
 if (!registro) {
 return interaction.reply({
 content: '✅ Este registro já foi processado anteriormente! O cargo já foi atribuído.',
 ephemeral: true
 });
 }

 // 🆕 NOVO: Marca como processando
 this.markProcessing(regId);

 const dados = registro.dados || registro;
 const { nick, guilda, server, plataforma, arma } = dados;
 const member = registro.member || interaction.guild.members.cache.get(registro.userId);

 if (!member) {
 this.processingRegistrations?.delete(regId);
 return interaction.reply({
 content: '❌ Membro não encontrado no servidor!',
 ephemeral: true
 });
 }

 try {
 await member.setNickname(nick);
 } catch (e) {
 console.log('[Registration] Não foi possível alterar nickname');
 }

 const cargoConvidado = interaction.guild.roles.cache.find(r => r.name === 'Convidado');
 if (cargoConvidado) {
 await member.roles.add(cargoConvidado);
 }

 const embedAprovado = new EmbedBuilder()
 .setTitle('✅ REGISTRO APROVADO - CONVIDADO')
 .setDescription(
 `**Jogador:** ${nick}\n` +
 `**Guilda:** ${guilda}\n` +
 `**Server:** ${server}\n` +
 `**Plataforma:** ${plataforma || 'N/A'}\n` +
 `**Arma Principal:** ${arma}\n` +
 `**Aprovado por:** ${interaction.user.tag}\n` +
 `**Status:** Convidado`
 )
 .setColor(0xF1C40F)
 .setTimestamp();

 const canalLogs = interaction.guild.channels.cache.find(c => c.name === 'logs-registros');
 if (canalLogs) {
 await canalLogs.send({ embeds: [embedAprovado] });
 }

 try {
 await member.send({
 embeds: [
 new EmbedBuilder()
 .setTitle('✅ SEU REGISTRO FOI APROVADO!')
 .setDescription(`Bem-vindo! Você foi aceito como **Convidado**.\nSeu nickname foi alterado para: \`${nick}\``)
 .setColor(0xF1C40F)
 .setTimestamp()
 ]
 });
 } catch (e) {
 console.log('[Registration] Não foi possível enviar DM');
 }

 global.registrosPendentes.delete(regId);
 global.registroTemp.delete(regId);
 this.processingRegistrations?.delete(regId);

 // 🆕 NOVO: Deleta a mensagem do canal de solicitação
 try {
 await interaction.message.delete();
 console.log(`[Registration] Mensagem de registro ${regId} deletada após aprovação`);
 } catch (e) {
 console.log('[Registration] Não foi possível deletar mensagem:', e);
 await interaction.update({
 content: `✅ **${nick}** aprovado como Convidado!`,
 components: [],
 embeds: []
 });
 }

 } catch (error) {
 console.error('[Registration] Error approving guest:', error);
 this.processingRegistrations?.delete(regId);

 if (!interaction.replied && !interaction.deferred) {
 await interaction.reply({
 content: '❌ Erro ao aprovar convidado.',
 ephemeral: true
 });
 }
 }
 }

 static async handleRejectRegistration(interaction, regId) {
 try {
 if (!(await this.checkRecruiterPermission(interaction))) return;

 const modal = new ModalBuilder()
 .setCustomId(`modal_recusar_registro_${regId}`)
 .setTitle('Motivo da Recusa');

 const motivoInput = new TextInputBuilder()
 .setCustomId('motivo_recusa')
 .setLabel('Explique o motivo da recusa')
 .setStyle(TextInputStyle.Paragraph)
 .setRequired(true)
 .setMaxLength(1000);

 modal.addComponents(new ActionRowBuilder().addComponents(motivoInput));
 await interaction.showModal(modal);

 } catch (error) {
 console.error('[Registration] Error showing rejection modal:', error);
 await interaction.reply({
 content: '❌ Erro ao abrir modal de recusa.',
 ephemeral: true
 });
 }
 }

 static async processRejectionWithReason(interaction, regId) {
 try {
 const motivo = interaction.fields.getTextInputValue('motivo_recusa');
 const registro = global.registrosPendentes.get(regId);

 if (!registro) {
 return interaction.reply({
 content: '❌ Registro não encontrado!',
 ephemeral: true
 });
 }

 const dados = registro.dados || registro;
 const { nick } = dados;
 const member = registro.member || interaction.guild.members.cache.get(registro.userId);

 // Salvar no histórico de recusas
 if (!global.historicoRegistros) global.historicoRegistros = new Map();
 if (!global.historicoRegistros.has(registro.userId)) {
 global.historicoRegistros.set(registro.userId, []);
 }

 global.historicoRegistros.get(registro.userId).push({
 tipo: 'recusado',
 motivo: motivo,
 nick: nick,
 data: Date.now(),
 analisadoPor: interaction.user.tag
 });

 // Enviar DM para o usuário
 if (member) {
 try {
 await member.send({
 embeds: [
 new EmbedBuilder()
 .setTitle('❌ SEU REGISTRO FOI RECUSADO')
 .setDescription(`Seu registro foi recusado.\n\n**Motivo:** ${motivo}\n\nVocê pode tentar novamente quando quiser.`)
 .setColor(0xE74C3C)
 .setTimestamp()
 ]
 });
 } catch (e) {
 console.log('[Registration] Não foi possível enviar DM de recusa');
 }
 }

 // Log de recusa
 const canalLogs = interaction.guild.channels.cache.find(c => c.name === 'logs-registros');
 if (canalLogs) {
 await canalLogs.send({
 embeds: [
 new EmbedBuilder()
 .setTitle('❌ REGISTRO RECUSADO')
 .setDescription(
 `**Jogador:** ${nick}\n` +
 `**Recusado por:** ${interaction.user.tag}\n` +
 `**Motivo:** ${motivo}`
 )
 .setColor(0xE74C3C)
 .setTimestamp()
 ]
 });
 }

 global.registrosPendentes.delete(regId);
 global.registroTemp.delete(regId);

 // 🆕 NOVO: Deleta a mensagem do canal de solicitação ao recusar
 try {
 await interaction.message.delete();
 console.log(`[Registration] Mensagem de registro ${regId} deletada após recusa`);
 } catch (e) {
 console.log('[Registration] Não foi possível deletar mensagem de recusa:', e);
 await interaction.reply({
 content: `❌ **${nick}** recusado. Motivo enviado por DM.`,
 ephemeral: true
 });
 }

 } catch (error) {
 console.error('[Registration] Error processing rejection:', error);
 await interaction.reply({
 content: '❌ Erro ao processar recusa.',
 ephemeral: true
 });
 }
 }

 static async handleBlacklistAdd(interaction, regId) {
 try {
 if (!(await this.checkRecruiterPermission(interaction))) return;

 const modal = new ModalBuilder()
 .setCustomId(`modal_blacklist_${regId}`)
 .setTitle('Adicionar à Blacklist');

 const motivoInput = new TextInputBuilder()
 .setCustomId('motivo_blacklist')
 .setLabel('Motivo da blacklist')
 .setStyle(TextInputStyle.Paragraph)
 .setRequired(true)
 .setMaxLength(1000);

 modal.addComponents(new ActionRowBuilder().addComponents(motivoInput));
 await interaction.showModal(modal);

 } catch (error) {
 console.error('[Registration] Error showing blacklist modal:', error);
 await interaction.reply({
 content: '❌ Erro ao abrir modal de blacklist.',
 ephemeral: true
 });
 }
 }

 static async processBlacklistAdd(interaction, regId) {
 try {
 const motivo = interaction.fields.getTextInputValue('motivo_blacklist');
 const registro = global.registrosPendentes.get(regId);

 if (!registro) {
 return interaction.reply({
 content: '❌ Registro não encontrado!',
 ephemeral: true
 });
 }

 const dados = registro.dados || registro;
 const { nick, guilda } = dados;
 const member = registro.member || interaction.guild.members.cache.get(registro.userId);

 // Adicionar à blacklist
 global.blacklist.set(registro.userId, {
 nick: nick,
 guilda: guilda,
 motivo: motivo,
 adicionadoPor: interaction.user.tag,
 data: Date.now()
 });

 // Banir do servidor
 if (member) {
 try {
 await member.ban({ reason: `Blacklist: ${motivo}` });
 } catch (e) {
 console.log('[Registration] Não foi possível banir usuário');
 }
 }

 // Log
 const canalLogs = interaction.guild.channels.cache.find(c => c.name === 'logs-blacklist');
 if (canalLogs) {
 await canalLogs.send({
 embeds: [
 new EmbedBuilder()
 .setTitle('🚫 USUÁRIO ADICIONADO À BLACKLIST')
 .setDescription(
 `**Usuário:** ${nick} (${registro.userId})\n` +
 `**Guilda:** ${guilda}\n` +
 `**Motivo:** ${motivo}\n` +
 `**Adicionado por:** ${interaction.user.tag}`
 )
 .setColor(0x000000)
 .setTimestamp()
 ]
 });
 }

 global.registrosPendentes.delete(regId);
 global.registroTemp.delete(regId);

 // 🆕 NOVO: Deleta a mensagem do canal de solicitação ao adicionar na blacklist
 try {
 await interaction.message.delete();
 console.log(`[Registration] Mensagem de registro ${regId} deletada após blacklist`);
 } catch (e) {
 console.log('[Registration] Não foi possível deletar mensagem de blacklist:', e);
 await interaction.reply({
 content: `🚫 **${nick}** adicionado à blacklist e banido!`,
 ephemeral: true
 });
 }

 } catch (error) {
 console.error('[Registration] Error adding to blacklist:', error);
 await interaction.reply({
 content: '❌ Erro ao adicionar à blacklist.',
 ephemeral: true
 });
 }
 }

 static async checkExistingRegistration(guild, userId, nick) {
 const erros = [];

 // Verificar se já está registrado
 const membro = guild.members.cache.get(userId);
 if (membro && membro.roles.cache.some(r =>
 r.name === 'Membro' ||
 r.name === 'Aliança' ||
 r.name === 'Convidado'
 )) {
 erros.push('Você já está registrado neste servidor!');
 }

 // Verificar blacklist
 if (global.blacklist.has(userId)) {
 const dados = global.blacklist.get(userId);
 erros.push(`🚫 Você está na blacklist! Motivo: ${dados.motivo}`);
 }

 // Verificar se nick já existe
 const membroComMesmoNick = guild.members.cache.find(m =>
 m.nickname === nick && m.id !== userId
 );
 if (membroComMesmoNick) {
 erros.push(`O nickname "${nick}" já está em uso por outro jogador!`);
 }

 return erros;
 }
}

module.exports = RegistrationActions;