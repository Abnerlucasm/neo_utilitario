/**
 * glassfish-modals.js
 * Funções de modal/UI para o gerenciamento de Glassfish.
 * Compatível com <dialog> nativo (DaisyUI) e IDs UUID do PostgreSQL.
 */

// ─── Estado interno ───────────────────────────────────────────────────────────
let currentServiceIndex    = null;
let currentMaintenanceIndex = null;
let currentDomainConfigIndex = null;
let logViewerActive        = false;
let currentWebSocket       = null;

// ─── Helper: extrai mensagem de erro da resposta HTTP ────────────────────────
async function parseErrorResponse(res) {
    try {
        const body = await res.json();
        return body?.details || body?.error || body?.message || `HTTP ${res.status}`;
    } catch {
        return `HTTP ${res.status}`;
    }
}

// ─── Helpers de modal (<dialog> nativo) ──────────────────────────────────────

function openDialog(id) {
    const el = document.getElementById(id);
    if (el && typeof el.showModal === 'function') el.showModal();
}

function closeDialog(id) {
    const el = document.getElementById(id);
    if (el && typeof el.close === 'function') el.close();
}

// ─── Token helper ─────────────────────────────────────────────────────────────
function getToken() {
    return localStorage.getItem('auth_token') || localStorage.getItem('token') || '';
}

function authHeaders(extra = {}) {
    return { 'Authorization': `Bearer ${getToken()}`, ...extra };
}

// ─── closeModal (exportado — chamado via data-action="closeModal") ────────────
export function closeModal(modalId) {
    closeDialog(modalId);

    if (modalId === 'logs-modal')   stopLiveLog();
    if (modalId === 'add-modal')    currentServiceIndex = null;
}

// ─── handleCardClick ──────────────────────────────────────────────────────────
export async function handleCardClick(index, services) {
    const service = services[index];
    if (!service) return;

    const fields = {
        'service-name':         service.name,
        'service-ip':           service.ip || service.host,
        'service-port':         service.port,
        'service-domain':       service.domain,
        'service-ssh-username': service.sshUsername || service.username,
        'service-ssh-password': service.sshPassword || '',
        'service-install-path': service.installPath,
        'production-port':      service.productionPort,
        'service-category':     service.setor,
        'service-access-type':  service.accessType,
    };

    for (const [id, val] of Object.entries(fields)) {
        const el = document.getElementById(id);
        if (el && val !== undefined && val !== null) el.value = val;
    }

    currentServiceIndex = index;

    const title = document.getElementById('modal-title');
    if (title) title.textContent = 'Editar Glassfish';

    openDialog('add-modal');
}

// ─── toggleLogViewer ─────────────────────────────────────────────────────────
// Recebe a lista de services do glassfish.js para conectar nos ativos
export function toggleLogViewer(services = []) {
    logViewerActive = !logViewerActive;

    const badge  = document.getElementById('log-live-badge');
    const btn    = document.querySelector('[data-action="toggleLogViewer"]');
    const viewer = document.getElementById('log-viewer');

    if (logViewerActive) {
        if (badge)  badge.classList.remove('hidden');
        if (btn)    btn.innerHTML = '<i class="fas fa-stop mr-1"></i>Desativar';

        const ativos = services.filter(s => s.status === 'active');

        if (ativos.length === 0) {
            if (viewer) viewer.innerHTML =
                '<span class="text-yellow-400">Nenhum servidor ativo no momento.</span>';
        } else {
            if (viewer) viewer.innerHTML = '';
            // Conecta em todos os ativos em paralelo
            startAllLiveLogs(ativos, viewer);
        }
    } else {
        if (badge)  badge.classList.add('hidden');
        if (btn)    btn.innerHTML = '<i class="fas fa-play mr-1"></i>Ativar';
        stopAllLiveLogs();
    }
}

// ─── openUserNameModal (não mais utilizado — usuário resolvido via JWT) ──────
export function openUserNameModal(index) {
    // Mantido apenas para evitar erros de import — lógica movida para glassfish.js
}

// ─── saveUserName (mantido para compatibilidade, lógica no glassfish.js) ─────
export async function saveUserName(services, fetchServices) {
    // Noop — markInUse em glassfish.js já resolve o usuário via JWT automaticamente
}

// ─── markServiceAvailable ─────────────────────────────────────────────────────
export async function markServiceAvailable(index, services, fetchServices) {
    try {
        const service = services[index];
        if (!service?.id) {
            showToast('Serviço não encontrado', 'error');
            return;
        }

        const res = await fetch(`/api/glassfish/servicos/${service.id}/available`, {
            method:  'POST',
            headers: authHeaders()
        });

        if (!res.ok) throw new Error(await parseErrorResponse(res));

        showToast('Serviço marcado como disponível!', 'success');
        await fetchServices();
    } catch (error) {
        console.error(error);
        showToast(error.message, 'error');
    }
}

// ─── viewLogs ────────────────────────────────────────────────────────────────
export async function viewLogs(index, services) {
    const service = services[index];
    if (!service?.id) {
        showToast('Serviço não encontrado', 'error');
        return;
    }

    // Atualiza título e abre modal imediatamente com loading
    const titleEl    = document.getElementById('logs-modal-title');
    const logsContent = document.getElementById('logs-content');
    if (titleEl)    titleEl.textContent = service.name;
    if (logsContent) logsContent.textContent = 'Carregando logs…';
    openDialog('logs-modal');

    try {
        const res = await fetch(`/api/glassfish/servicos/${service.id}/logs`, {
            headers: authHeaders()
        });

        // Lê o corpo independente do status para pegar mensagem de erro real
        const body = await res.json().catch(() => null);

        if (!res.ok) {
            const msg = body?.details || body?.error || `HTTP ${res.status}`;
            throw new Error(msg);
        }

        if (logsContent) {
            logsContent.textContent = body?.logs || '(sem logs disponíveis)';
            // Rola para o fim
            logsContent.scrollTop = logsContent.scrollHeight;
        }
    } catch (error) {
        console.error('viewLogs:', error);
        if (logsContent) {
            logsContent.textContent = `⚠ Erro ao carregar logs:\n${error.message}`;
            logsContent.style.color = '#f87171';
        }
        showToast('Erro ao obter logs: ' + error.message, 'error');
    }
}

// ─── Live Log via polling (GET a cada 3s) ────────────────────────────────────
// Polling é mais simples e não depende de WebSocket no backend
const pollingIntervals = new Map(); // serviceId → intervalId
const lastLogLines     = new Map(); // serviceId → última linha vista

function startAllLiveLogs(activeServices, viewer) {
    stopAllLiveLogs();

    for (const service of activeServices) {
        startPolling(service, viewer);
    }
}

function startPolling(service, viewer) {
    if (!service?.id) return;

    appendLog(viewer, `[${service.name}] ── iniciando monitoramento ──`, 'text-teal-400');

    // Busca imediata
    pollLogs(service, viewer);

    // Polling a cada 4 segundos
    const id = setInterval(() => {
        if (!logViewerActive) {
            clearInterval(id);
            pollingIntervals.delete(service.id);
            return;
        }
        pollLogs(service, viewer);
    }, 4000);

    pollingIntervals.set(service.id, id);
}

async function pollLogs(service, viewer) {
    try {
        const res = await fetch(`/api/glassfish/servicos/${service.id}/logs`, {
            headers: authHeaders()
        });
        if (!res.ok) return;

        const data = await res.json();
        if (!data.logs) return;

        // Pega as últimas 30 linhas
        const lines = data.logs.split('\n').filter(l => l.trim()).slice(-30);
        const lastSeen = lastLogLines.get(service.id) || '';

        // Encontra o índice da última linha já exibida
        const lastIdx = lines.lastIndexOf(lastSeen);
        const newLines = lastIdx >= 0 ? lines.slice(lastIdx + 1) : lines;

        if (newLines.length === 0) return;

        for (const line of newLines) {
            appendLog(viewer, `[${service.name}] ${line}`);
        }

        // Atualiza a última linha vista
        lastLogLines.set(service.id, lines[lines.length - 1]);

    } catch (_) {
        // silencioso — não interrompe o polling
    }
}

function appendLog(viewer, text, colorClass = 'text-green-400') {
    if (!viewer) return;

    const line = document.createElement('span');
    line.className = `${colorClass} block`;
    line.textContent = text;
    viewer.appendChild(line);

    // Limitar a 300 linhas
    while (viewer.children.length > 300) {
        viewer.removeChild(viewer.firstChild);
    }

    viewer.scrollTop = viewer.scrollHeight;
}

function stopAllLiveLogs() {
    for (const id of pollingIntervals.values()) clearInterval(id);
    pollingIntervals.clear();
    lastLogLines.clear();
    // Compatibilidade com código legado
    if (currentWebSocket) {
        try { currentWebSocket.close(); } catch (_) {}
        currentWebSocket = null;
    }
}

// Alias para compatibilidade com closeModal
function stopLiveLog() { stopAllLiveLogs(); }

// ─── openMaintenanceModal ─────────────────────────────────────────────────────
export function openMaintenanceModal(index) {
    currentMaintenanceIndex = index;
    // Limpar checkboxes
    ['clean-applications', 'clean-logs', 'clean-generated', 'clean-autodeploy'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.checked = false;
    });
    openDialog('maintenance-modal');
}

// ─── executeMaintenance ───────────────────────────────────────────────────────
export async function executeMaintenance(services, fetchServices) {
    try {
        const service = services[currentMaintenanceIndex];
        if (!service?.id) {
            showToast('Serviço não encontrado', 'error');
            return;
        }

        const tasks = [];
        if (document.getElementById('clean-applications')?.checked) tasks.push('cleanApplications');
        if (document.getElementById('clean-logs')?.checked)         tasks.push('cleanLogs');
        if (document.getElementById('clean-generated')?.checked)    tasks.push('cleanGenerated');
        if (document.getElementById('clean-autodeploy')?.checked)   tasks.push('cleanAutodeploy');

        if (tasks.length === 0) {
            showToast('Selecione ao menos uma opção de limpeza', 'warning');
            return;
        }

        const btn = document.querySelector('[data-action="executeMaintenance"]');
        if (btn) { btn.disabled = true; btn.innerHTML = '<span class="loading loading-spinner loading-xs"></span> Executando…'; }

        const res = await fetch(`/api/glassfish/servicos/${service.id}/maintenance`, {
            method:  'POST',
            headers: authHeaders({ 'Content-Type': 'application/json' }),
            body:    JSON.stringify({ tasks })
        });

        if (!res.ok) throw new Error(await parseErrorResponse(res));

        const data = await res.json();
        const failed = (data.results || []).filter(r => !r.success);

        if (failed.length === 0) {
            showToast('Manutenção executada com sucesso!', 'success');
        } else {
            showToast(`Manutenção concluída com ${failed.length} erro(s)`, 'warning');
        }

        closeDialog('maintenance-modal');
        await fetchServices();
    } catch (error) {
        console.error(error);
        showToast(error.message, 'error');
    } finally {
        const btn = document.querySelector('[data-action="executeMaintenance"]');
        if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fas fa-trash mr-1"></i>Executar Manutenção'; }
    }
}

// ─── openDomainConfigModal ────────────────────────────────────────────────────
export async function openDomainConfigModal(index, services) {
    try {
        const service = services[index];
        if (!service?.id) {
            showToast('Serviço não encontrado', 'error');
            return;
        }

        currentDomainConfigIndex = index;

        // Reset do modal
        ['db-server', 'db-user', 'db-password', 'db-name'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.value = '';
        });

        const appsLoading = document.getElementById('applications-loading');
        const appsContent = document.getElementById('applications-content');
        if (appsLoading) appsLoading.classList.remove('hidden');
        if (appsContent) { appsContent.classList.add('hidden'); appsContent.innerHTML = ''; }

        openDialog('domain-config-modal');

        // Carregar configurações do domain.xml
        const res  = await fetch(`/api/glassfish/servicos/${service.id}/domain-config`, {
            headers: authHeaders()
        });

        const body = await res.json().catch(() => null);
        if (!res.ok) {
            const msg = body?.details || body?.error || `HTTP ${res.status}`;
            throw new Error(msg);
        }

        const config = body;
        const dbServer   = document.getElementById('db-server');
        const dbUser     = document.getElementById('db-user');
        const dbPassword = document.getElementById('db-password');
        const dbName     = document.getElementById('db-name');

        if (dbServer)   dbServer.value   = config.serverName   || '';
        if (dbUser)     dbUser.value     = config.user         || '';
        if (dbPassword) dbPassword.value = config.password     || '';
        if (dbName)     dbName.value     = config.databaseName || '';

        await loadApplications(service.id);
    } catch (error) {
        console.error(error);
        showToast('Erro ao abrir configurações: ' + error.message, 'error');
    }
}

// ─── loadApplications ─────────────────────────────────────────────────────────
async function loadApplications(serviceId) {
    const appsLoading = document.getElementById('applications-loading');
    const appsContent = document.getElementById('applications-content');

    try {
        const res = await fetch(`/api/glassfish/servicos/${serviceId}/applications`, {
            headers: authHeaders()
        });

        if (!res.ok) throw new Error('Erro ao obter lista de aplicações');

        const data = await res.json();
        const apps = data.applications || data || [];

        if (appsContent) {
            if (apps.length === 0) {
                appsContent.innerHTML = '<p class="text-center text-gray-400 text-sm py-3">Nenhuma aplicação instalada</p>';
            } else {
                appsContent.innerHTML = apps.map(app => `
                    <div class="application-item">
                        <i class="fas fa-cube text-primary"></i>
                        <span class="name">${app.name}</span>
                        <span class="badge badge-sm ${app.enabled ? 'badge-success' : 'badge-ghost'}">
                            ${app.enabled ? 'Ativo' : 'Desativado'}
                        </span>
                        <span class="badge badge-sm badge-outline">deployed</span>
                    </div>
                `).join('');
            }
            appsContent.classList.remove('hidden');
        }
    } catch (error) {
        console.error(error);
        if (appsContent) {
            appsContent.innerHTML = `<p class="text-center text-error text-sm py-3">${error.message}</p>`;
            appsContent.classList.remove('hidden');
        }
    } finally {
        if (appsLoading) appsLoading.classList.add('hidden');
    }
}

// ─── saveDomainConfig ─────────────────────────────────────────────────────────
export async function saveDomainConfig(services) {
    try {
        const service = services[currentDomainConfigIndex];
        if (!service?.id) {
            showToast('Serviço não encontrado', 'error');
            return;
        }

        const config = {
            serverName:   document.getElementById('db-server')?.value   || '',
            user:         document.getElementById('db-user')?.value     || '',
            password:     document.getElementById('db-password')?.value || '',
            databaseName: document.getElementById('db-name')?.value     || ''
        };

        const res = await fetch(`/api/glassfish/servicos/${service.id}/domain-config`, {
            method:  'PUT',
            headers: authHeaders({ 'Content-Type': 'application/json' }),
            body:    JSON.stringify(config)
        });

        if (!res.ok) throw new Error(await parseErrorResponse(res));

        showToast('Configurações salvas com sucesso!', 'success');
        closeDialog('domain-config-modal');
    } catch (error) {
        console.error(error);
        showToast(error.message, 'error');
    }
}

// ─── uploadApplication ────────────────────────────────────────────────────────
export async function uploadApplication(services) {
    const fileInput = document.getElementById('application-file');
    const file = fileInput?.files?.[0];

    if (!file) {
        showToast('Selecione um arquivo primeiro', 'warning');
        return;
    }

    try {
        const service = services[currentDomainConfigIndex];
        if (!service?.id) {
            showToast('Serviço não encontrado', 'error');
            return;
        }

        const btn = document.getElementById('upload-button');
        if (btn) { btn.disabled = true; btn.innerHTML = '<span class="loading loading-spinner loading-xs"></span> Enviando…'; }

        const formData = new FormData();
        formData.append('file', file);

        const res = await fetch(`/api/glassfish/servicos/${service.id}/upload-application`, {
            method:  'POST',
            headers: authHeaders(),
            body:    formData
        });

        if (!res.ok) throw new Error(await parseErrorResponse(res));

        showToast('Aplicação enviada com sucesso!', 'success');
        if (fileInput) fileInput.value = '';

        const uploadBtn = document.getElementById('upload-button');
        if (uploadBtn) { uploadBtn.disabled = true; uploadBtn.innerHTML = '<i class="fas fa-upload mr-1"></i>Fazer Upload'; }

        await loadApplications(service.id);
    } catch (error) {
        console.error(error);
        showToast(error.message, 'error');

        const btn = document.getElementById('upload-button');
        if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fas fa-upload mr-1"></i>Fazer Upload'; }
    }
}

// ─── showToast (DaisyUI) ──────────────────────────────────────────────────────
export function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) {
        // fallback se o container não existir
        console.warn('[Toast]', type, message);
        return;
    }

    const colorMap = {
        success: 'alert-success',
        error:   'alert-error',
        danger:  'alert-error',
        warning: 'alert-warning',
        info:    'alert-info'
    };

    const alertClass = colorMap[type] || 'alert-info';
    const iconMap = {
        success: 'fa-circle-check',
        error:   'fa-circle-xmark',
        danger:  'fa-circle-xmark',
        warning: 'fa-triangle-exclamation',
        info:    'fa-circle-info'
    };
    const icon = iconMap[type] || 'fa-circle-info';

    const toast = document.createElement('div');
    toast.className = `alert ${alertClass} toast-item shadow-lg max-w-xs py-3 px-4 flex gap-2 items-center text-sm`;
    toast.innerHTML = `
        <i class="fas ${icon} flex-shrink-0"></i>
        <span class="flex-1">${message}</span>
        <button class="btn btn-ghost btn-xs p-0 h-auto min-h-0" onclick="this.closest('.toast-item').remove()">
            <i class="fas fa-xmark"></i>
        </button>
    `;

    container.appendChild(toast);

    // Auto-remover após 4s com animação de saída
    setTimeout(() => {
        toast.classList.add('removing');
        setTimeout(() => toast.remove(), 300);
    }, 4000);
}