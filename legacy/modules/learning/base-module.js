class BaseLearningModule {
    constructor(config) {
        this.config = config;
        this.content = {};
        this.sections = [];
        this.currentPage = null;
    }

    async init(containerId) {
        console.log('Inicializando módulo base');
        this.container = document.getElementById(containerId);
        if (!this.container) {
            throw new Error(`Container ${containerId} não encontrado`);
        }

        try {
            await this.loadContent();
            this.render();
            this.setupEvents();
        } catch (error) {
            console.error('Erro na inicialização:', error);
            this.showError('Erro ao carregar conteúdo');
        }
    }

    showError(message) {
        if (this.container) {
            this.container.innerHTML = `
                <div class="notification is-danger">
                    <p>${message}</p>
                    <button class="button is-small is-info mt-2" onclick="window.location.reload()">
                        Tentar novamente
                    </button>
                </div>
            `;
        }
    }

    async loadContent() {
        try {
            console.log(`Carregando conteúdo de: ${this.config.apiEndpoint}/${this.config.contentType}`);
            const response = await fetch(`${this.config.apiEndpoint}/${this.config.contentType}`);
            
            if (!response.ok) {
                throw new Error('Erro ao carregar conteúdo');
            }
            
            const data = await response.json();
            console.log('Conteúdo carregado:', data);
            
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

        const menuHtml = this.renderMenu();
        const contentHtml = this.renderContent();

        this.container.innerHTML = `
            <div class="columns is-gapless">
                <div class="column is-3">
                    ${menuHtml}
                </div>
                <div class="column">
                    ${contentHtml}
                </div>
            </div>
        `;
    }

    renderMenu() {
        return `
            <aside class="menu" id="sideMenu">
                ${this.sections.map(section => `
                    <p class="menu-label">${section.name}</p>
                    <ul class="menu-list">
                        ${section.pages.map(pageId => `
                            <li>
                                <a data-page="${pageId}" class="${this.currentPage === pageId ? 'is-active' : ''}">
                                    ${this.content[pageId]?.title || 'Sem título'}
                                </a>
                            </li>
                        `).join('')}
                    </ul>
                `).join('')}
            </aside>
        `;
    }

    renderContent() {
        if (!this.currentPage) {
            return '<div class="content p-4">Selecione uma página no menu.</div>';
        }

        const page = this.content[this.currentPage];
        if (!page) {
            return '<div class="content p-4">Página não encontrada.</div>';
        }

        return `
            <div class="content p-4">
                <h1 class="title">${page.title}</h1>
                ${marked.parse(page.content || '')}
            </div>
        `;
    }

    setupEvents() {
        document.querySelectorAll('[data-page]').forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const pageId = link.dataset.page;
                this.loadPage(pageId);
            });
        });
    }

    loadPage(pageId) {
        this.currentPage = pageId;
        this.render();
    }
} 