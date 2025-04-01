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
            comment: 'Caminho do recurso para verificação de permissão'
        }
    }, {
        tableName: 'Menus',
        timestamps: true
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

    return Menu;
}; 