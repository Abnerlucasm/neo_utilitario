class ModuleEditor {
    constructor() {
        this.moduleId = window.location.pathname.split('/').pop();
        this.editor = null;
        this.currentPage = null;
        this.content = {};
        this.sections = [];
    }

    async init() {
        try {
            await this.loadModule();
            this.render();
            this.initializeEditor();
            this.setupEventListeners();
        } catch (error) {
            console.error('Erro ao inicializar editor:', error);
            this.showErrorMessage('Erro ao carregar módulo');
        }
    }

    showErrorMessage(message) {
        const editorArea = document.getElementById('editorArea');
        if (editorArea) {
            editorArea.innerHTML = `
                <div class="notification is-danger">
                    <p>${message}</p>
                    <button class="button is-light mt-2" onclick="location.reload()">
                        Tentar novamente
                    </button>
                </div>
            `;
        }
    }

    async loadModule() {
        const response = await fetch(`/api/learning/modules/${this.moduleId}`);
        if (!response.ok) throw new Error('Erro ao carregar módulo');
        
        const data = await response.json();
        this.content = data.content || {};
        this.sections = data.sections || [];
        
        document.getElementById('moduleName').textContent = data.title;
        
        // Configurar link de visualização
        const viewBtn = document.getElementById('viewModuleBtn');
        if (viewBtn) {
            viewBtn.href = `/learn/${this.moduleId}`;
        }
    }

    initializeEditor() {
        const editorArea = document.getElementById('editorArea');
        // Criar o textarea para o editor
        editorArea.innerHTML = '<textarea id="editor"></textarea>';
        
        this.editor = new EasyMDE({
            element: document.getElementById('editor'),
            autofocus: true,
            spellChecker: false,
            status: false,
            toolbar: [
                'bold', 'italic', 'heading', '|',
                'quote', 'unordered-list', 'ordered-list', '|',
                'link', 'image', 'code', '|',
                'preview', 'side-by-side', 'fullscreen'
            ]
        });
    }

    render() {
        this.renderSections();
        this.renderEditor();
    }

    renderSections() {
        const container = document.getElementById('sectionsTree');
        if (!container) return;

        if (!this.sections.length) {
            container.innerHTML = `
                <div class="notification is-info is-light">
                    Nenhuma seção encontrada. Clique em "Nova Seção" para começar.
                </div>
            `;
            return;
        }

        container.innerHTML = this.sections.map(section => `
            <div class="section-item">
                <div class="level is-mobile">
                    <div class="level-left">
                        <div class="level-item">
                            <span class="icon"><i class="fas fa-folder"></i></span>
                            <span class="section-title" data-section="${section.id}">${section.title}</span>
                        </div>
                    </div>
                    <div class="level-right">
                        <div class="level-item buttons are-small">
                            <button class="button" data-action="add-page" data-section="${section.id}">
                                <span class="icon is-small"><i class="fas fa-plus"></i></span>
                            </button>
                            <button class="button" data-action="edit-section" data-section="${section.id}">
                                <span class="icon is-small"><i class="fas fa-edit"></i></span>
                            </button>
                            <button class="button is-danger" data-action="delete-section" data-section="${section.id}">
                                <span class="icon is-small"><i class="fas fa-trash"></i></span>
                            </button>
                        </div>
                    </div>
                </div>
                <div class="pages-list">
                    ${this.renderPages(section.pages)}
                </div>
            </div>
        `).join('');

        // Adicionar event listeners
        container.addEventListener('click', async (e) => {
            const action = e.target.closest('[data-action]')?.dataset.action;
            const sectionId = e.target.closest('[data-section]')?.dataset.section;
            
            if (!action || !sectionId) return;

            switch (action) {
                case 'edit-section':
                    this.editSection(sectionId);
                    break;
                case 'delete-section':
                    this.deleteSection(sectionId);
                    break;
                case 'add-page':
                    this.addPage(sectionId);
                    break;
            }
        });
    }

    renderPages(pages = []) {
        return pages.map(pageId => `
            <div class="page-item ${this.currentPage === pageId ? 'active' : ''}" data-page="${pageId}">
                <div class="level is-mobile">
                    <div class="level-left">
                        <div class="level-item">
                            <span class="icon is-small"><i class="fas fa-file-alt"></i></span>
                            <span>${this.content[pageId]?.title || 'Sem título'}</span>
                        </div>
                    </div>
                    <div class="level-right">
                        <div class="level-item buttons are-small">
                            <button class="button" data-action="edit-page" data-page="${pageId}">
                                <span class="icon is-small"><i class="fas fa-edit"></i></span>
                            </button>
                            <button class="button" data-action="keywords" data-page="${pageId}">
                                <span class="icon is-small"><i class="fas fa-tags"></i></span>
                            </button>
                            <button class="button is-danger" data-action="delete-page" data-page="${pageId}">
                                <span class="icon is-small"><i class="fas fa-trash"></i></span>
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `).join('');
    }

    renderEditor() {
        const editorArea = document.getElementById('editorArea');
        const toolbarButtons = document.querySelector('.editor-toolbar .buttons');
        
        if (!this.currentPage) {
            editorArea.innerHTML = `
                <div class="notification is-info">
                    <p>Selecione uma página para editar ou crie uma nova página em uma seção.</p>
                </div>
            `;
            toolbarButtons.style.display = 'none';
            return;
        }

        toolbarButtons.style.display = 'flex';
        if (!this.editor) {
            this.initializeEditor();
        }
        this.editor.value(this.content[this.currentPage]?.content || '');
    }

    setupEventListeners() {
        // Botão de Preview
        const previewBtn = document.getElementById('previewBtn');
        if (previewBtn) {
            previewBtn.addEventListener('click', () => {
                const previewArea = document.getElementById('previewArea');
                const editorArea = document.getElementById('editorArea');
                
                if (previewArea.classList.contains('is-hidden')) {
                    previewArea.classList.remove('is-hidden');
                    // Adicionar classe markdown-content e converter o markdown
                    previewArea.innerHTML = `<div class="markdown-content">${this.editor.markdown(this.editor.value())}</div>`;
                    editorArea.classList.add('is-hidden');
                    previewBtn.innerHTML = '<span class="icon"><i class="fas fa-edit"></i></span><span>Editar</span>';
                } else {
                    previewArea.classList.add('is-hidden');
                    editorArea.classList.remove('is-hidden');
                    previewBtn.innerHTML = '<span class="icon"><i class="fas fa-eye"></i></span><span>Preview</span>';
                }
            });
        }

        // Botão de Nova Seção
        const addSectionBtn = document.getElementById('addSectionBtn');
        if (addSectionBtn) {
            addSectionBtn.addEventListener('click', () => {
                document.getElementById('sectionModal').classList.add('is-active');
            });
        }

        // Fechar Modal
        document.querySelectorAll('.modal .delete, #cancelSectionBtn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.getElementById('sectionModal').classList.remove('is-active');
            });
        });

        // Salvar Nova Seção
        const saveSectionBtn = document.getElementById('saveSectionBtn');
        if (saveSectionBtn) {
            saveSectionBtn.addEventListener('click', async () => {
                const titleInput = document.getElementById('sectionTitle');
                const title = titleInput.value.trim();
                
                if (!title) {
                    alert('Por favor, insira um título para a seção');
                    return;
                }

                try {
                    const sectionId = 'section-' + Date.now();
                    const newSection = {
                        id: sectionId,
                        title: title,
                        pages: []
                    };

                    // Adicionar nova seção ao array
                    this.sections.push(newSection);

                    // Atualizar no servidor
                    const response = await fetch(`/api/learning/modules/${this.moduleId}`, {
                        method: 'PUT',
                        headers: {
                            'Content-Type': 'application/json',
                            'Accept': 'application/json'
                        },
                        body: JSON.stringify({
                            sections: this.sections,
                            content: this.content
                        })
                    });

                    if (!response.ok) {
                        const error = await response.json();
                        throw new Error(error.message || 'Erro ao salvar seção');
                    }

                    // Atualizar interface
                    this.renderSections();
                    
                    // Limpar e fechar modal
                    titleInput.value = '';
                    document.getElementById('sectionModal').classList.remove('is-active');
                } catch (error) {
                    console.error('Erro ao salvar seção:', error);
                    alert(error.message || 'Erro ao salvar seção');
                }
            });
        }

        // Eventos das páginas
        document.getElementById('sectionsTree').addEventListener('click', async (e) => {
            const pageItem = e.target.closest('.page-item');
            const action = e.target.closest('[data-action]')?.dataset.action;
            
            if (pageItem && !action) {
                // Clique na página (não em um botão de ação)
                const pageId = pageItem.dataset.page;
                this.currentPage = pageId;
                this.renderEditor();
                document.querySelectorAll('.page-item').forEach(item => {
                    item.classList.toggle('active', item.dataset.page === pageId);
                });
            } else if (action) {
                const pageId = e.target.closest('[data-page]')?.dataset.page;
                const sectionId = e.target.closest('[data-section]')?.dataset.section;
                
                switch (action) {
                    case 'edit-page':
                        if (pageId) await this.editPage(pageId);
                        break;
                    case 'delete-page':
                        if (pageId) await this.deletePage(pageId);
                        break;
                    case 'keywords':
                        if (pageId) await this.editKeywords(pageId);
                        break;
                    case 'edit-section':
                        if (sectionId) await this.editSection(sectionId);
                        break;
                    case 'delete-section':
                        if (sectionId) await this.deleteSection(sectionId);
                        break;
                    case 'add-page':
                        if (sectionId) await this.addPage(sectionId);
                        break;
                }
            }
        });

        // Botão Salvar
        const saveBtn = document.getElementById('saveBtn');
        if (saveBtn) {
            saveBtn.addEventListener('click', () => this.saveCurrentPage());
        }

        // Auto-save
        this.setupAutoSave();
    }

    async editSection(sectionId) {
        const section = this.sections.find(s => s.id === sectionId);
        if (!section) return;

        const newTitle = prompt('Novo título da seção:', section.title);
        if (!newTitle || newTitle === section.title) return;

        section.title = newTitle;
        await this.saveChanges();
    }

    async deleteSection(sectionId) {
        if (!confirm('Tem certeza que deseja excluir esta seção?')) return;

        this.sections = this.sections.filter(s => s.id !== sectionId);
        await this.saveChanges();
    }

    async addPage(sectionId) {
        const section = this.sections.find(s => s.id === sectionId);
        if (!section) return;

        // Desabilitar o botão para evitar múltiplos cliques
        const addButton = document.querySelector(`[data-action="add-page"][data-section="${sectionId}"]`);
        if (addButton) addButton.disabled = true;

        try {
            const pageTitle = prompt('Título da página:');
            if (!pageTitle) return;

            const pageId = 'page-' + Date.now();
            const newPage = {
                title: pageTitle,
                content: '',
                keywords: []
            };

            // Adicionar página ao conteúdo antes de atualizar a seção
            this.content[pageId] = newPage;
            section.pages.push(pageId);

            await this.saveChanges();
            
            // Selecionar a nova página
            this.currentPage = pageId;
            this.renderEditor();
            this.renderSections();
        } catch (error) {
            console.error('Erro ao adicionar página:', error);
            alert('Erro ao adicionar página');
        } finally {
            // Reabilitar o botão
            if (addButton) addButton.disabled = false;
        }
    }

    async editPage(pageId) {
        const page = this.content[pageId];
        if (!page) return;

        const newTitle = prompt('Novo título da página:', page.title);
        if (!newTitle || newTitle === page.title) return;

        page.title = newTitle;
        await this.saveChanges();
    }

    async deletePage(pageId) {
        if (!confirm('Tem certeza que deseja excluir esta página?')) return;

        try {
            // Remover da seção
            this.sections.forEach(section => {
                section.pages = section.pages.filter(p => p !== pageId);
            });

            // Remover do conteúdo
            delete this.content[pageId];

            // Se a página excluída era a atual, limpar a seleção
            if (this.currentPage === pageId) {
                this.currentPage = null;
            }

            await this.saveChanges();
            
            // Atualizar interface
            this.renderEditor();
            this.renderSections();
        } catch (error) {
            console.error('Erro ao excluir página:', error);
            alert('Erro ao excluir página');
        }
    }

    async editKeywords(pageId) {
        const page = this.content[pageId];
        if (!page) return;

        // Criar modal de keywords
        const modal = document.createElement('div');
        modal.className = 'modal is-active';
        modal.innerHTML = `
            <div class="modal-background"></div>
            <div class="modal-card">
                <header class="modal-card-head">
                    <p class="modal-card-title">Palavras-chave</p>
                    <button class="delete" aria-label="close"></button>
                </header>
                <section class="modal-card-body">
                    <div class="field">
                        <label class="label">Palavras-chave (separadas por vírgula)</label>
                        <div class="control">
                            <input class="input" type="text" id="keywordsInput" 
                                value="${page.keywords?.join(', ') || ''}"
                                placeholder="Ex: postgresql, banco de dados, sql">
                        </div>
                        <p class="help">Adicione palavras-chave para facilitar a busca</p>
                    </div>
                </section>
                <footer class="modal-card-foot">
                    <button class="button is-success" id="saveKeywordsBtn">Salvar</button>
                    <button class="button" id="cancelKeywordsBtn">Cancelar</button>
                </footer>
            </div>
        `;

        document.body.appendChild(modal);

        // Event listeners do modal
        const closeModal = () => {
            modal.remove();
        };

        modal.querySelector('.delete').addEventListener('click', closeModal);
        modal.querySelector('#cancelKeywordsBtn').addEventListener('click', closeModal);
        modal.querySelector('#saveKeywordsBtn').addEventListener('click', async () => {
            const input = document.getElementById('keywordsInput');
            page.keywords = input.value.split(',')
                .map(k => k.trim())
                .filter(Boolean);
            
            await this.saveChanges();
            closeModal();
        });
    }

    async saveCurrentPage() {
        if (!this.currentPage || !this.editor) return;
        
        this.content[this.currentPage].content = this.editor.value();
        await this.saveChanges();
    }

    setupAutoSave() {
        let saveTimeout;
        this.editor?.codemirror.on('change', () => {
            if (this.currentPage) {
                clearTimeout(saveTimeout);
                saveTimeout = setTimeout(() => this.saveCurrentPage(), 2000);
            }
        });
    }

    async saveChanges() {
        try {
            const response = await fetch(`/api/learning/modules/${this.moduleId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                body: JSON.stringify({
                    sections: this.sections,
                    content: this.content
                })
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.message || 'Erro ao salvar alterações');
            }

            // Mostrar toast de sucesso
            this.showToast('Alterações salvas com sucesso!');
        } catch (error) {
            console.error('Erro ao salvar alterações:', error);
            this.showToast(error.message || 'Erro ao salvar alterações', 'is-danger');
        }
    }

    showToast(message, type = 'is-success') {
        const toast = document.createElement('div');
        toast.className = `notification ${type} toast-notification`;
        toast.innerHTML = `
            <button class="delete"></button>
            ${message}
        `;

        document.body.appendChild(toast);

        // Fechar toast ao clicar no X
        toast.querySelector('.delete').addEventListener('click', () => {
            toast.remove();
        });

        // Auto-remover após 3 segundos
        setTimeout(() => {
            toast.remove();
        }, 3000);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const editor = new ModuleEditor();
    editor.init().catch(console.error);
}); 