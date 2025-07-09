/**
 * Módulo para edição de conteúdo de módulos de aprendizagem
 * Permite criar e gerenciar seções e páginas com conteúdo em markdown ou HTML
 */
class ModuleContentEditor {
    constructor() {
        this.moduleId = window.location.pathname.split('/').pop();
        
        // Inicializar biblioteca de componentes
        console.log('Inicializando biblioteca de componentes...');
        this.componentsLibrary = new ComponentsLibrary();
        
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
            preserveStyles: document.getElementById('preserveStyles'),
            isNeoBiblioteca: document.getElementById('isNeoBiblioteca'),

            // Elementos do modal de componentes
            componentsBtn: document.getElementById('componentsBtn'),
            componentsModal: document.getElementById('componentsModal'),
            componentConfigModal: document.getElementById('componentConfigModal'),
            insertComponentBtn: document.getElementById('insertComponentBtn'),
            detailsId: document.getElementById('detailsId'),
            detailsContent: document.getElementById('detailsContent'),
            navPath: document.getElementById('navPath'),
            navText: document.getElementById('navText'),
            tableHeaders: document.getElementById('tableHeaders'),
            tableData: document.getElementById('tableData')
        };

        // Verificar elementos críticos
        console.log('Verificando elementos do DOM...');
        if (!this.elements.componentsBtn) {
            console.error('Botão de componentes não encontrado');
        }
        if (!this.elements.componentsModal) {
            console.error('Modal de componentes não encontrado');
        }
        
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
        console.log('Configurando event listeners...');
        
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

        // Botão de Componentes
        console.log('Configurando botão de componentes...');
        if (this.elements.componentsBtn) {
            console.log('Adicionando evento de clique ao botão de componentes');
            this.elements.componentsBtn.addEventListener('click', () => {
                console.log('Botão de componentes clicado');
                this.openComponentsModal();
            });
        } else {
            console.error('Botão de componentes não encontrado');
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

        // Eventos dos modais de componentes
        this.setupComponentsModalListeners();
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
     * Configura os listeners dos modais de componentes
     */
    setupComponentsModalListeners() {
        console.log('Configurando listeners dos modais de componentes...');
        
        const componentsModal = document.getElementById('componentsModal');
        const configModal = document.getElementById('componentConfigModal');
        
        if (!componentsModal || !configModal) {
            console.error('Modais de componentes não encontrados:', {
                componentsModal: !!componentsModal,
                configModal: !!configModal
            });
            return;
        }
        
        // Fechar modal de componentes
        const closeComponentsModal = () => {
            componentsModal.classList.remove('is-active');
        };
        
        componentsModal.querySelectorAll('.delete, .modal-background').forEach(el => {
            el.addEventListener('click', closeComponentsModal);
        });
        
        // Fechar modal de configuração
        const closeConfigModal = () => {
            configModal.classList.remove('is-active');
            this.selectedComponent = null;
        };
        
        configModal.querySelectorAll('.delete, .modal-background, #cancelComponentBtn').forEach(el => {
            el.addEventListener('click', closeConfigModal);
        });
        
        // Inserir componente
        const insertBtn = document.getElementById('insertComponentBtn');
        if (insertBtn) {
            insertBtn.addEventListener('click', () => {
                this.insertSelectedComponent();
                closeConfigModal();
            });
        }
        
        // Adicionar classe ao modal para estilos específicos
        componentsModal.classList.add('components-modal');
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
            
            // Criar o textarea para o editor
            editorArea.innerHTML = '<textarea id="editor"></textarea>';
            
            // Configurar o preview personalizado
            const customPreviewRender = (plainText, preview) => {
                // Não renderizar se o preview estiver escondido
                if (preview.style.display === 'none') {
                    return;
                }
                
                try {
                    // Converter markdown para HTML
                    let html = marked.parse(plainText);
                    
                    // Criar container temporário
                    const tempContainer = document.createElement('div');
                    tempContainer.innerHTML = html;
                    
                    // Processar componentes no preview
                    const processComponents = () => {
                        const elements = tempContainer.querySelectorAll('[data-component]');
                        elements.forEach(element => {
                            const componentId = element.dataset.component;
                            if (componentId && this.componentsLibrary.components[componentId]) {
                                const renderedComponent = this.componentsLibrary.renderComponent(componentId);
                                element.outerHTML = renderedComponent;
                            }
                        });
                    };
                    
                    // Processar componentes
                    processComponents();
                    
                    // Sanitizar e retornar HTML
                    preview.innerHTML = DOMPurify.sanitize(tempContainer.innerHTML, {
                        ADD_TAGS: ['button', 'div', 'span', 'i'],
                        ADD_ATTR: ['class', 'style', 'id', 'onclick', 'data-component'],
                        ALLOW_SCRIPTS: true,
                        ALLOW_DATA_ATTR: true
                    });
                    
                    // Aplicar syntax highlighting
                    preview.querySelectorAll('pre code').forEach((block) => {
                        hljs.highlightElement(block);
                    });
                } catch (error) {
                    console.error('Erro ao renderizar preview:', error);
                    preview.innerHTML = 'Erro ao renderizar preview';
                }
                
                return true;
            };
            
            // Inicializar EasyMDE com as configurações
            this.editor = new EasyMDE({
                element: document.getElementById('editor'),
                autofocus: true,
                spellChecker: false,
                status: false,
                previewRender: customPreviewRender,
                toolbar: [
                    'bold', 'italic', 'heading', '|',
                    'quote', 'unordered-list', 'ordered-list', '|',
                    'link', 'image', 'code', '|',
                    'preview', 'side-by-side', 'fullscreen'
                ],
                renderingConfig: {
                    singleLineBreaks: false,
                    codeSyntaxHighlighting: true,
                },
                previewClass: ['editor-preview', 'markdown-content']
            });
            
            // Configurar visualização lado a lado por padrão
            this.editor.toggleSideBySide();
            
        } catch (error) {
            console.error('Erro ao inicializar editor:', error);
            this.showNotification('Erro ao inicializar editor', 'is-danger');
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
        const htmlContent = document.getElementById('htmlContent');
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
                        if (htmlContent) {
                            htmlContent.value = e.target.result;
                            // Detectar se é conteúdo da Biblioteca Neo
                            this.updateNeoBibliotecaCheckbox(e.target.result);
                        }
                    };
                    reader.readAsText(htmlFile.files[0]);
                } else {
                    fileName.textContent = 'Nenhum arquivo selecionado';
                }
            });
        }

        // Listener para detectar conteúdo colado
        if (htmlContent) {
            htmlContent.addEventListener('paste', () => {
                // Usar setTimeout para garantir que o conteúdo já foi colado
                setTimeout(() => {
                    this.updateNeoBibliotecaCheckbox(htmlContent.value);
                }, 0);
            });
            
            // Também detectar quando o usuário digita/modifica o conteúdo
            htmlContent.addEventListener('input', () => {
                this.updateNeoBibliotecaCheckbox(htmlContent.value);
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
     * Converte HTML para Markdown usando Turndown
     * @param {string} html HTML para converter
     * @returns {string} Markdown convertido
     */
    convertHtmlToMarkdown(html) {
        try {
            // Configurar o Turndown com opções específicas para a Biblioteca Neo
            const turndownService = new TurndownService({
                headingStyle: 'atx',
                hr: '---',
                bulletListMarker: '-',
                codeBlockStyle: 'fenced',
                emDelimiter: '_',
                strongDelimiter: '**',
                linkStyle: 'inlined'
            });

            // Regra para preservar quebras de linha
            turndownService.addRule('lineBreaks', {
                filter: ['br'],
                replacement: () => '\n'
            });

            // Regra para tratar os popups da Biblioteca Neo
            turndownService.addRule('popups', {
                filter: (node) => {
                    return node.classList && node.classList.contains('popupCss');
                },
                replacement: (content, node) => {
                    const title = node.querySelector('b')?.textContent || node.id;
                    return `\n\n## ${title}\n\n${content}\n\n`;
                }
            });

            // Regra para preservar títulos com navegação
            turndownService.addRule('titleLinks', {
                filter: (node) => {
                    return node.hasAttribute('title') && node.getAttribute('title').includes('->');
                },
                replacement: (content, node) => {
                    const title = node.getAttribute('title');
                    return `${content} (${title})`;
                }
            });

            // Remover elementos indesejados
            turndownService.remove(['script', 'style', 'button#btnfecharcsspopup']);

            // Converter HTML para Markdown
            return turndownService.turndown(html);

        } catch (error) {
            console.error('Erro ao converter HTML para Markdown:', error);
            throw new Error('Falha ao converter HTML para Markdown: ' + error.message);
        }
    }

    /**
     * Importa o HTML e o insere no editor
     */
    importHtml() {
        const htmlContent = document.getElementById('htmlContent');
        const convertToMarkdown = document.getElementById('convertToMarkdown');
        const replaceContent = document.getElementById('replaceContent');
        
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
            
            // Processar o conteúdo
            let content = '';
            
            if (convertToMarkdown && convertToMarkdown.checked) {
                // Usar Turndown para converter HTML para Markdown
                content = this.convertHtmlToMarkdown(html);
                this.showNotification('Conteúdo convertido para Markdown', 'is-info');
            } else {
                // Manter como HTML
                content = html;
            }
            
            // Atualizar o editor
            if (replaceContent && replaceContent.checked) {
                this.editor.value(content);
            } else {
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
     * Processa o conteúdo HTML antes de importar
     * @param {string} html - HTML para processar
     * @param {boolean} preserveStyles - Se deve preservar estilos
     * @returns {string} HTML processado
     */
    processHtmlContent(html, preserveStyles = true) {
        try {
            // Criar um DOM temporário
            const parser = new DOMParser();
            const doc = parser.parseFromString(html, 'text/html');
            
            // Função para processar um elemento
            const processElement = (element) => {
                // Remover scripts
                element.querySelectorAll('script').forEach(script => script.remove());
                
                // Remover botões de fechar popup
                element.querySelectorAll('#btnfecharcsspopup').forEach(btn => btn.remove());
                
                // Processar divs de popup
                element.querySelectorAll('.popupCss').forEach(popup => {
                    // Converter para seção
                    popup.classList.remove('popupCss');
                    popup.classList.add('content-section');
                    
                    // Adicionar título se não existir
                    const title = popup.querySelector('b');
                    if (title) {
                        const h2 = document.createElement('h2');
                        h2.textContent = title.textContent;
                        popup.insertBefore(h2, popup.firstChild);
                        title.remove();
                    } else if (popup.id) {
                        const h2 = document.createElement('h2');
                        h2.textContent = popup.id.replace(/_/g, ' ').toUpperCase();
                        popup.insertBefore(h2, popup.firstChild);
                    }
                });
                
                // Processar links
                element.querySelectorAll('a').forEach(link => {
                    // Adicionar target="_blank" para links externos
                    if (link.href && link.href.startsWith('http')) {
                        link.setAttribute('target', '_blank');
                        link.setAttribute('rel', 'noopener');
                    }
                    
                    // Preservar títulos de links que são caminhos de navegação
                    if (link.title && link.title.includes('->')) {
                        const path = link.title;
                        link.insertAdjacentText('afterend', ` (${path})`);
                    }
                });
                
                // Processar imagens
                element.querySelectorAll('img').forEach(img => {
                    // Converter caminhos relativos
                    if (img.src.startsWith('./')) {
                        img.src = img.src.replace('./', '');
                    }
                    
                    // Adicionar classes para responsividade
                    img.classList.add('img-fluid');
                    
                    // Criar figure com caption se houver título
                    if (img.title) {
                        const figure = document.createElement('figure');
                        const figcaption = document.createElement('figcaption');
                        figcaption.textContent = img.title;
                        
                        img.parentNode.insertBefore(figure, img);
                        figure.appendChild(img);
                        figure.appendChild(figcaption);
                    }
                });
                
                // Processar elementos de código
                element.querySelectorAll('code, pre').forEach(code => {
                    // Adicionar classe para highlight.js
                    if (!code.className) {
                        code.className = 'language-plaintext';
                    }
                });
                
                // Processar tabelas
                element.querySelectorAll('table').forEach(table => {
                    // Adicionar classes do Bulma
                    table.classList.add('table', 'is-bordered', 'is-striped');
                    
                    // Garantir que tem thead se houver th
                    const firstRow = table.querySelector('tr');
                    if (firstRow && firstRow.querySelector('th')) {
                        if (!table.querySelector('thead')) {
                            const thead = document.createElement('thead');
                            thead.appendChild(firstRow.cloneNode(true));
                            table.insertBefore(thead, table.firstChild);
                            firstRow.remove();
                        }
                    }
                });
                
                // Processar listas
                element.querySelectorAll('ul, ol').forEach(list => {
                    // Adicionar classes do Bulma
                    if (list.tagName === 'UL') {
                        list.classList.add('is-list');
                    } else {
                        list.classList.add('is-list-ordered');
                    }
                });
                
                // Limpar atributos desnecessários
                element.querySelectorAll('*').forEach(el => {
                    // Manter apenas atributos essenciais e classes adicionadas
                    const keepAttributes = ['src', 'href', 'title', 'alt', 'class', 'id'];
                    Array.from(el.attributes).forEach(attr => {
                        if (!keepAttributes.includes(attr.name) && !preserveStyles) {
                            el.removeAttribute(attr.name);
                        }
                    });
                });
            };
            
            // Processar o documento
            processElement(doc.body);
            
            // Extrair apenas o conteúdo relevante
            let content = '';
            
            // Se houver popups, extrair cada um como uma seção
            const sections = doc.querySelectorAll('.content-section');
            if (sections.length > 0) {
                sections.forEach(section => {
                    content += section.outerHTML + '\n\n';
                });
            } else {
                // Caso contrário, pegar todo o conteúdo do body
                content = doc.body.innerHTML;
            }
            
            // Limpar HTML
            content = content
                .replace(/>\s+</g, '><')  // Remover espaços entre tags
                .replace(/\s+/g, ' ')     // Normalizar espaços
                .replace(/<!--[\s\S]*?-->/g, '')  // Remover comentários
                .trim();
            
            return content;
            
        } catch (error) {
            console.error('Erro ao processar HTML:', error);
            throw new Error('Falha ao processar HTML: ' + error.message);
        }
    }

    /**
     * Processa HTML no formato da Biblioteca Neo
     * @param {string} html HTML da Biblioteca Neo
     * @returns {string} HTML processado
     */
    processNeoBibliotecaHtml(html) {
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');
        
        // Extrair todos os popups
        const popups = doc.querySelectorAll('.popupCss');
        let content = '';
        
        popups.forEach(popup => {
            const title = popup.querySelector('b')?.textContent || popup.id;
            const button = popup.querySelector('#btnfecharcsspopup');
            if (button) button.remove();
            
            content += `<section class="content-section">
                <h2>${title}</h2>
                ${popup.innerHTML}
            </section>\n\n`;
        });
        
        return content || doc.body.innerHTML;
    }

    /**
     * Detecta se o conteúdo é da Biblioteca Neo
     * @param {string} html Conteúdo HTML
     * @returns {boolean} true se for da Biblioteca Neo
     */
    detectNeoBiblioteca(html) {
        if (!html) return false;
        
        const indicators = [
            'class="popupCss"',
            'id="btnfecharcsspopup"',
            'Biblioteca Neo',
            'neosistemas.com.br'
        ];
        
        return indicators.some(indicator => html.includes(indicator));
    }

    /**
     * Atualiza o checkbox isNeoBiblioteca baseado no conteúdo
     * @param {string} html Conteúdo HTML
     */
    updateNeoBibliotecaCheckbox(html) {
        const checkbox = document.getElementById('isNeoBiblioteca');
        if (checkbox) {
            const isNeo = this.detectNeoBiblioteca(html);
            checkbox.checked = isNeo;
            
            if (isNeo) {
                this.showNotification('Conteúdo da Biblioteca Neo detectado automaticamente', 'is-info');
            }
        }
    }

    /**
     * Abre o modal de seleção de componentes
     */
    async openComponentsModal() {
        console.log('Abrindo modal de componentes...');
        
        if (!this.componentsLibrary) {
            console.error('Biblioteca de componentes não inicializada');
            this.showNotification('Erro: Biblioteca de componentes não inicializada', 'is-danger');
            return;
        }

        const modal = document.getElementById('componentsModal');
        const tabsContainer = document.getElementById('componentTabs');
        const listContainer = document.getElementById('componentsList');
        
        if (!modal || !tabsContainer || !listContainer) {
            console.error('Elementos do modal não encontrados:', {
                modal: !!modal,
                tabs: !!tabsContainer,
                list: !!listContainer
            });
            this.showNotification('Erro: Elementos do modal não encontrados', 'is-danger');
            return;
        }

        try {
            // Carregar componentes se ainda não foram carregados
            if (!this.componentsLibrary.components || Object.keys(this.componentsLibrary.components).length === 0) {
                console.log('Carregando componentes...');
                await this.componentsLibrary.loadComponents();
            }
            
            // Limpar conteúdo anterior
            tabsContainer.innerHTML = '';
            listContainer.innerHTML = '';
            
            // Buscar categorias e componentes
            const categories = this.componentsLibrary.getComponentsList();
            console.log('Categorias carregadas:', categories);
            
            // Criar tabs para cada categoria
            tabsContainer.innerHTML = `
                <ul>
                    ${Object.keys(categories).map((category, index) => `
                        <li class="${index === 0 ? 'is-active' : ''}">
                            <a data-category="${category}">
                                <span class="icon"><i class="fas fa-folder"></i></span>
                                <span>${category}</span>
                            </a>
                        </li>
                    `).join('')}
                </ul>
            `;
            
            // Adicionar eventos nas tabs
            tabsContainer.querySelectorAll('li').forEach(tab => {
                tab.addEventListener('click', () => {
                    // Atualizar tab ativa
                    tabsContainer.querySelectorAll('li').forEach(t => t.classList.remove('is-active'));
                    tab.classList.add('is-active');
                    
                    // Mostrar componentes da categoria
                    const category = tab.querySelector('a').dataset.category;
                    this.showComponentsCategory(category, categories[category]);
                });
            });
            
            // Mostrar primeira categoria
            const firstCategory = Object.keys(categories)[0];
            if (firstCategory) {
                console.log('Mostrando primeira categoria:', firstCategory);
                this.showComponentsCategory(firstCategory, categories[firstCategory]);
            } else {
                console.log('Nenhuma categoria encontrada');
                listContainer.innerHTML = `
                    <div class="notification is-info">
                        Nenhum componente disponível ainda. 
                        <a href="/admin/learning/components">Clique aqui</a> para criar componentes.
                    </div>
                `;
            }
            
            // Adicionar classe ao modal para estilos específicos
            modal.classList.add('components-modal');
            
            // Abrir modal
            console.log('Ativando modal...');
            modal.classList.add('is-active');
            
        } catch (error) {
            console.error('Erro ao abrir modal de componentes:', error);
            this.showNotification('Erro ao carregar componentes: ' + error.message, 'is-danger');
        }
    }

    /**
     * Mostra os componentes de uma categoria
     */
    showComponentsCategory(category, components) {
        const container = document.getElementById('componentsList');
        container.innerHTML = `
            <div class="columns is-multiline">
                ${components.map(comp => `
                    <div class="column is-6">
                        <div class="card">
                            <header class="card-header">
                                <p class="card-header-title">
                                    <span class="icon mr-2"><i class="${comp.icon}"></i></span>
                                    ${comp.name}
                                </p>
                            </header>
                            <div class="card-content">
                                <div class="preview-container" style="min-height: 120px; border: 1px solid #dbdbdb; border-radius: 4px; padding: 1.5rem; margin-bottom: 1rem; display: flex; align-items: center; justify-content: center;">
                                    ${this.componentsLibrary.renderComponent(comp.id)}
                                </div>
                                <div class="buttons is-centered">
                                    <button class="button is-info" data-action="preview" data-component="${comp.id}">
                                        <span class="icon"><i class="fas fa-eye"></i></span>
                                        <span>Visualizar</span>
                                    </button>
                                    <button class="button is-primary" data-action="insert" data-component="${comp.id}">
                                        <span class="icon"><i class="fas fa-plus"></i></span>
                                        <span>Inserir</span>
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                `).join('')}
            </div>
        `;
        
        // Adicionar eventos nos botões
        container.querySelectorAll('[data-action]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                const action = btn.dataset.action;
                const componentId = btn.dataset.component;
                
                if (action === 'preview') {
                    this.previewComponent(componentId);
                } else if (action === 'insert') {
                    if (this.componentsLibrary.needsDialog(componentId)) {
                        this.openComponentConfig(componentId);
                    } else {
                        this.insertComponent(componentId);
                    }
                }
            });
        });
    }

    /**
     * Mostra uma prévia do componente em tela cheia
     */
    previewComponent(componentId) {
        const component = this.componentsLibrary.components[componentId];
        if (!component) return;

        const modal = document.createElement('div');
        modal.className = 'modal is-active';
        modal.innerHTML = `
            <div class="modal-background"></div>
            <div class="modal-card">
                <header class="modal-card-head">
                    <p class="modal-card-title">
                        <span class="icon"><i class="${component.icon}"></i></span>
                        <span>${component.name}</span>
                    </p>
                    <button class="delete" aria-label="close"></button>
                </header>
                <section class="modal-card-body">
                    <div class="tabs">
                        <ul>
                            <li class="is-active"><a data-tab="preview">Prévia</a></li>
                            <li><a data-tab="html">HTML</a></li>
                            <li><a data-tab="css">CSS</a></li>
                            <li><a data-tab="js">JavaScript</a></li>
                        </ul>
                    </div>
                    
                    <div id="preview-tab" class="tab-content">
                        <div class="preview-container p-4" style="min-height: 200px; border: 1px solid #dbdbdb; border-radius: 4px;">
                            ${this.componentsLibrary.renderComponent(componentId)}
                        </div>
                    </div>
                    
                    <div id="html-tab" class="tab-content is-hidden">
                        <pre><code class="language-html">${this.escapeHtml(component.html || '')}</code></pre>
                    </div>
                    
                    <div id="css-tab" class="tab-content is-hidden">
                        <pre><code class="language-css">${this.escapeHtml(component.styles || '')}</code></pre>
                    </div>
                    
                    <div id="js-tab" class="tab-content is-hidden">
                        <pre><code class="language-javascript">${this.escapeHtml(component.scripts || '')}</code></pre>
                    </div>
                </section>
                <footer class="modal-card-foot">
                    <button class="button is-success" onclick="this.closest('.modal').querySelector('[data-action=insert]').click()">
                        <span class="icon"><i class="fas fa-plus"></i></span>
                        <span>Inserir no Editor</span>
                    </button>
                    <button class="button" onclick="this.closest('.modal').remove()">Fechar</button>
                </footer>
            </div>
        `;

        // Adicionar ao DOM
        document.body.appendChild(modal);

        // Configurar tabs
        const tabs = modal.querySelectorAll('.tabs li');
        const contents = modal.querySelectorAll('.tab-content');
        
        tabs.forEach(tab => {
            tab.addEventListener('click', () => {
                const target = tab.querySelector('a').dataset.tab;
                
                // Atualizar tabs ativas
                tabs.forEach(t => t.classList.remove('is-active'));
                tab.classList.add('is-active');
                
                // Mostrar conteúdo correspondente
                contents.forEach(content => {
                    content.classList.toggle('is-hidden', !content.id.startsWith(target));
                });
            });
        });

        // Configurar fechamento
        modal.querySelector('.delete').addEventListener('click', () => modal.remove());
        modal.querySelector('.modal-background').addEventListener('click', () => modal.remove());
    }

    /**
     * Escapa caracteres HTML para exibição segura
     */
    escapeHtml(unsafe) {
        return unsafe
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    /**
     * Abre o modal de configuração do componente
     */
    openComponentConfig(componentId) {
        this.selectedComponent = componentId;
        const modal = document.getElementById('componentConfigModal');
        const container = document.getElementById('componentConfig');
        
        // Configurar campos baseado no componente
        switch (componentId) {
            case 'detailsButton':
                container.innerHTML = `
                    <div class="field">
                        <label class="label">ID do Conteúdo</label>
                        <div class="control">
                            <input class="input" type="text" id="detailsId" placeholder="Ex: info_produto">
                        </div>
                    </div>
                    <div class="field">
                        <label class="label">Conteúdo</label>
                        <div class="control">
                            <textarea class="textarea" id="detailsContent" rows="5" placeholder="Conteúdo que será mostrado ao clicar no botão"></textarea>
                        </div>
                    </div>
                `;
                break;
                
            case 'navigationLink':
                container.innerHTML = `
                    <div class="field">
                        <label class="label">Caminho de Navegação</label>
                        <div class="control">
                            <input class="input" type="text" id="navPath" placeholder="Ex: Comercial -> Vendas -> Pedidos">
                        </div>
                    </div>
                    <div class="field">
                        <label class="label">Texto do Link</label>
                        <div class="control">
                            <input class="input" type="text" id="navText" placeholder="Ex: Cadastro de Pedidos">
                        </div>
                    </div>
                `;
                break;
                
            case 'dataTable':
                container.innerHTML = `
                    <div class="field">
                        <label class="label">Cabeçalhos (separados por vírgula)</label>
                        <div class="control">
                            <input class="input" type="text" id="tableHeaders" placeholder="Ex: Nome, Idade, Cidade">
                        </div>
                    </div>
                    <div class="field">
                        <label class="label">Dados (uma linha por vez, valores separados por vírgula)</label>
                        <div class="control">
                            <textarea class="textarea" id="tableData" rows="5" placeholder="João, 25, São Paulo&#10;Maria, 30, Rio de Janeiro"></textarea>
                        </div>
                    </div>
                `;
                break;
        }
        
        modal.classList.add('is-active');
    }

    /**
     * Insere o componente selecionado no editor
     */
    insertSelectedComponent() {
        if (!this.selectedComponent) return;
        
        let html = '';
        
        switch (this.selectedComponent) {
            case 'detailsButton':
                const id = document.getElementById('detailsId').value;
                const content = document.getElementById('detailsContent').value;
                
                // Criar div oculta com o conteúdo
                html = `
                    <div id="${id}" style="display: none;" data-title="Detalhes">
                        ${content}
                    </div>
                    ${this.componentsLibrary.renderComponent('detailsButton', id)}
                `;
                break;
                
            case 'navigationLink':
                const path = document.getElementById('navPath').value;
                const text = document.getElementById('navText').value;
                html = this.componentsLibrary.renderComponent('navigationLink', path, text);
                break;
                
            case 'dataTable':
                const headers = document.getElementById('tableHeaders').value.split(',').map(h => h.trim());
                const rows = document.getElementById('tableData').value
                    .split('\n')
                    .filter(line => line.trim())
                    .map(line => line.split(',').map(cell => cell.trim()));
                html = this.componentsLibrary.renderComponent('dataTable', headers, rows);
                break;
        }
        
        // Inserir HTML no editor
        if (html) {
            const cursor = this.editor.codemirror.getCursor();
            this.editor.codemirror.replaceRange(html, cursor);
        }
        
        // Fechar modais
        document.getElementById('componentConfigModal').classList.remove('is-active');
        document.getElementById('componentsModal').classList.remove('is-active');
        this.selectedComponent = null;
    }

    /**
     * Insere um componente simples no editor
     */
    insertComponent(componentId) {
        const html = this.componentsLibrary.renderComponent(componentId);
        if (html) {
            const cursor = this.editor.codemirror.getCursor();
            this.editor.codemirror.replaceRange(html, cursor);
        }
        document.getElementById('componentsModal').classList.remove('is-active');
    }

    /**
     * Mostra uma notificação na tela
     */
    showNotification(message, type = 'is-info') {
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.innerHTML = `
            <button class="delete"></button>
            ${message}
        `;

        // Posicionar no canto superior direito
        notification.style.position = 'fixed';
        notification.style.top = '1rem';
        notification.style.right = '1rem';
        notification.style.zIndex = '9999';
        notification.style.minWidth = '300px';

        // Adicionar ao DOM
        document.body.appendChild(notification);

        // Configurar botão de fechar
        notification.querySelector('.delete').addEventListener('click', () => {
            notification.remove();
        });

        // Auto-remover após 3 segundos
        setTimeout(() => {
            notification.style.opacity = '0';
            setTimeout(() => notification.remove(), 300);
        }, 3000);
    }
}

// Inicializar o editor quando o documento estiver pronto
document.addEventListener('DOMContentLoaded', () => {
    new ModuleContentEditor();
}); 