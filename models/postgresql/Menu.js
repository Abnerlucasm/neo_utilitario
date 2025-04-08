const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
    const Menu = sequelize.define('Menu', {
        id: {
            type: DataTypes.UUID,
            defaultValue: DataTypes.UUIDV4,
            primaryKey: true
        },
        title: {
            type: DataTypes.STRING,
            allowNull: false
        },
        path: {
            type: DataTypes.STRING,
            allowNull: false
        },
        icon: {
            type: DataTypes.STRING,
            allowNull: false,
            defaultValue: 'fas fa-link'
        },
        order: {
            type: DataTypes.INTEGER,
            allowNull: false,
            defaultValue: 0
        },
        parentId: {
            type: DataTypes.UUID,
            allowNull: true,
            references: {
                model: 'Menus',
                key: 'id'
            }
        },
        isAdminOnly: {
            type: DataTypes.BOOLEAN,
            allowNull: false,
            defaultValue: false
        },
        isActive: {
            type: DataTypes.BOOLEAN,
            allowNull: false,
            defaultValue: true
        },
        resourcePath: {
            type: DataTypes.STRING,
            allowNull: true,
            defaultValue: null,
            comment: 'Caminho do recurso para verificação de permissão'
        }
    }, {
        tableName: 'Menus',
        timestamps: true,
        hooks: {
            beforeCreate: (menu) => {
                // Garantir que resourcePath tenha um valor padrão se não for fornecido
                if (menu.resourcePath === undefined || menu.resourcePath === null) {
                    menu.resourcePath = menu.path;
                }
            },
            beforeUpdate: (menu) => {
                // Se path for atualizado e resourcePath for null, atualizar resourcePath também
                if (menu.changed('path') && (menu.resourcePath === undefined || menu.resourcePath === null)) {
                    menu.resourcePath = menu.path;
                }
            }
        }
    });

    Menu.associate = (models) => {
        // Auto-relacionamento para menus pai/filho
        Menu.hasMany(models.Menu, {
            foreignKey: 'parentId',
            as: 'children'
        });
        
        Menu.belongsTo(models.Menu, {
            foreignKey: 'parentId',
            as: 'parent'
        });
    };
    
    /**
     * Verifica se um menu com o título especificado existe
     * @param {string} title - Título do menu
     * @returns {Promise<boolean>} - True se o menu existe, false caso contrário
     */
    Menu.menuExists = async function(title) {
        const count = await this.count({ where: { title } });
        return count > 0;
    };
    
    /**
     * Obtém todos os menus ativos
     * @returns {Promise<Array>} - Lista de menus ativos
     */
    Menu.getActiveMenus = async function() {
        return await this.findAll({
            where: { isActive: true },
            order: [
                ['order', 'ASC'],
                ['title', 'ASC']
            ],
            include: [{
                model: this,
                as: 'children',
                where: { isActive: true },
                required: false,
                order: [
                    ['order', 'ASC'],
                    ['title', 'ASC']
                ]
            }]
        });
    };
    
    /**
     * Obtém todos os menus de nível superior (sem parentId)
     * @returns {Promise<Array>} - Lista de menus de nível superior
     */
    Menu.getRootMenus = async function() {
        const menus = await this.getActiveMenus();
        return menus.filter(menu => !menu.parentId);
    };
    
    /**
     * Atualiza um menu de forma segura, com validações adicionais
     * @param {string} menuId - ID do menu a ser atualizado
     * @param {Object} data - Dados a serem atualizados
     * @returns {Promise<Object>} - Menu atualizado
     * @throws {Error} - Se o menu não existir ou se houver problema na atualização
     */
    Menu.updateSafely = async function(menuId, data) {
        try {
            const menu = await this.findByPk(menuId);
            
            if (!menu) {
                throw new Error('Menu não encontrado');
            }
            
            // Validar ciclos de parentId
            if (data.parentId && data.parentId === menuId) {
                throw new Error('Um menu não pode ser pai de si mesmo');
            }
            
            // Verificar se parent existe
            if (data.parentId) {
                const parentExists = await this.findByPk(data.parentId);
                if (!parentExists) {
                    throw new Error('Menu pai não encontrado');
                }
            }
            
            // Preparar dados para atualização - tratando tipos de dados
            const updateData = {};
            
            // Processar apenas campos válidos e fazer conversões necessárias
            if ('title' in data) updateData.title = String(data.title || '');
            if ('path' in data) updateData.path = String(data.path || '');
            if ('icon' in data) updateData.icon = String(data.icon || 'fas fa-link');
            if ('order' in data) {
                const orderNum = parseInt(data.order, 10);
                updateData.order = isNaN(orderNum) ? 0 : orderNum;
            }
            
            // Tratar parentId especificamente
            if ('parentId' in data) {
                updateData.parentId = data.parentId === null || data.parentId === '' ? null : data.parentId;
            }
            
            // Tratar campos booleanos
            if ('isAdminOnly' in data) updateData.isAdminOnly = data.isAdminOnly === true;
            if ('isActive' in data) updateData.isActive = data.isActive === true;
            
            // Tratar resourcePath
            if ('resourcePath' in data) {
                // Se resourcePath for nulo ou vazio, usar o path
                if (data.resourcePath === null || data.resourcePath === '') {
                    updateData.resourcePath = updateData.path || menu.path;
                } else {
                    updateData.resourcePath = String(data.resourcePath);
                }
            }
            
            try {
                // Usar atualização simples ao invés de transação
                await menu.update(updateData);
                
                // Recarregar para obter dados atualizados
                await menu.reload();
                return menu;
            } catch (updateError) {
                console.error('Erro ao atualizar menu:', updateError);
                throw new Error(`Erro ao atualizar menu: ${updateError.message}`);
            }
        } catch (error) {
            console.error('Erro em updateSafely:', error);
            throw error;
        }
    };

    return Menu;
}; 