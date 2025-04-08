/**
 * Central de Aprendizado
 * Este arquivo gerencia a exibição e interação com os módulos de aprendizado na página learn.html
 */
class LearningHub {
    constructor() {
        this.modules = [];
        this.filteredModules = [];
        this.searchResults = null;
        this.userProgress = {};
    }

    async init() {
        try {
            console.log('Inicializando Central de Aprendizado...');
            // Carregar dados em paralelo
            await Promise.all([
                this.loadModules(),
                this.loadUserProgress()
            ]);
            
            this.setupSearch();
            this.setupFilters();
            this.render();
            
            console.log('Central de Aprendizado inicializada com sucesso!');
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
            
            let modules = await response.json();
            console.log(`${modules.length} módulos carregados:`, modules);
            
            // Processar módulos para garantir que todos tenham as propriedades necessárias
            modules = modules.map(module => {
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
                console.log('Usuário não é admin, filtrando apenas módulos publicados');
                modules = modules.filter(module => module.status === 'published');
                console.log(`${modules.length} módulos publicados disponíveis para o usuário`);
            }
            
            this.modules = modules;
            this.filteredModules = [...modules];
            console.log('Módulos processados:', this.modules);
        } catch (error) {
            console.error('Erro ao carregar módulos:', error);
            throw error;
        }
    }

    async loadUserProgress() {
        try {
            // Buscar progresso geral do usuário
            const response = await fetch('/api/progress', {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
                }
            });
            
            if (!response.ok) {
                throw new Error(`Erro ao carregar progresso: ${response.status}`);
            }
            
            const progressData = await response.json();
            
            // Organizar progresso por módulo
            if (progressData && progressData.modules) {
                progressData.modules.forEach(moduleProgress => {
                    this.userProgress[moduleProgress.module_id] = moduleProgress;
                });
            }
            
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
                    this.searchModules(query);
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

    searchModules(query) {
        // Busca local simples
        const lowercaseQuery = query.toLowerCase();
        
        this.searchResults = this.modules.filter(module => {
            const title = (module.title || '').toLowerCase();
            const description = (module.description || '').toLowerCase();
            const keywords = Array.isArray(module.keywords) 
                ? module.keywords.map(k => k.toLowerCase()) 
                : [];
                
            return title.includes(lowercaseQuery) || 
                   description.includes(lowercaseQuery) ||
                   keywords.some(k => k.includes(lowercaseQuery));
        });
        
        this.render();
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
                    <span>Nenhum módulo de aprendizado disponível. Entre em contato com o administrador do sistema.</span>
                </div>
            `;
            return;
        }

        container.innerHTML = this.filteredModules.map(module => `
            <div class="module-card card">
                <div class="card-image">
                    <figure class="image is-4by3">
                        <img src="${module.imageUrl || '/assets/default-module.jpg'}" alt="${module.title}">
                    </figure>
                    ${this.getStatusBadge(module)}
                </div>
                <div class="card-content">
                    <div class="media">
                        <div class="media-content">
                            <p class="title is-4">${module.title || 'Sem título'}</p>
                            <p class="subtitle is-6">${this.getProgressHTML(module)}</p>
                        </div>
                    </div>
                    <div class="content">
                        ${module.description || 'Sem descrição'}
                        ${Array.isArray(module.keywords) && module.keywords.length > 0 ? `
                            <div class="tags mt-2">
                                ${module.keywords.map(k => `<span class="tag">${k}</span>`).join('')}
                            </div>
                        ` : ''}
                    </div>
                </div>
                <footer class="card-footer">
                    ${this.getResumeButtonHTML(module)}
                </footer>
            </div>
        `).join('');
    }

    getStatusBadge(module) {
        const statusMap = {
            'draft': { class: 'is-light', text: 'Rascunho' },
            'published': { class: 'is-success', text: 'Publicado' },
            'archived': { class: 'is-dark', text: 'Arquivado' }
        };
        
        const status = statusMap[module.status] || statusMap.draft;
        
        return `<span class="status-badge tag ${status.class}">${status.text}</span>`;
    }

    getProgressHTML(module) {
        const progress = this.userProgress[module.id];
        
        if (!progress) {
            return 'Não iniciado';
        }
        
        const percentage = Math.round((progress.completed_pages || 0) / Math.max(1, progress.total_pages || 1) * 100);
        
        return `
            <div class="progress-container">
                <progress class="progress is-primary" value="${percentage}" max="100"></progress>
                <div class="is-size-7 has-text-right">${percentage}% concluído</div>
            </div>
        `;
    }

    getResumeButtonHTML(module) {
        const progress = this.userProgress[module.id];
        const isStarted = progress && progress.completed_pages > 0;
        const isCompleted = progress && progress.completed_pages === progress.total_pages && progress.total_pages > 0;
        
        let buttonClass = 'is-primary';
        let buttonText = 'Iniciar';
        let icon = 'fas fa-play';
        
        if (isCompleted) {
            buttonClass = 'is-success';
            buttonText = 'Revisar';
            icon = 'fas fa-check-circle';
        } else if (isStarted) {
            buttonClass = 'is-info';
            buttonText = 'Continuar';
            icon = 'fas fa-bookmark';
        }
        
        return `
            <a href="${module.route}" class="card-footer-item button ${buttonClass} is-light">
                <span class="icon">
                    <i class="${icon}"></i>
                </span>
                <span>${buttonText}</span>
            </a>
        `;
    }

    renderSearchResults(container) {
        if (!this.searchResults || this.searchResults.length === 0) {
            container.innerHTML = `
                <div class="notification is-warning">
                    <span class="icon"><i class="fas fa-search"></i></span>
                    <span>Nenhum resultado encontrado para a pesquisa.</span>
                </div>
            `;
            return;
        }

        container.innerHTML = `
            <h3 class="title is-5 mb-4">Resultados da pesquisa</h3>
            ${this.searchResults.map(module => `
                <div class="search-result-card card mb-4">
                    <div class="card-content">
                        <div class="media">
                            <div class="media-left">
                                <figure class="image is-64x64">
                                    <img src="${module.imageUrl || '/assets/default-module.jpg'}" alt="${module.title}">
                                </figure>
                            </div>
                            <div class="media-content">
                                <p class="title is-4">${module.title || 'Sem título'}</p>
                                <p class="subtitle is-6">${this.getProgressHTML(module)}</p>
                            </div>
                        </div>
                        <div class="content">
                            ${module.description || 'Sem descrição'}
                        </div>
                        <div class="buttons">
                            <a href="${module.route}" class="button is-primary">
                                <span class="icon">
                                    <i class="fas fa-book"></i>
                                </span>
                                <span>Ver módulo</span>
                            </a>
                        </div>
                    </div>
                </div>
            `).join('')}
        `;
    }

    updateUserProgressUI() {
        const progressElement = document.getElementById('user-progress');
        if (!progressElement) return;
        
        // Filtrar módulos com progresso
        const modulesWithProgress = this.modules
            .filter(module => this.userProgress[module.id])
            .map(module => ({
                ...module,
                progress: this.userProgress[module.id]
            }));
        
        // Calcular estatísticas gerais
        const totalModules = this.modules.length;
        const startedModules = modulesWithProgress.length;
        const completedModules = modulesWithProgress.filter(m => 
            m.progress.completed_pages === m.progress.total_pages && m.progress.total_pages > 0
        ).length;
        
        // Calcular percentual total completado
        let totalPages = 0;
        let totalCompletedPages = 0;
        
        modulesWithProgress.forEach(module => {
            totalPages += module.progress.total_pages || 0;
            totalCompletedPages += module.progress.completed_pages || 0;
        });
        
        const overallPercentage = totalPages > 0 
            ? Math.round((totalCompletedPages / totalPages) * 100) 
            : 0;
        
        // Renderizar progresso
        progressElement.innerHTML = `
            <div class="columns is-multiline">
                <div class="column is-12">
                    <div class="level">
                        <div class="level-item has-text-centered">
                            <div>
                                <p class="heading">Módulos</p>
                                <p class="title">${totalModules}</p>
                            </div>
                        </div>
                        <div class="level-item has-text-centered">
                            <div>
                                <p class="heading">Iniciados</p>
                                <p class="title">${startedModules}</p>
                            </div>
                        </div>
                        <div class="level-item has-text-centered">
                            <div>
                                <p class="heading">Concluídos</p>
                                <p class="title">${completedModules}</p>
                            </div>
                        </div>
                    </div>
                </div>
                
                <div class="column is-12">
                    <p class="subtitle">Progresso Geral</p>
                    <progress class="progress is-success" value="${overallPercentage}" max="100"></progress>
                    <p class="has-text-right">${overallPercentage}% concluído</p>
                </div>
                
                ${totalModules > 0 && startedModules === 0 ? `
                    <div class="column is-12">
                        <div class="notification is-info is-light">
                            <p>Você ainda não iniciou nenhum módulo. Escolha um acima para começar seu aprendizado!</p>
                        </div>
                    </div>
                ` : ''}
                
                ${startedModules > 0 ? `
                    <div class="column is-12">
                        <p class="subtitle">Módulos em andamento</p>
                        <div class="in-progress-modules">
                            ${modulesWithProgress
                                .filter(m => 
                                    m.progress.completed_pages < m.progress.total_pages
                                )
                                .sort((a, b) => {
                                    // Ordenar por percentual de conclusão (decrescente)
                                    const aPerc = a.progress.total_pages > 0 
                                        ? (a.progress.completed_pages / a.progress.total_pages) 
                                        : 0;
                                    const bPerc = b.progress.total_pages > 0 
                                        ? (b.progress.completed_pages / b.progress.total_pages) 
                                        : 0;
                                    return bPerc - aPerc;
                                })
                                .slice(0, 3) // Mostrar apenas os 3 mais avançados
                                .map(module => {
                                    const percentage = module.progress.total_pages > 0 
                                        ? Math.round((module.progress.completed_pages / module.progress.total_pages) * 100)
                                        : 0;
                                        
                                    return `
                                        <div class="box">
                                            <p class="is-size-5">${module.title}</p>
                                            <progress class="progress is-info" value="${percentage}" max="100"></progress>
                                            <div class="level is-mobile">
                                                <div class="level-left">
                                                    <a href="${module.route}" class="button is-small is-primary">
                                                        Continuar
                                                    </a>
                                                </div>
                                                <div class="level-right">
                                                    ${percentage}% concluído
                                                </div>
                                            </div>
                                        </div>
                                    `;
                                }).join('')}
                        </div>
                    </div>
                ` : ''}
            </div>
        `;
        
        // Atualizar conquistas
        this.updateAchievementsUI(modulesWithProgress);
    }

    updateAchievementsUI(modulesWithProgress) {
        const achievementsElement = document.getElementById('achievements');
        if (!achievementsElement) return;
        
        // Calcular estatísticas para conquistas
        const completedModules = modulesWithProgress.filter(m => 
            m.progress.completed_pages === m.progress.total_pages && m.progress.total_pages > 0
        ).length;
        
        const totalModulesStarted = modulesWithProgress.length;
        
        const totalPages = modulesWithProgress.reduce((sum, m) => sum + (m.progress.total_pages || 0), 0);
        const completedPages = modulesWithProgress.reduce((sum, m) => sum + (m.progress.completed_pages || 0), 0);
        
        // Definir conquistas
        const achievements = [
            {
                id: 'first-module',
                title: 'Primeiro Passo',
                description: 'Comece seu primeiro módulo de aprendizado',
                icon: 'fas fa-flag-checkered',
                color: 'is-info',
                achieved: totalModulesStarted > 0
            },
            {
                id: 'first-module-complete',
                title: 'Missão Cumprida',
                description: 'Complete seu primeiro módulo de aprendizado',
                icon: 'fas fa-trophy',
                color: 'is-success',
                achieved: completedModules > 0
            },
            {
                id: 'five-modules',
                title: 'Explorador',
                description: 'Inicie 5 módulos diferentes',
                icon: 'fas fa-compass',
                color: 'is-link',
                achieved: totalModulesStarted >= 5,
                progress: totalModulesStarted < 5 
                    ? { current: totalModulesStarted, max: 5 }
                    : null
            },
            {
                id: 'three-modules-complete',
                title: 'Especialista',
                description: 'Complete 3 módulos de aprendizado',
                icon: 'fas fa-award',
                color: 'is-warning',
                achieved: completedModules >= 3,
                progress: completedModules < 3 
                    ? { current: completedModules, max: 3 }
                    : null
            },
            {
                id: 'fifty-pages',
                title: 'Leitor Ávido',
                description: 'Leia 50 páginas de conteúdo',
                icon: 'fas fa-book-reader',
                color: 'is-danger',
                achieved: completedPages >= 50,
                progress: completedPages < 50 
                    ? { current: completedPages, max: 50 }
                    : null
            }
        ];
        
        // Renderizar conquistas
        achievementsElement.innerHTML = `
            <div class="achievements-list">
                ${achievements.map(achievement => {
                    if (achievement.achieved) {
                        return `
                            <div class="achievement-item ${achievement.color}">
                                <div class="achievement-icon">
                                    <span class="icon is-medium">
                                        <i class="${achievement.icon}"></i>
                                    </span>
                                </div>
                                <div class="achievement-details">
                                    <p class="has-text-weight-bold">${achievement.title}</p>
                                    <p class="is-size-7">${achievement.description}</p>
                                </div>
                            </div>
                        `;
                    } else {
                        return `
                            <div class="achievement-item locked-achievement">
                                <div class="achievement-icon">
                                    <span class="icon is-medium">
                                        <i class="fas fa-lock"></i>
                                    </span>
                                </div>
                                <div class="achievement-details">
                                    <p class="has-text-weight-bold">${achievement.title}</p>
                                    <p class="is-size-7">${achievement.description}</p>
                                    ${achievement.progress ? `
                                        <progress class="progress is-small" 
                                            value="${achievement.progress.current}" 
                                            max="${achievement.progress.max}">
                                        </progress>
                                        <p class="is-size-7 has-text-right">
                                            ${achievement.progress.current} / ${achievement.progress.max}
                                        </p>
                                    ` : ''}
                                </div>
                            </div>
                        `;
                    }
                }).join('')}
            </div>
        `;
    }

    showError(message) {
        const container = document.getElementById('modulesContainer');
        if (container) {
            container.innerHTML = `
                <div class="notification is-danger">
                    <span class="icon"><i class="fas fa-exclamation-circle"></i></span>
                    <span>${message}</span>
                </div>
            `;
        }
    }
}

// Inicializar quando o documento estiver pronto
document.addEventListener('DOMContentLoaded', () => {
    const learningHub = new LearningHub();
    learningHub.init();
}); 