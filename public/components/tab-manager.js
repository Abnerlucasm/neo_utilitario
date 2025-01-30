class TabManager {
    constructor() {
        this.tabs = new Map();
        this.tabCounter = 0;
        this.init();
    }

    init() {
        const tabList = document.querySelector('.tab-list');
        const tabContent = document.querySelector('.tab-content');
        
        if (!tabList || !tabContent) {
            console.error('Elementos de tab não encontrados');
            return;
        }
        
        this.tabList = tabList;
        this.tabContent = tabContent;
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

window.tabManager = new TabManager(); 