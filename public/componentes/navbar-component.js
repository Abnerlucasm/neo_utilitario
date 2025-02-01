class NeoNavbar extends HTMLElement {
    constructor() {
        super();
        this.attachShadow({ mode: 'open' });
        this.navigationHistory = [];
        // Definir a estrutura de navegação
        this.navigationStructure = {
            'index.html': { title: 'Início', parent: null },
            'utilitarios.html': { title: 'Utilitários', parent: 'index.html' },
            'glassfish.html': { title: 'Utilitário Web', parent: 'utilitarios.html' },
            'utilitarios-neodesktop.html': { title: 'Neocorp Desktop', parent: 'utilitarios.html' },
            'utilitarios-bd.html': { title: 'Banco de Dados', parent: 'utilitarios.html' },
            'utilitarios-chamados.html': { title: 'Neo Chamados', parent: 'utilitarios.html' },
            'config.html': { title: 'Configurar Ambiente', parent: 'index.html' },
            'rotinas.html': { title: 'Rotinas', parent: 'index.html' },
            'recursos-dev.html': { title: 'Recursos em Desenvolvimento', parent: 'index.html' },
            'sugestoes-dev.html': { title: 'Sugestões de Desenvolvimento', parent: 'index.html' },
            'neotrack.html': { title: 'NeoTrack', parent: 'utilitarios.html' }
        };
    }

    connectedCallback() {
        this.render();
        // Aguardar o próximo ciclo de renderização
        requestAnimationFrame(() => {
            this.setupTheme();
            this.addEventListeners();
            this.highlightCurrentPage();
            this.updateBreadcrumb();
        });
    }

    setupTheme() {
        const userSettings = JSON.parse(localStorage.getItem('userSettings')) || {};
        if (userSettings.theme === 'dark') {
            const navbar = this.shadowRoot.querySelector('.navbar');
            if (navbar) {
                navbar.classList.add('dark-theme');
            }
        }

        // Observar mudanças no tema
        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                if (mutation.attributeName === 'class') {
                    const navbar = this.shadowRoot.querySelector('.navbar');
                    if (navbar) {
                        if (document.body.classList.contains('dark-theme')) {
                            navbar.classList.add('dark-theme');
                        } else {
                            navbar.classList.remove('dark-theme');
                        }
                    }
                }
            });
        });

        observer.observe(document.body, {
            attributes: true,
            attributeFilter: ['class']
        });
    }

    render() {
        const userSettings = JSON.parse(localStorage.getItem('userSettings')) || {};
        const isDark = userSettings.theme === 'dark';
        
        this.shadowRoot.innerHTML = `
            <style>
                * {
                    box-sizing: border-box;
                    margin: 0;
                    padding: 0;
                }

                /* Navbar Styles */
                .navbar {
                    background: white;
                    box-shadow: 0 2px 4px rgba(0,0,0,0.1);
                    padding: 0.5rem 1rem;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    height: 60px;
                    position: fixed;
                    top: 0;
                    width: 100%;
                    z-index: 1000;
                }

                .navbar-brand {
                    display: flex;
                    align-items: center;
                    cursor: pointer;
                    transition: transform 0.2s ease;
                }

                .navbar-brand:hover {
                    transform: scale(1.02);
                }

                .navbar-brand img {
                    height: 40px;
                }

                /* Breadcrumb Styles */
                .breadcrumb-container {
                    background: #f8f9fa;
                    padding: 0.8rem 1rem;
                    margin-top: 60px;
                    border-bottom: 1px solid #e9ecef;
                }

                .breadcrumb {
                    list-style: none;
                    display: flex;
                    align-items: center;
                    gap: 0.5rem;
                    font-size: 0.95rem;
                    flex-wrap: wrap;
                    padding: 0;
                    margin: 0;
                }

                .breadcrumb li {
                    display: flex;
                    align-items: center;
                }

                .breadcrumb li:not(:last-child)::after {
                    content: '›';
                    margin: 0 0.5rem;
                    color: #6c757d;
                    font-size: 1.4rem;
                    line-height: 1;
                }

                .breadcrumb a {
                    color:rgb(106, 160, 12);
                    text-decoration: none;
                    transition: all 0.2s ease;
                    padding: 0.3rem 0.6rem;
                    border-radius: 4px;
                    display: flex;
                    align-items: center;
                    gap: 0.3rem;
                }

                .breadcrumb a:not(.is-active)::before {
                    content: '←';
                    opacity: 0;
                    transition: all 0.2s ease;
                    transform: translateX(5px);
                }

                .breadcrumb a:hover::before {
                    opacity: 1;
                    transform: translateX(0);
                }

                .breadcrumb a:hover {
                    background-color: rgba(33, 150, 243, 0.1);
                    transform: translateX(-3px);
                }

                .breadcrumb .is-active a {
                    color: #333;
                    font-weight: 500;
                    pointer-events: none;
                }

                /* Menu Toggle Button aprimorado */
                .menu-toggle {
                    background: rgba(33, 150, 243, 0.1);
                    border: 2px solid rgb(45, 45, 45);
                    border-radius: 8px;
                    font-size: 20px;
                    color: rgb(45, 45, 45);
                    cursor: pointer;
                    padding: 8px 12px;
                    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                }

                .menu-toggle:hover {
                    background:rgb(140, 200, 105);
                    color: white;
                    transform: scale(1.05);
                }

                /* Sidebar Styles Aprimorados */
                .sidebar {
                    height: 100vh;
                    width: 280px;
                    position: fixed;
                    top: 0;
                    right: -280px;
                    background: white;
                    transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
                    z-index: 1001;
                    box-shadow: -2px 0 5px rgba(0,0,0,0.1);
                    padding: 1rem;
                    padding-top: 60px;
                    overflow-y: auto;
                    border-top-left-radius: 16px;
                    border-bottom-left-radius: 16px;
                }

                .sidebar.active {
                    right: 0;
                    transform: translateX(0);
                }

                .close-sidebar {
                    position: absolute;
                    top: 20px;
                    right: 20px;
                    background: none;
                    border: none;
                    font-size: 28px;
                    color: #333;
                    cursor: pointer;
                    width: 40px;
                    height: 40px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    border-radius: 50%;
                    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
                }

                .close-sidebar:hover {
                    background: rgba(0, 0, 0, 0.05);
                    transform: rotate(90deg);
                }

                /* Menu List atualizado - removendo dots */
                .menu-list {
                    list-style: none;
                    padding: 0;
                    margin: 0;
                }

                .menu-list li {
                    margin: 8px 0;
                }

                .menu-list a {
                    display: flex;
                    align-items: center;
                    gap: 0.8rem;
                    padding: 12px 16px;
                    color: #333;
                    text-decoration: none;
                    border-radius: 8px;
                    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
                    font-size: 1.1rem;
                    font-weight: 500;
                    letter-spacing: 0.3px;
                }

                .menu-list a:hover {
                    background: rgba(33, 150, 243, 0.1);
                    transform: translateX(5px);
                    color: #2196F3;
                }

                .menu-list a.active {
                    background: #2196F3;
                    color: white;
                    font-weight: 600;
                }

                .menu-list .icon {
                    font-size: 1.3rem;
                    min-width: 24px;
                    text-align: center;
                }

                /* Submenu atualizado */
                .submenu {
                    margin-left: 2.5rem; /* Aumentado para alinhar com o texto do item pai */
                    border-left: 2px solid #e0e0e0;
                    margin-top: 0.5rem;
                    margin-bottom: 0.5rem;
                    padding-left: 0;
                }

                .submenu li {
                    margin: 4px 0;
                }

                .submenu a {
                    font-size: 1rem;
                    padding: 8px 16px;
                }

                /* Overlay Animation */
                .overlay {
                    position: fixed;
                    top: 0;
                    left: 0;
                    width: 100%;
                    height: 100%;
                    background: rgba(0,0,0,0.5);
                    opacity: 0;
                    visibility: hidden;
                    transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
                    z-index: 1000;
                    backdrop-filter: blur(3px);
                }

                .overlay.active {
                    opacity: 1;
                    visibility: visible;
                }

                /* Estilos para o tema escuro */
                .navbar.dark-theme {
                    background-color: #2c2d31 !important;
                    border-bottom: 1px solid #404246;
                }

                .navbar.dark-theme .navbar-item,
                .navbar.dark-theme .navbar-link {
                    color: #ffffff !important;
                }

                .navbar.dark-theme .navbar-item:hover,
                .navbar.dark-theme .navbar-link:hover {
                    background-color: #3a3b3f !important;
                    color: #3273dc !important;
                }
            </style>

            <nav class="navbar ${isDark ? 'dark-theme' : ''}" role="navigation" aria-label="main navigation">
                <div class="navbar-brand">
                    <a class="navbar-item" href="/">
                        <img src="/assets/neo-logo-small.png" alt="Neo Logo">
                    </a>
                    <a role="button" class="navbar-burger" aria-label="menu" aria-expanded="false">
                        <span aria-hidden="true"></span>
                        <span aria-hidden="true"></span>
                        <span aria-hidden="true"></span>
                    </a>
                </div>
                <div class="navbar-menu">
                    <button class="menu-toggle">☰</button>
                </div>
            </nav>

            <div class="breadcrumb-container">
                <ul class="breadcrumb">
                    <li><a href="/">Início</a></li>
                    <li class="is-active"><a href="#" aria-current="page">Página Atual</a></li>
                </ul>
            </div>

            <div class="overlay"></div>

            <div class="sidebar">
                <button class="close-sidebar">×</button>
                <nav>
                    <ul class="menu-list">
                        <li><a href="index.html"><span class="icon">🏠</span>Menu Principal</a></li>
                        <li><a href="../config.html"><span class="icon">⚙️</span>Configurar Ambiente</a></li>
                        <li><a href="rotinas.html"><span class="icon">📋</span>Rotinas</a></li>
                        <li class="submenu-parent">
                            <a href="utilitarios.html"><span class="icon">🔧</span>Utilitários</a>
                            <ul class="submenu">
                                <li><a href="glassfish.html">NeoWeb</a></li>
                                <li><a href="utilitarios-neodesktop.html">Neocorp Desktop</a></li>
                                <li><a href="utilitarios-bd.html">Banco de Dados</a></li>
                                <li><a href="utilitarios-chamados.html">Neo Chamados</a></li>
                                <li><a href="neotrack.html">NeoTrack</a></li>
                            </ul>
                        </li>
                        <li><a href="recursos-dev.html"><span class="icon">🚀</span>Recursos em Desenvolvimento</a></li>
                        <li><a href="sugestoes-dev.html"><span class="icon">💡</span>Sugestões de Desenvolvimento</a></li>
                    </ul>
                </nav>
            </div>
        `;

        // Adicionar índices aos itens do menu para animação
        const menuItems = this.shadowRoot.querySelectorAll('.menu-list li');
        menuItems.forEach((item, index) => {
            item.style.setProperty('--index', index);
        });
    }

    updateBreadcrumb() {
        const currentPath = window.location.pathname.split('/').pop() || 'index.html';
        const breadcrumbPath = this.getBreadcrumbPath(currentPath);
        const breadcrumbList = this.shadowRoot.querySelector('.breadcrumb');

        breadcrumbList.innerHTML = breadcrumbPath
            .map((item, index) => {
                const isLast = index === breadcrumbPath.length - 1;
                return `
                    <li class="${isLast ? 'is-active' : ''}">
                        <a href="/${item.path}" ${isLast ? 'aria-current="page"' : ''} 
                           title="${isLast ? 'Página atual' : 'Voltar para ' + item.title}">
                            ${item.title}
                        </a>
                    </li>
                `;
            })
            .join('');
    }

    getBreadcrumbPath(currentPath) {
        const path = [];
        let current = currentPath;

        // Construir o caminho do breadcrumb
        while (current) {
            const pageInfo = this.navigationStructure[current];
            if (!pageInfo) break;

            path.unshift({
                path: current,
                title: pageInfo.title
            });

            current = pageInfo.parent;
        }

        return path;
    }

    addEventListeners() {
        // Verificar se os elementos existem antes de adicionar os listeners
        const menuToggle = this.shadowRoot.querySelector('.menu-toggle');
        const closeButton = this.shadowRoot.querySelector('.close-sidebar');
        const sidebar = this.shadowRoot.querySelector('.sidebar');
        const overlay = this.shadowRoot.querySelector('.overlay');
        const logoHome = this.shadowRoot.querySelector('#logo-home');

        if (menuToggle && sidebar && overlay) {
            menuToggle.addEventListener('click', () => {
                sidebar.classList.toggle('active');
                overlay.classList.toggle('active');
            });
        }

        if (closeButton && sidebar && overlay) {
            closeButton.addEventListener('click', () => {
                sidebar.classList.remove('active');
                overlay.classList.remove('active');
            });
        }

        if (overlay && sidebar) {
            overlay.addEventListener('click', () => {
                sidebar.classList.remove('active');
                overlay.classList.remove('active');
            });
        }

        // Atualizar os listeners do breadcrumb
        const breadcrumbLinks = this.shadowRoot.querySelectorAll('.breadcrumb a');
        breadcrumbLinks.forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const path = link.getAttribute('href');
                if (path) {
                    window.location.href = path;
                }
            });
        });

        // Observar mudanças na navegação
        window.addEventListener('popstate', () => {
            this.updateBreadcrumb();
        });

        // Adicionar evento de clique no logo
        if (logoHome) {
            logoHome.addEventListener('click', () => {
                window.location.href = '/';
            });
        }

        // Adicionar event listeners para links do menu
        const menuLinks = this.shadowRoot.querySelectorAll('.menu-list a');
        menuLinks.forEach(link => {
            link.addEventListener('click', (e) => {
                menuLinks.forEach(l => l.classList.remove('is-active'));
                link.classList.add('is-active');
            });
        });
    }

    highlightCurrentPage() {
        const currentPath = window.location.pathname.split('/').pop();
        const links = this.shadowRoot.querySelectorAll('.menu-list a');
        
        links.forEach(link => {
            const href = link.getAttribute('href').split('/').pop();
            if (href === currentPath) {
                link.classList.add('active');
            } else {
                link.classList.remove('active');
            }
        });
    }
}

customElements.define('neo-navbar', NeoNavbar);
