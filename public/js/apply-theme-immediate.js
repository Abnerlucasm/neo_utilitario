/**
 * Script para aplicar tema salvo imediatamente
 * Evita flash de tema claro ao carregar páginas
 */

(function() {
    'use strict';
    
    try {
        const savedTheme = localStorage.getItem('theme');
        if (savedTheme && ['light', 'dark', 'system'].includes(savedTheme)) {
            let actualTheme = savedTheme;
            
            // Se for "system", detectar preferência do SO
            if (savedTheme === 'system') {
                actualTheme = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
            }
            
            // Aplicar tema no documento
            document.documentElement.setAttribute('data-theme', actualTheme);
            
            // Log para debug (apenas em desenvolvimento)
            if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
                console.log('Tema aplicado imediatamente:', savedTheme, '->', actualTheme);
            }
        }
    } catch (error) {
        console.error('Erro ao aplicar tema imediatamente:', error);
    }
})();
