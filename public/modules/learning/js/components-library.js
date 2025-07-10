/**
 * Biblioteca de componentes reutilizáveis para o editor
 */
class ComponentsLibrary {
    constructor() {
        console.log('Inicializando ComponentsLibrary...');
        this.components = {};
        this.loadComponents().then(() => {
            console.log('Componentes carregados:', this.components);
        }).catch(error => {
            console.error('Erro ao carregar componentes:', error);
        });
    }

    /**
     * Carrega os componentes do servidor
     */
    async loadComponents() {
        try {
            console.log('Buscando componentes do servidor...');
            const response = await fetch('/api/learning/components');
            if (!response.ok) {
                console.error('Resposta não ok:', response.status, response.statusText);
                throw new Error('Erro ao carregar componentes');
            }
            
            const customComponents = await response.json();
            console.log('Componentes recebidos:', customComponents);
            
            // Converter para o formato da biblioteca
            customComponents.forEach(component => {
                this.components[component.id] = {
                    name: component.name,
                    category: component.category,
                    icon: component.icon,
                    template: this.createTemplateFunction(component),
                    dialog: component.needsConfig,
                    configFields: component.configFields,
                    styles: component.css,
                    scripts: component.js
                };
            });

            console.log('Componentes processados:', this.components);
        } catch (error) {
            console.error('Erro ao carregar componentes:', error);
            throw error;
        }
    }

    /**
     * Cria uma função de template baseada no componente
     */
    createTemplateFunction(component) {
        return (...args) => {
            let html = component.html;
            
            // Substituir placeholders pelos argumentos
            if (component.configFields) {
                component.configFields.forEach((field, index) => {
                    const value = args[index] || '';
                    html = html.replace(new RegExp(`\\{\\{${field.name}\\}\\}`, 'g'), value);
                });
            }

            return html;
        };
    }

    /**
     * Retorna a lista de componentes agrupados por categoria
     */
    getComponentsList() {
        const categories = {};
        
        Object.entries(this.components).forEach(([id, component]) => {
            if (!categories[component.category]) {
                categories[component.category] = [];
            }
            categories[component.category].push({
                id,
                name: component.name,
                icon: component.icon
            });
        });
        
        return categories;
    }

    /**
     * Renderiza o HTML do componente
     */
    renderComponent(componentId, ...args) {
        const component = this.components[componentId];
        if (!component) return '';

        // Injetar estilos se necessário
        if (component.styles && !document.getElementById(`style-${componentId}`)) {
            const style = document.createElement('style');
            style.id = `style-${componentId}`;
            style.textContent = component.styles;
            document.head.appendChild(style);
        }

        // Injetar scripts se necessário
        if (component.scripts && !document.getElementById(`script-${componentId}`)) {
            const script = document.createElement('script');
            script.id = `script-${componentId}`;
            script.textContent = component.scripts;
            document.body.appendChild(script);
        }

        return component.template(...args);
    }

    /**
     * Verifica se o componente precisa de diálogo de configuração
     */
    needsDialog(componentId) {
        return this.components[componentId]?.dialog || false;
    }

    /**
     * Retorna os campos de configuração do componente
     */
    getConfigFields(componentId) {
        return this.components[componentId]?.configFields || [];
    }
}

// Estilos CSS para os componentes
const componentStyles = `
.component-button {
    margin: 0.2rem;
    min-width: 120px;
}

.component-preview {
    padding: 1rem;
    border: 1px solid #dbdbdb;
    border-radius: 4px;
    margin: 1rem 0;
}

.component-dialog {
    max-width: 500px;
}

.component-dialog .modal-card-body {
    max-height: 70vh;
    overflow-y: auto;
}
`;

// Adicionar estilos ao documento
const styleSheet = document.createElement('style');
styleSheet.textContent = componentStyles;
document.head.appendChild(styleSheet);

// Funções auxiliares para manipulação dos componentes
window.showDetails = function(id) {
    // Buscar conteúdo relacionado ao ID
    const content = document.querySelector(`#${id}`);
    if (content) {
        // Criar e mostrar modal com o conteúdo
        const modal = document.createElement('div');
        modal.className = 'modal is-active';
        modal.innerHTML = `
            <div class="modal-background"></div>
            <div class="modal-card component-dialog">
                <header class="modal-card-head">
                    <p class="modal-card-title">${content.getAttribute('data-title') || 'Detalhes'}</p>
                    <button class="delete" aria-label="close"></button>
                </header>
                <section class="modal-card-body">
                    ${content.innerHTML}
                </section>
                <footer class="modal-card-foot">
                    <button class="button" onclick="this.closest('.modal').remove()">Fechar</button>
                </footer>
            </div>
        `;
        document.body.appendChild(modal);

        // Adicionar listener para fechar
        modal.querySelector('.delete').addEventListener('click', () => modal.remove());
        modal.querySelector('.modal-background').addEventListener('click', () => modal.remove());
    }
}; 