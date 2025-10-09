# NeoHub - Plataforma de Colaboração

**NeoHub** é uma plataforma integrada para gerenciamento de serviços, sugestões e utilitários da equipe Neo. O sistema permite que os usuários gerenciem tarefas, colaborem em projetos e acessem utilitários de forma eficiente.

## 🚀 Funcionalidades

- **Gerenciamento de Serviços Glassfish**: Controle completo de servidores Glassfish via SSH
- **Consulta de Bancos de Dados**: Interface para consultar múltiplos servidores de banco de dados
- **Sistema de Sugestões**: Envie e visualize sugestões de desenvolvimento
- **Gerenciamento de Usuários**: Controle completo de usuários, roles e permissões
- **Sistema de Menus Dinâmicos**: Menus configuráveis via banco de dados
- **Sistema de Recursos**: Gerenciamento de recursos e permissões granulares
- **Autenticação 2FA**: Segurança reforçada com autenticação de dois fatores
- **Tema Claro/Escuro**: Interface responsiva com suporte a temas
- **WebSockets**: Logs em tempo real e comunicação bidirecional


## 🛠️ Tecnologias

- **Backend**: Node.js, Express, PostgreSQL
- **Frontend**: HTML, CSS, JavaScript, Web Components
- **Estilos**: DaisyUI, TailwindCSS (via CDN)
- **Banco de Dados**: PostgreSQL com Sequelize ORM
- **Autenticação**: JWT, Passport.js, 2FA com Speakeasy
- **Process Manager**: PM2 para produção
- **Logs**: Winston com rotação diária
- **Uploads**: Multer para arquivos e avatares
- **SSH**: NodeSSH para conexões remotas
- **Sessões**: Express-session com PostgreSQL
- **CORS**: Suporte a requisições cross-origin

## ⚙️ Instalação

### Pré-requisitos

- Node.js 18+ 
- PostgreSQL 12+
- PM2 (para produção)

### 1. Clone o repositório
```bash
git clone https://github.com/Abnerlucasm/neo_utilitario.git
cd neo_utilitario
```

### 2. Instale as dependências
```bash
npm install
```

### 3. Configure as variáveis de ambiente
```bash
cp .env.example .env
```

Edite o arquivo `.env` com suas configurações:

```bash
# Configurações do Servidor
PORT=3020
NODE_ENV=production
APP_URL=http://localhost:3020

# Configurações do Banco de Dados
DB_HOST=localhost
DB_PORT=5432
DB_NAME=neohub
DB_USER=postgres
DB_PASS=sua_senha_aqui

# Configurações de Segurança
JWT_SECRET=sua_chave_jwt_super_secreta_aqui
JWT_EXPIRES_IN=24h
ENCRYPTION_KEY=sua_chave_criptografia_32_caracteres

# Configurações do Admin Padrão
ADMIN_EMAIL=admin@neosistemas.com.br
ADMIN_USERNAME=admin
ADMIN_NAME=Administrador
ADMIN_PASSWORD=admin@123

# Configurações de Email
EMAIL_HOST=smtp.office365.com
EMAIL_PORT=587
EMAIL_SECURE=false
EMAIL_TLS=true
EMAIL_USER=seu_email@dominio.com
EMAIL_PASS=sua_senha_email
EMAIL_FROM=seu_email@dominio.com
EMAIL_FROM_NAME=NeoHub
EMAIL_SECRET=chave_secreta_para_verificacao_email
EMAIL_DEBUG=true

# Configurações de 2FA
TWO_FACTOR_APP_NAME=NeoHub

# Configurações de Log
LOG_LEVEL=info
```

### 4. Configure o banco de dados
```bash
# Criar banco de dados
createdb neohub

# Executar migrações
npm run migrate

# Executar seeds (opcional)
npm run run-migrations
```

### 5. Iniciar a aplicação

#### Desenvolvimento
```bash
npm run dev
```

#### Produção com PM2
```bash
# Instalar PM2 globalmente
npm install -g pm2

# Iniciar aplicação (lê automaticamente o .env)
pm2 start server.js --name neohub

# Verificar status
pm2 status

# Ver logs
pm2 logs neohub
```

## 📁 Estrutura do Projeto

```
neo_utilitario/
├── config/                 # Configurações do sistema
│   ├── database.js        # Configuração do PostgreSQL
│   ├── email.config.js    # Configuração de email
│   ├── passport.js        # Configuração de autenticação
│   ├── menu-structure.json # Estrutura de menus
│   └── defaultResources.js # Recursos padrão
├── controllers/           # Controladores da aplicação
├── middlewares/          # Middlewares customizados
│   ├── auth.js           # Autenticação
│   ├── access-control.js # Controle de acesso
│   ├── ensure-admin.js   # Verificação de admin
│   └── checkAccess.js    # Verificação de permissões
├── models/               # Modelos do banco de dados
│   └── postgresql/       # Modelos PostgreSQL
│       ├── User.js       # Modelo de usuário
│       ├── Role.js       # Modelo de roles
│       ├── Permission.js # Modelo de permissões
│       ├── Resource.js   # Modelo de recursos
│       └── associations.js # Associações entre modelos
├── routes/               # Rotas da API
│   ├── auth.js           # Autenticação
│   ├── glassfish.js      # Gerenciamento Glassfish
│   ├── admin.js          # Administração
│   ├── user.js           # Gerenciamento de usuários
│   ├── roles.js          # Gerenciamento de roles
│   ├── permissions.js    # Gerenciamento de permissões
│   ├── servers.js        # Gerenciamento de servidores
│   ├── resources.js      # Gerenciamento de recursos
│   └── menus.js          # Gerenciamento de menus
├── scripts/              # Scripts utilitários
├── services/             # Serviços da aplicação
│   ├── email.service.js  # Serviço de email
│   └── twoFactor.js      # Autenticação 2FA
├── utils/                # Utilitários
│   ├── logger.js         # Sistema de logs
│   └── admin-config.js   # Configurações do admin
├── public/               # Arquivos estáticos
│   ├── components/       # Componentes web
│   │   ├── navbar/       # Componente de navbar
│   │   └── footer/       # Componente de footer
│   ├── js/              # JavaScript do frontend
│   │   ├── admin/        # Scripts de administração
│   │   └── auth.js       # Autenticação frontend
│   ├── pages/           # Páginas HTML
│   │   ├── admin/        # Páginas de administração
│   │   └── consultabd.html # Consulta de bancos
│   ├── styles/          # Estilos CSS
│   └── uploads/         # Uploads de usuários
├── uploads/             # Arquivos enviados
├── migrations/          # Migrações do banco
├── seeders/             # Seeds do banco
├── .env                 # Variáveis de ambiente
├── .env.example         # Exemplo de configuração
├── package.json         # Dependências
└── server.js           # Servidor principal
```

## 🔧 Configuração

### Variáveis de Ambiente Principais

| Variável | Descrição | Padrão |
|----------|-----------|---------|
| `PORT` | Porta do servidor | 3020 |
| `NODE_ENV` | Ambiente (development/production) | production |
| `DB_HOST` | Host do PostgreSQL | localhost |
| `DB_NAME` | Nome do banco de dados | neohub |
| `JWT_SECRET` | Chave secreta para JWT | - |
| `ADMIN_EMAIL` | Email do admin padrão | admin@neosistemas.com.br |
| `ADMIN_PASSWORD` | Senha do admin padrão | admin@123 |

### Configuração do Admin Padrão

O sistema cria automaticamente um usuário admin padrão na primeira execução. As configurações podem ser alteradas via variáveis de ambiente:

```bash
ADMIN_EMAIL=seu_email@dominio.com
ADMIN_USERNAME=admin
ADMIN_NAME=Administrador
ADMIN_PASSWORD=sua_senha_segura
```

## 🚀 Deploy com PM2 e Nginx

### Configuração de Produção

O PM2 lê automaticamente as variáveis do arquivo `.env`. Para produção, certifique-se de que:

```bash
NODE_ENV=production
PORT=3020
# ... outras variáveis de produção
```

### Comandos PM2 Úteis

```bash
# Iniciar aplicação
pm2 start server.js --name neohub

# Verificar status
pm2 status

# Ver logs em tempo real
pm2 logs neohub

# Reiniciar aplicação
pm2 restart neohub

# Parar aplicação
pm2 stop neohub

# Remover aplicação
pm2 delete neohub

# Salvar configuração para auto-start
pm2 save
pm2 startup

# Monitoramento web (opcional)
pm2 web
```

## 🌐 Configuração com Nginx (Proxy Reverso)

### Instalação e Configuração do Nginx

Para usar o NeoHub com proxy reverso e subdomínios internos:

#### 1. Instalar Nginx
```bash
sudo apt update
sudo apt install nginx
```

#### 2. Gerar Certificado SSL Auto-assinado
```bash
# Executar o script de geração de certificado
sudo ./nginx-config/generate-ssl-cert.sh
```

#### 3. Configurar Nginx
```bash
# Copiar configuração do nginx
sudo cp nginx-config/neohub-simple.conf /etc/nginx/sites-available/

# Ativar o site
sudo ln -s /etc/nginx/sites-available/neohub-simple.conf /etc/nginx/sites-enabled/

# Remover site default (se necessário)
sudo rm -f /etc/nginx/sites-enabled/default

# Testar configuração
sudo nginx -t

# Reiniciar nginx
sudo systemctl restart nginx
```

#### 4. Configurar DNS Local
```bash
# Adicionar entradas ao /etc/hosts
echo '192.168.1.15 neohub.local admin.neohub.local api.neohub.local' | sudo tee -a /etc/hosts
```

### Acessos Disponíveis

Após a configuração, você pode acessar:

**HTTP (Porta 8080):**
- **Aplicação Principal**: `http://neohub.local:8080`
- **Admin**: `http://admin.neohub.local:8080` (mesmo conteúdo, roteamento futuro)
- **API**: `http://api.neohub.local:8080` (mesmo conteúdo, roteamento futuro)

**HTTPS (Porta 8443):**
- **Aplicação Principal**: `https://neohub.local:8443`
- **Admin**: `https://admin.neohub.local:8443` (mesmo conteúdo, roteamento futuro)
- **API**: `https://api.neohub.local:8443` (mesmo conteúdo, roteamento futuro)

### 🌐 Acesso via VPN

Para acessar via VPN, use o IP direto do servidor:

**HTTP:**
- `http://192.168.1.15:8080`

**HTTPS:**
- `https://192.168.1.15:8443`

> **Nota**: Consulte o arquivo `VPN-ACCESS-GUIDE.md` para instruções detalhadas de acesso via VPN.

### Configuração SSL (Opcional)

Para usar HTTPS com certificado auto-assinado:

```bash
# Usar configuração com SSL
sudo cp nginx-config/neohub.conf /etc/nginx/sites-available/
sudo ln -s /etc/nginx/sites-available/neohub.conf /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/neohub-simple.conf

# Testar e reiniciar
sudo nginx -t
sudo systemctl restart nginx
```

**Acessos com SSL:**
- **Aplicação Principal**: `https://neohub.local:8443`
- **Admin**: `https://admin.neohub.local:8443`
- **API**: `https://api.neohub.local:8443`

> **Nota**: Como o certificado é auto-assinado, você precisará aceitar o aviso de segurança no navegador.

## 📊 Scripts Disponíveis

```bash
# Desenvolvimento
npm run dev              # Iniciar com nodemon

# Produção
npm start               # Iniciar servidor

# Banco de Dados
npm run migrate         # Executar migrações
npm run migrate:undo    # Reverter migração
npm run migrate:undo:all # Reverter todas as migrações
npm run migrate:create  # Criar nova migração
npm run run-migrations  # Executar migrações customizadas
```

## 🔐 Segurança

### Autenticação 2FA

O sistema suporta autenticação de dois fatores usando TOTP (Time-based One-Time Password):

- Geração de QR Code para apps como Google Authenticator
- Verificação de tokens TOTP
- Backup codes para recuperação

### Controle de Acesso

- **Roles**: Sistema de roles (admin, user)
- **Permissions**: Permissões granulares por recurso
- **JWT**: Tokens seguros com expiração configurável
- **Session Management**: Sessões persistentes com PostgreSQL

## 📈 Monitoramento

### Logs

O sistema usa Winston para logging estruturado com rotação automática:

```bash
# Ver logs da aplicação
pm2 logs neohub

# Ver logs específicos (rotativos por data)
tail -f logs/combined-2025-07-11.log
tail -f logs/error-2025-07-11.log

# Listar todos os arquivos de log
ls -la logs/
```

**Configuração dos Logs:**
- **Localização**: `/logs/`
- **Rotação**: Diária (novo arquivo por dia)
- **Retenção**: 14 dias
- **Tamanho máximo**: 20MB por arquivo
- **Compressão**: Automática para arquivos antigos
- **Formato**: JSON estruturado com timestamp

### Métricas

- Status dos servidores Glassfish
- Uso de CPU e memória
- Logs em tempo real via WebSocket
- Estatísticas de usuários e atividades

## 🛠️ Desenvolvimento

### Estrutura de Código

- **MVC Pattern**: Modelos, Views, Controladores
- **Middleware Pattern**: Middlewares reutilizáveis
- **Service Layer**: Lógica de negócio em serviços
- **Repository Pattern**: Acesso a dados via modelos

### Convenções

- **Rotas**: `/api/[recurso]/[ação]`
- **Modelos**: PascalCase (ex: `User`, `LearningModule`)
- **Arquivos**: kebab-case (ex: `user-settings.js`)
- **Variáveis**: camelCase (ex: `userName`, `isActive`)

## 🐛 Troubleshooting

### Problemas Comuns

1. **Erro de conexão com banco**:
   ```bash
   # Verificar se PostgreSQL está rodando
   sudo systemctl status postgresql
   
   # Verificar conexão
   psql -h localhost -U postgres -d neohub
   ```

2. **Erro de permissões**:
   ```bash
   # Verificar logs
   pm2 logs neohub
   
   # Verificar configurações
   node scripts/test-admin-config.js
   ```

3. **Problemas com PM2**:
   ```bash
   # Reiniciar PM2
   pm2 kill
   pm2 start server.js --name neohub
   ```

## 👥 Contribuição

1. **Faça um Fork do projeto**
2. **Crie uma branch para sua feature**:
   ```bash
   git checkout -b feature/nova-funcionalidade
   ```
3. **Commit suas mudanças**:
   ```bash
   git commit -m 'Adiciona nova funcionalidade'
   ```
4. **Push para a branch**:
   ```bash
   git push origin feature/nova-funcionalidade
   ```
5. **Abra um Pull Request**

## 📝 Licença

Este projeto está sob a licença [MIT](LICENSE).

## 🤝 Suporte

Para suporte técnico ou dúvidas:

- **Email**: abner.freitas@neosistemas.com.br
- **Issues**: [GitHub Issues](https://github.com/Abnerlucasm/neo_utilitario/issues)
