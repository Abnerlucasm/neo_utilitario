class ContentManager {
    constructor(config) {
        this.config = {
            contentType: '',
            apiEndpoint: '/api/content',
            ...config
        };
        
        this.content = {};
        this.sections = [];
        this.currentPage = null;
        this.loadedComponents = new Map(); // Cache de componentes
    }

    async init(containerId) {
        this.container = document.getElementById(containerId);
        if (!this.container) {
            console.error(`Container ${containerId} não encontrado`);
            return;
        }

        await this.loadContent();
        this.render();
        this.setupEvents();
    }

    async loadContent() {
        try {
            const response = await fetch(`${this.config.apiEndpoint}/${this.config.contentType}`);
            if (!response.ok) throw new Error('Erro ao carregar conteúdo');
            
            const data = await response.json();
            this.content = data.content || {};
            this.sections = data.sections || [];
        } catch (error) {
            console.error('Erro ao carregar conteúdo:', error);
            this.content = {};
            this.sections = [];
        }
    }

    render() {
        if (!this.container) return;
        
        this.container.innerHTML = `
            <div class="content-editor p-4">
                <h1 class="title">Gerenciar Conteúdo</h1>
                
                <div class="sections-manager mb-4">
                    <h2 class="subtitle">Seções</h2>
                    ${this.renderSections()}
                    <div class="field has-addons">
                        <div class="control">
                            <input class="input" type="text" id="newSectionInput" placeholder="Nome da nova seção">
                        </div>
                        <div class="control">
                            <button class="button is-primary" id="addSection">
                                <span class="icon"><i class="fas fa-plus"></i></span>
                                <span>Adicionar</span>
                            </button>
                        </div>
                    </div>
                </div>

                ${this.currentPage ? this.renderPageEditor() : ''}
            </div>
        `;
    }

    setupEvents() {
        if (!this.container) return;

        // Eventos básicos do gerenciador de conteúdo
        const addSectionBtn = this.container.querySelector('#addSection');
        const newSectionInput = this.container.querySelector('#newSectionInput');

        if (addSectionBtn && newSectionInput) {
            addSectionBtn.addEventListener('click', () => this.addSection(newSectionInput.value));
        }

        // Configurar eventos de seções
        this.container.querySelectorAll('[data-section]').forEach(element => {
            element.addEventListener('click', (e) => {
                const sectionId = e.currentTarget.dataset.section;
                this.toggleSection(sectionId);
            });
        });

        // Configurar eventos de páginas
        this.container.querySelectorAll('[data-page]').forEach(element => {
            element.addEventListener('click', (e) => {
                const pageId = e.currentTarget.dataset.page;
                this.loadPage(pageId);
            });
        });
    }

    addSection(name) {
        if (!name.trim()) return;
        
        this.sections.push({
            id: name.toLowerCase().replace(/\s+/g, '-'),
            name: name.trim(),
            pages: []
        });
        
        this.render();
    }

    loadPage(pageId) {
        this.currentPage = pageId;
        this.render();
    }

    async saveContent() {
        try {
            console.log('Salvando conteúdo:', {
                content: this.content,
                sections: this.sections
            });

            const response = await fetch(`${this.config.apiEndpoint}/${this.config.contentType}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    content: this.content,
                    sections: this.sections
                })
            });

            if (!response.ok) {
                const errorText = await response.text();
                console.error('Erro na resposta:', errorText);
                throw new Error('Erro ao salvar conteúdo');
            }

            const result = await response.json();
            console.log('Resposta do servidor:', result);

            if (result.success) {
                // Atualizar conteúdo local com o retornado pelo servidor
                if (result.content) {
                    // Garantir que o conteúdo seja um objeto
                    this.content = typeof result.content.content === 'object' ? 
                        result.content.content : this.content;
                    
                    // Garantir que as seções sejam um array
                    this.sections = Array.isArray(result.content.sections) ? 
                        result.content.sections : this.sections;
                }
                return true;
            }
            return false;
        } catch (error) {
            console.error('Erro ao salvar conteúdo:', error);
            throw error;
        }
    }

    async loadSections() {
        try {
            const saved = localStorage.getItem(`${this.config.storageKey}_sections`);
            this.sections = saved ? JSON.parse(saved) : [];
        } catch (error) {
            console.error('Erro ao carregar seções:', error);
            this.sections = [];
        }
    }

    renderSections() {
        return this.sections.map(section => `
            <li>
                <a data-section="${section.id}" class="section-item">
                    <span class="section-name" data-section-id="${section.id}">${section.name}</span>
                    <div class="section-actions">
                        <button class="button is-small" data-rename-section="${section.id}" title="Renomear seção">
                            <span class="icon is-small">
                                <i class="fas fa-edit"></i>
                            </span>
                        </button>
                    </div>
                    <button class="delete is-small" data-delete-section="${section.id}"></button>
                </a>
                <ul class="menu-list">
                    ${section.pages.map(pageId => `
                        <li>
                            <a data-page="${pageId}" class="page-item ${this.currentPage === pageId ? 'is-active' : ''}">
                                <div class="page-item-content">
                                    ${this.content[pageId]?.title || 'Página sem título'}
                                </div>
                                <div class="page-actions">
                                    <button class="delete is-small" data-delete-page="${pageId}" title="Excluir página"></button>
                                </div>
                            </a>
                        </li>
                    `).join('')}
                    <li>
                        <a class="add-page" data-section="${section.id}">
                            <span class="icon is-small">
                                <i class="fas fa-plus"></i>
                            </span>
                            <span>Nova Página</span>
                        </a>
                    </li>
                </ul>
            </li>
        `).join('');
    }

    createNewPage(sectionId) {
        const section = this.sections.find(s => s.id === sectionId);
        if (!section) return;

        const pageId = `page-${Date.now()}`;
        if (!this.content || typeof this.content !== 'object') {
            this.content = {};
        }

        this.content[pageId] = {
            title: 'Nova Página',
            content: '# Nova Página\n\nAdicione seu conteúdo aqui.',
            components: []
        };
        
        section.pages.push(pageId);
        // Salvar e atualizar a interface
        this.saveContent().then(() => {
            this.currentPage = pageId;
            this.render();
            this.loadPage(pageId);
        });
    }

    selectSection(sectionId) {
        const section = this.sections.find(s => s.id === sectionId);
        if (section && section.pages.length > 0) {
            this.loadPage(section.pages[0]);
        }
    }

    async loadPage(pageId) {
        if (!pageId) return;

        try {
            const page = this.content[pageId];
            if (!page) {
                console.error('Página não encontrada:', pageId);
                return;
            }

            this.currentPage = pageId;
            
            // Atualizar o editor
            const editorContainer = document.getElementById('editorContainer');
            if (editorContainer) {
                editorContainer.innerHTML = this.renderEditor();
            }

            // Atualizar campos
            const pageTitleInput = document.getElementById('pageTitle');
            const pageContentInput = document.getElementById('pageContent');
            const pageIdInput = document.getElementById('pageId');

            if (pageIdInput) pageIdInput.value = pageId;
            if (pageTitleInput) pageTitleInput.value = page.title || '';
            if (pageContentInput) pageContentInput.value = page.content || '';

            // Atualizar links ativos
            document.querySelectorAll('.page-item').forEach(item => {
                const isActive = item.dataset.page === pageId;
                item.classList.toggle('is-active', isActive);
                // Atualizar título na lista
                if (isActive) {
                    const titleElement = item.querySelector('.page-item-content');
                    if (titleElement) {
                        titleElement.textContent = page.title || 'Página sem título';
                    }
                }
            });

            // Reconfigurar eventos
            this.setupEvents();
            this.setupComponentEvents();
            this.setupToolbarEvents();
        } catch (error) {
            console.error('Erro ao carregar página:', error);
        }
    }

    async saveCurrentPage() {
        if (!this.currentPage) return;

        const pageId = document.getElementById('pageId').value;
        const title = document.getElementById('pageTitle').value;
        const content = document.getElementById('pageContent').value;

        try {
            // Atualizar conteúdo local
            this.content[pageId] = {
                title,
                content,
                components: this.content[pageId]?.components || [],
                tags: this.content[pageId]?.tags || []
            };

            // Salvar todo o conteúdo
            await this.saveContent();

            alert('Página salva com sucesso!');
        } catch (error) {
            console.error('Erro ao salvar página:', error);
            alert('Erro ao salvar página');
        }
    }

    renderEditor() {
        const page = this.content[this.currentPage] || {};
        return `
            <div class="field">
                <label class="label">ID da Página</label>
                <div class="control">
                    <input class="input" type="text" id="pageId" value="${this.currentPage || ''}" readonly>
                </div>
            </div>

            <div class="field">
                <label class="label">Título</label>
                <div class="control">
                    <input class="input" type="text" id="pageTitle" value="${page.title || ''}" placeholder="Digite o título da página">
                </div>
            </div>

            <!-- Componentes Disponíveis -->
            <div class="field">
                <label class="label">Componentes Disponíveis</label>
                <div class="components-grid">
                    ${this.renderAvailableComponents()}
                </div>
            </div>

            <div class="field">
                <label class="label">Conteúdo</label>
                <div class="editor-toolbar">
                    ${this.renderToolbar()}
                </div>
                <div class="control">
                    <textarea class="textarea" id="pageContent" rows="20" placeholder="Digite o conteúdo da página">${page.content || ''}</textarea>
                </div>
            </div>

            ${this.customComponents?.length > 0 ? `
                <div class="field">
                    <label class="label">Componentes Personalizados</label>
                    <div class="control">
                        ${this.renderComponentsSelector()}
                    </div>
                </div>
            ` : ''}

            <div class="field">
                <label class="label">Tags</label>
                <div class="control">
                    <div class="tags-input">
                        <div class="tags-container">
                            ${this.content[this.currentPage]?.tags?.map(tag => `
                                <span class="tag is-info">
                                    ${tag}
                                    <button class="delete is-small" data-remove-tag="${tag}"></button>
                                </span>
                            `).join('')}
                        </div>
                        <input class="input" type="text" id="newTag" placeholder="Adicionar tag">
                    </div>
                </div>
                <p class="help">Pressione Enter para adicionar uma tag</p>
            </div>

            <div class="field is-grouped">
                <div class="control">
                    <button class="button is-primary" id="saveContent">Salvar</button>
                </div>
                <div class="control">
                    <button class="button is-info" id="previewContent">Preview</button>
                </div>
            </div>

            <div id="previewArea" class="mt-4 is-hidden">
                <h4 class="title is-4">Preview</h4>
                <div class="box content"></div>
            </div>
        `;
    }

    renderToolbar() {
        return `
            <div class="markdown-toolbar">
                <div class="toolbar-group">
                    <div class="toolbar-group-title">Headers</div>
                    <div class="buttons are-small">
                        <button class="button" data-template="# Título" title="Título H1">
                            <span class="icon">
                                <i class="fas fa-heading"></i>
                                <small>1</small>
                            </span>
                        </button>
                        <button class="button" data-template="## Subtítulo" title="Título H2">
                            <span class="icon">
                                <i class="fas fa-heading"></i>
                                <small>2</small>
                            </span>
                        </button>
                        <button class="button" data-template="### Seção" title="Título H3">
                            <span class="icon">
                                <i class="fas fa-heading"></i>
                                <small>3</small>
                            </span>
                        </button>
                    </div>
                </div>
            </div>
        `;
    }

    getAvailableComponents() {
        // Carregar apenas componentes personalizados do backend
        return this.customComponents || [];
    }

    async loadCustomComponents() {
        try {
            const response = await fetch('/api/components');
            if (!response.ok) throw new Error('Erro ao carregar componentes');
            this.customComponents = await response.json();
            console.log('Componentes personalizados carregados:', this.customComponents);
        } catch (error) {
            console.error('Erro ao carregar componentes:', error);
            this.customComponents = [];
        }
    }

    renderComponentsSelector() {
        if (!this.customComponents || this.customComponents.length === 0) {
            return '<div class="notification is-info">Nenhum componente personalizado disponível</div>';
        }

        const currentComponents = this.content[this.currentPage]?.components || [];
        
        return `
            <div class="components-grid">
                ${this.customComponents.map(comp => `
                    <div class="component-card ${currentComponents.includes(comp.id) ? 'is-active' : ''}" 
                         data-component="${comp.id}">
                        <div class="component-icon">
                            <span class="icon is-large">
                                <i class="fas fa-${comp.icon} fa-2x"></i>
                            </span>
                        </div>
                        <div class="component-info">
                            <h4 class="title is-6 mb-2">${comp.name}</h4>
                            <p class="help">${comp.description}</p>
                        </div>
                        ${currentComponents.includes(comp.id) ? `
                            <div class="component-active-indicator">
                                <span class="icon has-text-success">
                                    <i class="fas fa-check-circle"></i>
                                </span>
                            </div>
                        ` : ''}
                    </div>
                `).join('')}
            </div>
        `;
    }

    setupComponentEvents() {
        const textarea = document.getElementById('pageContent');
        if (!textarea) return;

        // Configurar os componentes arrastáveis
        document.querySelectorAll('.component-card').forEach(card => {
            // Adicionar classe para indicar que é arrastável
            card.setAttribute('draggable', 'true');
            card.classList.add('is-draggable');

            // Configurar eventos de drag
            card.addEventListener('dragstart', (e) => {
                e.dataTransfer.setData('text/plain', card.dataset.component);
                e.dataTransfer.effectAllowed = 'copy';
                card.classList.add('is-dragging');
            });

            card.addEventListener('dragend', () => {
                card.classList.remove('is-dragging');
            });

            // Manter o evento de clique para compatibilidade
            card.addEventListener('click', () => {
                const componentId = card.dataset.component;
                if (!componentId) return;

                // Garantir que o conteúdo da página atual existe
                if (!this.content[this.currentPage]) {
                    this.content[this.currentPage] = {
                        title: '',
                        content: '',
                        components: [],
                        tags: []
                    };
                }

                // Garantir que o array de componentes existe
                if (!this.content[this.currentPage].components) {
                    this.content[this.currentPage].components = [];
                }

                const currentComponents = this.content[this.currentPage].components;
                
                if (currentComponents.includes(componentId)) {
                    // Remover componente se já estiver incluído
                    this.content[this.currentPage].components = currentComponents.filter(id => id !== componentId);
                } else {
                    // Adicionar componente se não estiver incluído
                    this.content[this.currentPage].components = [...currentComponents, componentId];
                }
                
                // Atualizar o conteúdo e a interface
                this.saveCurrentPage();
                this.render();
            });
        });

        // Configurar a área de texto para receber os componentes
        textarea.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'copy';
            textarea.classList.add('is-dragover');
        });

        textarea.addEventListener('dragleave', () => {
            textarea.classList.remove('is-dragover');
        });

        textarea.addEventListener('drop', (e) => {
            e.preventDefault();
            textarea.classList.remove('is-dragover');

            const componentId = e.dataTransfer.getData('text/plain');
            if (!componentId) return;

            // Obter a posição do cursor
            const rect = textarea.getBoundingClientRect();
            const y = e.clientY - rect.top;
            const position = this.getDropPosition(textarea, y);

            // Inserir o componente
            const componentMarker = `\n\n{{component:${componentId}}}\n\n`;
            const text = textarea.value;
            textarea.value = text.slice(0, position) + componentMarker + text.slice(position);

            // Atualizar componentes ativos
            if (!this.content[this.currentPage].components.includes(componentId)) {
                this.content[this.currentPage].components.push(componentId);
            }

            // Salvar alterações
            this.saveCurrentPage();
        });
    }

    getDropPosition(textarea, y) {
        const lineHeight = parseInt(window.getComputedStyle(textarea).lineHeight);
        const scrollTop = textarea.scrollTop;
        const relativeY = y + scrollTop;
        const lineNumber = Math.floor(relativeY / lineHeight);
        
        // Encontrar a posição do cursor baseada na linha
        const lines = textarea.value.split('\n');
        let position = 0;
        
        for (let i = 0; i < lineNumber && i < lines.length; i++) {
            position += lines[i].length + 1; // +1 para o caractere de nova linha
        }
        
        return position;
    }

    renderTagsField() {
        const currentTags = this.content[this.currentPage]?.tags || [];
        
        return `
            <div class="field">
                <label class="label">Tags</label>
                <div class="control">
                    <div class="tags-input">
                        <div class="tags-container">
                            ${currentTags.map(tag => `
                                <span class="tag is-info">
                                    ${tag}
                                    <button class="delete is-small" data-remove-tag="${tag}"></button>
                                </span>
                            `).join('')}
                        </div>
                        <input class="input" type="text" id="newTag" placeholder="Adicionar tag">
                    </div>
                </div>
                <p class="help">Pressione Enter para adicionar uma tag</p>
            </div>
        `;
    }

    setupTagsEvents() {
        const tagInput = document.getElementById('newTag');
        if (!tagInput) return;

        tagInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                const tag = tagInput.value.trim();
                if (tag) {
                    const currentTags = this.content[this.currentPage]?.tags || [];
                    if (!currentTags.includes(tag)) {
                        this.content[this.currentPage].tags = [...currentTags, tag];
                        this.saveContent();
                        this.render();
                    }
                    tagInput.value = '';
                }
            }
        });

        document.querySelectorAll('[data-remove-tag]').forEach(button => {
            button.addEventListener('click', (e) => {
                const tagToRemove = e.target.dataset.removeTag;
                const currentTags = this.content[this.currentPage]?.tags || [];
                this.content[this.currentPage].tags = currentTags.filter(tag => tag !== tagToRemove);
                this.saveContent();
                this.render();
            });
        });
    }

    // Adicionar método para renderizar componentes
    async renderComponent(component) {
        console.log('Renderizando componente:', component);

        if (!component || typeof component !== 'object') {
            console.error('Componente inválido:', component);
            return '<div class="notification is-danger">Componente inválido</div>';
        }

        const componentId = `component-${component.id}`;
        
        // Garantir que os valores são strings e não objetos
        const html = String(component.html || '').trim() || '<div class="notification is-info">Componente vazio</div>';
        const css = String(component.css || '').trim();
        const js = String(component.js || '').trim();

        // Criar um container para o componente com estilos encapsulados
        const componentHtml = String.raw`
            <div class="custom-component" id="${componentId}">
                <style scoped>
                    #${componentId} {
                        position: relative;
                        margin: 1rem 0;
                        padding: 1rem;
                        border: 1px solid var(--border-color);
                        border-radius: 4px;
                    }
                    ${css}
                </style>
                ${html}
            </div>
        `;

        return componentHtml;
    }

    // Adicionar método para carregar componentes
    async loadComponent(componentId) {
        // Verificar cache primeiro
        if (this.loadedComponents.has(componentId)) {
            return this.loadedComponents.get(componentId);
        }

        try {
            const response = await fetch(`/api/components/${componentId}`);
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || `Erro ao carregar componente: ${response.statusText}`);
            }
            const component = await response.json();
            
            // Validar o componente
            if (!component || !component.id) {
                throw new Error('Componente inválido recebido do servidor');
            }

            // Garantir que os campos existam e são strings
            const processedComponent = {
                id: String(component.id),
                name: String(component.name || 'Componente sem nome'),
                html: String(component.html || ''),
                css: String(component.css || ''),
                js: String(component.js || ''),
                icon: String(component.icon || 'puzzle-piece'),
                description: String(component.description || '')
            };
            
            // Armazenar no cache
            this.loadedComponents.set(componentId, processedComponent);
            
            return processedComponent;
        } catch (error) {
            console.error('Erro ao carregar componente:', error);
            // Remover do cache se houver erro
            this.loadedComponents.delete(componentId);
            throw error;
        }
    }

    setupToolbarEvents() {
        // Implementação base vazia - será sobrescrita pelas classes específicas
    }

    async deletePage(pageId) {
        try {
            // Encontrar a seção que contém a página
            const section = this.sections.find(s => s.pages.includes(pageId));
            if (section) {
                // Remover a página da seção
                section.pages = section.pages.filter(p => p !== pageId);
                
                // Remover o conteúdo da página
                delete this.content[pageId];
                
                // Se a página atual foi excluída, limpar a seleção
                if (this.currentPage === pageId) {
                    this.currentPage = null;
                }
                
                // Salvar as alterações
                await this.saveContent();
                
                // Atualizar a interface
                this.render();
            }
        } catch (error) {
            console.error('Erro ao excluir página:', error);
            alert('Erro ao excluir página');
        }
    }

    renderAvailableComponents() {
        const components = this.getAvailableComponents();
        return components.map(comp => `
            <div class="component-card" data-component="${comp.id}">
                <div class="component-icon">
                    <span class="icon">
                        <i class="fas fa-${comp.icon}"></i>
                    </span>
                </div>
                <div class="component-info">
                    <div class="component-name">${comp.name}</div>
                    <div class="component-description">${comp.description}</div>
                </div>
            </div>
        `).join('');
    }

    renderComponentForm() {
        return `
            <div class="field">
                <label class="label">Nome do Componente</label>
                <div class="control">
                    <input class="input" type="text" id="componentName" required>
                </div>
            </div>
            <div class="field">
                <label class="label">Ícone (FontAwesome)</label>
                <div class="control">
                    <div class="field has-addons">
                        <div class="control is-expanded">
                            <input class="input" type="text" id="componentIcon" placeholder="puzzle-piece" required>
                        </div>
                        <div class="control">
                            <a href="https://fontawesome.com/icons" target="_blank" class="button is-info" title="Ver ícones disponíveis">
                                <span class="icon">
                                    <i class="fas fa-search"></i>
                                </span>
                            </a>
                        </div>
                    </div>
                    <p class="help">
                        Digite o nome do ícone sem o prefixo "fa-"
                    </p>
                </div>
            </div>
        `;
    }

    renderMarkdownToolbar() {
        return `
            <div class="markdown-toolbar">
                <div class="toolbar-group">
                    <div class="toolbar-group-title">Headers</div>
                    <div class="buttons are-small">
                        <button class="button" data-template="# Título" title="Título H1">
                            <span class="icon">
                                <i class="fas fa-heading"></i>
                                <small>1</small>
                            </span>
                        </button>
                        <button class="button" data-template="## Subtítulo" title="Título H2">
                            <span class="icon">
                                <i class="fas fa-heading"></i>
                                <small>2</small>
                            </span>
                        </button>
                        <button class="button" data-template="### Seção" title="Título H3">
                            <span class="icon">
                                <i class="fas fa-heading"></i>
                                <small>3</small>
                            </span>
                        </button>
                    </div>
                </div>
            </div>
        `;
    }
} 