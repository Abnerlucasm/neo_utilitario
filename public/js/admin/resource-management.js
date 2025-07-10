/**
 * Classe para gerenciamento de recursos na interface de administração
 */
class ResourceManager {
    constructor() {
        // Elementos da interface
        this.resourcesList = document.getElementById('resources-list');
        this.resourceForm = document.getElementById('resource-form');
        this.searchInput = document.getElementById('resource-search');
        this.typeFilter = document.getElementById('resource-type-filter');
        this.addResourceBtn = document.getElementById('add-resource-btn');
        this.cancelBtn = document.getElementById('cancel-resource-btn');
        this.saveResourceBtn = document.getElementById('save-resource-btn');
        this.deleteResourceBtn = document.getElementById('delete-resource-btn');
        this.resourceModal = new bootstrap.Modal(document.getElementById('resource-modal'));

        // Estado
        this.resources = [];
        this.roles = [];
        this.currentResource = null;
        this.isEditing = false;
        this.isLoading = false;
    }

    /**
     * Inicializa o gerenciador de recursos
     */
    async init() {
        try {
            // Carregar dados iniciais
            await this.loadResources();
            await this.loadRoles();

            // Configurar eventos
            this.setupEventListeners();
            
            // Mostrar visualização em árvore por padrão
            this.renderResourceTree();
        } catch (error) {
            console.error('Erro ao inicializar o gerenciador de recursos:', error);
            this.showToast('Erro ao carregar recursos. Consulte o console para mais detalhes.', 'error');
        }
    }

    /**
     * Configura os listeners de eventos
     */
    setupEventListeners() {
        // Botão para adicionar novo recurso
        this.addResourceBtn.addEventListener('click', () => this.openResourceForm());

        // Botão para cancelar formulário
        this.cancelBtn.addEventListener('click', () => this.resourceModal.hide());

        // Botão para salvar recurso
        this.saveResourceBtn.addEventListener('click', () => this.saveResource());

        // Botão para excluir recurso
        this.deleteResourceBtn.addEventListener('click', () => this.deleteResource());

        // Campo de pesquisa
        this.searchInput.addEventListener('input', debounce(() => {
            this.searchResources(this.searchInput.value);
        }, 300));

        // Filtro de tipo
        this.typeFilter.addEventListener('change', () => {
            this.searchResources(this.searchInput.value);
        });

        // Alternar entre visualizações (lista/árvore)
        document.getElementById('view-list').addEventListener('click', () => {
            document.getElementById('view-tree').classList.remove('active');
            document.getElementById('view-list').classList.add('active');
            this.renderResourcesList();
        });

        document.getElementById('view-tree').addEventListener('click', () => {
            document.getElementById('view-list').classList.remove('active');
            document.getElementById('view-tree').classList.add('active');
            this.renderResourceTree();
        });

        // Formulário
        document.getElementById('resource-type').addEventListener('change', (e) => {
            // Mostrar/esconder o campo de ícone apenas para tipos específicos
            const iconField = document.getElementById('resource-icon-group');
            if (e.target.value === 'menu' || e.target.value === 'item') {
                iconField.classList.remove('d-none');
            } else {
                iconField.classList.add('d-none');
            }
        });
    }

    /**
     * Carrega a lista de recursos do servidor
     */
    async loadResources() {
        try {
            this.isLoading = true;
            this.updateLoadingState();

            const response = await fetch('/api/v1/resources');
            const data = await response.json();

            if (data.success) {
                this.resources = data.data;
            } else {
                throw new Error(data.message || 'Erro ao carregar recursos');
            }
        } catch (error) {
            console.error('Erro ao carregar recursos:', error);
            this.showToast('Erro ao carregar recursos do servidor', 'error');
        } finally {
            this.isLoading = false;
            this.updateLoadingState();
        }
    }

    /**
     * Carrega a árvore de recursos do servidor
     */
    async loadResourceTree() {
        try {
            this.isLoading = true;
            this.updateLoadingState();

            const response = await fetch('/api/v1/resources/tree');
            const data = await response.json();

            if (data.success) {
                return data.data;
            } else {
                throw new Error(data.message || 'Erro ao carregar árvore de recursos');
            }
        } catch (error) {
            console.error('Erro ao carregar árvore de recursos:', error);
            this.showToast('Erro ao carregar árvore de recursos do servidor', 'error');
            return [];
        } finally {
            this.isLoading = false;
            this.updateLoadingState();
        }
    }

    /**
     * Carrega a lista de papéis do servidor
     */
    async loadRoles() {
        try {
            const response = await fetch('/api/v1/roles');
            const data = await response.json();

            if (data.success) {
                this.roles = data.data;
                this.updateRoleCheckboxes();
            } else {
                throw new Error(data.message || 'Erro ao carregar papéis');
            }
        } catch (error) {
            console.error('Erro ao carregar papéis:', error);
            this.showToast('Erro ao carregar papéis do servidor', 'error');
        }
    }

    /**
     * Renderiza a lista de recursos
     */
    renderResourcesList() {
        if (!this.resourcesList) return;
        
        this.resourcesList.innerHTML = '';
        if (this.resources.length === 0) {
            this.resourcesList.innerHTML = `
                <div class="text-center py-5">
                    <p class="text-muted">Nenhum recurso encontrado</p>
                </div>
            `;
            return;
        }

        // Criar tabela
        const table = document.createElement('table');
        table.className = 'table table-hover';
        table.innerHTML = `
            <thead>
                <tr>
                    <th>Nome</th>
                    <th>Caminho</th>
                    <th>Tipo</th>
                    <th>Status</th>
                    <th>Ações</th>
                </tr>
            </thead>
            <tbody></tbody>
        `;

        const tbody = table.querySelector('tbody');

        // Adicionar recursos à tabela
        this.resources.forEach(resource => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>
                    <div class="d-flex align-items-center">
                        ${resource.icon ? `<i class="${resource.icon} me-2"></i>` : ''}
                        <span>${this.escapeHtml(resource.name)}</span>
                    </div>
                </td>
                <td><code>${this.escapeHtml(resource.path)}</code></td>
                <td><span class="badge bg-secondary">${this.formatResourceType(resource.type)}</span></td>
                <td>
                    ${resource.is_active 
                        ? '<span class="badge bg-success">Ativo</span>' 
                        : '<span class="badge bg-danger">Inativo</span>'}
                    ${resource.is_system 
                        ? '<span class="badge bg-warning ms-1">Sistema</span>' 
                        : ''}
                </td>
                <td>
                    <button class="btn btn-sm btn-primary edit-btn" data-id="${resource.id}">
                        <i class="fas fa-edit"></i>
                    </button>
                </td>
            `;
            
            tbody.appendChild(row);
            
            // Adicionar evento para edição
            row.querySelector('.edit-btn').addEventListener('click', () => {
                this.editResource(resource.id);
            });
        });

        this.resourcesList.appendChild(table);
    }

    /**
     * Renderiza a visualização em árvore dos recursos
     */
    async renderResourceTree() {
        if (!this.resourcesList) return;
        
        this.resourcesList.innerHTML = '<div class="text-center py-3"><div class="spinner-border" role="status"></div></div>';
        
        try {
            const treeData = await this.loadResourceTree();
            
            if (treeData.length === 0) {
                this.resourcesList.innerHTML = `
                    <div class="text-center py-5">
                        <p class="text-muted">Nenhum recurso encontrado</p>
                    </div>
                `;
                return;
            }

            this.resourcesList.innerHTML = '';
            const treeContainer = document.createElement('div');
            treeContainer.className = 'resource-tree px-3 py-2';
            
            const ul = this.createResourceTreeUl(treeData);
            treeContainer.appendChild(ul);
            
            this.resourcesList.appendChild(treeContainer);
        } catch (error) {
            console.error('Erro ao renderizar árvore de recursos:', error);
            this.resourcesList.innerHTML = `
                <div class="alert alert-danger">
                    Erro ao carregar a árvore de recursos. Por favor, tente novamente.
                </div>
            `;
        }
    }

    /**
     * Cria um elemento UL para a árvore de recursos
     */
    createResourceTreeUl(resources) {
        const ul = document.createElement('ul');
        ul.className = 'tree-list';
        
        resources.forEach(resource => {
            const li = document.createElement('li');
            li.className = 'tree-item';
            
            // Criar conteúdo do item
            const itemContent = document.createElement('div');
            itemContent.className = 'tree-item-content d-flex align-items-center';
            
            // Adicionar ícone se existir
            if (resource.icon) {
                const icon = document.createElement('i');
                icon.className = `${resource.icon} me-2`;
                itemContent.appendChild(icon);
            }
            
            // Nome do recurso
            const nameSpan = document.createElement('span');
            nameSpan.textContent = resource.name;
            nameSpan.className = 'me-2';
            itemContent.appendChild(nameSpan);
            
            // Badges para tipo e status
            const typeBadge = document.createElement('span');
            typeBadge.className = 'badge bg-secondary me-1';
            typeBadge.textContent = this.formatResourceType(resource.type);
            itemContent.appendChild(typeBadge);
            
            if (!resource.is_active) {
                const statusBadge = document.createElement('span');
                statusBadge.className = 'badge bg-danger me-1';
                statusBadge.textContent = 'Inativo';
                itemContent.appendChild(statusBadge);
            }
            
            if (resource.is_system) {
                const systemBadge = document.createElement('span');
                systemBadge.className = 'badge bg-warning me-1';
                systemBadge.textContent = 'Sistema';
                itemContent.appendChild(systemBadge);
            }
            
            // Botão de edição
            const editBtn = document.createElement('button');
            editBtn.className = 'btn btn-sm btn-primary ms-auto';
            editBtn.innerHTML = '<i class="fas fa-edit"></i>';
            editBtn.addEventListener('click', () => this.editResource(resource.id));
            itemContent.appendChild(editBtn);
            
            li.appendChild(itemContent);
            
            // Adicionar filhos se existirem
            if (resource.children && resource.children.length > 0) {
                const childUl = this.createResourceTreeUl(resource.children);
                li.appendChild(childUl);
            }
            
            ul.appendChild(li);
        });
        
        return ul;
    }

    /**
     * Atualiza as checkboxes de papéis no formulário
     */
    updateRoleCheckboxes() {
        const container = document.getElementById('roles-container');
        if (!container || !this.roles.length) return;

        container.innerHTML = '';
        
        this.roles.forEach(role => {
            const div = document.createElement('div');
            div.className = 'form-check';
            div.innerHTML = `
                <input class="form-check-input role-checkbox" type="checkbox" 
                    id="role-${role.id}" value="${role.id}" name="roles">
                <label class="form-check-label" for="role-${role.id}">
                    ${this.escapeHtml(role.name)}
                </label>
            `;
            container.appendChild(div);
        });
    }

    /**
     * Preenche o formulário com os dados do recurso para edição
     */
    async editResource(id) {
        try {
            this.isLoading = true;
            this.updateLoadingState();
            
            const response = await fetch(`/api/v1/resources/${id}`);
            const data = await response.json();
            
            if (!data.success) {
                throw new Error(data.message || 'Erro ao carregar recurso');
            }
            
            this.currentResource = data.data;
            this.isEditing = true;
            
            // Preencher o formulário
            document.getElementById('resource-id').value = this.currentResource.id;
            document.getElementById('resource-name').value = this.currentResource.name;
            document.getElementById('resource-path').value = this.currentResource.path;
            document.getElementById('resource-description').value = this.currentResource.description || '';
            document.getElementById('resource-type').value = this.currentResource.type;
            document.getElementById('resource-icon').value = this.currentResource.icon || '';
            document.getElementById('resource-order').value = this.currentResource.order || 0;
            document.getElementById('resource-parent').value = this.currentResource.parent_id || '';
            document.getElementById('resource-active').checked = this.currentResource.is_active;
            
            // Atualizar o campo de ícone conforme o tipo
            const iconField = document.getElementById('resource-icon-group');
            if (this.currentResource.type === 'menu' || this.currentResource.type === 'item') {
                iconField.classList.remove('d-none');
            } else {
                iconField.classList.add('d-none');
            }
            
            // Marcar os papéis associados
            document.querySelectorAll('.role-checkbox').forEach(checkbox => {
                checkbox.checked = false;
            });
            
            if (this.currentResource.roles && this.currentResource.roles.length > 0) {
                this.currentResource.roles.forEach(role => {
                    const checkbox = document.getElementById(`role-${role.id}`);
                    if (checkbox) checkbox.checked = true;
                });
            }
            
            // Atualizar título do modal e estado dos botões
            document.getElementById('resource-modal-title').textContent = 'Editar Recurso';
            this.deleteResourceBtn.classList.remove('d-none');
            
            // Se for um recurso do sistema, desabilitar alguns campos
            const isSystem = this.currentResource.is_system;
            document.getElementById('resource-name').disabled = isSystem;
            document.getElementById('resource-path').disabled = isSystem;
            document.getElementById('resource-type').disabled = isSystem;
            
            if (isSystem) {
                this.deleteResourceBtn.disabled = true;
                this.deleteResourceBtn.title = 'Recursos do sistema não podem ser excluídos';
            } else {
                this.deleteResourceBtn.disabled = false;
                this.deleteResourceBtn.title = 'Excluir recurso';
            }
            
            // Abrir o modal
            this.resourceModal.show();
            
        } catch (error) {
            console.error('Erro ao editar recurso:', error);
            this.showToast('Erro ao carregar dados do recurso', 'error');
        } finally {
            this.isLoading = false;
            this.updateLoadingState();
        }
    }

    /**
     * Abre o formulário para criação de um novo recurso
     */
    openResourceForm() {
        this.isEditing = false;
        this.currentResource = null;
        
        // Limpar formulário
        this.resourceForm.reset();
        document.getElementById('resource-id').value = '';
        
        // Mostrar campo de ícone apenas para tipos específicos
        const iconField = document.getElementById('resource-icon-group');
        const type = document.getElementById('resource-type').value;
        if (type === 'menu' || type === 'item') {
            iconField.classList.remove('d-none');
        } else {
            iconField.classList.add('d-none');
        }
        
        // Desmarcar todas as checkboxes de papéis
        document.querySelectorAll('.role-checkbox').forEach(checkbox => {
            checkbox.checked = false;
        });
        
        // Atualizar título do modal e botões
        document.getElementById('resource-modal-title').textContent = 'Novo Recurso';
        this.deleteResourceBtn.classList.add('d-none');
        
        // Habilitar todos os campos (novo recurso não é do sistema)
        document.getElementById('resource-name').disabled = false;
        document.getElementById('resource-path').disabled = false;
        document.getElementById('resource-type').disabled = false;
        
        // Abrir o modal
        this.resourceModal.show();
    }

    /**
     * Salva um recurso (cria ou atualiza)
     */
    async saveResource() {
        try {
            // Validar o formulário
            if (!this.validateResourceForm()) {
                return;
            }
            
            this.isLoading = true;
            this.updateLoadingState();
            
            // Coletar dados do formulário
            const formData = {
                name: document.getElementById('resource-name').value,
                path: document.getElementById('resource-path').value,
                description: document.getElementById('resource-description').value,
                type: document.getElementById('resource-type').value,
                icon: document.getElementById('resource-icon').value,
                order: parseInt(document.getElementById('resource-order').value, 10) || 0,
                is_active: document.getElementById('resource-active').checked,
                parent_id: document.getElementById('resource-parent').value || null,
                roles: Array.from(document.querySelectorAll('.role-checkbox:checked')).map(cb => cb.value)
            };
            
            let url = '/api/v1/resources';
            let method = 'POST';
            
            // Se estiver editando, atualizar ao invés de criar
            if (this.isEditing && this.currentResource) {
                url = `/api/v1/resources/${this.currentResource.id}`;
                method = 'PUT';
            }
            
            const response = await fetch(url, {
                method: method,
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(formData),
            });
            
            const data = await response.json();
            
            if (!data.success) {
                throw new Error(data.message || 'Erro ao salvar recurso');
            }
            
            // Atualizar a lista de recursos
            await this.loadResources();
            
            // Mostrar mensagem de sucesso
            this.showToast(
                this.isEditing ? 'Recurso atualizado com sucesso' : 'Recurso criado com sucesso', 
                'success'
            );
            
            // Fechar o modal
            this.resourceModal.hide();
            
            // Atualizar a visualização atual
            document.getElementById('view-tree').classList.contains('active') 
                ? this.renderResourceTree() 
                : this.renderResourcesList();
                
        } catch (error) {
            console.error('Erro ao salvar recurso:', error);
            this.showToast(`Erro ao salvar recurso: ${error.message}`, 'error');
        } finally {
            this.isLoading = false;
            this.updateLoadingState();
        }
    }

    /**
     * Valida o formulário de recursos
     */
    validateResourceForm() {
        const name = document.getElementById('resource-name').value;
        const path = document.getElementById('resource-path').value;
        const type = document.getElementById('resource-type').value;
        
        if (!name || !name.trim()) {
            this.showToast('Nome é obrigatório', 'error');
            return false;
        }
        
        if (!path || !path.trim()) {
            this.showToast('Caminho é obrigatório', 'error');
            return false;
        }
        
        if (!type) {
            this.showToast('Tipo é obrigatório', 'error');
            return false;
        }
        
        return true;
    }

    /**
     * Exclui um recurso
     */
    async deleteResource() {
        if (!this.currentResource) return;
        
        // Confirmar exclusão
        if (!confirm(`Tem certeza que deseja excluir o recurso "${this.currentResource.name}"?`)) {
            return;
        }
        
        try {
            this.isLoading = true;
            this.updateLoadingState();
            
            const response = await fetch(`/api/v1/resources/${this.currentResource.id}`, {
                method: 'DELETE',
            });
            
            const data = await response.json();
            
            if (!data.success) {
                throw new Error(data.message || 'Erro ao excluir recurso');
            }
            
            // Atualizar a lista de recursos
            await this.loadResources();
            
            // Mostrar mensagem de sucesso
            this.showToast('Recurso excluído com sucesso', 'success');
            
            // Fechar o modal
            this.resourceModal.hide();
            
            // Atualizar a visualização atual
            document.getElementById('view-tree').classList.contains('active') 
                ? this.renderResourceTree() 
                : this.renderResourcesList();
                
        } catch (error) {
            console.error('Erro ao excluir recurso:', error);
            this.showToast(`Erro ao excluir recurso: ${error.message}`, 'error');
        } finally {
            this.isLoading = false;
            this.updateLoadingState();
        }
    }

    /**
     * Pesquisa recursos com base no termo e filtro de tipo
     */
    async searchResources(term) {
        try {
            this.isLoading = true;
            this.updateLoadingState();
            
            const typeFilter = this.typeFilter.value;
            let url = '/api/v1/resources';
            
            if (term || typeFilter) {
                // Se tiver termo ou filtro, usa a rota de pesquisa
                url = '/api/v1/resources/search?';
                
                if (term) url += `term=${encodeURIComponent(term)}`;
                if (typeFilter) {
                    url += term ? `&type=${encodeURIComponent(typeFilter)}` : `type=${encodeURIComponent(typeFilter)}`;
                }
            }
            
            const response = await fetch(url);
            const data = await response.json();
            
            if (!data.success) {
                throw new Error(data.message || 'Erro ao pesquisar recursos');
            }
            
            this.resources = data.data;
            
            // Renderizar apenas na visualização de lista, a árvore tem sua própria lógica
            if (document.getElementById('view-list').classList.contains('active')) {
                this.renderResourcesList();
            }
            
        } catch (error) {
            console.error('Erro ao pesquisar recursos:', error);
            this.showToast('Erro ao pesquisar recursos', 'error');
        } finally {
            this.isLoading = false;
            this.updateLoadingState();
        }
    }

    /**
     * Atualiza o estado de carregamento na interface
     */
    updateLoadingState() {
        document.querySelectorAll('button').forEach(button => {
            button.disabled = this.isLoading;
        });
        
        const loader = document.getElementById('loading-indicator');
        if (loader) {
            loader.style.display = this.isLoading ? 'block' : 'none';
        }
    }

    /**
     * Mostra uma notificação toast
     */
    showToast(message, type = 'info') {
        const toastContainer = document.getElementById('toast-container');
        if (!toastContainer) return;
        
        const toast = document.createElement('div');
        toast.className = `toast align-items-center text-white bg-${type === 'error' ? 'danger' : type} border-0`;
        toast.setAttribute('role', 'alert');
        toast.setAttribute('aria-live', 'assertive');
        toast.setAttribute('aria-atomic', 'true');
        
        toast.innerHTML = `
            <div class="d-flex">
                <div class="toast-body">
                    ${this.escapeHtml(message)}
                </div>
                <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast" aria-label="Fechar"></button>
            </div>
        `;
        
        toastContainer.appendChild(toast);
        
        const bsToast = new bootstrap.Toast(toast, {
            autohide: true,
            delay: 5000
        });
        
        bsToast.show();
        
        // Remover toast do DOM depois que for escondido
        toast.addEventListener('hidden.bs.toast', () => {
            toast.remove();
        });
    }

    /**
     * Escapa caracteres HTML para prevenção de XSS
     */
    escapeHtml(text) {
        if (!text) return '';
        
        const map = {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#039;'
        };
        
        return text.toString().replace(/[&<>"']/g, m => map[m]);
    }

    /**
     * Formata o tipo de recurso para exibição
     */
    formatResourceType(type) {
        const typeMap = {
            'menu': 'Menu',
            'item': 'Item',
            'page': 'Página',
            'api': 'API',
            'function': 'Função'
        };
        
        return typeMap[type] || type;
    }
}

/**
 * Função de debounce para evitar múltiplas chamadas de pesquisa
 */
function debounce(func, wait) {
    let timeout;
    return function(...args) {
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(this, args), wait);
    };
}

// Inicializar quando o DOM estiver pronto
document.addEventListener('DOMContentLoaded', () => {
    const resourceManager = new ResourceManager();
    resourceManager.init();
}); 