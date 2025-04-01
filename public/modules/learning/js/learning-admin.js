class LearningAdmin {
    constructor() {
        this.moduleId = window.location.pathname.split('/').pop();
        this.content = {};
        this.sections = [];
        this.currentPage = null;
    }

    async init() {
        try {
            await this.loadModule();
            this.render();
            this.setupEventListeners();
        } catch (error) {
            console.error('Erro ao inicializar:', error);
            this.showError('Erro ao carregar módulo');
        }
    }

    async loadModule() {
        // Carregar dados do módulo
        const response = await fetch(`/api/learning/modules/${this.moduleId}`);
        if (!response.ok) throw new Error('Erro ao carregar módulo');
        
        const moduleData = await response.json();
        this.content = moduleData.content || {};
        this.sections = moduleData.sections || [];
        
        document.getElementById('moduleName').textContent = moduleData.title;
    }

    render() {
        const container = document.getElementById('adminContent');
        if (!container) return;

        container.innerHTML = `
            <div class="columns">
                <div class="column is-3">
                    <!-- Menu de seções -->
                    <div class="menu">
                        <p class="menu-label">Seções</p>
                        <ul class="menu-list">
                            ${this.renderSections()}
                        </ul>
                        <button class="button is-small is-primary mt-2" id="addSectionBtn">
                            Adicionar Seção
                        </button>
                    </div>
                </div>
                <div class="column">
                    <!-- Editor de conteúdo -->
                    <div id="contentEditor">
                        ${this.renderEditor()}
                    </div>
                </div>
            </div>
        `;
    }

    renderSections() {
        return this.sections.map(section => `
            <li>
                <a data-section="${section.id}">
                    ${section.title}
                    <span class="icon is-small">
                        <i class="fas fa-edit"></i>
                    </span>
                </a>
                <ul>
                    ${section.pages.map(pageId => `
                        <li>
                            <a data-page="${pageId}">
                                ${this.content[pageId]?.title || 'Sem título'}
                            </a>
                        </li>
                    `).join('')}
                </ul>
            </li>
        `).join('');
    }

    renderEditor() {
        // Implementar editor WYSIWYG aqui
    }

    setupEventListeners() {
        // Implementar eventos para salvar alterações
    }
}

// Inicializar quando o DOM estiver pronto
document.addEventListener('DOMContentLoaded', () => {
    const admin = new LearningAdmin();
    admin.init().catch(console.error);
}); 