// Configurar o marked para renderizar markdown
const renderer = new marked.Renderer();

// Sobrescrever o método paragraph para processar componentes
renderer.paragraph = function(text) {
    // Se o texto for um objeto, extrair o texto dele
    const content = typeof text === 'object' ? text.text : text;
    
    if (!content) {
        console.warn('Texto inválido recebido:', text);
        return '<p></p>';
    }

    // Verificar se o texto contém um componente
    const componentRegex = /{{component:(.*?)}}/;
    const match = content.match(componentRegex);
    
    if (match) {
        // Retornar o marcador original para ser processado depois
        return content;
    }
    
    return `<p>${content}</p>`;
};

// Sobrescrever o método blockquote para suportar callouts
renderer.blockquote = function(text) {
    // Se o texto for um objeto, extrair o texto dele
    const content = typeof text === 'object' ? text.text : text;
    
    if (!content) {
        console.warn('Texto inválido recebido:', text);
        return '<blockquote></blockquote>';
    }

    const match = content.match(/\[!(INFO|WARNING|TIP)\]/);
    if (match && match[1]) {
        const type = match[1].toLowerCase();
        const cleanContent = content.replace(/\[!(INFO|WARNING|TIP)\]/, '').trim();
        return `
            <div class="callout callout-${type}">
                <div class="callout-icon">
                    <i class="fas fa-${type === 'info' ? 'info-circle' : type === 'warning' ? 'exclamation-triangle' : 'lightbulb'}"></i>
                </div>
                <div class="callout-content">
                    ${cleanContent}
                </div>
            </div>
        `;
    }
    return `<blockquote>${content}</blockquote>`;
};

// Configurar o marked para usar o renderer personalizado
marked.setOptions({
    renderer: renderer,
    gfm: true,
    breaks: true,
    headerIds: false,
    mangle: false,
    sanitize: false,
    smartLists: true,
    smartypants: false,
    xhtml: false,
    highlight: function(code, lang) {
        if (typeof hljs !== 'undefined') {
            if (lang && hljs.getLanguage(lang)) {
                try {
                    return hljs.highlight(code, { language: lang }).value;
                } catch (err) {}
            }
            try {
                return hljs.highlightAuto(code).value;
            } catch (err) {}
        }
        return code;
    }
});

// Extensão para melhorar tabelas
renderer.table = function(header, body) {
    return `
        <div class="table-container">
            <table class="table is-fullwidth">
                <thead>${header}</thead>
                <tbody>${body}</tbody>
            </table>
        </div>
    `;
};

// Extensão para melhorar blocos de código
renderer.code = function(code, language) {
    const validLang = !!(language && hljs.getLanguage(language));
    const highlighted = validLang ? hljs.highlight(code, { language }).value : code;
    const langClass = validLang ? ` language-${language}` : '';
    
    return `
        <div class="code-block">
            ${language ? `<div class="code-header">
                <span class="code-language">${language}</span>
                <button class="button is-small copy-button" data-clipboard-text="${code}">
                    <span class="icon is-small">
                        <i class="fas fa-copy"></i>
                    </span>
                </button>
            </div>` : ''}
            <pre><code class="hljs${langClass}">${highlighted}</code></pre>
        </div>
    `;
}; 