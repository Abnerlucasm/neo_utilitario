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