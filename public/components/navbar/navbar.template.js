export function getNavbarTemplate(isDark) {
    return `
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
} 