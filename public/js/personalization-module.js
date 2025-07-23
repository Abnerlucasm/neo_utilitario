/**
 * Módulo Centralizado de Personalização e Temas
 * Gerencia todas as configurações de personalização do sistema
 */
class PersonalizationModule {
    constructor() {
        this.config = {
            theme: 'light',
            language: 'pt-BR',
            fontSize: 'medium',
            colorScheme: 'default',
            animations: true,
            notifications: true,
            accessibility: {
                highContrast: false,
                reducedMotion: false,
                screenReader: false
            }
        };
        
        this.availableThemes = [
            'light', 'dark', 'cupcake', 'bumblebee', 'emerald', 'corporate',
            'synthwave', 'retro', 'cyberpunk', 'valentine', 'halloween',
            'garden', 'forest', 'aqua', 'lofi', 'pastel', 'fantasy',
            'wireframe', 'black', 'luxury', 'dracula', 'cmyk', 'autumn',
            'business', 'acid', 'lemonade', 'night', 'coffee', 'winter',
            'dim', 'nord', 'sunset', 'caramellatte', 'abyss', 'silk'
        ];
        
        this.isInitialized = false;
        this.init();
    }

    init() {
        this.loadSettings();
        this.applyCurrentSettings();
        this.setupEventListeners();
        this.isInitialized = true;
        this.dispatchEvent('personalizationReady', { config: this.config });
    }

    loadSettings() {
        try {
            const savedSettings = JSON.parse(localStorage.getItem('userSettings')) || {};
            this.config = { ...this.config, ...savedSettings };
        } catch (error) {
            console.error('Erro ao carregar configurações:', error);
        }
    }

    saveSettings() {
        try {
            localStorage.setItem('userSettings', JSON.stringify(this.config));
            this.syncWithServer();
        } catch (error) {
            console.error('Erro ao salvar configurações:', error);
        }
    }

    applyCurrentSettings() {
        // Aplicar tema
        this.applyTheme(this.config.theme);
        
        // Aplicar tamanho da fonte
        this.applyFontSize(this.config.fontSize);
        
        // Aplicar animações
        this.applyAnimations(this.config.animations);
        
        // Aplicar configurações de acessibilidade
        this.applyAccessibility(this.config.accessibility);
    }

    applyTheme(theme) {
        if (!theme || !this.availableThemes.includes(theme)) {
            theme = 'light';
        }
        
        this.config.theme = theme;
        document.documentElement.setAttribute('data-theme', theme);
        
        // Atualizar seletor se existir
        const themeSelect = document.getElementById('themeSelect');
        if (themeSelect && themeSelect.value !== theme) {
            themeSelect.value = theme;
        }
        
        this.dispatchEvent('themeChanged', { theme });
    }

    applyFontSize(size) {
        const sizes = {
            'small': '0.875rem',
            'medium': '1rem',
            'large': '1.125rem',
            'xlarge': '1.25rem'
        };
        
        this.config.fontSize = size;
        document.documentElement.style.fontSize = sizes[size] || sizes.medium;
        
        this.dispatchEvent('fontSizeChanged', { size });
    }

    applyAnimations(enabled) {
        this.config.animations = enabled;
        
        if (enabled) {
            document.documentElement.style.setProperty('--animation-duration', '0.3s');
        } else {
            document.documentElement.style.setProperty('--animation-duration', '0s');
        }
        
        this.dispatchEvent('animationsChanged', { enabled });
    }

    applyAccessibility(settings) {
        this.config.accessibility = { ...this.config.accessibility, ...settings };
        
        // Alto contraste
        if (settings.highContrast) {
            document.documentElement.classList.add('high-contrast');
        } else {
            document.documentElement.classList.remove('high-contrast');
        }
        
        // Reduzir movimento
        if (settings.reducedMotion) {
            document.documentElement.classList.add('reduced-motion');
        } else {
            document.documentElement.classList.remove('reduced-motion');
        }
        
        // Suporte a leitor de tela
        if (settings.screenReader) {
            document.documentElement.classList.add('screen-reader-friendly');
        } else {
            document.documentElement.classList.remove('screen-reader-friendly');
        }
        
        this.dispatchEvent('accessibilityChanged', { settings });
    }

    setupEventListeners() {
        // Listener para mudanças no seletor de tema
        document.addEventListener('change', (event) => {
            if (event.target.id === 'themeSelect') {
                this.applyTheme(event.target.value);
                this.saveSettings();
            }
        });

        // Listener para mudanças via localStorage (outras abas)
        window.addEventListener('storage', (event) => {
            if (event.key === 'userSettings') {
                try {
                    const settings = JSON.parse(event.newValue);
                    this.config = { ...this.config, ...settings };
                    this.applyCurrentSettings();
                } catch (error) {
                    console.error('Erro ao processar mudanças de configuração:', error);
                }
            }
        });

        // Listener para eventos customizados
        document.addEventListener('personalizationChangeRequested', (event) => {
            const { type, value } = event.detail;
            this.updateSetting(type, value);
        });
    }

    updateSetting(key, value) {
        if (key === 'theme') {
            this.applyTheme(value);
        } else if (key === 'fontSize') {
            this.applyFontSize(value);
        } else if (key === 'animations') {
            this.applyAnimations(value);
        } else if (key === 'accessibility') {
            this.applyAccessibility(value);
        } else {
            this.config[key] = value;
        }
        
        this.saveSettings();
        this.dispatchEvent('settingChanged', { key, value });
    }

    dispatchEvent(eventName, detail = {}) {
        const event = new CustomEvent(eventName, { detail });
        document.dispatchEvent(event);
    }

    async syncWithServer() {
        try {
            const token = localStorage.getItem('auth_token');
            if (!token) return;

            const response = await fetch('/api/auth/user/settings', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(this.config)
            });

            if (!response.ok) {
                console.warn('Erro ao sincronizar configurações com servidor');
            }
        } catch (error) {
            console.error('Erro ao sincronizar configurações:', error);
        }
    }

    // Métodos públicos
    getTheme() {
        return this.config.theme;
    }

    setTheme(theme) {
        this.updateSetting('theme', theme);
    }

    toggleTheme() {
        const newTheme = this.config.theme === 'light' ? 'dark' : 'light';
        this.setTheme(newTheme);
    }

    getFontSize() {
        return this.config.fontSize;
    }

    setFontSize(size) {
        this.updateSetting('fontSize', size);
    }

    getAnimations() {
        return this.config.animations;
    }

    setAnimations(enabled) {
        this.updateSetting('animations', enabled);
    }

    getAccessibility() {
        return this.config.accessibility;
    }

    setAccessibility(settings) {
        this.updateSetting('accessibility', settings);
    }

    getConfig() {
        return { ...this.config };
    }

    resetToDefaults() {
        this.config = {
            theme: 'light',
            language: 'pt-BR',
            fontSize: 'medium',
            colorScheme: 'default',
            animations: true,
            notifications: true,
            accessibility: {
                highContrast: false,
                reducedMotion: false,
                screenReader: false
            }
        };
        this.applyCurrentSettings();
        this.saveSettings();
    }

    // Método para aguardar inicialização
    async waitForInitialization() {
        if (this.isInitialized) {
            return Promise.resolve();
        }
        
        return new Promise((resolve) => {
            document.addEventListener('personalizationReady', resolve, { once: true });
        });
    }
}

// Inicializar módulo globalmente
window.personalization = new PersonalizationModule();

// Funções globais para compatibilidade
window.changeTheme = function(theme) {
    window.personalization.setTheme(theme);
};

window.getCurrentTheme = function() {
    return window.personalization.getTheme();
};

window.toggleTheme = function() {
    window.personalization.toggleTheme();
};

window.waitForPersonalization = function() {
    return window.personalization.waitForInitialization();
}; 