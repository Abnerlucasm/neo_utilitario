document.addEventListener('DOMContentLoaded', () => {
    // Inicializar userSettings primeiro
    if (!window.userSettings) {
        console.error('UserSettings não encontrado. Inicializando...');
        window.userSettings = new UserSettings();
    }

    // Função para abrir nova aba
    function openNewTab(title, url) {
        // Verifica se a tab já está aberta
        const existingTab = Array.from(window.tabManager.tabs.values())
            .find(tab => tab.url === url);
        
        if (existingTab) {
            window.tabManager.activateTab(existingTab.id);
            return;
        }

        // Carrega o conteúdo da página
        fetch(url)
            .then(response => {
                if (response.status === 404) {
                    return fetch('/404.html');
                } else if (response.status >= 500) {
                    return fetch('/500.html');
                } else if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
                return response;
            })
            .then(response => response.text())
            .then(content => {
                window.tabManager.addTab(title, content, true);
                // Atualiza a lista de abas abertas
                const openTabs = userSettings.getSetting('lastOpenedTabs') || [];
                openTabs.push({ title, url });
                // Mantém apenas as últimas 5 abas no histórico
                if (openTabs.length > 5) {
                    openTabs.shift();
                }
                userSettings.updateSetting('lastOpenedTabs', openTabs);
            })
            .catch(error => {
                console.error('Erro ao carregar página:', error);
                window.tabManager.addTab(`Erro - ${title}`, `
                    <div class="notification is-danger">
                        <h3 class="title is-4">Erro ao carregar página</h3>
                        <p>Ocorreu um erro ao tentar carregar "${title}".</p>
                        <p>Erro: ${error.message}</p>
                    </div>
                `, true);
            });
    }

    // Configurar botões de navegação
    const navigationButtons = {
        'btn-config': 'config.html',
        'btn-rotinas': 'rotinas.html',
        'btn-utilitarios': 'utilitarios.html',
        'btn-recursos-dev': 'recursos-dev.html',
        'btn-sugestoes-dev': 'sugestoes-dev.html'
    };

    // Adicionar event listeners para navegação
    Object.entries(navigationButtons).forEach(([id, url]) => {
        const button = document.getElementById(id);
        if (button) {
            button.addEventListener('click', () => window.location.href = url);
        }
    });

    // Configurar botão de configurações e modal
    setupUserSettingsModal();

    // Inicializar tema
    const savedTheme = userSettings.getSetting('theme') || 'light';
    updateTheme(savedTheme);

    // Mostrar saudação se houver nome salvo
    const userName = userSettings.getSetting('userName');
    if (userName) {
        const greetingElement = document.getElementById('greeting');
        if (greetingElement) {
            greetingElement.textContent = `${getGreeting()}, ${userName}!`;
        }
    }

    // Opcional: restaurar apenas a última aba aberta
    const lastOpenedTabs = userSettings.getSetting('lastOpenedTabs') || [];
    if (lastOpenedTabs.length > 0) {
        const lastTab = lastOpenedTabs[lastOpenedTabs.length - 1];
        openNewTab(lastTab.title, lastTab.url);
    }

    // Função de redirecionamento
    const redirectTo = (page) => {
        window.location.href = page;
    };

    // Adiciona os ouvintes de eventos para cada botão
    buttons.neoChamados.addEventListener('click', () => {
        window.open('https://app.neosistemas.com.br/neo-chamados/', '_blank');
    });
});

// Função para configurar o modal e seus event listeners
function setupUserSettingsModal() {
    // Botão que abre o modal
    const settingsButton = document.getElementById('openSettingsButton');
    if (settingsButton) {
        settingsButton.addEventListener('click', showSettingsModal);
    }

    // Botão Salvar
    const saveButton = document.getElementById('saveSettings');
    if (saveButton) {
        saveButton.addEventListener('click', () => {
            const input = document.getElementById('userNameInput');
            const themeSelect = document.getElementById('themeSelect');
            const newName = input.value.trim();
            
            if (newName) {
                userSettings.updateSetting('userName', newName);
                userSettings.updateSetting('theme', themeSelect.value);
                const greetingElement = document.getElementById('greeting');
                if (greetingElement) {
                    greetingElement.textContent = `${getGreeting()}, ${newName}!`;
                }
                updateTheme(themeSelect.value);
                closeModal();
            } else {
                showToast('Por favor, insira seu nome.');
            }
        });
    }

    // Botão Cancelar
    const cancelButton = document.getElementById('cancelSettings');
    if (cancelButton) {
        cancelButton.addEventListener('click', () => {
            closeModal();
        });
    }

    // Botão X (fechar) do modal
    const modalClose = document.querySelector('#userSettingsModal .modal-close');
    if (modalClose) {
        modalClose.addEventListener('click', () => {
            closeModal();
        });
    }

    // Background do modal
    const modalBackground = document.querySelector('#userSettingsModal .modal-background');
    if (modalBackground) {
        modalBackground.addEventListener('click', () => {
            closeModal();
        });
    }
}

function getGreeting() {
    const now = new Date();
    const hours = now.getHours();
    let greeting = '';

    if (hours >= 6 && hours < 12) {
        greeting = 'Bom dia';
    } else if (hours >= 12 && hours < 18) {
        greeting = 'Boa tarde';
    } else {
        greeting = 'Boa noite';
    }

    return greeting;
}

function showSettingsModal() {
    const modal = document.getElementById('userSettingsModal');
    const input = document.getElementById('userNameInput');
    const themeSelect = document.getElementById('themeSelect');

    if (modal && input && themeSelect) {
        input.value = userSettings.getSetting('userName') || '';
        themeSelect.value = userSettings.getSetting('theme') || 'light';
        modal.classList.add('is-active');
    }
}

function closeModal() {
    const modal = document.getElementById('userSettingsModal');
    if (modal) {
        modal.classList.remove('is-active');
    }
}

function showToast(message = 'Por favor, preencha todos os campos obrigatórios.') {
    const toast = document.getElementById('toast');
    const toastMessage = document.getElementById('toast-message');
    
    if (toastMessage) {
        toastMessage.textContent = message;
    }
    
    toast.classList.remove('is-hidden');
    setTimeout(function() {
        toast.classList.add('is-hidden');
    }, 3000); // O toast desaparecerá após 3 segundos
}

function hideToast() {
    const toast = document.getElementById('toast');
    toast.classList.add('is-hidden');
}

// Alteração de tema claro/escuro
const themeToggleButton = document.getElementById('theme-toggle');
const themeIcon = document.getElementById('theme-icon');

function updateTheme(theme) {
    try {
        document.body.classList.remove('light', 'dark');
        document.body.classList.add(theme);
        userSettings.updateSetting('theme', theme);
    } catch (error) {
        console.error('Erro ao atualizar tema:', error);
    }
}

// Adicionar função viewLogs
async function viewLogs(index) {
    try {
        const response = await fetch(`/api/servicos/glassfish/${index}/logs`);
        const data = await response.json();
        if (data.error) {
            alert(data.error);
            return;
        }
        document.getElementById('logs-content').textContent = data.logs;
        document.getElementById('logs-modal').classList.add('is-active');
    } catch (error) {
        console.error('Erro ao obter logs:', error);
        alert('Erro ao obter logs');
    }
}

function closeLogsModal() {
    document.getElementById('logs-modal').classList.remove('is-active');
}

async function saveGlassfish() {
    const name = document.getElementById('service-name').value;
    const ip = document.getElementById('service-ip').value;
    const port = document.getElementById('service-port').value;
    const domain = document.getElementById('service-domain').value;
    const password = document.getElementById('service-password').value;
    const status = document.getElementById('service-status').value;

    if (name && ip) {
        const service = { name, ip, port, domain, password, status };

        let response;
        if (editingIndex !== null) {
            const serviceId = services[editingIndex]._id;
            response = await fetch(`/api/servicos/glassfish/${serviceId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(service)
            });
        } else {
            response = await fetch('/api/servicos/glassfish', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(service)
            });
        }
        const result = await response.json();
        if (response.ok) {
            fetchServices();
            closeAddModal();
        } else {
            alert(result.error || 'Erro ao salvar serviço!');
        }
    } else {
        alert('Preencha todos os campos!');
    }
}
