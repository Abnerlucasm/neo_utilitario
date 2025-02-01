// Importar CSS como módulo
const cssPromise = fetch('/components/navbar/navbar.css')
    .then(response => response.text())
    .then(css => {
        const sheet = new CSSStyleSheet();
        sheet.replaceSync(css);
        return sheet;
    });

// Importar template
const templatePromise = import('./navbar.template.js')
    .then(module => module.getNavbarTemplate);

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

    async connectedCallback() {
        // Carregar CSS e template
        const [sheet, getTemplate] = await Promise.all([
            cssPromise,
            templatePromise
        ]);
        
        // Aplicar estilos
        this.shadowRoot.adoptedStyleSheets = [sheet];
        
        // Renderizar com o template
        this.render(getTemplate);
        
        // Resto das inicializações
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

    render(getTemplate) {
        const userSettings = JSON.parse(localStorage.getItem('userSettings')) || {};
        const isDark = userSettings.theme === 'dark';
        
        // Usar o template
        this.shadowRoot.innerHTML = getTemplate(isDark);

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
