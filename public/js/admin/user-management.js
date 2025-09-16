class UserManager {
    constructor() {
        this.users = [];
        this.roles = [];
        this.currentUserId = null;
        this.init();
        this.setupEventListeners();
    }

    async init() {
        try {
            await Promise.all([
                this.loadUsers(),
                this.loadRoles()
            ]);
            this.updateStats();
        } catch (error) {
            console.error('Erro ao inicializar:', error);
            this.showToast('Erro ao carregar dados', 'error');
        }
    }

    setupEventListeners() {
        // Configurar busca
        const searchInput = document.getElementById('searchInput');
        if (searchInput) {
            searchInput.addEventListener('input', this.handleSearch.bind(this));
        }
    }

    handleSearch(event) {
        const searchTerm = event.target.value.toLowerCase();
        const filteredUsers = this.users.filter(user => 
            user.username.toLowerCase().includes(searchTerm) ||
            user.email.toLowerCase().includes(searchTerm) ||
            user.userRoles.some(role => role.name.toLowerCase().includes(searchTerm))
        );
        this.renderUsers(filteredUsers);
    }

    async loadUsers() {
        try {
            const response = await fetch('/api/admin/users', {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
                }
            });

            if (!response.ok) {
                throw new Error('Erro ao carregar usuários');
            }

            this.users = await response.json();
            this.renderUsers(this.users);
            this.updateStats();
        } catch (error) {
            console.error('Erro ao carregar usuários:', error);
            this.showToast('Erro ao carregar usuários', 'error');
        }
    }

    async loadRoles() {
        try {
            const response = await fetch('/api/roles', {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
                }
            });

            if (!response.ok) {
                throw new Error('Erro ao carregar papéis');
            }

            this.roles = await response.json();
            this.renderRoles();
            this.updateStats();
        } catch (error) {
            console.error('Erro ao carregar papéis:', error);
            this.showToast('Erro ao carregar papéis', 'error');
        }
    }

    renderUsers(users = this.users) {
        const container = document.getElementById('userList');
        if (!container) return;

        container.innerHTML = users.map(user => `
            <tr>
                <td>
                    <div class="flex items-center gap-3">
                        <div class="avatar">
                            <div id="user-avatar-${user.id}" 
                                 class="w-8 h-8 rounded-full bg-base-300 flex items-center justify-center text-base-content/70">
                                <i class="fas fa-user"></i>
                            </div>
                        </div>
                        <div class="font-medium">${user.username}</div>
                    </div>
                </td>
                <td>${user.email}</td>
                <td>
                    <div class="flex items-center gap-2">
                        <div class="badge badge-sm ${user.is_active ? 'badge-success' : 'badge-error'} gap-1">
                            <div class="w-2 h-2 rounded-full ${user.is_active ? 'bg-success' : 'bg-error'}"></div>
                            ${user.is_active ? 'Ativo' : 'Inativo'}
                        </div>
                    </div>
                </td>
                <td>
                    ${user.userRoles?.map(role => `
                        <span class="badge badge-outline badge-sm mr-1">${role.name}</span>
                    `).join('') || ''}
                </td>
                <td class="text-right">
                    <div class="flex gap-1 justify-end">
                        <button class="btn btn-ghost btn-sm" onclick="userManager.editUser('${user.id}')" title="Editar">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="btn btn-ghost btn-sm text-error" onclick="userManager.deleteUser('${user.id}')" title="Excluir">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </td>
            </tr>
        `).join('') || '<tr><td colspan="5" class="text-center py-8 text-base-content/70">Nenhum usuário encontrado</td></tr>';

        // Atualizar avatares usando o AvatarManager
        if (window.avatarManager) {
            users.forEach(user => {
                const avatarElement = document.getElementById(`user-avatar-${user.id}`);
                if (avatarElement) {
                    // Se o usuário tem avatar, substituir ícone por imagem
                    window.avatarManager.getUserAvatar(user.id).then(avatarUrl => {
                        if (avatarUrl && avatarUrl !== '/assets/avatar-default.png') {
                            avatarElement.innerHTML = `<img src="${avatarUrl}" alt="${user.username}" class="w-full h-full object-cover rounded-full" onerror="this.parentElement.innerHTML='<i class=\\'fas fa-user\\'></i>'">`;
                        }
                    });
                }
            });
        }
    }

    renderRoles() {
        const rolesContainer = document.getElementById('rolesList');
        if (!rolesContainer) return;
        
        rolesContainer.innerHTML = '';
        
        this.roles.forEach(role => {
            const roleCard = document.createElement('div');
            roleCard.className = 'role-card';
            roleCard.innerHTML = `
                <label class="label cursor-pointer justify-start gap-3 p-4">
                    <input class="checkbox" type="checkbox" value="${role.id}" id="role_${role.id}" name="roles">
                    <div class="flex-1">
                        <div class="font-medium">${role.name}</div>
                        <div class="text-sm text-base-content/70">${role.description || 'Papel do sistema'}</div>
                    </div>
                </label>
            `;
            rolesContainer.appendChild(roleCard);
        });
    }

    updateStats() {
        const totalUsers = document.getElementById('totalUsers');
        const activeUsers = document.getElementById('activeUsers');
        const totalRoles = document.getElementById('totalRoles');

        if (totalUsers) totalUsers.textContent = this.users.length;
        if (activeUsers) activeUsers.textContent = this.users.filter(u => u.is_active).length;
        if (totalRoles) totalRoles.textContent = this.roles.length;
    }

    openUserModal(userId = null) {
        this.currentUserId = userId;
        const modal = document.getElementById('userModal');
        const title = document.getElementById('modalTitle');
        const form = document.getElementById('userForm');

        title.textContent = userId ? 'Editar Usuário' : 'Novo Usuário';
        form.reset();

        if (userId) {
            const user = this.users.find(u => u.id === userId);
            if (user) {
                document.getElementById('userName').value = user.username;
                document.getElementById('userEmail').value = user.email;
                document.getElementById('userStatus').checked = user.is_active;

                // Marcar papéis do usuário
                this.roles.forEach(role => {
                    const checkbox = document.getElementById(`role_${role.id}`);
                    if (checkbox) {
                        checkbox.checked = user.userRoles.some(r => r.id === role.id);
                    }
                });
            }
        }

        if (modal) {
            modal.showModal();
        }
    }

    async saveUser() {
        try {
            const form = document.getElementById('userForm');
            const roleCheckboxes = document.querySelectorAll('#rolesList input[type="checkbox"]:checked');
            
            if (roleCheckboxes.length === 0) {
                this.showToast('Selecione pelo menos um papel para o usuário', 'warning');
                return;
            }

            const password = document.getElementById('userPassword').value.trim();
            const userData = {
                username: document.getElementById('userName').value.trim(),
                email: document.getElementById('userEmail').value.trim(),
                is_active: document.getElementById('userStatus').checked,
                roles: Array.from(roleCheckboxes).map(cb => cb.value)
            };

            // Validar campos obrigatórios
            if (!userData.username || !userData.email) {
                this.showToast('Nome de usuário e email são obrigatórios', 'warning');
                return;
            }

            // Validar senha para novo usuário
            if (!this.currentUserId && !password) {
                this.showToast('Senha é obrigatória para novos usuários', 'warning');
                return;
            }

            // Só incluir senha se foi fornecida
            if (password) {
                userData.password = password;
            }

            const url = this.currentUserId ? 
                `/api/admin/users/${this.currentUserId}` : 
                '/api/admin/users';

            const response = await fetch(url, {
                method: this.currentUserId ? 'PUT' : 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
                },
                body: JSON.stringify(userData)
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || error.message || 'Erro ao salvar usuário');
            }

            await this.loadUsers();
            
            // Fechar modal
            const modal = document.getElementById('userModal');
            if (modal) {
                modal.close();
            }
            
            // Mostrar mensagem apropriada
            if (!this.currentUserId) {
                this.showToast(`Usuário criado com sucesso!`, 'success');
            } else {
                this.showToast('Usuário atualizado com sucesso', 'success');
            }
        } catch (error) {
            console.error('Erro ao salvar usuário:', error);
            this.showToast(error.message || 'Erro ao salvar usuário', 'error');
        }
    }

    async deleteUser(userId) {
        if (!confirm('Tem certeza que deseja excluir este usuário?')) return;

        try {
            const response = await fetch(`/api/admin/users/${userId}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
                }
            });

            if (!response.ok) {
                throw new Error('Erro ao excluir usuário');
            }

            await this.loadUsers();
            this.showToast('Usuário excluído com sucesso', 'success');
        } catch (error) {
            console.error('Erro ao excluir usuário:', error);
            this.showToast(error.message || 'Erro ao excluir usuário', 'error');
        }
    }

    editUser(userId) {
        this.openUserModal(userId);
    }

    showToast(message, type = 'info', duration = 5000) {
        const toast = document.createElement('div');
        toast.className = `alert alert-${type} fixed bottom-4 right-4 z-50 max-w-sm`;
        toast.innerHTML = `
            <div class="flex items-center gap-2">
                <i class="fas ${this.getToastIcon(type)}"></i>
                <span>${message}</span>
            </div>
            <button class="btn btn-ghost btn-sm" onclick="this.parentElement.remove()">
                <i class="fas fa-times"></i>
            </button>
        `;
        document.body.appendChild(toast);
        setTimeout(() => toast.remove(), duration);
    }
    
    getToastIcon(type) {
        const icons = {
            success: 'fa-check-circle',
            error: 'fa-exclamation-circle',
            warning: 'fa-exclamation-triangle',
            info: 'fa-info-circle'
        };
        return icons[type] || icons.info;
    }
}

// Inicializar quando o DOM estiver pronto
document.addEventListener('DOMContentLoaded', () => {
    window.userManager = new UserManager();
});

/**
 * Obtém os papéis do usuário
 * @param {Object} user - Objeto do usuário
 * @returns {Array} - Array com os nomes dos papéis
 */
function getUserRoles(user) {
    const roles = [];
    
    if (user.is_admin) {
        roles.push('Admin');
    }
    
    // Adicionar lógica para outros papéis conforme necessário
    // Exemplo: verificar propriedades específicas ou usar roles do usuário se disponível
    if (user.roles) {
        user.roles.forEach(role => {
            roles.push(role.name);
        });
    } else {
        // Fallback para papéis padrão
        if (!user.is_admin) {
            roles.push('Usuário');
        }
    }
    
    return roles;
} 