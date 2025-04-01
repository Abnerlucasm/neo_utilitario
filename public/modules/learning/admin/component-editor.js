class ComponentEditor {
    constructor() {
        this.components = {};
        this.init();
    }

    async init() {
        await this.loadComponents();
        this.render();
        this.setupEvents();
    }

    async loadComponents() {
        try {
            const response = await fetch('/api/components');
            if (!response.ok) {
                throw new Error('Erro ao carregar componentes');
            }
            const components = await response.json();
            
            // Converter array para objeto usando id como chave
            this.components = components.reduce((acc, comp) => {
                acc[comp.id] = comp;
                return acc;
            }, {});

            console.log('Componentes carregados:', this.components);
            
            // Atualizar lista de componentes
            const list = document.querySelector('.components-list');
            if (list) {
                list.innerHTML = this.renderComponentsList();
                this.setupEvents();
            }
        } catch (error) {
            console.error('Erro ao carregar componentes:', error);
            this.components = {};
        }
    }

    async saveComponent(component) {
        try {
            console.log('Salvando componente:', component);
            
            // Verificar se o componente já existe
            const exists = await this.checkComponentExists(component.id);
            
            const url = exists ? 
                `/api/components/${component.id}` : 
                '/api/components';
            
            const response = await fetch(url, {
                method: exists ? 'PUT' : 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(component)
            });

            if (!response.ok) {
                const errorText = await response.text();
                console.error('Erro na resposta:', errorText);
                const errorData = JSON.parse(errorText);
                throw new Error(errorData.error || 'Erro ao salvar componente');
            }

            const result = await response.json();
            console.log('Componente salvo:', result);

            // Atualizar lista de componentes
            this.components[component.id] = component;
            document.querySelector('.components-list').innerHTML = this.renderComponentsList();
            this.setupEvents();

            return result;
        } catch (error) {
            console.error('Erro ao salvar componente:', error);
            throw error;
        }
    }

    async checkComponentExists(id) {
        try {
            const response = await fetch(`/api/components/${id}`);
            return response.ok;
        } catch {
            return false;
        }
    }

    render() {
        return `
            <div class="modal" id="componentEditorModal">
                <div class="modal-background"></div>
                <div class="modal-card">
                    <header class="modal-card-head">
                        <p class="modal-card-title">Editor de Componentes</p>
                        <button class="delete" aria-label="close"></button>
                    </header>
                    <div class="modal-card-body">
                        <div class="tabs">
                            <ul>
                                <li class="is-active" data-tab="list">
                                    <a>Lista de Componentes</a>
                                </li>
                                <li data-tab="editor">
                                    <a>Editor</a>
                                </li>
                            </ul>
                        </div>

                        <div id="list" class="tab-content is-active">
                            <div class="components-list">
                                ${this.renderComponentsList()}
                            </div>
                            <button class="button is-primary mt-4" id="newComponentBtn">
                                <span class="icon">
                                    <i class="fas fa-plus"></i>
                                </span>
                                <span>Novo Componente</span>
                            </button>
                        </div>

                        <div id="editor" class="tab-content">
                            <form id="componentForm">
                                <div class="field">
                                    <label class="label">ID do Componente</label>
                                    <div class="control">
                                        <input class="input" type="text" id="componentId" placeholder="meu-componente">
                                    </div>
                                </div>

                                <div class="field">
                                    <label class="label">Nome</label>
                                    <div class="control">
                                        <input class="input" type="text" id="componentName" placeholder="Meu Componente">
                                    </div>
                                </div>

                                <div class="field">
                                    <label class="label">Ícone (FontAwesome)</label>
                                    <div class="control">
                                        <input class="input" type="text" id="componentIcon" placeholder="puzzle-piece">
                                    </div>
                                </div>

                                <div class="field">
                                    <label class="label">Descrição</label>
                                    <div class="control">
                                        <textarea class="textarea" id="componentDescription"></textarea>
                                    </div>
                                </div>

                                <div class="tabs is-small">
                                    <ul>
                                        <li class="is-active"><a data-code-tab="html">HTML</a></li>
                                        <li><a data-code-tab="css">CSS</a></li>
                                        <li><a data-code-tab="js">JavaScript</a></li>
                                    </ul>
                                </div>

                                <div id="htmlEditor" class="code-editor">
                                    <textarea class="textarea is-family-code" rows="10" placeholder="Template HTML"></textarea>
                                </div>

                                <div id="cssEditor" class="code-editor is-hidden">
                                    <textarea class="textarea is-family-code" rows="10" placeholder="Estilos CSS"></textarea>
                                </div>

                                <div id="jsEditor" class="code-editor is-hidden">
                                    <textarea class="textarea is-family-code" rows="10" placeholder="Código JavaScript"></textarea>
                                </div>
                            </form>
                        </div>
                    </div>
                    <footer class="modal-card-foot">
                        <button class="button is-primary" id="saveComponentBtn">Salvar</button>
                        <button class="button" id="cancelComponentBtn">Cancelar</button>
                    </footer>
                </div>
            </div>
        `;
    }

    renderComponentsList() {
        if (Object.keys(this.components).length === 0) {
            return '<div class="notification is-info">Nenhum componente cadastrado</div>';
        }

        return Object.entries(this.components).map(([id, comp]) => `
            <div class="box component-item" draggable="true" data-component-id="${id}">
                <div class="level">
                    <div class="level-left">
                        <div class="level-item">
                            <span class="icon">
                                <i class="fas fa-${comp.icon || 'puzzle-piece'}"></i>
                            </span>
                            <span class="ml-2">${comp.name}</span>
                            ${comp.description ? `
                                <span class="ml-2 has-text-grey is-size-7">
                                    ${comp.description}
                                </span>
                            ` : ''}
                        </div>
                    </div>
                    <div class="level-right">
                        <div class="level-item">
                            <div class="buttons are-small">
                                <button class="button is-info" data-edit-component="${id}">
                                    <span class="icon"><i class="fas fa-edit"></i></span>
                                </button>
                                <button class="button is-danger" data-delete-component="${id}">
                                    <span class="icon"><i class="fas fa-trash"></i></span>
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `).join('');
    }

    setupEvents() {
        const modal = document.getElementById('componentEditorModal');
        if (!modal) return;

        // Setup das tabs
        modal.querySelectorAll('.tabs li').forEach(tab => {
            tab.addEventListener('click', () => {
                if (tab.dataset.tab) {
                    this.switchTab(tab.dataset.tab);
                }
            });
        });

        // Garantir que a primeira tab esteja ativa
        this.switchTab('list');

        // Eventos do editor de código
        modal.querySelectorAll('.tabs a[data-code-tab]').forEach(tab => {
            tab.addEventListener('click', (e) => {
                const tabName = e.target.dataset.codeTab;
                this.switchCodeEditor(tabName);
            });
        });

        // Botão novo componente
        const newComponentBtn = modal.querySelector('#newComponentBtn');
        if (newComponentBtn) {
            newComponentBtn.addEventListener('click', () => {
                this.clearEditor();
                this.switchTab('editor');
            });
        }

        // Botão salvar
        const saveBtn = modal.querySelector('#saveComponentBtn');
        if (saveBtn) {
            saveBtn.addEventListener('click', () => {
                this.saveCurrentComponent();
            });
        }

        // Botão cancelar
        const cancelBtn = modal.querySelector('#cancelComponentBtn');
        if (cancelBtn) {
            cancelBtn.addEventListener('click', () => {
                this.switchTab('list');
            });
        }

        // Botões de editar e deletar
        modal.querySelectorAll('[data-edit-component]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const id = e.currentTarget.dataset.editComponent;
                this.editComponent(id);
            });
        });

        modal.querySelectorAll('[data-delete-component]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const id = e.currentTarget.dataset.deleteComponent;
                this.deleteComponent(id);
            });
        });

        // Setup do drag and drop
        this.setupDragAndDrop();
    }

    switchTab(tabId) {
        const modal = document.getElementById('componentEditorModal');
        if (!modal) return;

        // Atualizar tabs
        modal.querySelectorAll('.tabs li').forEach(tab => {
            tab.classList.toggle('is-active', tab.dataset.tab === tabId);
        });

        // Atualizar conteúdo
        modal.querySelectorAll('.tab-content').forEach(content => {
            const contentId = tabId;
            content.classList.toggle('is-active', content.id === contentId);
            content.classList.toggle('is-hidden', content.id !== contentId);
        });
    }

    switchCodeEditor(tabName) {
        document.querySelectorAll('.tabs a[data-code-tab]').forEach(tab => {
            tab.parentElement.classList.remove('is-active');
        });
        document.querySelector(`.tabs a[data-code-tab="${tabName}"]`).parentElement.classList.add('is-active');

        document.querySelectorAll('.code-editor').forEach(editor => {
            editor.classList.add('is-hidden');
        });
        document.getElementById(`${tabName}Editor`).classList.remove('is-hidden');
    }

    clearEditor() {
        document.getElementById('componentId').value = '';
        document.getElementById('componentName').value = '';
        document.getElementById('componentIcon').value = '';
        document.getElementById('componentDescription').value = '';
        document.querySelectorAll('.code-editor textarea').forEach(textarea => {
            textarea.value = '';
        });
    }

    async saveCurrentComponent() {
        const id = document.getElementById('componentId').value.trim();
        const name = document.getElementById('componentName').value.trim();
        const icon = document.getElementById('componentIcon').value.trim();
        const description = document.getElementById('componentDescription').value.trim();
        const html = document.querySelector('#htmlEditor textarea').value.trim();
        const css = document.querySelector('#cssEditor textarea').value.trim();
        const js = document.querySelector('#jsEditor textarea').value.trim();

        if (!id || !name) {
            alert('ID e Nome são campos obrigatórios');
            return;
        }

        // Mostrar feedback de salvamento
        const saveButton = document.getElementById('saveComponentBtn');
        const originalText = saveButton.innerHTML;
        saveButton.innerHTML = '<span class="icon"><i class="fas fa-spinner fa-spin"></i></span><span>Salvando...</span>';
        saveButton.disabled = true;

        const component = {
            id,
            name,
            icon: icon || 'puzzle-piece',
            description,
            html,
            css,
            js
        };

        try {
            await this.saveComponent(component);
            this.switchTab('list');
            document.querySelector('.components-list').innerHTML = this.renderComponentsList();
            this.setupEvents();
            alert('Componente salvo com sucesso!');
        } catch (error) {
            console.error('Erro ao salvar componente:', error);
            alert(error.message || 'Erro ao salvar componente. Verifique o console para mais detalhes.');
        } finally {
            // Restaurar botão
            saveButton.innerHTML = originalText;
            saveButton.disabled = false;
        }
    }

    editComponent(id) {
        const comp = this.components[id];
        if (!comp) return;

        document.getElementById('componentId').value = id;
        document.getElementById('componentName').value = comp.name;
        document.getElementById('componentIcon').value = comp.icon;
        document.getElementById('componentDescription').value = comp.description;
        document.querySelector('#htmlEditor textarea').value = comp.html;
        document.querySelector('#cssEditor textarea').value = comp.css;
        document.querySelector('#jsEditor textarea').value = comp.js;

        this.switchTab('editor');
    }

    async deleteComponent(id) {
        if (confirm('Tem certeza que deseja excluir este componente?')) {
            try {
                await fetch(`/api/components/${id}`, {
                    method: 'DELETE'
                });
                delete this.components[id];
            } catch (error) {
                console.error('Erro ao deletar componente:', error);
                alert('Erro ao deletar componente');
            }
            document.querySelector('.components-list').innerHTML = this.renderComponentsList();
            this.setupEvents();
        }
    }

    setupDragAndDrop() {
        const textarea = document.getElementById('pageContent');
        if (!textarea) return;

        // Configurar os componentes arrastáveis
        document.querySelectorAll('.component-item').forEach(item => {
            item.addEventListener('dragstart', (e) => {
                e.dataTransfer.setData('text/plain', item.dataset.componentId);
                e.dataTransfer.effectAllowed = 'copy';
            });
        });

        // Configurar a área de texto para receber os componentes
        textarea.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'copy';
            textarea.style.borderColor = 'var(--primary-color)';
        });

        textarea.addEventListener('dragleave', () => {
            textarea.style.borderColor = '';
        });

        textarea.addEventListener('drop', (e) => {
            e.preventDefault();
            textarea.style.borderColor = '';

            const componentId = e.dataTransfer.getData('text/plain');
            if (!componentId) return;

            // Calcular a posição do cursor baseado na posição do mouse
            const rect = textarea.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            
            // Encontrar a posição do cursor mais próxima
            textarea.focus();
            const position = this.getTextAreaPosition(textarea, x, y);
            textarea.setSelectionRange(position, position);

            // Inserir o componente
            const componentMarker = `\n\n{{component:${componentId}}}\n\n`;
            const text = textarea.value;
            textarea.value = text.slice(0, position) + componentMarker + text.slice(position);

            // Atualizar componentes ativos
            const currentComponents = this.content[this.currentPage]?.components || [];
            if (!currentComponents.includes(componentId)) {
                this.content[this.currentPage].components = [...currentComponents, componentId];
            }

            // Salvar alterações
            this.saveCurrentPage();
        });
    }

    getTextAreaPosition(textarea, x, y) {
        // Criar um elemento temporário para medir o texto
        const div = document.createElement('div');
        div.style.cssText = window.getComputedStyle(textarea, null).cssText;
        div.style.height = 'auto';
        div.style.position = 'absolute';
        div.style.visibility = 'hidden';
        div.textContent = textarea.value;
        document.body.appendChild(div);

        // Encontrar a posição mais próxima
        let position = 0;
        let minDistance = Infinity;

        for (let i = 0; i < textarea.value.length; i++) {
            const range = document.createRange();
            const textNode = div.firstChild;
            range.setStart(textNode, i);
            range.setEnd(textNode, i);
            const rect = range.getBoundingClientRect();
            const distance = Math.sqrt(
                Math.pow(rect.left - x, 2) + Math.pow(rect.top - y, 2)
            );

            if (distance < minDistance) {
                minDistance = distance;
                position = i;
            }
        }

        document.body.removeChild(div);
        return position;
    }
} 