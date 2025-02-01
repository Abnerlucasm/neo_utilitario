class TabManager {
    constructor() {
        this.tabs = new Map();
        this.tabCounter = 0;
        this.init();
    }

    init() {
        const tabElements = document.querySelectorAll('.tabs li');
        const tabContentElements = document.querySelectorAll('.tab-content');

        if (!tabElements.length || !tabContentElements.length) {
            console.log('Elementos de tab não encontrados nesta página');
            return;
        }
        
        this.tabList = tabElements[0].parentNode;
        this.tabContent = tabContentElements[0];
    }

    addTab(title, content, isCloseable = true) {
        const tabId = `tab-${++this.tabCounter}`;
        
        // Criar aba
        const tab = document.createElement('li');
        tab.innerHTML = `
            <a href="#${tabId}">
                ${title}
                ${isCloseable ? '<button class="delete is-small ml-2"></button>' : ''}
            </a>
        `;
        
        // Criar conteúdo
        const contentDiv = document.createElement('div');
        contentDiv.id = tabId;
        contentDiv.className = 'tab-panel';
        contentDiv.style.display = 'none';
        contentDiv.innerHTML = content;
        
        this.tabList.appendChild(tab);
        this.tabContent.appendChild(contentDiv);
        
        this.tabs.set(tabId, { tab, contentDiv, title });
        
        // Eventos
        tab.querySelector('a').addEventListener('click', (e) => {
            e.preventDefault();
            this.activateTab(tabId);
        });
        
        if (isCloseable) {
            tab.querySelector('.delete').addEventListener('click', (e) => {
                e.stopPropagation();
                this.closeTab(tabId);
            });
        }
        
        // Ativar a nova aba
        this.activateTab(tabId);
    }

    activateTab(tabId) {
        // Desativar todas as abas primeiro
        this.tabs.forEach((value, key) => {
            value.tab.classList.remove('is-active');
            value.contentDiv.style.display = 'none';
        });

        // Ativar a aba selecionada
        const tab = this.tabs.get(tabId);
        if (tab) {
            tab.tab.classList.add('is-active');
            tab.contentDiv.style.display = 'block';
        }
    }

    closeTab(tabId) {
        const tab = this.tabs.get(tabId);
        if (!tab) return;
        
        tab.tab.remove();
        tab.contentDiv.remove();
        this.tabs.delete(tabId);
        
        // Ativar última aba
        const lastTab = Array.from(this.tabs.keys()).pop();
        if (lastTab) {
            this.activateTab(lastTab);
        }
    }
}

// Criar instância apenas se estivermos em uma página que usa tabs
if (document.querySelector('.tabs')) {
    new TabManager();
} 