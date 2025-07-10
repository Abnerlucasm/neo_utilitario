class RoleManager {
    constructor() {
        this.baseUrl = '/api/roles';
        this.selectedRole = null;
        this.systemResources = [
            {
                id: '550e8400-e29b-41d4-a716-446655440000',
                name: 'Página Inicial',
                description: 'Acesso à página inicial do sistema',
                icon: 'fas fa-home',
                path: '/pages/index.html',
                type: 'PAGE'
            },
            {
                id: '6ba7b810-9dad-11d1-80b4-00c04fd430c8',
                name: 'Glassfish',
                description: 'Gerenciamento de servidores Glassfish',
                icon: 'fas fa-server',
                path: '/pages/glassfish.html',
                type: 'PAGE'
            },
            {
                id: '6ba7b811-9dad-11d1-80b4-00c04fd430c8',
                name: 'NeoTrack',
                description: 'Monitoramento de sistemas',
                icon: 'fas fa-chart-line',
                path: '/pages/neotrack.html',
                type: 'PAGE'
            },
            {
                id: '6ba7b812-9dad-11d1-80b4-00c04fd430c8',
                name: 'Central de Aprendizado',
                description: 'Materiais e treinamentos',
                icon: 'fas fa-graduation-cap',
                path: '/pages/learning/learn.html',
                type: 'PAGE'
            },
            {
                id: '6ba7b813-9dad-11d1-80b4-00c04fd430c8',
                name: 'Gerenciamento de Usuários',
                description: 'Administração de usuários',
                icon: 'fas fa-users-cog',
                path: '/pages/admin/user-management.html',
                type: 'PAGE'
            },
            {
                id: '6ba7b814-9dad-11d1-80b4-00c04fd430c8',
                name: 'Papéis e Permissões',
                description: 'Gerenciamento de papéis',
                icon: 'fas fa-user-shield',
                path: '/pages/admin/roles.html',
                type: 'PAGE'
            },
            {
                id: '6ba7b815-9dad-11d1-80b4-00c04fd430c8',
                name: 'Configurações',
                description: 'Configurações do usuário',
                path: '/pages/user-settings.html',
                type: 'PAGE',
                icon: 'fas fa-cog'
            }
        ];
        
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.loadRoles();
    }

    setupEventListeners() {
        document.getElementById('createRoleForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleCreateRole(e);
        });

        document.getElementById('closeResourcesPanel').addEventListener('click', () => {
            document.getElementById('resourcesPanel').style.display = 'none';
        });
        
        // Adicionar listener para o formulário de edição
        const editRoleForm = document.getElementById('editRoleForm');
        if (editRoleForm) {
            editRoleForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.handleUpdateRole();
            });
        }
    }

    async loadRoles() {
        try {
            console.log('Carregando papéis...');
            
            // Verificar token de autenticação
            const token = localStorage.getItem('auth_token');
            if (!token) {
                console.error('Token de autenticação não encontrado');
                window.location.href = '/pages/login.html';
                return;
            }
            
            const response = await fetch(this.baseUrl, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            
            if (!response.ok) {
                // Verificar se o erro é 401 (Unauthorized) ou 403 (Forbidden)
                if (response.status === 401 || response.status === 403) {
                    console.error('Erro de autenticação:', response.status);
                    // Limpar o token e redirecionar para a página de login
                    localStorage.removeItem('auth_token');
                    window.location.href = '/pages/login.html';
                    return;
                }
                
                const error = await response.json();
                console.error('Resposta da API:', error);
                throw new Error('Erro ao carregar papéis');
            }
            
            const roles = await response.json();
            console.log('Papéis carregados:', roles);
            
            this.renderRoles(roles);
        } catch (error) {
            console.error('Erro ao carregar papéis:', error);
            this.showError('Falha ao carregar papéis');
        }
    }

    renderRoles(roles) {
        const rolesList = document.getElementById('rolesList');
        rolesList.innerHTML = '';

        roles.forEach(role => {
            const isAdmin = role.name.toLowerCase() === 'admin';
            const roleItem = document.createElement('div');
            roleItem.className = `role-item ${isAdmin ? 'admin' : ''}`;
            roleItem.dataset.id = role.id;
            roleItem.innerHTML = `
                    <span>${role.name}</span>
                <div>
                    <button class="btn btn-sm btn-outline-primary edit-role" data-id="${role.id}" title="Editar">
                        <i class="fas fa-edit"></i>
                    </button>
                    ${!isAdmin ? `
                        <button class="btn btn-sm btn-outline-danger delete-role" data-id="${role.id}" title="Excluir">
                            <i class="fas fa-trash"></i>
                        </button>
                    ` : ''}
                </div>
            `;
            
            roleItem.addEventListener('click', (e) => {
                // Ignorar cliques nos botões
                if (e.target.closest('button')) return;
                
                // Selecionar papel
                document.querySelectorAll('.role-item').forEach(item => {
                    item.classList.remove('selected');
                });
                roleItem.classList.add('selected');
                this.selectedRole = role.id;
                this.updateSelectedRole();
                this.loadRoleResources(role.id);
                document.getElementById('resourcesPanel').style.display = 'block';
            });
            
            // Adicionar event listeners para os botões
            roleItem.querySelector('.edit-role')?.addEventListener('click', () => {
                this.handleEditRole(role.name, role.id);
            });
            
            roleItem.querySelector('.delete-role')?.addEventListener('click', () => {
                this.handleDeleteRole(role.id);
            });
            
            rolesList.appendChild(roleItem);
        });
    }

    async handleEditRole(name, roleId) {
        console.log(`Editar papel: ${name} (${roleId})`);
        
        try {
            // Buscar dados completos do papel
            const response = await fetch(`${this.baseUrl}/${roleId}`, {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
                }
            });
            
            if (!response.ok) {
                throw new Error('Erro ao carregar dados do papel');
            }
            
            const role = await response.json();
            console.log('Papel carregado:', role);
            
            // Preencher o modal de edição
            document.getElementById('editRoleId').value = role.id;
            document.getElementById('editRoleName').value = role.name;
            document.getElementById('editRoleDescription').value = role.description || '';
            
            // Exibir o modal
            const editModal = new bootstrap.Modal(document.getElementById('editRoleModal'));
            editModal.show();
        } catch (error) {
            console.error('Erro ao preparar edição do papel:', error);
            this.showError('Erro ao carregar dados do papel');
        }
    }

    async handleUpdateRole() {
        const roleId = document.getElementById('editRoleId').value;
        const name = document.getElementById('editRoleName').value;
        const description = document.getElementById('editRoleDescription').value;
        
        if (!name) {
            this.showError('O nome do papel é obrigatório');
            return;
        }
        
        try {
            const response = await fetch(`${this.baseUrl}/${roleId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
                },
                body: JSON.stringify({ 
                    name, 
                    description
                })
            });

            if (!response.ok) {
                throw new Error('Erro ao atualizar papel');
            }
            
            // Fechar o modal
            const editModal = bootstrap.Modal.getInstance(document.getElementById('editRoleModal'));
            editModal.hide();
            
            // Recarregar a lista de papéis
            this.loadRoles();
            
            // Mostrar mensagem de sucesso
            this.showSuccess('Papel atualizado com sucesso');
        } catch (error) {
            console.error('Erro ao atualizar papel:', error);
            this.showError('Erro ao atualizar papel');
        }
    }

    updateSelectedRole() {
        const selectedRoleName = document.getElementById('selectedRoleName');
        const selectedRole = document.querySelector(`.role-item[data-id="${this.selectedRole}"]`);
        if (selectedRole) {
            selectedRoleName.textContent = selectedRole.querySelector('span').textContent;
        }
    }

    async loadRoleResources(roleId) {
        try {
            // Verificar token de autenticação
            const token = localStorage.getItem('auth_token');
            if (!token) {
                console.error('Token de autenticação não encontrado');
                window.location.href = '/pages/login.html';
                return;
            }
            
            const response = await fetch(`${this.baseUrl}/${roleId}/resources`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            
            if (!response.ok) {
                // Verificar se o erro é 401 (Unauthorized) ou 403 (Forbidden)
                if (response.status === 401 || response.status === 403) {
                    console.error('Erro de autenticação:', response.status);
                    // Limpar o token e redirecionar para a página de login
                    localStorage.removeItem('auth_token');
                    window.location.href = '/pages/login.html';
                    return;
                }
                
                throw new Error('Erro ao carregar recursos');
            }
            
            const data = await response.json();
            
            console.log('Recursos carregados:', data);
            
            // Renderizar recursos disponíveis
            this.renderResources('availableResources', data.availableResources, false);
            
            // Renderizar recursos atribuídos
            this.renderResources('assignedResources', data.assignedResources, true);
        } catch (error) {
            console.error('Erro ao carregar recursos:', error);
            this.showError('Falha ao carregar recursos');
        }
    }

    renderResources(containerId, resources, isAssigned) {
        const container = document.getElementById(containerId);
        container.innerHTML = '';

        if (!resources || resources.length === 0) {
            container.innerHTML = `<p class="text-muted">Nenhum recurso ${isAssigned ? 'atribuído' : 'disponível'}</p>`;
            return;
        }

        resources.forEach(resource => {
            const resourceItem = document.createElement('div');
            resourceItem.className = 'resource-item';
            resourceItem.dataset.id = resource.id;
            
            // Determinar o ícone com base no tipo ou usar o ícone do recurso
            const icon = resource.icon || 'fas fa-link';
            
            resourceItem.innerHTML = `
                <div class="d-flex justify-content-between align-items-center">
                    <div>
                        <span class="resource-icon"><i class="${icon}"></i></span>
                        <span>${resource.name}</span>
                        <div class="path">${resource.path}</div>
                    </div>
                    <button class="btn btn-sm ${isAssigned ? 'btn-danger' : 'btn-success'}" title="${isAssigned ? 'Remover' : 'Adicionar'}">
                        <i class="fas ${isAssigned ? 'fa-minus' : 'fa-plus'}"></i>
                    </button>
                </div>
            `;
            
            // Adicionar event listener para o botão
            resourceItem.querySelector('button').addEventListener('click', () => {
                this.handleResourceToggle(resource.id, !isAssigned);
            });
            
            container.appendChild(resourceItem);
        });
    }

    async handleResourceToggle(resourceId, isAssigning) {
        if (!this.selectedRole) return;
        
        try {
            const method = isAssigning ? 'POST' : 'DELETE';
            const url = `${this.baseUrl}/${this.selectedRole}/resources/${resourceId}`;
            
            console.log(`Enviando requisição ${method} para ${url}`);
            
            // Se estiver adicionando, incluir dados do recurso
            let options = {
                method,
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
                }
            };
            
            if (isAssigning) {
                // Encontrar o recurso nos recursos do sistema
                const resource = this.systemResources.find(r => r.id === resourceId);
                if (resource) {
                    options.headers['Content-Type'] = 'application/json';
                    options.body = JSON.stringify({
                        name: resource.name,
                        path: resource.path,
                        description: resource.description,
                        type: resource.type,
                        icon: resource.icon
                    });
                }
            }
            
            const response = await fetch(url, options);
            const result = await response.json();
            
            console.log('Resposta do servidor:', result);
            
            if (!response.ok) {
                throw new Error(result.error || 'Erro ao adicionar recurso');
            }
            
            // Recarregar recursos para atualizar a interface
            this.loadRoleResources(this.selectedRole);
            
            // Mostrar mensagem de sucesso
            this.showSuccess(`Recurso ${isAssigning ? 'adicionado' : 'removido'} com sucesso`);
        } catch (error) {
            console.error('Erro ao atualizar recursos:', error);
            this.showError(`Erro ao ${isAssigning ? 'adicionar' : 'remover'} recurso`);
        }
    }

    async handleCreateRole(event) {
        event.preventDefault();
        const form = event.target;
        const formData = new FormData(form);
        
        try {
            const response = await fetch(this.baseUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
                },
                body: JSON.stringify({
                    name: formData.get('name'),
                    description: formData.get('description')
                })
            });

            if (!response.ok) {
                throw new Error('Erro ao criar papel');
            }
            
            // Limpar formulário
            form.reset();
            
            // Fechar modal
            const modal = bootstrap.Modal.getInstance(document.getElementById('createRoleModal'));
            modal.hide();
            
            // Recarregar papéis
            this.loadRoles();
            
            // Mostrar mensagem de sucesso
            this.showSuccess('Papel criado com sucesso');
        } catch (error) {
            console.error('Erro ao criar papel:', error);
            this.showError('Falha ao criar papel');
        }
    }

    async handleDeleteRole(roleId) {
        if (!confirm('Tem certeza que deseja excluir este papel?')) {
            return;
        }
        
        try {
            const response = await fetch(`${this.baseUrl}/${roleId}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
                }
            });
            
            if (!response.ok) {
                throw new Error('Erro ao excluir papel');
            }
            
            // Recarregar papéis
            this.loadRoles();
            
            // Esconder painel de recursos se o papel excluído estava selecionado
            if (this.selectedRole === roleId) {
                document.getElementById('resourcesPanel').style.display = 'none';
                this.selectedRole = null;
            }
            
            // Mostrar mensagem de sucesso
            this.showSuccess('Papel excluído com sucesso');
        } catch (error) {
            console.error('Erro ao excluir papel:', error);
            this.showError('Falha ao excluir papel');
        }
    }

    showError(message) {
        // Criar notificação de erro
        const notification = document.createElement('div');
        notification.className = 'alert alert-danger alert-dismissible fade show';
        notification.innerHTML = `
            ${message}
            <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
        `;
        
        // Adicionar ao container de notificações
        const container = document.getElementById('notifications') || document.body;
        container.appendChild(notification);
        
        // Auto-remover após 5 segundos
        setTimeout(() => {
            notification.remove();
        }, 5000);
    }

    showSuccess(message) {
        // Criar notificação de sucesso
        const notification = document.createElement('div');
        notification.className = 'alert alert-success alert-dismissible fade show';
        notification.innerHTML = `
            ${message}
            <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
        `;
        
        // Adicionar ao container de notificações
        const container = document.getElementById('notifications') || document.body;
        container.appendChild(notification);
        
        // Auto-remover após 5 segundos
        setTimeout(() => {
            notification.remove();
        }, 5000);
    }
}

// Inicializar o gerenciador de papéis
const roleManager = new RoleManager(); 