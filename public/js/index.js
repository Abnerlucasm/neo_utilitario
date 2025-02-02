document.addEventListener('DOMContentLoaded', () => {
    // Carregar configurações salvas
    const userSettings = JSON.parse(localStorage.getItem('userSettings')) || {};
    
    // Configurar campos do modal com valores salvos
    document.getElementById('userNameInput').value = userSettings.userName || '';
    document.getElementById('themeSelect').value = userSettings.theme || 'light';
    
    // Aplicar tema inicial
    if (userSettings.theme === 'dark') {
        document.documentElement.setAttribute('data-theme', 'dark');
        document.body.classList.add('dark-theme');
    }
    
    // Salvar configurações quando o botão for clicado
    document.getElementById('saveSettings').addEventListener('click', () => {
        const userName = document.getElementById('userNameInput').value;
        const theme = document.getElementById('themeSelect').value;
        
        const settings = {
            userName: userName,
            theme: theme
        };
        
        localStorage.setItem('userSettings', JSON.stringify(settings));
        
        // Aplicar tema
        if (theme === 'dark') {
            document.documentElement.setAttribute('data-theme', 'dark');
            document.body.classList.add('dark-theme');
        } else {
            document.documentElement.setAttribute('data-theme', 'light');
            document.body.classList.remove('dark-theme');
        }
        
        // Fechar modal
        document.getElementById('userSettingsModal').classList.remove('is-active');
        
        // Mostrar mensagem de sucesso
        showToast('Configurações salvas com sucesso!', 'success');
    });
});

let deferredPrompt;

window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault(); // Prevenir que o mini-infobar apareça no navegador
    deferredPrompt = e; // Armazenar o evento para que possamos chamar `prompt()` depois
    const installContainer = document.getElementById('install-container');
    installContainer.style.display = 'block'; // Exibir o botão de instalação

    const installButton = document.getElementById('install-button');
    installButton.addEventListener('click', () => {
        installContainer.style.display = 'none'; // Esconder o botão de instalação
        deferredPrompt.prompt(); // Mostrar o prompt de instalação
        deferredPrompt.userChoice.then((choiceResult) => {
            if (choiceResult.outcome === 'accepted') {
                console.log('Usuário aceitou a instalação do PWA');
            } else {
                console.log('Usuário rejeitou a instalação do PWA');
            }
            deferredPrompt = null; // Limpar o evento
        });
    });
});

// Verificar se o aplicativo já está instalado
if (window.matchMedia('(display-mode: standalone)').matches) {
    const installContainer = document.getElementById('install-container');
    installContainer.style.display = 'none'; // Ocultar o botão se já estiver instalado
}