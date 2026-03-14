# Configuração do Google Drive Backup

## Passo a passo para configurar:

1. Acesse https://console.cloud.google.com/
2. Crie um novo projeto (ou use existente)
3. Ative a API: "Google Drive API" em APIs & Services &gt; Library
4. Vá em IAM & Admin &gt; Service Accounts
5. Clique em "Create Service Account"
6. Dê um nome (ex: notag-bot-backup)
7. Em "Grant this service account access", adicione "Editor"
8. Clique na Service Account criada &gt; Keys &gt; Add Key &gt; Create new key
9. Selecione JSON e faça download
10. Renomeie o arquivo para `google-service-account.json` e coloque nesta pasta
11. Crie uma pasta no seu Google Drive
12. Compartilhe a pasta com o email da Service Account (xxx@yyy.iam.gserviceaccount.com) com permissão de Editor
13. Copie o ID da pasta (está na URL quando abre a pasta no navegador)
14. Adicione ao `.env`: GOOGLE_DRIVE_FOLDER_ID=seu_id_aqui