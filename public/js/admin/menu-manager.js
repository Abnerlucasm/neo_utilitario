class MenuManager {
    constructor() {
        // Estado da aplicação
        this.state = {
            menus: [],
            resources: [], // Adicionar recursos
            selectedMenuId: null,
            isLoading: false
        };
        
        // Configurações
        this.config = {
            iconList: [
                'fas fa-home', 'fas fa-user', 'fas fa-cog', 'fas fa-tools', 'fas fa-server',
                'fas fa-database', 'fas fa-chart-line', 'fas fa-graduation-cap', 'fas fa-book',
                'fas fa-users', 'fas fa-user-shield', 'fas fa-user-cog', 'fas fa-user-tag',
                'fas fa-rocket', 'fas fa-lightbulb', 'fas fa-bars', 'fas fa-link', 'fas fa-globe',
                'fas fa-ticket-alt', 'fas fa-file', 'fas fa-folder', 'fas fa-envelope',
                'fas fa-bell', 'fas fa-calendar', 'fas fa-clock', 'fas fa-search',
                'fas fa-shield-alt', 'fas fa-lock', 'fas fa-key', 'fas fa-sign-in-alt',
                'fas fa-sign-out-alt', 'fas fa-plus', 'fas fa-minus', 'fas fa-times',
                'fas fa-check', 'fas fa-exclamation-triangle', 'fas fa-info-circle',
                'fas fa-question-circle', 'fas fa-comment', 'fas fa-comments',
                'fas fa-paper-plane', 'fas fa-download', 'fas fa-upload', 'fas fa-sync',
                'fas fa-redo', 'fas fa-undo', 'fas fa-trash', 'fas fa-edit',
                'fas fa-eye', 'fas fa-eye-slash', 'fas fa-print', 'fas fa-save',
                'fas fa-copy', 'fas fa-paste', 'fas fa-cut', 'fas fa-list',
                'fas fa-table', 'fas fa-chart-bar', 'fas fa-chart-pie', 'fas fa-chart-area'
            ],
            validationRules: {
                title: { minLength: 3, required: true },
                path: { required: true, mustStartWith: '/' }
            },
            defaultMenu: {
                icon: 'fas fa-link',
                order: 0,
                is_admin_only: false,
                is_active: true
            }
        };
        
        this.init();
    }
    
    async init() {
        try {
            this.setupEventListeners();
            await Promise.all([
                this.loadMenus(),
                this.loadResources() // Carregar recursos também
            ]);
        } catch (error) {
            console.error('Erro ao inicializar gerenciador de menus:', error);
            this.showToast('Erro ao inicializar gerenciador de menus', 'danger');
        }
    }
    
    setupEventListeners() {
        // Elementos do formulário
        const elements = {
            showInactiveMenus: document.getElementById('showInactiveMenus'),
            iconSelectorBtn: document.getElementById('iconSelectorBtn'),
            menuIcon: document.getElementById('menuIcon'),
            menuTitle: document.getElementById('menuTitle'),
            menuPath: document.getElementById('menuPath'),
            menuIsAdminOnly: document.getElementById('menuIsAdminOnly'),
            menuIsActive: document.getElementById('menuIsActive'),
            modal: document.getElementById('menuModal')
        };
        
        // Event listeners para filtros
        if (elements.showInactiveMenus) {
            elements.showInactiveMenus.addEventListener('change', () => this.renderMenuTree());
        }
        
        // Event listeners para seletor de ícones
        if (elements.iconSelectorBtn) {
            elements.iconSelectorBtn.addEventListener('click', (e) => {
                e.preventDefault();
                this.toggleIconSelector();
            });
        }
        
        // Event listeners para preview em tempo real
        const previewFields = ['menuIcon', 'menuTitle', 'menuPath', 'menuIsAdminOnly', 'menuIsActive'];
        previewFields.forEach(fieldId => {
            const element = elements[fieldId];
            if (element) {
                const eventType = element.type === 'checkbox' ? 'change' : 'input';
                element.addEventListener(eventType, () => {
                    this.updateMenuPreview();
                    if (fieldId === 'menuIcon') {
                        this.updateIconPreview();
                    }
                    if (['menuTitle', 'menuPath'].includes(fieldId)) {
                        this.validateField(element, fieldId.replace('menu', '').toLowerCase());
                    }
                });
            }
        });
        
        // Event listener para limpeza do modal
        if (elements.modal) {
            elements.modal.addEventListener('close', () => this.clearMenuForm());
        }
        
        // Setup do seletor de recursos
        this.setupResourceSelector();
    }
    
    async loadMenus() {
        try {
            this.setState({ isLoading: true });
            
            const response = await fetch('/api/menus', {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
                }
            });
            
            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Erro ${response.status}: ${errorText}`);
            }
            
            const menus = await response.json();
            this.state.menus = this.flattenMenus(menus);
            
            this.renderMenuTree();
            this.populateParentSelect();
            
        } catch (error) {
            console.error('Erro ao carregar menus:', error);
            this.showToast(`Erro ao carregar menus: ${error.message}`, 'danger');
            this.showErrorMessage(error.message);
        } finally {
            this.setState({ isLoading: false });
        }
    }
    
    async loadResources() {
        try {
            const response = await fetch('/api/resources?is_active=true&type=PAGE,MENU', {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
                }
            });
            
            if (!response.ok) {
                throw new Error(`Erro ${response.status}: ${response.statusText}`);
            }
            
            const result = await response.json();
            this.state.resources = result.data || result;
            
        } catch (error) {
            console.error('Erro ao carregar recursos:', error);
            this.showToast(`Erro ao carregar recursos: ${error.message}`, 'warning');
        }
    }
    
    setState(newState) {
        this.state = { ...this.state, ...newState };
    }
    
    showErrorMessage(message) {
        const menuTree = document.getElementById('menuTree');
        if (menuTree) {
            menuTree.innerHTML = `
                <div class="alert alert-danger">
                    <i class="fas fa-exclamation-triangle"></i> Erro ao carregar menus: ${message}
                    <br>
                    <small>Verifique o console para mais detalhes ou entre em contato com o suporte.</small>
                </div>
            `;
        }
    }
    
    flattenMenus(menus, parentId = null, result = []) {
        menus.forEach(menu => {
            // Adicionar menu atual
            const flatMenu = { ...menu };
            result.push(flatMenu);
            
            // Processar submenus recursivamente
            if (menu.children && menu.children.length > 0) {
                this.flattenMenus(menu.children, menu.id, result);
            }
        });
        
        return result;
    }
    
    renderMenuTree() {
        const menuTree = document.getElementById('menuTree');
        if (!menuTree) return;
        
        // Limpar árvore
        menuTree.innerHTML = '';
        
        // Verificar se há menus
        if (this.state.menus.length === 0) {
            menuTree.innerHTML = `
                <div class="alert alert-info">
                    <i class="fas fa-info-circle"></i> Nenhum menu encontrado. Clique em "Novo Menu" para criar.
                </div>
            `;
            return;
        }
        
        // Filtrar menus de nível superior (sem parentId)
        const rootMenus = this.state.menus.filter(menu => !menu.parent_id);
        
        // Mostrar menus inativos?
        const showInactive = document.getElementById('showInactiveMenus')?.checked || false;
        
        // Renderizar menus de nível superior
        rootMenus.forEach(menu => {
            // Pular menus inativos se não estiver mostrando inativos
            if (!menu.is_active && !showInactive) return;
            
            const menuItem = this.createMenuItemElement(menu);
            menuTree.appendChild(menuItem);
            
            // Renderizar submenus
            this.renderSubmenus(menu.id, menuItem, showInactive);
        });
    }
    
    renderSubmenus(parentId, parentElement, showInactive) {
        // Filtrar submenus
        const submenus = this.state.menus.filter(menu => menu.parent_id === parentId);
        
        if (submenus.length === 0) return;
        
        // Criar container para submenus com visual melhorado
        const submenuContainer = document.createElement('div');
        submenuContainer.className = 'submenu-container ml-8 mt-4 border-l-2 border-primary/20 pl-4';
        
        // Adicionar cabeçalho do submenu
        const submenuHeader = document.createElement('div');
        submenuHeader.className = 'text-sm font-medium text-base-content/70 mb-3 flex items-center gap-2';
        submenuHeader.innerHTML = `
            <i class="fas fa-level-down-alt"></i>
            Submenus (${submenus.length})
        `;
        submenuContainer.appendChild(submenuHeader);
        
        // Renderizar submenus
        submenus.forEach(submenu => {
            // Pular menus inativos se não estiver mostrando inativos
            if (!submenu.is_active && !showInactive) return;
            
            const submenuItem = this.createMenuItemElement(submenu);
            submenuContainer.appendChild(submenuItem);
            
            // Renderizar submenus recursivamente
            this.renderSubmenus(submenu.id, submenuItem, showInactive);
        });
        
        // Adicionar container de submenus ao elemento pai
        parentElement.appendChild(submenuContainer);
    }
    
    createMenuItemElement(menu) {
        const menuItem = document.createElement('div');
        menuItem.className = `menu-item ${this.state.selectedMenuId === menu.id ? 'active' : ''} hover:shadow-md transition-all duration-200`;
        menuItem.dataset.id = menu.id;
        
        // Verificar se tem submenus
        const hasSubmenus = this.state.menus.some(m => m.parent_id === menu.id);
        
        // Conteúdo do item
        menuItem.innerHTML = `
            <div class="flex items-center justify-between p-4 rounded-lg border border-base-300 bg-base-100 hover:bg-base-200 transition-colors">
                <div class="flex items-center gap-3 flex-1">
                    <div class="flex items-center justify-center w-10 h-10 rounded-full bg-primary/10 text-primary">
                        <i class="${menu.icon} text-lg"></i>
                    </div>
                    <div class="flex-1">
                        <div class="flex items-center gap-2 mb-1">
                            <h3 class="font-semibold text-base-content">${menu.title}</h3>
                            ${menu.is_admin_only ? '<span class="badge badge-error badge-sm">Admin</span>' : ''}
                            ${!menu.is_active ? '<span class="badge badge-neutral badge-sm">Inativo</span>' : ''}
                            ${hasSubmenus ? '<span class="badge badge-info badge-sm">Pai</span>' : ''}
                        </div>
                        <div class="text-sm text-base-content/70 font-mono bg-base-200 px-2 py-1 rounded">
                            ${menu.path}
                        </div>
                    </div>
                </div>
                <div class="flex items-center gap-2">
                    <button class="btn btn-ghost btn-sm edit-menu" title="Editar menu">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="btn btn-ghost btn-sm delete-menu text-error hover:text-error" title="Excluir menu">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </div>
        `;
        
        // Adicionar event listeners
        menuItem.addEventListener('click', (e) => {
            // Ignorar cliques nos botões
            if (e.target.closest('.btn')) return;
            
            // Selecionar menu
            this.selectMenu(menu.id);
        });
        
        // Botão de editar
        menuItem.querySelector('.edit-menu').addEventListener('click', () => {
            this.openMenuModal(menu.id);
        });
        
        // Botão de excluir
        menuItem.querySelector('.delete-menu').addEventListener('click', () => {
            this.deleteMenu(menu.id);
        });
        
        return menuItem;
    }
    
    selectMenu(menuId) {
        // Atualizar menu selecionado
        this.setState({ selectedMenuId: menuId });
        
        // Atualizar classe ativa
        document.querySelectorAll('.menu-item').forEach(item => {
            item.classList.toggle('active', item.dataset.id === menuId);
        });
        
        // Mostrar detalhes do menu
        this.showMenuDetails(menuId);
    }
    
    showMenuDetails(menuId) {
        const menuDetails = document.getElementById('menuDetails');
        if (!menuDetails) return;
        
        // Encontrar menu
        const menu = this.state.menus.find(m => m.id === menuId);
        if (!menu) {
            menuDetails.innerHTML = `
                <div class="alert alert-warning">
                    <i class="fas fa-exclamation-triangle"></i>
                    <span>Menu não encontrado</span>
                </div>
            `;
            return;
        }
        
        // Encontrar menu pai
        const parentMenu = menu.parent_id ? this.state.menus.find(m => m.id === menu.parent_id) : null;
        
        // Verificar se tem submenus
        const hasSubmenus = this.state.menus.some(m => m.parent_id === menuId);
        const submenus = this.state.menus.filter(m => m.parent_id === menuId);
        
        // Renderizar detalhes com visual melhorado
        menuDetails.innerHTML = `
            <div class="space-y-4">
                <!-- Header do menu -->
                <div class="text-center p-4 bg-base-200 rounded-lg">
                    <div class="flex items-center justify-center w-16 h-16 rounded-full bg-primary/20 text-primary mb-3">
                        <i class="${menu.icon} text-2xl"></i>
                    </div>
                    <h3 class="text-xl font-bold text-base-content">${menu.title}</h3>
                    <p class="text-base-content/70 font-mono text-sm mt-1">${menu.path}</p>
                </div>
                
                <!-- Status badges -->
                <div class="flex flex-wrap gap-2 justify-center">
                    ${menu.is_admin_only ? '<span class="badge badge-error">Apenas Admin</span>' : '<span class="badge badge-success">Todos os Usuários</span>'}
                    ${menu.is_active ? '<span class="badge badge-success">Ativo</span>' : '<span class="badge badge-neutral">Inativo</span>'}
                    ${hasSubmenus ? `<span class="badge badge-info">Menu Pai (${submenus.length} submenus)</span>` : '<span class="badge badge-ghost">Menu Simples</span>'}
                </div>
                
                <!-- Informações detalhadas -->
                <div class="space-y-3">
                    <div class="flex justify-between items-center p-3 bg-base-100 rounded-lg">
                        <span class="font-medium">ID:</span>
                        <span class="text-sm font-mono text-base-content/70">${menu.id}</span>
                    </div>
                    
                    <div class="flex justify-between items-center p-3 bg-base-100 rounded-lg">
                        <span class="font-medium">Ordem:</span>
                        <span class="badge badge-outline">${menu.order}</span>
                    </div>
                    
                    <div class="flex justify-between items-center p-3 bg-base-100 rounded-lg">
                        <span class="font-medium">Menu Pai:</span>
                        <span class="text-sm">${parentMenu ? parentMenu.title : 'Nenhum (Menu Principal)'}</span>
                    </div>
                    
                    <div class="flex justify-between items-center p-3 bg-base-100 rounded-lg">
                        <span class="font-medium">Recurso:</span>
                        <span class="text-sm font-mono text-base-content/70">${menu.resource_path || menu.path}</span>
                    </div>
                    
                    <div class="flex justify-between items-center p-3 bg-base-100 rounded-lg">
                        <span class="font-medium">Criado:</span>
                        <span class="text-sm">${new Date(menu.created_at).toLocaleDateString('pt-BR')}</span>
                    </div>
                    
                    <div class="flex justify-between items-center p-3 bg-base-100 rounded-lg">
                        <span class="font-medium">Atualizado:</span>
                        <span class="text-sm">${new Date(menu.updated_at).toLocaleDateString('pt-BR')}</span>
                    </div>
                </div>
                
                <!-- Submenus preview -->
                ${hasSubmenus ? `
                    <div class="mt-4">
                        <h4 class="font-medium mb-2 flex items-center gap-2">
                            <i class="fas fa-level-down-alt"></i>
                            Submenus (${submenus.length})
                        </h4>
                        <div class="space-y-2 max-h-32 overflow-y-auto">
                            ${submenus.map(submenu => `
                                <div class="flex items-center gap-2 p-2 bg-base-200 rounded text-sm">
                                    <i class="${submenu.icon} text-primary"></i>
                                    <span>${submenu.title}</span>
                                    ${submenu.is_admin_only ? '<span class="badge badge-error badge-xs">Admin</span>' : ''}
                                    ${!submenu.is_active ? '<span class="badge badge-neutral badge-xs">Inativo</span>' : ''}
                                </div>
                            `).join('')}
                        </div>
                    </div>
                ` : ''}
                
                <!-- Ações -->
                <div class="flex gap-2 mt-6">
                    <button class="btn btn-primary btn-sm flex-1" onclick="menuManager.openMenuModal('${menu.id}')">
                        <i class="fas fa-edit"></i>
                        Editar
                    </button>
                    <button class="btn btn-error btn-sm flex-1" onclick="menuManager.deleteMenu('${menu.id}')">
                        <i class="fas fa-trash"></i>
                        Excluir
                    </button>
                </div>
            </div>
        `;
    }
    
    populateParentSelect() {
        const menuParent = document.getElementById('menuParent');
        if (!menuParent) return;
        
        // Limpar opções
        menuParent.innerHTML = '<option value="">Nenhum (Menu Principal)</option>';
        
        // Adicionar opções
        this.state.menus.forEach(menu => {
            // Não adicionar o menu atual como opção de pai
            if (menu.id === this.state.selectedMenuId) return;
            
            const option = document.createElement('option');
            option.value = menu.id;
            option.textContent = menu.title;
            menuParent.appendChild(option);
        });
    }
    
    openMenuModal(menuId = null) {
        this.setState({ selectedMenuId: menuId });
        
        const modalTitle = document.getElementById('modalTitle');
        const iconSelector = document.getElementById('iconSelector');
        
        // Atualizar título do modal
        modalTitle.textContent = menuId ? 'Editar Menu' : 'Novo Menu';
        
        // Ocultar seletor de ícones
        if (iconSelector) {
            iconSelector.style.display = 'none';
        }
        
        // Preencher select de menus pais
        this.populateParentSelect();
        
        if (menuId) {
            // Preencher formulário com dados do menu
            const menu = this.state.menus.find(m => m.id === menuId);
            if (menu) {
                this.setFormData(menu);
                this.updatePreviews();
                this.validateFormFields();
            }
        } else {
            // Valores padrão para novo menu
            this.setFormData(this.config.defaultMenu);
            this.updatePreviews();
            this.clearFormValidations();
        }
        
        // Abrir modal
        this.openModal();
    }
    
    updatePreviews() {
        this.updateIconPreview();
        this.updateMenuPreview();
    }
    
    validateFormFields() {
        this.validateField(document.getElementById('menuTitle'), 'title');
        this.validateField(document.getElementById('menuPath'), 'path');
    }
    
    clearFormValidations() {
        const titleField = document.getElementById('menuTitle');
        const pathField = document.getElementById('menuPath');
        
        if (titleField) {
            this.hideFieldError(titleField.closest('.form-control'));
        }
        if (pathField) {
            this.hideFieldError(pathField.closest('.form-control'));
        }
    }
    
    openModal() {
        const modal = document.getElementById('menuModal');
        if (modal) {
            modal.showModal();
            
            // Focar no primeiro campo
            setTimeout(() => {
                const titleField = document.getElementById('menuTitle');
                if (titleField) {
                    titleField.focus();
                }
            }, 100);
        }
    }
    
    clearMenuForm() {
        const form = document.getElementById('menuForm');
        if (!form) return;
        
        form.reset();
        this.clearValidations(form);
        this.resetPreviews();
    }
    
    clearValidations(form) {
        const inputs = form.querySelectorAll('input, select');
        inputs.forEach(input => {
            input.classList.remove('input-success', 'input-error');
            const inputGroup = input.closest('.form-control');
            if (inputGroup) {
                this.hideFieldError(inputGroup);
            }
        });
    }
    
    resetPreviews() {
        this.updateIconPreview();
        this.updateMenuPreview();
    }
    
    getFormData() {
        return {
            id: document.getElementById('menuId').value,
            title: document.getElementById('menuTitle').value,
            path: document.getElementById('menuPath').value,
            icon: document.getElementById('menuIcon').value,
            order: document.getElementById('menuOrder').value,
            parent_id: document.getElementById('menuParent').value || null,
            resource_path: document.getElementById('menuResourcePath').value || null,
            resource_id: document.getElementById('menuResourceId').value || null,
            is_admin_only: document.getElementById('menuIsAdminOnly').checked,
            is_active: document.getElementById('menuIsActive').checked
        };
    }
    
    setFormData(data) {
        const fields = {
            menuId: data.id || '',
            menuTitle: data.title || '',
            menuPath: data.path || '',
            menuIcon: data.icon || this.config.defaultMenu.icon,
            menuOrder: data.order || this.config.defaultMenu.order,
            menuParent: data.parent_id || '',
            menuResourcePath: data.resource_path || '',
            menuResourceId: data.resource_id || '',
            menuIsAdminOnly: data.is_admin_only || this.config.defaultMenu.is_admin_only,
            menuIsActive: data.is_active !== undefined ? data.is_active : this.config.defaultMenu.is_active
        };
        
        Object.entries(fields).forEach(([fieldId, value]) => {
            const element = document.getElementById(fieldId);
            if (element) {
                if (element.type === 'checkbox') {
                    element.checked = value;
                } else {
                    element.value = value;
                }
            }
        });
        
        // Atualizar seleção de recurso se houver resource_id
        if (data.resource_id) {
            this.selectResource(data.resource_id);
        } else {
            this.clearResourceSelection();
        }
    }
    
    async saveMenu() {
        try {
            const formData = this.getFormData();
            
            // Validar dados
            const validationErrors = this.validateFormData(formData);
            
            if (validationErrors.length > 0) {
                this.showValidationErrors(validationErrors);
                return;
            }
            
            // Preparar dados para envio
            const menuData = this.prepareMenuData(formData);
            
            // Salvar menu
            await this.saveMenuToServer(menuData, formData.id);
            
        } catch (error) {
            console.error('Erro ao salvar menu:', error);
            this.showToast(`Erro ao salvar menu: ${error.message}`, 'danger', 8000);
        }
    }
    
    validateFormData(data) {
        const errors = [];
        
        if (!data.title || data.title.trim() === '') {
            errors.push('O título do menu é obrigatório');
        }
        
        if (!data.path || data.path.trim() === '') {
            errors.push('O caminho (path) do menu é obrigatório');
        }
        
        if (data.parent_id === data.id) {
            errors.push('Um menu não pode ser pai de si mesmo');
        }
        
        return errors;
    }
    
    showValidationErrors(errors) {
        const errorMessage = errors.join('<br>');
        this.showToast(errorMessage, 'warning');
        
        const diagArea = document.getElementById('saveMenuDiagnostic');
        if (diagArea) {
            diagArea.innerHTML = `
                <div class="alert alert-warning">
                    <strong>Erros de validação:</strong>
                    <ul>${errors.map(err => `<li>${err}</li>`).join('')}</ul>
                </div>
            `;
        }
    }
    
    prepareMenuData(formData) {
        return {
            title: String(formData.title).trim(),
            path: String(formData.path).trim(),
            icon: formData.icon ? String(formData.icon).trim() : this.config.defaultMenu.icon,
            order: parseInt(formData.order, 10) || this.config.defaultMenu.order,
            parent_id: formData.parent_id === '' || formData.parent_id === 'null' ? null : formData.parent_id,
            resource_path: formData.resource_path ? String(formData.resource_path).trim() : null,
            resource_id: formData.resource_id || null,
            is_admin_only: Boolean(formData.is_admin_only),
            is_active: Boolean(formData.is_active)
        };
    }
    
    async saveMenuToServer(menuData, menuId) {
        console.log('Enviando dados para salvar menu:', menuData);
        
        // Determinar método e URL
        const method = menuId ? 'PUT' : 'POST';
        const url = menuId ? `/api/menus/${menuId}` : '/api/menus';
        
        // Mostrar indicador de carregamento
        this.showLoadingState(true);
        
        try {
            const response = await fetch(url, {
                method,
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
                },
                body: JSON.stringify(menuData)
            });
            
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(this.getErrorMessage(response.status, errorData));
            }
            
            // Fechar modal e recarregar menus
            this.closeModal();
            await this.loadMenus();
            
            // Mostrar mensagem de sucesso
            this.showToast(`Menu ${menuId ? 'atualizado' : 'criado'} com sucesso`, 'success');
            
        } catch (error) {
            throw error;
        } finally {
            this.showLoadingState(false);
        }
    }
    
    showLoadingState(loading) {
        const saveBtn = document.querySelector('#menuModal .btn-primary');
        if (saveBtn) {
            saveBtn.disabled = loading;
            saveBtn.innerHTML = loading ? 
                '<span class="loading loading-spinner loading-sm"></span> Salvando...' : 
                '<i class="fas fa-save"></i> Salvar Menu';
        }
    }
    
    closeModal() {
        const modal = document.getElementById('menuModal');
        if (modal) {
            modal.close();
        }
    }
    
    getErrorMessage(status, errorData) {
        const errorMsg = errorData.error || errorData.details || errorData.message || `Erro ao salvar menu (${status})`;
        
        const statusMessages = {
            400: 'Dados inválidos fornecidos',
            403: 'Você não tem permissão para executar esta operação',
            404: 'Menu não encontrado',
            500: 'Erro interno do servidor'
        };
        
        return statusMessages[status] || errorMsg;
    }

    async deleteMenu(menuId) {
        if (!confirm('Tem certeza que deseja excluir este menu? Esta ação não pode ser desfeita.')) {
            return;
        }
        
        try {
            // Verificar se o menu tem submenus
            const hasSubmenus = this.state.menus.some(menu => menu.parent_id === menuId);
            if (hasSubmenus) {
                if (!confirm('Este menu possui submenus que também serão excluídos. Deseja continuar?')) {
                    return;
                }
            }
            
            // Mostrar indicador de carregamento
            const menuItem = document.querySelector(`.menu-item[data-id="${menuId}"]`);
            if (menuItem) {
                menuItem.classList.add('deleting');
                const actions = menuItem.querySelector('.menu-actions');
                if (actions) {
                    actions.innerHTML = '<div class="spinner-border spinner-border-sm text-danger" role="status"><span class="visually-hidden">Excluindo...</span></div>';
                }
            }
            
            console.log(`Enviando requisição para excluir menu: ${menuId}`);
            // Enviar requisição
            const response = await fetch(`/api/menus/${menuId}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
                }
            });
            
            // Verificar resposta
            if (!response.ok) {
                const errorData = await response.json();
                console.error('Erro ao excluir menu:', errorData);
                throw new Error(errorData.error || errorData.message || 'Erro ao excluir menu');
            }
            
            // Recarregar menus
            await this.loadMenus();
            
            // Limpar seleção
            if (this.state.selectedMenuId === menuId) {
                this.state.selectedMenuId = null;
                document.getElementById('menuDetails').innerHTML = `
                    <p class="text-muted text-center">Selecione um menu para ver os detalhes</p>
                `;
            }
            
            // Mostrar mensagem de sucesso
            this.showToast('Menu excluído com sucesso', 'success');
        } catch (error) {
            console.error('Erro ao excluir menu:', error);
            
            // Exibir mensagem de erro
            this.showToast(error.message || 'Erro ao excluir menu', 'danger', 10000);
            
            // Restaurar estado do botão
            const menuItem = document.querySelector(`.menu-item[data-id="${menuId}"]`);
            if (menuItem) {
                menuItem.classList.remove('deleting');
                const actions = menuItem.querySelector('.menu-actions');
                if (actions) {
                    actions.innerHTML = `
                        <button class="btn btn-sm btn-outline-primary btn-action edit-menu" title="Editar">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="btn btn-sm btn-outline-danger btn-action delete-menu" title="Excluir">
                            <i class="fas fa-trash"></i>
                        </button>
                    `;
                    
                    // Readicionar event listeners
                    actions.querySelector('.edit-menu').addEventListener('click', () => {
                        this.openMenuModal(menuId);
                    });
                    
                    actions.querySelector('.delete-menu').addEventListener('click', () => {
                        this.deleteMenu(menuId);
                    });
                }
            }
        }
    }
    
    toggleIconSelector() {
        const iconSelector = document.getElementById('iconSelector');
        if (!iconSelector) return;
        
        // Alternar visibilidade
        const isVisible = iconSelector.style.display !== 'none';
        iconSelector.style.display = isVisible ? 'none' : 'grid';
        
        // Se estiver mostrando, preencher com ícones
        if (!isVisible) {
            this.renderIconSelector();
        }
    }
    
    renderIconSelector() {
        const iconSelector = document.getElementById('iconSelector');
        if (!iconSelector) return;
        
        // Limpar seletor
        iconSelector.innerHTML = '';
        
        // Adicionar cabeçalho
        const header = document.createElement('div');
        header.className = 'flex items-center justify-between mb-3';
        header.innerHTML = `
            <h5 class="font-medium">Selecionar Ícone</h5>
            <button type="button" class="btn btn-ghost btn-sm" onclick="menuManager.toggleIconSelector()">
                <i class="fas fa-times"></i>
            </button>
        `;
        iconSelector.appendChild(header);
        
        // Container para os ícones
        const iconGrid = document.createElement('div');
        iconGrid.className = 'grid grid-cols-6 gap-2 max-h-48 overflow-y-auto';
        
        // Adicionar ícones
        this.config.iconList.forEach(icon => {
            const iconOption = document.createElement('div');
            iconOption.className = 'icon-option p-2 rounded-lg border border-base-300 hover:bg-base-200 cursor-pointer transition-colors';
            iconOption.innerHTML = `<i class="${icon} text-lg"></i>`;
            
            // Marcar como selecionado se for o ícone atual
            const currentIcon = document.getElementById('menuIcon').value;
            if (currentIcon === icon) {
                iconOption.classList.add('bg-primary', 'text-primary-content', 'border-primary');
            }
            
            // Adicionar event listener
            iconOption.addEventListener('click', () => {
                document.getElementById('menuIcon').value = icon;
                this.updateIconPreview();
                this.updateMenuPreview();
                
                // Atualizar seleção visual
                document.querySelectorAll('.icon-option').forEach(option => {
                    option.classList.remove('bg-primary', 'text-primary-content', 'border-primary');
                });
                iconOption.classList.add('bg-primary', 'text-primary-content', 'border-primary');
            });
            
            iconGrid.appendChild(iconOption);
        });
        
        iconSelector.appendChild(iconGrid);
    }
    
    updateIconPreview() {
        const iconPreview = document.getElementById('iconPreview');
        const menuIcon = document.getElementById('menuIcon');
        
        if (iconPreview && menuIcon) {
            // Remover classes existentes
            iconPreview.className = '';
            
            // Adicionar nova classe
            iconPreview.className = menuIcon.value;
        }
    }

    updateMenuPreview() {
        const previewIcon = document.getElementById('previewIcon');
        const previewTitle = document.getElementById('previewTitle');
        const previewPath = document.getElementById('previewPath');
        const previewAdminBadge = document.getElementById('previewAdminBadge');
        const previewInactiveBadge = document.getElementById('previewInactiveBadge');
        
        if (!previewIcon || !previewTitle || !previewPath) return;
        
        const menuTitle = document.getElementById('menuTitle').value || 'Título do Menu';
        const menuPath = document.getElementById('menuPath').value || '/caminho/do/menu';
        const menuIcon = document.getElementById('menuIcon').value || 'fas fa-link';
        const menuIsAdminOnly = document.getElementById('menuIsAdminOnly').checked;
        const menuIsActive = document.getElementById('menuIsActive').checked;
        
        // Atualizar ícone
        previewIcon.className = menuIcon;
        
        // Atualizar título
        previewTitle.textContent = menuTitle;
        
        // Atualizar caminho
        previewPath.textContent = menuPath;
        
        // Atualizar badges
        if (previewAdminBadge) {
            previewAdminBadge.style.display = menuIsAdminOnly ? 'inline-block' : 'none';
        }
        
        if (previewInactiveBadge) {
            previewInactiveBadge.style.display = !menuIsActive ? 'inline-block' : 'none';
        }
    }
    
    validateField(field, type) {
        const value = field.value.trim();
        const inputGroup = field.closest('.form-control');
        const rules = this.config.validationRules[type];
        
        if (!rules) return;
        
        // Remover classes de validação anteriores
        field.classList.remove('input-success', 'input-error');
        
        // Validar campo obrigatório
        if (rules.required && value.length === 0) {
            field.classList.add('input-error');
            this.showFieldError(inputGroup, `${this.getFieldLabel(type)} é obrigatório`);
            return;
        }
        
        // Validar comprimento mínimo
        if (rules.minLength && value.length < rules.minLength) {
            field.classList.add('input-error');
            this.showFieldError(inputGroup, `${this.getFieldLabel(type)} deve ter pelo menos ${rules.minLength} caracteres`);
            return;
        }
        
        // Validar formato específico
        if (rules.mustStartWith && !value.startsWith(rules.mustStartWith)) {
            field.classList.add('input-error');
            this.showFieldError(inputGroup, `${this.getFieldLabel(type)} deve começar com ${rules.mustStartWith}`);
            return;
        }
        
        // Campo válido
        field.classList.add('input-success');
        this.hideFieldError(inputGroup);
    }
    
    getFieldLabel(type) {
        const labels = {
            title: 'Título',
            path: 'Caminho'
        };
        return labels[type] || type;
    }
    
    showFieldError(inputGroup, message) {
        // Remover mensagem de erro anterior
        this.hideFieldError(inputGroup);
        
        // Adicionar nova mensagem de erro
        const errorDiv = document.createElement('div');
        errorDiv.className = 'label-text-alt text-error mt-1';
        errorDiv.textContent = message;
        inputGroup.appendChild(errorDiv);
    }
    
    hideFieldError(inputGroup) {
        const existingError = inputGroup.querySelector('.label-text-alt.text-error');
        if (existingError) {
            existingError.remove();
        }
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
    
    setupResourceSelector() {
        const resourceSearch = document.getElementById('resourceSearch');
        const resourceList = document.getElementById('resourceList');
        const selectedResource = document.getElementById('selectedResource');
        
        if (!resourceSearch || !resourceList || !selectedResource) return;
        
        // Event listener para busca de recursos
        resourceSearch.addEventListener('input', (e) => {
            const searchTerm = e.target.value.toLowerCase();
            this.filterResources(searchTerm);
        });
        
        // Event listener para seleção de recurso
        resourceList.addEventListener('click', (e) => {
            const resourceItem = e.target.closest('.resource-item');
            if (resourceItem) {
                const resourceId = resourceItem.dataset.id;
                this.selectResource(resourceId);
            }
        });
        
        // Event listener para limpar seleção
        const clearResourceBtn = document.getElementById('clearResourceBtn');
        if (clearResourceBtn) {
            clearResourceBtn.addEventListener('click', () => {
                this.clearResourceSelection();
            });
        }
    }
    
    filterResources(searchTerm) {
        const resourceList = document.getElementById('resourceList');
        if (!resourceList) return;
        
        const filteredResources = this.state.resources.filter(resource => 
            resource.name.toLowerCase().includes(searchTerm) ||
            resource.path.toLowerCase().includes(searchTerm) ||
            resource.description?.toLowerCase().includes(searchTerm)
        );
        
        this.renderResourceList(filteredResources);
    }
    
    renderResourceList(resources) {
        const resourceList = document.getElementById('resourceList');
        if (!resourceList) return;
        
        if (resources.length === 0) {
            resourceList.innerHTML = '<div class="p-4 text-center text-base-content/70">Nenhum recurso encontrado</div>';
            return;
        }
        
        resourceList.innerHTML = resources.map(resource => `
            <div class="resource-item p-3 hover:bg-base-200 cursor-pointer border-b border-base-300" data-id="${resource.id}">
                <div class="flex items-center gap-3">
                    <div class="flex items-center justify-center w-8 h-8 rounded-full bg-primary/10 text-primary">
                        <i class="${resource.icon || 'fas fa-link'}"></i>
                    </div>
                    <div class="flex-1">
                        <div class="font-medium">${resource.name}</div>
                        <div class="text-sm text-base-content/70">${resource.path}</div>
                        ${resource.description ? `<div class="text-xs text-base-content/50">${resource.description}</div>` : ''}
                    </div>
                    <div class="badge badge-sm ${resource.is_active ? 'badge-success' : 'badge-error'}">
                        ${resource.is_active ? 'Ativo' : 'Inativo'}
                    </div>
                </div>
            </div>
        `).join('');
    }
    
    selectResource(resourceId) {
        const resource = this.state.resources.find(r => r.id === resourceId);
        if (!resource) return;
        
        // Atualizar campo de recurso selecionado
        const selectedResource = document.getElementById('selectedResource');
        if (selectedResource) {
            selectedResource.innerHTML = `
                <div class="flex items-center gap-3 p-3 bg-base-200 rounded-lg">
                    <div class="flex items-center justify-center w-10 h-10 rounded-full bg-primary/10 text-primary">
                        <i class="${resource.icon || 'fas fa-link'}"></i>
                    </div>
                    <div class="flex-1">
                        <div class="font-medium">${resource.name}</div>
                        <div class="text-sm text-base-content/70">${resource.path}</div>
                    </div>
                    <button type="button" class="btn btn-ghost btn-sm" onclick="menuManager.clearResourceSelection()">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
            `;
        }
        
        // Preencher campos do formulário
        document.getElementById('menuResourcePath').value = resource.path;
        document.getElementById('menuResourceId').value = resource.id;
        
        // Atualizar preview
        this.updateMenuPreview();
        
        // Fechar lista de recursos
        const resourceList = document.getElementById('resourceList');
        if (resourceList) {
            resourceList.innerHTML = '';
        }
        
        // Limpar busca
        const resourceSearch = document.getElementById('resourceSearch');
        if (resourceSearch) {
            resourceSearch.value = '';
        }
    }
    
    clearResourceSelection() {
        const selectedResource = document.getElementById('selectedResource');
        if (selectedResource) {
            selectedResource.innerHTML = `
                <div class="text-center p-4 text-base-content/70">
                    <i class="fas fa-search text-2xl mb-2"></i>
                    <div>Nenhum recurso selecionado</div>
                    <div class="text-xs">Digite para buscar recursos</div>
                </div>
            `;
        }
        
        document.getElementById('menuResourcePath').value = '';
        document.getElementById('menuResourceId').value = '';
        
        this.updateMenuPreview();
    }
}

// Inicializar quando o DOM estiver pronto
document.addEventListener('DOMContentLoaded', () => {
    window.menuManager = new MenuManager();
}); 