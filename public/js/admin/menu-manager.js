class MenuManager {
    constructor() {
        this.menus = [];
        this.selectedMenuId = null;
        this.iconList = [
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
        ];
        
        this.init();
    }
    
    async init() {
        try {
            // Configurar event listeners
            this.setupEventListeners();
            
            // Carregar menus
            await this.loadMenus();
        } catch (error) {
            console.error('Erro ao inicializar gerenciador de menus:', error);
            this.showToast('Erro ao inicializar gerenciador de menus', 'danger');
        }
    }
    
    setupEventListeners() {
        // Mostrar/ocultar menus inativos
        const showInactiveMenus = document.getElementById('showInactiveMenus');
        if (showInactiveMenus) {
            showInactiveMenus.addEventListener('change', () => {
                this.renderMenuTree();
            });
        }
        
        // Seletor de ícones
        const iconSelectorBtn = document.getElementById('iconSelectorBtn');
        if (iconSelectorBtn) {
            iconSelectorBtn.addEventListener('click', (e) => {
                e.preventDefault();
                this.toggleIconSelector();
            });
        }
        
        // Atualizar preview do ícone
        const menuIcon = document.getElementById('menuIcon');
        if (menuIcon) {
            menuIcon.addEventListener('input', () => {
                this.updateIconPreview();
            });
        }
    }
    
    async loadMenus() {
        try {
            console.log('Tentando carregar menus...');
            const response = await fetch('/api/menus', {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
                }
            });
            
            if (!response.ok) {
                const errorText = await response.text();
                console.error(`Erro ao carregar menus: ${response.status} - ${errorText}`);
                throw new Error(`Erro ${response.status}: ${errorText}`);
            }
            
            const menus = await response.json();
            this.menus = this.flattenMenus(menus);
            
            console.log('Menus carregados com sucesso:', this.menus);
            
            // Renderizar árvore de menus
            this.renderMenuTree();
            
            // Preencher select de menus pais
            this.populateParentSelect();
        } catch (error) {
            console.error('Erro ao carregar menus:', error);
            this.showToast(`Erro ao carregar menus: ${error.message}`, 'danger');
            
            // Mostrar mensagem de erro na árvore de menus
            const menuTree = document.getElementById('menuTree');
            if (menuTree) {
                menuTree.innerHTML = `
                    <div class="alert alert-danger">
                        <i class="fas fa-exclamation-triangle"></i> Erro ao carregar menus: ${error.message}
                        <br>
                        <small>Verifique o console para mais detalhes ou entre em contato com o suporte.</small>
                    </div>
                `;
            }
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
        if (this.menus.length === 0) {
            menuTree.innerHTML = `
                <div class="alert alert-info">
                    <i class="fas fa-info-circle"></i> Nenhum menu encontrado. Clique em "Novo Menu" para criar.
                </div>
            `;
            return;
        }
        
        // Filtrar menus de nível superior (sem parentId)
        const rootMenus = this.menus.filter(menu => !menu.parentId);
        
        // Mostrar menus inativos?
        const showInactive = document.getElementById('showInactiveMenus')?.checked || false;
        
        // Renderizar menus de nível superior
        rootMenus.forEach(menu => {
            // Pular menus inativos se não estiver mostrando inativos
            if (!menu.isActive && !showInactive) return;
            
            const menuItem = this.createMenuItemElement(menu);
            menuTree.appendChild(menuItem);
            
            // Renderizar submenus
            this.renderSubmenus(menu.id, menuItem, showInactive);
        });
    }
    
    renderSubmenus(parentId, parentElement, showInactive) {
        // Filtrar submenus
        const submenus = this.menus.filter(menu => menu.parentId === parentId);
        
        if (submenus.length === 0) return;
        
        // Criar container para submenus
        const submenuContainer = document.createElement('div');
        submenuContainer.className = 'submenu-container';
        
        // Renderizar submenus
        submenus.forEach(submenu => {
            // Pular menus inativos se não estiver mostrando inativos
            if (!submenu.isActive && !showInactive) return;
            
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
        menuItem.className = `menu-item ${this.selectedMenuId === menu.id ? 'active' : ''}`;
        menuItem.dataset.id = menu.id;
        
        // Conteúdo do item
        menuItem.innerHTML = `
            <div class="d-flex justify-content-between align-items-center">
                <div>
                    <span class="icon-preview"><i class="${menu.icon}"></i></span>
                    <span>${menu.title}</span>
                    ${menu.isAdminOnly ? '<span class="admin-badge">Admin</span>' : ''}
                    ${!menu.isActive ? '<span class="inactive-badge">Inativo</span>' : ''}
                    <div class="menu-path">${menu.path}</div>
                </div>
                <div class="menu-actions">
                    <button class="btn btn-sm btn-outline-primary btn-action edit-menu" title="Editar">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="btn btn-sm btn-outline-danger btn-action delete-menu" title="Excluir">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </div>
        `;
        
        // Adicionar event listeners
        menuItem.addEventListener('click', (e) => {
            // Ignorar cliques nos botões
            if (e.target.closest('.btn-action')) return;
            
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
        this.selectedMenuId = menuId;
        
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
        const menu = this.menus.find(m => m.id === menuId);
        if (!menu) {
            menuDetails.innerHTML = `
                <div class="alert alert-warning">
                    <i class="fas fa-exclamation-triangle"></i> Menu não encontrado
                </div>
            `;
            return;
        }
        
        // Encontrar menu pai
        const parentMenu = menu.parentId ? this.menus.find(m => m.id === menu.parentId) : null;
        
        // Renderizar detalhes
        menuDetails.innerHTML = `
            <div class="mb-3 text-center">
                <span class="icon-preview" style="font-size: 2rem;">
                    <i class="${menu.icon}"></i>
                </span>
                <h4 class="mt-2">${menu.title}</h4>
                <div class="text-muted">${menu.path}</div>
            </div>
            
            <div class="mb-3">
                <strong>ID:</strong> <span class="text-muted">${menu.id}</span>
            </div>
            
            <div class="mb-3">
                <strong>Ordem:</strong> ${menu.order}
            </div>
            
            <div class="mb-3">
                <strong>Menu Pai:</strong> ${parentMenu ? parentMenu.title : 'Nenhum (Menu Principal)'}
            </div>
            
            <div class="mb-3">
                <strong>Caminho do Recurso:</strong> <span class="text-muted">${menu.resourcePath || menu.path}</span>
            </div>
            
            <div class="mb-3">
                <strong>Status:</strong> 
                <span class="badge ${menu.isActive ? 'bg-success' : 'bg-secondary'}">
                    ${menu.isActive ? 'Ativo' : 'Inativo'}
                </span>
            </div>
            
            <div class="mb-3">
                <strong>Acesso:</strong> 
                <span class="badge ${menu.isAdminOnly ? 'bg-danger' : 'bg-primary'}">
                    ${menu.isAdminOnly ? 'Apenas Administradores' : 'Todos os Usuários'}
                </span>
            </div>
            
            <div class="mb-3">
                <strong>Criado em:</strong> ${new Date(menu.createdAt).toLocaleString()}
            </div>
            
            <div class="mb-3">
                <strong>Atualizado em:</strong> ${new Date(menu.updatedAt).toLocaleString()}
            </div>
            
            <div class="d-flex justify-content-center gap-2 mt-4">
                <button class="btn btn-primary" onclick="menuManager.openMenuModal('${menu.id}')">
                    <i class="fas fa-edit"></i> Editar
                </button>
                <button class="btn btn-danger" onclick="menuManager.deleteMenu('${menu.id}')">
                    <i class="fas fa-trash"></i> Excluir
                </button>
            </div>
        `;
    }
    
    populateParentSelect() {
        const menuParent = document.getElementById('menuParent');
        if (!menuParent) return;
        
        // Limpar opções
        menuParent.innerHTML = '<option value="">Nenhum (Menu Principal)</option>';
        
        // Adicionar opções
        this.menus.forEach(menu => {
            // Não adicionar o menu atual como opção de pai
            if (menu.id === this.selectedMenuId) return;
            
            const option = document.createElement('option');
            option.value = menu.id;
            option.textContent = menu.title;
            menuParent.appendChild(option);
        });
    }
    
    openMenuModal(menuId = null) {
        this.selectedMenuId = menuId;
        
        const modalTitle = document.getElementById('modalTitle');
        const menuForm = document.getElementById('menuForm');
        
        // Atualizar título do modal
        modalTitle.textContent = menuId ? 'Editar Menu' : 'Novo Menu';
        
        // Limpar formulário
        menuForm.reset();
        
        // Ocultar seletor de ícones
        document.getElementById('iconSelector').style.display = 'none';
        
        // Preencher select de menus pais
        this.populateParentSelect();
        
        if (menuId) {
            // Preencher formulário com dados do menu
            const menu = this.menus.find(m => m.id === menuId);
            if (menu) {
                document.getElementById('menuId').value = menu.id;
                document.getElementById('menuTitle').value = menu.title;
                document.getElementById('menuPath').value = menu.path;
                document.getElementById('menuIcon').value = menu.icon;
                document.getElementById('menuOrder').value = menu.order;
                document.getElementById('menuParent').value = menu.parentId || '';
                document.getElementById('menuResourcePath').value = menu.resourcePath || '';
                document.getElementById('menuIsAdminOnly').checked = menu.isAdminOnly;
                document.getElementById('menuIsActive').checked = menu.isActive;
                
                // Atualizar preview do ícone
                this.updateIconPreview();
            }
        } else {
            // Valores padrão para novo menu
            document.getElementById('menuId').value = '';
            document.getElementById('menuIcon').value = 'fas fa-link';
            document.getElementById('menuOrder').value = '0';
            document.getElementById('menuIsAdminOnly').checked = false;
            document.getElementById('menuIsActive').checked = true;
            
            // Atualizar preview do ícone
            this.updateIconPreview();
        }
        
        // Abrir modal
        const modal = new bootstrap.Modal(document.getElementById('menuModal'));
        modal.show();
    }
    
    async saveMenu() {
        try {
            // Obter dados do formulário
            const menuId = document.getElementById('menuId').value;
            const title = document.getElementById('menuTitle').value;
            const path = document.getElementById('menuPath').value;
            const icon = document.getElementById('menuIcon').value;
            const order = document.getElementById('menuOrder').value;
            const parentId = document.getElementById('menuParent').value || null;
            const resourcePath = document.getElementById('menuResourcePath').value || null;
            const isAdminOnly = document.getElementById('menuIsAdminOnly').checked;
            const isActive = document.getElementById('menuIsActive').checked;
            
            // Validação de dados mais rigorosa
            const validationErrors = [];
            
            if (!title || title.trim() === '') {
                validationErrors.push('O título do menu é obrigatório');
            }
            
            if (!path || path.trim() === '') {
                validationErrors.push('O caminho (path) do menu é obrigatório');
            }
            
            if (parentId === menuId) {
                validationErrors.push('Um menu não pode ser pai de si mesmo');
            }
            
            // Se houver erros de validação, mostrar e interromper o envio
            if (validationErrors.length > 0) {
                const errorMessage = validationErrors.join('<br>');
                this.showToast(errorMessage, 'warning');
                
                // Adicionar informações ao diagnóstico se existir
                const diagArea = document.getElementById('saveMenuDiagnostic');
                if (diagArea) {
                    diagArea.innerHTML = `
                        <div class="alert alert-warning">
                            <strong>Erros de validação:</strong>
                            <ul>${validationErrors.map(err => `<li>${err}</li>`).join('')}</ul>
                        </div>
                    `;
                }
                
                return;
            }
            
            // Preparar dados com tipos de dados corretos
            const menuData = {
                title: String(title).trim(),
                path: String(path).trim(),
                icon: icon ? String(icon).trim() : 'fas fa-link',
                order: parseInt(order, 10) || 0,
                parentId: parentId === '' || parentId === 'null' ? null : parentId,
                resourcePath: resourcePath ? String(resourcePath).trim() : null,
                isAdminOnly: Boolean(isAdminOnly),
                isActive: Boolean(isActive)
            };
            
            console.log('Enviando dados para salvar menu:', menuData);
            
            // Determinar método e URL
            const method = menuId ? 'PUT' : 'POST';
            const url = menuId ? `/api/menus/${menuId}` : '/api/menus';
            
            // Exibir debugging detalhado
            console.log(`Método HTTP: ${method}`);
            console.log(`URL da requisição: ${url}`);
            console.log(`Token de autenticação presente: ${!!localStorage.getItem('auth_token')}`);
            console.log(`Payload JSON: ${JSON.stringify(menuData, null, 2)}`);
            
            // Mostrar indicador de carregamento
            const saveBtn = document.querySelector('#menuModal .btn-primary');
            if (saveBtn) {
                saveBtn.disabled = true;
                saveBtn.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Salvando...';
            }
            
            // Adicionar informações de diagnóstico na página
            const diagArea = document.createElement('div');
            diagArea.id = 'saveMenuDiagnostic';
            diagArea.className = 'alert alert-info mt-3';
            diagArea.innerHTML = '<strong>Diagnóstico da requisição:</strong><pre>Enviando requisição...</pre>';
            document.getElementById('menuForm').appendChild(diagArea);
            
            // Acompanhar início da requisição
            const startTime = Date.now();
            
            let responseData;
            let responseText;
            
            try {
            // Enviar requisição
            const response = await fetch(url, {
                method,
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
                },
                body: JSON.stringify(menuData)
            });
                
                // Calcular tempo de resposta
                const responseTime = Date.now() - startTime;
                console.log(`Tempo de resposta: ${responseTime}ms`);
                
                // Mostrar informações da resposta
                document.getElementById('saveMenuDiagnostic').innerHTML = `
                    <strong>Diagnóstico da requisição:</strong>
                    <div>Status: ${response.status} ${response.statusText}</div>
                    <div>Tempo: ${responseTime}ms</div>
                    <div>Headers:</div>
                    <pre>${JSON.stringify(Object.fromEntries([...response.headers]), null, 2)}</pre>
                `;
                
                // Processar resposta
                responseText = await response.text();
                
                try {
                    // Tentar converter para JSON
                    responseData = JSON.parse(responseText);
                    console.log('Resposta do servidor (JSON):', responseData);
                    
                    // Adicionar ao diagnóstico
                    document.getElementById('saveMenuDiagnostic').innerHTML += `
                        <div>Resposta:</div>
                        <pre>${JSON.stringify(responseData, null, 2)}</pre>
                    `;
            
            if (!response.ok) {
                        console.error('Erro na resposta:', response.status, responseData);
                        
                        // Verificar códigos de erro específicos
                        let errorMsg = responseData.error || responseData.details || responseData.message || `Erro ao salvar menu (${response.status})`;
                        
                        // Mensagens mais amigáveis para códigos específicos
                        if (response.status === 400) {
                            if (errorMsg.includes('pai de si mesmo')) {
                                errorMsg = 'Um menu não pode ser pai de si mesmo. Por favor, selecione outro menu pai ou nenhum.';
                            } else if (errorMsg.includes('pai não encontrado')) {
                                errorMsg = 'O menu pai selecionado não existe mais. Por favor, selecione outro menu pai.';
                            } else if (errorMsg.includes('título') || errorMsg.includes('caminho')) {
                                errorMsg = 'O título e o caminho do menu são obrigatórios e não podem estar vazios.';
                            }
                        } else if (response.status === 403) {
                            errorMsg = 'Você não tem permissão para executar esta operação.';
                        } else if (response.status === 404) {
                            errorMsg = 'Menu não encontrado. Ele pode ter sido excluído por outro usuário.';
                        } else if (response.status === 500) {
                            errorMsg = 'Erro interno do servidor. Por favor, tente novamente mais tarde.';
                            
                            if (responseData.details) {
                                console.error('Detalhes do erro 500:', responseData.details);
                                
                                // Mostrar detalhes técnicos do erro para administradores, mas com mensagem amigável para o usuário
                                errorMsg += ' (Detalhes técnicos foram registrados para análise).';
                                
                                // Adicionar informações de depuração na área de diagnóstico
                                document.getElementById('saveMenuDiagnostic').innerHTML += `
                                    <div class="error-details" style="margin-top: 10px; padding: 10px; border: 1px solid #ffcccc; background-color: #fff5f5;">
                                        <strong>Detalhes técnicos do erro (apenas para administradores):</strong><br>
                                        ${responseData.details}
                                    </div>
                                `;
                            }
                        }
                        
                        throw new Error(errorMsg);
                    }
                } catch (jsonError) {
                    // Resposta não é JSON válido
                    console.error('Resposta não é JSON válido:', responseText);
                    document.getElementById('saveMenuDiagnostic').innerHTML += `
                        <div>Resposta (não é JSON válido):</div>
                        <pre>${responseText}</pre>
                    `;
                    throw new Error('Resposta inválida do servidor');
            }
            
            // Fechar modal
            const modal = bootstrap.Modal.getInstance(document.getElementById('menuModal'));
            modal.hide();
            
            // Recarregar menus
            await this.loadMenus();
            
            // Mostrar mensagem de sucesso
            this.showToast(`Menu ${menuId ? 'atualizado' : 'criado'} com sucesso`, 'success');
            } catch (fetchError) {
                console.error('Erro na requisição fetch:', fetchError);
                
                if (document.getElementById('saveMenuDiagnostic')) {
                    document.getElementById('saveMenuDiagnostic').innerHTML += `
                        <div class="text-danger">Erro na requisição: ${fetchError.message}</div>
                    `;
                }
                
                throw fetchError; // Relançar para o tratamento geral
            }
        } catch (error) {
            console.error('Erro ao salvar menu:', error);
            this.showToast(`Erro ao salvar menu: ${error.message}`, 'danger', 8000);
        } finally {
            // Restaurar botão de salvar
            const saveBtn = document.querySelector('#menuModal .btn-primary');
            if (saveBtn) {
                saveBtn.disabled = false;
                saveBtn.innerHTML = '<i class="fas fa-save"></i> Salvar';
            }
            
            // Manter a área de diagnóstico para análise
            setTimeout(() => {
                const diagArea = document.getElementById('saveMenuDiagnostic');
                if (diagArea) {
                    diagArea.classList.remove('alert-info');
                    diagArea.classList.add('alert-secondary');
                    diagArea.innerHTML += `<div class="mt-2"><small>Este diagnóstico será removido em 30 segundos</small></div>`;
                    
                    setTimeout(() => {
                        if (diagArea && diagArea.parentNode) {
                            diagArea.parentNode.removeChild(diagArea);
                        }
                    }, 30000);
                }
            }, 1000);
        }
    }
    
    async deleteMenu(menuId) {
        if (!confirm('Tem certeza que deseja excluir este menu? Esta ação não pode ser desfeita.')) {
            return;
        }
        
        try {
            // Verificar se o menu tem submenus
            const hasSubmenus = this.menus.some(menu => menu.parentId === menuId);
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
            if (this.selectedMenuId === menuId) {
                this.selectedMenuId = null;
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
        
        // Adicionar ícones
        this.iconList.forEach(icon => {
            const iconOption = document.createElement('div');
            iconOption.className = 'icon-option';
            iconOption.innerHTML = `<i class="${icon}"></i>`;
            
            // Marcar como selecionado se for o ícone atual
            const currentIcon = document.getElementById('menuIcon').value;
            if (currentIcon === icon) {
                iconOption.classList.add('selected');
            }
            
            // Adicionar event listener
            iconOption.addEventListener('click', () => {
                document.getElementById('menuIcon').value = icon;
                this.updateIconPreview();
                
                // Atualizar seleção
                document.querySelectorAll('.icon-option').forEach(option => {
                    option.classList.remove('selected');
                });
                iconOption.classList.add('selected');
            });
            
            iconSelector.appendChild(iconOption);
        });
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
    window.menuManager = new MenuManager();
}); 