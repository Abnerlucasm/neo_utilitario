import { getFooterTemplate } from './footer.template.js';

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
        const theme = userSettings.theme;
        this.applyTheme(theme);

        document.addEventListener('theme-changed', (e) => {
            this.applyTheme(e.detail.theme);
        });
    }

    applyTheme(theme) {
        if (window.ThemeManager) {
            window.ThemeManager.setTheme(theme);
        } else {
            document.documentElement.setAttribute('data-theme', theme);
        }
    }

    render() {
        const userSettings = JSON.parse(localStorage.getItem('userSettings')) || {};
        const isDark = userSettings.theme === 'dark';

        this.innerHTML = getFooterTemplate(isDark);
    }
}

customElements.define('neo-footer', NeoFooter);