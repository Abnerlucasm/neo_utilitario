/**
 * Sistema de Gerenciamento de Temas baseado na documentação oficial do DaisyUI
 * https://daisyui.com/docs/themes/
 */

class ThemeManager {
    constructor() {
        this.currentTheme = 'light';
        this.availableThemes = [
            'light', 'dark', 'system'
        ];
        
        this.init();
    }

    init() {
        console.log('Inicializando ThemeManager...');
        this.loadTheme();
        this.applyTheme(this.currentTheme);
        this.setupGlobalListeners();
        console.log('ThemeManager inicializado com tema:', this.currentTheme);
        
        // Aplicar tema imediatamente
        this.applyTheme(this.currentTheme);
        
        // Aplicar tema quando DOM estiver pronto
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => {
                this.applyTheme(this.currentTheme);
            });
        }
    }

    loadTheme() {
        try {
            const savedTheme = localStorage.getItem('theme');
            if (savedTheme && this.availableThemes.includes(savedTheme)) {
                this.currentTheme = savedTheme;
                console.log('Tema carregado do localStorage:', savedTheme);
            } else {
                // Verificar se há tema no HTML
                const htmlTheme = document.documentElement.getAttribute('data-theme');
                if (htmlTheme && this.availableThemes.includes(htmlTheme)) {
                    this.currentTheme = htmlTheme;
                    console.log('Tema carregado do HTML:', htmlTheme);
                } else {
                    this.currentTheme = 'light';
                    console.log('Usando tema padrão: light');
                }
            }
        } catch (error) {
            console.error('Erro ao carregar tema:', error);
            this.currentTheme = 'light';
        }
    }

    applyTheme(theme) {
        if (!theme || !this.availableThemes.includes(theme)) {
            console.warn('Tema inválido:', theme);
            return false;
        }
        
        try {
            this.currentTheme = theme;
            
            let actualTheme = theme;
            
            // Se for "system", detectar preferência do SO
            if (theme === 'system') {
                actualTheme = this.getSystemTheme();
                console.log('Tema do sistema detectado:', actualTheme);
            }
            
            // Aplicar tema no documento (método oficial do DaisyUI)
            document.documentElement.setAttribute('data-theme', actualTheme);
            
            // Forçar re-renderização do CSS
            document.documentElement.style.setProperty('--theme', actualTheme);
            
            // Salvar no localStorage
            localStorage.setItem('theme', theme);
            
            console.log('Tema aplicado:', theme, '->', actualTheme);
            console.log('Data-theme atual:', document.documentElement.getAttribute('data-theme'));
            
            // Aguardar um frame para garantir que o CSS seja aplicado
            requestAnimationFrame(() => {
                // Disparar evento customizado
                window.dispatchEvent(new CustomEvent('themeChanged', { 
                    detail: { theme: theme, actualTheme: actualTheme } 
                }));
            });
            
            return true;
        } catch (error) {
            console.error('Erro ao aplicar tema:', error);
            return false;
        }
    }
    
    getSystemTheme() {
        // Detectar preferência do sistema
        if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
            return 'dark';
        } else {
            return 'light';
        }
    }

    setTheme(theme) {
        return this.applyTheme(theme);
    }

    getCurrentTheme() {
        return this.currentTheme;
    }

    setupGlobalListeners() {
        // Escutar mudanças de tema de outros componentes
        window.addEventListener('themeChanged', (event) => {
            if (event.detail && event.detail.theme) {
                this.currentTheme = event.detail.theme;
                console.log('Tema atualizado via evento:', event.detail.theme);
            }
        });

        // Listener para mudanças na preferência do sistema
        if (window.matchMedia) {
            const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
            mediaQuery.addEventListener('change', (e) => {
                if (this.currentTheme === 'system') {
                    console.log('Preferência do sistema mudou:', e.matches ? 'dark' : 'light');
                    this.applyTheme('system');
                }
            });
        }
    }
}

// Inicializar automaticamente
window.ThemeManager = new ThemeManager();
