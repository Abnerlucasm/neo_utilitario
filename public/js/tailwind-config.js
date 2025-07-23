/**
 * Configuração Centralizada do Tailwind CSS e DaisyUI
 * Este arquivo deve ser incluído antes do Tailwind CSS em todas as páginas
 */

// Configuração global do Tailwind CSS
window.tailwind = {
    config: {
        daisyui: {
            themes: [
                "light", "dark", "cupcake", "bumblebee", "emerald", "corporate", 
                "synthwave", "retro", "cyberpunk", "valentine", "halloween", 
                "garden", "forest", "aqua", "lofi", "pastel", "fantasy", 
                "wireframe", "black", "luxury", "dracula", "cmyk", "autumn", 
                "business", "acid", "lemonade", "night", "coffee", "winter",
                "dim", "nord", "sunset", "caramellatte", "abyss", "silk"
            ],
            darkTheme: "dark",
            base: true,
            styled: true,
            utils: true,
            prefix: "",
            logs: false,
            themeRoot: ":root"
        }
    }
};

// Função para aplicar configuração se o Tailwind já estiver carregado
function applyTailwindConfig() {
    if (window.tailwindcss) {
        window.tailwindcss.config = window.tailwind.config;
    }
}

// Aplicar configuração quando o DOM estiver pronto
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', applyTailwindConfig);
} else {
    applyTailwindConfig();
}

// Aplicar configuração imediatamente se o Tailwind já estiver disponível
if (typeof window.tailwindcss !== 'undefined') {
    applyTailwindConfig();
} 