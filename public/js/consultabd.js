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

// Função para mostrar notificações
function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `alert alert-${type === 'error' ? 'error' : type === 'warning' ? 'warning' : 'info'} fixed top-4 right-4 z-50 max-w-sm`;
    notification.innerHTML = `
        <div class="flex items-center">
            <span class="flex-shrink-0">
                <i class="fas fa-${type === 'error' ? 'exclamation-triangle' : type === 'warning' ? 'exclamation-circle' : 'info-circle'}"></i>
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
    
    document.body.appendChild(notification);
    
    // Remover automaticamente após 5 segundos
    setTimeout(() => {
        if (notification.parentElement) {
            notification.remove();
        }
    }, 5000);
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
            
            <div class="stat">
                <div class="stat-figure text-warning">
                    <i class="fas fa-database text-3xl"></i>
                </div>
                <div class="stat-title">Média de RAM</div>
                <div class="stat-value text-warning">${Math.round(stats.averageMemory || 0)}%</div>
            </div>
            
            <div class="stat">
                <div class="stat-figure text-info">
                    <i class="fas fa-microchip text-3xl"></i>
                </div>
                <div class="stat-title">Média de CPU</div>
                <div class="stat-value text-info">${Math.round(stats.averageCpu || 0)}%</div>
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

    container.innerHTML = servers.map(server => `
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
                        <button class="btn btn-info btn-sm" onclick="testServerConnection(${server.id})" title="Testar Conexão">
                                <i class="fas fa-plug"></i>
                        </button>
                        <button class="btn btn-warning btn-sm" onclick="editServer(${server.id})" title="Editar">
                                <i class="fas fa-edit"></i>
                        </button>
                        <button class="btn btn-error btn-sm" onclick="deleteServer(${server.id})" title="Excluir">
                                <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </div>
            </div>
        </div>
    `).join('');
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
            showNotification(result.message || 'Erro ao criar servidor', 'error');
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
            showNotification(result.message || 'Erro ao atualizar servidor', 'error');
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
    if (!size) return 'N/A';
    
    // Se já está formatado, retornar como está
    if (typeof size === 'string' && size.includes(' ')) {
        return size;
    }
    
    // Converter bytes para formato legível
    const bytes = parseInt(size);
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    if (bytes === 0) return '0 B';
    
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
}

// Função para copiar informações da database
function copyDatabaseInfo(host, databaseName) {
    const connectionString = `Host: ${host}\nDatabase: ${databaseName}`;
    
    navigator.clipboard.writeText(connectionString).then(() => {
        showNotification('Informações copiadas para a área de transferência!', 'success');
    }).catch(() => {
        // Fallback para navegadores que não suportam clipboard API
        const textArea = document.createElement('textarea');
        textArea.value = connectionString;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
        showNotification('Informações copiadas para a área de transferência!', 'success');
    });
}

// Função para carregar databases dos servidores selecionados
async function loadDatabases() {
    const selectedServers = getSelectedServers();
    
    if (selectedServers.length === 0) {
        showNotification('Selecione pelo menos um servidor.', 'warning');
        return;
    }
    
    // Mostrar overlay de loading com progresso
    const overlay = document.createElement('div');
    overlay.id = 'loadingOverlay';
    overlay.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50';
    overlay.innerHTML = `
        <div class="bg-white rounded-lg p-8 flex flex-col items-center shadow-2xl max-w-md w-full mx-4">
            <div class="animate-spin rounded-full h-16 w-16 border-b-4 border-primary mb-4"></div>
            <p class="text-lg font-semibold text-gray-800 mb-2">Carregando databases...</p>
            <div id="progressInfo" class="text-sm text-gray-600 text-center space-y-2">
                <p>Conectando aos servidores selecionados...</p>
                <div class="progress progress-primary w-full" style="height: 4px;">
                    <div id="progressBar" class="progress-bar" style="width: 0%"></div>
                </div>
                <p id="currentServer" class="text-xs text-gray-500"></p>
            </div>
        </div>
    `;
    document.body.appendChild(overlay);
    
    try {
        // Simular progresso enquanto a requisição está sendo processada
        let progress = 0;
        const progressInterval = setInterval(() => {
            progress += Math.random() * 15;
            if (progress > 90) progress = 90;
            
            updateLoadingStats(progress);
        }, 500);
        
        const response = await fetch(`${API_BASE}/servers/list-databases`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${getAuthToken()}`
            },
            body: JSON.stringify({
                serverIds: selectedServers
            })
        });
        
        clearInterval(progressInterval);
        
        // Completar progresso
        updateLoadingStats(100);
        
        const data = await response.json();
        
        if (data.success) {
            // Mostrar resumo dos resultados
            const totalServers = data.data.length;
            const successfulServers = data.data.filter(server => server.success).length;
            const totalDatabases = data.data.reduce((total, server) => {
                return total + (server.success && server.databases ? server.databases.length : 0);
            }, 0);
            
            const currentServer = document.getElementById('currentServer');
            if (currentServer) {
                currentServer.innerHTML = `
                    <div class="text-green-600 font-semibold">✓ Concluído!</div>
                    <div class="text-xs mt-1">
                        ${successfulServers}/${totalServers} servidores conectados<br>
                        ${totalDatabases} databases encontradas
                    </div>
                `;
            }
            
            // Aguardar um pouco para mostrar o resultado
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            displayDatabasesGrid(data.data);
        } else {
            showNotification(data.message || 'Erro ao carregar databases.', 'error');
        }
    } catch (error) {
        console.error('Erro ao carregar databases:', error);
        showNotification('Erro ao conectar com o servidor.', 'error');
    } finally {
        // Remover overlay de loading
        const overlay = document.getElementById('loadingOverlay');
        if (overlay) {
            overlay.remove();
        }
    }
}

// Função para atualizar estatísticas de loading
function updateLoadingStats(progress) {
    const progressBar = document.getElementById('progressBar');
    if (progressBar) {
        progressBar.style.width = `${progress}%`;
    }
}

// Função para filtrar e paginar databases
function filterAndPaginateDatabases(page) {
    if (!allDatabasesData.length) return;
    const search = document.getElementById('databaseSearch').value.trim().toLowerCase();
    const perPage = parseInt(document.getElementById('databasesPerPage').value, 10);
    if (page) currentPage = page; else currentPage = 1;

    // Filtra databases
    let filtered = [];
    allDatabasesData.forEach(serverData => {
        if (serverData.success && serverData.databases && serverData.databases.length > 0) {
            const dbs = serverData.databases.filter(db => db.name.toLowerCase().includes(search));
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

    renderDatabasesTable(pageData, total, totalPages);
    renderDatabasesPagination(totalPages);
}

// Função para exibir a tabela de databases paginada
function renderDatabasesTable(pageData, total, totalPages) {
    const databasesSection = document.getElementById('databasesSection');
    const databasesGrid = document.getElementById('databasesGrid');
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
                <td>${formatSize(db.size)}</td>
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
    const pagination = document.getElementById('databasesPagination');
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
    
    // Mostrar resumo dos resultados
    showResultsSummary(databasesData);
    
    filterAndPaginateDatabases();
}

// Função para mostrar resumo dos resultados
function showResultsSummary(databasesData) {
    const totalServers = databasesData.length;
    const successfulServers = databasesData.filter(server => server.success).length;
    const failedServers = totalServers - successfulServers;
    const totalDatabases = databasesData.reduce((total, server) => {
        return total + (server.success && server.databases ? server.databases.length : 0);
    }, 0);
    
    // Criar ou atualizar o resumo
    let summaryHtml = `
        <div class="alert alert-info mb-4">
            <div class="flex items-center justify-between">
                <div>
                    <h4 class="font-bold">Resumo da Busca</h4>
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
                    </div>
                </div>
                <div class="text-right">
                    <div class="text-2xl font-bold text-primary">${totalDatabases}</div>
                    <div class="text-xs text-gray-500">databases</div>
                </div>
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
    if (databasesSection) {
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