/**
 * Gerenciador de Avatares
 * Utilitário para buscar e exibir avatares de usuários
 */
class AvatarManager {
    constructor() {
        this.cache = new Map();
        this.defaultAvatar = '/assets/avatar-default.png';
        this.defaultIcon = 'fas fa-user';
    }

    /**
     * Busca o avatar de um usuário específico
     * @param {string} userId - ID do usuário
     * @returns {Promise<string>} URL do avatar
     */
    async getUserAvatar(userId) {
        try {
            // Verificar cache primeiro
            if (this.cache.has(userId)) {
                return this.cache.get(userId);
            }

            const token = localStorage.getItem('auth_token');
            if (!token) {
                return this.defaultAvatar;
            }

            const response = await fetch(`/api/user/${userId}/avatar`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (!response.ok) {
                console.warn(`Erro ao buscar avatar do usuário ${userId}:`, response.status);
                return this.defaultAvatar;
            }

            const data = await response.json();
            const avatarUrl = data.avatarUrl || this.defaultAvatar;
            
            // Armazenar no cache
            this.cache.set(userId, avatarUrl);
            
            return avatarUrl;
        } catch (error) {
            console.error('Erro ao buscar avatar:', error);
            return this.defaultAvatar;
        }
    }

    /**
     * Busca informações completas de um usuário
     * @param {string} userId - ID do usuário
     * @returns {Promise<Object>} Informações do usuário
     */
    async getUserInfo(userId) {
        try {
            const token = localStorage.getItem('auth_token');
            if (!token) {
                return null;
            }

            const response = await fetch(`/api/user/${userId}/info`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (!response.ok) {
                console.warn(`Erro ao buscar informações do usuário ${userId}:`, response.status);
                return null;
            }

            const userInfo = await response.json();
            
            // Armazenar avatar no cache
            this.cache.set(userId, userInfo.avatar);
            
            return userInfo;
        } catch (error) {
            console.error('Erro ao buscar informações do usuário:', error);
            return null;
        }
    }

    /**
     * Atualiza a imagem de um elemento com o avatar do usuário
     * @param {string} userId - ID do usuário
     * @param {HTMLElement|string} element - Elemento ou seletor do elemento
     * @param {Object} options - Opções adicionais
     */
    async updateAvatarElement(userId, element, options = {}) {
        try {
            const avatarUrl = await this.getUserAvatar(userId);
            const imgElement = typeof element === 'string' ? document.querySelector(element) : element;
            
            if (!imgElement) {
                console.warn('Elemento não encontrado para atualizar avatar');
                return;
            }

            // Atualizar src da imagem
            imgElement.src = avatarUrl;
            
            // Adicionar classes CSS se especificado
            if (options.classes) {
                imgElement.className = options.classes;
            }
            
            // Adicionar atributos adicionais
            if (options.attributes) {
                Object.entries(options.attributes).forEach(([key, value]) => {
                    imgElement.setAttribute(key, value);
                });
            }

            // Callback após carregamento
            if (options.onLoad) {
                imgElement.onload = () => options.onLoad(imgElement);
            }

            // Callback de erro
            if (options.onError) {
                imgElement.onerror = () => options.onError(imgElement);
            } else {
                // Fallback padrão para erro
                imgElement.onerror = () => {
                    imgElement.src = this.defaultAvatar;
                };
            }

        } catch (error) {
            console.error('Erro ao atualizar elemento de avatar:', error);
        }
    }

    /**
     * Cria um elemento de avatar com as informações do usuário
     * @param {string} userId - ID do usuário
     * @param {Object} options - Opções de configuração
     * @returns {Promise<HTMLElement>} Elemento do avatar
     */
    async createAvatarElement(userId, options = {}) {
        const {
            size = 'w-8 h-8',
            classes = 'rounded-full',
            showName = false,
            showRole = false,
            containerClass = 'flex items-center gap-2',
            useIconPlaceholder = false
        } = options;

        try {
            const userInfo = await this.getUserInfo(userId);
            const avatarUrl = userInfo ? userInfo.avatar : this.defaultAvatar;
            const userName = userInfo ? (userInfo.name || userInfo.username) : 'Usuário';
            const userRole = userInfo && userInfo.roles ? userInfo.roles[0]?.name : 'Usuário';

            const container = document.createElement('div');
            container.className = containerClass;

            // Se usar ícone placeholder ou se não há avatar
            if (useIconPlaceholder || !userInfo?.avatar) {
                const iconContainer = document.createElement('div');
                iconContainer.className = `${size} ${classes} bg-base-300 flex items-center justify-center text-base-content/70`;
                
                const icon = document.createElement('i');
                icon.className = this.defaultIcon;
                iconContainer.appendChild(icon);
                
                container.appendChild(iconContainer);
            } else {
                const img = document.createElement('img');
                img.src = avatarUrl;
                img.alt = userName;
                img.className = `${size} ${classes}`;
                img.onerror = () => {
                    // Se erro ao carregar imagem, mostrar ícone
                    const iconContainer = document.createElement('div');
                    iconContainer.className = `${size} ${classes} bg-base-300 flex items-center justify-center text-base-content/70`;
                    
                    const icon = document.createElement('i');
                    icon.className = this.defaultIcon;
                    iconContainer.appendChild(icon);
                    
                    container.replaceChild(iconContainer, img);
                };

                container.appendChild(img);
            }

            if (showName || showRole) {
                const textContainer = document.createElement('div');
                
                if (showName) {
                    const nameElement = document.createElement('div');
                    nameElement.className = 'font-medium';
                    nameElement.textContent = userName;
                    textContainer.appendChild(nameElement);
                }

                if (showRole) {
                    const roleElement = document.createElement('div');
                    roleElement.className = 'text-sm opacity-70';
                    roleElement.textContent = userRole;
                    textContainer.appendChild(roleElement);
                }

                container.appendChild(textContainer);
            }

            return container;
        } catch (error) {
            console.error('Erro ao criar elemento de avatar:', error);
            
            // Retornar elemento de fallback com ícone
            const container = document.createElement('div');
            container.className = containerClass;
            
            const iconContainer = document.createElement('div');
            iconContainer.className = `${size} ${classes} bg-base-300 flex items-center justify-center text-base-content/70`;
            
            const icon = document.createElement('i');
            icon.className = this.defaultIcon;
            iconContainer.appendChild(icon);
            
            container.appendChild(iconContainer);
            return container;
        }
    }

    /**
     * Limpa o cache de avatares
     */
    clearCache() {
        this.cache.clear();
    }

    /**
     * Remove um usuário específico do cache
     * @param {string} userId - ID do usuário
     */
    removeFromCache(userId) {
        this.cache.delete(userId);
    }

    /**
     * Atualiza o avatar do usuário atual no navbar
     */
    async updateCurrentUserAvatar() {
        try {
            const token = localStorage.getItem('auth_token');
            if (!token) return;

            const tokenData = JSON.parse(atob(token.split('.')[1]));
            const userId = tokenData.id;

            // Atualizar avatares no navbar
            await this.updateAvatarElement(userId, '#navbarAvatar');
            await this.updateAvatarElement(userId, '#sidebarAvatar');
        } catch (error) {
            console.error('Erro ao atualizar avatar do usuário atual:', error);
        }
    }
}

// Instância global do gerenciador de avatares
window.avatarManager = new AvatarManager();

// Exportar para uso em módulos
if (typeof module !== 'undefined' && module.exports) {
    module.exports = AvatarManager;
}
