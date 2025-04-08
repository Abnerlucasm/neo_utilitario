class LearningHub {
    constructor() {
        this.modules = [];
        this.filteredModules = [];
        this.searchResults = null;
        this.userProgress = {};
    }

    async init() {
        try {
            console.log('Inicializando LearningHub...');
            // Carregar dados em paralelo
            await Promise.all([
                this.loadModules(),
                this.loadUserProgress()
            ]);
            
            this.setupSearch();
            this.setupFilters();
            this.render();
            
            console.log('LearningHub inicializado com sucesso!');
        } catch (error) {
            console.error('Erro ao inicializar:', error);
            this.showError('Erro ao carregar módulos: ' + error.message);
        }
    }

    async loadModules() {
        console.log('Carregando módulos...');
        try {
            const response = await fetch('/api/learning/modules', {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
                }
            });
            
            if (!response.ok) {
                const errorText = await response.text();
                console.error(`Erro HTTP ${response.status}: ${errorText}`);
                throw new Error(`Erro ao carregar módulos: ${response.status}`);
            }
            
        this.modules = await response.json();
            console.log(`${this.modules.length} módulos carregados:`, this.modules);
            
            // Processar módulos para garantir que todos tenham as propriedades necessárias
            this.modules = this.modules.map(module => {
                return {
                    ...module,
                    route: module.route || `/learn/${module.id}`,
                    imageUrl: module.imageUrl || '/assets/default-module.jpg',
                    sections: module.sections || [],
                    keywords: Array.isArray(module.keywords) ? module.keywords : [],
                    status: module.status || 'draft'
                };
            });
            
            // Filtrar apenas módulos publicados para usuários não-admin
            const isAdmin = this.checkIfUserIsAdmin();
            if (!isAdmin) {
                this.modules = this.modules.filter(module => module.status === 'published');
            }
            
        this.filteredModules = [...this.modules];
            console.log('Módulos processados:', this.modules);
        } catch (error) {
            console.error('Erro ao carregar módulos:', error);
            throw error;
        }
    }

    async loadUserProgress() {
        try {
            // Buscar progresso do usuário para todos os módulos
            const promises = this.modules.map(module => 
                fetch(`/api/progress/${module.id}`, {
                    headers: {
                        'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
                    }
                })
                .then(response => {
                    if (!response.ok && response.status !== 404) {
                        throw new Error(`Erro ao carregar progresso: ${response.status}`);
                    }
                    return response.json();
                })
                .then(data => {
                    this.userProgress[module.id] = data;
                    return data;
                })
                .catch(error => {
                    console.warn(`Erro ao carregar progresso para módulo ${module.id}:`, error);
                    return null;
                })
            );
            
            await Promise.all(promises);
            console.log('Progresso do usuário carregado:', this.userProgress);
        } catch (error) {
            console.warn('Erro ao carregar progresso do usuário:', error);
            // Não interrompe a execução, apenas registra o erro
        }
    }

    checkIfUserIsAdmin() {
        try {
            const token = localStorage.getItem('auth_token');
            if (!token) return false;
            
            // Decodificar token JWT (sem verificação de assinatura)
            const base64Url = token.split('.')[1];
            const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
            const jsonPayload = decodeURIComponent(atob(base64).split('').map(c => {
                return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
            }).join(''));

            const payload = JSON.parse(jsonPayload);
            return payload.isAdmin === true;
        } catch (error) {
            console.warn('Erro ao verificar se usuário é admin:', error);
            return false;
        }
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

    setupFilters() {
        // Adicionar filtros para categorias/status se existirem
        const filterContainer = document.querySelector('.filter-container');
        if (!filterContainer) return;
        
        // Extrair keywords únicas de todos os módulos
        const allKeywords = new Set();
        this.modules.forEach(module => {
            if (module.keywords && Array.isArray(module.keywords)) {
                module.keywords.forEach(keyword => allKeywords.add(keyword));
            }
        });
        
        // Criar filtros de keywords
        if (allKeywords.size > 0) {
            const keywordFilters = document.createElement('div');
            keywordFilters.className = 'keywords-filter mb-4';
            keywordFilters.innerHTML = `
                <h3 class="is-size-5 mb-2">Filtrar por palavras-chave</h3>
                <div class="tags">
                    ${Array.from(allKeywords).map(keyword => `
                        <span class="tag is-medium keyword-filter" data-keyword="${keyword}">
                            ${keyword}
                        </span>
                    `).join('')}
                </div>
            `;
            
            filterContainer.appendChild(keywordFilters);
            
            // Adicionar event listeners aos filtros
            document.querySelectorAll('.keyword-filter').forEach(filterTag => {
                filterTag.addEventListener('click', () => {
                    filterTag.classList.toggle('is-primary');
                    this.applyFilters();
                });
            });
        }
    }

    applyFilters() {
        // Obter keywords selecionadas
        const selectedKeywords = Array.from(document.querySelectorAll('.keyword-filter.is-primary'))
            .map(tag => tag.dataset.keyword);
        
        if (selectedKeywords.length === 0) {
            // Se nenhum filtro estiver selecionado, mostrar todos os módulos
            this.filteredModules = [...this.modules];
        } else {
            // Filtrar módulos que contêm pelo menos uma das keywords selecionadas
            this.filteredModules = this.modules.filter(module => {
                if (!module.keywords || !Array.isArray(module.keywords)) return false;
                return selectedKeywords.some(keyword => module.keywords.includes(keyword));
            });
        }
        
        this.render();
    }

    async handleSearch(query) {
        try {
            const response = await fetch(`/api/learning/search?query=${encodeURIComponent(query)}`, {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
                }
            });
            
            if (!response.ok) throw new Error('Erro na busca');
            
            this.searchResults = await response.json();
            this.render();
        } catch (error) {
            console.error('Erro ao buscar:', error);
            this.showError('Erro ao realizar busca: ' + error.message);
        }
    }

    render() {
        const container = document.getElementById('modulesContainer');
        if (!container) {
            console.error('Container de módulos não encontrado!');
            return;
        }

        // Se não houver busca ativa, mostrar grid de módulos
        if (!this.searchResults) {
            this.renderModulesGrid(container);
            
            // Atualizar o progresso do usuário
            this.updateUserProgressUI();
            
            return;
        }

        // Se houver busca, mostrar resultados
        this.renderSearchResults(container);
    }

    renderModulesGrid(container) {
        if (!this.filteredModules.length) {
            container.innerHTML = `
                <div class="notification is-warning">
                    <span class="icon"><i class="fas fa-exclamation-triangle"></i></span>
                    <span>Nenhum módulo disponível. Entre em contato com o administrador do sistema.</span>
                </div>
            `;
            return;
        }

        container.innerHTML = this.filteredModules.map(module => `
            <div class="module-card" data-id="${module.id}">
                <div class="card">
                    <div class="card-image">
                        <figure class="image is-4by3">
                            <img src="${module.imageUrl || '/assets/default-module.jpg'}" 
                                 alt="${module.title}" 
                                 onerror="this.src='/assets/default-module.jpg'">
                        </figure>
                        ${this.getStatusBadge(module)}
                    </div>
                    <div class="card-content">
                        <p class="title is-4">${module.title}</p>
                        <p class="subtitle is-6">${module.description || 'Sem descrição'}</p>
                        
                        <div class="content">
                            <div class="module-stats">
                                <span class="icon-text">
                                    <span class="icon">
                                        <i class="fas fa-book"></i>
                                    </span>
                                    <span>${this.getPageCount(module)} páginas</span>
                                </span>
                                
                                <span class="icon-text">
                                    <span class="icon">
                                        <i class="fas fa-layer-group"></i>
                                    </span>
                                    <span>${module.sections?.length || 0} seções</span>
                                </span>
                                
                                ${this.getProgressHTML(module)}
                            </div>

                            <div class="tags mt-2">
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
                            <span>Acessar conteúdo</span>
                        </a>
                        ${this.getResumeButtonHTML(module)}
                    </footer>
                </div>
            </div>
        `).join('');
    }

    getStatusBadge(module) {
        const statusMap = {
            'draft': { class: 'is-warning', text: 'Rascunho' },
            'published': { class: 'is-success', text: 'Publicado' },
            'archived': { class: 'is-light', text: 'Arquivado' }
        };
        
        const status = statusMap[module.status] || statusMap.draft;
        
        return `
            <div class="status-badge">
                <span class="tag ${status.class}">${status.text}</span>
            </div>
        `;
    }

    getProgressHTML(module) {
        const progress = this.userProgress[module.id] || { completed_pages: [], total_pages: 0 };
        const completedPages = progress.completed_pages?.length || 0;
        const totalPages = progress.total_pages || this.getPageCount(module);
        
        if (totalPages === 0) return '';
        
        const percentage = Math.round((completedPages / totalPages) * 100) || 0;
        const progressClass = percentage === 100 ? 'is-success' : 'is-primary';
        
        return `
            <div class="progress-container">
                <span class="icon-text">
                    <span class="icon">
                        <i class="fas fa-chart-line"></i>
                    </span>
                    <span>${percentage}% concluído</span>
                </span>
                <progress class="progress ${progressClass} is-small" 
                          value="${percentage}" max="100">
                    ${percentage}%
                </progress>
            </div>
        `;
    }

    getResumeButtonHTML(module) {
        const progress = this.userProgress[module.id];
        
        // Se não tem progresso ou nenhuma página foi concluída, não mostrar botão de continuar
        if (!progress || !progress.completed_pages || progress.completed_pages.length === 0) {
            return '';
        }
        
        // Se todas as páginas foram concluídas, mostrar botão de revisar
        const completedPages = progress.completed_pages.length;
        const totalPages = progress.total_pages || this.getPageCount(module);
        
        if (completedPages >= totalPages) {
            return `
                <a href="${module.route}" class="card-footer-item has-text-success">
                    <span class="icon">
                        <i class="fas fa-check-circle"></i>
                    </span>
                    <span>Revisar material</span>
                </a>
            `;
        }
        
        // Caso contrário, mostrar botão para continuar
        return `
            <a href="${module.route}" class="card-footer-item has-text-info">
                <span class="icon">
                    <i class="fas fa-play-circle"></i>
                </span>
                <span>Continuar estudando</span>
            </a>
        `;
    }

    renderSearchResults(container) {
        if (!this.searchResults.length) {
            container.innerHTML = `
                <div class="notification is-warning">
                    <p>Nenhum resultado encontrado para a sua busca.</p>
                    <button class="button is-text mt-2" onclick="location.reload()">
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
                <h2 class="title is-4">
                    <span class="icon-text">
                        <span class="icon"><i class="fas fa-search"></i></span>
                        <span>${this.searchResults.length} resultado(s) encontrado(s)</span>
                    </span>
                    <button class="button is-small is-light ml-4" onclick="location.reload()">
                        <span class="icon">
                            <i class="fas fa-undo"></i>
                        </span>
                        <span>Voltar para todos os módulos</span>
                    </button>
                </h2>
            </div>
            <div class="search-results">
            ${this.searchResults.map(result => `
                <div class="search-result-card">
                    <div class="card">
                        <div class="card-content">
                                <div class="columns is-mobile">
                                    <div class="column is-narrow">
                                        <figure class="image is-64x64">
                                            <img src="${result.imageUrl || '/assets/default-module.jpg'}" 
                                                alt="${result.moduleTitle}"
                                                onerror="this.src='/assets/default-module.jpg'">
                                        </figure>
                                    </div>
                                    <div class="column">
                            <p class="title is-4">${result.moduleTitle}</p>
                            
                            <div class="content">
                                <p class="subtitle is-6">
                                                <span class="icon-text">
                                    <span class="icon">
                                        <i class="fas fa-book"></i>
                                    </span>
                                                    <span>${result.sectionTitle} > ${result.pageTitle}</span>
                                                </span>
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
            </div>
        `;
    }

    getPageCount(module) {
        if (!module.sections || !Array.isArray(module.sections)) {
            return 0;
        }
        
        return module.sections.reduce((count, section) => 
            count + (section.pages?.length || 0), 0);
    }

    updateUserProgressUI() {
        const progressContainer = document.getElementById('user-progress');
        if (!progressContainer) return;

        // Verificar se há módulos com progresso
        const modulesWithProgress = Object.entries(this.userProgress)
            .filter(([moduleId, progress]) => 
                progress && 
                progress.completed_pages && 
                progress.completed_pages.length > 0
            )
            .map(([moduleId, progress]) => {
                const module = this.modules.find(m => m.id === moduleId);
                if (!module) return null;
                
                const completedPages = progress.completed_pages.length;
                const totalPages = progress.total_pages || this.getPageCount(module);
                const percentage = totalPages > 0 ? Math.round((completedPages / totalPages) * 100) : 0;
                
                return {
                    id: moduleId,
                    title: module.title,
                    completedPages,
                    totalPages,
                    percentage,
                    route: module.route
                };
            })
            .filter(Boolean)
            .sort((a, b) => b.percentage - a.percentage); // Ordenar por progresso (decrescente)

        if (modulesWithProgress.length === 0) {
            progressContainer.innerHTML = `
                <div class="notification is-light">
                    <p>Você ainda não iniciou nenhum módulo de aprendizado.</p>
                    <p>Escolha um módulo acima para começar.</p>
                </div>
            `;
            return;
        }

        progressContainer.innerHTML = `
            <div class="progress-list">
                ${modulesWithProgress.map(module => `
                    <div class="progress-item mb-4">
                        <div class="level is-mobile">
                            <div class="level-left">
                                <div class="level-item">
                                    <span class="is-size-6 has-text-weight-medium">${module.title}</span>
                                </div>
                            </div>
                            <div class="level-right">
                                <div class="level-item">
                                    <span class="tag is-info">${module.percentage}%</span>
                                </div>
                            </div>
                        </div>
                        <progress class="progress ${module.percentage === 100 ? 'is-success' : 'is-primary'}" 
                                value="${module.percentage}" max="100">
                            ${module.percentage}%
                        </progress>
                        <div class="level is-mobile">
                            <div class="level-left">
                                <div class="level-item">
                                    <span class="is-size-7">${module.completedPages} de ${module.totalPages} páginas</span>
                                </div>
                            </div>
                            <div class="level-right">
                                <div class="level-item">
                                    <a href="${module.route}" class="button is-small is-primary">
                                        ${module.percentage === 100 ? 'Revisar' : 'Continuar'}
                                    </a>
                                </div>
                            </div>
                        </div>
                    </div>
                `).join('')}
            </div>
        `;

        // Atualizar a seção de conquistas
        this.updateAchievementsUI(modulesWithProgress);
    }

    updateAchievementsUI(modulesWithProgress) {
        const achievementsContainer = document.getElementById('achievements');
        if (!achievementsContainer) return;

        // Calcular estatísticas básicas
        const totalModules = this.modules.length;
        const startedModules = modulesWithProgress.length;
        const completedModules = modulesWithProgress.filter(m => m.percentage === 100).length;
        const totalCompletedPages = modulesWithProgress.reduce((total, m) => total + m.completedPages, 0);

        // Definir conquistas baseadas nas estatísticas
        const achievements = [
            {
                id: 'first-step',
                title: 'Primeiros Passos',
                description: 'Iniciou seu primeiro módulo de aprendizado',
                icon: 'fas fa-shoe-prints',
                unlocked: startedModules > 0,
                color: 'is-info'
            },
            {
                id: 'module-master',
                title: 'Mestre do Módulo',
                description: 'Completou um módulo inteiro',
                icon: 'fas fa-graduation-cap',
                unlocked: completedModules > 0,
                color: 'is-success'
            },
            {
                id: 'knowledge-seeker',
                title: 'Buscador de Conhecimento',
                description: 'Completou 10 ou mais páginas de conteúdo',
                icon: 'fas fa-book-reader',
                unlocked: totalCompletedPages >= 10,
                color: 'is-warning'
            },
            {
                id: 'learning-enthusiast',
                title: 'Entusiasta do Aprendizado',
                description: 'Iniciou mais de 3 módulos diferentes',
                icon: 'fas fa-award',
                unlocked: startedModules >= 3,
                color: 'is-link'
            },
            {
                id: 'knowledge-master',
                title: 'Mestre do Conhecimento',
                description: 'Completou todos os módulos disponíveis',
                icon: 'fas fa-crown',
                unlocked: completedModules === totalModules && totalModules > 0,
                color: 'is-danger'
            }
        ];

        // Filtrar apenas conquistas desbloqueadas
        const unlockedAchievements = achievements.filter(a => a.unlocked);
        const lockedAchievements = achievements.filter(a => !a.unlocked);

        achievementsContainer.innerHTML = `
            ${unlockedAchievements.length > 0 ? `
                <div class="achievements-list">
                    ${unlockedAchievements.map(achievement => `
                        <div class="achievement-item ${achievement.color}">
                            <div class="achievement-icon">
                                <span class="icon is-large">
                                    <i class="${achievement.icon}"></i>
            </span>
                            </div>
                            <div class="achievement-content">
                                <p class="is-size-6 has-text-weight-bold">${achievement.title}</p>
                                <p class="is-size-7">${achievement.description}</p>
                            </div>
                        </div>
                    `).join('')}
                </div>
            ` : `
                <div class="notification is-light">
                    <p>Você ainda não desbloqueou nenhuma conquista.</p>
                    <p>Continue estudando para desbloquear!</p>
                </div>
            `}
            
            ${lockedAchievements.length > 0 ? `
                <div class="mt-4">
                    <p class="is-size-6 has-text-weight-medium mb-2">Próximas conquistas:</p>
                    <div class="locked-achievements">
                        ${lockedAchievements.slice(0, 3).map(achievement => `
                            <div class="locked-achievement">
                                <span class="icon"><i class="fas fa-lock"></i></span>
                                <span>${achievement.title}</span>
                            </div>
                        `).join('')}
                    </div>
                </div>
            ` : ''}
        `;
    }

    highlightMatches(text, matches) {
        if (!text || !matches || !matches.length) return text;
        
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
                    <div class="content">
                        <p><strong>Erro:</strong> ${message}</p>
                    <button class="button is-light mt-2" onclick="location.reload()">
                            <span class="icon"><i class="fas fa-sync"></i></span>
                            <span>Tentar novamente</span>
                    </button>
                    </div>
                </div>
            `;
        }
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const hub = new LearningHub();
    hub.init().catch(error => {
        console.error('Erro ao inicializar LearningHub:', error);
    });
}); 