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
            this.showToast('Erro ao carregar dados', 'danger');
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
            this.showToast('Erro ao carregar usuários', 'danger');
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
            this.showToast('Erro ao carregar papéis', 'danger');
        }
    }

    renderUsers(users = this.users) {
        const container = document.getElementById('userList');
        if (!container) return;

        container.innerHTML = users.map(user => `
            <tr>
                <td>
                    <div class="d-flex align-items-center">
                        <div class="avatar-circle" style="background-color: ${this.stringToColor(user.username)}">
                            ${user.username.charAt(0).toUpperCase()}
                        </div>
                        <div class="ms-2">${user.username}</div>
                    </div>
                </td>
                <td>${user.email}</td>
                <td>
                    <span class="user-status ${user.is_active ? 'active' : 'inactive'}"></span>
                    ${user.is_active ? 'Ativo' : 'Inativo'}
                </td>
                <td>
                    ${user.userRoles?.map(role => `
                        <span class="roles-badge">${role.name}</span>
                    `).join('') || ''}
                </td>
                <td class="text-end">
                    <button class="btn btn-sm btn-warning btn-action" onclick="userManager.editUser('${user.id}')" title="Editar">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="btn btn-sm btn-danger btn-action" onclick="userManager.deleteUser('${user.id}')" title="Excluir">
                        <i class="fas fa-trash"></i>
                    </button>
                </td>
            </tr>
        `).join('') || '<tr><td colspan="5" class="text-center">Nenhum usuário encontrado</td></tr>';
    }

    renderRoles() {
        const rolesContainer = document.getElementById('rolesList');
        rolesContainer.innerHTML = '';
        
        this.roles.forEach(role => {
            const roleCard = document.createElement('div');
            roleCard.className = `col-md-6 mb-3`;
            roleCard.innerHTML = `
                <div class="card role-card border">
                    <div class="card-body">
                        <div class="form-check">
                            <input class="form-check-input" type="checkbox" value="${role.id}" id="role_${role.id}" name="roles">
                            <label class="form-check-label w-100" for="role_${role.id}">
                                ${role.name}
                                <small class="text-muted d-block mt-1">${role.description || 'Papel do sistema'}</small>
                            </label>
                        </div>
                    </div>
                </div>
            `;
            rolesContainer.appendChild(roleCard);
        });
    }
    
    getRoleDescription(roleName) {
        return 'Papel do sistema';
    }

    updateStats() {
        const totalUsers = document.getElementById('totalUsers');
        const activeUsers = document.getElementById('activeUsers');
        const totalRoles = document.getElementById('totalRoles');

        if (totalUsers) totalUsers.textContent = this.users.length;
        if (activeUsers) activeUsers.textContent = this.users.filter(u => u.is_active).length;
        if (totalRoles) totalRoles.textContent = this.roles.length;
    }

    stringToColor(str) {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            hash = str.charCodeAt(i) + ((hash << 5) - hash);
        }
        const c = (hash & 0x00FFFFFF).toString(16).toUpperCase();
        return '#' + '00000'.substring(0, 6 - c.length) + c;
    }

    openUserModal(userId = null) {
        this.currentUserId = userId;
        const modal = new bootstrap.Modal(document.getElementById('userModal'));
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

        modal.show();
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

            console.log('Enviando dados do usuário:', { 
                ...userData, 
                password: password ? '[PRESENTE]' : '[NÃO ALTERADA]',
                isUpdate: !!this.currentUserId
            });

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

            const savedUser = await response.json();
            console.log('Usuário salvo com sucesso:', savedUser);

            await this.loadUsers();
            const modal = bootstrap.Modal.getInstance(document.getElementById('userModal'));
            modal.hide();
            
            // Mostrar mensagem apropriada
            if (!this.currentUserId) {
                this.showToast(`Usuário criado com sucesso!`, 'success');
            } else {
                this.showToast('Usuário atualizado com sucesso', 'success');
            }
        } catch (error) {
            console.error('Erro ao salvar usuário:', error);
            this.showToast(error.message || 'Erro ao salvar usuário', 'danger');
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
            this.showToast(error.message || 'Erro ao excluir usuário', 'danger');
        }
    }

    editUser(userId) {
        this.openUserModal(userId);
    }

    showToast(message, type = 'info', duration = 5000) {
        const toast = document.createElement('div');
        toast.className = `alert alert-${type} position-fixed bottom-0 end-0 m-3`;
        toast.style.zIndex = '1050';
        toast.innerHTML = `
            ${message}
            <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
        `;
        document.body.appendChild(toast);
        setTimeout(() => toast.remove(), duration);
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