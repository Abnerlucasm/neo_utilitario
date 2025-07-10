// Template otimizado do navbar
function getNavbarTemplate(isDarkTheme = false) {
    return `
        <div class="navbar bg-base-100 shadow-lg fixed top-0 w-full z-50">
            <div class="navbar-start">
                <a href="/" class="btn btn-ghost normal-case text-xl">
                    <img src="/assets/neo-logo-small.png" alt="Neo Logo" class="h-8">
                </a>
            </div>

            <div class="navbar-end">
                <button id="userMenuBtn" class="btn btn-ghost btn-circle" title="Menu do usuário">
                        <i class="fas fa-user"></i>
                </button>

                <!-- Menu burger para mobile - sempre visível e centralizado -->
                <label for="sidebar-toggle" class="btn btn-ghost btn-circle" style="display: flex !important; align-items: center !important; justify-content: center !important;">
                    <i class="fas fa-bars" style="display: flex !important; align-items: center !important; justify-content: center !important; width: 100% !important; height: 100% !important;"></i>
                </label>
            </div>
        </div>

        <!-- Breadcrumb horizontal -->
        <div class="bg-base-200 border-b border-base-300 pt-16 pb-2 px-4">
            <ul class="breadcrumbs text-sm flex flex-wrap items-center gap-2" style="display: flex !important; flex-direction: row !important;">
                <!-- Breadcrumb será gerado dinamicamente -->
            </ul>
        </div>

        <!-- Sidebar drawer -->
        <div class="drawer drawer-end">
            <input id="sidebar-toggle" type="checkbox" class="drawer-toggle" />
            <div class="drawer-side z-50">
                <label for="sidebar-toggle" aria-label="close sidebar" class="drawer-overlay"></label>
                <div class="menu p-4 w-80 min-h-full bg-base-100 text-base-content">
                    <div class="flex items-center gap-4 p-4 border-b border-base-300 mb-4">
                        <div class="avatar placeholder">
                            <div class="bg-neutral text-neutral-content rounded-full w-12">
                        <i class="fas fa-user"></i>
                            </div>
                    </div>
                    <div>
                            <div id="userName" class="font-semibold">Carregando...</div>
                            <div id="userRole" class="text-sm opacity-70">...</div>
                        </div>
                    </div>
                    
                    <ul class="menu-list"></ul>
                </div>
            </div>
        </div>
    `;
}

class NeoNavbar extends HTMLElement {
    constructor() {
        super();
        
        // Estado simplificado
        this.state = {
            isDarkTheme: false,
            menus: [],
            isAdmin: false,
            initialized: false
        };
        
        // Carregar tema do localStorage
        const savedSettings = JSON.parse(localStorage.getItem('userSettings')) || {};
        this.state.isDarkTheme = savedSettings.theme === 'dark';
    }

    async connectedCallback() {
        try {
            // Evitar inicialização duplicada
            if (this.state.initialized) return;
            
            // Carregar template
            const template = getNavbarTemplate(this.state.isDarkTheme);
            this.innerHTML = template;

            // Garantir FontAwesome e CSS
            this.ensureFontAwesome();
            this.ensureDaisyUI();

            // Inicializar
            await this.initialize();
            
            this.state.initialized = true;
        } catch (error) {
            console.error('Erro ao inicializar navbar:', error);
        }
    }

    ensureFontAwesome() {
            if (!document.querySelector('link[href*="font-awesome"]')) {
                const fontAwesome = document.createElement('link');
                fontAwesome.rel = 'stylesheet';
                fontAwesome.href = 'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css';
                document.head.appendChild(fontAwesome);
        }
    }

    ensureDaisyUI() {
        // Garantir que o DaisyUI esteja carregado
        if (!document.querySelector('link[href*="daisyui"]')) {
            const daisyUI = document.createElement('link');
            daisyUI.rel = 'stylesheet';
            daisyUI.href = 'https://cdn.jsdelivr.net/npm/daisyui@5/dist/full.css';
            document.head.appendChild(daisyUI);
        }

        // Garantir que o Tailwind esteja configurado
        if (!window.tailwind) {
            const script = document.createElement('script');
            script.src = 'https://cdn.tailwindcss.com';
            script.onload = () => {
                if (window.tailwind) {
                    window.tailwind.config = {
                        daisyui: {
                            themes: [
                                "light", "dark", "cupcake", "bumblebee", "emerald", "corporate", 
                                "synthwave", "retro", "cyberpunk", "valentine", "halloween", 
                                "garden", "forest", "aqua", "lofi", "pastel", "fantasy", 
                                "wireframe", "black", "luxury", "dracula", "cmyk", "autumn", 
                                "business", "acid", "lemonade", "night", "coffee", "winter",
                                "dim", "nord", "sunset", "caramellatte", "abyss", "silk"
                            ]
                        }
                    };
                }
            };
            document.head.appendChild(script);
        }

        // Adicionar CSS específico para garantir que o navbar funcione corretamente
        const styleId = 'navbar-custom-styles';
        if (!document.getElementById(styleId)) {
            const style = document.createElement('style');
            style.id = styleId;
            style.textContent = `
                /* Garantir que o navbar seja sempre visível */
                .navbar {
                    position: fixed !important;
                    top: 0 !important;
                    width: 100% !important;
                    z-index: 50 !important;
                    background-color: hsl(var(--b1)) !important;
                    box-shadow: 0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1) !important;
                }
                
                /* Garantir que o menu burger seja sempre visível */
                .navbar-end label[for="sidebar-toggle"] {
                    display: flex !important;
                    align-items: center !important;
                    justify-content: center !important;
                }
                
                .navbar-end .btn-ghost.btn-circle {
                    display: flex !important;
                    align-items: center !important;
                    justify-content: center !important;
                }
                
                /* Garantir que o breadcrumb seja horizontal */
                .breadcrumbs {
                    display: flex !important;
                    flex-direction: row !important;
                    align-items: center !important;
                    gap: 0.5rem !important;
                    flex-wrap: wrap !important;
                }
                
                /* Garantir que o drawer funcione corretamente */
                .drawer {
                    position: relative !important;
                }
                
                .drawer-side {
                    position: fixed !important;
                    top: 0 !important;
                    right: 0 !important;
                    height: 100vh !important;
                    z-index: 50 !important;
                }
                
                /* Garantir que os ícones sejam visíveis */
                .fas, .far, .fal, .fab {
                    font-family: "Font Awesome 6 Free" !important;
                    font-weight: 900 !important;
                }
                
                /* Garantir que o tema seja aplicado corretamente */
                [data-theme] {
                    color-scheme: light dark;
                }
                
                /* Garantir que o conteúdo não fique sob o navbar */
                body {
                    padding-top: 4rem !important;
                }
            `;
            document.head.appendChild(style);
        }
    }

    async initialize() {
        try {
            // Carregar configurações e verificar autenticação
            await this.loadUserSettings();
            await this.checkUserAuth();
            
            // Carregar menus dinamicamente
            await this.loadMenus();
            
            // Configurar eventos
            this.setupEventListeners();
            
            // Atualizar componentes
            this.updateBreadcrumb();
            this.highlightCurrentPage();
        } catch (error) {
            console.error('Erro na inicialização do navbar:', error);
        }
    }

    async checkUserAuth() {
        try {
            const token = localStorage.getItem('auth_token');
            if (!token) return;

            const tokenData = JSON.parse(atob(token.split('.')[1]));
            this.state.isAdmin = tokenData.roles && tokenData.roles.includes('admin');
            this.updateUserInfo(tokenData);
        } catch (error) {
            console.error('Erro ao verificar autenticação:', error);
        }
    }

    updateUserInfo(tokenData) {
        const userName = this.querySelector('#userName');
        const userRole = this.querySelector('#userRole');
        
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
            const token = localStorage.getItem('auth_token');
            if (!token) {
                this.renderEmptyMenu();
                return;
            }
            
            // Carregar menus da API
            const response = await fetch('/api/menus', {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (!response.ok) {
                throw new Error(`Erro ${response.status}: ${response.statusText}`);
            }

            const menus = await response.json();
            this.state.menus = this.transformMenus(menus);
            this.renderMenus();
        } catch (error) {
            console.error('Erro ao carregar menus:', error);
            this.renderEmptyMenu();
        }
    }

    transformMenus(menus) {
        if (!Array.isArray(menus)) return [];
        
        return menus.map(menu => ({
                id: menu.id,
                titulo: menu.title,
                url: menu.path,
                icon: menu.icon,
                isAdminOnly: menu.isAdminOnly,
                isActive: menu.isActive,
            resourcePath: menu.resourcePath || menu.path,
            submenu: menu.children ? this.transformMenus(menu.children) : []
        }));
    }

    renderMenus() {
        const menuList = this.querySelector('.menu-list');
        if (!menuList) return;

        // Filtrar menus baseado em permissões
        const filteredMenus = this.state.menus.filter(menu => {
            if (menu.isAdminOnly && !this.state.isAdmin) return false;
            if (!menu.isActive) return false;
            return true;
        });

        if (filteredMenus.length === 0) {
            this.renderEmptyMenu();
            return;
        }

        const menuHtml = filteredMenus.map(menu => this.renderMenuItem(menu)).join('');
        menuList.innerHTML = menuHtml;
    }

    renderMenuItem(menu) {
        const hasSubmenu = menu.submenu && menu.submenu.length > 0;
        
        if (hasSubmenu) {
            const submenuHtml = menu.submenu
                .filter(submenu => !submenu.isAdminOnly || this.state.isAdmin)
                .filter(submenu => submenu.isActive)
                .map(submenu => this.renderMenuItem(submenu))
                .join('');

            return `
                <li>
                    <details>
                        <summary class="flex items-center gap-2">
                            <i class="${menu.icon || 'fas fa-circle'}"></i>
                            <span>${menu.titulo}</span>
                        </summary>
                        <ul class="menu menu-compact">
                            ${submenuHtml}
                            </ul>
                    </details>
                        </li>
                    `;
                } else {
            const isExternal = menu.url.startsWith('http');
            return `
                <li>
                    <a href="${menu.url}" ${isExternal ? 'target="_blank" rel="noopener noreferrer"' : ''} class="flex items-center gap-2">
                        <i class="${menu.icon || 'fas fa-circle'}"></i>
                        <span>${menu.titulo}</span>
                    </a>
                </li>
            `;
        }
    }

    renderEmptyMenu() {
        const menuList = this.querySelector('.menu-list');
        if (!menuList) return;

        menuList.innerHTML = `
            <li>
                <a href="/pages/user-settings.html" class="flex items-center gap-2">
                    <i class="fas fa-user-cog"></i>
                    <span>Configurações</span>
                            </a>
                        </li>
                    `;
    }
    
    setupEventListeners() {
        // Botão do usuário
        const userMenuBtn = this.querySelector('#userMenuBtn');
        if (userMenuBtn) {
            userMenuBtn.addEventListener('click', () => {
                window.location.href = '/pages/user-settings.html';
            });
        }

        // Painel de informações do usuário
        const userInfoPanel = this.querySelector('.avatar');
        if (userInfoPanel) {
            userInfoPanel.addEventListener('click', () => {
                window.location.href = '/pages/user-settings.html';
            });
        }
    }

    highlightCurrentPage() {
        const currentPath = window.location.pathname;
        const links = this.querySelectorAll('.menu-list a');
        
        links.forEach(link => {
            const linkPath = link.getAttribute('href');
            
            if (linkPath === currentPath || 
                (currentPath.endsWith('/') && linkPath === currentPath + 'index.html') ||
                (linkPath.endsWith('/index.html') && currentPath === linkPath.replace('index.html', ''))) {
                link.classList.add('active');
                
                const parentDetails = link.closest('details');
                if (parentDetails) {
                    parentDetails.setAttribute('open', '');
                }
            }
        });
    }

    updateBreadcrumb() {
        const breadcrumb = this.querySelector('.breadcrumbs');
        if (!breadcrumb) return;

        // Garantir que o breadcrumb seja horizontal
        breadcrumb.style.display = 'flex';
        breadcrumb.style.flexDirection = 'row';
        breadcrumb.style.alignItems = 'center';
        breadcrumb.style.gap = '0.5rem';
        breadcrumb.style.flexWrap = 'wrap';

        const pathSegments = window.location.pathname.split('/').filter(segment => segment);

        // Mapeamento simplificado de títulos
        const routeTitles = {
            'admin': 'Administração',
            'learning': 'Central de Aprendizado',
            'user-settings': 'Configurações',
            'user-management': 'Gerenciamento de Usuários',
            'roles': 'Papéis e Permissões',
            'menus': 'Menus',
            'glassfish': 'Glassfish',
            'neotrack': 'NeoTrack',
            'consultabd': 'Consulta Banco de Dados'
        };

        const routeIcons = {
            'admin': 'fa-shield-alt',
            'learning': 'fa-graduation-cap',
            'user-settings': 'fa-user-cog',
            'user-management': 'fa-users',
            'roles': 'fa-user-shield',
            'menus': 'fa-bars',
            'glassfish': 'fa-server',
            'neotrack': 'fa-chart-line',
            'consultabd': 'fa-database'
        };

        let breadcrumbHTML = `
            <li style="display: flex; align-items: center;">
                <a href="/" class="flex items-center gap-2">
                        <i class="fas fa-home"></i>
                    <span>Início</span>
                </a>
            </li>
        `;
        
        let path = '';
        pathSegments.forEach((segment, index) => {
            const cleanSegment = segment.replace(/\.html$/, '').replace(/[-_]/g, ' ');
            path += `/${segment}`;
            
            if (cleanSegment === 'pages') return;

            const isLast = index === pathSegments.length - 1;
            const title = routeTitles[cleanSegment] || this.formatSegmentTitle(cleanSegment);
            const icon = routeIcons[cleanSegment] || 'fa-link';

            breadcrumbHTML += `
                <li class="${isLast ? 'text-base-content font-semibold' : ''}" style="display: flex; align-items: center;">
                    ${isLast ? `
                        <span class="flex items-center gap-2">
                            <i class="fas ${icon}"></i>
                            <span>${title}</span>
                        </span>
                    ` : `
                        <a href="${path}" class="flex items-center gap-2 hover:text-primary">
                                <i class="fas ${icon}"></i>
                            <span>${title}</span>
                        </a>
                    `}
                </li>
            `;
        });
        
        breadcrumb.innerHTML = breadcrumbHTML;
    }

    formatSegmentTitle(segment) {
        segment = segment.replace(/\.html$/, '').replace(/[-_]/g, ' ');
        return segment.split(' ')
            .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
            .join(' ');
    }

    async loadUserSettings() {
        try {
            // Carregar configurações básicas do usuário
            const savedSettings = JSON.parse(localStorage.getItem('userSettings')) || {};
            
            // Aplicar tema salvo (se houver)
            const theme = savedSettings.theme || 'light';
            document.documentElement.setAttribute('data-theme', theme);
            this.state.isDarkTheme = theme === 'dark';
        } catch (error) {
            console.error('Erro ao carregar configurações:', error);
        }
    }
}

// Registrar componente
if (!customElements.get('neo-navbar')) {
customElements.define('neo-navbar', NeoNavbar);
}