const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, StringSelectMenuOptionBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('ajuda')
    .setDescription('📚 Mostra o guia completo de comandos e funcionalidades do bot'),

  async execute(interaction, client) {
    try {
      const embedPrincipal = new EmbedBuilder()
        .setTitle('📚 CENTRAL DE AJUDA - NOTAG BOT')
        .setDescription(
          `**Bem-vindo à central de ajuda!**\n\n` +
          `Aqui você encontra informações detalhadas sobre todos os comandos e funcionalidades do bot.\n\n` +
          `**🤖 Sobre o Bot:**\n` +
          `Bot completo para gerenciamento de guilda Albion Online, com sistema financeiro, eventos, registro de membros e muito mais.\n\n` +
          `**📋 Como usar:**\n` +
          `Selecione uma categoria no menu abaixo para ver os comandos e funcionalidades disponíveis.`
        )
        .setColor(0x3498DB)
        .setThumbnail('https://i.imgur.com/5K9Q5ZK.png')
        .addFields(
          {
            name: '⚙️ Comandos Admin',
            value: '`/instalar`, `/desistalar`, `/atualizar`',
            inline: true
          },
          {
            name: '⚠️ Comandos Dono',
            value: '`/limpar-eventos`, `/limpar-saldo`, `/limpar-xp`',
            inline: true
          },
          {
            name: '📖 Ajuda',
            value: '`/ajuda`',
            inline: true
          }
        )
        .setFooter({ text: 'NOTAG Bot • Use o menu abaixo para navegar' })
        .setTimestamp();

      const menu = new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
          .setCustomId('ajuda_menu')
          .setPlaceholder('📚 Selecione uma categoria...')
          .addOptions([
            new StringSelectMenuOptionBuilder()
              .setLabel('📋 Visão Geral')
              .setValue('geral')
              .setDescription('Informações gerais do bot')
              .setEmoji('📋'),
            new StringSelectMenuOptionBuilder()
              .setLabel('⚙️ Comandos Administrativos')
              .setValue('admin')
              .setDescription('Comandos para ADMs e Staff')
              .setEmoji('⚙️'),
            new StringSelectMenuOptionBuilder()
              .setLabel('📝 Sistema de Registro')
              .setValue('registro')
              .setDescription('Como funciona o registro de novos membros')
              .setEmoji('📝'),
            new StringSelectMenuOptionBuilder()
              .setLabel('⚔️ Sistema de Eventos')
              .setValue('eventos')
              .setDescription('Criar e gerenciar eventos da guilda')
              .setEmoji('⚔️'),
            new StringSelectMenuOptionBuilder()
              .setLabel('🏰 Raid Avalon')
              .setValue('raid')
              .setDescription('Sistema de raids organizadas')
              .setEmoji('🏰'),
            new StringSelectMenuOptionBuilder()
              .setLabel('💰 Sistema Financeiro')
              .setValue('financeiro')
              .setDescription('Banco, depósitos, saques e empréstimos')
              .setEmoji('💰'),
            new StringSelectMenuOptionBuilder()
              .setLabel('🎓 Albion Academy')
              .setValue('academy')
              .setDescription('XP, níveis, perfil e orbs')
              .setEmoji('🎓'),
            new StringSelectMenuOptionBuilder()
              .setLabel('💎 Venda de Baú')
              .setValue('bau')
              .setDescription('Como vender baús para o banco da guilda')
              .setEmoji('💎'),
            new StringSelectMenuOptionBuilder()
              .setLabel('📊 Outras Funcionalidades')
              .setValue('outros')
              .setDescription('Lista de membros, estatísticas, etc')
              .setEmoji('📊')
          ])
      );

      await interaction.reply({
        embeds: [embedPrincipal],
        components: [menu],
        ephemeral: true
      });

      // Criar collector para o menu
      const collector = interaction.channel.createMessageComponentCollector({
        filter: i => i.user.id === interaction.user.id && i.customId === 'ajuda_menu',
        time: 300000 // 5 minutos
      });

      collector.on('collect', async (i) => {
        const categoria = i.values[0];
        let embed;

        switch (categoria) {
          case 'geral':
            embed = new EmbedBuilder()
              .setTitle('📋 VISÃO GERAL DO BOT')
              .setDescription(
                `**NOTAG Bot** é um sistema completo para gerenciamento de guildas de Albion Online.\n\n` +
                `**🎯 Principais Funcionalidades:**\n` +
                `• Registro automatizado de novos membros\n` +
                `• Sistema de eventos com controle de participação\n` +
                `• Banco da guilda com saldos, depósitos e saques\n` +
                `• Sistema de XP e níveis (Albion Academy)\n` +
                `• Raid Avalon organizada por classes\n` +
                `• Venda de baús com taxas automáticas\n` +
                `• Estatísticas e histórico completo\n\n` +
                `**👥 Cargos Importantes:**\n` +
                `• **ADM** - Acesso total ao bot\n` +
                `• **Staff** - Gerenciar eventos e finanças\n` +
                `• **Tesoureiro** - Aprovar depósitos e pagamentos\n` +
                `• **Recrutador** - Aprovar registros de novos membros\n\n` +
                `**💡 Dica:** Use o menu abaixo para explorar cada funcionalidade em detalhes.`
              )
              .setColor(0x3498DB)
              .setFooter({ text: 'NOTAG Bot • Sistema Completo de Guilda' });
            break;

          case 'admin':
            embed = new EmbedBuilder()
              .setTitle('⚙️ COMANDOS ADMINISTRATIVOS')
              .setDescription('Comandos restritos a ADMs, Staff e Dono do bot.')
              .setColor(0xE74C3C)
              .addFields(
                {
                  name: '🏗️ `/instalar`',
                  value: '**Permissão:** ADM\n' +
                         'Cria toda a estrutura do servidor automaticamente:\n' +
                         '• Categorias (ALBION ACADEMY, EVENTOS, FINANCEIRO, etc)\n' +
                         '• Canais de texto e voz\n' +
                         '• Cargos (Membro, Aliança, Convidado, Staff, etc)\n' +
                         '• Sistema de permissões configurado',
                  inline: false
                },
                {
                  name: '🗑️ `/desistalar`',
                  value: '**Permissão:** ADM\n' +
                         'Remove toda a estrutura criada pelo bot:\n' +
                         '• Deleta canais e categorias\n' +
                         '• Remove permissões configuradas\n' +
                         '⚠️ Ação irreversível!',
                  inline: false
                },
                {
                  name: '🔄 `/atualizar`',
                  value: '**Permissão:** ADM/Staff\n' +
                         'Atualiza a participação de um membro em eventos:\n' +
                         '• Ajusta porcentagem manualmente\n' +
                         '• Útil para corrigir tempo de participação\n' +
                         '• Parâmetros: @membro + porcentagem (0-100)',
                  inline: false
                },
                {
                  name: '⚠️ `/limpar-eventos`',
                  value: '**Permissão:** Dono do Bot apenas\n' +
                         'Limpa TODO o histórico de eventos do servidor.\n' +
                         '⚠️ **Extremamente perigoso!** Apaga todos os dados!',
                  inline: false
                },
                {
                  name: '⚠️ `/limpar-saldo`',
                  value: '**Permissão:** Dono do Bot apenas\n' +
                         'Zera os saldos de TODOS os jogadores.\n' +
                         '⚠️ Remove todo o dinheiro do banco!',
                  inline: false
                },
                {
                  name: '⚠️ `/limpar-xp`',
                  value: '**Permissão:** Dono do Bot apenas\n' +
                         'Reseta o XP e níveis de TODOS os jogadores.\n' +
                         '⚠️ Todos voltam para o nível 1!',
                  inline: false
                }
              );
            break;

          case 'registro':
            embed = new EmbedBuilder()
              .setTitle('📝 SISTEMA DE REGISTRO')
              .setDescription(
                'Sistema completo para recrutamento e aprovação de novos membros.\n\n' +
                '**🔄 Fluxo do Registro:**\n' +
                '1️⃣ Novo membro clica em **"📋 Registrar-se"**\n' +
                '2️⃣ Preenche formulário (Nick, Guilda, Plataforma, Arma)\n' +
                '3️⃣ Envia screenshot do personagem\n' +
                '4️⃣ Recrutador analisa e aprova/recusa\n' +
                '5️⃣ Membro recebe cargo e nickname é alterado'
              )
              .setColor(0x2ECC71)
              .addFields(
                {
                  name: '✅ Tipos de Aprovação',
                  value: '• **Membro** - Membro oficial da guilda\n' +
                         '• **Aliança** - Parceiro de aliança\n' +
                         '• **Convidado** - Visitante temporário\n' +
                         '• **Recusar** - Negar entrada com motivo\n' +
                         '• **Blacklist** - Banir e adicionar à lista negra',
                  inline: false
                },
                {
                  name: '🚫 Sistema de Blacklist',
                  value: 'Jogadores na blacklist são automaticamente banidos ao tentar registrar.\n' +
                         'Motivos são registrados e podem ser consultados.',
                  inline: false
                },
                {
                  name: '👥 Quem pode aprovar?',
                  value: '• Recrutadores\n' +
                         '• Staff\n' +
                         '• ADMs',
                  inline: true
                },
                {
                  name: '📍 Canais Envolvidos',
                  value: '• `📝╠registro` - Formulário\n' +
                         '• `📋╠analise` - Análise de registros\n' +
                         '• `🚪╠saída-membros` - Logs de saída',
                  inline: true
                }
              );
            break;

          case 'eventos':
            embed = new EmbedBuilder()
              .setTitle('⚔️ SISTEMA DE EVENTOS')
              .setDescription(
                'Gerencie eventos da guilda com controle automático de participação e divisão de loot.'
              )
              .setColor(0xF1C40F)
              .addFields(
                {
                  name: '➕ Criar Evento',
                  value: 'Clique em **"Criar Evento"** no painel e preencha:\n' +
                         '• Nome do evento\n' +
                         '• Descrição\n' +
                         '• Requisitos (opcional)\n' +
                         '• Horário',
                  inline: false
                },
                {
                  name: '✋ Participar',
                  value: 'Membros clicam em **"Entrar no Evento"** para:\n' +
                         '• Ser adicionado à lista\n' +
                         '• Receber permissão para entrar na call\n' +
                         '• Começar a contar tempo de participação',
                  inline: false
                },
                {
                  name: '🎮 Controles do Criador',
                  value: '• **Iniciar** - Começa o evento e timer\n' +
                         '• **Pausar** - Pausa timer do participante\n' +
                         '• **Pausar Global** - Pausa todos os timers\n' +
                         '• **Trancar** - Fecha para novos participantes\n' +
                         '• **Finalizar** - Encerra e libera divisão de loot',
                  inline: false
                },
                {
                  name: '💰 Divisão de Loot (LootSplit)',
                  value: 'Após finalizar:\n' +
                         '• Simule a divisão informando valor total\n' +
                         '• Adicione valor de sacos extras\n' +
                         '• Desconte reparos se necessário\n' +
                         '• Sistema calcula automaticamente por tempo participado\n' +
                         '• Envia para aprovação do Staff/ADM',
                  inline: false
                },
                {
                  name: '📍 Canais Importantes',
                  value: '• `⚔️╠participar` - Lista de eventos\n' +
                         '• `📊╠financeiro` - Aprovação de pagamentos\n' +
                         '• `🔊╠Aguardando-Evento` - Call de espera',
                  inline: true
                }
              );
            break;

          case 'raid':
            embed = new EmbedBuilder()
              .setTitle('🏰 SISTEMA DE RAID AVALON')
              .setDescription(
                'Organize raids em Avalon com controle de classes e armas específicas.'
              )
              .setColor(0x9B59B6)
              .addFields(
                {
                  name: '⚙️ Configuração',
                  value: 'Ao criar uma Raid Avalon:\n' +
                         '• Defina limite total de participantes\n' +
                         '• Configure limite por classe (Main Tank, Suporte, etc)\n' +
                         '• Escolha horário e descrição',
                  inline: false
                },
                {
                  name: '🛡️ Classes Disponíveis',
                  value: '• **Main Tank** - Tanque principal\n' +
                         '• **Suporte** - Healers e suportes\n' +
                         '• **DPS Melee** - Dano corpo a corpo\n' +
                         '• **DPS Ranged** - Dano à distância\n' +
                         '• **Engenheiro** - Armas de cerco',
                  inline: false
                },
                {
                  name: '🎮 Como Participar',
                  value: '1. Clique em **"Entrar na Raid"**\n' +
                         '2. Escolha sua classe\n' +
                         '3. Selecione sua arma específica\n' +
                         '4. Confirme participação\n\n' +
                         '⚠️ Cada classe tem limite de vagas!',
                  inline: false
                },
                {
                  name: '👑 Controles do Líder',
                  value: '• **Iniciar Raid** - Começa o evento\n' +
                         '• **Finalizar** - Encerra com sucesso\n' +
                         '• **Cancelar** - Cancela a raid',
                  inline: true
                }
              );
            break;

          case 'financeiro':
            embed = new EmbedBuilder()
              .setTitle('💰 SISTEMA FINANCEIRO')
              .setDescription(
                'Banco completo da guilda para gerenciamento de recursos e pagamentos.'
              )
              .setColor(0x2ECC71)
              .addFields(
                {
                  name: '💵 Depósitos',
                  value: 'Como depositar dinheiro:\n' +
                         '1. Vá em `💵╠depositar`\n' +
                         '2. Clique em **"Realizar Depósito"**\n' +
                         '3. Informe o valor (em milhões)\n' +
                         '4. Anexe screenshot do comprovante (link)\n' +
                         '5. Aguarde aprovação do Tesoureiro\n\n' +
                         '⚠️ Depósitos só são creditados após aprovação!',
                  inline: false
                },
                {
                  name: '💸 Saques',
                  value: 'Como sacar seu saldo:\n' +
                         '1. Vá em `💰╠consultar-saldo`\n' +
                         '2. Clique em **"Sacar Saldo"**\n' +
                         '3. Informe o valor desejado\n' +
                         '4. Aguarde aprovação do Staff/ADM\n' +
                         '5. Receba o pagamento em jogo',
                  inline: false
                },
                {
                  name: '💳 Empréstimos',
                  value: 'Solicite empréstimos do banco:\n' +
                         '• Prazo de pagamento configurável\n' +
                         '• Taxa de juros automática\n' +
                         '• Aprovação Staff/ADM necessária\n' +
                         '• Limite baseado no histórico',
                  inline: false
                },
                {
                  name: '💎 Transferências',
                  value: 'Transfira saldo para outros membros:\n' +
                         '• Informe o destinatário\n' +
                         '• Confirme o valor\n' +
                         '• O destinatário precisa aceitar\n' +
                         '• Sem taxas para transferências',
                  inline: false
                },
                {
                  name: '💰 Taxas Automáticas',
                  value: '• **Taxa Guilda:** % definido pelo ADM (padrão 10%)\n' +
                         '• **Venda de Baú:** Varia por local (Royal 10%, Black 15%, etc)\n' +
                         '• **Empréstimo:** Juros configuráveis',
                  inline: false
                },
                {
                  name: '📍 Canais',
                  value: '• `💵╠depositar` - Fazer depósitos\n' +
                         '• `💰╠consultar-saldo` - Ver saldo/saque\n' +
                         '• `📊╠financeiro` - Aprovações (Staff)\n' +
                         '• `📜╠logs-banco` - Logs de transações',
                  inline: true
                }
              );
            break;

          case 'academy':
            embed = new EmbedBuilder()
              .setTitle('🎓 ALBION ACADEMY')
              .setDescription(
                'Sistema de progressão e recompensas para membros da guilda.'
              )
              .setColor(0x3498DB)
              .addFields(
                {
                  name: '⭐ Sistema de XP',
                  value: 'Ganhe XP ao participar da guilda:\n' +
                         '• XP por eventos finalizados\n' +
                         '• XP por participação em raids\n' +
                         '• Bônus por bom desempenho\n' +
                         '• Suba de nível e desbloqueie benefícios',
                  inline: false
                },
                {
                  name: '🎖️ Níveis e Benefícios',
                  value: '• Cada nível requer mais XP\n' +
                         '• Benefícios exclusivos por nível\n' +
                         '• Reconhecimento na guilda\n' +
                         '• Acesso a eventos especiais',
                  inline: false
                },
                {
                  name: '👤 Perfil do Jogador',
                  value: 'Veja seu perfil em `👤╠perfil`:\n' +
                         '• Nível atual e XP\n' +
                         '• Total de eventos participados\n' +
                         '• Insígnias conquistadas\n' +
                         '• Histórico de atividade',
                  inline: false
                },
                {
                  name: '🔮 Sistema de Orbs',
                  value: 'Deposite orbs de XP:\n' +
                         '• Selecione usuários para receber\n' +
                         '• Escolha tipo de orb (pequena, média, grande)\n' +
                         '• Aprovação Staff/ADM\n' +
                         '• XP creditado automaticamente',
                  inline: false
                },
                {
                  name: '🏆 XP Events',
                  value: 'Eventos especiais de XP:\n' +
                         '• Criados por Staff/ADM\n' +
                         '• Duração definida\n' +
                         '• Multiplicadores de XP\n' +
                         '• Ranking ao vivo',
                  inline: false
                },
                {
                  name: '📍 Canais',
                  value: '• `👤╠perfil` - Seu perfil\n' +
                         '• `⭐╠xp-event` - Eventos de XP\n' +
                         '• `📊╠painel-xp` - Ranking\n' +
                         '• `🔮╠orb-xp` - Depósito de orbs',
                  inline: true
                }
              );
            break;

          case 'bau':
            embed = new EmbedBuilder()
              .setTitle('💎 VENDA DE BAÚ')
              .setDescription(
                'Venda seus baús de Avalon para o banco da guilda de forma rápida e segura.'
              )
              .setColor(0x9B59B6)
              .addFields(
                {
                  name: '🏦 Como Funciona',
                  value: 'Venda baús abertos em Avalon diretamente para o banco:\n' +
                         '• Valor creditado em seu saldo\n' +
                         '• Taxas automáticas por local\n' +
                         '• Processo seguro e auditado\n' +
                         '• Pagamento imediato após aprovação',
                  inline: false
                },
                {
                  name: '📸 Processo de Venda',
                  value: '1. Vá em `💎╠venda-bau`\n' +
                         '2. Clique em **"Vender Baú"**\n' +
                         '3. Selecione o local (Royal, Black, Brecilien, Avalon)\n' +
                         '4. Informe o valor total do baú\n' +
                         '5. Anexe prints dos itens (links)\n' +
                         '6. Aguarde compra por Staff/ADM',
                  inline: false
                },
                {
                  name: '💰 Taxas por Local',
                  value: '• **Royal:** 10% de taxa\n' +
                         '• **Black:** 15% de taxa\n' +
                         '• **Brecilien:** 12% de taxa\n' +
                         '• **Avalon:** 20% de taxa\n\n' +
                         'O valor já vem calculado automaticamente!',
                  inline: false
                },
                {
                  name: '✅ Aprovação',
                  value: 'Staff/ADM analisa:\n' +
                         '• Veracidade dos prints\n' +
                         '• Valor correto\n' +
                         '• Compra do baú\n' +
                         '• Depósito automático no seu saldo',
                  inline: false
                }
              );
            break;

          case 'outros':
            embed = new EmbedBuilder()
              .setTitle('📊 OUTRAS FUNCIONALIDADES')
              .setDescription('Recursos adicionais do bot.')
              .setColor(0x95A5A6)
              .addFields(
                {
                  name: '📋 Lista de Membros',
                  value: 'Painel completo em `📋╠lista-membros`:\n' +
                         '• Total de membros online/offline\n' +
                         '• Contagem por cargos (Membro, Aliança, etc)\n' +
                         '• Novos membros (últimos 7 dias)\n' +
                         '• Filtros por cargo e ordenação\n' +
                         '• Exportação para CSV\n' +
                         '• Estatísticas detalhadas',
                  inline: false
                },
                {
                  name: '📈 Estatísticas de Eventos',
                  value: 'Painel em `📈╠eventos-stats`:\n' +
                         '• Histórico de eventos\n' +
                         '• Filtros por período (7 dias, 30 dias, etc)\n' +
                         '• Filtros por cargo\n' +
                         '• Participação média\n' +
                         '• Ranking de participantes',
                  inline: false
                },
                {
                  name: '🔧 Painel de Configurações',
                  value: 'Acesso restrito a ADMs:\n' +
                         '• Alterar taxa da guilda (%)\n' +
                         '• Configurar taxas de baú\n' +
                         '• Ajustar taxa de empréstimo\n' +
                         '• Registrar guilda oficial\n' +
                         '• Ativar/desativar sistema XP',
                  inline: false
                },
                {
                  name: '📜 Logs e Auditoria',
                  value: 'Canais de logs:\n' +
                         '• `🚪╠saída-membros` - Membros que saíram\n' +
                         '• `📜╠logs-banco` - Transações financeiras\n' +
                         '• `📋╠logs-registros` - Aprovações/recusas\n' +
                         '• `🚫╠logs-blacklist` - Entradas na blacklist',
                  inline: false
                },
                {
                  name: '🛡️ Segurança',
                  value: '• Verificação de entrada em calls de evento\n' +
                         '• Apenas participantes podem entrar\n' +
                         '• Sistema anti-spam em registros\n' +
                         '• Blacklist automática\n' +
                         '• Backup de dados',
                  inline: false
                }
              );
            break;
        }

        await i.update({ embeds: [embed], components: [menu] });
      });

      collector.on('end', () => {
        interaction.editReply({
          components: []
        }).catch(() => {});
      });

    } catch (error) {
      console.error('[Command:ajuda] Error:', error);
      await interaction.reply({
        content: '❌ Erro ao mostrar ajuda. Tente novamente.',
        ephemeral: true
      });
    }
  }
};