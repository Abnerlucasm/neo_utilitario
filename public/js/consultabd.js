// Variáveis globais
let servers = [];
let currentServerId = null;

// Variáveis globais para paginação e filtro
let allDatabasesData = [];
let currentPage = 1;

// Configuração da API
const API_BASE = '/api';

// Inicialização da página
document.addEventListener('DOMContentLoaded', function() {
    console.log('DOM carregado, inicializando...');
    
    // Verificar autenticação antes de carregar dados
    if (!getAuthToken()) {
        console.log('Usuário não autenticado, redirecionando...');
        return; // A função getAuthToken já redireciona
    }
    
    loadServers();
    loadServerStats();
    setupEventListeners();
});

// Configurar event listeners
function setupEventListeners() {
    // Event listener para pesquisa de databases
    const searchInput = document.getElementById('databaseSearch');
    if (searchInput) {
        searchInput.addEventListener('input', debounce(() => {
            filterAndPaginateDatabases();
        }, 300));
    }
    
    // Event listener para mudança no número de itens por página
    const perPageSelect = document.getElementById('databasesPerPage');
    if (perPageSelect) {
        perPageSelect.addEventListener('change', () => {
            filterAndPaginateDatabases();
        });
    }
}

// Função debounce para otimizar pesquisa
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// Função para obter token de autenticação
function getAuthToken() {
    const token = localStorage.getItem('auth_token');
    if (!token) {
        // Redirecionar para login se não houver token
        window.location.href = '/pages/login.html';
        return null;
    }
    return token;
}

// Função para mostrar notificações toast com DaisyUI
function showToast(message, type = 'info', duration = 5000) {
    const toast = document.createElement('div');
    
    // Mapear tipos para classes DaisyUI
    const alertClass = type === 'error' ? 'alert-error' : 
                      type === 'warning' ? 'alert-warning' : 
                      type === 'success' ? 'alert-success' : 'alert-info';
    
    const iconClass = type === 'error' ? 'fa-exclamation-triangle' : 
                     type === 'warning' ? 'fa-exclamation-circle' : 
                     type === 'success' ? 'fa-check-circle' : 'fa-info-circle';
    
    toast.className = `alert ${alertClass} fixed top-4 right-4 z-50 max-w-sm shadow-lg`;
    toast.innerHTML = `
        <div class="flex items-center">
            <span class="flex-shrink-0">
                <i class="fas ${iconClass}"></i>
            </span>
            <div class="ml-3">
                <p class="text-sm font-medium">${message}</p>
            </div>
            <div class="ml-auto pl-3">
                <button onclick="this.parentElement.parentElement.remove()" class="btn btn-ghost btn-xs">
                    <i class="fas fa-times"></i>
                </button>
            </div>
        </div>
    `;
    
    document.body.appendChild(toast);
    
    // Auto-remover após duração
    setTimeout(() => {
        if (toast.parentElement) {
            toast.remove();
        }
    }, duration);
}

// Função para mostrar notificações (mantida para compatibilidade)
function showNotification(message, type = 'info') {
    showToast(message, type);
}

// Função para criar skeleton loading como tabela
function createSkeletonLoading(count = 5) {
    const skeletonRows = Array(count).fill(`
        <tr>
            <td><div class="skeleton-title"></div></td>
            <td><div class="skeleton-text"></div></td>
            <td><div class="skeleton-text short"></div></td>
            <td><div class="skeleton-text short"></div></td>
            <td><div class="skeleton-text"></div></td>
            <td><div class="skeleton-text"></div></td>
            <td><div class="skeleton-text short"></div></td>
        </tr>
    `).join('');
    
    return `
        <div class="overflow-x-auto">
            <table class="table table-zebra w-full">
                <thead>
                    <tr>
                        <th>Servidor</th>
                        <th>Nome</th>
                        <th>Versão</th>
                        <th>Tamanho</th>
                        <th>Dono</th>
                        <th>Comentário</th>
                        <th style="width: 90px;">Ação</th>
                    </tr>
                </thead>
                <tbody>
                    ${skeletonRows}
                </tbody>
            </table>
        </div>
    `;
}

// Função para mostrar skeleton loading
function showSkeletonLoading() {
    const databasesSection = document.getElementById('databasesSection');
    const resultsSummary = document.getElementById('resultsSummary');
    
    if (resultsSummary) resultsSummary.remove();
    
    if (databasesSection) {
        databasesSection.style.display = 'block';
        
        // Manter os filtros e apenas substituir o conteúdo da grid
        const databasesGrid = document.getElementById('databasesGrid');
        if (databasesGrid) {
            databasesGrid.innerHTML = createSkeletonLoading(8);
        } else {
            // Se não existe grid, criar estrutura completa
            databasesSection.innerHTML = `
                <div class="card bg-base-100 shadow-xl">
                    <div class="card-body">
                        <h3 class="card-title mb-4">Databases Encontradas</h3>
                        
                        <div class="flex flex-col gap-4 mb-4">
                            <!-- Filtros de busca -->
                            <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div class="form-control">
                                    <label class="label">
                                        <span class="label-text">Buscar por Servidor</span>
                                    </label>
                                    <input id="serverSearch" class="input input-bordered" type="search" placeholder="Nome do servidor..." oninput="filterAndPaginateDatabases()">
                                </div>
                                <div class="form-control">
                                    <label class="label">
                                        <span class="label-text">Buscar por Database</span>
                                    </label>
                                    <input id="databaseSearch" class="input input-bordered" type="search" placeholder="Nome da database..." oninput="filterAndPaginateDatabases()">
                                </div>
                                <div class="form-control">
                                    <label class="label">
                                        <span class="label-text">Filtrar por Status</span>
                                    </label>
                                    <select id="statusFilter" class="select select-bordered" onchange="filterAndPaginateDatabases()">
                                        <option value="">Todos</option>
                                        <option value="success">Com sucesso</option>
                                        <option value="error">Com erro</option>
                                    </select>
                                </div>
                            </div>
                            
                            <!-- Controles de paginação -->
                            <div class="flex flex-col sm:flex-row gap-4 justify-between items-center">
                                <div class="flex items-center gap-4">
                                    <div class="form-control">
                                        <label class="label">
                                            <span class="label-text">Itens por página</span>
                                        </label>
                                        <select id="databasesPerPage" class="select select-bordered select-sm" onchange="filterAndPaginateDatabases()">
                                            <option value="5">5</option>
                                            <option value="10" selected>10</option>
                                            <option value="25">25</option>
                                            <option value="50">50</option>
                                            <option value="100">100</option>
                                        </select>
                                    </div>
                                    <button class="btn btn-outline btn-sm" onclick="clearFilters()">
                                        <i class="fas fa-times mr-1"></i>
                                        Limpar Filtros
                                    </button>
                                </div>
                                <div class="text-sm text-base-content/70" id="resultsCount">
                                    <!-- Contador de resultados será atualizado aqui -->
                                </div>
                            </div>
                        </div>
                        
                        <div id="databasesGrid">
                            ${createSkeletonLoading(8)}
                        </div>
                        
                        <div class="flex justify-center mt-6">
                            <div class="join" id="databasesPagination" style="display:none;"></div>
                        </div>
                    </div>
                </div>
            `;
        }
    }
}

// Função para remover skeleton loading
function hideSkeletonLoading() {
    const skeletonContainer = document.querySelector('.skeleton-container');
    if (skeletonContainer) {
        skeletonContainer.remove();
    }
}

// Carregar servidores
async function loadServers() {
    try {
        const response = await fetch(`${API_BASE}/servers`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${getAuthToken()}`
            }
        });

        if (!response.ok) {
            throw new Error('Erro ao carregar servidores');
        }

        const data = await response.json();
        servers = data.data || [];
        
        renderServersList();
        renderServerCheckboxes();
        
    } catch (error) {
        console.error('Erro ao carregar servidores:', error);
        showNotification('Erro ao carregar servidores', 'error');
    }
}

// Carregar estatísticas dos servidores
async function loadServerStats() {
    try {
        const response = await fetch(`${API_BASE}/servers/stats/overview`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${getAuthToken()}`
            }
        });

        if (!response.ok) {
            throw new Error('Erro ao carregar estatísticas');
        }

        const stats = await response.json();
        renderServerStats(stats);
        
    } catch (error) {
        console.error('Erro ao carregar estatísticas:', error);
    }
}

// Renderizar estatísticas dos servidores
function renderServerStats(stats) {
    const statsContainer = document.getElementById('serverStats');
    if (!statsContainer) return;
    
    statsContainer.innerHTML = `
        <div class="stats shadow">
            <div class="stat">
                <div class="stat-figure text-primary">
                    <i class="fas fa-server text-3xl"></i>
                </div>
                <div class="stat-title">Total de Servidores</div>
                <div class="stat-value text-primary">${stats.totalServers || 0}</div>
            </div>
            
            <div class="stat">
                <div class="stat-figure text-success">
                    <i class="fas fa-check-circle text-3xl"></i>
                </div>
                <div class="stat-title">Ativos</div>
                <div class="stat-value text-success">${stats.activeServers || 0}</div>
            </div>
        </div>
    `;
}

// Renderizar lista de servidores
function renderServersList() {
    const container = document.getElementById('serversList');
    
    if (servers.length === 0) {
        container.innerHTML = `
            <div class="text-center text-gray-500 py-8">
                <i class="fas fa-server text-4xl mb-4 text-gray-300"></i>
                <p class="text-lg mb-2">Nenhum servidor cadastrado</p>
                <p class="text-sm">Clique em "Novo Servidor" para começar</p>
            </div>
        `;
        return;
    }

    const html = servers.map(server => `
        <div class="card bg-base-200 shadow-sm mb-3 server-card" data-server-id="${server.id}">
            <div class="card-body p-4">
                <div class="flex items-center justify-between">
                    <div class="flex items-center space-x-3">
                        <div class="status-circle status-${server.connectionStatus || 'unknown'}"></div>
                        <div>
                            <h3 class="font-semibold text-base">${server.name}</h3>
                            <p class="text-sm text-gray-600">${server.host}:${server.port}</p>
                            <p class="text-xs text-gray-500 uppercase">${server.type}</p>
                        </div>
                    </div>
                    <div class="flex space-x-2">
                        <button type="button" class="btn btn-info btn-sm" onclick="testServerConnection('${server.id}')" title="Testar Conexão">
                                <i class="fas fa-plug"></i>
                        </button>
                        <button type="button" class="btn btn-warning btn-sm" onclick="editServer('${server.id}')" title="Editar">
                                <i class="fas fa-edit"></i>
                        </button>
                        <button type="button" class="btn btn-error btn-sm" onclick="deleteServer('${server.id}')" title="Excluir">
                                <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </div>
            </div>
        </div>
    `).join('');
    
    container.innerHTML = html;
}

// Renderizar checkboxes dos servidores
function renderServerCheckboxes() {
    const container = document.getElementById('serverCheckboxes');
    
    if (servers.length === 0) {
        container.innerHTML = '<p class="text-gray-500">Nenhum servidor disponível</p>';
        return;
    }

    container.innerHTML = `
        <div class="form-control mb-4">
            <label class="label cursor-pointer bg-base-200 p-3 rounded-lg hover:bg-base-300 transition-colors">
                <span class="label-text font-medium">Selecionar Todos</span>
                <input type="checkbox" class="checkbox checkbox-primary" id="selectAllServers" onchange="toggleAllServers()">
            </label>
        </div>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-3 mt-4">
            ${servers.map(server => `
                <label class="label cursor-pointer">
                    <span class="label-text flex items-center">
                        <div class="status-circle status-${server.connectionStatus || 'unknown'} mr-2"></div>
                        ${server.name}
                    </span>
                    <input type="checkbox" class="checkbox" value="${server.id}" data-server-name="${server.name}">
                    </label>
            `).join('')}
        </div>
    `;
}

// Função para alternar todos os servidores
function toggleAllServers() {
    const selectAllCheckbox = document.getElementById('selectAllServers');
    const serverCheckboxes = document.querySelectorAll('input[type="checkbox"][value]');
    
    serverCheckboxes.forEach(checkbox => {
        checkbox.checked = selectAllCheckbox.checked;
    });
}

// Função para obter servidores selecionados
function getSelectedServers() {
    const checkboxes = document.querySelectorAll('input[type="checkbox"][value]:checked');
    return Array.from(checkboxes).map(cb => cb.value);
}

// Função para testar conexão do servidor
async function testServerConnection(serverId) {
    try {
        const response = await fetch(`${API_BASE}/servers/${serverId}/test-connection`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${getAuthToken()}`
            }
        });

        const result = await response.json();
        
        if (result.success) {
            showNotification('Conexão testada com sucesso!', 'success');
            // Atualizar status do servidor na lista
            updateServerStatus(serverId, 'connected');
        } else {
            showNotification(result.message || 'Erro ao testar conexão', 'error');
            updateServerStatus(serverId, 'disconnected');
        }
    } catch (error) {
        console.error('Erro ao testar conexão:', error);
        showNotification('Erro ao testar conexão', 'error');
        updateServerStatus(serverId, 'disconnected');
    }
}

// Função para atualizar status do servidor
function updateServerStatus(serverId, status) {
    const serverCard = document.querySelector(`[data-server-id="${serverId}"]`);
    if (serverCard) {
        const statusIndicator = serverCard.querySelector('.status-circle');
        if (statusIndicator) {
            statusIndicator.className = `status-circle status-${status}`;
        }
    }
    
    // Atualizar também nos checkboxes
    const checkbox = document.querySelector(`input[value="${serverId}"]`);
    if (checkbox) {
        const checkboxStatusIndicator = checkbox.closest('label').querySelector('.status-circle');
        if (checkboxStatusIndicator) {
            checkboxStatusIndicator.className = `status-circle status-${status}`;
        }
    }
}

// Função para abrir modal de servidor
function openServerModal() {
    // Criar modal de criação
    const modal = document.createElement('div');
    modal.id = 'createServerModal';
    modal.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4';
    modal.innerHTML = `
        <div class="bg-white rounded-lg w-full max-w-md max-h-[90vh] flex flex-col">
            <div class="flex justify-between items-center p-6 border-b">
                <h3 class="text-lg font-semibold">Novo Servidor</h3>
                <button onclick="closeCreateModal()" class="text-gray-500 hover:text-gray-700">
                    <i class="fas fa-times"></i>
                </button>
            </div>
            
            <form id="createServerForm" class="flex-1 overflow-y-auto p-6 space-y-4">
                <div>
                    <label class="label">
                        <span class="label-text">Nome do Servidor</span>
                    </label>
                    <input type="text" id="createServerName" class="input input-bordered w-full" required>
                </div>
                
                <div>
                    <label class="label">
                        <span class="label-text">Host</span>
                    </label>
                    <input type="text" id="createServerHost" class="input input-bordered w-full" required>
                </div>
                
                <div>
                    <label class="label">
                        <span class="label-text">Porta</span>
                    </label>
                    <input type="number" id="createServerPort" value="5432" class="input input-bordered w-full" required>
                </div>
                
                <div>
                    <label class="label">
                        <span class="label-text">Tipo de Banco</span>
                    </label>
                    <select id="createServerType" class="select select-bordered w-full" required>
                        <option value="postgresql" selected>PostgreSQL</option>
                        <option value="mysql">MySQL</option>
                        <option value="sqlserver">SQL Server</option>
                    </select>
                </div>
                
                <div>
                    <label class="label">
                        <span class="label-text">Usuário</span>
                    </label>
                    <input type="text" id="createServerUsername" class="input input-bordered w-full" required>
                </div>
                
                <div>
                    <label class="label">
                        <span class="label-text">Senha</span>
                    </label>
                    <input type="password" id="createServerPassword" class="input input-bordered w-full" required>
                </div>
            </form>
            
            <div class="flex justify-end space-x-2 p-6 border-t bg-gray-50">
                <button type="button" onclick="closeCreateModal()" class="btn btn-ghost">Cancelar</button>
                <button type="submit" form="createServerForm" class="btn btn-primary">Criar Servidor</button>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    // Adicionar evento de submit
    document.getElementById('createServerForm').addEventListener('submit', handleCreateServerSubmit);
}

// Função para fechar modal de criação
function closeCreateModal() {
    const modal = document.getElementById('createServerModal');
    if (modal) {
        modal.remove();
    }
}

// Função para verificar se servidor já existe (excluindo um ID específico)
function checkServerExists(host, port, excludeId = null) {
    return servers.some(server => 
        server.host === host && 
        server.port === port && 
        (!excludeId || server.id !== excludeId)
    );
}

// Função para lidar com o submit do formulário de criação
async function handleCreateServerSubmit(event) {
    event.preventDefault();
    
    const formData = {
        name: document.getElementById('createServerName').value,
        host: document.getElementById('createServerHost').value,
        port: parseInt(document.getElementById('createServerPort').value),
        type: document.getElementById('createServerType').value,
        username: document.getElementById('createServerUsername').value,
        password: document.getElementById('createServerPassword').value
    };
    
    // Verificar se já existe um servidor com o mesmo host e porta
    if (checkServerExists(formData.host, formData.port)) {
        showNotification('Já existe um servidor cadastrado com este host e porta. Verifique os dados e tente novamente.', 'error');
        return;
    }
    
    try {
        const response = await fetch(`${API_BASE}/servers`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${getAuthToken()}`
            },
            body: JSON.stringify(formData)
        });
        
        const result = await response.json();
        
        if (result.success) {
            showNotification('Servidor criado com sucesso!', 'success');
            closeCreateModal();
            loadServers(); // Recarregar lista de servidores
        } else {
            // Mostrar mensagem de erro específica
            let errorMessage = result.message || 'Erro ao criar servidor';
            
            // Se for erro de servidor duplicado, mostrar mensagem mais clara
            if (errorMessage.includes('Já existe um servidor')) {
                errorMessage = 'Já existe um servidor cadastrado com este host e porta. Verifique os dados e tente novamente.';
            }
            
            showNotification(errorMessage, 'error');
        }
    } catch (error) {
        console.error('Erro ao criar servidor:', error);
        showNotification('Erro ao conectar com o servidor', 'error');
    }
}

// Função para editar servidor
function editServer(serverId) {
    const server = servers.find(s => s.id === serverId);
    if (!server) {
        showNotification('Servidor não encontrado', 'error');
        return;
    }
    
    // Criar modal de edição
    const modal = document.createElement('div');
    modal.id = 'editServerModal';
    modal.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4';
    modal.innerHTML = `
        <div class="bg-white rounded-lg w-full max-w-md max-h-[90vh] flex flex-col">
            <div class="flex justify-between items-center p-6 border-b">
                <h3 class="text-lg font-semibold">Editar Servidor</h3>
                <button onclick="closeEditModal()" class="text-gray-500 hover:text-gray-700">
                    <i class="fas fa-times"></i>
                </button>
            </div>
            
            <form id="editServerForm" class="flex-1 overflow-y-auto p-6 space-y-4">
                <input type="hidden" id="editServerId" value="${server.id}">
                
                <div>
                    <label class="label">
                        <span class="label-text">Nome do Servidor</span>
                    </label>
                    <input type="text" id="editServerName" value="${server.name}" class="input input-bordered w-full" required>
                </div>
                
                <div>
                    <label class="label">
                        <span class="label-text">Host</span>
                    </label>
                    <input type="text" id="editServerHost" value="${server.host}" class="input input-bordered w-full" required>
                </div>
                
                <div>
                    <label class="label">
                        <span class="label-text">Porta</span>
                    </label>
                    <input type="number" id="editServerPort" value="${server.port}" class="input input-bordered w-full" required>
                </div>
                
                <div>
                    <label class="label">
                        <span class="label-text">Tipo de Banco</span>
                    </label>
                    <select id="editServerType" class="select select-bordered w-full" required>
                        <option value="postgresql" ${server.type === 'postgresql' ? 'selected' : ''}>PostgreSQL</option>
                        <option value="mysql" ${server.type === 'mysql' ? 'selected' : ''}>MySQL</option>
                        <option value="sqlserver" ${server.type === 'sqlserver' ? 'selected' : ''}>SQL Server</option>
                    </select>
                </div>
                
                <div>
                    <label class="label">
                        <span class="label-text">Usuário</span>
                    </label>
                    <input type="text" id="editServerUsername" value="${server.username}" class="input input-bordered w-full" required>
                </div>
                
                <div>
                    <label class="label">
                        <span class="label-text">Senha</span>
                    </label>
                    <input type="password" id="editServerPassword" placeholder="Digite a nova senha" class="input input-bordered w-full">
                    <div class="text-xs text-gray-500 mt-1">Deixe em branco para manter a senha atual</div>
                </div>
            </form>
            
            <div class="flex justify-end space-x-2 p-6 border-t bg-gray-50">
                <button type="button" onclick="closeEditModal()" class="btn btn-ghost">Cancelar</button>
                <button type="submit" form="editServerForm" class="btn btn-primary">Salvar</button>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    // Adicionar evento de submit
    document.getElementById('editServerForm').addEventListener('submit', handleEditServerSubmit);
}

// Função para fechar modal de edição
function closeEditModal() {
    const modal = document.getElementById('editServerModal');
    if (modal) {
        modal.remove();
    }
}

// Função para lidar com o submit do formulário de edição
async function handleEditServerSubmit(event) {
    event.preventDefault();
    
    const serverId = document.getElementById('editServerId').value;
    const formData = {
        name: document.getElementById('editServerName').value,
        host: document.getElementById('editServerHost').value,
        port: parseInt(document.getElementById('editServerPort').value),
        type: document.getElementById('editServerType').value,
        username: document.getElementById('editServerUsername').value,
        password: document.getElementById('editServerPassword').value || null
    };
    
    // Verificar se já existe um servidor com o mesmo host e porta (excluindo o atual)
    if (checkServerExists(formData.host, formData.port, serverId)) {
        showNotification('Já existe outro servidor cadastrado com este host e porta. Verifique os dados e tente novamente.', 'error');
        return;
    }
    
    try {
        const response = await fetch(`${API_BASE}/servers/${serverId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${getAuthToken()}`
            },
            body: JSON.stringify(formData)
        });
        
        const result = await response.json();
        
        if (result.success) {
            showNotification('Servidor atualizado com sucesso!', 'success');
            closeEditModal();
            loadServers(); // Recarregar lista de servidores
        } else {
            // Mostrar mensagem de erro específica
            let errorMessage = result.message || 'Erro ao atualizar servidor';
            
            // Se for erro de servidor duplicado, mostrar mensagem mais clara
            if (errorMessage.includes('Já existe um servidor')) {
                errorMessage = 'Já existe um servidor cadastrado com este host e porta. Verifique os dados e tente novamente.';
            }
            
            showNotification(errorMessage, 'error');
        }
    } catch (error) {
        console.error('Erro ao atualizar servidor:', error);
        showNotification('Erro ao conectar com o servidor', 'error');
    }
}

// Função para deletar servidor
async function deleteServer(serverId) {
    const server = servers.find(s => s.id === serverId);
    if (!server) {
        showNotification('Servidor não encontrado', 'error');
        return;
    }
    
    if (confirm(`Tem certeza que deseja excluir o servidor "${server.name}"?`)) {
        try {
            const response = await fetch(`${API_BASE}/servers/${serverId}`, {
                method: 'DELETE',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${getAuthToken()}`
                }
            });
            
            const result = await response.json();
            
            if (result.success) {
                showNotification('Servidor removido com sucesso!', 'success');
                loadServers(); // Recarregar lista de servidores
            } else {
                showNotification(result.message || 'Erro ao remover servidor', 'error');
            }
        } catch (error) {
            console.error('Erro ao remover servidor:', error);
            showNotification('Erro ao conectar com o servidor', 'error');
        }
    }
}

// Função para formatar tamanho
function formatSize(size) {
    // Verificar se size é válido
    if (!size || size === 'NaN undefined' || size === 'Carregando...') {
        return 'Carregando...';
    }
    
    // Se já está formatado (contém espaço), retornar como está
    if (typeof size === 'string' && size.includes(' ')) {
        return size;
    }
    
    // Se é um número, converter para formato legível
    const bytes = parseInt(size);
    if (isNaN(bytes) || bytes === 0) return 'N/A';
    
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
}

// Função para copiar informações da database
async function copyDatabaseInfo(host, databaseName) {
    const connectionString = `${host}/${databaseName}`;
    
    try {
        // Tentar usar a API moderna do clipboard primeiro
        if (navigator.clipboard && window.isSecureContext) {
            await navigator.clipboard.writeText(connectionString);
            showNotification('Informações copiadas para a área de transferência!', 'success');
            return;
        }
    } catch (error) {
        console.log('Clipboard API não disponível, usando fallback:', error);
    }
    
    // Fallback para navegadores que não suportam clipboard API
    try {
        // Método 1: Usar textarea temporário
        const textArea = document.createElement('textarea');
        textArea.value = connectionString;
        textArea.style.position = 'fixed';
        textArea.style.left = '-999999px';
        textArea.style.top = '-999999px';
        textArea.style.opacity = '0';
        textArea.style.pointerEvents = 'none';
        document.body.appendChild(textArea);
        
        // Tentar diferentes métodos de seleção
        textArea.focus();
        textArea.select();
        
        // Para Linux, às vezes precisamos de um pequeno delay
        setTimeout(() => {
            const successful = document.execCommand('copy');
            document.body.removeChild(textArea);
            
            if (successful) {
                showNotification('Informações copiadas para a área de transferência!', 'success');
            } else {
                // Método 2: Tentar com range selection
                tryCopyWithRange(connectionString);
            }
        }, 100);
        
    } catch (error) {
        console.error('Erro ao copiar com textarea:', error);
        // Método 2: Tentar com range selection
        tryCopyWithRange(connectionString);
    }
}

// Método alternativo usando range selection
function tryCopyWithRange(text) {
    try {
        const range = document.createRange();
        const selection = window.getSelection();
        
        // Criar elemento temporário
        const tempElement = document.createElement('div');
        tempElement.textContent = text;
        tempElement.style.position = 'absolute';
        tempElement.style.left = '-9999px';
        document.body.appendChild(tempElement);
        
        range.selectNodeContents(tempElement);
        selection.removeAllRanges();
        selection.addRange(range);
        
        const successful = document.execCommand('copy');
        selection.removeAllRanges();
        document.body.removeChild(tempElement);
        
        if (successful) {
            showNotification('Informações copiadas para a área de transferência!', 'success');
        } else {
            // Último recurso: mostrar modal para cópia manual
            showCopyManualModal(text);
        }
    } catch (error) {
        console.error('Erro ao copiar com range:', error);
        showCopyManualModal(text);
    }
}

// Função para mostrar modal de cópia manual
function showCopyManualModal(text) {
    // Remover modal existente se houver
    const existingModal = document.getElementById('copyManualModal');
    if (existingModal) {
        existingModal.remove();
    }
    
    // Criar modal
    const modal = document.createElement('div');
    modal.id = 'copyManualModal';
    modal.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4';
    modal.innerHTML = `
        <div class="bg-white rounded-lg w-full max-w-md flex flex-col">
            <div class="flex justify-between items-center p-6 border-b">
                <h3 class="text-lg font-semibold">Copiar Informações</h3>
                <button onclick="closeCopyManualModal()" class="text-gray-500 hover:text-gray-700">
                    <i class="fas fa-times"></i>
                </button>
            </div>
            
            <div class="p-6">
                <p class="text-sm text-gray-600 mb-4">
                    Não foi possível copiar automaticamente. Selecione o texto abaixo e copie manualmente:
                </p>
                <div class="bg-gray-100 p-3 rounded border">
                    <input type="text" value="${text}" class="w-full bg-transparent border-none outline-none text-sm font-mono" readonly onclick="this.select()">
                </div>
            </div>
            
            <div class="flex justify-end p-6 border-t bg-gray-50">
                <button onclick="closeCopyManualModal()" class="btn btn-primary">Fechar</button>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    // Focar no input automaticamente
    setTimeout(() => {
        const input = modal.querySelector('input');
        if (input) {
            input.focus();
            input.select();
        }
    }, 100);
}

// Função para fechar modal de cópia manual
function closeCopyManualModal() {
    const modal = document.getElementById('copyManualModal');
    if (modal) {
        modal.remove();
    }
}

// Função para testar suporte ao clipboard
function testClipboardSupport() {
    console.log('=== TESTE DE SUPORTE AO CLIPBOARD ===');
    
    // Verificar se a API Clipboard está disponível
    console.log('navigator.clipboard disponível:', !!navigator.clipboard);
    console.log('window.isSecureContext:', window.isSecureContext);
    
    // Verificar se document.execCommand está disponível
    console.log('document.execCommand disponível:', !!document.execCommand);
    
    // Testar se estamos em contexto seguro (HTTPS ou localhost)
    const isSecure = window.isSecureContext || window.location.protocol === 'https:' || window.location.hostname === 'localhost';
    console.log('Contexto seguro:', isSecure);
    
    // Verificar user agent para identificar o sistema operacional
    const userAgent = navigator.userAgent;
    console.log('User Agent:', userAgent);
    
    if (userAgent.includes('Linux')) {
        console.log('Sistema operacional detectado: Linux');
    } else if (userAgent.includes('Windows')) {
        console.log('Sistema operacional detectado: Windows');
    } else if (userAgent.includes('Mac')) {
        console.log('Sistema operacional detectado: macOS');
    }
    
    return {
        clipboardAPI: !!navigator.clipboard,
        secureContext: isSecure,
        execCommand: !!document.execCommand,
        userAgent: userAgent
    };
}

// Expor função de teste globalmente
window.testClipboardSupport = testClipboardSupport;

// Função para testar cópia no Linux
function testLinuxCopy() {
    console.log('=== TESTE DE CÓPIA NO LINUX ===');
    
    const testText = 'teste-copia-linux-' + Date.now();
    
    // Testar todos os métodos
    console.log('Testando cópia com texto:', testText);
    
    // Método 1: Clipboard API
    if (navigator.clipboard && window.isSecureContext) {
        navigator.clipboard.writeText(testText)
            .then(() => console.log('✅ Clipboard API funcionou'))
            .catch(err => console.log('❌ Clipboard API falhou:', err));
    } else {
        console.log('⚠️ Clipboard API não disponível');
    }
    
    // Método 2: execCommand
    try {
        const textArea = document.createElement('textarea');
        textArea.value = testText;
        textArea.style.position = 'fixed';
        textArea.style.left = '-999999px';
        document.body.appendChild(textArea);
        textArea.select();
        const success = document.execCommand('copy');
        document.body.removeChild(textArea);
        console.log(success ? '✅ execCommand funcionou' : '❌ execCommand falhou');
    } catch (error) {
        console.log('❌ execCommand falhou:', error);
    }
    
    // Método 3: Range selection
    try {
        const range = document.createRange();
        const selection = window.getSelection();
        const tempElement = document.createElement('div');
        tempElement.textContent = testText;
        tempElement.style.position = 'absolute';
        tempElement.style.left = '-9999px';
        document.body.appendChild(tempElement);
        
        range.selectNodeContents(tempElement);
        selection.removeAllRanges();
        selection.addRange(range);
        
        const success = document.execCommand('copy');
        selection.removeAllRanges();
        document.body.removeChild(tempElement);
        console.log(success ? '✅ Range selection funcionou' : '❌ Range selection falhou');
    } catch (error) {
        console.log('❌ Range selection falhou:', error);
    }
}

// Expor função de teste do Linux globalmente
window.testLinuxCopy = testLinuxCopy;

// Função para carregar databases dos servidores selecionados (progressiva)
async function loadDatabases() {
    const selectedServers = getSelectedServers();
    
    if (selectedServers.length === 0) {
        showNotification('Selecione pelo menos um servidor.', 'warning');
        return;
    }
    
    // Mostrar indicador discreto de carregamento
    const btnLoadDatabases = document.getElementById('btnLoadDatabases');
    const loadingIndicator = document.getElementById('loadingIndicator');
    const loadingText = document.getElementById('loadingText');
    
    // Desabilitar botão e mostrar indicador
    btnLoadDatabases.disabled = true;
    btnLoadDatabases.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i>Carregando...';
    loadingIndicator.classList.remove('hidden');
    loadingText.textContent = 'Iniciando carregamento progressivo...';
    
    // Limpar resultados anteriores
    const databasesSection = document.getElementById('databasesSection');
    const resultsSummary = document.getElementById('resultsSummary');
    if (resultsSummary) resultsSummary.remove();
    databasesSection.style.display = 'none';
    
    // Inicializar dados
    allDatabasesData = [];
    currentPage = 1;
    
    try {
        // Usar carregamento progressivo
        await loadDatabasesProgressive(selectedServers, loadingText);
        
    } catch (error) {
        console.error('Erro ao carregar databases:', error);
        showNotification('Erro ao conectar com o servidor.', 'error');
    } finally {
        // Restaurar botão e ocultar indicador
        btnLoadDatabases.disabled = false;
        btnLoadDatabases.innerHTML = '<i class="fas fa-search mr-2"></i>Listar Databases';
        loadingIndicator.classList.add('hidden');
    }
}

// Função para carregamento progressivo real
async function loadDatabasesProgressive(serverIds, loadingText) {
    try {
        // Mostrar skeleton loading
        showSkeletonLoading();
        
        // Toast de início
        showToast('Iniciando carregamento progressivo...', 'info', 3000);
        
        const response = await fetch(`${API_BASE}/servers/list-databases-progressive`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${getAuthToken()}`
            },
            body: JSON.stringify({ serverIds: serverIds })
        });
        
        if (!response.ok) {
            throw new Error('Erro ao iniciar carregamento progressivo');
        }
        
        const data = await response.json();
        const sessionId = data.sessionId;
        
        // Toast de progresso iniciado
        showToast('Carregamento iniciado! Verificando progresso...', 'success', 2000);
        
        // Polling para verificar progresso
        const pollInterval = setInterval(async () => {
            try {
                const progressResponse = await fetch(`${API_BASE}/servers/progressive-progress/${sessionId}`, {
                    headers: {
                        'Authorization': `Bearer ${getAuthToken()}`
                    }
                });
                
                if (!progressResponse.ok) {
                    throw new Error('Erro ao verificar progresso');
                }
                
                const progressData = await progressResponse.json();
                
                if (progressData.success) {
                    const { status, completed, total, results, progress } = progressData.data;
                    
                    // Atualizar texto de progresso
                    loadingText.textContent = `Processando: ${completed}/${total} servidores (${Math.round(progress)}%)`;
                    
                    // Atualizar dados se houver novos resultados
                    if (results.length > allDatabasesData.length) {
                        allDatabasesData = results;
                        hideSkeletonLoading();
                        displayDatabasesGrid(allDatabasesData);
                        
                        // Toast de progresso
                        if (completed > 0 && completed < total) {
                            showToast(`${completed}/${total} servidores processados`, 'info', 2000);
                        }
                    }
                    
                    // Verificar se concluído
                    if (status === 'completed') {
                        clearInterval(pollInterval);
                        loadingText.textContent = '✓ Carregamento concluído!';
                        
                        // Toast de conclusão
                        showToast('Carregamento concluído! Atualizando tamanhos...', 'success', 3000);
                        
                        // Atualizar tamanhos em background
                        updateSizesInBackground(serverIds);
                    } else if (status === 'error') {
                        clearInterval(pollInterval);
                        hideSkeletonLoading();
                        showToast('Erro no processamento progressivo', 'error', 5000);
                        throw new Error('Erro no processamento progressivo');
                    }
                }
            } catch (error) {
                clearInterval(pollInterval);
                hideSkeletonLoading();
                console.error('Erro ao verificar progresso:', error);
                showToast('Erro ao verificar progresso', 'error', 5000);
                throw error;
            }
        }, 1000); // Verificar a cada segundo
        
        // Timeout de segurança (5 minutos)
        setTimeout(() => {
            clearInterval(pollInterval);
            hideSkeletonLoading();
            showToast('Timeout no carregamento progressivo', 'error', 5000);
            throw new Error('Timeout no carregamento progressivo');
        }, 300000);
        
    } catch (error) {
        console.error('Erro no carregamento progressivo:', error);
        hideSkeletonLoading();
        showToast('Erro no carregamento progressivo', 'error', 5000);
        throw error;
    }
}

// Função para atualizar tamanhos em background
async function updateSizesInBackground(serverIds) {
    if (!serverIds || serverIds.length === 0) return;
    
    // Toast de início da atualização de tamanhos
    showToast('Iniciando atualização de tamanhos em background...', 'info', 2000);
    
    // Aguardar um pouco antes de começar a atualizar tamanhos
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    let updatedCount = 0;
    
    for (const serverId of serverIds) {
        try {
            console.log(`Tentando atualizar tamanhos para servidor: ${serverId}`);
            console.log(`URL: ${API_BASE}/servers/${serverId}/update-sizes`);
            
            const response = await fetch(`${API_BASE}/servers/${serverId}/update-sizes`, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${getAuthToken()}`
                }
            });
            
            console.log(`Response status: ${response.status}`);
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            const result = await response.json();
            console.log('Result:', result);
            
            if (result.success && result.data.sizes) {
                // Atualizar tamanhos na tabela
                result.data.sizes.forEach(sizeData => {
                    const sizeCells = document.querySelectorAll(`[data-database="${sizeData.name}"]`);
                    sizeCells.forEach(cell => {
                        if (cell && cell.textContent === 'Carregando...') {
                            cell.textContent = formatSize(sizeData.size);
                            updatedCount++;
                        }
                    });
                });
            }
        } catch (error) {
            console.error(`Erro ao atualizar tamanhos do servidor ${serverId}:`, error);
            showToast(`Erro ao atualizar tamanhos: ${error.message}`, 'error', 3000);
        }
    }
    
    // Toast de conclusão
    if (updatedCount > 0) {
        showToast(`${updatedCount} tamanhos atualizados com sucesso!`, 'success', 3000);
    } else {
        showToast('Nenhum tamanho foi atualizado', 'warning', 3000);
    }
}

// Função para filtrar e paginar databases (com debounce)
const filterAndPaginateDatabases = debounce((page) => {
    if (!allDatabasesData.length) return;
    
    // Verificar se os elementos existem antes de acessar
    const serverSearchElement = document.getElementById('serverSearch');
    const databaseSearchElement = document.getElementById('databaseSearch');
    const statusFilterElement = document.getElementById('statusFilter');
    const versionFilterElement = document.getElementById('versionFilter');
    const perPageElement = document.getElementById('databasesPerPage');
    
    const serverSearch = serverSearchElement ? serverSearchElement.value.trim().toLowerCase() : '';
    const databaseSearch = databaseSearchElement ? databaseSearchElement.value.trim().toLowerCase() : '';
    const statusFilter = statusFilterElement ? statusFilterElement.value : '';
    const versionFilter = versionFilterElement ? versionFilterElement.value.trim() : '';
    const perPage = perPageElement ? parseInt(perPageElement.value, 10) : 10;
    
    if (page) currentPage = page; else currentPage = 1;

    // Filtra databases
    let filtered = [];
    allDatabasesData.forEach(serverData => {
        // Filtrar por status
        if (statusFilter && statusFilter !== '') {
            if (statusFilter === 'success' && !serverData.success) return;
            if (statusFilter === 'error' && serverData.success) return;
        }
        
        // Filtrar por servidor
        if (serverSearch && !serverData.serverName.toLowerCase().includes(serverSearch)) return;
        
        // Filtrar por versão da grid (campo version da database)
        if (versionFilter && versionFilter !== '') {
            // Verificar se alguma database do servidor tem a versão filtrada
            const hasMatchingVersion = serverData.databases && serverData.databases.some(db => 
                db.version && db.version.includes(versionFilter)
            );
            if (!hasMatchingVersion) return;
        }
        
        if (serverData.success && serverData.databases && serverData.databases.length > 0) {
            const dbs = serverData.databases.filter(db => {
                // Filtrar por nome da database
                if (databaseSearch && !db.name.toLowerCase().includes(databaseSearch)) return false;
                return true;
            });
            if (dbs.length > 0) {
                filtered.push({ ...serverData, databases: dbs });
            }
        } else if (!serverData.success) {
            filtered.push(serverData);
        }
    });

    // Achatar todas as databases para paginação global
    let flat = [];
    filtered.forEach(serverData => {
        if (serverData.success && serverData.databases) {
            serverData.databases.forEach(db => {
                flat.push({
                    ...db,
                    serverName: serverData.serverName,
                    serverHost: serverData.serverHost
                });
            });
        }
    });
    // Adiciona erros como linhas separadas
    filtered.forEach(serverData => {
        if (!serverData.success) {
            flat.push({
                error: true,
                serverName: serverData.serverName,
                errorMsg: serverData.error
            });
        }
    });

    // Paginação
    const total = flat.length;
    const totalPages = Math.max(1, Math.ceil(total / perPage));
    if (currentPage > totalPages) currentPage = totalPages;
    const start = (currentPage - 1) * perPage;
    const end = start + perPage;
    const pageData = flat.slice(start, end);

    // Atualizar contador de resultados
    updateResultsCount(total, flat.length);

    renderDatabasesTable(pageData, total, totalPages);
    renderDatabasesPagination(totalPages);
}, 300);

// Função para atualizar contador de resultados
function updateResultsCount(total, filtered) {
    const resultsCount = document.getElementById('resultsCount');
    if (resultsCount) {
        if (filtered === total) {
            resultsCount.textContent = `${total} resultado(s)`;
        } else {
            resultsCount.textContent = `${filtered} de ${total} resultado(s)`;
        }
    }
}

// Função para limpar filtros
function clearFilters() {
    const serverSearch = document.getElementById('serverSearch');
    const databaseSearch = document.getElementById('databaseSearch');
    const statusFilter = document.getElementById('statusFilter');
    const versionFilter = document.getElementById('versionFilter');
    
    if (serverSearch) serverSearch.value = '';
    if (databaseSearch) databaseSearch.value = '';
    if (statusFilter) statusFilter.value = '';
    if (versionFilter) versionFilter.value = '';
    
    // Resetar página para 1
    currentPage = 1;
    
    // Reaplicar filtros
    filterAndPaginateDatabases();
    
    // Toast de confirmação
    showToast('Filtros limpos!', 'success', 2000);
}

// Função para exibir a tabela de databases paginada
function renderDatabasesTable(pageData, total, totalPages) {
    const databasesSection = document.getElementById('databasesSection');
    let databasesGrid = document.getElementById('databasesGrid');
    
    if (!databasesSection) {
        console.error('Elemento databasesSection não encontrado');
        return;
    }
    
    // Se databasesGrid não existe, criar
    if (!databasesGrid) {
        console.log('Criando elemento databasesGrid');
        databasesGrid = document.createElement('div');
        databasesGrid.id = 'databasesGrid';
        databasesSection.appendChild(databasesGrid);
    }
    
    if (!pageData.length) {
        databasesGrid.innerHTML = `<div class="alert alert-info"><p>Nenhuma database encontrada.</p></div>`;
        databasesSection.style.display = 'block';
        return;
    }
    
    if (!pageData.length) {
        databasesGrid.innerHTML = `<div class="alert alert-info"><p>Nenhuma database encontrada.</p></div>`;
        databasesSection.style.display = 'block';
        return;
    }
    let html = `
        <div class="overflow-x-auto">
            <table class="table table-zebra w-full">
                <thead>
                    <tr>
                        <th>Servidor</th>
                        <th>Nome</th>
                        <th>Versão</th>
                        <th>Tamanho</th>
                        <th>Dono</th>
                        <th>Comentário</th>
                        <th style="width: 90px;">Ação</th>
                    </tr>
                </thead>
                <tbody>
    `;
    pageData.forEach((db, index) => {
        if (db.error) {
            html += `<tr><td colspan="6"><span class="text-error"><strong>${db.serverName}:</strong> ${db.errorMsg || 'Erro ao conectar com o servidor'}</span></td></tr>`;
        } else {
            const comment = db.comment || '';
            const commentDisplay = comment.length > 50 ? comment.substring(0, 50) + '...' : comment;
            const hasLongComment = comment.length > 50;
            
            html += `<tr>
                <td>${db.serverName}</td>
                <td class="break-all">${db.name}</td>
                <td>${db.version ? `<span class="badge badge-info">${db.version}</span>` : '<span class="text-gray-400">N/A</span>'}</td>
                <td data-database="${db.name}">${formatSize(db.size)}</td>
                <td>${db.owner || 'N/A'}</td>
                <td class="max-w-xs">
                    ${comment ? 
                        `<span class="${hasLongComment ? 'cursor-pointer text-primary hover:text-primary-focus' : ''}" 
                              ${hasLongComment ? `onclick="showCommentModal('${db.name}', '${comment.replace(/'/g, "\\'")}', '${db.serverName}')"` : ''}
                              title="${hasLongComment ? 'Clique para ver completo' : comment}">
                            ${commentDisplay}
                        </span>` : 
                        '<span class="text-gray-400">-</span>'
                    }
                </td>
                <td><button class="btn btn-info btn-sm" onclick="copyDatabaseInfo('${db.serverHost}', '${db.name}')" title="Copiar"><i class="fas fa-copy"></i></button></td>
            </tr>`;
        }
    });
    html += `</tbody></table></div>`;
    databasesGrid.innerHTML = html;
    databasesSection.style.display = 'block';
}

// Função para mostrar modal com comentário completo
function showCommentModal(databaseName, comment, serverName) {
    // Remover modal existente se houver
    const existingModal = document.getElementById('commentModal');
    if (existingModal) {
        existingModal.remove();
    }
    
    // Criar modal
    const modal = document.createElement('div');
    modal.id = 'commentModal';
    modal.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4';
    modal.innerHTML = `
        <div class="bg-white rounded-lg w-full max-w-2xl max-h-[80vh] flex flex-col">
            <div class="flex justify-between items-center p-6 border-b">
                <h3 class="text-lg font-semibold">Comentário da Database</h3>
                <button onclick="closeCommentModal()" class="text-gray-500 hover:text-gray-700">
                    <i class="fas fa-times"></i>
                </button>
            </div>
            
            <div class="flex-1 overflow-y-auto p-6">
                <div class="space-y-4">
                    <div>
                        <label class="label">
                            <span class="label-text font-medium">Servidor:</span>
                        </label>
                        <p class="text-base-content/70">${serverName}</p>
                    </div>
                    
                    <div>
                        <label class="label">
                            <span class="label-text font-medium">Database:</span>
                        </label>
                        <p class="text-base-content/70 font-mono">${databaseName}</p>
                    </div>
                    
                    <div>
                        <label class="label">
                            <span class="label-text font-medium">Comentário:</span>
                        </label>
                        <div class="bg-gray-50 p-4 rounded-lg max-h-96 overflow-y-auto">
                            <p class="whitespace-pre-wrap text-base-content/80">${comment}</p>
                        </div>
                    </div>
                </div>
            </div>
            
            <div class="flex justify-end p-6 border-t bg-gray-50">
                <button onclick="closeCommentModal()" class="btn btn-primary">Fechar</button>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
}

// Função para fechar modal de comentário
function closeCommentModal() {
    const modal = document.getElementById('commentModal');
    if (modal) {
        modal.remove();
    }
}

// Função para exibir paginação
function renderDatabasesPagination(totalPages) {
    let pagination = document.getElementById('databasesPagination');
    
    // Se pagination não existe, criar
    if (!pagination) {
        console.log('Criando elemento databasesPagination');
        const databasesSection = document.getElementById('databasesSection');
        if (databasesSection) {
            pagination = document.createElement('div');
            pagination.id = 'databasesPagination';
            pagination.className = 'join';
            pagination.style.display = 'none';
            
            // Encontrar o container correto para inserir
            const paginationContainer = databasesSection.querySelector('.flex.justify-center.mt-6');
            if (paginationContainer) {
                paginationContainer.appendChild(pagination);
            } else {
                databasesSection.appendChild(pagination);
            }
        } else {
            console.error('Elemento databasesSection não encontrado para criar paginação');
            return;
        }
    }
    
    if (totalPages <= 1) {
        pagination.style.display = 'none';
        return;
    }
    
    let html = '<div class="join">';
    
    // Botão Anterior
    html += `<button class="join-item btn btn-outline" ${currentPage === 1 ? 'disabled' : ''} onclick="filterAndPaginateDatabases(${currentPage - 1})">
        <i class="fas fa-chevron-left"></i>
        Anterior
    </button>`;
    
    // Números das páginas
    for (let i = 1; i <= totalPages; i++) {
        if (i === currentPage) {
            html += `<button class="join-item btn btn-active">${i}</button>`;
        } else {
            html += `<button class="join-item btn btn-outline" onclick="filterAndPaginateDatabases(${i})">${i}</button>`;
        }
    }
    
    // Botão Próxima
    html += `<button class="join-item btn btn-outline" ${currentPage === totalPages ? 'disabled' : ''} onclick="filterAndPaginateDatabases(${currentPage + 1})">
        Próxima
        <i class="fas fa-chevron-right"></i>
    </button>`;
    
    html += '</div>';
    
    pagination.innerHTML = html;
    pagination.style.display = 'flex';
    pagination.style.justifyContent = 'center';
    pagination.style.marginTop = '1rem';
}

// Função principal para exibir databases (chamada pelo backend)
function displayDatabasesGrid(databasesData) {
    allDatabasesData = databasesData;
    currentPage = 1;
    
    // Aguardar um pouco para garantir que o DOM esteja pronto
    setTimeout(() => {
        // Mostrar resumo dos resultados
        showResultsSummary(databasesData);
        
        filterAndPaginateDatabases();
    }, 100);
}

// Função para mostrar resumo dos resultados
function showResultsSummary(databasesData) {
    const totalServers = databasesData.length;
    const successfulServers = databasesData.filter(server => server.success).length;
    const failedServers = totalServers - successfulServers;
    const totalDatabases = databasesData.reduce((total, server) => {
        return total + (server.success && server.databases ? server.databases.length : 0);
    }, 0);
    
    // Verificar se há dados do cache
    const fromCache = databasesData.some(server => server.fromCache);
    const cacheIndicator = fromCache ? '<span class="badge badge-warning ml-2">Cache</span>' : '';
    
    // Criar ou atualizar o resumo
    let summaryHtml = `
        <div class="alert alert-info mb-4">
            <div class="flex items-center justify-between">
                <div>
                    <h4 class="font-bold">Resumo da Busca ${cacheIndicator}</h4>
                    <div class="text-sm space-y-1 mt-2">
                        <div class="flex items-center space-x-2">
                            <span class="badge badge-success">${successfulServers}</span>
                            <span>servidores conectados com sucesso</span>
                        </div>
                        ${failedServers > 0 ? `
                        <div class="flex items-center space-x-2">
                            <span class="badge badge-error">${failedServers}</span>
                            <span>servidores com erro</span>
                        </div>
                        ` : ''}
                        <div class="flex items-center space-x-2">
                            <span class="badge badge-primary">${totalDatabases}</span>
                            <span>databases encontradas</span>
                        </div>
                        ${fromCache ? `
                        <div class="flex items-center space-x-2 mt-2">
                            <span class="badge badge-warning">Cache</span>
                            <span>Dados carregados do cache (atualizado há menos de 1 hora)</span>
                        </div>
                        ` : ''}
                    </div>
                </div>
                ${fromCache ? `
                <div>
                    <button onclick="forceCacheUpdate()" class="btn btn-warning btn-sm">
                        <i class="fas fa-sync-alt"></i>
                        Atualizar Cache
                    </button>
                </div>
                ` : ''}
            </div>
        </div>
    `;
    
    // Adicionar detalhes dos servidores com erro
    const failedServersList = databasesData.filter(server => !server.success);
    if (failedServersList.length > 0) {
        summaryHtml += `
            <div class="alert alert-warning mb-4">
                <div>
                    <h4 class="font-bold">Servidores com Erro:</h4>
                    <ul class="list-disc list-inside mt-2 text-sm">
                        ${failedServersList.map(server => `
                            <li><strong>${server.serverName}:</strong> ${server.error}</li>
                        `).join('')}
                    </ul>
                </div>
            </div>
        `;
    }
    
    // Inserir o resumo antes da seção de databases
    const databasesSection = document.getElementById('databasesSection');
    if (databasesSection && databasesSection.parentNode) {
        const existingSummary = document.getElementById('resultsSummary');
        if (existingSummary) {
            existingSummary.remove();
        }
        
        const summaryDiv = document.createElement('div');
        summaryDiv.id = 'resultsSummary';
        summaryDiv.innerHTML = summaryHtml;
        databasesSection.parentNode.insertBefore(summaryDiv, databasesSection);
    }
}

// Função para forçar atualização do cache (progressivo)
async function forceCacheUpdate() {
    const selectedServers = getSelectedServers();
    
    if (selectedServers.length === 0) {
        showNotification('Selecione pelo menos um servidor.', 'warning');
        return;
    }
    
    try {
        showToast('Limpando cache...', 'info', 2000);
        
        // Primeiro, limpar cache no backend
        const clearResponse = await fetch(`${API_BASE}/servers/force-cache-update`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${getAuthToken()}`
            },
            body: JSON.stringify({ serverIds: selectedServers })
        });
        
        if (!clearResponse.ok) {
            throw new Error('Erro ao limpar cache no servidor');
        }
        
        const clearResult = await clearResponse.json();
        showToast('Cache limpo! Carregando dados atualizados...', 'success', 2000);
        
        // Limpar resultados anteriores
        const databasesSection = document.getElementById('databasesSection');
        const resultsSummary = document.getElementById('resultsSummary');
        if (resultsSummary) resultsSummary.remove();
        if (databasesSection) databasesSection.style.display = 'none';
        
        // Inicializar dados
        allDatabasesData = [];
        currentPage = 1;
        
        // Mostrar indicador de carregamento
        const btnLoadDatabases = document.getElementById('btnLoadDatabases');
        const loadingIndicator = document.getElementById('loadingIndicator');
        const loadingText = document.getElementById('loadingText');
        
        if (btnLoadDatabases) {
            btnLoadDatabases.disabled = true;
            btnLoadDatabases.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i>Atualizando...';
        }
        
        if (loadingIndicator) loadingIndicator.classList.remove('hidden');
        if (loadingText) loadingText.textContent = 'Carregando dados atualizados...';
        
        // Usar carregamento progressivo
        await loadDatabasesProgressive(selectedServers, loadingText);
        
    } catch (error) {
        console.error('Erro ao forçar atualização de cache:', error);
        showToast('Erro ao atualizar cache', 'error', 5000);
    } finally {
        // Restaurar botão
        const btnLoadDatabases = document.getElementById('btnLoadDatabases');
        const loadingIndicator = document.getElementById('loadingIndicator');
        
        if (btnLoadDatabases) {
            btnLoadDatabases.disabled = false;
            btnLoadDatabases.innerHTML = '<i class="fas fa-search mr-2"></i>Listar Databases';
        }
        
        if (loadingIndicator) loadingIndicator.classList.add('hidden');
    }
}

// Função para atualizar a lista de databases
function refreshDatabases() {
    const databasesSection = document.getElementById('databasesSection');
    const resultsSummary = document.getElementById('resultsSummary');
    
    // Ocultar seções
    databasesSection.style.display = 'none';
    if (resultsSummary) {
        resultsSummary.remove();
    }
    
    // Limpar dados
    allDatabasesData = [];
    currentPage = 1;
    
    loadDatabases();
}

// ==================== FUNCIONALIDADES DE BUSCA DE OBJETOS ====================

// Variáveis globais para busca de objetos
let objectSearchResults = [];

// Função para abrir modal de busca de objetos
function openObjectSearchModal() {
    const modal = document.getElementById('objectSearchModal');
    if (modal) {
        // Carregar checkboxes dos servidores
        renderObjectSearchServerCheckboxes();
        
        // Mostrar modal
        modal.showModal();
        
        // Focar no campo de busca
        setTimeout(() => {
            const searchInput = document.getElementById('objectSearchTerm');
            if (searchInput) {
                searchInput.focus();
            }
        }, 100);
    }
}

// Função para fechar modal de busca de objetos
function closeObjectSearchModal() {
    const modal = document.getElementById('objectSearchModal');
    if (modal) {
        modal.close();
        
        // Limpar resultados
        clearObjectSearchResults();
    }
}

// Função para renderizar checkboxes dos servidores no modal de busca
function renderObjectSearchServerCheckboxes() {
    const container = document.getElementById('objectSearchServerCheckboxes');
    
    if (servers.length === 0) {
        container.innerHTML = '<p class="text-gray-500 text-sm">Nenhum servidor disponível</p>';
        return;
    }

    container.innerHTML = `
        <div class="form-control mb-2">
            <label class="label cursor-pointer bg-base-200 p-2 rounded hover:bg-base-300 transition-colors">
                <span class="label-text text-sm font-medium">Selecionar Todos</span>
                <input type="checkbox" class="checkbox checkbox-primary checkbox-sm" id="selectAllObjectServers" onchange="toggleAllObjectServers()">
            </label>
        </div>
        <div class="space-y-1">
            ${servers.map(server => `
                <label class="label cursor-pointer p-2 hover:bg-base-200 rounded">
                    <span class="label-text text-sm flex items-center">
                        <div class="status-circle status-${server.connectionStatus || 'unknown'} mr-2"></div>
                        ${server.name}
                    </span>
                    <input type="checkbox" class="checkbox checkbox-sm" value="${server.id}" data-server-name="${server.name}">
                </label>
            `).join('')}
        </div>
    `;
}

// Função para alternar todos os servidores na busca de objetos
function toggleAllObjectServers() {
    const selectAllCheckbox = document.getElementById('selectAllObjectServers');
    const serverCheckboxes = document.querySelectorAll('#objectSearchServerCheckboxes input[type="checkbox"][value]');
    
    serverCheckboxes.forEach(checkbox => {
        checkbox.checked = selectAllCheckbox.checked;
    });
}

// Função para obter servidores selecionados na busca de objetos
function getSelectedObjectServers() {
    const checkboxes = document.querySelectorAll('#objectSearchServerCheckboxes input[type="checkbox"][value]:checked');
    return Array.from(checkboxes).map(cb => cb.value);
}

// Função para buscar objetos
async function searchObjects() {
    const searchTerm = document.getElementById('objectSearchTerm').value.trim();
    const searchType = document.getElementById('objectSearchType').value;
    const objectType = document.getElementById('objectTypeFilter').value;
    const searchLimit = document.getElementById('objectSearchLimit').value;
    const selectedServers = getSelectedObjectServers();
    
    // Validações
    if (!searchTerm) {
        showNotification('Digite um termo de busca', 'warning');
        return;
    }
    
    if (searchTerm.length < 3) {
        showNotification('Termo de busca deve ter pelo menos 3 caracteres', 'warning');
        return;
    }
    
    if (selectedServers.length === 0) {
        showNotification('Selecione pelo menos um servidor', 'warning');
        return;
    }
    
    if (!objectType) {
        showNotification('Selecione um tipo de objeto', 'warning');
        return;
    }
    
    // Mostrar loading
    const btnSearch = document.getElementById('btnSearchObjectsExecute');
    const originalText = btnSearch.innerHTML;
    btnSearch.disabled = true;
    btnSearch.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i>Buscando...';
    
    try {
                const response = await fetch(`${API_BASE}/servers/search-objects`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${getAuthToken()}`
                    },
                    body: JSON.stringify({
                        searchTerm: searchTerm,
                        searchType: searchType,
                        objectType: objectType,
                        searchLimit: parseInt(searchLimit),
                        serverIds: selectedServers
                    })
                });
        
        if (!response.ok) {
            throw new Error('Erro ao buscar objetos');
        }
        
        const result = await response.json();
        
        if (result.success) {
            objectSearchResults = result.data || [];
            // Armazenar summary para uso nas estatísticas
            window.lastSearchSummary = result.summary || {};
            displayObjectSearchResults(objectSearchResults);
            showNotification(`Encontrados ${objectSearchResults.length} objetos`, 'success');
        } else {
            showNotification(result.message || 'Erro ao buscar objetos', 'error');
        }
        
    } catch (error) {
        console.error('Erro ao buscar objetos:', error);
        showNotification('Erro ao conectar com o servidor', 'error');
    } finally {
        // Restaurar botão
        btnSearch.disabled = false;
        btnSearch.innerHTML = originalText;
    }
}

// Função para exibir resultados da busca de objetos
function displayObjectSearchResults(results) {
    const resultsDiv = document.getElementById('objectSearchResults');
    const statsDiv = document.getElementById('objectSearchStats');
    const tableDiv = document.getElementById('objectSearchTable');
    
    if (!results.length) {
        resultsDiv.style.display = 'none';
        return;
    }
    
    // Mostrar seção de resultados
    resultsDiv.style.display = 'block';
    
    // Estatísticas
    const totalObjects = results.length;
    const objectTypes = [...new Set(results.map(r => r.object_type))];
    const servers = [...new Set(results.map(r => r.server_name))];
    
    // Verificar se há mais resultados (baseado na resposta da API)
    const hasMore = window.lastSearchSummary && window.lastSearchSummary.hasMore;
    const totalFound = window.lastSearchSummary && window.lastSearchSummary.totalFound;
    
    statsDiv.innerHTML = `
        <div class="flex items-center justify-between">
            <div>
                <h4 class="font-bold">Resultados da Busca</h4>
                <div class="text-sm space-y-1 mt-2">
                    <div class="flex items-center space-x-2">
                        <span class="badge badge-primary">${totalObjects}</span>
                        <span>objetos encontrados${hasMore ? ` (de ${totalFound} total)` : ''}</span>
                    </div>
                    <div class="flex items-center space-x-2">
                        <span class="badge badge-secondary">${servers.length}</span>
                        <span>servidores pesquisados</span>
                    </div>
                    <div class="flex items-center space-x-2">
                        <span class="badge badge-accent">${objectTypes.length}</span>
                        <span>tipos de objetos</span>
                    </div>
                    ${hasMore ? `
                    <div class="flex items-center space-x-2 mt-2">
                        <span class="badge badge-warning">Limite</span>
                        <span>Resultados limitados para melhor performance</span>
                    </div>
                    ` : ''}
                </div>
            </div>
        </div>
    `;
    
    // Tabela de resultados
    let tableHtml = `
        <table class="table table-zebra w-full">
            <thead>
                <tr>
                    <th>Servidor</th>
                    <th>Database</th>
                    <th>Tipo</th>
                    <th>Nome do Objeto</th>
                    <th>Schema</th>
                    <th>Informações</th>
                    <th>Ações</th>
                </tr>
            </thead>
            <tbody>
    `;
    
    results.forEach(obj => {
        const info = getObjectInfo(obj);
        const actions = getObjectActions(obj);
        
        tableHtml += `
            <tr>
                <td>
                    <div class="flex items-center">
                        <div class="status-circle status-${obj.connection_status || 'unknown'} mr-2"></div>
                        ${obj.server_name}
                    </div>
                </td>
                <td class="font-mono text-sm">${obj.database_name}</td>
                <td>
                    <span class="badge badge-${getObjectTypeBadgeClass(obj.object_type)}">
                        ${getObjectTypeLabel(obj.object_type)}
                    </span>
                </td>
                <td class="font-mono text-sm">${obj.object_name}</td>
                <td class="font-mono text-sm">${obj.schema_name || 'N/A'}</td>
                <td class="max-w-xs">
                    <div class="text-xs space-y-1">
                        ${info.map(item => `<div><strong>${item.label}:</strong> ${item.value}</div>`).join('')}
                    </div>
                </td>
                <td>
                    <div class="flex gap-1">
                        ${actions.map(action => action).join('')}
                    </div>
                </td>
            </tr>
        `;
    });
    
    tableHtml += '</tbody></table>';
    tableDiv.innerHTML = tableHtml;
}

// Função para obter informações do objeto
function getObjectInfo(obj) {
    const info = [];
    
    if (obj.size) {
        info.push({ label: 'Tamanho', value: formatSize(obj.size) });
    }
    
    if (obj.owner) {
        info.push({ label: 'Dono', value: obj.owner });
    }
    
    if (obj.description) {
        info.push({ label: 'Descrição', value: obj.description.substring(0, 50) + (obj.description.length > 50 ? '...' : '') });
    }
    
    if (obj.created_at) {
        info.push({ label: 'Criado', value: new Date(obj.created_at).toLocaleDateString('pt-BR') });
    }
    
    if (obj.modified_at) {
        info.push({ label: 'Modificado', value: new Date(obj.modified_at).toLocaleDateString('pt-BR') });
    }
    
    return info;
}

// Função para obter ações do objeto
function getObjectActions(obj) {
    const actions = [];
    
    // Botão para ver SQL
    if (obj.sql_definition) {
        actions.push(`
            <button class="btn btn-xs btn-info" onclick="showObjectSQL('${obj.object_name}', \`${obj.sql_definition.replace(/`/g, '\\`')}\`, '${obj.server_name}', '${obj.size || ''}', '${obj.owner || ''}')" title="Ver SQL">
                <i class="fas fa-code"></i>
            </button>
        `);
    }
    
    
    return actions;
}

// Função para obter classe do badge do tipo de objeto
function getObjectTypeBadgeClass(objectType) {
    const typeClasses = {
        'table': 'primary',
        'column': 'secondary',
        'index': 'accent',
        'view': 'info',
        'function': 'warning',
        'procedure': 'warning',
        'trigger': 'error',
        'sequence': 'success',
        'constraint': 'neutral'
    };
    return typeClasses[objectType] || 'neutral';
}

// Função para obter label do tipo de objeto
function getObjectTypeLabel(objectType) {
    const typeLabels = {
        'table': 'Tabela',
        'column': 'Coluna',
        'index': 'Índice',
        'view': 'View',
        'function': 'Função',
        'procedure': 'Procedure',
        'trigger': 'Trigger',
        'sequence': 'Sequência',
        'constraint': 'Constraint'
    };
    return typeLabels[objectType] || objectType;
}

// Função para mostrar SQL do objeto
function showObjectSQL(objectName, sqlDefinition, serverName, objectSize, objectOwner) {
    // Remover modal existente se houver
    const existingModal = document.getElementById('objectSQLModal');
    if (existingModal) {
        existingModal.remove();
    }
    
    // Criar modal
    const modal = document.createElement('div');
    modal.id = 'objectSQLModal';
    modal.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[999999] p-4';
    modal.innerHTML = `
        <div class="bg-white rounded-lg w-full max-w-4xl max-h-[80vh] flex flex-col">
            <div class="flex justify-between items-center p-6 border-b">
                <h3 class="text-lg font-semibold">SQL do Objeto</h3>
                <button onclick="closeObjectSQLModal()" class="text-gray-500 hover:text-gray-700">
                    <i class="fas fa-times"></i>
                </button>
            </div>
            
            <div class="flex-1 overflow-y-auto p-6">
                <div class="space-y-4">
                    <div>
                        <label class="label">
                            <span class="label-text font-medium">Servidor:</span>
                        </label>
                        <p class="text-base-content/70">${serverName}</p>
                    </div>
                    
                    <div>
                        <label class="label">
                            <span class="label-text font-medium">Objeto:</span>
                        </label>
                        <p class="text-base-content/70 font-mono">${objectName}</p>
                    </div>
                    
                    ${objectSize ? `
                    <div>
                        <label class="label">
                            <span class="label-text font-medium">Tamanho:</span>
                        </label>
                        <p class="text-base-content/70">${objectSize}</p>
                    </div>
                    ` : ''}
                    
                    ${objectOwner ? `
                    <div>
                        <label class="label">
                            <span class="label-text font-medium">Dono:</span>
                        </label>
                        <p class="text-base-content/70">${objectOwner}</p>
                    </div>
                    ` : ''}
                    
                    <div>
                        <label class="label">
                            <span class="label-text font-medium">Definição SQL:</span>
                        </label>
                        <div class="bg-gray-900 text-green-400 p-4 rounded-lg max-h-96 overflow-y-auto">
                            <pre class="text-sm font-mono whitespace-pre-wrap">${sqlDefinition}</pre>
                        </div>
                    </div>
                </div>
            </div>
            
            <div class="flex justify-end p-6 border-t bg-gray-50">
                <button onclick="copySQLDefinition(\`${sqlDefinition.replace(/`/g, '\\`')}\`)" class="btn btn-primary mr-2">
                    <i class="fas fa-copy mr-2"></i>
                    Copiar SQL
                </button>
                <button onclick="closeObjectSQLModal()" class="btn btn-ghost">Fechar</button>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
}

// Função para fechar modal de SQL
function closeObjectSQLModal() {
    const modal = document.getElementById('objectSQLModal');
    if (modal) {
        modal.remove();
    }
}


// Função para copiar definição SQL
function copySQLDefinition(sqlDefinition) {
    copyToClipboard(sqlDefinition, 'SQL copiado!');
}

// Função auxiliar para copiar texto
async function copyToClipboard(text, successMessage) {
    try {
        if (navigator.clipboard && window.isSecureContext) {
            await navigator.clipboard.writeText(text);
            showNotification(successMessage, 'success');
        } else {
            // Fallback para navegadores que não suportam clipboard API
            const textArea = document.createElement('textarea');
            textArea.value = text;
            textArea.style.position = 'fixed';
            textArea.style.left = '-999999px';
            textArea.style.top = '-999999px';
            document.body.appendChild(textArea);
            textArea.select();
            document.execCommand('copy');
            document.body.removeChild(textArea);
            showNotification(successMessage, 'success');
        }
    } catch (error) {
        console.error('Erro ao copiar:', error);
        showNotification('Erro ao copiar texto', 'error');
    }
}

// Função para limpar busca de objetos
function clearObjectSearch() {
    document.getElementById('objectSearchTerm').value = '';
    document.getElementById('objectSearchType').value = 'contains';
    document.getElementById('objectTypeFilter').value = 'table';
    document.getElementById('objectSearchLimit').value = '25';
    
    // Desmarcar todos os servidores
    const checkboxes = document.querySelectorAll('#objectSearchServerCheckboxes input[type="checkbox"][value]');
    checkboxes.forEach(checkbox => {
        checkbox.checked = false;
    });
    
    // Limpar resultados
    clearObjectSearchResults();
    
    showNotification('Filtros limpos!', 'success');
}

// Função para limpar resultados da busca de objetos
function clearObjectSearchResults() {
    const resultsDiv = document.getElementById('objectSearchResults');
    if (resultsDiv) {
        resultsDiv.style.display = 'none';
    }
    
    objectSearchResults = [];
} 