/**
 * Gerenciador Global de Temas
 * Aplica temas do DaisyUI em todas as páginas do sistema
 */
class ThemeManager {
    constructor() {
        this.currentTheme = 'light';
        this.init();
    }

    init() {
        // Carregar tema salvo
        this.loadSavedTheme();
        
        // Aplicar tema inicial
        this.applyTheme(this.currentTheme);
        
        // Configurar listener para mudanças de tema
        this.setupThemeListener();
        
        // Aplicar tema em elementos específicos
        this.applyThemeToElements();
    }

    loadSavedTheme() {
        try {
            const savedSettings = JSON.parse(localStorage.getItem('userSettings')) || {};
            this.currentTheme = savedSettings.theme || 'light';
        } catch (error) {
            console.error('Erro ao carregar tema salvo:', error);
            this.currentTheme = 'light';
        }
    }

    applyTheme(theme) {
        // Aplicar tema do DaisyUI
        document.documentElement.setAttribute('data-theme', theme);
        
        // Manter compatibilidade com tema escuro customizado
        if (theme === 'dark') {
            document.body.classList.add('dark-theme');
        } else {
            document.body.classList.remove('dark-theme');
        }
        
        // Salvar tema no localStorage
        this.saveTheme(theme);
        
        // Atualizar seletor de tema se existir
        this.updateThemeSelector(theme);
        
        // Disparar evento personalizado
        this.dispatchThemeChangeEvent(theme);
    }

    saveTheme(theme) {
        try {
            const settings = JSON.parse(localStorage.getItem('userSettings')) || {};
            settings.theme = theme;
            localStorage.setItem('userSettings', JSON.stringify(settings));
        } catch (error) {
            console.error('Erro ao salvar tema:', error);
        }
    }

    updateThemeSelector(theme) {
        const themeSelect = document.getElementById('themeSelect');
        if (themeSelect) {
            themeSelect.value = theme;
        }
    }

    setupThemeListener() {
        // Listener para mudanças no seletor de tema
        document.addEventListener('change', (event) => {
            if (event.target.id === 'themeSelect') {
                const newTheme = event.target.value;
                this.applyTheme(newTheme);
            }
        });

        // Listener para mudanças via localStorage (outras abas)
        window.addEventListener('storage', (event) => {
            if (event.key === 'userSettings') {
                try {
                    const settings = JSON.parse(event.newValue);
                    if (settings && settings.theme && settings.theme !== this.currentTheme) {
                        this.applyTheme(settings.theme);
                    }
                } catch (error) {
                    console.error('Erro ao processar mudança de tema:', error);
                }
            }
        });
    }

    applyThemeToElements() {
        // Aplicar tema em elementos específicos que podem não herdar automaticamente
        const elements = document.querySelectorAll('[data-theme-inherit]');
        elements.forEach(element => {
            element.setAttribute('data-theme', this.currentTheme);
        });
    }

    dispatchThemeChangeEvent(theme) {
        // Disparar evento personalizado para que outros componentes possam reagir
        const event = new CustomEvent('themeChanged', {
            detail: { theme }
        });
        document.dispatchEvent(event);
    }

    // Método público para mudar tema
    changeTheme(theme) {
        this.applyTheme(theme);
    }

    // Método para obter tema atual
    getCurrentTheme() {
        return this.currentTheme;
    }

    // Método para verificar se é tema escuro
    isDarkTheme() {
        return this.currentTheme === 'dark';
    }
}

// Inicializar gerenciador de temas globalmente
window.themeManager = new ThemeManager();

// Função global para mudar tema (para compatibilidade)
window.changeTheme = function(theme) {
    window.themeManager.changeTheme(theme);
};

// Função global para obter tema atual
window.getCurrentTheme = function() {
    return window.themeManager.getCurrentTheme();
};

// Aplicar tema quando o DOM estiver pronto
document.addEventListener('DOMContentLoaded', () => {
    // Garantir que o tema seja aplicado mesmo se o script for carregado depois
    if (window.themeManager) {
        window.themeManager.applyThemeToElements();
    }
});

// Aplicar tema imediatamente se o DOM já estiver pronto
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        if (window.themeManager) {
            window.themeManager.applyThemeToElements();
        }
    });
} else {
    if (window.themeManager) {
        window.themeManager.applyThemeToElements();
    }
} 