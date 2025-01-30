document.addEventListener('DOMContentLoaded', () => {
    const btnGlassfish = document.getElementById('btn-glassfish');
    const glassfishModal = document.getElementById('glassfish-modal');
    const modalCloseBtn = glassfishModal.querySelector('.delete');
    const btnReturnMain = document.getElementById('btn-return-main');
    const btnReturnPrevMenu = document.getElementById('btn-return-prev-menu');
    const btnExit = document.getElementById('btn-exit');
    const btnReturnMainGF = document.getElementById('btn-return-main-gf');

    // Show Glassfish Modal
    btnGlassfish.addEventListener('click', () => {
        glassfishModal.classList.add('is-active');
    });

    // Close Modal
    modalCloseBtn.addEventListener('click', () => {
        glassfishModal.classList.remove('is-active');
    });

    // Handle Glassfish Actions
    glassfishModal.querySelectorAll('.button[data-action]').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const action = e.target.dataset.action;
            executeAction(action);
        });
    });

    // Return to Main Menu from Glassfish Modal
    btnReturnMainGF.addEventListener('click', () => {
        glassfishModal.classList.remove('is-active');
    });

    // Navigation Buttons
    btnReturnPrevMenu.addEventListener('click', () => {
        window.location.href = 'utilitarios-corpweb.html';
    });

    btnReturnMain.addEventListener('click', () => {
        window.location.href = 'index.html';
    });

    btnExit.addEventListener('click', () => {
        alert('Aplicação encerrada.');
        window.close();
    });

    function executeAction(action) {
        let message;
        switch (action) {
            case 'start-without-debug':
                message = 'Glassfish iniciado sem debug.';
                break;
            case 'start-with-debug':
                message = 'Glassfish iniciado com debug.';
                break;
            case 'stop':
                message = 'Glassfish parado.';
                break;
            case 'restart':
                message = 'Glassfish reiniciado.';
                break;
            case 'open-domain':
                message = 'Domain aberto no navegador.';
                break;
            case 'clear-logs':
                message = 'Logs e sessões limpos.';
                break;
            case 'edit-config':
                message = 'Configurações de IP e Database editadas.';
                break;
            default:
                message = 'Ação não reconhecida.';
        }
        alert(message);
    }
});
