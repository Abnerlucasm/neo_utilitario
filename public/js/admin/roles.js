class RolesManager {
    constructor() {
        this.roles = [];
        this.permissions = [];
        this.currentRoleId = null;
        this.init();
    }

    async init() {
        try {
            await Promise.all([
                this.loadRoles(),
                this.loadPermissions()
            ]);
            this.updateStats();
        this.setupEventListeners();
            this.renderPermissionsCheckboxes();
            this.updateRolePreview();
        } catch (error) {
            console.error('Erro ao inicializar gerenciador de papéis:', error);
            this.showToast('Erro ao carregar dados', 'error');
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

    async loadPermissions() {
        try {
            const response = await fetch('/api/permissions', {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
                }
            });
            
            if (!response.ok) {
                throw new Error('Erro ao carregar permissões');
            }

            this.permissions = await response.json();
            this.renderPermissions();
        } catch (error) {
            console.error('Erro ao carregar permissões:', error);
            this.showToast('Erro ao carregar permissões', 'error');
        }
    }

    renderRoles() {
        const container = document.getElementById('rolesList');
        if (!container) return;

        container.innerHTML = this.roles.map(role => `
            <div class="card bg-base-100 shadow-lg hover:shadow-xl transition-all duration-200">
                <div class="card-body">
                    <div class="flex items-center justify-between">
                        <div class="flex items-center gap-3">
                            <div class="avatar placeholder">
                                <div class="bg-primary text-primary-content rounded-full w-12">
                                    <span class="text-lg font-bold">${role.name.charAt(0).toUpperCase()}</span>
                                </div>
                            </div>
                            <div>
                                <h3 class="font-bold text-lg">${role.name}</h3>
                                <p class="text-base-content/70">${role.description || 'Papel do sistema'}</p>
                                <div class="flex gap-2 mt-2">
                                    <span class="badge badge-outline badge-sm">${role.users_count || 0} usuários</span>
                                    <span class="badge badge-outline badge-sm">${role.permissions_count || 0} permissões</span>
                                </div>
                            </div>
                        </div>
                        <div class="flex gap-2">
                            <button class="btn btn-ghost btn-sm" onclick="rolesManager.editRole('${role.id}')" title="Editar">
                                <i class="fas fa-edit"></i>
                            </button>
                            <button class="btn btn-ghost btn-sm text-error" onclick="rolesManager.deleteRole('${role.id}')" title="Excluir">
                                <i class="fas fa-trash"></i>
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `).join('') || '<div class="text-center py-8 text-base-content/70">Nenhum papel encontrado</div>';
    }

    renderPermissions() {
        const container = document.getElementById('permissionsList');
        if (!container) return;

        container.innerHTML = this.permissions.map(permission => `
            <div class="card bg-base-100 shadow-lg hover:shadow-xl transition-all duration-200">
                <div class="card-body">
                    <div class="flex items-center justify-between">
                        <div>
                            <h3 class="font-bold">${permission.name}</h3>
                            <p class="text-base-content/70">${permission.description || 'Permissão do sistema'}</p>
                            <div class="flex gap-2 mt-2">
                                <span class="badge badge-outline badge-sm">${permission.resource}</span>
                                <span class="badge badge-outline badge-sm">${permission.action}</span>
                            </div>
                        </div>
                        <div class="flex gap-2">
                            <button class="btn btn-ghost btn-sm" onclick="rolesManager.editPermission('${permission.id}')" title="Editar">
                                <i class="fas fa-edit"></i>
                            </button>
                            <button class="btn btn-ghost btn-sm text-error" onclick="rolesManager.deletePermission('${permission.id}')" title="Excluir">
                                <i class="fas fa-trash"></i>
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `).join('') || '<div class="text-center py-8 text-base-content/70">Nenhuma permissão encontrada</div>';
        
        // Atualizar também as checkboxes no modal
        this.renderPermissionsCheckboxes();
    }

    updateStats() {
        const totalRoles = document.getElementById('totalRoles');
        const totalPermissions = document.getElementById('totalPermissions');
        const activeRoles = document.getElementById('activeRoles');

        if (totalRoles) totalRoles.textContent = this.roles.length;
        if (totalPermissions) totalPermissions.textContent = this.permissions.length;
        if (activeRoles) activeRoles.textContent = this.roles.filter(r => r.is_active).length;
    }

    openRoleModal(roleId = null) {
        this.currentRoleId = roleId;
        const modal = document.getElementById('roleModal');
        const title = document.getElementById('modalTitle');
        const form = document.getElementById('roleForm');

        title.textContent = roleId ? 'Editar Papel' : 'Novo Papel';
        form.reset();

        if (roleId) {
            const role = this.roles.find(r => r.id === roleId);
            if (role) {
                document.getElementById('roleName').value = role.name;
                document.getElementById('roleDescription').value = role.description || '';
                document.getElementById('roleIsActive').checked = role.is_active;

                // Marcar permissões do papel
                this.permissions.forEach(permission => {
                    const checkbox = document.getElementById(`permission_${permission.id}`);
                    if (checkbox) {
                        checkbox.checked = role.permissions && role.permissions.some(p => p.id === permission.id);
                    }
                });
            }
        }

        if (modal) {
            modal.showModal();
        }
    }

    renderPermissionsCheckboxes() {
        const container = document.getElementById('permissionsCheckboxes');
        if (!container) return;

        container.innerHTML = this.permissions.map(permission => `
            <label class="label cursor-pointer justify-start gap-3 p-4 bg-base-200 rounded-lg hover:bg-base-300 transition-colors">
                <input type="checkbox" class="checkbox" value="${permission.id}" id="permission_${permission.id}" name="permissions">
                <div class="flex-1">
                    <div class="font-medium">${permission.name}</div>
                    <div class="text-sm text-base-content/70">${permission.description || 'Permissão do sistema'}</div>
                    <div class="flex gap-2 mt-2">
                        <span class="badge badge-outline badge-xs">${permission.resource}</span>
                        <span class="badge badge-outline badge-xs">${permission.action}</span>
                    </div>
                </div>
            </label>
        `).join('') || '<div class="text-center py-8 text-base-content/70">Nenhuma permissão encontrada</div>';
    }

    updateRolePreview() {
        const previewName = document.getElementById('previewName');
        const previewDescription = document.getElementById('previewDescription');
        const previewInitial = document.getElementById('previewInitial');
        const previewStatus = document.getElementById('previewStatus');
        const previewPermissions = document.getElementById('previewPermissions');
        const previewId = document.getElementById('previewId');

        const roleName = document.getElementById('roleName').value || 'Nome do Papel';
        const roleDescription = document.getElementById('roleDescription').value || 'Descrição do papel';
        const roleIsActive = document.getElementById('roleIsActive').checked;

        // Atualizar preview
        if (previewName) previewName.textContent = roleName;
        if (previewDescription) previewDescription.textContent = roleDescription;
        if (previewInitial) previewInitial.textContent = roleName.charAt(0).toUpperCase();
        if (previewId) previewId.textContent = this.currentRoleId || 'Novo';

        // Atualizar status
        if (previewStatus) {
            if (roleIsActive) {
                previewStatus.className = 'badge badge-success badge-lg';
                previewStatus.innerHTML = '<i class="fas fa-check-circle"></i> Ativo';
            } else {
                previewStatus.className = 'badge badge-neutral badge-lg';
                previewStatus.innerHTML = '<i class="fas fa-times-circle"></i> Inativo';
            }
        }

        // Atualizar permissões selecionadas
        if (previewPermissions) {
            const selectedPermissions = Array.from(document.querySelectorAll('#permissionsCheckboxes input:checked'))
                .map(cb => cb.value);
            
            if (selectedPermissions.length > 0) {
                previewPermissions.innerHTML = selectedPermissions.map(permId => {
                    const permission = this.permissions.find(p => p.id === permId);
                    return permission ? `<span class="badge badge-outline badge-sm">${permission.name}</span>` : '';
                }).join('');
            } else {
                previewPermissions.innerHTML = '<span class="badge badge-outline badge-sm">Nenhuma permissão</span>';
            }
        }
    }

    setupEventListeners() {
        // Event listeners para preview em tempo real
        const previewFields = ['roleName', 'roleDescription', 'roleIsActive'];
        previewFields.forEach(fieldId => {
            const element = document.getElementById(fieldId);
            if (element) {
                const eventType = element.type === 'checkbox' ? 'change' : 'input';
                element.addEventListener(eventType, () => {
                    this.updateRolePreview();
                });
            }
        });

        // Event listeners para permissões
        document.addEventListener('change', (e) => {
            if (e.target.name === 'permissions') {
                this.updateRolePreview();
            }
        });
    }

    async saveRole() {
        try {
            const form = document.getElementById('roleForm');
            const permissionCheckboxes = document.querySelectorAll('#permissionsList input[type="checkbox"]:checked');
            
            const roleData = {
                name: document.getElementById('roleName').value.trim(),
                description: document.getElementById('roleDescription').value.trim(),
                is_active: document.getElementById('roleIsActive').checked,
                permissions: Array.from(permissionCheckboxes).map(cb => cb.value)
            };

            // Validar campos obrigatórios
            if (!roleData.name) {
                this.showToast('Nome do papel é obrigatório', 'warning');
                return;
            }

            const url = this.currentRoleId ? 
                `/api/roles/${this.currentRoleId}` : 
                '/api/roles';

            const response = await fetch(url, {
                method: this.currentRoleId ? 'PUT' : 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
                },
                body: JSON.stringify(roleData)
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || error.message || 'Erro ao salvar papel');
            }
            
            await this.loadRoles();
            
            // Fechar modal
            const modal = document.getElementById('roleModal');
            if (modal) {
                modal.close();
            }
            
            // Mostrar mensagem apropriada
            if (!this.currentRoleId) {
                this.showToast('Papel criado com sucesso!', 'success');
            } else {
                this.showToast('Papel atualizado com sucesso', 'success');
            }
        } catch (error) {
            console.error('Erro ao salvar papel:', error);
            this.showToast(error.message || 'Erro ao salvar papel', 'error');
        }
    }

    async deleteRole(roleId) {
        if (!confirm('Tem certeza que deseja excluir este papel?')) return;

        try {
            const response = await fetch(`/api/roles/${roleId}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
                }
            });
            
            if (!response.ok) {
                throw new Error('Erro ao excluir papel');
            }
            
            await this.loadRoles();
            this.showToast('Papel excluído com sucesso', 'success');
        } catch (error) {
            console.error('Erro ao excluir papel:', error);
            this.showToast(error.message || 'Erro ao excluir papel', 'error');
        }
    }

    editRole(roleId) {
        this.openRoleModal(roleId);
    }

    editPermission(permissionId) {
        // Implementar edição de permissão
        console.log('Editar permissão:', permissionId);
    }

    deletePermission(permissionId) {
        // Implementar exclusão de permissão
        console.log('Excluir permissão:', permissionId);
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
    window.rolesManager = new RolesManager();
}); 