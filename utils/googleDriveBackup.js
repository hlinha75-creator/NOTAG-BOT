const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');
const AdmZip = require('adm-zip');
const { EmbedBuilder } = require('discord.js');

class GoogleDriveBackup {
  constructor() {
    this.backupInterval = null;
    // ID da pasta no Google Drive onde os backups serão salvos
    this.driveFolderId = process.env.GOOGLE_DRIVE_FOLDER_ID || '';
    // Caminho para o arquivo de credenciais da Service Account
    this.credentialsPath = path.join(__dirname, '..', 'config', 'google-service-account.json');
  }

  /**
   * Autentica com o Google Drive usando Service Account
   */
  async authenticate() {
    try {
      // Verificar se existe arquivo de credenciais
      if (!fs.existsSync(this.credentialsPath)) {
        console.error('❌ Arquivo de credenciais do Google não encontrado!');
        console.log('📋 Para configurar:');
        console.log('1. Acesse https://console.cloud.google.com/');
        console.log('2. Crie um projeto e ative a Google Drive API');
        console.log('3. Crie uma Service Account e baixe o JSON');
        console.log('4. Coloque o arquivo em config/google-service-account.json');
        console.log('5. Compartilhe uma pasta no Drive com o email da Service Account');
        return null;
      }

      const credentials = JSON.parse(fs.readFileSync(this.credentialsPath, 'utf8'));

      const auth = new google.auth.GoogleAuth({
        credentials: credentials,
        scopes: ['https://www.googleapis.com/auth/drive.file']
      });

      const drive = google.drive({ version: 'v3', auth });
      return drive;
    } catch (error) {
      console.error('❌ Erro na autenticação do Google Drive:', error);
      return null;
    }
  }

  /**
   * Cria backup compactado do banco de dados
   */
  async createDatabaseBackup() {
    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const dbPath = path.join(__dirname, '..', 'data', 'database.db');
      const backupDir = path.join(__dirname, '..', 'data', 'backups');

      if (!fs.existsSync(dbPath)) {
        console.error('❌ Banco de dados não encontrado:', dbPath);
        return null;
      }

      if (!fs.existsSync(backupDir)) {
        fs.mkdirSync(backupDir, { recursive: true });
      }

      const zipFileName = `backup_saldos_${timestamp}.zip`;
      const zipPath = path.join(backupDir, zipFileName);

      // Criar ZIP com o banco de dados
      const zip = new AdmZip();
      zip.addLocalFile(dbPath, '', 'database.db');

      // Adicionar também o arquivo de configurações se existir
      const configPath = path.join(__dirname, '..', 'data', 'guild_config.json');
      if (fs.existsSync(configPath)) {
        zip.addLocalFile(configPath, '', 'guild_config.json');
      }

      zip.writeZip(zipPath);

      console.log(`✅ Backup local criado: ${zipFileName}`);
      return { zipPath, zipFileName, timestamp };
    } catch (error) {
      console.error('❌ Erro ao criar backup:', error);
      return null;
    }
  }

  /**
   * Envia arquivo para o Google Drive
   */
  async uploadToDrive(filePath, fileName) {
    try {
      const drive = await this.authenticate();
      if (!drive) return false;

      // Se não tiver ID da pasta, procurar ou criar
      let folderId = this.driveFolderId;
      if (!folderId) {
        folderId = await this.findOrCreateBackupFolder(drive);
        this.driveFolderId = folderId;
      }

      const fileMetadata = {
        name: fileName,
        parents: [folderId],
        description: `Backup automático do NOTAG-BOT - ${new Date().toLocaleString('pt-BR')}`
      };

      const media = {
        mimeType: 'application/zip',
        body: fs.createReadStream(filePath)
      };

      const response = await drive.files.create({
        requestBody: fileMetadata,
        media: media,
        fields: 'id, name, webViewLink'
      });

      console.log(`✅ Backup enviado para o Google Drive: ${response.data.name}`);
      console.log(`🔗 Link: ${response.data.webViewLink}`);

      // Limpar backups antigos no Drive (manter apenas os últimos 10)
      await this.cleanOldBackups(drive, folderId);

      return {
        id: response.data.id,
        name: response.data.name,
        link: response.data.webViewLink
      };

    } catch (error) {
      console.error('❌ Erro ao enviar para Google Drive:', error);
      return false;
    }
  }

  /**
   * Procura ou cria pasta de backups no Drive
   */
  async findOrCreateBackupFolder(drive) {
    try {
      const folderName = 'NOTAG-BOT Backups';

      // Procurar pasta existente
      const response = await drive.files.list({
        q: `mimeType='application/vnd.google-apps.folder' and name='${folderName}' and trashed=false`,
        spaces: 'drive',
        fields: 'files(id, name)'
      });

      if (response.data.files.length > 0) {
        console.log(`📁 Pasta encontrada: ${response.data.files[0].id}`);
        return response.data.files[0].id;
      }

      // Criar nova pasta
      const fileMetadata = {
        name: folderName,
        mimeType: 'application/vnd.google-apps.folder',
        description: 'Backups automáticos do bot NOTAG'
      };

      const folder = await drive.files.create({
        requestBody: fileMetadata,
        fields: 'id'
      });

      console.log(`📁 Pasta criada: ${folder.data.id}`);

      // Compartilhar pasta (opcional - tornar público ou compartilhar com email específico)
      await drive.permissions.create({
        fileId: folder.data.id,
        requestBody: {
          role: 'reader',
          type: 'anyone' // ou 'user' para específico
        }
      });

      return folder.data.id;

    } catch (error) {
      console.error('❌ Erro ao criar pasta:', error);
      return null;
    }
  }

  /**
   * Remove backups antigos do Drive (mantém últimos 10)
   */
  async cleanOldBackups(drive, folderId) {
    try {
      const response = await drive.files.list({
        q: `'${folderId}' in parents and mimeType='application/zip' and trashed=false`,
        orderBy: 'createdTime desc',
        fields: 'files(id, name, createdTime)'
      });

      const files = response.data.files;
      if (files.length > 10) {
        const filesToDelete = files.slice(10); // Pega do 11º em diante

        for (const file of filesToDelete) {
          await drive.files.delete({ fileId: file.id });
          console.log(`🗑️ Backup antigo removido: ${file.name}`);
        }
      }
    } catch (error) {
      console.error('❌ Erro ao limpar backups antigos:', error);
    }
  }

  /**
   * Executa backup completo (local + nuvem)
   */
  async executeBackup(guild = null) {
    try {
      console.log('🔄 Iniciando backup automático...');

      // 1. Criar backup local
      const backup = await this.createDatabaseBackup();
      if (!backup) return false;

      // 2. Enviar para Google Drive
      const driveResult = await this.uploadToDrive(backup.zipPath, backup.zipFileName);

      // 3. Notificar no Discord (se guild fornecida)
      if (guild && driveResult) {
        const embed = new EmbedBuilder()
          .setTitle('☁️ Backup para Google Drive')
          .setDescription(
            `✅ **Backup realizado com sucesso!**\n\n` +
            `📅 **Data:** ${new Date().toLocaleString('pt-BR')}\n` +
            `📁 **Arquivo:** ${backup.zipFileName}\n` +
            `💾 **Tamanho:** ${(fs.statSync(backup.zipPath).size / 1024 / 1024).toFixed(2)} MB\n` +
            `🔗 **[Acessar no Drive](${driveResult.link})**`
          )
          .setColor(0x4285F4) // Cor do Google
          .setTimestamp()
          .setFooter({ text: 'Backup automático • Google Drive' });

        // Enviar para canal de logs ou admin
        const canalLogs = guild.channels.cache.find(c => c.name === '📜╠logs-banco');
        if (canalLogs) {
          await canalLogs.send({ embeds: [embed] });
        }
      }

      // 4. Limpar arquivos locais antigos (manter últimos 5)
      await this.cleanLocalBackups();

      return true;
    } catch (error) {
      console.error('❌ Erro no backup:', error);
      return false;
    }
  }

  /**
   * Limpa backups locais antigos
   */
  async cleanLocalBackups() {
    try {
      const backupDir = path.join(__dirname, '..', 'data', 'backups');
      if (!fs.existsSync(backupDir)) return;

      const files = fs.readdirSync(backupDir)
        .filter(f => f.startsWith('backup_saldos_') && f.endsWith('.zip'))
        .map(f => ({
          name: f,
          path: path.join(backupDir, f),
          time: fs.statSync(path.join(backupDir, f)).mtime.getTime()
        }))
        .sort((a, b) => b.time - a.time); // Mais recentes primeiro

      // Remover arquivos além do 5º
      if (files.length > 5) {
        const toDelete = files.slice(5);
        for (const file of toDelete) {
          fs.unlinkSync(file.path);
          console.log(`🗑️ Backup local removido: ${file.name}`);
        }
      }
    } catch (error) {
      console.error('❌ Erro ao limpar backups locais:', error);
    }
  }

  /**
   * Inicia agendamento automático de backups (diário às 3h da manhã)
   */
  startAutoBackup(client) {
    console.log('☁️ Sistema de backup Google Drive iniciado');

    // Executar imediatamente ao iniciar (uma vez)
    setTimeout(() => {
      const guild = client.guilds.cache.first(); // Primeira guilda disponível
      this.executeBackup(guild);
    }, 60000); // Esperar 1 minuto após iniciar

    // Agendar backup diário às 03:00
    const scheduleBackup = () => {
      const now = new Date();
      const nextBackup = new Date();
      nextBackup.setHours(3, 0, 0, 0);

      if (nextBackup <= now) {
        nextBackup.setDate(nextBackup.getDate() + 1);
      }

      const timeUntil = nextBackup - now;

      setTimeout(() => {
        const guild = client.guilds.cache.first();
        this.executeBackup(guild);
        scheduleBackup(); // Reagendar para o próximo dia
      }, timeUntil);

      console.log(`📅 Próximo backup agendado para: ${nextBackup.toLocaleString('pt-BR')}`);
    };

    scheduleBackup();
  }

  /**
   * Comando manual de backup (para usar via Discord)
   */
  async manualBackup(interaction) {
    await interaction.deferReply({ ephemeral: true });

    const isADM = interaction.member.roles.cache.some(r => r.name === 'ADM') ||
      interaction.member.permissions.has(PermissionFlagsBits.Administrator);

    if (!isADM) {
      return interaction.editReply({ content: '❌ Apenas ADMs podem executar backup manual!' });
    }

    const result = await this.executeBackup(interaction.guild);

    if (result) {
      await interaction.editReply({ 
        content: '✅ **Backup realizado com sucesso!**\nVerifique o canal de logs para o link do Google Drive.' 
      });
    } else {
      await interaction.editReply({ 
        content: '❌ **Erro ao realizar backup!**\nVerifique o console para mais detalhes.' 
      });
    }
  }
}

module.exports = new GoogleDriveBackup();