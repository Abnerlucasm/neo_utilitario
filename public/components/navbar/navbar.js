// Importar CSS como módulo
// const cssPromise = fetch('navbar.css')
//     .then(response => response.text())
//     .then(css => {
//         const sheet = new CSSStyleSheet();
//         sheet.replaceSync(css);
//         return sheet;
//     });

// Definição do template diretamente
function getNavbarTemplate(isDarkTheme = false) {
    return `
        <style>
            @import url('https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css');
            @import url('/components/navbar/navbar.css');
        </style>

        <nav class="navbar ${isDarkTheme ? 'dark-theme' : ''}">
            <div class="navbar-brand">
                <a href="/">
                    <img src="/assets/neo-logo-small.png" alt="Neo Logo">
                </a>
            </div>

            <div class="navbar-end">
                <button id="themeToggle" class="button is-light" title="Alternar tema">
                    <span class="icon">
                        <i class="fas ${isDarkTheme ? 'fa-sun' : 'fa-moon'}"></i>
                    </span>
                </button>
                
                <button id="userMenuBtn" class="button is-light" title="Menu do usuário">
                    <span class="icon">
                        <i class="fas fa-user"></i>
                    </span>
                </button>

                <button class="menu-toggle" title="Menu principal">
                    <span class="icon">
                        <i class="fas fa-bars"></i>
                    </span>
                </button>
            </div>
        </nav>

        <div class="breadcrumb-container">
            <ul class="breadcrumb">
                <!-- Breadcrumb será gerado dinamicamente -->
            </ul>
        </div>

        <div class="sidebar">
            <button class="close-sidebar">
                <i class="fas fa-times"></i>
            </button>
            
            <div id="userInfoPanel" style="padding: 1rem; margin-bottom: 1rem; border-bottom: 1px solid #eee; cursor: pointer;">
                <div style="display: flex; align-items: center; gap: 1rem;">
                    <div style="width: 40px; height: 40px; border-radius: 50%; background: #e9ecef; display: flex; align-items: center; justify-content: center;">
                        <i class="fas fa-user"></i>
                    </div>
                    <div>
                        <div id="userName" style="font-weight: 500;">Carregando...</div>
                        <div id="userRole" style="font-size: 0.875rem; color: #6c757d;">...</div>
                    </div>
                </div>
            </div>

            <ul class="menu-list"></ul>
        </div>

        <div class="overlay"></div>
    `;
}

class NeoNavbar extends HTMLElement {
    constructor() {
        super();
        
        // Estado do componente
        this.state = {
            isDarkTheme: false,
            isMenuOpen: false,
            menus: [],
            userResources: [],
            isAdmin: false
        };
        
        // Carregar tema do localStorage
        const savedSettings = JSON.parse(localStorage.getItem('userSettings')) || {};
        this.state.isDarkTheme = savedSettings.theme === 'dark';
    }

    async connectedCallback() {
        try {
            // Criar Shadow DOM apenas uma vez
            this.attachShadow({ mode: 'open' });
            
            // Carregar o template
            const template = getNavbarTemplate(this.state.isDarkTheme);
            this.shadowRoot.innerHTML = template;

            // Garantir que o FontAwesome seja carregado
            if (!document.querySelector('link[href*="font-awesome"]')) {
                const fontAwesome = document.createElement('link');
                fontAwesome.rel = 'stylesheet';
                fontAwesome.href = 'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css';
                document.head.appendChild(fontAwesome);
            }

            // Inicializar referências aos elementos
            this.sidebar = this.shadowRoot.querySelector('.sidebar');
            this.overlay = this.shadowRoot.querySelector('.overlay');
            this.menuToggle = this.shadowRoot.querySelector('.menu-toggle');
            this.closeSidebar = this.shadowRoot.querySelector('.close-sidebar');
            this.menuList = this.shadowRoot.querySelector('.menu-list');
            this.userMenuBtn = this.shadowRoot.querySelector('#userMenuBtn');
            this.userInfoPanel = this.shadowRoot.querySelector('#userInfoPanel');

            // Escutar evento de atualização de informações do usuário
            document.addEventListener('user-info-updated', (event) => {
                if (event.detail && event.detail.userData) {
                    this.updateUserInfo(event.detail.userData);
                }
            });

            // Inicializar componentes
            await this.loadUserSettings();
            await this.loadMenus();
            this.setupEventListeners();
            this.highlightCurrentPage();
            this.updateBreadcrumb();
            this.updateIcons();
        } catch (error) {
            console.error('Erro ao inicializar navbar:', error);
        }
    }

    // Atualizar informações do usuário a partir do token
    updateUserInfo(tokenData) {
        const userName = this.shadowRoot.querySelector('#userName');
        const userRole = this.shadowRoot.querySelector('#userRole');
        
        if (userName) {
            userName.textContent = tokenData.email ? tokenData.email.split('@')[0] : 'Usuário';
        }
        
        if (userRole) {
            const roles = tokenData.roles || [];
            userRole.textContent = roles.length > 0 ? roles.join(', ') : 'Usuário';
        }
    }

    async loadMenus() {
        try {
            // Verificar se o usuário está autenticado
            const token = localStorage.getItem('auth_token');
            if (!token) {
                console.warn('Usuário não autenticado, renderizando menus padrão');
                this.renderDefaultMenus();
                return;
            }
            
            // Verificar se o usuário é admin
            try {
                const tokenData = JSON.parse(atob(token.split('.')[1]));
                this.state.isAdmin = tokenData.roles && tokenData.roles.includes('admin');
                console.log('Usuário é admin:', this.state.isAdmin);
                
                // Atualizar informações do usuário
                this.updateUserInfo(tokenData);
            } catch (error) {
                console.error('Erro ao decodificar token:', error);
            }

            // Carregar recursos do usuário
            try {
                this.state.userResources = await loadUserResources();
                console.log('Recursos do usuário carregados:', this.state.userResources);
            } catch (error) {
                console.error('Erro ao carregar recursos do usuário:', error);
                this.state.userResources = [];
            }
            
            // Renderizar menus
            await this.renderDefaultMenus();
            
            // Configurar eventos dos submenus após renderização
            this.setupSubmenuEvents();
        } catch (error) {
            console.error('Erro ao carregar menus:', error);
            // Em caso de erro, renderizar pelo menos os menus padrão
            this.renderDefaultMenus();
        }
    }

    // Função para transformar o formato dos menus do backend para o frontend
    transformMenus(menus) {
        if (!Array.isArray(menus)) {
            console.error('transformMenus: entrada não é um array', menus);
            return [];
        }
        
        return menus.map(menu => {
            // Criar objeto básico do menu
            const transformedMenu = {
                id: menu.id,
                titulo: menu.title,
                url: menu.path,
                icon: menu.icon,
                isAdminOnly: menu.isAdminOnly,
                isActive: menu.isActive,
                resourcePath: menu.resourcePath || menu.path
            };
            
            // Processar filhos recursivamente se existirem
            if (menu.children && Array.isArray(menu.children) && menu.children.length > 0) {
                transformedMenu.submenu = this.transformMenus(menu.children);
            }
            
            return transformedMenu;
        });
    }

    // Carregar menus estáticos como fallback
    loadStaticMenus() {
        console.log('Carregando menus estáticos como fallback');
        
        // Menus estáticos para usuários comuns
        const staticMenus = [
            {
                id: '1',
                titulo: 'Início',
                url: '/',
                icon: 'fas fa-home'
            },
            {
                id: '2',
                titulo: 'Central de Aprendizado',
                url: '/pages/learning/learn.html',
                icon: 'fas fa-graduation-cap'
            },
            {
                id: '3',
                titulo: 'Utilitários',
                url: '#',
                icon: 'fas fa-tools',
                submenu: [
                    {
                        id: '3-1',
                        titulo: 'Gerenciador Glassfish',
                        url: '/pages/glassfish.html',
                        icon: 'fas fa-server'
                    },
                    {
                        id: '3-2',
                        titulo: 'NeoTrack',
                        url: '/pages/neotrack.html',
                        icon: 'fas fa-chart-line'
                    }
                ]
            },
            {
                id: '4',
                titulo: 'Configurações',
                url: '/pages/user-settings.html',
                icon: 'fas fa-user-cog'
            }
        ];
        
        // Adicionar menus de admin se o usuário for admin
        if (this.state.isAdmin) {
            staticMenus.push({
                id: '5',
                titulo: 'Administração',
                url: '#',
                icon: 'fas fa-shield-alt',
                submenu: [
                    {
                        id: '5-1',
                        titulo: 'Usuários',
                        url: '/pages/admin/user-management.html',
                        icon: 'fas fa-users'
                    },
                    {
                        id: '5-2',
                        titulo: 'Papéis',
                        url: '/pages/admin/roles.html',
                        icon: 'fas fa-user-tag'
                    },
                    {
                        id: '5-3',
                        titulo: 'Menus',
                        url: '/pages/admin/menus.html',
                        icon: 'fas fa-bars'
                    }
                ]
            });
        }
        
        return staticMenus;
    }

    async renderDefaultMenus() {
        const menuList = this.shadowRoot.querySelector('.menu-list');
        if (!menuList) return;

        try {
            // Código original para buscar menus
            const token = localStorage.getItem('auth_token');
            
            // Adicionar verificação se o token existe
            if (!token) {
                throw new Error('Token não encontrado');
            }
            
            // Fazer requisição aos menus
            let response;
            try {
                console.log('Buscando menus da API...');
                response = await fetch('/api/menus', {
                    headers: {
                        'Authorization': `Bearer ${token}`
                    }
                });
    
                if (!response.ok) {
                    let errorMessage = `Erro ao carregar menus: ${response.status}`;
                    try {
                        const errorText = await response.text();
                        console.error(`Erro ${response.status} ao carregar menus: ${errorText}`);
                        
                        // Tentar parsear como JSON
                        try {
                            const errorData = JSON.parse(errorText);
                            errorMessage = errorData.error || errorData.message || errorMessage;
                        } catch {
                            // Se não for JSON, usar texto bruto
                            errorMessage = `${errorMessage} - ${errorText}`;
                        }
                    } catch (parseError) {
                        console.error('Erro ao processar resposta de erro:', parseError);
                    }
                    
                    throw new Error(errorMessage);
                }
            } catch (error) {
                console.error('Erro na requisição de menus:', error);
                throw error;
            }

            // Processar a resposta em JSON
            let menus;
            try {
                menus = await response.json();
                console.log('Menus carregados da API:', menus);
                
                // Verificar formato da resposta
                if (!Array.isArray(menus)) {
                    console.error('Formato de resposta inválido, esperava um array:', menus);
                    throw new Error('Formato de resposta inválido');
                }
                
                // Transformar para o formato esperado pelo frontend
                menus = this.transformMenus(menus);
                console.log('Menus transformados:', menus);
            } catch (error) {
                console.error('Erro ao processar JSON dos menus:', error);
                throw error;
            }

            // Renderizar menus dinamicamente
            let menuHtml = '';
            
            // Função recursiva para renderizar menus e submenus
            const renderMenu = (menuItem) => {
                let html = '';
                
                // Verificar se o menu tem submenu
                if (menuItem.submenu && menuItem.submenu.length > 0) {
                    // Menu com submenu
                    html += `
                        <li class="submenu-parent">
                            <a href="#" class="has-submenu">
                                <i class="${menuItem.icon || 'fas fa-circle'}"></i>
                                <span>${menuItem.titulo}</span>
                                <i class="fas fa-chevron-down"></i>
                            </a>
                            <ul class="submenu">
                                ${menuItem.submenu.map(subitem => renderMenu(subitem)).join('')}
                            </ul>
                        </li>
                    `;
                } else {
                    // Menu sem submenu - verificar se é um link externo ou interno
                    const isExternal = menuItem.url.startsWith('http');
                    
                    html += `
                        <li>
                            <a href="${menuItem.url}" ${isExternal ? 'target="_blank" rel="noopener noreferrer"' : ''}>
                                <i class="${menuItem.icon || 'fas fa-circle'}"></i>
                                ${menuItem.titulo}
                            </a>
                        </li>
                    `;
                }
                
                return html;
            };

            // Renderizar cada menu principal
            menus.forEach(menu => {
                // Verificar se o usuário tem acesso ao menu
                const hasAccess = this.checkAccess(menu.resourcePath || menu.url);
                if (!hasAccess && !this.state.isAdmin) {
                    // Pular menus aos quais o usuário não tem acesso
                    return;
                }
                
                // Verificar se o menu é apenas para admin
                if (menu.isAdminOnly && !this.state.isAdmin) {
                    // Pular menus exclusivos para admin
                    return;
                }
                
                menuHtml += renderMenu(menu);
            });

            // Adicionar menu de configurações que sempre aparece
            menuHtml += `
                <li>
                    <a href="/pages/user-settings.html">
                        <i class="fas fa-user-cog"></i>
                        Configurações
                    </a>
                </li>
            `;

            menuList.innerHTML = menuHtml;

            this.setupSubmenuEvents();
            this.updateIcons();

        } catch (error) {
            console.error('Erro ao carregar menus do banco:', error);
            
            // Usar menus estáticos em caso de falha
            const staticMenus = this.loadStaticMenus();
            
            // Renderizar menus estáticos
            let menuHtml = '';
            
            const renderStaticMenu = (menuItem) => {
                // Usar a mesma lógica de renderMenu
                let html = '';
                
                if (menuItem.submenu && menuItem.submenu.length > 0) {
                    html += `
                        <li class="submenu-parent">
                            <a href="#" class="has-submenu">
                                <i class="${menuItem.icon || 'fas fa-circle'}"></i>
                                <span>${menuItem.titulo}</span>
                                <i class="fas fa-chevron-down"></i>
                            </a>
                            <ul class="submenu">
                                ${menuItem.submenu.map(subitem => renderStaticMenu(subitem)).join('')}
                            </ul>
                        </li>
                    `;
                } else {
                    const isExternal = menuItem.url.startsWith('http');
                    
                    html += `
                        <li>
                            <a href="${menuItem.url}" ${isExternal ? 'target="_blank" rel="noopener noreferrer"' : ''}>
                                <i class="${menuItem.icon || 'fas fa-circle'}"></i>
                                ${menuItem.titulo}
                            </a>
                        </li>
                    `;
                }
                
                return html;
            };
            
            // Renderizar cada menu estático
            staticMenus.forEach(menu => {
                menuHtml += renderStaticMenu(menu);
            });
            
            menuList.innerHTML = menuHtml;
            
            // Configurar eventos dos submenus
            this.setupSubmenuEvents();
            this.updateIcons();
        }
    }

    setupSubmenuEvents() {
        // Encontrar todos os elementos com submenus
        const submenuParents = this.shadowRoot.querySelectorAll('.submenu-parent');
        
        submenuParents.forEach(parent => {
            const link = parent.querySelector('a.has-submenu');
            const submenu = parent.querySelector('.submenu');
            
            if (link) {
                link.addEventListener('click', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    
                    // Toggle da classe active no pai
                    parent.classList.toggle('active');
                    
                    // Animar o ícone de chevron
                    const chevron = link.querySelector('.fa-chevron-down');
                    if (chevron) {
                        chevron.style.transform = parent.classList.contains('active') 
                            ? 'rotate(180deg)' 
                            : 'rotate(0deg)';
                    }
                    
                    // Animar o submenu
                    if (submenu) {
                        if (parent.classList.contains('active')) {
                            submenu.style.maxHeight = submenu.scrollHeight + 'px';
                        } else {
                            submenu.style.maxHeight = '0';
                        }
                    }
                });
            }
        });
    }

    checkAccess(resourcePath) {
        // Se o usuário for admin, tem acesso a tudo
        if (this.state.isAdmin) {
            console.log(`Usuário é admin - acesso permitido a ${resourcePath}`);
            return true;
        }
        
        // Se não houver recursos carregados, permitir acesso
        if (!this.state.userResources || this.state.userResources.length === 0) {
            console.log(`Sem recursos carregados - permitindo acesso a ${resourcePath}`);
            return true;
        }
        
        // Verificar se o usuário tem acesso ao recurso
        const hasAccess = this.state.userResources.some(resource => {
            // Normalizar caminhos para comparação
            const normalizedResource = resource.startsWith('/pages/') ? resource : `/pages${resource}`;
            const normalizedPath = resourcePath.startsWith('/pages/') ? resourcePath : `/pages${resourcePath}`;
            
            const matches = normalizedResource === normalizedPath;
            if (matches) {
                console.log(`Recurso ${normalizedResource} corresponde ao caminho ${normalizedPath}`);
            }
            
            return matches;
        });
        
        console.log(`Verificando acesso a ${resourcePath}: ${hasAccess ? 'Permitido' : 'Negado'}`);
        return hasAccess;
    }
    
    setupEventListeners() {
        // Menu burger
        if (this.menuToggle) {
            this.menuToggle.addEventListener('click', (e) => {
                e.preventDefault();
                this.state.isMenuOpen = true;
                this.sidebar.classList.add('active');
                this.overlay.classList.add('active');
            });
        }

        // Botão de fechar menu
        if (this.closeSidebar) {
            this.closeSidebar.addEventListener('click', (e) => {
                e.preventDefault();
                this.state.isMenuOpen = false;
                this.sidebar.classList.remove('active');
                this.overlay.classList.remove('active');
            });
        }

        // Overlay
        if (this.overlay) {
            this.overlay.addEventListener('click', () => {
                this.state.isMenuOpen = false;
                this.sidebar.classList.remove('active');
                this.overlay.classList.remove('active');
            });
        }

        // Botão de menu do usuário
        if (this.userMenuBtn) {
            this.userMenuBtn.addEventListener('click', () => {
                window.location.href = '/pages/user-settings.html';
            });
        }

        // Painel de informações do usuário
        if (this.userInfoPanel) {
            this.userInfoPanel.addEventListener('click', () => {
                window.location.href = '/pages/user-settings.html';
            });
        }

        // Toggle de tema
        const themeToggle = this.shadowRoot.querySelector('#themeToggle');
        if (themeToggle) {
            themeToggle.addEventListener('change', () => {
                this.toggleTheme();
            });
        }
    }

    toggleTheme() {
        // Alternar o estado do tema
        this.state.isDarkTheme = !this.state.isDarkTheme;
        
        // Atualizar a UI
        this.updateTheme(this.state.isDarkTheme);
        
        // Salvar no localStorage
        const settings = JSON.parse(localStorage.getItem('userSettings')) || {};
        settings.theme = this.state.isDarkTheme ? 'dark' : 'light';
        localStorage.setItem('userSettings', JSON.stringify(settings));
        
        // Aplicar tema ao documento
        document.body.classList.toggle('dark-theme', this.state.isDarkTheme);
        
        // Disparar evento para outros componentes
        const event = new CustomEvent('theme-changed', {
            bubbles: true,
            composed: true,
            detail: { theme: this.state.isDarkTheme ? 'dark' : 'light' }
        });
        
        // Usar setTimeout para evitar recursão infinita
        setTimeout(() => {
            this.dispatchEvent(event);
        }, 0);
    }

    highlightCurrentPage() {
        const currentPath = window.location.pathname;
        
        // Encontrar todos os links no menu
        const links = this.shadowRoot.querySelectorAll('.menu-list a');
        
        links.forEach(link => {
            const linkPath = link.getAttribute('href');
            
            // Verificar se o caminho do link corresponde ao caminho atual
            if (linkPath === currentPath || 
                (currentPath.endsWith('/') && linkPath === currentPath + 'index.html') ||
                (linkPath.endsWith('/index.html') && currentPath === linkPath.replace('index.html', ''))) {
                link.classList.add('active');
                
                // Se for um submenu, expandir o menu pai
                const parentLi = link.closest('.submenu-parent');
                if (parentLi) {
                    parentLi.classList.add('active');
                }
            }
        });
    }

    updateBreadcrumb() {
        const breadcrumb = this.shadowRoot.querySelector('.breadcrumb');
        if (!breadcrumb) return;

        const pathSegments = window.location.pathname.split('/').filter(segment => segment);

        // Mapeamento de títulos para as rotas
        const routeTitles = {
            // Seções principais
            'pages': '',
            'admin': 'Administração',
            'learning': 'Central de Aprendizado',
            'modules': 'Módulos',
            'module': 'Módulo',
            'new': 'Novo',
            'edit': 'Editar',
            'learn': 'Central de Aprendizado',
            
            // Páginas específicas
            'index': 'Início',
            'home': 'Início',
            'glassfish': 'Glassfish',
            'neotrack': 'NeoTrack',
            'kanban': 'Kanban',
            'sugestoes-dev': 'Sugestões',
            'recursos-dev': 'Recursos em Desenvolvimento',
            'user-settings': 'Configurações',
            'user-management': 'Gerenciamento de Usuários',
            'roles': 'Papéis e Permissões',
            'menus': 'Menus',
            
            // Páginas de suporte
            'login': 'Login',
            'register': 'Cadastro',
            'verify-email': 'Verificação de Email',
            'forgot-password': 'Recuperação de Senha',
            'reset-password': 'Redefinição de Senha',
            'settings': 'Configurações',
            'profile': 'Perfil'
        };

        // Mapeamento de ícones para as rotas
        const routeIcons = {
            'home': 'fa-home',
            'index': 'fa-home',
            'admin': 'fa-shield-alt',
            'learning': 'fa-graduation-cap',
            'modules': 'fa-book',
            'module': 'fa-book-open',
            'new': 'fa-plus',
            'edit': 'fa-edit',
            'learn': 'fa-graduation-cap',
            'glassfish': 'fa-server',
            'neotrack': 'fa-chart-line',
            'kanban': 'fa-columns',
            'sugestoes-dev': 'fa-lightbulb',
            'recursos-dev': 'fa-cogs',
            'user-settings': 'fa-user-cog',
            'user-management': 'fa-users',
            'roles': 'fa-user-shield',
            'menus': 'fa-bars',
            'login': 'fa-sign-in-alt',
            'register': 'fa-user-plus',
            'settings': 'fa-cog',
            'profile': 'fa-id-card'
        };

        let breadcrumbHTML = `
            <li>
                <a href="/">
                    <span class="icon">
                        <i class="fas fa-home"></i>
                    </span>
                    <span>Início</span>
                </a>
            </li>
        `;
        
        let path = '';
        pathSegments.forEach((segment, index) => {
            // Primeiro remover qualquer extensão .html do segmento para comparações
            const cleanSegment = segment.replace(/\.html$/, '');
            path += `/${segment}`;
            
            // Ignorar 'pages' no breadcrumb
            if (cleanSegment === 'pages') return;

            // Verificar se é o último item
            const isLast = index === pathSegments.length - 1;
            
            // Obter título do segmento - primeiro verificar no mapeamento, senão formatar o nome
            let title = routeTitles[cleanSegment];
            
            // Se não tiver no mapeamento, aplicar formatação
            if (!title) {
                // Se for um ID (UUID ou número), tentar obter título do elemento atual
                if (/^[0-9a-f-]+$/.test(cleanSegment) || /^\d+$/.test(cleanSegment)) {
                    const currentElement = document.querySelector('h1.title, h2.title');
                    if (currentElement) {
                        title = currentElement.textContent;
                    } else {
                        title = 'Detalhes';
                    }
                } else {
                    // Aplicar formatação padrão
                    title = this.formatSegmentTitle(cleanSegment);
                }
            }

            // Obter ícone para o segmento - primeiro olhar no mapeamento, senão usar padrão
            const icon = routeIcons[cleanSegment] || 'fa-link';

            breadcrumbHTML += `
                <li class="${isLast ? 'is-active' : ''}">
                    ${isLast ? `
                        <span class="icon">
                            <i class="fas ${icon}"></i>
                        </span>
                        <span>${title}</span>
                    ` : `
                        <a href="${path}">
                            <span class="icon">
                                <i class="fas ${icon}"></i>
                            </span>
                            <span>${title}</span>
                        </a>
                    `}
                </li>
            `;
        });
        
        breadcrumb.innerHTML = breadcrumbHTML;
    }

    formatSegmentTitle(segment) {
        // Remover extensão .html
        segment = segment.replace(/\.html$/, '');
        
        // Substituir hífens e underscores por espaços
        segment = segment.replace(/[-_]/g, ' ');

        // Verificar se há um título específico definido
        const specificTitles = {
            'index': 'Início',
            'learn': 'Central de Aprendizado',
            'admin': 'Administração',
            'sugestoes dev': 'Sugestões',
            'recursos dev': 'Recursos em Desenvolvimento',
            'user settings': 'Configurações do Usuário'
        };

        if (specificTitles[segment.toLowerCase()]) {
            return specificTitles[segment.toLowerCase()];
        }
        
        // Capitalizar primeira letra de cada palavra
        return segment.split(' ')
            .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
            .join(' ');
    }

    async loadUserSettings() {
        try {
            const token = localStorage.getItem('auth_token');
            if (!token) return;
            
            const response = await fetch('/api/auth/user/settings', {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            
            if (!response.ok) {
                throw new Error('Erro ao carregar configurações do usuário');
            }
            
            const settings = await response.json();
            
            // Atualizar tema
            if (settings.theme) {
                this.updateTheme(settings.theme === 'dark');
            }
        } catch (error) {
            console.error('Erro ao carregar configurações do usuário:', error);
        }
    }

    async saveUserSettings() {
        try {
            const token = localStorage.getItem('auth_token');
            if (!token) return;
            
            const response = await fetch('/api/auth/user/settings', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    theme: this.state.isDarkTheme ? 'dark' : 'light'
                })
            });
            
            if (!response.ok) {
                throw new Error('Erro ao salvar configurações do usuário');
            }
            
            // Salvar no localStorage
            const settings = JSON.parse(localStorage.getItem('userSettings')) || {};
            settings.theme = this.state.isDarkTheme ? 'dark' : 'light';
            localStorage.setItem('userSettings', JSON.stringify(settings));
        } catch (error) {
            console.error('Erro ao salvar configurações do usuário:', error);
        }
    }
    
    updateTheme(isDark) {
        this.state.isDarkTheme = isDark;
        
        // Atualizar classes no shadow DOM
        const navbar = this.shadowRoot.querySelector('.navbar');
        const sidebar = this.shadowRoot.querySelector('.sidebar');
        const breadcrumbContainer = this.shadowRoot.querySelector('.breadcrumb-container');
        
        if (navbar) navbar.classList.toggle('dark-theme', isDark);
        if (sidebar) sidebar.classList.toggle('dark-theme', isDark);
        if (breadcrumbContainer) breadcrumbContainer.classList.toggle('dark-theme', isDark);
        
        // Atualizar o checkbox do tema
        const themeToggle = this.shadowRoot.querySelector('#themeToggle');
        if (themeToggle) {
            themeToggle.checked = isDark;
        }
        
        // Aplicar tema ao documento
        document.body.classList.toggle('dark-theme', isDark);
    }
    
    async filterResourcesByRoles() {
        try {
            // Se o usuário for admin, mostrar todos os recursos
            if (this.state.isAdmin) {
                console.log('Usuário é admin - mostrando todos os recursos');
                
                try {
                    // Buscar todos os recursos disponíveis
                    const response = await fetch('/api/auth/user-resources', {
                        headers: {
                            'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
                        }
                    });
                    
                    if (!response.ok) {
                        console.warn('Erro ao carregar recursos do usuário:', response.status);
                        // Continuar mesmo com erro, usando recursos padrão
                        this.state.userResources = ['/'];
                        return;
                    }
                    
                    const resources = await response.json();
                    this.state.userResources = resources.map(r => r.path);
                } catch (error) {
                    console.error('Erro ao carregar recursos:', error);
                    // Continuar mesmo com erro, usando recursos padrão
                    this.state.userResources = ['/'];
                }
                
                // Disparar evento com recursos carregados
                this.dispatchEvent(new CustomEvent('user-resources-loaded', {
                    bubbles: true,
                    composed: true,
                    detail: { resources: this.state.userResources }
                }));
                
                return;
            }
            
            // Para usuários não-admin, usar recursos padrão se a API falhar
            try {
                const resources = await loadUserResources();
                this.state.userResources = resources;
                
                console.log('Recursos do usuário:', resources);
                
                // Filtrar itens do menu com base nos recursos
                filterMenuItems(resources);
            } catch (error) {
                console.error('Erro ao carregar recursos do usuário:', error);
                // Usar recursos padrão em caso de erro
                this.state.userResources = ['/'];
            }
            
            // Disparar evento com recursos carregados
            this.dispatchEvent(new CustomEvent('user-resources-loaded', {
                bubbles: true,
                composed: true,
                detail: { resources: this.state.userResources }
            }));
        } catch (error) {
            console.error('Erro ao filtrar recursos:', error);
            // Garantir que o erro não interrompa a inicialização do componente
            this.state.userResources = ['/'];
        }
    }

    // Adicionar método para atualizar ícones
    updateIcons() {
        const icons = this.shadowRoot.querySelectorAll('.fas, .far, .fa, .fab');
        icons.forEach(icon => {
            icon.style.display = 'inline-flex';
            icon.style.alignItems = 'center';
            icon.style.justifyContent = 'center';
        });
    }
}

// Registrar o componente customizado
customElements.define('neo-navbar', NeoNavbar);

// Função para carregar recursos do usuário
async function loadUserResources() {
    try {
        const token = localStorage.getItem('auth_token');
        if (!token) {
            console.log('Sem token de autenticação para carregar recursos');
            return [];
        }
        
        // Verificar se o usuário é admin
        let isAdmin = false;
        try {
            const tokenData = JSON.parse(atob(token.split('.')[1]));
            isAdmin = tokenData.roles && tokenData.roles.includes('admin');
            console.log('Verificando recursos para usuário, isAdmin:', isAdmin);
        } catch (error) {
            console.error('Erro ao decodificar token:', error);
        }
        
        // Se for admin, retornar todos os recursos
        if (isAdmin) {
            console.log('Usuário é admin - retornando todos os recursos');
            
            try {
                // Buscar todos os recursos disponíveis
                const response = await fetch('/api/auth/user-resources', {
                    headers: {
                        'Authorization': `Bearer ${token}`
                    }
                });
                
                if (!response.ok) {
                    console.error('Erro ao carregar recursos:', response.status);
                    return ['/']; // Recurso base como fallback
                }
                
                const resources = await response.json();
                const paths = resources.map(r => r.path);
                console.log('Recursos carregados para admin:', paths);
                return paths;
            } catch (error) {
                console.error('Erro na requisição de recursos para admin:', error);
                return ['/']; // Recurso base como fallback
            }
        }
        
        // Para usuários não-admin, buscar recursos específicos
        try {
            console.log('Buscando recursos específicos para usuário não-admin');
            const response = await fetch('/api/auth/user-resources', {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            
            if (!response.ok) {
                console.error('Erro ao carregar recursos do usuário:', response.status);
                return ['/']; // Recurso base como fallback
            }
            
            const data = await response.json();
            const paths = data.map(resource => resource.path);
            console.log('Recursos específicos carregados:', paths);
            return paths;
        } catch (error) {
            console.error('Erro na requisição de recursos para usuário:', error);
            return ['/']; // Recurso base como fallback
        }
    } catch (error) {
        console.error('Erro geral ao carregar recursos do usuário:', error);
        return ['/'];
    }
}

// Função para filtrar itens do menu com base nos recursos
function filterMenuItems(resources) {
    console.log('Filtrando itens do menu com recursos:', resources);
    
    // Obter todos os itens do menu
    const menuItems = document.querySelectorAll('neo-navbar').forEach(navbar => {
        const shadowRoot = navbar.shadowRoot;
        if (!shadowRoot) return;
        
        const menuLinks = shadowRoot.querySelectorAll('.menu-list a');
        
        menuLinks.forEach(link => {
            const href = link.getAttribute('href');
            if (!href) return;
            
            // Normalizar caminho para comparação
            let path = href;
            if (!path.startsWith('/pages/') && !path.startsWith('http')) {
                path = `/pages${path}`;
            }
            
            // Verificar se o usuário tem acesso ao recurso
            const hasAccess = resources.some(resource => {
                const normalizedResource = resource.startsWith('/pages/') ? resource : `/pages${resource}`;
                return normalizedResource === path;
            });
            
            // Ocultar item se não tiver acesso
            const menuItem = link.closest('li');
            if (menuItem) {
                if (hasAccess) {
                    menuItem.style.display = '';
                } else {
                    menuItem.style.display = 'none';
                }
            }
        });
    });
}