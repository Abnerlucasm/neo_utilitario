// Exemplo de componente personalizado - Botão Detalhes Neo
const neoDetailsButton = {
    id: 'neoDetailsButton',
    name: 'Botão Detalhes Neo',
    category: 'Botões',
    icon: 'fas fa-info-circle',
    needsConfig: true,
    configFields: [
        {
            name: 'id',
            type: 'text',
            label: 'ID do Conteúdo'
        },
        {
            name: 'text',
            type: 'text',
            label: 'Texto do Botão'
        }
    ],
    html: `
        <a href="javascript: abrir('{{id}}');">
            <button class="btndetalhe">{{text}}</button>
        </a>
    `,
    css: `
        .btndetalhe {
            background-color: #A9CF46;
            border: none;
            border-radius: 3px;
            color: #fff;
            cursor: pointer;
            font-size: 12px;
            margin-left: 5px;
            padding: 2px 5px;
        }
        
        .btndetalhe:hover {
            background-color: #8FB83E;
        }
    `,
    js: `
        // Função de abrir popup (já existente na Biblioteca Neo)
        if (typeof window.abrir !== 'function') {
            window.abrir = function(id) {
                const popup = document.getElementById(id);
                if (popup) {
                    popup.style.display = 'block';
                    popup.focus();
                }
            };
        }
        
        // Função de fechar popup (já existente na Biblioteca Neo)
        if (typeof window.fechar !== 'function') {
            window.fechar = function(id) {
                const popup = document.getElementById(id);
                if (popup) {
                    popup.style.display = 'none';
                }
            };
        }
    `
};

// Enviar o componente para a API
fetch('/api/learning/components', {
    method: 'POST',
    headers: {
        'Content-Type': 'application/json'
    },
    body: JSON.stringify(neoDetailsButton)
}).then(response => {
    if (response.ok) {
        console.log('Componente de exemplo criado com sucesso!');
    } else {
        console.error('Erro ao criar componente de exemplo');
    }
}).catch(error => {
    console.error('Erro ao criar componente de exemplo:', error);
}); 