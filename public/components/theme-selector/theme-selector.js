class ModernThemeSelector extends HTMLElement {
    connectedCallback() {
        this.render();
        this.attachEvents();
        this.syncWithCurrentTheme();
    }

    render() {
        this.innerHTML = `
            <select id="themeSelect" class="select select-sm">
                <option value="corporate">Claro</option>
                <option value="forest">Escuro (Forest)</option>
                <option value="dark">Dark</option>
            </select>
        `;
    }

    attachEvents() {
        const select = this.querySelector('#themeSelect');

        select.addEventListener('change', (e) => {
            const theme = e.target.value;

            window.Theme.set(theme);
        });
    }

    syncWithCurrentTheme() {
        const select = this.querySelector('#themeSelect');
        if (!select) return;

        select.value = window.Theme.get();
    }
}

if (!customElements.get('modern-theme-selector')) {
    customElements.define('modern-theme-selector', ModernThemeSelector);
}