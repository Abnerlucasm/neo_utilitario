class NavbarComponent extends HTMLElement {
    constructor() {
        super();
        this.attachShadow({ mode: 'open' });
    }

    connectedCallback() {
        this.render();
        this.addEventListeners();
        this.highlightCurrentPage();
        this.updateMenuIconColor();
        window.addEventListener('scroll', () => this.updateMenuIconColor());
    }

    render() {
        this.shadowRoot.innerHTML = `
            <style>
                * {
                    box-sizing: border-box;
                    margin: 0;
                    padding: 0;
                }
                .sidebar {
                    height: 100vh;
                    width: 250px;
                    position: fixed;
                    top: 0;
                    left: 0;
                    background: #f5f5f5;
                    transform: translateX(-100%);
                    transition: transform 0.3s ease-in-out, background 0.2s;
                    z-index: 1000;
                    padding: 20px;
                    box-shadow: 4px 0 10px rgba(0, 0, 0, 0.1);
                    overflow-y: auto;
                    border-top-right-radius: 16px;
                    border-bottom-right-radius: 16px;
                    padding-top: 100px;
                }
                .sidebar.active {
                    transform: translateX(0);
                }
                .menu-toggle {
                    position: absolute;
                    top: 15px;
                    left: 20px;
                    z-index: 1100;
                    background: rgba(255, 255, 255, 0.2);
                    border: none;
                    cursor: pointer;
                    font-size: 28px;
                    transition: all 0.3s ease;
                    margin-left: 20px; 
                    margin-top: 20px;
                    padding: 8px 12px;
                    border-radius: 8px;
                    backdrop-filter: blur(5px);
                    -webkit-backdrop-filter: blur(5px);
                }
                .menu-toggle.light {
                    color: #ffffff;
                    text-shadow: 0 2px 4px rgba(0, 0, 0, 0.5);
                    background: rgba(255, 255, 255, 0.15);
                }
                .menu-toggle.dark {
                    color: #555555;
                    text-shadow: none;
                    background: rgba(0, 0, 0, 0.05);
                }
                .menu-toggle:hover {
                    transform: scale(1.1);
                }
                .menu-toggle.light:hover {
                    background: rgba(255, 255, 255, 0.25);
                }
                .menu-toggle.dark:hover {
                    background: rgba(0, 0, 0, 0.1);
                }
                .menu-list {
                    list-style: none;
                    padding: 0;
                }
                .menu-list a {
                    display: flex;
                    align-items: center;
                    gap: 10px;
                    padding: 12px;
                    text-decoration: none;
                    color: #555; /* Cor neutra */
                    font-weight: 500;
                    font-size: 1rem;
                    border-radius: 8px;
                    transition: background-color 0.3s, transform 0.2s;
                }
                .menu-list a:hover {
                    background-color: #e0e0e0;
                    transform: translateX(5px);
                }
                .menu-list a.active {
                    background-color: #b0bec5;
                    color: #fff;
                    font-weight: bold;
                }
                .overlay {
                    position: fixed;
                    top: 0;
                    left: 0;
                    width: 100%;
                    height: 100%;
                    background: rgba(0, 0, 0, 0.5);
                    display: none;
                    z-index: 999;
                }
                .overlay.active {
                    display: block;
                }
                .close-sidebar {
                    position: absolute;
                    top: 10px;
                    right: 10px;
                    background: none;
                    border: none;
                    font-size: 24px;
                    color: #555;
                    cursor: pointer;
                    transition: transform 0.2s;
                }
                .close-sidebar:hover {
                    transform: rotate(90deg);
                }
                .submenu {
                    max-height: 0;
                    overflow: hidden;
                    transition: max-height 0.3s ease;
                    padding-left: 16px;
                }
                .submenu-parent:hover .submenu {
                    max-height: 300px;
                }
                .submenu a {
                    font-size: 0.9rem;
                }
                .icon {
                    font-size: 1.2rem;
                }
            </style>
            
            <button class="menu-toggle">☰</button>
            
            <div class="overlay"></div>
            
            <div class="sidebar">
                <button class="close-sidebar">&times;</button>
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
                            </ul>
                        </li>
                        <li><a href="recursos-dev.html"><span class="icon">🚀</span>Recursos em Desenvolvimento</a></li>
                        <li><a href="sugestoes-dev.html"><span class="icon">💡</span>Sugestões de Desenvolvimento</a></li>
                    </ul>
                </nav>
            </div>
        `;
    }

    addEventListeners() {
        const menuToggle = this.shadowRoot.querySelector('.menu-toggle');
        const closeButton = this.shadowRoot.querySelector('.close-sidebar');
        const sidebar = this.shadowRoot.querySelector('.sidebar');
        const overlay = this.shadowRoot.querySelector('.overlay');

        menuToggle.addEventListener('click', () => {
            sidebar.classList.add('active');
            overlay.classList.add('active');
        });

        closeButton.addEventListener('click', () => {
            sidebar.classList.remove('active');
            overlay.classList.remove('active');
        });

        overlay.addEventListener('click', () => {
            sidebar.classList.remove('active');
            overlay.classList.remove('active');
        });
    }

    highlightCurrentPage() {
        const currentPath = window.location.pathname.split('/').pop();
        const links = this.shadowRoot.querySelectorAll('.menu-list a');
        
        links.forEach(link => {
            const href = link.getAttribute('href').split('/').pop(); // Só pega o nome do arquivo da URL
            if (href === currentPath) {
                link.classList.add('active');
            } else {
                link.classList.remove('active'); // Remove a classe 'active' de outros itens
            }
        });
    }

    updateMenuIconColor() {
        const menuToggle = this.shadowRoot.querySelector('.menu-toggle');
        const rect = menuToggle.getBoundingClientRect();
        const x = rect.left + rect.width / 2;
        const y = rect.top + rect.height / 2;
        
        // Criar um elemento temporário para capturar a cor de fundo
        const temp = document.createElement('div');
        temp.style.position = 'absolute';
        temp.style.height = '1px';
        temp.style.width = '1px';
        temp.style.top = `${y}px`;
        temp.style.left = `${x}px`;
        temp.style.pointerEvents = 'none';
        document.body.appendChild(temp);
        
        // Obter a cor de fundo
        const bgColor = window.getComputedStyle(temp).backgroundColor;
        document.body.removeChild(temp);
        
        // Converter a cor para RGB e calcular o brilho
        const rgb = bgColor.match(/\d+/g);
        if (rgb) {
            const brightness = (parseInt(rgb[0]) * 299 + parseInt(rgb[1]) * 587 + parseInt(rgb[2]) * 114) / 1000;
            
            // Ajustar a classe com base no brilho
            if (brightness > 128) {
                menuToggle.classList.remove('light');
                menuToggle.classList.add('dark');
            } else {
                menuToggle.classList.remove('dark');
                menuToggle.classList.add('light');
            }
        }
    }
}

customElements.define('neo-navbar', NavbarComponent);
