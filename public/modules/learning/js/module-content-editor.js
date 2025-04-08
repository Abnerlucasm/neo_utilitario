/**
 * Módulo para edição de conteúdo de módulos de aprendizagem
 * Permite criar e gerenciar seções e páginas com conteúdo em markdown ou HTML
 */
class ModuleContentEditor {
    constructor() {
        this.moduleId = null;
        this.module = null;
        this.sections = [];
        this.currentPage = null;
        this.editor = null;
        this.isEditing = false;
        this.draggingElement = null;
        this.currentSectionIndex = null;
        this.currentPageIndex = null;
        
        // Elementos do DOM
        this.elements = {
            moduleName: document.getElementById('moduleName'),
            sectionsTree: document.getElementById('sectionsTree'),
            editorArea: document.getElementById('editorArea'),
            previewArea: document.getElementById('previewArea'),
            saveBtn: document.getElementById('saveBtn'),
            previewBtn: document.getElementById('previewBtn'),
            backBtn: document.getElementById('backBtn'),
            viewModuleBtn: document.getElementById('viewModuleBtn'),
            addSectionBtn: document.getElementById('addSectionBtn'),
            
            // Elementos do modal de seção
            sectionModal: document.getElementById('sectionModal'),
            sectionTitle: document.getElementById('sectionTitle'),
            saveSectionBtn: document.getElementById('saveSectionBtn'),
            cancelSectionBtn: document.getElementById('cancelSectionBtn'),
            
            // Elementos do modal de página
            pageModal: document.getElementById('pageModal'),
            pageTitle: document.getElementById('pageTitle'),
            savePageBtn: document.getElementById('savePageBtn'),
            cancelPageBtn: document.getElementById('cancelPageBtn'),

            // Elementos do modal de importação de HTML
            importHtmlModal: document.getElementById('importHtmlModal'),
            htmlContent: document.getElementById('htmlContent'),
            htmlFile: document.getElementById('htmlFile'),
            fileName: document.getElementById('fileName'),
            confirmImportBtn: document.getElementById('confirmImportBtn'),
            cancelImportBtn: document.getElementById('cancelImportBtn'),
            preserveStyles: document.getElementById('preserveStyles')
        };
        
        // Armazenar a instância no elemento do editor para acesso global
        const editorContainer = document.querySelector('.editor-container');
        if (editorContainer) {
            editorContainer.__moduleEditor = this;
        }
        
        this.init();
    }
    
    /**
     * Inicializa o editor de conteúdo
     */
    init() {
        // Obter o ID do módulo da URL usando URLSearchParams
        const urlParams = new URLSearchParams(window.location.search);
        this.moduleId = urlParams.get('id');
        
        if (!this.moduleId) {
            this.showNotification('ID do módulo não encontrado na URL. Use ?id=MODULO_ID', 'is-danger');
            console.error('ID do módulo não encontrado. A URL deve conter o parâmetro "id"');
            
            // Mostrar mensagem no editor
            if (this.elements.editorArea) {
                this.elements.editorArea.innerHTML = `
                    <div class="notification is-danger">
                        <p><strong>Erro:</strong> ID do módulo não encontrado na URL.</p>
                        <p>A URL deve estar no formato: <code>/modules/learning/templates/module-content-editor.html?id=ID_DO_MODULO</code></p>
                        <button class="button is-small mt-2" onclick="window.location.href = '/admin/learning/modules'">
                            Voltar para a lista de módulos
                        </button>
                    </div>
                `;
            }
            
            setTimeout(() => {
                window.location.href = '/admin/learning/modules';
            }, 5000);
            return;
        }
        
        console.log(`ID do módulo encontrado: ${this.moduleId}`);
        
        // Configurar botões e eventos
        this.setupEventListeners();
        
        // Carregar o módulo
        this.loadModule();
        
        // Inicializar o editor markdown
        this.initMarkdownEditor();
    }
    
    /**
     * Configura os listeners de eventos para os elementos da UI
     */
    setupEventListeners() {
        // Botões de ação
        this.elements.backBtn.addEventListener('click', (e) => {
            e.preventDefault();
            window.location.href = document.referrer || '/learning/admin';
        });
        
        this.elements.addSectionBtn.addEventListener('click', () => {
            this.openSectionModal();
        });
        
        this.elements.saveBtn.addEventListener('click', () => {
            this.saveChanges();
        });
        
        this.elements.previewBtn.addEventListener('click', () => {
            this.togglePreview();
        });

        // Botão para importar HTML
        const importHtmlBtn = document.getElementById('importHtmlBtn');
        if (importHtmlBtn) {
            importHtmlBtn.addEventListener('click', () => {
                this.openImportHtmlModal();
            });
        }
        
        // Event listeners para modais
        this.setupModalListeners();
        
        // Evitar perda de mudanças não salvas
        window.addEventListener('beforeunload', (e) => {
            if (this.hasUnsavedChanges) {
                e.preventDefault();
                e.returnValue = 'Você tem alterações não salvas. Tem certeza que deseja sair?';
                return e.returnValue;
            }
        });
    }
    
    /**
     * Configura os event listeners para os modais
     */
    setupModalListeners() {
        // Modal de seção
        this.elements.saveSectionBtn.addEventListener('click', () => this.saveSection());
        this.elements.cancelSectionBtn.addEventListener('click', () => this.closeSectionModal());
        this.elements.sectionModal.querySelector('.delete').addEventListener('click', () => this.closeSectionModal());
        
        // Modal de página
        this.elements.savePageBtn.addEventListener('click', () => {
            const pageTitle = this.elements.pageTitle.value.trim();
            
            if (this.currentSectionIndex !== null) {
                // Se for edição, passa o índice da página atual
                const pageId = this.savePage(this.currentSectionIndex, pageTitle, this.currentPageIndex);
                
                // Fechar o modal
                this.closePageModal();
                
                // Atualizar a árvore de seções
                this.renderSectionsTree();
                
                // Selecionar a página recém-editada
                if (pageId) {
                    const section = this.sections[this.currentSectionIndex];
                    const pageIndex = section.pages.indexOf(pageId);
                    if (pageIndex !== -1) {
                        this.selectPage(this.currentSectionIndex, pageIndex);
                    }
                }
                
                // Notificar usuário
                this.showNotification(`Página "${pageTitle}" salva com sucesso`, 'is-success');
            }
        });
        
        this.elements.cancelPageBtn.addEventListener('click', () => this.closePageModal());
        this.elements.pageModal.querySelector('.delete').addEventListener('click', () => this.closePageModal());
        
        // Fechar modais ao pressionar ESC
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                if (this.elements.sectionModal.classList.contains('is-active')) {
                    this.closeSectionModal();
                }
                if (this.elements.pageModal.classList.contains('is-active')) {
                    this.closePageModal();
                }
                const importHtmlModal = document.getElementById('importHtmlModal');
                if (importHtmlModal && importHtmlModal.classList.contains('is-active')) {
                    this.closeImportHtmlModal();
                }
            }
        });
    }
    
    /**
     * Inicializa o editor Markdown (EasyMDE)
     */
    initMarkdownEditor() {
        try {
            console.log('Inicializando editor markdown...');
            
            // Verificar se o EasyMDE está disponível
            if (typeof EasyMDE === 'undefined') {
                console.error('EasyMDE não está disponível');
                this.showNotification('Erro: EasyMDE não carregado', 'is-danger');
                this.showFallbackEditor();
                return;
            }
            
            const editorArea = document.getElementById('editorArea');
            if (!editorArea) {
                console.error('Elemento editorArea não encontrado');
                this.showNotification('Erro ao inicializar editor: elemento não encontrado', 'is-danger');
                return;
            }
            
            // Limpar o conteúdo da área do editor
            editorArea.innerHTML = '';
            
            // Criar um elemento textarea para o editor
            const textarea = document.createElement('textarea');
            textarea.id = 'markdown-editor-textarea';
            editorArea.appendChild(textarea);
            
            // Definir o conteúdo inicial do textarea se houver uma página selecionada
            if (this.currentPage && this.content && this.content[this.currentPage]) {
                textarea.value = this.content[this.currentPage].content || '';
            }
            
            // Inicializar o editor após o textarea estar no DOM
            setTimeout(() => {
                try {
                    // Inicializar EasyMDE no textarea
                    this.editor = new EasyMDE({
                        element: textarea,
                        autoDownloadFontAwesome: false,
                        spellChecker: false,
                        autosave: {
                            enabled: true,
                            uniqueId: `module-${this.moduleId}-editor`,
                            delay: 1000
                        },
                        lineWrapping: true,
                        status: ['lines', 'words', 'cursor'],
                        toolbar: [
                            'bold', 'italic', 'heading', '|',
                            'quote', 'unordered-list', 'ordered-list', '|',
                            'link', 'image', 'table', 'code', '|',
                            'preview', 'side-by-side', 'fullscreen', '|',
                            'guide'
                        ],
                        promptURLs: true,
                        placeholder: 'Escreva seu conteúdo aqui...'
                    });
                    
                    // Verificar se o editor foi inicializado corretamente
                    if (!this.editor) {
                        throw new Error('Falha ao inicializar o editor Markdown');
                    }
                    
                    // Adicionar classe para estilização correta
                    const container = document.querySelector('.EasyMDEContainer');
                    if (container) {
                        container.classList.add('content-editor');
                    }
                    
                    // Atualizar quando o conteúdo mudar
                    this.editor.codemirror.on('change', () => {
                        this.contentChanged = true;
                        if (this.updateSaveButton) {
                            this.updateSaveButton();
                        }
                    });
                    
                    console.log('Editor Markdown inicializado com sucesso');
                } catch (innerError) {
                    console.error('Erro ao inicializar editor Markdown:', innerError);
                    this.showNotification('Erro ao inicializar editor: ' + innerError.message, 'is-danger');
                    this.showFallbackEditor();
                }
            }, 0);
            
        } catch (error) {
            console.error('Erro ao preparar inicialização do editor:', error);
            this.showNotification('Erro ao preparar editor: ' + error.message, 'is-danger');
            this.showFallbackEditor();
        }
    }
    
    /**
     * Mostra um editor de fallback em caso de erro
     */
    showFallbackEditor() {
        console.log('Mostrando editor de fallback');
        this.elements.editorArea.innerHTML = `
            <div class="notification is-warning">
                Erro ao carregar o editor de texto. 
                <button class="button is-small is-info ml-2" id="retryEditor">Tentar novamente</button>
            </div>
            <textarea class="textarea" style="min-height: 300px">${this.currentPage ? this.currentPage.content : ''}</textarea>
        `;
        
        const retryBtn = document.getElementById('retryEditor');
        if (retryBtn) {
            retryBtn.addEventListener('click', () => {
                this.initMarkdownEditor();
                if (this.currentPage) {
                    this.selectPage(this.currentPage.sectionIndex, this.currentPage.pageIndex);
                }
            });
        }
        
        const fallbackTextarea = this.elements.editorArea.querySelector('textarea');
        if (fallbackTextarea) {
            fallbackTextarea.addEventListener('input', (e) => {
                if (this.currentPage) {
                    this.currentPage.content = e.target.value;
                }
            });
        }
    }
    
    /**
     * Carrega o módulo do servidor
     */
    async loadModule() {
        try {
            console.log(`Carregando módulo com ID: ${this.moduleId}`);
            
            // Usar a nova rota para obter todos os dados do módulo
            const response = await fetch(`/api/learning/modules/${this.moduleId}/full`, {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
                }
            });
            
            if (!response.ok) {
                const errorText = await response.text();
                console.error(`Erro ${response.status}: ${errorText}`);
                
                let errorMessage = 'Erro ao carregar o módulo';
                try {
                    const errorData = JSON.parse(errorText);
                    errorMessage = errorData.error || errorData.details || errorMessage;
                } catch (e) {
                    // Se não for JSON válido, usar o texto como está
                    errorMessage = errorText || errorMessage;
                }
                
                throw new Error(errorMessage);
            }
            
            this.module = await response.json();
            console.log('Dados do módulo carregados:', this.module);
            
            // Preencher o nome do módulo
            this.elements.moduleName.textContent = this.module.title || 'Sem título';
            
            // Configurar link de visualização
            const viewModuleBtn = document.getElementById('viewModuleBtn');
            if (viewModuleBtn) {
                viewModuleBtn.href = `/learn/${this.moduleId}`;
            }
            
            // Inicializar seções e páginas
            this.sections = Array.isArray(this.module.sections) ? this.module.sections : [];
            
            // Renderizar a árvore de seções
            this.renderSectionsTree();
            
            // Se não houver seções, mostrar mensagem
            if (this.sections.length === 0) {
                this.elements.sectionsTree.innerHTML = `
                    <div class="notification is-info is-light">
                        Este módulo ainda não tem conteúdo. 
                        Clique em "Nova Seção" para começar.
                    </div>
                `;
            }
            
        } catch (error) {
            console.error('Erro ao carregar módulo:', error);
            this.showNotification('Erro ao carregar o módulo: ' + error.message, 'is-danger');
            
            // Mostrar mensagem amigável na árvore de seções
            if (this.elements.sectionsTree) {
                this.elements.sectionsTree.innerHTML = `
                    <div class="notification is-danger">
                        <p>Não foi possível carregar o conteúdo do módulo.</p>
                        <p>Erro: ${error.message}</p>
                        <button class="button is-small mt-2" id="retry-load-module">
                            <span class="icon"><i class="fas fa-sync"></i></span>
                            <span>Tentar novamente</span>
                        </button>
                    </div>
                `;
                
                // Adicionar botão de retry
                const retryBtn = document.getElementById('retry-load-module');
                if (retryBtn) {
                    retryBtn.addEventListener('click', () => {
                        this.loadModule();
                    });
                }
            }
        }
    }
    
    /**
     * Renderiza a árvore de seções e páginas
     */
    renderSectionsTree() {
        this.elements.sectionsTree.innerHTML = '';
        
        if (this.sections.length === 0) {
            return;
        }
        
        // Criar elementos para cada seção e suas páginas
        this.sections.forEach((section, sectionIndex) => {
            const sectionElement = document.createElement('div');
            sectionElement.className = 'section-item';
            sectionElement.id = `section-${sectionIndex}`;
            sectionElement.dataset.index = sectionIndex;
            sectionElement.draggable = true;
            
            // Adicionar eventos para drag and drop
            sectionElement.addEventListener('dragstart', (e) => this.handleDragStart(e, 'section', sectionIndex));
            sectionElement.addEventListener('dragover', (e) => this.handleDragOver(e));
            sectionElement.addEventListener('dragleave', (e) => this.handleDragLeave(e));
            sectionElement.addEventListener('drop', (e) => this.handleDrop(e, 'section', sectionIndex));
            sectionElement.addEventListener('dragend', (e) => this.handleDragEnd(e));
            
            sectionElement.innerHTML = `
                <div class="section-header">
                    <span class="section-title">${section.title || 'Sem título'}</span>
                    <div class="section-actions">
                        <span class="action-icon" title="Adicionar página">
                            <i class="fas fa-plus"></i>
                        </span>
                        <span class="action-icon" title="Editar seção">
                            <i class="fas fa-edit"></i>
                        </span>
                        <span class="action-icon" title="Excluir seção">
                            <i class="fas fa-trash"></i>
                        </span>
                    </div>
                </div>
                <div class="section-pages"></div>
            `;
            
            // Adicionar evento para adicionar nova página
            sectionElement.querySelector('.section-actions .fa-plus').parentElement.addEventListener('click', () => {
                this.openPageModal(sectionIndex);
            });
            
            // Adicionar evento para editar seção
            sectionElement.querySelector('.section-actions .fa-edit').parentElement.addEventListener('click', () => {
                this.editSection(sectionIndex);
            });
            
            // Adicionar evento para excluir seção
            sectionElement.querySelector('.section-actions .fa-trash').parentElement.addEventListener('click', () => {
                this.deleteSection(sectionIndex);
            });
            
            // Adicionar páginas da seção
            const pagesContainer = sectionElement.querySelector('.section-pages');
            
            if (section.pages && section.pages.length > 0) {
                section.pages.forEach((pageId, pageIndex) => {
                    // Verificar se pageId é uma string válida
                    if (typeof pageId !== 'string') {
                        console.warn(`ID de página inválido na seção ${sectionIndex}, índice ${pageIndex}: ${pageId}`);
                        return;
                    }
                    
                    const pageElement = document.createElement('div');
                    pageElement.className = 'page-item';
                    pageElement.id = `page-${sectionIndex}-${pageIndex}`;
                    pageElement.dataset.sectionIndex = sectionIndex;
                    pageElement.dataset.pageIndex = pageIndex;
                    pageElement.draggable = true;
                    
                    // Obter o título da página do objeto content
                    let pageTitle = 'Sem título';
                    if (this.content && this.content[pageId]) {
                        pageTitle = this.content[pageId].title || 'Sem título';
                    }
                    
                    // Adicionar eventos para drag and drop
                    pageElement.addEventListener('dragstart', (e) => this.handleDragStart(e, 'page', sectionIndex, pageIndex));
                    pageElement.addEventListener('dragover', (e) => this.handleDragOver(e));
                    pageElement.addEventListener('dragleave', (e) => this.handleDragLeave(e));
                    pageElement.addEventListener('drop', (e) => this.handleDrop(e, 'page', sectionIndex, pageIndex));
                    pageElement.addEventListener('dragend', (e) => this.handleDragEnd(e));
                    
                    pageElement.innerHTML = `
                        <span class="page-title">${pageTitle}</span>
                        <div class="page-actions">
                            <span class="action-icon" title="Editar página">
                                <i class="fas fa-edit"></i>
                            </span>
                            <span class="action-icon" title="Excluir página">
                                <i class="fas fa-trash"></i>
                            </span>
                        </div>
                    `;
                    
                    // Adicionar evento de clique para editar o conteúdo
                    pageElement.addEventListener('click', (e) => {
                        // Ignorar clique nos botões de ação
                        if (e.target.closest('.page-actions')) return;
                        
                        this.selectPage(sectionIndex, pageIndex);
                    });
                    
                    // Adicionar evento para editar página
                    pageElement.querySelector('.page-actions .fa-edit').parentElement.addEventListener('click', () => {
                        this.editPage(sectionIndex, pageIndex);
                    });
                    
                    // Adicionar evento para excluir página
                    pageElement.querySelector('.page-actions .fa-trash').parentElement.addEventListener('click', () => {
                        this.deletePage(sectionIndex, pageIndex);
                    });
                    
                    pagesContainer.appendChild(pageElement);
                });
            } else {
                // Se não houver páginas, mostrar botão para adicionar
                const addPageBtn = document.createElement('button');
                addPageBtn.className = 'button is-small is-info is-light add-page-button';
                addPageBtn.innerHTML = '<span class="icon is-small"><i class="fas fa-plus"></i></span> <span>Adicionar página</span>';
                addPageBtn.addEventListener('click', () => {
                    this.openPageModal(sectionIndex);
                });
                
                pagesContainer.appendChild(addPageBtn);
            }
            
            this.elements.sectionsTree.appendChild(sectionElement);
        });
    }
    
    /**
     * Seleciona uma página para edição
     * @param {number} sectionIndex - Índice da seção
     * @param {number} pageIndex - Índice da página
     */
    selectPage(sectionIndex, pageIndex) {
        try {
        console.log(`Selecionando página: seção ${sectionIndex}, página ${pageIndex}`);
        
        // Verificar se os índices são válidos
        if (sectionIndex < 0 || sectionIndex >= this.sections.length) {
                throw new Error(`Índice de seção inválido: ${sectionIndex}`);
        }
        
        const section = this.sections[sectionIndex];
            if (!Array.isArray(section.pages) || pageIndex < 0 || pageIndex >= section.pages.length) {
                throw new Error(`Índice de página inválido: ${pageIndex}`);
        }
        
            // Salvar o conteúdo da página atual antes de mudar
            if (this.currentPage && this.editor) {
        this.saveCurrentPageContent();
            }
            
            // Obter o ID da página a partir da seção
            const pageId = section.pages[pageIndex];
            
            // Verificar se o pageId é uma string (como esperado)
            if (typeof pageId !== 'string') {
                console.error(`PageId inválido: ${pageId} (${typeof pageId})`);
                throw new Error('ID de página inválido');
            }
            
            console.log(`ID da página selecionada: ${pageId}`);
            
            // Garantir que o objeto content exista
            if (!this.content) {
                this.content = {};
            }
            
            // Garantir que esta página exista no content
            if (!this.content[pageId]) {
                console.log(`Criando novo conteúdo para página ${pageId}`);
                this.content[pageId] = {
                id: pageId,
                    title: 'Nova página',
                content: '',
                    description: ''
                };
            }
            
            // Atualizar estado atual
            this.currentPage = pageId;
            
            // Expandir a seção se necessário
            this.expandSection(sectionIndex);
            
            // Remover classe 'active' de todas as páginas
            document.querySelectorAll('.page-item').forEach(el => {
                el.classList.remove('active');
            });
            
            // Adicionar classe 'active' à página selecionada
            const pageElement = document.querySelector(`#page-${sectionIndex}-${pageIndex}`);
            if (pageElement) {
                pageElement.classList.add('active');
                pageElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
            
            // Inicializar ou atualizar o editor
            this.renderEditor();
            
            // Atualizar título da página
            const titleElement = document.getElementById('currentPageTitle');
            if (titleElement) {
                titleElement.textContent = this.content[pageId].title || 'Sem título';
        } else {
                console.warn('Elemento currentPageTitle não encontrado');
            }
            
            console.log(`Página selecionada: "${this.content[pageId].title}" (Seção ${sectionIndex}, Página ${pageIndex})`);
        } catch (error) {
            console.error('Erro ao selecionar página:', error);
            this.showNotification('Erro ao selecionar página: ' + error.message, 'is-danger');
        }
    }
    
    /**
     * Atualiza o campo de palavras-chave
     */
    updateKeywordsField(keywords = []) {
        const keywordsContainer = document.querySelector('#keywordsContainer');
        
        // Se não existir, criar o container de keywords
        if (!keywordsContainer) {
            const editorActions = document.querySelector('.editor-actions');
            if (editorActions) {
                const keywordsSection = document.createElement('div');
                keywordsSection.className = 'keywords-section mt-4';
                keywordsSection.innerHTML = `
                    <div class="field">
                        <label class="label">Palavras-chave</label>
                        <div class="control">
                            <div class="tags-input">
                                <div id="keywordsContainer" class="tags"></div>
                                <input type="text" id="keywordInput" class="input" 
                                    placeholder="Digite uma palavra-chave e pressione Enter">
                            </div>
                        </div>
                        <p class="help">Ajuda na busca de conteúdo. Pressione Enter para adicionar cada palavra-chave.</p>
                    </div>
                `;
                editorActions.appendChild(keywordsSection);
                
                // Adicionar event listener para o input
                const keywordInput = document.querySelector('#keywordInput');
                if (keywordInput) {
                    keywordInput.addEventListener('keydown', (e) => {
                        if (e.key === 'Enter') {
                            e.preventDefault();
                            this.addKeyword(e.target.value.trim());
                            e.target.value = '';
                        }
                    });
                }
            }
        }
        
        // Atualizar a lista de keywords
        const keywordsElement = document.querySelector('#keywordsContainer');
        if (keywordsElement) {
            keywordsElement.innerHTML = '';
            
            if (Array.isArray(keywords) && keywords.length > 0) {
                keywords.forEach(keyword => {
                    if (keyword && keyword.trim()) {
                        this.renderKeywordTag(keyword.trim(), keywordsElement);
                    }
                });
            }
        }
    }
    
    /**
     * Renderiza uma tag de palavra-chave
     */
    renderKeywordTag(keyword, container) {
        const tag = document.createElement('span');
        tag.className = 'tag is-info is-medium mr-2 mb-2';
        tag.innerHTML = `
            ${keyword}
            <button class="delete is-small" data-keyword="${keyword}"></button>
        `;
        container.appendChild(tag);
        
        // Adicionar event listener para remover a tag
        tag.querySelector('.delete').addEventListener('click', (e) => {
            this.removeKeyword(e.target.dataset.keyword);
        });
    }
    
    /**
     * Adiciona uma palavra-chave
     */
    addKeyword(keyword) {
        if (!keyword) return;
        
        // Verificar se estamos editando uma página
        if (this.currentSectionIndex === null || this.currentPageIndex === null) {
            this.showNotification('Selecione uma página primeiro', 'is-warning');
            return;
        }
        
        // Obter a página atual
        const section = this.sections[this.currentSectionIndex];
        let page = section.pages[this.currentPageIndex];
        
        // Se a página for uma string (apenas ID), obter do conteúdo
        if (typeof page === 'string') {
            page = this.module.content[page];
            if (!page) return;
        }
        
        // Garantir que temos um array de keywords
        if (!page.keywords) {
            page.keywords = [];
        }
        
        // Verificar se a keyword já existe
        if (page.keywords.includes(keyword)) {
            this.showNotification('Esta palavra-chave já existe', 'is-warning');
            return;
        }
        
        // Adicionar a keyword
        page.keywords.push(keyword);
        
        // Atualizar a interface
        const keywordsContainer = document.querySelector('#keywordsContainer');
        if (keywordsContainer) {
            this.renderKeywordTag(keyword, keywordsContainer);
        }
        
        // Salvar alterações
        this.saveCurrentPageContent();
    }
    
    /**
     * Remove uma palavra-chave
     */
    removeKeyword(keyword) {
        if (!keyword) return;
        
        // Verificar se estamos editando uma página
        if (this.currentSectionIndex === null || this.currentPageIndex === null) {
            return;
        }
        
        // Obter a página atual
        const section = this.sections[this.currentSectionIndex];
        let page = section.pages[this.currentPageIndex];
        
        // Se a página for uma string (apenas ID), obter do conteúdo
        if (typeof page === 'string') {
            page = this.module.content[page];
            if (!page) return;
        }
        
        // Garantir que temos um array de keywords
        if (!page.keywords || !Array.isArray(page.keywords)) {
            page.keywords = [];
            return;
        }
        
        // Remover a keyword
        page.keywords = page.keywords.filter(k => k !== keyword);
        
        // Atualizar a interface
        this.updateKeywordsField(page.keywords);
        
        // Salvar alterações
        this.saveCurrentPageContent();
    }
    
    /**
     * Salva o conteúdo da página atual no objeto content
     */
    saveCurrentPageContent() {
        if (!this.currentPage || !this.editor) {
            console.warn('Nenhuma página selecionada ou editor não inicializado');
            return false;
        }
        
        try {
            // Verificar se a página existe no objeto content
            if (!this.content[this.currentPage]) {
                console.warn(`Página ${this.currentPage} não encontrada no objeto content`);
                this.content[this.currentPage] = {
                    title: document.getElementById('currentPageTitle').textContent || 'Sem título',
                    content: '',
                    description: ''
                };
            }
            
            // Obter o conteúdo do editor
            const content = this.editor.value();
            
            // Salvar no objeto content
            this.content[this.currentPage].content = content;
            
            // Se tiver campo de título, salvar também
            const titleField = document.getElementById('pageTitle');
            if (titleField) {
                this.content[this.currentPage].title = titleField.value || 'Sem título';
            }
            
            // Se tiver campo de descrição, salvar também
            const descField = document.getElementById('pageDescription');
            if (descField) {
                this.content[this.currentPage].description = descField.value || '';
            }
            
            console.log(`Conteúdo da página ${this.currentPage} salvo:`, this.content[this.currentPage]);
            return true;
        } catch (error) {
            console.error('Erro ao salvar conteúdo:', error);
            return false;
        }
    }
    
    /**
     * Alterna entre o modo editor e preview
     */
    togglePreview() {
        try {
            // Verificar se o editor existe
            if (!this.editor) {
                console.warn('Editor não inicializado');
            return;
        }
        
            const previewArea = document.getElementById('previewArea');
            const editorArea = document.getElementById('editorArea');
            const previewBtn = document.getElementById('previewBtn');
            
            if (!previewArea || !editorArea || !previewBtn) {
                console.error('Elementos necessários não encontrados');
                return;
            }
            
            // Salvar conteúdo atual se estiver no editor
            if (previewArea.classList.contains('is-hidden')) {
        this.saveCurrentPageContent();
            }
            
            // Toggle das classes
            previewArea.classList.toggle('is-hidden');
            
            // Importante: não esconder a área do editor, apenas o contêiner EasyMDE
            const easyMDEContainer = editorArea.querySelector('.EasyMDEContainer');
            if (easyMDEContainer) {
                if (previewArea.classList.contains('is-hidden')) {
                    // Voltar para o editor
                    easyMDEContainer.style.display = 'block';
                    previewBtn.innerHTML = '<span class="icon"><i class="fas fa-eye"></i></span><span>Preview</span>';
                } else {
            // Mostrar preview
                    easyMDEContainer.style.display = 'none';
                    previewBtn.innerHTML = '<span class="icon"><i class="fas fa-edit"></i></span><span>Editar</span>';
                    
                    // Renderizar Markdown para HTML
                    if (this.currentPage && this.content[this.currentPage]) {
                        const markdownContent = this.editor.value();
                        
                        // Usar o marked para converter Markdown para HTML
                        let htmlContent = '';
                        try {
                            htmlContent = marked.parse(markdownContent);
                            // Sanitizar HTML para segurança
                            htmlContent = DOMPurify.sanitize(htmlContent);
                        } catch (e) {
                            console.error('Erro ao renderizar markdown:', e);
                            htmlContent = '<p>Erro ao renderizar conteúdo</p>';
                        }
                        
                        // Renderizar o HTML na área de preview
                        previewArea.innerHTML = `
                            <div class="content markdown-preview">
                                ${htmlContent}
                </div>
            `;
                    } else {
                        previewArea.innerHTML = '<div class="notification is-warning">Selecione uma página para previsualizar o conteúdo</div>';
                    }
                }
            }
        } catch (error) {
            console.error('Erro ao alternar preview:', error);
            this.showNotification('Erro ao alternar visualização: ' + error.message, 'is-danger');
        }
    }
    
    /**
     * Abre o modal de adição/edição de página
     * @param {number} sectionIndex - Índice da seção
     * @param {number} pageIndex - Índice da página (se for edição)
     */
    openPageModal(sectionIndex, pageIndex) {
        try {
            if (sectionIndex === undefined || sectionIndex === null) {
                throw new Error('Índice de seção inválido');
            }
            
            // Definir estado atual
            this.currentSectionIndex = sectionIndex;
            this.currentPageIndex = pageIndex;
            
            // Configurar título do modal
            const modalTitle = document.querySelector('#pageModal .modal-card-title');
            if (modalTitle) {
                modalTitle.textContent = pageIndex !== undefined ? 'Editar Página' : 'Nova Página';
            }
            
            // Preencher campo com o título atual se for edição
            if (pageIndex !== undefined && this.sections[sectionIndex]) {
                const section = this.sections[sectionIndex];
                
                // Verificar se pages é um array
                if (!Array.isArray(section.pages)) {
                    section.pages = [];
                }
                
                // Verificar se o pageIndex é válido
                if (pageIndex >= 0 && pageIndex < section.pages.length) {
                    const pageId = section.pages[pageIndex];
                    
                    // Se pageId for uma string (ID), buscar os dados do content
                    if (typeof pageId === 'string' && this.content && this.content[pageId]) {
                        this.elements.pageTitle.value = this.content[pageId].title || '';
                    } else if (typeof pageId === 'object') {
                        // Suporte a formato antigo onde pageId é o objeto completo da página
                        this.elements.pageTitle.value = pageId.title || '';
        } else {
                        this.elements.pageTitle.value = '';
                    }
                } else {
                    this.elements.pageTitle.value = '';
                }
            } else {
                this.elements.pageTitle.value = '';
            }
            
            // Abrir o modal
            this.elements.pageModal.classList.add('is-active');
            
            // Focar no campo de título
            setTimeout(() => this.elements.pageTitle.focus(), 100);
        } catch (error) {
            console.error('Erro ao abrir modal de página:', error);
            this.showNotification('Erro ao abrir editor de página: ' + error.message, 'is-danger');
        }
    }

    /**
     * Salva uma página (nova ou existente)
     * @param {number} sectionIndex - Índice da seção
     * @param {string} pageTitle - Título da página
     * @param {number} pageIndex - Índice da página (opcional, para edição)
     * @returns {string} ID da página criada ou editada
     */
    savePage(sectionIndex, pageTitle, pageIndex = null) {
        try {
            console.log(`Salvando página "${pageTitle}" na seção ${sectionIndex} ${pageIndex !== null ? `(editando índice ${pageIndex})` : '(nova página)'}`);
            
            // Verificar se o título foi fornecido
            if (!pageTitle || pageTitle.trim() === '') {
                pageTitle = 'Nova Página';
            }
            
            // Validar índice da seção
            if (sectionIndex < 0 || sectionIndex >= this.sections.length) {
                throw new Error('Índice de seção inválido');
            }
            
            const section = this.sections[sectionIndex];
            
            if (pageIndex !== null) {
                // Verificar se é uma edição válida
                if (pageIndex < 0 || pageIndex >= section.pages.length) {
                    throw new Error('Índice de página inválido');
                }
                
                // Editar página existente
                const pageId = section.pages[pageIndex];
                
                // Verificar se o ID da página é válido
                if (typeof pageId !== 'string') {
                    throw new Error('ID de página inválido');
                }
                
                // Verificar se a página existe no objeto content
                if (!this.content[pageId]) {
                    // Criar o objeto de página se não existir
                    this.content[pageId] = {
                        title: pageTitle,
                        content: '',
                        description: ''
                    };
                } else {
                    // Atualizar apenas o título
                    this.content[pageId].title = pageTitle;
                }
                
                console.log(`Página ${pageId} editada: Novo título "${pageTitle}"`);
                return pageId;
            } else {
                // Criar nova página
                const pageId = this.generateId();
                
                // Garantir que o objeto content exista
                if (!this.content) {
                    this.content = {};
                }
                
                // Adicionar a página à lista de páginas da seção (apenas o ID)
                section.pages.push(pageId);
                
                // Criar o conteúdo da página
                this.content[pageId] = {
                    title: pageTitle,
                    content: '',
                    description: ''
                };
                
                console.log(`Nova página criada: ID ${pageId}, Título "${pageTitle}"`);
                return pageId;
            }
        } catch (error) {
            console.error('Erro ao salvar página:', error);
            this.showNotification('Erro ao salvar página: ' + error.message, 'is-danger');
            return null;
        }
    }
    
    /**
     * Abre o modal para adicionar/editar seção
     */
    openSectionModal(sectionIndex = null) {
        // Limpar o campo de título
        this.elements.sectionTitle.value = '';
        
        // Se for edição, preencher o título
        if (sectionIndex !== null) {
            this.elements.sectionTitle.value = this.sections[sectionIndex].title;
            this.elements.sectionModal.dataset.sectionIndex = sectionIndex;
        } else {
            delete this.elements.sectionModal.dataset.sectionIndex;
        }
        
        // Atualizar o título do modal
        const modalTitle = this.elements.sectionModal.querySelector('.modal-card-title');
        modalTitle.textContent = sectionIndex !== null ? 'Editar Seção' : 'Nova Seção';
        
        // Abrir o modal
        this.elements.sectionModal.classList.add('is-active');
        
        // Focar no campo de título
        setTimeout(() => {
            this.elements.sectionTitle.focus();
        }, 100);
    }
    
    /**
     * Fecha o modal de seção
     */
    closeSectionModal() {
        this.elements.sectionModal.classList.remove('is-active');
    }
    
    /**
     * Fecha o modal de página
     */
    closePageModal() {
        this.elements.pageModal.classList.remove('is-active');
    }
    
    /**
     * Salva a seção (nova ou editada)
     */
    saveSection() {
        try {
            const title = this.elements.sectionTitle.value.trim();
            
            if (!title) {
                this.showNotification('O título da seção é obrigatório', 'is-warning');
                return;
            }
            
            const sectionIndex = this.elements.sectionModal.dataset.sectionIndex;
            
            if (sectionIndex !== undefined) {
                // Editar seção existente
                this.sections[sectionIndex].title = title;
            } else {
                // Adicionar nova seção com uma página de exemplo
                const sectionId = this.generateId();
                const pageId = this.generateId();
                
                // Conteúdo inicial mais detalhado e útil
                const conteudoInicial = `# Introdução à ${title}

Esta é uma página de exemplo criada automaticamente. Você pode editar este conteúdo ou excluir esta página.

## Como usar o editor

1. Use a **barra de ferramentas** acima para formatar seu texto
2. Você pode usar Markdown para formatação:
   - **Negrito** usando dois asteriscos: \`**texto**\`
   - *Itálico* usando um asterisco: \`*texto*\`
   - Links: \`[Texto do link](https://www.exemplo.com)\`
   - Imagens: \`![Texto alternativo](url-da-imagem)\`

3. Use os botões abaixo para:
   - Clicar em *Preview* para ver como o conteúdo ficará formatado
   - Clicar em *Salvar* quando terminar suas edições

## Próximos passos

- Adicione mais páginas nesta seção usando o botão \`+\` ao lado do título da seção
- Crie novas seções para organizar melhor seu conteúdo
- Arraste e solte páginas e seções para reorganizá-las`;
                
                // Criar a página no objeto content primeiro
                if (!this.content) {
                    this.content = {};
                }
                this.content[pageId] = {
                    title: 'Introdução',
                    content: conteudoInicial
                };
                
                // Criar a seção com referência ao ID da página
                const novaSecao = {
                    id: sectionId,
                    title: title,
                    pages: [pageId]  // Armazenar apenas o ID da página
                };
                
                this.sections.push(novaSecao);
                
                // Salvar a referência à nova seção e página para seleção posterior
                this.currentSectionIndex = this.sections.length - 1;
                this.currentPageIndex = 0;
            }
            
            // Fechar o modal
            this.closeSectionModal();
            
            // Atualizar a árvore de seções
            this.renderSectionsTree();
            
            // Se foi adicionada uma nova seção com página de exemplo, selecionar a página
            if (sectionIndex === undefined) {
                console.log('Nova seção criada com página de exemplo. Selecionando para edição...');
                setTimeout(() => {
                    this.selectPage(this.currentSectionIndex, this.currentPageIndex);
                }, 300); // Atraso maior para garantir que a UI esteja atualizada
            }
            
            // Salvar as alterações no servidor imediatamente
            this.saveModuleToServer();
            
            // Mostrar notificação
            this.showNotification('Seção salva com sucesso', 'is-success');
        } catch (error) {
            console.error('Erro ao salvar seção:', error);
            this.showNotification('Erro ao salvar seção: ' + error.message, 'is-danger');
        }
    }
    
    /**
     * Salva as alterações do módulo no servidor
     */
    async saveModuleToServer() {
        try {
            if (!this.moduleId) throw new Error('ID do módulo não definido');
            
            console.log('Salvando módulo no servidor...', {
                sections: this.sections,
                content: this.content
            });
            
            const response = await fetch(`/api/learning/modules/${this.moduleId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
                },
                body: JSON.stringify({
                    sections: this.sections,
                    content: this.content
                })
            });
            
            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Erro ao salvar módulo: ${response.status} - ${errorText}`);
            }
            
            console.log('Módulo salvo com sucesso');
            return true;
        } catch (error) {
            console.error('Erro ao salvar módulo:', error);
            this.showNotification('Erro ao salvar no servidor: ' + error.message, 'is-danger');
            return false;
        }
    }
    
    /**
     * Edita uma seção existente
     */
    editSection(sectionIndex) {
        this.openSectionModal(sectionIndex);
    }
    
    /**
     * Exclui uma seção
     */
    deleteSection(sectionIndex) {
        try {
            // Verificar se o índice da seção é válido
            if (sectionIndex < 0 || sectionIndex >= this.sections.length) {
                throw new Error('Índice de seção inválido');
            }
            
            // Perguntar ao usuário se realmente deseja excluir a seção
            if (!confirm('Tem certeza que deseja excluir esta seção e todas as suas páginas? Esta ação não pode ser desfeita.')) {
                return;
            }
            
            // Salvar nome da seção para a mensagem
            const sectionTitle = this.sections[sectionIndex].title || 'Seção';
            
            // Se a seção atual estiver sendo excluída, limpar editor
            if (this.currentPage && this.currentPage.sectionIndex === sectionIndex) {
                this.clearEditor();
            }
            
            // Remover a seção da lista
            this.sections.splice(sectionIndex, 1);
            
            // Atualizar ordem das seções restantes
            this.sections.forEach((section, index) => {
                section.order = index;
            });
            
            // Renderizar árvore de seções atualizada
            this.renderSectionsTree();
            
            // Salvar alterações no servidor
            this.saveModuleToServer();
            
            // Mostrar notificação
            this.showNotification(`Seção "${sectionTitle}" excluída com sucesso`, 'is-success');
        } catch (error) {
            console.error('Erro ao excluir seção:', error);
            this.showNotification('Erro ao excluir seção: ' + error.message, 'is-danger');
        }
    }
    
    /**
     * Adiciona uma nova página à seção especificada
     * @param {number} sectionIndex - Índice da seção
     */
    addNewPage(sectionIndex) {
        try {
            // Verificar se o índice da seção é válido
            if (sectionIndex < 0 || sectionIndex >= this.sections.length) {
                throw new Error('Índice de seção inválido');
            }
            
            // Referência à seção
            const section = this.sections[sectionIndex];
            
            // Garantir que a seção tenha um array de páginas
            if (!Array.isArray(section.pages)) {
                section.pages = [];
            }
            
            // Criar ID único para a página
            const pageId = this.generateId();
            
            // Criar nova página com valores padrão
            const newPage = {
                id: pageId,
                title: 'Nova Página',
                description: 'Descrição da página',
                order: section.pages.length,
                content: '<p>Conteúdo da página. Edite este texto.</p>'
            };
            
            // Adicionar a nova página à seção
            section.pages.push(newPage);
            
            // Renderizar árvore de seções
        this.renderSectionsTree();
        
            // Selecionar automaticamente a nova página
            this.selectPage(sectionIndex, section.pages.length - 1);
        
        // Mostrar notificação
            this.showNotification('Nova página adicionada com sucesso', 'is-success');
            
            // Solicitar ao usuário que salve as alterações
            this.showNotification('Não se esqueça de salvar suas alterações', 'is-info');
        } catch (error) {
            console.error('Erro ao adicionar nova página:', error);
            this.showNotification('Erro ao adicionar página: ' + error.message, 'is-danger');
        }
    }
    
    /**
     * Edita o título de uma página
     */
    editPage(sectionIndex, pageIndex) {
        this.openPageModal(sectionIndex, pageIndex);
    }
    
    /**
     * Exclui uma página
     */
    deletePage(sectionIndex, pageIndex) {
        try {
            // Validar índices
            if (isNaN(sectionIndex) || sectionIndex < 0 || sectionIndex >= this.sections.length) {
                console.error('Índice de seção inválido:', sectionIndex);
                this.showNotification('Erro: Seção inválida', 'error');
                return false;
            }
            
            // Obter referência à seção
            const section = this.sections[sectionIndex];
            
            // Verificar se a seção tem páginas
            if (!Array.isArray(section.pages) || pageIndex < 0 || pageIndex >= section.pages.length) {
                console.error('Índice de página inválido:', pageIndex);
                this.showNotification('Erro: Página inválida', 'error');
                return false;
            }
            
            // Obter ID da página
            const pageId = section.pages[pageIndex];
            
            if (!pageId || typeof pageId !== 'string') {
                console.error('ID de página inválido:', pageId);
                this.showNotification('Erro: ID de página inválido', 'error');
                return false;
            }
            
            // Confirmar exclusão
            if (!confirm(`Tem certeza que deseja excluir a página "${this.content[pageId]?.title || 'Sem título'}"? Esta ação não pode ser desfeita.`)) {
                return false;
            }
            
            // Remover a página da seção
            section.pages.splice(pageIndex, 1);
            
            // Remover o conteúdo da página
            if (this.content && this.content[pageId]) {
                delete this.content[pageId];
            }
        
        // Atualizar a árvore de seções
        this.renderSectionsTree();
        
            // Salvar alterações
            this.saveChanges();
            
            // Notificar usuário
            this.showNotification('Página excluída com sucesso', 'success');
            
            return true;
        } catch (error) {
            console.error('Erro ao excluir página:', error);
            this.showNotification(`Erro ao excluir página: ${error.message}`, 'error');
            return false;
        }
    }
    
    /**
     * Salva todas as alterações no módulo
     */
    async saveChanges() {
        try {
            // Salvar o conteúdo da página atual, se houver
            this.saveCurrentPageContent();
            
            // Mostrar indicador de salvamento
            const saveBtn = document.getElementById('saveBtn');
            if (saveBtn) {
                saveBtn.classList.add('is-loading');
                saveBtn.disabled = true;
            }
            
            this.showNotification('Salvando módulo...', 'is-info');
            
            // Verificar se o módulo está carregado
            if (!this.module || !this.module.id) {
                throw new Error('Módulo não carregado corretamente');
            }
            
            // Preparar os dados para envio
            const moduleData = {
                sections: this.sections,
                content: this.content
            };
            
            // Verificar o tamanho dos dados
            const jsonDataSize = JSON.stringify(moduleData).length;
            console.log(`Tamanho dos dados a serem enviados: ${Math.round(jsonDataSize / 1024)} KB`);
            
            // Se o tamanho for muito grande (acima de 10MB), comprimir o conteúdo
            const compressionThreshold = 10 * 1024 * 1024; // 10MB
            let contentKeys = Object.keys(this.content);
            
            if (jsonDataSize > compressionThreshold) {
                console.warn('Conteúdo grande detectado, otimizando antes do envio');
                
                // Otimizar imagens no conteúdo se o tamanho for muito grande
                for (const pageId of contentKeys) {
                    const page = this.content[pageId];
                    if (page && page.content) {
                        // Limitar o tamanho do conteúdo muito grande
                        if (page.content.length > 1000000) { // Se for maior que 1MB
                            console.warn(`Página ${pageId} com conteúdo muito grande (${Math.round(page.content.length / 1024)} KB)`);
                            
                            // Remover grandes blocos de dados base64 se existirem
                            page.content = page.content.replace(/data:image\/[^;]+;base64,[a-zA-Z0-9+/]+={0,2}/g, match => {
                                if (match.length > 10000) { // Se a imagem for maior que 10KB
                                    console.warn('Substituindo imagem base64 grande por referência');
                                    return '[Imagem Grande Removida - Por favor use URL externa]';
                                }
                                return match;
                            });
                        }
                    }
                }
            }
            
            // Registrar dados que serão enviados
            console.log('Enviando dados do módulo para salvamento:', {
                sections: this.sections,
                contentKeys: contentKeys
            });
            
            // Enviar solicitação PUT para atualizar o módulo
            const response = await fetch(`/api/learning/modules/${this.module.id}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
                },
                body: JSON.stringify(moduleData)
            });
            
            // Verificar se a resposta foi bem-sucedida
            if (!response.ok) {
                const errorData = await response.json();
                console.error(`Erro ${response.status}:`, errorData);
                throw new Error(errorData.error || errorData.message || 'Erro no servidor');
            }
            
            // Processar resposta bem-sucedida
            const updatedModule = await response.json();
            
            // Atualizar dados locais
            this.module = updatedModule;
            this.showNotification('Módulo salvo com sucesso!', 'is-success');
            
            return updatedModule;
        } catch (error) {
            console.error('Erro ao salvar módulo:', error);
            this.showNotification(`Erro ao salvar módulo: ${error.message}`, 'is-danger');
            throw error;
        } finally {
            // Restaurar botão de salvar
            const saveBtn = document.getElementById('saveBtn');
            if (saveBtn) {
                saveBtn.classList.remove('is-loading');
                saveBtn.disabled = false;
            }
        }
    }
    
    // ===== Funções de drag and drop =====
    
    /**
     * Manipula o início do arrasto
     */
    handleDragStart(e, type, sectionIndex, pageIndex = null) {
        this.draggingElement = { type, sectionIndex, pageIndex };
        e.currentTarget.classList.add('dragging');
        
        // Armazenar o tipo e os índices para uso durante o drop
        e.dataTransfer.setData('text/plain', JSON.stringify(this.draggingElement));
        e.dataTransfer.effectAllowed = 'move';
    }
    
    /**
     * Manipula o evento dragover
     */
    handleDragOver(e) {
        e.preventDefault();
        e.currentTarget.classList.add('drag-over');
        e.dataTransfer.dropEffect = 'move';
    }
    
    /**
     * Manipula o evento dragleave
     */
    handleDragLeave(e) {
        e.currentTarget.classList.remove('drag-over');
    }
    
    /**
     * Manipula o drop
     */
    handleDrop(e, targetType, targetSectionIndex, targetPageIndex = null) {
        e.preventDefault();
        e.currentTarget.classList.remove('drag-over');
        
        if (!this.draggingElement) return;
        
        const { type, sectionIndex, pageIndex } = this.draggingElement;
        
        // Mover seção
        if (type === 'section' && targetType === 'section') {
            // Não fazer nada se for a mesma seção
            if (sectionIndex === targetSectionIndex) return;
            
            // Mover a seção para a nova posição
            const section = this.sections.splice(sectionIndex, 1)[0];
            const newIndex = sectionIndex < targetSectionIndex ? targetSectionIndex - 1 : targetSectionIndex;
            this.sections.splice(newIndex, 0, section);
            
            // Atualizar a árvore de seções
            this.renderSectionsTree();
        }
        
        // Mover página dentro da mesma seção
        else if (type === 'page' && targetType === 'page' && sectionIndex === targetSectionIndex) {
            // Não fazer nada se for a mesma página
            if (pageIndex === targetPageIndex) return;
            
            // Mover a página para a nova posição
            const page = this.sections[sectionIndex].pages.splice(pageIndex, 1)[0];
            const newIndex = pageIndex < targetPageIndex ? targetPageIndex - 1 : targetPageIndex;
            this.sections[sectionIndex].pages.splice(newIndex, 0, page);
            
            // Atualizar a árvore de seções
            this.renderSectionsTree();
        }
        
        // Mover página para outra seção
        else if (type === 'page' && targetType === 'section' && sectionIndex !== targetSectionIndex) {
            // Mover a página para a nova seção
            const page = this.sections[sectionIndex].pages.splice(pageIndex, 1)[0];
            if (!this.sections[targetSectionIndex].pages) {
                this.sections[targetSectionIndex].pages = [];
            }
            this.sections[targetSectionIndex].pages.push(page);
            
            // Atualizar a árvore de seções
            this.renderSectionsTree();
        }
        
        // Limpar o elemento sendo arrastado
        this.draggingElement = null;
    }
    
    /**
     * Manipula o fim do arrasto
     */
    handleDragEnd(e) {
        e.currentTarget.classList.remove('dragging');
        this.draggingElement = null;
        
        // Remover a classe drag-over de todos os elementos
        document.querySelectorAll('.drag-over').forEach(el => {
            el.classList.remove('drag-over');
        });
    }
    
    /**
     * Gera um ID único para seções e páginas
     */
    generateId() {
        return 'id_' + Math.random().toString(36).substr(2, 9);
    }
    
    /**
     * Mostra uma notificação temporária
     */
    showNotification(message, type = 'is-info') {
        // Criar o elemento de notificação
        const notification = document.createElement('div');
        notification.className = `notification ${type} toast-notification`;
        notification.innerHTML = `
            <button class="delete"></button>
            ${message}
        `;
        
        // Adicionar ao corpo do documento
        document.body.appendChild(notification);
        
        // Configurar o botão de fechar
        notification.querySelector('.delete').addEventListener('click', () => {
            notification.remove();
        });
        
        // Remover automaticamente após 3 segundos
        setTimeout(() => {
            notification.remove();
        }, 3000);
    }
    
    /**
     * Limpa o editor e reseta o estado de edição
     */
    clearEditor() {
        // Limpar áreas de edição e preview
        if (this.elements.editorArea) {
            this.elements.editorArea.innerHTML = '';
        }
        
        if (this.elements.previewArea) {
            this.elements.previewArea.innerHTML = '';
        }
        
        // Resetar estado de edição
        this.currentPage = null;
        this.isEditing = false;
        
        // Atualizar UI para refletir que nada está sendo editado
        const pageTitleElement = document.getElementById('pageTitle');
        if (pageTitleElement) {
            pageTitleElement.textContent = 'Nenhuma página selecionada';
        }
        
        // Desativar botões de edição
        const editButtons = document.querySelectorAll('.page-edit-buttons button');
        editButtons.forEach(button => {
            button.disabled = true;
        });
    }
    
    /**
     * Expande uma seção na árvore de seções
     * @param {number} sectionIndex - Índice da seção a ser expandida
     */
    expandSection(sectionIndex) {
        try {
            // Verificar se o índice da seção é válido
            if (sectionIndex < 0 || sectionIndex >= this.sections.length) {
                console.warn(`Índice de seção inválido: ${sectionIndex}`);
                return;
            }
            
            // Encontrar o elemento da seção na árvore
            const sectionElement = document.querySelector(`#section-${sectionIndex}`);
            if (!sectionElement) {
                console.warn(`Elemento da seção #section-${sectionIndex} não encontrado`);
                return;
            }
            
            // Encontrar o botão de expansão
            const expandButton = sectionElement.querySelector('.section-expand-btn');
            if (!expandButton) {
                console.warn('Botão de expansão não encontrado');
                return;
            }
            
            // Encontrar o container de páginas
            const pagesContainer = sectionElement.querySelector('.section-pages');
            if (!pagesContainer) {
                console.warn('Container de páginas não encontrado');
                return;
            }
            
            // Expandir a seção se não estiver expandida
            if (pagesContainer.style.display === 'none' || !pagesContainer.style.display) {
                pagesContainer.style.display = 'block';
                expandButton.innerHTML = '&#9660;'; // Seta para baixo
                expandButton.setAttribute('title', 'Recolher seção');
            }
            
            // Rolar até a seção
            sectionElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
        } catch (error) {
            console.error('Erro ao expandir seção:', error);
        }
    }
    
    /**
     * Renderiza o editor para a página atual
     */
    renderEditor() {
        if (!this.currentPage) {
            console.warn('Nenhuma página selecionada para renderizar o editor');
            return;
        }
        
        const pageData = this.content[this.currentPage];
        if (!pageData) {
            console.warn(`Dados da página ${this.currentPage} não encontrados`);
            return;
        }
        
        // Atualizar ou criar formulário do editor
        const editorArea = document.getElementById('editorArea');
        if (!editorArea) {
            console.error('Área do editor não encontrada');
            return;
        }
        
        // Verificar se já existe um formulário
        let form = editorArea.querySelector('form.editor-form');
        if (!form) {
            // Criar formulário
            form = document.createElement('form');
            form.className = 'editor-form';
            
            form.innerHTML = `
                <div class="field">
                    <label class="label">Título da Página</label>
                    <div class="control">
                        <input type="text" class="input" id="pageTitle" placeholder="Título da página">
                    </div>
                </div>
                
                <div class="field">
                    <label class="label">Descrição</label>
                    <div class="control">
                        <input type="text" class="input" id="pageDescription" placeholder="Breve descrição (opcional)">
                    </div>
                </div>
                
                <div class="field">
                    <label class="label">Conteúdo</label>
                    <div class="control">
                        <textarea id="editor"></textarea>
                    </div>
                </div>
            `;
            
            editorArea.appendChild(form);
        }
        
        // Preencher os campos com os dados da página
        const titleField = form.querySelector('#pageTitle');
        if (titleField) {
            titleField.value = pageData.title || 'Sem título';
        }
        
        const descField = form.querySelector('#pageDescription');
        if (descField) {
            descField.value = pageData.description || '';
        }
        
        // Atualizar título na área superior
        const currentPageTitle = document.getElementById('currentPageTitle');
        if (currentPageTitle) {
            currentPageTitle.textContent = pageData.title || 'Sem título';
        }
        
        // Inicializar ou atualizar o editor
        this.initMarkdownEditor(pageData.content || '');
        
        // Habilitar botões de salvar e preview
        const saveBtn = document.getElementById('saveBtn');
        if (saveBtn) {
            saveBtn.disabled = false;
        }
        
        const previewBtn = document.getElementById('previewBtn');
        if (previewBtn) {
            previewBtn.disabled = false;
        }
    }

    /**
     * Inicializa o editor Markdown (EasyMDE)
     * @param {string} initialContent - Conteúdo inicial do editor
     */
    initMarkdownEditor(initialContent = '') {
        try {
            console.log('Inicializando editor Markdown com conteúdo:', initialContent.substring(0, 50) + '...');
            
            // Verificar se a área do editor existe
            const editorArea = document.getElementById('editorArea');
            if (!editorArea) {
                console.error('Elemento editorArea não encontrado');
                this.showNotification('Erro ao inicializar o editor: área de edição não encontrada', 'is-danger');
                return;
            }

            // Limpar qualquer conteúdo anterior
            editorArea.innerHTML = '';
            
            // Criar um elemento textarea para o editor
            const textarea = document.createElement('textarea');
            textarea.id = 'markdownEditor';
            textarea.value = initialContent;
            editorArea.appendChild(textarea);

            // Inicializar o EasyMDE
            const mdeOptions = {
                element: textarea,
                spellChecker: false,
                autosave: {
                    enabled: true,
                    uniqueId: 'neohubEditor',
                    delay: 1000,
                },
                lineWrapping: true,
                status: ['lines', 'words'],
                renderingConfig: {
                    singleLineBreaks: true,
                    codeSyntaxHighlighting: true,
                },
                previewRender: (markdown) => {
                    try {
                        // Usar o marked para renderizar Markdown para HTML
                        const html = marked.parse(markdown);
                        
                        // Usar DOMPurify para sanitizar o HTML
                        return DOMPurify.sanitize(html);
                    } catch (error) {
                        console.error('Erro ao renderizar Markdown:', error);
                        return '<p>Erro ao renderizar conteúdo</p>';
                    }
                }
            };

            this.editor = new EasyMDE(mdeOptions);
            
            console.log('Editor Markdown inicializado com sucesso');
            
            // Adicionar listener para atualizar o estado do botão de salvar quando o conteúdo mudar
            this.editor.codemirror.on('change', () => {
                this.updateSaveButton();
            });
            
            // Forçar renderização inicial do editor
            this.editor.codemirror.refresh();
            
        } catch (error) {
            console.error('Erro ao inicializar editor Markdown:', error);
            this.showNotification('Erro ao inicializar o editor Markdown: ' + error.message, 'is-danger');
        }
    }
    
    /**
     * Atualiza o estado do botão de salvar com base em mudanças no editor
     */
    updateSaveButton() {
        const saveButton = document.getElementById('saveBtn');
        if (!saveButton) return;
        
        // Verificar se há uma página selecionada e se o editor existe
        if (this.currentPage && this.editor) {
            saveButton.disabled = false;
            saveButton.classList.add('is-active');
        } else {
            saveButton.disabled = true;
            saveButton.classList.remove('is-active');
        }
    }

    /**
     * Abre o modal de importação de HTML
     */
    openImportHtmlModal() {
        const modal = document.getElementById('importHtmlModal');
        if (!modal) {
            console.error('Modal de importação HTML não encontrado');
            return;
        }

        // Verificar se há uma página selecionada
        if (!this.currentPage) {
            this.showNotification('Selecione uma página antes de importar HTML', 'is-warning');
            return;
        }

        // Resetar campos
        const htmlContent = document.getElementById('htmlContent');
        const htmlFile = document.getElementById('htmlFile');
        const fileName = document.getElementById('fileName');
        
        if (htmlContent) htmlContent.value = '';
        if (htmlFile) htmlFile.value = '';
        if (fileName) fileName.textContent = 'Nenhum arquivo selecionado';

        // Configurar event listeners do modal
        if (!this.importHtmlListenersAdded) {
            this.setupImportHtmlListeners();
            this.importHtmlListenersAdded = true;
        }

        // Abrir modal
        modal.classList.add('is-active');
        document.documentElement.classList.add('is-clipped');
    }

    /**
     * Configura event listeners para o modal de importação de HTML
     */
    setupImportHtmlListeners() {
        const modal = document.getElementById('importHtmlModal');
        const htmlFile = document.getElementById('htmlFile');
        const fileName = document.getElementById('fileName');
        const confirmImportBtn = document.getElementById('confirmImportBtn');
        const cancelImportBtn = document.getElementById('cancelImportBtn');
        const closeButton = modal.querySelector('.delete');

        // Listener para atualizar nome do arquivo
        if (htmlFile && fileName) {
            htmlFile.addEventListener('change', () => {
                if (htmlFile.files.length > 0) {
                    fileName.textContent = htmlFile.files[0].name;
                    
                    // Ler o arquivo e atualizar o textarea
                    const reader = new FileReader();
                    reader.onload = (e) => {
                        const htmlContent = document.getElementById('htmlContent');
                        if (htmlContent) {
                            htmlContent.value = e.target.result;
                        }
                    };
                    reader.readAsText(htmlFile.files[0]);
                } else {
                    fileName.textContent = 'Nenhum arquivo selecionado';
                }
            });
        }

        // Listener para fechar modal
        if (closeButton) {
            closeButton.addEventListener('click', () => {
                this.closeImportHtmlModal();
            });
        }

        // Listener para cancelar importação
        if (cancelImportBtn) {
            cancelImportBtn.addEventListener('click', () => {
                this.closeImportHtmlModal();
            });
        }

        // Listener para confirmar importação
        if (confirmImportBtn) {
            confirmImportBtn.addEventListener('click', () => {
                this.importHtml();
            });
        }
    }

    /**
     * Fecha o modal de importação de HTML
     */
    closeImportHtmlModal() {
        const modal = document.getElementById('importHtmlModal');
        if (modal) {
            modal.classList.remove('is-active');
            document.documentElement.classList.remove('is-clipped');
        }
    }

    /**
     * Importa o HTML e o insere no editor
     */
    importHtml() {
        const htmlContent = document.getElementById('htmlContent');
        const convertToMarkdown = document.getElementById('convertToMarkdown');
        const replaceContent = document.getElementById('replaceContent');
        const preserveStyles = document.getElementById('preserveStyles');
        
        if (!htmlContent || !this.currentPage || !this.editor) {
            this.showNotification('Erro ao importar HTML: editor não inicializado', 'is-danger');
            return;
        }
        
        try {
            const html = htmlContent.value.trim();
            
            if (!html) {
                this.showNotification('Nenhum conteúdo HTML para importar', 'is-warning');
                return;
            }
            
            // Verificar se é para converter ou manter como HTML
            let content = '';
            const shouldPreserveStyles = preserveStyles && preserveStyles.checked;
            
            if (convertToMarkdown && convertToMarkdown.checked) {
                // Converter para Markdown
                content = this.convertHtmlToMarkdown(html);
            } else {
                // Processar o HTML, preservando estilos se necessário
                content = this.processHtmlContent(html, shouldPreserveStyles);
            }
            
            // Atualizar o editor
            if (replaceContent && replaceContent.checked) {
                // Substituir todo o conteúdo
                this.editor.value(content);
            } else {
                // Inserir na posição atual do cursor
                const currentContent = this.editor.value();
                const cursorPosition = this.editor.codemirror.getCursor();
                const before = currentContent.substring(0, this.editor.codemirror.indexFromPos(cursorPosition));
                const after = currentContent.substring(this.editor.codemirror.indexFromPos(cursorPosition));
                
                this.editor.value(before + content + after);
            }
            
            // Fechar o modal
            this.closeImportHtmlModal();
            
            // Notificar sucesso
            const modoMsg = convertToMarkdown && convertToMarkdown.checked ? 'convertido para Markdown' : 'mantido como HTML';
            this.showNotification(`Conteúdo HTML importado com sucesso (${modoMsg})`, 'is-success');
            
            // Marcar que há alterações não salvas
            this.hasUnsavedChanges = true;
            
            // Atualizar o preview se estiver ativo
            const previewArea = document.getElementById('previewArea');
            if (previewArea && !previewArea.classList.contains('is-hidden')) {
                this.togglePreview();
                this.togglePreview();
            }
        } catch (error) {
            console.error('Erro ao importar HTML:', error);
            this.showNotification('Erro ao importar HTML: ' + error.message, 'is-danger');
        }
    }
    
    /**
     * Extrai os estilos CSS do HTML e retorna separadamente
     * @param {string} html - HTML de origem
     * @returns {object} Objeto com HTML e estilos separados
     */
    extractStylesFromHtml(html) {
        try {
            // Criar um DOM temporário para analisar o HTML
            const parser = new DOMParser();
            const doc = parser.parseFromString(html, 'text/html');
            
            // Extrair todos os estilos (tags <style> e atributos style)
            const styleElements = doc.querySelectorAll('style');
            let styles = '';
            
            // Coletar estilos das tags <style>
            styleElements.forEach(styleEl => {
                styles += styleEl.textContent + '\n';
                styleEl.remove(); // Remover do documento para evitar duplicação
            });
            
            // Gerar HTML resultante
            const resultHtml = doc.body.innerHTML;
            
            return {
                html: resultHtml,
                styles: styles
            };
        } catch (error) {
            console.error('Erro ao extrair estilos:', error);
            return { html: html, styles: '' };
        }
    }

    /**
     * Converte HTML para Markdown usando o DOM
     * @param {string} html - Conteúdo HTML
     * @returns {string} - Conteúdo convertido para Markdown
     */
    convertHtmlToMarkdown(html) {
        if (!html || typeof html !== 'string') return '';
        
        try {
            // Sanitizar o HTML usando DOMPurify
            const sanitizedHtml = DOMPurify.sanitize(html);
            
            // Criar um elemento temporário para analisar o HTML
            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = sanitizedHtml;
            
            // Verificar se o conteúdo tem elementos complexos que são difíceis de converter para Markdown
            const hasComplexElements = tempDiv.querySelector('table, form, iframe, canvas, svg');
            
            // Remover estilos inline que possam causar problemas
            tempDiv.querySelectorAll('[style]').forEach(element => {
                element.removeAttribute('style');
            });
            
            // Limpar elementos vazios que podem causar quebras de linha desnecessárias
            tempDiv.querySelectorAll('p, div, span').forEach(element => {
                if (element.innerHTML.trim() === '') {
                    element.remove();
                }
            });
            
            if (hasComplexElements) {
                // Para elementos complexos, manter como HTML
                return sanitizedHtml;
            }
            
            // Função para processar cada nó do DOM
            function processNode(node, level = 0) {
                if (!node) return '';
                
                // Processar elementos específicos
                switch (node.nodeType) {
                    case Node.TEXT_NODE:
                        // Preservar espaços em branco significativos, mas remover espaços excessivos
                        const text = node.textContent
                            .replace(/\s+/g, ' ') // Substituir múltiplos espaços por um único
                            .replace(/^\s+|\s+$/g, ''); // Remover espaços no início e fim
                        return text;
                        
                    case Node.ELEMENT_NODE:
                        // Processar elementos específicos
                        switch (node.nodeName.toLowerCase()) {
                            case 'h1':
                                return `# ${processChildren(node).trim()}\n\n`;
                            case 'h2':
                                return `## ${processChildren(node).trim()}\n\n`;
                            case 'h3':
                                return `### ${processChildren(node).trim()}\n\n`;
                            case 'h4':
                                return `#### ${processChildren(node).trim()}\n\n`;
                            case 'h5':
                                return `##### ${processChildren(node).trim()}\n\n`;
                            case 'h6':
                                return `###### ${processChildren(node).trim()}\n\n`;
                            case 'p':
                                const pContent = processChildren(node).trim();
                                return pContent ? `${pContent}\n\n` : '';
                            case 'br':
                                return '\n';
                            case 'hr':
                                return '---\n\n';
                            case 'b':
                            case 'strong':
                                return `**${processChildren(node).trim()}**`;
                            case 'i':
                            case 'em':
                                return `*${processChildren(node).trim()}*`;
                            case 'a':
                                return `[${processChildren(node).trim()}](${node.getAttribute('href') || '#'})`;
                            case 'img':
                                return `![${node.getAttribute('alt') || ''}](${node.getAttribute('src') || '#'})`;
                            case 'blockquote':
                                const bqContent = processChildren(node).trim();
                                return bqContent ? `> ${bqContent.split('\n').join('\n> ')}\n\n` : '';
                            case 'pre':
                                // Se for um bloco pré-formatado que contém código
                                if (node.querySelector('code')) {
                                    const code = node.querySelector('code');
                                    // Verificar se o conteúdo parece realmente código
                                    const codeContent = code.textContent.trim();
                                    // Se parece mais texto do que código, tratar como texto normal
                                    if (!codeContent.includes('{') && !codeContent.includes('function') && 
                                        !codeContent.includes('=') && !codeContent.includes(';') && 
                                        codeContent.split('\n').length <= 2) {
                                        return `${codeContent}\n\n`;
                                    }
                                    const language = code.className.match(/language-(\w+)/) ? 
                                        code.className.match(/language-(\w+)/)[1] : '';
                                    return `\`\`\`${language}\n${code.textContent}\n\`\`\`\n\n`;
                                } else {
                                    // Verificar se o conteúdo parece texto normal
                                    const preContent = node.textContent.trim();
                                    if (!preContent.includes('{') && !preContent.includes('function') && 
                                        !preContent.includes('=') && !preContent.includes(';') && 
                                        preContent.split('\n').length <= 3) {
                                        // Tratar como texto normal se parecer mais texto que código
                                        return `${preContent}\n\n`;
                                    }
                                    return `\`\`\`\n${node.textContent}\n\`\`\`\n\n`;
                                }
                            case 'code':
                                // Se não estiver dentro de um <pre>
                                if (node.parentNode.nodeName.toLowerCase() !== 'pre') {
                                    const codeContent = node.textContent.trim();
                                    // Se parece mais texto do que código, tratar como texto normal com ênfase
                                    if (codeContent.length < 40 && 
                                        !codeContent.includes('{') && 
                                        !codeContent.includes('function') && 
                                        !codeContent.includes('=') && 
                                        !codeContent.includes(';')) {
                                        return `**${codeContent}**`;
                                    }
                                    return `\`${codeContent}\``;
                                }
                                // Se estiver dentro de um <pre>, será tratado pelo caso 'pre'
                                return node.textContent;
                            case 'ul':
                                let ulResult = '\n';
                                Array.from(node.children).forEach(li => {
                                    if (li.nodeName.toLowerCase() === 'li') {
                                        const liContent = processChildren(li).trim();
                                        if (liContent) {
                                            ulResult += `- ${liContent}\n`;
                                        }
                                    }
                                });
                                return ulResult + '\n';
                            case 'ol':
                                let olResult = '\n';
                                Array.from(node.children).forEach((li, index) => {
                                    if (li.nodeName.toLowerCase() === 'li') {
                                        const liContent = processChildren(li).trim();
                                        if (liContent) {
                                            olResult += `${index + 1}. ${liContent}\n`;
                                        }
                                    }
                                });
                                return olResult + '\n';
                            case 'li':
                                // Tratado pelos casos 'ul' e 'ol'
                                return processChildren(node);
                            case 'div':
                                // Tratar divs com estilo especial
                                if (node.className.includes('callout') || 
                                    node.className.includes('note') || 
                                    node.className.includes('alert') ||
                                    node.className.includes('warning') ||
                                    node.className.includes('info')) {
                                    return `> **Nota:** ${processChildren(node).trim()}\n\n`;
                                }
                                // Processar divs normais como parágrafos
                                const divContent = processChildren(node).trim();
                                return divContent ? `${divContent}\n\n` : '';
                            case 'span':
                                // Tratar spans como texto normal
                                return processChildren(node);
                            case 'table':
                                // Manter tabelas como HTML
                                return `\n${node.outerHTML}\n\n`;
                            default:
                                // Para outros elementos, processar seus filhos
                                return processChildren(node);
                        }
                        
                    default:
                        return '';
                }
            }
            
            // Função para processar os nós filhos
            function processChildren(node) {
                let result = '';
                if (node.childNodes && node.childNodes.length > 0) {
                    Array.from(node.childNodes).forEach(child => {
                        result += processNode(child);
                    });
                }
                return result;
            }
            
            // Processar o conteúdo
            let markdown = '';
            Array.from(tempDiv.childNodes).forEach(node => {
                markdown += processNode(node);
            });
            
            // Limpar formatação excessiva
            markdown = markdown
                .replace(/\n{3,}/g, '\n\n') // Substituir mais de 2 quebras de linha por apenas 2
                .replace(/^\s+|\s+$/g, ''); // Remover espaços em branco no início e fim
            
            return markdown;
        } catch (error) {
            console.error('Erro ao converter HTML para Markdown:', error);
            return html;
        }
    }

    /**
     * Processa o conteúdo HTML para garantir que os estilos CSS sejam preservados e aplicados corretamente
     * @param {string} html - Conteúdo HTML original
     * @param {boolean} preserveStyles - Se deve preservar estilos CSS
     * @returns {string} - HTML processado
     */
    processHtmlContent(html, preserveStyles = true) {
        if (!html) return '';
        
        try {
            // Sanitizar o HTML para segurança
            const sanitizedHtml = DOMPurify.sanitize(html, {
                ADD_TAGS: ['iframe', 'style'],
                ADD_ATTR: ['allow', 'allowfullscreen', 'frameborder', 'scrolling', 'class', 'style'],
                FORBID_TAGS: ['script'],
                FORBID_ATTR: ['onerror', 'onload', 'onclick', 'onmouseover']
            });
            
            if (!preserveStyles) {
                return sanitizedHtml;
            }
            
            // Processar o conteúdo para garantir que os estilos sejam preservados
            const parser = new DOMParser();
            const doc = parser.parseFromString(sanitizedHtml, 'text/html');
            
            // Coletar todos os estilos
            let styleContent = '';
            
            // 1. Extrair estilos das tags <style>
            const styleElements = doc.querySelectorAll('style');
            styleElements.forEach(styleEl => {
                styleContent += styleEl.textContent + '\n';
                // Não remover os elementos style, apenas coletar seu conteúdo
            });
            
            // 2. Extrair estilos de folhas de estilo externas referenciadas
            const linkElements = doc.querySelectorAll('link[rel="stylesheet"]');
            const linkUrls = Array.from(linkElements).map(link => link.getAttribute('href')).filter(Boolean);
            
            // 3. Preservar classes e estilos inline nos elementos
            const elementsWithStyles = doc.querySelectorAll('[style], [class]');
            elementsWithStyles.forEach(el => {
                // Garantir que os atributos style e class são preservados
                if (el.hasAttribute('style')) {
                    el.setAttribute('data-original-style', el.getAttribute('style'));
                }
                if (el.hasAttribute('class')) {
                    el.setAttribute('data-original-class', el.getAttribute('class'));
                }
            });
            
            // Construir o HTML final com estilos preservados
            let resultHtml = doc.body.innerHTML;
            
            // Se houver estilos coletados, incluí-los no resultado
            if (styleContent.trim()) {
                resultHtml = `<style>\n${styleContent}\n</style>\n${resultHtml}`;
            }
            
            // Se houver links para folhas de estilo externas, adicionar como comentários
            if (linkUrls.length > 0) {
                const styleLinks = linkUrls.map(url => `<!-- Folha de estilo externa: ${url} -->`).join('\n');
                resultHtml = `${styleLinks}\n${resultHtml}`;
            }
            
            return resultHtml;
        } catch (error) {
            console.error('Erro ao processar conteúdo HTML:', error);
            return html; // Em caso de erro, retornar o HTML original
        }
    }
}

// Inicializar o editor quando o documento estiver pronto
document.addEventListener('DOMContentLoaded', () => {
    new ModuleContentEditor();
}); 