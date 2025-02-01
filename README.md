# NeoHub - Plataforma de Colaboração

**NeoHub** é uma plataforma integrada para gerenciamento de serviços, sugestões e utilitários da equipe Neo. O sistema permite que os usuários gerenciem tarefas, colaborem em projetos e acessem utilitários de forma eficiente.

## 🚀 Funcionalidades

- **Gerenciamento de Serviços**: Utilize o NeoTrack para gerenciar suas tarefas e serviços com uma interface de kanban.
- **Sistema de Sugestões**: Envie e visualize sugestões de desenvolvimento para melhorias no sistema.
- **Utilitários Integrados**: Acesse uma variedade de ferramentas úteis para facilitar o trabalho da equipe.
- **Tema Claro/Escuro**: Alternar entre temas claro e escuro para uma melhor experiência do usuário.
- **Interface Responsiva**: Acesse a plataforma em dispositivos móveis e desktops.

## 🛠️ Tecnologias

- **Backend**: Node.js, Express, MongoDB
- **Frontend**: HTML, CSS, JavaScript, Web Components
- **Estilos**: Bulma CSS, Font Awesome

## ⚙️ Instalação

1. **Clone o repositório**:
   ```bash
   git clone https://github.com/seu-usuario/neo_utilitario.git
   cd neo_utilitario
   ```

2. **Instale as dependências**:
   ```bash
   npm install
   ```

3. **Configure as variáveis de ambiente**:
   ```bash
   cp .env.example .env
   ```
   Edite o arquivo `.env` com suas configurações, especialmente a senha do MongoDB.

4. **Crie os diretórios necessários**:
   ```bash
   mkdir uploads
   mkdir public/assets
   ```

5. **Inicie o servidor**:
   ```bash
   npm start
   ```

## 📁 Estrutura do Projeto

``` bash
neo_utilitario/
├── public/
│ ├── assets/
│ ├── components/
│ ├── js/
│ ├── pages/
│ └── styles/
├── models/
├── routes/
├── uploads/
├── .env
├── .env.example
├── package.json
└── server.js
```

## 🔧 Configuração

As seguintes variáveis de ambiente são necessárias:

- `PORT`: Porta do servidor (default: 3000)
- `HOST`: Host do servidor (default: localhost)
- `MONGODB_URI`: URI de conexão com MongoDB (incluindo usuário e senha)
- `UPLOAD_DIR`: Diretório para uploads
- `NODE_ENV`: Ambiente de execução (development/production)

## 👥 Contribuição

1. **Faça um Fork do projeto**
2. **Crie uma branch para sua feature**:
   ```bash
   git checkout -b feature/featureIncrivel
   ```
3. **Commit suas mudanças**:
   ```bash
   git commit -m 'Add some featureIncrivel'
   ```
4. **Push para a branch**:
   ```bash
   git push origin feature/featureIncrivel
   ```
5. **Abra um Pull Request**

## 📝 Licença

Este projeto está sob a licença [MIT](LICENSE).
