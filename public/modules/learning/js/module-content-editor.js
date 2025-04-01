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
            cancelPageBtn: document.getElementById('cancelPageBtn')
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
        // Obter o ID do módulo da URL
        const urlParts = window.location.pathname.split('/');
        this.moduleId = urlParts[urlParts.length - 1];
        
        if (!this.moduleId) {
            this.showNotification('ID do módulo não encontrado', 'is-danger');
            setTimeout(() => {
                window.location.href = '/admin/learning/modules';
            }, 2000);
            return;
        }
        
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
        // Botão de salvar
        this.elements.saveBtn.addEventListener('click', () => this.saveChanges());
        
        // Botão de preview
        this.elements.previewBtn.addEventListener('click', () => this.togglePreview());
        
        // Botão de voltar
        this.elements.backBtn.addEventListener('click', (e) => {
            e.preventDefault();
            window.location.href = '/admin/learning/modules';
        });
        
        // Botão de visualizar módulo
        this.elements.viewModuleBtn.addEventListener('click', (e) => {
            e.preventDefault();
            window.open(`/learn/${this.moduleId}`, '_blank');
        });
        
        // Adicionar seção
        this.elements.addSectionBtn.addEventListener('click', () => this.openSectionModal());
        
        // Modal de seção
        this.elements.saveSectionBtn.addEventListener('click', () => this.saveSection());
        this.elements.cancelSectionBtn.addEventListener('click', () => this.closeSectionModal());
        this.elements.sectionModal.querySelector('.delete').addEventListener('click', () => this.closeSectionModal());
        
        // Modal de página
        this.elements.savePageBtn.addEventListener('click', () => this.savePage());
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
            }
        });
    }
    
    /**
     * Inicializa o editor markdown
     */
    initMarkdownEditor() {
        try {
            console.log('Inicializando editor markdown...');
            
            // Verificar se o EasyMDE está disponível
            if (typeof EasyMDE === 'undefined') {
                console.error('EasyMDE não está disponível');
                this.showNotification('Erro: EasyMDE não carregado', 'is-danger');
                return;
            }
            
            // Limpar o conteúdo da área do editor
            this.elements.editorArea.innerHTML = '';
            
            // Criar um elemento textarea para o editor e anexá-lo à área do editor primeiro
            const textarea = document.createElement('textarea');
            textarea.id = 'markdown-editor-textarea';
            this.elements.editorArea.appendChild(textarea);
            
            // Inicializar o editor apenas após o textarea estar no DOM
            setTimeout(() => {
                try {
                    this.editor = new EasyMDE({
                        element: textarea,
                        spellChecker: false,
                        autofocus: true,
                        toolbar: [
                            'bold', 'italic', 'heading', '|',
                            'quote', 'unordered-list', 'ordered-list', '|',
                            'link', 'image', 'code', 'table', '|',
                            'preview', 'side-by-side', 'fullscreen', '|',
                            'guide'
                        ],
                        status: ['lines', 'words'],
                        placeholder: 'Digite seu conteúdo aqui usando Markdown...',
                        renderingConfig: {
                            codeSyntaxHighlighting: true,
                        },
                        autoDownloadFontAwesome: false
                    });
                    
                    console.log('Editor markdown inicializado com sucesso');
                    
                    // Notificar inicialização bem-sucedida
                    if (this.currentPage) {
                        // Se há uma página selecionada, definir o conteúdo
                        this.editor.value(this.currentPage.content);
                        // Forçar um refresh do editor
                        setTimeout(() => {
                            if (this.editor && this.editor.codemirror) {
                                this.editor.codemirror.refresh();
                            }
                        }, 100);
                    }
                } catch (innerError) {
                    console.error('Erro ao inicializar o editor markdown durante o timeout:', innerError);
                    this.showFallbackEditor();
                }
            }, 100); // Pequeno atraso para garantir que o DOM esteja pronto
            
        } catch (error) {
            console.error('Erro ao inicializar o editor markdown:', error);
            this.showNotification('Erro ao inicializar o editor', 'is-danger');
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
            const response = await fetch(`/api/learning/modules/${this.moduleId}`);
            
            if (!response.ok) {
                throw new Error('Erro ao carregar o módulo');
            }
            
            this.module = await response.json();
            
            // Preencher o nome do módulo
            this.elements.moduleName.textContent = this.module.title;
            
            // Inicializar seções e páginas
            this.sections = this.module.sections || [];
            
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
                    <span class="section-title">${section.title}</span>
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
                section.pages.forEach((page, pageIndex) => {
                    const pageElement = document.createElement('div');
                    pageElement.className = 'page-item';
                    pageElement.dataset.sectionIndex = sectionIndex;
                    pageElement.dataset.pageIndex = pageIndex;
                    pageElement.draggable = true;
                    
                    // Adicionar eventos para drag and drop
                    pageElement.addEventListener('dragstart', (e) => this.handleDragStart(e, 'page', sectionIndex, pageIndex));
                    pageElement.addEventListener('dragover', (e) => this.handleDragOver(e));
                    pageElement.addEventListener('dragleave', (e) => this.handleDragLeave(e));
                    pageElement.addEventListener('drop', (e) => this.handleDrop(e, 'page', sectionIndex, pageIndex));
                    pageElement.addEventListener('dragend', (e) => this.handleDragEnd(e));
                    
                    pageElement.innerHTML = `
                        <span class="page-title">${page.title}</span>
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
     */
    selectPage(sectionIndex, pageIndex) {
        console.log(`Selecionando página: seção ${sectionIndex}, página ${pageIndex}`);
        
        // Verificar se os índices são válidos
        if (sectionIndex < 0 || sectionIndex >= this.sections.length) {
            console.error(`Índice de seção inválido: ${sectionIndex}`);
            return;
        }
        
        const section = this.sections[sectionIndex];
        if (!section.pages || pageIndex < 0 || pageIndex >= section.pages.length) {
            console.error(`Índice de página inválido: seção ${sectionIndex}, página ${pageIndex}`);
            return;
        }
        
        // Salvar a página atual antes de mudar
        this.saveCurrentPageContent();
        
        // Definir página atual
        this.currentSectionIndex = sectionIndex;
        this.currentPageIndex = pageIndex;
        
        // Obter referência da página atual
        let page = section.pages[pageIndex];
        
        // Se a página for uma string (apenas ID), converter para objeto
        if (typeof page === 'string') {
            const pageId = page;
            page = this.module.content[pageId] || { 
                id: pageId,
                title: 'Sem título',
                content: '',
                keywords: []
            };
            
            // Atualizar a referência na seção
            this.sections[sectionIndex].pages[pageIndex] = page;
        }
        
        // Garantir que page tenha a propriedade keywords
        if (!page.keywords) {
            page.keywords = [];
        }
        
        // Atualizar elementos de interface
        document.querySelectorAll('.page-item.is-active').forEach(el => {
            el.classList.remove('is-active');
        });
        
        const pageListItem = document.querySelector(`[data-page-index="${pageIndex}"][data-section-index="${sectionIndex}"]`);
        if (pageListItem) {
            pageListItem.classList.add('is-active');
        }
        
        // Atualizar cabeçalho do editor
        const editorTitle = document.querySelector('#editorTitle');
        if (editorTitle) {
            editorTitle.textContent = page.title || 'Sem título';
        }
        
        // Preencher o editor com o conteúdo
        if (this.editor) {
            this.editor.setValue(page.content || '');
        } else {
            const textarea = document.querySelector('#contentEditor');
            if (textarea) {
                textarea.value = page.content || '';
            }
        }
        
        // Preencher as keywords
        this.updateKeywordsField(page.keywords);
        
        // Esconder o preview ao selecionar uma página
        const previewBox = document.querySelector('#previewBox');
        if (previewBox) {
            previewBox.classList.add('is-hidden');
        }
        
        // Mostrar o editor
        document.querySelector('#editorContainer').classList.remove('is-hidden');
        
        // Esconder a mensagem de boas-vindas
        document.querySelector('#welcomeMessage').classList.add('is-hidden');
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
     * Salva o conteúdo da página atual
     */
    saveCurrentPageContent() {
        // Verificar se existe uma página selecionada
        if (this.currentSectionIndex === null || this.currentPageIndex === null) {
            return;
        }
        
        // Obter referência da seção e página atual
        const section = this.sections[this.currentSectionIndex];
        let page = section.pages[this.currentPageIndex];
        
        // Obter o conteúdo do editor
        let content = '';
        if (this.editor) {
            content = this.editor.getValue();
        } else {
            const textarea = document.querySelector('#contentEditor');
            if (textarea) {
                content = textarea.value;
            }
        }
        
        // Para obter palavras-chave atuais
        const keywords = [];
        document.querySelectorAll('#keywordsContainer .tag').forEach(tag => {
            const keyword = tag.textContent.trim();
            if (keyword) keywords.push(keyword);
        });
        
        // Se a página for uma string (apenas ID), criar um objeto
        if (typeof page === 'string') {
            const pageId = page;
            
            // Criar um objeto para a página
            page = {
                id: pageId,
                title: this.module.content[pageId]?.title || 'Sem título',
                content: content,
                keywords: keywords
            };
            
            // Atualizar a referência na seção
            this.sections[this.currentSectionIndex].pages[this.currentPageIndex] = page;
        } else {
            // Atualizar o conteúdo da página
            page.content = content;
            page.keywords = keywords;
        }
        
        // Atualizar o objeto de conteúdo
        if (page.id) {
            this.module.content[page.id] = {
                title: page.title,
                content: page.content,
                keywords: page.keywords
            };
        }
        
        // Exibir status de "Salvo"
        this.showSavedStatus();
    }
    
    /**
     * Alterna entre editor e preview
     */
    togglePreview() {
        if (!this.currentPage) {
            this.showNotification('Selecione uma página primeiro', 'is-warning');
            return;
        }
        
        // Salvar o conteúdo atual
        this.saveCurrentPageContent();
        
        if (this.elements.previewArea.classList.contains('is-hidden')) {
            // Mostrar preview
            this.elements.previewArea.classList.remove('is-hidden');
            this.elements.editorArea.classList.add('is-hidden');
            
            // Renderizar o markdown
            this.elements.previewArea.innerHTML = `
                <div class="content markdown-content">
                    ${marked.parse(this.currentPage.content)}
                </div>
            `;
            
            // Atualizar o botão
            this.elements.previewBtn.innerHTML = '<span class="icon"><i class="fas fa-edit"></i></span><span>Editar</span>';
        } else {
            // Mostrar editor
            this.elements.previewArea.classList.add('is-hidden');
            this.elements.editorArea.classList.remove('is-hidden');
            
            // Atualizar o botão
            this.elements.previewBtn.innerHTML = '<span class="icon"><i class="fas fa-eye"></i></span><span>Preview</span>';
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
     * Abre o modal para adicionar/editar página
     */
    openPageModal(sectionIndex, pageIndex = null) {
        console.log(`Abrindo modal de página para seção ${sectionIndex}, página ${pageIndex}`);
        
        // Verificar se sectionIndex é válido
        if (sectionIndex === undefined || sectionIndex === null || !this.sections[sectionIndex]) {
            console.error(`Índice de seção inválido: ${sectionIndex}`);
            this.showNotification('Seção não encontrada. Tente atualizar a página.', 'is-danger');
            return;
        }
        
        // Limpar campos
        this.elements.pageTitle.value = '';
        
        // Armazenar índices em dataset para uso posterior
        this.elements.pageModal.dataset.sectionIndex = sectionIndex;
        
        // Se for edição, preencher campos
        if (pageIndex !== null) {
            this.elements.pageModal.dataset.pageIndex = pageIndex;
            
            // Verificar se a página existe
            const page = this.sections[sectionIndex].pages[pageIndex];
            if (!page) {
                this.showNotification('Página não encontrada', 'is-danger');
                return;
            }
            
            // Preencher com título da página
            if (typeof page === 'string') {
                // Se for apenas um ID, verificar se há conteúdo correspondente
                const content = this.module.content && this.module.content[page];
                if (content) {
                    this.elements.pageTitle.value = content.title || '';
                }
            } else if (typeof page === 'object' && page.title) {
                this.elements.pageTitle.value = page.title;
            }
        } else {
            // Se for adição, remover o índice da página
            delete this.elements.pageModal.dataset.pageIndex;
        }
        
        // Exibir modal
        this.elements.pageModal.classList.add('is-active');
        this.elements.pageTitle.focus();
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
            
            const novaSecao = {
                id: sectionId,
                title: title,
                pages: [{
                    id: pageId,
                    title: 'Introdução',
                    content: conteudoInicial
                }]
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
        
        // Mostrar notificação
        this.showNotification('Seção salva com sucesso', 'is-success');
    }
    
    /**
     * Salva os dados da página do modal
     */
    savePage() {
        // Obter o título do campo
        const title = this.elements.pageTitle.value.trim();
        
        // Validar o título
        if (!title) {
            this.showNotification('O título da página é obrigatório', 'is-danger');
            return;
        }
        
        // Obter o índice da seção do dataset
        const sectionIndex = parseInt(this.elements.pageModal.dataset.sectionIndex);
        
        // Verificar se a seção existe
        if (isNaN(sectionIndex) || !this.sections[sectionIndex]) {
            console.error(`Seção inválida: ${sectionIndex}`);
            this.showNotification('Seção não encontrada', 'is-danger');
            return;
        }
        
        // Garantir que a seção tenha um array de páginas
        if (!this.sections[sectionIndex].pages) {
            this.sections[sectionIndex].pages = [];
        }
        
        // Verificar se é adição ou edição
        const pageIndexStr = this.elements.pageModal.dataset.pageIndex;
        
        if (pageIndexStr !== undefined) {
            // Edição
            const pageIndex = parseInt(pageIndexStr);
            
            if (isNaN(pageIndex) || pageIndex < 0 || pageIndex >= this.sections[sectionIndex].pages.length) {
                console.error(`Índice de página inválido: ${pageIndex}`);
                this.showNotification('Página não encontrada', 'is-danger');
                return;
            }
            
            // Atualizar o título
            if (typeof this.sections[sectionIndex].pages[pageIndex] === 'string') {
                // Se for apenas ID, converter para objeto
                const pageId = this.sections[sectionIndex].pages[pageIndex];
                this.sections[sectionIndex].pages[pageIndex] = {
                    id: pageId,
                    title: title,
                    content: '' // Conteúdo vazio para criar
                };
            } else {
                // Se for objeto, atualizar apenas o título
                this.sections[sectionIndex].pages[pageIndex].title = title;
            }
            
            // Mostrar notificação
            this.showNotification('Página atualizada com sucesso', 'is-success');
            
            // Selecionar a página para continuar editando
            setTimeout(() => {
                this.selectPage(sectionIndex, pageIndex);
            }, 100);
        } else {
            // Adição
            // Gerar ID para a página
            const pageId = this.generateId();
            
            // Criar objeto de página com título e conteúdo vazio
            const page = {
                id: pageId,
                title: title,
                content: '# ' + title + '\n\nConteúdo da página'
            };
            
            // Adicionar a página à seção
            this.sections[sectionIndex].pages.push(page);
            
            // Obter o índice da nova página
            const newPageIndex = this.sections[sectionIndex].pages.length - 1;
            
            // Mostrar notificação
            this.showNotification('Página adicionada com sucesso', 'is-success');
            
            // Selecionar a nova página para edição
            setTimeout(() => {
                this.selectPage(sectionIndex, newPageIndex);
            }, 100);
        }
        
        // Fechar o modal
        this.closePageModal();
        
        // Atualizar a árvore de seções
        this.renderSectionsTree();
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
        if (!confirm(`Tem certeza que deseja excluir a seção "${this.sections[sectionIndex].title}" e todas as suas páginas?`)) {
            return;
        }
        
        // Remover a seção
        this.sections.splice(sectionIndex, 1);
        
        // Atualizar a árvore de seções
        this.renderSectionsTree();
        
        // Limpar o editor se a seção atual foi excluída
        if (this.currentPage && this.currentPage.sectionIndex === sectionIndex) {
            this.elements.editorArea.innerHTML = '';
            this.elements.previewArea.innerHTML = '';
            this.currentPage = null;
            this.isEditing = false;
        }
        
        // Mostrar notificação
        this.showNotification('Seção excluída com sucesso', 'is-success');
    }
    
    /**
     * Adiciona uma nova página a uma seção
     */
    addNewPage(sectionIndex) {
        this.openPageModal(sectionIndex);
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
        const page = this.sections[sectionIndex].pages[pageIndex];
        
        if (!confirm(`Tem certeza que deseja excluir a página "${page.title}"?`)) {
            return;
        }
        
        // Remover a página
        this.sections[sectionIndex].pages.splice(pageIndex, 1);
        
        // Atualizar a árvore de seções
        this.renderSectionsTree();
        
        // Limpar o editor se a página atual foi excluída
        if (this.currentPage && 
            this.currentPage.sectionIndex === sectionIndex && 
            this.currentPage.pageIndex === pageIndex) {
            
            this.elements.editorArea.innerHTML = '';
            this.elements.previewArea.innerHTML = '';
            this.currentPage = null;
            this.isEditing = false;
        }
        
        // Mostrar notificação
        this.showNotification('Página excluída com sucesso', 'is-success');
    }
    
    /**
     * Salva todas as alterações no servidor
     */
    async saveChanges() {
        // Salvar o conteúdo da página atual antes de enviar
        if (this.isEditing && this.currentPage) {
            try {
                this.saveCurrentPageContent();
            } catch (error) {
                console.error('Erro ao salvar conteúdo atual:', error);
                this.showNotification('Erro ao preparar conteúdo para salvar', 'is-warning');
            }
        }
        
        // Verificar se há conteúdo para salvar
        if (this.sections.length === 0) {
            this.showNotification('Nenhum conteúdo para salvar. Adicione uma seção primeiro.', 'is-info');
            return;
        }
        
        this.showNotification('Salvando alterações...', 'is-info');
        
        try {
            // Preparar o objeto de conteúdo
            const contentObj = {};
            
            // Verificar cada seção e página para garantir que o conteúdo está completo
            this.sections.forEach(section => {
                if (Array.isArray(section.pages)) {
                    section.pages.forEach(page => {
                        // Se a página for um objeto com content, adicionar ao contentObj
                        if (typeof page === 'object' && page.id && page.content) {
                            contentObj[page.id] = {
                                title: page.title || 'Sem título',
                                content: page.content
                            };
                        }
                    });
                }
            });
            
            // Preparar os dados para envio - incluindo tanto as seções quanto o conteúdo
            const moduleData = {
                sections: this.sections,
                content: contentObj
            };
            
            // Obter o token de autenticação
            const token = localStorage.getItem('auth_token');
            if (!token) {
                console.warn('Token de autenticação não encontrado');
                this.showNotification('Aviso: Token de autenticação não encontrado', 'is-warning');
            }
            
            console.log('Enviando dados para o servidor', moduleData);
            
            // Enviar para o servidor usando a rota principal do módulo (não a específica para seções)
            const response = await fetch(`/api/learning/modules/${this.moduleId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': token ? `Bearer ${token}` : ''
                },
                body: JSON.stringify(moduleData)
            });
            
            // Verificar se a resposta foi bem-sucedida
            if (!response.ok) {
                // Tentar obter mais detalhes sobre o erro
                let errorMessage = 'Erro ao salvar alterações';
                try {
                    const errorData = await response.json();
                    errorMessage = errorData.error || errorData.details || errorMessage;
                } catch (parseError) {
                    console.error('Erro ao analisar resposta de erro:', parseError);
                }
                
                throw new Error(errorMessage + ` (Status: ${response.status})`);
            }
            
            const result = await response.json();
            console.log('Resposta do servidor:', result);
            
            // Atualizar dados locais se a resposta incluir o módulo atualizado
            if (result && result.sections) {
                this.sections = result.sections;
                this.renderSectionsTree();
                
                // Reselecionar a página atual se existir
                if (this.currentPage) {
                    const { sectionIndex, pageIndex } = this.currentPage;
                    if (this.sections[sectionIndex] && 
                        this.sections[sectionIndex].pages && 
                        this.sections[sectionIndex].pages[pageIndex]) {
                        setTimeout(() => {
                            this.selectPage(sectionIndex, pageIndex);
                        }, 100);
                    }
                }
            }
            
            // Mostrar notificação de sucesso
            this.showNotification('Conteúdo salvo com sucesso', 'is-success');
            
        } catch (error) {
            console.error('Erro ao salvar alterações:', error);
            this.showNotification('Erro ao salvar alterações: ' + error.message, 'is-danger');
            
            // Tentar novamente em caso de erro de rede
            if (error.message.includes('network') || error.message.includes('failed to fetch')) {
                this.showNotification('Tentando novamente em 5 segundos...', 'is-info');
                setTimeout(() => this.saveChanges(), 5000);
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
}

// Inicializar o editor quando o documento estiver pronto
document.addEventListener('DOMContentLoaded', () => {
    new ModuleContentEditor();
}); 