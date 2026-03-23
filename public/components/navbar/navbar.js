// Template otimizado do navbar
function getNavbarTemplate() {
    return `
        <nav class="navbar fixed top-0 w-full z-50 backdrop-blur-md shadow-lg">
            <div class="navbar-start">
                <a href="/" class="btn btn-ghost normal-case text-xl">
                    <img src="/assets/neo-logo-small.png" alt="Neo Logo" class="h-8">
                </a>
            </div>
            <div class="navbar-end">
                <modern-theme-selector></modern-theme-selector>
                <button id="userMenuBtn" class="btn btn-ghost btn-circle" title="Menu do usuário">
                    <div class="avatar">
                        <div class="w-8 rounded-full">
                            <img id="navbarAvatar" src="/assets/avatar-default.png" alt="Avatar">
                        </div>
                    </div>
                </button>
                <label for="sidebar-toggle" class="btn btn-ghost btn-circle">
                    <i class="fas fa-bars"></i>
                </label>
            </div>
        </nav>
        <div class="drawer drawer-end">
            <input id="sidebar-toggle" type="checkbox" class="drawer-toggle" />
            <div class="drawer-side z-50">
                <label for="sidebar-toggle" aria-label="close sidebar" class="drawer-overlay"></label>
                <div class="menu p-4 w-80 min-h-full bg-base-100 text-base-content">
                    <div class="flex items-center gap-4 p-4 border-b border-base-300 mb-4">
                        <div class="avatar">
                            <div class="w-16 rounded-full ring ring-primary ring-offset-base-100 ring-offset-2">
                                <img id="sidebarAvatar" src="/assets/avatar-default.png" alt="Avatar">
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

    }

    async connectedCallback() {
        try {
            // Evitar inicialização duplicada
            if (this.state.initialized) return;

            // Carregar template
            this.innerHTML = getNavbarTemplate();

            // Garantir FontAwesome e CSS
            this.ensureFontAwesome();
            this.ensureDaisyUI();
            await this.ensureScript()

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
        if (!window.tailwind) {
            const script = document.createElement('script');
            script.src = 'https://cdn.tailwindcss.com';
            document.head.appendChild(script);
        }

        if (!document.querySelector('link[href*="daisyui"]')) {

            const daisyBase = document.createElement('link');
            daisyBase.rel = 'stylesheet';
            daisyBase.href = 'https://cdn.jsdelivr.net/npm/daisyui@latest/dist/full.css';

            document.head.appendChild(daisyBase);
        }
    }

    ensureScript() {
        return new Promise((resolve) => {
            if (document.querySelector('script[src="/js/avatar-manager.js"]')) {
                resolve();
                return;
            }
            const script = document.createElement('script');
            script.src = '/js/avatar-manager.js';
            script.onload = resolve;
            script.onerror = resolve; 
            document.head.appendChild(script);
        });
    }

    async initialize() {
        try {
            // Carregar configurações e verificar autenticação
            await this.checkUserAuth();

            // Carregar menus dinamicamente
            await this.loadMenus();

            // Configurar eventos
            this.setupEventListeners();

            // Atualizar componentes
            this.highlightCurrentPage();
        } catch (error) {
            console.error('Erro na inicialização do navbar:', error);
        }
    }

    async checkUserAuth() {
        try {
            const token = localStorage.getItem('auth_token');
            if (!token) {
                console.log('Navbar: Nenhum token encontrado');
                return;
            }

            const tokenData = JSON.parse(atob(token.split('.')[1]));
            this.state.isAdmin = tokenData.roles && tokenData.roles.includes('admin');
            console.log('Navbar: Token decodificado:', tokenData);
            console.log('Navbar: Usuário é admin?', this.state.isAdmin);
            this.updateUserInfo(tokenData);
        } catch (error) {
            console.error('Erro ao verificar autenticação:', error);
        }
    }

    updateUserInfo(tokenData) {
        const userName = this.querySelector('#userName');
        const userRole = this.querySelector('#userRole');
        const navbarAvatar = this.querySelector('#navbarAvatar');
        const sidebarAvatar = this.querySelector('#sidebarAvatar');

        if (userName) {
            userName.textContent = tokenData.email ? tokenData.email.split('@')[0] : 'Usuário';
        }
        if (userRole) {
            const roles = tokenData.roles || [];
            userRole.textContent = roles.length > 0 ? roles.join(', ') : 'Usuário';
        }

        // Atualizar avatares usando o AvatarManager se disponível
        if (window.avatarManager && tokenData.id) {
            window.avatarManager.updateAvatarElement(tokenData.id, navbarAvatar);
            window.avatarManager.updateAvatarElement(tokenData.id, sidebarAvatar);
        } else {
            // Fallback para avatar padrão
            const avatarUrl = tokenData.avatar || '/assets/avatar-default.png';
            if (navbarAvatar) {
                navbarAvatar.src = avatarUrl;
            }
            if (sidebarAvatar) {
                sidebarAvatar.src = avatarUrl;
            }
        }
    }

    async loadMenus() {
        try {
            const token = localStorage.getItem('auth_token');
            if (!token) {
                console.log('Navbar: Nenhum token para carregar menus');
                this.renderEmptyMenu();
                return;
            }

            console.log('Navbar: Carregando menus da API...');

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
            console.log('Navbar: Menus carregados da API:', menus.length, 'menus');

            this.state.menus = this.transformMenus(menus);
            console.log('Navbar: Menus transformados:', this.state.menus.length, 'menus');

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
            isAdminOnly: menu.is_admin_only,
            isActive: menu.is_active,
            resourcePath: menu.resource_path || menu.path,
            submenu: menu.children ? this.transformMenus(menu.children) : []
        }));
    }

    renderMenus() {
        const menuList = this.querySelector('.menu-list');
        if (!menuList) return;

        // Filtrar menus baseado em permissões e status
        const filterMenus = (menus) => {
            return menus
                .filter(menu => menu.isActive && (!menu.isAdminOnly || this.state.isAdmin))
                .map(menu => ({
                    ...menu,
                    submenu: menu.submenu ? filterMenus(menu.submenu) : []
                }));
        };

        const filteredMenus = filterMenus(this.state.menus);

        if (filteredMenus.length === 0) {
            this.renderEmptyMenu();
            return;
        }

        // Renderizar hierarquia recursivamente
        menuList.innerHTML = this.renderMenuTree(filteredMenus);
    }

    renderMenuTree(menus) {
        return menus.map(menu => this.renderMenuItem(menu)).join('');
    }

    renderMenuItem(menu) {
        const hasSubmenu = menu.submenu && menu.submenu.length > 0;

        if (hasSubmenu) {
            return `
                <li>
                    <details>
                        <summary class="flex items-center gap-2">
                            <i class="${menu.icon || 'fas fa-circle'}"></i>
                            <span>${menu.titulo}</span>
                        </summary>
                        <ul class="menu menu-compact ml-4">
                            ${this.renderMenuTree(menu.submenu)}
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

    formatSegmentTitle(segment) {
        segment = segment.replace(/\.html$/, '').replace(/[-_]/g, ' ');
        return segment.split(' ')
            .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
            .join(' ');
    }
}

// Registrar componente
if (!customElements.get('neo-navbar')) {
    customElements.define('neo-navbar', NeoNavbar);
}