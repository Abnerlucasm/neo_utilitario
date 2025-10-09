/**
 * Seletor de Temas Moderno usando DaisyUI Theme Controller
 * Baseado na documentação oficial: https://daisyui.com/components/theme-controller/
 */

class ModernThemeSelector extends HTMLElement {
    constructor() {
        super();
        this.themes = [
            { name: 'Claro', value: 'light', icon: 'fas fa-sun' },
            { name: 'Escuro', value: 'dark', icon: 'fas fa-moon' },
            { name: 'Sistema', value: 'system', icon: 'fas fa-desktop' }
        ];
        
        this.currentTheme = 'light';
        this.init();
    }

    init() {
        this.render();
        this.setupEventListeners();
        this.loadTheme();
    }

    render() {
        this.innerHTML = `
            <div class="dropdown dropdown-end">
                <div tabindex="0" role="button" class="btn btn-ghost btn-circle">
                    <i class="fas fa-palette text-lg"></i>
                </div>
                <div tabindex="0" class="dropdown-content z-[1] menu p-2 shadow bg-base-100 rounded-box w-48">
                    <div class="divider my-1">
                        <span class="text-xs font-medium text-base-content/70">Temas</span>
                    </div>
                    <div class="space-y-1" id="themeGrid">
                        ${this.themes.map(theme => `
                            <label class="flex items-center gap-3 p-2 rounded-lg hover:bg-base-200 cursor-pointer">
                                <input 
                                    type="radio" 
                                    name="theme-selector" 
                                    value="${theme.value}"
                                    class="radio radio-sm theme-controller"
                                    ${theme.value === this.currentTheme ? 'checked' : ''}
                                />
                                <i class="${theme.icon} text-sm"></i>
                                <span class="text-sm">${theme.name}</span>
                            </label>
                        `).join('')}
                    </div>
                </div>
            </div>
        `;
    }

    setupEventListeners() {
        const themeGrid = this.querySelector('#themeGrid');
        if (themeGrid) {
            themeGrid.addEventListener('change', (e) => {
                if (e.target.type === 'radio' && e.target.name === 'theme-selector') {
                    const theme = e.target.value;
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
        
        if (theme === 'system') {
            // Para tema sistema, detectar preferência do SO
            const systemTheme = this.getSystemTheme();
            console.log('Tema do sistema detectado:', systemTheme);
            
            // Aplicar tema do sistema
            document.documentElement.setAttribute('data-theme', systemTheme);
            
            // Salvar 'system' no localStorage
            localStorage.setItem('theme', 'system');
            
            // Configurar listener para mudanças do sistema
            this.setupSystemThemeListener();
        } else {
            // Aplicar tema diretamente
            document.documentElement.setAttribute('data-theme', theme);
            localStorage.setItem('theme', theme);
        }
        
        this.currentTheme = theme;
        this.updateCurrentTheme();
        
        // Disparar evento
        window.dispatchEvent(new CustomEvent('themeChanged', { 
            detail: { theme: theme } 
        }));
    }

    getSystemTheme() {
        if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
            return 'dark';
        } else {
            return 'light';
        }
    }

    setupSystemThemeListener() {
        if (window.matchMedia) {
            const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
            mediaQuery.addEventListener('change', (e) => {
                if (this.currentTheme === 'system') {
                    const newSystemTheme = e.matches ? 'dark' : 'light';
                    console.log('Preferência do sistema mudou para:', newSystemTheme);
                    document.documentElement.setAttribute('data-theme', newSystemTheme);
                }
            });
        }
    }

    loadTheme() {
        const savedTheme = localStorage.getItem('theme');
        if (savedTheme && this.themes.some(t => t.value === savedTheme)) {
            this.currentTheme = savedTheme;
            this.selectTheme(savedTheme);
        } else {
            this.currentTheme = 'light';
            this.selectTheme('light');
        }
    }

    updateCurrentTheme() {
        const currentTheme = localStorage.getItem('theme') || 'light';
        
        // Atualizar radio buttons
        const radioButtons = this.querySelectorAll('input[name="theme-selector"]');
        radioButtons.forEach(radio => {
            if (radio.value === currentTheme) {
                radio.checked = true;
            } else {
                radio.checked = false;
            }
        });
    }
}

// Registrar o componente
customElements.define('modern-theme-selector', ModernThemeSelector);

console.log('ModernThemeSelector carregado');

