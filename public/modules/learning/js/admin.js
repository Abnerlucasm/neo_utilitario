// Definição da classe PostgreSQLContentManager
class PostgreSQLContentManager {
    constructor() {
        this.modules = [];
    }

    async init(containerId) {
        this.container = document.getElementById(containerId);
        if (!this.container) {
            throw new Error(`Container ${containerId} não encontrado`);
        }

        try {
            await this.loadModules();
            this.render();
            this.setupEvents();
        } catch (error) {
            console.error('Erro na inicialização do PostgreSQLContentManager:', error);
            this.showError('Erro ao carregar módulos');
        }
    }

    showError(message) {
        if (this.container) {
            this.container.innerHTML = `
                <div class="notification is-danger">
                    <p>${message}</p>
                    <button class="button is-small is-info mt-2" onclick="window.location.reload()">
                        Tentar novamente
                    </button>
                </div>
            `;
        }
    }

    async loadModules() {
        try {
            const response = await fetch('/api/learning/modules');
            if (!response.ok) {
                throw new Error('Erro ao carregar módulos');
            }
            this.modules = await response.json();
            console.log('Módulos carregados:', this.modules);
        } catch (error) {
            console.error('Erro ao carregar módulos:', error);
            this.modules = [];
        }
    }

    render() {
        if (!this.container) return;

        this.container.innerHTML = `
            <div class="section">
                <div class="level">
                    <div class="level-left">
                        <h1 class="title">Módulos PostgreSQL</h1>
                    </div>
                    <div class="level-right">
                        <button class="button is-primary" id="newModuleBtn">
                            <span class="icon"><i class="fas fa-plus"></i></span>
                            <span>Novo Módulo</span>
                        </button>
                    </div>
                </div>
                
                <div class="modules-list">
                    ${this.modules.map(module => this.renderModuleItem(module)).join('')}
                </div>
            </div>
        `;
    }

    renderModuleItem(module) {
        return `
            <div class="card mb-4">
                <div class="card-content">
                    <div class="level">
                        <div class="level-left">
                            <div class="level-item">
                                <h2 class="title is-4">${module.title}</h2>
                            </div>
                        </div>
                        <div class="level-right">
                            <div class="level-item">
                                <div class="buttons">
                                    <button class="button is-info is-small edit-module" data-id="${module.id}">
                                        <span class="icon"><i class="fas fa-edit"></i></span>
                                        <span>Editar</span>
                                    </button>
                                    <button class="button is-danger is-small delete-module" data-id="${module.id}">
                                        <span class="icon"><i class="fas fa-trash"></i></span>
                                        <span>Excluir</span>
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    setupEvents() {
        // Evento para o botão de novo módulo
        const newModuleBtn = document.getElementById('newModuleBtn');
        if (newModuleBtn) {
            newModuleBtn.addEventListener('click', () => {
                window.location.href = '/admin/learning/module/new';
            });
        }

        // Eventos para os botões de editar
        document.querySelectorAll('.edit-module').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const moduleId = e.currentTarget.dataset.id;
                window.location.href = `/admin/learning/module/edit/${moduleId}`;
            });
        });

        // Eventos para os botões de excluir
        document.querySelectorAll('.delete-module').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                if (confirm('Tem certeza que deseja excluir este módulo?')) {
                    const moduleId = e.currentTarget.dataset.id;
                    await this.deleteModule(moduleId);
                }
            });
        });
    }

    async deleteModule(moduleId) {
        try {
            const response = await fetch(`/api/learning/modules/${moduleId}`, {
                method: 'DELETE',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
                }
            });

            if (!response.ok) {
                throw new Error('Erro ao excluir módulo');
            }

            alert('Módulo excluído com sucesso!');
            await this.loadModules();
            this.render();
            this.setupEvents();
        } catch (error) {
            console.error('Erro ao excluir módulo:', error);
            alert('Erro ao excluir módulo. Por favor, tente novamente.');
        }
    }
}

class AdminManager {
    constructor() {
        this.currentManager = null;
        this.contentTypes = {
            'postgresql': PostgreSQLContentManager
        };
    }

    init() {
        this.render();
        this.setupEvents();
    }

    render() {
        const container = document.getElementById('adminContainer');
        if (!container) return;

        if (this.currentManager) {
            return; // O gerenciador atual cuidará da renderização
        }

        container.innerHTML = `
            <div class="section">
                <h1 class="title">Gerenciador de Conteúdo</h1>
                <div class="columns is-multiline">
                    ${this.renderContentCards()}
                </div>
            </div>
        `;
    }

    renderContentCards() {
        return `
            <div class="column is-4">
                <div class="card">
                    <div class="card-content">
                        <div class="media">
                            <div class="media-left">
                                <span class="icon is-large">
                                    <i class="fas fa-database fa-2x"></i>
                                </span>
                            </div>
                            <div class="media-content">
                                <p class="title is-4">PostgreSQL</p>
                                <p class="subtitle is-6">Tutorial de PostgreSQL</p>
                            </div>
                        </div>
                    </div>
                    <footer class="card-footer">
                        <a href="#" class="card-footer-item" data-content="postgresql">
                            <span class="icon"><i class="fas fa-edit"></i></span>
                            <span>Editar</span>
                        </a>
                    </footer>
                </div>
            </div>
        `;
    }

    setupEvents() {
        document.querySelectorAll('[data-content]').forEach(link => {
            link.addEventListener('click', async (e) => {
                e.preventDefault();
                const contentType = e.currentTarget.dataset.content;
                await this.loadContentManager(contentType);
            });
        });
    }

    async loadContentManager(contentType) {
        console.log('Inicializando gerenciador para:', contentType);
        
        const ManagerClass = this.contentTypes[contentType];
        if (!ManagerClass) {
            console.error('Tipo de conteúdo não suportado:', contentType);
            return;
        }

        try {
            const container = document.getElementById('adminContainer');
            if (!container) {
                throw new Error('Container não encontrado');
            }

            // Limpar conteúdo atual
            container.innerHTML = '<div id="content-manager"></div>';

            // Inicializar novo gerenciador
            this.currentManager = new ManagerClass();
            await this.currentManager.init('content-manager');
            
            console.log('Gerenciador inicializado com sucesso');
        } catch (error) {
            console.error('Erro ao inicializar gerenciador:', error);
            this.currentManager = null;
        }
    }

    async loadScript(src) {
        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = src;
            script.onload = resolve;
            script.onerror = reject;
            document.head.appendChild(script);
        });
    }
}

// Inicializar quando o DOM estiver pronto
document.addEventListener('DOMContentLoaded', () => {
    try {
        console.log('DOM está pronto. Inicializando LearningAdmin...');
        // Criar e expor o LearningAdmin globalmente
        window.learningAdmin = new LearningAdmin();
        console.log('LearningAdmin inicializado com sucesso');
    } catch (error) {
        console.error('Erro ao inicializar LearningAdmin:', error);
    }
});

// Adicionar ao menu existente
const adminMenu = [
    {
        title: 'Módulos de Aprendizagem',
        icon: 'graduation-cap',
        route: '/admin/learning/modules',
        permission: 'admin'
    }
    // ... outros itens do menu
];

class LearningAdmin {
    constructor() {
        this.container = document.querySelector('.main-container') || document.querySelector('.container');
        this.setupRoutes();
        this.init();
    }

    init() {
        console.log('Inicializando Learning Admin...');
        this.handleRouteChange();
    }

    setupRoutes() {
        window.addEventListener('popstate', () => this.handleRouteChange());
        document.addEventListener('click', (e) => {
            const routeLink = e.target.closest('[data-route]');
            if (routeLink) {
                e.preventDefault();
                const route = routeLink.getAttribute('data-route');
                this.navigateTo(route);
            }
        });
    }

    handleRouteChange() {
        try {
            console.log('Manipulando mudança de rota...');
            const path = window.location.pathname;
            const params = new URLSearchParams(window.location.search);
            const action = params.get('action');
            const id = params.get('id');
            
            console.log('Caminho atual:', path);
            
            // Verificar se estamos na página de módulos
            if (path.includes('/modules/learning/templates/modules.html') || 
                path.endsWith('/admin/learning/modules')) {
                console.log('Estamos na página de módulos');
                
                if (action === 'new') {
                    this.showModuleEditor();
                } else if (action === 'edit' && id) {
                    this.showModuleEditor(id);
                } else {
                    // Verificar se o container existe
                    if (document.getElementById('modulesContainer')) {
                        console.log('Container de módulos encontrado, carregando dados...');
                        this.showModulesList();
                    } else {
                        console.error('Container de módulos não encontrado na página');
                        console.log('Elementos disponíveis:');
                        const allIds = Array.from(document.querySelectorAll('[id]')).map(el => el.id);
                        console.log(allIds);
                    }
                }
            } else {
                // Para qualquer outra rota, tentar inicializar a lista de módulos
                console.log('Não estamos na página de módulos, tentando redirecionar');
                this.showModulesList();
            }
        } catch (error) {
            console.error('Erro ao manipular mudança de rota:', error);
            // Fallback: tentar mostrar alguma coisa
            try {
                this.showModulesList();
            } catch (fallbackError) {
                console.error('Falha no fallback:', fallbackError);
            }
        }
    }

    navigateTo(route) {
        if (route === 'new-module') {
            window.history.pushState({}, 'Novo Módulo', '/admin/learning/modules?action=new');
            this.showModuleEditor();
            return;
        }
        
        if (route.startsWith('edit-module:')) {
            const moduleId = route.split(':')[1];
            window.history.pushState({}, 'Editar Módulo', `/admin/learning/modules?action=edit&id=${moduleId}`);
            this.showModuleEditor(moduleId);
            return;
        }
        
        if (route.startsWith('edit-content:')) {
            const moduleId = route.split(':')[1];
            window.location.href = `/modules/learning/templates/module-content-editor.html?id=${moduleId}`;
            return;
        }
        
        if (route === 'modules-list') {
            window.history.pushState({}, 'Módulos', '/admin/learning/modules');
            this.showModulesList();
            return;
        }
    }

    async showModulesList() {
        try {
            console.log('Carregando lista de módulos...');
            
            // Verificar se já estamos na página correta
            if (document.getElementById('modulesContainer')) {
                console.log('Já estamos na página de módulos, carregando dados...');
                this.setupListEvents();
                this.loadModulesData();
                return;
            }
            
            // Se não estamos na página correta, redirecionar
            console.log('Redirecionando para a página de módulos...');
            window.location.href = '/modules/learning/templates/modules.html';
        } catch (error) {
            console.error('Erro ao carregar lista de módulos:', error);
            this.showError('Não foi possível carregar a lista de módulos. Por favor, tente novamente.');
        }
    }

    setupListEvents() {
        const newModuleBtn = document.querySelector('[data-route="new-module"]');
        if (newModuleBtn) {
            newModuleBtn.addEventListener('click', (e) => {
                e.preventDefault();
                this.navigateTo('new-module');
            });
        }
    }

    async loadModulesData() {
        try {
            // Usar o ID exato como está na página HTML
            const modulesContainer = document.getElementById('modulesContainer');
            if (!modulesContainer) {
                console.error('Container de módulos não encontrado. ID esperado: modulesContainer');
                console.log('IDs disponíveis na página:');
                document.querySelectorAll('[id]').forEach(el => console.log(`- ${el.id}`));
                return;
            }

            modulesContainer.innerHTML = `
                <div class="notification is-info is-light">
                    <p>Carregando módulos...</p>
                </div>
            `;

            const response = await fetch('/api/learning/modules');
            if (!response.ok) {
                throw new Error(`Erro ${response.status}: ${await response.text()}`);
            }

            const modules = await response.json();
            this.renderModulesList(modules);
        } catch (error) {
            console.error('Erro ao carregar dados dos módulos:', error);
            const modulesContainer = document.getElementById('modulesContainer');
            if (modulesContainer) {
                modulesContainer.innerHTML = `
                    <div class="notification is-danger">
                        <p>Erro ao carregar módulos: ${error.message}</p>
                        <button class="button is-small mt-2" onclick="location.reload()">
                            Tentar novamente
                        </button>
                    </div>
                `;
            }
        }
    }

    renderModulesList(modules) {
        const container = document.getElementById('modulesContainer');
        if (!container) {
            console.error('Container de módulos não encontrado em renderModulesList');
            console.log('Elementos com IDs na página:');
            document.querySelectorAll('[id]').forEach(el => {
                console.log(`- ${el.id}`);
            });
            return;
        }

        if (modules.length === 0) {
            container.innerHTML = `
                <div class="notification is-info is-light">
                    <p>Nenhum módulo encontrado. Crie seu primeiro módulo!</p>
                </div>
            `;
            return;
        }

        // Criar cards para cada módulo
        const modulesHTML = modules.map(module => `
            <div class="card mb-4">
                <div class="card-content">
                    <div class="level">
                        <div class="level-left">
                            <div class="level-item">
                                <h2 class="title is-4">${module.title || module.name}</h2>
                            </div>
                        </div>
                        <div class="level-right">
                            <div class="level-item">
                                <div class="buttons">
                                    <a href="#" data-route="edit-module:${module.id}" 
                                       class="button is-info is-small">
                                        <span class="icon"><i class="fas fa-edit"></i></span>
                                        <span>Editar</span>
                                    </a>
                                    <a href="#" data-route="edit-content:${module.id}" 
                                       class="button is-success is-small">
                                        <span class="icon"><i class="fas fa-book"></i></span>
                                        <span>Conteúdo</span>
                                    </a>
                                    <button class="button is-danger is-small delete-module" 
                                            data-module-id="${module.id}">
                                        <span class="icon"><i class="fas fa-trash"></i></span>
                                        <span>Excluir</span>
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div class="content">
                        <p>${module.description || 'Sem descrição'}</p>
                        ${module.imageUrl ? 
                            `<img src="${module.imageUrl}" alt="${module.title}" style="max-height: 100px; max-width: 200px;">` : 
                            ''}
                        <p class="mt-2">
                            <span class="tag is-info">${module.status || 'draft'}</span>
                        </p>
                    </div>
                </div>
            </div>
        `).join('');
        
        container.innerHTML = modulesHTML;
        
        // Adicionar listeners para botões de excluir
        document.querySelectorAll('.delete-module').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                e.preventDefault();
                const moduleId = e.currentTarget.getAttribute('data-module-id');
                if (confirm('Tem certeza que deseja excluir este módulo?')) {
                    await this.deleteModule(moduleId);
                }
            });
        });
    }

    async deleteModule(moduleId) {
        try {
            const response = await fetch(`/api/learning/modules/${moduleId}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
                }
            });
            
            if (!response.ok) {
                throw new Error(`Erro ${response.status}: ${await response.text()}`);
            }
            
            this.showNotification('Módulo excluído com sucesso!', 'success');
            this.loadModulesData();
        } catch (error) {
            console.error('Erro ao excluir módulo:', error);
            this.showError('Erro ao excluir módulo: ' + error.message);
        }
    }

    async showModuleEditor(moduleId = null) {
        try {
            console.log('Carregando editor de módulo...');
            const response = await fetch('/modules/learning/templates/module-editor.html');
            if (!response.ok) {
                throw new Error(`Erro ${response.status}: ${await response.text()}`);
            }

            const html = await response.text();
            this.container.innerHTML = html;

            // Configurar eventos do formulário
            this.setupEditorEvents();
            
            // Se temos um ID, carregamos os dados do módulo
            if (moduleId) {
                await this.loadModuleData(moduleId);
            }
        } catch (error) {
            console.error('Erro ao carregar editor de módulo:', error);
            this.showError('Não foi possível carregar o editor. Por favor, tente novamente.');
        }
    }

    setupEditorEvents() {
        const form = document.getElementById('module-form');
        if (form) {
            form.addEventListener('submit', async (e) => {
                e.preventDefault();
                await this.saveModule(form);
            });
        }

        const cancelBtn = document.getElementById('cancel-btn');
        if (cancelBtn) {
            cancelBtn.addEventListener('click', (e) => {
                e.preventDefault();
                this.navigateTo('modules-list');
            });
        }

        const backBtn = document.querySelector('[data-route="modules-list"]');
        if (backBtn) {
            backBtn.addEventListener('click', (e) => {
                e.preventDefault();
                this.navigateTo('modules-list');
            });
        }
    }

    async loadModuleData(moduleId) {
        try {
            const response = await fetch(`/api/learning/modules/${moduleId}`);
            if (!response.ok) {
                throw new Error(`Erro ${response.status}: ${await response.text()}`);
            }

            const module = await response.json();
            this.populateModuleForm(module);
        } catch (error) {
            console.error('Erro ao carregar dados do módulo:', error);
            this.showError('Erro ao carregar dados do módulo: ' + error.message);
        }
    }

    populateModuleForm(module) {
        // Preencher os campos do formulário
        document.getElementById('module-title').value = module.title || module.name || '';
        document.getElementById('module-description').value = module.description || '';
        
        // Selecionar status
        if (module.status && document.getElementById('module-status')) {
            document.getElementById('module-status').value = module.status;
        }
        
        // Mostrar imagem
        if (module.imageUrl) {
            const preview = document.getElementById('module-image-preview');
            if (preview) {
                preview.src = module.imageUrl;
                preview.style.display = 'block';
            }
        }
        
        // Adicionar ID oculto apenas para edição (não para criação)
        if (module.id) {
            // Verificar se o campo ID já existe
            let idInput = document.getElementById('module-id');
            
            // Se não existir, criar um
            if (!idInput) {
                idInput = document.createElement('input');
                idInput.type = 'hidden';
                idInput.id = 'module-id';
                idInput.name = 'id';
                
                const form = document.getElementById('module-form');
                if (form) {
                    form.appendChild(idInput);
                }
            }
            
            // Definir o valor do campo ID
            idInput.value = module.id;
        }
    }

    async saveModule(form) {
        try {
            const formData = new FormData(form);
            
            // Se houver um campo oculto module-id no DOM, podemos usá-lo
            const moduleIdElement = document.getElementById('module-id');
            const moduleId = moduleIdElement ? moduleIdElement.value : null;
            
            // Verificar se o ID é válido (se foi fornecido)
            if (moduleId && moduleId.trim() !== '') {
                formData.set('id', moduleId);
            } else {
                // Se não tiver ID ou for vazio, remover para o servidor gerar um novo
                formData.delete('id');
            }
            
            const url = moduleId ? `/api/learning/modules/${moduleId}` : '/api/learning/modules';
            const method = moduleId ? 'PUT' : 'POST';
            
            console.log(`Enviando requisição ${method} para ${url}`);

            const token = localStorage.getItem('auth_token');
            if (!token) {
                throw new Error('Usuário não autenticado');
            }

            // Não definir Content-Type, deixar o navegador configurar automaticamente para multipart/form-data
            const response = await fetch(url, {
                method: method,
                body: formData,
                headers: {
                    'Authorization': `Bearer ${token}`
                    // Não definir Content-Type, será definido automaticamente
                }
            });
            
            if (!response.ok) {
                const errorText = await response.text();
                let errorMessage;
                try {
                    const errorJson = JSON.parse(errorText);
                    errorMessage = errorJson.error || errorJson.message || errorText;
                } catch (e) {
                    errorMessage = errorText;
                }
                throw new Error('Erro ao salvar módulo: ' + errorMessage);
            }
            
            this.showNotification('Módulo salvo com sucesso!', 'success');
            setTimeout(() => {
                this.navigateTo('modules-list');
            }, 1500);
        } catch (error) {
            console.error('Erro ao salvar módulo:', error);
            this.showError(error.message);
        }
    }

    showNotification(message, type = 'info', duration = 3000) {
        const notification = document.createElement('div');
        notification.className = `notification is-${type}`;
        notification.innerHTML = `
            <button class="delete"></button>
            ${message}
        `;

        // Inserir no topo da página
        this.container.insertAdjacentElement('afterbegin', notification);
        
        // Adicionar evento de fechar
        notification.querySelector('.delete').addEventListener('click', () => {
            notification.remove();
        });
        
        // Remover automaticamente após alguns segundos
        if (duration) {
            setTimeout(() => {
                notification.remove();
            }, duration);
        }
    }

    showError(message) {
        this.showNotification(message, 'danger', 0);
    }
} 