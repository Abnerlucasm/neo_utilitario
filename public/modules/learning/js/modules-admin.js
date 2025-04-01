class ModulesAdmin {
    constructor() {
        this.modules = [];
    }

    async init() {
        try {
            await this.loadModules();
            this.render();
            this.setupEventListeners();
        } catch (error) {
            console.error('Erro ao inicializar:', error);
            this.showError('Erro ao carregar módulos');
        }
    }

    async loadModules() {
        const response = await fetch('/api/learning/modules');
        if (!response.ok) throw new Error('Erro ao carregar módulos');
        this.modules = await response.json();
    }

    render() {
        const container = document.getElementById('modulesList');
        if (!container) return;

        if (!Array.isArray(this.modules) || this.modules.length === 0) {
            container.innerHTML = `
                <div class="column is-12">
                    <div class="notification is-info is-light">
                        Nenhum módulo encontrado. Clique em "Criar Novo Módulo" para começar.
                    </div>
                </div>
            `;
            return;
        }

        container.innerHTML = this.modules.map(module => `
            <div class="column is-4">
                <div class="card">
                    <div class="card-content">
                        <p class="title is-4">${module.title}</p>
                        <p class="subtitle is-6">${module.description || ''}</p>
                    </div>
                    <footer class="card-footer">
                        <a href="/admin/learning/module/${module.id}" class="card-footer-item">
                            <span class="icon"><i class="fas fa-edit"></i></span>
                            <span>Editar</span>
                        </a>
                        <a href="/learn/${module.id}" class="card-footer-item" target="_blank">
                            <span class="icon"><i class="fas fa-eye"></i></span>
                            <span>Visualizar</span>
                        </a>
                        <a href="#" class="card-footer-item has-text-danger" data-action="delete" data-id="${module.id}">
                            <span class="icon"><i class="fas fa-trash"></i></span>
                            <span>Excluir</span>
                        </a>
                    </footer>
                </div>
            </div>
        `).join('');
    }

    showError(message) {
        const container = document.getElementById('modulesList');
        if (container) {
            container.innerHTML = `
                <div class="column is-12">
                    <div class="notification is-danger">
                        <p>${message}</p>
                        <button class="button is-light mt-2" onclick="location.reload()">
                            Tentar novamente
                        </button>
                    </div>
                </div>
            `;
        }
    }

    setupEventListeners() {
        // Botão Novo Módulo
        const newModuleBtn = document.getElementById('newModuleBtn');
        if (newModuleBtn) {
            newModuleBtn.addEventListener('click', () => {
                document.getElementById('moduleModal').classList.add('is-active');
            });
        }

        // Fechar Modal
        document.querySelectorAll('.modal .delete, #cancelModuleBtn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.getElementById('moduleModal').classList.remove('is-active');
            });
        });

        // Salvar Módulo
        document.getElementById('saveModuleBtn').addEventListener('click', async () => {
            const moduleData = {
                id: document.getElementById('moduleId').value.trim(),
                title: document.getElementById('moduleTitle').value.trim(),
                description: document.getElementById('moduleDescription').value.trim()
            };

            if (!moduleData.id || !moduleData.title) {
                alert('Por favor, preencha o ID e o título do módulo');
                return;
            }

            try {
                const response = await fetch('/api/learning/modules', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(moduleData)
                });

                if (!response.ok) {
                    const error = await response.json();
                    throw new Error(error.message || 'Erro ao salvar módulo');
                }

                // Limpar formulário e fechar modal
                document.getElementById('moduleId').value = '';
                document.getElementById('moduleTitle').value = '';
                document.getElementById('moduleDescription').value = '';
                document.getElementById('moduleModal').classList.remove('is-active');

                // Recarregar lista de módulos
                await this.loadModules();
                this.render();
            } catch (error) {
                console.error('Erro ao salvar módulo:', error);
                alert(error.message || 'Erro ao salvar módulo');
            }
        });

        // Excluir Módulo
        document.querySelectorAll('[data-action="delete"]').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                e.preventDefault();
                const moduleId = btn.dataset.id;
                
                if (!confirm('Tem certeza que deseja excluir este módulo?')) return;

                try {
                    const response = await fetch(`/api/learning/modules/${moduleId}`, {
                        method: 'DELETE'
                    });

                    if (!response.ok) throw new Error('Erro ao excluir módulo');

                    await this.loadModules();
                    this.render();
                } catch (error) {
                    console.error('Erro ao excluir módulo:', error);
                    alert('Erro ao excluir módulo');
                }
            });
        });
    }
}

// Inicializar quando o DOM estiver pronto
document.addEventListener('DOMContentLoaded', () => {
    const admin = new ModulesAdmin();
    admin.init().catch(console.error);
}); 