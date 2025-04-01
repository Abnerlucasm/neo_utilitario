const { sequelize, Menu } = require('../models/postgresql/associations');
const { v4: uuidv4 } = require('uuid');
const logger = require('../utils/logger');

/**
 * Verifica e cria os menus padrão do sistema se não existirem
 */
async function seedMenus() {
    try {
        logger.info('Iniciando verificação de menus...');
        
        // Verificar se já existem menus
        const existingMenus = await Menu.count();
        
        if (existingMenus > 0) {
            logger.info(`Já existem ${existingMenus} menus no banco de dados. Verificação concluída.`);
            return;
        }
        
        logger.info('Nenhum menu encontrado. Criando menus padrão...');
        
        // Menus principais
        const homeId = uuidv4();
        const utilitariosId = uuidv4();
        const learningId = uuidv4();
        const adminId = uuidv4();
        
        // Criar menus principais
        const mainMenus = [
            {
                id: homeId,
                title: 'Início',
                path: '/index.html',
                icon: 'fas fa-home',
                order: 1,
                isAdminOnly: false,
                resourcePath: '/pages/index.html'
            },
            {
                id: learningId,
                title: 'Central de Aprendizado',
                path: '/pages/learning/learn.html',
                icon: 'fas fa-graduation-cap',
                order: 2,
                isAdminOnly: false,
                resourcePath: '/pages/learning/learn.html'
            },
            {
                id: utilitariosId,
                title: 'Utilitários',
                path: '/pages/utilitarios.html',
                icon: 'fas fa-tools',
                order: 3,
                isAdminOnly: false,
                resourcePath: '/pages/utilitarios.html'
            },
            {
                id: adminId,
                title: 'Administração',
                path: '#',
                icon: 'fas fa-cogs',
                order: 10,
                isAdminOnly: true,
                resourcePath: '/admin'
            }
        ];
        
        // Submenus de Utilitários
        const utilitariosSubmenus = [
            {
                title: 'Gerenciador Glassfish',
                path: '/pages/glassfish.html',
                icon: 'fas fa-server',
                order: 1,
                parentId: utilitariosId,
                isAdminOnly: false,
                resourcePath: '/pages/glassfish.html'
            },
            {
                title: 'Neo Chamados',
                path: 'https://app.neosistemas.com.br/neo-chamados/',
                icon: 'fas fa-ticket-alt',
                order: 2,
                parentId: utilitariosId,
                isAdminOnly: false,
                resourcePath: 'https://app.neosistemas.com.br/neo-chamados/'
            },
            {
                title: 'NeoTrack',
                path: '/pages/neotrack.html',
                icon: 'fas fa-chart-line',
                order: 3,
                parentId: utilitariosId,
                isAdminOnly: false,
                resourcePath: '/pages/neotrack.html'
            },
            {
                title: 'Recursos em Desenvolvimento',
                path: '/pages/recursos-dev.html',
                icon: 'fas fa-rocket',
                order: 4,
                parentId: utilitariosId,
                isAdminOnly: false,
                resourcePath: '/pages/recursos-dev.html'
            },
            {
                title: 'Sugestões',
                path: '/pages/sugestoes-dev.html',
                icon: 'fas fa-lightbulb',
                order: 5,
                parentId: utilitariosId,
                isAdminOnly: false,
                resourcePath: '/pages/sugestoes-dev.html'
            }
        ];
        
        // Submenus de Administração
        const adminSubmenus = [
            {
                title: 'Gerenciar Usuários',
                path: '/pages/admin/user-management.html',
                icon: 'fas fa-users-cog',
                order: 1,
                parentId: adminId,
                isAdminOnly: true,
                resourcePath: '/pages/admin/user-management.html'
            },
            {
                title: 'Gerenciar Módulos',
                path: '/admin/learning/modules',
                icon: 'fas fa-book',
                order: 2,
                parentId: adminId,
                isAdminOnly: true,
                resourcePath: '/admin/learning/modules'
            },
            {
                title: 'Papéis e Permissões',
                path: '/pages/admin/roles.html',
                icon: 'fas fa-user-shield',
                order: 3,
                parentId: adminId,
                isAdminOnly: true,
                resourcePath: '/pages/admin/roles.html'
            },
            {
                title: 'Gerenciar Menus',
                path: '/pages/admin/menus.html',
                icon: 'fas fa-bars',
                order: 4,
                parentId: adminId,
                isAdminOnly: true,
                resourcePath: '/pages/admin/menus.html'
            }
        ];
        
        // Outros menus
        const otherMenus = [
            {
                title: 'Configurações',
                path: '/pages/user-settings.html',
                icon: 'fas fa-cog',
                order: 20,
                isAdminOnly: false,
                resourcePath: '/pages/user-settings.html'
            }
        ];
        
        // Inserir todos os menus
        const allMenus = [
            ...mainMenus,
            ...utilitariosSubmenus,
            ...adminSubmenus,
            ...otherMenus
        ];
        
        logger.info(`Criando ${allMenus.length} menus padrão...`);
        
        // Usar transaction para garantir consistência
        await sequelize.transaction(async (t) => {
            await Menu.bulkCreate(allMenus, { transaction: t });
        });
        
        logger.info('Menus padrão criados com sucesso!');
        
        // Verificar se os menus foram criados corretamente
        const menuCount = await Menu.count();
        logger.info(`Total de menus no sistema: ${menuCount}`);
        
        return true;
    } catch (error) {
        logger.error('Erro ao criar menus padrão:', error);
        throw error;
    }
}

// Executar o seed se este arquivo for chamado diretamente
if (require.main === module) {
    (async () => {
        try {
            await seedMenus();
            process.exit(0);
        } catch (error) {
            console.error('Erro ao executar seed:', error);
            process.exit(1);
        }
    })();
}

module.exports = seedMenus; 