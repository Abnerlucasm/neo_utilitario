class ModernThemeSelector extends HTMLElement {
    connectedCallback() {
        this.render();
        this.attachEvents();
        this.syncWithCurrentTheme();

        window.addEventListener('storage', (e) => {
            if (e.key === 'neohub-theme') this.syncWithCurrentTheme();
        });
    }

    render() {
        this.innerHTML = `
            <!-- BOTÃO -->
            <button id="openThemeModal"
                class="btn btn-sm bg-base-200 shadow-sm hover:shadow-md transition">
                Tema
                <span id="currentTheme" class="text-xs opacity-60 ml-2"></span>
            </button>

            <!-- MODAL (fora do fluxo visual do componente, será movido para body) -->
            <div id="themeModal"
                class="fixed inset-0 flex items-center justify-center
                       bg-black/50 backdrop-blur-sm
                       z-[999999]
                       opacity-0 pointer-events-none
                       transition-opacity duration-200">

                <div
                    class="bg-base-100 w-[90%] max-w-3xl max-h-[80vh]
                           overflow-y-auto rounded-2xl shadow-2xl p-6">

                    <!-- HEADER -->
                    <div class="flex justify-between items-center mb-4">
                        <h2 class="text-lg font-semibold">Escolha o tema</h2>

                        <button id="closeThemeModal"
                            class="btn btn-sm btn-ghost">
                            ✕
                        </button>
                    </div>

                    <!-- CLAROS -->
                    ${this.section("☀️ Claros", [
                        "corporate","light","cupcake","bumblebee","emerald",
                        "lemonade","winter","nord","retro"
                    ])}

                    <!-- ESCUROS -->
                    ${this.section("🌙 Escuros", [
                        "forest","dark","dracula","night","halloween",
                        "sunset","dim","black"
                    ])}

                    <!-- ESPECIAIS -->
                    ${this.section("✨ Especiais", [
                        "cyberpunk","synthwave","lofi","fantasy","wireframe",
                        "luxury","aqua","pastel","acid","coffee","business",
                        "autumn","valentine","garden","cmyk"
                    ])}

                </div>
            </div>
        `;

        // 🔥 move modal para o body (resolve navbar/z-index/contexto)
        const modal = this.querySelector('#themeModal');
        document.body.appendChild(modal);
    }

    section(title, items) {
        return `
            <div class="mb-6">
                <div class="text-sm opacity-60 mb-2">${title}</div>

                <div class="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    ${items.map(theme => `
                        <button data-theme="${theme}"
                            class="px-3 py-2 rounded-xl bg-base-200 hover:bg-base-300
                                   transition text-sm text-left">
                            ${theme}
                        </button>
                    `).join('')}
                </div>
            </div>
        `;
    }

    attachEvents() {
        const openBtn = this.querySelector('#openThemeModal');
        const modal = document.querySelector('#themeModal'); // agora global
        const closeBtn = document.querySelector('#closeThemeModal');

        // ABRIR
        openBtn.addEventListener('click', () => {
            modal.classList.remove('opacity-0', 'pointer-events-none');
        });

        // FECHAR botão
        closeBtn.addEventListener('click', () => {
            this.close();
        });

        // FECHAR clique fora do card
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                this.close();
            }
        });

        // TROCAR TEMA
        modal.querySelectorAll('[data-theme]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const theme = e.currentTarget.dataset.theme;
                window.Theme.set(theme);
                this.syncWithCurrentTheme();
                this.close();
            });
        });
    }

    syncWithCurrentTheme() {
        const theme = window.Theme.get();
        const label = this.querySelector('#currentTheme');

        if (label) label.textContent = theme;
    }

    close() {
        const modal = document.querySelector('#themeModal');
        modal.classList.add('opacity-0', 'pointer-events-none');
    }
}

if (!customElements.get('modern-theme-selector')) {
    customElements.define('modern-theme-selector', ModernThemeSelector);
}