class LearningCenter {
    constructor() {
        this.modulesContainer = document.getElementById('learning-modules');
        this.progressContainer = document.getElementById('user-progress');
        this.achievementsContainer = document.getElementById('achievements');
        this.searchInput = document.getElementById('moduleSearch');
        this.filterContainer = document.querySelector('.filter-container');
        this.modules = [];
        this.filteredModules = [];
        this.searchResults = null;
        this.userProgress = {};
        this.favorites = this.loadFavorites();
        this.activeFilters = [];
        
        if (!this.modulesContainer) {
            console.error('Container de módulos não encontrado (ID: learning-modules)');
            return;
        }

        // Inicializar apenas depois que o DOM estiver completamente carregado
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.init());
        } else {
        this.init();
        }
    }

    async init() {
        try {
            // Carregar módulos primeiro
            await this.loadModules();
            
            // Carregar dados do usuário em paralelo
            await Promise.all([
                this.loadProgress(),
                this.loadAchievements()
            ]);
            
            // Configurar busca e filtros
            this.setupSearch();
            this.setupFilters();
        } catch (error) {
            console.error('Erro ao inicializar central de aprendizado:', error);
            this.showError('Erro ao carregar dados da central de aprendizado');
        }
    }

    setupSearch() {
        if (!this.searchInput) return;
        
        let debounceTimer;
        this.searchInput.addEventListener('input', (event) => {
            clearTimeout(debounceTimer);
            debounceTimer = setTimeout(() => {
                const query = event.target.value.trim();
                if (query) {
                    this.searchModules(query);
                } else {
                    this.searchResults = null;
                    this.renderModules();
                }
            }, 300);
        });
    }

    searchModules(query) {
        if (!query || query.trim().length < 2) {
            this.searchResults = null;
            this.renderModules();
            return;
        }
        
        const lowercaseQuery = query.toLowerCase().trim();
        console.log('Realizando busca por:', lowercaseQuery);
        
        // Primeiro, tentar busca avançada na API
        this.performAdvancedSearch(lowercaseQuery);
    }

    async performAdvancedSearch(query) {
        try {
            this.modulesContainer.innerHTML = `
                <div class="column is-12">
                    <div class="notification is-info">
                        <span class="icon"><i class="fas fa-search"></i></span>
                        <span>Pesquisando por "${query}"...</span>
                    </div>
                </div>
            `;
            
            // Fazer requisição à API para busca avançada
            const response = await fetch(`/api/learning/search?query=${encodeURIComponent(query)}`, {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
                }
            });
            
            if (!response.ok) {
                console.warn('Busca na API falhou, usando busca local');
                this.performLocalSearch(query);
                return;
            }
            
            const results = await response.json();
            
            // Se não houver resultados da API, fazer busca local
            if (!results || results.length === 0) {
                console.log('Sem resultados da API, usando busca local');
                this.performLocalSearch(query);
                return;
            }
            
            console.log('Resultados da busca na API:', results);
            
            // Agrupar resultados por módulo
            const moduleResults = {};
            
            results.forEach(result => {
                if (!moduleResults[result.moduleId]) {
                    moduleResults[result.moduleId] = {
                        id: result.moduleId,
                        title: result.moduleTitle,
                        results: []
                    };
                }
                
                moduleResults[result.moduleId].results.push({
                    pageId: result.pageId,
                    pageTitle: result.pageTitle,
                    sectionTitle: result.sectionTitle,
                    excerpt: result.excerpt,
                    url: result.url
                });
            });
            
            // Transformar em array para renderização
            this.searchResults = Object.values(moduleResults);
            this.renderSearchResults();
            
        } catch (error) {
            console.error('Erro na busca avançada:', error);
            // Fallback para busca local
            this.performLocalSearch(query);
        }
    }
    
    performLocalSearch(query) {
        // Busca local simples
        const results = this.modules.filter(module => {
            const title = (module.title || '').toLowerCase();
            const description = (module.description || '').toLowerCase();
            const keywords = Array.isArray(module.keywords) 
                ? module.keywords.map(k => k.toLowerCase()) 
                : [];
                
            return title.includes(query) || 
                   description.includes(query) ||
                   keywords.some(k => k.includes(query));
        });
        
        // Preparar resultado no mesmo formato que a busca avançada
        this.searchResults = results.map(module => ({
            id: module.id,
            title: module.title,
            // Resultados simulados para busca local (sem trechos específicos)
            results: [{
                pageId: null,
                pageTitle: 'Módulo completo',
                sectionTitle: null,
                excerpt: module.description,
                url: module.route
            }]
        }));
        
        this.renderSearchResults();
    }
    
    renderSearchResults() {
        if (!this.modulesContainer) return;
        
        if (!this.searchResults || this.searchResults.length === 0) {
            this.modulesContainer.innerHTML = `
                <div class="column is-12">
                    <div class="notification is-warning">
                        <span class="icon"><i class="fas fa-search"></i></span>
                        <span>Nenhum resultado encontrado para sua busca.</span>
                    </div>
                </div>
            `;
            return;
        }
        
        // Obter os termos de busca da barra de pesquisa
        const searchInput = document.getElementById('moduleSearch');
        const searchTerms = searchInput ? searchInput.value.toLowerCase().split(/\s+/).filter(term => term.length > 2) : [];
        
        this.modulesContainer.innerHTML = `
            <div class="column is-12">
                <h3 class="title is-5">Resultados da busca</h3>
                ${this.searchResults.map(moduleResult => `
                    <div class="card mb-5">
                        <header class="card-header">
                            <p class="card-header-title">
                                <span class="icon-text">
                                    <span class="icon">
                                        <i class="fas fa-book"></i>
                                    </span>
                                    <span>${moduleResult.title}</span>
                                </span>
                            </p>
                        </header>
                        <div class="card-content">
                            ${moduleResult.results.map(result => {
                                // Destacar os termos de busca no excerpt
                                let highlightedExcerpt = result.excerpt || 'Sem trecho disponível';
                                
                                // Aplicar destaque para cada termo de busca
                                if (result.excerpt) {
                                    searchTerms.forEach(term => {
                                        // Criar regex case-insensitive para o termo
                                        const regex = new RegExp(`(${term})`, 'gi');
                                        // Substituir com span destacado
                                        highlightedExcerpt = highlightedExcerpt.replace(
                                            regex, 
                                            '<span class="search-highlight" style="background-color:#ffeb3b;font-weight:bold;">$1</span>'
                                        );
                                    });
                                }
                                
                                return `
                                    <div class="search-result-item mb-4">
                                        <div class="level mb-2">
                                            <div class="level-left">
                                                <div class="level-item">
                                                    <span class="has-text-weight-medium">
                                                        ${result.sectionTitle ? `${result.sectionTitle} &raquo; ` : ''}
                                                        ${result.pageTitle}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                        <div class="content">
                                            <p class="excerpt">${highlightedExcerpt}</p>
                                        </div>
                                        <a href="${result.url}" class="button is-small is-primary">
                                            <span class="icon">
                                                <i class="fas fa-eye"></i>
                                            </span>
                                            <span>Ver conteúdo</span>
                                        </a>
                                    </div>
                                    ${moduleResult.results.length > 1 ? '<hr>' : ''}
                                `;
                            }).join('')}
                        </div>
                    </div>
                `).join('')}
            </div>
        `;
    }

    async loadModules() {
        try {
            const response = await fetch('/api/learning/modules', {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
                }
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const modules = await response.json();

            if (!Array.isArray(modules)) {
                throw new Error('Dados de módulos inválidos');
            }

            this.modules = modules;
            this.filteredModules = [...modules];

            if (modules.length === 0) {
                this.modulesContainer.innerHTML = `
                    <div class="column is-12">
                        <div class="notification is-info">
                            Nenhum módulo disponível no momento.
                        </div>
                    </div>
                `;
                return;
            }

            this.renderModules();
        } catch (error) {
            console.error('Erro ao carregar módulos:', error);
            this.modulesContainer.innerHTML = `
                <div class="column is-12">
                    <div class="notification is-danger">
                        <p>Erro ao carregar módulos de aprendizado</p>
                        <p class="is-size-7">${error.message}</p>
                    </div>
                </div>
            `;
        }
    }

    renderModules() {
        if (!this.modulesContainer) return;
        
        const modulesToRender = this.searchResults || this.filteredModules;
        
        if (modulesToRender.length === 0) {
            this.modulesContainer.innerHTML = `
                <div class="column is-12">
                    <div class="notification is-warning">
                        ${this.searchResults ? 'Nenhum resultado encontrado para sua busca.' : 'Nenhum módulo disponível no momento.'}
                    </div>
                </div>
            `;
            return;
        }

        this.modulesContainer.innerHTML = modulesToRender.map(module => {
            const isCompleted = this.isModuleCompleted(module.id);
            const isFavorite = this.isFavorite(module.id);
            const progress = this.getModuleProgress(module.id);
            const hasImage = module.imageUrl && module.imageUrl !== '/assets/default-module.jpg';
            
            return `
                <div class="column is-4">
                    <div class="card ${isCompleted ? 'has-background-success-light' : ''}">
                        ${hasImage ? `
                        <div class="card-image">
                            <figure class="image is-4by3">
                                <img src="${module.imageUrl}" alt="${module.title}">
                            </figure>
                            <span class="tag is-${module.status === 'published' ? 'success' : module.status === 'draft' ? 'warning' : 'dark'} status-badge">
                                ${module.status === 'published' ? 'Publicado' : module.status === 'draft' ? 'Rascunho' : 'Arquivado'}
                            </span>
                            ${isCompleted ? `
                                <span class="tag is-success is-light" style="position: absolute; top: 10px; left: 10px;">
                                    <span class="icon"><i class="fas fa-check-circle"></i></span>
                                    <span>Concluído</span>
                                </span>
                            ` : ''}
                        </div>
                        ` : ''}
                        <div class="card-content">
                            ${!hasImage ? `
                            <span class="tag is-${module.status === 'published' ? 'success' : module.status === 'draft' ? 'warning' : 'dark'} is-pulled-right mb-2">
                                ${module.status === 'published' ? 'Publicado' : module.status === 'draft' ? 'Rascunho' : 'Arquivado'}
                            </span>
                            ${isCompleted ? `
                                <span class="tag is-success is-light is-pulled-left mb-2 mr-2">
                                    <span class="icon"><i class="fas fa-check-circle"></i></span>
                                    <span>Concluído</span>
                                </span>
                            ` : ''}
                            <div class="is-clearfix"></div>
                            ` : ''}
                            <div class="level mb-2">
                                <div class="level-left">
                                    <p class="title is-4">${module.title || 'Sem título'}</p>
                                </div>
                                <div class="level-right">
                                    <button class="button is-small favorite-button ${isFavorite ? 'is-warning' : 'is-light'}" 
                                            data-module-id="${module.id}" 
                                            onclick="window.learningCenter.toggleFavorite('${module.id}')">
                                        <span class="icon">
                                            <i class="fas fa-star"></i>
                                        </span>
                                    </button>
                                </div>
                            </div>
                            
                            <p class="subtitle is-6">${module.description || 'Sem descrição'}</p>
                            
                            <div class="progress-container mb-3">
                                <progress class="progress is-primary" value="${progress ? progress.percentage : 0}" max="100"></progress>
                                <p class="has-text-right is-size-7">${progress ? progress.percentage : 0}% concluído</p>
                            </div>
                            
                            <div class="content">
                                ${module.keywords && module.keywords.length > 0 ? `
                                    <div class="tags">
                                        ${module.keywords.map(k => `<span class="tag">${k}</span>`).join('')}
                                    </div>
                                ` : ''}
                            </div>
                        </div>
                        <footer class="card-footer">
                            <a href="/learn/${module.id}" class="card-footer-item button is-primary is-light">
                                <span class="icon-text">
                                    <span class="icon">
                                        <i class="fas ${this.getAccessButtonIcon(module.id)}"></i>
                                    </span>
                                    <span>${this.getAccessButtonText(module.id)}</span>
                                </span>
                            </a>
                        </footer>
                    </div>
                </div>
            `;
        }).join('');
        
        // Aplicar highlight aos termos de busca
        if (this.searchResults && this.searchInput.value.trim()) {
            this.highlightSearchTerms(this.searchInput.value.trim());
        }
    }
    
    highlightSearchTerms(query) {
        if (!query) return;
        
        const terms = query.toLowerCase().split(' ').filter(term => term.length > 2);
        if (terms.length === 0) return;
        
        // Encontrar elementos de texto nos módulos
        const textElements = this.modulesContainer.querySelectorAll('.card-content p, .card-content .tag');
        
        textElements.forEach(element => {
            const originalText = element.innerHTML;
            let highlightedText = originalText;
            
            // Não processar elementos que já contêm HTML
            if (originalText.includes('<mark>')) return;
            
            // Aplicar highlight para cada termo
            terms.forEach(term => {
                const regex = new RegExp(term, 'gi');
                highlightedText = highlightedText.replace(regex, match => `<mark>${match}</mark>`);
            });
            
            if (highlightedText !== originalText) {
                element.innerHTML = highlightedText;
            }
        });
    }

    getAccessButtonIcon(moduleId) {
        const progress = this.getModuleProgress(moduleId);
        
        if (!progress || progress.percentage === 0) {
            return 'fa-play';
        } else if (progress.percentage === 100) {
            return 'fa-check-circle';
        } else {
            return 'fa-book-reader';
        }
    }
    
    getAccessButtonText(moduleId) {
        const progress = this.getModuleProgress(moduleId);
        
        if (!progress || progress.percentage === 0) {
            return 'Iniciar';
        } else if (progress.percentage === 100) {
            return 'Revisar';
        } else {
            return 'Continuar';
        }
    }
    
    isModuleCompleted(moduleId) {
        const progress = this.getModuleProgress(moduleId);
        return progress && progress.percentage === 100;
    }
    
    getModuleProgress(moduleId) {
        // Verificar se temos progresso para este módulo
        const moduleProgress = this.userProgress[moduleId];
        
        if (!moduleProgress) {
            return {
                completed: false,
                percentage: 0,
                pagesCompleted: 0,
                totalPages: 0
            };
        }
        
        // Calcular percentual com base em páginas concluídas vs. total
        let totalPages = moduleProgress.total_pages || 0;
        let completedPages = Array.isArray(moduleProgress.completed_pages) 
            ? moduleProgress.completed_pages.length 
            : (moduleProgress.completed_pages || 0);
            
        // Se tiver um progresso armazenado, usá-lo diretamente
        if (typeof moduleProgress.progress === 'number') {
            return {
                completed: moduleProgress.completed === true,
                percentage: Math.round(moduleProgress.progress),
                pagesCompleted: completedPages,
                totalPages: totalPages
            };
        }
        
        // Senão, calcular com base nas páginas
        if (totalPages <= 0) {
            // Se não tiver informações de páginas, usar o módulo
            const module = this.modules.find(m => m.id === moduleId);
            if (module && module.sections) {
                // Contar páginas do módulo
                totalPages = module.sections.reduce((count, section) => {
                    return count + (Array.isArray(section.pages) ? section.pages.length : 0);
                }, 0);
            }
            
            // Se ainda não tiver páginas, garantir pelo menos uma
            if (totalPages <= 0) totalPages = 1;
        }
        
        const percentage = totalPages > 0 ? Math.round((completedPages / totalPages) * 100) : 0;
        
        return {
            completed: completedPages >= totalPages && totalPages > 0,
            percentage: percentage,
            pagesCompleted: completedPages,
            totalPages: totalPages
        };
    }
    
    isFavorite(moduleId) {
        return this.favorites.includes(moduleId);
    }
    
    toggleFavorite(moduleId) {
        if (!moduleId) return;
        
        const index = this.favorites.indexOf(moduleId);
        if (index === -1) {
            // Adicionar aos favoritos
            this.favorites.push(moduleId);
            
            // Verificar conquista de favorito
            setTimeout(() => this.checkAchievements(), 500);
        } else {
            // Remover dos favoritos
            this.favorites.splice(index, 1);
        }
        
        // Salvar favoritos
        this.saveFavorites();
        
        // Atualizar visualização
        this.renderModules();
    }
    
    loadFavorites() {
        try {
            const favorites = localStorage.getItem('module_favorites');
            return favorites ? JSON.parse(favorites) : [];
        } catch (e) {
            console.error('Erro ao carregar favoritos:', e);
            return [];
        }
    }
    
    saveFavorites() {
        try {
            localStorage.setItem('module_favorites', JSON.stringify(this.favorites));
        } catch (e) {
            console.error('Erro ao salvar favoritos:', e);
        }
    }

    async loadProgress() {
        try {
            if (!this.progressContainer) return;
            
            // Verificar se a API existe
            const response = await fetch('/api/progress', {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
                }
            }).catch(e => {
                console.warn('API de progresso não está disponível:', e);
                return { ok: false, status: 404 };
            });

            if (!response.ok) {
                // API não disponível, usar dados simulados para testes
                this.simulateUserProgress();
                this.renderProgressOverview();
                    return;
            }

            const progress = await response.json();

            // Organizar progresso por módulo ID
            if (progress && progress.modules) {
                progress.modules.forEach(moduleProgress => {
                    this.userProgress[moduleProgress.module_id] = moduleProgress;
                });
            }
            
            console.log('Progresso carregado:', this.userProgress);
            
            // Verificar se existem módulos concluídos antes de simular
            const hasCompletedModules = Object.values(this.userProgress).some(p => p.completed);
            
            // Se não houver progresso real, simular alguns dados para desenvolvimento
            if (Object.keys(this.userProgress).length === 0) {
                this.simulateUserProgress();
            }
            
            this.renderProgressOverview();
            this.checkAchievements();
        } catch (error) {
            console.error('Erro ao carregar progresso:', error);
            this.simulateUserProgress();
            this.renderProgressOverview();
        }
    }
    
    simulateUserProgress() {
        // Criar dados simulados de progresso para desenvolvimento
        this.modules.forEach((module, index) => {
            // Diferentes níveis de progresso para teste
            let progress = 0;
            
            if (index % 3 === 0) progress = 100; // Completado
            else if (index % 3 === 1) progress = Math.round(Math.random() * 80); // Em progresso
            
            const totalPages = Math.floor(Math.random() * 10) + 5;
            const completedPages = Math.ceil(totalPages * (progress / 100));
            
            this.userProgress[module.id] = {
                module_id: module.id,
                completed_pages: completedPages,
                total_pages: totalPages,
                progress: progress,
                completed: progress === 100,
                last_accessed: new Date().toISOString()
            };
        });
    }
    
    renderProgressOverview() {
        if (!this.progressContainer) return;
        
        // Obter todos os módulos disponíveis para o cálculo correto de progresso
        const totalModules = this.modules.length;
        const startedModules = Object.keys(this.userProgress).length;
        
        // Calcular módulos completados com base nos módulos que possuem progresso
        const completedModules = Object.values(this.userProgress).filter(p => 
            p && p.completed_pages === p.total_pages && p.total_pages > 0
        ).length;
        
        // Para cálculo do progresso geral, considerar TODOS os módulos disponíveis
        let totalPagesAcrossAllModules = 0;
        let completedPagesAcrossAllModules = 0;
        
        // Somar o total de páginas em todos os módulos
        this.modules.forEach(module => {
            // Obter o número de páginas do módulo (da API ou do progresso salvo)
            const moduleProgress = this.userProgress[module.id];
            let totalPagesInModule = 0;
            
            if (moduleProgress && moduleProgress.total_pages) {
                totalPagesInModule = moduleProgress.total_pages;
            } else {
                // Se não houver informação sobre o total de páginas, estimar com base nas seções
                if (module.sections && Array.isArray(module.sections)) {
                    module.sections.forEach(section => {
                        if (section.pages && Array.isArray(section.pages)) {
                            totalPagesInModule += section.pages.length;
                        }
                    });
                }
                
                // Se não houver seções ou páginas, considerar pelo menos 1 página
                if (totalPagesInModule === 0) {
                    totalPagesInModule = 1;
                }
            }
            
            // Adicionar ao total global
            totalPagesAcrossAllModules += totalPagesInModule;
            
            // Adicionar páginas completadas (se houver progresso)
            if (moduleProgress && moduleProgress.completed_pages) {
                completedPagesAcrossAllModules += moduleProgress.completed_pages;
            }
        });
        
        // Calcular percentual geral de conclusão
        const overallProgress = totalPagesAcrossAllModules > 0 
            ? Math.round((completedPagesAcrossAllModules / totalPagesAcrossAllModules) * 100) 
            : 0;
        
        // Verificar se há módulos em progresso
        const modulesInProgress = this.modules.filter(module => {
            const progress = this.getModuleProgress(module.id);
            return progress && progress.percentage > 0 && progress.percentage < 100;
        });
        
        // Ordenar módulos em progresso pelo percentual completado (decrescente)
        const sortedModulesInProgress = modulesInProgress.sort((a, b) => {
            const progressA = this.getModuleProgress(a.id);
            const progressB = this.getModuleProgress(b.id);
            return progressB.percentage - progressA.percentage;
        }).slice(0, 3); // Mostrar apenas os 3 mais avançados
        
            this.progressContainer.innerHTML = `
            <div class="content">
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
                            <p class="heading">Completados</p>
                            <p class="title">${completedModules}</p>
                        </div>
                    </div>
                </div>
                
                <p class="subtitle">Progresso Geral</p>
                <progress class="progress is-success" value="${overallProgress}" max="100"></progress>
                <p class="has-text-right">${overallProgress}% concluído</p>
                
                ${startedModules === 0 ? `
                    <div class="notification is-info is-light mt-4">
                        <p>Você ainda não iniciou nenhum módulo. Escolha um acima para começar seu aprendizado!</p>
                    </div>
                ` : ''}
                
                ${sortedModulesInProgress.length > 0 ? `
                    <div class="mt-4">
                        <p class="subtitle is-6">Módulos em andamento</p>
                        ${sortedModulesInProgress.map(module => {
                            const progress = this.getModuleProgress(module.id);
                            return `
                                <div class="box mb-3">
                                    <p class="is-size-6 mb-2">${module.title}</p>
                                    <progress class="progress is-info" value="${progress.percentage}" max="100"></progress>
                                    <div class="level is-mobile">
                                        <div class="level-left">
                                            <a href="/learn/${module.id}" class="button is-small is-primary">
                                                Continuar
                                            </a>
                                        </div>
                                        <div class="level-right">
                                            <span class="is-size-7">${progress.percentage}% concluído</span>
                                        </div>
                                    </div>
                                </div>
                            `;
                        }).join('')}
                    </div>
                ` : ''}
                </div>
            `;
    }
    
    checkAchievements() {
        // Verificar conquistas obtidas desde a última vez
        const previousAchievements = this.loadStoredAchievements();
        const currentAchievements = this.calculateAchievements();
        
        // Adicionar a flag 'notified' das conquistas anteriores
        currentAchievements.forEach(achievement => {
            const prevAchievement = previousAchievements.find(a => a.id === achievement.id);
            achievement.notified = prevAchievement ? !!prevAchievement.notified : false;
        });
        
        // Encontrar novas conquistas desbloqueadas que ainda não foram notificadas
        const newAchievements = currentAchievements.filter(achievement => 
            achievement.unlocked && !achievement.notified
        );
        
        // Marcar as novas conquistas como notificadas
        if (newAchievements.length > 0) {
            newAchievements.forEach(achievement => {
                achievement.notified = true;
            });
            
            // Mostrar notificações para as novas conquistas
            this.showAchievementToast(newAchievements);
        }
        
        // Salvar conquistas atualizadas
        this.saveAchievements(currentAchievements);
        
        // Atualizar a UI
        this.renderAchievements(currentAchievements);
    }
    
    loadStoredAchievements() {
        try {
            const saved = localStorage.getItem('learning_achievements');
            return saved ? JSON.parse(saved) : [];
        } catch (e) {
            console.error('Erro ao carregar conquistas salvas:', e);
            return [];
        }
    }

    async loadAchievements() {
        try {
            if (!this.achievementsContainer) return;
            
            // Calcular conquistas
            const achievements = this.calculateAchievements();
            
            // Renderizar conquistas
            this.renderAchievements(achievements);
            
            return achievements;
        } catch (error) {
            console.error('Erro ao carregar conquistas:', error);
            if (this.achievementsContainer) {
                    this.achievementsContainer.innerHTML = `
                    <div class="notification is-warning is-light">
                        Não foi possível carregar suas conquistas no momento.
                        </div>
                    `;
            }
            return [];
        }
    }
    
    saveAchievements(achievements) {
        try {
            localStorage.setItem('learning_achievements', JSON.stringify(
                achievements.map(a => ({id: a.id, unlocked: a.unlocked, notified: a.notified}))
            ));
        } catch (e) {
            console.error('Erro ao salvar conquistas:', e);
        }
    }
    
    calculateAchievements() {
        // Calcular estatísticas para conquistas
        const startedModules = Object.keys(this.userProgress).length;
        const completedModules = Object.values(this.userProgress)
            .filter(p => p.completed || (p.completed_pages === p.total_pages && p.total_pages > 0))
            .length;
        
        let totalPages = 0;
        let completedPages = 0;
        
        Object.values(this.userProgress).forEach(progress => {
            totalPages += progress.total_pages || 0;
            completedPages += progress.completed_pages || 0;
        });

        // Definir conquistas
        return [
            {
                id: 'first-module',
                name: 'Primeiro Passo',
                description: 'Comece seu primeiro módulo de aprendizado',
                icon: 'fas fa-flag-checkered',
                unlocked: startedModules > 0
            },
            {
                id: 'module-complete',
                name: 'Missão Cumprida',
                description: 'Complete seu primeiro módulo',
                icon: 'fas fa-trophy',
                unlocked: completedModules > 0
            },
            {
                id: 'first-favorite',
                name: 'Favorito',
                description: 'Adicione um módulo aos favoritos',
                icon: 'fas fa-star',
                unlocked: this.favorites.length > 0
            },
            {
                id: 'all-modules',
                name: 'Mestre do Conhecimento',
                description: 'Complete todos os módulos disponíveis',
                icon: 'fas fa-graduation-cap',
                unlocked: this.modules.length > 0 && completedModules === this.modules.length
            }
        ];
    }
    
    showAchievementToast(achievements) {
        achievements.forEach((achievement, index) => {
            setTimeout(() => {
                const toast = document.createElement('div');
                toast.className = 'notification is-success toast-notification achievement-toast';
                toast.innerHTML = `
                    <button class="delete"></button>
                    <div class="achievement-toast-content">
                        <span class="icon is-large">
                            <i class="${achievement.icon || 'fas fa-award'} fa-lg"></i>
                        </span>
                        <div>
                            <p class="has-text-weight-bold">Nova Conquista Desbloqueada!</p>
                            <p>${achievement.name}</p>
                            <p class="is-size-7">${achievement.description}</p>
                        </div>
                    </div>
                `;
                
                document.body.appendChild(toast);
                
                // Fechar toast ao clicar no X
                toast.querySelector('.delete').addEventListener('click', () => {
                    toast.remove();
                });
                
                // Auto-remover após 5 segundos
                setTimeout(() => {
                    toast.classList.add('fadeOut');
                    setTimeout(() => toast.remove(), 500);
                }, 5000);
            }, index * 1500); // Mostrar cada conquista com intervalo
        });
    }
    
    renderAchievements(achievements) {
        if (!this.achievementsContainer) return;

            this.achievementsContainer.innerHTML = achievements.map(achievement => `
            <div class="achievement-item mb-3 ${achievement.unlocked ? 'is-success' : ''}">
                    <span class="icon-text">
                        <span class="icon ${achievement.unlocked ? 'has-text-success' : 'has-text-grey'}">
                        <i class="${achievement.icon || 'fas fa-award'}"></i>
                        </span>
                        <span>${achievement.name}</span>
                    </span>
                    <p class="help">${achievement.description}</p>
                </div>
            `).join('');
    }

    showError(message) {
        const notification = document.createElement('div');
        notification.className = 'notification is-danger';
        notification.innerHTML = `
            <button class="delete"></button>
            ${message}
        `;
        
        notification.querySelector('.delete').addEventListener('click', () => {
            notification.remove();
        });
        
        document.querySelector('.container').prepend(notification);
    }

    setupFilters() {
        if (!this.filterContainer) return;
        
        // Filtros básicos (Favoritos e Concluídos)
        const basicFilters = `
            <div class="mb-4">
                <p class="has-text-weight-medium mb-2">Filtros</p>
                <div class="buttons">
                    <button class="button is-small filter-button" data-filter="favorites">
                        <span class="icon"><i class="fas fa-star"></i></span>
                        <span>Favoritos</span>
                    </button>
                    <button class="button is-small filter-button" data-filter="completed">
                        <span class="icon"><i class="fas fa-check-circle"></i></span>
                        <span>Concluídos</span>
                    </button>
                    <button class="button is-small filter-button" data-filter="in-progress">
                        <span class="icon"><i class="fas fa-spinner"></i></span>
                        <span>Em Progresso</span>
                    </button>
                </div>
            </div>
        `;
        
        // Filtros de palavras-chave
        let keywordsFilters = '';
        const allKeywords = this.getAllKeywords();
        
        if (allKeywords.length > 0) {
            keywordsFilters = `
                <div class="mb-4">
                    <p class="has-text-weight-medium mb-2">Palavras-chave</p>
                    <div class="tags">
                        ${allKeywords.map(keyword => 
                            `<span class="tag is-medium keyword-filter" data-filter="keyword" data-keyword="${keyword}">
                                ${keyword}
                            </span>`
                        ).join('')}
                    </div>
                </div>
            `;
        }
        
        // Adicionar filtros ao container
        this.filterContainer.innerHTML = basicFilters + keywordsFilters;
        
        // Adicionar event listeners
        document.querySelectorAll('.filter-button').forEach(button => {
            button.addEventListener('click', () => {
                const filter = button.dataset.filter;
                button.classList.toggle('is-primary');
                
                if (button.classList.contains('is-primary')) {
                    this.activeFilters.push(filter);
                } else {
                    const index = this.activeFilters.indexOf(filter);
                    if (index !== -1) {
                        this.activeFilters.splice(index, 1);
                    }
                }
                
                this.applyFilters();
            });
        });
        
        document.querySelectorAll('.keyword-filter').forEach(tag => {
            tag.addEventListener('click', () => {
                tag.classList.toggle('is-primary');
                this.applyFilters();
            });
        });
    }
    
    getAllKeywords() {
        // Extrair todas as palavras-chave de todos os módulos
        const keywordsSet = new Set();
        
        this.modules.forEach(module => {
            if (module.keywords && Array.isArray(module.keywords)) {
                module.keywords.forEach(keyword => keywordsSet.add(keyword));
            }
        });
        
        return Array.from(keywordsSet);
    }
    
    applyFilters() {
        const activeKeywords = Array.from(document.querySelectorAll('.keyword-filter.is-primary'))
            .map(tag => tag.dataset.keyword);
            
        // Começar com todos os módulos
        this.filteredModules = [...this.modules];
        
        // Aplicar filtros ativos
        if (this.activeFilters.includes('favorites')) {
            this.filteredModules = this.filteredModules.filter(module => 
                this.isFavorite(module.id)
            );
        }
        
        if (this.activeFilters.includes('completed')) {
            this.filteredModules = this.filteredModules.filter(module => 
                this.isModuleCompleted(module.id)
            );
        }
        
        if (this.activeFilters.includes('in-progress')) {
            this.filteredModules = this.filteredModules.filter(module => {
                const progress = this.getModuleProgress(module.id);
                return progress && progress.percentage > 0 && progress.percentage < 100;
            });
        }
        
        // Aplicar filtros de palavras-chave
        if (activeKeywords.length > 0) {
            this.filteredModules = this.filteredModules.filter(module => {
                if (!module.keywords || !Array.isArray(module.keywords)) return false;
                return activeKeywords.some(keyword => module.keywords.includes(keyword));
            });
        }
        
        // Renderizar módulos filtrados
        this.renderModules();
    }
}

// Inicializar quando o DOM estiver pronto
document.addEventListener('DOMContentLoaded', () => {
    // Verificar se o usuário está autenticado
    if (!localStorage.getItem('auth_token')) {
        console.warn('Usuário não autenticado. Redirecionando para login...');
        window.location.href = '/pages/login.html';
        return;
    }
    
    console.log('Inicializando Central de Aprendizado...');
    const learningCenter = new LearningCenter();
    
    // Disponibilizar globalmente para depuração e para os botões de favorito
    window.learningCenter = learningCenter;
}); 