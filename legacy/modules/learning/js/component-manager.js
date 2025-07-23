/**
 * Gerenciador de Componentes Personalizados
 */
class ComponentManager {
    constructor() {
        this.editors = {};
        this.currentComponent = null;
        this.setupEditors();
        this.setupEventListeners();
        this.loadComponents();
    }

    /**
     * Configura os editores CodeMirror
     */
    setupEditors() {
        const editorConfig = {
            lineNumbers: true,
            theme: 'monokai',
            autoCloseTags: true,
            autoCloseBrackets: true,
            matchBrackets: true,
            indentUnit: 4,
            tabSize: 4,
            lineWrapping: true
        };

        this.editors.html = CodeMirror(document.getElementById('htmlEditor'), {
            ...editorConfig,
            mode: 'xml',
            htmlMode: true
        });

        this.editors.css = CodeMirror(document.getElementById('cssEditor'), {
            ...editorConfig,
            mode: 'css'
        });

        this.editors.js = CodeMirror(document.getElementById('jsEditor'), {
            ...editorConfig,
            mode: 'javascript'
        });

        // Ajustar tamanho dos editores
        Object.values(this.editors).forEach(editor => {
            editor.setSize('100%', '500px');
        });
    }

    /**
     * Configura os event listeners
     */
    setupEventListeners() {
        // Botão Novo Componente
        document.getElementById('newComponentBtn').addEventListener('click', () => {
            this.openComponentModal();
        });

        // Tabs dos editores
        document.querySelectorAll('.tabs a').forEach(tab => {
            tab.addEventListener('click', (e) => {
                e.preventDefault();
                this.switchTab(e.target.getAttribute('data-tab'));
            });
        });

        // Modal
        document.querySelectorAll('.modal .delete, #cancelComponentBtn').forEach(btn => {
            btn.addEventListener('click', () => {
                this.closeComponentModal();
            });
        });

        // Checkbox de configuração
        document.getElementById('componentNeedsConfig').addEventListener('change', (e) => {
            document.getElementById('configFieldsContainer').style.display = e.target.checked ? 'block' : 'none';
        });

        // Botão adicionar campo de configuração
        document.getElementById('addConfigField').addEventListener('click', () => {
            this.addConfigField();
        });

        // Botão salvar
        document.getElementById('saveComponentBtn').addEventListener('click', () => {
            this.saveComponent();
        });

        // Preview em tempo real
        Object.values(this.editors).forEach(editor => {
            editor.on('change', () => this.updatePreview());
        });
    }

    /**
     * Carrega a lista de componentes
     */
    async loadComponents() {
        try {
            const response = await fetch('/api/learning/components');
            if (!response.ok) throw new Error('Erro ao carregar componentes');
            
            const components = await response.json();
            this.renderComponentsList(components);
        } catch (error) {
            console.error('Erro ao carregar componentes:', error);
            this.showNotification('Erro ao carregar componentes', 'is-danger');
        }
    }

    /**
     * Renderiza a lista de componentes
     */
    renderComponentsList(components) {
        const tbody = document.getElementById('componentsList');
        tbody.innerHTML = components.map(component => `
            <tr>
                <td>${component.name}</td>
                <td>${component.category}</td>
                <td>${component.type}</td>
                <td><i class="${component.icon}"></i></td>
                <td>${new Date(component.updatedAt).toLocaleString()}</td>
                <td>
                    <div class="buttons are-small">
                        <button class="button is-info" onclick="componentManager.editComponent('${component.id}')">
                            <span class="icon"><i class="fas fa-edit"></i></span>
                        </button>
                        <button class="button is-danger" onclick="componentManager.deleteComponent('${component.id}')">
                            <span class="icon"><i class="fas fa-trash"></i></span>
                        </button>
                    </div>
                </td>
            </tr>
        `).join('');
    }

    /**
     * Abre o modal de componente
     */
    openComponentModal(component = null) {
        this.currentComponent = component;
        document.getElementById('componentModal').classList.add('is-active');
        
        if (component) {
            // Preencher dados do componente
            document.getElementById('componentName').value = component.name;
            document.getElementById('componentCategory').value = component.category;
            document.getElementById('componentType').value = component.type || 'button';
            document.getElementById('componentIcon').value = component.icon;
            document.getElementById('componentNeedsConfig').checked = component.needsConfig;
            
            this.editors.html.setValue(component.html || '');
            this.editors.css.setValue(component.css || '');
            this.editors.js.setValue(component.js || '');
            
            if (component.configFields) {
                component.configFields.forEach(field => this.addConfigField(field));
            }
        } else {
            // Limpar formulário
            document.getElementById('componentName').value = '';
            document.getElementById('componentCategory').value = 'Botões';
            document.getElementById('componentType').value = 'button';
            document.getElementById('componentIcon').value = '';
            document.getElementById('componentNeedsConfig').checked = false;
            
            this.editors.html.setValue('');
            this.editors.css.setValue('');
            this.editors.js.setValue('');
            
            document.getElementById('configFields').innerHTML = '';
        }

        this.updatePreview();
    }

    /**
     * Fecha o modal de componente
     */
    closeComponentModal() {
        document.getElementById('componentModal').classList.remove('is-active');
        this.currentComponent = null;
    }

    /**
     * Alterna entre as tabs de código
     */
    switchTab(tab) {
        document.querySelectorAll('.tabs li').forEach(li => li.classList.remove('is-active'));
        document.querySelector(`.tabs a[data-tab="${tab}"]`).parentElement.classList.add('is-active');
        
        document.querySelectorAll('.editor-container').forEach(container => {
            container.style.display = 'none';
        });
        document.getElementById(`${tab}Editor`).style.display = 'block';
    }

    /**
     * Adiciona um campo de configuração
     */
    addConfigField(field = null) {
        const container = document.createElement('div');
        container.className = 'field-row columns is-mobile mb-2';
        container.innerHTML = `
            <div class="column is-5">
                <input class="input is-small" type="text" placeholder="Nome do Campo" 
                    value="${field?.name || ''}" data-field="name">
            </div>
            <div class="column is-5">
                <div class="select is-small is-fullwidth">
                    <select data-field="type">
                        <option value="text" ${field?.type === 'text' ? 'selected' : ''}>Texto</option>
                        <option value="number" ${field?.type === 'number' ? 'selected' : ''}>Número</option>
                        <option value="textarea" ${field?.type === 'textarea' ? 'selected' : ''}>Área de Texto</option>
                        <option value="select" ${field?.type === 'select' ? 'selected' : ''}>Seleção</option>
                    </select>
                </div>
            </div>
            <div class="column is-2">
                <button class="button is-danger is-small is-fullwidth" onclick="this.closest('.field-row').remove()">
                    <span class="icon"><i class="fas fa-trash"></i></span>
                </button>
            </div>
        `;
        
        document.getElementById('configFields').appendChild(container);
    }

    /**
     * Atualiza o preview do componente
     */
    updatePreview() {
        const preview = document.getElementById('componentPreview');
        const html = this.editors.html.getValue();
        const css = this.editors.css.getValue();
        const js = this.editors.js.getValue();

        // Criar um iframe isolado para o preview
        preview.innerHTML = '<iframe id="previewFrame" style="width: 100%; height: 200px; border: none;"></iframe>';
        const iframe = document.getElementById('previewFrame');
        const doc = iframe.contentDocument || iframe.contentWindow.document;

        doc.open();
        doc.write(`
            <!DOCTYPE html>
            <html>
            <head>
                <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bulma@0.9.4/css/bulma.min.css">
                <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css">
                <style>${css}</style>
            </head>
            <body>
                ${html}
                <script>${js}</script>
            </body>
            </html>
        `);
        doc.close();
    }

    /**
     * Salva o componente
     */
    async saveComponent() {
        try {
            // Coletar dados do formulário
            const componentData = {
                name: document.getElementById('componentName').value,
                category: document.getElementById('componentCategory').value,
                type: document.getElementById('componentType').value,
                icon: document.getElementById('componentIcon').value,
                html: this.editors.html.getValue(),
                css: this.editors.css.getValue(),
                js: this.editors.js.getValue(),
                needsConfig: document.getElementById('componentNeedsConfig').checked
            };

            // Validar dados obrigatórios
            if (!componentData.name) {
                throw new Error('Nome é obrigatório');
            }

            if (!componentData.type) {
                throw new Error('Tipo é obrigatório');
            }

            // Coletar campos de configuração se necessário
            if (componentData.needsConfig) {
                componentData.configFields = Array.from(document.getElementById('configFields').children).map(row => {
                    const nameInput = row.querySelector('[data-field="name"]');
                    const typeSelect = row.querySelector('[data-field="type"]');
                    return {
                        name: nameInput.value,
                        type: typeSelect.value
                    };
                });
            }

            // Determinar se é criação ou atualização
            const url = this.currentComponent 
                ? `/api/learning/components/${this.currentComponent.id}`
                : '/api/learning/components';
            
            const method = this.currentComponent ? 'PUT' : 'POST';

            // Enviar para o servidor
            const response = await fetch(url, {
                method: method,
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(componentData)
            });

            if (!response.ok) {
                throw new Error('Erro ao salvar componente');
            }

            // Atualizar lista e fechar modal
            await this.loadComponents();
            this.closeComponentModal();
            this.showNotification('Componente salvo com sucesso', 'is-success');
        } catch (error) {
            console.error('Erro ao salvar componente:', error);
            this.showNotification(error.message, 'is-danger');
        }
    }

    /**
     * Edita um componente existente
     */
    async editComponent(id) {
        try {
            const response = await fetch(`/api/learning/components/${id}`);
            if (!response.ok) throw new Error('Erro ao carregar componente');
            
            const component = await response.json();
            this.openComponentModal(component);
        } catch (error) {
            console.error('Erro ao editar componente:', error);
            this.showNotification('Erro ao carregar componente', 'is-danger');
        }
    }

    /**
     * Exclui um componente
     */
    async deleteComponent(id) {
        if (!confirm('Tem certeza que deseja excluir este componente?')) return;

        try {
            const response = await fetch(`/api/learning/components/${id}`, {
                method: 'DELETE'
            });

            if (!response.ok) throw new Error('Erro ao excluir componente');

            await this.loadComponents();
            this.showNotification('Componente excluído com sucesso', 'is-success');
        } catch (error) {
            console.error('Erro ao excluir componente:', error);
            this.showNotification('Erro ao excluir componente', 'is-danger');
        }
    }

    /**
     * Mostra uma notificação
     */
    showNotification(message, type = 'is-info') {
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.innerHTML = `
            <button class="delete"></button>
            ${message}
        `;

        // Adicionar ao DOM
        document.body.appendChild(notification);

        // Configurar botão de fechar
        notification.querySelector('.delete').addEventListener('click', () => {
            notification.remove();
        });

        // Auto-remover após 3 segundos
        setTimeout(() => {
            notification.remove();
        }, 3000);
    }
}

// Inicializar o gerenciador
window.componentManager = new ComponentManager(); 