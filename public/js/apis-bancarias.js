const BANKS = [
  "Banco do Brasil",
  "Sicoob",
  "Unicred",
  "Sicredi",
  "Itaú",
  "Banrisul",
  "Caixa",
  "Bradesco",
  "C6Bank",
  "Safra",
  "Santander",
  "Ailos",
];
const APIS = [
  "Cobrança",
  "Webhook",
  "Pag. boletos",
  "Pag. Pix",
  "Pag. TED",
  "Pag. concessionária",
  "DDA",
  "Extrato",
];
const AVAILABLE_APIS = {
  "Banco do Brasil": [
    "Cobranca",
    "Webhook",
    "Pag Boletos",
    "Pag Pix",
    "Pag TED",
    "Pag Concessionaria",
    "DDA",
    "Extrato",
  ],
  "Sicoob": [
    "Cobranca",
    "Webhook",
    "Pag Boletos",
    "Pag Pix",
    "Pag TED",
    "Pag Concessionaria",
    "DDA",
    "Extrato",
  ],
  "Unicred": ["Cobranca", "Webhook"],
  "Sicredi": [
    "Cobranca",
    "Webhook",
    "Pag Boletos",
    "Pag Pix",
    "Pag Concessionaria",
  ],
  "Itaú": ["Cobranca", "Pag Pix", "Extrato"],
  "Banrisul": ["Cobranca"],
  "Caixa": ["Cobranca"],
  "Bradesco": [
    "Cobranca",
    "Pag Boletos",
    "Pag Pix",
    "Pag TED",
    "Pag Concessionaria",
    "Extrato",
  ],
  "C6Bank": ["Cobranca"],
  "Safra": ["Cobranca"],
  "Santander": [
    "Cobranca",
    "Webhook",
    "Pag Boletos",
    "Pag Pix",
    "Pag TED",
    "Pag Concessionaria",
    "Extrato",
  ],
  "Ailos": ["Cobranca"],
};
const ALL_APIS = [...new Set(Object.values(AVAILABLE_APIS).flat())];
const API_ALIASES = {
  "Cobrança": "Cobranca",
  "Pag. boletos": "Pag Boletos",
  "Pag. Pix": "Pag Pix",
  "Pag. TED": "Pag TED",
  "Pag. concessionaria": "Pag Concessionaria",
};
//Rota
const API_BASE = "/api/apis-bancarias";

let clients = [];
let certificates = [];
let integrationSequence = 0;

// ─── Inicialização, carregamento da tela ─────────────────────────────────────
document.addEventListener("DOMContentLoaded", function () {
  console.log("DOM carregado, inicializando APIs Bancárias...");

  if (!getAuthToken()) {
    console.log("Usuário não autenticado, redirecionando...");
    return;
  }

  populateBankSelects();
  loadClients();
  loadCertificates();
  setupEventListeners();
});

function setupEventListeners() {
  const searchInput = document.getElementById("clientSearch");
  if (searchInput) {
    searchInput.addEventListener(
      "input",
      debounce(() => filterClients(), 300),
    );
  }

  const clientForm = document.getElementById("clientForm");
  if (clientForm) {
    clientForm.addEventListener("submit", handleClientSubmit);
    clientForm.elements.name?.addEventListener("input", (event) => {
      event.target.value = event.target.value.toLocaleUpperCase("pt-BR");
    });
  }

  const certificateForm = document.getElementById("certificateForm");
  if (certificateForm) {
    certificateForm.addEventListener("submit", handleCertificateSubmit);
  }
}

function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}

// ─── Helpers gerais ────────────────────────────────────────────────────────
function getAuthToken() {
  const token = localStorage.getItem("auth_token");
  if (!token) {
    window.location.href = "/pages/login.html";
    return null;
  }
  return token;
}

function authHeaders(extra = {}) {
  return { Authorization: `Bearer ${getAuthToken()}`, ...extra };
}
//adicionado esses replace por conta de um erro de acento que estava dando
function escapeHtml(str = "") {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
//Notificação de erro/sucesso
function showToast(message, type = "info", duration = 4000) {
  const toast = document.createElement("div");

  const alertClass =
    type === "error"
      ? "alert-error"
      : type === "warning"
        ? "alert-warning"
        : type === "success"
          ? "alert-success"
          : "alert-info";

  const iconClass =
    type === "error"
      ? "fa-exclamation-triangle"
      : type === "warning"
        ? "fa-exclamation-circle"
        : type === "success"
          ? "fa-check-circle"
          : "fa-info-circle";

  toast.className = `alert ${alertClass} fixed top-4 right-4 z-50 max-w-sm shadow-lg`;
  toast.innerHTML = `
        <div class="flex items-center">
            <span class="flex-shrink-0"><i class="fas ${iconClass}"></i></span>
            <div class="ml-3"><p class="text-sm font-medium">${escapeHtml(message)}</p></div>
            <div class="ml-auto pl-3">
                <button onclick="this.parentElement.parentElement.parentElement.remove()" class="btn btn-ghost btn-xs">
                    <i class="fas fa-times"></i>
                </button>
            </div>
        </div>
    `;

  document.body.appendChild(toast);
  setTimeout(() => {
    if (toast.parentElement) toast.remove();
  }, duration);
}

// ─── Alterna Abas (Clientes / Certificados) ──────────────────────────────────
function switchTab(tab) {
  document.querySelectorAll('[role="tab"]').forEach((btn) => {
    btn.classList.toggle("tab-active", btn.dataset.tab === tab);
  });
  document
    .getElementById("clientsPanel")
    ?.classList.toggle("hidden", tab !== "clients");
  document
    .getElementById("certificatesPanel")
    ?.classList.toggle("hidden", tab !== "certificates");
}

// ═══════════════════════════════════════════════════════════════════════════
// CLIENTES - renderização, CRUD e filtros
// ═══════════════════════════════════════════════════════════════════════════

async function loadClients() {
  try {
    const response = await fetch(`${API_BASE}/clientes`, {
      headers: authHeaders(),
    });
    if (!response.ok) throw new Error("Erro ao carregar clientes");

    const data = await response.json();
    clients = data.data || data || [];

    renderClients(clients);
    updateStats();
  } catch (error) {
    console.error("Erro ao carregar clientes:", error);
    showToast("Erro ao carregar clientes", "error");
  }
}

function renderClients(list) {
  const body = document.getElementById("clientsBody");
  const empty = document.getElementById("clientsEmpty");
  if (!body) return;

  if (!list.length) {
    body.innerHTML = "";
    empty?.classList.remove("hidden");
    return;
  }
  empty?.classList.add("hidden");

  body.innerHTML = list
    .map((client) => {
      const integrations = client.integrations || [];

      const badges = integrations
        .map((i) => {
          const apiNames = (i.apis || [])
            .map((api) => (typeof api === "string" ? api : api.name))
            .filter(Boolean);

          const description = apiNames.length
            ? apiNames.join(",\n")
            : "Nenhuma API vinculada";

          return `<span class="badge badge-outline badge-sm api-integration-badge" title="${escapeHtml(description)}">
    <div><strong>${escapeHtml(i.bank)}</strong></div> — <div style="white-space: pre-line">${escapeHtml(description)}</div>
</span>`;
        })
        .join("");

      return `
        <tr>
            <td class="font-medium">${escapeHtml(client.name)}</td>
            <td>${escapeHtml(client.document || "—")}</td>
            <td><div class="api-integrations">${badges || '<span class="text-base-content/40">—</span>'}</div></td>
            <td class="max-w-xs whitespace-normal break-words" title="${escapeHtml(client.notes || "")}">${escapeHtml(client.notes || "—")}</td>
            <td class="api-actions">
                <button type="button" class="btn btn-xs btn-ghost" onclick="editClient('${client.id}')" title="Editar">
                    <i class="fas fa-pen"></i>
                </button>
                <button type="button" class="btn btn-xs btn-ghost text-error" onclick="deleteClient('${client.id}')" title="Excluir">
                    <i class="fas fa-trash"></i>
                </button>
            </td>
        </tr>`;
    })
    .join("");
}

function openClientModal() {
  const form = document.getElementById("clientForm");
  form.reset();
  form.elements.id.value = "";

  renderIntegrations();

  document.getElementById("clientDialogTitle").textContent = "Novo cliente";
  document.getElementById("clientDialog").showModal();
}

function closeClientModal() {
  document.getElementById("clientDialog").close();
}

function bankOptions(selectedBank = "") {
  return (
    '<option value="">Selecione</option>' +
    BANKS.map(
      (bank) =>
        `<option value="${escapeHtml(bank)}"${bank === selectedBank ? " selected" : ""}>${escapeHtml(bank)}</option>`,
    ).join("")
  );
}

function normalizeApiName(api) {
  return API_ALIASES[api] || api;
}

function integrationApiOptions(bank = "", selectedApis = []) {
  const supportedApis = new Set(AVAILABLE_APIS[bank] || []);
  const selected = new Set(selectedApis.map(normalizeApiName));
  return ALL_APIS.map((api) => {
    const supported = supportedApis.has(api);
    return `<label class="${supported ? "" : "api-option-disabled"}">
            <input type="checkbox" class="checkbox checkbox-primary checkbox-sm" data-api value="${escapeHtml(api)}"${supported && selected.has(api) ? " checked" : ""}${supported ? "" : " disabled"}>
            ${escapeHtml(api)}
        </label>`;
  }).join("");
}

function refreshIntegrationApis(select) {
  const row = select.closest(".api-integration");
  const selectedApis = Array.from(
    row.querySelectorAll("[data-api]:checked"),
  ).map((input) => input.value);
  row.querySelector(".api-options").innerHTML = integrationApiOptions(
    select.value,
    selectedApis,
  );
}

function integrationRow(integration = {}) {
  const id = `integration-${integrationSequence++}`;
  const selectedApis = (integration.apis || []).map((api) =>
    typeof api === "string" ? api : api.name,
  );
  return `
        <div class="api-integration" data-integration-id="${id}">
            <div class="flex items-end justify-between gap-3 mb-3">
                <label class="form-control flex-1">
                    <span class="label-text">Banco</span>
                    <select class="select select-bordered integration-bank" onchange="refreshIntegrationApis(this)">${bankOptions(integration.bank || "")}</select>
                </label>
                <button type="button" class="btn btn-ghost btn-sm text-error" onclick="removeIntegration(this)" title="Remover banco">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
            <div class="api-options">${integrationApiOptions(integration.bank || "", selectedApis)}</div>
        </div>`;
}

function renderIntegrations(integrations = []) {
  const container = document.getElementById("integrationRows");
  if (!container) return;
  integrationSequence = 0;
  container.innerHTML = (integrations.length ? integrations : [{}])
    .map(integrationRow)
    .join("");
}

function addIntegration() {
  const container = document.getElementById("integrationRows");
  if (container) container.insertAdjacentHTML("beforeend", integrationRow());
}

function removeIntegration(button) {
  const row = button.closest(".api-integration");
  const rows = document.querySelectorAll("#integrationRows .api-integration");
  if (rows.length === 1) {
    row.querySelector(".integration-bank").value = "";
    row.querySelectorAll("[data-api]").forEach((input) => {
      input.checked = false;
    });
    return;
  }
  row.remove();
}

function collectIntegrations() {
  const integrations = Array.from(
    document.querySelectorAll("#integrationRows .api-integration"),
  )
    .map((row) => ({
      bank: row.querySelector(".integration-bank")?.value || "",
      apis: Array.from(row.querySelectorAll("[data-api]:checked")).map(
        (input) => input.value,
      ),
    }))
    .filter((integration) => integration.bank);

  const banks = integrations.map((integration) => integration.bank);
  if (new Set(banks).size !== banks.length) {
    showToast(
      "Cada banco pode ser informado apenas uma vez por cliente",
      "warning",
    );
    return null;
  }
  return integrations;
}

function editClient(id) {
  const client = clients.find((c) => c.id === id);
  if (!client) {
    showToast("Cliente não encontrado", "error");
    return;
  }

  openClientModal();

  const form = document.getElementById("clientForm");
  form.elements.id.value = client.id;
  form.elements.name.value = client.name;
  form.elements.document.value = client.document || "";
  form.elements.notes.value = client.notes || "";

  renderIntegrations(client.integrations || []);

  document.getElementById("clientDialogTitle").textContent = "Editar cliente";
}

async function handleClientSubmit(e) {
  e.preventDefault();

  const form = e.target;
  const id = form.elements.id.value;
  const payload = {
    name: form.elements.name.value.trim().toLocaleUpperCase("pt-BR"),
    document: form.elements.document.value.trim(),
    notes: form.elements.notes.value.trim(),
    integrations: collectIntegrations(),
  };

  if (!payload.name) {
    showToast("Informe o nome da empresa", "warning");
    return;
  }
    if (!payload.document) {
    showToast("Informe o CNPJ da empresa", "warning");
    return;
  }
  if (payload.integrations === null) return;

  const isEdit = !!id;
  const submitBtn = form.querySelector(
    'button[type="submit"], .modal-action button:not([type="button"])',
  );

  try {
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = "Salvando...";
    }

    const response = await fetch(
      `${API_BASE}/clientes${isEdit ? "/" + id : ""}`,
      {
        method: isEdit ? "PUT" : "POST",
        headers: authHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify(payload),
      },
    );

    const result = await response.json().catch(() => ({}));

    if (response.ok) {
      showToast(
        isEdit
          ? "Cliente atualizado com sucesso!"
          : "Cliente cadastrado com sucesso!",
        "success",
      );
      closeClientModal();
      await loadClients();
    } else {
      showToast(
        result.message || result.error || "Erro ao salvar cliente",
        "error",
      );
    }
  } catch (error) {
    console.error("Erro ao salvar cliente:", error);
    showToast("Erro ao conectar com o servidor", "error");
  } finally {
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.textContent = "Salvar";
    }
  }
}

async function deleteClient(id) {
  const client = clients.find((c) => c.id === id);
  if (!client) {
    showToast("Cliente não encontrado", "error");
    return;
  }

  if (!confirm(`Tem certeza que deseja excluir "${client.name}"?`)) return;

  try {
    const response = await fetch(`${API_BASE}/clientes/${id}`, {
      method: "DELETE",
      headers: authHeaders(),
    });

    const result = await response.json().catch(() => ({}));

    if (response.ok) {
      showToast("Cliente removido com sucesso!", "success");
      await loadClients();
    } else {
      showToast(result.message || "Erro ao remover cliente", "error");
    }
  } catch (error) {
    console.error("Erro ao remover cliente:", error);
    showToast("Erro ao conectar com o servidor", "error");
  }
}

function filterClients() {
  const query = (document.getElementById("clientSearch")?.value || "")
    .trim()
    .toLowerCase();

  if (!query) {
    renderClients(clients);
    return;
  }

  const filtered = clients.filter((client) => {
    const banks = (client.integrations || []).map((i) => i.bank).join(" ");
    const apis = (client.integrations || [])
      .flatMap((i) => i.apis || [])
      .join(" ");
    const hay = [client.name, client.document, banks, apis]
      .join(" ")
      .toLowerCase();
    return hay.includes(query);
  });

  renderClients(filtered);
}

// ═══════════════════════════════════════════════════════════════════════════
// CERTIFICADOS - renderização, vencimentos cert, CRUD e filtros
// ═══════════════════════════════════════════════════════════════════════════

async function loadCertificates() {
  try {
    const response = await fetch(`${API_BASE}/certificados`, {
      headers: authHeaders(),
    });
    if (!response.ok) throw new Error("Erro ao carregar certificados");

    const data = await response.json();
    certificates = data.data || data || [];

    renderCertificates(certificates);
    updateStats();
  } catch (error) {
    console.error("Erro ao carregar certificados:", error);
    showToast("Erro ao carregar certificados", "error");
  }
}
// Retorna status do certificado com base na data de vencimento
function certificateStatus(expiresOn) {
  if (!expiresOn) return { label: "Sem data", cls: "badge-ghost" };

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const exp = new Date(expiresOn);
  const diffDays = Math.ceil((exp - today) / (1000 * 60 * 60 * 24));

  if (diffDays < 0) return { label: "Vencido", cls: "badge-error" };
  if (diffDays <= 30)
    return { label: `Vence em ${diffDays}d`, cls: "badge-warning" };
  return { label: "Em dia", cls: "badge-success" };
}

function renderCertificates(list) {
  const body = document.getElementById("certificatesBody");
  const empty = document.getElementById("certificatesEmpty");
  if (!body) return;

  if (!list.length) {
    body.innerHTML = "";
    empty?.classList.remove("hidden");
    return;
  }
  empty?.classList.add("hidden");

  body.innerHTML = list
    .map((cert) => {
      const client = clients.find((c) => c.id === cert.clientId);
      const status = certificateStatus(cert.expiresOn);

      return `
        <tr>
            <td>${escapeHtml(client?.name || "—")}</td>
            <td>${escapeHtml(cert.bank || "—")}</td>
            <td>${escapeHtml(cert.apiName || "—")}</td>
            <td>${escapeHtml(cert.label || "—")}</td>
            <td>${cert.expiresOn ? new Date(cert.expiresOn).toLocaleDateString("pt-BR") : "—"}</td>
            <td><span class="badge badge-sm ${status.cls}">${status.label}</span></td>
            <td class="api-actions">
                <button type="button" class="btn btn-xs btn-ghost" onclick="editCertificate('${cert.id}')" title="Editar">
                    <i class="fas fa-pen"></i>
                </button>
                <button type="button" class="btn btn-xs btn-ghost text-error" onclick="deleteCertificate('${cert.id}')" title="Excluir">
                    <i class="fas fa-trash"></i>
                </button>
            </td>
        </tr>`;
    })
    .join("");
}


function openCertificateModal() {
  const form = document.getElementById("certificateForm");
  form.reset();
  form.elements.id.value = "";

  populateClientSelect();

  const apiSelect = document.getElementById("certificateApi");
  if (apiSelect) {
    delete apiSelect.dataset.editingApiId;
    apiSelect.innerHTML =
      '<option value="">Selecione o cliente primeiro</option>';
  }

  document.getElementById("certificateDialogTitle").textContent =
    "Adicionar certificado";
  document.getElementById("certificateDialog").showModal();
}


function closeCertificateModal() {
  document.getElementById("certificateDialog").close();
}


function editCertificate(id) {
  const cert = certificates.find((c) => c.id === id);
  if (!cert) {
    showToast("Certificado não encontrado", "error");
    return;
  }

  openCertificateModal();

  const form = document.getElementById("certificateForm");
  form.elements.id.value = cert.id;
  form.elements.clientId.value = cert.clientId;
  form.elements.label.value = cert.label || "";
  form.elements.expiresOn.value = cert.expiresOn
    ? cert.expiresOn.slice(0, 10)
    : "";

  const apiSelect = document.getElementById("certificateApi");
  if (apiSelect) {
    apiSelect.dataset.editingApiId = cert.apiId;
    populateApiSelect();
    apiSelect.value = cert.apiId;
  }

  document.getElementById("certificateDialogTitle").textContent =
    "Editar certificado";
}

async function handleCertificateSubmit(e) {
  e.preventDefault();

  const form = e.target;
  const id = form.elements.id.value;

  const payload = {
    apiId: form.elements.apiId.value,
    label: form.elements.label.value.trim(),
    expiresOn: form.elements.expiresOn.value,
  };

  if (!payload.apiId || !payload.expiresOn) {
    showToast("Selecione a API e informe o vencimento", "warning");
    return;
  }

  const isEdit = !!id;
  const submitBtn = form.querySelector(
    'button[type="submit"], .modal-action button:not([type="button"])',
  );

  try {
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = "Salvando...";
    }

    const response = await fetch(
      `${API_BASE}/certificados${isEdit ? "/" + id : ""}`,
      {
        method: isEdit ? "PUT" : "POST",
        headers: authHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify(payload),
      },
    );

    const result = await response.json().catch(() => ({}));

    if (response.ok) {
      showToast(
        isEdit
          ? "Certificado atualizado com sucesso!"
          : "Certificado adicionado com sucesso!",
        "success",
      );
      closeCertificateModal();
      await loadCertificates();
    } else {
      showToast(
        result.message || result.error || "Erro ao salvar certificado",
        "error",
      );
    }
  } catch (error) {
    console.error("Erro ao salvar certificado:", error);
    showToast("Erro ao conectar com o servidor", "error");
  } finally {
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.textContent = "Salvar";
    }
  }
}

async function deleteCertificate(id) {
  if (!confirm("Tem certeza que deseja excluir este certificado?")) return;

  try {
    const response = await fetch(`${API_BASE}/certificados/${id}`, {
      method: "DELETE",
      headers: authHeaders(),
    });

    const result = await response.json().catch(() => ({}));

    if (response.ok) {
      showToast("Certificado removido com sucesso!", "success");
      await loadCertificates();
    } else {
      showToast(result.message || "Erro ao remover certificado", "error");
    }
  } catch (error) {
    console.error("Erro ao remover certificado:", error);
    showToast("Erro ao conectar com o servidor", "error");
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// AUXILIARES: popular selects e estatísticas dos modals
// ═══════════════════════════════════════════════════════════════════════════

function populateBankSelects() {
  const opts = BANKS.map(
    (b) => `<option value="${escapeHtml(b)}">${escapeHtml(b)}</option>`,
  ).join("");
  const clientBank = document.getElementById("clientBank");
  if (clientBank)
    clientBank.innerHTML = '<option value="">Selecione</option>' + opts;
}
// popula o select de cliente na aba de certificados
function populateClientSelect() {
  const select = document.getElementById("certificateClient");
  if (!select) return;

  select.innerHTML =
    '<option value="">Selecione</option>' +
    clients
      .map((c) => `<option value="${c.id}">${escapeHtml(c.name)}</option>`)
      .join("");
}

// Preenche o select de API (Banco — API) com base no cliente escolhido no modal de certificado.
function populateApiSelect() {
  const clientId = document.getElementById("certificateClient")?.value;
  const apiSelect = document.getElementById("certificateApi");
  if (!apiSelect) return;

  const client = clients.find((c) => c.id === clientId);
  const currentApiId = apiSelect.dataset.editingApiId || "";

  const options = [];
  (client?.integrations || []).forEach((integ) => {
    (integ.apis || []).forEach((api) => {
      if (api.certificateId && api.id !== currentApiId) return;
      options.push(
        `<option value="${api.id}">${escapeHtml(integ.bank)} — ${escapeHtml(api.name)}</option>`,
      );
    });
  });

  apiSelect.innerHTML = options.length
    ? '<option value="">Selecione</option>' + options.join("")
    : '<option value="">Nenhuma API disponível para este cliente</option>';
}

function updateStats() {
  const set = (id, val) => {
    const el = document.getElementById(id);
    if (el) el.textContent = val;
  };

// Calcula certificados vencidos e próximos do vencimento
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  let soon = 0,
    expired = 0;
  certificates.forEach((cert) => {
    if (!cert.expiresOn) return;
    const diffDays = Math.ceil(
      (new Date(cert.expiresOn) - today) / (1000 * 60 * 60 * 24),
    );
    if (diffDays < 0) expired++;
    else if (diffDays <= 30) soon++;
  });

  set("clientCount", clients.length);
  set("soonCount", soon);
  set("expiredCount", expired);
}
