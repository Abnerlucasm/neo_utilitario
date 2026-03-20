import {
    closeModal,
    toggleLogViewer,
    markServiceAvailable,
    viewLogs,
    executeMaintenance,
    openMaintenanceModal,
    openDomainConfigModal,
    saveDomainConfig,
    uploadApplication,
    showToast
} from './glassfish-modals.js';

// ─── Service Worker ───────────────────────────────────────────────────────────
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js')
            .then(r  => console.log('SW:', r.scope))
            .catch(e => console.warn('SW falhou:', e));
    });
}

// ─── Estado ───────────────────────────────────────────────────────────────────
let services            = [];
let currentServiceIndex = null;

// ─── Helpers ──────────────────────────────────────────────────────────────────
function getToken() {
    return localStorage.getItem('auth_token') || localStorage.getItem('token') || '';
}
function authHeaders(extra = {}) {
    return { 'Authorization': `Bearer ${getToken()}`, ...extra };
}
function openDialog(id) {
    const el = document.getElementById(id);
    if (el?.showModal) el.showModal();
}
function closeDialog(id) {
    const el = document.getElementById(id);
    if (el?.close) el.close();
}
function getVal(id) {
    return document.getElementById(id)?.value?.trim() || '';
}
function setVal(id, value) {
    const el = document.getElementById(id);
    if (el && value !== undefined && value !== null) el.value = value;
}

// Lê campo do serviço com fallback para config aninhado (registros antigos têm config={})
function fieldOf(service, field, defaultValue = '') {
    const direct = service[field];
    if (direct !== undefined && direct !== null && direct !== '') return direct;
    const cfg = service.config || {};
    const fromConfig = cfg[field];
    if (fromConfig !== undefined && fromConfig !== null && fromConfig !== '') return fromConfig;
    return defaultValue;
}

// ─── Fetch ────────────────────────────────────────────────────────────────────
async function fetchServices() {
    try {
        const res = await fetch('/api/glassfish/servicos', { headers: authHeaders() });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        services = await res.json();
        renderCards(services);
        updateStats(services);
        const rc    = document.getElementById('results-count');
        const empty = document.getElementById('empty-message');
        if (rc)    rc.textContent = `${services.length} serviço(s)`;
        if (empty) empty.classList.toggle('hidden', services.length > 0);

        // Checar status real de cada serviço em background (sem bloquear a UI)
        checkAllServicesStatus();
    } catch (err) {
        console.error(err);
        showToast('Erro ao carregar serviços', 'error');
    }
}

// Checa o status real de todos os serviços via SSH em paralelo (background)
async function checkAllServicesStatus() {
    if (services.length === 0) return;

    // Limita a 4 verificações simultâneas para não sobrecarregar
    const CONCURRENCY = 4;
    const chunks = [];
    for (let i = 0; i < services.length; i += CONCURRENCY) {
        chunks.push(services.slice(i, i + CONCURRENCY));
    }

    for (const chunk of chunks) {
        await Promise.allSettled(
            chunk.map(service => checkServiceStatus(service))
        );
    }
}

async function checkServiceStatus(service) {
    // Mostrar spinner no card
    const spinner = document.getElementById(`checking-badge-${service.id}`);
    if (spinner) spinner.style.display = 'inline-flex';

    try {
        const res = await fetch(`/api/glassfish/servicos/${service.id}/status`, {
            headers: authHeaders()
        });

        if (!res.ok) return;

        const data = await res.json();
        const idx  = services.findIndex(s => s.id === service.id);
        if (idx === -1) return;

        // Atualiza o objeto local com os dois estados
        services[idx].machineStatus   = data.machineStatus   || 'unknown';
        services[idx].glassfishStatus = data.glassfishStatus || 'unknown';
        services[idx].status          = data.status          || 'inactive';

        // Atualiza os dois badges no DOM sem re-renderizar o card
        const mBadge = document.getElementById(`machine-badge-${service.id}`);
        const gBadge = document.getElementById(`gf-badge-${service.id}`);

        if (mBadge) mBadge.outerHTML = machineBadge(services[idx]);
        if (gBadge) gBadge.outerHTML = glassfishBadge(services[idx]);

        // Borda do card muda se máquina offline
        const card = document.querySelector(`[data-index="${idx}"]`);
        if (card) {
            card.classList.toggle('border-error',   data.machineStatus === 'offline');
            card.classList.toggle('border-warning',  data.machineStatus === 'online' && data.glassfishStatus !== 'active' && !services[idx].inUse);
            card.classList.toggle('border-base-300', data.machineStatus === 'online' && data.glassfishStatus === 'active');
        }

        updateStats(services);

    } catch {
        // silencioso
    } finally {
        const sp = document.getElementById(`checking-badge-${service.id}`);
        if (sp) sp.style.display = 'none';
    }
}

function updateStats(list) {
    const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
    set('stat-total',          list.length);
    set('stat-machine-online', list.filter(s => s.machineStatus === 'online').length);
    set('stat-gf-active',      list.filter(s => s.glassfishStatus === 'active').length);
    set('stat-inuse',          list.filter(s => s.inUse).length);
}

// ─── Helpers de badge de status ──────────────────────────────────────────────
function machineBadge(service) {
    const s = service.machineStatus || 'unknown';
    const map = {
        online:  { cls: 'badge-success',  dot: 'bg-success',  label: 'Máquina online' },
        offline: { cls: 'badge-error',    dot: 'bg-error',    label: 'Máquina offline' },
        unknown: { cls: 'badge-ghost',    dot: 'bg-base-300', label: 'Máquina?' },
    };
    const { cls, dot, label } = map[s] || map.unknown;
    return `<span class="badge badge-sm ${cls} gap-1" id="machine-badge-${service.id}">
        <span class="w-1.5 h-1.5 rounded-full ${dot} inline-block flex-shrink-0"></span>${label}
    </span>`;
}

function glassfishBadge(service) {
    const s = service.glassfishStatus || (service.status === 'active' ? 'active' : 'inactive');
    const map = {
        active:   { cls: 'badge-success', dot: 'bg-success',  label: 'GlassFish ativo' },
        inactive: { cls: 'badge-warning', dot: 'bg-warning',  label: 'GlassFish parado' },
        unknown:  { cls: 'badge-ghost',   dot: 'bg-base-300', label: 'GlassFish?' },
    };
    const { cls, dot, label } = map[s] || map.unknown;
    return `<span class="badge badge-sm ${cls} gap-1" id="gf-badge-${service.id}">
        <span class="w-1.5 h-1.5 rounded-full ${dot} inline-block flex-shrink-0"></span>${label}
    </span>`;
}

// ─── Render cards ─────────────────────────────────────────────────────────────
function renderCards(list) {
    const container = document.getElementById('cards-container');
    if (!container) return;
    if (list.length === 0) { container.innerHTML = ''; return; }

    container.innerHTML = list.map((service, index) => {
        const ip     = service.ip || service.host || '—';
        const active  = service.glassfishStatus === 'active' || service.status === 'active';
        const inUse   = !!service.inUse;

        return `
        <div class="card bg-base-100 shadow server-card border ${
            service.machineStatus === 'offline' ? 'border-error' :
            (service.glassfishStatus === 'inactive' && !inUse) ? 'border-warning' :
            inUse ? 'border-warning' : 'border-base-300'
        } rounded-xl" data-index="${index}">
            <div class="card-body p-5 gap-2">
                <div class="flex items-start gap-3">
                    <div class="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                        <i class="fas fa-server text-primary"></i>
                    </div>
                    <div class="min-w-0">
                        <h2 class="font-bold text-base truncate" title="${service.name}">${service.name}</h2>
                        <p class="text-xs text-gray-400 font-mono">${ip}:${service.port || '—'}</p>
                    </div>
                </div>
                <div class="flex flex-wrap gap-1 mt-1" id="badges-${service.id}">
                    ${machineBadge(service)}
                    ${glassfishBadge(service)}
                    <span class="badge badge-sm badge-ghost gap-1 checking-spinner" id="checking-badge-${service.id}" style="display:none">
                        <span class="loading loading-spinner loading-xs"></span>
                    </span>
                    ${inUse  ? `<span class="badge badge-sm badge-warning max-w-[160px] truncate" title="${service.inUseBy || '?'}">Em uso: ${(service.inUseBy||'?').split('@')[0]}</span>` : ''}
                    ${service.setor ? `<span class="badge badge-sm badge-ghost" title="${service.setor}">${service.setor}</span>` : ''}
                </div>
                <div class="text-xs text-gray-400 mt-1 space-y-0.5">
                    <p>Domínio: <span class="font-mono text-gray-600">${service.domain || '—'}</span></p>
                </div>
            </div>
            <div class="border-t border-base-200 p-3 space-y-2">
                <div class="flex gap-1.5 flex-wrap justify-center">
                    <button class="btn btn-xs btn-success"  data-action="startService"   data-index="${index}" title="Iniciar"><i class="fas fa-play"></i></button>
                    <button class="btn btn-xs btn-error"    data-action="stopService"    data-index="${index}" title="Parar"><i class="fas fa-stop"></i></button>
                    <button class="btn btn-xs btn-warning"  data-action="restartService" data-index="${index}" title="Reiniciar"><i class="fas fa-rotate-right"></i></button>
                    <button class="btn btn-xs btn-info btn-outline" data-action="viewLogs" data-index="${index}" title="Logs"><i class="fas fa-file-lines"></i></button>
                    <button class="btn btn-xs btn-ghost"    data-action="domainConfig"   data-index="${index}" title="Domain"><i class="fas fa-database"></i></button>
                    <button class="btn btn-xs btn-ghost"    data-action="editService"    data-index="${index}" title="Editar"><i class="fas fa-pen"></i></button>
                    <button class="btn btn-xs btn-ghost text-error" data-action="removeService" data-index="${index}" title="Excluir"><i class="fas fa-trash"></i></button>
                </div>
                <div class="flex justify-center">
                    ${!inUse
                        ? `<button class="btn btn-xs btn-warning btn-outline w-full gap-1" data-action="markInUse" data-index="${index}"><i class="fas fa-user-clock"></i>Marcar em uso</button>`
                        : canRelease(service)
                            ? `<button class="btn btn-xs btn-success btn-outline w-full gap-1" data-action="markAvailable" data-index="${index}"><i class="fas fa-circle-check"></i>Disponível</button>`
                            : `<span class="btn btn-xs btn-disabled w-full gap-1 opacity-60 cursor-not-allowed" title="Apenas ${service.inUseBy} ou um admin pode liberar"><i class="fas fa-lock"></i>Uso: ${(service.inUseBy||'?').split('@')[0]}</span>`
                    }
                </div>
            </div>
        </div>`;
    }).join('');
}

// ─── Filtros ──────────────────────────────────────────────────────────────────
function filterCards() {
    const status = document.getElementById('filter-status')?.value || 'all';
    const setor  = document.getElementById('filter-setor')?.value  || 'all';
    const query  = (document.getElementById('search-input')?.value || '').toLowerCase();

    const filtered = services.filter(s => {
        const matchStatus = status === 'all' || (status === 'active' && s.status === 'active') || (status === 'inactive' && s.status !== 'active');
        const matchSetor  = setor === 'all' || s.setor === setor;
        const matchSearch = (s.name || '').toLowerCase().includes(query) || (s.domain || '').toLowerCase().includes(query) || (s.ip || s.host || '').toLowerCase().includes(query);
        return matchStatus && matchSetor && matchSearch;
    });

    renderCards(filtered);
    const rc = document.getElementById('results-count');
    if (rc) rc.textContent = `${filtered.length} de ${services.length} serviço(s)`;
}

// ─── Modal Adicionar/Editar ───────────────────────────────────────────────────
function openAddModal(editIndex = null) {
    const modal = document.getElementById('add-modal');
    if (!modal) return;

    // Reset limpa os campos antes de preencher
    document.getElementById('service-form')?.reset();
    const resultEl = document.getElementById('ssh-test-result');
    if (resultEl) resultEl.textContent = '';

    if (editIndex !== null && services[editIndex]) {
        const s = services[editIndex];

        // Debug: confirmar dados recebidos (com config aninhado expandido)
        console.log('[openAddModal] serviço raw:', s);
        console.log('[openAddModal] config:', s.config);

        // Usar fieldOf() para ler campo direto OU config.campo (registros antigos têm config={})
        setVal('service-name',         fieldOf(s, 'name'));
        setVal('service-ip',           s.ip || s.host || fieldOf(s, 'ip', ''));
        setVal('service-port',         s.port || 4848);
        setVal('service-domain',       fieldOf(s, 'domain'));
        setVal('service-ssh-username', s.sshUsername || s.username || fieldOf(s, 'sshUsername', ''));
        setVal('service-ssh-password', fieldOf(s, 'sshPassword'));
        setVal('service-install-path', fieldOf(s, 'installPath', '/srv/glassfish6.2.5'));
        setVal('production-port',      fieldOf(s, 'productionPort', 8091));
        setVal('service-category',     fieldOf(s, 'setor', 'Setor Sup. Externo'));
        setVal('service-access-type',  fieldOf(s, 'accessType', 'local'));
        setVal('service-admin-password', fieldOf(s, 'adminPassword', ''));

        currentServiceIndex = editIndex;
        const t = document.getElementById('modal-title');
        if (t) t.textContent = `Editar — ${s.name}`;
    } else {
        currentServiceIndex = null;
        // Valores padrão para novo serviço
        setVal('service-port',         '4848');
        setVal('production-port',      '8091');
        setVal('service-install-path', '/srv/glassfish6.2.5');
        setVal('service-access-type',  'local');
        setVal('service-category',     'Setor Sup. Externo');
        const t = document.getElementById('modal-title');
        if (t) t.textContent = 'Adicionar Glassfish';
    }

    // Abre o dialog nativo
    if (modal.showModal) {
        modal.showModal();
    }
}

function closeAddModal() {
    closeDialog('add-modal');
    currentServiceIndex = null;
}

// ─── Salvar ───────────────────────────────────────────────────────────────────
async function saveGlassfish() {
    const btn = document.querySelector('[data-action="saveGlassfish"]');
    try {
        const serviceData = {
            name:           getVal('service-name'),
            ip:             getVal('service-ip'),
            port:           parseInt(getVal('service-port'))    || 4848,
            domain:         getVal('service-domain'),
            sshUsername:    getVal('service-ssh-username'),
            sshPassword:    getVal('service-ssh-password'),
            adminPassword:  getVal('service-admin-password'),
            installPath:    getVal('service-install-path')      || '/srv/glassfish6.2.5',
            setor:          getVal('service-category'),
            accessType:     getVal('service-access-type'),
            productionPort: parseInt(getVal('production-port')) || 8091
        };

        // Validação clara campo a campo
        const labels = {
            name: 'Nome', ip: 'IP', domain: 'Domínio',
            sshUsername: 'Usuário SSH', sshPassword: 'Senha SSH', installPath: 'Caminho de instalação'
        };
        const missing = Object.entries(labels)
            .filter(([k]) => !serviceData[k])
            .map(([, label]) => label);

        if (missing.length) {
            showToast(`Preencha: ${missing.join(', ')}`, 'warning');
            return;
        }

        // Se editando e a senha está vazia, manter a senha atual
        const isEdit = currentServiceIndex !== null;
        if (isEdit && !serviceData.sshPassword) {
            serviceData.sshPassword = services[currentServiceIndex].sshPassword || '';
        }

        if (btn) {
            btn.disabled = true;
            btn.innerHTML = '<span class="loading loading-spinner loading-xs"></span> Salvando…';
        }

        const url = isEdit
            ? `/api/glassfish/servicos/${services[currentServiceIndex].id}`
            : '/api/glassfish/servicos';

        const res = await fetch(url, {
            method:  isEdit ? 'PUT' : 'POST',
            headers: authHeaders({ 'Content-Type': 'application/json' }),
            body:    JSON.stringify(serviceData)
        });

        if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            throw new Error(err.details || err.error || `Erro HTTP ${res.status}`);
        }

        const saved = await res.json();
        console.log('[saveGlassfish] resposta do servidor:', saved);

        // Atualiza o objeto local imediatamente sem esperar o fetchServices
        if (isEdit) {
            services[currentServiceIndex] = saved;
        }

        closeAddModal();
        showToast(isEdit ? 'Serviço atualizado!' : 'Serviço adicionado!', 'success');

        // Recarrega a lista completa para garantir consistência
        await fetchServices();

    } catch (err) {
        console.error('[saveGlassfish]', err);
        showToast(err.message || 'Erro ao salvar serviço', 'error');
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = '<i class="fas fa-save mr-1"></i>Salvar';
        }
    }
}

// ─── Ações dos cards ──────────────────────────────────────────────────────────
async function removeService(index) {
    const s = services[index];
    if (!s || !confirm(`Excluir "${s.name}"?`)) return;
    try {
        const res = await fetch(`/api/glassfish/servicos/${s.id}`, { method: 'DELETE', headers: authHeaders() });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        showToast('Serviço removido!', 'success');
        await fetchServices();
    } catch (err) { showToast('Erro ao remover: ' + err.message, 'error'); }
}

async function serviceAction(index, action, msg) {
    const s = services[index];
    if (!s?.id) return;
    const btn = document.querySelector(`[data-action="${action}Service"][data-index="${index}"]`);
    if (btn) btn.classList.add('loading');
    try {
        const res = await fetch(`/api/glassfish/servicos/${s.id}/${action}`, { method: 'POST', headers: authHeaders() });
        if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.error || `Erro ao ${action}`); }
        showToast(msg, 'success');
        await fetchServices();
    } catch (err) { showToast(err.message, 'error'); }
    finally { if (btn) btn.classList.remove('loading'); }
}

const startService   = (i) => serviceAction(i, 'start',   'Serviço iniciado!');
const stopService    = (i) => serviceAction(i, 'stop',    'Serviço parado!');
const restartService = (i) => serviceAction(i, 'restart', 'Serviço reiniciado!');

async function markInUse(index) {
    const s = services[index];
    if (!s?.id) return;

    // Busca nome do usuário — API primeiro, JWT como fallback
    const user = await resolveCurrentUserAsync();
    if (!user) {
        showToast('Não foi possível identificar o usuário logado', 'warning');
        return;
    }

    try {
        const res = await fetch(`/api/glassfish/servicos/${s.id}/in-use`, {
            method: 'POST',
            headers: authHeaders({ 'Content-Type': 'application/json' }),
            body: JSON.stringify({ user })
        });
        if (!res.ok) throw new Error('Erro ao marcar como em uso');
        showToast(`Marcado em uso por ${user}`, 'success');
        await fetchServices();
    } catch (err) {
        showToast(err.message, 'error');
    }
}

/**
 * Resolve o nome do usuário logado a partir do token JWT ou AuthManager.
 * Retorna o nome/username/email disponível, priorizando legibilidade.
 */
function resolveCurrentUser() {
    // 1. Tentar AuthManager
    try {
        const u = AuthManager?.getCurrentUser?.();
        if (u?.name)     return u.name;
        if (u?.username) return u.username;
        if (u?.email)    return u.email;
    } catch (_) {}

    // 2. Decodificar JWT
    try {
        const payload = JSON.parse(atob(getToken().split('.')[1]));
        if (payload.name)     return payload.name;
        if (payload.username) return payload.username;
        if (payload.email)    return payload.email;
    } catch (_) {}

    // 3. localStorage
    return localStorage.getItem('username') || localStorage.getItem('user') || null;
}

// Verifica se o usuário atual pode liberar o serviço (dono ou admin)
function canRelease(service) {
    if (!service.inUse) return true;
    try {
        const payload = JSON.parse(atob(getToken().split('.')[1]));
        const isAdmin = payload.is_admin || payload.roles?.some(r => r === 'admin' || r?.name === 'admin');
        if (isAdmin) return true;
        const me    = (payload.email || payload.username || '').split('@')[0].toLowerCase();
        const owner = (service.inUseBy || '').split('@')[0].toLowerCase();
        return me === owner;
    } catch { return false; }
}

// Busca o nome real do usuário na API e armazena em cache
let _cachedUserName = null;
async function resolveCurrentUserAsync() {
    if (_cachedUserName) return _cachedUserName;

    // Tentar síncronamente primeiro
    const sync = resolveCurrentUser();

    try {
        const res = await fetch('/api/auth/me', { headers: authHeaders() });
        if (res.ok) {
            const u = await res.json();
            const name = u.name || u.username || u.email || sync;
            _cachedUserName = name;
            return name;
        }
    } catch (_) {}

    // Tentar rota alternativa comum
    try {
        const res = await fetch('/api/users/me', { headers: authHeaders() });
        if (res.ok) {
            const u = await res.json();
            const name = u.name || u.username || u.email || sync;
            _cachedUserName = name;
            return name;
        }
    } catch (_) {}

    _cachedUserName = sync;
    return sync;
}

function openAdminPanel() {
    if (currentServiceIndex === null) return;
    const s = services[currentServiceIndex];
    window.open(`http://${s.ip || s.host}:${s.port}`, '_blank');
}

function accessNeoWeb() {
    if (currentServiceIndex === null) return;
    const s = services[currentServiceIndex];
    window.open(`http://${s.ip || s.host}:${s.productionPort}/neoweb`, '_blank');
}

function handleAccessTypeChange() {
    const type  = document.getElementById('service-access-type')?.value;
    const field = document.getElementById('production-port-field');
    if (field) field.style.display = type === 'external' ? '' : 'none';
}

async function testAPIConnection() {
    const ip       = getVal('service-ip');
    const port     = getVal('service-port') || '4848';
    const password = getVal('service-admin-password');
    const resultEl = document.getElementById('api-test-result');

    if (!ip) {
        if (resultEl) { resultEl.textContent = 'Preencha o IP'; resultEl.className = 'text-error text-xs mt-1'; }
        return;
    }

    if (resultEl) { resultEl.textContent = 'Testando…'; resultEl.className = 'text-info text-xs mt-1'; }

    try {
        const res  = await fetch('/api/glassfish/test-api', {
            method:  'POST',
            headers: authHeaders({ 'Content-Type': 'application/json' }),
            body:    JSON.stringify({ ip, port: parseInt(port), adminPassword: password })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Falha na API');
        if (resultEl) { resultEl.textContent = '✓ ' + data.message; resultEl.className = 'text-success text-xs mt-1'; }
    } catch (err) {
        if (resultEl) { resultEl.textContent = '✗ ' + err.message; resultEl.className = 'text-error text-xs mt-1'; }
    }
}

async function testSSHConnection() {
    const host = getVal('service-ip'), username = getVal('service-ssh-username'), password = getVal('service-ssh-password');
    const el   = document.getElementById('ssh-test-result');
    if (!host || !username || !password) {
        if (el) { el.textContent = 'Preencha IP, usuário e senha SSH'; el.className = 'text-error text-sm mt-1'; }
        return;
    }
    if (el) { el.textContent = 'Testando…'; el.className = 'text-info text-sm mt-1'; }
    try {
        const res  = await fetch('/api/glassfish/test-ssh', { method: 'POST', headers: authHeaders({ 'Content-Type': 'application/json' }), body: JSON.stringify({ ip: host, username, password }) });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Falha SSH');
        if (el) { el.textContent = '✓ ' + data.message; el.className = 'text-success text-sm mt-1'; }
    } catch (err) {
        if (el) { el.textContent = '✗ ' + err.message; el.className = 'text-error text-sm mt-1'; }
    }
}

// ─── Init ─────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
    document.getElementById('search-input')?.addEventListener('input',  filterCards);
    document.getElementById('filter-status')?.addEventListener('change', filterCards);
    document.getElementById('filter-setor')?.addEventListener('change',  filterCards);
    document.getElementById('application-file')?.addEventListener('change', e => {
        const btn = document.getElementById('upload-button');
        if (btn) btn.disabled = !e.target.files?.[0];
    });

    document.addEventListener('click', async (e) => {
        const target = e.target.closest('[data-action]');
        if (!target) return;
        const action = target.dataset.action;
        const index  = target.dataset.index !== undefined ? parseInt(target.dataset.index) : null;

        switch (action) {
            case 'filter':            filterCards();                                      break;
            case 'refresh':           fetchServices();                                    break;
            case 'openAddModal':      openAddModal();                                     break;
            case 'closeAddModal':     closeAddModal();                                    break;
            case 'saveGlassfish':     saveGlassfish();                                    break;
            case 'editService':       openAddModal(index);                                break;
            case 'removeService':     removeService(index);                               break;
            case 'startService':      startService(index);                                break;
            case 'stopService':       stopService(index);                                 break;
            case 'restartService':    restartService(index);                              break;
            case 'markInUse':         markInUse(index);                                   break;
            case 'markAvailable':     markServiceAvailable(index, services, fetchServices); break;
            // saveUserName removido — usuário é identificado automaticamente via JWT
            case 'viewLogs':          viewLogs(index, services);                           break;
            case 'toggleLogViewer':   toggleLogViewer(services);                           break;
            case 'clearLogViewer':    { const lv = document.getElementById('log-viewer'); if (lv) lv.textContent = ''; break; }
            case 'domainConfig':      openDomainConfigModal(index, services);              break;
            case 'saveDomainConfig':  saveDomainConfig(services);                          break;
            case 'uploadApplication': uploadApplication(services);                         break;
            case 'openMaintenanceModal': openMaintenanceModal(index);                      break;
            case 'executeMaintenance':   executeMaintenance(services, fetchServices);      break;
            case 'testSSHConnection': testSSHConnection();                                 break;
            case 'testAPIConnection':  testAPIConnection();                                  break;
            case 'openAdminPanel':    openAdminPanel();                                    break;
            case 'accessNeoWeb':      accessNeoWeb();                                      break;
            case 'closeModal': {
                const modalId = target.dataset.modal;
                if (modalId) closeModal(modalId);
                break;
            }
        }
    });

    window.handleAccessTypeChange = handleAccessTypeChange;
    await fetchServices();
});