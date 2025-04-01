class RoleManager {
    constructor() {
        this.roleForm = document.getElementById('roleForm');
        this.rolesList = document.getElementById('rolesList');
        this.resourcesList = document.getElementById('resourcesList');
        this.selectedRoleId = null;

        this.initializeEventListeners();
        this.loadRoles();
    }

    initializeEventListeners() {
        this.roleForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            await this.saveRole();
        });
    }

    showToast(message, type = 'info') {
        const toast = document.createElement('div');
        toast.className = `notification is-${type}`;
        toast.style.position = 'fixed';
        toast.style.bottom = '20px';
        toast.style.right = '20px';
        toast.style.zIndex = '1000';
        toast.innerHTML = `
            <button class="delete" onclick="this.parentElement.remove()"></button>
            ${message}
        `;
        document.body.appendChild(toast);
        setTimeout(() => toast.remove(), 5000);
    }

    async loadRoles() {
        try {
            const response = await fetch('/api/roles');
            if (!response.ok) throw new Error('Erro ao carregar papéis');
            
            const roles = await response.json();
            this.renderRoles(roles);
        } catch (error) {
            console.error('Erro ao carregar papéis:', error);
            this.showToast('Erro ao carregar papéis', 'danger');
        }
    }

    renderRoles(roles) {
        this.rolesList.innerHTML = roles.map(role => `
            <div class="panel-block">
                <span class="panel-icon">
                    <i class="fas fa-user-tag"></i>
                </span>
                <a href="#" onclick="roleManager.selectRole('${role.id}')">${role.name}</a>
            </div>
        `).join('');
    }

    async selectRole(roleId) {
        this.selectedRoleId = roleId;
        try {
            const response = await fetch(`/api/roles/${roleId}/resources`);
            if (!response.ok) throw new Error('Erro ao carregar recursos do papel');
            
            const resources = await response.json();
            this.renderResources(resources);
            
            // Carregar dados do papel no formulário
            const roleResponse = await fetch(`/api/roles/${roleId}`);
            if (!roleResponse.ok) throw new Error('Erro ao carregar dados do papel');
            
            const roleData = await roleResponse.json();
            this.populateForm(roleData);
        } catch (error) {
            console.error('Erro ao carregar recursos do papel:', error);
            this.showToast('Erro ao carregar recursos do papel', 'danger');
        }
    }

    renderResources(resources) {
        this.resourcesList.innerHTML = resources.map(resource => `
            <div class="field">
                <label class="checkbox">
                    <input type="checkbox" name="resources" value="${resource.id}" 
                           ${resource.selected ? 'checked' : ''}>
                    ${resource.name}
                </label>
            </div>
        `).join('');
    }

    populateForm(roleData) {
        document.getElementById('roleName').value = roleData.name;
        document.getElementById('roleDescription').value = roleData.description || '';
    }

    async saveRole() {
        try {
            const formData = new FormData(this.roleForm);
            const roleData = {
                name: formData.get('name'),
                description: formData.get('description'),
                permissions: Array.from(formData.getAll('resources'))
            };

            const method = this.selectedRoleId ? 'PUT' : 'POST';
            const url = this.selectedRoleId ? 
                `/api/roles/${this.selectedRoleId}` : 
                '/api/roles';

            const response = await fetch(url, {
                method,
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(roleData)
            });

            if (!response.ok) throw new Error('Erro ao salvar papel');

            this.showToast('Papel salvo com sucesso', 'success');
            await this.loadRoles();
            this.roleForm.reset();
            this.selectedRoleId = null;
        } catch (error) {
            console.error('Erro ao salvar papel:', error);
            this.showToast('Erro ao salvar papel', 'danger');
        }
    }

    async deleteRole(roleId) {
        if (!confirm('Tem certeza que deseja excluir este papel?')) return;

        try {
            const response = await fetch(`/api/roles/${roleId}`, {
                method: 'DELETE'
            });

            if (!response.ok) throw new Error('Erro ao excluir papel');

            this.showToast('Papel excluído com sucesso', 'success');
            await this.loadRoles();
            if (this.selectedRoleId === roleId) {
                this.roleForm.reset();
                this.selectedRoleId = null;
                this.resourcesList.innerHTML = '';
            }
        } catch (error) {
            console.error('Erro ao excluir papel:', error);
            this.showToast('Erro ao excluir papel', 'danger');
        }
    }
}

// Inicializar o gerenciador de papéis quando o documento estiver pronto
document.addEventListener('DOMContentLoaded', () => {
    window.roleManager = new RoleManager();
}); 