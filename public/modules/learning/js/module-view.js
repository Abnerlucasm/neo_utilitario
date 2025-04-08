class ModuleView {
    constructor() {
        // Extrair ID do módulo da URL
        // Primeiro tentar obter da query string
        const urlParams = new URLSearchParams(window.location.search);
        let moduleId = urlParams.get('id');
        
        // Se não tiver na query string, tentar extrair do path
        if (!moduleId) {
            const pathParts = window.location.pathname.split('/');
            const potentialId = pathParts[pathParts.length - 1];
            // Verificar se é um UUID válido
            if (potentialId && potentialId.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
                moduleId = potentialId;
            }
        }
        
        this.moduleId = moduleId;
        this.content = {};
        this.sections = [];
        this.currentPageId = null;
        this.currentSectionIndex = 0;
        this.searchInput = document.getElementById('searchInput');
        this.searchResults = null;
        this.userProgress = {};
        this.inPageSearch = null; // Armazenar estado da busca na página atual
        
        this.pageHistory = [];
        this.historyIndex = -1;
        
        // Elementos do DOM
        this.moduleName = document.getElementById('moduleName');
        this.pageContent = document.getElementById('pageContent');
        this.searchResultsContainer = document.getElementById('searchResults');
        this.sectionsContainer = document.getElementById('moduleSections');
    }

    async init() {
        try {
            // Get the module ID from the URL
            this.moduleId = new URLSearchParams(window.location.search).get('id');
            if (!this.moduleId) {
                this.showError('ID do módulo não especificado');
                return;
            }
            
            // Load the module content
            await this.loadModule();
            
            // Check if the user is an admin
            await this.checkIfUserIsAdmin();
            
            // Load user progress
            await this.loadUserProgress();
            
            // Setup the UI interactions
            this.setupNavigation();
            this.setupSearch();
            
            // Setup completion message observer
            this.setupCompletionMessageObserver();
            
            // Render sections and content
            this.render();
            
            // Apply syntax highlighting
            this.applySyntaxHighlighting();
            
            // Mark the module as started
            if (!this.moduleStarted) {
                await this.markModuleAsStarted();
            }
        } catch (error) {
            console.error('Error initializing module view:', error);
            this.showError('Erro ao carregar o módulo');
        }
    }

    async loadModule() {
        try {
            console.log(`Carregando módulo ${this.moduleId}`);
            
            if (!this.moduleId) {
                throw new Error('ID do módulo não encontrado na URL');
            }
            
            // Buscar dados do módulo
            const response = await fetch(`/api/learning/modules/${this.moduleId}`, {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('auth_token')}`,
                    'Accept': 'application/json'
                }
            });
            
            if (!response.ok) {
                let errorMessage = `Erro ao carregar o módulo: ${response.status}`;
                try {
                    const errorData = await response.json();
                    errorMessage = errorData.error || errorData.message || errorMessage;
                } catch (e) {
                    // Ignorar erro de parsing
                }
                throw new Error(errorMessage);
            }
            
            const module = await response.json();
            
            console.log('Dados do módulo carregados:', {
                id: module.id,
                title: module.title,
                sections: Array.isArray(module.sections) ? module.sections.length : 'não é array',
                contentKeys: module.content ? Object.keys(module.content).length : 'sem conteúdo'
            });
            
            // Verificar se o módulo tem o formato esperado
            if (!module || typeof module !== 'object') {
                throw new Error('Formato de módulo inválido');
            }
            
            // Extrair dados do módulo com verificações de segurança
            this.moduleTitle = module.title || 'Módulo sem título';
            this.sections = Array.isArray(module.sections) ? module.sections : [];
            this.content = typeof module.content === 'object' ? module.content || {} : {};
            
            // Inicializar conteúdo vazio se for null ou undefined
            if (!this.content) {
                this.content = {};
            }
            
            // Atualizar o título na página
            document.title = this.moduleTitle + ' | Módulo de Aprendizagem';
            if (this.moduleName) {
                this.moduleName.textContent = this.moduleTitle;
            }
            
            console.log('Seções carregadas:', this.sections);
            console.log('Conteúdo carregado:', this.content);
            
            // Verificar consistência entre seções e conteúdo
            let totalPages = 0;
            let validPages = 0;
            let firstPageId = null;
            
            for (const section of this.sections) {
                if (Array.isArray(section.pages)) {
                    totalPages += section.pages.length;
                    
                    for (const pageId of section.pages) {
                        if (typeof pageId === 'string') {
                            // Se não tivermos o conteúdo para este pageId, inicializar com valor default
                            if (!this.content[pageId]) {
                                this.content[pageId] = {
                                    id: pageId,
                                    title: 'Página sem título',
                                    content: 'Conteúdo não disponível',
                                    description: ''
                                };
                            }
                            
                            // Armazenar o primeiro pageId válido encontrado
                            if (!firstPageId) {
                                firstPageId = pageId;
                            }
                            
                            validPages++;
                        }
                    }
                }
            }
            
            console.log(`Verificação de consistência: ${validPages}/${totalPages} páginas válidas`);
            
            // Se encontramos uma página válida, exibi-la
            if (firstPageId) {
                // Obter ID da página da URL se disponível
                const urlParams = new URLSearchParams(window.location.search);
                const pageFromUrl = urlParams.get('page');
                
                // Mostrar página específica da URL ou a primeira página
                const pageToShow = pageFromUrl || firstPageId;
                console.log(`Exibindo página: ${pageToShow}`);
                
                // Esperar um momento para garantir que o DOM está pronto
                setTimeout(() => {
                    this.showPage(pageToShow);
                }, 100);
            } else if (totalPages > 0) {
                console.warn('Nenhuma página válida encontrada no módulo. Possível desalinhamento entre seções e conteúdo.');
                this.showError('Este módulo não possui páginas válidas. Entre em contato com o administrador.');
            } else {
                this.showError('Este módulo está vazio. Entre em contato com o administrador.');
            }
            
            return true;
        } catch (error) {
            console.error('Erro ao carregar módulo:', error);
            this.showError('Erro ao inicializar visualização: ' + error.message);
            return false;
        }
    }

    /**
     * Carrega o progresso do usuário para este módulo
     */
    async loadUserProgress() {
        try {
            // Verificar se há token de autenticação
            const token = localStorage.getItem('auth_token');
            if (!token) {
                console.warn('Usuário não autenticado, progresso não será carregado');
                return;
            }
            
            // Buscar progresso específico para este módulo
            const response = await fetch(`/api/progress/modules/${this.moduleId}`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            
            if (!response.ok) {
                throw new Error(`Erro ao carregar progresso: ${response.status}`);
            }
            
            const progress = await response.json();
            
            // Processar progresso
            this.userProgress = progress;
            this.readPages = Array.isArray(progress.readPages) ? progress.readPages : [];
            this.moduleStarted = progress.started || this.readPages.length > 0;
            this.moduleCompleted = progress.completed || false;
            
            // Renderizar progresso
            this.renderProgress();
            
            console.log('Progresso do usuário carregado:', progress);
        } catch (error) {
            console.warn('Erro ao carregar progresso do usuário:', error);
            this.userProgress = {
                readPages: []
            };
            this.readPages = [];
        }
    }

    /**
     * Renderiza a barra de progresso do módulo
     */
    renderProgress() {
        const progressContainer = document.querySelector('.progress-container');
        if (!progressContainer) return;
        
        // Contar total de páginas no módulo
        let totalPages = 0;
        if (Array.isArray(this.sections)) {
            for (const section of this.sections) {
                if (section && Array.isArray(section.pages)) {
                    totalPages += section.pages.length;
                }
            }
        }
        
        // Contar páginas lidas
        const readPagesCount = Array.isArray(this.readPages) ? this.readPages.length : 0;
        
        // Calcular percentual
        const percentage = totalPages > 0 ? Math.round((readPagesCount / totalPages) * 100) : 0;
        
        // Renderizar barra de progresso
        progressContainer.innerHTML = `
            <div class="columns is-vcentered">
                <div class="column is-9">
                    <progress class="progress is-info" value="${percentage}" max="100"></progress>
                </div>
                <div class="column is-3 has-text-right">
                    ${readPagesCount} de ${totalPages} páginas
                    <br>
                    <strong>${percentage}% concluído</strong>
                </div>
            </div>
        `;
        
        // Atualizar marcadores de páginas lidas no menu lateral
        this.updateReadPageMarkers();
    }
    
    /**
     * Atualiza os marcadores de páginas lidas no menu lateral
     */
    updateReadPageMarkers() {
        if (!Array.isArray(this.readPages)) return;
        
        // Atualizar ícones de páginas lidas
        const pageLinks = document.querySelectorAll('.menu-list a[data-page-id]');
        pageLinks.forEach(link => {
            const pageId = link.getAttribute('data-page-id');
            const iconSpan = link.querySelector('.icon');
            
            if (this.readPages.includes(pageId)) {
                // Se a página foi lida, mostrar ícone de check
                if (!iconSpan) {
                    const newIcon = document.createElement('span');
                    newIcon.className = 'icon';
                    newIcon.innerHTML = '<i class="fas fa-check"></i>';
                    link.appendChild(newIcon);
                }
            } else {
                // Se a página não foi lida, remover ícone se existir
                if (iconSpan) {
                    iconSpan.remove();
                }
            }
        });
    }

    async markModuleAsStarted() {
        try {
            // Enviar progresso inicial para o módulo para marcá-lo como "iniciado"
            const response = await fetch(`/api/progress/modules/${this.moduleId}/start`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    started: true
                })
            });
            
            if (!response.ok) {
                throw new Error('Erro ao registrar início do módulo');
            }
            
            console.log('Módulo marcado como iniciado');
            return true;
        } catch (error) {
            console.error('Erro ao marcar módulo como iniciado:', error);
            return false;
        }
    }

    async markPageAsRead(pageId) {
        if (!pageId) return false;
        
        try {
            const response = await fetch(`/api/progress/modules/${this.moduleId}/pages/${pageId}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                }
            });
            
            if (!response.ok) {
                throw new Error('Erro ao registrar progresso');
            }
            
            // Atualizar progresso local
            const updatedProgress = await response.json();
            this.userProgress = { ...this.userProgress, ...updatedProgress };
            
            // Atualizar barra de progresso
            this.renderProgress();
            
            // Verificar se o módulo foi completado
            if (updatedProgress.completed) {
                this.showCompletionMessage();
            }
            
            return true;
            } catch (error) {
            console.error('Erro ao marcar página como lida:', error);
            return false;
        }
    }

    showPage(pageId) {
        // Verificar se o pageId está presente no content
        if (!this.content[pageId]) {
            console.error(`Page id ${pageId} not found in content`);
            this.showEmptyContent('A página não foi encontrada');
            return;
        }
        
        this.currentPage = pageId;
        
        // Obter a página do conteúdo
        const page = this.content[pageId];
        
        // Atualizar o título da página
        document.title = `${page.title} | ${this.moduleName}`;
        
        // Renderizar conteúdo
        const contentElement = document.getElementById('pageContent');
        const content = page.content || 'Sem conteúdo';
        contentElement.innerHTML = this.renderMarkdown(content);
        
        // Aplicar syntax highlighting
        this.applySyntaxHighlighting();
        
        // Atualizar navegação
        this.updateNavigation(pageId);
        
        // Atualizar URL
        this.updateURL(pageId);
        
        // Iniciar temporizador de leitura
        this.startPageReadingTimer(pageId);
        
        // Resetar variáveis de busca
        this.clearInPageSearch();
        
        // Esconder resultados de pesquisa
        document.getElementById('searchResults').style.display = 'none';
        
        // Verificar se deve mostrar mensagem de conclusão (para páginas pequenas)
        if (this.checkScrollPosition) {
            setTimeout(this.checkScrollPosition, 500);
        }
    }

    showCompletionMessage() {
        // Mostrar mensagem de parabéns quando o módulo for concluído
        const notification = document.createElement('div');
        notification.className = 'notification is-success is-light';
        notification.innerHTML = `
            <button class="delete"></button>
            <div class="has-text-centered">
                <p class="title is-4">Parabéns!</p>
                <p class="subtitle is-6">Você completou este módulo de aprendizado.</p>
                <p>Continue explorando outros módulos para ampliar seus conhecimentos.</p>
                <a href="/learn" class="button is-primary mt-3">
                    <span class="icon"><i class="fas fa-graduation-cap"></i></span>
                    <span>Ver todos os módulos</span>
                </a>
            </div>
        `;
        
        // Adicionar a notificação após o conteúdo da página
        this.pageContent.appendChild(notification);
        
        // Permitir fechar a notificação
        notification.querySelector('.delete').addEventListener('click', () => {
            notification.remove();
        });

        // Rolar para a notificação
        notification.scrollIntoView({ behavior: 'smooth' });
    }

    setupSearch() {
        const searchInput = document.getElementById('searchInput');
        const searchResults = document.getElementById('searchResults');
        const pageContent = document.getElementById('pageContent');

        if (!searchInput || !searchResults || !pageContent) return;

        let debounceTimer;

        searchInput.addEventListener('input', (event) => {
            clearTimeout(debounceTimer);
            debounceTimer = setTimeout(() => {
                const query = event.target.value.trim();
                this.handleSearch(query);
            }, 300);
        });
        
        // Adicionar suporte para teclas de atalho
        searchInput.addEventListener('keydown', (event) => {
            // Enter para iniciar busca ou navegar entre resultados
            if (event.key === 'Enter') {
                event.preventDefault();
                const query = searchInput.value.trim();
                
                if (query) {
                    // Se já estiver em um modo de busca na página
                    if (this.inPageSearch) {
                        // Navegar para o próximo resultado (shift+enter navega para trás)
                        this.navigateSearch(event.shiftKey ? 'prev' : 'next');
                    } else {
                        // Iniciar busca
                        this.handleSearch(query);
                    }
                }
            }
            
            // Escape para cancelar busca
            if (event.key === 'Escape') {
                searchInput.value = '';
                this.clearInPageSearch();
                searchResults.style.display = 'none';
                pageContent.style.display = 'block';
            }
            
            // F3 para navegar entre resultados
            if (event.key === 'F3') {
                event.preventDefault();
                if (this.inPageSearch) {
                    this.navigateSearch(event.shiftKey ? 'prev' : 'next');
                }
            }
        });
        
        // Adicionar atalho global Ctrl+F para focar na busca
        document.addEventListener('keydown', (event) => {
            if ((event.ctrlKey || event.metaKey) && event.key === 'f') {
                // Impedir o comportamento padrão do navegador
                event.preventDefault();
                
                // Focar no input de busca
                searchInput.focus();
                
                // Se já houver texto no input, selecionar tudo
                if (searchInput.value.trim()) {
                    searchInput.select();
                }
            }
        });
    }

    async handleSearch(query) {
        const searchResults = document.getElementById('searchResults');
        const pageContent = document.getElementById('pageContent');

        if (!query) {
            searchResults.style.display = 'none';
            pageContent.style.display = 'block';
            this.clearInPageSearch();
            return;
        }

        try {
            // Se a consulta for muito curta (menos de 3 caracteres), verificar primeiro se há 
            // ocorrências na página atual antes de buscar em todo o módulo
            if (query.length < 3 && this.currentPageId) {
                const inPageResults = this.searchInCurrentPage(query);
                if (inPageResults.total > 0) {
                    // Temos resultados na página atual, não precisamos procurar em outras páginas
                    searchResults.style.display = 'none';
                    pageContent.style.display = 'block';
                    return;
                }
            }

            // Limpar qualquer destaque anterior
            this.clearInPageSearch();
            
            // Buscar localmente primeiro (mais rápido)
            const localResults = this.searchLocalContent(query);
            
            // Exibir resultados locais imediatamente
            if (localResults.length > 0) {
                this.renderSearchResults(localResults);
                return;
            }
            
            // Se não encontrar resultados localmente, fazer uma busca no servidor
            const response = await fetch(`/api/learning/search?moduleId=${this.moduleId}&query=${encodeURIComponent(query)}`);
            if (!response.ok) throw new Error('Erro na busca');
            
            const results = await response.json();
            this.renderSearchResults(results);
        } catch (error) {
            console.error('Erro ao buscar:', error);
            searchResults.innerHTML = `
                <div class="notification is-danger">
                    Erro ao realizar a busca. Tente novamente.
                </div>
            `;
            searchResults.style.display = 'block';
            pageContent.style.display = 'none';
        }
    }
    
    /**
     * Realiza busca local no conteúdo do módulo
     * @param {string} query - Termo de busca
     * @returns {Array} - Resultados da busca
     */
    searchLocalContent(query) {
        console.log('Realizando busca local por:', query);
        
        if (!query || query.length < 2) return [];
        
        const results = [];
        const searchTerms = query.toLowerCase().split(' ').filter(term => term.length > 1);
        
        if (searchTerms.length === 0) return [];
        
        // Buscar em todas as seções e páginas
        for (const section of this.sections) {
            const sectionTitle = section.title || 'Sem título';
            
            for (const pageId of section.pages) {
                if (typeof pageId !== 'string') continue;
                
                const page = this.content[pageId];
                if (!page) continue;
                
                const pageTitle = page.title || 'Sem título';
                const pageContent = page.content || '';
                const pageKeywords = Array.isArray(page.keywords) ? page.keywords : [];
                
                const searchableText = `${pageTitle} ${pageContent}`.toLowerCase();
                
                // Verificar se algum termo de busca está presente no texto ou keywords
                const textMatches = searchTerms.filter(term => searchableText.includes(term));
                const keywordMatches = searchTerms.filter(term => 
                    pageKeywords.some(keyword => keyword.toLowerCase().includes(term))
                );
                
                const matches = [...new Set([...textMatches, ...keywordMatches])];
                
                if (matches.length > 0) {
                    // Encontrar trecho relevante para exibição
                    let excerpt = '';
                    const mainMatch = matches[0];
                    
                    // Primeiro tentar encontrar o match em keywords (prioridade)
                    if (keywordMatches.length > 0) {
                        const matchingKeywords = pageKeywords.filter(keyword => 
                            keywordMatches.some(term => keyword.toLowerCase().includes(term))
                        );
                        excerpt = `Palavras-chave: ${matchingKeywords.join(', ')}`;
                        
                        // Se também houver match no conteúdo, adicionar
                        if (textMatches.length > 0) {
                            const contentExcerpt = this.extractExcerpt(pageContent, textMatches[0], 100);
                            if (contentExcerpt) {
                                excerpt += `\n${contentExcerpt}`;
                            }
                        }
                    } else {
                        // Se não houver match em keywords, usar o conteúdo
                        excerpt = this.extractExcerpt(pageContent, mainMatch, 150);
                    }
                    
                    results.push({
                        pageId,
                        title: pageTitle,
                        section: sectionTitle,
                        excerpt: excerpt || 'Sem conteúdo',
                        matches,
                        hasKeywordMatch: keywordMatches.length > 0,
                        keywords: pageKeywords
                    });
                }
            }
        }
        
        // Ordenar resultados: primeiro os que têm match em keywords, depois por número de matches
        results.sort((a, b) => {
            if (a.hasKeywordMatch && !b.hasKeywordMatch) return -1;
            if (!a.hasKeywordMatch && b.hasKeywordMatch) return 1;
            return b.matches.length - a.matches.length;
        });
        
        return results;
    }
    
    /**
     * Extrai um trecho do texto ao redor do termo encontrado
     * @param {string} text - Texto completo 
     * @param {string} term - Termo de busca
     * @param {number} length - Tamanho aproximado do trecho
     * @returns {string} - Trecho extraído
     */
    extractExcerpt(text, term, length = 150) {
        if (!text || !term) return '';
        
        try {
            const lowerText = text.toLowerCase();
            const index = lowerText.indexOf(term.toLowerCase());
            
            if (index === -1) return text.substring(0, length);
            
            const halfLength = Math.floor(length / 2);
            const start = Math.max(0, index - halfLength);
            const end = Math.min(text.length, index + term.length + halfLength);
            
            let excerpt = text.substring(start, end);
            
            // Adicionar elipses se necessário
            if (start > 0) excerpt = '...' + excerpt;
            if (end < text.length) excerpt = excerpt + '...';
            
            return excerpt;
        } catch (error) {
            console.error('Erro ao extrair trecho:', error);
            return '';
        }
    }

    renderSearchResults(results) {
        const searchResults = document.getElementById('searchResults');
        const pageContent = document.getElementById('pageContent');

        if (!results.length) {
            searchResults.innerHTML = `
                <div class="notification is-warning">
                    Nenhum resultado encontrado.
                </div>
            `;
            searchResults.style.display = 'block';
            pageContent.style.display = 'none';
            return;
        }

        searchResults.innerHTML = `
            <h3 class="title is-4">Resultados da busca</h3>
            <div class="search-results-list">
                ${results.map(result => `
                    <div class="box">
                        <h4 class="title is-5">
                            <a href="#${result.pageId}" data-page="${result.pageId}">
                                ${result.title}
                            </a>
                        </h4>
                        <p class="subtitle is-6">${result.section}</p>
                        ${result.keywords && result.keywords.length > 0 ? 
                            `<div class="tags">
                                ${result.keywords.map(keyword => 
                                    `<span class="tag is-info is-light">${keyword}</span>`
                                ).join('')}
                            </div>` : 
                            ''
                        }
                        <div class="content">
                            ${this.highlightMatches(result.excerpt, result.matches)}
                        </div>
                    </div>
                `).join('')}
            </div>
        `;

        searchResults.style.display = 'block';
        pageContent.style.display = 'none';

        // Adicionar event listeners aos resultados
        searchResults.querySelectorAll('[data-page]').forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const pageId = link.dataset.page;
                this.showPage(pageId);
                searchResults.style.display = 'none';
                pageContent.style.display = 'block';
                document.getElementById('searchInput').value = '';
            });
        });
    }

    highlightMatches(text, matches) {
        let highlighted = text;
        matches.forEach(match => {
            const regex = new RegExp(match, 'gi');
            highlighted = highlighted.replace(regex, `<mark>${match}</mark>`);
        });
        return highlighted;
    }

    setupNavigation() {
        // Verificar se existe o container para a navegação
        const contentArea = document.querySelector('.content-area');
        if (!contentArea) {
            console.warn('Container .content-area não encontrado para navegação');
            return;
        }
        
        const navContainer = document.createElement('div');
        navContainer.className = 'navigation-buttons mt-4';
        navContainer.innerHTML = `
            <button class="button" id="prevPage" disabled>
                <span class="icon"><i class="fas fa-chevron-left"></i></span>
                <span>Anterior</span>
            </button>
            <button class="button" id="nextPage" disabled>
                <span>Próxima</span>
                <span class="icon"><i class="fas fa-chevron-right"></i></span>
            </button>
        `;
        
        contentArea.appendChild(navContainer);
        
        const prevBtn = document.getElementById('prevPage');
        const nextBtn = document.getElementById('nextPage');
        
        if (prevBtn) {
            prevBtn.addEventListener('click', () => this.navigate('prev'));
        }
        
        if (nextBtn) {
            nextBtn.addEventListener('click', () => this.navigate('next'));
        }
    }

    navigate(direction) {
        let currentIndex = -1;
        const allPages = this.getAllPages();
        
        if (this.currentPageId) {
            currentIndex = allPages.indexOf(this.currentPageId);
        }

        if (direction === 'prev' && currentIndex > 0) {
            this.showPage(allPages[currentIndex - 1]);
        } else if (direction === 'next' && currentIndex < allPages.length - 1) {
            this.showPage(allPages[currentIndex + 1]);
        }
    }

    getAllPages() {
        return this.sections.reduce((pages, section) => {
            return pages.concat(section.pages);
        }, []);
    }

    updateNavigationButtons() {
        const allPages = this.getAllPages();
        const currentIndex = allPages.indexOf(this.currentPageId);
        
        const prevBtn = document.getElementById('prevPage');
        const nextBtn = document.getElementById('nextPage');
        
        if (prevBtn) {
            prevBtn.disabled = currentIndex <= 0;
        }
        
        if (nextBtn) {
            nextBtn.disabled = currentIndex >= allPages.length - 1;
        }
    }

    async createPageContent(pageId, section) {
        try {
            // Mostrar indicador de carregamento
            const contentArea = document.querySelector('.content-area');
            if (contentArea) {
                contentArea.innerHTML = `
                    <div class="notification is-info">
                        <p>Criando conteúdo para a página...</p>
                        <progress class="progress is-small is-primary mt-2"></progress>
                    </div>
                `;
            }
            
            // Obter o módulo atual
            const response = await fetch(`/api/learning/modules/${this.moduleId}`);
            if (!response.ok) {
                throw new Error('Não foi possível carregar o módulo');
            }
            
            const module = await response.json();
            const updatedModule = {
                ...module,
                content: { ...module.content } || {}
            };
            
            // Criar conteúdo para a página
            const sectionTitle = section ? section.title : 'Sem seção';
            updatedModule.content[pageId] = {
                title: `Nova Página - ${sectionTitle}`,
                content: `# Nova Página - ${sectionTitle}\n\nEste é um conteúdo padrão criado automaticamente. Você pode editar esta página para adicionar seu próprio conteúdo.`
            };
            
            // Salvar o módulo atualizado
            const saveResponse = await fetch(`/api/learning/modules/${this.moduleId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    content: updatedModule.content
                })
            });
            
            if (!saveResponse.ok) {
                const error = await saveResponse.json();
                throw new Error(`Erro ao salvar página: ${error.error || error.details || saveResponse.status}`);
            }
            
            // Recarregar a página para mostrar o novo conteúdo
            window.location.reload();
            
        } catch (error) {
            console.error('Erro ao criar conteúdo da página:', error);
            this.showError(`Não foi possível criar o conteúdo da página: ${error.message}`);
        }
    }

    render() {
        console.log('Renderizando o conteúdo do módulo');
        
        // Renderizar seções na barra lateral
        this.renderSections();
        
        // Verificar se há seções e páginas para mostrar
        if (this.sections.length > 0) {
            const firstSection = this.sections[0];
            
            if (Array.isArray(firstSection.pages) && firstSection.pages.length > 0) {
                // Obter a primeira página válida (que deve ser uma string ou número)
                const validPages = firstSection.pages.filter(
                    pageId => typeof pageId === 'string' || typeof pageId === 'number'
                );
                
                if (validPages.length > 0) {
                    const firstPageId = String(validPages[0]);
                    console.log('Mostrando a primeira página:', firstPageId);
                    
                    // Verificar se a página existe no conteúdo
                    if (this.content[firstPageId]) {
                        this.showPage(firstPageId);
                    } else {
                        console.warn(`A primeira página (${firstPageId}) não foi encontrada no conteúdo`);
                        this.showEmptyContent('A primeira página não foi encontrada no conteúdo deste módulo.');
                    }
                } else {
                    console.warn('A primeira seção não tem páginas válidas');
                    this.showEmptyContent('Esta seção não contém páginas válidas.');
                }
            } else {
                console.warn('A primeira seção não tem páginas');
                this.showEmptyContent('Esta seção não tem páginas.');
            }
        } else {
            console.warn('Não há seções para mostrar');
            this.showEmptyContent('Este módulo ainda não tem conteúdo definido.');
        }
    }

    renderSections() {
        const container = document.getElementById('moduleSections');
        if (!container) {
            console.error('Elemento moduleSections não encontrado');
            return;
        }

        console.log('Renderizando seções:', this.sections.length);

        if (!this.sections || this.sections.length === 0) {
            container.innerHTML = '<li><div class="notification is-warning is-light">Nenhuma seção encontrada</div></li>';
            return;
        }

        const sectionsHTML = this.sections.map(section => {
            // Verificar se a seção tem o formato esperado
            if (!section || typeof section !== 'object') {
                console.warn('Formato de seção inválido:', section);
                return '';
            }

            const sectionTitle = section.title || 'Sem título';
            let pages = [];
            
            // Garantir que pages seja um array válido
            if (Array.isArray(section.pages)) {
                // Filtrar apenas os pageIds que são strings válidas
                pages = section.pages.filter(pageId => {
                    if (typeof pageId !== 'string' && typeof pageId !== 'number') {
                        console.warn(`Ignorando pageId inválido na seção "${sectionTitle}":`, pageId);
                        return false;
                    }
                    return true;
                });
            } else {
                console.warn(`Seção "${sectionTitle}" não tem um array de páginas válido:`, section.pages);
            }
            
            console.log(`Renderizando seção "${sectionTitle}" com ${pages.length} páginas válidas`);

            return `
                <li>
                    <p class="menu-label">${sectionTitle}</p>
                <ul class="menu-list">
                        ${pages.map(pageId => {
                            // Converter para string para garantir consistência
                            const pageIdStr = String(pageId);
                            // Verificar se a página existe no content
                            const pageExists = this.content[pageIdStr] !== undefined;
                            const pageTitle = pageExists ? (this.content[pageIdStr].title || 'Sem título') : 'Página não encontrada';
                            const isActive = this.currentPageId === pageIdStr;
                            const isCompleted = this.userProgress.completed_pages?.includes(pageIdStr);
                            
                            return `
                                <li>
                                    <a class="${isActive ? 'is-active' : ''} ${!pageExists ? 'has-text-danger' : ''}"
                                       data-page="${pageIdStr}"
                                       href="#${pageIdStr}">
                                        ${pageTitle}
                                        ${isCompleted ? 
                                    '<span class="icon"><i class="fas fa-check"></i></span>' : 
                                    ''}
                                        ${!pageExists ? 
                                            '<span class="icon"><i class="fas fa-exclamation-triangle"></i></span>' : 
                                            ''}
                            </a>
                        </li>
                            `;
                        }).join('')}
                </ul>
            </li>
            `;
        }).filter(Boolean).join('');

        if (sectionsHTML) {
            container.innerHTML = sectionsHTML;
        } else {
            container.innerHTML = '<li><div class="notification is-warning is-light">Não foi possível renderizar as seções</div></li>';
        }

        // Adicionar event listeners para os links das páginas
        container.querySelectorAll('[data-page]').forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const pageId = link.dataset.page;
                this.showPage(pageId);
            });
        });
    }

    showEmptyContent(message) {
        const contentArea = document.querySelector('.content-area');
        if (contentArea) {
            // Verificar se o usuário é administrador
            const isAdmin = this.checkIfUserIsAdmin();
            
            // Construir botões com base nas permissões
            let buttonsHTML = `
                <div class="buttons mt-4">
                    <button class="button is-primary create-content-btn">
                        <span class="icon"><i class="fas fa-plus"></i></span>
                        <span>Criar Conteúdo Inicial</span>
                    </button>
            `;
            
            // Adicionar botão de editor apenas para admins
            if (isAdmin) {
                buttonsHTML += `
                    <a href="/admin/learning/module/content/${this.moduleId}" class="button is-info">
                        <span class="icon"><i class="fas fa-edit"></i></span>
                        <span>Abrir Editor Completo</span>
                    </a>
                `;
            }
            
            buttonsHTML += `</div>`;
            
            contentArea.innerHTML = `
                <div class="notification is-info is-light">
                    <p>${message}</p>
                    <p class="mt-2">Use o editor de conteúdo para adicionar seções e páginas.</p>
                    
                    ${buttonsHTML}
                </div>
            `;
            
            // Adicionar listener ao botão de criar conteúdo
            const createContentBtn = contentArea.querySelector('.create-content-btn');
            if (createContentBtn) {
                createContentBtn.addEventListener('click', () => this.createInitialContent());
            }
        }
    }

    async createInitialContent() {
        try {
            // Mostrar indicador de carregamento
            const contentArea = document.querySelector('.content-area');
            if (contentArea) {
                contentArea.innerHTML = `
                    <div class="notification is-info">
                        <p>Criando conteúdo inicial...</p>
                        <progress class="progress is-small is-primary mt-2"></progress>
                    </div>
                `;
            }
            
            // Obter o módulo atual
            const response = await fetch(`/api/learning/modules/${this.moduleId}`);
            if (!response.ok) {
                throw new Error('Não foi possível carregar o módulo');
            }
            
            const module = await response.json();
            
            // Inicializar o conteúdo e seções se necessário
            const updatedModule = {
                ...module,
                content: module.content || {},
                sections: Array.isArray(module.sections) ? module.sections : []
            };
            
            // Verificar se já existem seções
            if (updatedModule.sections.length === 0) {
                // Criar uma seção padrão
                const sectionId = this.generateId();
                updatedModule.sections.push({
                    id: sectionId,
                    title: 'Introdução',
                    pages: []
                });
                
                // Criar algumas páginas padrão
                const pageTemplates = [
                    {
                        title: 'Bem-vindo',
                        content: `# Bem-vindo\n\nEste é o início do módulo "${module.title}". Aqui você encontrará informações importantes sobre este conteúdo.`
                    },
                    {
                        title: 'Objetivos',
                        content: `# Objetivos\n\nAo concluir este módulo, você terá aprendido:\n\n- Conceito básico\n- Aplicações práticas\n- Técnicas avançadas`
                    },
                    {
                        title: 'Conteúdo',
                        content: `# Conteúdo\n\nEste módulo está organizado em seções que abordam diferentes aspectos do tema principal.`
                    }
                ];
                
                // Adicionar as páginas à seção e ao conteúdo
                pageTemplates.forEach(template => {
                    const pageId = this.generateId();
                    updatedModule.sections[0].pages.push(pageId);
                    updatedModule.content[pageId] = template;
                });
            } else {
                // Verificar e criar conteúdo para páginas que não existem
                updatedModule.sections.forEach(section => {
                    if (Array.isArray(section.pages)) {
                        section.pages.forEach(pageId => {
                            // Se a página não existir no conteúdo, criar conteúdo padrão
                            if (!updatedModule.content[pageId]) {
                                updatedModule.content[pageId] = {
                                    title: `Nova Página - ${section.title}`,
                                    content: `# Nova Página - ${section.title}\n\nEste é um conteúdo padrão criado automaticamente. Você pode editar esta página para adicionar seu próprio conteúdo.`
                                };
                            }
                        });
                    }
                });
            }
            
            // Salvar o módulo atualizado
            const saveResponse = await fetch(`/api/learning/modules/${this.moduleId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    content: updatedModule.content,
                    sections: updatedModule.sections
                })
            });
            
            if (!saveResponse.ok) {
                const error = await saveResponse.json();
                throw new Error(`Erro ao salvar módulo: ${error.error || error.details || saveResponse.status}`);
            }
            
            // Recarregar a página para mostrar o novo conteúdo
            window.location.reload();
            
        } catch (error) {
            console.error('Erro ao criar conteúdo inicial:', error);
            this.showError(`Não foi possível criar o conteúdo inicial: ${error.message}`);
        }
    }
    
    generateId() {
        return 'id_' + Math.random().toString(36).substr(2, 9);
    }

    showError(message) {
        const contentArea = document.getElementById('pageContent');
        if (contentArea) {
            contentArea.innerHTML = `
                <div class="notification is-danger">
                    <p>${message}</p>
                    <button class="button is-light mt-2" onclick="location.reload()">
                        Tentar novamente
                    </button>
                </div>
            `;
        }
    }

    /**
     * Verifica se o usuário atual é um administrador
     * @returns {boolean} True se o usuário for admin, false caso contrário
     */
    checkIfUserIsAdmin() {
        // Verificar se há um token no localStorage
        const token = localStorage.getItem('auth_token');
        if (!token) return false;
        
        try {
            // Tentar decodificar o token (simplificado, apenas para verificação básica)
            // Isso assume que o token JWT tem a estrutura padrão header.payload.signature
            const parts = token.split('.');
            if (parts.length !== 3) return false;
            
            // Decodificar a parte do payload
            const payload = JSON.parse(atob(parts[1]));
            
            // Verificar se o usuário tem o campo role como 'admin'
            return payload && payload.role === 'admin';
        } catch (error) {
            console.error('Erro ao verificar permissões de administrador:', error);
            return false;
        }
    }

    // Método para renderizar conteúdo markdown
    renderMarkdown(content) {
        if (!content) return '<div class="notification is-warning">Esta página não possui conteúdo.</div>';
        
        try {
            // Configurar o marked para melhor segurança e funcionalidade
            marked.setOptions({
                breaks: true,
                gfm: true,
                headerIds: true,
                sanitize: false // A sanitização é tratada via DOMPurify
            });
            
            // Renderizar markdown para HTML
            const htmlContent = marked.parse(content);
            
            // Verificar se DOMPurify está disponível, se não, implementar uma sanitização básica
            let sanitizedHtml = htmlContent;
            if (typeof DOMPurify !== 'undefined') {
                // Sanitizar o HTML usando DOMPurify
                sanitizedHtml = DOMPurify.sanitize(htmlContent, {
                    ADD_ATTR: ['target'],
                    ADD_TAGS: ['iframe']
                });
            } else {
                console.warn('DOMPurify não está disponível. Usando sanitização básica.');
                // Implementação básica de sanitização (limitada)
                sanitizedHtml = htmlContent
                    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
                    .replace(/javascript:/gi, 'blocked:');
            }
            
            return `
                <div class="content">
                    ${sanitizedHtml}
                </div>
            `;
        } catch (error) {
            console.error('Erro ao renderizar markdown:', error);
            return `<div class="notification is-danger">
                Erro ao renderizar o conteúdo: ${error.message}
            </div>`;
        }
    }
    
    // Método para atualizar a navegação lateral e botões
    updateNavigation(pageId) {
        try {
            // Limpar seleção atual
            document.querySelectorAll('#moduleSections a').forEach(item => {
                item.classList.remove('is-active');
            });
            
            // Marcar o item atual como ativo
            const currentItem = document.querySelector(`#moduleSections a[data-page-id="${pageId}"]`);
            if (currentItem) {
                currentItem.classList.add('is-active');
                
                // Expandir a seção pai, se necessário
                const parentSection = currentItem.closest('.section-content');
                if (parentSection) {
                    const sectionHeader = parentSection.previousElementSibling;
                    if (sectionHeader && !sectionHeader.classList.contains('is-active')) {
                        sectionHeader.classList.add('is-active');
                        parentSection.style.display = 'block';
                    }
                }
                
                // Scroll para o item visível, se necessário
                currentItem.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            }
            
            // Atualizar botões de navegação
            this.updateNavigationButtons(pageId);
        } catch (error) {
            console.error('Erro ao atualizar navegação:', error);
        }
    }
    
    // Método para atualizar botões de navegação anterior/próximo
    updateNavigationButtons(pageId) {
        // Encontrar índices da página atual
        let sectionIndex = -1;
        let pageIndex = -1;
        let flatPages = [];
        
        // Criar uma lista plana de todas as páginas para navegação
        this.sections.forEach((section, sIdx) => {
            if (Array.isArray(section.pages)) {
                section.pages.forEach((pid, pIdx) => {
                    if (this.content[pid]) {
                        flatPages.push({
                            pageId: pid,
                            sectionIndex: sIdx,
                            pageIndex: pIdx
                        });
                        
                        if (pid === pageId) {
                            sectionIndex = sIdx;
                            pageIndex = pIdx;
                        }
                    }
                });
            }
        });
        
        // Encontrar a posição atual na lista plana
        const currentFlatIndex = flatPages.findIndex(p => p.pageId === pageId);
        
        // Configurar botão Anterior
        const prevButton = document.getElementById('prevPageBtn');
        if (prevButton) {
            if (currentFlatIndex > 0) {
                const prevPage = flatPages[currentFlatIndex - 1];
                prevButton.dataset.pageId = prevPage.pageId;
                prevButton.classList.remove('is-disabled');
                prevButton.removeAttribute('disabled');
            } else {
                prevButton.dataset.pageId = '';
                prevButton.classList.add('is-disabled');
                prevButton.setAttribute('disabled', 'disabled');
            }
        }
        
        // Configurar botão Próximo
        const nextButton = document.getElementById('nextPageBtn');
        if (nextButton) {
            if (currentFlatIndex >= 0 && currentFlatIndex < flatPages.length - 1) {
                const nextPage = flatPages[currentFlatIndex + 1];
                nextButton.dataset.pageId = nextPage.pageId;
                nextButton.classList.remove('is-disabled');
                nextButton.removeAttribute('disabled');
            } else {
                nextButton.dataset.pageId = '';
                nextButton.classList.add('is-disabled');
                nextButton.setAttribute('disabled', 'disabled');
            }
        }
    }
    
    // Método para aplicar syntax highlighting no conteúdo
    applySyntaxHighlighting() {
        try {
            document.querySelectorAll('pre code').forEach(block => {
                hljs.highlightElement(block);
            });
        } catch (error) {
            console.error('Erro ao aplicar syntax highlighting:', error);
        }
    }
    
    // Método para atualizar a URL com o ID da página atual
    updateURL(pageId) {
        if (!pageId) return;
        
        try {
            // Atualizar os parâmetros da URL sem recarregar a página
            const url = new URL(window.location.href);
            url.searchParams.set('page', pageId);
            window.history.pushState({pageId}, '', url.toString());
        } catch (error) {
            console.error('Erro ao atualizar URL:', error);
        }
    }
    
    // Método para iniciar contagem para marcar página como lida
    startPageReadingTimer(pageId) {
        // Limpar timeout anterior, se existir
        if (this.readTimeout) {
            clearTimeout(this.readTimeout);
        }
        
        // Definir novo timeout para marcar como lida após 5 segundos
        this.readTimeout = setTimeout(() => {
            this.markPageAsRead(pageId);
        }, 5000);
    }

    /**
     * Busca dentro da página atual e destaca as ocorrências
     * @param {string} query - Termo de busca
     * @returns {Object} Resultado com total de ocorrências e índice atual
     */
    searchInCurrentPage(query) {
        if (!query || !this.currentPageId) return { total: 0, current: 0 };
        
        const pageContent = document.getElementById('pageContent');
        if (!pageContent) return { total: 0, current: 0 };
        
        // Limpar pesquisas anteriores
        this.clearInPageSearch();
        
        // Converter o conteúdo em texto simples para busca
        const contentHtml = pageContent.innerHTML;
        const contentText = pageContent.textContent;
        
        if (!contentText || contentText.trim() === '') {
            return { total: 0, current: 0 };
        }
        
        // Buscar todas as ocorrências
        const searchTerms = query.toLowerCase().split(/\s+/).filter(term => term.length > 0);
        if (searchTerms.length === 0) {
            return { total: 0, current: 0 };
        }
        
        // Criar controles de navegação se não existirem
        this.createSearchNavigation();
        
        // Destacar ocorrências
        let newHtml = contentHtml;
        const occurrences = [];
        
        searchTerms.forEach(term => {
            const regex = new RegExp(`(${this.escapeRegExp(term)})`, 'gi');
            
            // Encontrar todas as posições dos matches no texto original
            let match;
            while ((match = regex.exec(contentText)) !== null) {
                occurrences.push({
                    term: match[0],
                    index: match.index,
                    length: match[0].length
                });
            }
            
            // Substituir no HTML com destaque
            newHtml = newHtml.replace(regex, '<mark class="search-highlight">$1</mark>');
        });
        
        // Ordenar ocorrências por posição no texto
        occurrences.sort((a, b) => a.index - b.index);
        
        // Se houver ocorrências, atualizar a UI
        if (occurrences.length > 0) {
            pageContent.innerHTML = newHtml;
            
            // Armazenar estado da busca
            this.inPageSearch = {
                occurrences: occurrences,
                currentIndex: 0,
                total: occurrences.length,
                query: query
            };
            
            // Atualizar contador e ativar controles
            this.updateSearchCounter();
            this.activateSearchNavigation(true);
            
            // Destacar a primeira ocorrência como ativa
            this.highlightCurrentMatch();
            
            return { total: occurrences.length, current: 1 };
        } else {
            // Nenhuma ocorrência encontrada na página atual
            this.updateSearchCounter(0, 0);
            this.activateSearchNavigation(false);
            return { total: 0, current: 0 };
        }
    }
    
    /**
     * Limpa pesquisas anteriores na página
     */
    clearInPageSearch() {
        // Resetar estado da busca
        this.inPageSearch = null;
        
        // Remover destaque de pesquisa anterior se existir
        const pageContent = document.getElementById('pageContent');
        if (pageContent) {
            // Substituir todas as tags mark com seu conteúdo
            const highlighted = pageContent.querySelectorAll('mark.search-highlight');
            highlighted.forEach(mark => {
                const parent = mark.parentNode;
                if (parent) {
                    while (mark.firstChild) {
                        parent.insertBefore(mark.firstChild, mark);
                    }
                    parent.removeChild(mark);
                }
            });
            
            // Remover classe de destaque ativo
            const active = pageContent.querySelector('mark.search-highlight-active');
            if (active) {
                active.classList.remove('search-highlight-active');
            }
        }
        
        // Esconder controles de navegação
        this.activateSearchNavigation(false);
    }
    
    /**
     * Cria controles de navegação para pesquisa na página
     */
    createSearchNavigation() {
        // Verificar se já existe
        let navContainer = document.querySelector('.in-page-search-nav');
        
        if (!navContainer) {
            navContainer = document.createElement('div');
            navContainer.className = 'in-page-search-nav';
            navContainer.style.cssText = 'position:absolute; right:15px; top:15px; z-index:100; background:#fff; border-radius:4px; box-shadow:0 2px 5px rgba(0,0,0,0.2); padding:5px;';
            navContainer.innerHTML = `
                <div class="field has-addons">
                    <p class="control">
                        <button class="button is-small nav-prev" title="Anterior">
                            <span class="icon is-small">
                                <i class="fas fa-chevron-up"></i>
                            </span>
                        </button>
                    </p>
                    <p class="control">
                        <button class="button is-small nav-next" title="Próximo">
                            <span class="icon is-small">
                                <i class="fas fa-chevron-down"></i>
                            </span>
                        </button>
                    </p>
                    <p class="control">
                        <span class="button is-static is-small search-counter">0 de 0</span>
                    </p>
                    <p class="control">
                        <button class="button is-small nav-close" title="Fechar">
                            <span class="icon is-small">
                                <i class="fas fa-times"></i>
                            </span>
                        </button>
                    </p>
                </div>
            `;
            
            // Adicionar à área de pesquisa
            const searchContainer = document.querySelector('.search-container');
            if (searchContainer) {
                searchContainer.style.position = 'relative';
                searchContainer.appendChild(navContainer);
                
                // Adicionar event listeners
                navContainer.querySelector('.nav-prev').addEventListener('click', () => this.navigateSearch('prev'));
                navContainer.querySelector('.nav-next').addEventListener('click', () => this.navigateSearch('next'));
                navContainer.querySelector('.nav-close').addEventListener('click', () => {
                    this.clearInPageSearch();
                    document.getElementById('searchInput').value = '';
                });
            }
        }
        
        return navContainer;
    }
    
    /**
     * Ativa ou desativa controles de navegação
     */
    activateSearchNavigation(active) {
        const navContainer = document.querySelector('.in-page-search-nav');
        if (navContainer) {
            navContainer.style.display = active ? 'block' : 'none';
        }
    }
    
    /**
     * Atualiza contador de resultados
     */
    updateSearchCounter(current = null, total = null) {
        const counter = document.querySelector('.search-counter');
        if (counter) {
            if (current === null && this.inPageSearch) {
                current = this.inPageSearch.currentIndex + 1;
                total = this.inPageSearch.total;
            }
            
            counter.textContent = `${current || 0} de ${total || 0}`;
        }
    }
    
    /**
     * Navega entre resultados da pesquisa
     */
    navigateSearch(direction) {
        if (!this.inPageSearch) return;
        
        const { occurrences, currentIndex, total } = this.inPageSearch;
        
        // Calcular próximo índice
        let nextIndex;
        if (direction === 'prev') {
            nextIndex = (currentIndex - 1 + total) % total;
        } else {
            nextIndex = (currentIndex + 1) % total;
        }
        
        // Atualizar índice atual
        this.inPageSearch.currentIndex = nextIndex;
        
        // Destacar novo resultado ativo
        this.highlightCurrentMatch();
        
        // Atualizar contador
        this.updateSearchCounter();
    }
    
    /**
     * Destaca o resultado atual de busca
     */
    highlightCurrentMatch() {
        if (!this.inPageSearch) return;
        
        const { currentIndex } = this.inPageSearch;
        
        // Remover destaque anterior
        const prevActive = document.querySelector('mark.search-highlight-active');
        if (prevActive) {
            prevActive.classList.remove('search-highlight-active');
        }
        
        // Adicionar destaque ativo ao resultado atual
        const allMatches = document.querySelectorAll('mark.search-highlight');
        if (allMatches.length > currentIndex) {
            const currentMatch = allMatches[currentIndex];
            currentMatch.classList.add('search-highlight-active');
            
            // Scroll para o elemento atual
            currentMatch.scrollIntoView({
                behavior: 'smooth',
                block: 'center'
            });
        }
    }
    
    /**
     * Escapa caracteres especiais para uso em regex
     */
    escapeRegExp(string) {
        return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }

    /**
     * Monitora o scroll e exibe a mensagem de conclusão quando o usuário chega ao final do conteúdo
     */
    setupCompletionMessageObserver() {
        // Verificar se o elemento de conteúdo existe
        const contentElement = document.getElementById('pageContent');
        if (!contentElement) return;
        
        // Criar o elemento de mensagem de conclusão
        const completionMessage = document.createElement('div');
        completionMessage.id = 'completionMessage';
        completionMessage.className = 'notification is-success completion-message';
        completionMessage.style.display = 'none';
        completionMessage.innerHTML = `
            <div class="content has-text-centered">
                <h3 class="title is-4">
                    <span class="icon-text">
                        <span class="icon">
                            <i class="fas fa-trophy"></i>
                        </span>
                        <span>Parabéns!</span>
                    </span>
                </h3>
                <p>Você completou este módulo de aprendizado.</p>
                <p>Continue explorando outros módulos para ampliar seus conhecimentos.</p>
                <div class="buttons is-centered mt-4">
                    <a href="/learn" class="button is-info">
                        <span class="icon">
                            <i class="fas fa-book"></i>
                        </span>
                        <span>Ver Outros Módulos</span>
                    </a>
                </div>
            </div>
        `;
        
        // Adicionar o elemento ao conteúdo
        contentElement.parentNode.appendChild(completionMessage);
        
        // Variável para controlar se a mensagem já foi mostrada
        let completionMessageShown = false;
        
        // Função para verificar se chegou ao final do conteúdo
        const checkScrollPosition = () => {
            if (completionMessageShown) return;
            
            const contentBox = contentElement.getBoundingClientRect();
            const windowHeight = window.innerHeight;
            
            // Se chegou ao final do conteúdo (conteúdo inteiro visível ou scrollado até o final)
            if (contentBox.bottom <= windowHeight || 
                (window.innerHeight + window.scrollY) >= document.body.offsetHeight - 100) {
                
                // Verificar se o usuário já leu pelo menos uma página
                if (this.userProgress && this.userProgress.readPages && this.userProgress.readPages.length > 0) {
                    this.showCompletionMessage();
                    completionMessageShown = true;
                    
                    // Remover o listener depois de mostrar a mensagem
                    window.removeEventListener('scroll', checkScrollPosition);
                }
            }
        };
        
        // Adicionar listener de scroll
        window.addEventListener('scroll', checkScrollPosition);
        
        // Também verificar quando mudar de página
        this.completionMessage = completionMessage;
        this.checkScrollPosition = checkScrollPosition;
        
        // Verificar imediatamente (caso o conteúdo seja pequeno)
        setTimeout(checkScrollPosition, 1000);
    }

    /**
     * Exibe a mensagem de conclusão do módulo
     */
    showCompletionMessage() {
        if (!this.completionMessage) return;
        
        // Mostrar a mensagem com animação
        this.completionMessage.style.display = 'block';
        this.completionMessage.style.animation = 'fadeInUp 0.5s ease-out';
        
        // Atualizar o progresso se necessário
        if (this.moduleId && !this.moduleCompleted) {
            this.markModuleAsCompleted();
        }
    }

    /**
     * Marca o módulo como concluído no servidor
     */
    async markModuleAsCompleted() {
        try {
            // Atualizar o progresso no servidor
            const response = await fetch(`/api/learning/progress/${this.moduleId}/complete`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                }
            });
            
            if (response.ok) {
                // Atualizar o estado local
                this.moduleCompleted = true;
                
                // Atualizar a interface se necessário
                this.renderProgress();
            }
        } catch (error) {
            console.error('Erro ao marcar módulo como concluído:', error);
        }
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const view = new ModuleView();
    view.init().catch(console.error);
}); 