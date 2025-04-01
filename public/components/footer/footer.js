// Importar CSS como módulo
const cssPromise = fetch('/components/footer/footer.css')
    .then(response => response.text())
    .then(css => {
        const sheet = new CSSStyleSheet();
        sheet.replaceSync(css);
        return sheet;
    });

// Importar template
const templatePromise = import('./footer.template.js')
    .then(module => module.getFooterTemplate);

class NeoFooter extends HTMLElement {
    constructor() {
        super();
        this.attachShadow({ mode: 'open' });
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
        
        // Configurar tema e observar mudanças
        this.setupTheme();
    }

    setupTheme() {
        const theme = localStorage.getItem('theme') || 'light';
        this.applyTheme(theme);

        window.addEventListener('themeChange', (e) => {
            this.applyTheme(e.detail.theme);
        });
    }

    applyTheme(theme) {
        const footer = this.shadowRoot.querySelector('.neo-footer');
        if (footer) {
            if (theme === 'dark') {
                footer.classList.add('dark-theme');
            } else {
                footer.classList.remove('dark-theme');
            }
        }
    }

    render(getTemplate) {
        const userSettings = JSON.parse(localStorage.getItem('userSettings')) || {};
        const isDark = userSettings.theme === 'dark';
        
        // Usar o template
        this.shadowRoot.innerHTML = getTemplate(isDark);
    }
}

customElements.define('neo-footer', NeoFooter);
