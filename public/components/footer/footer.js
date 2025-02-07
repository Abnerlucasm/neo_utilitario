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
        const userSettings = JSON.parse(localStorage.getItem('userSettings')) || {};
        if (userSettings.theme === 'dark') {
            const footer = this.shadowRoot.querySelector('.neo-footer');
            if (footer) {
                footer.classList.add('dark-theme');
            }
        }

        // Observar mudanças no tema
        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                if (mutation.attributeName === 'class') {
                    const footer = this.shadowRoot.querySelector('.neo-footer');
                    if (footer) {
                        if (document.body.classList.contains('dark-theme')) {
                            footer.classList.add('dark-theme');
                        } else {
                            footer.classList.remove('dark-theme');
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
    }
}

customElements.define('neo-footer', NeoFooter);
