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
    loadServers();
    loadServerStats();
    setupEventListeners();
});

// Configurar event listeners
function setupEventListeners() {
    console.log('Configurando event listeners...');
    
    // Form do servidor
    const serverForm = document.getElementById('serverForm');
    console.log('Form encontrado:', serverForm);
    
    if (serverForm) {
        // Adicionar listener para o evento submit
        serverForm.addEventListener('submit', function(e) {
            console.log('Form submit disparado');
            e.preventDefault(); // Prevenir comportamento padrão
            handleServerSubmit(e);
        });
        console.log('Event listener do form adicionado');
        
        // Adicionar também um listener no botão para debug
        const submitButton = serverForm.querySelector('button[type="submit"]');
        console.log('Botão submit encontrado:', submitButton);
        if (submitButton) {
            submitButton.addEventListener('click', function(e) {
                console.log('Botão submit clicado');
                // Não prevenir o comportamento padrão aqui para permitir que o submit seja disparado
            });
        }
        
        // Adicionar listener para mudanças nos campos para debug
        const formFields = serverForm.querySelectorAll('input, textarea, select');
        formFields.forEach(field => {
            field.addEventListener('change', function(e) {
                console.log('Campo alterado:', e.target.id, 'Valor:', e.target.value);
            });
        });
    } else {
        console.error('Form serverForm não encontrado!');
    }
    
    // Modal
    const modal = document.getElementById('serverModal');
    if (modal) {
        modal.addEventListener('click', function(e) {
            if (e.target.classList.contains('modal-background') || e.target.classList.contains('delete')) {
                closeServerModal();
            }
        });
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
        showNotification('Erro ao carregar servidores', 'is-danger');
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

        const data = await response.json();
        updateStats(data.data);
        
    } catch (error) {
        console.error('Erro ao carregar estatísticas:', error);
    }
}

// Atualizar estatísticas na interface
function updateStats(stats) {
    const totalServers = stats.totalServers || 0;
    let onlineCount = 0;
    let offlineCount = 0;
    let errorCount = 0;

    stats.stats.forEach(stat => {
        switch (stat.connectionStatus) {
            case 'online':
                onlineCount = parseInt(stat.count);
                break;
            case 'offline':
                offlineCount = parseInt(stat.count);
                break;
            case 'error':
                errorCount = parseInt(stat.count);
                break;
        }
    });

    document.getElementById('totalServers').textContent = totalServers;
    document.getElementById('onlineServers').textContent = onlineCount;
    document.getElementById('offlineServers').textContent = offlineCount;
    document.getElementById('errorServers').textContent = errorCount;
}

// Renderizar lista de servidores
function renderServersList() {
    const container = document.getElementById('serversList');
    
    if (servers.length === 0) {
        container.innerHTML = `
            <div class="has-text-centered has-text-grey-light">
                <p class="mb-3">
                    <span class="icon is-large">
                        <i class="fas fa-server fa-2x"></i>
                    </span>
                </p>
                <p>Nenhum servidor cadastrado</p>
                <p class="is-size-7">Clique em "Novo Servidor" para começar</p>
            </div>
        `;
        return;
    }

    container.innerHTML = servers.map(server => `
        <div class="box server-card mb-3" data-server-id="${server.id}">
            <div class="columns is-vcentered">
                <div class="column">
                    <div class="is-flex is-align-items-center">
                        <span class="status-indicator status-${server.connectionStatus}"></span>
                        <div>
                            <p class="has-text-weight-semibold">${server.name}</p>
                            <p class="is-size-7 has-text-grey">${server.host}:${server.port}</p>
                            <p class="is-size-7 has-text-grey">${server.type.toUpperCase()}</p>
                        </div>
                    </div>
                </div>
                <div class="column is-narrow">
                    <div class="buttons are-small">
                        <button class="button is-info" onclick="testServerConnection(${server.id})" title="Testar Conexão">
                            <span class="icon">
                                <i class="fas fa-plug"></i>
                            </span>
                        </button>
                        <button class="button is-warning" onclick="editServer(${server.id})" title="Editar">
                            <span class="icon">
                                <i class="fas fa-edit"></i>
                            </span>
                        </button>
                        <button class="button is-danger" onclick="deleteServer(${server.id})" title="Excluir">
                            <span class="icon">
                                <i class="fas fa-trash"></i>
                            </span>
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
        container.innerHTML = '<p class="has-text-grey-light">Nenhum servidor disponível</p>';
        return;
    }

    container.innerHTML = `
        <div class="field">
            <label class="checkbox">
                <input type="checkbox" id="selectAllServers" onchange="toggleAllServers()">
                Selecionar Todos
            </label>
        </div>
        <div class="columns is-multiline">
            ${servers.map(server => `
                <div class="column is-6">
                    <label class="checkbox">
                        <input type="checkbox" class="server-checkbox" value="${server.id}" data-server-name="${server.name}">
                        <span class="status-indicator status-${server.connectionStatus}"></span>
                        ${server.name}
                    </label>
                </div>
            `).join('')}
        </div>
    `;
}

// Selecionar/Desselecionar todos os servidores
function toggleAllServers() {
    const selectAll = document.getElementById('selectAllServers');
    const checkboxes = document.querySelectorAll('.server-checkbox');
    
    checkboxes.forEach(checkbox => {
        checkbox.checked = selectAll.checked;
    });
}

// Abrir modal para novo servidor
function openServerModal(serverId = null) {
    currentServerId = serverId;
    const modal = document.getElementById('serverModal');
    const title = document.getElementById('modalTitle');
    
    if (serverId) {
        title.textContent = 'Editar Servidor';
        loadServerData(serverId);
    } else {
        title.textContent = 'Novo Servidor';
        resetServerForm();
    }
    
    modal.classList.add('is-active');
}

// Fechar modal
function closeServerModal() {
    const modal = document.getElementById('serverModal');
    modal.classList.remove('is-active');
    currentServerId = null;
    resetServerForm();
}

// Resetar formulário
function resetServerForm() {
    document.getElementById('serverForm').reset();
    document.getElementById('serverPort').value = '5432';
    document.getElementById('serverType').value = 'postgresql';
}

// Carregar dados do servidor para edição
async function loadServerData(serverId) {
    try {
        const response = await fetch(`${API_BASE}/servers/${serverId}`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${getAuthToken()}`
            }
        });

        if (!response.ok) {
            throw new Error('Erro ao carregar dados do servidor');
        }

        const data = await response.json();
        const server = data.data;
        
        document.getElementById('serverName').value = server.name;
        document.getElementById('serverHost').value = server.host;
        document.getElementById('serverPort').value = server.port;
        document.getElementById('serverUsername').value = server.username;
        document.getElementById('serverPassword').value = ''; // Não carregar senha por segurança
        document.getElementById('serverType').value = server.type;
        document.getElementById('serverDescription').value = server.description || '';
        
    } catch (error) {
        console.error('Erro ao carregar dados do servidor:', error);
        showNotification('Erro ao carregar dados do servidor', 'is-danger');
    }
}

// Função para lidar com o submit do formulário
function handleServerSubmit(e) {
    console.log('handleServerSubmit chamada');
    e.preventDefault();
    
    // Obter dados do formulário
    const formData = {
        name: document.getElementById('serverName').value,
        host: document.getElementById('serverHost').value,
        port: document.getElementById('serverPort').value,
        username: document.getElementById('serverUsername').value,
        password: document.getElementById('serverPassword').value,
        type: document.getElementById('serverType').value,
        description: document.getElementById('serverDescription').value
    };
    
    console.log('Dados do formulário:', formData);
    
    // Validar campos obrigatórios
    if (!formData.name || !formData.host || !formData.username || !formData.password) {
        console.error('Campos obrigatórios não preenchidos');
        showNotification('Por favor, preencha todos os campos obrigatórios.', 'is-danger');
        return;
    }
    
    console.log('Dados validados, enviando para API...');
    
    // Determinar se é criação ou edição
    const isEditing = currentServerId !== null;
    const url = isEditing ? `/api/servers/${currentServerId}` : '/api/servers';
    const method = isEditing ? 'PUT' : 'POST';
    
    console.log('URL:', url, 'Método:', method);
    
    // Fazer requisição para a API
    fetch(url, {
        method: method,
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${getAuthToken()}`
        },
        body: JSON.stringify(formData)
    })
    .then(response => {
        console.log('Response status:', response.status);
        return response.json();
    })
    .then(data => {
        console.log('Response data:', data);
        if (data.success) {
            showNotification('Servidor salvo com sucesso!', 'is-success');
            closeServerModal();
            loadServers();
        } else {
            console.error('Erro ao salvar servidor:', data.message);
            showNotification(data.message || 'Erro ao salvar servidor.', 'is-danger');
        }
    })
    .catch(error => {
        console.error('Erro na requisição:', error);
        showNotification('Erro ao conectar com o servidor.', 'is-danger');
    });
}

// Testar conexão do servidor
async function testServerConnection(serverId) {
    try {
        const response = await fetch(`${API_BASE}/servers/${serverId}/test-connection`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${getAuthToken()}`
            }
        });

        if (!response.ok) {
            throw new Error('Erro ao testar conexão');
        }

        const data = await response.json();
        const status = data.data.success ? 'success' : 'danger';
        showNotification(data.data.message, `is-${status}`);
        
        // Recarregar servidores para atualizar status
        loadServers();
        loadServerStats();
        
    } catch (error) {
        console.error('Erro ao testar conexão:', error);
        showNotification('Erro ao testar conexão', 'is-danger');
    }
}

// Editar servidor
function editServer(serverId) {
    openServerModal(serverId);
}

// Deletar servidor
async function deleteServer(serverId) {
    if (!confirm('Tem certeza que deseja excluir este servidor?')) {
        return;
    }

    try {
        const response = await fetch(`${API_BASE}/servers/${serverId}`, {
            method: 'DELETE',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${getAuthToken()}`
            }
        });

        if (!response.ok) {
            throw new Error('Erro ao excluir servidor');
        }

        const data = await response.json();
        showNotification(data.message, 'is-success');
        loadServers();
        loadServerStats();
        
    } catch (error) {
        console.error('Erro ao excluir servidor:', error);
        showNotification('Erro ao excluir servidor', 'is-danger');
    }
}

// Função para carregar databases dos servidores selecionados
async function loadDatabases() {
    const selectedServers = getSelectedServers();
    
    if (selectedServers.length === 0) {
        showNotification('Selecione pelo menos um servidor.', 'is-warning');
        return;
    }
    
    // Mostrar loading
    const loadingSpinner = document.getElementById('databaseLoading');
    loadingSpinner.classList.add('is-active');
    
    try {
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
        
        const data = await response.json();
        
        if (data.success) {
            displayDatabasesGrid(data.data);
        } else {
            showNotification(data.message || 'Erro ao carregar databases.', 'is-danger');
        }
    } catch (error) {
        console.error('Erro ao carregar databases:', error);
        showNotification('Erro ao conectar com o servidor.', 'is-danger');
    } finally {
        loadingSpinner.classList.remove('is-active');
    }
}

// Função utilitária para padronizar tamanho
function formatSize(sizeStr) {
    if (!sizeStr) return 'N/A';
    // Extrai número e unidade
    const match = sizeStr.match(/([\d,.]+)\s*(\w+)/);
    if (!match) return sizeStr;
    let value = parseFloat(match[1].replace(',', '.'));
    let unit = match[2].toLowerCase();
    if (unit.startsWith('g')) return value.toFixed(2) + ' GB';
    if (unit.startsWith('m')) {
        if (value >= 1024) return (value / 1024).toFixed(2) + ' GB';
        return value.toFixed(0) + ' MB';
    }
    if (unit.startsWith('k')) return (value / 1024).toFixed(2) + ' MB';
    return sizeStr;
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
        databasesGrid.innerHTML = `<div class="notification is-info"><p>Nenhuma database encontrada.</p></div>`;
        databasesSection.style.display = 'block';
        return;
    }
    let html = `<div class="table-container"><table class="table is-striped is-hoverable is-fullwidth"><thead><tr><th>Servidor</th><th>Nome</th><th>Tamanho</th><th>Dono</th><th style="width: 90px;">Ação</th></tr></thead><tbody>`;
    pageData.forEach(db => {
        if (db.error) {
            html += `<tr><td colspan="5"><span class="has-text-danger"><strong>${db.serverName}:</strong> ${db.errorMsg || 'Erro ao conectar com o servidor'}</span></td></tr>`;
        } else {
            html += `<tr><td>${db.serverName}</td><td style="word-break: break-all;">${db.name}</td><td>${formatSize(db.size)}</td><td>${db.owner || 'N/A'}</td><td><button class="button is-small is-info" onclick="copyDatabaseInfo('${db.serverHost}', '${db.name}')"><span class="icon is-small"><i class="fas fa-copy"></i></span><span>Copiar</span></button></td></tr>`;
        }
    });
    html += `</tbody></table></div>`;
    databasesGrid.innerHTML = html;
    databasesSection.style.display = 'block';
}

// Função para exibir paginação
function renderDatabasesPagination(totalPages) {
    const pagination = document.getElementById('databasesPagination');
    if (totalPages <= 1) {
        pagination.style.display = 'none';
        return;
    }
    let html = '';
    html += `<a class="pagination-previous" ${currentPage === 1 ? 'disabled' : ''} onclick="filterAndPaginateDatabases(${currentPage - 1})">Anterior</a>`;
    html += `<a class="pagination-next" ${currentPage === totalPages ? 'disabled' : ''} onclick="filterAndPaginateDatabases(${currentPage + 1})">Próxima</a>`;
    html += '<ul class="pagination-list">';
    for (let i = 1; i <= totalPages; i++) {
        if (i === currentPage) {
            html += `<li><a class="pagination-link is-current">${i}</a></li>`;
        } else {
            html += `<li><a class="pagination-link" onclick="filterAndPaginateDatabases(${i})">${i}</a></li>`;
        }
    }
    html += '</ul>';
    pagination.innerHTML = html;
    pagination.style.display = 'flex';
}

// Função principal para exibir databases (chamada pelo backend)
function displayDatabasesGrid(databasesData) {
    allDatabasesData = databasesData;
    currentPage = 1;
    filterAndPaginateDatabases();
}


// Função para atualizar a lista de databases
function refreshDatabases() {
    const databasesSection = document.getElementById('databasesSection');
    databasesSection.style.display = 'none';
    loadDatabases();
}

// Função para obter servidores selecionados
function getSelectedServers() {
    const checkboxes = document.querySelectorAll('.server-checkbox:checked');
    return Array.from(checkboxes).map(cb => cb.value);
}

// Função para copiar informações da database
function copyDatabaseInfo(serverHost, databaseName) {
    const databaseInfo = `${serverHost}/${databaseName}`;
    
    // Usar a API de clipboard moderna
    if (navigator.clipboard && window.isSecureContext) {
        navigator.clipboard.writeText(databaseInfo).then(() => {
            showNotification(`Copiado: ${databaseInfo}`, 'is-success');
        }).catch(err => {
            console.error('Erro ao copiar:', err);
            fallbackCopyTextToClipboard(databaseInfo);
        });
    } else {
        // Fallback para navegadores mais antigos
        fallbackCopyTextToClipboard(databaseInfo);
    }
}

// Função fallback para copiar texto
function fallbackCopyTextToClipboard(text) {
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.position = 'fixed';
    textArea.style.left = '-999999px';
    textArea.style.top = '-999999px';
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    
    try {
        document.execCommand('copy');
        showNotification(`Copiado: ${text}`, 'is-success');
    } catch (err) {
        console.error('Erro ao copiar:', err);
        showNotification('Erro ao copiar para a área de transferência', 'is-danger');
    }
    
    document.body.removeChild(textArea);
}


// Recarregar servidores
function refreshServers() {
    loadServers();
    loadServerStats();
    showNotification('Servidores atualizados', 'is-info');
}

// Mostrar notificação
function showNotification(message, type = 'is-info') {
    // Criar notificação usando Bulma
    const notification = document.createElement('div');
    notification.className = `notification ${type} is-light`;
    notification.innerHTML = `
        <button class="delete" onclick="this.parentElement.remove()"></button>
        ${message}
    `;
    
    // Adicionar ao topo da página
    const container = document.querySelector('.container');
    container.insertBefore(notification, container.firstChild);
    
    // Remover automaticamente após 5 segundos
    setTimeout(() => {
        if (notification.parentElement) {
            notification.remove();
        }
    }, 5000);
}

// Verificar autenticação
function checkAuth() {
    // Aceita tanto 'auth_token' quanto 'token' para compatibilidade
    const token = localStorage.getItem('auth_token') || localStorage.getItem('token');
    if (!token) {
        window.location.href = '/login.html';
        return false;
    }
    return true;
}

// Verificar autenticação na inicialização
if (!checkAuth()) {
    // Redirecionamento será feito pela função checkAuth
} 

// Atualizar todos os fetch para usar o token correto
function getAuthToken() {
    return localStorage.getItem('auth_token') || localStorage.getItem('token');
} 