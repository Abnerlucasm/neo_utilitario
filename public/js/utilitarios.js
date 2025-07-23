document.addEventListener('DOMContentLoaded', () => {
    // Usar módulo de personalização se disponível
    if (window.personalization) {
        const userSettings = JSON.parse(localStorage.getItem('userSettings')) || {};
        const theme = userSettings.theme || 'light';
        window.personalization.setTheme(theme);
    } else {
        // Fallback para aplicação direta do DaisyUI
        const userSettings = JSON.parse(localStorage.getItem('userSettings')) || {};
        const theme = userSettings.theme || 'light';
        document.documentElement.setAttribute('data-theme', theme);
    }
});