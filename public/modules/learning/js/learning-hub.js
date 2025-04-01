class LearningHub {
    constructor() {
        this.modules = [];
        this.filteredModules = [];
        this.searchResults = null;
    }

    async init() {
        try {
            await this.loadModules();
            this.setupSearch();
            this.render();
        } catch (error) {
            console.error('Erro ao inicializar:', error);
            this.showError('Erro ao carregar módulos');
        }
    }

    async loadModules() {
        const response = await fetch('/api/learning/modules');
        if (!response.ok) throw new Error('Erro ao carregar módulos');
        this.modules = await response.json();
        this.filteredModules = [...this.modules];
    }

    setupSearch() {
        const searchInput = document.getElementById('moduleSearch');
        if (!searchInput) return;

        let debounceTimer;
        searchInput.addEventListener('input', (event) => {
            clearTimeout(debounceTimer);
            debounceTimer = setTimeout(() => {
                const query = event.target.value.trim();
                if (query) {
                    this.handleSearch(query);
                } else {
                    this.searchResults = null;
                    this.render();
                }
            }, 300);
        });
    }

    async handleSearch(query) {
        try {
            const response = await fetch(`/api/learning/search?query=${encodeURIComponent(query)}`);
            if (!response.ok) throw new Error('Erro na busca');
            
            this.searchResults = await response.json();
            this.render();
        } catch (error) {
            console.error('Erro ao buscar:', error);
            this.showError('Erro ao realizar busca');
        }
    }

    render() {
        const container = document.getElementById('modulesContainer');
        if (!container) return;

        // Se não houver busca ativa, mostrar grid de módulos
        if (!this.searchResults) {
            this.renderModulesGrid(container);
            return;
        }

        // Se houver busca, mostrar resultados
        this.renderSearchResults(container);
    }

    renderModulesGrid(container) {
        if (!this.modules.length) {
            container.innerHTML = `
                <div class="notification is-warning">
                    Nenhum módulo disponível.
                </div>
            `;
            return;
        }

        container.innerHTML = this.modules.map(module => `
            <div class="module-card">
                <div class="card">
                    <div class="card-content">
                        <p class="title is-4">${module.title}</p>
                        <p class="subtitle is-6">${module.description}</p>
                        
                        <div class="content">
                            <div class="tags">
                                <span class="tag is-info">
                                    ${this.getPageCount(module)} páginas
                                </span>
                                ${this.getProgressTag(module)}
                                ${module.keywords?.map(keyword => 
                                    `<span class="tag is-light">${keyword}</span>`
                                ).join('') || ''}
                            </div>
                        </div>
                    </div>
                    <footer class="card-footer">
                        <a href="${module.route}" class="card-footer-item">
                            <span class="icon">
                                <i class="fas fa-book-reader"></i>
                            </span>
                            <span>Acessar</span>
                        </a>
                    </footer>
                </div>
            </div>
        `).join('');
    }

    renderSearchResults(container) {
        if (!this.searchResults.length) {
            container.innerHTML = `
                <div class="notification is-warning">
                    Nenhum resultado encontrado.
                    <button class="button is-text" onclick="location.reload()">
                        <span class="icon">
                            <i class="fas fa-undo"></i>
                        </span>
                        <span>Voltar para todos os módulos</span>
                    </button>
                </div>
            `;
            return;
        }

        container.innerHTML = `
            <div class="search-results-header mb-4">
                <h2 class="subtitle">
                    ${this.searchResults.length} resultado(s) encontrado(s)
                    <button class="button is-text" onclick="location.reload()">
                        <span class="icon">
                            <i class="fas fa-undo"></i>
                        </span>
                        <span>Voltar para todos os módulos</span>
                    </button>
                </h2>
            </div>
            ${this.searchResults.map(result => `
                <div class="search-result-card">
                    <div class="card">
                        <div class="card-content">
                            <p class="title is-4">${result.moduleTitle}</p>
                            
                            <div class="content">
                                <p class="subtitle is-6">
                                    <span class="icon">
                                        <i class="fas fa-book"></i>
                                    </span>
                                    ${result.sectionTitle} > ${result.pageTitle}
                                </p>
                                
                                <div class="search-excerpt">
                                    ${this.highlightMatches(result.excerpt, result.matches)}
                                </div>
                                
                                ${result.keywords?.length ? `
                                    <div class="tags mt-2">
                                        ${result.keywords.map(tag => `
                                            <span class="tag is-info is-light">
                                                ${this.highlightMatches(tag, result.matches)}
                                            </span>
                                        `).join('')}
                                    </div>
                                ` : ''}
                            </div>
                        </div>
                        <footer class="card-footer">
                            <a href="${result.url}" class="card-footer-item">
                                <span class="icon">
                                    <i class="fas fa-arrow-right"></i>
                                </span>
                                <span>Ver conteúdo</span>
                            </a>
                        </footer>
                    </div>
                </div>
            `).join('')}
        `;
    }

    getPageCount(module) {
        return module.sections.reduce((count, section) => 
            count + section.pages.length, 0);
    }

    getProgressTag(module) {
        const progress = module.userProgress || { completedPages: [], totalPages: 0 };
        const percentage = progress.totalPages ? 
            Math.round((progress.completedPages.length / progress.totalPages) * 100) : 0;
        
        return `
            <span class="tag is-primary">
                ${percentage}% concluído
            </span>
        `;
    }

    highlightMatches(text, matches) {
        let highlighted = text;
        matches.forEach(match => {
            const regex = new RegExp(`(${match})`, 'gi');
            highlighted = highlighted.replace(regex, '<mark>$1</mark>');
        });
        return highlighted;
    }

    showError(message) {
        const container = document.getElementById('modulesContainer');
        if (container) {
            container.innerHTML = `
                <div class="notification is-danger">
                    <p>${message}</p>
                    <button class="button is-light mt-2" onclick="location.reload()">
                        Tentar novamente
                    </button>
                </div>
            `;
        }
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const hub = new LearningHub();
    hub.init().catch(console.error);
}); 