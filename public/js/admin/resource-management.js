/**
 * Gerenciador de Recursos do Sistema
 * Interface moderna para gerenciar recursos e permissões
 */
class ResourceManager {
    constructor() {
        this.resources = [];
        this.roles = [];
        this.currentResourceId = null;
        this.filters = {
            search: '',
            type: '',
            status: '',
            showInactive: false
        };
        this.icons = [
            'fas fa-link', 'fas fa-file', 'fas fa-folder', 'fas fa-home',
            'fas fa-users', 'fas fa-user', 'fas fa-cog', 'fas fa-tools',
            'fas fa-chart-bar', 'fas fa-chart-line', 'fas fa-chart-pie',
            'fas fa-database', 'fas fa-server', 'fas fa-network-wired',
            'fas fa-shield-alt', 'fas fa-lock', 'fas fa-key', 'fas fa-eye',
            'fas fa-edit', 'fas fa-trash', 'fas fa-plus', 'fas fa-minus',
            'fas fa-check', 'fas fa-times', 'fas fa-exclamation-triangle',
            'fas fa-info-circle', 'fas fa-question-circle', 'fas fa-heart',
            'fas fa-star', 'fas fa-bookmark', 'fas fa-calendar', 'fas fa-clock',
            'fas fa-map-marker-alt', 'fas fa-phone', 'fas fa-envelope',
            'fas fa-download', 'fas fa-upload', 'fas fa-sync', 'fas fa-redo',
            'fas fa-undo', 'fas fa-save', 'fas fa-print', 'fas fa-search',
            'fas fa-filter', 'fas fa-sort', 'fas fa-list', 'fas fa-th',
            'fas fa-bars', 'fas fa-ellipsis-h', 'fas fa-ellipsis-v',
            'fas fa-chevron-left', 'fas fa-chevron-right', 'fas fa-chevron-up',
            'fas fa-chevron-down', 'fas fa-angle-left', 'fas fa-angle-right',
            'fas fa-angle-up', 'fas fa-angle-down', 'fas fa-caret-left',
            'fas fa-caret-right', 'fas fa-caret-up', 'fas fa-caret-down'
        ];
        this.init();
    }

    async init() {
        try {
            await Promise.all([
                this.loadResources(),
                this.loadRoles()
            ]);
            this.setupEventListeners();
            this.updateStats();
            this.renderResourceTree();
        } catch (error) {
            console.error('Erro ao inicializar gerenciador de recursos:', error);
            this.showToast('Erro ao carregar dados', 'error');
        }
    }

    async loadResources() {
        try {
            const response = await fetch('/api/resources?include_roles=true', {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
                }
            });

            if (!response.ok) {
                throw new Error(`Erro ao carregar recursos (${response.status})`);
            }

            const data = await response.json();
            this.resources = data.data || [];
            this.renderResources();
        } catch (error) {
            console.error('Erro ao carregar recursos:', error);
            this.showToast('Erro ao carregar recursos', 'error');
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
                throw new Error(`Erro ao carregar papéis (${response.status})`);
            }

            const data = await response.json();
            this.roles = data.data || [];
            this.renderRolesCheckboxes();
        } catch (error) {
            console.error('Erro ao carregar papéis:', error);
            this.showToast('Erro ao carregar papéis', 'error');
        }
    }

    setupEventListeners() {
        // Filtros
        document.getElementById('resourceSearch')?.addEventListener('input', (e) => {
            this.filters.search = e.target.value;
            this.applyFilters();
        });

        document.getElementById('resourceTypeFilter')?.addEventListener('change', (e) => {
            this.filters.type = e.target.value;
            this.applyFilters();
        });

        document.getElementById('resourceStatusFilter')?.addEventListener('change', (e) => {
            this.filters.status = e.target.value;
            this.applyFilters();
        });

        document.getElementById('showInactiveResources')?.addEventListener('change', (e) => {
            this.filters.showInactive = e.target.checked;
            this.applyFilters();
        });

        // Formulário
        document.getElementById('resourceForm')?.addEventListener('input', () => {
            this.updateResourcePreview();
        });

        // Seletor de ícones
        document.getElementById('iconSelectorBtn')?.addEventListener('click', () => {
            this.toggleIconSelector();
        });

        // Modal
        document.getElementById('resourceModal')?.addEventListener('close', () => {
            this.resetForm();
        });
    }

    applyFilters() {
        let filteredResources = [...this.resources];

        // Filtro de busca
        if (this.filters.search) {
            const searchTerm = this.filters.search.toLowerCase();
            filteredResources = filteredResources.filter(resource =>
                resource.name.toLowerCase().includes(searchTerm) ||
                resource.path.toLowerCase().includes(searchTerm) ||
                (resource.description && resource.description.toLowerCase().includes(searchTerm))
            );
        }

        // Filtro de tipo
        if (this.filters.type) {
            filteredResources = filteredResources.filter(resource =>
                resource.type === this.filters.type
            );
        }

        // Filtro de status
        if (this.filters.status !== '') {
            const isActive = this.filters.status === 'true';
            filteredResources = filteredResources.filter(resource =>
                resource.is_active === isActive
            );
        }

        // Filtro de inativos
        if (!this.filters.showInactive) {
            filteredResources = filteredResources.filter(resource => resource.is_active);
        }

        this.renderResources(filteredResources);
        this.updateStats(filteredResources);
    }

    renderResources(resources = null) {
        const container = document.getElementById('resourcesList');
        if (!container) return;

        const resourcesToRender = resources || this.resources;

        if (resourcesToRender.length === 0) {
            container.innerHTML = `
                <div class="no-resources-container">
                    <i class="fas fa-file-alt"></i>
                    <h3 class="text-xl font-bold mb-2">Nenhum recurso encontrado</h3>
                    <p class="text-base-content/70 mb-4">Nenhum recurso corresponde aos critérios de busca.</p>
                    <button class="btn btn-primary" onclick="resourceManager.openResourceModal()">
                        <i class="fas fa-plus"></i> Adicionar Recurso
                    </button>
                </div>
            `;
            return;
        }

        container.innerHTML = resourcesToRender.map(resource => this.renderResourceCard(resource)).join('');
        
        // Atualizar contador
        const countElement = document.getElementById('resourcesCount');
        if (countElement) {
            countElement.textContent = resourcesToRender.length;
        }
    }

    renderResourceCard(resource) {
        const typeClass = `type-${resource.type.toLowerCase()}`;
        const statusClass = resource.is_active ? 'badge-success' : 'badge-error';
        const statusText = resource.is_active ? 'Ativo' : 'Inativo';
        
        const rolesText = resource.roles && resource.roles.length > 0 
            ? resource.roles.map(role => role.name).join(', ')
            : 'Nenhum papel';

        return `
            <div class="card resource-card bg-base-100 shadow-lg hover:shadow-xl transition-all duration-200 cursor-pointer"
                 onclick="resourceManager.selectResource('${resource.id}')">
                <div class="card-body">
                    <div class="flex items-start justify-between">
                        <div class="flex items-start gap-4 flex-1">
                            <div class="resource-icon bg-primary/10 text-primary">
                                <i class="${resource.icon || 'fas fa-link'}"></i>
                            </div>
                            <div class="flex-1">
                                <div class="flex items-center gap-2 mb-2">
                                    <h3 class="font-bold text-lg">${resource.name}</h3>
                                    <span class="badge ${typeClass} resource-type-badge">${resource.type}</span>
                                    <span class="badge ${statusClass} badge-sm">${statusText}</span>
                                    ${resource.is_admin_only ? '<span class="badge badge-error badge-sm">Admin</span>' : ''}
                                </div>
                                <div class="resource-path mb-2">${resource.path}</div>
                                ${resource.description ? `<div class="resource-description">${resource.description}</div>` : ''}
                                <div class="text-sm text-base-content/70 mt-2">
                                    <i class="fas fa-users mr-1"></i> ${rolesText}
                                </div>
                            </div>
                        </div>
                        <div class="flex gap-2">
                            <button class="btn btn-ghost btn-sm" 
                                    onclick="event.stopPropagation(); resourceManager.editResource('${resource.id}')">
                                <i class="fas fa-edit"></i>
                            </button>
                            <button class="btn btn-ghost btn-sm text-error" 
                                    onclick="event.stopPropagation(); resourceManager.deleteResource('${resource.id}')">
                                <i class="fas fa-trash"></i>
                            </button>
                        </div>
                    </div>
                </div>
                </div>
            `;
        }

    renderResourceTree() {
        const container = document.getElementById('resourceTree');
        if (!container) return;

        const rootResources = this.resources.filter(r => !r.parent_id);
        
        if (rootResources.length === 0) {
            container.innerHTML = '<p class="text-base-content/70 text-center">Nenhum recurso encontrado</p>';
            return;
        }

        const treeHtml = rootResources.map(resource => this.renderTreeNode(resource)).join('');
        container.innerHTML = treeHtml;
    }

    renderTreeNode(resource, level = 0) {
        const children = this.resources.filter(r => r.parent_id === resource.id);
        const hasChildren = children.length > 0;
        const indent = level * 20;

        let html = `
            <div class="resource-tree-item" style="margin-left: ${indent}px;">
                <div class="flex items-center gap-2 py-1">
                    <i class="fas fa-${hasChildren ? 'folder' : 'file'} text-primary"></i>
                    <span class="font-medium">${resource.name}</span>
                    <span class="badge badge-sm ${resource.is_active ? 'badge-success' : 'badge-error'}">${resource.is_active ? 'Ativo' : 'Inativo'}</span>
                </div>
            </div>
        `;

        if (hasChildren) {
            html += children.map(child => this.renderTreeNode(child, level + 1)).join('');
        }

        return html;
    }

    renderRolesCheckboxes() {
        const container = document.getElementById('rolesCheckboxes');
        if (!container) return;

        if (this.roles.length === 0) {
            container.innerHTML = '<p class="text-center text-base-content/70">Nenhum papel encontrado</p>';
            return;
        }

        container.innerHTML = this.roles.map(role => `
            <label class="label cursor-pointer justify-start gap-3">
                <input type="checkbox" class="checkbox" value="${role.id}" name="resourceRoles">
                <div>
                    <span class="label-text font-medium">${role.name}</span>
                    <div class="label-text-alt">${role.description || 'Sem descrição'}</div>
                </div>
            </label>
        `).join('');
    }

    updateStats(resources = null) {
        const resourcesToCount = resources || this.resources;
        
        const stats = {
            total: resourcesToCount.length,
            active: resourcesToCount.filter(r => r.is_active).length,
            menu: resourcesToCount.filter(r => r.type === 'MENU').length,
            api: resourcesToCount.filter(r => r.type === 'API').length
        };

        // Atualizar elementos
        const elements = {
            totalResources: stats.total,
            activeResources: stats.active,
            menuResources: stats.menu,
            apiResources: stats.api
        };

        Object.entries(elements).forEach(([id, value]) => {
            const element = document.getElementById(id);
            if (element) {
                element.textContent = value;
            }
        });
    }

    openResourceModal(resourceId = null) {
        this.currentResourceId = resourceId;
        const modal = document.getElementById('resourceModal');
        const title = document.getElementById('modalTitle');
        const form = document.getElementById('resourceForm');

        title.textContent = resourceId ? 'Editar Recurso' : 'Novo Recurso';
        form.reset();

        if (resourceId) {
            const resource = this.resources.find(r => r.id === resourceId);
            if (resource) {
                this.fillResourceForm(resource);
            }
            } else {
            this.resetForm();
        }

        modal.showModal();
    }

    fillResourceForm(resource) {
        document.getElementById('resourceId').value = resource.id;
        document.getElementById('resourceName').value = resource.name;
        document.getElementById('resourcePath').value = resource.path;
        document.getElementById('resourceDescription').value = resource.description || '';
        document.getElementById('resourceType').value = resource.type;
        document.getElementById('resourceIcon').value = resource.icon || 'fas fa-link';
        document.getElementById('resourceOrder').value = resource.order || 0;
        document.getElementById('resourceIsActive').checked = resource.is_active;
        document.getElementById('resourceIsAdminOnly').checked = resource.is_admin_only;

        // Selecionar recurso pai
        const parentSelect = document.getElementById('resourceParent');
        if (parentSelect) {
            parentSelect.value = resource.parent_id || '';
        }

        // Marcar papéis
        if (resource.roles) {
            const roleIds = resource.roles.map(role => role.id);
            document.querySelectorAll('input[name="resourceRoles"]').forEach(checkbox => {
                checkbox.checked = roleIds.includes(checkbox.value);
            });
        }

        this.updateResourcePreview();
    }

    resetForm() {
        document.getElementById('resourceId').value = '';
        document.getElementById('resourceName').value = '';
        document.getElementById('resourcePath').value = '';
        document.getElementById('resourceDescription').value = '';
        document.getElementById('resourceType').value = 'PAGE';
        document.getElementById('resourceIcon').value = 'fas fa-link';
        document.getElementById('resourceOrder').value = '0';
        document.getElementById('resourceIsActive').checked = true;
        document.getElementById('resourceIsAdminOnly').checked = false;
        
        const parentSelect = document.getElementById('resourceParent');
        if (parentSelect) {
            parentSelect.value = '';
        }

        document.querySelectorAll('input[name="resourceRoles"]').forEach(checkbox => {
            checkbox.checked = false;
        });
        
        this.updateResourcePreview();
    }

    updateResourcePreview() {
        const name = document.getElementById('resourceName')?.value || 'Nome do Recurso';
        const path = document.getElementById('resourcePath')?.value || '/caminho/do/recurso';
        const description = document.getElementById('resourceDescription')?.value || 'Descrição do recurso';
        const type = document.getElementById('resourceType')?.value || 'PAGE';
        const icon = document.getElementById('resourceIcon')?.value || 'fas fa-link';
        const isActive = document.getElementById('resourceIsActive')?.checked;
        const isAdminOnly = document.getElementById('resourceIsAdminOnly')?.checked;

        // Atualizar preview
        document.getElementById('previewName').textContent = name;
        document.getElementById('previewPath').textContent = path;
        document.getElementById('previewDescription').textContent = description;
        document.getElementById('previewIcon').innerHTML = `<i class="${icon}"></i>`;
        document.getElementById('previewTypeBadge').textContent = type;
        document.getElementById('previewActiveBadge').textContent = isActive ? 'Ativo' : 'Inativo';
        document.getElementById('previewActiveBadge').className = `badge badge-sm ${isActive ? 'badge-success' : 'badge-error'}`;
        document.getElementById('previewAdminBadge').style.display = isAdminOnly ? 'inline-block' : 'none';

        // Atualizar ícone de preview no formulário
        const iconPreview = document.getElementById('iconPreview');
        if (iconPreview) {
            iconPreview.className = icon;
        }
    }

    toggleIconSelector() {
        const selector = document.getElementById('iconSelector');
        const isVisible = selector.style.display !== 'none';
        
        if (!isVisible) {
            this.renderIconSelector();
        }
        
        selector.style.display = isVisible ? 'none' : 'block';
    }

    renderIconSelector() {
        const grid = document.querySelector('.icons-grid');
        if (!grid) return;

        grid.innerHTML = this.icons.map(icon => `
            <div class="icon-option" onclick="resourceManager.selectIcon('${icon}')">
                <i class="${icon}"></i>
            </div>
        `).join('');
    }

    selectIcon(icon) {
        document.getElementById('resourceIcon').value = icon;
        document.getElementById('iconPreview').className = icon;
        this.updateResourcePreview();
        this.toggleIconSelector();
    }

    async saveResource() {
        try {
            const formData = this.getFormData();
            
            if (!this.validateForm(formData)) {
                return;
            }
            
            const url = this.currentResourceId 
                ? `/api/resources/${this.currentResourceId}`
                : '/api/resources';
            
            const method = this.currentResourceId ? 'PUT' : 'POST';
            
            const response = await fetch(url, {
                method,
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
                },
                body: JSON.stringify(formData)
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || `Erro ao salvar recurso (${response.status})`);
            }

            const result = await response.json();
            
            this.showToast(
                this.currentResourceId ? 'Recurso atualizado com sucesso' : 'Recurso criado com sucesso',
                'success'
            );
            
            // Fechar modal e recarregar dados
            document.getElementById('resourceModal').close();
            await this.loadResources();
            this.updateStats();
            this.renderResourceTree();
                
        } catch (error) {
            console.error('Erro ao salvar recurso:', error);
            this.showToast(error.message, 'error');
        }
    }

    getFormData() {
        const selectedRoles = Array.from(document.querySelectorAll('input[name="resourceRoles"]:checked'))
            .map(checkbox => checkbox.value);

        return {
            name: document.getElementById('resourceName').value,
            path: document.getElementById('resourcePath').value,
            description: document.getElementById('resourceDescription').value,
            type: document.getElementById('resourceType').value,
            icon: document.getElementById('resourceIcon').value,
            order: parseInt(document.getElementById('resourceOrder').value) || 0,
            is_active: document.getElementById('resourceIsActive').checked,
            is_admin_only: document.getElementById('resourceIsAdminOnly').checked,
            parent_id: document.getElementById('resourceParent').value || null,
            roles: selectedRoles
        };
    }

    validateForm(data) {
        if (!data.name.trim()) {
            this.showToast('Nome do recurso é obrigatório', 'error');
            return false;
        }
        
        if (!data.path.trim()) {
            this.showToast('Caminho do recurso é obrigatório', 'error');
            return false;
        }
        
        if (!data.type) {
            this.showToast('Tipo do recurso é obrigatório', 'error');
            return false;
        }
        
        return true;
    }

    async deleteResource(resourceId) {
        const resource = this.resources.find(r => r.id === resourceId);
        if (!resource) return;

        if (!confirm(`Tem certeza que deseja excluir o recurso "${resource.name}"?`)) {
            return;
        }
        
        try {
            const response = await fetch(`/api/resources/${resourceId}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
                }
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || `Erro ao excluir recurso (${response.status})`);
            }

            this.showToast('Recurso excluído com sucesso', 'success');
            await this.loadResources();
            this.updateStats();
            this.renderResourceTree();
                
        } catch (error) {
            console.error('Erro ao excluir recurso:', error);
            this.showToast(error.message, 'error');
        }
    }

    selectResource(resourceId) {
        const resource = this.resources.find(r => r.id === resourceId);
        if (!resource) return;

        this.renderResourceDetails(resource);
    }

    renderResourceDetails(resource) {
        const container = document.getElementById('resourceDetails');
        if (!container) return;

        const rolesText = resource.roles && resource.roles.length > 0 
            ? resource.roles.map(role => role.name).join(', ')
            : 'Nenhum papel';

        container.innerHTML = `
            <div class="space-y-4">
                <div class="flex items-center gap-3">
                    <div class="resource-icon bg-primary/10 text-primary">
                        <i class="${resource.icon || 'fas fa-link'}"></i>
                    </div>
                    <div>
                        <h3 class="font-bold text-lg">${resource.name}</h3>
                        <div class="resource-path">${resource.path}</div>
                    </div>
                </div>
                
                ${resource.description ? `
                    <div>
                        <h4 class="font-medium mb-2">Descrição</h4>
                        <p class="text-sm text-base-content/70">${resource.description}</p>
                    </div>
                ` : ''}
                
                <div class="grid grid-cols-2 gap-4">
                    <div>
                        <h4 class="font-medium mb-1">Tipo</h4>
                        <span class="badge badge-sm">${resource.type}</span>
                    </div>
                    <div>
                        <h4 class="font-medium mb-1">Status</h4>
                        <span class="badge badge-sm ${resource.is_active ? 'badge-success' : 'badge-error'}">
                            ${resource.is_active ? 'Ativo' : 'Inativo'}
                        </span>
                    </div>
                </div>
                
                <div>
                    <h4 class="font-medium mb-2">Papéis com Acesso</h4>
                    <p class="text-sm text-base-content/70">${rolesText}</p>
                </div>
                
                <div class="flex gap-2">
                    <button class="btn btn-primary btn-sm" onclick="resourceManager.editResource('${resource.id}')">
                        <i class="fas fa-edit"></i> Editar
                    </button>
                    <button class="btn btn-error btn-sm" onclick="resourceManager.deleteResource('${resource.id}')">
                        <i class="fas fa-trash"></i> Excluir
                    </button>
                </div>
            </div>
        `;
    }

    editResource(resourceId) {
        this.openResourceModal(resourceId);
    }

    showToast(message, type = 'info') {
        // Implementar sistema de toast (pode usar DaisyUI toast ou criar um customizado)
        console.log(`${type.toUpperCase()}: ${message}`);
        
        // Exemplo simples de alerta
        alert(`${type.toUpperCase()}: ${message}`);
    }
}

// Inicializar o gerenciador quando a página carregar
document.addEventListener('DOMContentLoaded', () => {
    window.resourceManager = new ResourceManager();
}); 