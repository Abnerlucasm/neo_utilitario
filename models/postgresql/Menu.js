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
        parent_id: {
            type: DataTypes.UUID,
            allowNull: true,
            references: {
                model: 'Menus',
                key: 'id'
            }
        },
        is_admin_only: {
            type: DataTypes.BOOLEAN,
            allowNull: false,
            defaultValue: false
        },
        is_active: {
            type: DataTypes.BOOLEAN,
            allowNull: false,
            defaultValue: true
        },
        resource_path: {
            type: DataTypes.STRING,
            allowNull: true,
            defaultValue: null,
            comment: 'Caminho do recurso para verificação de permissão'
        },
        resource_id: {
            type: DataTypes.UUID,
            allowNull: true,
            references: {
                model: 'resources',
                key: 'id'
            }
        }
    }, {
        tableName: 'Menus',
        timestamps: true,
        underscored: true,
        hooks: {
            beforeCreate: (menu) => {
                if (menu.resource_path === undefined || menu.resource_path === null) {
                    menu.resource_path = menu.path;
                }
            },
            beforeUpdate: (menu) => {
                if (menu.changed('path') && (menu.resource_path === undefined || menu.resource_path === null)) {
                    menu.resource_path = menu.path;
                }
            }
        }
    });

    Menu.associate = (models) => {
        Menu.hasMany(models.Menu, {
            foreignKey: 'parent_id',
            as: 'children'
        });
        Menu.belongsTo(models.Menu, {
            foreignKey: 'parent_id',
            as: 'parent'
        });
        Menu.belongsTo(models.Resource, {
            foreignKey: 'resource_id',
            as: 'resource'
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
            where: { is_active: true },
            order: [
                ['order', 'ASC'],
                ['title', 'ASC']
            ],
            include: [{
                model: this,
                as: 'children',
                where: { is_active: true },
                required: false,
                order: [
                    ['order', 'ASC'],
                    ['title', 'ASC']
                ]
            }]
        });
    };
    
    /**
     * Obtém todos os menus de nível superior (sem parent_id)
     * @returns {Promise<Array>} - Lista de menus de nível superior
     */
    Menu.getRootMenus = async function() {
        const menus = await this.getActiveMenus();
        return menus.filter(menu => !menu.parent_id);
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
            
            // Validar ciclos de parent_id
            if (data.parent_id && data.parent_id === menuId) {
                throw new Error('Um menu não pode ser pai de si mesmo');
            }
            
            // Verificar se parent existe
            if (data.parent_id) {
                const parentExists = await this.findByPk(data.parent_id);
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
            
            // Tratar parent_id especificamente
            if ('parent_id' in data) {
                updateData.parent_id = data.parent_id === null || data.parent_id === '' ? null : data.parent_id;
            }
            
            // Tratar campos booleanos
            if ('is_admin_only' in data) updateData.is_admin_only = data.is_admin_only === true;
            if ('is_active' in data) updateData.is_active = data.is_active === true;
            
            // Tratar resource_path
            if ('resource_path' in data) {
                // Se resource_path for nulo ou vazio, usar o path
                if (data.resource_path === null || data.resource_path === '') {
                    updateData.resource_path = updateData.path || menu.path;
                } else {
                    updateData.resource_path = String(data.resource_path);
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