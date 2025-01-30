document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('configForm');

    // Carregar configurações existentes
    async function carregarConfiguracoes() {
        try {
            const response = await fetch('/config');
            const config = await response.json();
            
            // Preencher formulário com dados existentes
            Object.entries(config.conexao).forEach(([key, value]) => {
                const input = form.querySelector(`[name="conexao.${key}"]`);
                if (input) input.value = value;
            });

            Object.entries(config.paths).forEach(([key, value]) => {
                const input = form.querySelector(`[name="paths.${key}"]`);
                if (input) input.value = value;
            });
        } catch (error) {
            console.error('Erro ao carregar configurações:', error);
        }
    }

    // Salvar novas configurações
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const formData = new FormData(form);
        const config = {
            conexao: {},
            paths: {}
        };

        for (let [key, value] of formData.entries()) {
            const [tipo, campo] = key.split('.');
            config[tipo][campo] = value;
        }

        try {
            const response = await fetch('/config', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(config)
            });

            const result = await response.json();
            alert(result.message);
        } catch (error) {
            console.error('Erro ao salvar configurações:', error);
        }
    });

    carregarConfiguracoes();
});

    // Função para alternar a visibilidade da senha
    const togglePassword = document.getElementById("togglePassword");
    const password = document.getElementById("senha");
    const passwordIcon = document.getElementById("passwordIcon");

    togglePassword.addEventListener("click", function () {
        // Alterna o tipo de input entre 'password' e 'text'
        const type = password.type === "password" ? "text" : "password";
        password.type = type;

        // Alterna o ícone de olho
        const iconClass = password.type === "password" ? "fas fa-eye" : "fas fa-eye-slash";
        passwordIcon.className = iconClass;
    });