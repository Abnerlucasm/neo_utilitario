const learningModules = {
    'postgresql': {
        title: 'PostgreSQL',
        description: 'Aprenda PostgreSQL do básico ao avançado',
        route: '/learn-postgresql',
        apiEndpoint: '/api/learn-postgresql/content',
        initialContent: {
            content: {
                'page-1': {
                    title: 'Introdução ao PostgreSQL',
                    content: '# Bem-vindo ao PostgreSQL\n\nEste é um guia introdutório.'
                }
            },
            sections: [
                {
                    id: 'section-1',
                    title: 'Primeiros Passos',
                    pages: ['page-1']
                }
            ]
        }
    },
    // Outros módulos podem ser adicionados aqui
};

module.exports = learningModules; 