/**
 * Componente Seletor Global de Temas
 * Renderiza um dropdown com todos os temas disponíveis
 */

// Verificar se a classe já foi declarada
if (typeof ThemeSelector === 'undefined') {
    class ThemeSelector extends HTMLElement {
    constructor() {
        super();
        // Temas simplificados - light, dark e system
        this.themes = [
            { name: 'Claro', value: 'light', icon: '☀️' },
            { name: 'Escuro', value: 'dark', icon: '🌙' },
            { name: 'Sistema', value: 'system', icon: '💻' }
        ];
    }

    connectedCallback() {
        console.log('ThemeSelector connectedCallback chamado');
        this.render();
        this.setupEventListeners();
        
        // Aguardar ThemeManager estar disponível
        this.waitForThemeManager().then(() => {
            this.updateCurrentTheme();
        });
    }
    
    async waitForThemeManager() {
        let attempts = 0;
        const maxAttempts = 50; // 5 segundos
        
        while (!window.ThemeManager && attempts < maxAttempts) {
            await new Promise(resolve => setTimeout(resolve, 100));
            attempts++;
        }
        
        if (window.ThemeManager) {
            console.log('ThemeManager encontrado após', attempts * 100, 'ms');
        } else {
            console.warn('ThemeManager não encontrado após 5 segundos');
        }
    }

    render() {
        this.innerHTML = `
            <div class="dropdown dropdown-end">
                <div tabindex="0" role="button" class="btn btn-ghost btn-circle" id="themeButton">
                    <i class="fas fa-palette text-lg" id="themeIcon"></i>
                </div>
                <div tabindex="0" class="dropdown-content z-[1] menu p-2 shadow bg-base-100 rounded-box w-40">
                    <div class="divider my-1">
                        <span class="text-xs font-medium text-base-content/70">Temas</span>
                    </div>
                    <div class="space-y-1" id="themeGrid">
                        ${this.themes.map(theme => `
                            <button 
                                class="btn btn-sm btn-ghost justify-start w-full" 
                                data-theme="${theme.value}"
                                title="${theme.name}"
                            >
                                <span class="text-lg mr-2">${theme.icon}</span>
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
        console.log('ThemeManager disponível:', !!window.ThemeManager);
        
        if (window.ThemeManager) {
            console.log('Usando ThemeManager para aplicar tema');
            const success = window.ThemeManager.setTheme(theme);
            console.log('Resultado do setTheme:', success);
            
            if (success) {
                this.showToast('Tema alterado com sucesso!', 'success');
            } else {
                this.showToast('Erro ao aplicar tema', 'error');
            }
        } else {
            console.log('ThemeManager não disponível, usando fallback');
            // Fallback se SimpleThemeManager não estiver disponível
            document.documentElement.setAttribute('data-theme', theme);
            localStorage.setItem('theme', theme);
            this.showToast('Tema aplicado localmente', 'info');
        }
    }

    updateCurrentTheme() {
        const currentTheme = window.ThemeManager ? 
            window.ThemeManager.getCurrentTheme() : 
            localStorage.getItem('theme') || 'light';
        
        // Atualizar ícone do botão principal
        const themeIcon = this.querySelector('#themeIcon');
        if (themeIcon) {
            const theme = this.themes.find(t => t.value === currentTheme);
            if (theme) {
                themeIcon.className = `fas fa-palette text-lg`;
                themeIcon.title = `Tema atual: ${theme.name}`;
            }
        }
        
        // Atualizar botões do dropdown
        const buttons = this.querySelectorAll('button[data-theme]');
        buttons.forEach(button => {
            if (button.dataset.theme === currentTheme) {
                button.classList.add('btn-primary');
                button.classList.remove('btn-ghost');
            } else {
                button.classList.remove('btn-primary');
                button.classList.add('btn-ghost');
            }
        });
    }

    showToast(message, type = 'info') {
        // Usar a função showToast global se disponível
        if (window.showToast) {
            window.showToast(message, type);
            return;
        }

        // Fallback: criar toast simples
        const toast = document.createElement('div');
        toast.className = `alert alert-${type} fixed top-4 right-4 z-50 max-w-sm`;
        toast.innerHTML = `
            <div>
                <i class="fas fa-${type === 'success' ? 'check-circle' : type === 'error' ? 'exclamation-circle' : 'info-circle'}"></i>
                <span>${message}</span>
            </div>
        `;
        document.body.appendChild(toast);
        
        setTimeout(() => {
            toast.remove();
        }, 3000);
    }
    }

    // Registrar o componente customizado apenas se não existir
    if (!customElements.get('theme-selector')) {
        customElements.define('theme-selector', ThemeSelector);
    }
}

