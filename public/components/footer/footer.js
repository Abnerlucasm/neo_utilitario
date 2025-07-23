class NeoFooter extends HTMLElement {
    constructor() {
        super();
    }

    connectedCallback() {
        this.render();
        this.setupTheme();
    }

    setupTheme() {
        const userSettings = JSON.parse(localStorage.getItem('userSettings')) || {};
        const theme = userSettings.theme || 'light';
        this.applyTheme(theme);

        document.addEventListener('theme-changed', (e) => {
            this.applyTheme(e.detail.theme);
        });
    }

    applyTheme(theme) {
        if (window.personalization) {
            window.personalization.setTheme(theme);
        } else {
            document.documentElement.setAttribute('data-theme', theme);
        }
    }

    render() {
        this.innerHTML = `
            <footer class="footer footer-center p-10 bg-base-200 text-base-content">
                <div>
                    <p class="text-center">
                        <strong>NeoHub</strong> - Plataforma integrada de colaboração e gerenciamento
                    </p>
                </div>
                <div class="flex flex-col items-center gap-4">
                    <a href="https://github.com/Abnerlucasm/neo_utilitario" 
                       class="btn btn-ghost btn-sm gap-2" 
                       target="_blank" 
                       rel="noopener noreferrer">
                        <i class="fab fa-github w-5 h-5"></i>
                        Contribua no GitHub
                    </a>
                    <p class="text-sm opacity-70">© ${new Date().getFullYear()} Neo. Todos os direitos reservados.</p>
                </div>
            </footer>
        `;
    }
}

customElements.define('neo-footer', NeoFooter);
