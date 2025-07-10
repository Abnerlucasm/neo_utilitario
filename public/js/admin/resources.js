/**
 * Classe para gerenciamento de recursos
 */
class ResourceManager {
    constructor() {
        this.resources = [];
        this.filteredResources = [];
        this.currentResourceId = null;
        
        // Elementos DOM
        this.resourceAccordion = document.getElementById('resourceAccordion');
        this.loadingContainer = document.getElementById('loadingContainer');
        this.noResourcesContainer = document.getElementById('noResourcesContainer');
        this.resourceSearch = document.getElementById('resourceSearch');
        this.resourceTypeFilter = document.getElementById('resourceTypeFilter');
        this.resourceStatusFilter = document.getElementById('resourceStatusFilter');
        this.resourceModal = document.getElementById('resourceModal');
        this.deleteModal = document.getElementById('deleteModal');
        
        // Formulário
        this.resourceForm = document.getElementById('resourceForm');
        this.resourceName = document.getElementById('resourceName');
        this.resourcePath = document.getElementById('resourcePath');
        this.resourceDescription = document.getElementById('resourceDescription');
        this.resourceType = document.getElementById('resourceType');
        this.parentResource = document.getElementById('parentResource');
        this.resourceIcon = document.getElementById('resourceIcon');
        this.resourceActive = document.getElementById('resourceActive');
        this.iconPreview = document.getElementById('iconPreview');
        
        // Elementos do modal de exclusão
        this.deleteResourceName = document.getElementById('deleteResourceName');
        this.confirmDeleteBtn = document.getElementById('confirmDeleteBtn');
        
        // Configurar manipuladores de eventos dos modais
        if (this.resourceModal) {
            const closeButtons = this.resourceModal.querySelectorAll('.delete, .modal-background, #cancelResourceBtn');
            closeButtons.forEach(button => {
                button.addEventListener('click', () => this.hideResourceModal());
            });
        }
        
        if (this.deleteModal) {
            const closeButtons = this.deleteModal.querySelectorAll('.delete, .modal-background, button:not(#confirmDeleteBtn)');
            closeButtons.forEach(button => {
                button.addEventListener('click', () => this.hideDeleteModal());
            });
        }
    }
    
    /**
     * Inicializa o gerenciador de recursos
     */
    init() {
        this.setupAuthCheck();
        this.bindEvents();
        this.loadResources();
    }
    
    /**
     * Verifica se o usuário está autenticado
     * Redireciona para a página de login se não estiver
     */
    setupAuthCheck() {
        const token = localStorage.getItem('auth_token');
        if (!token) {
            this.showToast('Erro', 'Você precisa estar logado para acessar esta página', 'error');
            
            // Redirecionar para a página de login depois de 2 segundos
            setTimeout(() => {
                window.location.href = '/pages/login.html';
            }, 2000);
            return false;
        }
        return true;
    }
    
    /**
     * Vincula eventos aos elementos da página
     */
    bindEvents() {
        // Botão de adicionar recurso
        document.getElementById('addResourceBtn').addEventListener('click', () => {
            this.showAddResourceModal();
        });
        
        // Botão de salvar recurso
        document.getElementById('saveResourceBtn').addEventListener('click', () => {
            this.saveResource();
        });
        
        // Botão de confirmar exclusão
        this.confirmDeleteBtn.addEventListener('click', () => {
            this.deleteResource();
        });
        
        // Filtros
        this.resourceSearch.addEventListener('input', () => {
            this.applyFilters();
        });
        
        this.resourceTypeFilter.addEventListener('change', () => {
            this.applyFilters();
        });
        
        this.resourceStatusFilter.addEventListener('change', () => {
            this.applyFilters();
        });
        
        // Preview do ícone
        this.resourceIcon.addEventListener('input', () => {
            this.updateIconPreview();
        });
        
        // Adicionar botão de seleção de ícones
        const iconGroup = this.resourceIcon.parentNode;
        const selectIconBtn = document.createElement('button');
        selectIconBtn.type = 'button';
        selectIconBtn.className = 'btn btn-outline-primary btn-sm mt-2';
        selectIconBtn.innerHTML = '<i class="fas fa-icons"></i> Escolher ícone';
        selectIconBtn.onclick = (e) => {
            e.preventDefault();
            this.toggleIconSelector();
        };
        iconGroup.appendChild(selectIconBtn);
    }
    
    /**
     * Carrega os recursos do servidor
     */
    loadResources() {
        this.showLoading(true);
        
        // Obter o token de autenticação do localStorage
        const token = localStorage.getItem('auth_token');
        
        // Configurar os headers da requisição
        const headers = {
            'Content-Type': 'application/json'
        };
        
        // Adicionar o token de autorização se existir
        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
        }
        
        fetch('/api/resources', {
            method: 'GET',
            headers: headers
        })
            .then(response => {
                if (!response.ok) {
                    throw new Error('Falha ao carregar recursos');
                }
                return response.json();
            })
            .then(data => {
                // Se os dados estiverem dentro de um objeto 'data', extraí-los
                this.resources = Array.isArray(data) ? data : (data.data || []);
                this.filteredResources = [...this.resources];
                this.renderResources();
                this.populateParentResourceOptions();
                this.showLoading(false);
            })
            .catch(error => {
                console.error('Erro ao carregar recursos:', error);
                this.showToast('Erro', 'Não foi possível carregar os recursos. Tente novamente mais tarde.', 'error');
                this.showLoading(false);
            });
    }
    
    /**
     * Mostra/esconde o indicador de carregamento
     * @param {boolean} show - Se deve mostrar ou esconder o loading
     */
    showLoading(show) {
        if (show) {
            this.loadingContainer.classList.remove('d-none');
            this.resourceAccordion.classList.add('d-none');
            this.noResourcesContainer.classList.add('d-none');
        } else {
            this.loadingContainer.classList.add('d-none');
            
            if (this.filteredResources.length === 0) {
                this.noResourcesContainer.classList.remove('d-none');
                this.resourceAccordion.classList.add('d-none');
            } else {
                this.resourceAccordion.classList.remove('d-none');
                this.noResourcesContainer.classList.add('d-none');
            }
        }
    }
    
    /**
     * Renderiza os recursos na página
     */
    renderResources() {
        this.resourceAccordion.innerHTML = '';
        
        if (this.filteredResources.length === 0) {
            this.noResourcesContainer.classList.remove('d-none');
            this.resourceAccordion.classList.add('d-none');
            return;
        }
        
        this.noResourcesContainer.classList.add('d-none');
        this.resourceAccordion.classList.remove('d-none');
        
        // Agrupar recursos por tipo
        const resourcesByType = this.groupResourcesByType(this.filteredResources);
        
        // Renderizar cada grupo
        Object.keys(resourcesByType).forEach((type, index) => {
            const resources = resourcesByType[type];
            const typeId = `type-${type.toLowerCase()}`;
            const typeLabel = this.getTypeLabel(type);
            
            const accordionItem = document.createElement('div');
            accordionItem.className = 'accordion-item';
            accordionItem.innerHTML = `
                <h2 class="accordion-header" id="heading-${typeId}">
                    <button class="accordion-button ${index > 0 ? 'collapsed' : ''}" type="button" 
                            data-bs-toggle="collapse" data-bs-target="#collapse-${typeId}" 
                            aria-expanded="${index === 0 ? 'true' : 'false'}" aria-controls="collapse-${typeId}">
                        <span class="resource-type-badge resource-type-${type.toLowerCase()}">${typeLabel}</span>
                        <span class="ms-2">${resources.length} recurso(s)</span>
                    </button>
                </h2>
                <div id="collapse-${typeId}" class="accordion-collapse collapse ${index === 0 ? 'show' : ''}" 
                     aria-labelledby="heading-${typeId}" data-bs-parent="#resourceAccordion">
                    <div class="accordion-body p-0">
                        <div class="resource-list" id="resource-list-${typeId}">
                        </div>
                    </div>
                </div>
            `;
            
            this.resourceAccordion.appendChild(accordionItem);
            
            // Renderizar recursos do grupo
            const resourceList = document.getElementById(`resource-list-${typeId}`);
            
            resources.forEach(resource => {
                const resourceItem = document.createElement('div');
                resourceItem.className = 'resource-item d-flex align-items-center justify-content-between';
                resourceItem.innerHTML = `
                    <div class="d-flex align-items-center">
                        <div class="resource-icon">
                            <i class="fas ${resource.icon || 'fa-file'}"></i>
                        </div>
                        <div>
                            <div class="resource-title">${resource.name}</div>
                            <div class="resource-path">${resource.path}</div>
                            ${resource.description ? `<div class="resource-description">${resource.description}</div>` : ''}
                        </div>
                    </div>
                    <div class="d-flex align-items-center">
                        <span class="status-badge ${resource.is_active ? 'status-active' : 'status-inactive'}">
                            ${resource.is_active ? 'Ativo' : 'Inativo'}
                        </span>
                        <div class="resource-actions ms-3">
                            <button class="btn btn-sm btn-primary edit-resource" data-id="${resource.id}" title="Editar">
                                <i class="fas fa-edit"></i>
                            </button>
                            <button class="btn btn-sm btn-danger delete-resource" data-id="${resource.id}" data-name="${resource.name}" title="Excluir">
                                <i class="fas fa-trash"></i>
                            </button>
                        </div>
                    </div>
                `;
                
                resourceList.appendChild(resourceItem);
                
                // Adicionar event listeners para botões de edição e exclusão
                const editBtn = resourceItem.querySelector('.edit-resource');
                if (editBtn) {
                    editBtn.addEventListener('click', () => {
                        this.showEditResourceModal(resource.id);
                    });
                }
                
                const deleteBtn = resourceItem.querySelector('.delete-resource');
                if (deleteBtn) {
                    deleteBtn.addEventListener('click', () => {
                        this.showDeleteConfirmation(resource.id, resource.name);
                    });
                }
            });
        });
    }
    
    /**
     * Agrupa recursos por tipo
     * @param {Array} resources - Lista de recursos
     * @return {Object} Recursos agrupados por tipo
     */
    groupResourcesByType(resources) {
        const groups = {};
        
        resources.forEach(resource => {
            const type = resource.type.toUpperCase();
            if (!groups[type]) {
                groups[type] = [];
            }
            groups[type].push(resource);
        });
        
        return groups;
    }
    
    /**
     * Obtém o rótulo legível para um tipo de recurso
     * @param {string} type - Tipo do recurso
     * @return {string} Rótulo do tipo
     */
    getTypeLabel(type) {
        const types = {
            'PAGE': 'Página',
            'API': 'API',
            'COMPONENT': 'Componente',
            'REPORT': 'Relatório',
            'OTHER': 'Outro'
        };
        
        return types[type] || type;
    }
    
    /**
     * Preenche o select de recursos pais
     */
    populateParentResourceOptions() {
        this.parentResource.innerHTML = '<option value="">Nenhum (recurso raiz)</option>';
        
        // Recurso temporariamente desabilitado por conta de limitações no banco de dados
        // Desabilitando select de parent
        this.parentResource.disabled = true;
        
        /*
        // Filtrar apenas recursos ativos que não são o recurso atual
        const parentOptions = this.resources.filter(resource => {
            return resource.is_active && 
                  (!this.currentResourceId || resource.id !== this.currentResourceId);
        });
        
        // Adicionar opções
        parentOptions.forEach(resource => {
            const option = document.createElement('option');
            option.value = resource.id;
            option.textContent = resource.name;
            this.parentResource.appendChild(option);
        });
        */
    }
    
    /**
     * Mostra o modal de adição de recurso
     */
    showAddResourceModal() {
        this.currentResourceId = null;
        this.resourceForm.reset();
        this.resourceActive.checked = true;
        
        // Exibir modal
        this.resourceModal.classList.add('is-active');
        
        // Atualizar título
        document.querySelector('#resourceModal .modal-card-title').textContent = 'Adicionar Recurso';
        
        // Desabilitar parentResource
        this.parentResource.disabled = true;
        
        // Garantir que o modal está visível
        setTimeout(() => {
            this.resourceName.focus();
        }, 100);
    }
    
    /**
     * Mostra o modal de edição de recurso
     * @param {string} resourceId - ID do recurso a ser editado
     */
    showEditResourceModal(resourceId) {
        this.currentResourceId = resourceId;
        this.resourceForm.reset();
        
        // Buscar dados do recurso
        const resource = this.resources.find(r => r.id == resourceId);
        
        if (!resource) {
            this.showToast('Erro', 'Recurso não encontrado', 'error');
            return;
        }
        
        // Preencher formulário
        this.resourceName.value = resource.name;
        this.resourcePath.value = resource.path;
        this.resourceDescription.value = resource.description || '';
        this.resourceType.value = resource.type;
        this.resourceIcon.value = resource.icon || '';
        this.resourceActive.checked = resource.is_active;
        
        // Desabilitar parent - temporariamente removido
        this.parentResource.disabled = true;
        
        /*
        // Selecionar parent resource
        if (resource.parent && resource.parent.id) {
            this.parentResource.value = resource.parent.id;
        } else {
            this.parentResource.value = '';
        }
        */
        
        // Atualizar preview do ícone
        this.updateIconPreview();
        
        // Exibir modal
        this.resourceModal.classList.add('is-active');
        
        // Atualizar título
        document.querySelector('#resourceModal .modal-card-title').textContent = 'Editar Recurso';
        
        // Focar no primeiro campo
        setTimeout(() => {
            this.resourceName.focus();
        }, 100);
    }
    
    /**
     * Esconde o modal de recurso
     */
    hideResourceModal() {
        this.resourceModal.classList.remove('is-active');
        document.documentElement.classList.remove('is-clipped');
    }
    
    /**
     * Atualiza o preview do ícone
     */
    updateIconPreview() {
        const iconClass = this.resourceIcon.value || 'fa-file';
        this.iconPreview.innerHTML = `<i class="fas ${iconClass}"></i>`;
    }
    
    /**
     * Alterna a exibição do seletor de ícones
     */
    toggleIconSelector() {
        const iconSelector = document.getElementById('iconSelector');
        
        if (iconSelector) {
            // Se já existe, apenas alterna a visibilidade
            iconSelector.classList.toggle('d-none');
        } else {
            // Se não existe, cria o seletor
            this.renderIconSelector();
        }
    }
    
    /**
     * Renderiza o seletor de ícones
     */
    renderIconSelector() {
        // Lista de ícones comuns para escolha rápida
        const commonIcons = [
            'fa-file', 'fa-folder', 'fa-home', 'fa-users', 'fa-user', 
            'fa-cog', 'fa-wrench', 'fa-chart-bar', 'fa-table', 'fa-list',
            'fa-edit', 'fa-search', 'fa-trash', 'fa-plus', 'fa-minus',
            'fa-save', 'fa-print', 'fa-download', 'fa-upload', 'fa-link',
            'fa-eye', 'fa-eye-slash', 'fa-lock', 'fa-unlock', 'fa-key',
            'fa-bell', 'fa-calendar', 'fa-clock', 'fa-star', 'fa-heart',
            'fa-check', 'fa-times', 'fa-exclamation-triangle', 'fa-question-circle', 'fa-info-circle',
            'fa-comments', 'fa-envelope', 'fa-phone', 'fa-map-marker-alt', 'fa-globe',
            'fa-dashboard', 'fa-tachometer-alt', 'fa-server', 'fa-database', 'fa-code',
            'fa-laptop', 'fa-desktop', 'fa-mobile-alt', 'fa-tablet-alt', 'fa-tv',
            'fa-image', 'fa-video', 'fa-music', 'fa-camera', 'fa-microphone',
            'fa-paperclip', 'fa-copy', 'fa-paste', 'fa-cut', 'fa-share',
            'fa-sort', 'fa-filter', 'fa-sync', 'fa-redo', 'fa-undo'
        ];

        // Criar o container do seletor
        const selectorContainer = document.createElement('div');
        selectorContainer.id = 'iconSelector';
        selectorContainer.className = 'icon-selector mt-2 mb-2 p-2 border rounded';
        
        // Adicionar um campo de busca
        const searchDiv = document.createElement('div');
        searchDiv.className = 'mb-2';
        searchDiv.innerHTML = `
            <input type="text" class="form-control form-control-sm" id="iconSearch" 
                   placeholder="Buscar ícone..." style="width: 100%; margin-bottom: 10px;">
        `;
        selectorContainer.appendChild(searchDiv);
        
        // Criar a grade de ícones
        const iconsGrid = document.createElement('div');
        iconsGrid.className = 'icons-grid d-flex flex-wrap';
        
        // Adicionar cada ícone à grade
        commonIcons.forEach(icon => {
            const iconElement = document.createElement('div');
            iconElement.className = 'icon-option p-2 m-1 text-center border rounded';
            iconElement.style.cursor = 'pointer';
            iconElement.style.width = '40px';
            iconElement.style.height = '40px';
            iconElement.dataset.icon = icon;
            iconElement.innerHTML = `<i class="fas ${icon}"></i>`;
            
            // Destacar o ícone atual, se houver
            if (icon === this.resourceIcon.value) {
                iconElement.classList.add('bg-primary', 'text-white');
            }
            
            // Adicionar evento de clique
            iconElement.addEventListener('click', () => {
                this.selectIcon(icon);
            });
            
            iconsGrid.appendChild(iconElement);
        });
        
        selectorContainer.appendChild(iconsGrid);
        
        // Inserir após o campo de ícone
        this.resourceIcon.parentNode.parentNode.appendChild(selectorContainer);
        
        // Adicionar evento de busca
        const iconSearch = document.getElementById('iconSearch');
        iconSearch.addEventListener('input', (e) => {
            const searchTerm = e.target.value.toLowerCase();
            const iconOptions = iconsGrid.querySelectorAll('.icon-option');
            
            iconOptions.forEach(option => {
                const icon = option.dataset.icon;
                if (icon.includes(searchTerm)) {
                    option.style.display = 'block';
                } else {
                    option.style.display = 'none';
                }
            });
        });
    }
    
    /**
     * Seleciona um ícone
     * @param {string} icon - Classe do ícone
     */
    selectIcon(icon) {
        // Atualizar o valor do campo
        this.resourceIcon.value = icon;
        
        // Atualizar o preview
        this.updateIconPreview();
        
        // Atualizar a seleção visual
        const iconOptions = document.querySelectorAll('.icon-option');
        
        iconOptions.forEach(option => {
            option.classList.remove('bg-primary', 'text-white');
            
            if (option.dataset.icon === icon) {
                option.classList.add('bg-primary', 'text-white');
            }
        });
    }
    
    /**
     * Mostra o modal de confirmação de exclusão
     * @param {string} resourceId - ID do recurso a ser excluído
     * @param {string} resourceName - Nome do recurso a ser excluído
     */
    showDeleteConfirmation(resourceId, resourceName) {
        this.currentResourceId = resourceId;
        this.deleteResourceName.textContent = resourceName;
        this.deleteModal.classList.add('is-active');
        document.documentElement.classList.add('is-clipped');
    }
    
    /**
     * Esconde o modal de confirmação de exclusão
     */
    hideDeleteModal() {
        this.deleteModal.classList.remove('is-active');
        document.documentElement.classList.remove('is-clipped');
    }
    
    /**
     * Salva o recurso (novo ou existente)
     */
    saveResource() {
        // Validar formulário
        if (!this.resourceName.value || !this.resourcePath.value || !this.resourceType.value) {
            this.showToast('Atenção', 'Preencha todos os campos obrigatórios', 'warning');
            return;
        }
        
        // Preparar dados
        const resourceData = {
            name: this.resourceName.value,
            path: this.resourcePath.value,
            description: this.resourceDescription.value,
            type: this.resourceType.value,
            icon: this.resourceIcon.value,
            is_active: this.resourceActive.checked,
            // parent_id: this.parentResource.value || null, // Comentado temporariamente
            order: 0 // Por enquanto, ordem fixa
            // is_system removido pois não existe no banco
        };
        
        // Obter o token de autenticação do localStorage
        const token = localStorage.getItem('auth_token');
        
        // Configurar os headers da requisição
        const headers = {
            'Content-Type': 'application/json'
        };
        
        // Adicionar o token de autorização se existir
        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
        }
        
        // URL da API e método
        let url = '/api/resources';
        let method = 'POST';
        
        // Se for edição, ajustar URL e método
        if (this.currentResourceId) {
            url = `/api/resources/${this.currentResourceId}`;
            method = 'PUT';
        }
        
        // Enviar requisição
        fetch(url, {
            method: method,
            headers: headers,
            body: JSON.stringify(resourceData)
        })
            .then(response => {
                if (!response.ok) {
                    throw new Error(`Erro ao salvar recurso: ${response.status}`);
                }
                return response.json();
            })
            .then(data => {
                // Verificar formato da resposta
                const responseData = data.data || data;
                
                if (this.currentResourceId) {
                    // Atualizar recurso existente na lista
                    const index = this.resources.findIndex(r => r.id === this.currentResourceId);
                    if (index !== -1) {
                        this.resources[index] = responseData;
                    }
                    this.showToast('Sucesso', 'Recurso atualizado com sucesso', 'success');
                } else {
                    // Adicionar novo recurso à lista
                    this.resources.push(responseData);
                    this.showToast('Sucesso', 'Recurso criado com sucesso', 'success');
                }
                
                // Atualizar interface
                this.filteredResources = [...this.resources];
                this.renderResources();
                this.hideResourceModal();
                this.populateParentResourceOptions();
            })
            .catch(error => {
                console.error('Erro ao salvar recurso:', error);
                this.showToast('Erro', 'Não foi possível salvar o recurso. Tente novamente.', 'error');
            });
    }
    
    /**
     * Exclui um recurso
     */
    deleteResource() {
        if (!this.currentResourceId) return;
        
        // Obter o token de autenticação
        const token = localStorage.getItem('auth_token');
        
        // Configurar os headers
        const headers = {
            'Content-Type': 'application/json'
        };
        
        // Adicionar o token de autorização se existir
        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
        }
        
        fetch(`/api/resources/${this.currentResourceId}`, {
            method: 'DELETE',
            headers: headers
        })
        .then(response => {
            if (!response.ok) {
                throw new Error('Erro ao excluir recurso');
            }
            
            // Fechar modal
            this.hideDeleteModal();
            
            // Atualizar lista
            this.loadResources();
            
            // Mostrar notificação
            this.showToast('Sucesso', 'Recurso excluído com sucesso!', 'success');
        })
        .catch(error => {
            console.error('Erro ao excluir recurso:', error);
            this.showToast('Erro', 'Não foi possível excluir o recurso. Tente novamente mais tarde.', 'error');
        });
    }
    
    /**
     * Aplica filtros à lista de recursos
     */
    applyFilters() {
        const searchTerm = this.resourceSearch.value.toLowerCase();
        const typeFilter = this.resourceTypeFilter.value;
        const statusFilter = this.resourceStatusFilter.value;
        
        this.filteredResources = this.resources.filter(resource => {
            // Filtro de busca
            const matchesSearch = 
                resource.name.toLowerCase().includes(searchTerm) ||
                resource.path.toLowerCase().includes(searchTerm) ||
                (resource.description && resource.description.toLowerCase().includes(searchTerm));
            
            // Filtro de tipo
            const matchesType = typeFilter === 'all' || resource.type.toLowerCase() === typeFilter;
            
            // Filtro de status
            let matchesStatus = true;
            if (statusFilter === 'active') {
                matchesStatus = resource.is_active === true;
            } else if (statusFilter === 'inactive') {
                matchesStatus = resource.is_active === false;
            }
            
            return matchesSearch && matchesType && matchesStatus;
        });
        
        this.renderResources();
    }
    
    /**
     * Mostra uma notificação toast
     * @param {string} title - Título da notificação
     * @param {string} message - Mensagem da notificação
     * @param {string} type - Tipo da notificação (success, error, warning, info)
     */
    showToast(title, message, type = 'info') {
        const toast = document.createElement('div');
        
        // Mapear tipos para classes do Bulma
        let typeClass;
        switch (type) {
            case 'success':
                typeClass = 'is-success';
                break;
            case 'error':
                typeClass = 'is-danger';
                break;
            case 'warning':
                typeClass = 'is-warning';
                break;
            default:
                typeClass = 'is-info';
        }
        
        // Configurar classes e estilo
        toast.className = `notification ${typeClass}`;
        toast.style.position = 'fixed';
        toast.style.bottom = '20px';
        toast.style.right = '20px';
        toast.style.zIndex = '1000';
        toast.style.minWidth = '250px';
        toast.style.boxShadow = '0 3px 10px rgba(0,0,0,0.2)';
        
        // Definir conteúdo com título e mensagem
        toast.innerHTML = `
            <button class="delete"></button>
            <p class="has-text-weight-bold">${title}</p>
            <p>${message}</p>
        `;
        
        // Adicionar ao body
        document.body.appendChild(toast);
        
        // Configurar botão de fechar
        const closeButton = toast.querySelector('.delete');
        closeButton.addEventListener('click', () => {
            toast.remove();
        });
        
        // Auto-remover após 5 segundos
        setTimeout(() => {
            toast.remove();
        }, 5000);
    }
}

// Inicializa o gerenciador de recursos quando o documento estiver pronto
document.addEventListener('DOMContentLoaded', () => {
    window.resourceManager = new ResourceManager();
}); 