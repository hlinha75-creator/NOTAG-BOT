const {
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle
} = require('discord.js');
const Database = require('../utils/database');
const fs = require('fs');
const path = require('path');

const PENDING_FILE = path.join(__dirname, '..', 'data', 'pending_finance.json');

function savePendingFinance() {
    try {
        const data = {
            withdrawals: Object.fromEntries(global.pendingWithdrawals || []),
            loans: Object.fromEntries(global.pendingLoans || []),
            loanPayments: Object.fromEntries(global.pendingLoanPayments || []),
            transfers: Object.fromEntries(global.pendingTransfers || [])
        };
        fs.writeFileSync(PENDING_FILE, JSON.stringify(data, null, 2));
    } catch (e) {
        console.error('[Finance] Erro ao salvar pendências:', e.message);
    }
}

function loadPendingFinance() {
    try {
        if (!fs.existsSync(PENDING_FILE)) return;
        const raw = fs.readFileSync(PENDING_FILE, 'utf8');
        const data = JSON.parse(raw);
        if (data.withdrawals) {
            for (const [k, v] of Object.entries(data.withdrawals)) {
                if (v.status === 'pendente') (global.pendingWithdrawals = global.pendingWithdrawals || new Map()).set(k, v);
            }
        }
        if (data.loans) {
            for (const [k, v] of Object.entries(data.loans)) {
                if (v.status === 'pendente') (global.pendingLoans = global.pendingLoans || new Map()).set(k, v);
            }
        }
        if (data.loanPayments) {
            for (const [k, v] of Object.entries(data.loanPayments)) {
                if (v.status === 'pendente') (global.pendingLoanPayments = global.pendingLoanPayments || new Map()).set(k, v);
            }
        }
        if (data.transfers) {
            for (const [k, v] of Object.entries(data.transfers)) {
                if (v.status === 'pendente') (global.pendingTransfers = global.pendingTransfers || new Map()).set(k, v);
            }
        }
        const total = (global.pendingWithdrawals?.size || 0) + (global.pendingLoans?.size || 0) +
            (global.pendingLoanPayments?.size || 0) + (global.pendingTransfers?.size || 0);
        if (total > 0) console.log(`[Finance] ${total} pendências financeiras carregadas do arquivo.`);
    } catch (e) {
        console.error('[Finance] Erro ao carregar pendências:', e.message);
    }
}

const modalCooldowns = new Map();
const MODAL_COOLDOWN_MS = 10000;

// Sistema de lock para evitar processamento simultâneo do mesmo usuário
const processingUsers = new Set();

function checkModalCooldown(userId, key) {
    const mapKey = `${key}_${userId}`;
    const now = Date.now();
    const last = modalCooldowns.get(mapKey);
    if (last && (now - last) < MODAL_COOLDOWN_MS) return false;
    modalCooldowns.set(mapKey, now);
    return true;
}

class FinanceHandler {
    constructor() {
        this.pendingWithdrawals = new Map();
        this.pendingLoans = new Map();
        this.pendingTransfers = new Map();
    }

    static formatSafeNumber(value) {
        if (value === undefined || value === null || isNaN(value)) {
            return '0';
        }
        return value.toLocaleString();
    }

    static createWithdrawModal() {
        const modal = new ModalBuilder()
            .setCustomId('modal_sacar_saldo')
            .setTitle('💸 Solicitar Saque');

        const valorInput = new TextInputBuilder()
            .setCustomId('valor_saque')
            .setLabel('Valor que deseja sacar (em pratas)')
            .setPlaceholder('Ex: 1000000 para 1M')
            .setStyle(TextInputStyle.Short)
            .setRequired(true)
            .setMaxLength(12);

        modal.addComponents(new ActionRowBuilder().addComponents(valorInput));
        return modal;
    }

    static async processWithdrawRequest(interaction) {
        if (processingUsers.has(interaction.user.id)) {
            console.log(`[Finance] Usuário ${interaction.user.id} já tem saque em processamento`);
            try {
                if (!interaction.replied && !interaction.deferred) {
                    await interaction.reply({
                        content: '⏳ Você já tem uma solicitação de saque em andamento. Aguarde.',
                        ephemeral: true
                    });
                }
            } catch (e) {}
            return;
        }

        processingUsers.add(interaction.user.id);

        try {
            if (!checkModalCooldown(interaction.user.id, 'saque')) {
                await interaction.reply({
                    content: '⏳ Sua solicitação de saque já foi enviada. Aguarde alguns segundos.',
                    ephemeral: true
                });
                return;
            }

            await interaction.deferReply({ ephemeral: true });

            const valorInput = interaction.fields.getTextInputValue('valor_saque').trim();
            const valorLimpo = valorInput.replace(/\./g, '').replace(/,/g, '');
            const valor = parseInt(valorLimpo);

            if (isNaN(valor) || valor <= 0) {
                await interaction.editReply({
                    content: '❌ Valor inválido! Digite apenas números (ex: 500000 para 500k)'
                });
                return;
            }

            const user = await Database.getUser(interaction.user.id);

            if (!user || user.saldo === undefined) {
                await interaction.editReply({
                    content: '❌ Erro ao consultar seu saldo. Tente novamente mais tarde.'
                });
                return;
            }

            if (user.saldo < valor) {
                await interaction.editReply({
                    content: `❌ Saldo insuficiente! Você tem \`${this.formatSafeNumber(user.saldo)}\` mas tentou sacar \`${this.formatSafeNumber(valor)}\`.`
                });
                return;
            }

            const withdrawalId = `wd_${Date.now()}_${interaction.user.id}`;
            const withdrawalData = {
                id: withdrawalId,
                userId: interaction.user.id,
                userTag: interaction.user.tag,
                valor: valor,
                saldoAtual: user.saldo,
                guildId: interaction.guild.id,
                status: 'pendente',
                timestamp: Date.now()
            };

            if (!global.pendingWithdrawals) global.pendingWithdrawals = new Map();
            global.pendingWithdrawals.set(withdrawalId, withdrawalData);
            savePendingFinance();

            console.log(`[Finance] Withdrawal request ${withdrawalId} created by ${interaction.user.id} for ${valor}`);

            const canalFinanceiro = interaction.guild.channels.cache.find(c => c.name === '📊╠financeiro');
            if (!canalFinanceiro) {
                await interaction.editReply({
                    content: '❌ Canal financeiro não encontrado! Contate um ADM.'
                });
                return;
            }

            const embed = new EmbedBuilder()
                .setTitle('💸 SOLICITAÇÃO DE SAQUE')
                .setDescription(
                    `**Jogador:** <@${interaction.user.id}> (${interaction.user.tag})\n` +
                    `**Valor Solicitado:** \`${this.formatSafeNumber(valor)}\`\n` +
                    `**Saldo Atual:** \`${this.formatSafeNumber(user.saldo)}\`\n` +
                    `**Saldo Após Saque:** \`${this.formatSafeNumber(user.saldo - valor)}\``
                )
                .setColor(0xE74C3C)
                .setTimestamp();

            const botoes = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId(`fin_confirmar_saque_${withdrawalId}`)
                        .setLabel('✅ Confirmar Saque')
                        .setStyle(ButtonStyle.Success),
                    new ButtonBuilder()
                        .setCustomId(`fin_recusar_saque_${withdrawalId}`)
                        .setLabel('❌ Recusar Saque')
                        .setStyle(ButtonStyle.Danger)
                );

            const admRole = interaction.guild.roles.cache.find(r => r.name === 'ADM');
            const staffRole = interaction.guild.roles.cache.find(r => r.name === 'Staff');
            const tesoureiroRole = interaction.guild.roles.cache.find(r => r.name === 'tesoureiro');

            let mentions = '';
            if (tesoureiroRole) mentions += `<@&${tesoureiroRole.id}> `;
            if (admRole) mentions += `<@&${admRole.id}> `;
            if (staffRole) mentions += `<@&${staffRole.id}>`;

            await canalFinanceiro.send({
                content: mentions ? `🔔 ${mentions} Nova solicitação de saque!` : '🔔 Nova solicitação de saque!',
                embeds: [embed],
                components: [botoes]
            });

            await interaction.editReply({
                content: `✅ Solicitação de saque de \`${this.formatSafeNumber(valor)}\` enviada para análise! Aguarde aprovação.`
            });

        } catch (error) {
            console.error(`[Finance] Error processing withdrawal request:`, error);
            if (interaction.deferred && !interaction.replied) {
                await interaction.editReply({
                    content: '❌ Erro ao processar solicitação de saque.'
                }).catch(() => {});
            }
        } finally {
            processingUsers.delete(interaction.user.id);
        }
    }

    static async handleConfirmWithdrawal(interaction, withdrawalId) {
        try {
            console.log(`[Finance] Confirming withdrawal ${withdrawalId}`);

            const withdrawal = global.pendingWithdrawals?.get(withdrawalId);
            if (!withdrawal) {
                return interaction.reply({
                    content: '❌ Solicitação de saque não encontrada ou já processada!',
                    ephemeral: true
                });
            }

            if (withdrawal.status !== 'pendente') {
                return interaction.reply({
                    content: '❌ Esta solicitação já foi processada!',
                    ephemeral: true
                });
            }

            const isADM = interaction.member.roles.cache.some(r => r.name === 'ADM');
            const isStaff = interaction.member.roles.cache.some(r => r.name === 'Staff');
            const isTesoureiro = interaction.member.roles.cache.some(r => r.name === 'tesoureiro');

            if (!isADM && !isStaff && !isTesoureiro) {
                return interaction.reply({
                    content: '❌ Apenas ADM, Staff ou Tesoureiro podem confirmar saques!',
                    ephemeral: true
                });
            }

            withdrawal.status = 'processando';
            await interaction.deferUpdate();

            const guildId = withdrawal.guildId || interaction.guild.id;
            await Database.removeSaldo(withdrawal.userId, withdrawal.valor, 'saque_aprovado', guildId);

            withdrawal.status = 'aprovado';
            withdrawal.aprovadoPor = interaction.user.id;
            withdrawal.aprovadoEm = Date.now();
            savePendingFinance();

            try {
                const user = await interaction.client.users.fetch(withdrawal.userId);
                const userData = await Database.getUser(withdrawal.userId);
                const novoSaldo = userData?.saldo || 0;

                const embed = new EmbedBuilder()
                    .setTitle('✅ SAQUE APROVADO')
                    .setDescription(
                        `💰 **Transação Concluída com Sucesso!**\n\n` +
                        `> **Valor Sacado:** \`${this.formatSafeNumber(withdrawal.valor)}\`\n` +
                        `> **Aprovado por:** \`${interaction.user.tag}\`\n` +
                        `> **Data:** ${new Date().toLocaleString('pt-BR')}\n\n` +
                        `💳 **Novo Saldo:** \`${this.formatSafeNumber(novoSaldo)}\``
                    )
                    .setColor(0x2ECC71)
                    .setFooter({
                        text: 'NOTAG Bot • Sistema Financeiro'
                    })
                    .setTimestamp();

                await user.send({ embeds: [embed] });
            } catch (e) {
                console.log(`[Finance] Could not DM user ${withdrawal.userId}`);
            }

            await interaction.editReply({
                content: `✅ Saque de \`${this.formatSafeNumber(withdrawal.valor)}\` aprovado para ${withdrawal.userTag}!\n👤 **Aprovado por:** ${interaction.user.tag}`,
                components: []
            });

            const canalLogs = interaction.guild.channels.cache.find(c => c.name === '📜╠logs-banco');
            if (canalLogs) {
                await canalLogs.send({
                    embeds: [
                        new EmbedBuilder()
                            .setTitle('📝 LOG: SAQUE APROVADO')
                            .setDescription(
                                `**Jogador:** <@${withdrawal.userId}>\n` +
                                `**Valor:** \`${this.formatSafeNumber(withdrawal.valor)}\`\n` +
                                `**Aprovado por:** <@${interaction.user.id}>`
                            )
                            .setColor(0x2ECC71)
                            .setTimestamp()
                    ]
                });
            }

        } catch (error) {
            console.error(`[Finance] Error confirming withdrawal:`, error);
            await interaction.editReply({
                content: '❌ Erro ao confirmar saque.',
            });
        }
    }

    static async handleRejectWithdrawal(interaction, withdrawalId) {
        try {
            console.log(`[Finance] Rejecting withdrawal ${withdrawalId}`);

            const withdrawal = global.pendingWithdrawals?.get(withdrawalId);
            if (!withdrawal) {
                return interaction.reply({
                    content: '❌ Solicitação não encontrada!',
                    ephemeral: true
                });
            }

            const modal = new ModalBuilder()
                .setCustomId(`modal_motivo_recusa_saque_${withdrawalId}`)
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
            console.error(`[Finance] Error showing rejection modal:`, error);
            await interaction.reply({
                content: '❌ Erro ao abrir modal de recusa.',
                ephemeral: true
            });
        }
    }

    static async processWithdrawalRejection(interaction, withdrawalId) {
        try {
            const motivo = interaction.fields.getTextInputValue('motivo_recusa');
            const withdrawal = global.pendingWithdrawals?.get(withdrawalId);

            if (!withdrawal) {
                return interaction.reply({
                    content: '❌ Solicitação não encontrada!',
                    ephemeral: true
                });
            }

            withdrawal.status = 'recusado';
            withdrawal.motivoRecusa = motivo;
            withdrawal.recusadoPor = interaction.user.id;
            savePendingFinance();

            try {
                const user = await interaction.client.users.fetch(withdrawal.userId);

                const embed = new EmbedBuilder()
                    .setTitle('❌ SAQUE RECUSADO')
                    .setDescription(
                        `⚠️ **Sua solicitação de saque foi recusada.**\n\n` +
                        `> **Valor Solicitado:** \`${this.formatSafeNumber(withdrawal.valor)}\`\n` +
                        `> **Motivo:** \`\`\`${motivo}\`\`\`\n` +
                        `> **Recusado por:** \`${interaction.user.tag}\`\n\n` +
                        `💡 *Se você tiver dúvidas, entre em contato com um administrador.*`
                    )
                    .setColor(0xE74C3C)
                    .setFooter({
                        text: 'NOTAG Bot • Sistema Financeiro'
                    })
                    .setTimestamp();

                await user.send({ embeds: [embed] });
            } catch (e) {
                console.log(`[Finance] Could not DM user ${withdrawal.userId}`);
            }

            await interaction.reply({
                content: `❌ Saque recusado. Motivo enviado para o jogador.`,
                ephemeral: true
            });

            try {
                await interaction.message.edit({
                    content: `❌ SAQUE RECUSADO por ${interaction.user.tag}\n**Motivo:** ${motivo}`,
                    components: []
                });
            } catch (e) {
                console.log('[Finance] Could not edit original message');
            }

        } catch (error) {
            console.error(`[Finance] Error processing rejection:`, error);
            await interaction.reply({
                content: '❌ Erro ao processar recusa.',
                ephemeral: true
            });
        }
    }

    static createLoanModal() {
        const modal = new ModalBuilder()
            .setCustomId('modal_solicitar_emprestimo')
            .setTitle('💳 Solicitar Empréstimo');

        const valorInput = new TextInputBuilder()
            .setCustomId('valor_emprestimo')
            .setLabel('Valor que deseja pegar emprestado (em pratas)')
            .setPlaceholder('Ex: 1000000 para 1M')
            .setStyle(TextInputStyle.Short)
            .setRequired(true)
            .setMaxLength(12);

        modal.addComponents(new ActionRowBuilder().addComponents(valorInput));
        return modal;
    }

    static async processLoanRequest(interaction) {
        if (processingUsers.has(interaction.user.id)) {
            console.log(`[Finance] Usuário ${interaction.user.id} já tem empréstimo em processamento`);
            try {
                if (!interaction.replied && !interaction.deferred) {
                    await interaction.reply({
                        content: '⏳ Você já tem uma solicitação em andamento. Aguarde.',
                        ephemeral: true
                    });
                }
            } catch (e) {}
            return;
        }

        processingUsers.add(interaction.user.id);

        try {
            if (!checkModalCooldown(interaction.user.id, 'emprestimo')) {
                await interaction.reply({
                    content: '⏳ Sua solicitação de empréstimo já foi enviada. Aguarde alguns segundos.',
                    ephemeral: true
                });
                return;
            }

            await interaction.deferReply({ ephemeral: true });

            const valorInput = interaction.fields.getTextInputValue('valor_emprestimo').trim();
            const valorLimpo = valorInput.replace(/\./g, '').replace(/,/g, '');
            const valor = parseInt(valorLimpo);

            if (isNaN(valor) || valor <= 0) {
                await interaction.editReply({
                    content: '❌ Valor inválido! Digite apenas números.'
                });
                return;
            }

            const loanId = `loan_${Date.now()}_${interaction.user.id}`;
            const loanData = {
                id: loanId,
                userId: interaction.user.id,
                userTag: interaction.user.tag,
                valor: valor,
                guildId: interaction.guild.id,
                status: 'pendente',
                timestamp: Date.now()
            };

            if (!global.pendingLoans) global.pendingLoans = new Map();
            global.pendingLoans.set(loanId, loanData);
            savePendingFinance();

            console.log(`[Finance] Loan request ${loanId} created by ${interaction.user.id} for ${valor}`);

            const canalFinanceiro = interaction.guild.channels.cache.find(c => c.name === '📊╠financeiro');
            if (!canalFinanceiro) {
                await interaction.editReply({
                    content: '❌ Canal financeiro não encontrado!'
                });
                return;
            }

            const embed = new EmbedBuilder()
                .setTitle('💳 SOLICITAÇÃO DE EMPRÉSTIMO')
                .setDescription(
                    `**Jogador:** <@${interaction.user.id}> (${interaction.user.tag})\n` +
                    `**Valor Solicitado:** \`${this.formatSafeNumber(valor)}\``
                )
                .setColor(0x3498DB)
                .setTimestamp();

            const botoes = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId(`fin_confirmar_emprestimo_${loanId}`)
                        .setLabel('✅ Aprovar Empréstimo')
                        .setStyle(ButtonStyle.Success),
                    new ButtonBuilder()
                        .setCustomId(`fin_recusar_emprestimo_${loanId}`)
                        .setLabel('❌ Recusar Empréstimo')
                        .setStyle(ButtonStyle.Danger)
                );

            const admRole = interaction.guild.roles.cache.find(r => r.name === 'ADM');
            const staffRole = interaction.guild.roles.cache.find(r => r.name === 'Staff');
            const tesoureiroRole = interaction.guild.roles.cache.find(r => r.name === 'tesoureiro');

            let mentions = '';
            if (tesoureiroRole) mentions += `<@&${tesoureiroRole.id}> `;
            if (admRole) mentions += `<@&${admRole.id}> `;
            if (staffRole) mentions += `<@&${staffRole.id}>`;

            await canalFinanceiro.send({
                content: mentions ? `🔔 ${mentions} Nova solicitação de empréstimo!` : '🔔 Nova solicitação de empréstimo!',
                embeds: [embed],
                components: [botoes]
            });

            await interaction.editReply({
                content: `✅ Solicitação de empréstimo de \`${this.formatSafeNumber(valor)}\` enviada para análise!`
            });

        } catch (error) {
            console.error(`[Finance] Error processing loan request:`, error);
            if (interaction.deferred && !interaction.replied) {
                await interaction.editReply({
                    content: '❌ Erro ao processar solicitação de empréstimo.'
                }).catch(() => {});
            }
        } finally {
            processingUsers.delete(interaction.user.id);
        }
    }

    static async handleConfirmLoan(interaction, loanId) {
        try {
            console.log(`[Finance] Confirming loan ${loanId}`);

            const loan = global.pendingLoans?.get(loanId);
            if (!loan) {
                return interaction.reply({
                    content: '❌ Solicitação de empréstimo não encontrada!',
                    ephemeral: true
                });
            }

            if (loan.status !== 'pendente') {
                return interaction.reply({
                    content: '❌ Esta solicitação já foi processada!',
                    ephemeral: true
                });
            }

            const isADM = interaction.member.roles.cache.some(r => r.name === 'ADM');
            const isStaff = interaction.member.roles.cache.some(r => r.name === 'Staff');
            const isTesoureiro = interaction.member.roles.cache.some(r => r.name === 'tesoureiro');

            if (!isADM && !isStaff && !isTesoureiro) {
                return interaction.reply({
                    content: '❌ Apenas ADM, Staff ou Tesoureiro podem aprovar empréstimos!',
                    ephemeral: true
                });
            }

            loan.status = 'processando';
            await interaction.deferUpdate();

            const guildId = loan.guildId || interaction.guild.id;
            await Database.addSaldo(loan.userId, loan.valor, 'emprestimo_aprovado', guildId);
            const user = await Database.getUser(loan.userId);
            const novaDivida = (user.emprestimosPendentes || 0) + loan.valor;
            await Database.updateUser(loan.userId, { emprestimos_pendentes: novaDivida });

            loan.status = 'aprovado';
            loan.aprovadoPor = interaction.user.id;
            loan.aprovadoEm = Date.now();
            savePendingFinance();

            try {
                const discordUser = await interaction.client.users.fetch(loan.userId);
                const userData = await Database.getUser(loan.userId);
                const novoSaldo = userData?.saldo || 0;
                const dividaTotal = userData?.emprestimosPendentes || loan.valor;

                const embed = new EmbedBuilder()
                    .setTitle('✅ EMPRÉSTIMO APROVADO')
                    .setDescription(
                        `💳 **Crédito Liberado!**\n\n` +
                        `> **Valor do Empréstimo:** \`${this.formatSafeNumber(loan.valor)}\`\n` +
                        `> **Aprovado por:** \`${interaction.user.tag}\`\n` +
                        `> **Data:** ${new Date().toLocaleString('pt-BR')}\n\n` +
                        `💰 **Novo Saldo:** \`${this.formatSafeNumber(novoSaldo)}\`\n` +
                        `📊 **Dívida Total:** \`${this.formatSafeNumber(dividaTotal)}\`\n\n` +
                        `⚠️ *Lembre-se de quitar seu empréstimo assim que possível!*`
                    )
                    .setColor(0x3498DB)
                    .setFooter({
                        text: 'NOTAG Bot • Sistema Financeiro'
                    })
                    .setTimestamp();

                await discordUser.send({ embeds: [embed] });
            } catch (e) {
                console.log(`[Finance] Could not DM user ${loan.userId}`);
            }

            await interaction.editReply({
                content: `✅ Empréstimo de \`${this.formatSafeNumber(loan.valor)}\` aprovado para ${loan.userTag}!\n👤 **Aprovado por:** ${interaction.user.tag}`,
                components: []
            });

            const canalLogs = interaction.guild.channels.cache.find(c => c.name === '📜╠logs-banco');
            if (canalLogs) {
                await canalLogs.send({
                    embeds: [
                        new EmbedBuilder()
                            .setTitle('📝 LOG: EMPRÉSTIMO APROVADO')
                            .setDescription(
                                `**Jogador:** <@${loan.userId}>\n` +
                                `**Valor:** \`${this.formatSafeNumber(loan.valor)}\`\n` +
                                `**Aprovado por:** <@${interaction.user.id}>`
                            )
                            .setColor(0x3498DB)
                            .setTimestamp()
                    ]
                });
            }

        } catch (error) {
            console.error(`[Finance] Error confirming loan:`, error);
            await interaction.editReply({
                content: '❌ Erro ao aprovar empréstimo.',
            });
        }
    }

    static async handleRejectLoan(interaction, loanId) {
        try {
            console.log(`[Finance] Rejecting loan ${loanId}`);

            const loan = global.pendingLoans?.get(loanId);
            if (!loan) {
                return interaction.reply({
                    content: '❌ Solicitação não encontrada!',
                    ephemeral: true
                });
            }

            const isADM = interaction.member.roles.cache.some(r => r.name === 'ADM');
            const isStaff = interaction.member.roles.cache.some(r => r.name === 'Staff');
            const isTesoureiro = interaction.member.roles.cache.some(r => r.name === 'tesoureiro');

            if (!isADM && !isStaff && !isTesoureiro) {
                return interaction.reply({
                    content: '❌ Sem permissão!',
                    ephemeral: true
                });
            }

            loan.status = 'recusado';
            loan.recusadoPor = interaction.user.id;
            savePendingFinance();

            try {
                const user = await interaction.client.users.fetch(loan.userId);

                const embed = new EmbedBuilder()
                    .setTitle('❌ EMPRÉSTIMO RECUSADO')
                    .setDescription(
                        `⚠️ **Sua solicitação de empréstimo foi recusada.**\n\n` +
                        `> **Valor Solicitado:** \`${this.formatSafeNumber(loan.valor)}\`\n` +
                        `> **Recusado por:** \`${interaction.user.tag}\`\n\n` +
                        `💡 *Entre em contato com a administração para mais informações.*`
                    )
                    .setColor(0xE74C3C)
                    .setFooter({
                        text: 'NOTAG Bot • Sistema Financeiro'
                    })
                    .setTimestamp();

                await user.send({ embeds: [embed] });
            } catch (e) {
                console.log(`[Finance] Could not DM user ${loan.userId}`);
            }

            await interaction.update({
                content: `❌ Empréstimo recusado. Motivo enviado ao jogador.\n👤 **Recusado por:** ${interaction.user.tag}`,
                components: []
            });

        } catch (error) {
            console.error(`[Finance] Error rejecting loan:`, error);
            await interaction.reply({
                content: '❌ Erro ao recusar empréstimo.',
                ephemeral: true
            });
        }
    }

    static createLoanPaymentModal() {
        const modal = new ModalBuilder()
            .setCustomId('modal_quitar_emprestimo')
            .setTitle('✅ Quitar Empréstimo');

        const valorInput = new TextInputBuilder()
            .setCustomId('valor_quitacao')
            .setLabel('Valor que deseja quitar (em pratas)')
            .setPlaceholder('Ex: 1000000 para 1M')
            .setStyle(TextInputStyle.Short)
            .setRequired(true)
            .setMaxLength(12);

        modal.addComponents(new ActionRowBuilder().addComponents(valorInput));
        return modal;
    }

    static async processLoanPaymentRequest(interaction) {
        if (processingUsers.has(interaction.user.id)) {
            console.log(`[Finance] Usuário ${interaction.user.id} já tem quitação em processamento`);
            try {
                if (!interaction.replied && !interaction.deferred) {
                    await interaction.reply({
                        content: '⏳ Você já tem uma solicitação em andamento. Aguarde.',
                        ephemeral: true
                    });
                }
            } catch (e) {}
            return;
        }

        processingUsers.add(interaction.user.id);

        try {
            if (!checkModalCooldown(interaction.user.id, 'quitacao')) {
                await interaction.reply({
                    content: '⏳ Sua solicitação de quitação já foi enviada. Aguarde alguns segundos.',
                    ephemeral: true
                });
                return;
            }

            await interaction.deferReply({ ephemeral: true });

            const valorInput = interaction.fields.getTextInputValue('valor_quitacao').trim();
            const valorLimpo = valorInput.replace(/\./g, '').replace(/,/g, '');
            const valor = parseInt(valorLimpo);

            if (isNaN(valor) || valor <= 0) {
                await interaction.editReply({
                    content: '❌ Valor inválido! Digite apenas números (ex: 500000 para 500k)'
                });
                return;
            }

            const user = await Database.getUser(interaction.user.id);

            if (!user) {
                await interaction.editReply({
                    content: '❌ Erro ao consultar seus dados. Tente novamente mais tarde.'
                });
                return;
            }

            const dividaAtual = user.emprestimosPendentes || 0;

            if (dividaAtual <= 0) {
                await interaction.editReply({
                    content: '✅ Você não possui empréstimos pendentes para quitar!'
                });
                return;
            }

            if (valor > dividaAtual) {
                await interaction.editReply({
                    content: `❌ O valor de quitação (\`${this.formatSafeNumber(valor)}\`) é maior que sua dívida atual (\`${this.formatSafeNumber(dividaAtual)}\`).`
                });
                return;
            }

            if (user.saldo < valor) {
                await interaction.editReply({
                    content: `❌ Saldo insuficiente! Você tem \`${this.formatSafeNumber(user.saldo)}\` mas tentou quitar \`${this.formatSafeNumber(valor)}\`.`
                });
                return;
            }

            const paymentId = `pay_${Date.now()}_${interaction.user.id}`;
            const paymentData = {
                id: paymentId,
                userId: interaction.user.id,
                userTag: interaction.user.tag,
                valor: valor,
                dividaAtual: dividaAtual,
                dividaRestante: dividaAtual - valor,
                guildId: interaction.guild.id,
                status: 'pendente',
                timestamp: Date.now()
            };

            if (!global.pendingLoanPayments) global.pendingLoanPayments = new Map();
            global.pendingLoanPayments.set(paymentId, paymentData);
            savePendingFinance();

            console.log(`[Finance] Loan payment ${paymentId} created by ${interaction.user.id} for ${valor}`);

            const canalFinanceiro = interaction.guild.channels.cache.find(c => c.name === '📊╠financeiro');
            if (!canalFinanceiro) {
                await interaction.editReply({
                    content: '❌ Canal financeiro não encontrado! Contate um ADM.'
                });
                return;
            }

            const embed = new EmbedBuilder()
                .setTitle('✅ SOLICITAÇÃO DE QUITAÇÃO DE EMPRÉSTIMO')
                .setDescription(
                    `**Jogador:** <@${interaction.user.id}> (${interaction.user.tag})\n` +
                    `**Valor a Quitar:** \`${this.formatSafeNumber(valor)}\`\n` +
                    `**Dívida Atual:** \`${this.formatSafeNumber(dividaAtual)}\`\n` +
                    `**Dívida Após Quitação:** \`${this.formatSafeNumber(dividaAtual - valor)}\``
                )
                .setColor(0x2ECC71)
                .setTimestamp();

            const botoes = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId(`fin_confirmar_quitacao_${paymentId}`)
                        .setLabel('✅ Confirmar Quitação')
                        .setStyle(ButtonStyle.Success),
                    new ButtonBuilder()
                        .setCustomId(`fin_recusar_quitacao_${paymentId}`)
                        .setLabel('❌ Recusar Quitação')
                        .setStyle(ButtonStyle.Danger)
                );

            const admRole = interaction.guild.roles.cache.find(r => r.name === 'ADM');
            const staffRole = interaction.guild.roles.cache.find(r => r.name === 'Staff');
            const tesoureiroRole = interaction.guild.roles.cache.find(r => r.name === 'tesoureiro');

            let mentions = '';
            if (tesoureiroRole) mentions += `<@&${tesoureiroRole.id}> `;
            if (admRole) mentions += `<@&${admRole.id}> `;
            if (staffRole) mentions += `<@&${staffRole.id}>`;

            await canalFinanceiro.send({
                content: mentions ? `🔔 ${mentions} Solicitação de quitação de empréstimo!` : '🔔 Solicitação de quitação de empréstimo!',
                embeds: [embed],
                components: [botoes]
            });

            await interaction.editReply({
                content: `✅ Solicitação de quitação de \`${this.formatSafeNumber(valor)}\` enviada para análise! Aguarde aprovação.`
            });

        } catch (error) {
            console.error(`[Finance] Error processing loan payment request:`, error);
            if (interaction.deferred && !interaction.replied) {
                await interaction.editReply({
                    content: '❌ Erro ao processar solicitação de quitação.'
                }).catch(() => {});
            }
        } finally {
            processingUsers.delete(interaction.user.id);
        }
    }

    static async handleConfirmLoanPayment(interaction, paymentId) {
        try {
            console.log(`[Finance] Confirming loan payment ${paymentId}`);

            const payment = global.pendingLoanPayments?.get(paymentId);
            if (!payment) {
                return interaction.reply({
                    content: '❌ Solicitação de quitação não encontrada ou já processada!',
                    ephemeral: true
                });
            }

            if (payment.status !== 'pendente') {
                return interaction.reply({
                    content: '❌ Esta solicitação já foi processada!',
                    ephemeral: true
                });
            }

            const isADM = interaction.member.roles.cache.some(r => r.name === 'ADM');
            const isStaff = interaction.member.roles.cache.some(r => r.name === 'Staff');
            const isTesoureiro = interaction.member.roles.cache.some(r => r.name === 'tesoureiro');

            if (!isADM && !isStaff && !isTesoureiro) {
                return interaction.reply({
                    content: '❌ Apenas ADM, Staff ou Tesoureiro podem confirmar quitações!',
                    ephemeral: true
                });
            }

            payment.status = 'processando';
            await interaction.deferUpdate();

            const guildId = payment.guildId || interaction.guild.id;
            await Database.removeSaldo(payment.userId, payment.valor, 'quitacao_emprestimo', guildId);
            const novaDivida = Math.max(0, payment.dividaAtual - payment.valor);
            await Database.updateUser(payment.userId, { emprestimos_pendentes: novaDivida });

            payment.status = 'aprovado';
            payment.aprovadoPor = interaction.user.id;
            payment.aprovadoEm = Date.now();
            savePendingFinance();

            try {
                const discordUser = await interaction.client.users.fetch(payment.userId);
                const userData = await Database.getUser(payment.userId);
                const novoSaldo = userData?.saldo || 0;

                const embed = new EmbedBuilder()
                    .setTitle('✅ QUITAÇÃO DE EMPRÉSTIMO APROVADA')
                    .setDescription(
                        `💳 **Pagamento Confirmado!**\n\n` +
                        `> **Valor Quitado:** \`${this.formatSafeNumber(payment.valor)}\`\n` +
                        `> **Aprovado por:** \`${interaction.user.tag}\`\n` +
                        `> **Data:** ${new Date().toLocaleString('pt-BR')}\n\n` +
                        `💰 **Novo Saldo:** \`${this.formatSafeNumber(novoSaldo)}\`\n` +
                        `📊 **Dívida Restante:** \`${this.formatSafeNumber(novaDivida)}\``
                    )
                    .setColor(0x2ECC71)
                    .setFooter({ text: 'NOTAG Bot • Sistema Financeiro' })
                    .setTimestamp();

                await discordUser.send({ embeds: [embed] });
            } catch (e) {
                console.log(`[Finance] Could not DM user ${payment.userId}`);
            }

            await interaction.editReply({
                content: `✅ Quitação de \`${this.formatSafeNumber(payment.valor)}\` aprovada para ${payment.userTag}!\n👤 **Aprovado por:** ${interaction.user.tag}`,
                components: []
            });

            const canalLogs = interaction.guild.channels.cache.find(c => c.name === '📜╠logs-banco');
            if (canalLogs) {
                await canalLogs.send({
                    embeds: [
                        new EmbedBuilder()
                            .setTitle('📝 LOG: QUITAÇÃO DE EMPRÉSTIMO APROVADA')
                            .setDescription(
                                `**Jogador:** <@${payment.userId}>\n` +
                                `**Valor Quitado:** \`${this.formatSafeNumber(payment.valor)}\`\n` +
                                `**Dívida Restante:** \`${this.formatSafeNumber(novaDivida)}\`\n` +
                                `**Aprovado por:** <@${interaction.user.id}>`
                            )
                            .setColor(0x2ECC71)
                            .setTimestamp()
                    ]
                });
            }

        } catch (error) {
            payment.status = 'pendente';
            console.error(`[Finance] Error confirming loan payment:`, error);
            await interaction.editReply({
                content: '❌ Erro ao confirmar quitação.',
            });
        }
    }

    static async handleRejectLoanPayment(interaction, paymentId) {
        try {
            console.log(`[Finance] Rejecting loan payment ${paymentId}`);

            const payment = global.pendingLoanPayments?.get(paymentId);
            if (!payment) {
                return interaction.reply({
                    content: '❌ Solicitação não encontrada!',
                    ephemeral: true
                });
            }

            const isADM = interaction.member.roles.cache.some(r => r.name === 'ADM');
            const isStaff = interaction.member.roles.cache.some(r => r.name === 'Staff');
            const isTesoureiro = interaction.member.roles.cache.some(r => r.name === 'tesoureiro');

            if (!isADM && !isStaff && !isTesoureiro) {
                return interaction.reply({
                    content: '❌ Sem permissão!',
                    ephemeral: true
                });
            }

            payment.status = 'recusado';
            payment.recusadoPor = interaction.user.id;
            savePendingFinance();

            try {
                const discordUser = await interaction.client.users.fetch(payment.userId);

                const embed = new EmbedBuilder()
                    .setTitle('❌ QUITAÇÃO DE EMPRÉSTIMO RECUSADA')
                    .setDescription(
                        `⚠️ **Sua solicitação de quitação foi recusada.**\n\n` +
                        `> **Valor Solicitado:** \`${this.formatSafeNumber(payment.valor)}\`\n` +
                        `> **Recusado por:** \`${interaction.user.tag}\`\n\n` +
                        `💡 *Entre em contato com a administração para mais informações.*`
                    )
                    .setColor(0xE74C3C)
                    .setFooter({ text: 'NOTAG Bot • Sistema Financeiro' })
                    .setTimestamp();

                await discordUser.send({ embeds: [embed] });
            } catch (e) {
                console.log(`[Finance] Could not DM user ${payment.userId}`);
            }

            await interaction.update({
                content: `❌ Quitação recusada. Motivo enviado ao jogador.\n👤 **Recusado por:** ${interaction.user.tag}`,
                components: []
            });

        } catch (error) {
            console.error(`[Finance] Error rejecting loan payment:`, error);
            await interaction.reply({
                content: '❌ Erro ao recusar quitação.',
                ephemeral: true
            });
        }
    }

    static createTransferModal() {
        const modal = new ModalBuilder()
            .setCustomId('modal_transferir_saldo')
            .setTitle('🔄 Transferir Saldo');

        const usuarioInput = new TextInputBuilder()
            .setCustomId('id_usuario')
            .setLabel('ID do usuário destino')
            .setPlaceholder('Ex: 123456789012345678')
            .setStyle(TextInputStyle.Short)
            .setRequired(true)
            .setMaxLength(20);

        const valorInput = new TextInputBuilder()
            .setCustomId('valor_transferencia')
            .setLabel('Valor a transferir (em pratas)')
            .setPlaceholder('Ex: 500000 para 500k')
            .setStyle(TextInputStyle.Short)
            .setRequired(true)
            .setMaxLength(12);

        const comentarioInput = new TextInputBuilder()
            .setCustomId('comentario_transferencia')
            .setLabel('Motivo/Comentário (opcional)')
            .setPlaceholder('Ex: Pagamento por craft...')
            .setStyle(TextInputStyle.Paragraph)
            .setRequired(false)
            .setMaxLength(500);

        modal.addComponents(
            new ActionRowBuilder().addComponents(usuarioInput),
            new ActionRowBuilder().addComponents(valorInput),
            new ActionRowBuilder().addComponents(comentarioInput)
        );
        return modal;
    }

    static async processTransferRequest(interaction) {
        if (processingUsers.has(interaction.user.id)) {
            console.log(`[Finance] Usuário ${interaction.user.id} já tem transferência em processamento`);
            try {
                if (!interaction.replied && !interaction.deferred) {
                    await interaction.reply({
                        content: '⏳ Você já tem uma solicitação em andamento. Aguarde.',
                        ephemeral: true
                    });
                }
            } catch (e) {}
            return;
        }

        processingUsers.add(interaction.user.id);

        try {
            if (!checkModalCooldown(interaction.user.id, 'transferencia')) {
                await interaction.reply({
                    content: '⏳ Sua solicitação de transferência já foi enviada. Aguarde alguns segundos.',
                    ephemeral: true
                });
                return;
            }

            await interaction.deferReply({ ephemeral: true });

            const userIdDestino = interaction.fields.getTextInputValue('id_usuario').trim();
            const valorInput = interaction.fields.getTextInputValue('valor_transferencia').trim();
            const comentario = interaction.fields.getTextInputValue('comentario_transferencia')?.trim() || 'Sem motivo especificado';

            const valorLimpo = valorInput.replace(/\./g, '').replace(/,/g, '');
            const valor = parseInt(valorLimpo);

            if (isNaN(valor) || valor <= 0) {
                await interaction.editReply({
                    content: '❌ Valor inválido!'
                });
                return;
            }

            if (!/^\d{17,19}$/.test(userIdDestino)) {
                await interaction.editReply({
                    content: '❌ ID de usuário inválido! Deve ter 17-19 dígitos.'
                });
                return;
            }

            if (userIdDestino === interaction.user.id) {
                await interaction.editReply({
                    content: '❌ Você não pode transferir para si mesmo!'
                });
                return;
            }

            const userOrigem = await Database.getUser(interaction.user.id);
            if (!userOrigem || userOrigem.saldo === undefined) {
                await interaction.editReply({
                    content: '❌ Erro ao consultar seu saldo. Tente novamente mais tarde.'
                });
                return;
            }

            if (userOrigem.saldo < valor) {
                await interaction.editReply({
                    content: `❌ Saldo insuficiente! Você tem \`${this.formatSafeNumber(userOrigem.saldo)}\`.`
                });
                return;
            }

            let destinoTag = 'Usuário não encontrado';
            try {
                const destinoUser = await interaction.client.users.fetch(userIdDestino);
                destinoTag = destinoUser.tag;
            } catch (e) {
                await interaction.editReply({
                    content: '❌ Usuário destino não encontrado no Discord!'
                });
                return;
            }

            const transferId = `transf_${Date.now()}_${interaction.user.id}`;
            const transferData = {
                id: transferId,
                fromId: interaction.user.id,
                fromTag: interaction.user.tag,
                toId: userIdDestino,
                toTag: destinoTag,
                valor: valor,
                comentario: comentario,
                status: 'pendente',
                timestamp: Date.now()
            };

            if (!global.pendingTransfers) global.pendingTransfers = new Map();
            global.pendingTransfers.set(transferId, transferData);
            savePendingFinance();

            console.log(`[Finance] Transfer request ${transferId} from ${interaction.user.id} to ${userIdDestino} - Motivo: ${comentario}`);

            try {
                const destinoUser = await interaction.client.users.fetch(userIdDestino);

                const embed = new EmbedBuilder()
                    .setTitle('🔄 SOLICITAÇÃO DE TRANSFERÊNCIA')
                    .setDescription(
                        `💸 **Você recebeu uma proposta de transferência!**\n\n` +
                        `> **De:** \`${interaction.user.tag}\`\n` +
                        `> **Valor:** \`${this.formatSafeNumber(valor)}\`\n` +
                        `> **Motivo:** \`\`\`${comentario}\`\`\`\n\n` +
                        `🤔 *Aceitar ou recusar esta transferência?*`
                    )
                    .setColor(0xF1C40F)
                    .setFooter({
                        text: 'NOTAG Bot • Sistema Financeiro'
                    })
                    .setTimestamp();

                const botoes = new ActionRowBuilder()
                    .addComponents(
                        new ButtonBuilder()
                            .setCustomId(`transf_aceitar_${transferId}`)
                            .setLabel('✅ Aceitar')
                            .setStyle(ButtonStyle.Success),
                        new ButtonBuilder()
                            .setCustomId(`transf_recusar_${transferId}`)
                            .setLabel('❌ Recusar')
                            .setStyle(ButtonStyle.Danger)
                    );

                await destinoUser.send({
                    embeds: [embed],
                    components: [botoes]
                });

                await interaction.editReply({
                    content: `✅ Solicitação de transferência enviada para ${destinoTag}!\n📝 **Motivo:** \`${comentario}\`\nAguarde confirmação.`
                });

            } catch (e) {
                console.log(`[Finance] Could not DM destination user ${userIdDestino}`);
                await interaction.editReply({
                    content: '❌ Não foi possível enviar mensagem para o usuário destino. Verifique se ele permite DMs.'
                });
            }

        } catch (error) {
            console.error(`[Finance] Error processing transfer request:`, error);
            if (interaction.deferred && !interaction.replied) {
                await interaction.editReply({
                    content: '❌ Erro ao processar transferência.'
                }).catch(() => {});
            }
        } finally {
            processingUsers.delete(interaction.user.id);
        }
    }

    static async handleAcceptTransfer(interaction, transferId) {
        try {
            console.log(`[Finance] Accepting transfer ${transferId}`);

            const transfer = global.pendingTransfers?.get(transferId);
            if (!transfer) {
                return interaction.reply({
                    content: '❌ Transferência não encontrada ou expirada!',
                    ephemeral: true
                });
            }

            if (interaction.user.id !== transfer.toId) {
                return interaction.reply({
                    content: '❌ Você não é o destinatário desta transferência!',
                    ephemeral: true
                });
            }

            const userOrigem = await Database.getUser(transfer.fromId);
            if (!userOrigem || userOrigem.saldo < transfer.valor) {
                return interaction.reply({
                    content: '❌ O remetente não possui saldo suficiente mais!',
                    ephemeral: true
                });
            }

            await Database.removeSaldo(transfer.fromId, transfer.valor, 'transferencia_enviada');
            await Database.addSaldo(transfer.toId, transfer.valor, 'transferencia_recebida');

            transfer.status = 'concluida';
            transfer.dataAceite = Date.now();
            savePendingFinance();

            try {
                const origemUser = await interaction.client.users.fetch(transfer.fromId);

                const embed = new EmbedBuilder()
                    .setTitle('✅ TRANSFERÊNCIA CONCLUÍDA')
                    .setDescription(
                        `🎉 **Sua transferência foi aceita!**\n\n` +
                        `> **Para:** \`${interaction.user.tag}\`\n` +
                        `> **Valor:** \`${this.formatSafeNumber(transfer.valor)}\`\n` +
                        `> **Motivo:** \`\`\`${transfer.comentario}\`\`\`\n` +
                        `> **Data:** ${new Date().toLocaleString('pt-BR')}\n\n` +
                        `💰 O valor já foi debitado da sua conta.`
                    )
                    .setColor(0x2ECC71)
                    .setFooter({
                        text: 'NOTAG Bot • Sistema Financeiro'
                    })
                    .setTimestamp();

                await origemUser.send({ embeds: [embed] });
            } catch (e) {
                console.log(`[Finance] Could not notify origin user ${transfer.fromId}`);
            }

            const embedAceite = new EmbedBuilder()
                .setTitle('✅ TRANSFERÊNCIA RECEBIDA')
                .setDescription(
                    `💰 **Você aceitou a transferência!**\n\n` +
                    `> **De:** \`${transfer.fromTag}\`\n` +
                    `> **Valor Recebido:** \`${this.formatSafeNumber(transfer.valor)}\`\n` +
                    `> **Motivo:** \`\`\`${transfer.comentario}\`\`\`\n` +
                    `> **Data:** ${new Date().toLocaleString('pt-BR')}`
                )
                .setColor(0x2ECC71)
                .setFooter({
                    text: 'NOTAG Bot • Sistema Financeiro'
                })
                .setTimestamp();

            await interaction.update({
                content: '',
                embeds: [embedAceite],
                components: []
            });

            const canalLogs = interaction.guild.channels.cache.find(c => c.name === '📜╠logs-banco');
            if (canalLogs) {
                await canalLogs.send({
                    embeds: [
                        new EmbedBuilder()
                            .setTitle('📝 LOG: TRANSFERÊNCIA')
                            .setDescription(
                                `**De:** <@${transfer.fromId}>\n` +
                                `**Para:** <@${transfer.toId}>\n` +
                                `**Valor:** \`${this.formatSafeNumber(transfer.valor)}\`\n` +
                                `**Motivo:** \`${transfer.comentario}\``
                            )
                            .setColor(0x95A5A6)
                            .setTimestamp()
                    ]
                });
            }

        } catch (error) {
            console.error(`[Finance] Error accepting transfer:`, error);
            await interaction.reply({
                content: '❌ Erro ao aceitar transferência.',
                ephemeral: true
            });
        }
    }

    static async handleRejectTransfer(interaction, transferId) {
        try {
            console.log(`[Finance] Rejecting transfer ${transferId}`);

            const transfer = global.pendingTransfers?.get(transferId);
            if (!transfer) {
                return interaction.reply({
                    content: '❌ Transferência não encontrada!',
                    ephemeral: true
                });
            }

            if (interaction.user.id !== transfer.toId) {
                return interaction.reply({
                    content: '❌ Você não é o destinatário desta transferência!',
                    ephemeral: true
                });
            }

            transfer.status = 'recusada';
            savePendingFinance();

            try {
                const origemUser = await interaction.client.users.fetch(transfer.fromId);

                const embed = new EmbedBuilder()
                    .setTitle('❌ TRANSFERÊNCIA RECUSADA')
                    .setDescription(
                        `⚠️ **Sua transferência foi recusada.**\n\n` +
                        `> **Para:** \`${interaction.user.tag}\`\n` +
                        `> **Valor:** \`${this.formatSafeNumber(transfer.valor)}\`\n` +
                        `> **Motivo Original:** \`${transfer.comentario}\`\n\n` +
                        `💡 O valor não foi debitado da sua conta.`
                    )
                    .setColor(0xE74C3C)
                    .setFooter({
                        text: 'NOTAG Bot • Sistema Financeiro'
                    })
                    .setTimestamp();

                await origemUser.send({ embeds: [embed] });
            } catch (e) {
                console.log(`[Finance] Could not notify origin user ${transfer.fromId}`);
            }

            const embedRecusa = new EmbedBuilder()
                .setTitle('❌ TRANSFERÊNCIA RECUSADA')
                .setDescription(
                    `🚫 **Você recusou a transferência.**\n\n` +
                    `> **De:** \`${transfer.fromTag}\`\n` +
                    `> **Valor:** \`${this.formatSafeNumber(transfer.valor)}\`\n` +
                    `> **Motivo:** \`${transfer.comentario}\``
                )
                .setColor(0xE74C3C)
                .setFooter({
                    text: 'NOTAG Bot • Sistema Financeiro'
                })
                .setTimestamp();

            await interaction.update({
                content: '',
                embeds: [embedRecusa],
                components: []
            });

        } catch (error) {
            console.error(`[Finance] Error rejecting transfer:`, error);
            await interaction.reply({
                content: '❌ Erro ao recusar transferência.',
                ephemeral: true
            });
        }
    }

    static async sendBalanceInfo(user) {
        try {
            const userData = await Database.getUser(user.id);

            if (!userData) {
                console.error(`[Finance] User data not found for ${user.id}`);
                throw new Error('Dados do usuário não encontrados');
            }

            const saldo = userData.saldo || 0;
            const emprestimosPendentes = userData.emprestimosPendentes || 0;
            const saldoLiquido = saldo - emprestimosPendentes;
            const totalRecebido = userData.totalRecebido || 0;
            const totalSacado = userData.totalSacado || 0;
            const totalEmprestimos = userData.totalEmprestimos || 0;

            const embed = new EmbedBuilder()
                .setTitle('💰 SEU SALDO')
                .setDescription(
                    `📊 **Resumo Financeiro Completo**\n\n` +
                    `💵 **Saldo Bruto:** \`\`\`${this.formatSafeNumber(saldo)}\`\`\`\n` +
                    `📉 **Empréstimos Pendentes:** \`\`\`${this.formatSafeNumber(emprestimosPendentes)}\`\`\`\n` +
                    `✨ **Saldo Líquido:** \`\`\`${this.formatSafeNumber(saldoLiquido)}\`\`\`\n\n` +
                    `📈 **Estatísticas:**\n` +
                    `> Total Recebido: \`${this.formatSafeNumber(totalRecebido)}\`\n` +
                    `> Total Sacado: \`${this.formatSafeNumber(totalSacado)}\`\n` +
                    `> Total em Empréstimos: \`${this.formatSafeNumber(totalEmprestimos)}\``
                )
                .setColor(0x2ECC71)
                .setFooter({
                    text: `NOTAG Bot • Sistema Financeiro • ${new Date().toLocaleDateString('pt-BR')}`
                })
                .setTimestamp();

            const percentualSaque = totalRecebido > 0
                ? Math.round((totalSacado / totalRecebido) * 100)
                : 0;

            embed.addFields({
                name: '📊 Movimentação',
                value: `Saque/Recebimento: \`${percentualSaque}%\``,
                inline: false
            });

            await user.send({ embeds: [embed] });
            console.log(`[Finance] Balance info sent to ${user.id}`);
        } catch (error) {
            console.error(`[Finance] Error sending balance info:`, error);
            throw error;
        }
    }
}

module.exports = FinanceHandler;
module.exports.loadPendingFinance = loadPendingFinance;
module.exports.savePendingFinance = savePendingFinance;
