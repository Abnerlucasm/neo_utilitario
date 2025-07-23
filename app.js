const { initDatabase } = require('./models/postgresql/index');

// Função auto-invocada para inicializar o banco de dados e a aplicação
(async () => {
    try {
        // Inicializar o banco de dados (criar tabelas, seed inicial, etc.)
        await initDatabase();
        
        // Aqui você pode iniciar seu servidor Express ou outras inicializações necessárias
        // Exemplo:
        // const app = require('./app');
        // app.listen(PORT, () => {
        //     console.log(`Servidor rodando na porta ${PORT}`);
        // });
    } catch (error) {
        console.error('Erro durante a inicialização da aplicação:', error);
        process.exit(1); // Sair com código de erro
    }
})();