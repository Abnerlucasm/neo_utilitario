class UserManager {
    constructor() {
        this.setupElements();
        this.setupEventListeners();
        this.loadUsers();
        this.loadRoles();
    }

    setupElements() {
        this.modal = document.getElementById('userModal');
        this.form = document.getElementById('userForm');
        this.tableBody = document.getElementById('usersTableBody');
        this.currentUserId = null;
    }

    setupEventListeners() {
        document.getElementById('addUserBtn').addEventListener('click', () => this.showModal());
        document.getElementById('saveUserBtn').addEventListener('click', () => this.saveUser());
        document.getElementById('cancelUserBtn').addEventListener('click', () => this.hideModal());
        document.querySelector('.modal-background').addEventListener('click', () => this.hideModal());
        document.querySelector('.delete').addEventListener('click', () => this.hideModal());
    }

    async loadUsers() {
        try {
            const response = await fetch('/api/admin/users', {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                }
            });
            const users = await response.json();
            this.renderUsers(users);
        } catch (error) {
            console.error('Erro ao carregar usuários:', error);
            this.showError('Erro ao carregar usuários');
        }
    }

    async loadRoles() {
        try {
            const response = await fetch('/api/roles', {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
                }
            });
            const roles = await response.json();
            this.renderRolesCheckboxes(roles);
        } catch (error) {
            console.error('Erro ao carregar papéis:', error);
        }
    }

    renderUsers(users) {
        this.tableBody.innerHTML = users.map(user => `
            <tr>
                <td>${user.name}</td>
                <td>${user.email}</td>
                <td>
                    <span class="tag ${user.is_active ? 'is-success' : 'is-danger'}">
                        ${user.is_active ? 'Ativo' : 'Inativo'}
                    </span>
                </td>
                <td>${this.formatRoles(user.userRoles)}</td>
                <td>${this.formatDate(user.last_login)}</td>
                <td>
                    <div class="buttons are-small">
                        <button class="button is-info" onclick="userManager.editUser('${user.id}')">
                            <span class="icon"><i class="fas fa-edit"></i></span>
                        </button>
                        <button class="button is-danger" onclick="userManager.deleteUser('${user.id}')">
                            <span class="icon"><i class="fas fa-trash"></i></span>
                        </button>
                    </div>
                </td>
            </tr>
        `).join('');
    }

    renderRolesCheckboxes(roles) {
        const container = document.getElementById('rolesCheckboxes');
        container.innerHTML = roles.map(role => `
            <label class="checkbox">
                <input type="checkbox" value="${role.id}" name="roles">
                ${role.name}
            </label>
        `).join('<br>');
    }

    formatRoles(roles) {
        return roles.map(role => 
            `<span class="tag is-info is-light">${role.name}</span>`
        ).join(' ');
    }

    formatDate(date) {
        if (!date) return 'Nunca';
        return new Date(date).toLocaleString('pt-BR');
    }

    showModal(userId = null) {
        this.currentUserId = userId;
        this.modal.classList.add('is-active');
        
        if (userId) {
            this.loadUserData(userId);
        } else {
            this.resetForm();
        }
    }

    hideModal() {
        this.modal.classList.remove('is-active');
        this.resetForm();
    }

    resetForm() {
        this.form.reset();
        this.currentUserId = null;
    }

    async loadUserData(userId) {
        try {
            const response = await fetch(`/api/admin/users/${userId}`, {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                }
            });
            const user = await response.json();

            document.getElementById('userName').value = user.name;
            document.getElementById('userEmail').value = user.email;
            document.getElementById('userStatus').checked = user.is_active;

            // Marcar papéis do usuário
            const checkboxes = document.querySelectorAll('[name="roles"]');
            checkboxes.forEach(checkbox => {
                checkbox.checked = user.userRoles.some(role => role.id === checkbox.value);
            });
        } catch (error) {
            console.error('Erro ao carregar dados do usuário:', error);
            this.showError('Erro ao carregar dados do usuário');
        }
    }

    async saveUser() {
        try {
            const userData = {
                name: document.getElementById('userName').value,
                email: document.getElementById('userEmail').value,
                is_active: document.getElementById('userStatus').checked,
                roles: Array.from(document.querySelectorAll('[name="roles"]:checked'))
                    .map(cb => cb.value)
            };

            const url = this.currentUserId ? 
                `/api/admin/users/${this.currentUserId}` : 
                '/api/admin/users';

            const response = await fetch(url, {
                method: this.currentUserId ? 'PUT' : 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                },
                body: JSON.stringify(userData)
            });

            if (response.ok) {
                this.hideModal();
                this.loadUsers();
                this.showSuccess('Usuário salvo com sucesso');
            } else {
                const data = await response.json();
                this.showError(data.error);
            }
        } catch (error) {
            console.error('Erro ao salvar usuário:', error);
            this.showError('Erro ao salvar usuário');
        }
    }

    async deleteUser(userId) {
        if (!confirm('Tem certeza que deseja excluir este usuário?')) {
            return;
        }

        try {
            const response = await fetch(`/api/admin/users/${userId}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                }
            });

            if (response.ok) {
                this.loadUsers();
                this.showSuccess('Usuário excluído com sucesso');
            } else {
                const data = await response.json();
                this.showError(data.error);
            }
        } catch (error) {
            console.error('Erro ao excluir usuário:', error);
            this.showError('Erro ao excluir usuário');
        }
    }

    showError(message) {
        this.showNotification(message, 'is-danger');
    }

    showSuccess(message) {
        this.showNotification(message, 'is-success');
    }

    showNotification(message, type) {
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.innerHTML = `
            <button class="delete"></button>
            ${message}
        `;

        notification.querySelector('.delete').addEventListener('click', () => {
            notification.remove();
        });

        document.querySelector('.container').insertBefore(
            notification,
            document.querySelector('.title')
        );

        setTimeout(() => notification.remove(), 5000);
    }
}

// Inicializar gerenciador
const userManager = new UserManager(); 