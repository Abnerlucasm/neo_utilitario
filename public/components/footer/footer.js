// Importar template
const templatePromise = import('./footer.template.js')
    .then(module => module.getFooterTemplate);

class NeoFooter extends HTMLElement {
    constructor() {
        super();
    }

    async connectedCallback() {
        // Carregar template
        const templatePromise = import('./footer.template.js')
            .then(module => module.getFooterTemplate);

        // Renderizar com o template
        this.render(await templatePromise);
        
        // Configurar tema e observar mudanças
        this.setupTheme();
    }

    setupTheme() {
        const userSettings = JSON.parse(localStorage.getItem('userSettings')) || {};
        const theme = userSettings.theme || 'light';
        this.applyTheme(theme);

        // Observar mudanças de tema
        document.addEventListener('theme-changed', (e) => {
            this.applyTheme(e.detail.theme);
        });
    }

    applyTheme(theme) {
        const footer = this.querySelector('.footer');
        if (footer) {
            // Aplicar tema do DaisyUI
            document.documentElement.setAttribute('data-theme', theme);
        }
    }

    render(getTemplate) {
        const userSettings = JSON.parse(localStorage.getItem('userSettings')) || {};
        const isDark = userSettings.theme === 'dark';
        
        // Usar o template
        this.innerHTML = getTemplate(isDark);
    }
}

customElements.define('neo-footer', NeoFooter);
