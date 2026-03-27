const {
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle
} = require('discord.js');
const FinanceHandler = require('./financeHandler');

const balanceCooldowns = new Map();
const BALANCE_COOLDOWN_MS = 8000;

// Sistema de lock local para operações financeiras
const processingUsers = new Set();

class ConsultarSaldoHandler {
    static async sendPanel(channel) {
        try {
            console.log(`[ConsultarSaldo] Sending panel to channel ${channel.id}`);

            const embed = new EmbedBuilder()
                .setTitle('🔍 CONSULTAR SALDO')
                .setDescription(
                    'Bem-vindo ao sistema financeiro! Aqui você pode:\n\n' +
                    '💰 **Consultar Saldo** - Veja seu saldo atual no privado\n' +
                    '💸 **Sacar Saldo** - Solicite um saque do seu saldo\n' +
                    '💳 **Solicitar Empréstimo** - Peça um empréstimo da guilda\n' +
                    '🔄 **Transferir Saldo** - Envie saldo para outro jogador\n' +
                    '✅ **Quitar Empréstimo** - Pague parte ou toda a sua dívida'
                )
                .setColor(0x3498DB)
                .setFooter({ text: 'Clique nos botões abaixo para interagir' })
                .setTimestamp();

            const botoes = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId('btn_consultar_saldo')
                        .setLabel('💰 Consultar Saldo')
                        .setStyle(ButtonStyle.Primary),
                    new ButtonBuilder()
                        .setCustomId('btn_sacar_saldo')
                        .setLabel('💸 Sacar Saldo')
                        .setStyle(ButtonStyle.Success),
                    new ButtonBuilder()
                        .setCustomId('btn_solicitar_emprestimo')
                        .setLabel('💳 Solicitar Empréstimo')
                        .setStyle(ButtonStyle.Secondary),
                    new ButtonBuilder()
                        .setCustomId('btn_transferir_saldo')
                        .setLabel('🔄 Transferir Saldo')
                        .setStyle(ButtonStyle.Secondary),
                    new ButtonBuilder()
                        .setCustomId('btn_quitar_emprestimo')
                        .setLabel('✅ Quitar Empréstimo')
                        .setStyle(ButtonStyle.Danger)
                );

            await channel.send({
                embeds: [embed],
                components: [botoes]
            });

            console.log(`[ConsultarSaldo] Panel sent successfully`);

        } catch (error) {
            console.error(`[ConsultarSaldo] Error sending panel:`, error);
            throw error;
        }
    }

    static async handleConsultarSaldo(interaction) {
        // Verificar cooldown
        const now = Date.now();
        const lastUsed = balanceCooldowns.get(interaction.user.id);
        if (lastUsed && (now - lastUsed) < BALANCE_COOLDOWN_MS) {
            try {
                if (!interaction.replied && !interaction.deferred) {
                    await interaction.reply({
                        content: '⏳ Aguarde alguns segundos antes de consultar novamente.',
                        ephemeral: true
                    });
                }
            } catch (e) {}
            return;
        }
        balanceCooldowns.set(interaction.user.id, now);

        try {
            console.log(`[ConsultarSaldo] Balance check requested by ${interaction.user.id}`);

            // DEFER REPLY IMEDIATO para segurar a interação
            await interaction.deferReply({ ephemeral: true });

            // Enviar informações no privado
            await FinanceHandler.sendBalanceInfo(interaction.user);

            // Responder confirmando o envio
            await interaction.editReply({
                content: '✅ Verifique seu privado! Enviei seu saldo por lá.'
            });

        } catch (error) {
            console.error(`[ConsultarSaldo] Error checking balance:`, error);

            try {
                if (interaction.deferred && !interaction.replied) {
                    await interaction.editReply({
                        content: '❌ Não consegui enviar mensagem no seu privado. Verifique se você permite DMs de membros do servidor.'
                    });
                }
            } catch (e) {
                console.error(`[ConsultarSaldo] Failed to send error response:`, e);
            }
        }
    }

    static async handleSacarSaldo(interaction) {
        try {
            console.log(`[ConsultarSaldo] Withdrawal requested by ${interaction.user.id}`);
            const modal = FinanceHandler.createWithdrawModal();
            await interaction.showModal(modal);
        } catch (error) {
            console.error(`[ConsultarSaldo] Error showing withdrawal modal:`, error);
            try {
                if (!interaction.replied && !interaction.deferred) {
                    await interaction.reply({
                        content: '❌ Erro ao abrir modal de saque.',
                        ephemeral: true
                    }).catch(() => {});
                }
            } catch (e) {}
        }
    }

    static async handleSolicitarEmprestimo(interaction) {
        try {
            console.log(`[ConsultarSaldo] Loan requested by ${interaction.user.id}`);
            const modal = FinanceHandler.createLoanModal();
            await interaction.showModal(modal);
        } catch (error) {
            console.error(`[ConsultarSaldo] Error showing loan modal:`, error);
            try {
                if (!interaction.replied && !interaction.deferred) {
                    await interaction.reply({
                        content: '❌ Erro ao abrir modal de empréstimo.',
                        ephemeral: true
                    }).catch(() => {});
                }
            } catch (e) {}
        }
    }

    static async handleTransferirSaldo(interaction) {
        try {
            console.log(`[ConsultarSaldo] Transfer requested by ${interaction.user.id}`);
            const modal = FinanceHandler.createTransferModal();
            await interaction.showModal(modal);
        } catch (error) {
            console.error(`[ConsultarSaldo] Error showing transfer modal:`, error);
            try {
                if (!interaction.replied && !interaction.deferred) {
                    await interaction.reply({
                        content: '❌ Erro ao abrir modal de transferência.',
                        ephemeral: true
                    }).catch(() => {});
                }
            } catch (e) {}
        }
    }

    static async handleQuitarEmprestimo(interaction) {
        try {
            console.log(`[ConsultarSaldo] Loan payment requested by ${interaction.user.id}`);
            const modal = FinanceHandler.createLoanPaymentModal();
            await interaction.showModal(modal);
        } catch (error) {
            console.error(`[ConsultarSaldo] Error showing loan payment modal:`, error);
            try {
                if (!interaction.replied && !interaction.deferred) {
                    await interaction.reply({
                        content: '❌ Erro ao abrir modal de quitação de empréstimo.',
                        ephemeral: true
                    }).catch(() => {});
                }
            } catch (e) {}
        }
    }
}

module.exports = ConsultarSaldoHandler;
