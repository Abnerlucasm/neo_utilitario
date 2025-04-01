/**
 * Retorna o template HTML para a barra de navegação
 * @param {boolean} isDarkTheme - Se o tema escuro está ativo
 * @returns {string} Template HTML
 */
export function getNavbarTemplate(isDarkTheme = false) {
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