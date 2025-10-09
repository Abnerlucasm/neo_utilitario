/**
 * Seletor de Temas Simplificado baseado na documentação oficial do DaisyUI
 * https://daisyui.com/docs/themes/
 */

class SimpleThemeSelector extends HTMLElement {
    constructor() {
        super();
        this.themes = [
            { value: 'light', name: 'Light', icon: '☀️' },
            { value: 'dark', name: 'Dark', icon: '🌙' },
            { value: 'cupcake', name: 'Cupcake', icon: '🧁' },
            { value: 'bumblebee', name: 'Bumblebee', icon: '🐝' },
            { value: 'emerald', name: 'Emerald', icon: '💚' },
            { value: 'corporate', name: 'Corporate', icon: '🏢' },
            { value: 'synthwave', name: 'Synthwave', icon: '🌆' },
            { value: 'retro', name: 'Retro', icon: '📺' },
            { value: 'cyberpunk', name: 'Cyberpunk', icon: '🤖' },
            { value: 'valentine', name: 'Valentine', icon: '💕' },
            { value: 'halloween', name: 'Halloween', icon: '🎃' },
            { value: 'garden', name: 'Garden', icon: '🌱' },
            { value: 'forest', name: 'Forest', icon: '🌲' },
            { value: 'aqua', name: 'Aqua', icon: '🌊' },
            { value: 'lofi', name: 'Lo-Fi', icon: '🎵' },
            { value: 'pastel', name: 'Pastel', icon: '🎨' },
            { value: 'fantasy', name: 'Fantasy', icon: '🧚' },
            { value: 'wireframe', name: 'Wireframe', icon: '📐' },
            { value: 'black', name: 'Black', icon: '⚫' },
            { value: 'luxury', name: 'Luxury', icon: '💎' },
            { value: 'dracula', name: 'Dracula', icon: '🧛' },
            { value: 'cmyk', name: 'CMYK', icon: '🖨️' },
            { value: 'autumn', name: 'Autumn', icon: '🍂' },
            { value: 'business', name: 'Business', icon: '💼' },
            { value: 'acid', name: 'Acid', icon: '🧪' },
            { value: 'lemonade', name: 'Lemonade', icon: '🍋' },
            { value: 'night', name: 'Night', icon: '🌃' },
            { value: 'coffee', name: 'Coffee', icon: '☕' },
            { value: 'winter', name: 'Winter', icon: '❄️' },
            { value: 'dim', name: 'Dim', icon: '🔅' },
            { value: 'nord', name: 'Nord', icon: '🏔️' },
            { value: 'sunset', name: 'Sunset', icon: '🌅' },
            { value: 'caramellatte', name: 'Caramel Latte', icon: '🍯' },
            { value: 'abyss', name: 'Abyss', icon: '🌌' },
            { value: 'silk', name: 'Silk', icon: '🕸️' }
        ];
        
        this.currentTheme = 'light';
        this.init();
    }

    init() {
        this.render();
        this.setupEventListeners();
        this.updateCurrentTheme();
    }

    render() {
        this.innerHTML = `
            <div class="dropdown dropdown-end">
                <div tabindex="0" role="button" class="btn btn-ghost btn-circle">
                    <i class="fas fa-palette text-lg"></i>
                </div>
                <div tabindex="0" class="dropdown-content z-[1] menu p-2 shadow bg-base-100 rounded-box w-52">
                    <div class="divider my-1">
                        <span class="text-xs font-medium text-base-content/70">Temas</span>
                    </div>
                    <div class="grid grid-cols-2 gap-1 max-h-64 overflow-y-auto" id="themeGrid">
                        ${this.themes.map(theme => `
                            <button 
                                class="btn btn-sm btn-ghost justify-start text-xs" 
                                data-theme="${theme.value}"
                                title="${theme.name}"
                            >
                                <span class="text-lg mr-1">${theme.icon}</span>
                                <span class="truncate">${theme.name}</span>
                            </button>
                        `).join('')}
                    </div>
                </div>
            </div>
        `;
    }

    setupEventListeners() {
        const themeGrid = this.querySelector('#themeGrid');
        if (themeGrid) {
            themeGrid.addEventListener('click', (e) => {
                const button = e.target.closest('button[data-theme]');
                if (button) {
                    const theme = button.dataset.theme;
                    this.selectTheme(theme);
                }
            });
        }

        // Listener para mudanças de tema externas
        window.addEventListener('themeChanged', (e) => {
            this.updateCurrentTheme();
        });
    }

    selectTheme(theme) {
        console.log('Tema selecionado:', theme);
        
        if (window.ThemeManager) {
            console.log('Usando ThemeManager para aplicar tema');
            const success = window.ThemeManager.setTheme(theme);
            console.log('Resultado do setTheme:', success);
            
            if (success) {
                this.currentTheme = theme;
                this.updateCurrentTheme();
            }
        } else {
            console.error('ThemeManager não disponível');
        }
    }

    updateCurrentTheme() {
        if (window.ThemeManager) {
            this.currentTheme = window.ThemeManager.getTheme();
        }
        
        const buttons = this.querySelectorAll('button[data-theme]');
        buttons.forEach(button => {
            const theme = button.dataset.theme;
            if (theme === this.currentTheme) {
                button.classList.remove('btn-ghost');
                button.classList.add('btn-primary');
            } else {
                button.classList.remove('btn-primary');
                button.classList.add('btn-ghost');
            }
        });
    }
}

// Registrar o componente
customElements.define('simple-theme-selector', SimpleThemeSelector);

console.log('SimpleThemeSelector carregado');

