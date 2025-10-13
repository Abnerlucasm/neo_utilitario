document.addEventListener('DOMContentLoaded', () => {
    // Aplicar tema salvo usando ThemeManager
    if (window.ThemeManager) {
        const savedTheme = localStorage.getItem('theme') || 'light';
        window.ThemeManager.setTheme(savedTheme);
        console.log('Tema aplicado via ThemeManager:', savedTheme);
    } else {
        // Fallback: aplicar tema diretamente
        const savedTheme = localStorage.getItem('theme') || 'light';
        document.documentElement.setAttribute('data-theme', savedTheme);
        console.log('Tema aplicado diretamente:', savedTheme);
    }
});