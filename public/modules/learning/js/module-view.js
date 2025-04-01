class ModuleView {
    constructor() {
        this.moduleId = window.location.pathname.split('/').pop();
        this.content = {};
        this.sections = [];
        this.currentPage = null;
        this.userProgress = {
            completedPages: [],
            totalPages: 0
        };
    }

    async init() {
        try {
            await this.loadModule();
            await this.loadUserProgress();
            this.setupSearch();
            this.setupNavigation();
            this.render();
        } catch (error) {
            console.error('Erro ao inicializar:', error);
            this.showError('Erro ao carregar módulo');
        }
    }

    async loadModule() {
        try {
            const moduleId = this.moduleId;
            console.log('Carregando módulo:', moduleId);
            
            const response = await fetch(`/api/learning/modules/${moduleId}`);
            console.log('Status da resposta:', response.status);
            
            if (!response.ok) {
                const error = await response.json();
                console.error('Erro detalhado:', error);
                throw new Error('Erro ao carregar módulo');
            }
            
            const data = await response.json();
            console.log('Dados completos do módulo:', data);
            
            // Verificar e estruturar o conteúdo adequadamente
            if (data.content) {
                console.log('Conteúdo encontrado no módulo');
                this.content = data.content;
            } else {
                console.warn('Módulo não tem conteúdo definido');
                this.content = {}; // Objeto vazio para evitar erros
            }
            
            // Verificar e estruturar as seções adequadamente
            if (Array.isArray(data.sections) && data.sections.length > 0) {
                console.log('Seções encontradas no módulo:', data.sections.length);
                
                // Verificar e corrigir as seções com problemas
                const fixedSections = data.sections.map(section => {
                    // Clone a seção para evitar mutar o objeto original
                    const fixedSection = { ...section };
                    
                    // Verificar se a seção tem um array de páginas
                    if (!Array.isArray(fixedSection.pages)) {
                        console.warn(`Seção sem array de páginas válido:`, fixedSection);
                        fixedSection.pages = [];
                        return fixedSection;
                    }
                    
                    // Filtrar e fixar páginas que são objetos
                    const fixedPages = fixedSection.pages.filter(pageId => {
                        if (typeof pageId === 'object') {
                            console.warn(`Encontrado objeto como ID de página na seção ${fixedSection.title || 'sem título'}:`, pageId);
                            // Se pageId for um objeto com uma propriedade 'id', usar esse valor
                            if (pageId && pageId.id && (typeof pageId.id === 'string' || typeof pageId.id === 'number')) {
                                console.log(`  - Usando a propriedade 'id' do objeto como ID: ${pageId.id}`);
                                // Substituir o objeto pelo valor da propriedade 'id'
                                return true;
                            }
                            return false;
                        }
                        return true;
                    }).map(pageId => {
                        // Se for um objeto com id, extrair o id
                        if (typeof pageId === 'object' && pageId && pageId.id) {
                            return String(pageId.id);
                        }
                        // Caso contrário, usar o pageId como está (deve ser string ou número)
                        return pageId;
                    });
                    
                    fixedSection.pages = fixedPages;
                    return fixedSection;
                });
                
                this.sections = fixedSections;
            } else {
                console.warn('Módulo não tem seções definidas ou as seções não estão em formato válido');
                this.sections = []; // Array vazio para evitar erros
            }
            
            // Atualizar o título da página
            const moduleNameElement = document.getElementById('moduleName');
            if (moduleNameElement) {
                moduleNameElement.textContent = data.title || 'Módulo sem título';
            } else {
                console.error('Elemento moduleName não encontrado no DOM');
            }
            
            // Verificar se há dados suficientes para mostrar o conteúdo
            if (Object.keys(this.content).length === 0 || this.sections.length === 0) {
                console.warn('Módulo não tem conteúdo ou seções suficientes para exibição');
                this.showError('Este módulo ainda não tem conteúdo definido. Por favor, adicione conteúdo no editor.');
            }
        } catch (error) {
            console.error('Erro completo ao carregar módulo:', error);
            this.showError(`Não foi possível carregar o módulo: ${error.message}`);
            throw error;
        }
    }

    async loadUserProgress() {
        try {
            console.log('Carregando progresso para o módulo:', this.moduleId);
            
            // Tentar carregar o progresso, mas se falhar, continuar com valores padrão
            let progressData = {
                completed_pages: [],
                total_pages: 0,
                progress: 0
            };
            
            try {
                const response = await fetch(`/api/progress/${this.moduleId}`);
                console.log('Status da resposta de progresso:', response.status);
                
                if (response.ok) {
                    progressData = await response.json();
                    console.log('Dados de progresso recebidos:', progressData);
                } else {
                    console.warn('Não foi possível carregar o progresso do usuário:', response.status);
                }
            } catch (error) {
                console.warn('Erro ao carregar progresso, continuando com valores padrão:', error);
            }
            
            // Independentemente de sucesso ou erro, processar os dados (usar defaults se necessário)
            this.userProgress = {
                completedPages: progressData.completed_pages || [],
                totalPages: progressData.total_pages || 0,
                progress: progressData.progress || 0
            };
            
            console.log('Progresso processado:', this.userProgress);
        } catch (error) {
            console.error('Erro ao processar progresso do usuário:', error);
            // Usar valores padrão em caso de erro
            this.userProgress = {
                completedPages: [],
                totalPages: 0,
                progress: 0
            };
        }
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
                this.handleSearch(event.target.value.trim());
            }, 300);
        });
    }

    async handleSearch(query) {
        const searchResults = document.getElementById('searchResults');
        const pageContent = document.getElementById('pageContent');

        if (!query) {
            searchResults.style.display = 'none';
            pageContent.style.display = 'block';
            return;
        }

        try {
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
        
        document.querySelector('.content-area').appendChild(navContainer);
        
        document.getElementById('prevPage').addEventListener('click', () => this.navigate('prev'));
        document.getElementById('nextPage').addEventListener('click', () => this.navigate('next'));
    }

    navigate(direction) {
        let currentIndex = -1;
        const allPages = this.getAllPages();
        
        if (this.currentPage) {
            currentIndex = allPages.indexOf(this.currentPage);
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
        const currentIndex = allPages.indexOf(this.currentPage);
        
        document.getElementById('prevPage').disabled = currentIndex <= 0;
        document.getElementById('nextPage').disabled = currentIndex >= allPages.length - 1;
    }

    async markPageAsRead(pageId) {
        console.log(`Marcando página ${pageId} como lida`);
        
        // Garantir que o pageId seja uma string
        const pageIdStr = String(pageId);
        
        if (!this.userProgress.completedPages.includes(pageIdStr)) {
            this.userProgress.completedPages.push(pageIdStr);
            
            try {
                // Adaptar para o formato esperado pelo servidor (camelCase para snake_case)
                const totalPages = this.getAllPages().length;
                
                console.log('Enviando progresso atualizado:', {
                    completed_pages: this.userProgress.completedPages,
                    total_pages: totalPages
                });
                
                await fetch(`/api/progress/${this.moduleId}`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        completed_pages: this.userProgress.completedPages,
                        total_pages: totalPages
                    })
                });
                
                console.log('Progresso salvo com sucesso');
            } catch (error) {
                console.error('Erro ao atualizar progresso:', error);
            }
        }
    }

    renderProgress() {
        const totalPages = this.getAllPages().length;
        const completedPages = this.userProgress.completedPages.length;
        const progressPercentage = Math.round((completedPages / totalPages) * 100);

        const progressContainer = document.createElement('div');
        progressContainer.className = 'progress-container mt-4';
        progressContainer.innerHTML = `
            <progress class="progress is-primary" value="${completedPages}" max="${totalPages}"></progress>
            <p class="has-text-centered">${progressPercentage}% concluído (${completedPages}/${totalPages} páginas)</p>
        `;

        document.querySelector('.content-area').appendChild(progressContainer);
    }

    showPage(pageId) {
        console.log('Tentando mostrar página:', pageId);
        
        // Verificar se o pageId é válido
        if (!pageId) {
            console.error('ID de página inválido:', pageId);
            this.showError('ID de página inválido ou ausente');
            return;
        }
        
        // Converter para string para garantir consistência
        const pageIdStr = String(pageId);
        
        // Verificar se o pageId é um objeto
        if (typeof pageId === 'object') {
            console.error('Recebido um objeto como ID de página:', pageId);
            this.showError(`Formato de ID inválido. Recebido um objeto quando deveria ser uma string.`);
            return;
        }
        
        this.currentPage = pageIdStr;
        const page = this.content[pageIdStr];
        
        if (!page) {
            console.error(`Página ${pageIdStr} não encontrada no conteúdo`);
            console.log('Conteúdo disponível:', Object.keys(this.content));
            
            // Encontrar a seção à qual esta página pertence
            let pageSection = null;
            for (const section of this.sections) {
                if (section.pages && section.pages.includes(pageIdStr)) {
                    pageSection = section;
                    break;
                }
            }
            
            const contentArea = document.querySelector('.content-area');
            if (contentArea) {
                // Verificar se o usuário é administrador
                const isAdmin = this.checkIfUserIsAdmin();
                
                // Construir a mensagem de erro
                let buttonsHTML = `
                    <div class="buttons is-centered mt-4">
                        <button class="button is-primary create-page-btn">
                            <span class="icon"><i class="fas fa-plus"></i></span>
                            <span>Criar Página</span>
                        </button>
                `;
                
                // Adicionar botão de corrigir estrutura apenas para administradores
                if (isAdmin) {
                    buttonsHTML += `
                        <button class="button is-warning fix-structure-btn">
                            <span class="icon"><i class="fas fa-wrench"></i></span>
                            <span>Corrigir Estrutura</span>
                        </button>
                    `;
                }
                
                // Adicionar botão de abrir editor (apenas para administradores)
                if (isAdmin) {
                    buttonsHTML += `
                        <a href="/admin/learning/module/content/${this.moduleId}" class="button is-info">
                            <span class="icon"><i class="fas fa-edit"></i></span>
                            <span>Abrir Editor</span>
                        </a>
                    `;
                }
                
                buttonsHTML += `</div>`;
                
                contentArea.innerHTML = `
                    <div class="page-not-found">
                        <h3 class="title is-4">Página não encontrada</h3>
                        <p>A página solicitada (${pageIdStr}) não foi encontrada neste módulo.</p>
                        ${pageSection ? `<p>Esta página pertence à seção "${pageSection.title}" mas não tem conteúdo definido.</p>` : ''}
                        
                        ${buttonsHTML}
                    </div>
                `;
                
                // Adicionar listeners aos botões
                const createPageBtn = contentArea.querySelector('.create-page-btn');
                if (createPageBtn) {
                    createPageBtn.addEventListener('click', () => this.createPageContent(pageIdStr, pageSection));
                }
                
                const fixStructureBtn = contentArea.querySelector('.fix-structure-btn');
                if (fixStructureBtn && isAdmin) {
                    fixStructureBtn.addEventListener('click', () => {
                        if (typeof ModuleFixer !== 'undefined') {
                            const fixer = new ModuleFixer();
                            fixer.fix();
                        } else {
                            console.error('ModuleFixer não está definido');
                            this.showError('Ferramenta de correção não disponível');
                        }
                    });
                }
            }
            return;
        }

        console.log('Conteúdo da página encontrado:', page);
        
        const contentArea = document.querySelector('.content-area');
        if (!contentArea) {
            console.error('Elemento .content-area não encontrado');
            return;
        }
        
        contentArea.innerHTML = `
            <div class="search-container mb-4"></div>
            <h1 class="title">${page.title || 'Sem título'}</h1>
            <div class="content markdown-content">
                ${page.content ? marked.parse(page.content) : '<p>Esta página não tem conteúdo.</p>'}
            </div>
            <div class="navigation-buttons mt-4"></div>
            <div class="progress-container mt-4"></div>
        `;

        // Restaurar elementos
        this.setupSearch();
        this.setupNavigation();
        this.updateNavigationButtons();
        this.renderProgress();
        
        // Marcar página como lida
        this.markPageAsRead(pageIdStr);
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
                            const isActive = this.currentPage === pageIdStr;
                            const isCompleted = this.userProgress.completedPages?.includes(pageIdStr);
                            
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
}

document.addEventListener('DOMContentLoaded', () => {
    const view = new ModuleView();
    view.init().catch(console.error);
}); 