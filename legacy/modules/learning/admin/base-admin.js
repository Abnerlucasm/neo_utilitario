class BaseLearningAdmin {
    constructor(config) {
        this.config = {
            storageKey: 'learning_content',
            templates: {},
            ...config
        };
        
        this.sections = [];
        this.content = {};
    }

    // Templates padrão para componentes
    getDefaultTemplates() {
        return {
            markdown: {
                title: {
                    content: `# Título Principal\n## Subtítulo\n### Seção`,
                    cursorOffset: 2
                },
                code: {
                    content: "```\nSeu código aqui\n```",
                    cursorOffset: 12
                },
                // ... outros templates markdown
            },
            components: {
                basic: {
                    button: {
                        content: `<button class="button is-primary">\n  Texto do Botão\n</button>`,
                        cursorOffset: 29
                    },
                    alert: {
                        content: `<div class="notification is-info">\n  Mensagem\n</div>`,
                        cursorOffset: 35
                    }
                }
            }
        };
    }

    // Métodos de gerenciamento de seções
    async loadSections() {
        try {
            const saved = localStorage.getItem(`${this.config.storageKey}_sections`);
            this.sections = saved ? JSON.parse(saved) : [];
        } catch (error) {
            console.error('Erro ao carregar seções:', error);
            this.sections = [];
        }
    }

    addSection(section) {
        this.sections.push(section);
        this.saveSections();
    }

    removeSection(sectionId) {
        this.sections = this.sections.filter(s => s.id !== sectionId);
        this.saveSections();
    }

    saveSections() {
        localStorage.setItem(`${this.config.storageKey}_sections`, JSON.stringify(this.sections));
    }

    // Métodos de gerenciamento de conteúdo
    async loadContent() {
        try {
            const saved = localStorage.getItem(this.config.storageKey);
            this.content = saved ? JSON.parse(saved) : {};
        } catch (error) {
            console.error('Erro ao carregar conteúdo:', error);
            this.content = {};
        }
    }

    saveContent(pageId, content, sectionId) {
        this.content[pageId] = content;
        this.updatePageSection(pageId, sectionId);
        this.saveAllContent();
    }

    updatePageSection(pageId, sectionId) {
        this.sections.forEach(section => {
            if (section.id === sectionId) {
                if (!section.pages.includes(pageId)) {
                    section.pages.push(pageId);
                }
            } else {
                section.pages = section.pages.filter(p => p !== pageId);
            }
        });
        this.saveSections();
    }

    saveAllContent() {
        localStorage.setItem(this.config.storageKey, JSON.stringify(this.content));
    }

    // Renderização da interface
    async render(containerId) {
        const container = document.getElementById(containerId);
        if (!container) return;

        await this.loadSections();
        await this.loadContent();

        container.innerHTML = this.getAdminTemplate();
        this.setupEventListeners();
    }

    getAdminTemplate() {
        return `
            <div class="columns">
                <!-- Gerenciador de Seções -->
                <div class="column is-3">
                    <div class="box">
                        <h3 class="title is-5">Seções</h3>
                        <div class="field">
                            <div class="control">
                                <input class="input" type="text" id="newSectionInput" placeholder="Nome da seção">
                            </div>
                        </div>
                        <button class="button is-primary" id="addSectionBtn">Adicionar Seção</button>
                        <div class="menu mt-4">
                            <ul class="menu-list" id="sectionsList">
                                ${this.renderSectionsList()}
                            </ul>
                        </div>
                    </div>
                </div>

                <!-- Editor -->
                <div class="column">
                    <div class="box">
                        ${this.renderEditor()}
                    </div>
                </div>
            </div>
        `;
    }

    renderSectionsList() {
        return this.sections.map(section => `
            <li>
                <a data-section="${section.id}">
                    ${section.name}
                    <button class="delete is-small" data-delete-section="${section.id}"></button>
                </a>
                <ul>
                    ${section.pages.map(pageId => `
                        <li><a data-page="${pageId}">${this.content[pageId]?.title || pageId}</a></li>
                    `).join('')}
                </ul>
            </li>
        `).join('');
    }

    renderEditor() {
        return `
            <div class="field">
                <label class="label">ID da Página</label>
                <div class="control">
                    <input class="input" type="text" id="pageId">
                </div>
            </div>

            <div class="field">
                <label class="label">Seção</label>
                <div class="control">
                    <div class="select">
                        <select id="pageSection">
                            ${this.sections.map(section => 
                                `<option value="${section.id}">${section.name}</option>`
                            ).join('')}
                        </select>
                    </div>
                </div>
            </div>

            <div class="field">
                <label class="label">Conteúdo</label>
                <div class="editor-toolbar">
                    ${this.renderEditorToolbar()}
                </div>
                <div class="control">
                    <textarea class="textarea" id="pageContent" rows="20"></textarea>
                </div>
            </div>

            <div class="field is-grouped">
                <div class="control">
                    <button class="button is-primary" id="saveContent">Salvar</button>
                </div>
                <div class="control">
                    <button class="button is-info" id="previewContent">Preview</button>
                </div>
            </div>

            <div id="previewArea" class="mt-4" style="display: none;">
                <h4 class="title is-4">Preview</h4>
                <div class="box content" id="previewContent"></div>
            </div>
        `;
    }

    renderEditorToolbar() {
        // Implementação específica da barra de ferramentas
        return '';
    }

    setupEventListeners() {
        // Implementar listeners de eventos
    }
} 